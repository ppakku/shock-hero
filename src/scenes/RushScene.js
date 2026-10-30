import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { stages } from '../stage/index.js';
import { bossDex } from '../logic/dex.js';
import { HERO_INFO } from '../logic/heroes.js';
import { PLAYERS, rushCourses, courseUnlocked, normalizeRush } from '../logic/rush.js';
import { isTouchDevice } from '../ui/touch.js';
import { pageCount, pageOf, turnPage } from '../ui/paging.js';
import { makeText, FONT, formatTime } from '../ui/text.js';
import { TITLE_FONT } from '../ui/titleArt.js';
import { fitPortrait } from '../ui/portrait.js';
import { customArt } from '../config/art.js';
import { portraitArt } from '../logic/stageArt.js';
import { queueArt, finishArt } from '../fx/artLoader.js';

// 보스 러시 고르는 화면. 타이틀 위에 열리고, 닫으면 타이틀을 다시 그린다.
// 위: 누가 하는지 고르기. 왼쪽: 코스 (스테이지 다섯 개씩, 다 깨면 열림, 한 쪽에 네 개). 오른쪽: 고른 코스의 가족 기록표.
// 화살표 위아래로 코스, 왼쪽 오른쪽으로 사람, Q / E 로 쪽 넘기기, Enter 로 출발, Esc 또는 R 로 닫기. 손가락으로 눌러도 된다.
const INK = 0x10161c;
const LIST_X = 26;
const LIST_Y = 132;
const COURSE_W = 430;
const COURSE_H = 82;
const PER_PAGE = 4; // 한 쪽에 놓는 코스 수
const PANEL_X = 480;
const PANEL_W = 456;

export class RushScene extends Phaser.Scene {
  constructor() {
    super('Rush');
  }

  // 열린 코스의 보스 얼굴 그림만 받는다
  preload() {
    const save = saveStore.load();
    const bosses = bossDex(stages);
    const keys = rushCourses(stages.length)
      .filter((c) => courseUnlocked(save, c))
      .flatMap((c) => c.stages.map((n) => bosses[n - 1]?.portrait));
    queueArt(this, portraitArt(keys, customArt));
  }

