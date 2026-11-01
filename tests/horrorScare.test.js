import { describe, it, expect } from 'vitest';
import { createScare, stepScare, dreadLevel, figureSpot } from '../src/logic/horrorScare.js';
import { parseMap, withOpen } from '../src/logic/horrorGrid.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror.scare;
const hall = parseMap([
  '####################',
  '#M................R#',
  '#L.................#',
  '####################',
]);

describe('놀람 시간표', () => {
  it('어둠, 얼굴, 끝 순서로 간다', () => {
    const s = createScare(true, k);
    expect(stepScare(s, k.dark - 0.01)).toBe('dark');
    expect(stepScare(s, 0.02)).toBe('face');
    expect(stepScare(s, k.show)).toBe('done');
  });

  it('작은 놀람은 얼굴 없이 끝난다', () => {
    const s = createScare(false, k);
    expect(stepScare(s, k.dark)).toBe('done');
  });

  it('시간이 거꾸로 와도 되감기지 않는다', () => {
    const s = createScare(true, k);
    stepScare(s, 0.5);
    stepScare(s, -0.4);
    expect(s.t).toBe(0.5);
  });
});

describe('가장자리 어둠', () => {
  it('멀면 없고 가까우면 짙다', () => {
    expect(dreadLevel(k.dreadFar + 5, false, k)).toBe(0);
    expect(dreadLevel(k.dreadNear, false, k)).toBeCloseTo(k.dreadMax);
    expect(dreadLevel(4, false, k)).toBeGreaterThan(dreadLevel(8, false, k));
  });

  it('쫓기면 멀어도 어둡다', () => {
    expect(dreadLevel(50, true, k)).toBeCloseTo(k.dreadChase * k.dreadMax);
  });
});

describe('멀리 서 있는 형체', () => {
  const east = -Math.PI / 2;
  it('보는 쪽으로 곧게 보이는 먼 자리를 고른다', () => {
    const spot = figureSpot(hall, { x: 2.5, y: 1.5 }, east, 5, 8);
    expect(spot.x).toBeCloseTo(10.5);
    expect(spot.y).toBeCloseTo(1.5);
  });

  it('벽이 가까우면 자리가 없다', () => {
    expect(figureSpot(hall, { x: 16.5, y: 1.5 }, east, 5, 8)).toBe(null);
  });

  it('벽 너머는 고르지 않는다', () => {
    expect(figureSpot(withOpen(hall), { x: 2.5, y: 1.5 }, 0, 1, 8)).toBe(null);
  });
});
