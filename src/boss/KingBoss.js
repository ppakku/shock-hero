import Phaser from 'phaser';
import { ArmBoss } from './ArmBoss.js';
import { make } from '../fx/textures.js';
import { Health } from '../logic/health.js';
import { flash, floatText } from '../fx/effects.js';
import { coreDamage, rockTargets, pickPattern, canSummon, summonSpots } from '../logic/boss.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
const lerp = Phaser.Math.Linear;
const WAVE_H = 44;
const STAND_W = 160;
const STAND_H = 240;

const TIPS = {
  summon: '부하를 불렀어! 보라색 구멍에서 나와. 먼저 잡아도 되고 피해도 돼!',
  leap: '왕이 뛰어올라! 그림자 밖으로 피하고, 땅이 울리면 점프!',
  charge: '돌진이다! 빨간 길을 대시로 뚫고 지나가!',
};

// 킹 돌연변이: 왕좌에 앉은 커다란 왕. 팔 보스 공격을 다 쓰고 부하도 부른다.
// 팔을 다 부수면 왕좌에서 일어나 싸움터를 뛰어다니며 싸운다 (마지막 단계).
export class KingBoss extends ArmBoss {
  constructor(scene, cfg, stage, skin = 5) {
    super(scene, cfg, stage, skin);
    this.kc = cfg.kingBoss;
    this.coreHealth = new Health(Math.round(this.c.coreHealth * this.hpScale * (this.kc.coreMultiplier || 1)));
    this.throne = scene.add.image(this.bodyX + 20, this.groundY, `boss_throne_${skin}`).setOrigin(0.5, 1).setDepth(1.5).setDisplaySize(300, 360);
    this.minions = [];
    this.standing = false;
    this.standStage = null;
    this.kx = this.bodyX;
    this.ky = this.groundY;
    this.face = -1;
    this.kwaves = [];
  }

  layout() {
    if (this.standing) return { bodyW: STAND_W, bodyH: STAND_H };
    return { bodyW: 250, bodyH: 320 };
  }

  static makeTextures(scene, stage, skin) {
    const c = stage.boss.colors;
    const gold = 0xffd23f;
    // 왕좌에 앉은 왕 (왼쪽을 보는 모습)
    make(scene, `boss_body_${skin}`, 250, 320, (g) => {
      g.fillStyle(0x8a1020).fillPoints([{ x: 40, y: 90 }, { x: 225, y: 90 }, { x: 250, y: 320 }, { x: 15, y: 320 }], true); // 망토
      g.fillStyle(0xb01830).fillPoints([{ x: 60, y: 100 }, { x: 205, y: 100 }, { x: 225, y: 320 }, { x: 40, y: 320 }], true);
      g.fillStyle(c.main).fillRoundedRect(30, 70, 190, 250, 60); // 몸
      g.fillStyle(c.light).fillRoundedRect(50, 200, 140, 115, 40); // 배
      g.fillStyle(0xfff6e8).fillRoundedRect(28, 176, 194, 22, 10); // 털 목도리
      g.fillStyle(0x222222);
      for (let i = 0; i < 7; i++) g.fillCircle(42 + i * 28, 187, 3);
      g.fillStyle(0xfff04d).fillEllipse(70, 108, 44, 32).fillEllipse(128, 102, 38, 28); // 눈
      g.fillStyle(0xd40000).fillCircle(63, 109, 9).fillCircle(121, 103, 8);
      g.lineStyle(6, c.dark).lineBetween(48, 86, 92, 98).lineBetween(108, 92, 148, 84); // 화난 눈썹
      g.fillStyle(0x2a0e25).fillRoundedRect(46, 130, 100, 32, 14); // 입
      g.fillStyle(0xffffff);
      for (let i = 0; i < 6; i++) g.fillTriangle(50 + i * 16, 130, 62 + i * 16, 130, 56 + i * 16, 144);
      g.fillStyle(gold).fillPoints(
        [{ x: 50, y: 74 }, { x: 56, y: 22 }, { x: 82, y: 52 }, { x: 105, y: 10 }, { x: 128, y: 52 }, { x: 154, y: 22 }, { x: 162, y: 74 }],
        true,
      ); // 왕관
      g.fillStyle(0xe8a800).fillRect(50, 64, 112, 12);
      g.fillStyle(0xff3a6a).fillCircle(105, 44, 8);
      g.fillStyle(0x3fd0ff).fillCircle(70, 60, 5).fillCircle(140, 60, 5);
    });
    // 일어선 왕 (마지막 단계, 왼쪽을 보는 모습)
    make(scene, `boss_king_stand_${skin}`, STAND_W, STAND_H, (g) => {
      g.fillStyle(0x8a1020).fillPoints([{ x: 40, y: 70 }, { x: 130, y: 70 }, { x: 160, y: 236 }, { x: 60, y: 236 }], true); // 망토
      g.fillStyle(c.dark).fillRoundedRect(48, 190, 26, 50, 8).fillRoundedRect(96, 190, 26, 50, 8); // 다리
      g.fillStyle(c.main).fillRoundedRect(28, 60, 110, 145, 40); // 몸
      g.fillStyle(c.light).fillRoundedRect(40, 120, 86, 75, 26);
      g.fillStyle(0xfff6e8).fillRoundedRect(26, 108, 114, 14, 7);
      g.fillStyle(0xfff04d).fillEllipse(50, 84, 26, 20).fillEllipse(88, 80, 22, 18);
      g.fillStyle(0xd40000).fillCircle(45, 85, 6).fillCircle(84, 81, 5);
      g.fillStyle(0x2a0e25).fillRoundedRect(36, 96, 56, 14, 6);
      g.fillStyle(gold).fillPoints(
        [{ x: 38, y: 62 }, { x: 42, y: 26 }, { x: 60, y: 46 }, { x: 76, y: 16 }, { x: 92, y: 46 }, { x: 110, y: 26 }, { x: 114, y: 62 }],
        true,
      );
      g.fillStyle(0xff3a6a).fillCircle(76, 40, 6);
    });
    // 왕좌 (뒤에 있는 큰 의자)
    make(scene, `boss_throne_${skin}`, 300, 360, (g) => {
      g.fillStyle(0x3a1a40).fillRoundedRect(30, 0, 240, 360, 30);
      g.fillStyle(0x5a2a6a).fillRoundedRect(55, 30, 190, 300, 24);
      g.fillStyle(0xffd23f).fillRect(30, 0, 240, 14).fillCircle(40, 10, 18).fillCircle(260, 10, 18).fillCircle(150, 6, 22);
      g.fillStyle(0xff3a6a).fillCircle(150, 6, 10);
      g.fillStyle(0xffd23f).fillRect(0, 250, 300, 22);
      g.fillStyle(0x2a1030).fillRect(10, 272, 40, 88).fillRect(250, 272, 40, 88);
    });
    // 팔과 주먹은 팔 보스 그림 (이미 있는 키는 건너뜀)
    ArmBoss.makeTextures(scene, stage, skin);
  }

