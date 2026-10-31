import { describe, it, expect } from 'vitest';
import { moveFromKeys, moveFromStick, stepPlayer, noiseFor, nextPixelRatio } from '../src/logic/horrorInput.js';
import { parseMap } from '../src/logic/horrorGrid.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const room = parseMap(['#####', '#...#', '#...#', '#####']);

describe('이동 값', () => {
  it('대각선도 빨라지지 않는다', () => {
    const m = moveFromKeys({ up: true, right: true });
    expect(Math.hypot(m.x, m.z)).toBeCloseTo(1);
  });

  it('달리기 키를 읽는다', () => {
    expect(moveFromKeys({ up: true, run: true }).run).toBe(true);
    expect(moveFromKeys({}).run).toBe(false);
  });

  it('조이스틱을 끝까지 밀면 달린다', () => {
    expect(moveFromStick(0, -60, 60, 0.92)).toEqual({ x: 0, z: 1, run: true });
    expect(moveFromStick(0, -30, 60, 0.92).run).toBe(false);
  });
});

describe('벽 충돌', () => {
  it('앞으로 걷는다 (yaw 0 은 y 가 줄어드는 쪽)', () => {
    const p = stepPlayer({ x: 2.5, y: 2.5 }, { x: 0, z: 1 }, 0, 1, 0.5, room, 0.2);
    expect(p.y).toBeCloseTo(2);
    expect(p.x).toBeCloseTo(2.5);
  });

  it('벽을 지나가지 못한다', () => {
    let p = { x: 2.5, y: 1.5 };
    for (let i = 0; i < 60; i++) p = stepPlayer(p, { x: 0, z: 1 }, 0, 2, 0.05, room, 0.2);
    expect(p.y).toBeGreaterThanOrEqual(1.2);
  });

  it('벽을 따라 미끄러진다', () => {
    const p = stepPlayer({ x: 2.5, y: 1.25 }, { x: 0.7, z: 0.7 }, 0, 1, 0.5, room, 0.2);
    expect(p.x).toBeGreaterThan(2.5);
    expect(p.y).toBeCloseTo(1.25);
  });
});

describe('소리 크기', () => {
  it('멈추면 0, 달리면 걸을 때보다 크다', () => {
    expect(noiseFor(false, false, k)).toBe(0);
    expect(noiseFor(true, true, k)).toBeGreaterThan(noiseFor(true, false, k));
  });
});

describe('해상도 조절', () => {
  it('느리면 낮추고 충분히 빠르면 높인다', () => {
    expect(nextPixelRatio(1.5, 20, k)).toBeCloseTo(1.5 - k.ratioStep);
    expect(nextPixelRatio(1, 58, k)).toBeCloseTo(1 + k.ratioStep);
    expect(nextPixelRatio(1, 40, k)).toBe(1);
  });

  it('범위를 넘지 않는다', () => {
    expect(nextPixelRatio(k.minRatio, 5, k)).toBe(k.minRatio);
    expect(nextPixelRatio(k.maxRatio, 60, k)).toBe(k.maxRatio);
  });
});
