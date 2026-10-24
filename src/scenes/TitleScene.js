import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { makeText, formatTime, FONT } from '../ui/text.js';
import { saveStore } from '../save.js';
import { resetProgress } from '../logic/save.js';
import { stages, totalTreasures } from '../stage/index.js';
import { DIFFICULTIES, DIFFICULTY_INFO } from '../logic/difficulty.js';
import { CONTROL_SCHEMES, CONTROL_INFO } from '../logic/controls.js';
import { makeTitleTextures, photoTexture, drawCape, TITLE_FONT } from '../ui/titleArt.js';
import { cardLayout, tokenizeControlLine, photoKind, cardTilt, CARD_W, CARD_H } from '../ui/titleLayout.js';

// 타이틀: 스테이지 고르기 + 설정(난이도, 조작, 레벨 초기화)
// ↑ ↓ 로 줄을 옮기고, ← → 로 고르고, Enter 로 시작하거나 바꾼다. 마우스로 눌러도 된다.
// 그림은 흑백 만화 느낌 (회색 하늘, 연기, 불타는 도시, 옥상 위 주인공). 그림 그리는 코드는 src/ui/titleArt.js

// 제목 글꼴(Black Han Sans, index.html 에서 불러옴)을 기다린다. 첫 화면부터 글꼴이 맞게 나오도록.
// 2.5초 안에 못 받으면 기본 글꼴로 그린다.
let fontReady = null; // true / false (다 기다렸을 때)
let fontWait = null;
const NUM_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

function fontSample() {
  const names = [...Object.values(DIFFICULTY_INFO), ...Object.values(CONTROL_INFO)].map((d) => d.name);
  return [
    '쇼크 히어로 몬스터 브레이커 스테이지 0123456789 보물 / : 잠김 Enter 시작 체크포인트부터 이어하기 ↑ 키 고르기로 돌아가기',
    '난이도 조작 레벨 초기화 ( ) + ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...names,
  ].join(' ');
}

