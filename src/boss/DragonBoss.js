import Phaser from 'phaser';
import { BossBase } from './BossBase.js';
import { BossPart, Puddles, GroundWaves, Rect, intersects, damagePart, warnBox, WAVE_H } from './bossKit.js';
import { signatureDue } from '../logic/sig_dragon.js';
import { chooseDragonAttack, pillarWaves, flyLandingX, gustVelocity, gustPillarXs } from '../logic/dragon.js';
import { spreadTargets } from '../logic/watcher.js';
import { coreDamage } from '../logic/boss.js';
import { difficultyOf, pickSideAttack } from '../logic/bossCombo.js';
import { varyCount } from '../logic/bossVariety.js';
import { floatText, ring } from '../fx/effects.js';
import { FireFx } from '../fx/fireFx.js';
import { make } from '../fx/textures.js';
import { hasArt, stamp, stampLimb } from '../fx/bossArt.js';

const lerp = Phaser.Math.Linear;
const W = 320; // 서 있는 용 그림 크기
const H = 260;
const TH = 200; // 날개를 늘어뜨리고 쉬는 그림 높이
const TIRED_W = 340; // 날개를 늘어뜨린 Gemini 그림을 쓸 때 화면 크기
const TIRED_H = 230;
const SHEET_H = 340; // 스프라이트 시트(아들 그림)를 쓸 때 화면 높이
const SHEET_W = Math.round((SHEET_H * 344) / 384); // 한 칸 비율 그대로
const SHEET_FOOT = 34; // 시트 칸 아래 빈 공간 (화면 픽셀)
const HALF = 110;
const TAIL_LEN = 310; // 몸 가운데에서 꼬리 끝까지
const TAIL_H = 50; // 꼬리 휘두르기 높이 (점프로 넘을 수 있음)
const FLY_H = 170; // 날아오르는 높이 (화면 위로 나가지 않게)
const PILLAR_W = 70;
const PILLAR_H = 320;
// 불기둥 그림(fx_pillar, 14장/초)은 3~5장이 솟구치는 장면. 이 3장이 피해 나는 0.45초에 걸치게
// 느리게(0.15초/장) 틀고, 피해 시작보다 2장(0.3초) 먼저 재생을 시작한다.
const PILLAR_ANIM_SCALE = 1 / (14 * 0.15); // 약 0.48배 속도
const PILLAR_LEAD = 0.3;

const TIPS = {
  breath: '불을 뿜는다! 땅을 훑는 불길은 점프로 넘어!',
  wing: '날개 바람이 밀어낸다! 앞으로 계속 걸어서 버텨! 벽 쪽에서 불기둥이 솟아!',
  tail: '꼬리가 날아와! 점프로 넘거나 대시로 통과해! 땅에 떨어진 꼬리는 때릴 수 있어!',
  fly: '날아올랐다! 불덩이 표시를 피하고, 내려앉는 빨간 칸에서 비켜!',
  pillars: '용암 갈라짐에서 불기둥이 솟아! 빛나지 않는 곳으로 옮겨!',
  tired: '날개가 축 처졌어! 지금! 날개를 때려!',
  belly: '용이 헉헉거려! 크림색 배를 {strong}(으)로 때려!',
};

// 겹치기 공격: 큰 공격을 하는 동안 같이 쓸 수 있는 작은 공격 (난이도의 bossCombo 확률)
const SIDE_ATTACKS = {
  breath: ['pillars'],
  tail: ['fireball'],
  wing: ['fireball'],
  fly: ['pillars'],
  pillars: ['fireball'],
};

// 아스트라노바X (아들이 디자인한 보스): 용암 지대의 붉은 용.
// 주로 땅에서 싸우고 가끔만 날아오른다.
// 땅에 떨어진 꼬리, 날개가 축 처졌을 때 날개를 때린다. 둘 다 부수면 크림색 배가 약점.
export class DragonBoss extends BossBase {
  constructor(scene, cfg, stage, skin = 3) {
    super(scene, cfg, stage, skin);
    this.diff = difficultyOf(cfg);
    this.hpScale *= this.diff.bossHealth;
    this.tempo *= this.diff.bossSpeed;
    const k = (this.k = cfg.dragonBoss);
    this.skinKey = skin;
    this.colors = { main: 0xc8282a, dark: 0x7a1418, armor: 0x2e2a2c, lava: 0xff7a1f, belly: 0xf0d0a0, ...(this.def.colors || {}) };
    this.leftStop = this.arenaStart + 150; // 화면 안에 몸이 다 보이게
    this.rightStop = this.arenaEnd - 150;
    this.x = this.arenaEnd - 230;
    this.bodyX = this.x;
    this.facing = -1;
    this.air = 0;
    this.lift = 0;
    this.flashT = 0;
    this.stepT = 0;
    this.tail = { lift: 0, flat: false };

    this.hazG = scene.add.graphics().setDepth(1);
    this.shadowG = scene.add.graphics().setDepth(1.5);
    this.tailG = scene.add.graphics().setDepth(3.5);
    this.windG = scene.add.graphics().setDepth(9);
    this.sprite = scene.add.sprite(this.x, this.groundY, `dragon_${skin}`).setOrigin(0.5, 1).setDepth(4).setDisplaySize(W, H);
    // art.js 에 스프라이트 시트(아들 그림)가 있으면 그 애니메이션을 쓴다. 시트에는 꼬리까지 그려져 있다.
    this.sheet = scene.anims.exists(`dragon_${skin}_anim`);
    if (this.sheet) this.sprite.play(`dragon_${skin}_anim`);
    // 불덩이 그림: 아이들이 그린 애니메이션(fx_fireball_anim)이 있으면 그걸, 없으면 동그란 도형 그림
    this.ballSheet = scene.anims.exists('fx_fireball_anim');
    this.ballPool = []; // 하늘에서 떨어지는 불덩이 그림 (다시 쓴다)
    this.sideBall = this.ballSheet ? this.makeBallSprite() : scene.add.image(0, 0, 'fireball').setDepth(8).setDisplaySize(36, 36).setVisible(false);
    // 불 효과 (겹겹이 쌓은 불꽃 알갱이, 빛 번짐, 아지랑이). 그림만 바꾸고 공격 시간, 피해, 맞는 칸은 그대로.
    this.fire = new FireFx(scene, 8.6);
    if (!this.ballSheet) scene.impact?.addGlow(this.sideBall, 0xff7a1f, 8); // WebGL 에서만 빛 번짐
    this.dt = 1 / 60;

    const hp = this.hpScale;
    this.tailPart = new BossPart('꼬리', Math.round(k.tailHealth * hp));
    this.wing = new BossPart('날개', Math.round(k.wingHealth * hp));
    this.belly = new BossPart('배', Math.round(k.bellyHealth * hp));
    this.totalMax = this.tailPart.health.max + this.wing.health.max + this.belly.health.max;
    this.bellyOpen = false;

    this.puddles = new Puddles(scene, this.hazG, { damage: k.fireDamage, color: 0xd8401c, edge: 0xffc040, name: '뜨거운 바닥', art: 'fx_puddle_fire' });
    // 불 뿜기 그림(fx_breath, 아들 그림)이 있으면 땅을 훑는 불길은 그 그림으로 그리고,
    // GroundWaves 의 세모 도형은 보이지 않는 붓(flameG)에 그리게 한다 (판정은 GroundWaves 그대로).
    this.breathSheet = scene.anims.exists('fx_breath_anim');
    this.flameG = this.breathSheet ? scene.add.graphics().setVisible(false) : this.fxG;
    this.breathPool = [];
    this.flames = new GroundWaves(scene, this.flameG, { damage: k.breathDamage, speed: k.breathSpeed, color: 0xff5a1f, light: 0xffe08a });
    this.waves = new GroundWaves(scene, this.fxG, { damage: k.landWaveDamage, speed: k.landWaveSpeed, color: 0xff8a3d, light: 0xfff0b0, art: true });
    this.balls = []; // 하늘에서 떨어지는 불덩이
    this.action = null;
    this.side = null;
    this.introSaid = false;
  }

