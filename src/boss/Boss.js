import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { chooseBossAttack, bossSpeedMultiplier, coreDamage, rockTargets, doubleSlamTargets } from '../logic/boss.js';
import { flash, floatText } from '../fx/effects.js';
import { makeText } from '../ui/text.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
const lerp = Phaser.Math.Linear;
const RAISED_Y = 230; // 팔을 들고 있을 때 주먹 아래쪽 높이
const WAVE_H = 44; // 충격파 높이 (점프로 넘을 수 있음)

// 처음 보는 공격이면 로봇이 알려 주는 말
const TIPS = {
  multiSlam: '연속으로 찍어! 멈추지 말고 계속 움직여!',
  doubleSlam: '두 팔이 한꺼번에 와! 빨간 곳 사이로 피해!',
  sweep: '바닥 쓸기는 점프로 못 넘어. 대시로 통과해!',
  rocks: '그림자가 보이면 피해! 돌이 떨어져.',
  shockwave: '땅이 울린다! 충격파는 점프로 넘어!',
  spit: '독침이 날아와! 한곳에 서 있지 마!',
};

// 부술 수 있는 팔 하나
class BossArm {
  constructor(scene, id, label, home, shoulder, maxHealth, texture, linkColor) {
    this.scene = scene;
    this.id = id;
    this.label = label;
    this.home = home;
    this.shoulder = shoulder;
    this.linkColor = linkColor;
    this.sprite = scene.add.image(home.x, home.y, texture).setOrigin(0.5, 1).setDepth(5).setDisplaySize(70, 210);
    this.health = new Health(maxHealth);
    this.alive = true;
    this.hittable = false;
    this.busy = false;
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
    if (!this.alive) {
      this.hittable = false;
      return;
    }
    this.hittable = on;
    this.hint.setVisible(this.hittable);
    if (!this.hittable) this.sprite.clearTint();
  }
}

// 돌연변이 보스: 팔을 다 부수면 장갑이 떨어지고 코어가 드러난다.
// 스테이지마다 stage.boss 로 이름, 팔 개수, 체력 배수, 공격 목록이 달라진다.
export class Boss {
  constructor(scene, cfg, stage, skin = 1) {
    this.scene = scene;
    this.c = cfg.boss;
    this.def = stage.boss;
    this.name = this.def.name;
    this.groundY = stage.groundY;
    this.minX = stage.arena.startX + 60;
    this.bodyX = stage.arena.endX - 150;
    this.frontX = this.bodyX - 110;
    this.maxArmX = this.frontX - 70;
    this.mouth = { x: this.bodyX - 70, y: this.groundY - 170 };

    const hpScale = this.def.healthScale || 1;
    this.tempo = this.def.speedScale || 1;
    const colors = this.def.colors;

    this.links = scene.add.graphics().setDepth(3);
    this.warn = scene.add.graphics().setDepth(2);
    this.fxG = scene.add.graphics().setDepth(8);
    this.labels = [];

    this.body = scene.add.image(this.bodyX, this.groundY, `boss_body_${skin}`).setOrigin(0.5, 1).setDepth(4).setDisplaySize(220, 280);
    this.blocker = scene.add.zone(this.bodyX, this.groundY - 140, 200, 280);
    scene.physics.add.existing(this.blocker, true);

    this.corePos = { x: this.frontX + 12, y: this.groundY - 80 };
    this.core = scene.add.image(this.corePos.x, this.corePos.y, 'boss_core').setDepth(6).setDisplaySize(56, 56);
    this.armor = scene.add.image(this.corePos.x, this.corePos.y, 'boss_armor').setDepth(7).setDisplaySize(80, 80);
    this.coreHealth = new Health(Math.round(this.c.coreHealth * hpScale));
    this.coreExposed = false;

    const armHp = Math.round(this.c.armHealth * hpScale);
    const tex = `boss_arm_${skin}`;
    const slots = [
      { id: 'a', home: { x: this.maxArmX - 60, y: RAISED_Y }, shoulder: { x: this.frontX + 25, y: this.groundY - 210 } },
      { id: 'b', home: { x: this.maxArmX - 230, y: RAISED_Y - 40 }, shoulder: { x: this.frontX + 55, y: this.groundY - 250 } },
      { id: 'c', home: { x: this.maxArmX - 400, y: RAISED_Y - 20 }, shoulder: { x: this.frontX + 40, y: this.groundY - 175 } },
    ];
    const count = Phaser.Math.Clamp(Math.round(this.def.arms || 2), 1, 3);
    const names = count === 3 ? ['오른팔', '가운데 팔', '왼팔'] : count === 2 ? ['오른팔', '왼팔'] : ['팔'];
    this.arms = slots.slice(0, count).map((s, i) => new BossArm(scene, s.id, names[i], s.home, s.shoulder, armHp, tex, i % 2 ? colors.light : colors.arm));
    this.totalArms = count;

    this.rocks = [];
    this.waves = [];
    this.globs = [];
    this.state = 'dormant';
    this.action = null;
    this.lastType = null;
    this.timer = 0;
    this.t = 0;
    this.defeated = false;
    this.lastBlockedAt = -10;
  }

