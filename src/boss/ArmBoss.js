import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import {
  chooseBossAttack, bossSpeedMultiplier, coreDamage, rockTargets, doubleSlamTargets,
  pickRocketHeight, rocketBand, inhaleStep, shouldRage, restAfterAttack, difficultyOf,
} from '../logic/boss.js';
import { varyCount } from '../logic/bossVariety.js';
import { ComboHazards } from './comboHazards.js';
import { flash, floatText } from '../fx/effects.js';
import { makeText } from '../ui/text.js';
import { make } from '../fx/textures.js';
import { sheetFacesRight } from '../fx/spriteSheets.js';
import { BossBase } from './BossBase.js';
import { customArt } from '../config/art.js';
import { drawSwirl } from './bossFx.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
const lerp = Phaser.Math.Linear;
const RAISED_Y = 230; // 팔을 들고 있을 때 주먹 아래쪽 높이
const WAVE_H = 44; // 충격파 높이 (점프로 넘을 수 있음)
const SHEET_ORIGIN_Y = 0.9; // 스프라이트 시트 칸 아래 빈 공간(약 10%)만큼 기준점을 올림

// 처음 보는 공격이면 로봇이 알려 주는 말
const TIPS = {
  multiSlam: '연속으로 찍어! 멈추지 말고 계속 움직여!',
  doubleSlam: '두 팔이 한꺼번에 와! 빨간 곳 사이로 피해!',
  sweep: '바닥 쓸기는 점프로 못 넘어. 대시로 통과해!',
  rocks: '그림자가 보이면 피해! 돌이 떨어져.',
  shockwave: '땅이 울린다! 충격파는 점프로 넘어!',
  spit: '독침이 날아와! 한곳에 서 있지 마!',
  rocketPunch: '주먹이 날아온다! 낮으면 점프, 높으면 가만히 서 있어!',
  inhale: '빨아들인다! 반대쪽으로 계속 달려! 충전하면 느려지니까 조심!',
};
const FIST_W = 66; // 코드로 그린 날아가는 주먹 크기
const FIST_H = 56;
const ART_FIST = { w: 96, h: 66 }; // art.js 의 주먹 그림은 더 크게 (높은 펀치 띠 높이 66 에 맞춤)
const LINK_W = 30; // art.js 의 줄 띠 그림 굵기
const ARM_CUT = 148; // 팔 그림 210 높이 중 이 아래가 주먹 (art.js 에 armCut 을 적으면 그 값)

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
    const { w, h } = this.fistSize;
    if (this.fist) return new Rect(this.fist.x - w / 2 - 6, this.fist.y - h / 2 - 6, w + 12, h + 12);
    return new Rect(this.sprite.x - 35, this.sprite.y - 120, 70, 120);
  }

  // 반짝이는 부분 (주먹이 날아가 있으면 주먹)
  get shiny() {
    return this.fist || this.sprite;
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
    if (!this.hittable) {
      this.sprite.clearTint();
      this.fist?.clearTint();
    }
  }
}

