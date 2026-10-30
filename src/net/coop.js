import Peer from 'peerjs';
import { makeRoomCode, peerIdFor, mergeInput } from '../logic/room.js';
import { sfx } from '../audio/sfx.js';
import { cfg } from '../config/index.js';
import { cleanProfile } from '../logic/coopRewards.js';

// 인터넷 함께하기 연결 (PeerJS). 화면과 상관없이 연결 상태만 들고 있다. 게임 전체에서 하나만 쓴다.
//
// 방장(host): 방 코드로 중개 서버에 이름을 올리고 친구를 기다린다. 친구가 들어오면
//   - 친구가 보내는 키를 input 에 모아 둔다 (GameScene 이 2P 를 움직일 때 읽는다)
//   - 게임 화면(canvas)을 영상으로 친구에게 보낸다
//   - 효과음 이름을 친구에게 보낸다 (친구 기기에서 직접 울린다)
// 친구(guest): 방 코드로 방장에게 붙고, 누른 키를 보내고, 받은 영상을 보여 준다.
//
// 주고받는 쪽지 (JSON):
//   친구 → 방장: { t: 'hello', hero, level, xp, upgrades, shop }, { t: 'in', left, right, jumpDown, jumpPressed, ... }
//   방장 → 친구: { t: 'sfx', name }, { t: 'info', text }, { t: 'reward', kind, ... } (친구 기기에 저장할 보상),
//               { t: 'stage', n, name } (스테이지 시작: 친구 화면에 친구 조작법을 보여 준다),
//               { t: 'stage', versus: true, round } (겨루기 한 판 시작)
class Coop {
  constructor() {
    this.reset();
  }

  reset() {
    this.peer = null;
    this.conn = null;
    this.call = null;
    this.role = null; // 'host' | 'guest' | null
    this.code = null;
    this.partner = null; // 방장 쪽: 친구 정보 { hero, level, xp, upgrades, shop } (src/logic/coopRewards.js)
    this.input = {}; // 방장 쪽: 친구가 누르고 있는 키
    this.stream = null; // 친구 쪽: 받은 게임 화면 영상
    this.status = 'idle'; // 'idle' | 'waiting' | 'connecting' | 'connected' | 'closed'
    this.listeners = new Set();
  }

  // 방장이 친구와 이어져 있는지 (GameScene 이 2P 를 넣을지 정할 때)
  get hostConnected() {
    return this.role === 'host' && this.status === 'connected' && Boolean(this.partner);
  }

