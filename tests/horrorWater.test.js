import { describe, it, expect } from 'vitest';
import { parseMap } from '../src/logic/horrorGrid.js';
import { withWater, waterAt, createWet, stepWet, dry, waterNoise, waterSpeed, eyeIn, throwDuck, DRY, PUDDLE, SHALLOW, DEEP } from '../src/logic/horrorWater.js';
import { createStalker, tickStalker, stunStalker } from '../src/logic/horrorStalker.js';
import { swimPath, poolSpots } from '../src/logic/horrorSwimmer.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const kw = k.water;
const m = k.monsters.swimmer;

// 왼쪽은 깊은 풀, 가운데는 마른 바닥, 오른쪽 끝은 웅덩이
const pool = withWater(parseMap([
  '################',
  '#M.R..........S#',
  '#..............#',
  '#R.............#',
  '################',
]), [
  '................',
  '.WWWW........~~.',
  '.WWWW.......ww~.',
  '.WWWW...........',
  '................',
]);

const player = (o) => ({ x: 9.5, y: 2.5, hidden: null, lightOn: false, noise: 0, ...o });
const run = (s, world, seconds, rand = () => 0.5) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...tickStalker(s, world, k, 0.05, rand));
  return events;
};
const swimmer = () => createStalker(pool, k, () => 0.5, 'swimmer');

describe('물 깊이', () => {
  it('물 줄을 읽는다', () => {
    expect(waterAt(pool, 1, 1)).toBe(DEEP);
    expect(waterAt(pool, 7, 2)).toBe(DRY);
    expect(waterAt(pool, 14, 1)).toBe(PUDDLE);
    expect(waterAt(pool, 12, 2)).toBe(SHALLOW);
    expect(waterAt(pool, -1, 0)).toBe(DRY);
  });

  it('줄 수나 글자가 틀리면 알려 준다', () => {
    expect(() => withWater(parseMap(['#.#']), ['...', '...'])).toThrow();
    expect(() => withWater(parseMap(['#.#']), ['.x.'])).toThrow();
  });
});

describe('물소리', () => {
  const wetIn = (level) => stepWet(createWet(), level, kw, 0.05);

  it('마른 바닥은 달려도 소리가 없다', () => {
    expect(waterNoise(wetIn(DRY), true, true, kw)).toBe(0);
  });

  it('깊을수록 멀리 들린다', () => {
    const puddle = waterNoise(wetIn(PUDDLE), true, false, kw);
    const wade = waterNoise(wetIn(SHALLOW), true, false, kw);
    const swim = waterNoise(wetIn(DEEP), true, false, kw);
    expect(puddle).toBeGreaterThan(0);
    expect(wade).toBeGreaterThan(puddle);
    expect(swim).toBeGreaterThan(wade);
  });

  it('웅덩이에서 달리면 더 멀리 들린다', () => {
    expect(waterNoise(wetIn(PUDDLE), true, true, kw)).toBeGreaterThan(waterNoise(wetIn(PUDDLE), true, false, kw));
  });

  it('얕은 물에 가만히 서 있으면 조용하고, 깊은 물에 떠 있으면 찰랑인다', () => {
    expect(waterNoise(wetIn(SHALLOW), false, false, kw)).toBe(0);
    expect(waterNoise(wetIn(DEEP), false, false, kw)).toBeGreaterThan(0);
  });

  it('물에서 나와도 한동안 물방울 소리가 나고, 깊은 물일수록 오래간다', () => {
    const after = (level) => {
      const w = stepWet(createWet(), level, kw, 0.05);
      let t = 0;
      while (stepWet(w, DRY, kw, 0.05).dripT > 0) t += 0.05;
      return t;
    };
    expect(after(PUDDLE)).toBeGreaterThan(1);
    expect(after(DEEP)).toBeGreaterThan(after(PUDDLE));
    const w = stepWet(createWet(), DEEP, kw, 0.05);
    stepWet(w, DRY, kw, 0.05);
    expect(waterNoise(w, false, false, kw)).toBe(kw.hear.drip);
  });

  it('수건으로 닦으면 바로 조용해진다', () => {
    const w = stepWet(stepWet(createWet(), DEEP, kw, 0.05), DRY, kw, 0.05);
    dry(w);
    expect(waterNoise(w, true, true, kw)).toBe(0);
  });

  it('얕은 물에서는 느리고, 깊은 물에서는 눈높이가 내려온다', () => {
    expect(waterSpeed(SHALLOW, kw)).toBeLessThan(waterSpeed(DRY, kw));
    expect(eyeIn(DEEP, 1.6, kw)).toBeLessThan(1.6);
    expect(eyeIn(PUDDLE, 1.6, kw)).toBe(1.6);
  });
});

