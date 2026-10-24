import Phaser from 'phaser';
import { Monster } from './Monster.js';
import { flash, floatText, ring } from '../fx/effects.js';
import { bomberHoverY, bomberXRange, bombLandingY, pushedKnockback, BOMBER_MAX_Y, BOMBER_MIN_Y } from '../logic/monsters.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;

// balance.js 에서 숫자를 지워 버려도 돌아가게 쓰는 기본값
const DEFAULTS = { hoverY: 290, bombInterval: 2.8, bombWarningTime: 0.9, bombFallTime: 0.35, bombDamage: 14, bombRadius: 55, tiredTime: 1.3 };

// 폭탄벌레: 하늘을 날며 주인공 위로 따라와서 폭탄을 떨어뜨린다.
// 떠 있기 → (빨간 원 경고) 조준 → 폭탄 떨어뜨림 → 낮게 내려와 쉬기 → 다시 떠오르기
// 높이는 항상 250 ~ 340 사이라서 점프 펀치나 위쪽 공격으로 잡을 수 있다.
export class Bomber extends Monster {
  constructor(scene, spot, cfg) {
    super(scene, spot, cfg);
    this.m = { ...DEFAULTS, ...this.m };
    this.flying = true;
    this.body.setAllowGravity(false);
    // 발판이나 땅에 걸리지 않게 충돌을 끈다 (가로 범위는 직접 막는다)
    this.body.checkCollision.none = true;
    this.setDragX(400);
    this.hoverY = bomberHoverY(spot.y, this.m.hoverY);
    this.baseY = this.hoverY;
    this.y = this.hoverY;
    this.bob = Math.random() * Math.PI * 2;
    this.bombCd = 1.2; // 처음 폭탄은 조금 늦게
    this.pendingBomb = null;
    this.state = 'idle';
  }

  update(dt) {
    if (this.dead) return;
    this.stateTime += dt;
    this.bob += dt * 4;
    this.bombCd -= dt;
    this.think(dt);
    // 높이: 기본 높이에서 살짝 위아래로 흔들림. 절대 250 위로는 안 올라감
    const wobble = this.state === 'aim' ? 0 : Math.sin(this.bob) * 10;
    this.y = Phaser.Math.Clamp(this.baseY + wobble, BOMBER_MIN_Y, BOMBER_MAX_Y);
    this.body.setVelocityY(0);
    // 가로: 스테이지 밖이나 보스 문 너머로 못 감
    const range = bomberXRange(this.scene.stage, this.scene.gateOpen);
    if (this.x < range.min || this.x > range.max) {
      this.x = Phaser.Math.Clamp(this.x, range.min, range.max);
      this.body.setVelocityX(0);
    }
    this.alert.setPosition(this.x, this.y - 36);
    this.setFlipX(this.facing < 0);
    // 날갯짓
    this.scaleY = this.baseScaleY * (1 + Math.sin(this.bob * 5) * 0.04);
  }

