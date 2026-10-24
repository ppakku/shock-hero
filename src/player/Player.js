import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { Cooldown } from '../logic/cooldown.js';
import { chargeRatio, resolveAttack } from '../logic/combat.js';

// 주인공: 이동, 점프, 대시, 충전 펀치, 피격.
// 공격 판정과 효과는 scene.onPlayerAttack 이 맡는다.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cfg, { maxHealth, damageMultiplier }) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(40, 60);
    this.body.setSize(this.width * 0.8, this.height * 0.93, true);
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
      if (!input.attackDown) this.releaseAttack();
    }

    if (this.hurtLock > 0) return;

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
    this.scene.onDash(this);
  }

  endDash() {
    this.dashTime = 0;
    this.body.allowGravity = true;
    this.setVelocityX(this.body.velocity.x * 0.3);
  }

  releaseAttack() {
    const attack = resolveAttack(this.chargeHeld, this.cfg, this.damageMultiplier);
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
    if (this.dead) return 'ignored';
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

  attackRect(range) {
    const x = this.facing > 0 ? this.x + 8 : this.x - 8 - range;
    return new Phaser.Geom.Rectangle(x, this.y - 38, range, 72);
  }
}
