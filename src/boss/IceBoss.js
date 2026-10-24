import Phaser from 'phaser';
import { BossBase } from './BossBase.js';
import { Health } from '../logic/health.js';
import { coreDamage, rockTargets, pickPattern, shouldRage, restAfterAttack, landingX, difficultyOf } from '../logic/boss.js';
import { ComboHazards } from './comboHazards.js';
import { flash, floatText } from '../fx/effects.js';
import { make } from '../fx/textures.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
const lerp = Phaser.Math.Linear;

const HIGH_Y = 140; // 높이 날 때 몸 가운데 높이 (몸 아래쪽 약 y 195: 위쪽 공격도 안 닿음)
const LOW_Y = 250; // 급강하 뒤 낮게 떠 있을 때 몸 가운데 높이 (몸 아래쪽 약 y 305: 점프 펀치, 위쪽 공격이 닿음)
const BREATH_H = 60; // 얼음 숨결 높이 (점프로 넘기)
const BREATH_LEN = 120; // 얼음 숨결 길이

const TIPS = {
  icicles: '고드름이 떨어져! 바닥 그림자 밖으로 피해!',
  dive: '급강하다! 빨간 길을 따라 날아와. 대시로 뚫고 지나가!',
  frostBreath: '얼음 숨결이 바닥을 달려와! 점프로 넘어!',
  hop: '뛰어올랐다! 그림자 밖으로 도망쳐!',
  land: '지쳐서 내려왔어! 지금이야, 마구 때려!',
  hover: '낮게 떠 있어! 밑에서 점프 펀치나 위쪽 공격!',
};

// 얼음 돌연변이: 하늘을 날아다니는 얼음 박쥐 용.
// 날개 2개를 부수면 떨어져서 못 날고, 그때 얼음 심장(약점)이 열린다.
export class IceBoss extends BossBase {
  constructor(scene, cfg, stage, skin = 4) {
    super(scene, cfg, stage, skin);
    this.ic = cfg.iceBoss;
    // 난이도: 체력 배수, 공격 시간 배수, 겹쳐 쓰기 확률
    this.diff = difficultyOf(cfg);
    this.hpScale *= this.diff.bossHealth;
    this.x = this.maxX - 120;
    this.y = HIGH_Y + 20;
    this.face = -1; // -1 왼쪽을 봄, 1 오른쪽을 봄
    this.mode = 'fly'; // 'fly' 날기, 'rest' 지쳐서 쉬기, 'grounded' 날개가 부서져 땅에 있음
    this.action = null;
    this.attacks = 0; // 쉬고 나서 한 공격 수
    this.chained = false;
    this.flap = 0;

    this.aura = scene.add.graphics().setDepth(3);
    this.shadowG = scene.add.graphics().setDepth(1);
    const wingTex = `boss_ice_wing_${skin}`;
    this.wings = [0, 1].map((i) => ({
      side: i === 0 ? -1 : 1, // 화면 왼쪽 날개, 오른쪽 날개
      label: i === 0 ? '왼쪽 날개' : '오른쪽 날개',
      health: new Health(Math.round(this.ic.wingHealth * this.hpScale)),
      alive: true,
      sprite: scene.add.image(0, 0, wingTex).setDepth(4).setDisplaySize(130, 96).setOrigin(i === 0 ? 1 : 0, 0.85).setFlipX(i === 0),
    }));
    this.body = scene.add.image(this.x, this.y, `boss_ice_body_${skin}`).setDepth(5).setDisplaySize(180, 130);
    this.heart = scene.add.image(this.x, this.y, 'ice_heart').setDepth(6).setDisplaySize(30, 36).setAlpha(0.7);
    this.heartHealth = new Health(Math.round(this.ic.heartHealth * this.hpScale));
    this.icicles = [];
    this.trail = [];
    this.combo = new ComboHazards(this, { rockTexture: 'ice_icicle', rockW: 26, rockH: 64, rockDamage: this.ic.icicleDamage });
    this.pose(0);
  }

