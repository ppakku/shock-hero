import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { coop } from '../net/coop.js';
import { CONTROL_KEYS, attackButtonLabel, controlLines } from '../logic/controls.js';
import { normalizeHero } from '../logic/heroes.js';
import { HELD_KEYS, TAP_KEYS } from '../logic/room.js';
import { applyGuestReward } from '../logic/coopRewards.js';
import { cfg } from '../config/index.js';
import { getStage, stages } from '../stage/index.js';
import { isTouchDevice, touchPad, touchPoints, TOUCH_BUTTONS, drawTouchButtons, labelFontSize } from '../ui/touch.js';
import { makeText } from '../ui/text.js';

const KEY = Phaser.Input.Keyboard.KeyCodes;

// 함께하기 친구(2P) 화면. 게임은 방장 기기에서 돌고, 여기서는
//   - 방장이 보내 주는 게임 화면 영상을 보여 주고
//   - 내가 누른 키(키보드, 마우스, 태블릿 화면 버튼)를 방장에게 보내고
//   - 방장이 보낸 효과음 이름으로 소리를 낸다.
//   - 방장이 보낸 보상(보물, 경험치, 클리어)을 내 저장에 적는다.
// Esc (태블릿은 오른쪽 위 나가기) 로 방에서 나간다.
export class GuestScene extends Phaser.Scene {
  constructor() {
    super('Guest');
  }

