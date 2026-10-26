import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { stages, chapters } from '../stage/index.js';
import { stageStars, totalStars, STAR_KINDS, STAR_INFO } from '../logic/rewards.js';
import { nodePosition, roadPoints, locateStage, chapterUnlocked, mapStartStage } from '../ui/mapLayout.js';
import { isTouchDevice } from '../ui/touch.js';
import { makeText, formatTime, FONT } from '../ui/text.js';

// 모험 지도: 냥코대전쟁처럼 길 위의 스테이지 점을 골라서 들어간다.
// ← → 로 스테이지 고르기 (장 끝에서 넘어가면 다음 장), Q / E 로 장 넘기기, Enter 로 시작, Esc 로 타이틀.
// 잠긴 스테이지도 골라서 이름과 보스를 볼 수 있지만 출발은 못 한다.
// 점을 한 번 누르면 고르고, 한 번 더 누르면 시작한다.

// 스테이지 배경 종류 → 지도 장식 그림
const SCENERY_KIND = { forest: 'forest', volcano: 'lava', mountains: 'ice', castle: 'castle', underwater: 'water' };
const sceneryKind = (st) => SCENERY_KIND[st.theme?.scenery] || 'city';

// 장마다 지도 색 [바다, 땅, 땅 테두리]
const CHAPTER_LOOK = {
  1: { sea: 0x1d3a52, land: 0x6f8a4a, edge: 0x3e5228, title: '#ffe14a' },
  2: { sea: 0x1a0f24, land: 0x5a3a4a, edge: 0x2e1a26, title: '#ff8a7a' },
};