  static makeTextures(scene, stage, skin) {
    const c = stage.boss.colors;
    // 몸통 (왼쪽을 보는 모습: 머리가 왼쪽, 꼬리가 오른쪽)
    make(scene, `boss_ice_body_${skin}`, 180, 130, (g) => {
      g.fillStyle(c.dark).fillTriangle(120, 70, 180, 110, 130, 95); // 꼬리
      g.fillStyle(c.main).fillEllipse(100, 72, 120, 84); // 몸
      g.fillStyle(c.light).fillEllipse(92, 88, 70, 44); // 배
      g.fillStyle(0xe8f8ff);
      for (let i = 0; i < 4; i++) g.fillTriangle(85 + i * 18, 34, 95 + i * 18, 34, 92 + i * 18, 14); // 등 가시
      g.fillStyle(c.main).fillCircle(42, 58, 34); // 머리
      g.fillStyle(0xe8f8ff).fillTriangle(30, 30, 40, 26, 22, 4).fillTriangle(52, 26, 62, 30, 64, 6); // 뿔
      g.fillStyle(0x7ff8ff).fillEllipse(30, 52, 16, 11).fillEllipse(52, 50, 14, 10); // 눈
      g.fillStyle(0x003a5a).fillCircle(28, 53, 4).fillCircle(50, 51, 4);
      g.fillStyle(0x0d1d33).fillRoundedRect(14, 70, 44, 14, 6); // 입
      g.fillStyle(0xffffff);
      for (let i = 0; i < 4; i++) g.fillTriangle(17 + i * 10, 70, 25 + i * 10, 70, 21 + i * 10, 78);
      g.fillStyle(c.dark).fillRect(78, 108, 12, 20).fillRect(112, 108, 12, 20); // 다리
      g.fillStyle(0xe8f8ff).fillTriangle(76, 128, 82, 120, 88, 128).fillTriangle(110, 128, 116, 120, 122, 128);
    });
    // 날개 하나 (오른쪽 날개 모습, 왼쪽은 뒤집어서 씀). 붙는 곳이 왼쪽 아래
    make(scene, `boss_ice_wing_${skin}`, 130, 96, (g) => {
      g.fillStyle(c.light, 0.95).fillPoints(
        [{ x: 0, y: 82 }, { x: 40, y: 10 }, { x: 128, y: 0 }, { x: 110, y: 40 }, { x: 120, y: 60 }, { x: 90, y: 62 }, { x: 96, y: 84 }, { x: 60, y: 76 }, { x: 40, y: 96 }],
        true,
      );
      g.lineStyle(4, c.dark).lineBetween(0, 82, 40, 10).lineBetween(40, 10, 128, 0).lineBetween(40, 10, 110, 40).lineBetween(40, 10, 90, 62).lineBetween(40, 10, 60, 76);
      g.fillStyle(0xe8f8ff).fillTriangle(124, 0, 130, 2, 126, 14);
    });
    // 얼음 심장 (약점)
    make(scene, 'ice_heart', 30, 36, (g) => {
      g.fillStyle(0x3fd0ff).fillPoints([{ x: 15, y: 0 }, { x: 30, y: 14 }, { x: 15, y: 36 }, { x: 0, y: 14 }], true);
      g.fillStyle(0xe8ffff).fillPoints([{ x: 15, y: 6 }, { x: 22, y: 14 }, { x: 15, y: 26 }, { x: 8, y: 14 }], true);
    });
    // 떨어지는 고드름
    make(scene, 'ice_icicle', 26, 64, (g) => {
      g.fillStyle(0xbfeeff).fillTriangle(0, 0, 26, 0, 13, 64);
      g.fillStyle(0xffffff).fillTriangle(5, 0, 12, 0, 10, 40);
    });
  }

  // ---------- 모습 ----------

  get heartOpen() {
    return this.mode === 'grounded';
  }

  get wingsAlive() {
    return this.wings.filter((w) => w.alive);
  }

  get speed() {
    return this.tempo * this.diff.bossSpeed * (this.raging ? this.c.rageSpeed : 1);
  }

  get healthRatio() {
    let cur = this.heartHealth.current;
    let max = this.heartHealth.max;
    for (const w of this.wings) {
      cur += w.alive ? w.health.current : 0;
      max += w.health.max;
    }
    return cur / max;
  }

  // 플레이어 공격이 맞는 곳 (날 때는 날개까지 넓게)
  hitRect() {
    if (this.mode === 'fly') return new Rect(this.x - 110, this.y - 50, 220, 105);
    return new Rect(this.x - 90, this.y - 60, 180, 125);
  }

  // 공격이 플레이어를 맞히는 곳 (급강하, 뛰어 내려찍기)
  dangerRect() {
    return new Rect(this.x - 80, this.y - 45, 160, 100);
  }

