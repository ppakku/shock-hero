import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { chooseBossAttack, bossSpeedMultiplier, coreDamage, rockTargets } from '../logic/boss.js';
import { flash, floatText } from '../fx/effects.js';
import { makeText } from '../ui/text.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
const lerp = Phaser.Math.Linear;
const RAISED_Y = 230; // 팔을 들고 있을 때 주먹 아래쪽 높이

// 부술 수 있는 팔 하나
class BossArm {
  constructor(scene, id, label, home, shoulder, maxHealth, tint, linkColor) {
    this.scene = scene;
    this.id = id;
    this.label = label;
    this.home = home;
    this.shoulder = shoulder;
    this.tint = tint;
    this.linkColor = linkColor;
    this.sprite = scene.add.image(home.x, home.y, 'boss_arm').setOrigin(0.5, 1).setDepth(5).setDisplaySize(70, 210);
    if (tint !== null) this.sprite.setTint(tint);
    this.health = new Health(maxHealth);
    this.alive = true;
    this.hittable = false;
    this.hint = makeText(scene, home.x, home.y, '지금! 때려!', 18, '#ffd23f').setOrigin(0.5).setDepth(31).setVisible(false);
  }

  // 플레이어 주먹이 맞는 곳 (주먹과 팔 아래쪽)
  hitRect() {
    return new Rect(this.sprite.x - 35, this.sprite.y - 120, 70, 120);
  }

  // 보스 공격이 플레이어를 맞히는 곳 (팔 전체)
  attackRect() {
    return new Rect(this.sprite.x - 32, this.sprite.y - 200, 64, 200);
  }

  setHittable(on) {
    this.hittable = on && this.alive;
    this.hint.setVisible(this.hittable);
    if (!this.hittable && this.alive) {
      if (this.tint !== null) this.sprite.setTint(this.tint);
      else this.sprite.clearTint();
    }
  }
}

// 다중 팔 돌연변이: 팔 2개를 부수면 장갑이 떨어지고 코어가 드러난다.
export class Boss {
  constructor(scene, cfg, stage) {
    this.scene = scene;
    this.c = cfg.boss;
    this.groundY = stage.groundY;
    this.minX = stage.arena.startX + 60;
    this.bodyX = stage.arena.endX - 150;
    this.frontX = this.bodyX - 110;
    this.maxArmX = this.frontX - 70;

    this.links = scene.add.graphics().setDepth(3);
    this.warn = scene.add.graphics().setDepth(2);
    this.warnLabel = makeText(scene, 0, 0, '', 22, '#ff5555').setOrigin(0.5).setDepth(31).setVisible(false);

    this.body = scene.add.image(this.bodyX, this.groundY, 'boss_body').setOrigin(0.5, 1).setDepth(4).setDisplaySize(220, 280);
    this.blocker = scene.add.zone(this.bodyX, this.groundY - 140, 200, 280);
    scene.physics.add.existing(this.blocker, true);

    this.corePos = { x: this.frontX + 12, y: this.groundY - 80 };
    this.core = scene.add.image(this.corePos.x, this.corePos.y, 'boss_core').setDepth(6).setDisplaySize(56, 56);
    this.armor = scene.add.image(this.corePos.x, this.corePos.y, 'boss_armor').setDepth(7).setDisplaySize(80, 80);
    this.coreHealth = new Health(this.c.coreHealth);
    this.coreExposed = false;

    this.arms = [
      new BossArm(scene, 'left', '왼팔', { x: this.maxArmX - 60, y: RAISED_Y }, { x: this.frontX + 25, y: this.groundY - 210 }, this.c.armHealth, null, 0x7a3cbf),
      new BossArm(scene, 'right', '오른팔', { x: this.maxArmX - 230, y: RAISED_Y - 40 }, { x: this.frontX + 55, y: this.groundY - 250 }, this.c.armHealth, 0xc9a0ff, 0x9c78c9),
    ];

    this.rocks = [];
    this.state = 'dormant';
    this.action = null;
    this.timer = 0;
    this.t = 0;
    this.defeated = false;
    this.lastBlockedAt = -10;
  }

  get armsAlive() {
    return this.arms.filter((a) => a.alive);
  }

  get speed() {
    return bossSpeedMultiplier(this.armsAlive.length);
  }

