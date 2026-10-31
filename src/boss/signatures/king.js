import { Rect } from '../bossKit.js';
import { Signature } from './Signature.js';
import { canSummon, summonSpots } from '../../logic/boss.js';
import { driftToward } from '../../logic/signature.js';
import { behindSpot, boltSpots, fireRows, mixPlan, zoneAround } from '../../logic/sig_king.js';

const MIN_WARN = 0.6; // 아무리 화가 나도 이만큼은 경고를 보여 준다
const BOSS_DIM = 0.15; // 왕이 사라졌을 때 몸의 진하기

// 킹 공통: 앉은 왕은 자리를 못 옮기니 몸을 흐리게 하고 분신을 보낸다. 일어선 왕은 직접 옮겨 간다.
class KingSignature extends Signature {
  // 주인공이 갈 수 있는 끝
  get lo() {
    return this.boss.minX + 20;
  }

  get hi() {
    return (this.boss.standing ? this.boss.maxX : this.boss.maxArmX) - 20;
  }

  warnTime(base) {
    return Math.max(MIN_WARN, base * this.speed);
  }

  // 분노하면 줄어드는 시간 (경고 말고 공격 사이 박자)
  beat(base) {
    return base * this.speed;
  }

  appear(x, tint) {
    const { boss } = this;
    const face = boss.target.x >= x ? 1 : -1;
    if (boss.standing) {
      boss.kx = x;
      boss.face = face;
      boss.fadeBody(1);
    } else {
      this.double = this.own(boss.makeDouble(x, face)).setTint(tint);
    }
  }

  destroy() {
    this.boss.fadeBody(1);
    super.destroy();
  }
}

const VANISH = 0.3; // 왕이 사라지는 시간
const STRIKE = 0.14; // 내리치는 판정이 있는 시간
const STEP_AFTER = 0.5; // 내리친 뒤 멈칫 (때릴 기회)
const STEP_GAP = 70; // 주인공에게서 떨어져 나타나는 거리
const STEP_R = 110; // 내리치는 구역 반지름
const STEP_H = 150; // 내리치는 구역 높이

// 망령 왕: 사라졌다가 경고 뒤 주인공 등 뒤에 나타나 내리친다
export class PhantomStep extends KingSignature {
  static tip = '왕이 사라졌어! 빨간 칸이 나오면 얼른 앞으로 달려 나가!';

  constructor(boss) {
    super(boss);
    this.phase = 'vanish';
    this.hits = new Set();
    this.scene.sfxPlay('swoop');
  }

  // 일어선 왕은 숨은 동안 때릴 수 없다
  get hidden() {
    return this.boss.standing && this.phase === 'aim';
  }

  step() {
    const { boss, groundY } = this;
    if (this.phase === 'vanish') {
      boss.fadeBody(1 - (1 - BOSS_DIM) * Math.min(1, this.t / VANISH));
      if (this.t < VANISH) return false;
      const p = boss.target;
      this.x = behindSpot(p.x, p.facing ?? 1, STEP_GAP, this.lo, this.hi);
      this.zone = zoneAround(this.x, STEP_R, boss.minX, this.hi + 20);
      this.next('aim', this.warnTime(boss.kc.phantomWarnTime));
      this.scene.sfxPlay('warn');
    }
    if (this.phase === 'aim') {
      const k = 1 - this.left() / this.span;
      this.warnAt(this.zone.x0, groundY - STEP_H, this.zone.w, STEP_H);
      this.drawShade(this.x, k);
      boss.label(0, '등 뒤다! 달려!', this.x, groundY - STEP_H - 90, 24);
      if (this.left() > 0) return false;
      this.appear(this.x, 0xb890ff);
      this.next('strike', STRIKE);
      this.scene.sfxPlay('slam');
      this.scene.shake(0.012, 220);
      this.scene.dustAt(this.x, groundY, 14);
    }
    if (this.phase === 'strike') {
      this.hurt(new Rect(this.zone.x0, groundY - STEP_H, this.zone.w, STEP_H), boss.kc.phantomDamage, this.x, this.hits);
      this.drawSlash(1);
      if (this.left() > 0) return false;
      this.next('after', STEP_AFTER);
    }
    this.drawSlash(this.left() / this.span);
    this.double?.setAlpha(Math.min(1, this.left() * 4));
    if (!boss.standing) boss.fadeBody(1 - (1 - BOSS_DIM) * (this.left() / this.span));
    return this.left() <= 0;
  }