  // 스프라이트 위치와 날갯짓
  pose(dt) {
    const folded = this.mode !== 'fly' && !(this.action && this.action.type === 'land' && this.action.phase === 'descend');
    this.flap += dt * (folded ? 0 : this.action?.type === 'dive' ? 18 : 10);
    const flipped = this.face > 0;
    this.body.setPosition(this.x, this.y).setFlipX(flipped);
    for (const w of this.wings) {
      if (!w.alive) continue;
      const ax = this.x + w.side * 18;
      const ay = this.y - 22;
      w.sprite.setPosition(ax, ay);
      if (folded) w.sprite.setAngle(w.side * -55).setScale(w.sprite.scaleX, Math.abs(w.sprite.scaleY));
      else w.sprite.setAngle(w.side * Math.sin(this.flap) * 28);
    }
    const hx = this.x + (flipped ? 22 : -22);
    this.heart.setPosition(hx, this.y + 22);
    if (this.heartOpen && !this.defeated) {
      const s = 1 + Math.sin(this.t * 8) * 0.12;
      this.heart.setDisplaySize(30 * s * 1.3, 36 * s * 1.3).setAlpha(1);
    }
    // 땅 그림자
    this.shadowG.clear();
    if (!this.defeated) {
      const h = Phaser.Math.Clamp((this.groundY - this.y) / 400, 0, 1);
      this.shadowG.fillStyle(0x000000, 0.35 - 0.2 * h).fillEllipse(this.x, this.groundY, 150 - 70 * h, 18 - 8 * h);
    }
  }

  faceTo(x) {
    if (Math.abs(x - this.x) > 20) this.face = x > this.x ? 1 : -1;
  }