// 팔 보스(스테이지 1 파쇄자, 스테이지 5 킹이 물려 씀): 팔을 다 부수면 장갑이 떨어지고 코어가 드러난다.
// stage.boss 로 이름, 팔 개수, 체력 배수, 공격 목록이 달라진다.
// 보스가 지켜야 할 약속은 src/boss/README.md 에 있다.
export class ArmBoss extends BossBase {
  constructor(scene, cfg, stage, skin = 1) {
    super(scene, cfg, stage, skin);
    // 난이도: 체력 배수, 공격 시간 배수, 겹쳐 쓰기 확률
    this.diff = difficultyOf(cfg);
    this.hpScale *= this.diff.bossHealth;
    const lay = this.layout();
    this.frontX = this.bodyX - lay.bodyW / 2;
    this.maxArmX = this.frontX - 70;
    this.mouth = { x: this.bodyX - 70, y: this.groundY - 170 };
    // 빨아들이는 입 (몸통 그림의 입 자리)
    this.mouthOpen = { x: this.bodyX - lay.bodyW * 0.14, y: this.groundY - lay.bodyH * 0.55 };
    this.biteX = this.frontX - 40;
    const colors = this.def.colors;

    this.aura = scene.add.graphics().setDepth(3);
    this.links = scene.add.graphics().setDepth(3);

    this.body = scene.add.sprite(this.bodyX, this.groundY, `boss_body_${skin}`).setOrigin(0.5, 1).setDepth(4).setDisplaySize(lay.bodyW, lay.bodyH);
    // art.js 에 스프라이트 시트(아들 그림, 예: 파쇄자)가 있으면 애니메이션으로 그린다.
    // 칸 아래 빈 공간만큼 기준점을 올려 발이 땅에 닿게 하고, 오른쪽을 보는 그림이면 뒤집어 왼쪽(주인공 쪽)을 보게 한다.
    this.sheet = scene.anims.exists(`boss_body_${skin}_anim`);
    if (this.sheet) {
      const sheetH = lay.bodyH * 1.18;
      this.body.setOrigin(0.5, SHEET_ORIGIN_Y).setDisplaySize(Math.round((sheetH * this.body.width) / this.body.height), sheetH);
      this.body.setFlipX(sheetFacesRight(scene, `boss_body_${skin}`)).play(`boss_body_${skin}_anim`);
    }
    this.blocker = scene.add.zone(this.bodyX, this.groundY - lay.bodyH / 2, lay.bodyW - 20, lay.bodyH);
    scene.physics.add.existing(this.blocker, true);

    // 약점(코어)은 몸통 앞 아래: 땅에 서서 치는 펀치가 닿는 높이여야 한다
    this.corePos = { x: this.frontX + 12, y: this.groundY - 80 };
    this.core = scene.add.image(this.corePos.x, this.corePos.y, 'boss_core').setDepth(6).setDisplaySize(56, 56);
    this.armor = scene.add.image(this.corePos.x, this.corePos.y, 'boss_armor').setDepth(7).setDisplaySize(80, 80);
    this.coreHealth = new Health(Math.round(this.c.coreHealth * this.hpScale));
    this.coreExposed = false;

    const armHp = Math.round(this.c.armHealth * this.hpScale);
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
    this.fistSize = customArt[`boss_fist_${skin}`] ? ART_FIST : { w: FIST_W, h: FIST_H };
    for (const arm of this.arms) arm.fistSize = this.fistSize;

    this.rocks = [];
    this.waves = [];
    this.globs = [];
    this.action = null;
    this.chained = false;
    this.rocketCount = 0;
    this.combo = new ComboHazards(this, { waveMaxX: this.frontX });
  }

  // 몸통 크기 (킹 돌연변이는 더 크다)
  layout() {
    return { bodyW: 220, bodyH: 280 };
  }

  static makeTextures(scene, stage, skin) {
    const boss = stage.boss;
    const c = boss.colors;
    // 보스 몸통 (왼쪽을 보는 모습)
    make(scene, `boss_body_${skin}`, 220, 280, (g) => {
      g.fillStyle(c.main).fillRoundedRect(10, 20, 200, 260, 60);
      g.fillStyle(c.light).fillRoundedRect(30, 120, 140, 150, 40);
      g.fillStyle(c.dark).fillCircle(170, 90, 10).fillCircle(150, 230, 8).fillCircle(190, 200, 6);
      g.fillStyle(0xfff04d).fillEllipse(55, 75, 40, 30).fillEllipse(110, 70, 34, 26);
      g.fillStyle(0xd40000).fillCircle(48, 76, 8).fillCircle(103, 71, 7);
      g.fillStyle(0x2a0e25).fillRoundedRect(30, 110, 100, 34, 14);
      g.fillStyle(0xffffff);
      for (let i = 0; i < 6; i++) g.fillTriangle(34 + i * 16, 110, 46 + i * 16, 110, 40 + i * 16, 124);
      if (boss.crown) {
        g.fillStyle(0xffd23f).fillPoints(
          [{ x: 40, y: 30 }, { x: 50, y: 0 }, { x: 70, y: 22 }, { x: 90, y: 0 }, { x: 110, y: 22 }, { x: 130, y: 0 }, { x: 140, y: 30 }],
          true,
        );
        g.fillStyle(0xff3a6a).fillCircle(90, 20, 6);
      }
    });

    // 보스 팔 (주먹이 아래)
    make(scene, `boss_arm_${skin}`, 70, 210, (g) => {
      g.fillStyle(c.arm).fillRoundedRect(18, 0, 34, 160, 14);
      g.fillStyle(c.dark).fillRect(18, 60, 34, 8).fillRect(18, 110, 34, 8);
      g.fillStyle(c.light).fillRoundedRect(0, 148, 70, 62, 20);
      g.lineStyle(4, c.dark).lineBetween(18, 160, 18, 200).lineBetween(35, 160, 35, 205).lineBetween(52, 160, 52, 200);
    });

    // 날아가는 주먹 (왼쪽을 보는 모습, 뒤에 불꽃)
    make(scene, `boss_fist_${skin}`, FIST_W, FIST_H, (g) => {
      g.fillStyle(0xffb030).fillTriangle(66, 10, 66, 46, 46, 28);
      g.fillStyle(0xfff3a0).fillTriangle(66, 18, 66, 38, 54, 28);
      g.fillStyle(c.light).fillRoundedRect(0, 4, 52, 48, 18);
      g.lineStyle(4, c.dark).lineBetween(8, 16, 26, 16).lineBetween(6, 28, 26, 28).lineBetween(8, 40, 26, 40);
      g.fillStyle(c.dark).fillRect(40, 8, 8, 40);
    });
  }

