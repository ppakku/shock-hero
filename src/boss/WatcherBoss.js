import Phaser from 'phaser';
import { BossBase } from './BossBase.js';
import { BossPart, Puddles, Rect, intersects, damagePart, warnBox } from './bossKit.js';
import { chooseWatcherAttack, popUpX, spreadTargets, crawlPlan } from '../logic/watcher.js';
import { coreDamage } from '../logic/boss.js';
import { difficultyOf, pickSideAttack } from '../logic/bossCombo.js';
import { floatText } from '../fx/effects.js';
import { make } from '../fx/textures.js';
import { sheetFacesRight } from '../fx/spriteSheets.js';

const lerp = Phaser.Math.Linear;
const W = 260; // 기어 다니는 와처 그림 크기
const H = 170;
const FLAT_H = 100; // 지쳐서 엎드린 그림 높이
const SHEET_H = 290; // 스프라이트 시트(아들 그림)를 쓸 때 화면 높이
const SHEET_W = Math.round((SHEET_H * 344) / 384); // 한 칸 비율 그대로
const SHEET_FOOT = 34; // 시트 칸 아래 빈 공간 (화면 픽셀)
const HALF = 105; // 몸 반쪽 너비
const ARM_UP = 36; // 할퀴는 팔이 지나가는 높이 (가슴 높이, 점프로 넘을 수 있음)
const ARM_T = 22; // 팔 두께
const CEIL = 330; // 천장을 기어갈 때 땅에서의 높이

// 처음 보는 공격이면 로봇 볼트가 알려 주는 말
const TIPS = {
  claw: '긴 팔이 가슴 높이로 할퀴어! 점프로 넘거나 대시로 통과해! 땅에 박힌 팔은 때릴 수 있어!',
  burrow: '땅속으로 숨었다! 초록으로 갈라지는 곳에서 튀어나와. 거기서 멀리 떨어져!',
  spit: '독 점액이다! 초록 원을 피해! 독 웅덩이에 서 있으면 조금씩 아파.',
  vines: '덩굴이 솟아! 잎사귀 표시에서 비켜! 잡히면 대시로 빠져나와!',
  crawl: '벽을 타고 천장으로 간다! 떨어지는 독 방울 표시를 피해!',
  tired: '와처가 지쳐서 엎드렸어! 지금! 등의 초록 독혹을 때려!',
  head: '엎드린 와처의 머리가 보여! 충전 펀치로 때려!',
};

// 겹치기 공격: 큰 공격을 하는 동안 같이 쓸 수 있는 작은 공격 (난이도의 bossCombo 확률)
const SIDE_ATTACKS = {
  claw: ['spit', 'vines'],
  burrow: ['vines'],
  spit: ['vines'],
  vines: ['spit'],
  crawl: ['vines'],
};

// 포레스트 와처 (아들이 디자인한 보스): 긴 팔다리로 기어 다니는 마른 숲 괴물.
// 땅에 박힌 긴 팔, 지쳐서 엎드렸을 때 등의 독혹을 때린다.
// 둘 다 부수면 지칠 때마다 머리(약점)가 낮게 내려온다.
export class WatcherBoss extends BossBase {
  constructor(scene, cfg, stage, skin = 2) {
    super(scene, cfg, stage, skin);
    this.diff = difficultyOf(cfg);
    this.hpScale *= this.diff.bossHealth;
    this.tempo *= this.diff.bossSpeed;
    const k = (this.k = cfg.watcherBoss);
    this.skinKey = skin;
    this.leftWall = this.arenaStart + HALF + 10;
    this.rightWall = this.arenaEnd - HALF - 10;
    this.x = this.arenaEnd - 230;
    this.bodyX = this.x;
    this.air = 0; // 땅에서 떨어진 높이 (천장 기어가기)
    this.angle = 0;
    this.facing = -1;
    this.squash = 1;
    this.alpha = 1;
    this.flashT = 0;
    this.blisterFlash = 0;

    this.hazG = scene.add.graphics().setDepth(1);
    this.shadowG = scene.add.graphics().setDepth(1.5);
    this.armG = scene.add.graphics().setDepth(6);
    this.vineG = scene.add.graphics().setDepth(7);
    this.sprite = scene.add.sprite(this.x, this.groundY, `watcher_${skin}`).setOrigin(0.5, 1).setDepth(5).setDisplaySize(W, H);
    // art.js 에 스프라이트 시트(아들 그림)가 있으면 그 애니메이션을 쓴다
    this.sheet = scene.anims.exists(`watcher_${skin}_anim`);
    this.sheetRight = sheetFacesRight(scene, `watcher_${skin}`);
    if (this.sheet) this.sprite.play(`watcher_${skin}_anim`);
    this.blister = scene.add.image(this.x, this.groundY, 'watcher_blister').setDepth(6).setDisplaySize(70, 44);

    const hp = this.hpScale;
    this.arm = new BossPart('긴 팔', Math.round(k.armHealth * hp));
    this.back = new BossPart('등 독혹', Math.round(k.backHealth * hp));
    this.head = new BossPart('머리', Math.round(k.headHealth * hp));
    this.totalMax = this.arm.health.max + this.back.health.max + this.head.health.max;
    this.headOpen = false;

    this.puddles = new Puddles(scene, this.hazG, { damage: k.puddleDamage, color: 0x4fbf2a, edge: 0xc8ff4a, name: '독 웅덩이' });
    this.globs = [];
    this.vines = []; // 솟아오르는 덩굴 { x, t, warn, hit }
    this.grab = null; // 덩굴에 잡힌 상태
    this.action = null;
    this.side = null;
    this.combo = 0;
    this.introSaid = false;
  }

