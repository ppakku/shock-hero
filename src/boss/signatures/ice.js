import { Rect, intersects } from '../bossKit.js';
import { drawIceShard } from '../bossFx.js';
import { Signature } from './Signature.js';
import { FROST } from '../../logic/boss.js';
import { galeDir, pushOutOfWall, shardStrips, snowLanes, wallRooms, wallSpots, windPush } from '../../logic/sig_ice.js';

const LANE_WARN = 0.7; // 눈덩이가 지나갈 줄을 먼저 보여 주는 시간
const SNOW_R = 20; // 눈덩이 반지름
const SNOW_Y = { low: 24, high: 96 }; // 눈덩이 높이 (땅에서). 낮으면 점프로 넘고, 높으면 서 있는 머리 위로 간다
const WIND_EDGE = 24; // 바람이 밀어붙이는 싸움터 끝 여백
const WALL_HALF = 22; // 얼음벽 반 폭
const WALL_EDGE = 240; // 싸움터 끝에서 벽까지 최소 거리 (끝 방도 얼음을 피할 만큼 넓게)
const WALL_RISE = 0.2; // 벽이 솟는 시간
const VOLLEY_LEAD = 0.4; // 벽이 솟고 첫 얼음 경고까지
const SHARD_FALL = 0.25; // 얼음이 떨어지는 시간 (경고 끝자락)
const STRIP_GAP = 8; // 얼음 자리와 안전한 자리 사이 틈

function windLines(g, boss, dir, t, alpha) {
  const { arenaStart: x0, arenaEnd: x1, groundY } = boss;
  const w = x1 - x0;
  for (let i = 0; i < 16; i++) {
    const y = 70 + ((i * 53) % (groundY - 90));
    const run = (i * 191 + t * (420 + i * 18)) % w;
    const head = dir > 0 ? x0 + run : x1 - run;
    const len = 70 + (i % 3) * 40;
    g.lineStyle(3 + (i % 2), 0xe8fbff, alpha).lineBetween(head, y, head - dir * len, y);
  }
}

// 눈보라 아스트라: 바람선 경고 뒤 강풍이 한쪽으로 밀고, 그동안 눈덩이가 날아온다. 바람은 밀기만 한다.
export class Gale extends Signature {
  static tip = '강풍이 밀어내니까 버티면서, 낮은 눈덩이는 점프로 넘고 높은 눈덩이는 서서 피해!';

  constructor(boss) {
    super(boss);
    this.k = boss.ic;
    this.flying = boss.mode === 'fly';
    this.mid = (boss.minX + boss.maxX) / 2;
    this.dir = galeDir(this.flying, boss.target.x, boss.x, this.mid);
    // 날 때는 바람이 시작되는 끝으로 날아가고, 땅에서는 그 자리에서 분다
    this.hx = !this.flying ? boss.x : this.dir > 0 ? boss.minX + 70 : boss.maxX - 70;
    this.damage = this.k.signatureDamage;
    this.lanes = snowLanes(this.k.snowballCount + (boss.raging ? 1 : 0));
    this.balls = [];
    this.fired = 0;
    this.blow = null; // 바람이 분 시간. 경고 중에는 null
  }

  get fromX() {
    return this.boss.x + this.dir * 70;
  }

  laneRect(lane) {
    const end = this.dir > 0 ? this.boss.arenaEnd : this.boss.arenaStart;
    const y = this.groundY - SNOW_Y[lane];
    return [Math.min(this.fromX, end), y - SNOW_R, Math.abs(end - this.fromX), SNOW_R * 2];
  }

  step(dt) {
    const b = this.boss;
    b.face = this.dir;
    if (this.blow === null) {
      const there = !this.flying || b.moveTo(this.hx, FROST.highY, dt, this.k.flySpeed * 1.6);
      windLines(this.g, b, this.dir, this.t, 0.55);
      const arrow = this.dir > 0 ? '▶▶  강풍이 온다!  ▶▶' : '◀◀  강풍이 온다!  ◀◀';
      b.label(0, arrow, this.mid, 70, 26);
      if (there && this.t >= this.k.galeWarningTime * this.speed) {
        this.blow = 0;
        this.scene.sfxPlay('freeze');
        this.scene.shake(0.004, 200);
      }
      return false;
    }
    this.blow += dt;
    if (this.flying) b.y = FROST.highY + Math.sin(this.t * 2.5) * 10;
    const blowing = this.blow < this.k.galeTime * this.speed;
    if (blowing) {
      windLines(this.g, b, this.dir, this.t, 0.9);
      this.pushHeroes(dt);
    }
    this.runSnow(dt);
    return !blowing && this.fired === this.lanes.length && this.balls.length === 0;
  }