  // HUD 체력바에 보여 줄 부위 목록
  hudParts() {
    const parts = this.arms.map((arm) => ({
      label: arm.alive ? arm.label : `${arm.label} 파괴`,
      ratio: arm.alive ? arm.health.ratio : 0,
      kind: 'part',
    }));
    parts.push({ label: this.coreExposed ? '코어 (약점!)' : '코어 (잠김)', ratio: this.coreHealth.ratio, kind: 'core', locked: !this.coreExposed });
    return parts;
  }

  // 궁극기: 살아 있는 팔은 바닥에 없어도 맞고, 코어가 드러났으면 코어도 맞는다
  receiveUltimate(damage) {
    if (this.state !== 'fight' || this.defeated) return false;
    const target = this.armsAlive[0];
    if (target) {
      target.health.damage(damage);
      const r = target.hitRect();
      floatText(this.scene, r.centerX, r.y - 10, String(damage), '#3fd0ff', 30);
      flash(this.scene, target.shiny);
      if (target.health.isDead) this.destroyArm(target);
      return true;
    }
    if (this.coreExposed) {
      this.coreHealth.damage(damage);
      floatText(this.scene, this.corePos.x, this.corePos.y - 40, String(damage), '#3fd0ff', 32);
      flash(this.scene, this.core);
      if (this.coreHealth.isDead) this.defeat();
      return true;
    }
    return false;
  }

  // 남은 전체 체력 비율 (팔 + 코어)
  get healthRatio() {
    let cur = this.coreHealth.current;
    let max = this.coreHealth.max;
    for (const a of this.arms) {
      cur += a.alive ? a.health.current : 0;
      max += a.health.max;
    }
    return cur / max;
  }

  get armsAlive() {
    return this.arms.filter((a) => a.alive);
  }

  // 시간에 곱하는 값 (작을수록 빠름)
  get speed() {
    return bossSpeedMultiplier(this.armsAlive.length, this.totalArms) * this.tempo * this.diff.bossSpeed * (this.raging ? this.c.rageSpeed : 1);
  }

  startFight() {
    if (this.state !== 'dormant') return;
    this.state = 'intro';
    this.timer = 1.8;
    this.scene.tweens.add({ targets: this.body, x: this.bodyX + 6, duration: 60, yoyo: true, repeat: 10 });
  }

  // 분노 모드: 코어 체력이 절반 아래로 내려가면 빨개지고 공격 두 개를 쉬지 않고 이어서 한다
  rageRatio() {
    return this.coreHealth.ratio;
  }

  updateRage() {
    if (this.state !== 'fight' || this.defeated) return;
    if (shouldRage(this.rageRatio(), this.c.rageAt, this.raging)) this.enterRage();
  }

  enterRage() {
    this.raging = true;
    this.chained = false;
    this.scene.sfxPlay('rage');
    this.scene.shake(0.014, 600);
    this.body.setTint(0xff6a6a);
    floatText(this.scene, this.bodyX, this.groundY - this.layout().bodyH - 50, '분노 모드!', '#ff3030', 34);
    this.scene.robot.say(['보스가 화났어! 빨개졌다!', '이제 쉬지 않고 두 번씩 공격해. 정신 바짝 차려!'], true);
  }

  drawRage() {
    this.aura.clear();
    if (!this.raging || this.defeated) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
    const lay = this.layout();
    const cx = this.bodyX;
    this.aura.fillStyle(0xff2020, 0.12 + 0.12 * pulse).fillEllipse(cx, this.groundY - lay.bodyH / 2, lay.bodyW + 60 + pulse * 20, lay.bodyH + 50);
    this.label(7, '분노!', cx, this.groundY - lay.bodyH - 24, 22 + Math.round(pulse * 4), '#ff3030');
  }

