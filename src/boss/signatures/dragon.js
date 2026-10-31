import { Rect } from '../bossKit.js';
import { Signature } from './Signature.js';
import { driftToward, fanOut } from '../../logic/signature.js';
import { darkAlpha, lightningXs, releaseTimes, rollFrom, warnTime } from '../../logic/sig_dragon.js';
import { stamp } from '../../fx/bossArt.js';

const ROCK_R = 36; // 바위 반지름 (그림)
const ROCK_HIT_W = 48; // 바위 맞는 칸
const ROCK_HIT_H = 58; // 점프 높이(약 130)보다 충분히 낮게
const ROCK_LANE = 64; // 바닥 경고 줄 높이

// 바위 협곡룡: 바닥을 굴러오는 큰 바위, 점프로 넘는다
export class Boulders extends Signature {
  static tip = '큰 바위가 바닥을 굴러온다! 빨간 줄이 보이면 점프로 넘어!';

  constructor(boss) {
    super(boss);
    const k = boss.k;
    this.from = rollFrom(boss.target.x, boss.arenaStart, boss.arenaEnd);
    this.aim = warnTime(k.boulderWarningTime, this.speed);
    this.waiting = releaseTimes(k.boulderCount + (boss.raging ? 1 : 0), k.boulderGap);
    this.rocks = [];
    this.scene.sfxPlay('roar');
    this.scene.shake(0.006, 240);
  }

  step(dt) {
    const b = this.boss;
    const since = this.t - this.aim;
    while (this.waiting.length && since >= this.waiting[0]) {
      this.waiting.shift();
      this.rocks.push({ x: this.from.x, roll: 0, hits: new Set() });
      this.scene.sfxPlay('slam');
    }
    // 아직 나올 바위가 있으면 줄을 계속 보여 준다
    if (this.waiting.length) this.warnAt(b.arenaStart, this.groundY - ROCK_LANE, b.arenaEnd - b.arenaStart, ROCK_LANE);
    if (since < 0) b.label(0, '바위가 굴러온다! 점프로 넘어!', (b.arenaStart + b.arenaEnd) / 2, this.groundY - 130, 24);
    const speed = b.k.boulderSpeed;
    for (const r of this.rocks) {
      r.x += this.from.dir * speed * dt;
      r.roll += (speed * dt) / ROCK_R;
      this.drawRock(r);
      this.hurt(new Rect(r.x - ROCK_HIT_W / 2, this.groundY - ROCK_HIT_H, ROCK_HIT_W, ROCK_HIT_H), b.k.boulderDamage, r.x - this.from.dir * 40, r.hits);
      if (Math.random() < 0.35) this.scene.dustAt(r.x - this.from.dir * ROCK_R, this.groundY, 1);
    }
    this.rocks = this.rocks.filter((r) => r.x > b.arenaStart - 60 && r.x < b.arenaEnd + 60);
    return since >= 0 && !this.waiting.length && !this.rocks.length;
  }

  drawRock(r) {
    const g = this.g;
    const y = this.groundY - ROCK_R;
    g.fillStyle(0x000000, 0.3).fillEllipse(r.x, this.groundY, ROCK_R * 2, 12);
    if (stamp(this.scene, 'boss_boulder', r.x, y, ROCK_R * 2.1, ROCK_R * 2.1, { rotation: r.roll * this.from.dir })) return;
    g.fillStyle(0x4a3c32, 1).fillCircle(r.x, y, ROCK_R);
    g.fillStyle(0x7a6654, 1).fillCircle(r.x, y, ROCK_R - 5);
    g.lineStyle(4, 0x4a3c32, 1);
    // 구르는 게 보이게 금과 돌 조각을 같이 돌린다
    for (let i = 0; i < 3; i++) {
      const a = r.roll + (i * Math.PI * 2) / 3;
      const cx = r.x + Math.cos(a) * ROCK_R * 0.8;
      const cy = y + Math.sin(a) * ROCK_R * 0.8;
      g.lineBetween(r.x, y, cx, cy);
      g.fillStyle(0x9c8a76, 1).fillCircle(r.x + Math.cos(a + 1) * ROCK_R * 0.5, y + Math.sin(a + 1) * ROCK_R * 0.5, 7);
    }
  }
}

