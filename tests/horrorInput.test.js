import { describe, it, expect } from 'vitest';
import { moveFromKeys, moveFromStick, stepPlayer, noiseFor, nextPixelRatio, startRatio } from '../src/logic/horrorInput.js';
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

  it('옆걸음은 보는 방향의 오른쪽이다 (yaw 0 은 x 가 늘어난다)', () => {
    const p = stepPlayer({ x: 2.5, y: 2.5 }, { x: 1, z: 0 }, 0, 1, 0.5, room, 0.2);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(2.5);
  });

  it('yaw 가 있으면 앞은 그 방향이다 (왼쪽으로 90도면 x 가 줄어든다)', () => {
    const p = stepPlayer({ x: 2.5, y: 2.5 }, { x: 0, z: 1 }, Math.PI / 2, 1, 0.5, room, 0.2);
    expect(p.x).toBeCloseTo(2);
    expect(p.y).toBeCloseTo(2.5);
  });

  it('yaw 가 있으면 오른쪽도 같이 돈다 (왼쪽으로 90도면 오른쪽은 y 가 줄어든다)', () => {
    const p = stepPlayer({ x: 2.5, y: 2.5 }, { x: 1, z: 0 }, Math.PI / 2, 1, 0.5, room, 0.2);
    expect(p.x).toBeCloseTo(2.5);
    expect(p.y).toBeCloseTo(2);
  });

  it('조이스틱 위로 밀면 앞, 오른쪽으로 밀면 오른쪽 옆걸음', () => {
    const up = moveFromStick(0, -40, 70, 0.92);
    const right = moveFromStick(40, 0, 70, 0.92);
    expect(up.z).toBeGreaterThan(0);
    expect(up.x).toBe(0);
    expect(right.x).toBeGreaterThan(0);
    expect(right.z).toBe(0);
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

  it('태블릿은 낮은 배율로 시작한다', () => {
    expect(startRatio(2, true, k)).toBe(k.touchRatio);
    expect(startRatio(2, false, k)).toBe(k.maxRatio);
    expect(startRatio(1, true, k)).toBe(1); // 화면보다 높이지는 않는다
    expect(startRatio(undefined, false, k)).toBe(1);
  });

  it('범위를 넘지 않는다', () => {
    expect(nextPixelRatio(k.minRatio, 5, k)).toBe(k.minRatio);
    expect(nextPixelRatio(k.maxRatio, 60, k)).toBe(k.maxRatio);
  });
});