  static makeTextures(scene, stage, skin) {
    const c = stage.boss.colors || {};
    const body = c.main ?? 0x4a3526;
    const dark = c.dark ?? 0x2b1d14;
    const moss = c.moss ?? 0x55602a;
    const slime = c.slime ?? 0xb6ff2a;
    const drip = (g, x, y, len) => {
      g.fillStyle(slime).fillRoundedRect(x - 3, y, 6, len, 3).fillCircle(x, y + len, 4);
    };
    // 기어 다니는 와처 (왼쪽을 보는 모습)
    make(scene, `watcher_${skin}`, W, H, (g) => {
      // 뒷다리 (길고 마른 다리, 무릎이 높이 솟음)
      g.lineStyle(14, dark).lineBetween(190, 90, 225, 40).lineBetween(225, 40, 250, 168);
      g.lineStyle(12, body).lineBetween(170, 95, 200, 35).lineBetween(200, 35, 215, 168);
      // 몸통 (등이 둥글게 굽음)
      g.fillStyle(body).fillEllipse(150, 82, 160, 70);
      g.fillStyle(dark).fillEllipse(160, 96, 120, 30);
      // 등 가시털
      g.fillStyle(dark);
      for (let i = 0; i < 9; i++) {
        const x = 95 + i * 14;
        g.fillTriangle(x, 58 - Math.sin(i / 2) * 4, x + 12, 56, x + 4, 30 - (i % 3) * 6);
      }
      // 앞다리 (긴 팔로 땅을 짚음)
      g.lineStyle(13, dark).lineBetween(100, 80, 60, 30).lineBetween(60, 30, 40, 165);
      g.lineStyle(11, body).lineBetween(120, 90, 95, 40).lineBetween(95, 40, 88, 165);
      // 긴 손가락
      g.lineStyle(4, dark);
      for (const fx of [40, 88]) g.lineBetween(fx, 165, fx - 12, 170).lineBetween(fx, 165, fx - 2, 170).lineBetween(fx, 165, fx + 9, 170);
      // 목과 머리 (사람 같은 얼굴, 큰 검은 눈)
      g.lineStyle(16, body).lineBetween(95, 75, 55, 95);
      g.fillStyle(body).fillEllipse(40, 102, 52, 62);
      g.fillStyle(0xd8c7a8).fillEllipse(36, 106, 40, 50);
      g.fillStyle(0x111111).fillEllipse(27, 98, 13, 17).fillEllipse(46, 98, 13, 17);
      g.fillStyle(0xffffff).fillCircle(25, 94, 2.5).fillCircle(44, 94, 2.5);
      g.lineStyle(2, 0x3a2a1c).beginPath();
      g.moveTo(24, 118);
      g.lineTo(36, 122);
      g.lineTo(48, 118);
      g.strokePath();
      g.fillStyle(0xf2f0d0);
      for (let i = 0; i < 5; i++) g.fillRect(27 + i * 4, 118, 2, 3);
      // 독 점액 흐름
      drip(g, 150, 78, 22);
      drip(g, 175, 90, 30);
      drip(g, 70, 60, 26);
      drip(g, 195, 60, 18);
      g.fillStyle(moss).fillCircle(130, 70, 6).fillCircle(185, 75, 5);
    });

    // 지쳐서 엎드린 와처 (팔다리를 쭉 뻗고 바닥에 붙음)
    make(scene, `watcher_flat_${skin}`, W, FLAT_H, (g) => {
      g.lineStyle(12, dark).lineBetween(150, 80, 250, 96).lineBetween(110, 80, 20, 96);
      g.lineStyle(10, body).lineBetween(170, 84, 240, 98).lineBetween(100, 84, 40, 98);
      g.fillStyle(body).fillEllipse(140, 70, 170, 46);
      g.fillStyle(dark);
      for (let i = 0; i < 9; i++) {
        const x = 85 + i * 15;
        g.fillTriangle(x, 52, x + 12, 50, x + 5, 34 - (i % 3) * 4);
      }
      g.fillStyle(body).fillEllipse(50, 78, 50, 40);
      g.fillStyle(0xd8c7a8).fillEllipse(46, 80, 38, 30);
      // 지쳐서 눈을 감음
      g.lineStyle(3, 0x111111).lineBetween(32, 78, 42, 80).lineBetween(50, 80, 60, 78);
      drip(g, 150, 70, 16);
      drip(g, 120, 66, 20);
    });

    // 등의 독혹 (부술 수 있음)
    make(scene, 'watcher_blister', 70, 44, (g) => {
      g.fillStyle(0x7ad01a).fillEllipse(35, 26, 66, 36);
      g.fillStyle(0xd8ff4a).fillCircle(20, 22, 10).fillCircle(42, 18, 12).fillCircle(56, 28, 7);
      g.fillStyle(0xffffff, 0.8).fillCircle(38, 13, 4).fillCircle(17, 18, 3);
    });

    make(scene, 'slime_glob', 24, 24, (g) => {
      g.fillStyle(0xb6ff2a).fillCircle(12, 12, 12);
      g.fillStyle(0xeaffb0).fillCircle(8, 8, 4);
    });
  }