  // 처음 보는 공격이면 로봇이 알려 준다
  tip(type, text = TIPS[type]) {
    super.tip(type, text);
  }

  update(dt) {
    this.t += dt;
    this.drawLinks();
    this.updateRage();

    if (this.coreExposed && !this.defeated) {
      const s = 1 + Math.sin(this.t * 8) * 0.08;
      this.core.setDisplaySize(56 * s, 56 * s);
    }
    for (const arm of this.arms) {
      if (arm.hittable) {
        if (arm.fist) arm.hint.setPosition(arm.fist.x + 10, arm.fist.y - 60);
        else arm.hint.setPosition(arm.sprite.x, arm.sprite.y - 230);
        arm.hint.setAlpha(0.6 + Math.sin(this.t * 12) * 0.4);
        if (Math.floor(this.t * 8) % 2 === 0) arm.shiny.setTint(0xfff3a0);
        else arm.shiny.clearTint();
      } else if (this.raging && arm.alive) arm.sprite.setTint(0xff8080);
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
      this.hideLabels();
      this.drawRage();
      this.timer -= dt;
      if (this.timer <= 0 && this.scene.anyAlive) this.startAction();
      this.combo.update(dt);
      return;
    }

    this.warn.clear();
    this.fxG.clear();
    this.hideLabels();
    this.drawRage();
    this.runAction(dt);
    this.combo.update(dt);
  }

