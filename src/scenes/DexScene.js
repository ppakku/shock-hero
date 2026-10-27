import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { stages } from '../stage/index.js';
import { MONSTER_DEX, bossDex, monsterStages, normalizeDex, dexCounts } from '../logic/dex.js';
import { makeSeaMonsterTextures } from '../enemies/seaTextures.js';
import { isTouchDevice } from '../ui/touch.js';
import { makeText, FONT } from '../ui/text.js';
import { TITLE_FONT } from '../ui/titleArt.js';

// 몬스터 도감. 타이틀 위에 열리고, 닫으면 타이틀을 다시 그린다.
// 왼쪽은 칸(5 x 4), 오른쪽은 고른 칸의 자세한 설명. 아직 못 잡은 칸은 검은 그림자와 ??? 로 보인다.
// 화살표로 고르기, Q 또는 Tab 으로 몬스터와 보스 바꾸기, Esc 또는 G 로 닫기. 손가락으로 칸과 탭을 눌러도 된다.
const COLS = 5;
const CARD_W = 104;
const CARD_H = 96;
const GAP = 6;
const GRID_X = 26;
const GRID_Y = 104;
const PANEL_X = 600;
const PANEL_W = 336;
const INK = 0x10161c;

// [2, 3, 4, 5, 7, 8] → '2~5, 7, 8'
function stageRanges(list) {
  const out = [];
  for (let i = 0; i < list.length; ) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    out.push(j - i >= 2 ? `${list[i]}~${list[j]}` : list.slice(i, j + 1).join(', '));
    i = j + 1;
  }
  return out.join(', ');
}

export class DexScene extends Phaser.Scene {
  constructor() {
    super('Dex');
  }

  create() {
    makeSeaMonsterTextures(this); // 해파리처럼 코드로 그리는 바다 몬스터 그림 (게임 중에만 만들어져서 여기서도 만든다)
    this.tab = 'monsters';
    this.selected = 0;
    this.where = monsterStages(stages);
    this.bosses = bossDex(stages);

    this.add.rectangle(480, 270, 960, 540, 0x0b0e14, 0.98).setInteractive();
    this.add
      .text(GRID_X, 22, '몬스터 도감', { fontFamily: `${TITLE_FONT}, ${FONT}`, fontSize: '36px', color: '#ffe14a', stroke: '#000000', strokeThickness: 7 })
      .setOrigin(0, 0);
    this.countText = makeText(this, 250, 40, '', 17, '#dddddd').setOrigin(0, 0.5);

    this.tabs = [
      { id: 'monsters', label: '몬스터', x: GRID_X },
      { id: 'bosses', label: '보스', x: GRID_X + 124 },
    ].map((t) => {
      const c = this.add.container(t.x, 70);
      const bg = this.add.graphics();
      const label = makeText(this, 58, 15, t.label, 17, '#ffffff').setOrigin(0.5);
      c.add([bg, label]);
      c.setSize(116, 30).setInteractive(new Phaser.Geom.Rectangle(0, 0, 116, 30), Phaser.Geom.Rectangle.Contains);
      c.input.cursor = 'pointer';
      c.on('pointerdown', () => this.setTab(t.id));
      return { ...t, c, bg, label };
    });

    const close = makeText(this, 900, 40, '닫기 ✕', 20, '#ffffff', { backgroundColor: '#5a1020', padding: { x: 10, y: 6 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.close());

    this.cards = [];
    for (let i = 0; i < 20; i++) this.cards.push(this.makeCard(i));
    this.makePanel();

    const help = isTouchDevice() ? '칸을 누르면 자세히 봐요' : '화살표 고르기    Q 또는 Tab: 몬스터와 보스 바꾸기    Esc 닫기';
    makeText(this, 480, 524, help, 14, '#aaaaaa').setOrigin(0.5);

    const kb = this.input.keyboard;
    const once = (fn) => (e) => {
      if (!e?.repeat) fn();
    };
    const on = (keys, fn) => keys.forEach((k) => kb.on(`keydown-${k}`, once(fn)));
    on(['LEFT', 'A'], () => this.move(-1, 0));
    on(['RIGHT', 'D'], () => this.move(1, 0));
    on(['UP', 'W'], () => this.move(0, -1));
    on(['DOWN', 'S'], () => this.move(0, 1));
    on(['Q', 'TAB', 'E'], () => this.setTab(this.tab === 'monsters' ? 'bosses' : 'monsters'));
    on(['ESC', 'G'], () => this.close());
    this.refresh();
    this.cameras.main.fadeIn(120);
  }

  makeCard(i) {
    const x = GRID_X + (i % COLS) * (CARD_W + GAP) + CARD_W / 2;
    const y = GRID_Y + Math.floor(i / COLS) * (CARD_H + GAP) + CARD_H / 2;
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const img = this.add.image(0, -10, '__DEFAULT');
    const name = makeText(this, 0, CARD_H / 2 - 14, '', 12, '#ffffff').setOrigin(0.5);
    const badge = makeText(this, CARD_W / 2 - 8, -CARD_H / 2 + 8, '', 12, '#ffe14a').setOrigin(1, 0);
    const q = makeText(this, 0, -10, '', 34, '#5a6070', { strokeThickness: 0 }).setOrigin(0.5); // 그림이 아직 없는 보스
    c.add([bg, img, q, name, badge]);
    c.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.selected = i;
      sfx.play('cardMove');
      this.refresh();
    });
    return { c, bg, img, q, name, badge };
  }

