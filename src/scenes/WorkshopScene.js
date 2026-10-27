import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { stages } from '../stage/index.js';
import { PLAYERS } from '../logic/rush.js';
import { fixJosa } from '../logic/heroes.js';
import {
  MAX_DESIGNS,
  NAME_MAX,
  INTRO_MAX,
  LOOKS,
  COLORS,
  SIZES,
  MOVES,
  cleanText,
  randomName,
  newDesign,
  normalizeWorkshop,
  saveDesign,
  removeDesign,
  lookUnlocked,
  stageChoices,
} from '../logic/workshop.js';
import { ensureWorkshopTexture } from '../fx/workshopTextures.js';
import { isTouchDevice } from '../ui/touch.js';
import { makeText, FONT } from '../ui/text.js';
import { TITLE_FONT } from '../ui/titleArt.js';
import { customArt } from '../config/art.js';
import { portraitArt } from '../logic/stageArt.js';
import { queueArt, finishArt } from '../fx/artLoader.js';

// 몬스터 공방. 타이틀 위에 열리고, 닫으면 타이틀을 다시 그린다.
// 위: 작품 칸 세 개 (빈 칸을 누르면 새로 만든다). 왼쪽: 만든 몬스터가 움직이는 모습과 이름, 소개. 오른쪽: 고르는 줄 여섯 개.
// 바꾸면 바로 저장된다. 화살표 위아래로 줄, 왼쪽 오른쪽으로 바꾸기, N: 이름 쓰기, Enter: 그 스테이지에서 만나기, Esc 또는 M: 닫기.
const INK = 0x10161c;
const SLOT_Y = 88;
const VIEW = { x: 26, y: 120, w: 420, h: 210 };
const ROW_X = 470;
const ROW_Y = 132;
const ROW_H = 50;
const ROW_W = 466;
const PREVIEW_ZOOM = 2.1;

const ROWS = [
  { id: 'look', label: '생김새' },
  { id: 'color', label: '색' },
  { id: 'size', label: '크기' },
  { id: 'move', label: '움직임' },
  { id: 'maker', label: '작가' },
  { id: 'stage', label: '나오는 곳' },
];

export class WorkshopScene extends Phaser.Scene {
  constructor() {
    super('Workshop');
  }

  // 생김새 그림 (도감에서 잡은 것까지 전부. 이미 받은 그림은 다시 안 받는다)
  preload() {
    queueArt(this, portraitArt(LOOKS.map((l) => l.id), customArt));
  }

