import Phaser from 'phaser';
import { Monster } from './Monster.js';
import { flash, floatText, ring } from '../fx/effects.js';
import {
  floorBelowY,
  frosHoverX,
  frosHoverY,
  frosXRange,
  pushedKnockback,
  venomDirection,
  venomLanding,
  FROS_MAX_Y,
  FROS_MIN_Y,
} from '../logic/monsters.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;

// balance.js 에서 숫자를 지워 버려도 돌아가게 쓰는 기본값
const DEFAULTS = {
  hoverY: 290,
  preferDist: 170,
  shootRange: 320,
  venomInterval: 3.0,
  venomWarningTime: 1.0,
  venomLockTime: 0.35,
  venomSpeed: 300,
  venomDamage: 10,
  cloudTime: 1.5,
  cloudWidth: 100,
  cloudHeight: 70,
  cloudDamage: 3,
  cloudTickTime: 0.35,
  tiredTime: 1.4,
};

const VENOM_PURPLE = 0x9b30ff;

// 프로스 (아들 디자인 말벌): 하늘을 날며 주인공 옆 위쪽에서 비스듬히 맹독을 쏜다.
// 떠 있기 → (배를 앞으로 구부리고 보라색으로 빛남 + 점선 조준) → 맹독 발사 → 낮게 내려와 쉬기 → 다시 떠오르기
// 맹독이 떨어진 곳에는 독구름이 잠깐 남아서, 안에 있으면 체력이 조금씩 깎인다 (대시 무적이면 괜찮음).
// 높이는 항상 250 ~ 340 사이라서 점프 펀치나 위쪽 공격으로 잡을 수 있다.
export class Fros extends Monster {
  constructor(scene, spot, cfg) {
    super(scene, spot, cfg);
    this.m = { ...DEFAULTS, ...this.m };
    this.flying = true;
    this.body.setAllowGravity(false);
    // 발판이나 땅에 걸리지 않게 충돌을 끈다 (가로 범위는 직접 막는다)
    this.body.checkCollision.none = true;
    this.setDragX(400);
    this.hoverY = frosHoverY(spot.y, this.m.hoverY);
    this.baseY = this.hoverY;
    this.y = this.hoverY;
    this.bob = Math.random() * Math.PI * 2;
    this.flapT = Math.random();
    this.venomCd = 1.4; // 처음 맹독은 조금 늦게
    this.aimTarget = null;
    this.aimG = scene.add.graphics().setDepth(4);
    this.state = 'idle';
    this.baseScale = { x: this.scaleX, y: this.scaleY };
    // 내가 그린 그림(customArt)으로 바꿨을 때 크기가 다른 그림끼리는 바꾸지 않는다
    this.canSwapFrames = sameSize(scene, 'monster_fros', ['monster_fros_flap', 'monster_fros_aim']);
  }

  update(dt) {
    if (this.dead) return;
    this.stateTime += dt;
    this.bob += dt * 4;
    this.flapT += dt;
    this.venomCd -= dt;
    this.think(dt);
    // 높이: 기본 높이에서 살짝 위아래로 흔들림. 절대 250 위로는 안 올라감
    const wobble = this.state === 'aim' ? 0 : Math.sin(this.bob) * 10;
    this.y = Phaser.Math.Clamp(this.baseY + wobble, FROS_MIN_Y, FROS_MAX_Y);
    this.body.setVelocityY(0);
    // 가로: 스테이지 밖이나 보스 문 너머로 못 감
    const range = frosXRange(this.scene.stage, this.scene.gateOpen);
    if (this.x < range.min || this.x > range.max) {
      this.x = Phaser.Math.Clamp(this.x, range.min, range.max);
      this.body.setVelocityX(0);
    }
    this.alert.setPosition(this.x, this.y - 44);
    this.setFlipX(this.facing < 0);
    this.updateLook();
  }

  // 날갯짓과 쏘기 직전 모습
  updateLook() {
    const flapUp = Math.floor(this.flapT * 16) % 2 === 0;
    if (this.canSwapFrames) {
      const key = this.state === 'aim' ? 'monster_fros_aim' : flapUp ? 'monster_fros' : 'monster_fros_flap';
      if (this.texture.key !== key) this.setTexture(key);
    } else {
      // 그림이 하나뿐이면 몸을 살짝 늘였다 줄여서 날갯짓처럼
      this.scaleY = this.baseScale.y * (flapUp ? 1.04 : 0.97);
    }
  }