  static makeTextures(scene, stage, skin) {
    const c = { main: 0xc8282a, dark: 0x7a1418, armor: 0x2e2a2c, lava: 0xff7a1f, belly: 0xf0d0a0, ...(stage.boss.colors || {}) };
    const crack = (g, lines) => {
      g.lineStyle(4, c.lava, 1);
      for (const [a, b, d, e] of lines) g.lineBetween(a, b, d, e);
      g.lineStyle(1.5, 0xffe08a, 1);
      for (const [a, b, d, e] of lines) g.lineBetween(a, b, d, e);
    };
    const head = (g, hx, hy, sleepy) => {
      // 뿔 (뒤로 휘어짐)
      g.fillStyle(c.dark).fillTriangle(hx + 60, hy + 8, hx + 76, hy + 18, hx + 108, hy - 30);
      g.fillStyle(c.dark).fillTriangle(hx + 44, hy + 10, hx + 58, hy + 16, hx + 80, hy - 22);
      g.fillStyle(0x1a1a1a).fillTriangle(hx + 96, hy - 18, hx + 108, hy - 30, hx + 100, hy - 10);
      // 머리와 주둥이
      g.fillStyle(c.main).fillPoints(
        [{ x: hx, y: hy + 40 }, { x: hx + 20, y: hy + 18 }, { x: hx + 60, y: hy + 8 }, { x: hx + 86, y: hy + 24 }, { x: hx + 84, y: hy + 60 }, { x: hx + 40, y: hy + 66 }, { x: hx + 4, y: hy + 56 }],
        true,
      );
      g.fillStyle(c.dark).fillRect(hx + 4, hy + 46, 50, 6);
      g.fillStyle(0xffffff);
      for (let i = 0; i < 6; i++) g.fillTriangle(hx + 6 + i * 8, hy + 46, hx + 12 + i * 8, hy + 46, hx + 9 + i * 8, hy + 55);
      // 눈
      if (sleepy) g.lineStyle(3, 0x111111).lineBetween(hx + 44, hy + 30, hx + 58, hy + 28);
      else {
        g.fillStyle(0xffe04a).fillEllipse(hx + 52, hy + 28, 16, 10);
        g.fillStyle(0x111111).fillRect(hx + 50, hy + 23, 4, 10);
      }
      g.fillStyle(0x111111).fillCircle(hx + 8, hy + 34, 2.5);
    };
    // 서 있는 용 (왼쪽을 보는 모습, 날개를 펼침)
    make(scene, `dragon_${skin}`, W, H, (g) => {
      // 뒤쪽 날개
      g.fillStyle(c.dark).fillPoints(
        [{ x: 175, y: 100 }, { x: 215, y: 12 }, { x: 255, y: 0 }, { x: 310, y: 36 }, { x: 318, y: 104 }, { x: 288, y: 118 }, { x: 262, y: 100 }, { x: 236, y: 128 }, { x: 204, y: 112 }],
        true,
      );
      g.fillStyle(c.main).fillPoints([{ x: 190, y: 98 }, { x: 222, y: 26 }, { x: 255, y: 14 }, { x: 300, y: 44 }, { x: 290, y: 104 }, { x: 262, y: 90 }, { x: 236, y: 114 }], true);
      g.lineStyle(4, c.dark).lineBetween(190, 98, 255, 4).lineBetween(255, 4, 290, 110).lineBetween(255, 4, 236, 124).lineBetween(255, 4, 312, 100);
      // 뒷다리
      g.fillStyle(c.main).fillRoundedRect(190, 160, 56, 70, 22).fillRoundedRect(205, 220, 30, 36, 10);
      g.fillStyle(c.armor).fillRoundedRect(196, 166, 44, 40, 14);
      crack(g, [[204, 176, 220, 188], [220, 188, 232, 178]]);
      g.fillStyle(0x1a1a1a).fillTriangle(200, 256, 210, 248, 196, 260).fillTriangle(232, 256, 240, 248, 244, 260);
      // 몸통
      g.fillStyle(c.main).fillEllipse(165, 150, 170, 120);
      // 등 가시
      g.fillStyle(c.armor);
      for (let i = 0; i < 6; i++) g.fillTriangle(140 + i * 18, 96 - (i % 2) * 2, 156 + i * 18, 98, 150 + i * 18, 76 - (i % 2) * 6);
      // 크림색 배
      g.fillStyle(c.belly).fillEllipse(128, 168, 86, 104);
      g.lineStyle(2, 0xc9a070);
      for (let y = 130; y < 215; y += 14) g.lineBetween(96, y, 160, y + 2);
      crack(g, [[180, 120, 200, 145], [200, 145, 190, 170], [150, 120, 165, 112]]);
      // 어깨 갑옷
      g.fillStyle(c.armor).fillRoundedRect(120, 104, 46, 34, 12);
      crack(g, [[130, 114, 146, 126]]);
      // 앞발
      g.fillStyle(c.main).fillRoundedRect(96, 176, 30, 70, 12);
      g.fillStyle(0x1a1a1a).fillTriangle(90, 252, 100, 244, 88, 258).fillTriangle(104, 254, 112, 244, 108, 260).fillTriangle(118, 254, 126, 244, 126, 260);
      // 목
      g.fillStyle(c.main).fillPoints([{ x: 150, y: 110 }, { x: 115, y: 70 }, { x: 80, y: 66 }, { x: 78, y: 100 }, { x: 110, y: 120 }, { x: 128, y: 150 }], true);
      g.fillStyle(c.belly).fillPoints([{ x: 80, y: 96 }, { x: 108, y: 118 }, { x: 122, y: 146 }, { x: 108, y: 140 }, { x: 84, y: 112 }], true);
      head(g, 4, 44, false);
    });

    // 지쳐서 날개를 늘어뜨린 용 (머리가 낮음)
    make(scene, `dragon_tired_${skin}`, W, TH, (g) => {
      // 늘어진 날개 (땅까지 닿음)
      g.fillStyle(c.dark).fillPoints([{ x: 180, y: 70 }, { x: 250, y: 60 }, { x: 312, y: 120 }, { x: 318, y: 198 }, { x: 280, y: 186 }, { x: 250, y: 198 }, { x: 220, y: 182 }, { x: 196, y: 150 }], true);
      g.fillStyle(c.main).fillPoints([{ x: 196, y: 80 }, { x: 250, y: 74 }, { x: 300, y: 124 }, { x: 302, y: 184 }, { x: 270, y: 176 }, { x: 236, y: 184 }, { x: 206, y: 146 }], true);
      g.lineStyle(4, c.dark).lineBetween(196, 80, 300, 190).lineBetween(220, 76, 250, 196);
      g.fillStyle(c.main).fillRoundedRect(186, 130, 56, 66, 22);
      g.fillStyle(c.armor).fillRoundedRect(192, 136, 44, 36, 14);
      g.fillStyle(c.main).fillEllipse(160, 128, 170, 100);
      g.fillStyle(c.armor);
      for (let i = 0; i < 6; i++) g.fillTriangle(136 + i * 18, 84, 152 + i * 18, 86, 146 + i * 18, 66 - (i % 2) * 5);
      g.fillStyle(c.belly).fillEllipse(124, 146, 84, 80);
      g.lineStyle(2, 0xc9a070);
      for (let y = 118; y < 182; y += 14) g.lineBetween(92, y, 156, y + 2);
      crack(g, [[176, 102, 194, 126]]);
      g.fillStyle(c.main).fillRoundedRect(92, 150, 30, 48, 12);
      g.fillStyle(c.main).fillPoints([{ x: 130, y: 110 }, { x: 96, y: 128 }, { x: 80, y: 150 }, { x: 98, y: 160 }, { x: 128, y: 140 }], true);
      head(g, 0, 118, true);
    });

    make(scene, 'fireball', 36, 36, (g) => {
      g.fillStyle(0xd8401c).fillCircle(18, 18, 18);
      g.fillStyle(0xff9a1f).fillCircle(18, 18, 12);
      g.fillStyle(0xffe08a).fillCircle(15, 15, 6);
    });
  }