  // 공격 종류별로 나눠 실행 (킹 돌연변이가 더 붙인다)
  runAction(dt) {
    if (this.checkFeint()) return;
    const a = this.action;
    if (a.jobs) this.runArmJobs(dt);
    else if (a.type === 'rocks') this.runRocks(dt);
    else if (a.type === 'shockwave') this.runShockwave(dt);
    else if (a.type === 'spit') this.runSpit(dt);
    else if (a.type === 'rocketPunch') this.runRocketPunch(dt);
    else if (a.type === 'inhale') this.runInhale(dt);
    else this.endAction();
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

  // 몸통 어깨와 팔을 잇는 줄. art.js 에 boss_link_<번호> 띠 그림이 있으면 그 그림을 줄 길이만큼 이어 붙여 그린다
  drawLinks() {
    this.links.clear();
    const key = `boss_link_${this.skin}`;
    const art = Boolean(customArt[key]) && this.scene.textures.exists(key);
    this.hideLinks();
    for (const arm of this.armsAlive) {
      const top = { x: arm.sprite.x, y: arm.sprite.y - 200 };
      if (art) {
        if (!arm.link) {
          const tex = this.scene.textures.get(key).getSourceImage();
          arm.link = this.scene.add.tileSprite(0, 0, 10, LINK_W, key).setDepth(3).setTileScale(LINK_W / tex.height);
        }
        const dx = top.x - arm.shoulder.x;
        const dy = top.y - arm.shoulder.y;
        arm.link
          .setVisible(true)
          .setPosition((arm.shoulder.x + top.x) / 2, (arm.shoulder.y + top.y) / 2)
          .setSize(Math.hypot(dx, dy) + 16, LINK_W)
          .setRotation(Math.atan2(dy, dx));
        continue;
      }
      this.links.lineStyle(26, arm.linkColor, 1).lineBetween(arm.shoulder.x, arm.shoulder.y, top.x, top.y);
      this.links.fillStyle(arm.linkColor, 1).fillCircle(arm.shoulder.x, arm.shoulder.y, 16).fillCircle(top.x, top.y, 14);
    }
  }

  // 줄 그림 숨기기 (부서진 팔, 쓰러질 때, 왕이 일어선 뒤)
  hideLinks() {
    for (const arm of this.arms) arm.link?.setVisible(false);
  }

  // picked: 킹 돌연변이가 대신 골라서 넘긴 공격 (진짜로 강제된 공격이 아니므로 속여도 된다)
  startAction(forceType = null, picked = false) {
    const p = this.target;
    const alive = this.armsAlive;
    const type = forceType || chooseBossAttack(this.def.phases, alive.length, this.totalArms, this.lastType);
    this.lastType = type;
    const a = { type, phase: 'aim', t: 0 };
    this.prepareAttack(a, { slam: this.c.slamWarningTime, sweep: this.c.sweepWarningTime }, !forceType || picked);
    const pickArm = () => alive[Math.floor(Math.random() * alive.length)];
    const target = () => Phaser.Math.Clamp(p.x, this.minX, this.maxArmX);

    if (type === 'slam') a.jobs = [this.makeJob(pickArm(), 'slam', target(), this.c.slamWarningTime * a.late)];
    else if (type === 'multiSlam') {
      a.jobs = [this.makeJob(pickArm(), 'slam', target(), this.c.multiSlamWarningTime, varyCount(Math.max(1, Math.round(this.c.multiSlamCount)), this.variety, Math.random, 2))];
    } else if (type === 'doubleSlam') {
      const two = Phaser.Utils.Array.Shuffle([...alive]).slice(0, 2);
      const xs = doubleSlamTargets(p.x, this.minX, this.maxArmX);
      a.jobs = two.map((arm, i) => this.makeJob(arm, 'slam', xs[i], this.c.doubleSlamWarningTime * a.late));
    } else if (type === 'sweep') {
      const job = this.makeJob(pickArm(), 'sweep', this.maxArmX, this.c.sweepWarningTime * a.late);
      job.startX = this.maxArmX;
      job.endX = this.minX;
      a.jobs = [job];
    } else if (type === 'rocks') {
      const count = varyCount(Math.max(1, Math.round(this.c.rockCount + (this.def.rockBonus || 0) + (alive.length === 0 ? 1 : 0))), this.variety, Math.random, 2);
      a.targets = rockTargets(p.x, count, this.minX, this.maxArmX + 40);
      this.scene.tweens.add({ targets: this.body, y: this.groundY - 10, duration: 120, yoyo: true });
    } else if (type === 'shockwave') {
      a.count = Math.max(1, Math.round(this.def.shockwaves || 1));
      a.spawned = 0;
    } else if (type === 'spit') {
      a.count = Math.max(1, Math.round(this.c.spitCount));
      a.fired = 0;
    } else if (type === 'rocketPunch') {
      a.arm = pickArm();
      a.height = pickRocketHeight(this.rocketCount, Math.random);
      this.rocketCount += 1;
      a.fromX = a.arm.sprite.x;
      a.fromY = a.arm.sprite.y;
      a.arm.busy = true;
    } else if (type === 'inhale') {
      this.scene.tweens.add({ targets: this.body, scaleY: this.body.scaleY * 1.06, duration: 500, yoyo: true });
    }
    if (a.jobs) for (const j of a.jobs) j.arm.busy = true;
    this.action = a;
    this.scene.sfxPlay('warn');
    this.tip(type);
    this.combo.maybeStart(type, this.diff.bossCombo);
  }

  // 속임 동작: 들고 있던 팔을 내려놓는다
  onFeintCancel(a) {
    for (const j of a.jobs ?? []) j.arm.busy = false;
  }

  makeJob(arm, kind, target, warnTime, repeats = 1) {
    return { arm, kind, target, warnTime, repeats, phase: 'aim', t: 0, hits: new Set() };
  }

  endAction() {
    const a = this.action;
    if (a?.jobs) {
      for (const j of a.jobs) {
        j.arm.busy = false;
        j.arm.setHittable(false);
      }
    }
    if (a?.arm) {
      a.arm.busy = false;
      a.arm.setHittable(false);
      this.removeFist(a.arm);
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
    const rest = restAfterAttack(this.raging, this.chained, this.restTime(this.c.idleTime) * this.speed, this.c.rageChainGap);
    this.timer = rest.wait;
    this.chained = rest.chained;
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
          job.target = Phaser.Math.Clamp(this.target.x, this.minX, this.maxArmX);
          job.phase = 'aim';
          job.t = 0;
        }
        break;
      }
      case 'slide': {
        const dur = Math.max(0.2, this.c.sweepTime);
        s.x = lerp(job.startX, job.endX, Math.min(1, job.t / dur));
        if (Math.random() < 0.5) this.scene.dustAt(s.x + 30, this.groundY, 2);
        this.hurtPlayer(arm.attackRect(), this.c.sweepDamage, s.x + 100, undefined, job.hits);
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
    this.scene.impact?.bossSlam(1); // 쿵: 잠깐 멈칫 + 화면 확대 (src/fx/impact.js)
    this.scene.sfxPlay('slam');
    this.scene.dustAt(s.x, this.groundY, 16);
    this.hurtPlayer(arm.attackRect(), damage, s.x, 320);
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
        this.scene.sfxPlay('slam');
        this.scene.shake(0.006, 150);
        const hits = new Set(); // 바위 여러 개가 한 사람을 두 번 때리지 않게
        for (const r of this.rocks) {
          this.scene.dustAt(r.x, this.groundY, 8);
          this.hurtPlayer(new Rect(r.x - 28, this.groundY - 60, 56, 60), this.c.rockDamage, r.x, undefined, hits);
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
      const dur = this.c.shockwaveWarningTime * m * a.late;
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
      this.waves.push({ x: startX, hits: new Set() });
      this.scene.sfxPlay('slam');
      this.scene.shake(0.01, 200);
      this.scene.dustAt(startX, this.groundY, 12);
      this.scene.tweens.add({ targets: this.body, y: this.groundY - 14, duration: 90, yoyo: true });
    }
    for (const w of this.waves) {
      w.x -= this.c.shockwaveSpeed * dt;
      this.fxG.fillStyle(0xffb030, 0.85).fillTriangle(w.x - 26, this.groundY, w.x, this.groundY - WAVE_H, w.x + 26, this.groundY);
      this.fxG.fillStyle(0xfff3a0, 0.9).fillTriangle(w.x - 12, this.groundY, w.x, this.groundY - WAVE_H * 0.6, w.x + 12, this.groundY);
      if (Math.random() < 0.4) this.scene.dustAt(w.x, this.groundY, 1);
      this.hurtPlayer(new Rect(w.x - 18, this.groundY - WAVE_H, 36, WAVE_H), this.c.shockwaveDamage, w.x + 40, undefined, w.hits);
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
      const p = this.target;
      const tx = Phaser.Math.Clamp(p.x + p.body.velocity.x * 0.3, this.minX - 40, this.frontX - 40);
      const sprite = this.scene.add.image(this.mouth.x, this.mouth.y, 'glob').setDepth(8).setDisplaySize(24, 24);
      this.globs.push({ sprite, tx, t: 0, done: false });
      this.scene.sfxPlay('spit');
    }
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
      if (this.scene.playersIn(box).length || k >= 1) {
        g.done = true;
        g.sprite.destroy();
        this.scene.greenGooAt(g.sprite.x, g.sprite.y, 10);
        const splash = new Rect(g.sprite.x - 30, g.sprite.y - 30, 60, 50);
        this.hurtPlayer(splash, this.c.spitDamage, g.sprite.x);
      }
    }
    if (a.fired >= a.count && this.globs.every((g) => g.done)) {
      if (!a.endAt) a.endAt = a.t + 0.3;
      if (a.t >= a.endAt) this.endAction();
    }
  }

