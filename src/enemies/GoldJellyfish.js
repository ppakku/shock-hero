import Phaser from 'phaser';
import { SwimMonster, fireProjectile } from './SwimMonster.js';
import { floatText, ring } from '../fx/effects.js';
import { jellyBlocks } from '../logic/swim.js';

// balance.js 에서 숫자를 지워 버려도 돌아가게 쓰는 기본값
const DEFAULTS = {
  swimY: 330, boltWindup: 0.9, boltSpeed: 240, boltDamage: 12, boltCooldown: 2.6,
  hardenRange: 130, hardenTime: 1.6, hardenCooldown: 4.0, tiredTime: 1.2, breakRatio: 0.5,
};

// 골드해파리 GX (아들 디자인): 금색 반구 머리에 "24k", 화난 보라 눈, 긴 금색 촉수.
// 둥둥 떠다니기 → (촉수가 보라로 번쩍 + 조준선) 독 쏘기 → 다시 떠다니기
// 주인공이 가까이 오면 순간 경화: 촉수를 말고 빛나는 공이 되어 펀치를 튕겨 낸다.
//   충전 펀치(반 이상 충전)나 궁극기는 경화를 깨뜨린다. 경화가 끝나면 지쳐서 잠깐 가라앉음 (때릴 기회)
export class GoldJellyfish extends SwimMonster {
  constructor(scene, spot, cfg) {
    super(scene, spot, cfg, 'monster_jelly', 52, 65);
    this.m = { ...DEFAULTS, ...this.m };
    this.boltCd = 1.4;
    this.hardenCd = 0.8;
    this.frameT = 0;
    this.aimG = scene.add.graphics().setDepth(4);
    this.glowG = scene.add.graphics().setDepth(4);
    this.aim = null;
    this.baseScale = { x: this.scaleX, y: this.scaleY };
  }

  get hardened() {
    return this.state === 'hard';
  }

