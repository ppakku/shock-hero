import Phaser from 'phaser';
import { BossBase } from './BossBase.js';
import { Health } from '../logic/health.js';
import { coreDamage, rockTargets, pickPattern, shouldRage, restAfterAttack, landingX, difficultyOf } from '../logic/boss.js';
import { whirlPullStep, seaChargeY, seaPhaseIndex, seaUsableAttacks } from '../logic/swim.js';
import { ComboHazards } from './comboHazards.js';
import { drawSwirl } from './bossFx.js';
import { flash, floatText, ring } from '../fx/effects.js';
import { makeCanvas } from '../enemies/seaTextures.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;

// =============================================================
//  심해 아귀왕 (스테이지 6 수중 던전 보스)
//  아들의 물속 보스 디자인이 오면 그림만 바꾸면 된다:
//   - makeTextures() 의 boss_sea_body_6 / boss_sea_jaw_6 / boss_sea_lure 를 고치거나
//   - src/config/art.js 에 같은 이름으로 PNG 를 넣으면 그 그림을 쓴다
//  몸 크기와 부위 위치는 아래 LOOK 숫자만 맞추면 된다.
// =============================================================
const LOOK = {
  bodyW: 250, // 몸통 그림 크기
  bodyH: 160,
  jaw: { x: -72, y: 40, w: 112, h: 52 }, // 큰 턱 위치 (몸 가운데에서, 왼쪽을 볼 때)
  stalkFrom: { x: -40, y: -62 }, // 초롱불 줄기가 나오는 곳
  lure: { x: -138, y: -100, size: 40 }, // 초롱불 위치
  mouth: { x: -112, y: 18 }, // 입 (소용돌이가 빨아들이는 곳)
  hit: { w: 230, h: 140 }, // 주인공 공격이 맞는 몸 크기
};

const TIPS = {
  charge: '빨간 띠를 따라 돌진해 와! 위나 아래로 헤엄쳐서 띠 밖으로 피하거나 대시로 뚫어!',
  bubbles: '바닥에서 거품 폭탄이 올라와! 점선 밖으로 비켜. {atk}(으)로 터뜨려도 돼!',
  whirlpool: '소용돌이로 빨아들인다! 반대쪽으로 계속 헤엄쳐!',
  ink: '먹물이다! 깜깜해도 초롱불 빛을 잘 봐. 빨간 띠가 보이면 피해!',
  sweep: '꼬리로 바닥을 휩쓴다! {jump} 를 꾹 눌러 위로 헤엄쳐!',
  rest: '지쳐서 바닥에 내려앉았어! 지금 마구 때려!',
  dizzy: '벽에 쿵! 어지러워해. 지금 때려!',
};

// 심해 아귀왕: 머리 위 초롱불(빛)과 큰 턱이 부위. 둘 다 부수면 심장(약점)이 드러난다.
// 물속을 헤엄치며 돌진(띠 피하기), 거품 폭탄(점선 피하기), 소용돌이(반대로 헤엄), 먹물(어둠), 꼬리 휩쓸기(위로 헤엄)를 쓴다.
// 공격을 몇 번 하면 지쳐서 바닥에 내려앉고, 돌진 뒤에는 벽에 부딪혀 어지러워한다 (때릴 기회).
export class SeaBoss extends BossBase {
  constructor(scene, cfg, stage, skin = 6) {
    super(scene, cfg, stage, skin);
    this.sc = { ...SEA_DEFAULTS, ...(cfg.seaBoss || {}) };
    this.diff = difficultyOf(cfg);
    this.hpScale *= this.diff.bossHealth;
    this.topY = 200; // 헤엄칠 때 가장 높은 몸 가운데 (초롱불이 화면 위 체력바에 가리지 않게)
    this.restY = this.groundY - 72; // 바닥에 내려앉았을 때 몸 가운데
    this.x = this.maxX - 140;
    this.y = 260;
    this.face = -1; // -1 왼쪽을 봄
    this.action = null;
    this.attacks = 0;
    this.chained = false;
    this.inkLeft = 0;
    this.bubbles = [];
    this.wobble = 0;

    this.aura = scene.add.graphics().setDepth(3);
    this.stalkG = scene.add.graphics().setDepth(5);
    this.topG = scene.add.graphics().setDepth(30.5); // 먹물 위에 보이는 경고
    this.bubbleG = scene.add.graphics().setDepth(7);
    this.body = scene.add.image(this.x, this.y, `boss_sea_body_${skin}`).setDepth(5).setDisplaySize(LOOK.bodyW, LOOK.bodyH);
    this.parts = [
      {
        key: 'lure',
        label: '초롱불',
        health: new Health(Math.round(this.sc.lureHealth * this.hpScale)),
        alive: true,
        sprite: scene.add.image(0, 0, 'boss_sea_lure').setDepth(6).setDisplaySize(LOOK.lure.size, LOOK.lure.size),
      },
      {
        key: 'jaw',
        label: '큰 턱',
        health: new Health(Math.round(this.sc.jawHealth * this.hpScale)),
        alive: true,
        sprite: scene.add.image(0, 0, `boss_sea_jaw_${skin}`).setDepth(6).setDisplaySize(LOOK.jaw.w, LOOK.jaw.h).setOrigin(0.85, 0.2),
      },
    ];
    this.heartHealth = new Health(Math.round(this.sc.heartHealth * this.hpScale));
    this.heart = scene.add.image(0, 0, 'boss_sea_heart').setDepth(6).setDisplaySize(34, 30).setVisible(false);
    this.lureGlow = scene.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    // 먹물 어둠 (주인공과 초롱불 둘레만 보임)
    this.dark = scene.add.graphics().setScrollFactor(0).setDepth(30).setVisible(false);
    this.darkMaskG = scene.make.graphics({ x: 0, y: 0 }, false).setScrollFactor(0); // 화면 좌표로 그림
    const mask = this.darkMaskG.createGeometryMask();
    mask.setInvertAlpha(true);
    this.dark.setMask(mask);
    this.combo = new ComboHazards(this, { rockTexture: 'rock', rockDamage: 12 });
    this.introLines = ['으악, 엄청 큰 아귀야! 심해 아귀왕이다!', '머리 위 초롱불과 큰 턱을 부수면 심장이 드러나!', '지쳐서 바닥에 내려앉거나 벽에 부딪혀 어지러울 때가 기회야!'];
    this.pose(0);
  }

