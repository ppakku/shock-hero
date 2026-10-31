import { describe, it, expect } from 'vitest';
import { createStalker, seesPlayer, tickStalker, stunStalker, sendAway, heartInterval, noteTrail, MODES } from '../src/logic/horrorStalker.js';
import { parseMap, blocked, center, findPath } from '../src/logic/horrorGrid.js';
import { factoryMap } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const seeded = (seed) => {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};
const hall = parseMap([
  '##############',
  '#M..........R#',
  '#.##########.#',
  '#L..........R#',
  '##############',
]);
const player = (o) => ({ x: 8.5, y: 1.5, hidden: null, lightOn: false, noise: 0, ...o });
const run = (s, world, seconds, rand = () => 0.5) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...tickStalker(s, world, k, 0.05, rand));
  return events;
};
const facing = (o) => ({ ...createStalker(hall), heading: Math.PI / 2, ...o }); // x 가 커지는 쪽을 본다

describe('보기', () => {
  it('어두우면 가까이서만 본다', () => {
    const s = facing({ x: 1.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 3.5 }), hall, k)).toBe(true);
    expect(seesPlayer(s, player({ x: 8.5 }), hall, k)).toBe(false);
  });

  it('손전등을 켜면 멀리서 보인다', () => {
    const s = facing({ x: 1.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 8.5, lightOn: true }), hall, k)).toBe(true);
  });

  it('뒤쪽, 벽 너머, 사물함 안은 못 본다', () => {
    const s = facing({ x: 5.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 3.5 }), hall, k)).toBe(false);
    expect(seesPlayer(s, player({ x: 5.5, y: 3.5 }), hall, k)).toBe(false);
    expect(seesPlayer(s, player({ x: 6.5, hidden: 0 }), hall, k)).toBe(false);
  });
});