  next(phase, span) {
    this.phase = phase;
    this.span = span;
    this.until = this.t + span;
  }

  left() {
    return this.until - this.t;
  }

  // 등 뒤에서 커지는 검은 그림자와 두 눈
  drawShade(x, k) {
    const y = this.groundY - 70 - 30 * k;
    const r = 18 + 40 * k;
    this.g.fillStyle(0x24103a, 0.45 + 0.4 * k).fillEllipse(x, y, r * 1.7, r * 2.6);
    this.g.fillStyle(0xd8b0ff, 0.5 + 0.5 * k).fillCircle(x - r * 0.3, y - r * 0.5, 3 + 3 * k).fillCircle(x + r * 0.3, y - r * 0.5, 3 + 3 * k);
  }

  drawSlash(alpha) {
    const y = this.groundY - STEP_H / 2;
    this.g.lineStyle(14, 0xd8b0ff, 0.8 * alpha).beginPath().arc(this.x, y, STEP_R - 14, -1.2, 1.2).strokePath();
    this.g.beginPath().arc(this.x, y, STEP_R - 14, Math.PI - 1.2, Math.PI + 1.2).strokePath();
    this.g.lineStyle(5, 0xffffff, alpha).beginPath().arc(this.x, y, STEP_R - 14, -1, 1).strokePath();
    this.g.beginPath().arc(this.x, y, STEP_R - 14, Math.PI - 1, Math.PI + 1).strokePath();
  }
}

const THROW = 0.45; // 창이 날아가는 시간
const LANCE_LEN = 90; // 창 길이
const BOLTS = 5; // 내리치는 번개 줄기
const BOLT_TIME = 0.35; // 번개가 보이는 시간 (앞부분에만 맞는다)
const BOLT_HIT = 0.12;
const LANCE_AFTER = 0.5;
const ZONE_H = 220; // 번개 구역 높이

// 위에서 아래로 내리치는 번개 한 줄기
function drawBolt(g, x, top, bottom, seed, alpha = 1) {
  const n = 6;
  const points = [];
  for (let i = 0; i <= n; i++) {
    const wob = i === 0 || i === n ? 0 : Math.sin(seed * 37 + i * 9) * 22;
    points.push({ x: x + wob, y: top + ((bottom - top) * i) / n });
  }
  g.lineStyle(12, 0x6ab0ff, 0.5 * alpha).strokePoints(points, false);
  g.lineStyle(4, 0xffffff, alpha).strokePoints(points, false);
}

// 폭풍 기사왕: 번개 창을 던지고, 경고 뒤 창이 꽂힌 자리로 순간이동하며 주변을 번개로 친다
export class StormLance extends KingSignature {
  static tip = '번개 창이 꽂히면 왕이 그리로 날아와! 빨간 칸 밖으로 달려!';

  constructor(boss) {
    super(boss);
    this.from = { x: boss.bodyX + (boss.standing ? boss.face * 50 : -120), y: this.groundY - 190 };
    this.x = Math.min(this.hi, Math.max(this.lo, boss.target.x));
    this.zone = zoneAround(this.x, boss.kc.lanceRadius, boss.minX, this.hi + 20);
    this.bolts = boltSpots(this.zone, BOLTS);
    this.hold = this.warnTime(boss.kc.lanceWarnTime);
    this.hits = new Set();
    this.scene.sfxPlay('swoop');
  }