  // ---------- 상태 도우미 ----------

  get tired() {
    return this.action?.type === 'tired';
  }

  get mouth() {
    return { x: this.x + this.facing * 150, y: this.groundY - 180 - this.air - this.lift };
  }

  wingRect() {
    // 늘어진 날개 끝 (몸 뒤쪽 땅)
    const cx = this.x - this.facing * 110;
    return new Rect(cx - 55, this.groundY - 90, 110, 90);
  }

  bellyRect() {
    const cx = this.x + this.facing * 32;
    return this.tired ? new Rect(cx - 48, this.groundY - 100, 96, 80) : new Rect(cx - 48, this.groundY - 140, 96, 110);
  }

  tailPoints() {
    const f = this.facing;
    const base = { x: this.x - f * 80, y: this.groundY - 70 - this.air };
    const lift = this.tail.lift;
    const len = this.tailPart.alive ? TAIL_LEN : 170; // 부서지면 짧아진다
    const tip = { x: this.x - f * len, y: this.groundY - 14 - this.air - lift };
    const mid = { x: (base.x + tip.x) / 2, y: Math.max(base.y, tip.y) + 10 - lift * 0.4 };
    return { base, mid, tip };
  }

  tailRect() {
    const { base, tip } = this.tailPoints();
    const x0 = Math.min(base.x, tip.x);
    return new Rect(x0, this.groundY - 40, Math.abs(tip.x - base.x), 40);
  }

  bodyRect() {
    const h = this.tired ? TH : H;
    return new Rect(this.x - 130, this.groundY - this.air - h, 260, h);
  }