  // 독침 끝 위치 (그림 크기에 맞춰 계산)
  stingerPos() {
    const aim = this.state === 'aim';
    const lx = (aim ? 25 : -28) * this.baseScale.x;
    const ly = (aim ? 39 : 42) * this.baseScale.y;
    return { x: this.x + lx * this.facing, y: this.y + ly };
  }

  think(dt) {
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const ease = (target, rate) => target + (this.baseY - target) * Math.exp(-rate * dt);

    switch (this.state) {
      case 'idle': {
        this.baseY = ease(this.hoverY, 3);
        if (Math.abs(this.x - this.origin) > 100) this.patrolDir = this.x > this.origin ? -1 : 1;
        this.facing = this.patrolDir;
        this.setVelocityX(this.patrolDir * this.m.moveSpeed * 0.35);
        if (dist < this.m.sightRange && !p.dead) this.changeState('hover');
        break;
      }
      case 'hover': {
        // 주인공 옆 위쪽(비스듬히 쏘기 좋은 곳)으로 천천히 따라간다. 언제나 주인공을 바라봄
        this.baseY = ease(this.hoverY, 3);
        this.facing = Math.sign(dx) || this.facing;
        const range = frosXRange(this.scene.stage, this.scene.gateOpen);
        const tx = frosHoverX(this.x, p.x, this.m.preferDist, range);
        const gap = tx - this.x;
        const speed = Math.abs(gap) > 10 ? Math.min(this.m.moveSpeed, Math.abs(gap) * 3) : 0;
        this.setVelocityX(Math.sign(gap) * speed);
        const heroBelow = p.y > this.y + 40;
        if (p.dead || dist > this.m.sightRange * 1.6) {
          this.origin = this.x;
          this.changeState('idle');
        } else if (this.venomCd <= 0 && heroBelow && dist > 50 && dist < this.m.shootRange) {
          this.startAim();
        }
        break;
      }
      case 'aim': {
        // 제자리에 멈춰 배를 구부리고 보라색으로 깜빡임. 점선으로 맹독이 떨어질 곳을 보여 줌
        this.setVelocityX(0);
        const lockAt = Math.max(0, this.m.venomWarningTime - this.m.venomLockTime);
        const locked = this.stateTime >= lockAt;
        if (!locked) {
          this.facing = Math.sign(dx) || this.facing;
          this.aimTarget = { x: p.x, y: p.y + 10 };
        } else if (!this.aimLocked) {
          this.aimLocked = true;
          this.scene.sfxPlay('warn');
        }
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xd08cff);
        else this.clearTint();
        this.alert.setVisible(true);
        this.drawAim(locked);
        if (this.stateTime >= this.m.venomWarningTime) this.fireVenom();
        break;
      }
      case 'tired': {
        // 맹독을 쏘고 지쳐서 낮게 내려옴 (점프 펀치로 때리기 좋은 때)
        this.setVelocityX(0);
        this.baseY = ease(FROS_MAX_Y, 4);
        if (this.stateTime >= this.m.tiredTime) this.changeState('hover');
        break;
      }
      case 'stunned': {
        this.baseY = ease(Math.min(FROS_MAX_Y, this.hoverY + 25), 4);
        if (this.stateTime >= this.stunTime) this.changeState('hover');
        break;
      }
      default:
        this.changeState('hover');
        break;
    }
  }

  changeState(state) {
    super.changeState(state);
    if (state !== 'aim' && this.aimG) this.aimG.clear();
  }

  startAim() {
    this.aimLocked = false;
    this.aimTarget = { x: this.scene.player.x, y: this.scene.player.y + 10 };
    this.scene.sfxPlay('venomCharge');
    this.changeState('aim');
  }

  // 맹독이 날아갈 길(점선)과 떨어질 곳(보라 타원)
  drawAim(locked) {
    const s = this.scene;
    const from = this.stingerPos();
    const dir = venomDirection(from.x, from.y, this.aimTarget.x, this.aimTarget.y);
    const land = venomLanding(from.x, from.y, dir, s.stage.platforms, s.stage.groundY);
    const blink = Math.floor(this.stateTime * 14) % 2 === 0;
    const k = Math.min(1, this.stateTime / this.m.venomWarningTime);
    const color = locked && blink ? 0xffffff : VENOM_PURPLE;
    const g = this.aimG.clear();
    // 독침 끝이 점점 밝게 빛남
    g.fillStyle(VENOM_PURPLE, 0.25 + 0.35 * k).fillCircle(from.x, from.y, 8 + 8 * k);
    g.fillStyle(0xe6c8ff, 0.6 * k).fillCircle(from.x, from.y, 4 + 3 * k);
    const len = Math.hypot(land.x - from.x, land.y - from.y);
    for (let d = 14; d < len; d += 20) {
      g.fillStyle(color, 0.45 + 0.45 * k).fillCircle(from.x + dir.x * d, from.y + dir.y * d, 3);
    }
    const w = this.m.cloudWidth;
    g.fillStyle(VENOM_PURPLE, locked ? 0.35 : 0.18).fillEllipse(land.x, land.y, w, 18);
    g.lineStyle(3, color, 0.9).strokeEllipse(land.x, land.y, w, 18);
  }

  // 맹독 발사
  fireVenom() {
    const s = this.scene;
    const m = this.m;
    const from = this.stingerPos();
    const dir = venomDirection(from.x, from.y, this.aimTarget.x, this.aimTarget.y);
    const land = venomLanding(from.x, from.y, dir, s.stage.platforms, s.stage.groundY);
    this.venomCd = m.venomInterval;
    this.aimTarget = null;
    this.changeState('tired');
    s.sfxPlay('venomShot');
    launchVenom(s, from, dir, land, m);
  }

  cancelAim() {
    if (this.state !== 'aim') return;
    this.aimG.clear();
    this.aimTarget = null;
    this.venomCd = Math.max(this.venomCd, 1.0);
  }

  takeHit(attack, dir) {
    if (this.dead) return false;
    this.health.damage(attack.damage);
    floatText(this.scene, this.x, this.y - 30, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 26 : 20);
    flash(this.scene, this);
    // 공중이라 위아래로는 안 밀리고 옆으로만 조금 밀린다
    const k = attack.knockback || 0;
    this.setVelocityX(dir * Math.min(300, pushedKnockback(k, this.m.knockbackScale)));
    this.facing = -dir;
    this.cancelAim();
    if (this.health.isDead) {
      this.die();
    } else {
      this.clearTint();
      this.stunTime = 0.35 + k / 1500;
      this.changeState('stunned');
    }
    return true;
  }

  // 쓰러지면 빙글빙글 돌며 땅으로 떨어진다
  die() {
    this.dead = true;
    this.cancelAim();
    this.aimG.destroy();
    this.alert.destroy();
    this.body.enable = false;
    this.clearTint();
    if (this.canSwapFrames) this.setTexture('monster_fros_flap');
    this.scene.onMonsterKilled(this);
    const s = this.scene;
    const landY = floorBelowY(this.x, this.y, s.stage.platforms, s.stage.groundY) - 20;
    s.tweens.add({
      targets: this,
      y: landY,
      angle: this.facing > 0 ? -200 : 200,
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => {
        s.dustAt(this.x, landY + 14, 6);
        s.tweens.add({ targets: this, alpha: 0, duration: 300, onComplete: () => this.destroy() });
      },
    });
  }
}

