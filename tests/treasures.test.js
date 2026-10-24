import { describe, it, expect } from 'vitest';
import { placeTreasures, heightWeight } from '../src/logic/treasures.js';
import { stageRamp, withDifficulty } from '../src/logic/difficulty.js';
import { stages } from '../src/stage/index.js';

const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// 보물이 놓인 평균 높이 (땅에서 몇 픽셀 위인지)
function avgHeight(st, n, runs = 300) {
  const rand = seeded(n * 97);
  let sum = 0;
  let count = 0;
  for (let r = 0; r < runs; r++) {
    for (const t of placeTreasures(st, n, rand)) {
      sum += st.groundY - t.y;
      count += 1;
    }
  }
  return sum / count;
}

describe('보물 자리 무작위', () => {
  it('들어올 때마다 자리가 바뀐다', () => {
    const st = stages[0];
    const rand = seeded(7);
    const seen = new Set();
    for (let r = 0; r < 30; r++) seen.add(placeTreasures(st, 1, rand).map((t) => `${t.x},${t.y}`).join('|'));
    expect(seen.size).toBeGreaterThan(20);
  });

  it('뒤 스테이지일수록 높은 곳에 숨는다', () => {
    expect(heightWeight(300, 1)).toBe(1);
    expect(heightWeight(300, 10)).toBeGreaterThan(heightWeight(300, 5));
    // 같은 스테이지 모양이라도 스테이지 번호가 크면 더 높이 놓인다
    const st = stages[9];
    expect(avgHeight(st, 10)).toBeGreaterThan(avgHeight(st, 1) + 60);
    // 실제 스테이지 1 과 10 비교
    expect(avgHeight(stages[9], 10)).toBeGreaterThan(avgHeight(stages[0], 1) + 100);
  });

  it('보물끼리 너무 붙어 있지 않다', () => {
    const rand = seeded(3);
    for (const [i, st] of stages.entries()) {
      for (let r = 0; r < 50; r++) {
        const xs = placeTreasures(st, i + 1, rand).map((t) => t.x).sort((a, b) => a - b);
        for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThanOrEqual(130);
      }
    }
  });
});

describe('스테이지마다 조금씩 어려워짐', () => {
  it('스테이지 1 은 원래 난이도 그대로', () => {
    const d = withDifficulty({}, 'normal', 1).difficulty;
    expect(d).toEqual({ level: 'normal', monsterDamage: 1, monsterSpeed: 1, monsterWindup: 1, bossHealth: 1, bossSpeed: 1, bossCombo: 0.15 });
  });

  it('스테이지가 오를수록 몬스터와 보스가 서서히 세진다', () => {
    for (let n = 2; n <= stages.length; n++) {
      const a = withDifficulty({}, 'normal', n - 1).difficulty;
      const b = withDifficulty({}, 'normal', n).difficulty;
      expect(b.monsterDamage).toBeGreaterThan(a.monsterDamage);
      expect(b.monsterSpeed).toBeGreaterThan(a.monsterSpeed);
      expect(b.monsterWindup).toBeLessThan(a.monsterWindup);
      expect(b.bossHealth).toBeGreaterThan(a.bossHealth);
      expect(b.bossSpeed).toBeLessThan(a.bossSpeed);
      expect(b.bossCombo).toBeGreaterThan(a.bossCombo);
    }
    // 서서히: 한 스테이지에 5% 넘게 뛰지 않는다
    const r = stageRamp(2);
    for (const k of ['monsterDamage', 'monsterSpeed', 'monsterWindup', 'bossHealth', 'bossSpeed']) expect(Math.abs(r[k] - 1)).toBeLessThanOrEqual(0.05);
  });

  it('어려움 10 스테이지도 겹쳐 쓰기 확률은 1 을 넘지 않는다', () => {
    expect(withDifficulty({}, 'hard', 10).difficulty.bossCombo).toBeLessThanOrEqual(1);
  });
});