  // 상태가 바뀌면 부른다 (방 화면이 글자를 바꾼다). fn(event, data)
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event, data) {
    for (const fn of [...this.listeners]) fn(event, data);
  }

  // ---------- 방장 ----------

  // 방 만들기. 같은 코드가 이미 쓰이고 있으면 다른 코드로 몇 번 더 해 본다.
  // getCanvas: 친구에게 보낼 게임 화면 canvas 를 돌려주는 함수
  host(getCanvas, tries = 4) {
    this.close();
    this.role = 'host';
    this.status = 'waiting';
    this.getCanvas = getCanvas;
    sfx.onPlay = (name) => this.sendSfx(name);
    const code = makeRoomCode();
    this.code = code;
    const peer = new Peer(peerIdFor(code));
    this.peer = peer;
    peer.on('open', () => this.emit('code', code));
    peer.on('connection', (conn) => {
      if (this.conn) {
        conn.on('open', () => {
          conn.send({ t: 'info', text: '이 방은 이미 두 명이에요' });
          setTimeout(() => conn.close(), 300);
        });
        return;
      }
      this.useConn(conn);
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && tries > 1) return this.host(getCanvas, tries - 1);
      this.emit('error', errorText(err));
    });
    peer.on('disconnected', () => {
      // 중개 서버와만 끊긴 것: 친구와는 계속 이어져 있을 수 있다. 다시 붙어 둔다
      if (this.peer === peer && !peer.destroyed) peer.reconnect();
    });
  }

  // 친구에게 게임 화면을 영상으로 보낸다 (canvas 의 초당 30 장)
  sendScreen() {
    const canvas = this.getCanvas?.();
    if (!canvas?.captureStream || !this.conn) return;
    const stream = canvas.captureStream(30);
    this.call = this.peer.call(this.conn.peer, stream);
  }

  // 효과음을 친구에게 (방장 기기에서 소리를 껐어도 친구는 듣는다)
  sendSfx(name) {
    if (this.role === 'host' && this.status === 'connected') this.send({ t: 'sfx', name });
  }

  // 스테이지가 시작됐다고 친구에게
  sendStage(n, name) {
    if (this.hostConnected) this.send({ t: 'stage', n, name });
  }

  // 친구 화면에 안내 글자 (빈 글자면 지운다)
  sendInfo(text) {
    if (this.hostConnected) this.send({ t: 'info', text });
  }

  // 겨루기 한 판이 시작됐다고 친구에게
  sendVersusRound(round) {
    if (this.hostConnected) this.send({ t: 'stage', versus: true, round });
  }

  // 친구 기기에 저장할 보상 (보물, 경험치, 클리어). 친구가 받아서 자기 저장에 넣는다
  sendReward(msg) {
    if (this.hostConnected) this.send({ t: 'reward', ...msg });
  }

  // 방장이 읽은 뒤 한 번 누른 키를 지운다 (GameScene.readPartnerInput 이 부른다)
  takeInput() {
    const i = this.input;
    this.input = { ...i, jumpPressed: false, dashPressed: false, ultPressed: false };
    return i;
  }

  // 내가 다른 앱으로 넘어갔을 때(on) 와 돌아왔을 때 (main.js).
  // 방장: 게임이 멈추니 친구 화면에 이유를 알려 준다. 친구: 누르던 키를 다 뗀 걸로 보낸다 (2P 가 혼자 계속 걸어가지 않게).
  away(on) {
    if (this.status !== 'connected') return;
    if (this.role === 'host') this.send({ t: 'info', text: on ? '방장이 잠깐 다른 앱을 보고 있어요. 돌아올 때까지 기다려 주세요' : '' });
    else if (on) this.send({ t: 'in' });
  }

  // ---------- 친구 ----------

  // 방 참여. profile: 내 주인공과 성장 정보 (guestProfile)
  join(code, profile) {
    this.close();
    this.role = 'guest';
    this.status = 'connecting';
    this.code = code;
    const peer = new Peer();
    this.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(peerIdFor(code), { reliable: true });
      this.useConn(conn, () => conn.send({ t: 'hello', ...profile }));
    });
    peer.on('call', (call) => {
      this.call = call;
      call.answer(); // 친구는 영상을 보내지 않는다
      call.on('stream', (stream) => {
        this.stream = stream;
        this.emit('stream', stream);
      });
    });
    peer.on('error', (err) => this.emit('error', errorText(err)));
  }

  // 누른 키를 방장에게
  sendInput(input) {
    if (this.role === 'guest' && this.status === 'connected') this.send({ t: 'in', ...input });
  }

  // ---------- 공통 ----------

  useConn(conn, onOpen) {
    this.conn = conn;
    conn.on('open', () => {
      if (this.role === 'guest') {
        this.status = 'connected';
        this.emit('connected');
      }
      onOpen?.();
    });
    conn.on('data', (msg) => this.receive(msg));
    conn.on('close', () => this.lost(conn));
    conn.on('error', () => this.lost(conn));
  }

  receive(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (this.role === 'host') {
      if (msg.t === 'hello') {
        this.partner = cleanProfile(msg, cfg.upgrades.maxRank);
        this.status = 'connected';
        this.emit('connected', this.partner);
        this.sendScreen();
      } else if (msg.t === 'in') {
        this.input = mergeInput(this.input, msg);
      }
      return;
    }
    this.emit(msg.t, msg);
  }

  send(msg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  // 상대와 끊겼을 때. 방장은 같은 코드로 친구를 다시 기다린다
  lost(conn) {
    if (conn !== this.conn || this.status === 'idle') return;
    if (this.role === 'host') {
      try {
        this.call?.close();
      } catch {
        // 이미 끊긴 영상은 무시
      }
      this.conn = null;
      this.call = null;
      this.partner = null;
      this.input = {};
      this.status = 'waiting';
      this.emit('lost', 'host');
      return;
    }
    this.close();
    this.emit('lost', 'guest');
  }

  // 연결을 모두 끊고 처음 상태로 (듣는 사람 목록은 남긴다)
  close() {
    const listeners = this.listeners;
    try {
      this.call?.close();
      this.conn?.close();
      this.peer?.destroy();
    } catch {
      // 이미 끊긴 연결은 무시
    }
    this.reset();
    this.listeners = listeners;
    sfx.onPlay = null;
  }
}

// 연결 오류를 아이가 읽을 수 있는 말로
function errorText(err) {
  switch (err?.type) {
    case 'peer-unavailable':
      return '그 코드의 방을 찾을 수 없어요. 코드를 다시 확인해 주세요.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return '인터넷 연결이 불안정해요. 잠시 뒤 다시 해 주세요.';
    case 'browser-incompatible':
      return '이 브라우저에서는 함께하기를 할 수 없어요.';
    case 'unavailable-id':
      return '방을 만들지 못했어요. 다시 눌러 주세요.';
    default:
      return '연결하지 못했어요. 다시 해 주세요.';
  }
}

export const coop = new Coop();