  tip(type, text = TIPS[type]) {
    super.tip(type, text);
  }

  get liveMinions() {
    this.minions = this.minions.filter((m) => !m.dead);
    return this.minions.length;
  }

  // ---------- 앉아 있는 단계: 팔 보스 공격 + 부하 부르기 ----------

  startAction(forceType = null) {
    if (this.standing) {
      this.startStandingAction(forceType);
      return;
    }
    let type = forceType;
    if (!type) {
      type = this.pickSeated();
      if (type === 'summon' && !canSummon(this.liveMinions, this.kc.summonMax)) type = this.pickSeated('summon');
    }
    if (type === 'summon') {
      this.startSummon();
      return;
    }
    super.startAction(type);
  }

  pickSeated(avoid = null) {
    const alive = this.armsAlive.length;
    const lost = this.totalArms - alive;
    const phases = this.def.phases;
    const list = (phases[Math.min(lost, phases.length - 1)] || []).filter((p) => p !== avoid && (p !== 'rocketPunch' || alive > 0));
    return pickPattern(list, this.lastType, Math.random, 'slam');
  }

  startSummon() {
    const p = this.scene.player;
    const room = Math.max(0, Math.round(this.kc.summonMax) - this.liveMinions);
    const hi = this.standing ? this.maxX : this.maxArmX;
    const spots = summonSpots(p.x, Math.min(2, room), this.minX, hi);
    this.lastType = 'summon';
    this.action = { type: 'summon', phase: 'aim', t: 0, spots };
    this.scene.sfxPlay('summon');
    this.tip('summon');
    this.combo.maybeStart('summon', this.diff.bossCombo);
  }

  runAction(dt) {
    const a = this.action;
    if (a.type === 'summon') this.runSummon(dt);
    else if (a.type === 'leap') this.runLeap(dt);
    else if (a.type === 'charge') this.runCharge(dt);
    else super.runAction(dt);
  }

