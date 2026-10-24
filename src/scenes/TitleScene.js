import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { makeText, formatTime } from '../ui/text.js';
import { saveStore } from '../save.js';
import { stages, totalTreasures } from '../stage/index.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const save = saveStore.load();
    const { width } = this.scale;
    const g = this.add.graphics();
    g.fillGradientStyle(0x2a1640, 0x2a1640, 0xd9643a, 0xd9643a, 1).fillRect(0, 0, 960, 540);
    g.fillStyle(0x140b1f, 1);
    for (let i = 0; i < 16; i++) {
      const h = 80 + ((i * 53) % 140);
      g.fillRect(i * 62, 540 - h, 54, h);
    }

    makeText(this, width / 2, 80, '쇼크 히어로', 60, '#ffd23f', { strokeThickness: 10 }).setOrigin(0.5);
    makeText(this, width / 2, 136, '몬스터 브레이커', 28, '#ffffff').setOrigin(0.5);

    const controls = [
      '이동 A / D 또는 ← →    점프 Space    대시 K 또는 Shift',
      '펀치 J 또는 마우스 왼쪽 (꾹 눌렀다 떼면 충전 펀치)    일시정지 Esc',
    ].join('\n');
    makeText(this, width / 2, 196, controls, 16, '#ffffff', { lineSpacing: 6 }).setOrigin(0.5);

    // 스테이지 고르기
    this.save = save;
    this.selected = save.checkpoint || save.unlocked;
    this.cards = stages.map((st, i) => {
      const n = i + 1;
      const x = width / 2 + (i - 2) * 150;
      const box = this.add.rectangle(x, 300, 136, 92, 0x000000, 0.5).setStrokeStyle(3, 0x888888);
      const locked = n > save.unlocked;
      const found = st.treasures.filter((t) => save.treasures.includes(t.id)).length;
      const best = save.bestTimes[n];
      makeText(this, x, 272, `스테이지 ${n}`, 18, locked ? '#777777' : '#ffffff').setOrigin(0.5);
      makeText(this, x, 296, locked ? '잠김' : st.name, 15, locked ? '#777777' : '#ffd23f').setOrigin(0.5);
      makeText(this, x, 322, locked ? '' : `보물 ${found}/${st.treasures.length}${best ? `  ${formatTime(best)}` : ''}`, 12, '#dddddd').setOrigin(0.5);
      box.setInteractive({ useHandCursor: !locked }).on('pointerdown', () => {
        if (locked) return;
        if (this.selected === n) this.begin(false);
        else this.select(n);
      });
      return { box, locked };
    });

    this.startText = makeText(this, width / 2, 395, '', 22, '#3ff07a').setOrigin(0.5);
    this.tweens.add({ targets: this.startText, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.subText = makeText(this, width / 2, 430, '', 16, '#ffffff').setOrigin(0.5);

    const info = [`레벨 ${save.level}`, `보물 ${save.treasures.length}/${totalTreasures}`];
    if (save.bestTimes[stages.length]) info.push('모든 스테이지 클리어!');
    makeText(this, width / 2, 500, info.join('   '), 16, '#dddddd').setOrigin(0.5);

    if (this.sys.game.device.input.touch && !this.sys.game.device.os.desktop) {
      makeText(this, width / 2, 460, '지금은 키보드가 있는 컴퓨터에서 할 수 있어요', 18, '#ff9a1f').setOrigin(0.5);
    }

    this.started = false;
    this.select(this.selected);
    const kb = this.input.keyboard;
    kb.on('keydown-LEFT', () => this.select(this.selected - 1));
    kb.on('keydown-A', () => this.select(this.selected - 1));
    kb.on('keydown-RIGHT', () => this.select(this.selected + 1));
    kb.on('keydown-D', () => this.select(this.selected + 1));
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.select(i + 1)));
    kb.on('keydown-ENTER', () => this.begin(this.canContinue));
    kb.on('keydown-SPACE', () => this.begin(this.canContinue));
    kb.on('keydown-N', () => this.begin(false));
  }

  get canContinue() {
    return this.save.checkpoint === this.selected;
  }

  select(n) {
    if (n < 1 || n > stages.length || n > this.save.unlocked) return;
    this.selected = n;
    this.cards.forEach((c, i) => {
      const on = i + 1 === n;
      c.box.setStrokeStyle(on ? 5 : 3, on ? 0x3ff07a : c.locked ? 0x444444 : 0x888888);
      c.box.setFillStyle(0x000000, on ? 0.75 : 0.5);
    });
    this.startText.setText(this.canContinue ? `Enter: 스테이지 ${n} 체크포인트부터 이어하기` : `Enter: 스테이지 ${n} 시작`);
    this.subText.setText(
      [this.save.unlocked > 1 ? '← → 또는 숫자로 스테이지 고르기' : '', this.canContinue ? 'N: 처음부터' : ''].filter(Boolean).join('    '),
    );
  }

  begin(fromCheckpoint) {
    if (this.started) return;
    this.started = true;
    sfx.unlock();
    sfx.muted = this.save.settings.muted;
    if (!fromCheckpoint) saveStore.update({ checkpoint: null });
    this.registry.set('runTime', 0);
    this.scene.start('Game', { stage: this.selected, fromCheckpoint });
    this.scene.launch('HUD');
  }
}