  startFight() {
    if (this.state !== 'dormant') return;
    this.state = 'intro';
    this.timer = 1.8;
    this.scene.tweens.add({ targets: this.body, x: this.bodyX + 6, duration: 60, yoyo: true, repeat: 10 });
  }

  update(dt) {
    this.t += dt;
    this.drawLinks();

    if (this.coreExposed && !this.defeated) {
      const s = 1 + Math.sin(this.t * 8) * 0.08;
      this.core.setDisplaySize(56 * s, 56 * s);
    }
    for (const arm of this.arms) {
      if (arm.hittable) {
        arm.hint.setPosition(arm.sprite.x, arm.sprite.y - 230).setAlpha(0.6 + Math.sin(this.t * 12) * 0.4);
        if (Math.floor(this.t * 8) % 2 === 0) arm.sprite.setTint(0xfff3a0);
        else if (arm.tint !== null) arm.sprite.setTint(arm.tint);
        else arm.sprite.clearTint();
      }
    }

    if (this.state === 'dormant' || this.state === 'dead') {
      this.bobArms(dt);
      return;
    }
    if (this.state === 'intro') {
      this.bobArms(dt);
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'fight';
        this.timer = 0.4;
      }
      return;
    }

    if (!this.action) {
      this.bobArms(dt);
      this.timer -= dt;
      if (this.timer <= 0 && !this.scene.player.dead) this.startAction(chooseBossAttack(this.armsAlive));
      return;
    }
    if (this.action.type === 'rocks') this.runRocks(dt);
    else this.runArm(dt);
  }

  bobArms(dt) {
    const k = 1 - Math.exp(-4 * dt);
    for (const arm of this.armsAlive) {
      if (this.action && this.action.arm === arm) continue;
      const s = arm.sprite;
      s.x += (arm.home.x - s.x) * k;
      s.y += (arm.home.y + Math.sin(this.t * 2 + arm.home.x) * 10 - s.y) * k;
    }
  }

  drawLinks() {
    this.links.clear();
    for (const arm of this.armsAlive) {
      const top = { x: arm.sprite.x, y: arm.sprite.y - 200 };
      this.links.lineStyle(26, arm.linkColor, 1).lineBetween(arm.shoulder.x, arm.shoulder.y, top.x, top.y);
      this.links.fillStyle(arm.linkColor, 1).fillCircle(arm.shoulder.x, arm.shoulder.y, 16).fillCircle(top.x, top.y, 14);
    }
  }

  startAction(choice) {
    const p = this.scene.player;
    const a = { ...choice, phase: 'aim', t: 0, hasHit: false };
    if (a.type === 'slam') a.target = Phaser.Math.Clamp(p.x, this.minX, this.maxArmX);
    if (a.type === 'sweep') {
      a.startX = this.maxArmX;
      a.endX = this.minX;
    }
    if (a.type === 'rocks') {
      a.targets = rockTargets(p.x, Math.max(1, Math.round(this.c.rockCount)), this.minX, this.maxArmX + 40);
      this.scene.tweens.add({ targets: this.body, y: this.groundY - 10, duration: 120, yoyo: true });
    }
    this.action = a;
    this.scene.sfxPlay('warn');
  }

  endAction() {
    if (this.action?.arm) this.action.arm.setHittable(false);
    this.action = null;
    this.warn.clear();
    this.warnLabel.setVisible(false);
    for (const r of this.rocks) r.destroy();
    this.rocks = [];
    this.timer = this.c.idleTime * this.speed;
  }

  // 내려찍기와 바닥 쓸기
  runArm(dt) {
    const a = this.action;
    const arm = a.arm;
    if (!arm.alive) {
      this.endAction();
      return;
    }
    const s = arm.sprite;
    const m = this.speed;
    a.t += dt;

    switch (a.phase) {
      case 'aim': {
        const dur = (a.type === 'slam' ? this.c.slamWarningTime : this.c.sweepWarningTime) * m;
        const tx = a.type === 'slam' ? a.target : a.startX;
        const k = 1 - Math.exp(-10 * dt);
        s.x += (tx - s.x) * k;
        s.y += (RAISED_Y - s.y) * k;
        this.drawWarning(a);
        if (a.t >= dur) {
          s.x = tx;
          a.phase = 'drop';
          a.t = 0;
        }
        break;
      }
      case 'drop': {
        const dur = 0.12;
        s.y = lerp(RAISED_Y, this.groundY, Math.min(1, a.t / dur));
        if (a.t >= dur) {
          s.y = this.groundY;
          this.warn.clear();
          this.warnLabel.setVisible(false);
          this.impact(arm, this.c.slamDamage);
          a.t = 0;
          if (a.type === 'slam') {
            a.phase = 'rest';
            arm.setHittable(true);
          } else {
            a.phase = 'slide';
          }
        }
        break;
      }
      case 'slide': {
        const dur = Math.max(0.2, this.c.sweepTime);
        s.x = lerp(a.startX, a.endX, Math.min(1, a.t / dur));
        if (Math.random() < 0.5) this.scene.dustAt(s.x + 30, this.groundY, 2);
        const p = this.scene.player;
        if (!a.hasHit && intersects(arm.attackRect(), p.getBounds())) {
          if (p.hurt(this.c.sweepDamage, s.x + 100) !== 'ignored') a.hasHit = true;
        }
        if (a.t >= dur) {
          a.phase = 'rest';
          a.t = 0;
          arm.setHittable(true);
        }
        break;
      }
      case 'rest': {
        if (a.t >= this.c.armRestTime) {
          arm.setHittable(false);
          a.phase = 'rise';
          a.t = 0;
          a.fromX = s.x;
        }
        break;
      }
      case 'rise': {
        const k = Math.min(1, a.t / 0.45);
        const e = Phaser.Math.Easing.Cubic.Out(k);
        s.y = lerp(this.groundY, arm.home.y, e);
        s.x = lerp(a.fromX, arm.home.x, e);
        if (k >= 1) this.endAction();
        break;
      }
      default:
        break;
    }
  }

  impact(arm, damage) {
    const s = arm.sprite;
    this.scene.shake(0.012, 220);
    this.scene.sfxPlay('slam');
    this.scene.dustAt(s.x, this.groundY, 16);
    const p = this.scene.player;
    if (intersects(arm.attackRect(), p.getBounds())) p.hurt(damage, s.x, 320);
  }

  // 돌 떨구기 (팔이 다 부서진 뒤)
  runRocks(dt) {
    const a = this.action;
    a.t += dt;
    const m = this.speed;
    if (a.phase === 'aim') {
      const dur = this.c.rockWarningTime * m;
      const k = Math.min(1, a.t / dur);
      this.warn.clear();
      for (const x of a.targets) {
        this.warn.fillStyle(0x000000, 0.35 + 0.3 * k).fillEllipse(x, this.groundY, 30 + 40 * k, 10 + 8 * k);
        this.warn.lineStyle(2, 0xff4444, 0.5 + 0.5 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY, 70, 18);
      }
      this.warnLabel.setText('돌 조심!').setPosition((this.minX + this.maxArmX) / 2, 120).setVisible(true);
      if (a.t >= dur) {
        a.phase = 'fall';
        a.t = 0;
        this.rocks = a.targets.map((x) => this.scene.add.image(x, -60, 'rock').setDepth(8).setDisplaySize(44, 40));
      }
    } else if (a.phase === 'fall') {
      const k = Math.min(1, a.t / 0.35);
      for (const r of this.rocks) r.y = lerp(-60, this.groundY - 20, k * k);
      if (k >= 1) {
        const p = this.scene.player;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.006, 150);
        let hit = false;
        for (const r of this.rocks) {
          this.scene.dustAt(r.x, this.groundY, 8);
          if (!hit && intersects(new Rect(r.x - 28, this.groundY - 60, 56, 60), p.getBounds())) {
            hit = p.hurt(this.c.rockDamage, r.x) !== 'ignored';
          }
          r.destroy();
        }
        this.rocks = [];
        this.warn.clear();
        this.warnLabel.setVisible(false);
        a.phase = 'after';
        a.t = 0;
      }
    } else if (a.t >= 0.5) {
      this.endAction();
    }
  }

  drawWarning(a) {
    const alpha = 0.22 + 0.18 * Math.sin(this.t * 18);
    this.warn.clear();
    if (a.type === 'slam') {
      this.warn.fillStyle(0xff2020, alpha).fillRect(a.target - 45, this.groundY - 200, 90, 200);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(a.target - 45, this.groundY - 200, 90, 200);
      this.warnLabel.setText('!').setPosition(a.target, this.groundY - 100).setVisible(true);
    } else {
      const x0 = a.endX - 40;
      const w = a.startX - a.endX + 80;
      this.warn.fillStyle(0xff2020, alpha * 0.8).fillRect(x0, this.groundY - 200, w, 200);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(x0, this.groundY - 200, w, 200);
      this.warnLabel.setText('◀◀  바닥 쓸기! 대시로 통과!  ◀◀').setPosition(x0 + w / 2, this.groundY - 100).setVisible(true);
    }
  }

  // 플레이어 공격 처리. 맞혔으면 true.
  receiveAttack(rect, attack) {
    if (this.state === 'dormant' || this.defeated) return false;
    let hit = false;
    for (const arm of this.armsAlive) {
      if (!arm.hittable || !intersects(rect, arm.hitRect())) continue;
      arm.health.damage(attack.damage);
      floatText(this.scene, arm.sprite.x, arm.sprite.y - 130, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 28 : 20);
      flash(this.scene, arm.sprite, arm.tint);
      this.scene.gooAt(arm.sprite.x, arm.sprite.y - 60, 6);
      if (arm.health.isDead) this.destroyArm(arm);
      hit = true;
    }

    const coreRect = new Rect(this.corePos.x - 30, this.corePos.y - 30, 60, 60);
    if (this.coreExposed && intersects(rect, coreRect)) {
      const dmg = coreDamage(attack, this.c.chargedPunchCoreMultiplier);
      this.coreHealth.damage(dmg);
      floatText(this.scene, this.corePos.x, this.corePos.y - 40, String(dmg), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 32 : 20);
      flash(this.scene, this.core);
      this.scene.gooAt(this.corePos.x, this.corePos.y, 8);
      if (this.coreHealth.isDead) this.defeat();
      hit = true;
    }

    if (!hit) {
      const bodyRect = new Rect(this.bodyX - 110, this.groundY - 280, 220, 280);
      const touchedArm = this.armsAlive.some((arm) => intersects(rect, arm.hitRect()));
      if (intersects(rect, bodyRect) || touchedArm) {
        this.scene.sfxPlay('tink');
        if (this.t - this.lastBlockedAt > 1.2) {
          this.lastBlockedAt = this.t;
          const msg = this.coreExposed ? '코어를 노려!' : this.armsAlive.length ? '깡! 팔이 바닥에 있을 때!' : '깡!';
          floatText(this.scene, rect.centerX, rect.y - 10, msg, '#bfc7d5', 18);
        }
      }
    }
    return hit;
  }

  destroyArm(arm) {
    arm.alive = false;
    arm.setHittable(false);
    arm.hint.destroy();
    if (this.action?.arm === arm) this.endAction();
    this.scene.sfxPlay('break');
    this.scene.shake(0.015, 300);
    this.scene.gooAt(arm.sprite.x, arm.sprite.y - 80, 30);
    floatText(this.scene, arm.sprite.x, arm.sprite.y - 160, `${arm.label} 파괴!`, '#ff9a1f', 30);
    this.scene.tweens.add({
      targets: arm.sprite,
      angle: -40,
      alpha: 0,
      y: arm.sprite.y + 40,
      duration: 700,
      onComplete: () => arm.sprite.destroy(),
    });
    this.scene.gainXp(this.c.armXp, arm.sprite.x, arm.sprite.y - 120);

    if (this.armsAlive.length === 1) {
      this.scene.robot.say(['팔 하나 끝! 남은 팔이 화났어.', '바닥 쓸기는 점프로 못 넘어. 대시로 통과해!'], true);
    } else if (this.armsAlive.length === 0) {
      this.exposeCore();
    }
  }

  exposeCore() {
    this.coreExposed = true;
    this.scene.tweens.add({
      targets: this.armor,
      x: this.armor.x - 70,
      y: this.groundY - 20,
      angle: -120,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeIn',
    });
    this.scene.robot.say(['장갑이 떨어졌다! 코어가 보여!', '충전 펀치로 끝내 버려!'], true);
    this.timer = 1.2;
  }

  defeat() {
    this.defeated = true;
    this.state = 'dead';
    this.endAction();
    this.scene.onBossDefeated(this);
  }

  // 쓰러지는 연출 (GameScene 이 슬로모션 뒤 부른다)
  collapse() {
    const targets = [this.body, this.core, ...this.armsAlive.map((a) => a.sprite)];
    this.links.clear();
    this.scene.tweens.add({ targets, alpha: 0, y: '+=60', duration: 900 });
  }
}