  step() {
    const { boss, groundY, t, zone } = this;
    if (t < THROW + this.hold) this.warnAt(zone.x0, groundY - ZONE_H, zone.w, ZONE_H);
    if (t < THROW) {
      const k = t / THROW;
      const y = this.from.y + (groundY - 40 - this.from.y) * k - Math.sin(k * Math.PI) * 90;
      this.drawLance(this.from.x + (this.x - this.from.x) * k, y, this.from.x <= this.x ? 1.1 + k * 0.45 : Math.PI - 1.1 - k * 0.45);
      return false;
    }
    this.drawLance(this.x, groundY - LANCE_LEN / 2, Math.PI / 2);
    if (t < THROW + this.hold) {
      if (!this.stuck) {
        this.stuck = true;
        this.scene.sfxPlay('zap');
        this.scene.dustAt(this.x, groundY, 10);
      }
      boss.label(0, '왕이 날아온다! 칸 밖으로!', this.x, groundY - ZONE_H - 30, 24);
      if (Math.sin(t * 40) > 0) drawBolt(this.g, this.x, groundY - LANCE_LEN, groundY - LANCE_LEN - 60, t, 0.7);
      return false;
    }
    if (!this.struck) {
      this.struck = true;
      this.appear(this.x, 0x9ad0ff);
      this.scene.sfxPlay('jellyZap');
      this.scene.sfxPlay('slam');
      this.scene.shake(0.016, 280);
      this.scene.dustAt(this.x, groundY, 18);
    }
    const since = t - THROW - this.hold;
    if (since < BOLT_HIT) this.hurt(new Rect(zone.x0, groundY - ZONE_H, zone.w, ZONE_H), boss.kc.lanceDamage, this.x, this.hits);
    if (since < BOLT_TIME) this.bolts.forEach((x, i) => drawBolt(this.g, x, 0, groundY, i + Math.floor(t * 20), 1 - since / BOLT_TIME));
    this.double?.setAlpha(Math.min(1, (BOLT_TIME + LANCE_AFTER - since) * 4));
    if (!boss.standing) boss.fadeBody(since < BOLT_TIME ? BOSS_DIM : 1);
    return since >= BOLT_TIME + LANCE_AFTER;
  }

  drawLance(x, y, angle) {
    const dx = (Math.cos(angle) * LANCE_LEN) / 2;
    const dy = (Math.sin(angle) * LANCE_LEN) / 2;
    this.g.lineStyle(14, 0x6ab0ff, 0.45).lineBetween(x - dx, y - dy, x + dx, y + dy);
    this.g.lineStyle(6, 0xe8f4ff, 1).lineBetween(x - dx, y - dy, x + dx, y + dy);
    this.g.fillStyle(0xffe45a, 1).fillCircle(x + dx, y + dy, 7);
  }
}

const PILLAR_W = 90; // 불기둥 너비
const PILLAR_H = 250; // 불기둥 높이 (점프로 못 넘는다)
const PILLAR_GAP = 180; // 불기둥 사이 (빈틈에 서면 안전)
const PILLAR_TIME = 0.4; // 불기둥이 타오르는 시간
const ROW_REST = 0.3; // 다음 줄 경고까지 쉬는 시간

// 마왕: 불기둥이 줄지어 터지고 부하를 부른다
export class Hellfire extends KingSignature {
  static tip = '불기둥이 줄지어 터져! 빨간 줄 사이 빈틈에 서 있어!';

  constructor(boss) {
    super(boss);
    const { kc } = boss;
    const here = boss.bodyX;
    const [from, to] = Math.abs(here - this.hi) <= Math.abs(here - this.lo) ? [this.hi, this.lo] : [this.lo, this.hi];
    this.pillars = fireRows(from, to, {
      rows: boss.raging ? 2 : 1,
      gap: PILLAR_GAP,
      warn: this.warnTime(kc.hellfireWarnTime),
      step: this.beat(kc.hellfireStep),
      rest: ROW_REST,
    });
    this.fireEnd = Math.max(...this.pillars.map((p) => p.at)) + PILLAR_TIME;
    this.hits = new Set();
    this.scene.sfxPlay('warn');
  }

