import Phaser from 'phaser';
import { cfg } from '../config/index.js';
import { sfx } from '../audio/sfx.js';
import { UPGRADE_TRACKS, upgradeCard, normalizeUpgrades } from '../logic/growth.js';
import { makeText } from '../ui/text.js';

// 레벨 업 카드 고르기. 게임 장면을 멈추고 그 위에 카드 4장을 보여 준다.
// ← → 로 고르고 Enter, 또는 숫자 1 ~ 4, 또는 마우스 클릭. 한꺼번에 여러 레벨이 오르면 한 장씩 여러 번 고른다.
const CARD_W = 196;
const CARD_H = 250;
const GAP = 20;
const INPUT_DELAY = 450; // 막 열렸을 때 펀치나 점프를 누르고 있던 손이 실수로 고르지 않게 잠깐 기다림 (밀리초)

export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super('LevelUp');
  }

  get game_() {
    return this.scene.get('Game');
  }

  create() {
    this.openedAt = this.time.now;
    this.busy = false;
    this.add.rectangle(480, 270, 960, 540, 0x000000, 0.65);
    this.title = makeText(this, 480, 70, '', 44, '#ffd23f', { strokeThickness: 8 }).setOrigin(0.5);
    this.sub = makeText(this, 480, 118, '', 18, '#ffffff').setOrigin(0.5);
    this.help = makeText(this, 480, 500, '← → 로 고르고 Enter    숫자 1 2 3 4    마우스로 클릭', 16, '#dddddd').setOrigin(0.5);

    const x0 = 480 - (UPGRADE_TRACKS.length * CARD_W + (UPGRADE_TRACKS.length - 1) * GAP) / 2 + CARD_W / 2;
    this.cards = UPGRADE_TRACKS.map((track, i) => this.makeCard(track, i, x0 + i * (CARD_W + GAP), 300));
    this.refresh();
    this.select(this.firstOpen());

    const kb = this.input.keyboard;
    // 키를 꾹 누르고 있을 때 반복해서 들어오는 신호는 무시 (달리던 손 그대로 카드가 휙휙 넘어가지 않게)
    const once = (fn) => (e) => {
      if (!e?.repeat) fn();
    };
    kb.on('keydown-LEFT', once(() => this.move(-1)));
    kb.on('keydown-RIGHT', once(() => this.move(1)));
    kb.on('keydown-ENTER', once(() => this.choose(this.selected)));
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((name, i) => {
      kb.on(`keydown-${name}`, once(() => this.choose(i)));
      kb.on(`keydown-NUMPAD_${name}`, once(() => this.choose(i)));
    });

    this.cameras.main.fadeIn(150);
  }

  makeCard(track, i, x, y) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const num = makeText(this, -CARD_W / 2 + 18, -CARD_H / 2 + 18, String(i + 1), 18, '#ffffff').setOrigin(0.5);
    const icon = this.add.image(0, -68, `up_${track}`).setScale(1.5);
    const name = makeText(this, 0, -12, '', 20, '#ffffff').setOrigin(0.5);
    const rank = makeText(this, 0, 18, '', 17, '#ffd23f').setOrigin(0.5);
    const lines = makeText(this, 0, 50, '', 15, '#ffffff', { lineSpacing: 6, wordWrap: { width: CARD_W - 20, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    const pips = this.add.graphics();
    c.add([bg, icon, num, name, rank, lines, pips]);
    c.setSize(CARD_W, CARD_H);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => this.select(i, false));
    c.on('pointerdown', () => this.choose(i));
    return { track, c, bg, icon, name, rank, lines, pips, card: null };
  }

  // 지금 저장된 레벨로 카드 글자를 다시 쓴다
  refresh() {
    const gs = this.game_;
    const save = gs.save;
    const u = normalizeUpgrades(save.upgrades, cfg.upgrades.maxRank);
    this.title.setText(`레벨 업! Lv ${save.level}`);
    this.sub.setText(save.picksPending > 1 ? `카드를 하나 골라요 (남은 카드 ${save.picksPending}장)` : '카드를 하나 골라요');
    for (const v of this.cards) {
      const card = upgradeCard(v.track, u, cfg);
      v.card = card;
      v.name.setText(card.name).setColor(card.color);
      v.rank.setText(card.maxed ? `Lv ${card.rank} 최고!` : `Lv ${card.rank} → ${card.rank + 1}`);
      v.lines.setText(card.lines.join('\n'));
      v.c.setAlpha(card.maxed ? 0.45 : 1);
      // 레벨 칸 (동그라미 5개)
      const max = cfg.upgrades.maxRank;
      v.pips.clear();
      const step = 18;
      const px0 = -((max - 1) * step) / 2;
      for (let k = 0; k < max; k++) {
        const filled = k < card.rank;
        v.pips.fillStyle(filled ? 0xffd23f : 0x333344, 1).fillCircle(px0 + k * step, CARD_H / 2 - 22, 6);
        v.pips.lineStyle(2, 0x000000, 0.8).strokeCircle(px0 + k * step, CARD_H / 2 - 22, 6);
      }
    }
    this.drawCards();
  }

  drawCards() {
    this.cards.forEach((v, i) => {
      const on = i === this.selected && !v.card?.maxed;
      const g = v.bg.clear();
      g.fillStyle(on ? 0x2a3f6b : 0x1d2233, 0.97).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
      g.lineStyle(on ? 5 : 2, on ? 0xffd23f : 0x6b7590, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
      v.c.setScale(on ? 1.06 : 1);
    });
  }

  firstOpen() {
    const i = this.cards.findIndex((v) => !v.card.maxed);
    return i < 0 ? 0 : i;
  }

  select(i, withSound = true) {
    if (i === this.selected) return;
    this.selected = i;
    this.drawCards();
    if (withSound) sfx.play('cardMove');
  }

  move(dir) {
    const n = this.cards.length;
    let i = this.selected;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!this.cards[i].card.maxed) break;
    }
    this.select(i);
  }

  choose(i) {
    if (this.busy || this.time.now - this.openedAt < INPUT_DELAY) return;
    const v = this.cards[i];
    if (!v || v.card.maxed) return;
    const gs = this.game_;
    if (!gs.pickUpgrade(v.track)) return;
    this.busy = true;
    this.selected = i;
    this.drawCards();
    sfx.play('pick');
    this.tweens.add({ targets: v.c, scale: 1.18, duration: 120, yoyo: true });
    this.time.delayedCall(320, () => {
      if (gs.save.picksPending > 0) {
        // 한 번에 여러 레벨이 올랐으면 한 장 더
        this.busy = false;
        this.openedAt = this.time.now - INPUT_DELAY + 150;
        this.refresh();
        if (this.cards[this.selected].card.maxed) this.select(this.firstOpen(), false);
        return;
      }
      gs.closeLevelUp();
    });
  }
}