  // ---------- 그림 (아들 디자인이 오면 이 부분만 바꾸면 됨) ----------

  static makeTextures(scene, stage, skin) {
    const c = stage.boss.colors || {};
    const hex = (n, d) => `#${(n ?? d).toString(16).padStart(6, '0')}`;
    const main = hex(c.main, 0x2a4a6a);
    const light = hex(c.light, 0x4a7aa0);
    const dark = hex(c.dark, 0x14263a);
    const belly = hex(c.belly, 0x8ab0c0);
    const lure = hex(c.lure, 0x9dff6a);
    // 몸통 (왼쪽을 보는 모습: 머리가 왼쪽, 꼬리가 오른쪽. 아래턱은 따로)
    makeCanvas(scene, `boss_sea_body_${skin}`, 250, 160, (ctx) => {
      ctx.strokeStyle = '#0a1420';
      ctx.lineWidth = 3;
      // 꼬리 지느러미
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(196, 80);
      ctx.lineTo(248, 30);
      ctx.lineTo(236, 80);
      ctx.lineTo(248, 132);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 등 가시 지느러미
      ctx.fillStyle = dark;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(110 + i * 18, 28 + i * 3);
        ctx.lineTo(120 + i * 18, 4 + i * 4);
        ctx.lineTo(128 + i * 18, 32 + i * 3);
        ctx.fill();
      }
      // 몸
      const g = ctx.createLinearGradient(0, 10, 0, 150);
      g.addColorStop(0, light);
      g.addColorStop(0.55, main);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(18, 70);
      ctx.bezierCurveTo(20, 10, 150, 6, 205, 70);
      ctx.bezierCurveTo(200, 120, 120, 150, 60, 130);
      ctx.lineTo(18, 96);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 배
      ctx.fillStyle = belly;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(110, 118, 70, 18, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 입 안 (어두운 큰 입)
      ctx.fillStyle = '#12060a';
      ctx.beginPath();
      ctx.moveTo(14, 76);
      ctx.quadraticCurveTo(60, 70, 96, 92);
      ctx.lineTo(70, 110);
      ctx.quadraticCurveTo(30, 108, 14, 96);
      ctx.closePath();
      ctx.fill();
      // 윗니
      ctx.fillStyle = '#f2f2e8';
      for (let i = 0; i < 7; i++) {
        const x = 18 + i * 11;
        const y = 76 + i * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + 13);
        ctx.lineTo(x + 8, y + 1);
        ctx.fill();
      }
      // 가슴지느러미
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(130, 92);
      ctx.quadraticCurveTo(150, 130, 120, 138);
      ctx.quadraticCurveTo(118, 112, 130, 92);
      ctx.fill();
      ctx.stroke();
      // 눈 (작고 빛나는 노란 눈 + 화난 눈썹)
      ctx.fillStyle = '#ffe94a';
      ctx.beginPath();
      ctx.arc(66, 46, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1a0a00';
      ctx.beginPath();
      ctx.arc(62, 47, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a1420';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(48, 30);
      ctx.lineTo(82, 38);
      ctx.stroke();
      // 옆구리 빛 점
      ctx.fillStyle = lure;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(100 + i * 16, 84 + Math.sin(i) * 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // 큰 아래턱 (이빨이 위로). 붙는 곳(경첩)이 오른쪽
    makeCanvas(scene, `boss_sea_jaw_${skin}`, 112, 52, (ctx) => {
      ctx.fillStyle = main;
      ctx.strokeStyle = '#0a1420';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(2, 8);
      ctx.quadraticCurveTo(50, 22, 108, 6);
      ctx.lineTo(104, 30);
      ctx.quadraticCurveTo(50, 54, 6, 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f2f2e8';
      for (let i = 0; i < 8; i++) {
        const x = 6 + i * 12;
        const y = 10 + Math.sin((i / 8) * Math.PI) * 6;
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x + 5, y - 10);
        ctx.lineTo(x + 9, y + 5);
        ctx.fill();
      }
    });
    // 초롱불 (빛나는 공)
    makeCanvas(scene, 'boss_sea_lure', 40, 40, (ctx) => {
      const g = ctx.createRadialGradient(20, 20, 2, 20, 20, 20);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, lure);
      g.addColorStop(0.7, 'rgba(157,255,106,0.5)');
      g.addColorStop(1, 'rgba(157,255,106,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 40, 40);
      ctx.strokeStyle = '#2a5a20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(20, 20, 9, 0, Math.PI * 2);
      ctx.stroke();
    });
    // 심장 (약점)
    makeCanvas(scene, 'boss_sea_heart', 34, 30, (ctx) => {
      ctx.fillStyle = '#ff4a7a';
      ctx.strokeStyle = '#5a0a20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(17, 28);
      ctx.bezierCurveTo(-6, 14, 4, -4, 17, 8);
      ctx.bezierCurveTo(30, -4, 40, 14, 17, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffc0d0';
      ctx.beginPath();
      ctx.arc(11, 10, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // 거품 폭탄
    makeCanvas(scene, 'boss_sea_bubble', 48, 48, (ctx) => {
      const g = ctx.createRadialGradient(18, 16, 2, 24, 24, 23);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.5, 'rgba(160,230,255,0.35)');
      g.addColorStop(1, 'rgba(120,200,255,0.6)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(24, 24, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,250,255,0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 안에서 빨갛게 빛나는 심지 (터지면 아픔)
      ctx.fillStyle = '#ff5a3a';
      ctx.beginPath();
      ctx.arc(24, 26, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(24, 26, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---------- 모습 ----------

  get lure() {
    return this.parts[0];
  }

  get jaw() {
    return this.parts[1];
  }

  get partsAlive() {
    return this.parts.filter((p) => p.alive);
  }

  get heartOpen() {
    return this.partsAlive.length === 0;
  }

  get speed() {
    return this.tempo * this.diff.bossSpeed * (this.raging ? this.c.rageSpeed : 1);
  }

  get healthRatio() {
    let cur = this.heartHealth.current;
    let max = this.heartHealth.max;
    for (const p of this.parts) {
      cur += p.alive ? p.health.current : 0;
      max += p.health.max;
    }
    return cur / max;
  }

  local(off) {
    // 왼쪽을 볼 때 그대로, 오른쪽을 보면 x 를 뒤집음
    return { x: this.x + (this.face < 0 ? off.x : -off.x), y: this.y + off.y };
  }

  get mouth() {
    return this.local(LOOK.mouth);
  }

  get lurePos() {
    const sway = Math.sin(this.t * 2.2) * 8;
    const p = this.local(LOOK.lure);
    return { x: p.x + sway, y: p.y + Math.cos(this.t * 1.7) * 5 };
  }

  bodyRect() {
    return new Rect(this.x - LOOK.hit.w / 2, this.y - LOOK.hit.h / 2, LOOK.hit.w, LOOK.hit.h);
  }

  lureRect() {
    const p = this.lurePos;
    return new Rect(p.x - 30, p.y - 30, 60, 60);
  }

  pose(dt) {
    this.wobble += dt;
    const flipped = this.face > 0;
    const tilt = this.action?.phase === 'dizzy' ? Math.sin(this.t * 12) * 6 : Math.sin(this.t * 1.5) * 2;
    this.body.setPosition(this.x, this.y).setFlipX(flipped).setAngle(tilt);
    // 아래턱: 소용돌이와 깨물기 때 크게 벌림
    const jaw = this.jaw;
    if (jaw.alive) {
      const p = this.local(LOOK.jaw);
      const open = this.action && this.action.type === 'whirlpool' && this.action.phase !== 'after' ? 1 : this.action?.type === 'charge' && this.action.phase === 'go' ? 0.6 : 0.1 + 0.08 * Math.sin(this.t * 3);
      jaw.sprite.setPosition(p.x, p.y).setFlipX(flipped).setOrigin(flipped ? 0.15 : 0.85, 0.2).setAngle((flipped ? 1 : -1) * open * 28);
    }
    // 초롱불 줄기와 빛
    const g = this.stalkG.clear();
    this.lureGlow.clear();
    if (!this.defeated) {
      const from = this.local(LOOK.stalkFrom);
      const lp = this.lurePos;
      if (this.lure.alive) {
        g.lineStyle(5, 0x14263a, 1);
        const cx = (from.x + lp.x) / 2;
        const cy = Math.min(from.y, lp.y) - 40;
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x, from.y), new Phaser.Math.Vector2(cx, cy), new Phaser.Math.Vector2(lp.x, lp.y + 8));
        curve.draw(g, 16);
        this.lure.sprite.setPosition(lp.x, lp.y);
        const resting = this.action?.type === 'rest' && this.action.phase === 'rest';
        const pulse = 0.5 + 0.5 * Math.sin(this.t * (this.inkLeft > 0 ? 9 : 4));
        const a = resting ? 0.1 : 0.22 + 0.15 * pulse;
        this.lureGlow.fillStyle(0x9dff6a, a).fillCircle(lp.x, lp.y, 46 + pulse * 10);
        this.lureGlow.fillStyle(0xd8ffb0, a).fillCircle(lp.x, lp.y, 20);
      } else {
        // 부러진 줄기
        g.lineStyle(5, 0x14263a, 1).lineBetween(from.x, from.y, from.x + (this.face < 0 ? -24 : 24), from.y - 30);
      }
    }
    // 심장: 부위를 다 부수면 배에서 쿵쾅
    if (this.heartOpen && !this.defeated) {
      const hp = this.local({ x: 20, y: 30 });
      const s = 1 + Math.sin(this.t * 8) * 0.12;
      this.heart.setVisible(true).setPosition(hp.x, hp.y).setDisplaySize(34 * s * 1.4, 30 * s * 1.4);
    }
  }

  faceTo(x) {
    if (Math.abs(x - this.x) > 30) this.face = x > this.x ? 1 : -1;
  }

  // 목표 쪽으로 헤엄치기. 다 오면 true
  moveTo(tx, ty, dt, speed = this.sc.swimSpeed) {
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

  clampY(y) {
    return Phaser.Math.Clamp(y, this.topY, this.restY);
  }

  // ---------- 진행 ----------

  startFight() {
    if (this.state !== 'dormant') return;
    super.startFight();
    this.scene.sfxPlay('seaRoar');
  }

  update(dt) {
    const fighting = this.tickState(dt);
    this.bodyX = this.x;
    this.updateBubbles(dt);
    this.updateInk(dt);
    if (this.state === 'dead') {
      this.pose(dt);
      return;
    }
    if (!fighting) {
      if (this.state === 'intro') this.moveTo(this.maxX - 180, 260, dt, 120);
      else this.y = 260 + Math.sin(this.t * 1.5) * 10;
      this.faceTo(this.target.x);
      this.pose(dt);
      return;
    }
    this.warn.clear();
    this.fxG.clear();
    this.topG.clear();
    this.hideLabels();
    this.updateRage();
    this.drawRage();
    if (!this.action) {
      this.idle(dt);
      this.timer -= dt;
      if (this.timer <= 0 && this.scene.anyAlive) this.startAction();
    } else {
      this.runAction(dt);
    }
    this.combo.update(dt);
    this.pose(dt);
  }

  // 공격 사이: 주인공에게서 조금 떨어진 곳을 천천히 맴돈다
  idle(dt) {
    const p = this.target;
    const tx = Phaser.Math.Clamp(p.x + (this.x > p.x ? 280 : -280), this.minX + 80, this.maxX - 80);
    const ty = this.clampY(220 + Math.sin(this.t * 1.2) * 40);
    this.moveTo(tx, ty, dt, this.sc.swimSpeed * 0.5);
    this.faceTo(p.x);
  }

  updateRage() {
    if (this.defeated || this.state !== 'fight') return;
    if (shouldRage(this.healthRatio, this.sc.rageAt, this.raging)) {
      this.raging = true;
      this.chained = false;
      this.scene.sfxPlay('rage');
      this.scene.shake(0.014, 600);
      this.body.setTint(0xff9090);
      for (const p of this.partsAlive) p.sprite.setTint(0xff9090);
      floatText(this.scene, this.x, this.y - 110, '분노 모드!', '#ff3030', 34);
      this.scene.robot.say(['아귀왕이 화났어! 빨개졌다!', '쉬지 않고 두 번씩 공격하고 거품도 많아져. 조심해!'], true);
    }
  }

  drawRage() {
    this.aura.clear();
    if (!this.raging || this.defeated) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
    this.aura.fillStyle(0xff2020, 0.12 + 0.1 * pulse).fillEllipse(this.x, this.y, 300 + pulse * 20, 190);
    this.label(7, '분노!', this.x, this.y - 110, 22 + Math.round(pulse * 4), '#ff3030');
  }

  tip(type, text = TIPS[type]) {
    super.tip(type, text && this.scene.keyText ? this.scene.keyText(text) : text);
  }

  startAction(forceType = null) {
    let type = forceType;
    if (!type) {
      if (this.attacks >= Math.max(2, Math.round(this.sc.tiredAfter))) type = 'rest';
      else {
        const phases = this.def.phases || [];
        const idx = Math.min(seaPhaseIndex(this.partsAlive.length, 2), phases.length - 1);
        const list = seaUsableAttacks(phases[Math.max(0, idx)], this.lure.alive && this.inkLeft <= 0);
        type = pickPattern(list, this.lastType, Math.random, 'charge');
      }
    }
    this.lastType = type;
    const p = this.target;
    const mid = (this.minX + this.maxX) / 2;
    const a = { type, phase: 'aim', t: 0, hits: new Set() }; // hits: 이번 공격에 이미 맞은 주인공
    if (type === 'charge') {
      a.dir = p.x < mid ? -1 : 1; // 이 방향으로 돌진
      a.startX = a.dir < 0 ? this.maxX - 40 : this.minX + 40;
      a.endX = a.dir < 0 ? this.minX + 40 : this.maxX - 40;
      // 띠 높이는 주인공 높이를 따라가되, 위로도 아래로도 피할 길이 남게 (띠 반 높이 64)
      a.y = seaChargeY(p.y, 214, this.restY - 20);
      a.ready = false;
    } else if (type === 'bubbles') {
      const n = Math.max(1, Math.round(this.sc.bubbleCount + (this.raging ? 2 : 0)));
      a.targets = rockTargets(p.x, n, this.minX - 20, this.maxX + 20, Math.random, 110);
    } else if (type === 'whirlpool') {
      a.x = p.x < mid ? this.maxX - 60 : this.minX + 60;
      a.ready = false;
    } else if (type === 'sweep') {
      a.dir = p.x < mid ? -1 : 1;
      a.startX = a.dir < 0 ? this.maxX - 20 : this.minX + 20;
      a.endX = a.dir < 0 ? this.minX + 20 : this.maxX - 20;
      a.ready = false;
    } else if (type === 'rest') {
      a.phase = 'descend';
      a.tx = landingX(p.x, this.minX + 80, this.maxX - 80, 220);
    }
    this.action = a;
    if (type !== 'rest') this.scene.sfxPlay('warn');
    this.tip(type);
    if (type !== 'rest' && type !== 'ink') {
      // 겹쳐 쓰기는 지금 공격과 피하는 법이 겹치지 않게: 바닥 휩쓸기 중에는 돌, 거품 중에는 충격파
      const mainLike = type === 'sweep' ? 'shockwave' : type === 'bubbles' ? 'rocks' : type;
      this.combo.maybeStart(mainLike, this.diff.bossCombo);
    }
  }

  endAction() {
    const a = this.action;
    this.action = null;
    if (a && a.type === 'rest') {
      this.attacks = 0;
      this.timer = 0.6;
      this.chained = false;
      return;
    }
    this.attacks += 1;
    const rest = restAfterAttack(this.raging, this.chained, this.sc.idleTime * this.speed, this.c.rageChainGap);
    this.timer = rest.wait;
    this.chained = rest.chained;
  }

  next(a, phase) {
    a.phase = phase;
    a.t = 0;
  }

  runAction(dt) {
    const a = this.action;
    a.t += dt;
    if (a.type === 'charge') this.runCharge(dt);
    else if (a.type === 'bubbles') this.runBubbles(dt);
    else if (a.type === 'whirlpool') this.runWhirl(dt);
    else if (a.type === 'ink') this.runInk(dt);
    else if (a.type === 'sweep') this.runSweep(dt);
    else if (a.type === 'rest') this.runRest(dt);
    else this.endAction();
  }

  // ---------- 돌진 (띠 밖으로 헤엄치거나 대시) ----------

  runCharge(dt) {
    const a = this.action;
    const band = 64; // 띠 반 높이
    if (a.phase === 'aim') {
      const there = this.moveTo(a.startX, a.y, dt, this.sc.swimSpeed * 1.6);
      this.face = a.dir;
      if (there) a.ready = true;
      const dur = this.sc.chargeWarningTime * this.speed;
      const alpha = 0.18 + 0.14 * Math.sin(this.t * 18);
      const g = this.inkLeft > 0 ? this.topG : this.warn;
      g.fillStyle(0xff2020, alpha).fillRect(this.minX - 60, a.y - band, this.maxX - this.minX + 120, band * 2);
      g.lineStyle(3, 0xff4444, 1).strokeRect(this.minX - 60, a.y - band, this.maxX - this.minX + 120, band * 2);
      const arrow = a.dir < 0 ? '◀◀  돌진! 띠 밖으로!  ◀◀' : '▶▶  돌진! 띠 밖으로!  ▶▶';
      const ly = a.y - band - 24 < 70 ? a.y + band + 24 : a.y - band - 24;
      this.label(0, arrow, (this.minX + this.maxX) / 2, ly, 24);
      if (this.labels[0]) this.labels[0].setDepth(31);
      if (a.ready && a.t >= dur) {
        this.next(a, 'go');
        this.scene.sfxPlay('swoop');
      }
      return;
    }
    if (a.phase === 'go') {
      this.x += a.dir * this.sc.chargeSpeed * dt;
      if (Math.random() < 0.6) this.scene.dustAt(this.x - a.dir * 110, this.y + Phaser.Math.Between(-40, 40), 1);
      const danger = new Rect(this.x - 110, a.y - band + 10, 220, band * 2 - 20);
      this.hurtPlayer(danger, this.sc.chargeDamage, this.x - a.dir * 80, 420, a.hits);
      const done = a.dir < 0 ? this.x <= a.endX : this.x >= a.endX;
      if (done) {
        this.x = a.endX;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.016, 300);
        this.scene.impact?.bossSlam(1); // 쿵: 잠깐 멈칫 + 화면 확대 (src/fx/impact.js)
        ring(this.scene, this.x + a.dir * 110, this.y, 0xffffff, 80, 300, 5);
        floatText(this.scene, this.x, this.y - 100, '쿵! 어질어질...', '#ffd23f', 24);
        this.next(a, 'dizzy');
        this.tip('dizzy');
      }
      return;
    }
    if (a.phase === 'dizzy') {
      // 벽에 부딪혀 어지러움 (때릴 기회): 천천히 가라앉음
      this.y = Math.min(this.restY, this.y + 30 * dt);
      for (let i = 0; i < 3; i++) {
        const ang = this.t * 5 + i * 2.1;
        this.fxG.fillStyle(0xffe066, 1).fillCircle(this.x + Math.cos(ang) * 40, this.y - 80 + Math.sin(ang) * 8, 5);
      }
      this.label(0, '어지러워! 지금 때려!', this.x, this.y - 120, 22, '#ffd23f');
      if (a.t >= this.sc.dizzyTime) this.endAction();
    }
  }

  // ---------- 거품 폭탄 (바닥에서 올라옴, 점선 밖으로) ----------

  runBubbles(dt) {
    const a = this.action;
    if (a.phase === 'aim') {
      // 위로 올라가서 입으로 바닥을 향해 뿜는 자세
      this.moveTo(Phaser.Math.Clamp(this.x, this.minX + 120, this.maxX - 120), this.topY, dt, this.sc.swimSpeed);
      const dur = this.sc.bubbleWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      for (const x of a.targets) {
        this.warn.fillStyle(0x9fe8ff, 0.25 + 0.35 * k).fillEllipse(x, this.groundY - 2, 40 + 40 * k, 14);
        this.warn.lineStyle(2, 0xffffff, 0.5 + 0.5 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY - 2, 84, 18);
        for (let y = this.groundY - 30; y > 80; y -= 26) this.warn.fillStyle(0xbff8ff, 0.18 + 0.4 * k).fillCircle(x, y, 3);
      }
      this.label(0, '거품 폭탄! 점선 밖으로!', (this.minX + this.maxX) / 2, 80, 24, '#bff8ff');
      if (a.t >= dur) {
        this.next(a, 'rise');
        this.scene.sfxPlay('bubbleUp');
        for (const x of a.targets) this.spawnBubble(x, this.groundY - 22);
      }
      return;
    }
    if (a.phase === 'rise') {
      this.y = this.topY + Math.sin(this.t * 2) * 6;
      if (this.bubbles.length === 0 || a.t > 4) this.next(a, 'after');
      return;
    }
    if (a.t >= 0.3) this.endAction();
  }

  spawnBubble(x, y) {
    const img = this.scene.add.image(x, y, 'boss_sea_bubble').setDepth(8).setDisplaySize(44, 44);
    this.bubbles.push({ x, y, x0: x, img, t: Math.random() * 3 });
  }

  updateBubbles(dt) {
    this.bubbleG.clear();
    if (!this.bubbles.length) return;
    for (const b of this.bubbles) {
      b.t += dt;
      b.y -= this.sc.bubbleRiseSpeed * dt;
      b.x = b.x0 + Math.sin(b.t * 3) * 10;
      b.img.setPosition(b.x, b.y);
      const touched = b.done ? [] : this.scene.playersIn(new Rect(b.x - 18, b.y - 18, 36, 36));
      if (touched.length) {
        this.popBubble(b, true);
        for (const p of touched) p.hurt(this.sc.bubbleDamage, b.x, 260);
      } else if (!b.done && b.y < 70) this.popBubble(b, false);
    }
    this.bubbles = this.bubbles.filter((b) => !b.done);
  }

  popBubble(b, boom) {
    b.done = true;
    const s = this.scene;
    s.tweens.add({ targets: b.img, scale: b.img.scale * 1.6, alpha: 0, duration: 160, onComplete: () => b.img.destroy() });
    if (boom) {
      s.sfxPlay('bomb');
      ring(s, b.x, b.y, 0xff8a5a, 50, 220, 5);
      s.sparks.explode(10, b.x, b.y);
    } else {
      s.sfxPlay('pop');
      ring(s, b.x, b.y, 0xbff8ff, 30, 180, 3);
    }
  }

  // ---------- 소용돌이 (반대쪽으로 헤엄쳐 버티기) ----------

  runWhirl(dt) {
    const a = this.action;
    const p = this.target;
    const m = this.mouth;
    const pullDir = this.face; // 입이 보는 쪽에서 끌어옴
    if (a.phase === 'aim') {
      const there = this.moveTo(a.x, this.clampY(Phaser.Math.Clamp(p.y, 220, 380)), dt, this.sc.swimSpeed * 1.4);
      this.faceTo(p.x);
      if (there) a.ready = true;
      const dur = this.sc.whirlWarningTime * this.speed;
      drawSwirl(this.fxG, m.x, m.y, this.t, 0.35 * Math.min(1, a.t / dur), pullDir);
      this.label(0, '소용돌이! 반대로 헤엄쳐!', (this.minX + this.maxX) / 2, 90, 24);
      if (a.ready && a.t >= dur) {
        this.next(a, 'pull');
        this.scene.sfxPlay('inhale');
      }
      return;
    }
    if (a.phase === 'pull') {
      drawSwirl(this.fxG, m.x, m.y, this.t, 1, pullDir);
      this.fxG.fillStyle(0x0a1420, 0.6).fillCircle(m.x, m.y, 26);
      this.label(0, pullDir < 0 ? '버텨! ◀ 반대로 헤엄쳐!' : '버텨! 반대로 헤엄쳐! ▶', (this.minX + this.maxX) / 2, 90, 24);
      // 함께하기: 둘 다 끌려온다. 먼저 입에 닿은 사람이 깨물린다
      for (const q of this.scene.players) {
        if (q.dead || q.ultActive || q.dashInvuln > 0) continue;
        const np = whirlPullStep(q.x, q.y, m.x, m.y, this.sc.whirlPull, dt);
        q.x = np.x;
        q.y = np.y;
      }
      const bitten = a.hits.size ? null : this.scene.players.find((q) => !q.dead && Math.hypot(q.x - m.x, q.y - m.y) < 60);
      if (bitten) {
        const p = bitten;
        a.hits.add(p);
        if (this.jaw.alive) {
          this.scene.sfxPlay('bite');
          floatText(this.scene, m.x, m.y - 50, '앙!', '#ff5555', 30);
          p.hurt(this.sc.whirlBiteDamage, this.x, 520);
        } else {
          // 턱이 없어서 못 깨물고 퉤 뱉음
          floatText(this.scene, m.x, m.y - 50, '퉤!', '#bff8ff', 26);
          p.hurt(Math.round(this.sc.whirlBiteDamage * 0.4), this.x, 520);
        }
        this.next(a, 'after');
        return;
      }
      if (a.t >= this.sc.whirlTime) this.next(a, 'after');
      return;
    }
    if (a.t >= 0.5) this.endAction();
  }

  // ---------- 먹물 (깜깜해지고 바로 돌진) ----------

  runInk() {
    const a = this.action;
    if (a.phase === 'aim') {
      this.fxG.fillStyle(0x0a0a14, 0.5).fillCircle(this.mouth.x, this.mouth.y, 20 + a.t * 60);
      this.label(0, '먹물이다!', this.x, this.y - 110, 24, '#bfc7d5');
      if (a.t >= 0.8 * this.speed) {
        this.scene.sfxPlay('ink');
        this.inkLeft = this.sc.inkTime;
        this.dark.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: this.dark, alpha: 1, duration: 300 });
        this.scene.dustAt(this.mouth.x, this.mouth.y, 12);
        // 어둠 속에서 바로 돌진 (초롱불과 빨간 띠는 보임)
        this.action = null;
        this.startAction('charge');
        this.lastType = 'ink';
      }
    }
  }

  updateInk(dt) {
    if (this.inkLeft <= 0) return;
    this.inkLeft -= dt;
    const cam = this.scene.cameras.main;
    this.dark.clear().fillStyle(0x020812, 0.88).fillRect(0, 0, 960, 540);
    const mg = this.darkMaskG.clear().fillStyle(0xffffff);
    // 주인공 둘레만 보인다 (함께하기면 두 사람 모두)
    for (const p of this.scene.players) if (!p.dead) mg.fillCircle(p.x - cam.scrollX, p.y - cam.scrollY, 90);
    if (this.lure.alive && !this.defeated) {
      const lp = this.lurePos;
      mg.fillCircle(lp.x - cam.scrollX, lp.y - cam.scrollY, 70);
    }
    if (this.inkLeft <= 0 || this.defeated) this.clearInk();
  }

  clearInk() {
    this.inkLeft = 0;
    this.scene.tweens.add({ targets: this.dark, alpha: 0, duration: 400, onComplete: () => this.dark.setVisible(false) });
  }

  // ---------- 꼬리 휩쓸기 (위로 헤엄쳐 피하기) ----------

  runSweep(dt) {
    const a = this.action;
    const h = this.sc.sweepHeight;
    if (a.phase === 'aim') {
      const there = this.moveTo(a.startX, this.restY, dt, this.sc.swimSpeed * 1.6);
      this.face = a.dir;
      if (there) a.ready = true;
      const alpha = 0.18 + 0.14 * Math.sin(this.t * 18);
      this.warn.fillStyle(0xff2020, alpha).fillRect(this.minX - 60, this.groundY - h, this.maxX - this.minX + 120, h);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(this.minX - 60, this.groundY - h, this.maxX - this.minX + 120, h);
      this.label(0, '꼬리 휩쓸기! ▲ 위로 헤엄쳐! ▲', (this.minX + this.maxX) / 2, this.groundY - h - 30, 24);
      if (a.ready && a.t >= this.sc.sweepWarningTime * this.speed) {
        this.next(a, 'go');
        this.scene.sfxPlay('swoop');
      }
      return;
    }
    if (a.phase === 'go') {
      this.x += a.dir * this.sc.sweepSpeed * dt;
      this.y = this.restY + Math.sin(this.t * 20) * 3;
      this.scene.dustAt(this.x - a.dir * 100, this.groundY - 4, 2);
      // 모래 물결
      this.fxG.fillStyle(0xbfae8a, 0.6).fillEllipse(this.x - a.dir * 60, this.groundY - h / 2, 200, h);
      const danger = new Rect(this.x - 120, this.groundY - h, 240, h);
      this.hurtPlayer(danger, this.sc.sweepDamage, this.x - a.dir * 80, 360, a.hits);
      const done = a.dir < 0 ? this.x <= a.endX : this.x >= a.endX;
      if (done) this.next(a, 'after');
      return;
    }
    // 휩쓸고 나서 다시 떠오름
    this.moveTo(this.x, 260, dt, this.sc.swimSpeed);
    if (a.t >= 0.6) this.endAction();
  }

  // ---------- 지쳐서 내려앉기 (때릴 기회) ----------

  runRest(dt) {
    const a = this.action;
    if (a.phase === 'descend') {
      this.faceTo(this.target.x);
      this.warn.fillStyle(0x9dff6a, 0.2).fillEllipse(a.tx, this.groundY, 200, 20);
      const there = this.moveTo(a.tx, this.restY, dt, this.sc.swimSpeed * 1.2);
      if (there) {
        this.scene.dustAt(this.x, this.groundY, 14);
        this.scene.sfxPlay('slam');
        this.scene.shake(0.006, 150);
        floatText(this.scene, this.x, this.y - 100, '헉헉...', '#bff8ff', 24);
        this.next(a, 'rest');
      }
      return;
    }
    if (a.phase === 'rest') {
      this.faceTo(this.target.x);
      this.y = this.restY + Math.sin(this.t * 4) * 2;
      this.label(0, '지쳤다! 지금 때려!', this.x, this.y - 120, 22, '#ffd23f');
      if (Math.random() < 0.08) {
        // 헉헉: 입에서 거품이 뽀글
        const b = this.scene.add.image(this.mouth.x, this.mouth.y, 'swim_bubble').setDepth(7).setAlpha(0.9);
        this.scene.tweens.add({ targets: b, y: b.y - 60, alpha: 0, duration: 900, onComplete: () => b.destroy() });
      }
      if (a.t >= this.sc.restTime) this.next(a, 'rise');
      return;
    }
    if (a.phase === 'rise') {
      const there = this.moveTo(this.x, 240, dt, this.sc.swimSpeed);
      if (there || a.t > 1.2) this.endAction();
    }
  }

  // ---------- 플레이어 공격 ----------

  receiveAttack(rect, attack) {
    // 거품 폭탄은 펀치로 미리 터뜨릴 수 있다 (안전)
    let popped = false;
    for (const b of this.bubbles) {
      if (!b.done && intersects(rect, new Rect(b.x - 24, b.y - 24, 48, 48))) {
        this.popBubble(b, false);
        popped = true;
      }
    }
    if (this.state !== 'fight' || this.defeated) return popped;
    const onLure = this.lure.alive && intersects(rect, this.lureRect());
    if (!onLure && !intersects(rect, this.bodyRect())) return popped;
    const color = attack.kind === 'charged' ? '#ffd23f' : '#ffffff';
    if (this.heartOpen) {
      this.damageHeart(coreDamage(attack, this.c.chargedPunchCoreMultiplier), color);
      return true;
    }
    const part = onLure ? this.lure : this.jaw.alive ? this.jaw : this.lure;
    this.damagePart(part, attack.damage, color);
    return true;
  }

  receiveUltimate(damage) {
    if (this.state !== 'fight' || this.defeated) return false;
    if (this.heartOpen) this.damageHeart(damage, '#3fd0ff');
    else {
      const part = [...this.partsAlive].sort((a, b) => a.health.current - b.health.current)[0];
      if (!part) return false;
      this.damagePart(part, damage, '#3fd0ff');
    }
    return true;
  }

  damagePart(part, dmg, color) {
    part.health.damage(dmg);
    const at = part.key === 'lure' ? this.lurePos : this.local(LOOK.jaw);
    floatText(this.scene, at.x, at.y - 40, String(dmg), color, color === '#ffffff' ? 20 : 28);
    flash(this.scene, part.sprite, this.raging ? 0xff9090 : null);
    flash(this.scene, this.body, this.raging ? 0xff9090 : null);
    this.scene.sparks?.explode(8, at.x, at.y);
    if (part.health.isDead) this.breakPart(part);
  }

  damageHeart(dmg, color) {
    this.heartHealth.damage(dmg);
    floatText(this.scene, this.heart.x, this.heart.y - 40, String(dmg), color, color === '#ffffff' ? 20 : 30);
    flash(this.scene, this.heart);
    flash(this.scene, this.body, this.raging ? 0xff9090 : null);
    this.scene.sparks?.explode(10, this.heart.x, this.heart.y);
    if (this.heartHealth.isDead) this.defeat();
  }

  breakPart(part) {
    part.alive = false;
    const s = this.scene;
    s.sfxPlay('break');
    s.shake(0.015, 300);
    const at = { x: part.sprite.x, y: part.sprite.y };
    floatText(s, at.x, at.y - 60, `${part.label} 파괴!`, '#ff9a1f', 30);
    s.tweens.add({ targets: part.sprite, y: this.groundY - 10, angle: 160, alpha: 0, duration: 1000, onComplete: () => part.sprite.destroy() });
    s.gainXp(this.c.armXp, at.x, at.y - 90);
    if (part.key === 'lure') {
      if (this.inkLeft > 0) this.clearInk();
      s.robot.say('초롱불이 꺼졌어! 이제 먹물은 못 써!', true);
    } else {
      s.robot.say('큰 턱이 떨어졌다! 이제 깨물지 못해!', true);
    }
    if (this.heartOpen) {
      this.heart.setVisible(true);
      this.scene.time.delayedCall(400, () => s.robot.say(['부위를 다 부쉈어! 배에서 심장이 쿵쾅거려!', '심장을 때려! {strong}(이)가 제일 세!'], true));
    }
  }

  hudParts() {
    const parts = this.parts.map((p) => ({ label: p.alive ? p.label : `${p.label} 파괴`, ratio: p.alive ? p.health.ratio : 0, kind: 'part' }));
    parts.push({ label: this.heartOpen ? '심장 (약점!)' : '심장 (잠김)', ratio: this.heartHealth.ratio, kind: 'core', locked: !this.heartOpen });
    return parts;
  }

  // 봇과 테스트용: 지금 피해야 하는 곳 { band: [위 y, 아래 y] | null, columns: [[왼쪽 x, 오른쪽 x]], pull: {x, y} | null }
  dangers() {
    const a = this.action;
    const out = { band: null, columns: [], pull: null };
    if (!a) return out;
    if (a.type === 'charge' && (a.phase === 'aim' || a.phase === 'go')) out.band = [a.y - 64, a.y + 64];
    if (a.type === 'sweep' && (a.phase === 'aim' || a.phase === 'go')) out.band = [this.groundY - this.sc.sweepHeight, this.groundY];
    if (a.type === 'bubbles' && a.phase === 'aim') out.columns = a.targets.map((x) => [x - 50, x + 50]);
    if (a.type === 'whirlpool' && a.phase === 'pull') out.pull = this.mouth;
    for (const b of this.bubbles) out.columns.push([b.x - 50, b.x + 50]);
    return out;
  }

  defeat() {
    if (this.defeated) return;
    this.action = null;
    this.combo.clear();
    for (const b of this.bubbles) b.img.destroy();
    this.bubbles = [];
    this.aura.clear();
    this.topG.clear();
    if (this.inkLeft > 0) this.clearInk();
    super.defeat();
  }

  collapse() {
    this.stalkG.clear();
    this.lureGlow.clear();
    const targets = [this.body, this.heart, ...this.partsAlive.map((p) => p.sprite)];
    // 배를 뒤집고 바닥으로 가라앉음
    this.scene.tweens.add({ targets, alpha: 0, y: this.groundY - 30, angle: 180, duration: 1200, ease: 'Sine.easeIn' });
  }
}

// balance.js 의 seaBoss 를 지워 버려도 돌아가게 쓰는 기본값
const SEA_DEFAULTS = {
  lureHealth: 200, jawHealth: 220, heartHealth: 420, swimSpeed: 200, idleTime: 1.0, tiredAfter: 3, restTime: 3.0,
  chargeWarningTime: 1.1, chargeSpeed: 620, chargeDamage: 20, dizzyTime: 1.8,
  bubbleCount: 4, bubbleWarningTime: 0.9, bubbleRiseSpeed: 150, bubbleDamage: 12,
  whirlWarningTime: 1.0, whirlTime: 2.6, whirlPull: 130, whirlBiteDamage: 18, inkTime: 4.0,
  sweepWarningTime: 1.0, sweepSpeed: 520, sweepDamage: 16, sweepHeight: 100, rageAt: 0.5,
};