describe('상태 변화', () => {
  it('아무 일이 없으면 순찰 지점을 돈다', () => {
    const s = createStalker(hall);
    const x0 = s.x;
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5 }) }, 3);
    expect(s.mode).toBe('patrol');
    expect(Math.hypot(s.x - x0, s.y - 1.5)).toBeGreaterThan(1);
  });

  it('소리를 들으면 조사하러 간다', () => {
    const s = facing({ x: 6.5, y: 1.5 }); // 돌아봐도 안 보일 만큼 멀리 있어야 조사에 머문다
    const events = run(s, { map: hall, player: player({ x: 1.5, y: 1.5, noise: 6 }) }, 0.1);
    expect(events).toContain('notice');
    expect(s.mode).toBe('investigate');
  });

  it('보면 쫓고 잡는다', () => {
    const s = facing({ x: 6.5, y: 1.5 });
    const events = run(s, { map: hall, player: player() }, 4);
    expect(events).toContain('chase');
    expect(events).toContain('caught');
  });

  it('같은 칸 모서리에 서 있어도 곧장 다가가 잡는다', () => {
    // 칸 가운데에서 모서리까지는 0.707 이라 잡힘 거리 0.7 보다 멀다
    const s = facing({ x: 3.5, y: 1.5, mode: 'chase', lastSeen: { cx: 3, cy: 1 } });
    const world = { map: hall, player: player({ x: 3.999, y: 1.999 }) };
    expect(Math.hypot(s.x - 3.999, s.y - 1.999)).toBeGreaterThan(k.catchDist);
    const events = run(s, world, 1);
    expect(events).toContain('caught');
    expect(Math.hypot(s.x - 3.999, s.y - 1.999)).toBeLessThan(k.catchDist);
  });

  it('놓치면 수색을 하고, 시간이 지나면 순찰로 돌아간다', () => {
    const s = facing({ x: 6.5, y: 1.5 });
    const world = { map: hall, player: player({ x: 8.5 }) };
    run(s, world, 0.1);
    world.player = player({ x: 3.5, y: 3.5, hidden: null });
    const events = run(s, world, k.loseTime + 0.3);
    expect(events).toContain('lost');
    expect(s.mode).toBe('search');
    run(s, world, k.searchTime + 1);
    expect(s.mode).toBe('patrol');
  });

  it('수색 중 숨은 사물함을 뒤지면 들킨다', () => {
    const s = facing({ x: 2.5, y: 3.5, mode: 'chase', lastSeen: { cx: 2, cy: 3 } });
    const world = { map: hall, player: player({ x: 1.5, y: 3.5, hidden: 0 }) };
    const events = run(s, world, k.loseTime + 3, () => 0.1);
    expect(events).toContain('locker');
    expect(events).toContain('found');
  });

  it('사물함을 뒤지지 않으면 들키지 않는다', () => {
    const s = facing({ x: 2.5, y: 3.5, mode: 'chase', lastSeen: { cx: 2, cy: 3 } });
    const world = { map: hall, player: player({ x: 1.5, y: 3.5, hidden: 0 }) };
    expect(run(s, world, k.loseTime + 3, () => 0.9)).not.toContain('found');
  });

  it('길이 없는 사물함은 뒤지지 않는다', () => {
    const sealed = parseMap([
      '#########',
      '#M.....R#',
      '#########',
      '####L####',
      '#########',
    ]);
    const s = { ...createStalker(sealed), mode: 'search', searchT: 99, lockers: [0] };
    const world = { map: sealed, player: player({ x: 4.5, y: 3.5, hidden: 0 }) };
    const events = run(s, world, 3, () => 0.1);
    expect(events).not.toContain('locker');
    expect(events).not.toContain('found');
    expect(s.checking).toBeNull();
  });

  it('소리가 계속 나도 알림은 한 번만 온다', () => {
    const s = facing({ x: 6.5, y: 1.5 });
    const world = { map: hall, player: player({ x: 3.5, y: 3.5, noise: 30 }) };
    const events = run(s, world, 4);
    expect(events.filter((e) => e === 'notice')).toHaveLength(1);
    expect(s.mode).toBe('investigate');
  });

  it('조사 자리에 도착했는데 소리가 그치면 순찰로 돌아간다', () => {
    const s = facing({ x: 6.5, y: 1.5, mode: 'investigate', target: { cx: 1, cy: 3 } });
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5, noise: 0 }) }, 0.1);
    expect(s.mode).toBe('patrol');
  });

  it('조사 자리에 도착해도 소리가 이어지면 알림을 다시 보내지 않는다', () => {
    // 파쇄자가 소리 난 칸 한가운데에 서 있고, 주인공은 같은 칸 안에서 움직이고 있다
    const s = facing({ x: 1.5, y: 3.5, mode: 'investigate', target: { cx: 1, cy: 3 } });
    const world = { map: hall, player: player({ x: 1.2, y: 3.2, noise: 30 }) };
    const near = { ...k, catchDist: 0.1 }; // 잡힘 거리만 줄여서 이 테스트가 잡힘에 섞이지 않게 한다
    const events = [];
    for (let t = 0; t < 3; t += 0.05) events.push(...tickStalker(s, world, near, 0.05, () => 0.5));
    expect(events).not.toContain('notice');
    expect(s.mode).toBe('investigate');
  });

  it('숨은 주인공은 파쇄자가 바로 위에 서도 잡히지 않는다', () => {
    const hidden = run(facing({ x: 6.5, y: 1.5 }), { map: hall, player: player({ x: 6.5, y: 1.5, hidden: 0 }) }, 1);
    expect(hidden).not.toContain('caught');
    const open = run(facing({ x: 6.5, y: 1.5 }), { map: hall, player: player({ x: 6.5, y: 1.5 }) }, 1);
    expect(open).toContain('caught');
  });

  it('쇼크 펀치를 맞으면 멈췄다가 수색한다', () => {
    const s = facing({ x: 6.5, y: 1.5, mode: 'chase' });
    stunStalker(s, k);
    const x = s.x;
    run(s, { map: hall, player: player({ x: 7.2 }) }, k.stunTime - 0.2);
    expect(s.mode).toBe('stunned');
    expect(s.x).toBe(x);
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5 }) }, 0.5);
    expect(s.mode).toBe('search');
  });

  it('맵 위에서 오래 돌아도 벽 안으로 들어가지 않는다', () => {
    const s = createStalker(factoryMap);
    let n = 0;
    const rand = () => {
      n = (n * 9301 + 49297) % 233280;
      return n / 233280;
    };
    const world = { map: factoryMap, player: { x: 2.5, y: 16.5, hidden: null, lightOn: true, noise: 9 } };
    for (let t = 0; t < 300; t += 0.05) {
      tickStalker(s, world, k, 0.05, rand);
      expect(blocked(factoryMap, Math.floor(s.x), Math.floor(s.y))).toBe(false);
      world.player.x = 2.5 + (t % 3);
    }
  });
});

