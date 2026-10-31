import { describe, expect, it, vi } from 'vitest';
import { balance } from '../src/config/balance.js';
import { SIGNATURES } from '../src/boss/signatures/index.js';
import { stages } from '../src/stage/index.js';
import { darkAlpha, lightningXs, releaseTimes, rollFrom, signatureDue, warnTime } from '../src/logic/sig_dragon.js';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {}, Intersects: {} }, GameObjects: {}, Math: {} } }));

const k = balance.dragonBoss;
const variants = { 8: 'boulders', 13: 'boulders', 18: 'boulders', 23: 'lightning', 29: 'lightning', 33: 'darkOrbs', 38: 'darkOrbs' };

describe('용 변종 스테이지', () => {
  for (const [n, name] of Object.entries(variants)) {
    const boss = stages[n - 1].boss;

    it(`${n}: 단계마다 전용 공격이 하나씩, 공격 수는 그대로`, () => {
      expect(boss.signature).toBe(name);
      expect(SIGNATURES[name]?.tip).toBeTruthy();
      for (const list of boss.phases) {
        expect(list).toHaveLength(5);
        expect(list.filter((p) => p === 'signature')).toHaveLength(1);
      }
    });

    it(`${n}: 꼬리와 날개를 끝까지 부술 수 있다`, () => {
      const [, one] = boss.phases;
      expect(boss.phases[0].some((p) => ['tail', 'wing', 'fly'].includes(p))).toBe(true);
      // 하나가 부서진 단계에서는 어느 쪽이 남아도 때릴 기회가 있어야 한다
      expect(one).toContain('tail');
      expect(one.some((p) => p === 'wing' || p === 'fly')).toBe(true);
    });
  }
});

describe('전용 공격을 꼭 보여 준다', () => {
  const phases = [['breath', 'signature']];

  it('두 번째 공격까지 안 나왔으면 이번에 낸다', () => {
    expect(signatureDue(phases, false, 1)).toBe(false);
    expect(signatureDue(phases, false, 2)).toBe(true);
    expect(signatureDue(phases, true, 2)).toBe(false);
  });

  it('전용 공격이 없는 보스는 그대로다', () => {
    expect(signatureDue([['breath', 'tail']], false, 5)).toBe(false);
  });
});

describe('경고 시간', () => {
  it('가장 빠른 보스가 화나도 피할 시간이 남는다', () => {
    expect(warnTime(1, 0.7 * 0.7)).toBe(0.7);
    expect(warnTime(1, 1)).toBe(1);
  });
});

describe('바위', () => {
  it('주인공에게서 먼 벽에서 주인공 쪽으로 구른다', () => {
    expect(rollFrom(900, 0, 1000)).toEqual({ x: -40, dir: 1 });
    expect(rollFrom(100, 0, 1000)).toEqual({ x: 1040, dir: -1 });
  });

  it('점프 시간보다 넉넉한 간격으로 나온다', () => {
    const air = (2 * balance.player.jumpSpeed) / balance.world.gravity;
    expect(k.boulderGap).toBeGreaterThan(air);
    expect(releaseTimes(3, 1.3)).toEqual([0, 1.3, 2.6]);
  });

  it('주인공이 달려서 도망칠 수 없을 만큼 빠르지만 점프로 넘는다', () => {
    expect(k.boulderSpeed).toBeGreaterThan(balance.player.moveSpeed);
    expect(k.boulderSpeed).toBeLessThan(balance.dragonBoss.landWaveSpeed + 1);
  });
});

describe('낙뢰', () => {
  it('주인공 자리부터 떨어지고 번개 사이로 피할 수 있다', () => {
    const xs = lightningXs(500, 4, 170, 0, 1000, () => 0.9);
    expect(xs[0]).toBe(500);
    expect(xs).toHaveLength(4);
    const sorted = [...xs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBe(170);
  });

  it('벽 쪽에 있어도 싸움터 안에서 개수를 채운다', () => {
    const xs = lightningXs(10, 5, 170, 60, 900, () => 0.1);
    expect(xs).toHaveLength(5);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(60);
      expect(x).toBeLessThanOrEqual(900);
    }
  });

  it('경고 안에 옆 틈까지 걸어갈 수 있다', () => {
    expect(warnTime(k.lightningWarningTime, 0.49) * balance.player.moveSpeed).toBeGreaterThan(k.lightningGap / 2);
  });
});

describe('어둠', () => {
  it('서서히 어두워지고 끝나면 완전히 돌아온다', () => {
    expect(darkAlpha(0, 5, 0.4, 0.45)).toBe(0);
    expect(darkAlpha(2, 5, 0.4, 0.45)).toBe(0.45);
    expect(darkAlpha(5, 5, 0.4, 0.45)).toBe(0);
    expect(darkAlpha(6, 5, 0.4, 0.45)).toBe(0);
  });

  it('구슬은 주인공보다 훨씬 느리다', () => {
    expect(k.orbSpeed * 2).toBeLessThan(balance.player.moveSpeed);
  });
});
