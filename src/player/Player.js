import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { Cooldown } from '../logic/cooldown.js';
import { jumpKind } from '../logic/jump.js';
import { chargeRatio, resolveAttack, upperRect } from '../logic/combat.js';
import { HERO_FRAME, HERO_ORIGIN_Y, HERO_LOOKS } from '../fx/heroTextures.js';
import { normalizeHero, heroStats, gunnerAttack, giantAttack } from '../logic/heroes.js';

// 주인공: 이동, 점프, 대시, 충전 펀치, 위쪽 공격, 궁극기, 피격.
// 공격 판정과 효과는 scene.onPlayerAttack 이, 에너지탄과 궁극기는 scene.skills 가 맡는다.
// hero 로 주인공을 고른다 (src/logic/heroes.js): shock 주먹, gunner 번개 사수, giant 강철 거인.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cfg, { maxHealth, damageMultiplier = 1, powers = null, hero = 'shock' }) {
    hero = normalizeHero(hero);
    const look = HERO_LOOKS[hero];
    // customArt 로 player 그림을 넣었으면 쇼크 히어로는 그 한 장을 모든 동작에 쓴다
    const customArt = hero === 'shock' && Boolean(scene.registry.get('heroCustomArt'));
    super(scene, x, y, customArt ? 'player' : `${look.prefix}_idle0`);
    this.hero = hero;
    this.prefix = look.prefix;
    this.stats = heroStats(hero, cfg);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.customArt = customArt;
    if (customArt) {
      this.setDisplaySize(44, 64);
      this.body.setSize(this.width * 0.7, this.height * 0.9, true);
    } else {
      // 그림은 2배로 촘촘하게 그렸으니 절반 크기로 보여 준다. 몸통 판정은 30 x 56
      const k = this.width / HERO_FRAME.w;
      this.setScale(this.stats.scale / k); // 강철 거인은 몸이 더 크다
      this.setOrigin(0.5, HERO_ORIGIN_Y);
      this.body.setSize(30 * k, 56 * k, false);
      this.body.setOffset((this.width - 30 * k) / 2, HERO_FRAME.feetY * k - 56 * k);
    }
    this.setCollideWorldBounds(true);
    this.setDragX(1200);
    this.setDepth(10);

    this.cfg = cfg;
    this.health = new Health(maxHealth);
    // 레벨 업 카드로 정해지는 값들 (GameScene.applyUpgrades 가 바꾼다)
    this.baseDamageMultiplier = damageMultiplier;
    this.damageTakenMultiplier = 1; // 방어력
    this.speedMultiplier = 1; // 속도
    this.dashCooldownMultiplier = 1;
    this.powers = powers; // 보물 상자의 특별한 힘 (PowerSet)
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
    this.airJumpsLeft = 0; // 공중에서 더 뛸 수 있는 횟수 (땅에 닿으면 다시 참)
    this.ghostTimer = 0;
    this.dead = false;
    this.ultGauge = 0; // 궁극기 게이지 0 ~ 1 (HUD 가 그린다)
    this.ultActive = false; // 궁극기 쓰는 중 (무적)
    this.ultPose = null;
    this.poseName = null; // 잠깐 보여 줄 공격 자세
    this.poseTime = 0;
    this.lastMoving = false;
    this.spinLeft = 0; // 강철 거인 회오리가 남은 시간
    this.spinFlip = 0;
    this.swim = null; // 수중 스테이지면 GameScene 이 SwimController 를 붙인다 (src/player/swim.js)
  }

  // 공격 피해 배수: 레벨 업 카드(공격력) x 파워 장갑
  get damageMultiplier() {
    const glove = this.powers?.has('power') ? this.cfg.powers.power.damageMultiplier : 1;
    return this.baseDamageMultiplier * glove;
  }

  set damageMultiplier(v) {
    this.baseDamageMultiplier = v;
  }

  get moveSpeed() {
    const boots = this.powers?.has('speed') ? this.cfg.powers.speed.moveMultiplier : 1;
    return this.cfg.player.moveSpeed * this.speedMultiplier * boots * this.stats.move;
  }

  get invincible() {
    return Boolean(this.powers?.has('star'));
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

  // 적 공격에 맞았는지는 그림 틀(머리 위 빈 공간 포함, 키 78) 말고 실제 몸통(30 x 56)으로 본다.
  // 그림 틀로 보면 "높다! 가만히!" 주먹이 가만히 서 있어도 머리 위 빈 곳에 닿았다.
  getBounds(output) {
    const b = this.body;
    if (!b) return super.getBounds(output);
    const r = output || new Phaser.Geom.Rectangle();
    return r.setTo(b.x, b.y, b.width, b.height);
  }

  update(dt, input) {
    this.step(dt, input);
    this.updateAnim();
  }

  step(dt, input) {
    this.poseTime = Math.max(0, this.poseTime - dt);
    const boots = this.powers?.has('speed') ? this.cfg.powers.speed.dashCooldownMultiplier : 1;
    this.dashCd.duration = this.cfg.dash.cooldown * this.dashCooldownMultiplier * boots;
    this.dashCd.remaining = Math.min(this.dashCd.remaining, this.dashCd.duration);
    this.dashCd.update(dt);
    this.attackCd.update(dt);
    if (this.spinLeft > 0) {
      this.spinLeft = Math.max(0, this.spinLeft - dt);
      if (this.spinLeft <= 0) this.scene.skills?.endSpin(this);
    }
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
    if (onGround) this.airJumpsLeft = (this.cfg.player.airJumps || 0) + (this.bonusAirJumps || 0); // 상점 트리플 점프면 +1
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

    if (attackPressed && !this.charging && this.spinLeft <= 0 && this.attackCd.ready && this.hurtLock <= 0) {
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
    let speed = this.moveSpeed;
    if (this.isCharging) speed *= this.cfg.charge.moveSpeedMultiplier;
    if (this.spinLeft > 0) speed *= this.cfg.heroes.giant.spinMoveMultiplier;
    this.setVelocityX(dir * speed);
    if (dir !== 0) this.facing = dir;
    if (this.spinLeft > 0) {
      // 회오리: 빙글빙글 도는 것처럼 좌우를 빠르게 바꿔 보여 준다
      this.spinFlip += dt;
      this.setFlipX(Math.floor(this.spinFlip / 0.07) % 2 === 0);
    } else {
      this.setFlipX(this.facing < 0);
    }

    const kind = jumpKind({ jumpPressed: input.jumpPressed, jumpBuffer: this.jumpBuffer, coyote: this.coyote, airJumpsLeft: this.airJumpsLeft });
    if (kind === 'ground') {
      this.setVelocityY(-this.cfg.player.jumpSpeed * this.stats.jump);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.scene.onPlayerJump();
    } else if (kind === 'air') {
      // 더블 점프: 공중에서 한 번 더 (떨어지는 중이어도 위로 다시 뜀)
      this.setVelocityY(-this.cfg.player.doubleJumpSpeed * this.stats.jump);
      this.jumpBuffer = 0;
      this.airJumpsLeft -= 1;
      this.scene.tweens.add({ targets: this, angle: { from: 0, to: 360 * this.facing }, duration: 320, onComplete: () => !this.dead && this.setAngle(0) });
      this.scene.onPlayerDoubleJump?.(this);
    }
    // 점프 버튼을 일찍 떼면 낮게 뛴다
    if (jumpReleased && this.body.velocity.y < 0) this.setVelocityY(this.body.velocity.y * 0.5);
  }

  startDash(input) {
    this.cancelCharge();
    if (this.spinLeft > 0) {
      this.spinLeft = 0;
      this.scene.skills?.endSpin(this);
    }
    if (this.hero === 'gunner') return this.startBackstep(input);
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0) || this.facing;
    this.facing = dir;
    this.setFlipX(dir < 0);
    this.dashTime = this.cfg.dash.duration;
    this.dashInvuln = this.cfg.dash.invincibleTime;
    this.dashCd.trigger();
    this.body.allowGravity = false;
    this.setVelocity(dir * this.cfg.dash.speed, 0);
    this.swim?.onDash(dir, input); // 수중 스테이지: 헤엄 돌진
    this.rushHits = this.hero === 'giant' ? new Set() : null; // 강철 거인: 몸통 박치기로 이미 친 적
    this.scene.onDash(this);
  }

  // 번개 사수의 대시: 앞을 본 채로 뒤로 폴짝 빠진다 (물속에서는 뒤로 쑥 헤엄쳐 빠진다)
  startBackstep(input = {}) {
    const g = this.cfg.heroes.gunner;
    this.dashTime = this.cfg.dash.duration * 1.3;
    this.dashInvuln = this.cfg.dash.invincibleTime;
    this.dashCd.trigger();
    this.setFlipX(this.facing < 0);
    if (this.swim) {
      this.body.allowGravity = false;
      this.swim.onBackstep(this.facing, g.backstepSpeed, input);
    } else {
      this.body.allowGravity = true;
      this.setVelocity(-this.facing * g.backstepSpeed, -g.backstepHop);
    }
    this.rushHits = null;
    this.scene.onDash(this);
  }

  endDash() {
    this.dashTime = 0;
    this.body.allowGravity = true;
    this.setVelocityX(this.body.velocity.x * 0.3);
  }

  releaseAttack(input = {}) {
    const up = Boolean(input.upDown);
    const resolve = this.hero === 'gunner' ? gunnerAttack : this.hero === 'giant' ? giantAttack : resolveAttack;
    const attack = resolve(this.chargeHeld, this.cfg, this.damageMultiplier, { up });
    this.lastMoving = Boolean(input.left || input.right);
    const glow = attack.kind === 'charged' && attack.style !== 'smash';
    this.poseName = attack.up ? (glow ? 'upperGlow' : 'upper') : glow ? 'punchGlow' : 'punch';
    this.poseTime = glow ? 0.26 : 0.16;
    if (attack.style === 'smash') {
      this.poseName = 'smash';
      this.poseTime = 0.28;
    }
    this.charging = false;
    this.chargeHeld = 0;
    // 주인공마다 다음 공격까지 기다리는 시간이 다르다 (번개탄은 빠르게, 망치는 느리게)
    const h = this.cfg.heroes;
    this.attackCd.duration =
      attack.style === 'bolt' ? h.gunner.boltCooldown : attack.style === 'smash' ? h.giant.smashCooldown : this.cfg.punch.cooldown;
    this.attackCd.trigger();
    if (attack.style === 'spin') {
      this.spinLeft = attack.time;
      this.spinFlip = 0;
    }
    this.scene.onPlayerAttack(this, attack);
  }

  cancelCharge() {
    if (!this.charging) return;
    const wasCharging = this.isCharging;
    this.charging = false;
    this.chargeHeld = 0;
    if (wasCharging) this.scene.onChargeCancelled(this);
  }

  // 결과: 'hit' 맞음(방패가 다 막아도 'hit'), 'dodged' 대시로 피함, 'ignored' 무적 중이라 무시
  hurt(damage, fromX, knockback = this.cfg.player.hurtKnockback) {
    if (this.dead || this.ultActive) return 'ignored';
    if (this.invincible) return 'ignored'; // 무적 별
    if (this.dashInvuln > 0) {
      this.scene.onDodge(this);
      return 'dodged';
    }
    if (this.hurtInvuln > 0) return 'ignored';

    // 볼트 방패가 있으면 한 번 막아 준다
    if (this.scene.robot?.tryGuard?.(this)) return this.blockedHit(fromX);

    // 방어력 카드만큼 덜 아프고, 강철 몸 방패가 먼저 받는다
    let left = Math.max(1, Math.round(damage * this.damageTakenMultiplier));
    if (this.powers) {
      const r = this.powers.absorb(left);
      if (r.absorbed > 0) this.scene.onShieldAbsorb?.(this, r.absorbed, r.broke);
      left = r.left;
    }
    if (left <= 0) return this.blockedHit(fromX);
    damage = left;

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

  // 지속 피해(독구름 같은 것): 밀려나지 않고 체력만 깎인다. 실제로 깎인 체력을 돌려준다.
  // 무적 별이면 0, 방어력 카드만큼 덜 아프고, 강철 몸 방패가 먼저 받는다. (볼트 방패는 아끼느라 안 씀)
  tickDamage(damage) {
    if (this.dead || this.invincible || !(damage > 0)) return 0;
    let left = Math.max(1, Math.round(damage * this.damageTakenMultiplier));
    if (this.powers) {
      const r = this.powers.absorb(left);
      if (r.absorbed > 0) this.scene.onShieldAbsorb?.(this, r.absorbed, r.broke);
      left = r.left;
    }
    return left > 0 ? this.health.damage(left) : 0;
  }

  // 방패가 공격을 다 막았을 때: 체력은 그대로, 살짝 밀리고 잠깐 무적
  blockedHit(fromX) {
    this.hurtInvuln = this.cfg.player.hurtInvincibleTime;
    const dir = this.x < fromX ? -1 : 1;
    this.setVelocity(dir * 160, -140);
    return 'hit';
  }

  die() {
    this.dead = true;
    this.spinLeft = 0;
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
    if (this.spinLeft > 0 && !this.dead && this.hurtLock <= 0) return this.play(`${this.prefix}-spin`, true);
    const onGround = this.body.blocked.down || this.body.touching.down;
    let a;
    if (this.dead || this.hurtLock > 0) a = 'hurt';
    else if (this.ultActive) a = this.ultPose || 'slam';
    else if (this.dashing) a = this.hero === 'gunner' && !this.swim ? 'jump' : 'dash'; // 백스텝은 폴짝 뛰는 자세
    else if (this.poseTime > 0 && this.poseName) a = this.poseName;
    else if (this.isCharging) a = 'charge';
    else if (!onGround) a = this.body.velocity.y < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.body.velocity.x) > 30) a = 'run';
    else a = 'idle';
    this.play(`${this.prefix}-${a}`, true);
  }

  // 위쪽 공격(어퍼컷)이 닿는 키 큰 사각형
  upperRect(reach, width = this.cfg.skills.upperWidth) {
    const r = upperRect(this.x, this.y, this.facing, reach, width);
    return new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h);
  }

  attackRect(range) {
    const x = this.facing > 0 ? this.x + 8 : this.x - 8 - range;
    return new Phaser.Geom.Rectangle(x, this.y - 38, range, 72);
  }
}