describe('잡힌 뒤', () => {
  it('주인공에게서 가장 먼 순찰 지점으로 옮긴다', () => {
    const s = createStalker(factoryMap);
    s.mode = 'chase';
    sendAway(s, factoryMap, { x: 2.5, y: 16.5 });
    expect(s.mode).toBe('patrol');
    expect(Math.hypot(s.x - 2.5, s.y - 16.5)).toBeGreaterThan(15);
  });

  it('옮긴 자리는 막힌 칸이 아니다', () => {
    for (const c of factoryMap.patrol) {
      const s = createStalker(factoryMap);
      const p = center(c);
      sendAway(s, factoryMap, p);
      expect(blocked(factoryMap, Math.floor(s.x), Math.floor(s.y))).toBe(false);
    }
  });
});

describe('심장 소리', () => {
  it('가까울수록 빨라진다', () => {
    expect(heartInterval(1, k)).toBeLessThan(heartInterval(10, k));
    expect(heartInterval(100, k)).toBeNull();
  });

  it('간격과 거리는 balance.horror 값으로 정해진다', () => {
    const tuned = { ...k, heartFar: 10, heartFast: 0.5, heartSlow: 1 };
    expect(heartInterval(0, tuned)).toBeCloseTo(0.5);
    expect(heartInterval(10, tuned)).toBeCloseTo(1.5);
    expect(heartInterval(11, tuned)).toBeNull();
  });
});

describe('잡힌 뒤 괴물 보내기', () => {
  it('늘 같은 곳으로 가지 않고, 언제나 멀리 간다', () => {
    const p = { x: 2.5, y: 16.5 };
    const spots = new Set();
    for (const r of [0, 0.4, 0.9]) {
      const s = createStalker(factoryMap);
      sendAway(s, factoryMap, p, () => r);
      spots.add(`${s.x},${s.y}`);
      expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThanOrEqual(15);
    }
    expect(spots.size).toBeGreaterThan(1);
  });
});

// 둘레를 도는 고리 복도. 한쪽 길을 막아도 반대쪽으로 갈 수 있다
const ring = parseMap([
  '###############',
  '#R...........R#',
  '#.###########.#',
  '#.###########.#',
  '#R.....M.....R#',
  '###############',
]);
const seq = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const lost = (o) => ({ ...createStalker(ring), mode: 'chase', lostT: k.loseTime, repathT: 9, heading: 0, ...o });
const far = { x: 7.5, y: 1.5, hidden: null, lightOn: false, noise: 0 };