// 그림들이 모두 같은 크기인지 (날갯짓 그림을 바꿔 끼워도 크기가 안 변하게)
function sameSize(scene, baseKey, keys) {
  const size = (k) => {
    if (!scene.textures.exists(k)) return null;
    const f = scene.textures.getFrame(k);
    return f ? `${f.width}x${f.height}` : null;
  };
  const base = size(baseKey);
  return !!base && keys.every((k) => size(k) === base);
}

// 장면 시간으로 매 프레임 일을 한다. step(dt) 가 true 를 돌려주면 끝.
// 프로스가 쓰러져도 이미 쏜 맹독과 독구름은 끝까지 처리된다.
function runEffect(s, step) {
  let last = s.time.now;
  const timer = s.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      const now = s.time.now;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (step(dt)) timer.remove();
    },
  });
  return timer;
}

// 맹독이 날아간다. 주인공에게 맞거나 바닥에 닿으면 독구름이 생긴다.
function launchVenom(s, from, dir, land, m) {
  const ball = s.add.image(from.x, from.y, 'monster_venom').setDepth(8).setDisplaySize(30, 18);
  ball.setRotation(Math.atan2(dir.y, dir.x));
  const total = Math.hypot(land.x - from.x, land.y - from.y);
  const speed = Math.max(60, m.venomSpeed);
  let travelled = 0;
  let dodged = false;
  let trail = 0;
  runEffect(s, (dt) => {
    if (!ball.active) return true;
    travelled = Math.min(total, travelled + speed * dt);
    ball.setPosition(from.x + dir.x * travelled, from.y + dir.y * travelled);
    trail += dt;
    if (trail > 0.05) {
      trail = 0;
      const drop = s.add.circle(ball.x - dir.x * 10, ball.y - dir.y * 10, 3, Math.random() < 0.3 ? 0x7dff4a : VENOM_PURPLE, 0.8).setDepth(7);
      s.tweens.add({ targets: drop, alpha: 0, scale: 0.3, y: drop.y + 10, duration: 300, onComplete: () => drop.destroy() });
    }
    const p = s.player;
    if (!dodged && !p.dead) {
      const hitBox = new Rect(ball.x - 8, ball.y - 8, 16, 16);
      if (intersects(hitBox, p.getBounds())) {
        const r = p.hurt(m.venomDamage, ball.x, m.heroKnockback);
        if (r === 'hit') {
          ball.destroy();
          const fy = floorBelowY(ball.x, p.y - 20, s.stage.platforms, s.stage.groundY);
          splashCloud(s, ball.x, fy, m);
          return true;
        }
        if (r === 'dodged') dodged = true; // 대시로 뚫고 지나감
      }
    }
    if (travelled >= total) {
      ball.destroy();
      splashCloud(s, land.x, land.y, m);
      return true;
    }
    return false;
  });
}