  get armsAlive() {
    return this.arms.filter((a) => a.alive);
  }

  // 시간에 곱하는 값 (작을수록 빠름)
  get speed() {
    return bossSpeedMultiplier(this.armsAlive.length, this.totalArms) * this.tempo;
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

    this.bobArms(dt);
    if (!this.action) {
      this.timer -= dt;
      if (this.timer <= 0 && !this.scene.player.dead) this.startAction();
      return;
    }

    this.warn.clear();
    this.fxG.clear();
    this.hideLabels();
    const a = this.action;
    if (a.jobs) this.runArmJobs(dt);
    else if (a.type === 'rocks') this.runRocks(dt);
    else if (a.type === 'shockwave') this.runShockwave(dt);
    else if (a.type === 'spit') this.runSpit(dt);
  }

  bobArms(dt) {
    const k = 1 - Math.exp(-4 * dt);
    for (const arm of this.armsAlive) {
      if (arm.busy) continue;
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

  // 경고 글자 (프레임마다 다시 그림)
  label(i, text, x, y, size = 22) {
    if (!this.labels[i]) this.labels[i] = makeText(this.scene, 0, 0, '', size, '#ff5555').setOrigin(0.5).setDepth(31);
    this.labels[i].setText(text).setFontSize(size).setPosition(x, y).setVisible(true);
  }

  hideLabels() {
    for (const l of this.labels) l.setVisible(false);
  }

  tip(type) {
    const said = this.scene.bossTips;
    if (!TIPS[type] || said.has(type)) return;
    said.add(type);
    this.scene.robot.say(TIPS[type], true);
  }

  startAction(forceType = null) {
    const p = this.scene.player;
    const alive = this.armsAlive;
    const type = forceType || chooseBossAttack(this.def.phases, alive.length, this.totalArms, this.lastType);
    this.lastType = type;
    const a = { type, phase: 'aim', t: 0 };
    const pickArm = () => alive[Math.floor(Math.random() * alive.length)];
    const target = () => Phaser.Math.Clamp(p.x, this.minX, this.maxArmX);

    if (type === 'slam') a.jobs = [this.makeJob(pickArm(), 'slam', target(), this.c.slamWarningTime)];
    else if (type === 'multiSlam') {
      a.jobs = [this.makeJob(pickArm(), 'slam', target(), this.c.multiSlamWarningTime, Math.max(1, Math.round(this.c.multiSlamCount)))];
    } else if (type === 'doubleSlam') {
      const two = Phaser.Utils.Array.Shuffle([...alive]).slice(0, 2);
      const xs = doubleSlamTargets(p.x, this.minX, this.maxArmX);
      a.jobs = two.map((arm, i) => this.makeJob(arm, 'slam', xs[i], this.c.doubleSlamWarningTime));
    } else if (type === 'sweep') {
      const job = this.makeJob(pickArm(), 'sweep', this.maxArmX, this.c.sweepWarningTime);
      job.startX = this.maxArmX;
      job.endX = this.minX;
      a.jobs = [job];
    } else if (type === 'rocks') {
      const count = Math.max(1, Math.round(this.c.rockCount + (this.def.rockBonus || 0) + (alive.length === 0 ? 1 : 0)));
      a.targets = rockTargets(p.x, count, this.minX, this.maxArmX + 40);
      this.scene.tweens.add({ targets: this.body, y: this.groundY - 10, duration: 120, yoyo: true });
    } else if (type === 'shockwave') {
      a.count = Math.max(1, Math.round(this.def.shockwaves || 1));
      a.spawned = 0;
    } else if (type === 'spit') {
      a.count = Math.max(1, Math.round(this.c.spitCount));
      a.fired = 0;
    }
    if (a.jobs) for (const j of a.jobs) j.arm.busy = true;
    this.action = a;
    this.scene.sfxPlay('warn');
    this.tip(type);
  }

  makeJob(arm, kind, target, warnTime, repeats = 1) {
    return { arm, kind, target, warnTime, repeats, phase: 'aim', t: 0, hasHit: false };
  }

  endAction() {
    const a = this.action;
    if (a?.jobs) {
      for (const j of a.jobs) {
        j.arm.busy = false;
        j.arm.setHittable(false);
      }
    }
    this.action = null;
    this.warn.clear();
    this.fxG.clear();
    this.hideLabels();
    for (const r of this.rocks) r.destroy();
    for (const g of this.globs) g.sprite.destroy();
    this.rocks = [];
    this.waves = [];
    this.globs = [];
    this.timer = this.c.idleTime * this.speed;
  }

  // ---------- 팔 공격 (내려찍기, 연속, 두 팔, 바닥 쓸기) ----------

  runArmJobs(dt) {
    const a = this.action;
    a.jobs.forEach((job, i) => this.runJob(job, i, dt));
    if (a.jobs.every((j) => j.phase === 'done')) this.endAction();
  }

  runJob(job, i, dt) {
    const arm = job.arm;
    if (job.phase === 'done') return;
    if (!arm.alive) {
      job.phase = 'done';
      return;
    }
    const s = arm.sprite;
    const m = this.speed;
    job.t += dt;

    switch (job.phase) {
      case 'aim': {
        const dur = job.warnTime * m;
        const tx = job.kind === 'slam' ? job.target : job.startX;
        const k = 1 - Math.exp(-10 * dt);
        s.x += (tx - s.x) * k;
        s.y += (RAISED_Y - s.y) * k;
        this.drawJobWarning(job, i);
        if (job.t >= dur) {
          s.x = tx;
          job.phase = 'drop';
          job.t = 0;
        }
        break;
      }
      case 'drop': {
        const dur = 0.12;
        s.y = lerp(RAISED_Y, this.groundY, Math.min(1, job.t / dur));
        if (job.t >= dur) {
          s.y = this.groundY;
          this.impact(arm, this.c.slamDamage);
          job.t = 0;
          job.repeats -= 1;
          if (job.kind === 'sweep') job.phase = 'slide';
          else if (job.repeats > 0) job.phase = 'bounce';
          else {
            job.phase = 'rest';
            arm.setHittable(true);
          }
        }
        break;
      }
      case 'bounce': {
        // 연속 내려찍기: 살짝 들었다가 다시 플레이어를 노린다
        const k = Math.min(1, job.t / 0.25);
        s.y = lerp(this.groundY, RAISED_Y, Phaser.Math.Easing.Cubic.Out(k));
        if (k >= 1) {
          job.target = Phaser.Math.Clamp(this.scene.player.x, this.minX, this.maxArmX);
          job.phase = 'aim';
          job.t = 0;
        }
        break;
      }
      case 'slide': {
        const dur = Math.max(0.2, this.c.sweepTime);
        s.x = lerp(job.startX, job.endX, Math.min(1, job.t / dur));
        if (Math.random() < 0.5) this.scene.dustAt(s.x + 30, this.groundY, 2);
        const p = this.scene.player;
        if (!job.hasHit && intersects(arm.attackRect(), p.getBounds())) {
          if (p.hurt(this.c.sweepDamage, s.x + 100) !== 'ignored') job.hasHit = true;
        }
        if (job.t >= dur) {
          job.phase = 'rest';
          job.t = 0;
          arm.setHittable(true);
        }
        break;
      }
      case 'rest': {
        if (job.t >= this.c.armRestTime) {
          arm.setHittable(false);
          job.phase = 'rise';
          job.t = 0;
          job.fromX = s.x;
        }
        break;
      }
      case 'rise': {
        const k = Math.min(1, job.t / 0.45);
        const e = Phaser.Math.Easing.Cubic.Out(k);
        s.y = lerp(this.groundY, arm.home.y, e);
        s.x = lerp(job.fromX, arm.home.x, e);
        if (k >= 1) {
          job.phase = 'done';
          arm.busy = false;
        }
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

  drawJobWarning(job, i) {
    const alpha = 0.22 + 0.18 * Math.sin(this.t * 18);
    if (job.kind === 'slam') {
      this.warn.fillStyle(0xff2020, alpha).fillRect(job.target - 45, this.groundY - 200, 90, 200);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(job.target - 45, this.groundY - 200, 90, 200);
      this.label(i, '!', job.target, this.groundY - 100);
    } else {
      const x0 = job.endX - 40;
      const w = job.startX - job.endX + 80;
      this.warn.fillStyle(0xff2020, alpha * 0.8).fillRect(x0, this.groundY - 200, w, 200);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(x0, this.groundY - 200, w, 200);
      this.label(i, '◀◀  바닥 쓸기! 대시로 통과!  ◀◀', x0 + w / 2, this.groundY - 100);
    }
  }

  // ---------- 돌 떨구기 ----------

  runRocks(dt) {
    const a = this.action;
    a.t += dt;
    const m = this.speed;
    if (a.phase === 'aim') {
      const dur = this.c.rockWarningTime * m;
      const k = Math.min(1, a.t / dur);
      for (const x of a.targets) {
        this.warn.fillStyle(0x000000, 0.35 + 0.3 * k).fillEllipse(x, this.groundY, 30 + 40 * k, 10 + 8 * k);
        this.warn.lineStyle(2, 0xff4444, 0.5 + 0.5 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY, 70, 18);
      }
      this.label(0, '돌 조심!', (this.minX + this.maxArmX) / 2, 120);
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
        a.phase = 'after';
        a.t = 0;
      }
    } else if (a.t >= 0.5) {
      this.endAction();
    }
  }

  // ---------- 땅 울림 충격파 (점프로 넘기) ----------

  runShockwave(dt) {
    const a = this.action;
    a.t += dt;
    const m = this.speed;
    const startX = this.frontX + 10;
    if (a.phase === 'aim') {
      const dur = this.c.shockwaveWarningTime * m;
      const alpha = 0.15 + 0.15 * Math.sin(this.t * 20);
      this.warn.fillStyle(0xff2020, alpha).fillRect(this.minX - 60, this.groundY - WAVE_H, startX - this.minX + 60, WAVE_H);
      this.warn.lineStyle(2, 0xff4444, 1).strokeRect(this.minX - 60, this.groundY - WAVE_H, startX - this.minX + 60, WAVE_H);
      this.label(0, '땅이 울린다! 점프!', (this.minX + this.maxArmX) / 2, this.groundY - 120, 26);
      this.body.y = this.groundY - Math.sin(Math.min(1, a.t / dur) * Math.PI) * 30;
      if (a.t >= dur) {
        this.body.y = this.groundY;
        a.phase = 'run';
        a.t = 0;
        a.nextSpawn = 0;
      }
      return;
    }
    // 충격파를 차례로 내보낸다
    if (a.spawned < a.count && a.t >= a.nextSpawn) {
      a.spawned += 1;
      a.nextSpawn = a.t + 0.7 * m;
      this.waves.push({ x: startX, hasHit: false });
      this.scene.sfxPlay('slam');
      this.scene.shake(0.01, 200);
      this.scene.dustAt(startX, this.groundY, 12);
      this.scene.tweens.add({ targets: this.body, y: this.groundY - 14, duration: 90, yoyo: true });
    }
    const p = this.scene.player;
    for (const w of this.waves) {
      w.x -= this.c.shockwaveSpeed * dt;
      this.fxG.fillStyle(0xffb030, 0.85).fillTriangle(w.x - 26, this.groundY, w.x, this.groundY - WAVE_H, w.x + 26, this.groundY);
      this.fxG.fillStyle(0xfff3a0, 0.9).fillTriangle(w.x - 12, this.groundY, w.x, this.groundY - WAVE_H * 0.6, w.x + 12, this.groundY);
      if (Math.random() < 0.4) this.scene.dustAt(w.x, this.groundY, 1);
      if (!w.hasHit && intersects(new Rect(w.x - 18, this.groundY - WAVE_H, 36, WAVE_H), p.getBounds())) {
        if (p.hurt(this.c.shockwaveDamage, w.x + 40) !== 'ignored') w.hasHit = true;
      }
    }
    this.waves = this.waves.filter((w) => w.x > this.minX - 120);
    if (a.spawned >= a.count && this.waves.length === 0) this.endAction();
  }

  // ---------- 독침 (플레이어를 따라 차례로 떨어짐) ----------

  runSpit(dt) {
    const a = this.action;
    a.t += dt;
    const m = this.speed;
    if (a.phase === 'aim') {
      const dur = this.c.spitWarningTime * m;
      this.fxG.fillStyle(0x7dff4a, 0.4 + 0.4 * Math.sin(this.t * 25)).fillCircle(this.mouth.x, this.mouth.y, 16 + 10 * (a.t / dur));
      this.label(0, '독침!', this.mouth.x, this.mouth.y - 50);
      if (a.t >= dur) {
        a.phase = 'fire';
        a.t = 0;
        a.nextFire = 0;
      }
      return;
    }
    const flight = Math.max(0.3, this.c.spitFlightTime);
    if (a.fired < a.count && a.t >= a.nextFire) {
      a.fired += 1;
      a.nextFire = a.t + 0.4 * m;
      const p = this.scene.player;
      const tx = Phaser.Math.Clamp(p.x + p.body.velocity.x * 0.3, this.minX - 40, this.frontX - 40);
      const sprite = this.scene.add.image(this.mouth.x, this.mouth.y, 'glob').setDepth(8).setDisplaySize(24, 24);
      this.globs.push({ sprite, tx, t: 0, done: false });
      this.scene.sfxPlay('spit');
    }
    const p = this.scene.player;
    for (const g of this.globs) {
      if (g.done) continue;
      g.t += dt;
      const k = Math.min(1, g.t / flight);
      g.sprite.x = lerp(this.mouth.x, g.tx, k);
      g.sprite.y = lerp(this.mouth.y, this.groundY - 12, k) - Math.sin(k * Math.PI) * 160;
      // 떨어질 자리 표시
      this.warn.fillStyle(0x3a8a1a, 0.3 + 0.4 * k).fillEllipse(g.tx, this.groundY, 30 + 30 * k, 10);
      this.warn.lineStyle(2, 0x7dff4a, 0.9).strokeEllipse(g.tx, this.groundY, 60, 16);
      const box = new Rect(g.sprite.x - 12, g.sprite.y - 12, 24, 24);
      if (intersects(box, p.getBounds()) || k >= 1) {
        g.done = true;
        g.sprite.destroy();
        this.scene.greenGooAt(g.sprite.x, g.sprite.y, 10);
        const splash = new Rect(g.sprite.x - 30, g.sprite.y - 30, 60, 50);
        if (intersects(splash, p.getBounds())) p.hurt(this.c.spitDamage, g.sprite.x);
      }
    }
    if (a.fired >= a.count && this.globs.every((g) => g.done)) {
      if (!a.endAt) a.endAt = a.t + 0.3;
      if (a.t >= a.endAt) this.endAction();
    }
  }

  // ---------- 플레이어 공격 처리. 맞혔으면 true ----------

  receiveAttack(rect, attack) {
    if (this.state === 'dormant' || this.defeated) return false;
    let hit = false;
    for (const arm of this.armsAlive) {
      if (!arm.hittable || !intersects(rect, arm.hitRect())) continue;
      arm.health.damage(attack.damage);
      floatText(this.scene, arm.sprite.x, arm.sprite.y - 130, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 28 : 20);
      flash(this.scene, arm.sprite);
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
    arm.busy = false;
    arm.setHittable(false);
    arm.hint.destroy();
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

    const left = this.armsAlive.length;
    if (left === 0) this.exposeCore();
    else this.scene.robot.say(`${arm.label} 끝! 남은 팔 ${left}개. 더 화났어, 조심해!`, true);
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
    if (!this.action) this.timer = 1.2;
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
