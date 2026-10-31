import { describe, expect, it, vi } from 'vitest';
import { cloneSlots, huntResult, owedSignature, pickReal, rushDone, rushPath } from '../src/logic/sig_watcher.js';
import { WATCHER_PATTERNS } from '../src/logic/watcher.js';
import { SIGNATURES } from '../src/boss/signatures/index.js';
import { stages } from '../src/stage/index.js';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {}, Intersects: {} } } }));

const stageOf = (n) => stages[n - 1];

describe('그림자 분신 계산', () => {
  it('자리는 싸움터 양 끝까지 고르게 놓인다', () => {
    expect(cloneSlots(100, 400, 4)).toEqual([100, 200, 300, 400]);
    expect(cloneSlots(100, 400, 1)).toEqual([250]);
  });

  it('진짜 자리는 언제나 분신 안에 있다', () => {
    for (const r of [0, 0.5, 0.999]) {
      const i = pickReal(5, () => r);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(5);
    }
  });

  it('주인공 쪽으로 달려들고 싸움터 밖으로 나가지 않는다', () => {
    expect(rushPath(500, 300, 200, 0, 900)).toEqual({ dir: -1, from: 500, to: 300 });
    expect(rushPath(500, 800, 600, 0, 900)).toEqual({ dir: 1, from: 500, to: 900 });
  });

  it('달려드는 길 끝을 지나면 끝난다', () => {
    const path = rushPath(500, 300, 100, 0, 900);
    expect(rushDone(450, path)).toBe(false);
    expect(rushDone(399, path)).toBe(true);
  });
});

describe('분신 찾기 결과', () => {
  it('진짜를 찾으면 시간과 상관없이 달려들지 않고 끝난다', () => {
    expect(huntResult(true, 3)).toBe('found');
    expect(huntResult(true, -1)).toBe('found');
  });

  it('시간이 다 됐을 때만 달려든다', () => {
    expect(huntResult(false, 0)).toBe('rush');
    expect(huntResult(false, 0.1)).toBeNull();
  });
});

describe('전용 공격이 꼭 나온다', () => {
  const def = { signature: 'clones', phases: [['claw', 'signature']] };

  it('처음 지치기 전 마지막 공격에서 쓴다', () => {
    expect(owedSignature(def, false, 1, 3)).toBe(false);
    expect(owedSignature(def, false, 2, 3)).toBe(true);
  });

  it('이미 썼거나 전용 공격이 없으면 고르지 않는다', () => {
    expect(owedSignature(def, true, 2, 3)).toBe(false);
    expect(owedSignature({ phases: [['claw']] }, false, 2, 3)).toBe(false);
  });
});

describe('와처 변종 스테이지', () => {
  const spec = { 11: 'spores', 17: 'spores', 28: 'spores', 22: 'clones', 31: 'clones', 35: 'clones' };

  it('단계마다 전용 공격이 있고 공격 수는 그대로다', () => {
    for (const [n, name] of Object.entries(spec)) {
      const b = stageOf(+n).boss;
      expect(b.signature, n).toBe(name);
      expect(SIGNATURES[name].tip, n).toBeTruthy();
      for (const list of b.phases) {
        expect(list, n).toHaveLength(5);
        expect(list.filter((p) => p === 'signature'), n).toHaveLength(1);
        for (const p of list) expect(WATCHER_PATTERNS, n).toContain(p);
      }
    }
  });

  it('긴 팔이 남은 단계에는 할퀴기가 있어 언제나 쓰러뜨릴 수 있다', () => {
    for (const st of stages.filter((s) => s.boss.type === 'watcher')) {
      expect(st.boss.phases[0], st.boss.name).toContain('claw');
      expect(st.boss.phases[1], st.boss.name).toContain('claw');
    }
  });
});