const BOLT_W = 70; // 낙뢰 맞는 폭
const BOLT_HOLD = 0.16; // 번개가 내리치는 시간

// 천둥룡: 주인공 근처 바닥에 표시, 잠시 뒤 낙뢰가 연달아
export class Lightning extends Signature {
  static tip = '바닥에 번개 표시가 떴다! 표시가 없는 틈으로 옮겨!';

  constructor(boss) {
    super(boss);
    const k = boss.k;
    const aim = warnTime(k.lightningWarningTime, this.speed);
    const xs = lightningXs(boss.target.x, k.lightningCount + (boss.raging ? 1 : 0), k.lightningGap, boss.minX, boss.maxX);
    this.bolts = xs.map((x, i) => ({ x, at: aim + i * k.lightningDelay, hits: new Set() }));
    this.end = aim + (xs.length - 1) * k.lightningDelay + BOLT_HOLD + 0.25;
    this.scene.sfxPlay('warn');
  }

  step(_dt) {
    const b = this.boss;
    let marked = false;
    for (const s of this.bolts) {
      const age = this.t - s.at;
      if (age < 0) {
        marked = true;
        this.drawMark(s.x, Math.max(0, 1 + age));
      } else if (age < BOLT_HOLD) {
        this.strike(s);
      }
    }
    if (marked) b.label(0, '번개 표시! 틈으로 옮겨!', (b.arenaStart + b.arenaEnd) / 2, 110, 24);
    return this.t >= this.end;
  }

  drawMark(x, q) {
    const gy = this.groundY;
    this.g.fillStyle(0xfff3a0, 0.05 + 0.12 * q).fillRect(x - BOLT_W / 2, 0, BOLT_W, gy);
    this.warnAt(x - BOLT_W / 2, gy - 16, BOLT_W, 16);
    this.g.lineStyle(3, 0xfff3a0, 0.5 + 0.5 * q).strokeEllipse(x, gy, BOLT_W + 14, 22);
  }

  strike(s) {
    const gy = this.groundY;
    if (!s.fired) {
      s.fired = true;
      this.scene.sfxPlay('slam');
      this.scene.shake(0.007, 120);
      this.scene.sparks.explode(12, s.x, gy - 10);
      this.scene.dustAt(s.x, gy, 6);
    }
    this.g.fillStyle(0xeaf6ff, 0.8).fillEllipse(s.x, gy, BOLT_W + 20, 20);
    this.hurt(new Rect(s.x - BOLT_W / 2 + 6, 0, BOLT_W - 12, gy), this.boss.k.lightningDamage, s.x, s.hits);
    if (stamp(this.scene, 'fx_bolt', s.x, 0, BOLT_W * 1.6, gy + 8, { flipX: Math.floor(this.t * 30) % 2 === 0 })) return;
    // 구불구불한 번개 줄기 (굵고 푸른 빛 위에 가는 흰 줄)
    const pts = [];
    for (let y = 0; y < gy; y += 50) pts.push({ x: s.x + (Math.random() - 0.5) * 40, y });
    pts.push({ x: s.x, y: gy });
    for (const [w, color, alpha] of [[20, 0x7ab8ff, 0.5], [6, 0xffffff, 1]]) {
      this.g.lineStyle(w, color, alpha).beginPath();
      this.g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) this.g.lineTo(p.x, p.y);
      this.g.strokePath();
    }
  }
}

const ORB_R = 24; // 구슬 반지름
const ORB_Y = 64; // 구슬 높이 (땅에서). 점프로 넘을 수 있는 높이
const ORB_BLINK = 0.7; // 터지기 전 깜빡이는 시간
const ORB_BURST = 70; // 터지는 범위 (반지름)
const DARK_FADE = 0.4; // 어두워지고 밝아지는 시간
const DARK_DEPTH = 0.7; // 땅보다 위, 그림자와 경고, 보스, 주인공보다 아래

// 흑룡: 화면이 조금 어두워지고 천천히 따라오는 어둠 구슬. 시간이 지나면 터진다.
export class DarkOrbs extends Signature {
  static tip = '어둠 구슬이 따라온다! 느리니까 달아나거나 뛰어넘고, 빨갛게 깜빡이면 멀어져!';

