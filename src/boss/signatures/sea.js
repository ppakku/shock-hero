import { Rect } from '../bossKit.js';
import { Signature } from './Signature.js';
import { driftToward } from '../../logic/signature.js';
import { laneAngle, ringArcs, ringHits, ringReach, scatterLures } from '../../logic/sig_sea.js';
import { SWIMMER_MIN_Y } from '../../logic/swim.js';
import { stamp } from '../../fx/bossArt.js';

const TOP = 30.5; // 어둠(30) 위에 그려서 경고가 늘 보이게
const RING_START = 80; // 고리가 시작하는 반지름
const RING_BAND = 26; // 이만큼 가까우면 고리에 닿는다 (고리 절반 + 몸 절반)
const SWING = 0.6; // 틈이 주인공 자리에서 벗어나는 각도 (고리마다 좌우 번갈아)
const SINK_Y = 300; // 어둠 동안 내려앉는 높이 (초롱불에 손이 닿게)
const BOOM_TIME = 0.3; // 가짜 미끼가 터지는 불꽃 시간
const RING_PIECE = 110; // 전기 고리 그림 한 조각 길이
const LURE = 0x9dff6a; // 가짜 미끼도 진짜 초롱불과 같은 빛깔

function waterBounds(boss) {
  return { minX: boss.minX, maxX: boss.maxX, minY: SWIMMER_MIN_Y, maxY: boss.groundY - 40 };
}

// 전기 가오리: 보스에서 퍼지는 전기 고리. 고리마다 틈이 있어서 초록 통로에 있으면 지나간다.
export class ShockRings extends Signature {
  static tip = '전기 고리가 퍼져 나가! 초록 통로로 헤엄쳐서 고리의 틈으로 빠져나가!';

  constructor(boss) {
    super(boss);
    this.g.setDepth(TOP);
    this.sc = boss.sc;
    this.left = this.sc.ringCount + (boss.raging ? 1 : 0);
    this.half = this.sc.ringLaneWidth / 2;
    this.cx = boss.x;
    this.cy = boss.y;
    this.bounds = waterBounds(boss);
    this.reach = ringReach(this.cx, this.cy, this.bounds);
    this.rings = [];
    this.swing = Math.random() < 0.5 ? -SWING : SWING;
    this.aim();
  }

  // 다음 고리의 틈을 정한다. 함께하기면 주인공마다 틈이 하나씩이라 멀리 떨어져도 빠져나갈 수 있다.
  aim() {
    this.swing = -this.swing;
    const alive = this.scene.players.filter((p) => !p.dead);
    this.gaps = alive.map((p) => laneAngle(this.cx, this.cy, p.x, p.y, this.swing, this.bounds));
    this.aimT = 0;
  }

  step(dt) {
    if (this.left > 0) {
      this.aimT += dt;
      this.drawAim();
      if (this.aimT >= this.sc.ringWarningTime * this.speed) this.launch();
    }
    for (const r of this.rings) {
      const move = this.sc.ringSpeed * dt;
      r.r += move;
      this.drawRing(r);
      // 프레임이 끊겨도 이번에 지나온 폭을 다 본다
      const mid = r.r - move / 2;
      const band = RING_BAND + move / 2;
      for (const p of this.scene.players) {
        if (p.dead || r.hits.has(p) || !ringHits(p.x, p.y, this.cx, this.cy, mid, band, r.gaps, this.half)) continue;
        this.hurt(new Rect(p.x - 1, p.y - 1, 2, 2), this.sc.ringDamage, this.cx, r.hits);
      }
    }
    this.rings = this.rings.filter((r) => r.r < this.reach + RING_BAND);
    return this.left <= 0 && this.rings.length === 0;
  }

  launch() {
    this.rings.push({ r: RING_START, gaps: this.gaps, hits: new Set() });
    this.left -= 1;
    this.scene.sfxPlay('zap');
    if (this.left > 0) this.aim();
  }

