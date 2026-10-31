import { describe, expect, it, vi } from 'vitest';
import { balance } from '../src/config/balance.js';
import { SIGNATURES } from '../src/boss/signatures/index.js';
import { stages } from '../src/stage/index.js';
import { airTimeAbove, chainPosts, signatureDue, warnTime, zigzag } from '../src/logic/sig_arms.js';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {}, Intersects: {} } } }));

const c = balance.boss;
const { jumpSpeed, moveSpeed } = balance.player;
const gravity = balance.world.gravity;

// 제일 약한 점프 배수 (주인공 표 어디에 있든 찾는다)
const weakestJump = () => {
  const found = [];
  const walk = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'jumpMultiplier') found.push(v);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(balance.heroes);
  return Math.min(1, ...found);
};

describe('번개 사슬', () => {
  it('기둥 사이에 주인공이 있고 기둥은 싸움터 안에 있다', () => {
    for (const r of [0, 0.5, 0.999]) {
      const [a, b] = chainPosts(500, 400, 100, 900, () => r);
      expect(a).toBeLessThan(500);
      expect(b).toBeGreaterThan(500);
      expect(b - a).toBeCloseTo(400);
    }
  });

  it('구석에 있어도 기둥이 밖으로 나가지 않는다', () => {
    expect(chainPosts(100, 400, 100, 900, () => 1)).toEqual([100, 500]);
    expect(chainPosts(900, 400, 100, 900, () => 0)).toEqual([500, 900]);
    expect(chainPosts(500, 2000, 100, 900, () => 0.5)).toEqual([100, 900]);
  });

  it('제일 약한 점프로도 사슬을 넘는다', () => {
    expect(airTimeAbove(44, jumpSpeed * weakestJump(), gravity)).toBeGreaterThan(c.voltStrikeTime);
  });

  it('닿지 못하는 높이면 떠 있는 시간이 0 이다', () => {
    expect(airTimeAbove(9999, jumpSpeed, gravity)).toBe(0);
  });

  it('대시 무적이 번개보다 길어서 대시로도 지나간다', () => {
    expect(balance.dash.invincibleTime).toBeGreaterThanOrEqual(c.voltStrikeTime);
  });

  it('사슬의 양 끝은 기둥에 붙어 있다', () => {
    const pts = zigzag(100, 500, 400, 10, 14, () => 1);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual({ x: 100, y: 400 });
    expect(pts[10]).toEqual({ x: 500, y: 400 });
    expect(pts[5].y).toBe(414);
  });
});

describe('드릴 땅파기', () => {
  it('보스가 빨라져도 경고는 걸어서 비킬 만큼 나온다', () => {
    const t = warnTime(c.drillWarningTime, 0.1, 0.6);
    expect(t).toBe(0.6);
    expect(t * moveSpeed).toBeGreaterThan(100);
  });

  it('흙더미는 주인공이 달리면 따라잡지 못한다', () => {
    expect(c.drillSpeed).toBeLessThan(moveSpeed);
  });

  it('피해는 내려찍기와 같다', () => {
    expect(c.drillDamage).toBe(c.slamDamage);
  });
});

describe('파쇄자 변종 스테이지', () => {
  const uses = { 7: 'drillBurrow', 12: 'drillBurrow', 21: 'voltChain', 27: 'voltChain', 32: 'voltChain' };
  const counts = { 7: [4, 4, 5, 3], 12: [5, 5, 5, 4], 21: [5, 5, 5, 4], 27: [5, 5, 5, 4], 32: [5, 5, 5, 4] };

  it.each(Object.keys(uses))('스테이지 %s 는 단계마다 전용 공격이 하나씩 있고 공격 수는 그대로다', (n) => {
    const boss = stages[n - 1].boss;
    expect(boss.signature).toBe(uses[n]);
    expect(SIGNATURES[boss.signature].tip).toBeTruthy();
    expect(boss.phases.map((p) => p.length)).toEqual(counts[n]);
    for (const p of boss.phases) expect(p.filter((a) => a === 'signature')).toHaveLength(1);
  });

  it('팔이 있는 단계마다 팔을 때릴 공격이 남아 있다', () => {
    const opens = ['slam', 'multiSlam', 'doubleSlam', 'sweep', 'rocketPunch'];
    for (const n of Object.keys(uses)) {
      for (const p of stages[n - 1].boss.phases.slice(0, 3)) expect(p.some((a) => opens.includes(a))).toBe(true);
    }
  });

  it('스테이지마다 빼는 공격이 조금씩 다르다', () => {
    const lists = Object.keys(uses).map((n) => JSON.stringify(stages[n - 1].boss.phases));
    expect(new Set(lists).size).toBe(lists.length);
  });
});

describe('전용 공격 없이 끝나지 않게', () => {
  const phases = [['slam', 'signature']];

  it('정해진 횟수까지 안 나왔으면 다음은 전용 공격이다', () => {
    expect(signatureDue(phases, 1, false, 2)).toBe(false);
    expect(signatureDue(phases, 2, false, 2)).toBe(true);
  });

  it('한 번 나왔거나 전용 공격이 없는 보스는 그대로다', () => {
    expect(signatureDue(phases, 9, true, 2)).toBe(false);
    expect(signatureDue([['slam']], 9, false, 2)).toBe(false);
  });
});