  pushHeroes(dt) {
    const { arenaStart, arenaEnd } = this.boss;
    for (const p of this.scene.players) {
      if (p.dead) continue;
      p.setX(windPush(p.x, this.dir, this.k.galeSpeed, dt, arenaStart + WIND_EDGE, arenaEnd - WIND_EDGE));
    }
  }

  runSnow(dt) {
    const gap = this.k.snowballGap * this.speed;
    const warn = LANE_WARN * this.speed;
    this.lanes.forEach((lane, i) => {
      const at = warn + i * gap;
      if (i < this.fired || this.blow < at - warn) return;
      if (this.blow < at) {
        this.warnAt(...this.laneRect(lane));
        return;
      }
      this.fired = i + 1;
      this.balls.push({ x: this.fromX, y: this.groundY - SNOW_Y[lane], hits: new Set() });
      this.scene.sfxPlay('swoop');
    });
    const { arenaStart, arenaEnd } = this.boss;
    for (const s of this.balls) {
      s.x += this.dir * this.k.snowballSpeed * dt;
      this.g.fillStyle(0x7fb8e8, 0.35).fillCircle(s.x - this.dir * 26, s.y, SNOW_R * 0.7);
      this.g.fillStyle(0xf4fcff).fillCircle(s.x, s.y, SNOW_R);
      this.g.fillStyle(0xbfe4ff).fillCircle(s.x + 5, s.y + 6, SNOW_R * 0.55);
      this.g.lineStyle(2, 0x2a5fa8).strokeCircle(s.x, s.y, SNOW_R);
      const r = SNOW_R * 0.8;
      this.hurt(new Rect(s.x - r, s.y - r, r * 2, r * 2), this.damage, s.x - this.dir * 40, s.hits);
    }
    this.balls = this.balls.filter((s) => s.x > arenaStart && s.x < arenaEnd);
  }
}

// 검은 얼음 아스트라: 경고 뒤 얼음벽 둘이 솟아 싸움터를 나누고, 좁아진 방에 얼음이 절반씩 떨어진다.
// 벽은 몇 대 치면 깨지고, 시간이 지나면 사라진다. 벽 속에 있던 주인공은 옆으로 빼낸다.
export class IceWalls extends Signature {
  static tip = '얼음벽이 솟으면 빨갛지 않은 쪽으로 피하고, 막히면 벽을 몇 대 쳐서 깨!';

  constructor(boss) {
    super(boss);
    this.k = boss.ic;
    const { arenaStart, arenaEnd } = boss;
    this.mid = (arenaStart + arenaEnd) / 2;
    this.xs = wallSpots(boss.target.x, arenaStart, arenaEnd, this.k.iceWallGap, WALL_EDGE);
    this.rooms = wallRooms(arenaStart, arenaEnd, this.xs, WALL_HALF);
    this.flip = Math.random() < 0.5;
    this.damage = this.k.signatureDamage;
    this.walls = null;
    this.volleys = Array.from({ length: this.k.iceWallVolleys + (boss.raging ? 1 : 0) }, () => ({ struck: false, hits: new Set() }));
  }

  get warnTime() {
    return this.k.iceWallWarningTime * this.speed;
  }

  get lifeTime() {
    const { iceWallVolleyGap: gap, iceShardWarningTime: warn } = this.k;
    return (VOLLEY_LEAD + (this.volleys.length - 1) * gap + warn + 0.6) * this.speed;
  }

  wallRect(x) {
    return new Rect(x - WALL_HALF, -100, WALL_HALF * 2, this.groundY + 100);
  }

  step(dt) {
    const b = this.boss;
    b.idle(dt);
    if (this.t < this.warnTime) {
      for (const x of this.xs) this.warnAt(x - WALL_HALF, 0, WALL_HALF * 2, this.groundY);
      b.label(0, '얼음벽이 솟는다! 빨간 줄에서 비켜!', this.mid, 70, 26);
      return false;
    }
    if (!this.walls) this.raise();
    const t = this.t - this.warnTime;
    this.keepHeroesOut();
    this.drawWalls(t);
    this.runVolleys(t);
    return t >= this.lifeTime;
  }

  raise() {
    const { scene } = this;
    const hits = new Set();
    this.walls = this.xs.map((x) => {
      const r = this.wallRect(x);
      this.hurt(r, this.damage, x, hits);
      const zone = scene.add.zone(x, r.centerY, r.width, r.height);
      scene.physics.add.existing(zone, true);
      return { x, zone, collider: scene.physics.add.collider(scene.players, zone), hits: this.k.iceWallHits, flash: 0 };
    });
    scene.sfxPlay('slam');
    scene.shake(0.008, 200);
    for (const x of this.xs) scene.dustAt(x, this.groundY, 8);
  }

