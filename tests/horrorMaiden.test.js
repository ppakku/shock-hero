import { describe, it, expect } from 'vitest';
import { createStalker, tickStalker, stunStalker, blinkSpot } from '../src/logic/horrorStalker.js';
import { parseMap, lineOfSight, center, inPlayerView, wallAt } from '../src/logic/horrorGrid.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const m = k.monsters.maiden;
const seeded = (seed) => {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};
// 나무(#)가 띄엄띄엄 선 숲 마당
const forest = parseMap([
  '#####################',
  '#M.......R.........R#',
  '#..#....#.....#.....#',
  '#.....#.....#....#..#',
  '#..#.......#........#',
  '#.......#.....#..#..#',
  '#.#..#.......#......#',
  '#.......#.#.....#...#',
  '#...#.........#.....#',
  '#.....#..#.#.....#..#',
  '#R..#.......#......R#',
  '#####################',
]);
// 곧은 복도. 걸음 속도를 잴 때 쓴다
const hall = parseMap([
  '##############################',
  '#M..........................R#',
  '##############################',
]);
const player = (o) => ({ x: 10.5, y: 5.5, hidden: null, lightOn: false, noise: 0, ...o });
const maiden = (map, o) => ({ ...createStalker(map, k, Math.random, 'maiden'), ...o });
const run = (s, world, seconds, rand = seeded(3)) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...tickStalker(s, world, k, 0.05, rand));
  return events;
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('처녀귀신: 노을', () => {
  it('소리를 내고 손전등을 비춰도 쫓지 않고 잡지도 않는다', () => {
    const s = maiden(forest, { x: 7.5, y: 5.5, heading: Math.PI / 2 });
    const world = { map: forest, player: player({ noise: k.runNoise, lightOn: true }), seen: false, stage: 'glow' };
    const events = run(s, world, 20);
    expect(events).not.toContain('chase');
    expect(events).not.toContain('notice');
    expect(events).not.toContain('caught');
    expect(s.mode).toBe('patrol');
  });

  it('눈에 띄면 잠깐 서 있다가 사라진다', () => {
    const s = maiden(forest, { x: 1.5, y: 1.5 });
    const world = { map: forest, player: player({ x: 10.5, y: 1.5 }), seen: true, stage: 'glow' };
    const events = run(s, world, 0.5);
    expect(s.mode).toBe('watch');
    expect(events).not.toContain('slip');
    const more = run(s, world, m.glow.showTime + 0.2);
    expect(more).toContain('slip');
    expect(s.mode).toBe('patrol');
  });

  it('가까이 다가가면 바로 사라진다', () => {
    const s = maiden(forest, { x: 7.5, y: 1.5 });
    const world = { map: forest, player: player({ x: 10.5, y: 1.5 }), seen: true, stage: 'glow' };
    expect(run(s, world, 0.1)).toContain('slip');
  });

  it('노을에 걷는 속도는 세이노보다 느리다', () => {
    expect(m.glow.walk).toBeLessThan(k.stalkerWalk);
    expect(m.glow.chase).toBe(0);
  });
});