  think(dt) {
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dist = Math.hypot(dx, p.y - this.y);
    this.boltCd -= dt;
    this.hardenCd -= dt;
    const bobY = Math.sin(this.bob) * 22; // 위아래로 둥실둥실

    switch (this.state) {
      case 'idle': {
        this.steer(this.origin + Math.sin(this.bob * 0.4) * 50, this.homeY + bobY, this.m.moveSpeed * 0.6, dt, 2);
        if (this.sees()) this.changeState('chase');
        break;
      }
      case 'chase': {
        // 주인공과 거리를 두고 비슷한 높이로 떠다닌다
        this.facing = Math.sign(dx) || this.facing;
        const keep = 190;
        const tx = Math.abs(dx) > keep ? p.x - Math.sign(dx) * keep : this.x - Math.sign(dx) * 30;
        this.steer(tx, p.y - 10 + bobY, this.m.moveSpeed, dt, 2);
        if (this.hardenCd <= 0 && dist < this.m.hardenRange && !p.dead) this.startCurl();
        else if (this.boltCd <= 0 && dist < 460 && dist > 100 && !p.dead) this.startAim();
        else if (!this.sees(this.m.sightRange * 1.6)) {
          this.origin = this.x;
          this.homeY = this.y;
          this.changeState('idle');
        }
        break;
      }
      case 'windup': {
        // 독 쏘기 준비: 멈춰서 촉수가 보라와 노랑으로 번쩍, 조준선
        this.stopMoving(dt);
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xd070ff);
        else this.setTint(0xfff080);
        this.drawAim();
        if (this.hardenCd <= 0 && dist < this.m.hardenRange * 0.8) this.startCurl();
        else if (this.stateTime >= this.m.boltWindup) this.shoot();
        break;
      }
      case 'curl': {
        // 몸을 웅크림 (0.25초): 경화 신호
        this.stopMoving(dt, 10);
        const k = Math.min(1, this.stateTime / 0.25);
        this.setScale(this.baseScale.x * (1 - 0.25 * k), this.baseScale.y * (1 - 0.35 * k));
        if (k >= 1) this.harden();
        break;
      }
      case 'hard': {
        this.stopMoving(dt, 8);
        this.y += Math.sin(this.stateTime * 30) * 0.4;
        if (this.stateTime >= this.m.hardenTime) this.soften(false);
        break;
      }
      case 'tired': {
        // 지쳐서 천천히 가라앉음 (때릴 기회)
        this.body.velocity.x *= 0.9;
        this.body.velocity.y = 30;
        if (this.stateTime >= this.m.tiredTime) this.changeState('chase');
        break;
      }
      default:
        this.changeState('chase');
        break;
    }
  }

  startAim() {
    const p = this.scene.player;
    this.aim = { x: p.x, y: p.y - 6 };
    this.scene.sfxPlay('jellyCharge');
    this.changeState('windup');
  }

  drawAim() {
    const g = this.aimG.clear();
    if (!this.aim) return;
    const k = Math.min(1, this.stateTime / this.m.boltWindup);
    const dx = this.aim.x - this.x;
    const dy = this.aim.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const len = 420;
    // 보라 점선 조준선 (점점 진해짐)
    for (let s = 30; s < len; s += 22) {
      g.fillStyle(0xc060ff, 0.25 + 0.6 * k).fillCircle(this.x + (dx / d) * s, this.y + (dy / d) * s, 3);
    }
    // 촉수 끝에 모이는 전기
    for (let i = 0; i < 3; i++) {
      const a = this.stateTime * 9 + i * 2.1;
      g.lineStyle(2, 0xfff59a, 0.9).lineBetween(this.x, this.y + 14, this.x + Math.cos(a) * 18 * k, this.y + 14 + Math.sin(a) * 18 * k);
    }
  }

  shoot() {
    this.aimG.clear();
    this.clearTint();
    const a = this.aim;
    this.aim = null;
    this.boltCd = this.m.boltCooldown;
    this.changeState('chase');
    if (!a) return;
    const dx = a.x - this.x;
    const dy = a.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const s = this.scene;
    s.sfxPlay('jellyZap');
    fireProjectile(s, {
      x: this.x + (dx / d) * 20,
      y: this.y + (dy / d) * 20,
      vx: (dx / d) * this.m.boltSpeed,
      vy: (dy / d) * this.m.boltSpeed,
      texture: 'monster_jelly_bolt',
      w: 34,
      h: 17,
      damage: this.m.boltDamage,
      life: 2.2,
      knockback: this.m.heroKnockback,
      trail: (x, y) => s.sparks.emitParticleAt(x, y, 1),
    });
  }

  // 순간 경화
  startCurl() {
    this.aimG.clear();
    this.aim = null;
    this.clearTint();
    this.changeState('curl');
  }

  harden() {
    this.setTexture('monster_jelly_ball');
    this.setDisplaySize(52 * this.m.size, 52 * this.m.size);
    this.hardenCd = this.m.hardenCooldown + this.m.hardenTime;
    this.scene.sfxPlay('harden');
    ring(this.scene, this.x, this.y, 0xffe066, 50, 260, 4);
    floatText(this.scene, this.x, this.y - 44, '순간 경화!', '#ffe066', 18);
    this.changeState('hard');
    if (!this.scene.jellyTipSaid) {
      this.scene.jellyTipSaid = true;
      this.scene.robot.say('골드해파리가 단단해졌어! {jellyTip}', true);
    }
  }

  // 경화 풀림. broken 이면 깨져서 오래 멍함
  soften(broken) {
    this.setTexture('monster_jelly');
    this.setScale(this.baseScale.x, this.baseScale.y);
    if (broken) {
      this.stunTime = 1.4;
      this.changeState('stunned');
    } else {
      this.changeState('tired');
      floatText(this.scene, this.x, this.y - 44, '헉헉...', '#fff59a', 16);
    }
  }

  takeHit(attack, dir) {
    if (this.dead) return false;
    if (this.state === 'curl' || this.hardened) {
      if (jellyBlocks(attack.kind, true, attack.ratio ?? 0, this.m.breakRatio)) {
        // 튕겨 냄
        this.scene.sfxPlay('tink');
        floatText(this.scene, this.x, this.y - 40, '팅!', '#ffe066', 22);
        ring(this.scene, this.x, this.y, 0xffffff, 34, 160, 3);
        this.scene.sparks.explode(6, this.x - dir * 20, this.y);
        return true;
      }
      // 충전 펀치나 궁극기: 경화를 깨뜨린다
      floatText(this.scene, this.x, this.y - 60, '경화 깨기!', '#3ff0ff', 24);
      this.scene.sfxPlay('shieldBreak');
      this.soften(true);
      const ok = super.takeHit({ ...attack, damage: Math.round(attack.damage * 1.3) }, dir);
      if (!this.dead) {
        this.stunTime = 1.4;
        this.changeState('stunned');
      }
      return ok;
    }
    this.aimG.clear();
    this.aim = null;
    return super.takeHit(attack, dir);
  }

  afterUpdate(dt) {
    // 촉수 흔들기 (그림 2장 번갈아)
    if (!this.hardened && this.state !== 'curl') {
      this.frameT += dt;
      const tex = Math.floor(this.frameT * 4) % 2 === 0 ? 'monster_jelly' : 'monster_jelly_b';
      if (this.texture.key !== tex) this.setTexture(tex);
    }
    // 빛: 경화 중에는 금빛 후광, 평소에는 은은한 빛
    const g = this.glowG.clear();
    if (this.hardened) {
      const pulse = 0.5 + 0.5 * Math.sin(this.stateTime * 14);
      g.fillStyle(0xffe066, 0.2 + 0.2 * pulse).fillCircle(this.x, this.y, 40 + pulse * 6);
      g.lineStyle(3, 0xfff3a0, 0.8).strokeCircle(this.x, this.y, 34 + pulse * 4);
    } else {
      g.fillStyle(0xffd23f, 0.12).fillCircle(this.x, this.y - 10, 30);
    }
    if (this.state === 'tired') g.fillStyle(0xffffff, 0.6).fillCircle(this.x + Math.cos(this.stateTime * 6) * 18, this.y - 36, 3);
  }

  onDie() {
    this.aimG.destroy();
    this.glowG.destroy();
  }
}