  // ---------- 주먹 발사 (낮으면 점프, 높으면 가만히) ----------

  runRocketPunch(dt) {
    const a = this.action;
    const arm = a.arm;
    a.t += dt;
    if (!arm.alive) {
      if (a.phase !== 'gone') {
        a.phase = 'gone';
        a.t = 0;
      }
      if (a.t >= 0.4) this.endAction();
      return;
    }
    const s = arm.sprite;
    const band = rocketBand(a.height, this.groundY);
    const fistY = (band.top + band.bottom) / 2;
    const launchX = this.maxArmX + 40;
    const { w: fistW, h: fistH } = this.fistSize;
    const wallX = this.arenaStart + fistW / 2 + 4;

    if (a.phase === 'aim') {
      const dur = this.c.rocketPunchWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      // 팔을 뒤로 당긴다 (부들부들)
      const e = Phaser.Math.Easing.Cubic.Out(Math.min(1, k * 1.6));
      s.x = lerp(a.fromX, launchX + 30 * k, e) + (k > 0.5 ? Math.sin(this.t * 60) * 3 : 0);
      s.y = lerp(a.fromY, fistY + fistH / 2 + 4, e);
      this.drawRocketWarning(band, launchX, a.height, k);
      if (a.t >= dur) {
        a.phase = 'fly';
        a.t = 0;
        const frame = s.frame;
        s.setCrop(0, 0, frame.width, frame.height * ((customArt[s.texture.key]?.armCut || ARM_CUT) / 210));
        arm.fist = this.scene.add.image(s.x, fistY, `boss_fist_${this.skin}`).setDepth(8).setDisplaySize(fistW, fistH);
        this.scene.sfxPlay('rocket');
        this.scene.shake(0.006, 120);
      }
      return;
    }

    const fist = arm.fist;
    if (a.phase === 'fly') {
      fist.x -= this.c.rocketPunchSpeed * dt;
      fist.y = fistY + Math.sin(this.t * 40) * 2;
      // 불꽃 꼬리와 지나가는 높이
      const trail = Math.min(220, launchX - fist.x);
      this.fxG.fillStyle(0xffb030, 0.45).fillRect(fist.x + fistW / 2, band.top + 14, trail, band.bottom - band.top - 28);
      this.warn.lineStyle(2, 0xff4444, 0.7).strokeRect(this.arenaStart, band.top, Math.max(0, fist.x - this.arenaStart), band.bottom - band.top);
      this.label(0, a.height === 'high' ? '가만히!' : '점프!', fist.x, band.top - 26, 24);
      if (Math.random() < 0.6) this.scene.dustAt(fist.x + fistW / 2, fist.y, 1);
      const rect = new Rect(fist.x - fistW / 2, band.top, fistW, band.bottom - band.top);
      this.hurtPlayer(rect, this.c.rocketPunchDamage, fist.x + 100, 380, (a.hits ??= new Set()));
      if (fist.x <= wallX) {
        fist.x = wallX;
        a.phase = 'stuck';
        a.t = 0;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.012, 220);
        this.scene.impact?.bossSlam(1); // 쿵: 잠깐 멈칫 + 화면 확대 (src/fx/impact.js)
        this.scene.dustAt(wallX - 20, fist.y, 14);
        this.scene.tweens.add({ targets: fist, y: this.groundY - fistH / 2, angle: -20, duration: 260, ease: 'Bounce.easeOut' });
        arm.setHittable(true);
      }
      return;
    }