describe('처녀귀신: 어스름과 밤', () => {
  it('소리를 들으면 알아채고 조사하러 간다', () => {
    const s = maiden(forest, { x: 6.5, y: 5.5, heading: -Math.PI / 2 }); // 주인공 반대쪽을 본다
    const world = { map: forest, player: player({ noise: k.walkNoise * 2 }), seen: true, stage: 'twilight' };
    expect(run(s, world, 0.1)).toContain('notice');
  });

  it('밤에 쫓는 속도는 세이노보다 빠르고 주인공 달리기보다는 느리다', () => {
    const go = (monsterId, stage) => {
      const s = { ...createStalker(hall, k, Math.random, monsterId), heading: Math.PI / 2 };
      const world = { map: hall, player: player({ x: 9.5, y: 1.5, lightOn: true }), seen: true, stage }; // 손전등을 켜면 8칸에서 보인다
      run(s, world, 0.05); // 알아채고 쫓기 시작한다
      expect(s.mode).toBe('chase');
      const x0 = s.x;
      run(s, world, 1);
      return s.x - x0;
    };
    const seino = go('seino');
    const night = go('maiden', 'night');
    expect(night).toBeGreaterThan(seino);
    expect(night).toBeLessThan(k.runSpeed);
    expect(go('maiden', 'twilight')).toBeLessThan(seino);
  });

  it('밤에는 쫓다가 닿으면 잡는다 (잡힘 거리는 세이노와 같다)', () => {
    const s = maiden(hall, { x: 20.5, y: 1.5, heading: Math.PI / 2 });
    const world = { map: hall, player: player({ x: 23.5, y: 1.5 }), seen: true, stage: 'night' };
    const events = run(s, world, 4);
    expect(events).toContain('caught');
    expect(dist(s, world.player)).toBeLessThan(k.catchDist);
  });

  it.each(['twilight', 'night'])('%s: 안 보인 채 시간이 지나면 가까운 곳에 나타난다', (stage) => {
    const st = m[stage];
    const p = player({ x: 18.5, y: 2.5, yaw: 0 }); // 맵 반대편 구석에서 -y 쪽을 본다
    const s = maiden(forest, { x: 1.5, y: 10.5 });
    const world = { map: forest, player: p, seen: false, stage };
    const before = run(s, world, st.blinkAfter - 0.3);
    expect(before).not.toContain('blink');
    const events = run(s, world, 0.5);
    expect(events).toContain('blink');
    const d = dist(s, p);
    expect(d).toBeGreaterThanOrEqual(st.blinkMin - 0.6); // 나타난 뒤 조금 걸었을 수 있다
    expect(d).toBeLessThanOrEqual(st.blinkMax + 0.6);
  });

  it('보고 있는 동안에는 순간이동하지 않는다', () => {
    const s = maiden(forest, { x: 1.5, y: 10.5 });
    const world = { map: forest, player: player({ yaw: 0 }), seen: true, stage: 'night' };
    expect(run(s, world, 10)).not.toContain('blink');
  });

  it('순간이동 칸은 거리 안이고, 주인공 눈에 안 보이고, 주인공 위가 아니다', () => {
    for (const stage of ['twilight', 'night']) {
      const st = m[stage];
      for (let seed = 1; seed <= 40; seed++) {
        const rand = seeded(seed);
        const p = player({ x: 3.5 + Math.floor(rand() * 15), y: 1.5 + Math.floor(rand() * 9), yaw: rand() * Math.PI * 2 });
        if (forest.rows[Math.floor(p.y)][Math.floor(p.x)] === '#') continue;
        const spot = blinkSpot(forest, p, st, k, rand);
        if (!spot) continue;
        const c = center(spot);
        const d = dist(c, p);
        expect(d).toBeGreaterThanOrEqual(Math.max(st.blinkMin, k.catchDist + 1));
        expect(d).toBeLessThanOrEqual(st.blinkMax);
        expect(inPlayerView(p, p.yaw, c, forest, k)).toBe(false);
      }
    }
  });

  it('고개 방향을 모르면 가려진 칸을 고른다', () => {
    const p = player({ x: 10.5, y: 5.5 });
    for (let seed = 1; seed <= 20; seed++) {
      const spot = blinkSpot(forest, p, m.night, k, seeded(seed));
      if (spot) expect(lineOfSight(forest, p, center(spot))).toBe(false);
    }
  });

  it('밤에는 등 뒤를 더 자주 고르고 나무 옆을 좋아한다', () => {
    const p = player({ x: 10.5, y: 5.5, yaw: 0 }); // -y 쪽을 보니 등 뒤는 +y 쪽이다
    let behind = 0;
    let tree = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const spot = blinkSpot(forest, p, m.night, k, seeded(seed));
      if (center(spot).y > p.y) behind++;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wallAt(forest, spot.cx + dx, spot.cy + dy))) tree++;
    }
    expect(behind).toBeGreaterThan(20);
    expect(tree).toBeGreaterThan(15);
  });

  it('주인공 바로 위나 잡히는 거리에는 절대 나타나지 않는다', () => {
    const tiny = parseMap([
      '#######',
      '#M...R#',
      '#.....#',
      '#######',
    ]);
    const p = player({ x: 3.5, y: 1.5, yaw: 0 });
    for (let seed = 1; seed <= 20; seed++) {
      const spot = blinkSpot(tiny, p, m.night, k, seeded(seed));
      if (spot) expect(dist(center(spot), p)).toBeGreaterThan(k.catchDist + 1);
    }
  });

  it('나타난 순간에는 잡지 않는다', () => {
    const p = player({ x: 10.5, y: 5.5, yaw: 0 });
    const s = maiden(forest, { x: 1.5, y: 10.5, unseenT: m.night.blinkAfter });
    const events = tickStalker(s, { map: forest, player: p, seen: false, stage: 'night' }, k, 0.05, seeded(1));
    expect(events).toContain('blink');
    expect(events).not.toContain('caught');
    expect(s.warnT).toBeGreaterThan(0.5);
  });

  it('잡힌 뒤 쉬는 동안은 세지 않아서, 쉬는 시간이 끝나도 바로 나타나지 않는다', () => {
    const s = maiden(forest, { x: 1.5, y: 10.5, graceT: k.respawnGrace });
    const world = { map: forest, player: player({ x: 18.5, y: 2.5, yaw: 0 }), seen: false, stage: 'night' };
    expect(run(s, world, k.respawnGrace + m.night.blinkAfter - 0.5)).not.toContain('blink');
    expect(run(s, world, 1)).toContain('blink');
  });

  it('숨어 있으면 순간이동하지 않는다', () => {
    const s = maiden(forest, { x: 1.5, y: 10.5 });
    const world = { map: forest, player: player({ hidden: 0, yaw: 0 }), seen: false, stage: 'night' };
    expect(run(s, world, 10)).not.toContain('blink');
  });
});

describe('처녀귀신: 쇼크', () => {
  it('맞으면 멈춰 서지 않고 멀리 사라졌다가, 쉬는 동안은 잡지 않는다', () => {
    const p = player({ x: 10.5, y: 1.5, noise: k.runNoise, lightOn: true });
    const s = maiden(forest, { x: 11.5, y: 1.5, heading: -Math.PI / 2, mode: 'chase', lastSeen: { cx: 10, cy: 1 } });
    stunStalker(s, k);
    const world = { map: forest, player: p, seen: true, stage: 'night' };
    const first = tickStalker(s, world, k, 0.05, seeded(2));
    expect(first).toContain('vanish');
    expect(s.mode).toBe('patrol');
    expect(dist(s, p)).toBeGreaterThan(6);
    const events = run(s, world, k.stunTime - 0.3);
    expect(events).not.toContain('caught');
    expect(events).not.toContain('blink');
    expect(events).not.toContain('chase');
  });

  it('쉬는 시간이 끝나면 다시 사냥한다', () => {
    const p = player({ x: 10.5, y: 1.5, noise: k.runNoise, lightOn: true });
    const s = maiden(forest, { x: 11.5, y: 1.5 });
    stunStalker(s, k);
    const world = { map: forest, player: p, seen: false, stage: 'night' };
    const events = run(s, world, k.stunTime + 3);
    expect(events.some((e) => e === 'notice' || e === 'chase' || e === 'blink')).toBe(true);
  });
});