  step() {
    if (this.t < this.fireEnd) {
      this.drawPillars();
      return false;
    }
    return this.summon();
  }

  drawPillars() {
    const { t, groundY } = this;
    for (const p of this.pillars) {
      if (t < p.warnAt) continue;
      const x0 = p.x - PILLAR_W / 2;
      if (t < p.at) {
        this.warnAt(x0, groundY - PILLAR_H, PILLAR_W, PILLAR_H);
        continue;
      }
      const since = t - p.at;
      if (since >= PILLAR_TIME) continue;
      if (!p.lit) {
        p.lit = true;
        this.scene.sfxPlay('fire');
        this.scene.dustAt(p.x, groundY, 6);
      }
      const alpha = 1 - since / PILLAR_TIME;
      const wob = Math.sin(t * 40 + p.x) * 8;
      this.g.fillStyle(0xd02000, 0.85 * alpha).fillRoundedRect(x0 + wob / 2, groundY - PILLAR_H, PILLAR_W - wob, PILLAR_H, 26);
      this.g.fillStyle(0xff9a1f, 0.9 * alpha).fillRoundedRect(x0 + 16, groundY - PILLAR_H * 0.82, PILLAR_W - 32, PILLAR_H * 0.82, 18);
      this.g.fillStyle(0xffe45a, alpha).fillRoundedRect(x0 + 30, groundY - PILLAR_H * 0.55, PILLAR_W - 60, PILLAR_H * 0.55, 12);
      this.hurt(new Rect(x0 + 6, groundY - PILLAR_H, PILLAR_W - 12, PILLAR_H), this.boss.kc.hellfireDamage, p.x, this.hits);
    }
  }

  // 불기둥이 끝나면 보라색 구멍을 보여 주고 부하를 부른다. 자리가 없으면 그냥 끝.
  summon() {
    const { boss, groundY } = this;
    if (!this.spots) {
      const room = Math.max(0, Math.round(boss.kc.summonMax) - boss.liveMinions);
      this.spots = summonSpots(boss.target.x, Math.min(2, room), boss.minX, boss.standing ? boss.maxX : boss.maxArmX);
      this.summonAt = this.t + this.warnTime(boss.kc.summonWarningTime);
      if (this.spots.length) this.scene.sfxPlay('summon');
    }
    if (!this.spots.length || !canSummon(boss.liveMinions, boss.kc.summonMax)) return true;
    const left = this.summonAt - this.t;
    const k = 1 - Math.max(0, left) / boss.kc.summonWarningTime;
    for (const x of this.spots) {
      this.g.fillStyle(0x7a2aff, 0.25 + 0.3 * k).fillEllipse(x, groundY - 40, 40 + 50 * k, 80 + 40 * k);
      this.g.lineStyle(3, 0xd08aff, 0.8).strokeEllipse(x, groundY - 40, 90, 120);
    }
    if (left > 0) return false;
    boss.spawnMinions(this.spots);
    return true;
  }
}

const MIX_GAP = 0.6; // 작은 위험이 나오는 간격
const BOLT_W = 70; // 낙뢰 너비
const SPIKE_W = 100; // 얼음 가시 너비
const SPIKE_H = 46; // 얼음 가시 높이 (점프로 넘는다)
const SPIKE_TIME = 0.5;
const CLOUD_R = 34; // 포자 구름 반지름
const CLOUD_Y = 70; // 구름 높이 (땅에서, 주인공 몸높이)
const CLOUD_TIME = 1.8;
const CLOUD_SPEED = 60;

// 마왕 마지막 공격: 낙뢰, 얼음 가시, 포자 구름이 번갈아 나온다
export class FinalMix extends KingSignature {
  static tip = '번개, 얼음 가시, 포자가 번갈아 나와! 빨간 칸을 보고 하나씩 피해!';