  get baseScaleY() {
    if (this._baseScaleY === undefined) this._baseScaleY = this.scaleY;
    return this._baseScaleY;
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
        // 주인공 바로 위로 천천히 따라간다
        this.baseY = ease(this.hoverY, 3);
        this.facing = Math.sign(dx) || this.facing;
        const speed = dist > 12 ? Math.min(this.m.moveSpeed, dist * 3) : 0;
        this.setVelocityX(Math.sign(dx) * speed);
        if (p.dead || dist > this.m.sightRange * 1.6) {
          this.origin = this.x;
          this.changeState('idle');
        } else if (this.bombCd <= 0 && dist < 90) {
          this.startAim();
        }
        break;
      }
      case 'aim': {
        // 제자리에 멈춰 빨갛게 깜빡임. 바닥의 빨간 원으로 떨어질 곳을 알려 줌
        this.setVelocityX(0);
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xff3030);
        else this.clearTint();
        if (this.stateTime >= this.m.bombWarningTime) this.releaseBomb();
        break;
      }
      case 'tired': {
        // 폭탄을 떨어뜨리고 지쳐서 낮게 내려옴 (점프 펀치로 때리기 좋은 때)
        this.setVelocityX(0);
        this.baseY = ease(BOMBER_MAX_Y, 4);
        if (this.stateTime >= this.m.tiredTime) this.changeState('hover');
        break;
      }
      case 'stunned': {
        this.baseY = ease(Math.min(BOMBER_MAX_Y, this.hoverY + 25), 4);
        if (this.stateTime >= this.stunTime) this.changeState('hover');
        break;
      }
      default:
        this.changeState('hover');
        break;
    }
  }

  // 조준 시작: 아래 바닥에 경고 원을 그린다
  startAim() {
    const s = this.scene;
    const m = this.m;
    const x = this.x;
    const landY = bombLandingY(x, this.y, s.stage.platforms, s.stage.groundY);
    const r = m.bombRadius;
    const g = s.add.graphics().setDepth(4);
    const bomb = { x, landY, g, t: 0, cancelled: false, dropped: false };
    // 경고 원은 장면 시간으로 그린다 (벌레가 죽어도 남은 폭탄은 끝까지 처리)
    bomb.timer = s.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        bomb.t += 0.016;
        const total = m.bombWarningTime + m.bombFallTime;
        const k = Math.min(1, bomb.t / total);
        const blink = Math.floor(bomb.t * 10) % 2 === 0;
        g.clear();
        g.fillStyle(0x000000, 0.25 + 0.3 * k).fillEllipse(x, landY, r * 2 * (0.4 + 0.6 * k), 18);
        g.fillStyle(0xff3030, blink ? 0.3 : 0.18).fillEllipse(x, landY, r * 2, 24);
        g.lineStyle(4, blink ? 0xffe0e0 : 0xff3030, 1).strokeEllipse(x, landY, r * 2, 24);
        // 떨어질 곳 위로 세로 점선
        for (let y = landY - 20; y > landY - 90; y -= 16) g.fillStyle(0xff3030, 0.5 * k + 0.2).fillRect(x - 2, y, 4, 8);
      },
    });
    this.pendingBomb = bomb;
    this.scene.sfxPlay('warn');
    this.changeState('aim');
  }

  // 폭탄을 떨어뜨린다
  releaseBomb() {
    const bomb = this.pendingBomb;
    this.pendingBomb = null;
    this.bombCd = this.m.bombInterval;
    this.changeState('tired');
    if (!bomb) return;
    bomb.dropped = true;
    const s = this.scene;
    const m = this.m;
    const img = s.add.image(bomb.x, this.y + 18, 'monster_bomb').setDepth(8).setDisplaySize(22, 26);
    s.sfxPlay('bombDrop');
    s.tweens.add({
      targets: img,
      y: bomb.landY - 12,
      angle: 200,
      duration: Math.max(50, m.bombFallTime * 1000),
      ease: 'Quad.easeIn',
      onComplete: () => {
        img.destroy();
        explodeBomb(s, bomb, m);
      },
    });
  }

  cancelBomb() {
    const bomb = this.pendingBomb;
    if (!bomb || bomb.dropped) return;
    bomb.cancelled = true;
    bomb.timer.remove();
    bomb.g.destroy();
    this.pendingBomb = null;
    this.bombCd = Math.max(this.bombCd, 1.0);
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
    this.cancelBomb();
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
    this.cancelBomb();
    this.alert.destroy();
    this.body.enable = false;
    this.clearTint();
    this.scene.onMonsterKilled(this);
    const s = this.scene;
    const landY = bombLandingY(this.x, this.y, s.stage.platforms, s.stage.groundY) - 18;
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

// 폭탄이 터진다. 벌레가 이미 쓰러졌어도 떨어진 폭탄은 터진다.
function explodeBomb(s, bomb, m) {
  bomb.timer.remove();
  bomb.g.destroy();
  if (!s.sys.isActive()) return;
  const r = m.bombRadius;
  s.sfxPlay('bomb');
  s.sparks.explode(18, bomb.x, bomb.landY - 10);
  s.dustAt(bomb.x, bomb.landY - 4, 8);
  ring(s, bomb.x, bomb.landY - 10, 0xff8a2a, r, 260);
  const boom = s.add.ellipse(bomb.x, bomb.landY - r * 0.4, r * 1.6, r * 1.1, 0xffb030, 0.85).setDepth(24);
  s.tweens.add({ targets: boom, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 260, onComplete: () => boom.destroy() });
  s.shake(0.006, 120);
  const p = s.player;
  const area = new Rect(bomb.x - r, bomb.landY - r * 1.2, r * 2, r * 1.2 + 10);
  if (!p.dead && intersects(area, p.getBounds())) p.hurt(m.bombDamage, bomb.x, m.heroKnockback);
}
