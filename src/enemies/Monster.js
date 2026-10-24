import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { flash, floatText } from '../fx/effects.js';
import { makeText } from '../ui/text.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;

// 초록 몬스터: 순찰 → 추격 → (빨개짐) 공격 준비 → 달려들기 → 멍하게 쉬기
export class Monster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cfg) {
    super(scene, x, y, 'monster');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(52, 48);
    this.body.setSize(this.width * 0.8, this.height * 0.85, true);
    this.setCollideWorldBounds(true);
    this.setDragX(900);
    this.setDepth(5);

    this.m = cfg.monster;
    this.health = new Health(this.m.maxHealth);
    this.state = 'idle';
    this.stateTime = 0;
    this.stunTime = 0;
    this.facing = -1;
    this.origin = x;
    this.patrolDir = -1;
    this.hasHit = false;
    this.dead = false;
    this.alert = makeText(scene, x, y - 40, '!', 28, '#ff4444').setOrigin(0.5).setDepth(30).setVisible(false);
  }

  changeState(state) {
    this.state = state;
    this.stateTime = 0;
    this.alert.setVisible(state === 'windup');
    if (state !== 'windup') this.clearTint();
  }

  update(dt) {
    if (this.dead) return;
    this.stateTime += dt;
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const playerReachable = !p.dead && Math.abs(p.y - this.y) < 90;
    this.alert.setPosition(this.x, this.y - 40);

    switch (this.state) {
      case 'idle': {
        if (Math.abs(this.x - this.origin) > 80) this.patrolDir = this.x > this.origin ? -1 : 1;
        this.facing = this.patrolDir;
        this.setVelocityX(this.patrolDir * this.m.moveSpeed * 0.4);
        if (dist < this.m.sightRange && playerReachable) this.changeState('chase');
        break;
      }
      case 'chase': {
        this.facing = Math.sign(dx) || this.facing;
        if (dist > 20) this.setVelocityX(this.facing * this.m.moveSpeed);
        if (dist <= this.m.attackRange && playerReachable) {
          this.setVelocityX(0);
          this.changeState('windup');
        } else if (dist > this.m.sightRange * 1.5 || p.dead) {
          this.origin = this.x;
          this.changeState('idle');
        }
        break;
      }
      case 'windup': {
        this.setVelocityX(0);
        // 빨간 깜빡임 + "!" 로 공격 신호
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xff3030);
        else this.clearTint();
        if (this.stateTime >= this.m.windupTime) {
          this.hasHit = false;
          this.setVelocityX(this.facing * this.m.lungeSpeed);
          this.changeState('attack');
        }
        break;
      }
      case 'attack': {
        this.setVelocityX(this.facing * this.m.lungeSpeed);
        if (!this.hasHit && intersects(this.attackRect(), p.getBounds())) {
          const result = p.hurt(this.m.damage, this.x);
          if (result !== 'ignored') this.hasHit = true;
        }
        if (this.stateTime >= this.m.attackTime) this.changeState('recover');
        break;
      }
      case 'recover': {
        if (this.stateTime >= this.m.recoverTime) this.changeState('chase');
        break;
      }
      case 'stunned': {
        if (this.stateTime >= this.stunTime) this.changeState('chase');
        break;
      }
      case 'down': {
        if (this.stateTime >= 1.0) {
          this.setAngle(0);
          this.changeState('chase');
        }
        break;
      }
      default:
        break;
    }
    this.setFlipX(this.facing < 0);
  }

  attackRect() {
    const w = 46;
    const x = this.facing > 0 ? this.x + 8 : this.x - 8 - w;
    return new Rect(x, this.y - 20, w, 40);
  }

  takeHit(attack, dir) {
    if (this.dead) return false;
    this.health.damage(attack.damage);
    floatText(this.scene, this.x, this.y - 30, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 26 : 20);
    flash(this.scene, this);
    const k = attack.knockback;
    this.setVelocity(dir * k, -Math.min(k * 0.5, 420));
    this.facing = -dir;

    if (this.health.isDead) {
      this.die();
    } else if (k >= this.m.downKnockback) {
      this.changeState('down');
      this.setAngle(90 * dir);
    } else {
      this.stunTime = 0.25 + k / 1200;
      this.changeState('stunned');
    }
    return true;
  }

  die() {
    this.dead = true;
    this.alert.destroy();
    this.body.enable = false;
    this.scene.onMonsterKilled(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: 180,
      y: this.y - 30,
      duration: 450,
      onComplete: () => this.destroy(),
    });
  }
}
