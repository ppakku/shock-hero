import Phaser from 'phaser';
import { Monster } from './Monster.js';
import { flash, floatText } from '../fx/effects.js';
import { pushedKnockback } from '../logic/monsters.js';
import { swimmerY, swimmerXRange, swimmerYRange } from '../logic/swim.js';
import { makeSeaMonsterTextures } from './seaTextures.js';

// 물속을 헤엄치는 몬스터의 공통 부분 (골드해파리, 가시복어, 피라냐).
// 중력이 없고 땅과 발판에 걸리지 않는다. 대신 주인공이 닿는 물속 범위(y 170 ~ 땅 위)와
// 보스 문 앞(gateX - 50)을 넘지 않게 직접 붙잡아 둔다.
export class SwimMonster extends Monster {
  constructor(scene, spot, cfg, texture, w, h) {
    makeSeaMonsterTextures(scene);
    super(scene, spot, cfg);
    this.setTexture(texture);
    this.setDisplaySize(w * this.m.size, h * this.m.size);
    this.body.setSize(this.width * 0.8, this.height * 0.8, true);
    this.flying = true;
    this.body.setAllowGravity(false);
    this.body.checkCollision.none = true;
    this.setCollideWorldBounds(false);
    this.setDragX(0);
    this.y = swimmerY(spot.y, scene.stage.groundY, this.m.swimY ?? scene.stage.groundY - 120);
    this.homeY = this.y;
    this.bob = Math.random() * Math.PI * 2;
    this.state = 'idle';
  }

  // 목표 쪽으로 부드럽게 헤엄친다 (rate 가 클수록 빨리 방향을 바꿈)
  steer(tx, ty, speed, dt, rate = 4) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const s = d > 6 ? Math.min(speed, d * 3) : 0;
    const vx = d > 0 ? (dx / d) * s : 0;
    const vy = d > 0 ? (dy / d) * s : 0;
    const k = 1 - Math.exp(-rate * dt);
    this.body.velocity.x += (vx - this.body.velocity.x) * k;
    this.body.velocity.y += (vy - this.body.velocity.y) * k;
  }

  stopMoving(dt, rate = 6) {
    const k = 1 - Math.exp(-rate * dt);
    this.body.velocity.x -= this.body.velocity.x * k;
    this.body.velocity.y -= this.body.velocity.y * k;
  }

  update(dt) {
    if (this.dead) return;
    this.stateTime += dt;
    this.bob += dt * 3;
    if (this.state === 'stunned') {
      this.stopMoving(dt, 3);
      if (this.stateTime >= this.stunTime) this.changeState('chase');
    } else {
      this.think(dt);
    }
    this.keepInWater();
    this.alert.setPosition(this.x, this.y - this.displayHeight * 0.6 - 10);
    this.setFlipX(this.facing < 0);
    this.afterUpdate?.(dt);
  }

  // 물속 범위와 보스 문 앞으로 붙잡기
  keepInWater() {
    const s = this.scene;
    const xr = swimmerXRange(s.stage, s.gateOpen);
    const yr = swimmerYRange(s.stage.groundY);
    if (this.x < xr.min || this.x > xr.max) {
      this.x = Phaser.Math.Clamp(this.x, xr.min, xr.max);
      this.body.velocity.x = 0;
    }
    if (this.y < yr.min || this.y > yr.max) {
      this.y = Phaser.Math.Clamp(this.y, yr.min, yr.max);
      this.body.velocity.y = 0;
    }
  }

  // 주인공이 보이는지 (가까우면 높이와 상관없이)
  sees(range = this.m.sightRange) {
    const p = this.scene.player;
    return !p.dead && Math.hypot(p.x - this.x, p.y - this.y) < range;
  }

  // 맞으면 맞은 방향으로 조금 밀려나고 잠깐 멍해진다
  takeHit(attack, dir) {
    if (this.dead) return false;
    this.health.damage(attack.damage);
    floatText(this.scene, this.x, this.y - 30, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 26 : 20);
    flash(this.scene, this);
    const k = attack.knockback || 0;
    const push = Math.min(320, pushedKnockback(k, this.m.knockbackScale));
    this.body.velocity.x = dir * push;
    this.body.velocity.y = attack.up ? -push * 0.6 : -push * 0.15;
    this.facing = -dir;
    this.onHurt?.(attack);
    if (this.health.isDead) {
      this.die();
    } else {
      this.clearTint();
      this.stunTime = 0.3 + k / 1500;
      this.changeState('stunned');
    }
    return true;
  }

  // 쓰러지면 배를 뒤집고 위로 둥둥 떠오르며 사라진다
  die() {
    this.dead = true;
    this.alert.destroy();
    this.body.enable = false;
    this.clearTint();
    this.onDie?.();
    this.scene.onMonsterKilled(this);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 60,
      angle: 180,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => this.destroy(),
    });
  }
}

// 몬스터가 쏘는 탄 (몬스터가 쓰러져도 날아가던 탄은 끝까지 간다)
// opts: { x, y, vx, vy, texture, w, h, damage, life, knockback, trail }
export function fireProjectile(scene, opts) {
  const img = scene.add.image(opts.x, opts.y, opts.texture).setDepth(8).setDisplaySize(opts.w, opts.h);
  img.setRotation(Math.atan2(opts.vy, opts.vx));
  const st = { t: 0, done: false };
  const ev = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      if (st.done) return;
      st.t += 0.016;
      img.x += opts.vx * 0.016;
      img.y += opts.vy * 0.016;
      if (opts.trail && Math.random() < 0.5) opts.trail(img.x, img.y);
      const p = scene.player;
      const hitBox = new Phaser.Geom.Rectangle(img.x - opts.w * 0.35, img.y - opts.h * 0.35, opts.w * 0.7, opts.h * 0.7);
      let end = st.t >= opts.life;
      if (!end && !p.dead && Phaser.Geom.Intersects.RectangleToRectangle(hitBox, p.getBounds())) {
        if (p.hurt(opts.damage, img.x, opts.knockback) !== 'ignored') end = true;
      }
      if (end || !scene.sys.isActive()) {
        st.done = true;
        ev.remove();
        scene.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.6, duration: 150, onComplete: () => img.destroy() });
      }
    },
  });
  return img;
}