  create() {
    finishArt(this);
    const save = saveStore.load();
    this.courses = rushCourses(stages.length);
    this.bosses = bossDex(stages);
    const rush = normalizeRush(save.rush, this.courses.length);
    this.player = PLAYERS.indexOf(rush.player);
    // 처음엔 열린 코스 중 마지막 (방금 열린 코스를 바로 해 보게)
    const open = this.courses.filter((c) => courseUnlocked(save, c));
    this.selected = open.length ? this.courses.indexOf(open[open.length - 1]) : 0;

    this.add.rectangle(480, 270, 960, 540, 0x0b0e14, 1).setInteractive();
    this.add
      .text(LIST_X, 18, '보스 러시', { fontFamily: `${TITLE_FONT}, ${FONT}`, fontSize: '36px', color: '#ff6a4a', stroke: '#000000', strokeThickness: 7 })
      .setOrigin(0, 0);
    makeText(this, 210, 38, '보스 다섯 마리를 쉬지 않고 연달아! 빨리 깰수록 기록표 위로 올라가요.', 15, '#dddddd').setOrigin(0, 0.5);
    const close = makeText(this, 900, 38, '닫기 ✕', 20, '#ffffff', { backgroundColor: '#5a1020', padding: { x: 10, y: 6 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.close());

    // 누가 해요? (사람 칩)
    makeText(this, LIST_X, 92, '누가 해요?', 18, '#ffe14a').setOrigin(0, 0.5);
    this.chips = PLAYERS.map((name, i) => {
      const c = this.add.container(186 + i * 92, 92);
      const bg = this.add.graphics();
      const label = makeText(this, 0, 0, name, 17, '#ffffff').setOrigin(0.5);
      c.add([bg, label]);
      c.setSize(84, 34).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => this.pickPlayer(i));
      return { c, bg, label };
    });

    this.cards = this.courses.map((course, i) => this.makeCourse(course, i));
    this.makePanel();
    this.makePager();

    this.startBtn = makeText(this, PANEL_X + PANEL_W / 2, 476, '', 24, '#1a1408', { backgroundColor: '#ffe14a', padding: { x: 22, y: 10 }, stroke: '#000000', strokeThickness: 0 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerdown', () => this.start());

    const help = isTouchDevice() ? '사람과 코스를 누르고 출발을 눌러요' : '← →: 사람    ↑ ↓: 코스    Q / E: 쪽 넘기기    Enter: 출발    Esc: 닫기';
    makeText(this, 480, 526, help, 14, '#aaaaaa').setOrigin(0.5);

    const kb = this.input.keyboard;
    const once = (fn) => (e) => {
      if (!e?.repeat) fn();
    };
    const on = (keys, fn) => keys.forEach((k) => kb.on(`keydown-${k}`, once(fn)));
    on(['LEFT', 'A'], () => this.pickPlayer((this.player + PLAYERS.length - 1) % PLAYERS.length));
    on(['RIGHT', 'D'], () => this.pickPlayer((this.player + 1) % PLAYERS.length));
    on(['UP', 'W'], () => this.pick(this.selected - 1));
    on(['DOWN', 'S'], () => this.pick(this.selected + 1));
    on(['Q', 'PAGE_UP'], () => this.turn(-1));
    on(['E', 'PAGE_DOWN'], () => this.turn(1));
    on(['ENTER', 'SPACE'], () => this.start());
    on(['ESC', 'R'], () => this.close());
    this.refresh();
    this.cameras.main.fadeIn(120);
  }

  makeCourse(course, i) {
    const y = LIST_Y + (i % PER_PAGE) * (COURSE_H + 8);
    const c = this.add.container(LIST_X, y);
    const bg = this.add.graphics();
    const title = makeText(this, 14, 16, `코스 ${course.id}  ${course.name}`, 18, '#ffffff').setOrigin(0, 0.5);
    const sub = makeText(this, COURSE_W - 12, 16, '', 13, '#bbbbbb').setOrigin(1, 0.5);
    const heads = course.stages.map((n, k) => this.add.image(40 + k * 62, 56, '__DEFAULT'));
    const qs = course.stages.map((n, k) => makeText(this, 40 + k * 62, 56, '', 24, '#5a6070', { strokeThickness: 0 }).setOrigin(0.5)); // 그림이 아직 없는 보스
    const lock = makeText(this, COURSE_W / 2, 56, '', 15, '#ffb0a4').setOrigin(0.5);
    c.add([bg, title, sub, ...heads, ...qs, lock]);
    c.setSize(COURSE_W, COURSE_H).setInteractive(new Phaser.Geom.Rectangle(0, 0, COURSE_W, COURSE_H), Phaser.Geom.Rectangle.Contains);
    c.input.cursor = 'pointer';
    c.on('pointerdown', () => {
      if (this.selected === i) this.start();
      else this.pick(i);
    });
    return { course, c, bg, title, sub, heads, qs, lock };
  }

  // 코스 목록 아래: 쪽 넘기기
  makePager() {
    const y = LIST_Y + PER_PAGE * (COURSE_H + 8) + 12;
    const arrow = (x, label, dir) =>
      makeText(this, x, y, label, 24, '#ffffff', { strokeThickness: 5 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.turn(dir));
    this.pagePrev = arrow(LIST_X + 120, '◀', -1);
    this.pageNext = arrow(LIST_X + COURSE_W - 120, '▶', 1);
    this.pageText = makeText(this, LIST_X + COURSE_W / 2, y, '', 16, '#ffe14a').setOrigin(0.5);
  }

  makePanel() {
    const g = this.add.graphics();
    const top = LIST_Y - 6;
    g.fillStyle(INK, 1).fillRoundedRect(PANEL_X - 3, top - 3, PANEL_W + 6, 318, 16);
    g.fillStyle(0xf4ecd8, 1).fillRoundedRect(PANEL_X, top, PANEL_W, 312, 13);
    this.pTitle = makeText(this, PANEL_X + 18, top + 22, '', 20, '#1a1408', { strokeThickness: 0, fontStyle: 'bold' }).setOrigin(0, 0.5);
    const dark = { strokeThickness: 0 };
    this.rows = [];
    for (let i = 0; i < 8; i++) {
      const y = top + 58 + i * 31;
      this.rows.push({
        rank: makeText(this, PANEL_X + 34, y, '', 18, '#1a1408', { ...dark, fontStyle: 'bold' }).setOrigin(0.5),
        name: makeText(this, PANEL_X + 66, y, '', 18, '#1a1408', { ...dark, fontStyle: 'bold' }).setOrigin(0, 0.5),
        hero: makeText(this, PANEL_X + 150, y, '', 14, '#5a5040', dark).setOrigin(0, 0.5),
        time: makeText(this, PANEL_X + PANEL_W - 20, y, '', 18, '#1c4a7a', { ...dark, fontStyle: 'bold' }).setOrigin(1, 0.5),
      });
    }
    this.pEmpty = makeText(this, PANEL_X + PANEL_W / 2, top + 150, '', 17, '#5a5040', { ...dark, align: 'center', lineSpacing: 8 }).setOrigin(0.5);
  }

  pickPlayer(i) {
    if (i === this.player) return;
    this.player = i;
    sfx.play('cardMove');
    this.refresh();
  }

  pick(i) {
    if (i < 0 || i >= this.courses.length || i === this.selected) return;
    this.selected = i;
    sfx.play('cardMove');
    this.refresh();
  }

  turn(dir) {
    const next = turnPage(this.selected, dir, PER_PAGE, this.courses.length);
    if (next === this.selected) return;
    this.selected = next;
    sfx.play('cardMove');
    this.refresh();
  }

  refresh() {
    const save = saveStore.load();
    const rush = normalizeRush(save.rush, this.courses.length);
    const page = pageOf(this.selected, PER_PAGE);
    const pages = pageCount(this.courses.length, PER_PAGE);
    this.pageText.setText(`${page + 1} / ${pages} 쪽`);
    this.pagePrev.setAlpha(page > 0 ? 1 : 0.3);
    this.pageNext.setAlpha(page < pages - 1 ? 1 : 0.3);
    this.chips.forEach((chip, i) => {
      const on = i === this.player;
      chip.bg.clear();
      chip.bg.fillStyle(INK, 1).fillRoundedRect(-44, -19, 88, 38, 10);
      chip.bg.fillStyle(on ? 0xffe14a : 0x2a3040, 1).fillRoundedRect(-42, -17, 84, 34, 8);
      chip.label.setColor(on ? '#1a1408' : '#cccccc').setStroke('#000000', on ? 0 : 3);
    });

    this.cards.forEach((card, i) => {
      const { course } = card;
      card.c.setVisible(pageOf(i, PER_PAGE) === page);
      const open = courseUnlocked(save, course);
      const on = i === this.selected;
      card.bg.clear();
      card.bg.fillStyle(INK, 1).fillRoundedRect(-2, -2, COURSE_W + 4, COURSE_H + 4, 10);
      card.bg.fillStyle(open ? 0x2c3a4c : 0x262a33, 1).fillRoundedRect(0, 0, COURSE_W, COURSE_H, 8);
      if (on) card.bg.lineStyle(4, 0xffe14a, 1).strokeRoundedRect(0, 0, COURSE_W, COURSE_H, 8);
      const best = rush.records[course.id]?.[0];
      const first = course.stages[0];
      const last = course.stages[course.stages.length - 1];
      card.sub.setText(best ? `1등 ${best.name} ${formatTime(best.time)}` : `스테이지 ${first}~${last}`);
      card.title.setColor(open ? '#ffffff' : '#888888');
      card.heads.forEach((img, k) => {
        const b = this.bosses[course.stages[k] - 1];
        const has = fitPortrait(this, img, b.portrait, 54, 40, true);
        img.setVisible(open && has);
        card.qs[k].setText(open && !has ? '?' : '');
      });
      card.lock.setText(open ? '' : `🔒 스테이지 ${first}~${last}를 다 깨면 열려요`);
    });

    const card = this.cards[this.selected];
    const open = courseUnlocked(save, card.course);
    const list = rush.records[card.course.id] || [];
    this.pTitle.setText(`가족 기록표: 코스 ${card.course.id}`);
    this.rows.forEach((row, i) => {
      const r = list[i];
      row.rank.setText(r ? `${i + 1}` : '').setColor(i === 0 ? '#c08a00' : '#1a1408');
      row.name.setText(r ? r.name : '');
      row.hero.setText(r ? `${HERO_INFO[r.hero]?.name ?? ''}${r.duo ? '  (둘이서)' : ''}` : '');
      row.time.setText(r ? formatTime(r.time) : '');
    });
    this.pEmpty.setText(list.length ? '' : open ? '아직 기록이 없어요.\n첫 기록을 세워 보세요!' : '이 코스는 아직 잠겨 있어요.');
    this.startBtn.setText(open ? `${PLAYERS[this.player]}, 출발!` : '잠겨 있어요');
    this.startBtn.setBackgroundColor(open ? '#ffe14a' : '#555555');
  }

  start() {
    const course = this.courses[this.selected];
    if (!courseUnlocked(saveStore.load(), course)) {
      sfx.play('locked');
      return;
    }
    sfx.play('beep');
    const player = PLAYERS[this.player];
    const save = saveStore.load();
    saveStore.update({ rush: { ...normalizeRush(save.rush, this.courses.length), player } });
    this.scene.get('Title').startRush(course, player);
  }

  close() {
    sfx.play('beep');
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeRush?.();
  }
}
