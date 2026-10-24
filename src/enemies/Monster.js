import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { flash, floatText } from '../fx/effects.js';
import { makeText } from '../ui/text.js';
import { monsterStats, pushedKnockback } from '../logic/monsters.js';

export const TEXTURE = {
  basic: 'monster',
  fast: 'monster_fast',
  tank: 'monster_tank',
  jumper: 'monster_jumper',
  fros: 'monster_fros',
  spitter: 'monster_spitter',
  shield: 'monster_shield',
};

const SHEET_SIZE = 1.15; // 스프라이트 시트 그림은 칸에 꽉 차게 잘라서 코드 그림보다 조금 크게
const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;

// 몬스터: 순찰 → 추격 → (빨개짐) 공격 준비 → 달려들기(뜀뛰기는 점프) → 멍하게 쉬기
export class Monster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, spot, cfg) {
    const m = monsterStats(cfg, spot.type);
    const x = spot.x;
    const y = spot.y - 30 * m.size;
    const tex = TEXTURE[m.type];
    super(scene, x, y, tex);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(52 * m.size, 48 * m.size);
    // art.js 에 걷기 스프라이트 시트(8장, 오른쪽을 봄)가 있으면 칸 비율대로 크기를 맞추고 걷기를 반복 재생한다
    if (scene.anims.exists(`${tex}_anim`)) {
      const h = 48 * m.size * SHEET_SIZE;
      this.setDisplaySize((h * this.width) / this.height, h).play({ key: `${tex}_anim`, startFrame: Phaser.Math.Between(0, 7) });
    }
    this.body.setSize(this.width * 0.8, this.height * 0.85, true);
    this.setCollideWorldBounds(true);
    this.setDragX(900);
    this.setDepth(5);

    this.m = m;
    this.type = m.type;
    this.health = new Health(this.m.maxHealth);
    this.state = 'idle';
    this.stateTime = 0;
    this.stunTime = 0;
    this.facing = -1;
    this.origin = x;
    this.patrolDir = -1;
    this.hasHit = false;
    this.dead = false;
    this.flying = false; // 하늘을 나는 몬스터만 true
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
    this.alert.setPosition(this.x, this.y - 40 * this.m.size);
    if (!this.updateHurt()) this.think(dt);
    this.setFlipX(this.facing < 0);
  }

  // 맞고 비틀거리거나 쓰러져 있는 동안. 그런 상태면 true
  updateHurt() {
    if (this.state === 'stunned') {
      if (this.stateTime >= this.stunTime) this.changeState('chase');
      return true;
    }
    if (this.state === 'down') {
      if (this.stateTime >= 1.0) {
        this.setAngle(0);
        this.changeState('chase');
      }
      return true;
    }
    return false;
  }

  // 주인공 쪽으로 몸을 돌린다 (방패병은 천천히 돈다)
  faceToward(dx, _dt) {
    this.facing = Math.sign(dx) || this.facing;
  }

  // 종류마다 다르게 움직이는 부분 (기본: 순찰, 추격, 공격 준비, 달려들기, 쉬기)
  think(dt) {
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const playerReachable = !p.dead && Math.abs(p.y - this.y) < 90;

    switch (this.state) {
      case 'idle': {
        if (Math.abs(this.x - this.origin) > 80) this.patrolDir = this.x > this.origin ? -1 : 1;
        this.facing = this.patrolDir;
        this.setVelocityX(this.patrolDir * this.m.moveSpeed * 0.4);
        if (dist < this.m.sightRange && playerReachable) this.changeState('chase');
        break;
      }
      case 'chase': {
        this.faceToward(dx, dt);
        this.setVelocityX(dist > 30 ? this.facing * this.m.moveSpeed : 0);
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
        this.faceToward(dx, dt);
        // 빨간 깜빡임 + "!" 로 공격 신호
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xff3030);
        else this.clearTint();
        if (this.stateTime >= this.m.windupTime) {
          this.hasHit = false;
          this.setVelocityX(this.facing * this.m.lungeSpeed);
          if (this.type === 'jumper') this.setVelocityY(-520);
          this.changeState('attack');
        }
        break;
      }
      case 'attack': {
        if (!this.hasHit && intersects(this.attackRect(), p.getBounds())) {
          const result = p.hurt(this.m.damage, this.x, this.m.heroKnockback);
          if (result !== 'ignored') this.hasHit = true;
        }
        if (this.type === 'jumper') {
          // 뜀뛰기는 땅에 내려앉을 때까지 날아간다
          this.setVelocityX(this.hasHit ? this.body.velocity.x * 0.9 : this.facing * this.m.lungeSpeed * 0.8);
          const landed = this.stateTime > 0.15 && (this.body.blocked.down || this.body.touching.down);
          if (landed || this.stateTime > 1.4) {
            this.scene.dustAt(this.x, this.y + 20, 5);
            this.changeState('recover');
          }
          break;
        }
        // 주인공에게 닿으면 멈춘다 (뚫고 지나가지 않게)
        const ahead = dx * this.facing;
        this.setVelocityX(this.hasHit || ahead < 36 ? 0 : this.facing * this.m.lungeSpeed);
        if (this.stateTime >= this.m.attackTime) this.changeState('recover');
        break;
      }
      case 'recover': {
        if (this.stateTime >= this.m.recoverTime) this.changeState('chase');
        break;
      }
      default:
        break;
    }
  }

  attackRect() {
    const s = this.m.size;
    if (this.type === 'jumper' && this.state === 'attack') return new Rect(this.x - 26, this.y - 24, 52, 48);
    const w = 46 * s;
    const x = this.facing > 0 ? this.x + 8 : this.x - 8 - w;
    return new Rect(x, this.y - 20 * s, w, 40 * s);
  }

  takeHit(attack, dir) {
    if (this.dead) return false;
    this.health.damage(attack.damage);
    floatText(this.scene, this.x, this.y - 30, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 26 : 20);
    flash(this.scene, this);
    // 쓰러질지는 원래 펀치 힘으로 정하고, 실제로 밀리는 거리만 줄인다
    const k = attack.knockback || 0;
    const push = pushedKnockback(k, this.m.knockbackScale);
    this.setVelocity(dir * push, -Math.min(push * 0.5, 420));
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