describe('주인공이 다닌 자리 기억', () => {
  it('걸어간 자리에 쌓이고 시간이 지나면 식는다', () => {
    const s = createStalker(hall);
    noteTrail(s, { cx: 3, cy: 1 }, 10);
    const i = hall.w + 3;
    expect(s.heat[i]).toBeCloseTo(10);
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5 }) }, k.heatHalfLife / 5);
    expect(s.heat[i]).toBeLessThan(10);
    expect(s.heat[i]).toBeGreaterThan(5);
  });

  it('배열은 처음 크기 그대로이고 저장할 값에 섞이지 않게 숫자 배열이다', () => {
    const s = createStalker(factoryMap);
    expect(s.heat).toBeInstanceOf(Float32Array);
    expect(s.heat.length).toBe(factoryMap.w * factoryMap.h);
    const heat = s.heat;
    run(s, { map: factoryMap, player: { x: 2.5, y: 16.5, hidden: null, lightOn: false, noise: 3 } }, 3);
    expect(s.heat).toBe(heat);
  });

  it('움직일 때만 쌓이고 숨어 있으면 쌓이지 않는다', () => {
    const s = createStalker(hall);
    run(s, { map: hall, player: player({ x: 3.5, y: 3.5, noise: 0 }) }, 1);
    run(s, { map: hall, player: player({ x: 3.5, y: 3.5, noise: 3, hidden: 0 }) }, 1);
    expect(s.heat[3 * hall.w + 3]).toBe(0);
    run(s, { map: hall, player: player({ x: 3.5, y: 3.5, noise: 3 }) }, 1);
    expect(s.heat[3 * hall.w + 3]).toBeGreaterThan(0.5);
  });

  it('순찰은 뜨거운 곳으로 더 자주 가고, 방금 간 곳은 피한다', () => {
    const wide = parseMap([
      '################',
      '#R..R..R..R..R.#',
      '#.############.#',
      '#R..R..M..R..R.#',
      '################',
    ]);
    const tally = (heat, recent) => {
      const rand = seeded(7);
      const s = createStalker(wide);
      noteTrail(s, wide.patrol[6], heat);
      const quiet = { ...k, seeLight: 0, seeDark: 0, catchDist: 0, heatHalfLife: 1e9, patrolRecent: recent };
      const counts = new Array(wide.patrol.length).fill(0);
      let backAgain = 0;
      let last = s.patrolIndex;
      for (let t = 0; t < 4000; t += 0.1) {
        tickStalker(s, { map: wide, player: { ...far, x: 7.5, y: 2.5 } }, quiet, 0.1, rand);
        if (s.patrolIndex === last) continue;
        last = s.patrolIndex;
        counts[last]++;
        if (s.recent[(s.recentAt + 6) % 8] === last || s.recent[(s.recentAt + 5) % 8] === last) backAgain++;
      }
      return { counts, backAgain };
    };
    const hot = tally(50, k.patrolRecent);
    expect(hot.counts[6]).toBeGreaterThan(hot.counts[4] * 1.5); // 멀리 있는 지점보다 훨씬 자주 간다
    expect(hot.counts[6]).toBeGreaterThan(hot.counts[8] * 1.5);
    expect(Math.min(...hot.counts)).toBeGreaterThan(0); // 다른 곳도 간다
    expect(hot.backAgain).toBeLessThan(tally(50, 1).backAgain / 3);
  });

  it('순찰 순서가 늘 같지 않다', () => {
    const order = (seed) => {
      const rand = seeded(seed);
      const s = createStalker(ring);
      const seen = [];
      const quiet = { ...k, seeLight: 0, seeDark: 0, catchDist: 0 };
      for (let t = 0; t < 200; t += 0.1) {
        tickStalker(s, { map: ring, player: { ...far, x: 1.5, y: 2.5 } }, quiet, 0.1, rand);
        if (seen[seen.length - 1] !== s.patrolIndex) seen.push(s.patrolIndex);
      }
      return seen.join();
    };
    expect(order(1)).not.toBe(order(2));
  });

  it('문이 열려 순찰 지점이 늘어나도 새 지점으로 간다', () => {
    const rand = seeded(5);
    const s = createStalker(ring);
    const world = { map: { ...ring, patrol: ring.patrol.slice(0, 2) }, player: { ...far, x: 1.5, y: 2.5 } };
    s.weights = new Float32Array(2);
    const quiet = { ...k, seeLight: 0, seeDark: 0, catchDist: 0 };
    for (let t = 0; t < 30; t += 0.1) tickStalker(s, world, quiet, 0.1, rand);
    world.map = ring;
    const seen = new Set();
    for (let t = 0; t < 200; t += 0.1) {
      tickStalker(s, world, quiet, 0.1, rand);
      expect(Number.isNaN(s.x)).toBe(false);
      seen.add(s.patrolIndex);
    }
    expect(seen.has(2) || seen.has(3)).toBe(true);
  });

  it('순찰 지점이 줄어도 없는 번호로 멈추지 않는다', () => {
    const s = { ...createStalker(ring), patrolIndex: 3 };
    const small = { ...ring, patrol: ring.patrol.slice(0, 2) };
    const quiet = { ...k, seeLight: 0, seeDark: 0, catchDist: 0 };
    for (let t = 0; t < 40; t += 0.1) tickStalker(s, { map: small, player: { ...far, x: 1.5, y: 2.5 } }, quiet, 0.1, () => 0.5);
    expect(s.patrolIndex).toBeLessThan(2);
  });

  it('길이 없는 순찰 지점만 있어도 멈추거나 오류가 나지 않는다', () => {
    const sealed = parseMap(['#######', '#M....#', '#######', '#R#R###', '#######']);
    const s = createStalker(sealed);
    expect(() => run(s, { map: sealed, player: player({ x: 4.5, y: 1.5, hidden: 0 }) }, 2)).not.toThrow();
    expect(s.mode).toBe('patrol');
  });
});