// 독구름: cloudTime 동안 남아서 안에 있는 주인공의 체력을 조금씩 깎는다.
function splashCloud(s, x, floorY, m) {
  if (!s.sys.isActive()) return;
  s.sfxPlay('venomSplash');
  ring(s, x, floorY - 8, VENOM_PURPLE, m.cloudWidth * 0.5, 240);
  s.greenGooAt(x, floorY - 6, 6);
  const w = m.cloudWidth;
  const h = m.cloudHeight;
  // 구름 덩이 여러 개를 겹쳐 둥실둥실한 구름을 만든다
  const puffs = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const fx = (i / (n - 1) - 0.5) * (w - 30);
    const fy = -h * (i % 2 === 0 ? 0.3 : 0.55);
    const img = s.add.image(x + fx, floorY + fy, 'monster_poison_puff').setDepth(9).setAlpha(0);
    img.setDisplaySize(44 + (i % 3) * 8, 38 + (i % 3) * 6);
    puffs.push({ img, fx, fy, sx: img.scaleX, sy: img.scaleY, ph: Math.random() * Math.PI * 2 });
  }
  const life = Math.max(0.2, m.cloudTime);
  let t = 0;
  let tickCd = 0;
  runEffect(s, (dt) => {
    t += dt;
    tickCd -= dt;
    // 처음엔 빠르게 퍼지고, 끝날 때 옅어진다
    const fadeIn = Math.min(1, t / 0.15);
    const fadeOut = Math.min(1, Math.max(0, (life - t) / 0.3));
    const a = 0.9 * fadeIn * fadeOut;
    for (const pf of puffs) {
      const wob = 1 + Math.sin(t * 6 + pf.ph) * 0.08;
      pf.img.setAlpha(a).setScale(pf.sx * wob * (0.7 + 0.3 * fadeIn), pf.sy * wob * (0.7 + 0.3 * fadeIn));
      pf.img.y = floorY + pf.fy - t * 6;
    }
    if (t >= life) {
      for (const pf of puffs) pf.img.destroy();
      return true;
    }
    const p = s.player;
    const area = new Rect(x - w / 2, floorY - h, w, h);
    if (tickCd <= 0 && !p.dead && intersects(area, p.getBounds())) {
      tickCd = m.cloudTickTime;
      poisonHero(s, p, m.cloudDamage);
    }
    return false;
  });
}

// 독구름 피해: 밀려나지 않고 체력만 조금 깎인다. 대시 무적, 궁극기, 맞은 직후 무적이면 괜찮음.
function poisonHero(s, p, damage) {
  if (p.dead || p.ultActive || p.dashInvuln > 0 || p.hurtInvuln > 0) return;
  const dealt = p.tickDamage ? p.tickDamage(damage) : p.health.damage(damage); // 방어력, 무적 별, 강철 몸 반영
  if (dealt <= 0) return;
  s.sfxPlay('poisonTick');
  floatText(s, p.x, p.y - 44, `-${dealt}`, '#c58cff', 18);
  p.setTint(0xc58cff);
  s.time.delayedCall(120, () => {
    if (p.active && !p.dead) p.clearTint();
  });
  s.greenGooAt(p.x, p.y - 10, 3);
  s.skills?.onHurt?.(dealt);
  if (p.health.isDead) p.die();
}