    if (a.phase === 'stuck') {
      if (a.t >= this.c.rocketPunchStuckTime) {
        arm.setHittable(false);
        a.phase = 'back';
        a.t = 0;
        a.backFrom = { x: fist.x, y: fist.y };
        this.scene.tweens.killTweensOf(fist);
        fist.setAngle(0).setFlipX(true);
      }
      return;
    }

    if (a.phase === 'back') {
      // 주먹이 높이 날아서 돌아온다 (돌아올 때는 아프지 않음)
      const k = Math.min(1, a.t / 0.7);
      fist.x = lerp(a.backFrom.x, s.x, k);
      fist.y = lerp(a.backFrom.y, s.y - fistH / 2, k) - Math.sin(k * Math.PI) * 180;
      if (k >= 1) this.endAction();
    }
  }

  drawRocketWarning(band, launchX, height, k) {
    const alpha = 0.18 + 0.14 * Math.sin(this.t * 18);
    const x0 = this.arenaStart;
    const w = launchX - x0;
    const h = band.bottom - band.top;
    this.warn.fillStyle(0xff2020, alpha).fillRect(x0, band.top, w, h);
    this.warn.lineStyle(3, 0xff4444, 1).strokeRect(x0, band.top, w, h);
    // 왼쪽으로 흐르는 화살표
    const cy = band.top + h / 2;
    const shift = (this.t * 240) % 120;
    for (let x = launchX - 40 - shift; x > x0 + 20; x -= 120) {
      this.warn.fillStyle(0xffe0e0, 0.85).fillTriangle(x - 22, cy, x + 4, cy - 14, x + 4, cy + 14);
    }
    const mid = (x0 + launchX) / 2;
    if (height === 'high') {
      this.label(0, '높다! 가만히!', mid, band.top - 30, 28);
      this.label(1, '점프하면 맞아!', mid, band.top - 62, 18, '#ffd23f');
    } else {
      this.label(0, '낮다! 점프!', mid, band.top - 30, 28);
      this.label(1, '▲ 점프 ▲', mid, band.top - 62, 18, '#ffd23f');
    }
    if (k > 0.6) this.label(2, '!', launchX + 10, band.top - 20, 30);
  }

  removeFist(arm) {
    if (arm.fist) {
      this.scene.tweens.killTweensOf(arm.fist);
      arm.fist.destroy();
      arm.fist = null;
    }
    if (arm.alive && arm.sprite.active) arm.sprite.setCrop();
  }

  // ---------- 빨아들이기 (반대쪽으로 달려서 버티기) ----------

  runInhale(dt) {
    const a = this.action;
    a.t += dt;
    const m = this.mouthOpen;
    const dir = this.inhaleSide();
    if (a.phase === 'aim') {
      const dur = this.c.inhaleWarningTime * this.speed * a.late;
      const k = Math.min(1, a.t / dur);
      this.fxG.fillStyle(0x10040e, 0.9).fillEllipse(m.x, m.y, 30 + 30 * k, 16 + 30 * k);
      drawSwirl(this.fxG, m.x, m.y, this.t, 0.35 + 0.3 * k, dir);
      this.label(0, '빨아들인다! 반대쪽으로 달려!', this.arenaStart + 480, 120, 26);
      if (a.t >= dur) {
        a.phase = 'pull';
        a.t = 0;
        this.scene.sfxPlay('inhale');
      }
      return;
    }
    if (a.phase === 'pull') {
      const open = 60 + Math.sin(this.t * 14) * 6;
      this.fxG.fillStyle(0x10040e, 0.95).fillEllipse(m.x, m.y, open, open * 0.9);
      drawSwirl(this.fxG, m.x, m.y, this.t, 1, dir);
      this.label(0, '버텨! 반대쪽으로 달려!', this.arenaStart + 480, 120, 26);
      if (Math.random() < 0.3) this.scene.dustAt(m.x + dir * Phaser.Math.Between(150, 600), this.groundY, 1);
      // 함께하기: 둘 다 끌려온다. 먼저 입에 닿은 사람이 깨물린다
      const target = this.biteTargetX();
      for (const p of this.scene.players) {
        if (p.dead) continue;
        p.x = inhaleStep(p.x, target, this.c.inhalePull, dt);
        if (Math.abs(p.x - target) < 2) {
          this.bite(p, dir);
          a.phase = 'after';
          a.t = 0;
          return;
        }
      }
      if (a.t >= this.c.inhaleTime) {
        a.phase = 'after';
        a.t = 0;
      }
      return;
    }
    if (a.t >= 0.5) this.endAction();
  }

  // 빨아들이는 쪽 (-1 = 왼쪽에서 끌어옴)
  inhaleSide() {
    return -1;
  }

  // 여기까지 끌려오면 깨물린다
  biteTargetX() {
    return this.biteX;
  }

  // 입까지 끌려오면 깨물고 뱉는다
  bite(p, dir) {
    this.scene.sfxPlay('bite');
    this.scene.shake(0.012, 200);
    floatText(this.scene, p.x, p.y - 60, '꽉!', '#ff5555', 30);
    const r = p.hurt(this.c.inhaleBiteDamage, p.x - dir * 100, 650);
    if (r !== 'hit') p.setVelocity(dir * 650, -260);
    this.scene.robot.say('으악, 깨물렸어! 다음엔 더 멀리 도망가!', true);
  }

  // ---------- 플레이어 공격 처리. 맞혔으면 true ----------

  receiveAttack(rect, attack) {
    if (this.state === 'dormant' || this.defeated) return false;
    let hit = false;
    for (const arm of this.armsAlive) {
      if (!arm.hittable || !intersects(rect, arm.hitRect())) continue;
      arm.health.damage(attack.damage);
      const hr = arm.hitRect();
      floatText(this.scene, hr.centerX, hr.y - 10, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 28 : 20);
      flash(this.scene, arm.shiny);
      this.scene.gooAt(hr.centerX, hr.centerY, 6);
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
      const lay = this.layout();
      const bodyRect = new Rect(this.bodyX - lay.bodyW / 2, this.groundY - lay.bodyH, lay.bodyW, lay.bodyH);
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
    if (arm.fist) {
      const f = arm.fist;
      arm.fist = null;
      this.scene.tweens.add({ targets: f, angle: 60, alpha: 0, y: f.y + 20, duration: 600, onComplete: () => f.destroy() });
    }
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
    this.scene.robot.say(['장갑이 떨어졌다! 코어가 보여!', '{strong}(으)로 끝내 버려!'], true);
    if (!this.action) this.timer = 1.2;
  }

  defeat() {
    if (this.defeated) return;
    this.endAction();
    this.combo.clear();
    this.aura.clear();
    super.defeat();
  }

  // 쓰러지는 연출 (GameScene 이 슬로모션 뒤 부른다)
  collapse() {
    const targets = [this.body, this.core, ...this.armsAlive.map((a) => a.sprite)];
    this.links.clear();
    this.hideLinks();
    this.aura.clear();
    this.scene.tweens.add({ targets, alpha: 0, y: '+=60', duration: 900 });
  }
}