describe('매복', () => {
  it('운이 나쁘면 놓친 뒤 수색 대신 매복하고 알린다', () => {
    const s = lost({ x: 10.5, y: 1.5, lastSeen: { cx: 10, cy: 1 } });
    noteTrail(s, { cx: 7, cy: 1 }, 5);
    const events = tickStalker(s, { map: ring, player: { ...far, x: 3.5, y: 1.5 } }, k, 0.05, seq(0.1, 0.9));
    expect(events).toContain('lost');
    expect(events).toContain('ambush');
    expect(s.mode).toBe('ambush');
  });

  it('돌아갈 때는 놓친 쪽이 아닌 반대편에서 다가간다', () => {
    const s = lost({ x: 10.5, y: 1.5, lastSeen: { cx: 10, cy: 1 } });
    const world = { map: ring, player: { ...far, x: 4.5, y: 1.5 } };
    tickStalker(s, world, k, 0.05, seq(0.1, 0.9));
    expect(s.ambushKind).toBe('flank');
    expect(s.path.at(-2).cx).toBeLessThan(4); // 주인공 왼쪽에서 들어온다. 놓친 곳은 오른쪽이다
    expect(s.path[0].cx).toBeGreaterThan(10); // 먼저 등을 돌려 멀어진다
    expect(s.path.length).toBeGreaterThan(6);
  });

  it('길목에서 기다리는 동안 움직이지 않고, 시간이 다 되면 수색한다', () => {
    const s = { ...lost({ x: 3.5, y: 1.5 }), mode: 'ambush', ambushKind: 'wait', ambushT: 3, path: [] };
    const world = { map: ring, player: { ...far, x: 13.5, y: 4.5 } };
    const x = s.x;
    run(s, world, 2.8);
    expect(s.mode).toBe('ambush');
    expect(s.x).toBe(x);
    run(s, world, 0.4);
    expect(s.mode).toBe('search');
  });

  it('고른 길목은 복도이고 주인공에게서 멀다', () => {
    const s = lost({ x: 12.5, y: 2.5, lastSeen: { cx: 12, cy: 2 } });
    noteTrail(s, { cx: 7, cy: 1 }, 50);
    const p = { ...far, x: 1.5, y: 4.5 };
    tickStalker(s, { map: ring, player: p }, k, 0.05, seq(0.1, 0.1));
    expect(s.ambushKind).toBe('wait');
    const end = s.path.at(-1);
    expect(Math.hypot(end.cx + 0.5 - p.x, end.cy + 0.5 - p.y)).toBeGreaterThanOrEqual(k.ambushMinDist);
  });

  it('갈 길을 못 찾으면 그냥 수색한다', () => {
    const dead = parseMap(['#######', '#M...R#', '#######']);
    const s = { ...createStalker(dead), mode: 'chase', lostT: k.loseTime, repathT: 9, heading: Math.PI, lastSeen: { cx: 1, cy: 1 } };
    const events = tickStalker(s, { map: dead, player: player({ x: 3.5, y: 1.5, noise: 0 }) }, k, 0.05, () => 0.1);
    expect(events).toContain('lost');
    expect(events).not.toContain('ambush');
    expect(s.mode).toBe('search');
  });

  it('사물함에 숨었으면 매복하지 않고 수색한다', () => {
    const s = lost({ x: 10.5, y: 1.5, lastSeen: { cx: 10, cy: 1 } });
    const events = tickStalker(s, { map: ring, player: { ...far, x: 3.5, hidden: 0 } }, k, 0.05, () => 0);
    expect(events).not.toContain('ambush');
    expect(s.mode).toBe('search');
  });

  it('순간이동 없이 걸어서만 움직인다', () => {
    const s = lost({ x: 10.5, y: 1.5, lastSeen: { cx: 10, cy: 1 } });
    const world = { map: ring, player: { ...far, x: 4.5, y: 1.5 } };
    tickStalker(s, world, k, 0.05, seq(0.1, 0.9));
    world.player = { ...world.player, hidden: 0 }; // 눈에 띄지 않게 해서 끝까지 걷게 한다
    for (let i = 0; i < 400 && s.mode === 'ambush'; i++) {
      const [x, y] = [s.x, s.y];
      tickStalker(s, world, k, 0.05, () => 0.5);
      expect(Math.hypot(s.x - x, s.y - y)).toBeLessThanOrEqual(k.ambushSpeed * 0.05 + 1e-6);
    }
    expect(s.mode).toBe('search');
  });

  it('매복 중 가까이 가면 뛰쳐나오지만 곧바로 잡지는 않는다', () => {
    const s = { ...createStalker(ring), x: 3.5, y: 1.5, mode: 'ambush', ambushKind: 'wait', ambushT: 9, heading: 0 };
    const world = { map: ring, player: { ...far, x: 3.9, y: 1.5 } };
    const first = tickStalker(s, world, k, 0.05, () => 0.5);
    expect(first).toContain('chase');
    expect(first).not.toContain('caught');
    const t = [];
    for (let i = 0; i * 0.05 < k.pounceWarn - 0.1; i++) t.push(...tickStalker(s, world, k, 0.05, () => 0.5));
    expect(t).not.toContain('caught');
    expect(run(s, world, 1)).toContain('caught');
  });

  it('매복 중에는 먼 소리나 먼 시야로 끌려 나오지 않는다', () => {
    const s = { ...createStalker(ring), x: 3.5, y: 1.5, mode: 'ambush', ambushKind: 'wait', ambushT: 9, heading: Math.PI / 2 };
    const events = run(s, { map: ring, player: { ...far, x: 9.5, y: 1.5, lightOn: true, noise: 9 } }, 2);
    expect(events).toEqual([]);
    expect(s.mode).toBe('ambush');
  });

  it('공장 맵에서 오래 돌아도 매복은 언제나 끝난다', () => {
    const rand = seeded(3);
    const s = createStalker(factoryMap);
    const world = { map: factoryMap, player: { ...center(factoryMap.start), hidden: null, lightOn: false, noise: 0 } };
    const trail = findPath(factoryMap, factoryMap.start, factoryMap.patrol.find((c) => findPath(factoryMap, factoryMap.start, c)?.length > 8));
    trail.forEach((c) => noteTrail(s, c, 1));
    let ambushes = 0;
    let longest = 0;
    let t = 0;
    for (let i = 0; i < 60; i++) {
      Object.assign(s, center(trail[8]), { mode: 'chase', lostT: k.loseTime, repathT: 9, lastSeen: trail[0], path: [] });
      const ev = tickStalker(s, world, { ...k, ambushChance: 1 }, 0.05, rand);
      if (ev.includes('ambush')) ambushes++;
      for (t = 0; s.mode === 'ambush' && t < 120; t += 0.05) tickStalker(s, world, k, 0.05, rand);
      longest = Math.max(longest, t);
      expect(s.mode).not.toBe('ambush');
    }
    expect(ambushes).toBeGreaterThan(0);
    expect(longest).toBeLessThan(k.ambushMaxPath / k.ambushSpeed + k.ambushWaitMax + 2);
  });
});