  // ---------- 위치 도우미 ----------

  get tired() {
    return this.action?.type === 'tired';
  }

  get mouthX() {
    return this.x + this.facing * 95;
  }

  get mouthY() {
    return this.groundY - 64;
  }

  get shoulder() {
    return { x: this.x + this.facing * 40, y: this.groundY - 100 };
  }

  blisterPos() {
    if (this.tired) return { x: this.x - this.facing * 10, y: this.groundY - 48 };
    return { x: this.x - this.facing * 15, y: this.groundY - 118 - this.air };
  }

  blisterRect() {
    const b = this.blisterPos();
    return new Rect(b.x - 44, b.y - 30, 88, 64);
  }

  headRect() {
    const hx = this.x + this.facing * 85;
    return new Rect(hx - 45, this.groundY - 60, 90, 60);
  }

  bodyRect() {
    const h = this.tired ? FLAT_H : H;
    return new Rect(this.x - 115, this.groundY - this.air - h, 230, h);
  }

  armRect(a) {
    const x0 = Math.min(this.shoulder.x, a.tipX);
    const x1 = Math.max(this.shoulder.x, a.tipX);
    return new Rect(x0, a.armY - ARM_T / 2 - 4, x1 - x0, ARM_T + 8);
  }

  facePlayer() {
    const p = this.scene.player;
    if (Math.abs(p.x - this.x) > 20) this.facing = p.x < this.x ? -1 : 1;
  }

  // 경고 글자가 화면 밖으로 나가지 않게
  label(i, text, x, y, size, color) {
    super.label(i, text, Phaser.Math.Clamp(x, this.arenaStart + 160, this.arenaEnd - 160), y, size, color);
  }

  // 글자 칸 번호가 띄엄띄엄이어도 괜찮게 (BossBase 것은 빈 칸에서 멈춤)
  hideLabels() {
    for (const l of this.labels) l?.setVisible(false);
  }

  // ---------- HUD, 궁극기 ----------

  // 볼트 레이저가 노릴 자리 (때릴 수 있는 부위만)
  robotTargets() {
    if (this.state !== 'fight' || this.defeated) return [];
    const mid = (r) => ({ x: r.centerX, y: r.centerY });
    const a = this.action;
    if (a?.type === 'claw' && a.phase === 'stuck' && this.arm.alive) return [mid(this.armRect(a))];
    if (this.tired && this.headOpen) return [mid(this.headRect())];
    if (this.tired && this.back.alive) return [mid(this.blisterRect())];
    return [];
  }

  hudParts() {
    return [
      this.arm.hud('part'),
      this.back.hud('part'),
      { label: this.headOpen ? '머리 (약점!)' : '머리 (잠김)', ratio: this.head.health.ratio, kind: 'core', locked: !this.headOpen },
    ];
  }

  totalRatio() {
    return [this.arm, this.back, this.head].reduce((s, p) => s + p.health.current, 0) / this.totalMax;
  }

  receiveUltimate(damage) {
    if (this.state !== 'fight' || this.defeated) return false;
    if (this.arm.alive) this.hitArm(damage, { ult: true });
    else if (this.back.alive) this.hitBack(damage, { ult: true });
    else this.hitHead(damage, { ult: true });
    return true;
  }

  // ---------- 흐름 ----------

  update(dt) {
    this.flashT = Math.max(0, this.flashT - dt);
    this.blisterFlash = Math.max(0, this.blisterFlash - dt);
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

    this.clearFx();
    this.armG.clear();
    this.shadowG.clear();
    this.vineG.clear();
    this.puddles.update(dt, this.groundY, this.t);

    if (!this.action) {
      this.timer -= dt;
      this.facePlayer();
      if (this.timer <= 0 && !this.scene.player.dead) this.startAction();
    } else {
      const a = this.action;
      a.t += dt;
      if (a.type === 'claw') this.runClaw(dt);
      else if (a.type === 'burrow') this.runBurrow(dt);
      else if (a.type === 'spit') this.runSpit(dt);
      else if (a.type === 'vines') this.runVinesAction(dt);
      else if (a.type === 'crawl') this.runCrawl(dt);
      else if (a.type === 'tired') this.runTired(dt);
    }
    if (this.side) this.runSide(dt);
    this.updateVines(dt);
    this.updateGrab(dt);
    this.updateGlobs(dt);
    this.draw();
  }

  draw() {
    const s = this.sprite;
    const tired = this.tired;
    const breathe = this.action ? 0 : Math.sin(this.t * 3) * 0.03;
    const sq = this.squash + breathe;
    if (this.sheet) {
      // 지치면 납작 엎드리고(세로로 눌림) 움직임이 느려진다
      s.setDisplaySize(SHEET_W * (2 - sq), SHEET_H * sq * (tired ? 0.62 : 1));
      s.anims.timeScale = tired ? 0.35 : this.raging ? 1.5 : 1;
      s.setPosition(this.x, this.groundY - this.air + SHEET_FOOT * (tired ? 0.62 : 1));
      s.setFlipX(this.sheetRight ? this.facing < 0 : this.facing > 0);
    } else {
      s.setTexture(tired ? `watcher_flat_${this.skinKey}` : `watcher_${this.skinKey}`);
      s.setDisplaySize(W * (2 - sq), (tired ? FLAT_H : H) * sq);
      s.setPosition(this.x, this.groundY - this.air);
      s.setFlipX(this.facing > 0);
    }
    s.setAngle(this.angle);
    s.setAlpha(this.alpha);
    this.bodyX = this.x;
    if (this.flashT > 0) s.setTintFill(0xffffff);
    else if (this.raging) s.setTint(0xffa0a0);
    else s.clearTint();

    const showBlister = this.back.alive && this.alpha > 0.5 && this.angle === 0;
    this.blister.setVisible(showBlister);
    if (showBlister) {
      const b = this.blisterPos();
      const big = tired ? 1.3 + Math.sin(this.t * 10) * 0.08 : 1 + Math.sin(this.t * 4) * 0.05;
      this.blister.setPosition(b.x, b.y).setDisplaySize(70 * big, 44 * big);
      if (this.blisterFlash > 0) this.blister.setTintFill(0xffffff);
      else if (tired && Math.floor(this.t * 8) % 2 === 0) this.blister.setTint(0xfff3a0);
      else this.blister.clearTint();
    }
  }

