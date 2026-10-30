import { describe, it, expect } from 'vitest';
import { bossVarietyOf, jitterRest, nextTiredAfter, lateWarning, varyCount, shouldFeint } from '../src/logic/bossVariety.js';
import { pillarWaves } from '../src/logic/dragon.js';
import { avalancheWaves } from '../src/logic/boss.js';

const steps = (n) => Array.from({ length: n }, (_, i) => (i + 0.5) / n);
const fixed = (...vals) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('난이도별 흔들림 값', () => {
  it('쉬움은 쉬는 시간만 조금 흔든다', () => {
    expect(bossVarietyOf('easy')).toEqual({ rest: 0.15, tired: 0, shape: 0, feint: 0 });
  });
  it('속임 동작은 어려움에만 있다', () => {
    expect(bossVarietyOf('normal').feint).toBe(0);
    expect(bossVarietyOf('hard').feint).toBeGreaterThan(0);
  });
  it('모르는 난이도는 보통', () => {
    expect(bossVarietyOf('nope')).toEqual(bossVarietyOf('normal'));
    expect(bossVarietyOf(undefined)).toEqual(bossVarietyOf('normal'));
  });
});

describe('쉬는 시간', () => {
  const v = bossVarietyOf('hard');
  it('범위 안에서 흔들리고 평균은 그대로', () => {
    const xs = steps(1000).map((r) => jitterRest(1, v, () => r));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1.4);
    expect(avg(xs)).toBeCloseTo(1, 5);
  });
});

describe('지치기까지 공격 횟수', () => {
  it('쉬움은 고정', () => {
    for (const r of steps(20)) expect(nextTiredAfter(3, bossVarietyOf('easy'), () => r)).toBe(3);
  });
  it('보통은 2~4번이고 평균은 3번', () => {
    const xs = steps(999).map((r) => nextTiredAfter(3, bossVarietyOf('normal'), () => r));
    expect(new Set(xs)).toEqual(new Set([2, 3, 4]));
    expect(avg(xs)).toBeCloseTo(3, 5);
  });
  it('최소 횟수 아래로 내려가지 않는다', () => {
    expect(nextTiredAfter(1, bossVarietyOf('normal'), () => 0, 1)).toBe(1);
  });
});

describe('늦은 경고', () => {
  it('경고는 절대 짧아지지 않고 1.4배를 넘지 않는다', () => {
    const v = bossVarietyOf('hard');
    for (const a of steps(50)) for (const b of steps(50)) {
      const w = lateWarning(0.9, v, fixed(a, b));
      expect(w).toBeGreaterThanOrEqual(0.9);
      expect(w).toBeLessThanOrEqual(0.9 * 1.4 + 1e-9);
    }
  });
  it('쉬움은 그대로', () => {
    expect(lateWarning(0.9, bossVarietyOf('easy'), () => 0)).toBe(0.9);
  });
});

describe('개수 변형', () => {
  const v = bossVarietyOf('hard');
  it('확률에 걸리면 하나 늘거나 준다', () => {
    expect(varyCount(3, v, fixed(0, 0))).toBe(2);
    expect(varyCount(3, v, fixed(0, 0.9))).toBe(4);
  });
  it('확률에 안 걸리면 그대로', () => {
    expect(varyCount(3, v, () => 0.99)).toBe(3);
  });
  it('최소 개수를 지킨다', () => {
    expect(varyCount(2, v, fixed(0, 0), 2)).toBe(2);
  });
  it('쉬움은 그대로', () => {
    expect(varyCount(3, bossVarietyOf('easy'), () => 0)).toBe(3);
  });
});

describe('속임 동작', () => {
  const hard = bossVarietyOf('hard');
  it('허용된 공격만 속인다', () => {
    expect(shouldFeint('slam', ['slam'], hard, () => 0)).toBe(true);
    expect(shouldFeint('vines', ['slam'], hard, () => 0)).toBe(false);
  });
  it('확률을 넘으면 속이지 않는다', () => {
    expect(shouldFeint('slam', ['slam'], hard, () => 0.9)).toBe(false);
  });
  it('보통에서는 나오지 않는다', () => {
    expect(shouldFeint('slam', ['slam'], bossVarietyOf('normal'), () => 0)).toBe(false);
  });
});

describe('자리 변형', () => {
  it('불기둥을 밀어도 두 묶음 간격이 유지된다', () => {
    const [a, b] = pillarWaves(100, 1100, 200, 60);
    const all = [...a, ...b].sort((x, y) => x - y);
    for (let i = 1; i < all.length; i++) expect(all[i] - all[i - 1]).toBe(200);
    expect(all[0]).toBe(260);
  });
  it('불기둥은 밀지 않으면 그대로', () => {
    expect(pillarWaves(100, 1100, 200)).toEqual(pillarWaves(100, 1100, 200, 0));
  });
  it('빙천지락 순서를 바꾸면 첫 묶음과 둘째 묶음이 뒤바뀐다', () => {
    const plain = avalancheWaves(0, 700, 100, 0, 2);
    const swapped = avalancheWaves(0, 700, 100, 0, 2, true);
    expect(swapped[0]).toEqual(plain[1]);
    expect(swapped[1]).toEqual(plain[0]);
  });
  it('분노로 세 번 솟아도 번갈아 나온다', () => {
    const s = avalancheWaves(0, 700, 100, 0, 3, true);
    expect(s[0]).toEqual(s[2]);
    expect(s[0]).not.toEqual(s[1]);
  });
});
