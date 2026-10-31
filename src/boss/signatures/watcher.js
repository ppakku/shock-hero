import { GroundWaves, Rect, intersects } from '../bossKit.js';
import { Signature } from './Signature.js';
import { driftToward, fanOut } from '../../logic/signature.js';
import { cloneSlots, pickReal, rushDone, rushPath } from '../../logic/sig_watcher.js';
import { floatText } from '../../fx/effects.js';

const AIM = 0.9; // 구름이 나올 자리를 보여 주는 시간
const LIFE = 3.2; // 구름이 떠다니는 시간
const R = 44; // 구름 반지름
const CLOUD_Y = 70; // 구름 높이 (땅에서, 주인공 몸높이)

// 늪 괴물 와처: 천천히 따라오는 포자 구름, 구름이 사라지면 양쪽으로 진흙 파도
export class Spores extends Signature {
  static tip = '포자 구름이 따라온다! 느리니까 멀리 달아나고, 구름이 사라지면 진흙 파도를 뛰어넘어!';

  constructor(boss) {
    super(boss);
    const dir = boss.facing || -1;
    const count = boss.raging ? 3 : 2;
    const y = this.groundY - CLOUD_Y;
    this.clouds = fanOut(boss.x, dir, count, 150).map((x) => ({ x: Math.min(boss.maxX, Math.max(boss.minX, x)), y, hits: new Set() }));
    this.damage = boss.k.signatureDamage;
    this.drift = boss.k.sporeSpeed;
    this.mud = new GroundWaves(this.scene, this.g, { damage: this.damage, speed: boss.k.mudWaveSpeed, color: 0x5a4a22, light: 0x9acd32 });
  }

  step(dt) {
    const aim = AIM * this.speed;
    if (this.t < aim) {
      for (const c of this.clouds) this.warnAt(c.x - R, c.y - R, R * 2, R * 2);
      return false;
    }
    const left = aim + LIFE - this.t;
    if (left <= 0) {
      if (!this.waved) {
        this.waved = true;
        for (const dir of [-1, 1]) this.mud.spawn(this.boss.x, dir, this.boss.maxX - this.boss.minX);
      }
      this.mud.update(dt, this.groundY, this.boss.minX, this.boss.maxX);
      return this.mud.list.length === 0;
    }
    const alpha = Math.min(0.75, left);
    for (const c of this.clouds) {
      const aimAt = this.boss.scene.nearestPlayer(c.x);
      Object.assign(c, driftToward(c, { x: aimAt.x, y: this.groundY - CLOUD_Y }, this.drift, dt, this.boss.minX, this.boss.maxX));
      this.g.fillStyle(0x9acd32, alpha * 0.55).fillCircle(c.x, c.y, R);
      this.g.fillStyle(0xd8ff6a, alpha * 0.7).fillCircle(c.x - 12, c.y - 8, R * 0.45).fillCircle(c.x + 16, c.y + 6, R * 0.35);
      this.hurt(new Rect(c.x - R * 0.7, c.y - R * 0.7, R * 1.4, R * 1.4), this.damage, c.x, c.hits);
    }
    return false;
  }
}

const FADE = 0.45; // 와처가 사라지는 시간
const SHOW = 0.3; // 분신이 나타나는 시간
const FIG_ALPHA = 0.8; // 분신 진하기
const FIG_TINT = 0x7a6a9a; // 분신은 모두 같은 그림자 색 (진짜도 똑같다)
const HIT_W = 150; // 분신을 때릴 수 있는 너비
const HIT_H = 170; // 분신을 때릴 수 있는 높이
const LOW = 0.42; // 달려들 때 납작해지는 비율
const RUSH_H = 64; // 달려드는 분신에 맞는 높이 (점프로 넘을 수 있음)
const MIN_WARN = 0.6; // 분노해도 이만큼은 경고한다
const EYE_X = 0.36; // 진짜 눈 자리: 몸 가운데에서 앞으로 (그림 너비 비율)
const EYE_Y = 0.36; // 진짜 눈 자리: 머리 꼭대기에서 아래로 (그림 높이 비율)

// 그림자 와처: 사라진 뒤 분신이 나타난다. 눈이 빛나는 것이 진짜.
// 가짜는 때리면 사라지고, 진짜를 때리거나 시간이 다 되면 남은 가짜가 경고 뒤 달려든다.
export class Clones extends Signature {
  static tip = '와처가 그림자로 나뉘었어! 가짜는 때리면 사라져. 눈이 빛나는 진짜를 때리면 끝! 남은 가짜는 달려드니 뛰어넘어!';

  constructor(boss) {
    super(boss);
    this.phase = 'fade';
    this.phaseAt = 0;
    this.damage = boss.k.signatureDamage;
    this.figs = [];
    this.found = false;
  }

  go(phase) {
    this.phase = phase;
    this.phaseAt = this.t;
  }

  get phaseT() {
    return this.t - this.phaseAt;
  }

  get midX() {
    return (this.boss.arenaStart + this.boss.arenaEnd) / 2;
  }

  step(dt) {
    if (this.phase === 'fade') this.stepFade();
    else if (this.phase === 'hunt') this.stepHunt();
    else if (this.phase === 'warn') this.stepWarn();
    else return this.stepRush(dt);
    return false;
  }

  stepFade() {
    const q = Math.min(1, this.phaseT / FADE);
    this.boss.alpha = 1 - q;
    this.boss.label(0, '그림자로 사라진다!', this.boss.x, this.groundY - 200, 22);
    if (q >= 1) this.showFigures();
  }