  makePanel() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(PANEL_X + 5, GRID_Y + 6, PANEL_W, 402, 14);
    g.fillStyle(INK, 1).fillRoundedRect(PANEL_X - 3, GRID_Y - 3, PANEL_W + 6, 408, 16);
    g.fillStyle(0xf4ecd8, 1).fillRoundedRect(PANEL_X, GRID_Y, PANEL_W, 402, 13);
    g.fillStyle(0xe2d6b8, 1).fillRoundedRect(PANEL_X + 14, GRID_Y + 14, PANEL_W - 28, 170, 10);
    const cx = PANEL_X + PANEL_W / 2;
    this.big = this.add.sprite(cx, GRID_Y + 176, '__DEFAULT').setOrigin(0.5, 1);
    this.bigQ = makeText(this, cx, GRID_Y + 100, '', 54, '#8a7c60', { strokeThickness: 0 }).setOrigin(0.5);
    const left = PANEL_X + 20;
    const textW = PANEL_W - 40;
    const dark = { stroke: '#f4ecd8', strokeThickness: 0, align: 'left', wordWrap: { width: textW, useAdvancedWrap: true } };
    this.pName = makeText(this, left, GRID_Y + 196, '', 24, '#1a1408', { ...dark, fontStyle: 'bold' });
    this.pTag = makeText(this, left, GRID_Y + 230, '', 14, '#7a5600', dark);
    this.pDesc = makeText(this, left, GRID_Y + 256, '', 15, '#2a2418', { ...dark, lineSpacing: 3 });
    this.pTip = makeText(this, left, GRID_Y + 318, '', 15, '#1c4a7a', { ...dark, lineSpacing: 3 });
    this.pMeta = makeText(this, left, GRID_Y + 374, '', 14, '#5a5040', dark);
  }

  get dex() {
    return normalizeDex(saveStore.load().dex, stages.length);
  }

  setTab(id) {
    if (this.tab === id) return;
    this.tab = id;
    this.selected = 0;
    sfx.play('cardMove');
    this.refresh();
  }

  move(dx, dy) {
    const i = this.selected + dx + dy * COLS;
    if (i < 0 || i >= this.entries().length) return;
    this.selected = i;
    sfx.play('cardMove');
    this.refresh();
  }

  // 지금 탭의 칸들: { key, name, found, count, portrait, ... }
  entries() {
    const dex = this.dex;
    if (this.tab === 'monsters') {
      return MONSTER_DEX.map((e) => ({ ...e, key: e.id, portrait: e.id, found: Boolean(dex.monsters[e.id]), count: dex.monsters[e.id] || 0 }));
    }
    return this.bosses.map((b) => ({ ...b, key: `boss${b.stage}`, found: dex.bosses.includes(b.stage) }));
  }

  // 칸 그림: 첫 장에서 빈 가장자리를 잘라 낸 조각('dex' 프레임)을 한 번 만들어 둔다 (보스 그림은 여백이 커서)
  trimmed(key) {
    const tex = this.textures.get(key);
    if (tex.has('dex')) return 'dex';
    const base = tex.has(0) ? tex.get(0) : tex.get();
    try {
      const c = document.createElement('canvas');
      c.width = base.cutWidth;
      c.height = base.cutHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(base.source.image, base.cutX, base.cutY, base.cutWidth, base.cutHeight, 0, 0, base.cutWidth, base.cutHeight);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (px[(y * c.width + x) * 4 + 3] > 24) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return base.name;
      tex.add('dex', base.sourceIndex, base.cutX + x0, base.cutY + y0, x1 - x0 + 1, y1 - y0 + 1);
      return 'dex';
    } catch {
      return base.name;
    }
  }

  // 그림 한 장 맞추기 (스프라이트 시트면 첫 칸). trim 이면 여백을 잘라 낸 조각으로. 그림이 없으면 false
  fit(img, key, w, h, trim = false) {
    if (!key || !this.textures.exists(key)) return false;
    const tex = this.textures.get(key);
    img.setTexture(key, trim ? this.trimmed(key) : tex.has(0) ? 0 : undefined);
    const k = Math.min(w / img.frame.width, h / img.frame.height);
    img.setScale(k);
    // 왼쪽을 보는 그림(아스트라노바X)은 오른쪽을 보게
    img.setFlipX(key.startsWith('dragon_'));
    return true;
  }

  refresh() {
    const save = saveStore.load();
    const counts = dexCounts(save, stages.length);
    this.countText.setText(`몬스터 ${counts.monsters}/${counts.monsterTotal}    보스 ${counts.bosses}/${counts.bossTotal}`);
    this.tabs.forEach((t) => {
      const on = t.id === this.tab;
      t.bg.clear();
      t.bg.fillStyle(INK, 1).fillRoundedRect(-2, -2, 120, 34, 10);
      t.bg.fillStyle(on ? 0xffe14a : 0x2a3040, 1).fillRoundedRect(0, 0, 116, 30, 8);
      t.label.setColor(on ? '#1a1408' : '#cccccc').setStroke('#000000', on ? 0 : 3);
    });

    const list = this.entries();
    this.cards.forEach((card, i) => {
      const e = list[i];
      card.c.setVisible(Boolean(e));
      if (!e) return;
      const on = i === this.selected;
      card.bg.clear();
      card.bg.fillStyle(INK, 1).fillRoundedRect(-CARD_W / 2 - 2, -CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, 10);
      card.bg.fillStyle(e.found ? 0x2c3a4c : 0x3a4252, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
      if (on) card.bg.lineStyle(4, 0xffe14a, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
      const has = this.fit(card.img, e.portrait, CARD_W - 16, CARD_H - 32, true);
      card.img.setVisible(has);
      card.q.setText(has ? '' : '?');
      if (has) {
        if (e.found) card.img.clearTint();
        else card.img.setTintFill(0x05070a);
        card.img.setAlpha(e.found ? 1 : 0.85);
      }
      card.name.setText(e.found ? e.name : '???').setColor(e.found ? '#ffffff' : '#777777');
      if (card.name.width > CARD_W - 8) card.name.setScale((CARD_W - 8) / card.name.width);
      else card.name.setScale(1);
      card.badge.setText(e.found && e.by === 'son' ? '★' : '');
      card.c.setScale(on ? 1.04 : 1);
    });
    this.showPanel(list[this.selected]);
  }

  showPanel(e) {
    const big = this.big;
    big.stop();
    const has = this.fit(big, e.portrait, PANEL_W - 60, 150);
    big.setVisible(has);
    this.bigQ.setText(has ? '' : '?');
    if (has) {
      if (e.found) {
        big.clearTint();
        if (this.anims.exists(`${e.portrait}_anim`)) big.play(`${e.portrait}_anim`);
      } else big.setTintFill(0x2a2418);
    }

    if (this.tab === 'monsters') {
      const where = this.where[e.id] || [];
      const whereText = where.length ? `스테이지 ${stageRanges(where)}` : '보스가 부르면 나와요';
      if (!e.found) {
        this.pName.setText('???');
        this.pTag.setText('아직 못 잡았어요');
        this.pDesc.setText(where.length ? `스테이지 ${where[0]}에서 만날 수 있어요.` : '');
        this.pTip.setText('');
        this.pMeta.setText('');
        return;
      }
      this.pName.setText(e.name);
      const place = e.group === '기본' ? '' : `${e.group} 몬스터`;
      this.pTag.setText([e.by === 'son' ? '★ 작가님 디자인' : '', place].filter(Boolean).join('    '));
      this.pDesc.setText(e.desc);
      this.pTip.setText(`공략: ${e.tip}`);
      this.pMeta.setText(`잡은 수 ${e.count},  나오는 곳: ${whereText}`);
      return;
    }
    this.pName.setText(e.found ? e.name : '???');
    this.pTag.setText(`스테이지 ${e.stage} 보스`);
    this.pDesc.setText(e.found ? '물리쳤어요!' : '아직 못 이겼어요.');
    this.pTip.setText(has ? '' : '그림 준비 중이에요. 작가님이 그려 주면 여기에 나와요.');
    this.pMeta.setText('');
  }

  close() {
    sfx.play('beep');
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeDex?.();
  }
}