export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create(data = {}) {
    this.touch = isTouchDevice();
    this.started = false;
    this.save = saveStore.load();
    if (new URLSearchParams(window.location.search).has('all')) this.save.unlocked = stages.length; // 테스트용: 모든 스테이지 열기
    this.selected = mapStartStage(this.save, data.stage, stages.length);
    this.chapterIndex = locateStage(chapters, this.selected).chapterIndex;
    this.draw();

    const kb = this.input.keyboard;
    const on = (keys, fn) => keys.forEach((k) => kb.on(`keydown-${k}`, fn));
    on(['LEFT', 'A'], () => this.step(-1));
    on(['RIGHT', 'D'], () => this.step(1));
    on(['Q', 'PAGE_UP'], () => this.turnChapter(-1));
    on(['E', 'PAGE_DOWN'], () => this.turnChapter(1));
    on(['ENTER', 'SPACE'], () => this.begin(this.canContinue));
    on(['N'], () => this.begin(false));
    on(['ESC', 'BACKSPACE'], () => this.back());
    this.cameras.main.fadeIn(200);
  }

  get chapter() {
    return chapters[this.chapterIndex];
  }

  get canContinue() {
    return this.save.checkpoint === this.selected;
  }

  // 지도 한 장을 (다시) 그린다
  draw() {
    this.tweens.killAll();
    this.children.removeAll(true);
    const ch = this.chapter;
    const look = CHAPTER_LOOK[ch.chapter] || CHAPTER_LOOK[1];
    const unlocked = this.save.unlocked;

    // 바다와 땅
    const g = this.add.graphics();
    g.fillStyle(look.sea, 1).fillRect(0, 0, 960, 540);
    for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, 0.04).fillCircle((i * 197) % 960, 30 + ((i * 113) % 480), 2 + (i % 3)); // 물결 반짝이
    const blobs = [
      [150, 330, 150], [330, 300, 170], [520, 320, 170], [700, 300, 170], [830, 280, 130],
      [300, 170, 120], [480, 180, 130], [660, 160, 130], [800, 190, 110], [140, 220, 90],
    ];
    g.fillStyle(look.edge, 1);
    for (const [x, y, r] of blobs) g.fillCircle(x, y + 6, r * 0.62);
    g.fillStyle(look.land, 1);
    for (const [x, y, r] of blobs) g.fillCircle(x, y, r * 0.6);

    // 스테이지마다 그 땅의 색과 작은 풍경
    ch.stages.forEach((n, i) => {
      const st = stages[n - 1];
      const p = nodePosition(i);
      g.fillStyle(st.theme.sky?.[1] ?? 0x888888, 0.45).fillEllipse(p.x, p.y + 4, 120, 70);
      this.drawScenery(g, sceneryKind(st), p.x + (i % 2 ? 46 : -46), p.y - 30);
    });

    // 길 (열린 곳까지는 밝게, 아직 못 가는 곳은 흐리게)
    const road = this.add.graphics();
    for (let i = 0; i < ch.stages.length - 1; i++) {
      const n = ch.stages[i + 1];
      const pts = roadPoints(nodePosition(i), nodePosition(i + 1));
      const open = n <= unlocked;
      road.lineStyle(12, 0x2a2018, open ? 0.7 : 0.35).strokePoints(pts);
      road.lineStyle(8, open ? 0xf0dca0 : 0x8a8478, open ? 1 : 0.6).strokePoints(pts);
      for (let k = 1; k < pts.length - 1; k += 3) road.fillStyle(0x6a5030, open ? 0.9 : 0.4).fillCircle(pts[k].x, pts[k].y, 2);
    }

    // 스테이지 점
    this.nodes = ch.stages.map((n, i) => this.makeNode(n, i));

    // 주인공 표시 (고른 점 위에서 통통)
    const heroKey = this.textures.exists('hero_idle0') ? 'hero_idle0' : 'player';
    this.hero = this.add.image(0, 0, heroKey).setOrigin(0.5, 1).setDepth(30);
    if (this.hero.height) this.hero.setScale(56 / this.hero.height);

    // 위: 장 이름, 장 넘기기 화살표, 별과 보석
    makeText(this, 480, 40, ch.name, 34, look.title, { strokeThickness: 7, fontStyle: 'bold' }).setOrigin(0.5).setDepth(40);
    const prevOk = this.chapterIndex > 0;
    const next = chapters[this.chapterIndex + 1];
    const nextOk = next && chapterUnlocked(next, unlocked);
    this.arrow(250, 40, '◀', prevOk, () => this.turnChapter(-1));
    this.arrow(710, 40, next ? (nextOk ? '▶' : '▶ 🔒') : '', Boolean(next), () => this.turnChapter(1));
    makeText(this, 940, 22, `★ ${totalStars(this.save, stages)}/${stages.length * 3}   💎 ${this.save.gems}`, 16, '#ffffff').setOrigin(1, 0.5).setDepth(40);
    const back = makeText(this, 20, 22, '◀ 타이틀', 16, '#ffffff', { backgroundColor: '#00000088', padding: { x: 8, y: 4 } })
      .setOrigin(0, 0.5)
      .setDepth(40)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.back());

    // 아래: 고른 스테이지 설명판
    const plate = this.add.graphics().setDepth(40);
    plate.fillStyle(0x0c0e14, 0.88).fillRoundedRect(40, 432, 880, 100, 14);
    plate.lineStyle(3, 0xffe14a, 0.9).strokeRoundedRect(40, 432, 880, 100, 14);
    this.infoTitle = makeText(this, 64, 452, '', 22, '#ffe14a', { align: 'left', fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    this.infoStars = makeText(this, 64, 482, '', 15, '#ffffff', { align: 'left' }).setOrigin(0, 0.5).setDepth(41);
    this.infoMore = makeText(this, 64, 510, '', 15, '#cccccc', { align: 'left' }).setOrigin(0, 0.5).setDepth(41);
    this.startBtn = makeText(this, 800, 470, '', 24, '#1b1b1b', { backgroundColor: '#ffb21f', padding: { x: 16, y: 8 }, fontStyle: 'bold', strokeThickness: 0 })
      .setOrigin(0.5)
      .setDepth(41)
      .setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerdown', () => this.begin(this.canContinue));
    this.restartBtn = makeText(this, 800, 512, '', 14, '#ffffff').setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', () => this.canContinue && this.begin(false));
    this.refresh();
  }

  // 스테이지 점 하나
  makeNode(n, i) {
    const st = stages[n - 1];
    const p = nodePosition(i);
    const locked = n > this.save.unlocked;
    const stars = stageStars(this.save, st, n);
    const last = i === this.chapter.stages.length - 1; // 장의 마지막 = 큰 보스 성
    const r = last ? 32 : 25;
    const c = this.add.container(p.x, p.y).setDepth(20);
    const ring = this.add.graphics();
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillCircle(3, 5, r);
    g.fillStyle(locked ? 0x5a5a5a : st.theme.sky?.[1] ?? 0x4a6a8a, 1).fillCircle(0, 0, r);
    g.lineStyle(4, locked ? 0x9a9a9a : 0xffffff, 1).strokeCircle(0, 0, r);
    if (last && !locked) {
      // 왕관 (장의 마지막 보스)
      g.fillStyle(0xffd23f, 1).fillTriangle(-16, -r + 2, -10, -r - 14, -4, -r + 2);
      g.fillTriangle(-6, -r + 2, 0, -r - 18, 6, -r + 2);
      g.fillTriangle(4, -r + 2, 10, -r - 14, 16, -r + 2);
    }
    const parts = [ring, g];
    if (locked) {
      g.lineStyle(3, 0xd0d0d0, 1).strokeCircle(0, -4, 7);
      g.fillStyle(0xd0d0d0, 1).fillRoundedRect(-10, -2, 20, 15, 3);
    } else {
      parts.push(makeText(this, 0, 0, String(n), last ? 24 : 20, '#ffffff', { strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5));
      STAR_KINDS.forEach((k, j) => {
        parts.push(
          this.add
            .text(-16 + j * 16, r + 12, '★', { fontFamily: FONT, fontSize: '17px', color: stars[k] ? '#ffc21f' : '#6a6a6a', stroke: '#1a1a1a', strokeThickness: 3 })
            .setOrigin(0.5),
        );
      });
    }
    c.add(parts);
    c.setSize(r * 2 + 10, r * 2 + 10).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      if (this.selected === n) this.begin(this.canContinue);
      else this.select(n);
    });
    return { n, c, ring, r, locked };
  }

  // 작은 풍경 그림 (지도 장식)
  drawScenery(g, kind, x, y) {
    if (kind === 'forest') {
      for (const dx of [-14, 0, 14]) {
        g.fillStyle(0x4a3020, 1).fillRect(x + dx - 2, y + 4, 4, 10);
        g.fillStyle(0x2e6a2a, 1).fillTriangle(x + dx - 10, y + 6, x + dx, y - 16, x + dx + 10, y + 6);
      }
    } else if (kind === 'lava') {
      g.fillStyle(0x4a2a20, 1).fillTriangle(x - 22, y + 14, x, y - 14, x + 22, y + 14);
      g.fillStyle(0xff6a1a, 1).fillTriangle(x - 6, y - 7, x, y - 14, x + 6, y - 7);
      g.fillStyle(0xffb03a, 0.8).fillCircle(x + 4, y - 20, 4);
    } else if (kind === 'ice') {
      g.fillStyle(0x8ab0d8, 1).fillTriangle(x - 24, y + 14, x - 6, y - 14, x + 12, y + 14);
      g.fillStyle(0xb8d4f0, 1).fillTriangle(x - 6, y + 14, x + 10, y - 8, x + 26, y + 14);
      g.fillStyle(0xffffff, 1).fillTriangle(x - 11, y - 6, x - 6, y - 14, x - 1, y - 6);
    } else if (kind === 'castle') {
      g.fillStyle(0x3a2a4a, 1).fillRect(x - 18, y - 4, 36, 18);
      for (const dx of [-18, 10]) g.fillRect(x + dx, y - 16, 8, 14);
      g.fillStyle(0xff5ad5, 1).fillRect(x - 3, y + 2, 6, 8);
    } else if (kind === 'water') {
      g.lineStyle(3, 0x6fd8ff, 0.9);
      for (const dy of [-6, 4]) {
        g.beginPath();
        g.arc(x - 10, y + dy, 8, Math.PI, 0);
        g.arc(x + 6, y + dy, 8, Math.PI, 0);
        g.strokePath();
      }
    } else {
      g.fillStyle(0x3a3a48, 1);
      g.fillRect(x - 20, y - 6, 12, 20);
      g.fillRect(x - 6, y - 16, 12, 30);
      g.fillRect(x + 8, y - 2, 12, 16);
      g.fillStyle(0xffd27a, 0.9);
      for (const [wx, wy] of [[-16, 0], [-2, -10], [-2, 0], [12, 4]]) g.fillRect(x + wx, y + wy, 3, 3);
    }
  }

  arrow(x, y, label, enabled, fn) {
    if (!label) return;
    const t = makeText(this, x, y, label, 26, enabled ? '#ffffff' : '#666666', { strokeThickness: 5 }).setOrigin(0.5).setDepth(40);
    t.setInteractive({ useHandCursor: enabled }).on('pointerdown', () => (enabled ? fn() : this.flashLocked()));
  }

  refresh() {
    const n = this.selected;
    const st = stages[n - 1];
    for (const node of this.nodes) {
      const on = node.n === n;
      node.ring.clear();
      if (on) node.ring.lineStyle(5, 0xffe14a, 1).strokeCircle(0, 0, node.r + 7);
      node.c.setScale(on ? 1.12 : 1);
    }
    const here = this.nodes.find((node) => node.n === n);
    this.tweens.killTweensOf(this.hero);
    if (here) {
      const top = here.c.y - here.r - (here.n === this.chapter.stages[this.chapter.stages.length - 1] ? 24 : 6);
      this.hero.setVisible(true).setPosition(here.c.x, top);
      this.tweens.add({ targets: this.hero, y: top - 8, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } else {
      this.hero.setVisible(false); // 고른 스테이지가 다른 장에 있음
    }

    const inChapter = this.chapter.stages.includes(n);
    if (!inChapter) {
      this.infoTitle.setText(`${this.chapter.name}`);
      this.infoStars.setText(chapterUnlocked(this.chapter, this.save.unlocked) ? '← → 로 스테이지를 골라요' : '앞 장을 다 깨면 열려요');
      this.infoMore.setText('');
      this.startBtn.setVisible(false);
      this.restartBtn.setText('');
      return;
    }
    if (n > this.save.unlocked) {
      this.infoTitle.setText(`스테이지 ${n}  ${st.name}  🔒`);
      this.infoStars.setText(`스테이지 ${n - 1} 을(를) 깨면 열려요`);
      this.infoMore.setText(`보스: ${st.boss.name}`);
      this.startBtn.setVisible(false);
      this.restartBtn.setText(this.touch ? '' : `← 로 돌아가면 스테이지 ${this.save.unlocked} 를 할 수 있어요`);
      return;
    }
    const stars = stageStars(this.save, st, n);
    const found = st.treasures.filter((t) => this.save.treasures.includes(t.id)).length;
    const best = this.save.bestTimes[n];
    this.infoTitle.setText(`스테이지 ${n}  ${st.name}${st.swim ? '  (헤엄치기)' : ''}`);
    this.infoStars.setText(STAR_KINDS.map((k) => `${stars[k] ? '★' : '☆'} ${STAR_INFO[k]}`).join('    '));
    this.infoMore.setText(`보스: ${st.boss.name}    보물 ${found}/${st.treasures.length}${best ? `    최고 기록 ${formatTime(best)}` : ''}`);
    this.startBtn.setVisible(true).setText(this.canContinue ? '▶ 이어하기' : '▶ 출발!');
    this.restartBtn.setText(this.canContinue ? (this.touch ? '여기를 누르면 처음부터' : 'N: 처음부터') : this.touch ? '' : 'Enter: 출발    Esc: 타이틀');
  }

  select(n) {
    if (n < 1 || n > stages.length) return false;
    this.selected = n;
    const { chapterIndex } = locateStage(chapters, n);
    sfx.play('cardMove');
    if (chapterIndex !== this.chapterIndex) {
      this.chapterIndex = chapterIndex;
      this.draw();
    } else this.refresh();
    return true;
  }

  // ← →: 옆 스테이지로 (잠긴 곳은 못 감)
  step(dir) {
    if (this.started) return;
    if (!this.select(this.selected + dir)) this.flashLocked();
  }

  // 장 넘기기: 그 장에서 갈 수 있는 가장 뒤 스테이지를 고른다
  turnChapter(dir) {
    if (this.started) return;
    const next = chapters[this.chapterIndex + dir];
    if (!next) return this.flashLocked();
    // 열린 곳 중 가장 뒤, 아직 못 여는 장이면 그 장의 첫 스테이지 (보기만)
    const open = next.stages.filter((n) => n <= this.save.unlocked);
    const pick = open.length ? Math.max(...open) : next.stages[0];
    this.selected = pick;
    this.chapterIndex += dir;
    sfx.play('cardMove');
    this.draw();
  }

  flashLocked() {
    sfx.play('beep');
    this.cameras.main.shake(120, 0.004);
  }

  back() {
    if (this.started) return;
    sfx.play('beep');
    this.scene.start('Title');
  }

  begin(fromCheckpoint) {
    if (this.started || !this.chapter.stages.includes(this.selected)) return;
    if (this.selected > this.save.unlocked) return this.flashLocked(); // 잠긴 스테이지는 출발 못 함
    this.started = true;
    sfx.unlock();
    sfx.muted = this.save.settings.muted;
    if (!fromCheckpoint) saveStore.update({ checkpoint: null });
    this.registry.set('runTime', 0);
    this.scene.start('Game', { stage: this.selected, fromCheckpoint });
    this.scene.launch('HUD');
  }
}