  create() {
    const save = saveStore.load();
    this.touch = isTouchDevice();
    this.cameras.main.setBackgroundColor('#000000');
    this.video = null;
    this.wait = makeText(this, 480, 250, '방장 화면을 기다리는 중...\n방장이 모험 지도에서 스테이지를 고르면 같이 시작해요', 22, '#ffffff', {
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5);
    this.note = makeText(this, 480, 300, '', 18, '#ff9a8a').setOrigin(0.5).setDepth(50);
    // 방장 화면 위쪽 체력은 방장 것이라, 내 체력이 어디인지 알려 준다
    this.hpHint = makeText(this, 936, 114, '▲ 내 체력 (2P)', 12, '#ffd23f').setOrigin(1, 0.5).setDepth(60);
    // 친구 화면에는 일시정지가 없다 (Esc 는 방에서 나가기)
    this.setControls(save.settings.hero);
    this.leaveAskAt = -9999;
    this.helpBox = null;
    const leave = makeText(this, 916, 140, '나가기', 16, '#ffffff', { backgroundColor: '#5a1020aa', padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setDepth(60)
      .setInteractive({ useHandCursor: true });
    leave.on('pointerdown', () => this.askLeave());

    // 내 조작 방식 키 (방장 쪽 GameScene 과 같은 이름)
    const scheme = CONTROL_KEYS[save.settings.controls] || CONTROL_KEYS.classic;
    this.keys = {};
    for (const [action, names] of Object.entries(scheme)) this.keys[action] = names.map((n) => this.input.keyboard.addKey(KEY[n]));
    this.input.keyboard.on('keydown-ESC', () => this.askLeave());
    this.input.mouse?.disableContextMenu();
    touchPad.reset();
    if (this.touch) {
      this.padG = this.add.graphics().setDepth(40);
      const hero = normalizeHero(save.settings.hero);
      this.padLabels = TOUCH_BUTTONS.map((b) => {
        const label = b.id === 'attack' ? attackButtonLabel(hero) : b.label;
        return makeText(this, b.x, b.y, label, labelFontSize(b, label), '#ffffff')
          .setOrigin(0.5)
          .setDepth(41);
      });
    }

    this.last = '';
    this.sentAt = 0;
    this.off = coop.on((event, data) => this.onCoop(event, data));
    this.events.once('shutdown', () => this.off());
    if (coop.stream) this.showStream(coop.stream);
  }

  onCoop(event, data) {
    if (event === 'stream') this.showStream(data);
    else if (event === 'sfx') sfx.play(data.name);
    else if (event === 'info') this.note.setText(data.text);
    else if (event === 'reward') this.takeReward(data);
    else if (event === 'stage') this.showControls(data);
    else if (event === 'lost') this.showLost();
  }

  // 내 주인공에 맞는 조작법 글 (친구 화면에는 일시정지가 없다)
  setControls(hero) {
    const save = saveStore.load();
    this.controls = controlLines(this.touch ? 'touch' : save.settings.controls, hero).map((l) =>
      l.replace('일시정지 Esc', '방에서 나가기 Esc 두 번').replace(/\s*일시정지 오른쪽 위 II/, ''),
    );
  }

  // 겨루기에서 저장과 다른 주인공을 골랐을 때: 조작법 글과 공격 버튼 이름을 바꾼다
  useHero(hero) {
    this.setControls(hero);
    if (!this.padLabels) return;
    const label = attackButtonLabel(normalizeHero(hero));
    TOUCH_BUTTONS.forEach((b, i) => {
      if (b.id === 'attack') this.padLabels[i].setText(label).setFontSize(labelFontSize(b, label));
    });
  }

  // 방장 화면 영상을 화면 가득 (영상 크기가 정해지면 960 x 540 에 맞춘다)
  showStream(stream) {
    if (!this.video) {
      this.video = this.add.video(480, 270).setDepth(0);
      this.video.on(Phaser.GameObjects.Events.VIDEO_CREATED, (v) => v.setDisplaySize(960, 540));
    }
    this.video.loadMediaStream(stream, true);
    this.video.play();
    this.wait.setVisible(false);
  }

  // 스테이지가 시작되면 내 조작법을 잠깐 (안내판과 볼트 대사는 방장 키 이름으로 나오니까)
  showControls(msg) {
    if (msg.versus) {
      this.hpHint.setY(82); // 겨루기 체력바는 맨 위에 있다
      this.note.setText('');
      this.useHero(msg.hero);
    }
    if (msg.versus && msg.round > 1) return; // 겨루기는 첫 판에만 알려 준다
    this.helpBox?.destroy();
    const title = msg.versus ? '겨루기 시작! 나는 2P, 내 조작법:' : `스테이지 ${Number(msg.n) || ''} 시작! 나는 2P, 내 조작법:`;
    this.helpBox = makeText(this, 480, 400, [title, ...this.controls].join('\n'), 15, '#ffffff', {
      align: 'center',
      lineSpacing: 6,
      backgroundColor: '#000000bb',
      padding: { x: 14, y: 10 },
    })
      .setOrigin(0.5)
      .setDepth(56);
    const box = this.helpBox;
    this.tweens.add({ targets: box, alpha: 0, delay: msg.versus ? cfg.versus.countdown * 1000 : 7000, duration: 500, onComplete: () => box.destroy() });
  }

  // 보상을 내 저장에 넣고, 화면 아래에 잠깐 알려 준다
  takeReward(msg) {
    const n = Number(msg.stage);
    const stage = Number.isInteger(n) && n >= 1 && n <= stages.length ? getStage(n) : null;
    const r = applyGuestReward(saveStore.load(), msg, stage, cfg);
    if (Object.keys(r.patch).length) saveStore.update(r.patch);
    if (!r.text) return;
    const t = makeText(this, 480, 112, `내 기록: ${r.text}`, 20, '#7af0ff', { backgroundColor: '#000000aa', padding: { x: 10, y: 5 } })
      .setOrigin(0.5)
      .setDepth(55);
    this.toasts = (this.toasts || []).filter((o) => o.active);
    t.y += this.toasts.length * 34; // 여러 개가 겹치지 않게 아래로 쌓기 (방장의 결과 화면 글자보다 위쪽에)
    this.toasts.push(t);
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
  }

  showLost() {
    this.video?.stop();
    this.video?.setVisible(false);
    this.wait.setText('방장과 연결이 끊겼어요.\nEsc 를 누르거나 나가기를 눌러 타이틀로 돌아가요').setVisible(true);
  }

  // 지금 누른 키 (방장 GameScene.readInput 과 같은 모양)
  readInput() {
    const k = this.keys;
    const down = (a) => k[a].some((key) => key.isDown);
    const justDown = (a) => k[a].map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    const m = this.input.mousePointer;
    const mouseDown = !!m && m.isDown && m.leftButtonDown() && !m.wasTouch;
    const t = this.touch ? touchPad.poll(touchPoints(this)) : { down: {}, pressed: {} };
    return {
      left: down('left') || !!t.down.left,
      right: down('right') || !!t.down.right,
      upDown: down('up') || !!t.down.up,
      jumpDown: down('jump') || !!t.down.jump,
      jumpPressed: justDown('jump') || !!t.pressed.jump,
      attackDown: down('attack') || mouseDown || !!t.down.attack,
      dashPressed: justDown('dash') || !!t.pressed.dash,
      ultPressed: justDown('ult') || !!t.pressed.ult,
    };
  }

  update(time) {
    const input = this.readInput();
    if (this.touch) {
      this.padG.clear();
      drawTouchButtons(this.padG, this.padLabels, touchPad);
    }
    // 바뀌었을 때, 한 번 누른 키가 있을 때, 그리고 0.2 초마다 (쪽지 하나가 사라져도 키가 붙어 있지 않게) 보낸다
    const held = HELD_KEYS.map((key) => (input[key] ? 1 : 0)).join('');
    const tapped = TAP_KEYS.some((key) => input[key]);
    if (held !== this.last || tapped || time - this.sentAt > 200) {
      this.last = held;
      this.sentAt = time;
      coop.sendInput(input);
    }
  }

  // 실수로 나가지 않게: 2 초 안에 한 번 더 누르면 나간다 (연결이 끊겼으면 바로)
  askLeave() {
    if (coop.status !== 'connected' || this.time.now - this.leaveAskAt < 2000) return this.leave();
    this.leaveAskAt = this.time.now;
    sfx.play('beep');
    this.note.setText('한 번 더 누르면 방에서 나가요');
    this.time.delayedCall(2000, () => this.note.text === '한 번 더 누르면 방에서 나가요' && this.note.setText(''));
  }

  leave() {
    sfx.play('beep');
    coop.close();
    this.scene.start('Title');
  }
}