  runSummon(dt) {
    const a = this.action;
    a.t += dt;
    if (a.phase === 'aim') {
      const dur = this.kc.summonWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      for (const x of a.spots) {
        this.warn.fillStyle(0x7a2aff, 0.25 + 0.3 * k).fillEllipse(x, this.groundY - 40, 40 + 50 * k, 80 + 40 * k);
        this.warn.lineStyle(3, 0xd08aff, 0.6 + 0.4 * Math.sin(this.t * 16)).strokeEllipse(x, this.groundY - 40, 90, 120);
      }
      this.label(0, '부하 소환!', this.arenaStart + 480, 120, 26, '#d08aff');
      if (a.t >= dur) {
        const kinds = this.def.minions || ['basic', 'fast', 'jumper'];
        for (const x of a.spots) {
          if (!canSummon(this.liveMinions, this.kc.summonMax)) break;
          const type = kinds[Math.floor(Math.random() * kinds.length)];
          const m = this.scene.spawnMonster({ x, type });
          this.minions.push(m);
          this.scene.dustAt(x, this.groundY, 12);
        }
        a.phase = 'after';
        a.t = 0;
      }
      return;
    }
    if (a.t >= 0.4) this.endAction();
  }

  // ---------- 팔을 다 부수면: 왕좌에서 일어난다 ----------

  exposeCore() {
    this.coreExposed = true;
    this.scene.tweens.add({ targets: this.armor, x: this.armor.x - 70, y: this.groundY - 20, angle: -120, alpha: 0, duration: 800, ease: 'Quad.easeIn' });
    if (this.action) {
      const a = this.action;
      this.action = null;
      if (a.jobs) for (const j of a.jobs) j.arm.busy = false;
      if (a.arm) this.removeFist(a.arm);
      for (const r of this.rocks) r.destroy();
      for (const g of this.globs) g.sprite.destroy();
      this.rocks = [];
      this.waves = [];
      this.globs = [];
    }
    this.clearFx();
    this.combo.clear();
    this.combo.opts.waveMaxX = undefined;
    this.standing = true;
    this.standStage = 'rise';
    this.standT = 0;
    this.scene.sfxPlay('roar');
    this.scene.shake(0.02, 900);
    this.scene.robot.say(['팔을 다 부쉈다!', '어? 왕이 일어난다! 이제 진짜 싸움이야!', '코어를 때려! 뛰어오르면 그림자 밖으로!'], true);
  }

  update(dt) {
    if (!this.standing || this.defeated) {
      super.update(dt);
      return;
    }
    this.t += dt;
    this.links.clear();
    this.warn.clear();
    this.fxG.clear();
    this.hideLabels();
    if (this.standStage !== 'ready') {
      this.runStandUp(dt);
      return;
    }
    this.updateRage();
    this.drawRage();
    this.mouthOpen = { x: this.kx + this.face * 30, y: this.groundY - 150 };
    if (!this.action) {
      this.ky = this.groundY;
      this.faceTo(this.scene.player.x);
      // 숨 고르기: 이때 코어를 때릴 기회
      this.label(0, '지금! 코어를 때려!', this.kx, this.groundY - STAND_H - 40, 20, '#ffd23f');
      this.timer -= dt;
      if (this.timer <= 0 && !this.scene.player.dead) this.startAction();
    } else {
      this.runAction(dt);
    }
    this.combo.update(dt);
    this.updateWaves(dt);
    this.placeStanding();
  }

