import { describe, it, expect } from 'vitest';
import { alive, nearestPlayer, strongerResult, partyCenter, clampSpread } from '../src/logic/coop.js';

const a = { x: 100, y: 400, dead: false };
const b = { x: 600, y: 300, dead: false };

describe('함께하기 계산', () => {
  it('살아 있는 사람만 고른다', () => {
    expect(alive([a, { ...b, dead: true }])).toEqual([a]);
  });

  it('가장 가까운 살아 있는 사람을 노린다', () => {
    expect(nearestPlayer([a, b], 500)).toBe(b);
    expect(nearestPlayer([a, b], 200)).toBe(a);
    expect(nearestPlayer([a, b], 350, 300)).toBe(b); // y 도 주면 거리로 잰다
  });

  it('가까운 사람이 쓰러졌으면 다른 사람, 다 쓰러졌으면 1P', () => {
    const deadB = { ...b, dead: true };
    expect(nearestPlayer([a, deadB], 590)).toBe(a);
    const deadA = { ...a, dead: true };
    expect(nearestPlayer([deadA, deadB], 590)).toBe(deadA);
  });

  it('피해 결과는 더 센 쪽을 남긴다', () => {
    expect(strongerResult('miss', 'hit')).toBe('hit');
    expect(strongerResult('hit', 'dodged')).toBe('hit');
    expect(strongerResult('ignored', 'dodged')).toBe('dodged');
    expect(strongerResult('miss', 'ignored')).toBe('ignored');
  });

  it('카메라는 살아 있는 사람들의 가운데', () => {
    expect(partyCenter([a, b])).toEqual({ x: 350, y: 350 });
    expect(partyCenter([a, { ...b, dead: true }])).toEqual({ x: 100, y: 400 });
    expect(partyCenter([{ ...a, dead: true }, { ...b, dead: true }])).toEqual({ x: 350, y: 350 });
  });

  it('너무 멀어지면 가운데 쪽으로 당긴다', () => {
    const far = { x: 1500, y: 400, dead: false };
    const xs = clampSpread([a, far], 880);
    expect(xs[1] - xs[0]).toBe(880);
    expect((xs[0] + xs[1]) / 2).toBe(800);
    expect(clampSpread([a, b], 880)).toEqual([100, 600]); // 가까우면 그대로
    expect(clampSpread([a, { ...far, dead: true }], 880)).toEqual([100, 1500]); // 쓰러진 사람은 안 당긴다
  });

  it('멀어지려는 사람만 멈추고, 가만히 있던 사람은 끌려가지 않는다', () => {
    const runner = { x: 990, y: 400, dead: false };
    expect(clampSpread([a, runner], 880, [100, 970])).toEqual([100, 980]);
    const back = { x: 70, y: 400, dead: false };
    expect(clampSpread([back, b], 500, [90, 600])).toEqual([100, 600]);
  });
});