  // 목표 쪽으로 날아가기. 다 오면 true
  moveTo(tx, ty, dt, speed = this.ic.flySpeed) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) {
      this.x = tx;
      this.y = ty;
      return true;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return false;
  }

  // ---------- 진행 ----------

  startFight() {
    if (this.state !== 'dormant') return;
    super.startFight();
    this.scene.sfxPlay('freeze');
  }

  update(dt) {
    const fighting = this.tickState(dt);
    this.bodyX = this.x;
    if (this.state === 'dead') {
      this.pose(dt);
      return;
    }
    if (!fighting) {
      // 등장: 하늘에서 천천히 내려와 자리 잡기
      if (this.state === 'intro') this.moveTo(this.maxX - 160, HIGH_Y, dt, 120);
      else this.y = HIGH_Y + 20 + Math.sin(this.t * 2) * 8;
      this.pose(dt);
      return;
    }
    if (!this.introSaid) {
      this.introSaid = true;
      this.scene.robot.say(['얼음 돌연변이가 날아다녀!', '지쳐서 땅에 내려오면 그때 날개를 때려!'], true);
    }
    this.warn.clear();
    this.fxG.clear();
    this.hideLabels();
    this.updateRage();
    this.drawRage();

    if (!this.action) {
      this.idle(dt);
      this.timer -= dt;
      if (this.timer <= 0 && !this.scene.player.dead) this.startAction();
    } else {
      this.runAction(dt);
    }
    this.combo.update(dt);
    this.updateTrail(dt);
    this.pose(dt);
  }

  // 공격 사이: 날 때는 플레이어 위쪽 높은 곳을 맴돌고, 땅에서는 플레이어를 바라본다
  idle(dt) {
    const p = this.scene.player;
    if (this.mode === 'fly') {
      const tx = Phaser.Math.Clamp(p.x + (this.x > p.x ? 220 : -220), this.minX + 40, this.maxX - 40);
      this.moveTo(tx, HIGH_Y + Math.sin(this.t * 2.5) * 10, dt, this.ic.flySpeed * 0.6);
      this.faceTo(p.x);
    } else {
      this.y = this.groundY - 65;
      this.faceTo(p.x);
    }
  }

  updateRage() {
    if (this.defeated || this.state !== 'fight') return;
    if (shouldRage(this.healthRatio, this.ic.rageAt, this.raging)) {
      this.raging = true;
      this.chained = false;
      this.scene.sfxPlay('rage');
      this.scene.shake(0.014, 600);
      this.body.setTint(0xff9090);
      for (const w of this.wingsAlive) w.sprite.setTint(0xff9090);
      floatText(this.scene, this.x, this.y - 100, '분노 모드!', '#ff3030', 34);
      this.scene.robot.say(['얼음 돌연변이가 화났어! 빨개졌다!', '쉬지 않고 두 번씩 공격해. 조심해!'], true);
    }
  }

  drawRage() {
    this.aura.clear();
    if (!this.raging || this.defeated) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
    this.aura.fillStyle(0xff2020, 0.14 + 0.12 * pulse).fillEllipse(this.x, this.y, 260 + pulse * 20, 170);
    this.label(7, '분노!', this.x, this.y - 95, 22 + Math.round(pulse * 4), '#ff3030');
  }

  tip(type, text = TIPS[type]) {
    super.tip(type, text);
  }

  // 다음 공격 고르기
  startAction(forceType = null) {
    let type = forceType;
    const tiredAfter = Math.max(2, Math.round(this.ic.tiredAfter) - (2 - this.wingsAlive.length));
    if (!type) {
      if (this.mode === 'fly' && this.attacks >= tiredAfter) type = 'land';
      else {
        const phases = this.def.phases || [];
        const idx = this.mode === 'grounded' ? phases.length - 1 : Math.min(2 - this.wingsAlive.length, phases.length - 1);
        const fallback = this.mode === 'grounded' ? 'hop' : 'icicles';
        type = pickPattern(phases[Math.max(0, idx)], this.lastType, Math.random, fallback);
        if (this.mode === 'grounded' && type === 'dive') type = 'hop';
        if (this.mode === 'fly' && type === 'hop') type = 'dive';
      }
    }
    this.lastType = type;
    const p = this.scene.player;
    const a = { type, phase: 'aim', t: 0 };
    if (type === 'icicles') {
      const n = Math.max(1, Math.round(this.ic.icicleCount + (this.mode === 'grounded' ? 1 : 0)));
      a.targets = rockTargets(p.x, n, this.minX - 20, this.maxX + 20);
      a.phase = this.mode === 'fly' ? 'rise' : 'aim';
    } else if (type === 'dive') {
      a.dir = this.x > p.x ? -1 : 1; // 이 방향으로 가로지른다
      a.startX = a.dir < 0 ? this.maxX - 10 : this.minX + 10;
      a.endX = a.dir < 0 ? this.minX + 60 : this.maxX - 60;
      a.ready = false;
    } else if (type === 'frostBreath') {
      a.dir = p.x > (this.minX + this.maxX) / 2 ? 1 : -1; // 숨결이 달려가는 방향
      a.fromX = a.dir > 0 ? this.minX - 20 : this.maxX + 20;
      a.ready = false;
    } else if (type === 'hop') {
      a.tx = Phaser.Math.Clamp(p.x, this.minX, this.maxX);
      a.fromX = this.x;
    } else if (type === 'land') {
      a.phase = 'descend';
      a.tx = landingX(p.x, this.minX + 40, this.maxX - 40, 190);
    }
    this.action = a;
    if (type !== 'land') this.scene.sfxPlay('warn');
    this.tip(type);
    if (type !== 'land') this.combo.maybeStart(type, this.diff.bossCombo);
  }

  endAction() {
    const a = this.action;
    this.action = null;
    for (const i of this.icicles) i.destroy();
    this.icicles = [];
    this.warn.clear();
    this.fxG.clear();
    if (a && a.type === 'land') {
      this.attacks = 0;
      this.timer = 0.6;
      this.chained = false;
      return;
    }
    this.attacks += 1;
    const idle = (this.mode === 'grounded' ? 1.1 : this.ic.idleTime) * this.speed;
    const rest = restAfterAttack(this.raging, this.chained, idle, this.c.rageChainGap);
    this.timer = rest.wait;
    this.chained = rest.chained;
  }

  runAction(dt) {
    const a = this.action;
    a.t += dt;
    if (a.type === 'icicles') this.runIcicles(dt);
    else if (a.type === 'dive') this.runDive(dt);
    else if (a.type === 'frostBreath') this.runBreath(dt);
    else if (a.type === 'hop') this.runHop(dt);
    else if (a.type === 'land') this.runLand(dt);
    else if (a.type === 'crash') this.runCrash(dt);
    else this.endAction();
  }

  next(a, phase) {
    a.phase = phase;
    a.t = 0;
  }

  // ---------- 고드름 비 (그림자 피하기) ----------

  runIcicles(dt) {
    const a = this.action;
    const mid = (this.minX + this.maxX) / 2;
    if (a.phase === 'rise') {
      const done = this.moveTo(Phaser.Math.Clamp(this.x, mid - 200, mid + 200), HIGH_Y - 30, dt, this.ic.flySpeed * 1.4);
      if (done || a.t > 0.7) this.next(a, 'aim');
      return;
    }
    if (a.phase === 'aim') {
      const dur = this.ic.icicleWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      if (this.mode === 'fly') this.x += Math.sin(this.t * 40) * 1.5;
      for (const x of a.targets) {
        this.warn.fillStyle(0x000000, 0.3 + 0.35 * k).fillEllipse(x, this.groundY, 26 + 40 * k, 8 + 8 * k);
        this.warn.lineStyle(2, 0x9fe8ff, 0.5 + 0.5 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY, 70, 18);
        this.warn.fillStyle(0xbfeeff, 0.5 * k).fillTriangle(x - 8, 0, x + 8, 0, x, 30 * k);
      }
      this.label(0, '고드름 조심!', mid, 70, 26);
      if (a.t >= dur) {
        this.next(a, 'fall');
        this.icicles = a.targets.map((x) => this.scene.add.image(x, -70, 'ice_icicle').setDepth(8).setDisplaySize(26, 64));
        this.scene.sfxPlay('icicle');
      }
      return;
    }
    if (a.phase === 'fall') {
      const k = Math.min(1, a.t / 0.35);
      for (const ic of this.icicles) ic.y = lerp(-70, this.groundY - 32, k * k);
      if (k >= 1) {
        const p = this.scene.player;
        let hit = false;
        this.scene.shake(0.006, 150);
        for (const ic of this.icicles) {
          this.scene.sparks?.explode(10, ic.x, this.groundY - 10);
          this.scene.dustAt(ic.x, this.groundY, 5);
          if (!hit && intersects(new Rect(ic.x - 26, this.groundY - 64, 52, 64), p.getBounds())) {
            hit = p.hurt(this.ic.icicleDamage, ic.x) !== 'ignored';
          }
          ic.destroy();
        }
        this.icicles = [];
        this.scene.sfxPlay('slam');
        this.next(a, 'after');
      }
      return;
    }
    if (a.t >= 0.45) this.endAction();
  }

  // ---------- 급강하 (대시로 통과) ----------

  // 급강하 길: u(0~1) 에 따른 위치
  divePoint(a, u) {
    const x = lerp(a.startX, a.endX, u);
    const lowY = this.groundY - 58;
    let y;
    if (u < 0.3) y = lerp(HIGH_Y, lowY, Math.sin((u / 0.3) * (Math.PI / 2)));
    else if (u < 0.78) y = lowY;
    else y = lerp(lowY, LOW_Y, Phaser.Math.Easing.Sine.Out((u - 0.78) / 0.22));
    return { x, y };
  }

  runDive(dt) {
    const a = this.action;
    const p = this.scene.player;
    if (a.phase === 'aim') {
      // 출발점으로 날아가며 경고
      const there = this.moveTo(a.startX, HIGH_Y, dt, this.ic.flySpeed * 1.5);
      this.faceTo(a.endX);
      const dur = this.ic.diveWarningTime * this.speed;
      if (there) a.ready = true;
      this.drawDiveWarning(a);
      if (a.ready && a.t >= dur) {
        this.next(a, 'dive');
        this.scene.sfxPlay('swoop');
      }
      return;
    }
    if (a.phase === 'dive') {
      const u = Math.min(1, a.t / Math.max(0.4, this.ic.diveTime * this.speed));
      const pt = this.divePoint(a, u);
      this.x = pt.x;
      this.y = pt.y;
      this.trail.push({ x: this.x, y: this.y, life: 0.3 });
      if (u > 0.25 && u < 0.85 && Math.random() < 0.6) this.scene.dustAt(this.x, this.groundY, 2);
      if (!a.hasHit && u > 0.1 && u < 0.85 && intersects(this.dangerRect(), p.getBounds())) {
        if (p.hurt(this.ic.diveDamage, this.x - a.dir * 60, 420) !== 'ignored') a.hasHit = true;
      }
      if (u >= 1) {
        this.next(a, 'hover');
        this.tip('hover');
      }
      return;
    }
    if (a.phase === 'hover') {
      // 낮게 떠서 숨 고르기 (몸 아래쪽 y 약 305)
      this.y = LOW_Y + Math.sin(this.t * 5) * 5;
      this.faceTo(p.x);
      this.label(0, '지금! 점프 펀치!', this.x, this.y - 100, 22, '#ffd23f');
      this.label(1, '▲', this.x, this.y + 80, 22, '#ffd23f');
      if (a.t >= this.ic.hoverTime) this.endAction();
    }
  }

  drawDiveWarning(a) {
    const alpha = 0.2 + 0.15 * Math.sin(this.t * 18);
    const lowY = this.groundY - 58;
    const x0 = Math.min(a.startX, a.endX);
    const x1 = Math.max(a.startX, a.endX);
    // 몸이 낮게 지나가는 구간
    const la = lerp(a.startX, a.endX, 0.22);
    const lb = lerp(a.startX, a.endX, 0.85);
    this.warn.fillStyle(0xff2020, alpha).fillRect(Math.min(la, lb), lowY - 55, Math.abs(lb - la), 113);
    this.warn.lineStyle(3, 0xff4444, 1).strokeRect(Math.min(la, lb), lowY - 55, Math.abs(lb - la), 113);
    // 날아오는 길 (점선)
    for (let u = 0; u <= 1.001; u += 0.04) {
      const pt = this.divePoint(a, u);
      this.warn.fillStyle(0xffe0e0, 0.9).fillCircle(pt.x, pt.y, 4);
    }
    const arrow = a.dir < 0 ? '◀◀  급강하! 대시로 통과!  ◀◀' : '▶▶  급강하! 대시로 통과!  ▶▶';
    this.label(0, arrow, (x0 + x1) / 2, lowY - 85, 24);
  }

  updateTrail(dt) {
    for (const tr of this.trail) {
      tr.life -= dt;
      if (tr.life > 0) this.fxG.fillStyle(0xbfeeff, tr.life * 1.6).fillEllipse(tr.x, tr.y, 120 * tr.life * 3, 40 * tr.life * 3);
    }
    this.trail = this.trail.filter((tr) => tr.life > 0);
  }

  // ---------- 얼음 숨결 (점프로 넘기) ----------

  runBreath(dt) {
    const a = this.action;
    const p = this.scene.player;
    const mouthOff = this.face > 0 ? 70 : -70;
    if (a.phase === 'aim') {
      const dur = this.ic.breathWarningTime * this.speed;
      if (this.mode === 'fly') {
        const there = this.moveTo(a.dir > 0 ? this.minX + 40 : this.maxX - 40, 210, dt, this.ic.flySpeed * 1.5);
        if (there) a.ready = true;
      } else {
        a.ready = true;
        a.fromX = this.x + a.dir * 60;
      }
      this.face = a.dir;
      const alpha = 0.15 + 0.15 * Math.sin(this.t * 20);
      this.warn.fillStyle(0x3fd0ff, alpha).fillRect(this.minX - 60, this.groundY - BREATH_H, this.maxX - this.minX + 120, BREATH_H);
      this.warn.lineStyle(2, 0x9fe8ff, 1).strokeRect(this.minX - 60, this.groundY - BREATH_H, this.maxX - this.minX + 120, BREATH_H);
      this.fxG.fillStyle(0x9fe8ff, 0.5 + 0.4 * Math.sin(this.t * 25)).fillCircle(this.x + mouthOff, this.y + 10, 12 + 10 * Math.min(1, a.t / dur));
      this.label(0, '얼음 숨결! 점프로 넘어!', (this.minX + this.maxX) / 2, this.groundY - 130, 26);
      if (a.ready && a.t >= dur) {
        this.next(a, 'blow');
        a.front = this.mode === 'fly' ? this.x + mouthOff : a.fromX;
        a.start = a.front;
        this.scene.sfxPlay('freeze');
      }
      return;
    }
    if (a.phase === 'blow') {
      a.front += a.dir * this.ic.breathSpeed * dt;
      const tail = a.front - a.dir * BREATH_LEN;
      const l = Math.min(a.front, tail);
      // 입에서 바닥으로 뿜는 줄기
      this.fxG.lineStyle(10, 0xbfeeff, 0.5).lineBetween(this.x + mouthOff, this.y + 10, a.front, this.groundY - 20);
      this.fxG.fillStyle(0xbfeeff, 0.85).fillRect(l, this.groundY - BREATH_H, BREATH_LEN, BREATH_H);
      this.fxG.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < 5; i++) this.fxG.fillTriangle(l + i * 24, this.groundY, l + i * 24 + 12, this.groundY - BREATH_H - 8, l + i * 24 + 24, this.groundY);
      // 지나간 자리는 살짝 언 바닥 (아프지 않음)
      const s0 = Math.min(a.start, tail);
      const s1 = Math.max(a.start, tail);
      if (s1 > s0) this.fxG.fillStyle(0xd8f4ff, 0.35).fillRect(s0, this.groundY - 6, s1 - s0, 6);
      if (Math.random() < 0.5) this.scene.dustAt(a.front, this.groundY, 1);
      if (!a.hasHit && intersects(new Rect(l, this.groundY - BREATH_H, BREATH_LEN, BREATH_H), p.getBounds())) {
        if (p.hurt(this.ic.breathDamage, a.front - a.dir * 40) !== 'ignored') a.hasHit = true;
      }
      const gone = a.dir > 0 ? tail > this.maxX + 80 : tail < this.minX - 80;
      if (gone) this.next(a, 'after');
      return;
    }
    if (a.t >= 0.4) this.endAction();
  }

  // ---------- 뛰어 내려찍기 (날개가 부서진 뒤) ----------

  runHop(dt) {
    const a = this.action;
    const p = this.scene.player;
    if (a.phase === 'aim') {
      const dur = this.ic.hopWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      this.y = this.groundY - 65 + 10 * k; // 웅크리기
      this.faceTo(a.tx);
      this.warn.fillStyle(0x000000, 0.3 + 0.3 * k).fillEllipse(a.tx, this.groundY, 120 + 60 * k, 20);
      this.warn.fillStyle(0xff2020, 0.15 + 0.15 * Math.sin(this.t * 18)).fillRect(a.tx - 95, this.groundY - 120, 190, 120);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(a.tx - 95, this.groundY - 120, 190, 120);
      this.label(0, '뛰어내린다! 피해!', a.tx, this.groundY - 200, 24);
      if (a.t >= dur) this.next(a, 'air');
      return;
    }
    if (a.phase === 'air') {
      const k = Math.min(1, a.t / 0.6);
      this.x = lerp(a.fromX, a.tx, k);
      this.y = this.groundY - 65 - Math.sin(k * Math.PI) * 220;
      this.warn.fillStyle(0x000000, 0.45).fillEllipse(a.tx, this.groundY, 180, 20);
      if (k >= 1) {
        this.y = this.groundY - 65;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.016, 300);
        this.scene.dustAt(this.x, this.groundY, 18);
        this.scene.sparks?.explode(16, this.x, this.groundY - 10);
        if (intersects(new Rect(a.tx - 95, this.groundY - 120, 190, 120), p.getBounds())) p.hurt(this.ic.hopDamage, this.x, 380);
        this.next(a, 'after');
      }
      return;
    }
    if (a.t >= 0.6) this.endAction();
  }

  // ---------- 지쳐서 내려앉기 (때릴 기회) ----------

  runLand(dt) {
    const a = this.action;
    if (a.phase === 'descend') {
      this.faceTo(this.scene.player.x);
      this.warn.fillStyle(0x3fd0ff, 0.25).fillEllipse(a.tx, this.groundY, 160, 20);
      const there = this.moveTo(a.tx, this.groundY - 65, dt, this.ic.flySpeed * 1.2);
      if (there) {
        this.mode = 'rest';
        this.scene.dustAt(this.x, this.groundY, 12);
        this.scene.sfxPlay('slam');
        this.scene.shake(0.006, 150);
        this.next(a, 'rest');
        floatText(this.scene, this.x, this.y - 90, '헉헉...', '#bfeeff', 24);
      }
      return;
    }
    if (a.phase === 'rest') {
      this.faceTo(this.scene.player.x);
      this.y = this.groundY - 65 + Math.sin(this.t * 6) * 2;
      this.label(0, '지쳤다! 지금 때려!', this.x, this.y - 110, 22, '#ffd23f');
      if (Math.random() < 0.05) this.scene.dustAt(this.x + this.face * 60, this.y - 20, 1);
      if (a.t >= this.ic.restTime) {
        this.mode = 'fly';
        this.next(a, 'takeoff');
        this.scene.sfxPlay('flap');
      }
      return;
    }
    if (a.phase === 'takeoff') {
      const there = this.moveTo(this.x, HIGH_Y, dt, this.ic.flySpeed);
      if (there || a.t > 1.2) this.endAction();
    }
  }

  // 날개가 다 부서져 떨어진다
  runCrash(dt) {
    const a = this.action;
    if (a.phase === 'aim') {
      this.y = Math.min(this.groundY - 65, this.y + 500 * dt);
      this.x += Math.sin(this.t * 30) * 2;
      if (this.y >= this.groundY - 65) {
        this.scene.sfxPlay('slam');
        this.scene.shake(0.02, 400);
        this.scene.dustAt(this.x, this.groundY, 24);
        this.next(a, 'after');
      }
      return;
    }
    if (a.t >= 1.0) {
      this.action = null;
      this.attacks = 0;
      this.timer = 1.0;
    }
  }

  // ---------- 플레이어 공격 ----------

  receiveAttack(rect, attack) {
    if (this.state !== 'fight' || this.defeated) return false;
    if (this.action && this.action.type === 'crash' && this.action.phase === 'aim') return false;
    if (!intersects(rect, this.hitRect())) return false;
    if (this.heartOpen) {
      const dmg = coreDamage(attack, this.c.chargedPunchCoreMultiplier);
      this.damageHeart(dmg, attack.kind === 'charged' ? '#ffd23f' : '#ffffff');
      return true;
    }
    const side = rect.centerX < this.x ? -1 : 1;
    const wing = this.wings.find((w) => w.alive && w.side === side) || this.wingsAlive[0];
    if (!wing) return false;
    this.damageWing(wing, attack.damage, attack.kind === 'charged' ? '#ffd23f' : '#ffffff');
    return true;
  }

  receiveUltimate(damage) {
    if (this.state !== 'fight' || this.defeated) return false;
    if (this.heartOpen) this.damageHeart(damage, '#3fd0ff');
    else {
      const wing = this.wingsAlive.sort((a, b) => a.health.current - b.health.current)[0];
      if (!wing) return false;
      this.damageWing(wing, damage, '#3fd0ff');
    }
    return true;
  }

  damageWing(wing, dmg, color) {
    wing.health.damage(dmg);
    floatText(this.scene, wing.sprite.x + wing.side * 40, this.y - 60, String(dmg), color, color === '#ffffff' ? 20 : 28);
    flash(this.scene, wing.sprite, this.raging ? 0xff9090 : null);
    flash(this.scene, this.body, this.raging ? 0xff9090 : null);
    this.scene.sparks?.explode(8, wing.sprite.x + wing.side * 30, this.y - 20);
    if (wing.health.isDead) this.breakWing(wing);
  }

  damageHeart(dmg, color) {
    this.heartHealth.damage(dmg);
    floatText(this.scene, this.heart.x, this.heart.y - 40, String(dmg), color, color === '#ffffff' ? 20 : 30);
    flash(this.scene, this.heart);
    flash(this.scene, this.body, this.raging ? 0xff9090 : null);
    this.scene.sparks?.explode(10, this.heart.x, this.heart.y);
    if (this.heartHealth.isDead) this.defeat();
  }

  breakWing(wing) {
    wing.alive = false;
    this.scene.sfxPlay('break');
    this.scene.shake(0.015, 300);
    floatText(this.scene, wing.sprite.x, this.y - 110, `${wing.label} 파괴!`, '#ff9a1f', 30);
    this.scene.tweens.add({
      targets: wing.sprite,
      angle: wing.side * 120,
      y: this.groundY,
      alpha: 0,
      duration: 900,
      onComplete: () => wing.sprite.destroy(),
    });
    this.scene.gainXp(this.c.armXp, wing.sprite.x, this.y - 140);
    if (this.wingsAlive.length > 0) {
      this.scene.robot.say(`${wing.label} 끝! 이제 금방 지칠 거야. 하나 남았어!`, true);
      return;
    }
    // 날개가 다 부서지면 떨어진다 (지금 하던 공격은 멈춤)
    for (const i of this.icicles) i.destroy();
    this.icicles = [];
    this.combo.clear();
    this.mode = 'grounded';
    this.action = { type: 'crash', phase: 'aim', t: 0 };
    this.scene.robot.say(['날개가 다 부서졌어! 이제 못 날아!', '반짝이는 얼음 심장을 때려! 충전 펀치가 제일 세!'], true);
  }

  hudParts() {
    const parts = this.wings.map((w) => ({ label: w.alive ? w.label : `${w.label} 파괴`, ratio: w.alive ? w.health.ratio : 0, kind: 'part' }));
    parts.push({ label: this.heartOpen ? '얼음 심장 (약점!)' : '얼음 심장 (잠김)', ratio: this.heartHealth.ratio, kind: 'core', locked: !this.heartOpen });
    return parts;
  }

  defeat() {
    if (this.defeated) return;
    this.action = null;
    this.combo.clear();
    for (const i of this.icicles) i.destroy();
    this.icicles = [];
    this.aura.clear();
    super.defeat();
  }

  collapse() {
    this.shadowG.clear();
    const targets = [this.body, this.heart, ...this.wingsAlive.map((w) => w.sprite)];
    this.scene.tweens.add({ targets, alpha: 0, y: this.groundY - 20, angle: 30, duration: 900 });
  }
}
