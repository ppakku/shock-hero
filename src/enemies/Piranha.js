import Phaser from 'phaser';
import { SwimMonster } from './SwimMonster.js';
import { dartVector } from '../logic/swim.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;

// balance.js 에서 숫자를 지워 버려도 돌아가게 쓰는 기본값
const DEFAULTS = { swimY: 330, dartWindup: 0.75, dartSpeed: 520, dartTime: 0.5, dartCooldown: 2.0, dartRange: 320, recoverTime: 0.9 };

// 이빨 피라냐: 작고 빠른 물고기. 여러 마리가 줄지어 나온다.
// 주인공 옆으로 따라붙기 → (빨갛게 깜빡 + 빨간 점선으로 돌진 길 표시) → 쓩! 일직선 돌진 → 숨 고르기 (때릴 기회)
// 돌진 길은 미리 정해져 있어서, 점선 밖으로 헤엄치거나 대시로 뚫으면 된다.
export class Piranha extends SwimMonster {
  constructor(scene, spot, cfg) {
    super(scene, spot, cfg, 'monster_piranha', 50, 32);
    this.m = { ...DEFAULTS, ...this.m };
    this.dartCd = 0.8 + Math.random() * 1.2; // 줄지어 있어도 한꺼번에 돌진하지 않게
    this.lineG = scene.add.graphics().setDepth(4);
    this.dart = null;
  }

  think(dt) {
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dist = Math.hypot(dx, p.y - this.y);
    this.dartCd -= dt;

    switch (this.state) {
      case 'idle': {
        this.steer(this.origin + Math.sin(this.bob * 0.6) * 90, this.homeY + Math.sin(this.bob * 1.3) * 12, this.m.moveSpeed * 0.5, dt, 3);
        this.facing = this.body.velocity.x >= 0 ? 1 : -1;
        if (this.sees()) {
          this.dartCd = Math.max(this.dartCd, 0.5 + Math.random() * 1.5); // 떼로 있어도 차례차례 돌진
          this.changeState('chase');
        }
        break;
      }
      case 'chase': {
        // 주인공 옆 (170 떨어진 곳)에 따라붙는다
        this.facing = Math.sign(dx) || this.facing;
        const side = this.x < p.x ? -1 : 1;
        this.steer(p.x + side * 170, p.y + Math.sin(this.bob * 2) * 14, this.m.moveSpeed, dt, 3);
        if (this.dartCd <= 0 && dist < this.m.dartRange && !p.dead) this.startWindup();
        else if (!this.sees(this.m.sightRange * 1.6)) {
          this.origin = this.x;
          this.homeY = this.y;
          this.changeState('idle');
        }
        break;
      }
      case 'windup': {
        this.stopMoving(dt, 10);
        this.facing = this.dart.dir.x >= 0 ? 1 : -1;
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xff3030);
        else this.clearTint();
        this.x -= this.dart.dir.x * 20 * dt; // 뒤로 살짝 물러나며 힘 모으기
        this.drawLine();
        if (this.stateTime >= this.m.dartWindup) {
          this.lineG.clear();
          this.hasHit = false;
          this.body.velocity.x = this.dart.dir.x * this.m.dartSpeed;
          this.body.velocity.y = this.dart.dir.y * this.m.dartSpeed;
          this.scene.sfxPlay('dart');
          this.changeState('attack');
        }
        break;
      }
      case 'attack': {
        // 일직선 돌진 (방향은 그대로)
        this.body.velocity.x = this.dart.dir.x * this.m.dartSpeed;
        this.body.velocity.y = this.dart.dir.y * this.m.dartSpeed;
        if (Math.random() < 0.5) this.trailBubble();
        if (!this.hasHit && !p.dead && intersects(this.biteRect(), p.getBounds())) {
          if (p.hurt(this.m.damage, this.x, this.m.heroKnockback) !== 'ignored') this.hasHit = true;
        }
        if (this.stateTime >= this.m.dartTime) {
          this.dartCd = this.m.dartCooldown;
          this.changeState('recover');
        }
        break;
      }
      case 'recover': {
        this.stopMoving(dt, 5);
        if (this.stateTime >= this.m.recoverTime) this.changeState('chase');
        break;
      }
      default:
        this.changeState('chase');
        break;
    }
  }

  startWindup() {
    const p = this.scene.player;
    this.dart = { dir: dartVector(this.x, this.y, p.x, p.y - 4), x: this.x, y: this.y };
    this.scene.sfxPlay('warn');
    this.changeState('windup');
  }

  biteRect() {
    return new Rect(this.x - 22, this.y - 14, 44, 28);
  }

  // 돌진할 길을 빨간 점선으로
  drawLine() {
    const g = this.lineG.clear();
    const len = this.m.dartSpeed * this.m.dartTime;
    const k = Math.min(1, this.stateTime / this.m.dartWindup);
    const d = this.dart.dir;
    for (let s = 24; s < len; s += 20) g.fillStyle(0xff3030, 0.3 + 0.6 * k).fillRect(this.x + d.x * s - 4, this.y + d.y * s - 2, 8, 4);
    const ex = this.x + d.x * len;
    const ey = this.y + d.y * len;
    g.lineStyle(3, 0xff5050, 0.5 + 0.5 * k).strokeCircle(ex, ey, 10);
  }

  // 돌진 뒤로 남는 거품 (잠깐 보였다 사라짐)
  trailBubble() {
    const b = this.scene.add.image(this.x - this.dart.dir.x * 20, this.y, 'swim_bubble').setDepth(4).setAlpha(0.8);
    this.scene.tweens.add({ targets: b, alpha: 0, y: b.y - 24, duration: 400, onComplete: () => b.destroy() });
  }

  afterUpdate() {
    if (this.state !== 'windup') this.lineG.clear();
  }

  onDie() {
    this.lineG.destroy();
  }
}