  startAction() {
    const k = this.k;
    if (this.combo >= Math.max(1, Math.round(k.comboLength))) {
      this.startTired();
      return;
    }
    const type = chooseWatcherAttack(this.def.phases, this.arm.alive, this.back.alive, this.lastType);
    this.lastType = type;
    this.combo += 1;
    const a = { type, phase: 'aim', t: 0 };
    if (type === 'claw') {
      this.facePlayer();
      const wall = this.facing < 0 ? this.arenaStart + 10 : this.arenaEnd - 10;
      a.len = Math.min(k.clawLength, Math.abs(wall - this.shoulder.x));
      a.tipX = this.shoulder.x;
      a.armY = this.groundY - ARM_UP;
      a.hasHit = false;
    } else if (type === 'burrow') {
      a.phase = 'sink';
    } else if (type === 'spit') {
      this.facePlayer();
      a.count = Math.max(1, Math.round(k.spitCount + (this.raging ? 1 : 0)));
      a.fired = 0;
    } else if (type === 'vines') {
      this.addVines(Math.max(1, Math.round(k.vineCount + (this.raging ? 1 : 0))));
    } else if (type === 'crawl') {
      a.plan = crawlPlan(this.x, this.arenaStart + 20, this.arenaEnd - 20);
      a.phase = 'run';
      const count = Math.max(1, Math.round(k.dripCount + (this.raging ? 1 : 0)));
      a.drops = spreadTargets(this.scene.player.x, count, this.arenaStart + 60, this.arenaEnd - 60).map((x) => ({ x, done: false }));
    }
    this.action = a;
    this.scene.sfxPlay('warn');
    this.tip(type, TIPS[type]);
    if (!this.side) {
      const sideType = pickSideAttack(SIDE_ATTACKS, type, this.diff.bossCombo);
      if (sideType) this.side = { type: sideType, t: 0, phase: 'wait', delay: 0.45 * this.speed, count: 2, fired: 0 };
    }
  }

  endAction(idle = this.k.idleTime) {
    this.action = null;
    this.squash = 1;
    this.air = 0;
    this.angle = 0;
    this.alpha = 1;
    this.timer = idle * this.speed;
  }

  // ---------- 긴 팔 할퀴기 (땅에 박히면 때릴 기회) ----------

  runClaw(_dt) {
    const a = this.action;
    const k = this.k;
    const m = this.speed;
    const dir = this.facing;
    const sh = this.shoulder;
    const fullTip = sh.x + dir * a.len;
    const drawArm = (y) => {
      const elbow = { x: (sh.x + a.tipX) / 2, y: Math.min(sh.y, y) - 30 };
      this.armG.lineStyle(ARM_T, 0x2b1d14, 1).lineBetween(sh.x, sh.y, elbow.x, elbow.y).lineBetween(elbow.x, elbow.y, a.tipX, y);
      this.armG.lineStyle(ARM_T - 8, 0x5a4230, 1).lineBetween(sh.x, sh.y, elbow.x, elbow.y).lineBetween(elbow.x, elbow.y, a.tipX, y);
      this.armG.lineStyle(5, 0x2b1d14, 1);
      for (const off of [-12, 0, 12]) this.armG.lineBetween(a.tipX, y, a.tipX + dir * 26, y + off);
    };
    if (a.phase === 'aim') {
      const dur = k.clawWarningTime * m;
      a.tipX = sh.x - dir * 30 * Math.min(1, a.t / dur); // 팔을 뒤로 당긴다
      drawArm(sh.y + 10);
      const x0 = Math.min(sh.x, fullTip);
      warnBox(this.warn, x0, a.armY - ARM_T / 2 - 6, Math.abs(fullTip - sh.x), ARM_T + 12, this.t);
      this.label(0, dir < 0 ? '◀ 할퀴기! 점프나 대시! ◀' : '▶ 할퀴기! 점프나 대시! ▶', (sh.x + fullTip) / 2, a.armY - 60, 22);
      if (a.t >= dur) {
        a.phase = 'shoot';
        a.t = 0;
        a.from = a.tipX;
        this.scene.sfxPlay('dash');
      }
      return;
    }
    if (a.phase === 'shoot' || a.phase === 'hold') {
      if (a.phase === 'shoot') {
        a.tipX = lerp(a.from, fullTip, Math.min(1, a.t / 0.14));
        if (a.t >= 0.14) {
          a.phase = 'hold';
          a.t = 0;
        }
      } else if (a.t >= 0.12) {
        a.phase = 'drop';
        a.t = 0;
      }
      drawArm(a.armY);
      if (!a.hasHit) {
        const r = this.hurtPlayer(this.armRect(a), k.clawDamage, sh.x, 300);
        if (r !== 'miss' && r !== 'ignored') a.hasHit = true;
      }
      return;
    }
    if (a.phase === 'drop') {
      a.armY = lerp(this.groundY - ARM_UP, this.groundY - 10, Math.min(1, a.t / 0.12));
      drawArm(a.armY);
      if (a.t >= 0.12) {
        a.phase = 'stuck';
        a.t = 0;
        this.scene.dustAt(fullTip, this.groundY, 8);
        this.scene.shake(0.006, 120);
      }
      return;
    }
    if (a.phase === 'stuck') {
      drawArm(a.armY);
      if (Math.floor(this.t * 8) % 2 === 0) this.armG.lineStyle(4, 0xfff3a0, 1).strokeRect(Math.min(sh.x, a.tipX), a.armY - 16, Math.abs(a.tipX - sh.x), 30);
      this.label(5, '팔이 땅에 박혔다! 지금 때려!', (sh.x + a.tipX) / 2, this.groundY - 70, 20, '#ffd23f');
      if (a.t >= k.clawStuckTime) {
        a.phase = 'pull';
        a.t = 0;
        a.pullFrom = a.tipX;
      }
      return;
    }
    if (a.phase === 'pull') {
      a.tipX = lerp(a.pullFrom, sh.x, Math.min(1, a.t / 0.3));
      a.armY = lerp(this.groundY - 10, sh.y + 10, Math.min(1, a.t / 0.3));
      drawArm(a.armY);
      if (a.t >= 0.3) this.endAction();
    }
  }