describe('바라보기', () => {
  const calm = (o) => ({ ...createStalker(ring), x: 2.5, y: 1.5, heading: Math.PI / 2, calmT: k.watchCalm, ...o });
  const lit = { ...far, lightOn: true, x: 8.5, y: 1.5 };

  it('오래 조용했고 멀리서 보면 멈춰 서서 바라본다', () => {
    const s = calm();
    const events = tickStalker(s, { map: ring, player: lit }, k, 0.05, () => 0.1);
    expect(events).toEqual(['watch']);
    expect(s.mode).toBe('watch');
    const x = s.x;
    const more = run(s, { map: ring, player: lit }, k.watchMin - 0.5, () => 0.5);
    expect(more).toEqual([]);
    expect(s.x).toBe(x);
  });

  it('2초에서 4초 바라본 뒤 쫓는다', () => {
    for (const [r, low, high] of [[0, k.watchMin, k.watchMin + 0.2], [0.999, k.watchMax - 0.2, k.watchMax + 0.2]]) {
      const s = calm();
      const world = { map: ring, player: lit };
      tickStalker(s, world, k, 0.05, seq(0.1, r));
      let t = 0;
      while (s.mode === 'watch' && t < 9) {
        tickStalker(s, world, k, 0.05, () => 0.5);
        t += 0.05;
      }
      expect(s.mode).toBe('chase');
      expect(t).toBeGreaterThanOrEqual(low - 0.1);
      expect(t).toBeLessThanOrEqual(high);
    }
  });

  it('쫓은 지 얼마 안 됐거나 가까우면 바라보지 않고 바로 쫓는다', () => {
    const recent = { ...calm(), calmT: 0 };
    expect(tickStalker(recent, { map: ring, player: lit }, k, 0.05, () => 0.1)).toEqual(['chase']);
    const near = calm();
    expect(tickStalker(near, { map: ring, player: { ...lit, x: 4.5 } }, k, 0.05, () => 0.1)).toEqual(['chase']);
    const loud = calm();
    expect(tickStalker(loud, { map: ring, player: { ...lit, noise: 9 } }, k, 0.05, () => 0.1)).toEqual(['chase']);
  });

  it('시선이 끊기거나 숨으면 바라보기를 멈추고 마지막 자리를 수색한다', () => {
    for (const p of [{ ...lit, hidden: 0 }, { ...lit, x: 3.5, y: 4.5 }]) {
      const s = calm();
      tickStalker(s, { map: ring, player: lit }, k, 0.05, () => 0.1);
      tickStalker(s, { map: ring, player: p }, k, 0.05, () => 0.9);
      expect(s.mode).toBe('search');
      expect(s.lastSeen).toEqual({ cx: 8, cy: 1 });
    }
  });

  it('다가오거나 뛰면 바로 쫓지만 곧바로 잡지는 않는다', () => {
    const s = calm();
    tickStalker(s, { map: ring, player: lit }, k, 0.05, () => 0.1);
    const near = { ...lit, x: 3.1 };
    const events = tickStalker(s, { map: ring, player: near }, k, 0.05, () => 0.5);
    expect(events).toEqual(['chase']);
    const loud = calm();
    tickStalker(loud, { map: ring, player: lit }, k, 0.05, () => 0.1);
    expect(tickStalker(loud, { map: ring, player: { ...lit, noise: 9 } }, k, 0.05, () => 0.5)).toEqual(['chase']);
  });

  it('쇼크 펀치로 멈추면 바라보기도 끝난다', () => {
    const s = calm();
    tickStalker(s, { map: ring, player: lit }, k, 0.05, () => 0.1);
    stunStalker(s, k);
    expect(s.mode).toBe('stunned');
  });

  it('한 번 바라봤으면 다음에는 바로 쫓는다', () => {
    const s = calm();
    tickStalker(s, { map: ring, player: lit }, k, 0.05, () => 0.1);
    tickStalker(s, { map: ring, player: { ...lit, hidden: 0 } }, k, 0.05, () => 0.9);
    s.heading = Math.PI / 2;
    expect(tickStalker(s, { map: ring, player: lit }, k, 0.05, () => 0.1)).toEqual(['chase']);
  });
});

