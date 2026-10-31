import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { center, cellOf, frontOf, findPath, lineOfSight, reachable, blocked } from '../src/logic/horrorGrid.js';
import { stepPlayer, noiseFor } from '../src/logic/horrorInput.js';
import { createStalker, tickStalker, sendAway, stunStalker } from '../src/logic/horrorStalker.js';
import { createRun, takeFuse, chargeShock, useShock, insertFuses, caught, escape, nearestUse } from '../src/logic/horrorRun.js';
import { factoryMap as map } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const DT = 1 / 30;
const BOT = readFileSync('tools/bot_horror.js', 'utf8');

// 작은 씨앗 난수. 실패가 늘 같은 판에서 다시 나게 한다
function seeded(seed) {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

// HorrorGame.playFrame 과 같은 순서로 그림 없이 한 판을 돌린다. 봇은 진짜 bot_horror.js 다.
function playGame(seed, options, maxSeconds = 900) {
  const rand = seeded(seed);
  const run = createRun(map, k, rand);
  const g = {
    map, run, k,
    p: center(map.start),
    yaw: 0,
    hidden: null,
    stalker: createStalker(map),
    nearestUse: () => nearestUse(run, map, g.p, g.hidden, k),
  };
  const window = { __horror: g, __horrorBot: options, __horrorLogic: { findPath, cellOf, frontOf, center, lineOfSight } };
  new Function('window', BOT)(window);
  const catches = [];
  let hideFrom = null;
  let t = 0;
  for (; t < maxSeconds && !run.escaped; t += DT) {
    const inp = g.readInput();
    g.yaw -= inp.lookX;
    const before = g.p;
    if (g.hidden === null) g.p = stepPlayer(g.p, inp.move, g.yaw, inp.move.run ? k.runSpeed : k.walkSpeed, DT, map, 0.2);
    const moving = g.p.x !== before.x || g.p.y !== before.y;
    const player = { ...g.p, hidden: g.hidden, lightOn: true, noise: noiseFor(moving, inp.move.run, k) };
    const events = tickStalker(g.stalker, { map, player }, k, DT, rand);
    if (events.includes('caught') || events.includes('found')) {
      caught(run);
      catches.push(t);
      g.hidden = null;
      g.p = center(map.start);
      sendAway(g.stalker, map, g.p);
      continue;
    }
    const target = g.nearestUse();
    if (inp.use && target) {
      if (target.kind === 'fuse') takeFuse(run, target.index);
      if (target.kind === 'box') chargeShock(run, target.index);
      if (target.kind === 'panel') insertFuses(run, k);
      if (target.kind === 'gate') escape(run, k);
      if (target.kind === 'locker') {
        if (g.hidden === null) {
          hideFrom = g.p;
          g.hidden = target.index;
          g.p = center(map.lockers[target.index]);
        } else {
          g.hidden = null;
          g.p = hideFrom;
        }
      }
    }
    if (inp.punch && useShock(run) && Math.hypot(g.stalker.x - g.p.x, g.stalker.y - g.p.y) <= k.shockRange) stunStalker(g.stalker, k);
  }
  return { won: run.escaped, seconds: t, catches, powered: run.powered };
}

const summary = (games) => ({
  won: games.filter((r) => r.won).length,
  meanSeconds: Math.round(games.reduce((a, r) => a + r.seconds, 0) / games.length),
  meanCatches: +(games.reduce((a, r) => a + r.catches.length, 0) / games.length).toFixed(1),
  maxCatches: Math.max(...games.map((r) => r.catches.length)),
  // 잡힌 뒤 다음에 잡힐 때까지 가장 짧은 시간
  minGap: Math.round(Math.min(...games.flatMap((r) => r.catches.slice(1).map((c, i) => c - r.catches[i])), Infinity)),
});

describe('공장 맵을 끝까지 할 수 있다', () => {
  const open = reachable(map, map.start);
  const standable = (cell) => {
    // 그 칸 둘레의 걸을 수 있는 자리 중 손이 닿는 곳이 있는가
    const c = center(cell);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { cx: cell.cx + dx, cy: cell.cy + dy };
      if (!blocked(map, n.cx, n.cy) && open.has(`${n.cx},${n.cy}`) && Math.hypot(n.cx + 0.5 - c.x, n.cy + 0.5 - c.y) <= k.useRange) return true;
    }
    return false;
  };

  it('사물함, 전기 상자, 전원, 정문은 모두 손이 닿는다', () => {
    for (const c of [...map.lockers, ...map.boxes, map.panel, map.gate]) expect(standable(c), `${c.cx},${c.cy}`).toBe(true);
  });

  it('순찰 지점은 모두 걸어갈 수 있다', () => {
    for (const c of map.patrol) expect(open.has(`${c.cx},${c.cy}`)).toBe(true);
  });

  it('벽 너머의 것은 집을 수 없다', () => {
    const run = createRun(map, k, () => 0.3);
    // 시작 방 오른쪽 벽 앞에서 벽 건너 칸의 물건은 닿지 않는다
    expect(nearestUse({ ...run, fuses: [{ cx: 8, cy: 16, taken: false }] }, map, { x: 6.8, y: 16.5 }, null, k)).toBe(null);
  });
});

describe('봇이 끝까지 한 판을 한다', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  it('조심하는 봇은 드물게 잡히고 언제나 탈출한다', () => {
    const s = summary(seeds.map((seed) => playGame(seed, { careful: true })));
    console.log('조심하는 봇', s);
    expect(s.won).toBe(seeds.length);
    expect(s.meanCatches).toBeLessThan(3);
  });

  it('세이노를 무시하고 달리기만 해도 탈출할 수 있다 (잡혀도 퓨즈가 남는다)', () => {
    const s = summary(seeds.map((seed) => playGame(seed, null)));
    console.log('달리기만 하는 봇', s);
    expect(s.won).toBe(seeds.length);
  });

  it('다시 시작하자마자 또 잡히지 않는다', () => {
    // 세이노 쪽으로 곧장 달려도 8초는 걸린다. 가만히 있으면 순찰 속도로 15칸을 와야 한다
    expect(summary(seeds.map((seed) => playGame(seed, null))).minGap).toBeGreaterThanOrEqual(8);
    const s = createStalker(map);
    const p = center(map.start);
    Object.assign(s, { x: p.x + 0.3, y: p.y, mode: 'chase', stunT: 0 });
    sendAway(s, map, p);
    expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThanOrEqual(15);
    expect(s.mode).toBe('patrol');
  });
});
