import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { makeText, formatTime } from '../ui/text.js';
import { saveStore } from '../save.js';

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

    makeText(this, width / 2, 110, '쇼크 히어로', 64, '#ffd23f', { strokeThickness: 10 }).setOrigin(0.5);
    makeText(this, width / 2, 170, '몬스터 브레이커', 30, '#ffffff').setOrigin(0.5);

    const controls = [
      '이동  A / D 또는 ← →',
      '점프  Space',
      '펀치  J 또는 마우스 왼쪽  (꾹 눌렀다 떼면 충전 펀치)',
      '대시  K 또는 Shift',
      '일시정지  Esc',
    ].join('\n');
    makeText(this, width / 2, 290, controls, 18, '#ffffff', { lineSpacing: 8 }).setOrigin(0.5);

    const canContinue = save.checkpoint === 'boss';
    const startLabel = canContinue ? 'Enter 또는 클릭: 체크포인트부터 이어하기' : 'Enter 또는 클릭: 시작';
    const start = makeText(this, width / 2, 420, startLabel, 24, '#3ff07a').setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    if (canContinue) makeText(this, width / 2, 455, 'N: 처음부터', 18, '#ffffff').setOrigin(0.5);

    const info = [`레벨 ${save.level}`];
    if (save.treasures.length) info.push(`보물 ${save.treasures.length}개`);
    if (save.bestTime) info.push(`최고 기록 ${formatTime(save.bestTime)}`);
    makeText(this, width / 2, 500, info.join('   '), 16, '#dddddd').setOrigin(0.5);

    if (this.sys.game.device.input.touch && !this.sys.game.device.os.desktop) {
      makeText(this, width / 2, 220, '지금은 키보드가 있는 컴퓨터에서 할 수 있어요', 18, '#ff9a1f').setOrigin(0.5);
    }

    let started = false;
    const begin = (fromCheckpoint) => {
      if (started) return;
      started = true;
      sfx.unlock();
      sfx.muted = save.settings.muted;
      if (!fromCheckpoint) saveStore.update({ checkpoint: null });
      this.registry.set('runTime', 0);
      this.scene.start('Game', { fromCheckpoint });
      this.scene.launch('HUD');
    };
    this.input.keyboard.once('keydown-ENTER', () => begin(canContinue));
    this.input.keyboard.once('keydown-SPACE', () => begin(canContinue));
    this.input.once('pointerdown', () => begin(canContinue));
    if (canContinue) this.input.keyboard.once('keydown-N', () => begin(false));
  }
}