  constructor(boss) {
    super(boss);
    this.plan = mixPlan(boss.raging ? 9 : 6, this.warnTime(MIX_GAP)).map((h) => ({ ...h, hits: new Set() }));
    this.warn = this.warnTime(boss.kc.mixWarnTime);
    this.scene.sfxPlay('roar');
  }

  step(dt) {
    const { boss, groundY, t } = this;
    boss.label(0, '마지막 공격!', boss.bodyX, groundY - boss.layout().bodyH - 60, 26, '#ffd23f');
    let alive = false;
    for (const h of this.plan) {
      if (h.done) continue;
      alive = true;
      if (t < h.at) continue;
      if (h.x === undefined) {
        h.x = Math.min(this.hi, Math.max(this.lo, boss.target.x + h.offset));
        this.scene.sfxPlay('warn');
      }
      this[h.kind](h, t - h.at - this.warn, dt);
    }
    return !alive;
  }

  bolt(h, since) {
    const { groundY } = this;
    if (since < 0) {
      this.warnAt(h.x - BOLT_W / 2, groundY - 200, BOLT_W, 200);
      return;
    }
    if (!h.lit) {
      h.lit = true;
      this.scene.sfxPlay('zap');
    }
    if (since < BOLT_HIT) this.hurt(new Rect(h.x - BOLT_W / 2, groundY - 200, BOLT_W, 200), this.boss.kc.mixDamage, h.x, h.hits);
    drawBolt(this.g, h.x, 0, groundY, h.x + since, 1 - since / BOLT_TIME);
    if (since >= BOLT_TIME) h.done = true;
  }

  spike(h, since) {
    const { groundY } = this;
    if (since < 0) {
      this.warnAt(h.x - SPIKE_W / 2, groundY - SPIKE_H, SPIKE_W, SPIKE_H);
      return;
    }
    if (!h.lit) {
      h.lit = true;
      this.scene.sfxPlay('spikeBurst');
    }
    const up = Math.min(1, since / 0.1) * Math.min(1, (SPIKE_TIME - since) / 0.15);
    const tall = SPIKE_H * Math.max(0, up);
    for (const off of [-34, 0, 34]) {
      this.g.fillStyle(0x8fdcff, 0.95).fillTriangle(h.x + off - 16, groundY, h.x + off, groundY - tall, h.x + off + 16, groundY);
      this.g.fillStyle(0xeafaff, 1).fillTriangle(h.x + off - 6, groundY, h.x + off, groundY - tall * 0.7, h.x + off + 6, groundY);
    }
    if (up > 0.6) this.hurt(new Rect(h.x - SPIKE_W / 2 + 6, groundY - tall, SPIKE_W - 12, tall), this.boss.kc.mixDamage, h.x, h.hits);
    if (since >= SPIKE_TIME) h.done = true;
  }

  spore(h, since, dt) {
    const { boss, groundY } = this;
    const y = groundY - CLOUD_Y;
    if (since < 0) {
      this.warnAt(h.x - CLOUD_R, y - CLOUD_R, CLOUD_R * 2, CLOUD_R * 2);
      return;
    }
    const aim = this.scene.nearestPlayer(h.x);
    h.x = driftToward({ x: h.x, y }, { x: aim.x, y }, CLOUD_SPEED, dt, boss.minX, this.hi + 20).x;
    const alpha = Math.min(0.8, (CLOUD_TIME - since) * 2);
    this.g.fillStyle(0x9acd32, alpha * 0.6).fillCircle(h.x, y, CLOUD_R);
    this.g.fillStyle(0xd8ff6a, alpha * 0.8).fillCircle(h.x - 10, y - 7, CLOUD_R * 0.45).fillCircle(h.x + 12, y + 5, CLOUD_R * 0.35);
    const r = CLOUD_R * 0.7;
    this.hurt(new Rect(h.x - r, y - r, r * 2, r * 2), boss.kc.mixDamage, h.x, h.hits);
    if (since >= CLOUD_TIME) h.done = true;
  }
}

export const kingSignatures = { phantomStep: PhantomStep, stormLance: StormLance, hellfire: Hellfire, finalMix: FinalMix };