  create() {
    finishArt(this);
    this.touch = isTouchDevice();
    this.row = 0;
    this.slot = 0;
    this.deleteArmed = false;
    this.inputs = [];

    this.add.rectangle(480, 270, 960, 540, 0x0b0e14, 1).setInteractive().on('pointerdown', () => this.blurInputs());
    this.add
      .text(26, 18, '몬스터 공방', { fontFamily: `${TITLE_FONT}, ${FONT}`, fontSize: '36px', color: '#7af0a0', stroke: '#000000', strokeThickness: 7 })
      .setOrigin(0, 0);
    makeText(this, 236, 38, '나만의 몬스터를 만들면 고른 스테이지에 나와요!', 15, '#dddddd').setOrigin(0, 0.5);
    const close = makeText(this, 900, 38, '닫기 ✕', 20, '#ffffff', { backgroundColor: '#5a1020', padding: { x: 10, y: 6 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.close());

    this.slots = [];
    for (let i = 0; i < MAX_DESIGNS; i++) this.slots.push(this.makeSlot(i));
    this.makeView();
    this.rows = ROWS.map((r, i) => this.makeRow(r, i));
    this.moveDesc = makeText(this, ROW_X + 12, ROW_Y + ROWS.length * ROW_H - 12, '', 14, '#bbbbbb').setOrigin(0, 0.5);

    // 아래 버튼: 지우기, 그 스테이지에서 만나기
    this.delBtn = makeText(this, VIEW.x + 70, 482, '', 17, '#ffffff', { backgroundColor: '#6a1a1a', padding: { x: 14, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.delBtn.on('pointerdown', () => this.remove());
    this.goBtn = makeText(this, ROW_X + ROW_W / 2, 482, '', 22, '#1a1408', { backgroundColor: '#7af0a0', padding: { x: 20, y: 9 }, stroke: '#000000', strokeThickness: 0 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.goBtn.on('pointerdown', () => this.go());
    this.note = makeText(this, 480, 448, '', 16, '#ffe14a').setOrigin(0.5).setDepth(20);

    const help = this.touch
      ? '◀ ▶ 를 눌러 바꿔요. 바꾸면 바로 저장돼요.'
      : '↑ ↓: 고를 줄    ← →: 바꾸기    N: 이름 쓰기    1 2 3: 작품 칸    Enter: 만나러 가기    Esc: 닫기';
    makeText(this, 480, 526, help, 14, '#aaaaaa').setOrigin(0.5);

    const kb = this.input.keyboard;
    const once = (fn) => (e) => {
      if (!e?.repeat) fn();
    };
    const on = (keys, fn) => keys.forEach((k) => kb.on(`keydown-${k}`, once(fn)));
    on(['UP', 'W'], () => this.pickRow(this.row - 1));
    on(['DOWN', 'S'], () => this.pickRow(this.row + 1));
    on(['LEFT', 'A'], () => this.change(-1));
    on(['RIGHT', 'D'], () => this.change(1));
    on(['N'], () => this.design && this.nameInput.focus());
    on(['ONE'], () => this.pickSlot(0));
    on(['TWO'], () => this.pickSlot(1));
    on(['THREE'], () => this.pickSlot(2));
    on(['ENTER', 'SPACE'], () => this.go());
    on(['ESC', 'M'], () => this.close());

    this.events.once('shutdown', () => this.removeInputs());
    this.refresh();
    this.cameras.main.fadeIn(120);
  }

  get workshop() {
    return normalizeWorkshop(saveStore.load().workshop, stages.length);
  }

  // 지금 고른 칸의 작품 (빈 칸이면 null)
  get design() {
    return this.workshop.designs[this.slot] || null;
  }

  // ---------- 만들기 ----------

  makeSlot(i) {
    const c = this.add.container(26 + i * 206, SLOT_Y);
    const bg = this.add.graphics();
    const label = makeText(this, 100, 0, '', 16, '#ffffff').setOrigin(0.5);
    c.add([bg, label]);
    c.setSize(200, 36).setInteractive(new Phaser.Geom.Rectangle(0, -18, 200, 36), Phaser.Geom.Rectangle.Contains);
    c.input.cursor = 'pointer';
    c.on('pointerdown', () => this.pickSlot(i));
    return { c, bg, label };
  }

  makeView() {
    const g = this.add.graphics();
    const { x, y, w, h } = VIEW;
    g.fillStyle(INK, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 16);
    g.fillStyle(0x223048, 1).fillRoundedRect(x, y, w, h, 13);
    // 공방 벽 줄무늬와 바닥
    for (let k = 0; k < 7; k++) g.fillStyle(0x1c2840, 1).fillRect(x + 20 + k * 60, y + 10, 26, h - 60);
    g.fillStyle(0x5a4630, 1).fillRect(x, y + h - 44, w, 44);
    g.fillStyle(0x3a2c1c, 1).fillRect(x, y + h - 44, w, 5);
    this.floorY = y + h - 42;
    this.pet = this.add.sprite(x + w / 2, this.floorY, '__DEFAULT').setOrigin(0.5, 1);
    this.petName = makeText(this, x + w / 2, y + 22, '', 20, '#ffe14a').setOrigin(0.5);
    this.petMaker = makeText(this, x + w - 12, y + h - 22, '', 14, '#ffffff').setOrigin(1, 0.5);
    this.empty = makeText(this, x + w / 2, y + h / 2 - 10, '', 20, '#cccccc', { lineSpacing: 8 }).setOrigin(0.5);

    // 이름과 소개 쓰는 칸 (진짜 글자 칸을 화면 위에 띄운다: 태블릿 자판이 나오게)
    this.nameLabel = makeText(this, x, 352, '이름', 16, '#ffe14a').setOrigin(0, 0.5);
    this.introLabel = makeText(this, x, 398, '소개', 16, '#ffe14a').setOrigin(0, 0.5);
    this.nameInput = this.makeInput(x + 52, 336, 280, 32, NAME_MAX, '몬스터 이름', (v) => this.edit({ name: v || '이름 없는 몬스터' }));
    this.introInput = this.makeInput(x + 52, 382, w - 52, 32, INTRO_MAX, '어떤 몬스터인지 한 줄로 (도감에 나와요)', (v) => this.edit({ intro: v }));
    this.dice = makeText(this, x + w - 40, 352, '🎲 이름', 15, '#ffffff', { backgroundColor: '#2a3040', padding: { x: 8, y: 5 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.dice.on('pointerdown', () => {
      if (!this.design) return;
      const name = randomName();
      this.edit({ name });
      this.nameInput.value = name;
    });
  }

  makeRow(r, i) {
    const y = ROW_Y + i * ROW_H;
    const c = this.add.container(ROW_X, y);
    const bg = this.add.graphics();
    const label = makeText(this, 14, 0, r.label, 17, '#ffe14a').setOrigin(0, 0.5);
    const value = makeText(this, 300, 0, '', 18, '#ffffff').setOrigin(0.5);
    const swatch = this.add.graphics();
    const left = makeText(this, 140, 0, '◀', 22, '#ffffff').setOrigin(0.5).setInteractive({ useHandCursor: true });
    const right = makeText(this, ROW_W - 26, 0, '▶', 22, '#ffffff').setOrigin(0.5).setInteractive({ useHandCursor: true });
    left.on('pointerdown', () => {
      this.pickRow(i, true);
      this.change(-1);
    });
    right.on('pointerdown', () => {
      this.pickRow(i, true);
      this.change(1);
    });
    c.add([bg, label, swatch, value, left, right]);
    c.setSize(ROW_W, ROW_H - 6).setInteractive(new Phaser.Geom.Rectangle(0, -(ROW_H - 6) / 2, 120, ROW_H - 6), Phaser.Geom.Rectangle.Contains);
    c.on('pointerdown', () => this.pickRow(i));
    return { ...r, c, bg, label, value, swatch, left, right };
  }

  // 화면 위에 띄우는 글자 칸. 게임 화면 크기가 바뀌면 따라 움직인다
  makeInput(x, y, w, h, max, placeholder, onChange) {
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = max;
    el.placeholder = placeholder;
    el.autocomplete = 'off';
    el.spellcheck = false;
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: 20,
      boxSizing: 'border-box',
      border: '3px solid #10161c',
      borderRadius: '8px',
      background: '#f4ecd8',
      color: '#1a1408',
      fontFamily: FONT,
      fontWeight: 'bold',
      padding: '0 8px',
      outline: 'none',
    });
    const place = () => {
      const rect = this.game.canvas.getBoundingClientRect();
      const k = rect.width / 960;
      Object.assign(el.style, {
        left: `${rect.left + x * k}px`,
        top: `${rect.top + y * k}px`,
        width: `${w * k}px`,
        height: `${h * k}px`,
        fontSize: `${Math.round(16 * k)}px`,
      });
    };
    place();
    // 글자 칸에 쓰는 동안은 게임 키를 끈다 (A, D, 띄어쓰기가 게임으로 가지 않게)
    el.addEventListener('focus', () => {
      this.game.input.keyboard.enabled = false;
      el.style.borderColor = '#ffe14a';
    });
    el.addEventListener('blur', () => {
      this.game.input.keyboard.enabled = true;
      el.style.borderColor = '#10161c';
      onChange(cleanText(el.value, max));
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) el.blur();
      e.stopPropagation();
    });
    el.addEventListener('input', () => {
      if (!el.matches(':focus')) return;
      onChange(cleanText(el.value, max));
    });
    document.body.appendChild(el);
    window.addEventListener('resize', place);
    this.scale.on('resize', place);
    this.inputs.push({ el, place });
    return el;
  }

  blurInputs() {
    for (const { el } of this.inputs) el.blur();
  }

  removeInputs() {
    for (const { el, place } of this.inputs) {
      el.blur();
      el.remove();
      window.removeEventListener('resize', place);
    }
    this.inputs = [];
    this.game.input.keyboard.enabled = true;
  }

  // ---------- 고르기 ----------

  pickSlot(i) {
    this.blurInputs();
    this.deleteArmed = false;
    const w = this.workshop;
    if (i !== this.slot) sfx.play('cardMove');
    // 빈 칸: 새 작품을 바로 만든다 (무작위 이름과 색으로 시작)
    if (!w.designs[i]) {
      i = w.designs.length; // 빈 칸은 앞에서부터 채운다
      const d = { ...newDesign(w.next), name: randomName(), color: COLORS[1 + Math.floor(Math.random() * (COLORS.length - 1))].id };
      saveStore.update({ workshop: saveDesign(w, d, stages.length) });
      this.note.setText('새 몬스터를 만들었어요! 마음대로 바꿔 보세요.');
      sfx.play('coin');
    } else this.note.setText('');
    this.slot = i;
    this.refresh();
  }

  pickRow(i, silent = false) {
    if (i < 0 || i >= ROWS.length) return;
    if (i !== this.row && !silent) sfx.play('cardMove');
    this.row = i;
    this.refresh();
  }

  // 지금 줄에서 고를 수 있는 값들
  choices(id) {
    const save = saveStore.load();
    if (id === 'look') return LOOKS.filter((l) => lookUnlocked(l, save.dex)).map((l) => l.id);
    if (id === 'color') return COLORS.map((c) => c.id);
    if (id === 'size') return SIZES.map((s) => s.id);
    if (id === 'move') return MOVES.map((m) => m.id);
    if (id === 'maker') return PLAYERS;
    return stageChoices(save, stages);
  }

  change(dir) {
    const d = this.design;
    if (!d) return this.pickSlot(this.slot);
    const id = ROWS[this.row].id;
    const list = this.choices(id);
    const at = list.indexOf(d[id]);
    const next = list[(Math.max(0, at) + dir + list.length) % list.length];
    if (next === d[id]) return;
    sfx.play('cardMove');
    this.edit({ [id]: next });
  }

  edit(patch) {
    const d = this.design;
    if (!d) return;
    this.deleteArmed = false;
    saveStore.update({ workshop: saveDesign(this.workshop, { ...d, ...patch }, stages.length) });
    this.refresh();
  }

  remove() {
    const d = this.design;
    if (!d) return;
    if (!this.deleteArmed) {
      this.deleteArmed = true;
      sfx.play('locked');
      this.note.setText(fixJosa(`정말 지울까요? 한 번 더 누르면 ${d.name}(이)가 사라져요.`));
      this.refresh();
      return;
    }
    this.deleteArmed = false;
    saveStore.update({ workshop: removeDesign(this.workshop, d.id) });
    sfx.play('break');
    this.note.setText(fixJosa(`${d.name}(을)를 지웠어요.`));
    this.slot = Math.max(0, Math.min(this.slot, this.workshop.designs.length - 1));
    this.refresh();
  }

  // 고른 스테이지로 바로 가서 만나 보기
  go() {
    const d = this.design;
    if (!d) return this.pickSlot(this.slot);
    sfx.play('beep');
    this.removeInputs();
    this.scene.get('Title').startWorkshopStage(d.stage);
  }

  close() {
    sfx.play('beep');
    this.removeInputs();
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeWorkshop?.();
  }

  // ---------- 그리기 ----------

  valueText(id, d) {
    if (id === 'look') return LOOKS.find((l) => l.id === d.look)?.name;
    if (id === 'color') return COLORS.find((c) => c.id === d.color)?.name;
    if (id === 'size') return SIZES.find((s) => s.id === d.size)?.name;
    if (id === 'move') return MOVES.find((m) => m.id === d.move)?.name;
    if (id === 'maker') return d.maker;
    return `스테이지 ${d.stage} ${stages[d.stage - 1]?.name || ''}`;
  }

  refresh() {
    const w = this.workshop;
    const d = w.designs[this.slot] || null;
    this.slots.forEach((s, i) => {
      const e = w.designs[i];
      const on = i === this.slot && Boolean(d);
      s.bg.clear();
      s.bg.fillStyle(INK, 1).fillRoundedRect(-2, -20, 204, 40, 10);
      s.bg.fillStyle(on ? 0x7af0a0 : e ? 0x2c3a4c : 0x1c222c, 1).fillRoundedRect(0, -18, 200, 36, 8);
      const free = !e && i === w.designs.length;
      s.label.setText(e ? `${i + 1}. ${e.name}` : free ? '＋ 새로 만들기' : '빈 칸');
      s.label.setColor(on ? '#1a1408' : e ? '#ffffff' : free ? '#7af0a0' : '#555555').setStroke('#000000', on ? 0 : 3);
      s.c.setVisible(Boolean(e) || free);
    });

    const show = Boolean(d);
    [this.pet, this.petName, this.petMaker, this.nameLabel, this.introLabel, this.dice, this.delBtn, this.goBtn, this.moveDesc].forEach((o) => o.setVisible(show));
    for (const { el } of this.inputs) el.style.display = show ? 'block' : 'none';
    this.rows.forEach((r) => r.c.setVisible(show));
    this.empty.setText(show ? '' : '아직 만든 몬스터가 없어요.\n위의 ＋ 새로 만들기를 눌러 보세요!');
    if (!show) return;

    // 글자 칸 (쓰는 중이면 건드리지 않는다)
    if (document.activeElement !== this.nameInput) this.nameInput.value = d.name === '이름 없는 몬스터' ? '' : d.name;
    if (document.activeElement !== this.introInput) this.introInput.value = d.intro;

    const save = saveStore.load();
    const looksOpen = LOOKS.filter((l) => lookUnlocked(l, save.dex)).length;
    this.rows.forEach((r, i) => {
      const on = i === this.row;
      r.bg.clear();
      r.bg.fillStyle(INK, 1).fillRoundedRect(-2, -(ROW_H - 6) / 2 - 2, ROW_W + 4, ROW_H - 2, 10);
      r.bg.fillStyle(on ? 0x34465e : 0x222a36, 1).fillRoundedRect(0, -(ROW_H - 6) / 2, ROW_W, ROW_H - 6, 8);
      if (on) r.bg.lineStyle(3, 0x7af0a0, 1).strokeRoundedRect(0, -(ROW_H - 6) / 2, ROW_W, ROW_H - 6, 8);
      r.value.setText(this.valueText(r.id, d) || '');
      r.value.setScale(r.value.width > 250 ? 250 / r.value.width : 1);
      r.swatch.clear();
      const c = COLORS.find((x) => x.id === d.color);
      if (r.id === 'color' && c?.swatch) {
        const sx = 300 - r.value.displayWidth / 2 - 22;
        r.swatch.fillStyle(INK, 1).fillCircle(sx, 0, 11).fillStyle(c.swatch, 1).fillCircle(sx, 0, 9);
      }
      if (r.id === 'look') r.label.setText(`생김새 ${looksOpen}/${LOOKS.length}`);
    });
    const move = MOVES.find((m) => m.id === d.move);
    this.moveDesc.setText(
      this.row === 0 && looksOpen < LOOKS.length ? '도감에서 새 몬스터를 잡으면 생김새가 늘어나요.' : `${move.name}: ${move.desc}`,
    );
    this.delBtn.setText(this.deleteArmed ? '정말 지우기' : '지우기');
    this.goBtn.setText(`▶ 스테이지 ${d.stage}에서 만나기`);

    this.drawPet(d);
  }

  // 왼쪽 공방에서 작품이 고른 움직임대로 움직인다
  drawPet(d) {
    const key = ensureWorkshopTexture(this, d);
    const size = SIZES.find((s) => s.id === d.size) || SIZES[1];
    const pet = this.pet;
    this.tweens.killTweensOf(pet);
    pet.stop().setTexture(key, this.textures.get(key).has(0) ? 0 : undefined);
    const h = 48 * size.scale * 1.15 * PREVIEW_ZOOM;
    pet.setDisplaySize((h * pet.frame.width) / pet.frame.height, h);
    pet.setAngle(0);
    if (this.anims.exists(`${key}_anim`)) pet.play(`${key}_anim`);
    const cx = VIEW.x + VIEW.w / 2;
    pet.setPosition(cx, this.floorY).setFlipX(false);
    const side = (x0, x1, duration, ease = 'Sine.inOut', hold = 0) =>
      this.tweens.add({
        targets: pet,
        x: { from: x0, to: x1 },
        duration,
        ease,
        hold,
        yoyo: true,
        repeat: -1,
        onYoyo: () => pet.setFlipX(true),
        onRepeat: () => pet.setFlipX(false),
      });
    if (d.move === 'fast') side(cx - 120, cx + 120, 420, 'Quad.inOut', 250);
    else if (d.move === 'tank') {
      side(cx - 60, cx + 60, 1800);
      this.tweens.add({ targets: pet, y: this.floorY - 6, duration: 260, yoyo: true, repeat: -1, ease: 'Quad.out' });
    } else if (d.move === 'jumper') {
      side(cx - 90, cx + 90, 900);
      this.tweens.add({ targets: pet, y: this.floorY - 70, duration: 450, yoyo: true, repeat: -1, ease: 'Quad.out' });
    } else side(cx - 80, cx + 80, 1400);
    this.petName.setText(d.name);
    this.petMaker.setText(`작가: ${d.maker}`);
  }
}