  // 경고: 고리가 지나갈 자리는 빨갛게, 틈은 초록 통로로
  drawAim() {
    const k = Math.min(1, this.aimT / (this.sc.ringWarningTime * this.speed));
    const pulse = 0.6 + 0.25 * Math.sin(this.t * 18);
    for (let r = RING_START + 70; r < this.reach; r += 150) this.strokeArcs(r, this.gaps, 6, 0xff2020, pulse);
    for (const a of this.gaps) this.drawLane(a, 0.16 + 0.2 * k);
    this.boss.label(0, '전기 고리! 초록 통로로!', (this.boss.minX + this.boss.maxX) / 2, 90, 24);
  }

  drawLane(angle, alpha) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = -sin * this.half;
    const ny = cos * this.half;
    const ex = this.cx + cos * this.reach;
    const ey = this.cy + sin * this.reach;
    this.g.fillStyle(0x6aff9a, alpha);
    this.g.beginPath();
    this.g.moveTo(this.cx + nx, this.cy + ny);
    this.g.lineTo(ex + nx, ey + ny);
    this.g.lineTo(ex - nx, ey - ny);
    this.g.lineTo(this.cx - nx, this.cy - ny);
    this.g.closePath();
    this.g.fillPath();
  }

  strokeArcs(r, gaps, width, color, alpha) {
    this.g.lineStyle(width, color, alpha);
    for (const [from, to] of ringArcs(r, gaps, this.half)) {
      this.g.beginPath();
      this.g.arc(this.cx, this.cy, r, from, to);
      this.g.strokePath();
    }
  }

  // 고리 그림: 전기 띠 조각을 원을 따라 잇는다. 틈(gaps)에는 놓지 않는다
  stampRing(ring) {
    let drawn = true;
    for (const [from, to] of ringArcs(ring.r, ring.gaps, this.half)) {
      const n = Math.max(1, Math.round(((to - from) * ring.r) / RING_PIECE));
      const piece = ((to - from) * ring.r) / n;
      for (let i = 0; i < n && drawn; i++) {
        const a = from + ((to - from) * (i + 0.5)) / n;
        drawn = stamp(this.scene, 'fx_arc', this.cx + Math.cos(a) * ring.r, this.cy + Math.sin(a) * ring.r, piece * 1.15, 40, {
          rotation: a + Math.PI / 2,
          flipY: Math.floor(this.t * 24 + i) % 2 === 0,
        });
      }
    }
    return drawn;
  }

  // 찌릿찌릿한 고리
  drawRing(ring) {
    if (this.stampRing(ring)) return;
    this.strokeArcs(ring.r, ring.gaps, 16, 0x2aa8ff, 0.45);
    this.strokeArcs(ring.r, ring.gaps, 6, 0xbff8ff, 0.95);
    this.g.lineStyle(2, 0xffffff, 0.9);
    for (const [from, to] of ringArcs(ring.r, ring.gaps, this.half)) {
      const n = Math.max(2, Math.round(((to - from) * ring.r) / 22));
      this.g.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = from + ((to - from) * i) / n;
        const r = ring.r + Math.sin(i * 2.3 + this.t * 40) * 9;
        const x = this.cx + Math.cos(a) * r;
        const y = this.cy + Math.sin(a) * r;
        if (i === 0) this.g.moveTo(x, y);
        else this.g.lineTo(x, y);
      }
      this.g.strokePath();
    }
  }
}

// 어둠 아귀: 시야가 좁아지고 가짜 미끼가 떠다닌다. 가까이 가면 터지고, 진짜 불빛은 보스의 약점이다.
export class Blackout extends Signature {
  static tip = '캄캄해졌어! 빨간 테두리 불빛은 가짜라서 가까이 가면 터져, 테두리 없는 진짜 불빛을 때려!';

  constructor(boss) {
    super(boss);
    this.g.setDepth(TOP);
    this.sc = boss.sc;
    boss.combo.clear(); // 어둠에 가려질 다른 공격을 남기지 않는다
    const alive = this.scene.players.filter((p) => !p.dead);
    const count = this.sc.fakeLures + (boss.raging ? 1 : 0);
    const spots = scatterLures(count, [...alive, boss.weakSpot], waterBounds(boss), this.sc.fakeBlast * 2);
    this.lures = spots.map((s) => ({ ...s, fuse: null, boom: null, hits: new Set() }));
    this.dark = false;
  }

