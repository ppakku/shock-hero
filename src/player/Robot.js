import Phaser from 'phaser';
import { FONT } from '../ui/text.js';

// 로봇 조수 볼트: 주인공 옆을 둥둥 떠다니며 말풍선으로 힌트와 농담을 한다.
export class Robot {
  constructor(scene, target) {
    this.scene = scene;
    this.target = target;
    this.sprite = scene.add.image(target.x - 45, target.y - 55, 'robot').setDepth(15).setDisplaySize(30, 34);
    this.bubble = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#111111',
        backgroundColor: '#ffffffee',
        padding: { x: 10, y: 6 },
        wordWrap: { width: 280, useAdvancedWrap: true },
        align: 'left',
      })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);
    this.queue = [];
    this.timer = 0;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    const tx = this.target.x - this.target.facing * 45;
    const ty = this.target.y - 55 + Math.sin(this.t * 3) * 5;
    const k = 1 - Math.exp(-6 * dt);
    this.sprite.x += (tx - this.sprite.x) * k;
    this.sprite.y += (ty - this.sprite.y) * k;
    this.sprite.setFlipX(this.target.facing < 0);

    if (this.bubble.visible) {
      const cam = this.scene.cameras.main;
      const half = this.bubble.width / 2 + 8;
      const x = Phaser.Math.Clamp(this.sprite.x, cam.scrollX + half, cam.scrollX + cam.width - half);
      this.bubble.setPosition(x, Math.max(this.sprite.y - 22, this.bubble.height + 8));
      this.timer -= dt;
      if (this.timer <= 0) this.next();
    }
  }

  // urgent 면 지금 하던 말을 끊고 바로 말한다
  say(lines, urgent = false) {
    const list = Array.isArray(lines) ? lines : [lines];
    if (urgent) {
      this.queue = [...list];
      this.next();
      return;
    }
    this.queue.push(...list);
    if (!this.bubble.visible) this.next();
  }

  next() {
    const line = this.queue.shift();
    if (!line) {
      this.bubble.setVisible(false);
      return;
    }
    this.bubble.setText(`볼트: ${line}`).setVisible(true);
    this.timer = Phaser.Math.Clamp(1.4 + line.length * 0.07, 2.2, 5);
  }
}