  // 솟는 벽이나 두 사람 간격 맞추기로 몸이 벽에 들어가면 바로 옆으로 뺀다
  keepHeroesOut() {
    const { arenaStart, arenaEnd } = this.boss;
    for (const p of this.scene.players) {
      if (p.dead) continue;
      for (const w of this.walls) {
        if (!w.zone) continue;
        const x = pushOutOfWall(p.x, p.body.halfWidth, w.x, WALL_HALF, arenaStart, arenaEnd);
        if (x !== p.x) p.setX(x);
      }
    }
  }

  runVolleys(t) {
    const gap = this.k.iceWallVolleyGap * this.speed;
    const warn = this.k.iceShardWarningTime * this.speed;
    const fall = SHARD_FALL * this.speed;
    const lead = VOLLEY_LEAD * this.speed;
    this.volleys.forEach((v, i) => {
      const from = lead + i * gap;
      const strike = from + warn;
      if (t < from || v.struck) return;
      const strips = shardStrips(this.rooms, i, this.flip, STRIP_GAP);
      if (t < strike) {
        for (const [a, c] of strips) this.warnAt(a, 0, c - a, this.groundY);
        if (t > strike - fall) this.drawShards(strips, (t - (strike - fall)) / fall);
        return;
      }
      v.struck = true;
      this.scene.sfxPlay('icicle');
      this.scene.shake(0.005, 120);
      for (const [a, c] of strips) {
        this.hurt(new Rect(a, 0, c - a, this.groundY), this.damage, (a + c) / 2, v.hits);
        this.scene.dustAt((a + c) / 2, this.groundY, 5);
      }
    });
  }

  drawShards(strips, k) {
    const y = -30 + (this.groundY - 10) * k * k;
    for (const [a, c] of strips) {
      for (let x = a + 22; x < c; x += 44) drawIceShard(this.g, x, y - (x % 3) * 14, 16, Math.PI, 0xc8d8ff, 0.95);
    }
  }

  drawWalls(t) {
    const fade = Math.min(1, (this.lifeTime - t) / 0.4);
    const rise = Math.min(1, t / (WALL_RISE * this.speed));
    const top = this.groundY * (1 - rise);
    for (const w of this.walls) {
      if (!w.zone) continue;
      w.flash = Math.max(0, w.flash - 1 / 30);
      const l = w.x - WALL_HALF;
      const h = this.groundY - top;
      this.g.fillStyle(w.flash > 0 ? 0xffffff : 0x161a38, 0.92 * fade).fillRect(l, top, WALL_HALF * 2, h);
      this.g.fillStyle(0x4a5f9a, 0.75 * fade);
      for (let i = 0, y = top + 12; y < this.groundY - 30; i++, y += 58) {
        const [a, c] = i % 2 ? [l + 40, l + 12] : [l + 4, l + 32];
        this.g.fillTriangle(a, y, c, y + 16, a, y + 50);
      }
      this.g.lineStyle(3, 0x9fd8ff, 0.9 * fade).strokeRect(l, top, WALL_HALF * 2, h);
      // 맞을수록 금이 늘어난다
      this.g.lineStyle(2, 0xe8fbff, fade);
      const cracks = Math.round((1 - w.hits / this.k.iceWallHits) * 6);
      for (let i = 0; i < cracks; i++) {
        const y = this.groundY - 40 - i * 62;
        this.g.lineBetween(w.x - 16, y, w.x + 6, y - 24).lineBetween(w.x + 6, y - 24, w.x - 4, y - 48).lineBetween(w.x + 6, y - 24, w.x + 18, y - 12);
      }
    }
  }

  // 벽을 때렸으면 true. 공격을 벽이 받아서 뒤의 보스는 안 맞는다.
  receiveAttack(rect) {
    const w = this.walls?.find((o) => o.zone && intersects(rect, this.wallRect(o.x)));
    if (!w) return false;
    w.hits -= 1;
    w.flash = 0.1;
    this.scene.sparks?.explode(6, w.x, rect.centerY);
    if (w.hits <= 0) this.breakWall(w);
    return true;
  }

  // 궁극기는 벽을 모두 부수고 보스도 맞는다
  onUltimate() {
    for (const w of this.walls || []) if (w.zone) this.breakWall(w);
  }

  breakWall(w) {
    this.dropWall(w);
    this.scene.sfxPlay('break');
    this.scene.shake(0.006, 150);
    for (let y = this.groundY - 40; y > 120; y -= 90) this.scene.sparks?.explode(6, w.x, y);
  }

  dropWall(w) {
    if (!w.zone) return;
    w.collider.destroy();
    w.zone.destroy();
    w.zone = null;
  }

  destroy() {
    for (const w of this.walls || []) this.dropWall(w);
    super.destroy();
  }
}

export const iceSignatures = { gale: Gale, iceWalls: IceWalls };