  // 아이들이 그린 불덩이 한 장 (머리가 왼쪽, 꼬리가 오른쪽). 기준점은 머리 가운데.
  // 머리 지름(약 40px)이 맞는 칸 크기와 비슷하게, 꼬리는 바깥으로 나와도 된다.
  makeBallSprite() {
    return this.scene.add
      .sprite(0, 0, 'fx_fireball')
      .play('fx_fireball_anim')
      .setOrigin(0.25, 0.38)
      .setScale(0.72)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8.4)
      .setVisible(false);
  }

  // 불덩이 그림을 움직이는 쪽으로 돌려서 놓는다 (그림의 머리가 왼쪽이라 진행 각도 + 180도)
  aimBall(img, x, y, vx, vy) {
    img.setVisible(true).setPosition(x, y);
    if (this.ballSheet && (vx || vy)) img.setRotation(Math.atan2(vy, vx) + Math.PI);
  }

  // 불기둥 그림들을 미리 재생 시작 (피해 시작 PILLAR_LEAD 초 전에 부른다)
  startPillarSprites(xs) {
    for (const x of xs) this.fire.pillarSprite(x, this.groundY, PILLAR_H, PILLAR_ANIM_SCALE);
  }

  // 땅을 훑는 불길 그림: 머리(둥근 불꽃)가 판정 자리, 꼬리는 지나온 쪽으로.
  // 그림은 머리가 왼쪽이라 오른쪽으로 달리면 뒤집는다. 높이는 판정 높이(WAVE_H)와 맞춘다.
  drawBreathSprites() {
    const used = new Set();
    for (const w of this.flames.list) {
      if (!w.img) {
        w.img = this.breathPool.pop() || this.scene.add.sprite(0, 0, 'fx_breath').play('fx_breath_anim').setOrigin(0.08, 1).setDepth(8.4);
        w.img.anims.setProgress(Math.random());
      }
      const s = Math.max(0.3, Math.min(1, w.left / 60)); // 끝에 가면 작아진다 (GroundWaves 와 같은 계산)
      const frameH = w.img.frame.height || 152;
      const k = (WAVE_H * 1.25 * s) / frameH; // 그림 칸 높이의 약 80%가 불꽃이라 판정 높이와 비슷하게 보인다
      w.img.setVisible(true).setScale(k).setFlipX(w.dir > 0).setOrigin(w.dir > 0 ? 0.92 : 0.08, 1).setPosition(w.x, this.groundY + 2);
      used.add(w.img);
    }
    for (const img of this.breathLive || []) {
      if (!used.has(img)) {
        img.setVisible(false);
        this.breathPool.push(img);
      }
    }
    this.breathLive = used;
  }

  // 발밑 그림자 (src/fx/shadows.js 가 그린다). 날아오르면 작아진다.
  shadowSpots() {
    if (this.state === 'dead') return [];
    return [{ x: this.x, feetY: this.groundY - this.air, w: 250 }];
  }

  facePlayer() {
    const p = this.target;
    if (Math.abs(p.x - this.x) > 30) this.facing = p.x < this.x ? -1 : 1;
  }

  label(i, text, x, y, size, color) {
    super.label(i, text, Phaser.Math.Clamp(x, this.arenaStart + 160, this.arenaEnd - 160), Math.max(90, y), size, color);
  }

  hideLabels() {
    for (const l of this.labels) l?.setVisible(false);
  }

  // 볼트 레이저가 노릴 자리 (때릴 수 있는 부위만)
  robotTargets() {
    if (this.state !== 'fight' || this.defeated) return [];
    const mid = (r) => ({ x: r.centerX, y: r.centerY });
    const a = this.action;
    if (a?.type === 'tail' && a.phase === 'stuck' && this.tailPart.alive) return [mid(this.tailRect())];
    if (this.tired && this.bellyOpen) return [mid(this.bellyRect())];
    if (this.tired && this.wing.alive) return [mid(this.wingRect())];
    return [];
  }

  hudParts() {
    return [
      this.tailPart.hud('part'),
      this.wing.hud('part'),
      { label: this.bellyOpen ? '배 (약점!)' : '배 (잠김)', ratio: this.belly.health.ratio, kind: 'core', locked: !this.bellyOpen },
    ];
  }

  totalRatio() {
    return [this.tailPart, this.wing, this.belly].reduce((s, p) => s + p.health.current, 0) / this.totalMax;
  }

  receiveUltimate(damage) {
    if (this.state !== 'fight' || this.defeated) return false;
    if (this.tailPart.alive) this.hitPart(this.tailPart, damage, this.tailRect(), { ult: true });
    else if (this.wing.alive) this.hitPart(this.wing, damage, this.wingRect(), { ult: true });
    else this.hitBelly(damage, { ult: true });
    return true;
  }

  // ---------- 흐름 ----------

  update(dt) {
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.state === 'dead') return;
    if (this.state === 'dormant') {
      this.draw();
      return;
    }
    if (!this.tickState(dt)) {
      if (!this.introSaid) {
        this.introSaid = true;
        if (this.def.intro) this.scene.robot.say(this.def.intro, true);
      }
      this.facePlayer();
      this.draw();
      return;
    }

    this.dt = dt;
    this.clearFx();
    this.fire.begin();
    if (this.breathSheet) this.flameG.clear();
    this.shadowG.clear();
    this.windG.clear();
    this.puddles.update(dt, this.groundY, this.t);
    this.flames.update(dt, this.groundY, this.arenaStart, this.arenaEnd);
    this.waves.update(dt, this.groundY, this.arenaStart, this.arenaEnd);

    if (!this.action) {
      this.timer -= dt;
      this.walk(dt);
      if (this.timer <= 0 && this.scene.anyAlive) this.startAction();
    } else if (!this.checkFeint()) {
      const a = this.action;
      a.t += dt;
      if (a.type === 'breath') this.runBreath(dt);
      else if (a.type === 'wing') this.runWing(dt);
      else if (a.type === 'tail') this.runTail(dt);
      else if (a.type === 'fly') this.runFly(dt);
      else if (a.type === 'pillars') this.runPillars(dt);
      else if (a.type === 'signature') this.runSignature(dt);
      else if (a.type === 'tired') this.runTired(dt);
    }
    if (this.side) this.runSide(dt);
    this.updateBalls(dt);
    this.drawFire(dt);
    this.fire.end();
    this.draw();
  }

  // 땅을 달리는 불길, 착지 충격파, 뜨거운 바닥, 화난 몸의 불씨
  drawFire(dt) {
    const gy = this.groundY;
    if (this.breathSheet) {
      // 불길 그림이 잘 보이게 알갱이는 불씨만 조금
      this.drawBreathSprites();
      this.flames.list.forEach((w, i) => this.fire.ember.emitParticleAt(w.x, gy - 24, this.fire.n(`flE${i}`, 24, dt, 2)));
    } else {
      this.flames.list.forEach((w, i) => this.fire.wall(w.x, gy, 64 * Math.max(0.3, Math.min(1, w.left / 60)), dt, this.t, `fl${i}`));
    }
    this.waves.list.forEach((w, i) => this.fire.wall(w.x, gy, 44 * Math.max(0.3, Math.min(1, w.left / 60)), dt, this.t, `wv${i}`));
    this.puddles.list.forEach((p, i) => this.fire.lick(p.x, gy, p.w, dt, `pd${i}`));
    if (this.raging) this.fire.aura(this.x, gy - this.air, 220, 200, dt);
  }

  walk(dt) {
    const p = this.target;
    this.facePlayer();
    if (this.tail.lift > 0) this.tail.lift = Math.max(0, this.tail.lift - 300 * dt);
    const side = this.x >= p.x ? 1 : -1;
    let tx = p.x + side * this.k.keepDistance;
    if (tx > this.rightStop || tx < this.leftStop) tx = p.x - side * this.k.keepDistance;
    tx = Phaser.Math.Clamp(tx, this.leftStop, this.rightStop);
    const dx = tx - this.x;
    if (Math.abs(dx) < 8) return;
    const sp = this.k.walkSpeed * (this.raging ? 1.4 : 1);
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
    this.stepT -= dt;
    if (this.stepT <= 0) {
      this.stepT = 0.5;
      this.scene.dustAt(this.x + Math.sign(dx) * 40, this.groundY, 3);
    }
  }

  draw() {
    const s = this.sprite;
    const tired = this.tired;
    const sheetKey = `dragon_${this.skinKey}`;
    const tiredKey = `dragon_tired_${this.skinKey}`;
    const tiredArt = this.sheet && tired && hasArt(this.scene, tiredKey); // 날개를 늘어뜨린 그림
    if (tiredArt) {
      if (s.texture.key !== tiredKey) s.anims.stop();
      s.setTexture(tiredKey).setDisplaySize(TIRED_W, TIRED_H);
    } else if (this.sheet) {
      if (s.texture.key !== sheetKey) s.setTexture(sheetKey).play(`${sheetKey}_anim`);
      // 시트 한 칸 비율(344x384)을 지켜서 그린다. 지치면 날갯짓이 느려지고 살짝 웅크린다.
      s.setDisplaySize(SHEET_W, tired ? SHEET_H * 0.85 : SHEET_H);
      s.anims.timeScale = tired ? 0.4 : this.raging ? 1.5 : 1;
    } else {
      s.setTexture(tired ? `dragon_tired_${this.skinKey}` : `dragon_${this.skinKey}`);
      s.setDisplaySize(W, tired ? TH : H);
    }
    // 시트 그림은 칸 아래에 빈 공간이 있어서 그만큼 내려 발이 땅에 닿게 한다
    s.setPosition(this.x, this.groundY - this.air - this.lift + (this.sheet && !tiredArt ? SHEET_FOOT : 0));
    s.setFlipX(this.facing > 0);
    this.bodyX = this.x;
    // 분노하면 몸의 용암 무늬가 밝게 빛난다
    if (this.flashT > 0) s.setTintFill(0xffffff);
    else if (this.raging) s.setTint(Math.floor(this.t * 6) % 2 === 0 ? 0xffc080 : 0xff9a60);
    else s.clearTint();

    // 꼬리
    const g = this.tailG.clear();
    const { base, mid, tip } = this.tailPoints();
    // 시트 그림에는 꼬리가 있으니, 꼬리 휘두르기 공격 중에만 휘두르는 꼬리를 따로 그린다
    const drawTail = !this.sheet || this.action?.type === 'tail';
    const tailFx = this.flashTail > 0 ? { tintFill: 0xffffff } : {};
    if (drawTail && stampLimb(this.scene, `dragon_tail_${this.skinKey}`, base, mid, 40, tailFx) && stampLimb(this.scene, `dragon_tailtip_${this.skinKey}`, mid, tip, 40, { ...tailFx, overlap: 18 })) {
      // 꼬리 그림 두 토막 (부서지면 짧아진 길이 그대로)
    } else if (drawTail) {
      const col = this.flashTail > 0 ? 0xffffff : this.colors.main;
      g.lineStyle(30, this.colors.dark, 1).lineBetween(base.x, base.y, mid.x, mid.y);
      g.lineStyle(20, this.colors.dark, 1).lineBetween(mid.x, mid.y, tip.x, tip.y);
      g.lineStyle(24, col, 1).lineBetween(base.x, base.y, mid.x, mid.y);
      g.lineStyle(14, col, 1).lineBetween(mid.x, mid.y, tip.x, tip.y);
      g.fillStyle(this.colors.armor, 1).fillTriangle(tip.x, tip.y - 12, tip.x, tip.y + 12, tip.x - this.facing * 26, tip.y);
      if (this.raging) g.lineStyle(3, this.colors.lava, 1).lineBetween(base.x, base.y - 4, tip.x, tip.y - 2);
    }
    this.flashTail = Math.max(0, (this.flashTail || 0) - 1 / 60);
  }

  startAction() {
    let type = chooseDragonAttack(this.def.phases, this.tailPart.alive, this.wing.alive, this.lastType);
    this.attackCount = (this.attackCount || 0) + 1;
    if (signatureDue(this.def.phases, this.sigUsed, this.attackCount)) type = 'signature'; // 변종은 전용 공격을 꼭 보여 준다
    if (type === 'signature') this.sigUsed = true;
    this.lastType = type;
    const k = this.k;
    const a = { type, phase: 'aim', t: 0 };
    this.prepareAttack(a, { breath: k.breathWarningTime, tail: k.tailWarningTime });
    this.facePlayer();
    const p = this.target;
    if (type === 'breath') {
      a.count = varyCount(this.raging ? 3 : 2, this.variety, Math.random, 2);
      a.spawned = 0;
    } else if (type === 'wing') {
      a.pillars = gustPillarXs(p.x, this.x, this.arenaStart, this.arenaEnd);
      a.push = gustVelocity(p.x, this.x, k.gustStrength);
    } else if (type === 'tail') {
      this.facing = p.x < this.x ? 1 : -1; // 등을 돌려 꼬리를 플레이어 쪽으로
      a.hits = new Set();
    } else if (type === 'fly') {
      a.phase = 'takeoff';
      a.lx = flyLandingX(this.x, this.leftStop, this.rightStop);
      a.x0 = this.x;
      const count = varyCount(Math.max(1, Math.round(k.bombCount + (this.raging ? 1 : 0))), this.variety);
      a.bombs = spreadTargets(p.x, count, this.arenaStart + 60, this.arenaEnd - 60).map((x) => ({ x, done: false }));
    } else if (type === 'pillars') {
      const shaped = Math.random() < this.variety.shape; // 줄을 밀고, 절반은 둘째 묶음부터 터뜨린다
      const offset = shaped ? (Math.random() - 0.5) * k.pillarSpacing : 0;
      const swap = shaped && Math.random() < 0.5;
      const [w0, w1] = pillarWaves(this.arenaStart + 20, this.arenaEnd - 20, k.pillarSpacing, offset);
      const first = swap ? w1 : w0;
      const second = swap ? w0 : w1;
      const list = this.raging ? [first, second, first] : [first, second];
      const warn = k.pillarWarningTime * this.speed;
      const step = warn + k.pillarWaveGap;
      a.waves = list.map((xs, i) => ({ xs, start: i * step, warn, hits: new Set(), burst: false }));
      a.end = (list.length - 1) * step + warn + 0.5;
    } else if (type === 'signature') {
      this.startSignature();
    }
    this.action = a;
    this.scene.sfxPlay('warn');
    this.tip(type, TIPS[type]);
    if (!this.side) {
      const sideType = pickSideAttack(SIDE_ATTACKS, type, this.diff.bossCombo);
      if (sideType) this.side = { type: sideType, t: 0, phase: 'wait', delay: 0.5 * this.speed, hits: new Set() };
    }
  }

  // 공격이 끝난 뒤: 배가 드러났으면 헉헉거리며 쉰다
  afterAttack() {
    this.lift = 0;
    if (this.bellyOpen) this.startTired(this.k.restTime);
    else this.endAction();
  }

  // 전용 공격도 다른 공격처럼, 배가 드러났으면 끝난 뒤 헉헉거린다
  runSignature(dt) {
    if (this.sig?.update(dt)) {
      this.stopSignature();
      this.afterAttack();
    }
  }

  startTired(dur) {
    this.lift = 0;
    this.air = 0;
    this.tail.lift = 0;
    this.action = { type: 'tired', t: 0, dur };
    this.scene.dustAt(this.x, this.groundY, 12);
    if (this.bellyOpen) this.tip('belly', TIPS.belly);
    else if (this.wing.alive) this.tip('tired', TIPS.tired);
  }

  // 속임 동작: 들어 올린 몸을 내린다 (꼬리는 저절로 내려옴)
  onFeintCancel() {
    this.lift = 0;
    this.air = 0;
  }

  endAction() {
    this.action = null;
    this.lift = 0;
    this.air = 0;
    this.timer = this.restTime(this.k.idleTime) * this.speed;
  }

  // ---------- 불 뿜기 (땅을 훑는 불길, 점프로 넘기) ----------

  runBreath(_dt) {
    const a = this.action;
    const k = this.k;
    const m = this.speed;
    const mo = this.mouth;
    const f = this.facing;
    const startX = this.x + f * 160;
    if (a.phase === 'aim') {
      const dur = k.breathWarningTime * m * a.late;
      const q = Math.min(1, a.t / dur);
      this.fxG.fillStyle(0xff9a1f, 0.4 + 0.4 * Math.sin(this.t * 25)).fillCircle(mo.x, mo.y + 20, 10 + 12 * q);
      const wall = f < 0 ? this.arenaStart : this.arenaEnd;
      // 입에 불이 모이고, 불길이 지나갈 바닥이 깜빡이며 달아오른다
      this.fire.glow(mo.x, mo.y + 20, 26 + 54 * q, 0xffa040, 0.45 + 0.45 * q);
      this.fire.core.emitParticleAt(mo.x, mo.y + 20, this.fire.n('breathAim', 20 + 60 * q, this.dt, 3));
      for (let x = startX; (x - wall) * f < 0; x += f * 130) this.fire.warnGlow(x, this.groundY - 10, 44, this.t, q, 0xff3010);
      warnBox(this.warn, Math.min(startX, wall), this.groundY - 44, Math.abs(wall - startX), 44, this.t);
      this.label(0, '불 뿜기! 점프로 넘어!', (startX + wall) / 2, this.groundY - 130, 24);
      if (a.t >= dur) {
        a.phase = 'fire';
        a.t = 0;
        a.next = 0.35; // 불줄기가 먼저 땅에 닿는 게 보이고, 그다음 불길이 달린다
      }
      return;
    }
    // 입에서 땅으로 불줄기
    if (a.spawned < a.count || a.t < a.next) {
      const reach = Math.hypot(startX - mo.x, this.groundY - mo.y);
      const lean = Math.atan2(this.groundY - mo.y, startX - mo.x) - Math.PI / 2;
      if (!stamp(this.scene, 'fx_flame_stream', mo.x, mo.y + 8, 96, reach * 1.05, { rotation: lean, flipX: Math.floor(this.t * 20) % 2 === 0 })) {
        this.fxG.fillStyle(0xff5a1f, 0.6).fillTriangle(mo.x, mo.y + 14, startX - 20, this.groundY, startX + f * 40, this.groundY);
        this.fxG.fillStyle(0xffe08a, 0.6).fillTriangle(mo.x, mo.y + 18, startX - 8, this.groundY, startX + f * 16, this.groundY);
      }
      this.fire.jet(mo.x, mo.y + 16, startX + f * 10, this.groundY - 6, this.dt, this.t);
    }
    if (a.spawned < a.count && a.t >= a.next) {
      a.spawned += 1;
      a.next = a.t + Math.max(0.95, k.breathGap * m); // 점프 한 번(약 0.9초)이 끝난 뒤에 다음 불길
      this.flames.spawn(startX, f, 1000);
      this.fire.burst(startX, this.groundY - 12, 1.2);
      this.scene.sfxPlay('fire');
    }
    if (a.spawned >= a.count && this.flames.list.length === 0) this.afterAttack();
  }

  // ---------- 날개 바람 (밀어내기 + 벽 쪽 불기둥) ----------

  runWing(dt) {
    const a = this.action;
    const k = this.k;
    const m = this.speed;
    const markPillars = (q) => {
      for (const x of a.pillars) {
        this.fire.warnGlow(x, this.groundY - 6, 46, this.t, q);
        this.fire.ember.emitParticleAt(x + Phaser.Math.Between(-24, 24), this.groundY - 4, this.fire.n(`wingE${x}`, 10 + 20 * q, dt, 2));
        this.warn.fillStyle(0xff7a1f, 0.25 + 0.45 * q).fillEllipse(x, this.groundY, PILLAR_W * (0.6 + 0.6 * q), 18);
        this.warn.lineStyle(3, 0xffd23f, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY, PILLAR_W + 14, 22);
      }
    };
    if (a.phase === 'aim') {
      const dur = k.wingWarningTime * m * a.late;
      this.lift = Math.abs(Math.sin(this.t * 10)) * 10;
      markPillars(a.t / dur);
      this.label(0, '날개 바람! 앞으로 걸어서 버텨!', this.x, this.groundY - H - 40, 22);
      if (a.t >= dur) {
        a.phase = 'gust';
        a.t = 0;
        this.scene.sfxPlay('roar');
      }
      return;
    }
    if (a.phase === 'gust') {
      this.lift = Math.abs(Math.sin(this.t * 14)) * 16;
      markPillars(1);
      // 함께하기: 바람은 둘 다 밀어낸다 (각자 용에게서 먼 쪽으로)
      for (const p of this.scene.players) {
        const push = gustVelocity(p.x, this.x, k.gustStrength);
        if (!p.dead && !p.dashing) p.x = Phaser.Math.Clamp(p.x + push * dt, this.arenaStart + 20, this.arenaEnd - 20);
      }
      // 바람 줄
      for (let i = 0; i < 6; i++) {
        const y = this.groundY - 30 - i * 40;
        const off = ((this.t * 600 + i * 90) % 500) * Math.sign(a.push);
        const x = this.x + Math.sign(a.push) * 140 + off;
        this.windG.lineStyle(3, 0xffffff, 0.5).lineBetween(x, y, x + Math.sign(a.push) * 50, y);
      }
      // 날리는 먼지와 불씨
      this.fire.gust(this.x + Math.sign(a.push) * 130, this.groundY - 250, this.groundY - 6, Math.sign(a.push), dt);
      if (Math.random() < 0.3) this.scene.dustAt(this.x + Math.sign(a.push) * 160, this.groundY, 1);
      this.label(0, '버텨! 벽 쪽에 불기둥!', this.x, this.groundY - H - 40, 22);
      if (!a.sprites && a.t >= k.gustTime - PILLAR_LEAD) {
        a.sprites = true;
        this.startPillarSprites(a.pillars);
      }
      if (a.t >= k.gustTime) {
        a.phase = 'burst';
        a.t = 0;
        this.scene.sfxPlay('fire');
        this.scene.shake(0.008, 160);
        for (const x of a.pillars) this.fire.burst(x, this.groundY - 10, 1.4);
        this.scene.impact?.zoomPunch(0.018, 60, 220);
      }
      return;
    }
    if (a.phase === 'burst') {
      this.lift = 0;
      for (const x of a.pillars) this.drawPillar(x, Math.min(1, a.t / 0.08), a);
      if (a.t >= 0.45) {
        // 날개를 너무 세게 쳐서 축 처진다 (날개를 때릴 기회)
        if (this.wing.alive || this.bellyOpen) this.startTired(k.wingDownTime);
        else this.endAction();
      }
    }
  }

  drawPillar(x, grow, holder) {
    const h = PILLAR_H * grow;
    const wob = Math.sin(this.t * 40 + x) * 6;
    const sheet = this.fire.hasPillar; // 아이들 불기둥 그림이 몸통을 그린다
    if (!sheet) {
      this.fxG.fillStyle(0xff5a1f, 0.6).fillRect(x - PILLAR_W / 2 - wob / 2, this.groundY - h, PILLAR_W + wob, h);
      this.fxG.fillStyle(0xffe08a, 0.65).fillRect(x - PILLAR_W / 4, this.groundY - h, PILLAR_W / 2, h);
    }
    this.fire.column(x, this.groundY, h, PILLAR_W, this.dt, this.t, `col${Math.round(x)}`, sheet);
    holder.hits ??= new Set(); // 한 불기둥 묶음은 한 사람을 한 번만 때린다
    this.hurtPlayer(new Rect(x - PILLAR_W / 2 + 6, this.groundY - h, PILLAR_W - 12, h), this.k.pillarDamage, x, 300, holder.hits);
  }

  // ---------- 꼬리 휘두르기 (땅에 떨어진 꼬리는 때릴 기회) ----------

  runTail(dt) {
    const a = this.action;
    const k = this.k;
    const m = this.speed;
    const f = this.facing;
    const reach0 = this.x - f * 70;
    const reach1 = this.x - f * ((this.tailPart.alive ? TAIL_LEN : 170) + 30);
    if (a.phase === 'aim') {
      const dur = k.tailWarningTime * m * a.late;
      this.tail.lift = 140 * Math.min(1, a.t / (dur * 0.6));
      // 꼬리 끝이 빨갛게 달아오른다
      const tp = this.tailPoints().tip;
      this.fire.warnGlow(tp.x, tp.y, 40, this.t, Math.min(1, a.t / dur), 0xff3010);
      warnBox(this.warn, Math.min(reach0, reach1), this.groundY - TAIL_H - 10, Math.abs(reach1 - reach0), TAIL_H + 10, this.t);
      this.label(0, '꼬리! 점프나 대시!', (reach0 + reach1) / 2, this.groundY - 160, 22);
      if (a.t >= dur) {
        a.phase = 'sweep';
        a.t = 0;
        this.scene.sfxPlay('dash');
      }
      return;
    }
    if (a.phase === 'sweep') {
      this.tail.lift = Math.max(0, 140 * (1 - a.t / 0.12));
      // 휘두른 자리에 남는 바람 자국
      const fade = 1 - Math.min(1, a.t / 0.18);
      const swipe = stamp(this.scene, 'fx_slash', (reach0 + reach1) / 2, this.groundY - 26, Math.abs(reach1 - reach0), 80, { alpha: fade, rotation: Math.PI / 2, flipY: reach1 < reach0 });
      for (let i = 0; i < 3 && !swipe; i++) {
        const y = this.groundY - 14 - i * 14;
        this.fxG.lineStyle(10 - i * 3, 0xfff0d0, 0.45 * fade).lineBetween(reach0, y, reach1 + f * i * 20, y + 4);
      }
      this.fire.gust(reach1, this.groundY - 40, this.groundY - 6, -f, dt);
      // 맞거나 피한 사람은 다시 맞지 않는다
      this.hurtPlayer(new Rect(Math.min(reach0, reach1), this.groundY - TAIL_H, Math.abs(reach1 - reach0), TAIL_H), k.tailDamage, this.x, 380, a.hits);
      if (a.t >= 0.18) {
        a.phase = 'stuck';
        a.t = 0;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.01, 160);
        this.scene.dustAt(this.x - f * 220, this.groundY, 12);
        // 꼬리가 땅을 쾅: 멈칫 + 돌 부스러기 + 충격 고리
        this.scene.impact?.bossSlam(0.8);
        this.scene.sparks.explode(14, this.x - f * 220, this.groundY - 10);
        ring(this.scene, this.x - f * 220, this.groundY - 8, 0xffc080, 110, 320, 6);
      }
      return;
    }
    if (a.phase === 'stuck') {
      this.tail.lift = 0;
      const r = this.tailRect();
      if (this.tailPart.alive) {
        if (Math.floor(this.t * 8) % 2 === 0) this.warn.lineStyle(4, 0xfff3a0, 1).strokeRect(r.x, r.y, r.width, r.height);
        this.label(5, '꼬리가 땅에! 지금 때려!', r.centerX, this.groundY - 90, 20, '#ffd23f');
      }
      if (a.t >= k.tailStuckTime) this.afterAttack();
    }
  }

  // ---------- 날아올라 불 폭격 뒤 내려앉기 ----------

  runFly(dt) {
    const a = this.action;
    const k = this.k;
    const m = this.speed;
    for (const b of a.bombs) {
      if (b.done) continue;
      this.warn.fillStyle(0x000000, 0.3).fillEllipse(b.x, this.groundY, 70, 14);
      this.fire.warnGlow(b.x, this.groundY - 6, 40, this.t, 1, 0xff3020);
      this.warn.lineStyle(3, 0xff4444, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeCircle(b.x, this.groundY - 30, 40);
    }
    if (a.phase !== 'land' || a.t < 0.01) warnBox(this.warn, a.lx - HALF, this.groundY - 150, HALF * 2, 150, this.t);
    if (a.phase !== 'takeoff') this.fire.warnGlow(a.lx, this.groundY - 10, HALF, this.t, 0.6, 0xff2010);
    if (a.phase === 'takeoff') {
      const dur = k.takeoffTime * m;
      this.lift = Math.abs(Math.sin(this.t * 12)) * 12;
      this.fire.gust(this.x - 120, this.groundY - 60, this.groundY - 4, -1, dt);
      this.fire.gust(this.x + 120, this.groundY - 60, this.groundY - 4, 1, dt);
      this.label(0, '날아오른다!', this.x, this.groundY - H - 40, 24);
      if (a.t >= dur) {
        a.phase = 'rise';
        a.t = 0;
        this.lift = 0;
        this.scene.sfxPlay('roar');
        this.scene.dustAt(this.x, this.groundY, 16);
      }
      return;
    }
    if (a.phase === 'rise') {
      this.air = FLY_H * Phaser.Math.Easing.Cubic.Out(Math.min(1, a.t / 0.5));
      if (a.t >= 0.5) {
        a.phase = 'cross';
        a.t = 0;
        this.facing = a.lx < this.x ? -1 : 1;
      }
      return;
    }
    if (a.phase === 'cross') {
      const dur = k.flyCrossTime * m;
      const q = Math.min(1, a.t / dur);
      this.x = lerp(a.x0, a.lx, q);
      this.air = FLY_H + Math.sin(this.t * 8) * 10;
      this.label(0, '불덩이 조심! 빨간 칸에 내려앉아!', (this.arenaStart + this.arenaEnd) / 2, 110, 22);
      for (const b of a.bombs) {
        if (!b.done && (this.x - b.x) * this.facing >= 0) {
          b.done = true;
          this.balls.push({ x: b.x, y: this.groundY - this.air - 120, vy: 200 });
          this.scene.sfxPlay('fire');
        }
      }
      if (q >= 1) {
        a.phase = 'land';
        a.t = 0;
        a.fromAir = this.air;
      }
      return;
    }
    if (a.phase === 'land') {
      const q = Math.min(1, a.t / 0.3);
      this.air = a.fromAir * (1 - q * q);
      warnBox(this.warn, a.lx - HALF, this.groundY - 150, HALF * 2, 150, this.t);
      if (q >= 1) {
        this.air = 0;
        this.scene.sfxPlay('slam');
        // 쿵! 위아래로 흔들리고 잠깐 멈칫, 불길이 터진다
        if (this.scene.impact) this.scene.impact.bossSlam(1.4, true);
        else this.scene.shake(0.016, 300);
        this.scene.dustAt(this.x, this.groundY, 20);
        this.fire.burst(this.x, this.groundY - 14, 2.4);
        this.fire.explosion(this.x, this.groundY + 6, 1.15); // 아이들 폭발 그림 (있을 때만)
        ring(this.scene, this.x, this.groundY - 10, 0xffb040, 240, 420, 8);
        ring(this.scene, this.x, this.groundY - 10, 0xfff0c0, 140, 300, 4);
        this.hurtPlayer(new Rect(this.x - HALF, this.groundY - 150, HALF * 2, 150), k.landDamage, this.x, 380);
        this.waves.spawn(this.x - HALF, -1, k.landWaveDistance);
        this.waves.spawn(this.x + HALF, 1, k.landWaveDistance);
        this.facePlayer();
        if (this.wing.alive || this.bellyOpen) this.startTired(k.wingDownTime);
        else this.endAction();
      }
    }
  }

  updateBalls(dt) {
    this.balls.forEach((b, i) => {
      b.vy += 1400 * dt;
      b.y += b.vy * dt;
      this.fire.trail(b.x, b.y - 8, dt, `ball${i}`);
      if (this.ballSheet) {
        if (!b.img) b.img = this.ballPool.pop() || this.makeBallSprite();
        this.aimBall(b.img, b.x, b.y, 0, b.vy);
      } else {
        this.fxG.fillStyle(0xff5a1f, 1).fillCircle(b.x, b.y, 16);
        this.fxG.fillStyle(0xffe08a, 1).fillCircle(b.x - 3, b.y - 3, 7);
      }
      if (b.y >= this.groundY - 14) {
        b.done = true;
        this.scene.sparks.explode(12, b.x, this.groundY - 10);
        this.scene.dustAt(b.x, this.groundY, 6);
        this.fire.burst(b.x, this.groundY - 12, 1.3);
        this.fire.explosion(b.x, this.groundY + 4, 0.6);
        this.hurtPlayer(new Rect(b.x - 40, this.groundY - 70, 80, 70), this.k.bombDamage, b.x, 240);
        this.puddles.add(b.x, 90, this.k.fireTime);
      }
    });
    for (const b of this.balls) {
      if (b.done && b.img) {
        b.img.setVisible(false);
        this.ballPool.push(b.img);
        b.img = null;
      }
    }
    this.balls = this.balls.filter((b) => !b.done);
  }

  // ---------- 용암 갈라짐 불기둥 ----------

  runPillars(_dt) {
    const a = this.action;
    this.lift = a.t < 0.4 ? Math.sin((a.t / 0.4) * Math.PI) * 14 : 0;
    for (const w of a.waves) {
      const lt = a.t - w.start;
      if (lt < 0) continue;
      if (!w.sprites && lt >= w.warn - PILLAR_LEAD) {
        w.sprites = true;
        this.startPillarSprites(w.xs);
      }
      if (lt < w.warn) {
        const q = lt / w.warn;
        for (const x of w.xs) {
          // 갈라진 틈이 깜빡이며 달아오르고 불씨가 올라온다 (어디서 솟을지 잘 보이게)
          this.fire.warnGlow(x, this.groundY - 6, 46, this.t, q);
          this.fire.ember.emitParticleAt(x + Phaser.Math.Between(-20, 20), this.groundY - 4, this.fire.n(`pilE${x}`, 8 + 24 * q, this.dt, 2));
          this.warn.fillStyle(0xff7a1f, 0.25 + 0.45 * q).fillEllipse(x, this.groundY, PILLAR_W * (0.6 + 0.6 * q), 18);
          this.warn.lineStyle(3, 0xffd23f, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY, PILLAR_W + 14, 22);
          this.warn.fillStyle(0xff2020, 0.08 + 0.1 * q).fillRect(x - PILLAR_W / 2, this.groundY - PILLAR_H, PILLAR_W, PILLAR_H);
        }
        continue;
      }
      if (lt < w.warn + 0.45) {
        if (!w.burst) {
          w.burst = true;
          this.scene.sfxPlay('fire');
          this.scene.shake(0.008, 160);
          for (const x of w.xs) {
            this.fire.burst(x, this.groundY - 10, 1);
            this.fire.explosion(x, this.groundY + 4, 0.45);
          }
          this.scene.impact?.zoomPunch(0.012, 50, 180);
        }
        for (const x of w.xs) this.drawPillar(x, Math.min(1, (lt - w.warn) / 0.08), w);
      }
    }
    if (a.waves.some((w) => a.t < w.start + w.warn)) this.label(0, '불기둥! 빛나지 않는 곳으로!', (this.arenaStart + this.arenaEnd) / 2, 110, 24);
    if (a.t >= a.end) this.afterAttack();
  }

  // ---------- 쉬는 때 (날개가 처짐, 배가 드러나면 헉헉) ----------

  runTired(_dt) {
    const a = this.action;
    const left = Math.max(0, a.dur - a.t);
    if (Math.random() < 0.2) this.scene.dustAt(this.x + this.facing * 150, this.groundY - 60, 1);
    if (this.bellyOpen) this.label(5, `지금! 배를 때려! ${left.toFixed(1)}`, this.x, this.groundY - TH - 30, 22, '#ffd23f');
    else if (this.wing.alive) {
      const r = this.wingRect();
      if (Math.floor(this.t * 8) % 2 === 0) this.warn.lineStyle(4, 0xfff3a0, 1).strokeRect(r.x, r.y, r.width, r.height);
      this.label(5, `날개가 처졌다! 지금! ${left.toFixed(1)}`, r.centerX, this.groundY - 130, 20, '#ffd23f');
    }
    if (a.t >= a.dur) this.endAction();
  }

  // ---------- 겹치기 공격 (큰 공격과 동시에) ----------

  runSide(dt) {
    const sd = this.side;
    const k = this.k;
    const m = this.speed;
    const p = this.target;
    sd.t += dt;
    if (sd.phase === 'wait') {
      if (sd.t < sd.delay) return;
      sd.phase = 'go';
      sd.t = 0;
      this.scene.sfxPlay('warn');
      if (sd.type === 'fireball') {
        const mo = this.mouth;
        sd.x0 = mo.x;
        sd.y0 = mo.y;
        sd.tx = Phaser.Math.Clamp(p.x, this.arenaStart + 40, this.arenaEnd - 40);
      } else {
        const px = Phaser.Math.Clamp(p.x, this.arenaStart + 40, this.arenaEnd - 40);
        sd.xs = [px - 240, px, px + 240].filter((x) => x > this.arenaStart + 20 && x < this.arenaEnd - 20);
      }
    }
    if (sd.type === 'fireball') {
      const dur = k.fireballFlightTime * m;
      const q = Math.min(1, sd.t / dur);
      const bx = lerp(sd.x0, sd.tx, q);
      const by = lerp(sd.y0, this.groundY - 18, q) - Math.sin(q * Math.PI) * 140;
      // 진행 방향 = 이번 위치 - 지난 위치 (처음 프레임은 목표 쪽)
      const vx = sd.px === undefined ? sd.tx - sd.x0 : bx - sd.px;
      const vy = sd.py === undefined ? -1 : by - sd.py;
      sd.px = bx;
      sd.py = by;
      this.aimBall(this.sideBall, bx, by, vx, vy);
      if (!this.ballSheet) this.sideBall.setAngle(this.t * 400);
      this.fire.trail(this.sideBall.x, this.sideBall.y, dt, 'side');
      this.fire.warnGlow(sd.tx, this.groundY - 6, 40, this.t, q, 0xff3020);
      this.warn.fillStyle(0x000000, 0.25 + 0.35 * q).fillEllipse(sd.tx, this.groundY, 40 + 40 * q, 12);
      this.warn.lineStyle(3, 0xff4444, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeCircle(sd.tx, this.groundY - 40, 45);
      this.label(2, '불덩이도 날아온다!', sd.tx, this.groundY - 120, 20);
      if (q >= 1) {
        this.sideBall.setVisible(false);
        this.scene.sparks.explode(12, sd.tx, this.groundY - 10);
        this.fire.burst(sd.tx, this.groundY - 12, 1.3);
        this.fire.explosion(sd.tx, this.groundY + 4, 0.6);
        this.hurtPlayer(new Rect(sd.tx - 45, this.groundY - 80, 90, 80), k.bombDamage, sd.tx, 260);
        this.puddles.add(sd.tx, 90, k.fireTime);
        this.side = null;
      }
      return;
    }
    const warn = k.pillarWarningTime * m;
    if (!sd.sprites && sd.t >= warn - PILLAR_LEAD) {
      sd.sprites = true;
      this.startPillarSprites(sd.xs);
    }
    if (sd.t < warn) {
      const q = sd.t / warn;
      for (const x of sd.xs) {
        this.fire.warnGlow(x, this.groundY - 6, 46, this.t, q);
        this.warn.fillStyle(0xff7a1f, 0.25 + 0.45 * q).fillEllipse(x, this.groundY, PILLAR_W * (0.6 + 0.6 * q), 18);
        this.warn.lineStyle(3, 0xffd23f, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY, PILLAR_W + 14, 22);
      }
      this.label(2, '불기둥도 솟는다!', (this.arenaStart + this.arenaEnd) / 2, 150, 22);
      return;
    }
    if (!sd.burst) {
      sd.burst = true;
      this.scene.sfxPlay('fire');
      for (const x of sd.xs) this.fire.burst(x, this.groundY - 10, 1);
    }
    for (const x of sd.xs) this.drawPillar(x, 1, sd);
    if (sd.t >= warn + 0.45) this.side = null;
  }

  // ---------- 플레이어 공격 ----------

  receiveAttack(rect, attack) {
    if (this.state !== 'fight' || this.defeated) return false;
    const a = this.action;
    const opts = { charged: attack.kind === 'charged' };
    if (a?.type === 'tail' && a.phase === 'stuck' && this.tailPart.alive && intersects(rect, this.tailRect())) {
      this.hitPart(this.tailPart, attack.damage, this.tailRect(), opts);
      return true;
    }
    if (this.tired) {
      if (this.bellyOpen && intersects(rect, this.bellyRect())) {
        this.hitBelly(coreDamage(attack, this.k.chargedPunchBellyMultiplier), opts);
        return true;
      }
      if (this.wing.alive && intersects(rect, this.wingRect())) {
        this.hitPart(this.wing, attack.damage, this.wingRect(), opts);
        return true;
      }
    }
    if (this.air < 60 && intersects(rect, this.bodyRect())) {
      this.scene.sfxPlay('tink');
      if (this.t - this.lastBlockedAt > 1.2) {
        this.lastBlockedAt = this.t;
        let msg = '깡! 비늘이 너무 단단해!';
        if (this.tired && this.bellyOpen) msg = '크림색 배를 노려!';
        else if (this.tired && this.wing.alive) msg = '뒤쪽 날개를 때려!';
        else if (this.tailPart.alive) msg = '깡! 땅에 떨어진 꼬리를 때려!';
        floatText(this.scene, rect.centerX, rect.y - 10, msg, '#bfc7d5', 18);
      }
    }
    return false;
  }

  hitPart(part, dmg, r, opts) {
    if (part === this.tailPart) this.flashTail = 0.07;
    else this.flashT = 0.07;
    this.scene.sparks.explode(6, r.centerX, r.centerY);
    if (damagePart(this.scene, part, dmg, r.centerX, r.y - 30, opts)) this.breakPart(part, r.centerX);
    this.checkRage(this.totalRatio());
  }

  hitBelly(dmg, opts) {
    if (!this.bellyOpen) return;
    const r = this.bellyRect();
    this.flashT = 0.07;
    this.scene.sparks.explode(10, r.centerX, r.centerY);
    damagePart(this.scene, this.belly, dmg, r.centerX, r.y - 30, opts);
    this.checkRage(this.totalRatio());
    if (!this.belly.alive) this.defeat();
  }

  checkRage(ratio) {
    const was = this.raging;
    super.checkRage(ratio);
    if (!was && this.raging) this.scene.robot.say('용암 무늬가 빛난다! 더 빨라졌어!', true);
  }

  breakPart(part, x) {
    this.scene.sfxPlay('break');
    this.scene.shake(0.015, 300);
    this.scene.sparks.explode(24, x, this.groundY - 40);
    this.scene.impact?.partBreak(); // 멈칫 + 확대 + 번쩍
    this.fire.burst(x, this.groundY - 60, 2);
    floatText(this.scene, x, this.groundY - 150, `${part.label} 파괴!`, '#ff9a1f', 30);
    this.scene.gainXp(this.k.partXp, x, this.groundY - 120);
    if (!this.tailPart.alive && !this.wing.alive) {
      this.bellyOpen = true;
      this.scene.robot.say(['꼬리도 날개도 끝났어!', '이제 공격이 끝나면 헉헉거려. 크림색 배를 {strong}(으)로!'], true);
      if (this.action?.type === 'tail') this.afterAttack();
    } else {
      this.scene.robot.say(`${part.label} 끝! 이제 ${this.tailPart.alive ? '꼬리' : '날개'}만 남았어!`, true);
    }
  }

  defeat() {
    this.action = null;
    this.side = null;
    this.sideBall.setVisible(false);
    for (const b of this.balls) b.img?.setVisible(false);
    this.balls = [];
    this.flames.clear();
    this.waves.clear();
    this.puddles.clear();
    this.windG.clear();
    this.fire.clear();
    for (const img of this.breathLive || []) img.setVisible(false);
    super.defeat();
  }

  collapse() {
    if (this.sheet) this.sprite.anims.stop();
    else this.sprite.setTexture(`dragon_tired_${this.skinKey}`).setDisplaySize(W, TH);
    this.scene.tweens.add({ targets: [this.sprite, this.tailG], alpha: 0, y: '+=60', duration: 1000 });
  }
}
