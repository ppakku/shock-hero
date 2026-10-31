import Phaser from 'phaser';
import { BossBase } from './BossBase.js';
import { BossPart, GroundWaves, Puddles, Rect, intersects, damagePart, warnBox } from './bossKit.js';
import { ArmBoss } from './ArmBoss.js';
import { drawSwirl } from './bossFx.js';
import { chooseShredderAttack, SAW_PATTERNS, walkStep, dashEndX, finStep, rollBlade, bladeDone, sawSpin, holeSpot } from '../logic/shredder.js';
import { crawlPlan, spreadTargets } from '../logic/watcher.js';
import { coreDamage, inhaleStep, pickRocketHeight, rocketBand } from '../logic/boss.js';
import { difficultyOf, pickSideAttack } from '../logic/bossCombo.js';
import { nextTiredAfter, varyCount } from '../logic/bossVariety.js';
import { floatText } from '../fx/effects.js';
import { make } from '../fx/textures.js';
import { sheetFacesRight } from '../fx/spriteSheets.js';
import { stamp } from '../fx/bossArt.js';

const lerp = Phaser.Math.Linear;
const BODY_H = 330; // 시트 그림의 화면 높이
const BODY_W = Math.round((BODY_H * 344) / 384);
const FOOT = 0.9; // 시트 칸 아래 빈 공간만큼 기준점을 올림
const HALF = 100; // 몸 반쪽 너비
const CEIL = 430; // 천장을 기어갈 때 땅에서의 높이
const BELLY_UP = 158; // 땅에서 배 구멍까지 높이 (칸마다의 정확한 자리는 holeSpot)
const KNEEL = 0.62; // 지치면 이만큼 주저앉아서 배가 펀치 높이로 내려온다
const SAW_D = 84; // 평소 톱니 지름 (구멍을 둘러싼 쇠고리 안에 들어간다)
const GUARD_D = 104; // 쇠창살 지름 (쇠고리에 맞물린다)
const SAW_BIG = 150; // 돌진할 때 톱니 지름
const BLADE = 64; // 던지는 톱날 지름
const BLADE_LOW_H = 54; // 낮은 톱날 높이 (점프로 넘음)
const FIN_H = 46; // 땅 위로 나온 톱날 높이
const DASH_H = 170; // 돌진이 닿는 높이 (더블 점프로 넘거나 대시로 통과)
const FIST = { w: 96, h: 66 };

const TIPS = {
  sawDash: '배 톱니로 돌진한다! 더블 점프나 대시로 넘어! 벽에 끼면 덮개를 때려!',
  sawThrow: '톱날이 굴러와! 점프로 넘어! 벽에서 튕겨 돌아오니까 조심해!',
  sawDive: '땅속으로 파고들었다! 톱날이 따라와. 점프로 넘고, 멈추면 멀리 도망쳐!',
  crawl: '벽을 갈면서 천장으로 올라간다! 떨어지는 고철 표시를 피해!',
  stomp: '뛰어오른다! 빨간 곳에서 비켜! 내려찍으면 충격파는 점프로 넘어!',
  rocket: '주먹이 날아온다! 낮으면 점프, 높으면 가만히 서 있어! 땅에 떨어진 주먹을 때려!',
  grind: '톱니로 빨아들인다! 반대쪽으로 달려! 잡히면 대시로 빠져나와!',
  tired: '과열됐다! 주저앉은 지금 배의 덮개를 때려!',
  core: '덮개가 없어! 주저앉으면 코어가 보여. {strong}(으)로 때려!',
};

// 겹치기 공격: 큰 공격을 하는 동안 톱날 하나를 더 던진다 (난이도의 bossCombo 확률)
const SIDE_ATTACKS = { rocket: ['blade'], stomp: ['blade'], grind: ['blade'] };

// 파쇄자 (아들이 그린 보스): 배에 톱니가 달린 녹슨 드럼통. 포레스트 와처처럼 싸움터를 돌아다닌다.
// 땅에 떨어진 주먹으로 쇠팔을, 벽에 끼거나 과열됐을 때 배의 톱니 덮개를 부순다.
// 둘 다 부수면 주저앉을 때마다 코어가 드러난다.
export class ShredderBoss extends BossBase {
  constructor(scene, cfg, stage, skin = 1) {
    super(scene, cfg, stage, skin);
    this.diff = difficultyOf(cfg);
    this.hpScale *= this.diff.bossHealth;
    this.tempo *= this.diff.bossSpeed;
    const k = (this.k = cfg.shredderBoss);
    this.leftWall = this.arenaStart + HALF + 10;
    this.rightWall = this.arenaEnd - HALF - 10;
    this.x = this.arenaEnd - 230;
    this.bodyX = this.x;
    this.air = 0;
    this.angle = 0;
    this.facing = -1;
    this.squash = 1;
    this.alpha = 1;
    this.flashT = 0;
    this.moving = false;
    this.markHeight = 330;

    this.hazG = scene.add.graphics().setDepth(1);
    this.linkG = scene.add.graphics().setDepth(5.5);
    // 배에 톱날 구멍이 있는 전용 몸통. 파쇄자 MK2 들은 예전 그림(boss_body_1)을 그대로 쓴다.
    const bodyTex = scene.textures.exists('shredder_body') ? 'shredder_body' : `boss_body_${skin}`;
    this.body = scene.add.sprite(this.x, this.groundY, bodyTex).setDepth(5);
    this.sheet = scene.anims.exists(`${bodyTex}_anim`);
    this.sheetRight = sheetFacesRight(scene, bodyTex);
    if (this.sheet) this.body.setOrigin(0.5, FOOT).play(`${bodyTex}_anim`);
    else this.body.setOrigin(0.5, 1);

    // 쇠팔은 양옆에 달려 있다. 앞쪽 팔이 주먹을 날린다.
    const tex = `boss_arm_${skin}`;
    this.armSprites = [-1, 1].map((side) => ({ side, sprite: scene.add.image(this.x, this.groundY, tex).setOrigin(0.5, 0).setDepth(side > 0 ? 6 : 4.5).setDisplaySize(62, 186) }));
    this.core = scene.add.image(this.x, this.groundY, 'boss_core').setDepth(6.2).setDisplaySize(64, 64).setVisible(false);
    this.saw = scene.add.image(this.x, this.groundY, 'shredder_saw').setDepth(6.5).setDisplaySize(SAW_D, SAW_D);
    this.guard = scene.add.image(this.x, this.groundY, 'shredder_guard').setDepth(6.6).setDisplaySize(GUARD_D, GUARD_D);

    const hp = this.hpScale;
    this.arm = new BossPart('쇠팔', Math.round(k.armHealth * hp));
    this.guardPart = new BossPart('톱니 덮개', Math.round(k.guardHealth * hp));
    this.corePart = new BossPart('코어', Math.round(k.coreHealth * hp));
    this.totalMax = this.arm.health.max + this.guardPart.health.max + this.corePart.health.max;
    this.coreOpen = false;

    this.puddles = new Puddles(scene, this.hazG, { damage: k.puddleDamage, color: 0xd8571a, edge: 0xffc14a, name: '뜨거운 고철', art: 'fx_puddle_fire' });
    this.waves = new GroundWaves(scene, this.fxG, { damage: k.waveDamage, speed: k.waveSpeed, art: true });
    this.blades = []; // 던진 톱날
    this.scrap = []; // 천장에서 떨어지는 고철
    this.fin = null; // 땅속 톱날
    this.chew = null; // 톱니에 잡힌 상태
    this.fist = null; // 날아간 주먹
    this.sawMode = 'idle';
    this.sawAngle = 0;
    this.sawSize = SAW_D;
    this.action = null;
    this.side = null;
    this.combo = 0;
    this.sinceSaw = 0;
    this.rocketCount = 0;
    this.tiredRoll = nextTiredAfter(k.comboLength, this.variety, Math.random, 2);
  }

