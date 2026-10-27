import { describe, it, expect } from 'vitest';
import { statEvent, countStat } from '../src/net/stats.js';

describe('방문 통계', () => {
  it('스테이지 이름은 두 자리로 맞춰 통계 화면에서 순서대로 보인다', () => {
    expect(statEvent('start', 3)).toEqual({ path: 'stage-03-start', title: '스테이지 3 시작' });
    expect(statEvent('clear', 12).path).toBe('stage-12-clear');
    expect(statEvent('fall', 1).path).toBe('stage-01-fall');
    expect(statEvent('rush-done', 2).path).toBe('rush-2-done');
    expect(statEvent('coop-host').path).toBe('coop-host');
    expect(statEvent('zzz')).toBe(null);
  });

  it('count.js 가 있으면 사건으로 센다', () => {
    const got = [];
    countStat('clear', 5, { goatcounter: { count: (v) => got.push(v) } });
    expect(got).toEqual([{ path: 'stage-05-clear', title: '스테이지 5 클리어', event: true }]);
  });

  it('count.js 가 없거나 오류가 나도 게임은 멈추지 않는다', () => {
    expect(() => countStat('start', 1, {})).not.toThrow();
    expect(() => countStat('start', 1, undefined)).not.toThrow();
    expect(() => countStat('start', 1, { goatcounter: { count: () => { throw new Error('blocked'); } } })).not.toThrow();
  });
});
