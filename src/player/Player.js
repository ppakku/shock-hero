import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { Cooldown } from '../logic/cooldown.js';
import { chargeRatio, resolveAttack, upperRect } from '../logic/combat.js';
import { HERO_FRAME, HERO_ORIGIN_Y } from '../fx/heroTextures.js';

// 주인공: 이동, 점프, 대시, 충전 펀치, 위쪽 공격, 궁극기, 피격.
// 공격 판정과 효과는 scene.onPlayerAttack 이, 에너지탄과 궁극기는 scene.skills 가 맡는다.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cfg, { maxHealth, damageMultiplier }) {
    // customArt 로 player 그림을 넣었으면 그 한 장을 모든 동작에 쓴다
    const customArt = Boolean(scene.registry.get('heroCustomArt'));
    super(scene, x, y, customArt ? 'player' : 'hero_idle0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.customArt = customArt;
    if (customArt) {
      this.setDisplaySize(44, 64);
      this.body.setSize(this.width * 0.7, this.height * 0.9, true);
    } else {
      // 그림은 2배로 촘촘하게 그렸으니 절반 크기로 보여 준다. 몸통 판정은 30 x 56
      const k = this.width / HERO_FRAME.w;
      this.setScale(1 / k);
      this.setOrigin(0.5, HERO_ORIGIN_Y);
      this.body.setSize(30 * k, 56 * k, false);
      this.body.setOffset((this.width - 30 * k) / 2, HERO_FRAME.feetY * k - 56 * k);
    }
    this.setCollideWorldBounds(true);
    this.setDragX(1200);
    this.setDepth(10);

    this.cfg = cfg;
    this.health = new Health(maxHealth);
    this.damageMultiplier = damageMultiplier;
    this.facing = 1;
    this.dashCd = new Cooldown(cfg.dash.cooldown);
    this.attackCd = new Cooldown(cfg.punch.cooldown);
    this.dashTime = 0;
    this.dashInvuln = 0;
    this.hurtInvuln = 0;
    this.hurtLock = 0;
    this.charging = false;
    this.chargeHeld = 0;
    this.wasAttackDown = false;
    this.wasJumpDown = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.ghostTimer = 0;
    this.dead = false;
    this.ultGauge = 0; // 궁극기 게이지 0 ~ 1 (HUD 가 그린다)
    this.ultActive = false; // 궁극기 쓰는 중 (무적)
    this.ultPose = null;
    this.poseName = null; // 잠깐 보여 줄 공격 자세
    this.poseTime = 0;
    this.lastMoving = false;
    this.swim = null; // 수중 스테이지면 GameScene 이 SwimController 를 붙인다 (src/player/swim.js)
  }

  get dashing() {
    return this.dashTime > 0;
  }

  get chargeRatio() {
    return this.charging ? chargeRatio(this.chargeHeld, this.cfg.charge) : 0;
  }

  // 기본 펀치 구간을 넘겨 실제로 충전 중인지
  get isCharging() {
    return this.charging && this.chargeHeld >= this.cfg.charge.minTime;
  }

  update(dt, input) {
    this.step(dt, input);
    this.updateAnim();
  }

  step(dt, input) {
    this.poseTime = Math.max(0, this.poseTime - dt);
    this.dashCd.update(dt);
    this.attackCd.update(dt);
    this.dashInvuln = Math.max(0, this.dashInvuln - dt);
    this.hurtInvuln = Math.max(0, this.hurtInvuln - dt);
    this.hurtLock = Math.max(0, this.hurtLock - dt);

    const attackPressed = input.attackDown && !this.wasAttackDown;
    this.wasAttackDown = input.attackDown;
    const jumpReleased = this.wasJumpDown && !input.jumpDown;
    this.wasJumpDown = input.jumpDown;

    if (this.dead) return;

    const onGround = this.body.blocked.down || this.body.touching.down;
    this.coyote = onGround ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = input.jumpPressed ? 0.12 : Math.max(0, this.jumpBuffer - dt);

    const blinking = this.hurtInvuln > 0 && Math.floor(this.hurtInvuln * 16) % 2 === 0;
    this.setAlpha(blinking ? 0.35 : 1);

    // 궁극기 중에는 scene.skills 가 움직인다
    if (this.ultActive) return;
    if (input.ultPressed && this.hurtLock <= 0 && this.scene.skills?.startUltimate(this)) return;

    if (this.dashing) {
      this.dashTime -= dt;
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghostTimer = 0.03;
        this.scene.spawnGhost(this);
      }
      if (this.dashTime <= 0) this.endDash();
      return;
    }

    if (input.dashPressed && this.dashCd.ready && this.hurtLock <= 0) {
      this.startDash(input);
      return;
    }

    if (attackPressed && !this.charging && this.attackCd.ready && this.hurtLock <= 0) {
      this.charging = true;
      this.chargeHeld = 0;
    }
    if (this.charging) {
      const before = this.chargeRatio;
      this.chargeHeld += dt;
      if (before < 1 && this.chargeRatio >= 1) this.scene.onChargeFull(this);
      if (!input.attackDown) this.releaseAttack(input);
    }

    if (this.hurtLock > 0) return;

    // 수중 스테이지: 걷기와 점프 대신 헤엄치기 (src/player/swim.js)
    if (this.swim) return this.swim.move(dt, input);

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let speed = this.cfg.player.moveSpeed;
    if (this.isCharging) speed *= this.cfg.charge.moveSpeedMultiplier;
    this.setVelocityX(dir * speed);
    if (dir !== 0) this.facing = dir;
    this.setFlipX(this.facing < 0);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.setVelocityY(-this.cfg.player.jumpSpeed);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.scene.onPlayerJump();
    }
    // 점프 버튼을 일찍 떼면 낮게 뛴다
    if (jumpReleased && this.body.velocity.y < 0) this.setVelocityY(this.body.velocity.y * 0.5);
  }

  startDash(input) {
    this.cancelCharge();
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0) || this.facing;
    this.facing = dir;
    this.setFlipX(dir < 0);
    this.dashTime = this.cfg.dash.duration;
    this.dashInvuln = this.cfg.dash.invincibleTime;
    this.dashCd.trigger();
    this.body.allowGravity = false;
    this.setVelocity(dir * this.cfg.dash.speed, 0);
    this.swim?.onDash(dir, input); // 수중 스테이지: 헤엄 돌진
    this.scene.onDash(this);
  }

  endDash() {
    this.dashTime = 0;
    this.body.allowGravity = true;
    this.setVelocityX(this.body.velocity.x * 0.3);
  }

  releaseAttack(input = {}) {
    const attack = resolveAttack(this.chargeHeld, this.cfg, this.damageMultiplier, { up: Boolean(input.upDown) });
    this.lastMoving = Boolean(input.left || input.right);
    const glow = attack.kind === 'charged';
    this.poseName = attack.up ? (glow ? 'upperGlow' : 'upper') : glow ? 'punchGlow' : 'punch';
    this.poseTime = glow ? 0.26 : 0.16;
    this.charging = false;
    this.chargeHeld = 0;
    this.attackCd.trigger();
    this.scene.onPlayerAttack(this, attack);
  }

  cancelCharge() {
    if (!this.charging) return;
    const wasCharging = this.isCharging;
    this.charging = false;
    this.chargeHeld = 0;
    if (wasCharging) this.scene.onChargeCancelled(this);
  }

  // 결과: 'hit' 맞음, 'dodged' 대시로 피함, 'ignored' 무적 중이라 무시
  hurt(damage, fromX, knockback = this.cfg.player.hurtKnockback) {
    if (this.dead || this.ultActive) return 'ignored';
    if (this.dashInvuln > 0) {
      this.scene.onDodge(this);
      return 'dodged';
    }
    if (this.hurtInvuln > 0) return 'ignored';

    this.health.damage(damage);
    this.cancelCharge();
    if (this.dashing) this.endDash();
    this.hurtInvuln = this.cfg.player.hurtInvincibleTime;
    this.hurtLock = 0.3;
    const dir = this.x < fromX ? -1 : 1;
    this.setVelocity(dir * knockback, -220);
    this.scene.onPlayerHurt(this, damage);
    if (this.health.isDead) this.die();
    return 'hit';
  }

  die() {
    this.dead = true;
    this.charging = false;
    this.body.allowGravity = true;
    this.setAlpha(1);
    this.setTint(0x777777);
    this.setVelocityX(0);
    this.scene.tweens.add({ targets: this, angle: -90 * this.facing, duration: 400 });
    this.scene.onPlayerDied(this);
  }

  // 동작에 맞는 그림(애니메이션)으로 바꾼다
  updateAnim() {
    if (this.customArt) return;
    const onGround = this.body.blocked.down || this.body.touching.down;
    let a;
    if (this.dead || this.hurtLock > 0) a = 'hurt';
    else if (this.ultActive) a = this.ultPose || 'slam';
    else if (this.dashing) a = 'dash';
    else if (this.poseTime > 0 && this.poseName) a = this.poseName;
    else if (this.isCharging) a = 'charge';
    else if (!onGround) a = this.body.velocity.y < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.body.velocity.x) > 30) a = 'run';
    else a = 'idle';
    this.play(`hero-${a}`, true);
  }

  // 위쪽 공격(어퍼컷)이 닿는 키 큰 사각형
  upperRect(reach) {
    const r = upperRect(this.x, this.y, this.facing, reach, this.cfg.skills.upperWidth);
    return new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h);
  }

  attackRect(range) {
    const x = this.facing > 0 ? this.x + 8 : this.x - 8 - range;
    return new Phaser.Geom.Rectangle(x, this.y - 38, range, 72);
  }
}