  static makeTextures(scene, stage, skin) {
    ArmBoss.makeTextures(scene, stage, skin); // 몸통, 쇠팔, 주먹은 팔 보스와 같은 이름
    const c = stage.boss.colors;
    // 그림(shredder_saw, shredder_guard)을 못 받았을 때 쓰는 임시 도형
    make(scene, 'shredder_saw', 128, 128, (g) => {
      const teeth = 14;
      g.fillStyle(0xcfd4d8);
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        const b = a + (Math.PI * 2) / teeth;
        const m = a + 0.1;
        g.fillTriangle(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48, 64 + Math.cos(b) * 48, 64 + Math.sin(b) * 48, 64 + Math.cos(m) * 64, 64 + Math.sin(m) * 64);
      }
      g.fillStyle(0x8d959c).fillCircle(64, 64, 50);
      g.fillStyle(0xb7bec4).fillCircle(64, 64, 42);
      g.fillStyle(c.main).fillCircle(64, 64, 20);
      g.fillStyle(c.dark).fillCircle(64, 64, 9);
      g.lineStyle(4, 0x8d959c);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.lineBetween(64 + Math.cos(a) * 22, 64 + Math.sin(a) * 22, 64 + Math.cos(a + 0.35) * 40, 64 + Math.sin(a + 0.35) * 40);
      }
    });
    // 톱니를 절반 가리는 덮개 (부술 수 있음). 가운데는 비어 톱니가 보인다.
    make(scene, 'shredder_guard', 110, 120, (g) => {
      for (const x of [0, 86]) {
        g.fillStyle(c.dark).fillRoundedRect(x, 0, 24, 120, 6);
        g.fillStyle(c.light).fillRoundedRect(x + 4, 4, 16, 112, 4);
        g.fillStyle(c.dark).fillCircle(x + 12, 16, 3).fillCircle(x + 12, 60, 3).fillCircle(x + 12, 104, 3);
      }
      g.fillStyle(c.dark).fillRect(0, 54, 110, 12);
      g.fillStyle(c.light).fillRect(4, 57, 102, 6);
    });
  }

  // ---------- 위치 도우미 ----------

  get tired() {
    return this.action?.type === 'tired';
  }

  get jammed() {
    return this.action?.type === 'sawDash' && this.action.phase === 'jam';
  }

  // 맞을 수 있는 때 (과열로 주저앉았거나 톱니가 벽에 낌)
  get exposed() {
    return this.tired || this.jammed;
  }

  // 몸 기준 자리 → 화면 자리. forward: 앞쪽 거리, up: 발에서 위로 높이. 벽, 천장에서는 같이 돌아간다.
  local(forward, up) {
    const rad = Phaser.Math.DegToRad(this.angle);
    const ox = forward * this.facing;
    const oy = -up * this.squash * (this.tired ? KNEEL : 1);
    return { x: this.x + ox * Math.cos(rad) - oy * Math.sin(rad), y: this.groundY - this.air + ox * Math.sin(rad) + oy * Math.cos(rad) };
  }

  // 지금 시트 칸의 배 구멍 자리. 몸이 흔들려도 톱날과 쇠창살이 구멍에 붙어 있게 한다.
  get holeLocal() {
    if (!this.sheet) return { forward: 10, up: BELLY_UP };
    const h = holeSpot(this.body.frame.name);
    return { forward: (h.x - 0.5) * BODY_W, up: (FOOT - h.y) * BODY_H };
  }

  get bellyPos() {
    const { forward, up } = this.holeLocal;
    return this.local(forward, up);
  }

  bellyRect() {
    if (this.jammed) return new Rect(this.x - 110, this.groundY - 210, 220, 210); // 벽에 끼면 등 쪽에서도 때릴 수 있다
    const b = this.bellyPos;
    return new Rect(b.x - 80, b.y - 65, 160, 130);
  }

  bodyRect() {
    return new Rect(this.x - 115, this.groundY - this.air - 280, 230, 280);
  }

  fistRect() {
    return new Rect(this.fist.x - FIST.w / 2 - 6, this.fist.y - FIST.h / 2 - 6, FIST.w + 12, FIST.h + 12);
  }

  facePlayer() {
    const p = this.target;
    if (Math.abs(p.x - this.x) > 20) this.facing = p.x < this.x ? -1 : 1;
  }

  label(i, text, x, y, size, color) {
    super.label(i, text, Phaser.Math.Clamp(x, this.arenaStart + 160, this.arenaEnd - 160), y, size, color);
  }

  sparksAt(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 34;
      this.fxG.lineStyle(3, Math.random() < 0.5 ? 0xffd23f : 0xff8a1f, 1).lineBetween(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
  }

  // ---------- HUD, 궁극기 ----------

  robotTargets() {
    if (this.state !== 'fight' || this.defeated) return [];
    const mid = (r) => ({ x: r.centerX, y: r.centerY });
    if (this.fist?.stuck && this.arm.alive) return [mid(this.fistRect())];
    if (this.exposed && (this.guardPart.alive || this.coreOpen)) return [mid(this.bellyRect())];
    return [];
  }

  hudParts() {
    return [
      this.arm.hud('part'),
      this.guardPart.hud('part'),
      { label: this.coreOpen ? '코어 (약점!)' : '코어 (잠김)', ratio: this.corePart.health.ratio, kind: 'core', locked: !this.coreOpen },
    ];
  }

  totalRatio() {
    return [this.arm, this.guardPart, this.corePart].reduce((s, p) => s + p.health.current, 0) / this.totalMax;
  }

  receiveUltimate(damage) {
    if (this.state !== 'fight' || this.defeated) return false;
    if (this.arm.alive) this.hitArm(damage, { ult: true });
    else if (this.guardPart.alive) this.hitGuard(damage, { ult: true });
    else this.hitCore(damage, { ult: true });
    return true;
  }

  // ---------- 흐름 ----------

  update(dt) {
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.state === 'dead') return;
    if (this.state === 'dormant') {
      this.draw(dt);
      return;
    }
    if (!this.tickState(dt)) {
      this.facePlayer();
      this.draw(dt);
      return;
    }

    this.clearFx();
    this.linkG.clear();
    this.puddles.update(dt, this.groundY, this.t);
    this.moving = false;

    if (!this.action) {
      this.sawMode = 'idle';
      this.timer -= dt;
      this.walk(dt);
      if (this.timer <= 0 && this.scene.anyAlive) this.startAction();
    } else if (!this.checkFeint()) {
      const a = this.action;
      a.t += dt;
      if (a.phase === 'aim') a.warnT = a.t;
      if (a.type === 'sawDash') this.runDash(dt);
      else if (a.type === 'sawThrow') this.runThrow(dt);
      else if (a.type === 'sawDive') this.runDive(dt);
      else if (a.type === 'crawl') this.runCrawl(dt);
      else if (a.type === 'stomp') this.runStomp(dt);
      else if (a.type === 'rocket') this.runRocket(dt);
      else if (a.type === 'grind') this.runGrind(dt);
      else if (a.type === 'tired') this.runTired(dt);
    }
    if (this.side) this.runSide(dt);
    this.updateBlades(dt);
    this.updateScrap(dt);
    this.updateChew(dt);
    this.waves.update(dt, this.groundY, this.arenaStart, this.arenaEnd);
    this.draw(dt);
  }

  // 쉬는 동안 주인공 쪽으로 걸어간다
  walk(dt) {
    this.facePlayer();
    const nx = walkStep(this.x, this.target.x, this.k.walkKeep, this.k.walkSpeed / this.speed, dt, this.leftWall, this.rightWall);
    this.moving = nx !== this.x;
    this.x = nx;
  }

  draw(dt) {
    const s = this.body;
    const tired = this.tired;
    const q = this.squash * (tired ? KNEEL : 1);
    const breathe = this.moving || this.action ? 0 : Math.sin(this.t * 3) * 0.02;
    s.setDisplaySize(BODY_W * (2 - this.squash), (this.sheet ? BODY_H : 280) * (q + breathe));
    if (this.sheet) {
      s.anims.timeScale = tired ? 0 : this.moving ? 1.4 : this.action ? 1 : 0.25;
      s.setFlipX(this.sheetRight ? this.facing < 0 : this.facing > 0);
    } else s.setFlipX(this.facing > 0);
    s.setPosition(this.x, this.groundY - this.air).setAngle(this.angle).setAlpha(this.alpha);
    this.bodyX = this.x;
    if (this.flashT > 0) s.setTintFill(0xffffff);
    else if (this.raging) s.setTint(0xffa0a0);
    else s.clearTint();
    this.drawArms();
    this.drawBelly(dt);
  }

  drawArms() {
    for (const { side, sprite } of this.armSprites) {
      if (!sprite.active || !this.arm.alive) continue;
      const shoulder = this.local(side * 88, 236);
      const sway = this.moving ? Math.sin(this.t * 9 + side) * 7 : Math.sin(this.t * 2 + side) * 2;
      const pull = this.action?.type === 'rocket' && side === 1 && this.action.phase === 'aim' ? Math.min(1, this.action.t / 0.5) : 0;
      sprite.setPosition(shoulder.x, shoulder.y).setAngle(this.angle - this.facing * side * sway * 0.6 + this.facing * pull * 50);
      sprite.setAlpha(this.alpha).setDepth((this.facing > 0 ? side : -side) > 0 ? 6 : 4.5);
    }
  }

  drawBelly(dt) {
    const b = this.bellyPos;
    const open = this.alpha > 0.5;
    const mode = this.exposed ? 'stop' : this.sawMode;
    this.sawAngle += sawSpin(mode, this.raging) * dt * this.facing;
    const want = this.sawMode === 'attack' && !this.exposed ? SAW_BIG : SAW_D * (this.coreOpen ? 1.15 : 1);
    this.sawSize += (want - this.sawSize) * Math.min(1, dt * 12);
    const out = this.sawMode === 'attack' && !this.exposed ? (this.sawSize - SAW_D) * 0.9 : 0; // 돌진 때는 몸 앞으로 튀어나온다
    const sp = this.local(this.holeLocal.forward + out, this.holeLocal.up);
    this.saw.setVisible(open).setPosition(sp.x, sp.y).setDisplaySize(this.sawSize, this.sawSize).setRotation(this.sawAngle).setAlpha(this.alpha);
    if (this.flashT > 0) this.saw.setTintFill(0xffffff);
    else if (this.exposed && Math.floor(this.t * 8) % 2 === 0) this.saw.setTint(0xff6a3a);
    else this.saw.clearTint();

    const showCore = this.coreOpen && this.exposed;
    this.core.setVisible(showCore);
    if (showCore) {
      const big = 64 * (1 + Math.sin(this.t * 8) * 0.08);
      this.core.setPosition(b.x, b.y).setDisplaySize(big, big);
      this.saw.setVisible(false);
    }
    const guardOn = this.guardPart.alive && open;
    this.guard.setVisible(guardOn);
    if (guardOn) {
      this.guard.setPosition(b.x, b.y).setAngle(this.angle).setDisplaySize(GUARD_D, GUARD_D * (this.tired ? KNEEL + 0.2 : 1));
      if (this.flashT > 0) this.guard.setTintFill(0xffffff);
      else if (this.exposed && Math.floor(this.t * 8) % 2 === 0) this.guard.setTint(0xfff3a0);
      else this.guard.clearTint();
    }
    if ((this.sawMode === 'rev' || this.sawMode === 'attack') && open && !this.exposed) this.sparksAt(sp.x + this.facing * this.sawSize * 0.4, sp.y + this.sawSize * 0.3, this.sawMode === 'attack' ? 5 : 2);
  }

  startAction() {
    const k = this.k;
    if (this.combo >= this.tiredRoll) {
      this.startTired();
      return;
    }
    const type = chooseShredderAttack(this.def.phases, this.arm.alive, this.guardPart.alive, this.lastType, this.sinceSaw);
    this.lastType = type;
    this.combo += 1;
    this.sinceSaw = SAW_PATTERNS.includes(type) ? 0 : this.sinceSaw + 1;
    const a = { type, phase: 'aim', t: 0 };
    this.prepareAttack(a, { sawDash: k.dashWarningTime, sawThrow: k.throwWarningTime, stomp: k.stompWarningTime, rocket: this.c.rocketPunchWarningTime });
    if (type === 'sawDash') {
      this.facePlayer();
      a.endX = dashEndX(this.x, this.target.x, this.leftWall, this.rightWall);
      this.facing = a.endX < this.x ? -1 : 1;
      a.hits = new Set();
    } else if (type === 'sawThrow') {
      this.facePlayer();
      a.count = varyCount(Math.max(1, Math.round(k.bladeCount + (this.raging ? 1 : 0))), this.variety);
      a.fired = 0;
      a.next = 0;
    } else if (type === 'sawDive') {
      a.phase = 'sink';
    } else if (type === 'crawl') {
      a.plan = crawlPlan(this.x, this.arenaStart + 20, this.arenaEnd - 20);
      a.phase = 'run';
      const count = Math.max(1, Math.round(k.scrapCount + (this.raging ? 1 : 0)));
      a.drops = spreadTargets(this.target.x, count, this.arenaStart + 60, this.arenaEnd - 60).map((x) => ({ x, done: false }));
    } else if (type === 'stomp') {
      this.facePlayer();
      a.tx = Phaser.Math.Clamp(this.target.x, this.leftWall, this.rightWall);
      a.fromX = this.x;
    } else if (type === 'rocket') {
      this.facePlayer();
      a.height = pickRocketHeight(this.rocketCount, Math.random);
      this.rocketCount += 1;
    } else if (type === 'grind') {
      this.facePlayer();
    }
    this.action = a;
    this.scene.sfxPlay('warn');
    this.tip(type, TIPS[type]);
    if (!this.side) {
      const sideType = pickSideAttack(SIDE_ATTACKS, type, this.diff.bossCombo);
      if (sideType) this.side = { t: 0, delay: 0.5 * this.speed };
    }
  }

  endAction(idle = this.k.idleTime) {
    this.action = null;
    this.sawMode = 'idle';
    this.squash = 1;
    this.air = 0;
    this.angle = 0;
    this.alpha = 1;
    this.fin = null;
    this.timer = this.restTime(idle) * this.speed;
  }

  onFeintCancel() {
    this.combo -= 1;
    this.sawMode = 'idle';
    this.squash = 1;
  }

  // ---------- 배 톱니 돌진 (벽에 끼면 때릴 기회) ----------

  runDash(dt) {
    const a = this.action;
    const k = this.k;
    const dir = this.facing;
    if (a.phase === 'aim') {
      const dur = k.dashWarningTime * this.speed * a.late;
      this.sawMode = 'rev';
      this.squash = 1 - 0.08 * Math.min(1, a.t / dur);
      const x0 = Math.min(this.x, a.endX + dir * HALF);
      warnBox(this.warn, x0, this.groundY - DASH_H, Math.abs(a.endX + dir * HALF - this.x), DASH_H, this.t);
      this.label(0, dir < 0 ? '◀ 톱니 돌진! 더블 점프나 대시! ◀' : '▶ 톱니 돌진! 더블 점프나 대시! ▶', (this.x + a.endX) / 2, this.groundY - DASH_H - 30, 22);
      if (a.t >= dur) {
        a.phase = 'run';
        a.t = 0;
        this.squash = 1;
        this.sawMode = 'attack';
        this.scene.sfxPlay('dash');
      }
      return;
    }
    if (a.phase === 'run') {
      const step = k.dashSpeed * dt;
      const left = a.endX - this.x;
      this.moving = true;
      this.x = Math.abs(left) <= step ? a.endX : this.x + dir * step;
      if (Math.random() < 0.6) this.scene.dustAt(this.x - dir * 40, this.groundY, 2);
      const front = this.x + dir * (HALF + SAW_BIG * 0.5);
      this.hurtPlayer(new Rect(Math.min(this.x, front), this.groundY - DASH_H, Math.abs(front - this.x), DASH_H), k.dashDamage, this.x, 420, a.hits);
      if (this.x === a.endX) {
        a.phase = 'jam';
        a.t = 0;
        this.sawMode = 'stop';
        this.scene.sfxPlay('slam');
        this.scene.shake(0.016, 280);
        this.scene.impact?.bossSlam(1);
        this.scene.dustAt(this.x + dir * HALF, this.groundY - 120, 14);
        this.tipExposed();
      }
      return;
    }
    if (a.phase === 'jam') {
      this.x += Math.sin(this.t * 50) * 1.5 * (a.t < k.jamTime - 0.2 ? 1 : 0);
      this.sparksAt(a.endX + dir * HALF, this.groundY - BELLY_UP, 3);
      this.label(5, this.coreOpen ? '톱니가 끼었다! 코어를 때려!' : this.guardPart.alive ? '톱니가 벽에 끼었다! 지금 때려!' : '톱니가 벽에 끼었다!', this.x, this.groundY - 320, 20, '#ffd23f');
      if (a.t >= k.jamTime) {
        this.x = a.endX;
        this.endAction();
      }
    }
  }

  tipExposed() {
    if (this.coreOpen) this.tip('core', TIPS.core);
    else if (this.guardPart.alive) this.tip('tired', TIPS.tired);
  }

  // ---------- 톱날 던지기 (굴러가다 벽에서 튕겨 돌아옴) ----------

  runThrow(_dt) {
    const a = this.action;
    const k = this.k;
    if (a.phase === 'aim') {
      const dur = k.throwWarningTime * this.speed * a.late;
      this.sawMode = 'rev';
      const b = this.bellyPos;
      this.label(0, '톱날을 던진다! 점프!', b.x, b.y - 100, 22);
      if (a.t >= dur) {
        a.phase = 'fire';
        a.t = 0;
      }
      return;
    }
    if (a.fired < a.count && a.t >= a.next) {
      a.fired += 1;
      a.next = a.t + k.bladeGap * this.speed;
      this.facePlayer();
      this.throwBlade(a.fired % 2 === 0 && !this.guardPart.alive);
    }
    if (a.fired >= a.count) {
      this.sawMode = 'idle';
      if (!a.endAt) a.endAt = a.t + 0.5;
      if (a.t >= a.endAt) this.endAction();
    }
  }

  // high: 머리 위로 날아가는 톱날 (가만히 서 있으면 안 맞는다)
  throwBlade(high = false) {
    const b = this.local(HALF, BELLY_UP);
    const sprite = this.scene.add.image(b.x, b.y, 'shredder_saw').setDepth(7.5).setDisplaySize(BLADE, BLADE);
    const y = high ? this.groundY - 140 : this.groundY - BLADE_LOW_H / 2 - 2;
    this.blades.push({ sprite, x: b.x, y, fromY: b.y, t: 0, dir: this.facing, bounces: 1, hits: new Set() });
    this.scene.sfxPlay('rocket');
  }

  updateBlades(dt) {
    const k = this.k;
    const minX = this.arenaStart + BLADE / 2;
    const maxX = this.arenaEnd - BLADE / 2;
    for (const bl of this.blades) {
      bl.t += dt;
      const r = rollBlade(bl, k.bladeSpeed, dt, minX, maxX);
      Object.assign(bl, { x: r.x, dir: r.dir, bounces: r.bounces });
      if (r.bounced) {
        bl.hits = new Set(); // 돌아올 때 다시 맞을 수 있다
        this.scene.sfxPlay('tink');
        this.scene.dustAt(bl.x, bl.y, 6);
      }
      const q = Math.min(1, bl.t / 0.22);
      const y = lerp(bl.fromY, bl.y, q);
      bl.sprite.setPosition(bl.x, y).setRotation(bl.sprite.rotation + bl.dir * 18 * dt);
      if (y > this.groundY - 60) this.sparksAt(bl.x - bl.dir * 20, this.groundY - 4, 1);
      this.warn.lineStyle(2, 0xff4444, 0.7).lineBetween(bl.x, this.groundY - 2, bl.x + bl.dir * 120, this.groundY - 2);
      if (q >= 1) this.hurtPlayer(new Rect(bl.x - BLADE / 2 + 6, bl.y - BLADE_LOW_H / 2, BLADE - 12, BLADE_LOW_H), k.bladeDamage, bl.x - bl.dir * 40, 260, bl.hits);
      bl.done = bladeDone(bl, minX, maxX);
      if (bl.done) {
        bl.sprite.destroy();
        this.scene.dustAt(bl.x, this.groundY - 20, 6);
      }
    }
    this.blades = this.blades.filter((b) => !b.done);
  }

  // ---------- 땅 파기 (톱날만 내놓고 쫓아오다 튀어나옴) ----------

  runDive(dt) {
    const a = this.action;
    const k = this.k;
    if (a.phase === 'sink') {
      const q = Math.min(1, a.t / 0.5);
      this.sawMode = 'attack';
      this.squash = 1 - 0.8 * q;
      this.alpha = 1 - q;
      if (Math.random() < 0.6) this.scene.dustAt(this.x + Phaser.Math.Between(-80, 80), this.groundY, 2);
      this.label(0, '땅을 파고든다!', this.x, this.groundY - 340, 22);
      if (q >= 1) {
        a.phase = 'chase';
        a.t = 0;
        a.hits = new Set();
        this.fin = { x: this.x, rot: 0 };
      }
      return;
    }
    const f = this.fin;
    if (a.phase === 'chase' || a.phase === 'lock') {
      f.rot += dt * 24;
      this.drawFin(f);
      if (Math.random() < 0.7) this.scene.dustAt(f.x, this.groundY, 2);
    }
    if (a.phase === 'chase') {
      f.x = finStep(f.x, this.target.x, k.finSpeed / this.speed, dt, this.leftWall, this.rightWall);
      this.hurtPlayer(new Rect(f.x - 40, this.groundY - FIN_H, 80, FIN_H), k.finDamage, f.x, 240, a.hits);
      this.label(0, '톱날이 쫓아온다! 점프!', f.x, this.groundY - 120, 22);
      if (a.t >= k.finTime) {
        a.phase = 'lock';
        a.t = 0;
        this.scene.sfxPlay('warn');
      }
      return;
    }
    if (a.phase === 'lock') {
      const dur = k.burstWarningTime * this.speed * a.late;
      warnBox(this.warn, f.x - HALF - 20, this.groundY - 240, (HALF + 20) * 2, 240, this.t);
      this.label(0, '튀어나온다! 피해!', f.x, this.groundY - 270, 24);
      if (a.t >= dur) {
        this.x = f.x;
        this.fin = null;
        this.facePlayer();
        a.phase = 'burst';
        a.t = 0;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.016, 280);
        this.scene.impact?.bossSlam(1);
        this.scene.dustAt(this.x, this.groundY, 24);
        this.hurtPlayer(new Rect(this.x - HALF - 20, this.groundY - 240, (HALF + 20) * 2, 240), k.burstDamage, this.x, 380);
        if (this.raging || !this.arm.alive) this.spawnWaves();
      }
      return;
    }
    const q = Math.min(1, a.t / 0.28);
    this.alpha = 1;
    this.squash = q < 0.6 ? lerp(0.2, 1.15, q / 0.6) : lerp(1.15, 1, (q - 0.6) / 0.4);
    this.air = Math.sin(q * Math.PI) * 60;
    if (a.t >= 0.65) this.endAction();
  }

  // 땅 위로 절반만 나온 톱날
  drawFin(f) {
    const r = 46;
    const g = this.fxG;
    const y = this.groundY + 6;
    const teeth = 10;
    g.fillStyle(0xb7bec4, 1);
    for (let i = 0; i <= teeth; i++) {
      const a = Math.PI + (i / teeth) * Math.PI;
      const b = a + 0.22 + Math.sin(f.rot + i) * 0.04;
      g.fillTriangle(f.x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8), f.x + Math.cos(b) * (r + 12), y + Math.sin(b) * (r + 12), f.x + Math.cos(a + 0.34) * (r - 8), y + Math.sin(a + 0.34) * (r - 8));
    }
    g.fillStyle(0x8d959c, 1).slice(f.x, y, r, Math.PI, 0, false).fillPath();
    g.fillStyle(0xcfd4d8, 1).slice(f.x, y, r - 12, Math.PI, 0, false).fillPath();
    this.sparksAt(f.x, this.groundY - 4, 3);
  }

  spawnWaves() {
    const k = this.k;
    this.waves.spawn(this.x - 40, -1, k.waveRange);
    this.waves.spawn(this.x + 40, 1, k.waveRange);
  }

  // ---------- 벽을 갈며 천장으로 (고철을 떨어뜨림) ----------

  runCrawl(dt) {
    const a = this.action;
    const k = this.k;
    const { startWall, endWall, dir } = a.plan;
    const sp = k.crawlSpeed / this.speed;
    for (const d of a.drops) {
      if (d.done) continue;
      this.warn.fillStyle(0x000000, 0.35).fillEllipse(d.x, this.groundY, 70, 14);
      this.warn.lineStyle(3, 0xff8a1f, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeEllipse(d.x, this.groundY, 90, 20);
    }
    if (a.drops.some((d) => !d.done)) this.label(0, '고철 조심!', (this.arenaStart + this.arenaEnd) / 2, 120, 22);
    this.sawMode = 'rev';
    this.moving = true;
    if (a.phase === 'run') {
      this.facing = startWall < this.x ? -1 : 1;
      const step = Math.sign(startWall - this.x) * sp * dt;
      if (Math.abs(startWall - this.x) <= Math.abs(step)) {
        this.x = startWall;
        a.phase = 'up';
      } else this.x += step;
      return;
    }
    const b = this.bellyPos;
    this.sparksAt(b.x, b.y, 3);
    if (a.phase === 'up') {
      this.facing = dir;
      this.angle = this.turnTo(this.angle, -dir * 90, dt);
      this.air = Math.min(CEIL, this.air + sp * dt);
      if (this.air >= CEIL) a.phase = 'ceiling';
      return;
    }
    if (a.phase === 'ceiling') {
      this.angle = this.turnTo(this.angle, 180 * -dir, dt);
      this.x += dir * sp * dt;
      for (const d of a.drops) {
        if (!d.done && (this.x - d.x) * dir >= 0) {
          d.done = true;
          this.dropScrap(d.x);
        }
      }
      if ((this.x - endWall) * dir >= 0) {
        this.x = endWall;
        a.phase = 'down';
      }
      return;
    }
    if (a.phase === 'down') {
      this.angle = this.turnTo(this.angle, dir > 0 ? -270 : 270, dt);
      this.air = Math.max(0, this.air - sp * dt);
      if (this.air <= 0) {
        this.angle = 0;
        this.scene.dustAt(this.x, this.groundY, 10);
        a.phase = 'out';
      }
      return;
    }
    const tx = Phaser.Math.Clamp(this.x, this.leftWall, this.rightWall);
    this.facing = tx < this.x ? -1 : 1;
    const step = Math.sign(tx - this.x) * sp * dt;
    if (Math.abs(tx - this.x) <= Math.abs(step) + 1) {
      this.x = tx;
      this.endAction();
    } else this.x += step;
  }

  turnTo(from, to, dt) {
    const step = 420 * dt;
    return Math.abs(to - from) <= step ? to : from + Math.sign(to - from) * step;
  }

  dropScrap(x) {
    const y0 = this.groundY - CEIL + 60;
    const sprite = this.scene.add.image(x, y0, 'rock').setDepth(8).setDisplaySize(44, 40).setTint(0xff9a5a);
    this.scrap.push({ sprite, x, y0, t: 0 });
    this.scene.sfxPlay('slam');
  }

  updateScrap(dt) {
    const k = this.k;
    for (const s of this.scrap) {
      s.t += dt;
      const q = Math.min(1, s.t / 0.55);
      s.sprite.y = lerp(s.y0, this.groundY - 18, q * q);
      s.sprite.rotation += dt * 6;
      if (q >= 1) {
        s.done = true;
        s.sprite.destroy();
        this.scene.dustAt(s.x, this.groundY, 8);
        this.hurtPlayer(new Rect(s.x - 34, this.groundY - 60, 68, 60), k.scrapDamage, s.x, 200);
        this.puddles.add(s.x, k.puddleWidth, k.puddleTime);
      }
    }
    this.scrap = this.scrap.filter((s) => !s.done);
  }

  // ---------- 뛰어올라 내려찍기 (양쪽으로 충격파) ----------

  runStomp(_dt) {
    const a = this.action;
    const k = this.k;
    if (a.phase === 'aim') {
      const dur = k.stompWarningTime * this.speed * a.late;
      this.squash = 1 - 0.14 * Math.min(1, a.t / dur);
      warnBox(this.warn, a.tx - HALF - 20, this.groundY - 240, (HALF + 20) * 2, 240, this.t);
      this.label(0, '여기로 뛰어든다! 비켜!', a.tx, this.groundY - 270, 22);
      if (a.t >= dur) {
        a.phase = 'jump';
        a.t = 0;
        this.squash = 1;
        this.scene.sfxPlay('dash');
        this.scene.dustAt(this.x, this.groundY, 10);
      }
      return;
    }
    if (a.phase === 'jump') {
      const q = Math.min(1, a.t / k.stompAirTime);
      warnBox(this.warn, a.tx - HALF - 20, this.groundY - 240, (HALF + 20) * 2, 240, this.t);
      this.x = lerp(a.fromX, a.tx, q);
      this.air = Math.sin(q * Math.PI) * 240;
      if (q >= 1) {
        a.phase = 'land';
        a.t = 0;
        this.air = 0;
        this.x = a.tx;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.016, 260);
        this.scene.impact?.bossSlam(1);
        this.scene.dustAt(this.x, this.groundY, 18);
        this.hurtPlayer(new Rect(this.x - HALF - 20, this.groundY - 240, (HALF + 20) * 2, 240), k.stompDamage, this.x, 360);
        this.spawnWaves();
      }
      return;
    }
    const q = Math.min(1, a.t / 0.3);
    this.squash = q < 0.4 ? lerp(0.8, 1.05, q / 0.4) : lerp(1.05, 1, (q - 0.4) / 0.6);
    if (a.t >= 0.5) this.endAction();
  }

  // ---------- 주먹 발사 (낮으면 점프, 높으면 가만히. 떨어진 주먹이 때릴 기회) ----------

  runRocket(dt) {
    const a = this.action;
    if (!this.arm.alive) {
      this.endAction();
      return;
    }
    const k = this.c;
    const dir = (a.dir ??= this.facing);
    const band = rocketBand(a.height, this.groundY);
    const fistY = (band.top + band.bottom) / 2;
    const launchX = this.x + dir * (HALF + 20);
    a.fromX ??= launchX; // 주먹은 쏜 자리에서 rocketReach 만큼만 날아가고 떨어진다 (벽까지 뛰어가지 않아도 되게)
    const wall = dir < 0 ? this.arenaStart + FIST.w / 2 + 4 : this.arenaEnd - FIST.w / 2 - 4;
    const wallX = dir < 0 ? Math.max(wall, a.fromX - this.k.rocketReach) : Math.min(wall, a.fromX + this.k.rocketReach);
    const flip = dir > 0; // 주먹 그림은 왼쪽을 본다
    if (a.phase === 'aim') {
      const dur = k.rocketPunchWarningTime * this.speed * a.late;
      this.facing = dir;
      const x0 = Math.min(launchX, wallX);
      warnBox(this.warn, x0, band.top, Math.abs(wallX - launchX), band.bottom - band.top, this.t);
      this.label(0, a.height === 'high' ? '높다! 가만히!' : '낮다! 점프!', (launchX + wallX) / 2, band.top - 30, 28);
      if (a.t >= dur) {
        a.phase = 'fly';
        a.t = 0;
        const img = this.scene.add.image(launchX, fistY, `boss_fist_${this.skin}`).setDepth(8).setDisplaySize(FIST.w, FIST.h).setFlipX(flip);
        this.fist = { img, x: launchX, y: fistY, stuck: false };
        this.frontArm()?.setVisible(false);
        a.hits = new Set();
        this.scene.sfxPlay('rocket');
        this.scene.shake(0.006, 120);
      }
      return;
    }
    const f = this.fist;
    this.drawChain();
    if (a.phase === 'fly') {
      const step = k.rocketPunchSpeed * dt;
      const left = wallX - f.x;
      f.x = Math.abs(left) <= step ? wallX : f.x + dir * step;
      f.y = fistY + Math.sin(this.t * 40) * 2;
      f.img.setPosition(f.x, f.y);
      stamp(this.scene, 'fx_rocket_trail', f.x - dir * FIST.w * 0.4, f.y, 110, 50, { flipX: dir > 0, alpha: 0.9 });
      this.label(0, a.height === 'high' ? '가만히!' : '점프!', f.x, band.top - 26, 24);
      this.hurtPlayer(new Rect(f.x - FIST.w / 2, band.top, FIST.w, band.bottom - band.top), k.rocketPunchDamage, f.x - dir * 100, 380, a.hits);
      if (f.x === wallX) {
        a.phase = 'stuck';
        a.t = 0;
        f.stuck = true;
        f.y = this.groundY - FIST.h / 2;
        f.img.setPosition(f.x, f.y).setAngle(dir * 20);
        this.scene.sfxPlay('slam');
        this.scene.shake(0.012, 220);
        this.scene.impact?.bossSlam(1);
        this.scene.dustAt(f.x, this.groundY, 14);
      }
      return;
    }
    if (a.phase === 'stuck') {
      f.img.setTint(Math.floor(this.t * 8) % 2 === 0 ? 0xfff3a0 : 0xffffff);
      this.label(5, '주먹이 떨어졌다! 지금 때려!', f.x, f.y - 70, 20, '#ffd23f');
      if (a.t >= this.k.rocketStuckTime) {
        a.phase = 'back';
        a.t = 0;
        f.stuck = false;
        f.from = { x: f.x, y: f.y };
        f.img.clearTint().setAngle(0).setFlipX(!flip);
      }
      return;
    }
    const q = Math.min(1, a.t / 0.7);
    const shoulder = this.local(HALF, 100);
    f.img.setPosition(lerp(f.from.x, shoulder.x, q), lerp(f.from.y, shoulder.y, q) - Math.sin(q * Math.PI) * 180);
    f.x = f.img.x;
    f.y = f.img.y;
    if (q >= 1) {
      this.clearFist();
      this.endAction();
    }
  }

  frontArm() {
    return this.armSprites.find((a) => a.side === 1)?.sprite;
  }

  // 날아간 주먹과 몸을 잇는 쇠사슬
  drawChain() {
    if (!this.fist) return;
    const s = this.local(HALF - 30, 150);
    this.linkG.lineStyle(10, 0x3a2a24, 1).lineBetween(s.x, s.y, this.fist.x, this.fist.y);
    this.linkG.lineStyle(4, 0x9a6a50, 1).lineBetween(s.x, s.y, this.fist.x, this.fist.y);
  }

  clearFist() {
    if (this.fist) this.fist.img.destroy();
    this.fist = null;
    if (this.arm.alive) this.frontArm()?.setVisible(true);
  }

  // ---------- 빨아들여 갈기 (잡히면 대시로 탈출) ----------

  runGrind(dt) {
    const a = this.action;
    const b = this.bellyPos;
    if (a.phase === 'aim') {
      const dur = this.c.inhaleWarningTime * this.speed;
      this.sawMode = 'rev';
      drawSwirl(this.fxG, b.x, b.y, this.t, 0.4, this.facing);
      this.label(0, '톱니가 빨아들인다! 반대쪽으로 달려!', this.x, 120, 24);
      if (a.t >= dur) {
        a.phase = 'pull';
        a.t = 0;
        this.scene.sfxPlay('inhale');
      }
      return;
    }
    if (a.phase === 'pull') {
      this.sawMode = 'attack';
      for (const dir of [-1, 1]) drawSwirl(this.fxG, b.x, b.y, this.t, 0.5, dir);
      this.label(0, '버텨! 멀리 달려!', this.x, 120, 24);
      for (const p of this.scene.players) {
        if (p.dead || this.chew?.who === p) continue;
        p.x = inhaleStep(p.x, this.x, this.c.inhalePull, dt);
        if (!this.chew && Math.abs(p.x - this.x) < 40) this.startChew(p);
      }
      if (a.t >= this.c.inhaleTime && !this.chew) {
        a.phase = 'after';
        a.t = 0;
        this.sawMode = 'idle';
      }
      return;
    }
    if (a.t >= 0.5) this.endAction();
  }

  startChew(p) {
    this.chew = { who: p, t: 0, tick: 0 };
    this.scene.sfxPlay('bite');
    this.tip('chew', '톱니에 잡혔다! 대시로 빠져나와!');
  }

  updateChew(dt) {
    const g = this.chew;
    if (!g) return;
    const k = this.k;
    const p = g.who;
    g.t += dt;
    g.tick -= dt;
    if (p.dead) {
      this.chew = null;
      return;
    }
    if (p.dashing || g.t >= k.chewTime) {
      if (p.dashing) floatText(this.scene, p.x, p.y - 60, '탈출!', '#3ff0ff', 20);
      else p.setVelocity(this.facing * 500, -260); // 다 갈고 뱉어 낸다
      this.chew = null;
      return;
    }
    p.x = this.x + this.facing * 30;
    p.body.velocity.x = 0;
    this.sparksAt(p.x, p.y - 20, 5);
    this.label(4, '톱니에 잡혔다! 대시로 빠져나와!', p.x, p.y - 90, 18, '#ffd23f');
    if (g.tick <= 0) {
      g.tick = k.chewTick;
      p.hurt(k.chewDamage, p.x + 1, 0);
      this.scene.shake(0.005, 80);
    }
  }

  // ---------- 과열 (주저앉음, 때릴 기회) ----------

  startTired(extra = 0) {
    this.combo = 0;
    this.side = null;
    this.chew = null;
    this.clearFist();
    this.puddles.clear(); // 식으면서 뜨거운 고철도 식는다 (때리러 가기 편하게)
    this.tiredRoll = nextTiredAfter(this.k.comboLength, this.variety, Math.random, 2);
    this.action = { type: 'tired', t: 0, dur: this.k.tiredTime + extra };
    this.lastType = null;
    this.air = 0;
    this.angle = 0;
    this.alpha = 1;
    this.squash = 1;
    this.fin = null;
    this.sawMode = 'stop';
    this.scene.sfxPlay('beep');
    this.scene.dustAt(this.x, this.groundY, 12);
    this.tipExposed();
  }

  runTired(_dt) {
    const a = this.action;
    const b = this.bellyPos;
    if (Math.random() < 0.15) this.scene.dustAt(this.x + Phaser.Math.Between(-40, 40), this.groundY - 240, 1); // 김이 난다
    const left = Math.max(0, a.dur - a.t);
    if (this.coreOpen) this.label(5, `지금! 코어를 때려! ${left.toFixed(1)}`, b.x, b.y - 100, 22, '#ffd23f');
    else if (this.guardPart.alive) this.label(5, `지금! 배의 덮개! ${left.toFixed(1)}`, b.x, b.y - 100, 20, '#ffd23f');
    else this.label(5, '치익...', b.x, b.y - 100, 20, '#ffd23f');
    if (a.t >= a.dur) this.endAction(this.k.idleTime * 1.2);
  }

  // ---------- 겹치기 공격 ----------

  runSide(dt) {
    const sd = this.side;
    sd.t += dt;
    if (sd.t < sd.delay) return;
    if (this.alpha < 0.5 || this.angle !== 0 || this.air > 0) return; // 몸이 숨어 있으면 기다린다
    this.side = null;
    this.throwBlade(false);
  }

  // ---------- 플레이어 공격 ----------

  receiveAttack(rect, attack) {
    if (this.state !== 'fight' || this.defeated) return false;
    const opts = { charged: attack.kind === 'charged' };
    if (this.fist?.stuck && this.arm.alive && intersects(rect, this.fistRect())) {
      this.hitArm(attack.damage, opts);
      return true;
    }
    if (this.exposed && intersects(rect, this.bellyRect())) {
      if (this.coreOpen) {
        this.hitCore(coreDamage(attack, this.k.chargedPunchCoreMultiplier), opts);
        return true;
      }
      if (this.guardPart.alive) {
        this.hitGuard(attack.damage, opts);
        return true;
      }
    }
    if (this.alpha > 0.5 && intersects(rect, this.bodyRect())) {
      this.scene.sfxPlay('tink');
      if (this.t - this.lastBlockedAt > 1.2) {
        this.lastBlockedAt = this.t;
        let msg = '깡! 벽에 끼거나 주저앉을 때까지 피해!';
        if (this.exposed && this.guardPart.alive) msg = '배의 덮개를 때려!';
        else if (this.arm.alive && this.action?.type === 'rocket') msg = '깡! 떨어진 주먹을 때려!';
        floatText(this.scene, rect.centerX, rect.y - 10, msg, '#bfc7d5', 18);
      }
    }
    return false;
  }

  hitArm(dmg, opts) {
    const f = this.fist;
    const x = f ? f.x : this.x;
    const y = f ? f.y : this.groundY - 120;
    this.flashT = 0.07;
    this.scene.gooAt(x, y, 6);
    if (damagePart(this.scene, this.arm, dmg, x, y - 50, opts)) this.breakPart(this.arm, x);
    this.checkRage(this.totalRatio());
  }

  hitGuard(dmg, opts) {
    const b = this.bellyPos;
    this.flashT = 0.07;
    this.scene.gooAt(b.x, b.y, 8);
    if (damagePart(this.scene, this.guardPart, dmg, b.x, b.y - 60, opts)) this.breakPart(this.guardPart, b.x);
    this.checkRage(this.totalRatio());
  }

  hitCore(dmg, opts) {
    if (!this.coreOpen) return;
    const b = this.bellyPos;
    this.flashT = 0.07;
    this.scene.gooAt(b.x, b.y, 8);
    damagePart(this.scene, this.corePart, dmg, b.x, b.y - 60, opts);
    this.checkRage(this.totalRatio());
    if (!this.corePart.alive) this.defeat();
  }

  breakPart(part, x) {
    this.scene.sfxPlay('break');
    this.scene.shake(0.015, 300);
    this.scene.gooAt(x, this.groundY - 60, 30);
    floatText(this.scene, x, this.groundY - 180, `${part.label} 파괴!`, '#ff9a1f', 30);
    this.scene.gainXp(this.k.partXp, x, this.groundY - 150);
    if (part === this.arm) this.dropArms();
    else this.dropGuard();
    if (!this.arm.alive && !this.guardPart.alive) {
      this.coreOpen = true;
      this.scene.robot.say(['쇠팔도 덮개도 끝났어! 톱니가 미쳐 날뛴다!', '주저앉거나 벽에 끼면 코어가 보여. {strong}(으)로 끝내!'], true);
      if (this.tired) this.startTired(0.8);
    } else {
      this.scene.robot.say(`${part.label} 끝! 이제 ${this.arm.alive ? '쇠팔' : '톱니 덮개'}만 남았어!`, true);
      if (part === this.arm) this.startTired(); // 팔이 떨어져 나가면 휘청거리며 주저앉는다
    }
  }

  dropArms() {
    this.linkG.clear();
    const f = this.fist;
    if (f) {
      this.fist = null;
      this.scene.tweens.add({ targets: f.img, angle: 60, alpha: 0, y: f.y + 20, duration: 600, onComplete: () => f.img.destroy() });
    }
    for (const { sprite } of this.armSprites) {
      sprite.setVisible(true);
      this.scene.tweens.add({ targets: sprite, angle: -40, alpha: 0, y: sprite.y + 80, duration: 700, onComplete: () => sprite.destroy() });
    }
  }

  dropGuard() {
    const g = this.scene.add.image(this.guard.x, this.guard.y, 'shredder_guard').setDepth(6.6).setDisplaySize(GUARD_D, GUARD_D);
    this.scene.tweens.add({ targets: g, angle: -90, alpha: 0, y: this.groundY - 20, duration: 800, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
  }

  defeat() {
    this.action = null;
    this.side = null;
    this.chew = null;
    this.clearFist();
    for (const b of this.blades) b.sprite.destroy();
    for (const s of this.scrap) s.sprite.destroy();
    this.blades = [];
    this.scrap = [];
    this.fin = null;
    this.waves.clear();
    this.puddles.clear();
    this.linkG.clear();
    this.core.setVisible(false);
    this.guard.setVisible(false);
    this.saw.setVisible(false);
    super.defeat();
  }

  collapse() {
    if (this.sheet) this.body.anims.stop();
    const targets = [this.body, ...this.armSprites.map((a) => a.sprite).filter((s) => s.active)];
    this.scene.tweens.add({ targets, alpha: 0, y: '+=60', duration: 900 });
  }
}