describe('퓨즈를 찾을수록 위험해진다', () => {
  it('압박이 크면 더 빨리 걷는다', () => {
    const go = (pressure) => {
      const s = createStalker(ring);
      tickStalker(s, { map: ring, player: { ...far, x: 1.5, y: 2.5 }, pressure }, { ...k, seeLight: 0, seeDark: 0 }, 0.01, () => 0);
      const [x, y] = [s.x, s.y];
      tickStalker(s, { map: ring, player: { ...far, x: 1.5, y: 2.5 }, pressure }, { ...k, seeLight: 0, seeDark: 0 }, 1, () => 0);
      return Math.hypot(s.x - x, s.y - y);
    };
    expect(go(1)).toBeCloseTo(k.stalkerWalk * (1 + k.pressureWalk));
    expect(go(1)).toBeGreaterThan(go(0));
    expect(go(undefined)).toBeCloseTo(k.stalkerWalk);
  });

  it('압박이 크면 더 멀리서 듣는다', () => {
    const d = k.walkNoise + 1;
    const p = { ...far, x: 13.5 - d, y: 1.5, noise: k.walkNoise };
    const quiet = { ...createStalker(ring), x: 13.5, y: 1.5, heading: Math.PI / 2 };
    expect(tickStalker(quiet, { map: ring, player: p, pressure: 0 }, k, 0.05, () => 0.5)).not.toContain('notice');
    const tense = { ...createStalker(ring), x: 13.5, y: 1.5, heading: Math.PI / 2 };
    expect(tickStalker(tense, { map: ring, player: p, pressure: 1 }, k, 0.05, () => 0.5)).toContain('notice');
  });

  it('압박이 크면 더 오래 찾고 사물함을 더 많이 뒤진다', () => {
    const check = (pressure, r) => {
      const s = { ...createStalker(hall), x: 2.5, y: 3.5, heading: Math.PI, mode: 'stunned', stunT: 0.01 };
      tickStalker(s, { map: hall, player: player({ x: 1.5, y: 3.5, hidden: 0 }), pressure }, k, 0.05, () => r);
      return s;
    };
    expect(check(1, 0.5).searchT).toBeCloseTo(k.searchTime * (1 + k.pressureSearch));
    expect(check(0, 0.6).lockers).toEqual([]);
    expect(check(1, 0.6).lockers).toEqual([0]);
  });

  it('값이 범위를 넘어도 1 로 막는다', () => {
    const s = createStalker(ring);
    tickStalker(s, { map: ring, player: far, pressure: 9 }, k, 0.05, () => 0.5);
    expect(s.pressure).toBe(1);
  });

  it('가장 위험할 때도 추격은 달리기보다 느리고, 걷기는 추격보다 느리다', () => {
    expect(k.stalkerChase).toBeLessThan(k.runSpeed);
    expect(k.ambushSpeed).toBeLessThan(k.runSpeed);
    expect(k.stalkerWalk * (1 + k.pressureWalk)).toBeLessThan(k.stalkerChase);
    expect(k.lockerCheckChance + k.pressureLocker).toBeLessThan(1); // 숨어서 살 길이 남아 있다
  });
});