function waitTitleFont() {
  if (!fontWait) {
    fontWait = (async () => {
      if (!document.fonts || !document.fonts.load) return false;
      const deadline = Date.now() + 2500;
      const sample = fontSample();
      while (Date.now() < deadline) {
        try {
          const faces = await document.fonts.load(`40px ${TITLE_FONT}`, sample);
          if (faces.length) return true;
        } catch {
          // 글꼴 주소를 못 받으면 잠깐 뒤에 다시
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      return false;
    })().then((ok) => (fontReady = ok));
  }
  return fontWait;
}

// 제목 글꼴로 쓴 글자 (못 받았으면 기본 글꼴 굵게)
function brushText(scene, x, y, str, size, color, extra = {}) {
  return scene.add.text(x, y, str, {
    fontFamily: fontReady ? `${TITLE_FONT}, ${FONT}` : FONT,
    fontStyle: fontReady ? 'normal' : 'bold',
    fontSize: `${size}px`,
    color,
    stroke: '#000000',
    strokeThickness: Math.max(3, Math.round(size / 5)),
    align: 'center',
    ...extra,
  });
}

// 배경 불꽃 자리 [x, 바닥 y, 크기, 뒤집기]
const FLAMES = [
  [655, 246, 0.9, false],
  [700, 238, 0.7, true],
  [742, 240, 0.5, false],
  [930, 240, 0.85, true],
  [960, 244, 0.6, false],
  [14, 252, 0.6, true],
  [10, 392, 0.7, false],
  [950, 396, 0.6, true],
];
const HERO = { x: 822, y: 239, scale: 1 };

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.showAll = new URLSearchParams(window.location.search).has('all');
    this.started = false;
    this.confirming = false;
    this.ready = false;
    this.selected = 0;
    this.row = 0; // 0: 스테이지 줄, 1: 설정 줄
    this.option = 0; // 설정 줄에서 고른 버튼 (0 난이도, 1 조작, 2 초기화)
    this.cameras.main.setBackgroundColor('#30353d');
    if (fontReady === null) waitTitleFont().then(() => this.sys.isActive() && !this.ready && this.build());
    else this.build();

    const kb = this.input.keyboard;
    const on = (keys, fn) => keys.forEach((k) => kb.on(`keydown-${k}`, fn));
    on(['LEFT', 'A'], () => this.move(-1));
    on(['RIGHT', 'D'], () => this.move(1));
    on(['UP', 'W'], () => this.setRow(0));
    on(['DOWN', 'S'], () => this.setRow(1));
    NUM_KEYS.slice(0, stages.length).forEach((k, i) => kb.on(`keydown-${k}`, () => !this.confirming && this.select(i + 1)));
    on(['ENTER', 'SPACE'], () => this.activate());
    kb.on('keydown-N', () => {
      if (!this.ready) return;
      if (this.confirming) this.closeConfirm();
      else if (this.row === 0) this.begin(false);
    });
    kb.on('keydown-Y', () => this.confirming && this.doReset());
    kb.on('keydown-ESC', () => this.confirming && this.closeConfirm());
  }

  // 화면을 (다시) 그린다. 설정을 바꾸거나 초기화하면 다시 부른다.
  build() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    makeTitleTextures(this, fontReady);
    this.ready = true;
    const save = saveStore.load();
    this.save = save;
    const firstPick = save.checkpoint || save.unlocked;
    if (this.showAll) save.unlocked = stages.length; // 주소에 ?all: 모든 스테이지 열기 (테스트용, 저장은 안 바뀜)
    if (!this.selected || this.selected > save.unlocked) this.selected = firstPick;
    const { width } = this.scale;

    this.drawScenery();

    // 제목과 부제
    this.add.image(300, 60, 'tt-title').setDepth(10);
    this.add.image(330, 122, 'tt-sub').setDepth(11).setAngle(-2);

    // 조작법 철판
    const scheme = CONTROL_INFO[save.settings.controls] || CONTROL_INFO.classic;
    this.drawControls(scheme.lines);

    // 스테이지 카드
    const layout = cardLayout(stages.length, { top: 254, margin: 28 });
    this.cards = stages.map((st, i) => this.makeCard(st, i, layout));

    // 설정 버튼 줄 (빨간 낙서, 파란 테이프, 회색 철판)
    const d = DIFFICULTY_INFO[save.settings.difficulty];
    const c = CONTROL_INFO[save.settings.controls];
    const specs = [
      { text: `난이도: ${d.name}`, tex: 'tt-btn-paint', color: '#ffffff', angle: -2 },
      { text: `조작: ${c.name}`, tex: 'tt-btn-tape', color: '#ffffff', angle: 1 },
      { text: '레벨 초기화', tex: 'tt-btn-steel', color: '#ffb0a4', angle: -1 },
    ];
    const xs = [width / 2 - 285, width / 2, width / 2 + 285];
    this.buttons = specs.map((s, i) => {
      const box = this.add.container(xs[i], 459).setDepth(20).setAngle(s.angle);
      const ring = this.add.graphics();
      ring.lineStyle(4, 0xffe14a, 1).strokeRoundedRect(-128, -22, 256, 44, 8);
      const img = this.add.image(0, 0, s.tex);
      const label = brushText(this, 0, 0, s.text, 18, s.color).setOrigin(0.5);
      if (label.width > 220) label.setScale(220 / label.width);
      box.add([ring, img, label]);
      box.setSize(250, 44).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.confirming) return;
        this.row = 1;
        this.option = i;
        this.press(i);
      });
      return { box, ring };
    });
    this.optionHelp = makeText(this, width / 2, 492, '', 14, '#dddddd').setOrigin(0.5).setDepth(20);

    // Enter: 시작 (주황 노랑 글자 + 양옆 불꽃)
    this.startText = brushText(this, width / 2, 400, '', 28, '#ffb21f', { strokeThickness: 6 }).setOrigin(0.5).setDepth(21);
    this.startFlames = [0, 1].map((side) =>
      this.add.image(0, 414, 'tt-flame0').setOrigin(0.5, 1).setScale(0.42).setFlipX(side === 1).setDepth(20),
    );
    this.startFlames.forEach((f, k) => this.flicker(f, 0.42, k));
    this.tweens.add({ targets: this.startText, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.subText = makeText(this, width / 2, 425, '', 14, '#ffffff').setOrigin(0.5).setDepth(20);

    const info = [`레벨 ${save.level}`, `보물 ${save.treasures.length}/${totalTreasures}`];
    if (save.bestTimes[stages.length]) info.push('모든 스테이지 클리어!');
    makeText(this, width / 2, 521, info.join('   '), 16, '#dddddd').setOrigin(0.5).setDepth(20);

    if (this.sys.game.device.input.touch && !this.sys.game.device.os.desktop) {
      makeText(this, width / 2, 6, '지금은 키보드가 있는 컴퓨터에서 할 수 있어요', 15, '#ff9a1f').setOrigin(0.5, 0).setDepth(30);
    }

    // 레벨 초기화 확인 창 (철판)
    this.confirmBox = this.add.container(0, 0).setDepth(50).setVisible(this.confirming);
    const bg = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.75).setInteractive();
    const plate = this.add.image(480, 262, 'tt-plate').setDisplaySize(660, 200);
    const msg = this.add
      .text(480, 230, '정말 처음부터 다시 할까요?\n레벨, 경험치, 보물, 스테이지 기록이 모두 지워져요.', {
        fontFamily: FONT,
        fontStyle: 'bold',
        fontSize: '21px',
        color: '#15171a',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    const yes = brushText(this, 390, 308, 'Y: 지우기', 26, '#ff6a5a').setOrigin(0.5).setInteractive({ useHandCursor: true });
    const no = brushText(this, 570, 308, 'N: 취소', 26, '#3ff07a').setOrigin(0.5).setInteractive({ useHandCursor: true });
    yes.on('pointerdown', () => this.doReset());
    no.on('pointerdown', () => this.closeConfirm());
    this.confirmBox.add([bg, plate, msg, yes, no]);

    this.refresh();
  }

  // 배경: 하늘과 도시(한 장 그림), 흘러가는 연기, 일렁이는 불꽃, 불티, 옥상 위 주인공
  drawScenery() {
    this.add.image(0, 0, 'tt-bg').setOrigin(0).setDepth(0);
    this.smokes = [
      [40, 150, 'tt-smoke0', 1.1, 7],
      [430, 120, 'tt-smoke1', 1.2, 5],
      [610, 205, 'tt-smoke0', 0.9, 9],
      [250, 210, 'tt-smoke1', 0.8, 6],
      [880, 150, 'tt-smoke1', 1, 8],
    ].map(([x, y, key, s, speed]) => {
      const img = this.add.image(x, y, key).setScale(s).setAlpha(0.92).setDepth(1);
      img.speed = speed;
      return img;
    });

    FLAMES.forEach(([x, y, s, flip], k) => {
      const f = this.add.image(x, y, `tt-flame${k % 3}`).setOrigin(0.5, 1).setScale(s).setFlipX(flip).setDepth(2);
      this.flicker(f, s, k);
    });
    // 불꽃 그림 세 장을 돌려 가며 바꿔 끼운다 (일렁임)
    let tick = 0;
    this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        tick++;
        this.children.list.forEach((o, k) => {
          if (o.texture && o.texture.key.startsWith('tt-flame')) o.setTexture(`tt-flame${(tick + k) % 3}`);
        });
      },
    });

    // 불티: 불 위로 천천히 올라가는 작은 불씨
    const ember = (zone) =>
      this.add
        .particles(0, 0, 'tt-ember', {
          emitZone: { type: 'random', source: zone },
          lifespan: { min: 1800, max: 3200 },
          speedY: { min: -55, max: -22 },
          speedX: { min: -8, max: 22 },
          scale: { start: 1, end: 0.3 },
          alpha: { start: 0.95, end: 0 },
          frequency: 160,
        })
        .setDepth(5);
    ember(new Phaser.Geom.Rectangle(630, 170, 330, 70));
    ember(new Phaser.Geom.Rectangle(0, 110, 600, 60));

    this.capeG = this.add.graphics().setDepth(3);
    this.add.image(HERO.x, HERO.y, 'tt-hero').setOrigin(0.5, 226 / 230).setScale(HERO.scale).setDepth(4);
    this.drawCapeNow(0);

    // 만화 망점 (위쪽 하늘과 연기에만 살짝)
    this.add.tileSprite(0, 0, 960, 250, 'tt-dots').setOrigin(0).setAlpha(0.07).setDepth(6);
  }

  // 불꽃이 위아래로 살짝 늘었다 줄었다 (깜빡임 없이 부드럽게)
  flicker(img, s, k) {
    this.tweens.add({
      targets: img,
      scaleY: { from: s * 0.88, to: s * 1.08 },
      scaleX: { from: s, to: s * 0.94 },
      duration: 280 + ((k * 73) % 200),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  drawCapeNow(t) {
    const sx = HERO.x + (112 - 75) * HERO.scale; // 오른쪽 어깨
    const sy = HERO.y - (226 - 60) * HERO.scale;
    drawCape(this.capeG, sx, sy, t);
  }

  update(time, delta) {
    if (!this.ready || !this.capeG || !this.capeG.active) return;
    this.drawCapeNow(time / 1000);
    const dt = delta / 1000;
    this.smokes.forEach((s) => {
      s.x += s.speed * dt;
      if (s.x - s.displayWidth / 2 > 980) s.x = -s.displayWidth / 2 - 20;
    });
  }

  // 조작법: 철판 위에 글자와 키보드 버튼 모양
  drawControls(lines) {
    const cx = 340;
    const cy = 196;
    this.add.image(cx, cy, 'tt-plate').setDepth(10);
    const innerW = 580;
    const step = Math.min(24, 72 / Math.max(1, lines.length));
    lines.forEach((line, li) => {
      const y = cy + (li - (lines.length - 1) / 2) * step;
      const row = this.add.container(cx, y).setDepth(11);
      const parts = [];
      let x = 0;
      tokenizeControlLine(line).forEach((tok, i) => {
        if (i > 0) x += tok.wide ? 20 : 5;
        if (tok.type === 'key') {
          const label = this.add.text(0, 0, tok.text, { fontFamily: FONT, fontStyle: 'bold', fontSize: '13px', color: '#15171a' }).setOrigin(0.5);
          const w = Math.max(20, label.width + 10);
          const g = this.add.graphics();
          g.fillStyle(0x3c3f44, 1).fillRoundedRect(0, -9, w, 21, 4);
          g.fillStyle(0xf1f2f3, 1).fillRoundedRect(0, -10, w, 18, 4);
          g.lineStyle(1.5, 0x111214, 1).strokeRoundedRect(0, -10, w, 21, 4);
          parts.push({ objs: [g, label], x, w, key: true });
          x += w;
        } else {
          const t = this.add.text(0, 0, tok.text, { fontFamily: FONT, fontStyle: 'bold', fontSize: '15px', color: '#15171a' }).setOrigin(0, 0.5);
          parts.push({ objs: [t], x, w: t.width });
          x += t.width;
        }
      });
      const total = x;
      parts.forEach((p) => {
        const left = p.x - total / 2;
        if (p.key) {
          p.objs[0].x = left;
          p.objs[1].x = left + p.w / 2;
          p.objs[1].y = -1;
        } else p.objs[0].x = left;
        row.add(p.objs);
      });
      if (total > innerW) row.setScale(innerW / total);
    });
  }

  // 스테이지 카드 한 장: 종이에 핀으로 꽂은 흑백 사진
  makeCard(st, i, layout) {
    const n = i + 1;
    const save = this.save;
    const { x, y } = layout.positions[i];
    const locked = n > save.unlocked;
    const found = st.treasures.filter((t) => save.treasures.includes(t.id)).length;
    const best = save.bestTimes[n];
    const box = this.add.container(x, y).setDepth(15).setAngle(cardTilt(i)).setScale(layout.scale);
    const glow = this.add.image(0, 0, 'tt-card-glow');
    const paper = this.add.image(0, 0, 'tt-card-paper');
    const green = this.add.image(0, 0, 'tt-card-green').setVisible(false);
    const title = brushText(this, 0, -40, `스테이지 ${n}`, 17, '#1b1b1b', { strokeThickness: 0 }).setOrigin(0.5);
    // 사진 (하얀 테두리, 그림자)
    const frame = this.add.graphics();
    frame.fillStyle(0x000000, 0.35).fillRect(-52, -26, 108, 60);
    frame.fillStyle(0xf4f2ec, 1).fillRect(-55, -29, 108, 60);
    frame.lineStyle(1, 0x555555, 1).strokeRect(-55, -29, 108, 60);
    const photo = this.add.image(-1, 1, photoTexture(this, photoKind(st, i))).setDisplaySize(100, 55);
    const caption = this.add.rectangle(-1, 22, 100, 13, 0x000000, 0.55);
    const name = this.add
      .text(-1, 22, st.name, { fontFamily: FONT, fontStyle: 'bold', fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5);
    const pin = this.add.image(42, -28, 'tt-pin');
    const treasure = brushText(this, 0, 41, `보물 ${found}/${st.treasures.length}${best ? `  ${formatTime(best)}` : ''}`, 14, '#1b1b1b', {
      strokeThickness: 0,
    }).setOrigin(0.5);
    const parts = [glow, paper, green, frame, photo, caption, name, pin, title, treasure];
    if (locked) {
      photo.setTint(0x555555);
      caption.setVisible(false);
      name.setVisible(false);
      treasure.setVisible(false);
      const shade = this.add.rectangle(0, 0, CARD_W - 6, CARD_H - 6, 0x000000, 0.5);
      const lockG = this.add.graphics();
      lockG.lineStyle(4, 0xcfcfcf, 1).strokeCircle(0, 2, 8);
      lockG.fillStyle(0xcfcfcf, 1).fillRoundedRect(-12, 4, 24, 18, 3);
      lockG.fillStyle(0x333333, 1).fillCircle(0, 12, 3);
      const stamp = brushText(this, 0, 40, '잠김', 18, '#d4d4d4').setOrigin(0.5);
      title.setColor('#b8b8b8');
      parts.push(shade, lockG, stamp);
      parts.splice(parts.indexOf(title), 1);
      parts.push(title);
    }
    box.add(parts);
    box.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: !locked }).on('pointerdown', () => {
      if (locked || this.confirming) return;
      this.row = 0;
      if (this.selected === n) this.begin(this.canContinue);
      else this.select(n);
    });
    glow.setVisible(false);
    return { box, locked, glow, paper, green, title, treasure, caption, baseScale: layout.scale };
  }

  get canContinue() {
    return this.save.checkpoint === this.selected;
  }

  setRow(r) {
    if (this.confirming || !this.ready) return;
    this.row = r;
    this.refresh();
  }

  move(dir) {
    if (this.confirming || !this.ready) return;
    if (this.row === 0) this.select(this.selected + dir);
    else {
      this.option = Phaser.Math.Clamp(this.option + dir, 0, 2);
      this.refresh();
    }
  }

  select(n) {
    if (!this.ready || n < 1 || n > stages.length || n > this.save.unlocked) return;
    this.selected = n;
    this.refresh();
  }

  activate() {
    if (this.confirming || !this.ready) return;
    if (this.row === 0) this.begin(this.canContinue);
    else this.press(this.option);
  }

  // 설정 버튼 누르기: 난이도와 조작은 다음 것으로 바뀌고, 초기화는 확인 창을 띄운다
  press(i) {
    const s = this.save.settings;
    if (i === 2) {
      this.confirming = true;
      this.confirmBox.setVisible(true);
      return;
    }
    if (i === 0) {
      const next = DIFFICULTIES[(DIFFICULTIES.indexOf(s.difficulty) + 1) % DIFFICULTIES.length];
      saveStore.update({ settings: { ...s, difficulty: next } });
    } else {
      const next = CONTROL_SCHEMES[(CONTROL_SCHEMES.indexOf(s.controls) + 1) % CONTROL_SCHEMES.length];
      saveStore.update({ settings: { ...s, controls: next } });
    }
    sfx.unlock();
    sfx.muted = s.muted;
    sfx.play('beep');
    this.build();
  }

  closeConfirm() {
    this.confirming = false;
    this.confirmBox.setVisible(false);
  }

  doReset() {
    saveStore.save(resetProgress(saveStore.load()));
    this.confirming = false;
    this.selected = 1;
    this.row = 0;
    this.build();
    const done = makeText(this, 480, 492, '처음부터 새로 시작해요! 레벨 1, 보물 0개', 18, '#ffd23f').setOrigin(0.5).setDepth(60);
    this.optionHelp.setVisible(false);
    this.time.delayedCall(1800, () => {
      done.destroy();
      this.optionHelp.setVisible(true);
    });
  }

  refresh() {
    const n = this.selected;
    this.cards.forEach((c, i) => {
      const picked = i + 1 === n;
      const on = this.row === 0 && picked;
      c.green.setVisible(picked);
      c.paper.setVisible(!picked);
      c.glow.setVisible(on);
      if (!c.locked) {
        c.title.setColor(picked ? '#ffe14a' : '#1b1b1b').setStroke('#000000', picked ? 4 : 0);
        c.treasure.setColor(picked ? '#ffffff' : '#1b1b1b').setStroke('#000000', picked ? 4 : 0);
      }
      c.box.setScale(c.baseScale * (picked ? 1.07 : 1)).setDepth(picked ? 16 : 15);
    });
    this.buttons.forEach((b, i) => {
      const on = this.row === 1 && this.option === i;
      b.ring.setVisible(on);
      b.box.setScale(on ? 1.06 : 1);
    });
    const helps = [
      DIFFICULTY_INFO[this.save.settings.difficulty].desc,
      '키보드 조작 방식을 바꿔요. 위의 조작법 설명도 바로 바뀌어요.',
      '레벨과 보물을 모두 지우고 처음부터 다시 쌓아요.',
    ];
    this.optionHelp.setText(this.row === 1 ? `${helps[this.option]}  (Enter 또는 클릭으로 바꾸기)` : '↓ 키를 누르면 난이도, 조작, 레벨 초기화를 고를 수 있어요');
    this.startText.setText(this.canContinue ? `Enter: 스테이지 ${n} 체크포인트부터 이어하기` : `Enter: 스테이지 ${n} 시작`);
    if (this.row === 1) this.startText.setText('↑ 키: 스테이지 고르기로 돌아가기');
    this.paintStartText();
    this.subText.setText(
      this.row === 1
        ? ''
        : [this.save.unlocked > 1 ? '← → 또는 숫자로 스테이지 고르기' : '', this.canContinue ? 'N: 처음부터' : ''].filter(Boolean).join('    '),
    );
  }

  // 시작 글자를 노랑에서 주황으로 물들이고, 불꽃을 글자 양옆에 붙인다
  paintStartText() {
    const t = this.startText;
    const grad = t.context.createLinearGradient(0, 0, 0, t.height);
    grad.addColorStop(0.15, '#fff07a');
    grad.addColorStop(0.55, '#ffb21f');
    grad.addColorStop(1, '#ff5a1a');
    t.setFill(grad);
    const half = t.width / 2;
    this.startFlames[0].x = t.x - half * 1.05 - 22;
    this.startFlames[1].x = t.x + half * 1.05 + 22;
  }

  begin(fromCheckpoint) {
    if (this.started || this.confirming || !this.ready) return;
    this.started = true;
    sfx.unlock();
    sfx.muted = this.save.settings.muted;
    if (!fromCheckpoint) saveStore.update({ checkpoint: null });
    this.registry.set('runTime', 0);
    this.scene.start('Game', { stage: this.selected, fromCheckpoint });
    this.scene.launch('HUD');
  }
}