  runStandUp(dt) {
    this.standT += dt;
    if (this.standStage === 'rise') {
      const k = Math.min(1, this.standT / 1.3);
      this.body.y = this.groundY - 30 * k + Math.sin(this.t * 50) * 3;
      this.label(0, '왕이 일어난다!', this.bodyX, this.groundY - 380, 30);
      if (Math.random() < 0.3) this.scene.dustAt(this.bodyX + Phaser.Math.Between(-120, 120), this.groundY, 2);
      if (k >= 1) {
        this.standStage = 'jump';
        this.standT = 0;
        this.blocker.body.enable = false;
        this.throne.setTint(0x777777);
        this.body.setTexture(`boss_king_stand_${this.skin}`).setDisplaySize(STAND_W, STAND_H);
        if (this.raging) this.body.setTint(0xff6a6a);
        this.jumpFrom = this.bodyX;
        this.jumpTo = (this.minX + this.maxX) / 2 + 120;
        this.scene.sfxPlay('jump');
      }
      return;
    }
    if (this.standStage === 'jump') {
      const k = Math.min(1, this.standT / 0.8);
      this.kx = lerp(this.jumpFrom, this.jumpTo, k);
      this.ky = this.groundY - Math.sin(k * Math.PI) * 200;
      this.face = -1;
      this.placeStanding();
      if (k >= 1) {
        this.ky = this.groundY;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.02, 400);
        this.scene.dustAt(this.kx, this.groundY, 24);
        this.standStage = 'ready';
        this.timer = 1.2;
        this.placeStanding();
      }
    }
  }

  placeStanding() {
    this.bodyX = this.kx;
    this.body.setPosition(this.kx, this.ky).setFlipX(this.face > 0);
    this.corePos = { x: this.kx + this.face * 10, y: this.ky - 95 };
    this.core.setPosition(this.corePos.x, this.corePos.y);
    const s = 1 + Math.sin(this.t * 8) * 0.08;
    this.core.setDisplaySize(48 * s, 48 * s);
  }

  faceTo(x) {
    if (Math.abs(x - this.kx) > 20) this.face = x > this.kx ? 1 : -1;
  }

  // 일어선 왕은 몸통 전체가 약점 (때리면 코어 체력이 깎인다)
  standRect() {
    return new Rect(this.kx - 60, this.ky - 180, 120, 180);
  }

  inhaleSide() {
    if (!this.standing) return -1;
    return this.scene.player.x < this.kx ? -1 : 1;
  }

  biteTargetX() {
    if (!this.standing) return this.biteX;
    return this.kx + this.inhaleSide() * 60;
  }

  // ---------- 일어선 왕의 공격 ----------

  startStandingAction(forceType = null) {
    const p = this.scene.player;
    let type = forceType || pickPattern(this.def.finalPhase, this.lastType, Math.random, 'leap');
    if (type === 'summon' && !canSummon(this.liveMinions, this.kc.summonMax)) type = pickPattern(this.def.finalPhase.filter((x) => x !== 'summon'), this.lastType, Math.random, 'leap');
    if (type === 'summon') {
      this.startSummon();
      return;
    }
    this.lastType = type;
    const a = { type, phase: 'aim', t: 0 };
    if (type === 'leap') {
      a.fromX = this.kx;
      a.tx = Phaser.Math.Clamp(p.x, this.minX + 20, this.maxX - 20);
    } else if (type === 'charge') {
      a.dir = p.x >= this.kx ? 1 : -1;
      const wall = a.dir > 0 ? this.maxX : this.minX;
      if (Math.abs(wall - this.kx) < 160) a.dir = -a.dir;
      a.endX = a.dir > 0 ? this.maxX : this.minX;
    } else if (type === 'rocks') {
      const count = Math.max(1, Math.round(this.c.rockCount + (this.def.rockBonus || 0)));
      a.targets = rockTargets(p.x, count, this.minX - 20, this.maxX + 20);
    }
    this.action = a;
    this.scene.sfxPlay('warn');
    this.tip(type);
    this.combo.maybeStart(type, this.diff.bossCombo);
  }

  endAction() {
    super.endAction();
    if (this.standing && !this.chained) this.timer = this.kc.tiredTime * this.tempo * this.diff.bossSpeed;
  }

  runLeap(dt) {
    const a = this.action;
    const p = this.scene.player;
    a.t += dt;
    const zone = new Rect(a.tx - 95, this.groundY - 130, 190, 130);
    if (a.phase === 'aim') {
      const dur = this.kc.leapWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      this.faceTo(a.tx);
      this.ky = this.groundY + 12 * k; // 웅크리기
      this.warn.fillStyle(0x000000, 0.3 + 0.3 * k).fillEllipse(a.tx, this.groundY, 120 + 60 * k, 20);
      this.warn.fillStyle(0xff2020, 0.25 + 0.15 * Math.sin(this.t * 18)).fillRect(zone.x, zone.y, zone.width, zone.height);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(zone.x, zone.y, zone.width, zone.height);
      this.label(0, '뛰어내린다! 피하고 점프!', a.tx, this.groundY - 210, 24);
      if (a.t >= dur) {
        a.phase = 'air';
        a.t = 0;
        this.scene.sfxPlay('jump');
      }
      return;
    }
    if (a.phase === 'air') {
      const k = Math.min(1, a.t / 0.7);
      this.kx = lerp(a.fromX, a.tx, k);
      this.ky = this.groundY - Math.sin(k * Math.PI) * 260;
      this.warn.fillStyle(0x000000, 0.45).fillEllipse(a.tx, this.groundY, 180, 20);
      if (k >= 1) {
        this.ky = this.groundY;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.018, 300);
        this.scene.dustAt(this.kx, this.groundY, 20);
        if (intersects(zone, p.getBounds())) p.hurt(this.kc.leapDamage, this.kx, 380);
        // 양쪽으로 충격파 (점프로 넘기)
        this.kwaves.push({ x: this.kx - 100, dir: -1, hasHit: false }, { x: this.kx + 100, dir: 1, hasHit: false });
        a.phase = 'after';
        a.t = 0;
      }
      return;
    }
    if (a.t >= 0.5) this.endAction();
  }

  updateWaves(dt) {
    const p = this.scene.player;
    for (const w of this.kwaves) {
      w.x += w.dir * this.c.shockwaveSpeed * dt;
      this.fxG.fillStyle(0xffb030, 0.85).fillTriangle(w.x - 26, this.groundY, w.x, this.groundY - WAVE_H, w.x + 26, this.groundY);
      this.fxG.fillStyle(0xfff3a0, 0.9).fillTriangle(w.x - 12, this.groundY, w.x, this.groundY - WAVE_H * 0.6, w.x + 12, this.groundY);
      if (!w.hasHit && intersects(new Rect(w.x - 18, this.groundY - WAVE_H, 36, WAVE_H), p.getBounds())) {
        if (p.hurt(this.c.shockwaveDamage, w.x - w.dir * 40) !== 'ignored') w.hasHit = true;
      }
    }
    this.kwaves = this.kwaves.filter((w) => w.x > this.arenaStart - 60 && w.x < this.arenaEnd + 60);
    if (this.kwaves.length) this.label(3, '점프!', this.kwaves[0].x, this.groundY - 80, 20);
  }

  runCharge(dt) {
    const a = this.action;
    const p = this.scene.player;
    a.t += dt;
    if (a.phase === 'aim') {
      const dur = this.kc.chargeWarningTime * this.speed;
      this.face = a.dir;
      this.kx += Math.sin(this.t * 50) * 1.5;
      const x0 = Math.min(this.kx, a.endX) - 40;
      const w = Math.abs(a.endX - this.kx) + 80;
      this.warn.fillStyle(0xff2020, 0.18 + 0.14 * Math.sin(this.t * 18)).fillRect(x0, this.groundY - 200, w, 200);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(x0, this.groundY - 200, w, 200);
      const arrow = a.dir < 0 ? '◀◀  돌진! 대시로 통과!  ◀◀' : '▶▶  돌진! 대시로 통과!  ▶▶';
      this.label(0, arrow, x0 + w / 2, this.groundY - 100, 24);
      if (a.t >= dur) {
        a.phase = 'run';
        a.t = 0;
        this.scene.sfxPlay('swoop');
      }
      return;
    }
    if (a.phase === 'run') {
      this.kx += a.dir * this.kc.chargeSpeed * dt;
      if (Math.random() < 0.6) this.scene.dustAt(this.kx - a.dir * 40, this.groundY, 2);
      if (!a.hasHit && intersects(this.standRect(), p.getBounds())) {
        if (p.hurt(this.kc.chargeDamage, this.kx - a.dir * 40, 420) !== 'ignored') a.hasHit = true;
      }
      const done = a.dir > 0 ? this.kx >= a.endX : this.kx <= a.endX;
      if (done) {
        this.kx = a.endX;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.014, 250);
        this.scene.dustAt(this.kx + a.dir * 40, this.groundY - 60, 14);
        floatText(this.scene, this.kx, this.groundY - STAND_H - 20, '어질어질...', '#ffd23f', 20);
        a.phase = 'after';
        a.t = 0;
      }
      return;
    }
    if (a.t >= 0.6) this.endAction();
  }

  // ---------- 플레이어 공격 ----------

  receiveAttack(rect, attack) {
    if (!this.standing) return super.receiveAttack(rect, attack);
    if (this.defeated || this.standStage !== 'ready') return false;
    if (!intersects(rect, this.standRect())) return false;
    const dmg = coreDamage(attack, this.c.chargedPunchCoreMultiplier);
    this.coreHealth.damage(dmg);
    floatText(this.scene, this.corePos.x, this.corePos.y - 50, String(dmg), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 32 : 20);
    flash(this.scene, this.body, this.raging ? 0xff6a6a : null);
    flash(this.scene, this.core);
    this.scene.gooAt(this.corePos.x, this.corePos.y, 8);
    if (this.coreHealth.isDead) this.defeat();
    return true;
  }

  receiveUltimate(damage) {
    if (this.standing && this.standStage !== 'ready') return false;
    return super.receiveUltimate(damage);
  }

  hudParts() {
    const parts = super.hudParts();
    if (this.standing) parts[parts.length - 1].label = '킹의 코어 (약점!)';
    return parts;
  }

  defeat() {
    if (this.defeated) return;
    this.kwaves = [];
    super.defeat();
  }

  collapse() {
    super.collapse();
    this.scene.tweens.add({ targets: this.throne, alpha: 0.4, duration: 900 });
  }
}
