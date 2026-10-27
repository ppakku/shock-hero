import Phaser from 'phaser';
import { cfg } from '../config/index.js';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { SHOP_IDS, shopEntry, buyItem } from '../logic/shop.js';
import { totalStars } from '../logic/rewards.js';
import { stages } from '../stage/index.js';
import { isTouchDevice } from '../ui/touch.js';
import { makeText } from '../ui/text.js';

// 보석 상점. 타이틀 위에 열리고, 닫으면 타이틀을 다시 그린다.
// ↑ ↓ 로 고르고 Enter 로 사기, Esc 로 닫기. 마우스나 손가락으로 줄을 눌러도 산다.
const ROW_W = 720;
const ROW_H = 54;
const TOP = 132;

// 아이콘을 34 칸 안에 비율 그대로 맞춘다 (하트처럼 정사각형이 아닌 그림도 찌그러지지 않게)
function fitIcon(icon) {
  return icon.setScale(34 / Math.max(icon.width, icon.height));
}

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    this.selected = 0;
    this.add.rectangle(480, 270, 960, 540, 0x000000, 0.82).setInteractive();
    makeText(this, 480, 44, '보석 상점', 40, '#7af0ff', { strokeThickness: 7 }).setOrigin(0.5);
    this.gemText = makeText(this, 480, 88, '', 20, '#ffffff').setOrigin(0.5);
    this.rows = SHOP_IDS.map((id, i) => this.makeRow(id, i));
    this.msg = makeText(this, 480, 470, '', 18, '#ffd23f').setOrigin(0.5);
    const help = isTouchDevice() ? '줄을 누르면 사요' : '↑ ↓ 고르기    Enter 사기    Esc 닫기    (줄을 클릭해도 사요)';
    makeText(this, 480, 498, help, 15, '#cccccc').setOrigin(0.5);
    makeText(this, 480, 522, '보석 얻기: 보물 처음 찾기 +2, 스테이지 깨기 +1, 새 별 +3, 도감 새 몬스터 +1, 새 보스 +3, 보스 러시 첫 클리어 +5, 오늘의 도전 +3', 13, '#9fe8ff').setOrigin(0.5);

    const close = makeText(this, 900, 44, '닫기 ✕', 20, '#ffffff', { backgroundColor: '#5a1020', padding: { x: 10, y: 6 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.close());

    const kb = this.input.keyboard;
    const once = (fn) => (e) => {
      if (!e?.repeat) fn();
    };
    kb.on('keydown-UP', once(() => this.move(-1)));
    kb.on('keydown-W', once(() => this.move(-1)));
    kb.on('keydown-DOWN', once(() => this.move(1)));
    kb.on('keydown-S', once(() => this.move(1)));
    kb.on('keydown-ENTER', once(() => this.buy(this.selected)));
    kb.on('keydown-SPACE', once(() => this.buy(this.selected)));
    kb.on('keydown-ESC', once(() => this.close()));
    kb.on('keydown-B', once(() => this.close()));
    this.refresh();
    this.cameras.main.fadeIn(120);
  }

  makeRow(id, i) {
    const y = TOP + i * (ROW_H + 6);
    const c = this.add.container(480, y);
    const bg = this.add.graphics();
    const icon = fitIcon(this.add.image(-ROW_W / 2 + 34, 0, 'heart'));
    const name = makeText(this, -ROW_W / 2 + 64, -11, '', 19, '#ffffff', { align: 'left' }).setOrigin(0, 0.5);
    const desc = makeText(this, -ROW_W / 2 + 64, 13, '', 14, '#dddddd', { align: 'left' }).setOrigin(0, 0.5);
    const rank = makeText(this, 150, 0, '', 16, '#ffd23f').setOrigin(0.5);
    const price = makeText(this, ROW_W / 2 - 62, 0, '', 18, '#ffffff').setOrigin(0.5);
    c.add([bg, icon, name, desc, rank, price]);
    c.setSize(ROW_W, ROW_H).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.selected = i;
      this.buy(i);
    });
    return { id, c, bg, icon, name, desc, rank, price };
  }

  refresh() {
    const save = saveStore.load();
    this.save = save;
    this.gemText.setText(`💎 보석 ${save.gems}개      ★ 별 ${totalStars(save, stages)}/${stages.length * 3}`);
    this.rows.forEach((r, i) => {
      const e = shopEntry(save, r.id, cfg.shop);
      const on = i === this.selected;
      r.bg.clear();
      r.bg.fillStyle(on ? 0x24405a : 0x1c2028, 0.95).fillRoundedRect(-ROW_W / 2, -ROW_H / 2, ROW_W, ROW_H, 10);
      r.bg.lineStyle(on ? 4 : 2, on ? 0xffe14a : 0x4a5060, 1).strokeRoundedRect(-ROW_W / 2, -ROW_H / 2, ROW_W, ROW_H, 10);
      if (this.textures.exists(e.icon)) fitIcon(r.icon.setTexture(e.icon));
      r.name.setText(e.name).setColor(e.color);
      r.desc.setText(e.desc);
      r.rank.setText(e.maxRank > 1 ? `${'●'.repeat(e.rank)}${'○'.repeat(e.maxRank - e.rank)}` : e.rank ? '●' : '○');
      r.price.setText(e.maxed ? '완료' : `💎 ${e.price}`).setColor(e.maxed ? '#3ff07a' : e.canBuy ? '#7af0ff' : '#777777');
      r.c.setScale(on ? 1.02 : 1);
    });
  }

  move(dir) {
    this.selected = Phaser.Math.Wrap(this.selected + dir, 0, this.rows.length);
    sfx.play('cardMove');
    this.refresh();
  }

  buy(i) {
    const id = this.rows[i].id;
    const save = saveStore.load();
    const e = shopEntry(save, id, cfg.shop);
    const patch = buyItem(save, id, cfg.shop);
    if (!patch) {
      sfx.play('beep');
      this.say(e.maxed ? `${e.name}은(는) 다 샀어요!` : `보석이 ${e.price - save.gems}개 모자라요`, '#ff9a8a');
      return;
    }
    saveStore.update(patch);
    sfx.play('powerup');
    this.say(`${e.name} 샀어요! ${e.desc}`, '#3ff07a');
    this.tweens.add({ targets: this.rows[i].c, scale: 1.08, duration: 110, yoyo: true });
    this.refresh();
  }

  say(text, color) {
    this.msg.setText(text).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.msg);
    this.tweens.add({ targets: this.msg, alpha: 0, delay: 1600, duration: 400 });
  }

  close() {
    sfx.play('beep');
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeShop?.();
  }
}
