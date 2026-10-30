import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { coop } from '../net/coop.js';
import { countStat } from '../net/stats.js';
import { cleanCode, isRoomCode, CODE_LENGTH } from '../logic/room.js';
import { HERO_INFO, normalizeHero } from '../logic/heroes.js';
import { guestProfile } from '../logic/coopRewards.js';
import { isTouchDevice } from '../ui/touch.js';
import { makeText, FONT } from '../ui/text.js';

// 함께하기 방. 타이틀 위에 열린다.
//   방 만들기: 5 자리 코드가 나오고 친구를 기다린다. 친구가 들어오면 Enter 로 모험 지도를 열거나 (방장이 스테이지를 고른다),
//   V 로 겨루기를 시작한다 (5 판 3 선승 대결, src/logic/versus.js).
//   방 참여: 친구가 알려 준 코드를 넣고 Enter. 이어지면 방장 화면(src/scenes/GuestScene.js)으로 간다.
// Esc 로 한 단계 뒤로 (방을 닫거나 창을 닫는다).
export class RoomScene extends Phaser.Scene {
  constructor() {
    super('Room');
  }

  create() {
    this.touch = isTouchDevice();
    sfx.unlock(); // 친구 기기는 방장이 보낸 효과음을 여기서부터 낼 수 있다
    sfx.muted = saveStore.load().settings.muted;
    this.hero = normalizeHero(saveStore.load().settings.hero);
    this.add.rectangle(480, 270, 960, 540, 0x000000, 0.92).setInteractive();
    makeText(this, 480, 52, '함께하기', 40, '#7af0ff', { strokeThickness: 7 }).setOrigin(0.5);
    makeText(this, 480, 94, '친구와 인터넷으로 같이 해요. 한 명이 방을 만들고, 다른 한 명이 코드로 들어와요.', 16, '#dddddd').setOrigin(0.5);
    this.box = this.add.container(0, 0);
    this.msg = makeText(this, 480, 470, '', 18, '#ffd23f').setOrigin(0.5);
    this.help = makeText(this, 480, 510, '', 15, '#cccccc').setOrigin(0.5);
    const close = makeText(this, 900, 44, '닫기 ✕', 20, '#ffffff', { backgroundColor: '#5a1020', padding: { x: 10, y: 6 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.back());

    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => this.back());
    kb.on('keydown-ENTER', () => this.enter());
    kb.on('keydown-ONE', () => this.mode === 'menu' && this.startHost());
    kb.on('keydown-TWO', () => this.mode === 'menu' && this.showJoin());
    kb.on('keydown-V', () => this.mode === 'host' && this.openVersus());

    this.off = coop.on((event, data) => this.onCoop(event, data));
    this.events.once('shutdown', () => {
      this.off();
      this.input_?.destroy();
    });
    // 이미 방장으로 친구와 이어져 있으면 그 화면부터
    if (coop.role === 'host' && coop.status !== 'idle') this.showHost();
    else this.showMenu();
  }

  clearBox() {
    this.box.removeAll(true);
    this.input_?.destroy();
    this.input_ = null;
    this.msg.setText('');
  }

  // 큰 버튼 하나 (철판)
  button(x, y, label, sub, color, fn) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x1c2028, 0.95).fillRoundedRect(-170, -60, 340, 120, 16);
    g.lineStyle(4, Phaser.Display.Color.HexStringToColor(color).color, 1).strokeRoundedRect(-170, -60, 340, 120, 16);
    const t = makeText(this, 0, -14, label, 30, color, { strokeThickness: 6 }).setOrigin(0.5);
    const s = makeText(this, 0, 28, sub, 15, '#dddddd').setOrigin(0.5);
    c.add([g, t, s]);
    c.setSize(340, 120).setInteractive({ useHandCursor: true }).on('pointerdown', fn);
    this.box.add(c);
    return c;
  }

  // ---------- 처음: 방 만들기 / 방 참여 ----------

  showMenu() {
    this.mode = 'menu';
    this.clearBox();
    this.button(290, 270, '방 만들기', '코드를 만들어 친구에게 알려 줘요', '#ffd23f', () => this.startHost());
    this.button(670, 270, '방 참여', '친구가 알려 준 코드를 넣어요', '#7af0ff', () => this.showJoin());
    this.help.setText(this.touch ? '버튼을 눌러 고르세요' : '1: 방 만들기    2: 방 참여    Esc: 닫기');
  }

  // ---------- 방장 ----------

  startHost() {
    sfx.play('beep');
    coop.host(() => this.game.canvas);
    countStat('coop-host');
    this.showHost();
  }

  showHost() {
    this.mode = 'host';
    this.clearBox();
    this.codeText = makeText(this, 480, 230, coop.code && coop.peer?.open ? spaced(coop.code) : '······', 72, '#ffffff', {
      strokeThickness: 10,
      fontFamily: `monospace, ${FONT}`,
    }).setOrigin(0.5);
    const label = makeText(this, 480, 160, '방 코드', 22, '#ffd23f').setOrigin(0.5);
    this.hostState = makeText(this, 480, 320, '', 20, '#ffffff', { align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    this.box.add([label, this.codeText, this.hostState]);
    this.paintHost();
  }

  paintHost() {
    if (this.mode !== 'host') return;
    const ready = Boolean(coop.code && coop.peer?.open);
    this.codeText.setText(ready ? spaced(coop.code) : '······');
    if (coop.hostConnected) {
      const name = HERO_INFO[normalizeHero(coop.partner.hero)]?.name ?? '친구';
      this.hostState.setText(`친구가 들어왔어요! (2P: ${name})\n같이 모험하거나, 5 판 3 선승으로 겨뤄 봐요`).setColor('#3ff07a');
      this.help.setText(this.touch ? '아래 글자를 누르면 시작해요' : 'Enter: 모험 지도 열기    V: 겨루기    Esc: 방 닫기');
      if (!this.goBtn) {
        const go = (x, label, color, fn) =>
          makeText(this, x, 410, label, 26, color, { strokeThickness: 6 })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', fn);
        this.goBtn = go(310, '▶ 모험 지도 열기', '#ffb21f', () => this.openMap());
        this.versusBtn = go(660, '▶ 겨루기', '#ff8a6a', () => this.openVersus());
        this.box.add([this.goBtn, this.versusBtn]);
      }
      return;
    }
    this.goBtn?.destroy();
    this.versusBtn?.destroy();
    this.goBtn = null;
    this.versusBtn = null;
    this.hostState
      .setText(ready ? '친구에게 이 코드를 알려 주세요.\n친구를 기다리는 중...' : '방을 만드는 중...')
      .setColor('#ffffff');
    this.help.setText(this.touch ? '닫기를 누르면 방이 없어져요' : 'Esc: 방 닫기');
  }

  openMap() {
    if (!coop.hostConnected) return;
    sfx.play('beep');
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeRoom?.(true);
  }

  openVersus() {
    if (!coop.hostConnected) return;
    sfx.play('beep');
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeRoom?.('versus');
  }

  // ---------- 친구 ----------

  showJoin() {
    sfx.play('beep');
    this.mode = 'join';
    this.clearBox();
    const label = makeText(this, 480, 160, '친구가 알려 준 방 코드 5 자리', 22, '#7af0ff').setOrigin(0.5);
    this.box.add(label);
    // 글자 칸은 진짜 입력 상자 (태블릿에서 글자판이 뜬다)
    this.input_ = this.add.dom(480, 240, 'input', {
      width: '330px',
      height: '76px',
      fontSize: '56px',
      fontFamily: 'monospace',
      textAlign: 'center',
      letterSpacing: '12px',
      textTransform: 'uppercase',
      borderRadius: '12px',
      border: '4px solid #7af0ff',
      background: '#10141c',
      color: '#ffffff',
      outline: 'none',
    });
    const el = this.input_.node;
    el.maxLength = CODE_LENGTH + 2;
    el.autocomplete = 'off';
    el.autocapitalize = 'characters';
    el.spellcheck = false;
    el.placeholder = '·····';
    el.addEventListener('input', () => {
      const v = cleanCode(el.value);
      if (el.value !== v) el.value = v;
    });
    el.addEventListener('keydown', (e) => e.stopPropagation()); // 글자를 칠 때 다른 단축키가 움직이지 않게
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.enter();
      if (e.key === 'Escape') this.back();
    });
    setTimeout(() => el.focus(), 50);
    const go = makeText(this, 480, 340, '▶ 들어가기', 28, '#ffb21f', { strokeThickness: 6 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.enter());
    this.box.add(go);
    this.help.setText(this.touch ? '코드를 넣고 들어가기를 누르세요' : 'Enter: 들어가기    Esc: 뒤로');
  }

  tryJoin() {
    const code = cleanCode(this.input_?.node.value);
    if (!isRoomCode(code)) {
      sfx.play('beep');
      this.say('코드 5 자리를 다 넣어 주세요', '#ff9a8a');
      return;
    }
    sfx.play('beep');
    this.mode = 'connecting';
    this.say('방장에게 연결하는 중...', '#ffffff');
    coop.join(code, guestProfile(saveStore.load()));
  }

  // ---------- 연결 소식 ----------

  onCoop(event, data) {
    if (event === 'code' || event === 'connected' || event === 'lost') {
      if (this.mode === 'host') {
        if (event === 'connected') sfx.play('powerup');
        if (event === 'lost') this.say('친구 연결이 끊겼어요. 같은 코드로 다시 들어올 수 있어요.', '#ff9a8a');
        this.paintHost();
        return;
      }
      if (event === 'connected' && coop.role === 'guest') {
        countStat('coop-join');
        sfx.play('powerup');
        this.scene.stop('Title');
        this.scene.stop();
        this.scene.start('Guest');
      }
      return;
    }
    if (event === 'error') {
      if (this.mode === 'connecting') this.mode = 'join';
      this.say(data, '#ff9a8a');
    }
    if (event === 'info') this.say(data.text, '#ff9a8a');
  }

  say(text, color) {
    this.msg.setText(text).setColor(color);
  }

  enter() {
    if (this.mode === 'menu') return this.startHost();
    if (this.mode === 'host') return this.openMap();
    if (this.mode === 'join') return this.tryJoin();
  }

  // Esc: 방장은 방을 닫고, 참여 화면은 처음으로, 처음 화면이면 창을 닫는다
  back() {
    sfx.play('beep');
    if (this.mode === 'host' || this.mode === 'join' || this.mode === 'connecting') {
      coop.close();
      this.showMenu();
      return;
    }
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeRoom?.(false);
  }
}

// 'K7Q2M' → 'K 7 Q 2 M' (멀리서도 읽기 쉽게)
const spaced = (code) => code.split('').join(' ');