  constructor(boss) {
    super(boss);
    const k = boss.k;
    const y = this.groundY - ORB_Y;
    const count = k.orbCount + (boss.raging ? 1 : 0);
    this.orbs = fanOut(boss.x, boss.facing || -1, count, 130).map((x) => ({ x: Math.min(boss.maxX, Math.max(boss.minX, x)), y, hits: new Set() }));
    this.aim = warnTime(k.orbWarningTime, this.speed);
    this.chaseEnd = this.aim + k.orbLife;
    this.burstAt = this.chaseEnd + ORB_BLINK;
    this.end = this.burstAt + DARK_FADE;
    // 카메라가 흔들려도 가장자리가 드러나지 않게 화면보다 크게 깐다. 공격이 끝나거나 보스가 쓰러지면 같이 지워진다.
    this.dark = this.own(this.scene.add.rectangle(480, 270, 1600, 1000, 0x06030f, 1).setScrollFactor(0).setDepth(DARK_DEPTH).setAlpha(0));
    this.scene.sfxPlay('roar');
  }

  step(dt) {
    const k = this.boss.k;
    this.dark.setAlpha(darkAlpha(this.t, this.end, DARK_FADE, k.orbDarkness));
    if (this.t < this.aim) {
      for (const o of this.orbs) this.warnAt(o.x - ORB_R, o.y - ORB_R, ORB_R * 2, ORB_R * 2);
      return false;
    }
    if (this.t < this.chaseEnd) {
      for (const o of this.orbs) this.chase(o, dt);
    } else if (this.t < this.burstAt) {
      for (const o of this.orbs) {
        this.warnAt(o.x - ORB_BURST, this.groundY - ORB_BURST * 2, ORB_BURST * 2, ORB_BURST * 2);
        this.drawOrb(o, 0xff5a5a);
      }
    } else if (!this.burst) {
      this.burst = true;
      for (const o of this.orbs) this.explode(o);
      this.orbs = [];
    }
    return this.t >= this.end;
  }

  chase(o, dt) {
    const aimAt = this.scene.nearestPlayer(o.x);
    Object.assign(o, driftToward(o, { x: aimAt.x, y: o.y }, this.boss.k.orbSpeed, dt, this.boss.minX, this.boss.maxX));
    this.drawOrb(o, 0xb06cff);
    const r = ORB_R * 0.75;
    // 부딪히면 구슬은 그 자리에서 사라진다
    if (this.hurt(new Rect(o.x - r, o.y - r, r * 2, r * 2), this.boss.k.orbDamage, o.x, o.hits) === 'hit') {
      this.pop(o);
      o.gone = true;
    }
    this.orbs = this.orbs.filter((c) => !c.gone);
  }

  drawOrb(o, rim) {
    const pulse = 1 + Math.sin(this.t * 10) * 0.08;
    this.g.fillStyle(rim, 0.35).fillCircle(o.x, o.y, ORB_R * 1.5 * pulse);
    if (stamp(this.scene, 'dark_orb', o.x, o.y, ORB_R * 2.2 * pulse, ORB_R * 2.2 * pulse)) return;
    this.g.fillStyle(0x14081f, 1).fillCircle(o.x, o.y, ORB_R);
    this.g.lineStyle(3, rim, 1).strokeCircle(o.x, o.y, ORB_R);
    this.g.fillStyle(0xe8d0ff, 0.9).fillCircle(o.x - 7, o.y - 8, 4);
  }

  pop(o) {
    this.scene.goo?.explode(10, o.x, o.y);
    this.scene.sfxPlay('tink');
  }

  explode(o) {
    this.pop(o);
    this.playOnce('fx_explosion', o.x, this.groundY + 6, ORB_BURST * 2.6, 0.45, { originY: 1 });
    this.scene.sfxPlay('slam');
    this.scene.shake(0.006, 120);
    const r = new Rect(o.x - ORB_BURST, this.groundY - ORB_BURST * 2, ORB_BURST * 2, ORB_BURST * 2);
    this.hurt(r, this.boss.k.orbDamage, o.x, o.hits);
  }
}

export const dragonSignatures = { boulders: Boulders, lightning: Lightning, darkOrbs: DarkOrbs };
