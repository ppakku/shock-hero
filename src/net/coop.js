import Peer from 'peerjs';
import { makeRoomCode, peerIdFor, mergeInput } from '../logic/room.js';
import { sfx } from '../audio/sfx.js';

// 인터넷 함께하기 연결 (PeerJS). 화면과 상관없이 연결 상태만 들고 있다. 게임 전체에서 하나만 쓴다.
//
// 방장(host): 방 코드로 중개 서버에 이름을 올리고 친구를 기다린다. 친구가 들어오면
//   - 친구가 보내는 키를 input 에 모아 둔다 (GameScene 이 2P 를 움직일 때 읽는다)
//   - 게임 화면(canvas)을 영상으로 친구에게 보낸다
//   - 효과음 이름을 친구에게 보낸다 (친구 기기에서 직접 울린다)
// 친구(guest): 방 코드로 방장에게 붙고, 누른 키를 보내고, 받은 영상을 보여 준다.
//
// 주고받는 쪽지 (JSON):
//   친구 → 방장: { t: 'hello', hero }, { t: 'in', left, right, jumpDown, jumpPressed, ... }
//   방장 → 친구: { t: 'sfx', name }, { t: 'info', text }
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
    this.partner = null; // 방장 쪽: 친구 정보 { hero }
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

  // 방장이 읽은 뒤 한 번 누른 키를 지운다 (GameScene.readPartnerInput 이 부른다)
  takeInput() {
    const i = this.input;
    this.input = { ...i, jumpPressed: false, dashPressed: false, ultPressed: false };
    return i;
  }

  // ---------- 친구 ----------

  // 방 참여. hero: 내가 고른 주인공
  join(code, hero) {
    this.close();
    this.role = 'guest';
    this.status = 'connecting';
    this.code = code;
    const peer = new Peer();
    this.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(peerIdFor(code), { reliable: true });
      this.useConn(conn, () => conn.send({ t: 'hello', hero }));
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
        this.partner = { hero: typeof msg.hero === 'string' ? msg.hero : 'shock' };
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