  showFigures() {
    const b = this.boss;
    const count = b.k.cloneCount + (b.raging ? 1 : 0) + 1;
    const xs = cloneSlots(b.leftWall, b.rightWall, count);
    const real = pickReal(count);
    this.figs = xs.map((x, i) => this.makeFigure(x, i === real));
    b.alpha = 0;
    b.x = xs[real]; // 끝나면 진짜 자리에서 나타난다
    this.go('hunt');
  }

  makeFigure(x, real) {
    const b = this.boss;
    const key = `watcher_${b.skinKey}`;
    const sp = this.own(this.scene.add.sprite(x, b.sprite.y, key).setOrigin(0.5, 1).setDepth(5));
    const w = b.sprite.displayWidth;
    const h = b.sprite.displayHeight;
    sp.setDisplaySize(w, h).setTint(FIG_TINT).setAlpha(0);
    if (b.sheet) sp.play(`${key}_anim`);
    return { x, real, sp, w, h, foot: b.sprite.y - this.groundY, dir: -1, hits: new Set() };
  }

  // 분신이 dir 쪽을 보게 돌린다
  turn(f, dir) {
    const b = this.boss;
    f.dir = dir;
    f.sp.setFlipX(b.sheet && b.sheetRight ? dir < 0 : dir > 0);
  }

  drawEye(f) {
    const x = f.x + f.dir * f.w * EYE_X;
    const y = this.groundY + f.foot - f.h * (1 - EYE_Y);
    const glow = 0.55 + 0.35 * Math.sin(this.t * 7);
    this.g.fillStyle(0xffe066, glow * 0.45).fillCircle(x, y, 11);
    this.g.fillStyle(0xfff6c0, glow + 0.1).fillCircle(x, y, 4.5);
  }

  stepHunt() {
    const left = this.boss.k.cloneTime - this.phaseT;
    const show = Math.min(1, this.phaseT / SHOW) * FIG_ALPHA;
    for (const f of this.figs) {
      this.turn(f, this.scene.nearestPlayer(f.x).x < f.x ? -1 : 1);
      f.sp.setAlpha(show);
      if (f.real) this.drawEye(f);
    }
    this.boss.label(0, `진짜를 찾아라! ${Math.max(0, left).toFixed(1)}`, this.midX, 110, 22, '#ffd23f');
    if (this.found || left <= 0) this.startWarn();
  }

  startWarn() {
    const b = this.boss;
    for (const f of this.figs) if (f.real) f.sp.destroy();
    this.figs = this.figs.filter((f) => !f.real);
    b.alpha = 1;
    b.facePlayer();
    this.scene.dustAt(b.x, this.groundY, 10);
    for (const f of this.figs) {
      f.path = rushPath(f.x, this.scene.nearestPlayer(f.x).x, b.k.cloneRushReach, b.arenaStart + 40, b.arenaEnd - 40);
      this.turn(f, f.path.dir);
      f.sp.setAlpha(FIG_ALPHA);
    }
    this.warnTime = Math.max(MIN_WARN, b.k.cloneWarningTime * this.speed);
    this.go('warn');
    this.scene.sfxPlay('warn');
  }

  stepWarn() {
    const q = Math.min(1, this.phaseT / this.warnTime);
    for (const f of this.figs) {
      const { from, to, dir } = f.path;
      this.warnAt(Math.min(from, to), this.groundY - RUSH_H, Math.abs(to - from), RUSH_H);
      this.flatten(f, 1 - (1 - LOW) * q); // 납작 엎드리며 뒤로 당긴다
      f.x = from - dir * 18 * q;
      f.sp.x = f.x;
    }
    if (this.figs.length) this.boss.label(0, '분신이 달려든다! 뛰어넘거나 대시!', this.midX, this.groundY - 150, 22);
    if (q >= 1) this.go('rush');
  }

  flatten(f, sq) {
    f.sp.setDisplaySize(f.w * (2 - sq), f.h * sq);
    f.sp.y = this.groundY + f.foot * sq;
  }

  stepRush(dt) {
    const speed = this.boss.k.cloneRushSpeed;
    for (const f of this.figs) {
      f.x += f.path.dir * speed * dt;
      f.sp.x = f.x;
      if (Math.random() < 0.5) this.scene.dustAt(f.x, this.groundY, 1);
      this.hurt(new Rect(f.x - 50, this.groundY - RUSH_H, 100, RUSH_H), this.damage, f.x - f.path.dir * 40, f.hits);
      if (rushDone(f.x, f.path)) {
        this.poof(f);
        f.done = true;
      }
    }
    this.figs = this.figs.filter((f) => !f.done);
    return this.figs.length === 0;
  }

  poof(f) {
    this.scene.dustAt(f.x, this.groundY - 40, 10);
    f.sp.destroy();
  }

  // 찾는 동안과 경고 중에는 분신을 때릴 수 있다. 맞았으면 true.
  takeHit(rect) {
    if (this.phase !== 'hunt' && this.phase !== 'warn') return false;
    let hit = false;
    for (const f of this.figs) {
      if (!intersects(rect, new Rect(f.x - HIT_W / 2, this.groundY - HIT_H, HIT_W, HIT_H))) continue;
      hit = true;
      if (f.real) {
        this.found = true;
        floatText(this.scene, f.x, this.groundY - HIT_H - 20, '진짜다!', '#ffd23f', 26);
      } else {
        f.gone = true;
        floatText(this.scene, f.x, this.groundY - HIT_H - 20, '가짜!', '#bfc7d5', 20);
        this.poof(f);
      }
    }
    this.figs = this.figs.filter((f) => !f.gone);
    return hit;
  }

  // 공격 중에 보스가 쓰러지거나 엎드려도 몸을 되돌린다
  destroy() {
    const b = this.boss;
    b.alpha = 1;
    b.bodyX = b.x;
    b.sprite.setAlpha(1).setX(b.x);
    super.destroy();
  }
}

export const watcherSignatures = { spores: Spores, clones: Clones };