describe('고무오리', () => {
  it('앞쪽에서 가장 먼 물 칸에 떨어진다', () => {
    const r = throwDuck(pool, { x: 8.5, y: 2.5 }, Math.PI / 2, 8); // x 가 줄어드는 쪽 (풀 쪽)
    expect(r.splash).toBe(true);
    expect(waterAt(pool, r.cell.cx, r.cell.cy)).toBeGreaterThan(DRY);
    expect(r.cell.cx).toBeLessThanOrEqual(4);
  });

  it('물이 없으면 바닥에 떨어지고 소리가 없다', () => {
    const r = throwDuck(pool, { x: 7.5, y: 2.5 }, 0, 8); // y 가 줄어드는 쪽, 바로 벽 앞까지
    expect(r.splash).toBe(false);
  });

  it('코앞이 벽이면 던지지 못한다', () => {
    expect(throwDuck(pool, { x: 7.5, y: 1.5 }, 0, 8)).toBeNull();
  });
});

describe('물괴물', () => {
  it('물길이 싸다: 물을 따라 돌아가는 길을 고른다', () => {
    const path = swimPath(pool, { cx: 1, cy: 1 }, { cx: 4, cy: 3 }, m.landCost);
    expect(path.every((c) => waterAt(pool, c.cx, c.cy) > DRY)).toBe(true);
  });

  it('물 위 순찰 지점만 돈다', () => {
    expect(poolSpots(pool).every((c) => waterAt(pool, c.cx, c.cy) > DRY)).toBe(true);
  });

  it('마른 바닥 소리는 듣지 못한다: 옆에서 달려도 잡히지 않는다', () => {
    const s = swimmer();
    const events = run(s, { map: pool, player: player({ x: 6.5, y: 1.5, noise: 0 }) }, 5);
    expect(events).not.toContain('chase');
  });

  it('물소리를 들으면 그 칸으로 온다', () => {
    const s = swimmer();
    const events = run(s, { map: pool, player: player({ x: 12.5, y: 2.5, noise: kw.hear.wade * 3 }) }, 0.1);
    expect(events).toContain('chase');
    expect(s.mode).toBe('chase');
    expect(s.target).toEqual({ cx: 12, cy: 2 });
  });

  it('물속에서는 빠르고 물 밖에서는 걷기보다 느리다', () => {
    expect(m.swimSpeed).toBeGreaterThan(k.runSpeed);
    expect(m.crawlSpeed).toBeLessThan(k.walkSpeed);
  });

  it('도착하면 더듬다가 물로 돌아간다', () => {
    const s = swimmer();
    run(s, { map: pool, player: player({ x: 6.5, y: 2.5, noise: 20 }) }, 0.1);
    run(s, { map: pool, player: player({ x: 14.5, y: 3.5, noise: 0 }) }, 8);
    expect(s.mode).toBe('search');
    run(s, { map: pool, player: player({ x: 14.5, y: 3.5, noise: 0 }) }, m.gropeTime + 10);
    expect(s.mode).toBe('patrol');
    expect(waterAt(pool, Math.floor(s.x), Math.floor(s.y))).toBeGreaterThan(DRY);
  });

  it('도착한 뒤 같은 자리에서 소리가 이어져도 다시 알리지 않는다', () => {
    const s = swimmer();
    const events = run(s, { map: pool, player: player({ x: 6.5, y: 2.5, noise: 20 }) }, 4);
    expect(events.filter((e) => e === 'chase')).toHaveLength(1);
  });

  it('갈 수 없는 곳의 소리는 흘려듣는다', () => {
    const shut = withWater(parseMap(['#######', '#M.#..#', '#######']), ['.......', '.WW....', '.......']);
    const s = createStalker(shut, k, () => 0.5, 'swimmer');
    const events = run(s, { map: shut, player: player({ x: 4.5, y: 1.5, noise: 20 }) }, 1);
    expect(events).not.toContain('chase');
    expect(s.mode).toBe('patrol');
  });

  it('고무오리 소리로 따돌린다', () => {
    const s = swimmer();
    run(s, { map: pool, player: player({ noise: 0 }), splash: { x: 3.5, y: 3.5, range: kw.hear.duck } }, 0.1);
    expect(s.mode).toBe('chase');
    expect(s.target).toEqual({ cx: 3, cy: 3 });
  });

  it('소리가 없어도 닿으면 잡는다. 솟아오른 직후에는 잡지 않는다', () => {
    const s = swimmer();
    const touching = { map: pool, player: player({ x: s.x + 0.2, y: s.y, noise: 0 }) };
    expect(run(s, touching, 0.05)).toContain('caught');
    const t = swimmer();
    const first = tickStalker(t, { map: pool, player: player({ x: t.x + 0.2, y: t.y, noise: 5 }) }, k, 0.05, () => 0.5);
    expect(first).toContain('chase');
    expect(first).not.toContain('caught');
  });

  it('사물함에 숨으면 듣지도 잡지도 못한다', () => {
    const s = swimmer();
    const events = run(s, { map: pool, player: player({ x: s.x + 0.2, y: s.y, noise: 20, hidden: 0 }) }, 2);
    expect(events).not.toContain('caught');
    expect(events).not.toContain('chase');
  });

  it('펀치에 맞으면 멈췄다가 더듬는다', () => {
    const s = swimmer();
    stunStalker(s, k);
    const x = s.x;
    run(s, { map: pool, player: player({ noise: 20 }) }, k.stunTime - 0.2);
    expect(s.x).toBe(x);
    run(s, { map: pool, player: player({ noise: 0 }) }, 0.4);
    expect(s.mode).toBe('search');
  });
});