  // ---------- 땅속으로 숨었다 튀어나오기 ----------

  runBurrow(_dt) {
    const a = this.action;
    const k = this.k;
    const m = this.speed;
    if (a.phase === 'sink') {
      const q = Math.min(1, a.t / 0.5);
      this.squash = 1 - 0.8 * q;
      this.alpha = 1 - q;
      if (Math.random() < 0.5) this.scene.dustAt(this.x + Phaser.Math.Between(-80, 80), this.groundY, 2);
      this.label(0, '땅속으로 숨는다!', this.x, this.groundY - H - 20, 22);
      if (q >= 1) {
        a.phase = 'hidden';
        a.t = 0;
        a.tx = popUpX(this.scene.player.x, this.leftWall - HALF, this.rightWall + HALF, HALF);
      }
      return;
    }
    if (a.phase === 'hidden') {
      const dur = k.burrowWarningTime * m;
      const q = Math.min(1, a.t / dur);
      // 갈라지는 땅 (초록 빛) + 빨간 경고 칸
      this.shadowG.fillStyle(0x2a5a10, 0.4 + 0.4 * q).fillEllipse(a.tx, this.groundY, 80 + 120 * q, 18);
      this.shadowG.lineStyle(3, 0xb6ff2a, 0.9);
      for (let i = -2; i <= 2; i++) this.shadowG.lineBetween(a.tx + i * 22, this.groundY - 2, a.tx + i * 30 + 8, this.groundY - 8 - 6 * q);
      warnBox(this.warn, a.tx - HALF, this.groundY - 150, HALF * 2, 150, this.t);
      this.label(0, '여기서 튀어나온다! 피해!', a.tx, this.groundY - 180, 22);
      if (Math.random() < 0.3) this.scene.dustAt(a.tx + Phaser.Math.Between(-60, 60), this.groundY, 1);
      if (a.t >= dur) {
        this.x = a.tx;
        this.facePlayer();
        a.phase = 'burst';
        a.t = 0;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.014, 260);
        this.scene.dustAt(this.x, this.groundY, 20);
        this.scene.greenGooAt(this.x, this.groundY - 20, 14);
        this.hurtPlayer(new Rect(this.x - HALF, this.groundY - 150, HALF * 2, 150), k.burstDamage, this.x, 360);
      }
      return;
    }
    if (a.phase === 'burst') {
      const q = Math.min(1, a.t / 0.25);
      this.alpha = 1;
      this.squash = q < 0.6 ? lerp(0.2, 1.2, q / 0.6) : lerp(1.2, 1, (q - 0.6) / 0.4);
      this.air = Math.sin(q * Math.PI) * 40;
      if (a.t >= 0.6) this.endAction();
    }
  }

  // ---------- 독 점액 뱉기 (웅덩이를 남김) ----------

  runSpit(_dt) {
    const a = this.action;
    const k = this.k;
    const m = this.speed;
    if (a.phase === 'aim') {
      const dur = k.spitWarningTime * m;
      this.fxG.fillStyle(0xb6ff2a, 0.4 + 0.4 * Math.sin(this.t * 25)).fillCircle(this.mouthX, this.mouthY, 14 + 12 * Math.min(1, a.t / dur));
      this.label(0, '독 점액!', this.mouthX, this.mouthY - 60, 22);
      if (a.t >= dur) {
        a.phase = 'fire';
        a.t = 0;
        a.next = 0;
      }
      return;
    }
    if (a.fired < a.count && a.t >= a.next) {
      a.fired += 1;
      a.next = a.t + 0.45 * m;
      this.facePlayer();
      this.spitAtPlayer();
    }
    if (a.fired >= a.count && this.globs.length === 0) {
      if (!a.endAt) a.endAt = a.t + 0.3;
      if (a.t >= a.endAt) this.endAction();
    }
  }

  spitAtPlayer() {
    const p = this.scene.player;
    const tx = Phaser.Math.Clamp(p.x + p.body.velocity.x * 0.35, this.arenaStart + 40, this.arenaEnd - 40);
    this.launchGlob(this.mouthX, this.mouthY, tx, Math.max(0.3, this.k.spitFlightTime), 'arc');
    this.scene.sfxPlay('spit');
  }

  launchGlob(x0, y0, tx, flight, kind) {
    const sprite = this.scene.add.image(x0, y0, 'slime_glob').setDepth(8).setDisplaySize(24, 24);
    this.globs.push({ sprite, x0, y0, tx, flight, kind, t: 0 });
  }

  updateGlobs(dt) {
    const k = this.k;
    for (const g of this.globs) {
      g.t += dt;
      const q = Math.min(1, g.t / g.flight);
      if (g.kind === 'arc') {
        g.sprite.x = lerp(g.x0, g.tx, q);
        g.sprite.y = lerp(g.y0, this.groundY - 12, q) - Math.sin(q * Math.PI) * 170;
        this.warn.fillStyle(0x3a8a1a, 0.3 + 0.4 * q).fillEllipse(g.tx, this.groundY, 30 + 40 * q, 12);
        this.warn.lineStyle(2, 0xb6ff2a, 0.9).strokeEllipse(g.tx, this.groundY, 80, 18);
      } else {
        g.sprite.x = g.tx;
        g.sprite.y = lerp(g.y0, this.groundY - 12, q * q);
      }
      if (q >= 1) {
        g.done = true;
        g.sprite.destroy();
        this.scene.greenGooAt(g.tx, this.groundY - 10, 12);
        this.hurtPlayer(new Rect(g.tx - 34, this.groundY - 60, 68, 60), k.spitDamage, g.tx, 200);
        this.puddles.add(g.tx, k.puddleWidth, k.puddleTime);
      }
    }
    this.globs = this.globs.filter((g) => !g.done);
  }

  // ---------- 덩굴 붙잡기 ----------

  addVines(count) {
    const k = this.k;
    const xs = spreadTargets(this.scene.player.x, count, this.arenaStart + 50, this.arenaEnd - 50, Math.random, 150);
    for (const x of xs) this.vines.push({ x, t: 0, warn: k.vineWarningTime * this.speed, hit: false });
  }

  runVinesAction(_dt) {
    const a = this.action;
    // 와처는 손바닥으로 땅을 짚고 덩굴을 부른다
    this.squash = 0.92 + Math.sin(this.t * 12) * 0.02;
    if (a.t > 0.3 && this.vines.length === 0) this.endAction();
  }

  updateVines(dt) {
    const k = this.k;
    const p = this.scene.player;
    for (const v of this.vines) {
      v.t += dt;
      if (v.t < v.warn) {
        const q = v.t / v.warn;
        this.warn.fillStyle(0x2f7a1a, 0.3 + 0.4 * q).fillEllipse(v.x, this.groundY, 50 + 40 * q, 14);
        this.warn.lineStyle(3, 0xb6ff2a, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeEllipse(v.x, this.groundY, 100, 22);
        // 잎사귀 표시
        this.warn.fillStyle(0x7ad01a, 0.9).fillTriangle(v.x - 12, this.groundY - 6, v.x, this.groundY - 26 - 10 * q, v.x + 12, this.groundY - 6);
        this.label(3, '덩굴 조심!', v.x, this.groundY - 70, 20);
        continue;
      }
      const grow = Math.min(1, (v.t - v.warn) / 0.12);
      const h = 130 * grow;
      for (let i = -1; i <= 1; i++) {
        const bx = v.x + i * 16;
        this.vineG.lineStyle(9, 0x2f6a14, 1).beginPath();
        this.vineG.moveTo(bx, this.groundY);
        this.vineG.lineTo(bx + 10 * Math.sin(this.t * 6 + i), this.groundY - h * 0.5);
        this.vineG.lineTo(bx - 6 * i, this.groundY - h);
        this.vineG.strokePath();
        this.vineG.fillStyle(0x7ad01a, 1).fillEllipse(bx + 8, this.groundY - h * 0.6, 14, 8);
      }
      if (!v.hit && !this.grab && grow >= 1 && intersects(new Rect(v.x - 34, this.groundY - h, 68, h), p.getBounds())) {
        v.hit = true;
        const r = p.hurt(k.vineDamage, v.x, 0);
        if (r === 'hit') this.grab = { t: 0, x: p.x, tick: 0.7 };
      }
    }
    this.vines = this.vines.filter((v) => v.t < v.warn + 0.7);
  }

  // 덩굴에 잡히면 움직일 수 없다. 대시로 빠져나온다.
  updateGrab(dt) {
    const g = this.grab;
    if (!g) return;
    const p = this.scene.player;
    g.t += dt;
    g.tick -= dt;
    if (p.dead || p.dashing || g.t >= this.k.vineHoldTime) {
      if (p.dashing) floatText(this.scene, p.x, p.y - 60, '탈출!', '#3ff0ff', 20);
      this.grab = null;
      return;
    }
    p.x = g.x;
    p.body.velocity.x = 0;
    this.vineG.lineStyle(7, 0x2f6a14, 1).lineBetween(p.x - 16, this.groundY, p.x + 10, p.y);
    this.vineG.lineStyle(7, 0x2f6a14, 1).lineBetween(p.x + 16, this.groundY, p.x - 10, p.y - 10);
    this.label(4, '덩굴에 잡혔다! 대시로 빠져나와!', p.x, p.y - 80, 18, '#ffd23f');
    if (g.tick <= 0) {
      g.tick = 0.7;
      p.hurt(Math.max(1, Math.round(this.k.vineDamage / 3)), p.x + 1, 0);
    }
  }

  // ---------- 벽 타고 천장으로 (독 방울) ----------

  runCrawl(dt) {
    const a = this.action;
    const k = this.k;
    const { startWall, endWall, dir } = a.plan;
    const sp = k.crawlSpeed * (1 / this.speed);
    // 떨어질 독 방울 자리
    for (const d of a.drops) {
      if (d.done) continue;
      this.warn.fillStyle(0x3a8a1a, 0.35).fillEllipse(d.x, this.groundY, 70, 14);
      this.warn.lineStyle(3, 0xb6ff2a, 0.6 + 0.4 * Math.sin(this.t * 20)).strokeEllipse(d.x, this.groundY, 90, 20);
    }
    if (a.drops.some((d) => !d.done)) this.label(0, '독 방울 조심!', (this.arenaStart + this.arenaEnd) / 2, 120, 22);
    if (a.phase === 'run') {
      this.facing = startWall < this.x ? -1 : 1;
      const step = Math.sign(startWall - this.x) * sp * dt;
      if (Math.abs(startWall - this.x) <= Math.abs(step)) {
        this.x = startWall;
        a.phase = 'up';
      } else this.x += step;
      return;
    }
    if (a.phase === 'up') {
      this.angle = -dir * 90; // 벽에 붙어 위로
      this.air = Math.min(CEIL, this.air + sp * dt);
      if (this.air >= CEIL) a.phase = 'ceiling';
      return;
    }
    if (a.phase === 'ceiling') {
      this.angle = 180;
      this.facing = dir;
      this.x += dir * sp * dt;
      for (const d of a.drops) {
        if (!d.done && (this.x - d.x) * dir >= 0) {
          d.done = true;
          this.launchGlob(d.x, this.groundY - CEIL + 20, d.x, 0.5, 'drop');
          this.scene.sfxPlay('spit');
        }
      }
      if ((this.x - endWall) * dir >= 0) {
        this.x = endWall;
        a.phase = 'down';
      }
      return;
    }
    if (a.phase === 'down') {
      this.angle = dir * 90;
      this.air = Math.max(0, this.air - sp * dt);
      if (this.air <= 0) {
        this.angle = 0;
        this.scene.dustAt(this.x, this.groundY, 10);
        a.phase = 'out';
      }
      return;
    }
    if (a.phase === 'out') {
      // 벽에서 싸움터 안쪽으로 걸어 나온다
      const tx = Phaser.Math.Clamp(this.x, this.leftWall, this.rightWall);
      this.facing = tx < this.x ? -1 : 1;
      const step = Math.sign(tx - this.x) * sp * dt;
      if (Math.abs(tx - this.x) <= Math.abs(step) + 1) {
        this.x = tx;
        this.endAction();
      } else this.x += step;
    }
  }

  // ---------- 지쳐서 엎드림 (때릴 기회) ----------

  startTired(extra = 0) {
    this.combo = 0;
    this.side = null;
    this.puddles.clear(); // 지치면 독 웅덩이가 마른다 (때리러 가기 편하게)
    this.action = { type: 'tired', t: 0, dur: this.k.tiredTime + extra };
    this.lastType = null;
    this.air = 0;
    this.angle = 0;
    this.alpha = 1;
    this.squash = 1;
    this.scene.sfxPlay('beep');
    this.scene.dustAt(this.x, this.groundY, 12);
    if (this.headOpen) this.tip('head', TIPS.head);
    else this.tip('tired', TIPS.tired);
  }

  runTired(_dt) {
    const a = this.action;
    const cx = this.x + this.facing * 85;
    for (let i = 0; i < 3; i++) {
      const ang = this.t * 4 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(ang) * 34;
      const sy = this.groundY - FLAT_H - 10 + Math.sin(ang) * 8;
      this.fxG.fillStyle(0xffe066, 1).fillTriangle(sx - 7, sy + 4, sx + 7, sy + 4, sx, sy - 8);
      this.fxG.fillStyle(0xffe066, 1).fillTriangle(sx - 7, sy - 3, sx + 7, sy - 3, sx, sy + 9);
    }
    const left = Math.max(0, a.dur - a.t);
    if (this.headOpen) this.label(5, `지금! 머리를 때려! ${left.toFixed(1)}`, cx, this.groundY - 150, 22, '#ffd23f');
    else if (this.back.alive) this.label(5, `지금! 등의 독혹! ${left.toFixed(1)}`, this.blisterPos().x, this.groundY - 130, 20, '#ffd23f');
    else this.label(5, '헉헉...', this.x, this.groundY - 150, 20, '#ffd23f');
    if (a.t >= a.dur) this.endAction(this.k.idleTime * 1.2);
  }

  // ---------- 겹치기 공격 (큰 공격과 동시에) ----------

  runSide(dt) {
    const sd = this.side;
    const k = this.k;
    sd.t += dt;
    if (sd.phase === 'wait') {
      if (sd.t < sd.delay) return;
      sd.phase = 'go';
      sd.t = 0;
      this.scene.sfxPlay('warn');
      if (sd.type === 'vines') {
        this.addVines(2);
        this.side = null;
      }
      return;
    }
    // 독 점액 2개 (입이 숨어 있으면 쉰다)
    if (this.alpha < 0.5 || this.angle !== 0) return;
    if (sd.t < k.spitWarningTime * this.speed) {
      this.fxG.fillStyle(0xb6ff2a, 0.4 + 0.4 * Math.sin(this.t * 25)).fillCircle(this.mouthX, this.mouthY, 14);
      this.label(2, '독도 뱉는다!', this.mouthX, this.mouthY - 90, 20);
      return;
    }
    if (sd.fired < sd.count && sd.t >= (sd.next || 0)) {
      sd.fired += 1;
      sd.next = sd.t + 0.45 * this.speed;
      this.spitAtPlayer();
    }
    if (sd.fired >= sd.count) this.side = null;
  }

  // ---------- 플레이어 공격 ----------

  receiveAttack(rect, attack) {
    if (this.state !== 'fight' || this.defeated) return false;
    const a = this.action;
    const opts = { charged: attack.kind === 'charged' };
    if (a?.type === 'claw' && a.phase === 'stuck' && this.arm.alive && intersects(rect, this.armRect(a))) {
      this.hitArm(attack.damage, opts);
      return true;
    }
    if (this.tired) {
      if (this.headOpen && intersects(rect, this.headRect())) {
        this.hitHead(coreDamage(attack, this.k.chargedPunchHeadMultiplier), opts);
        return true;
      }
      if (!this.headOpen && this.back.alive && intersects(rect, this.blisterRect())) {
        this.hitBack(attack.damage, opts);
        return true;
      }
    }
    if (this.alpha > 0.5 && intersects(rect, this.bodyRect())) {
      this.scene.sfxPlay('tink');
      if (this.t - this.lastBlockedAt > 1.2) {
        this.lastBlockedAt = this.t;
        let msg = '깡! 지칠 때까지 피해!';
        if (this.tired && this.back.alive) msg = '등의 초록 독혹을 때려!';
        else if (this.arm.alive) msg = '깡! 땅에 박힌 팔을 때려!';
        floatText(this.scene, rect.centerX, rect.y - 10, msg, '#bfc7d5', 18);
      }
    }
    return false;
  }

  hitArm(dmg, opts) {
    const a = this.action;
    const x = a?.type === 'claw' ? (this.shoulder.x + a.tipX) / 2 : this.shoulder.x;
    this.flashT = 0.07;
    this.scene.gooAt(x, this.groundY - 20, 6);
    if (damagePart(this.scene, this.arm, dmg, x, this.groundY - 60, opts)) this.breakPart(this.arm, x);
    this.checkRage(this.totalRatio());
  }

  hitBack(dmg, opts) {
    const b = this.blisterPos();
    this.blisterFlash = 0.07;
    this.scene.greenGooAt(b.x, b.y, 8);
    if (damagePart(this.scene, this.back, dmg, b.x, b.y - 50, opts)) this.breakPart(this.back, b.x);
    this.checkRage(this.totalRatio());
  }

  hitHead(dmg, opts) {
    if (!this.headOpen) return;
    const r = this.headRect();
    this.flashT = 0.07;
    this.scene.gooAt(r.centerX, r.centerY, 8);
    damagePart(this.scene, this.head, dmg, r.centerX, r.y - 30, opts);
    this.checkRage(this.totalRatio());
    if (!this.head.alive) this.defeat();
  }

  breakPart(part, x) {
    this.scene.sfxPlay('break');
    this.scene.shake(0.015, 300);
    this.scene.greenGooAt(x, this.groundY - 40, 30);
    floatText(this.scene, x, this.groundY - 150, `${part.label} 파괴!`, '#ff9a1f', 30);
    this.scene.gainXp(this.k.partXp, x, this.groundY - 120);
    if (part === this.arm) {
      // 긴 팔이 부서지면 아파서 바로 엎드린다
      this.armG.clear();
      this.startTired();
    }
    if (!this.arm.alive && !this.back.alive) {
      this.headOpen = true;
      this.scene.robot.say(['긴 팔도 독혹도 끝났어!', '이제 지쳐서 엎드리면 머리가 낮게 내려와. 충전 펀치로 끝내!'], true);
      if (this.tired) this.startTired(0.8);
    } else {
      this.scene.robot.say(`${part.label} 끝! 이제 ${this.arm.alive ? '긴 팔' : '등 독혹'}만 남았어!`, true);
    }
  }

  defeat() {
    this.action = null;
    this.side = null;
    this.grab = null;
    for (const g of this.globs) g.sprite.destroy();
    this.globs = [];
    this.vines = [];
    this.puddles.clear();
    this.armG.clear();
    this.vineG.clear();
    this.shadowG.clear();
    this.blister.setVisible(false);
    super.defeat();
  }

  collapse() {
    if (this.sheet) this.sprite.anims.stop();
    else this.sprite.setTexture(`watcher_flat_${this.skinKey}`).setDisplaySize(W, FLAT_H);
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, y: '+=40', duration: 1000 });
  }
}