describe('공정함', () => {
  it('잡힌 뒤 정해진 시간 동안 보지도 듣지도 잡지도 않는다', () => {
    const s = createStalker(ring);
    sendAway(s, ring, far, () => 0);
    const world = { map: ring, player: { ...far, x: s.x, y: s.y, lightOn: true, noise: 9 } };
    const events = [];
    for (let t = 0; t < k.respawnGrace - 0.2; t += 0.05) {
      world.player = { ...world.player, x: s.x + 0.2, y: s.y };
      events.push(...tickStalker(s, world, k, 0.05, () => 0.5));
    }
    expect(events).toEqual([]);
    expect(s.mode).toBe('patrol');
    world.player = { ...world.player, x: s.x + 0.2, y: s.y };
    expect(run(s, world, 1)).toContain('caught');
  });

  it('처음 시작할 때는 봐주는 시간이 없다', () => {
    expect(createStalker(ring).graceT).toBe(0);
  });

  it('새 상태 이름을 내보낸다', () => {
    expect(MODES).toEqual(expect.arrayContaining(['ambush', 'watch']));
  });

  it('공장 맵을 오래 돌아도 어떤 상태에도 갇히지 않는다', () => {
    const rand = seeded(11);
    const s = createStalker(factoryMap);
    const world = { map: factoryMap, pressure: 1, player: { x: 2.5, y: 16.5, hidden: null, lightOn: true, noise: 3 } };
    const seen = new Set();
    let sameFor = 0;
    let longest = 0;
    let mode = s.mode;
    const dt = 1 / 30;
    for (let t = 0; t < 900; t += dt) {
      world.player.x = 2.5 + (t % 4);
      world.player.hidden = t % 60 < 15 ? 0 : null;
      const events = tickStalker(s, world, k, dt, rand);
      if (events.includes('caught') || events.includes('found')) sendAway(s, factoryMap, world.player, rand);
      expect(blocked(factoryMap, Math.floor(s.x), Math.floor(s.y))).toBe(false);
      seen.add(s.mode);
      sameFor = s.mode === mode ? sameFor + dt : 0;
      mode = s.mode;
      if (mode !== 'patrol') longest = Math.max(longest, sameFor);
    }
    expect(seen.has('patrol')).toBe(true);
    expect(longest).toBeLessThan(120);
  });
});