  // 어둠에 뚫을 구멍 (SeaBoss.updateInk 가 부른다)
  lights() {
    const spot = this.boss.weakSpot;
    return [{ x: spot.x, y: spot.y, r: 70 }, ...this.lures.map((l) => ({ x: l.x, y: l.y, r: l.fuse === null ? 48 : this.sc.fakeBlast }))];
  }

  step(dt) {
    const boss = this.boss;
    boss.faceTo(boss.target.x);
    boss.moveTo(boss.x, SINK_Y, dt, this.sc.swimSpeed * 0.6);
    if (!this.dark) {
      for (const l of this.lures) this.warnAt(l.x - 40, l.y - 40, 80, 80);
      boss.label(0, '불이 꺼진다! 빨간 곳을 피해!', (boss.minX + boss.maxX) / 2, 90, 24);
      if (this.t >= this.sc.blackoutWarningTime * this.speed) {
        this.dark = true;
        boss.startDark(this.sc.blackoutTime);
        this.scene.sfxPlay('ink');
      }
      return false;
    }
    if (boss.inkLeft <= 0) return true; // 시간이 다 됐거나 초롱불이 부서졌다
    this.drawWeakSpot();
    for (const l of this.lures) this.updateLure(l, dt);
    this.lures = this.lures.filter((l) => l.boom === null || l.boom > 0);
    return false;
  }

  drawWeakSpot() {
    if (this.boss.lure.alive) return; // 초롱불은 그림이 보인다
    const spot = this.boss.weakSpot;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    this.g.fillStyle(LURE, 0.2 + 0.2 * pulse).fillCircle(spot.x, spot.y, 34);
  }

  updateLure(l, dt) {
    const sc = this.sc;
    if (l.boom !== null) {
      l.boom = Math.max(0, l.boom - dt);
      const k = 1 - l.boom / BOOM_TIME;
      if (!l.blasted) l.blasted = this.playOnce('fx_explosion', l.x, l.y, sc.fakeBlast * 2.4, BOOM_TIME);
      if (!l.blasted) this.g.fillStyle(0xffa040, 0.7 * (1 - k)).fillCircle(l.x, l.y, sc.fakeBlast * (0.5 + 0.5 * k));
      return;
    }
    if (l.fuse === null) {
      const near = this.scene.nearestPlayer(l.x, l.y);
      Object.assign(l, driftToward(l, near, sc.fakeDrift, dt, this.boss.minX, this.boss.maxX));
      if (!near.dead && Math.hypot(near.x - l.x, near.y - l.y) <= sc.fakeTrigger) {
        l.fuse = sc.fakeFuse;
        this.scene.sfxPlay('warn');
      }
    } else {
      l.fuse -= dt;
      if (l.fuse <= 0) {
        l.boom = BOOM_TIME;
        this.scene.sfxPlay('bomb');
        const r = sc.fakeBlast * 0.85;
        this.hurt(new Rect(l.x - r, l.y - r, r * 2, r * 2), sc.fakeDamage, l.x, l.hits);
        return;
      }
    }
    this.drawLure(l);
  }

  drawLure(l) {
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 7 + l.x);
    this.g.fillStyle(LURE, 0.3 + 0.2 * pulse).fillCircle(l.x, l.y, 26);
    if (!stamp(this.scene, 'boss_sea_lure', l.x, l.y, 36, 36)) this.g.fillStyle(0xffffff, 0.9).fillCircle(l.x, l.y, 7);
    if (l.fuse === null) {
      this.g.lineStyle(3, 0xff4444, 0.6 + 0.4 * pulse).strokeCircle(l.x, l.y, 40);
    } else {
      // 불이 붙으면 터질 범위를 빨갛게 보여 준다
      this.g.fillStyle(0xff2020, 0.2 + 0.2 * Math.sin(this.t * 30)).fillCircle(l.x, l.y, this.sc.fakeBlast);
      this.g.lineStyle(4, 0xff4444, 1).strokeCircle(l.x, l.y, this.sc.fakeBlast);
    }
  }

  // 공격이 어떻게 끝나든 시야를 되돌린다
  destroy() {
    if (this.boss.inkLeft > 0) this.boss.clearInk();
    super.destroy();
  }
}

export const seaSignatures = { shockRings: ShockRings, blackout: Blackout };
