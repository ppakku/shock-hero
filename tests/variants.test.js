import { describe, expect, it, vi } from 'vitest';
import { customArt } from '../src/config/art.js';
import { VARIANTS } from '../src/config/variantArt.js';
import { SIGNATURES } from '../src/boss/signatures/index.js';
import { stages } from '../src/stage/index.js';
import { bossArtKeys } from '../src/logic/stageArt.js';
import { driftToward, fanOut } from '../src/logic/signature.js';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {}, Intersects: {} } } }));

const variantStages = stages.map((st, i) => ({ st, n: i + 1 })).filter(({ n }) => n > 6 && n !== 10);

describe('보스 변종', () => {
  it('7스테이지부터 모두 변종이고 원본 보스는 그대로다', () => {
    for (const { st, n } of variantStages) expect(VARIANTS[st.boss.skin], `${n}`).toBeTruthy();
    for (const n of [1, 2, 3, 4, 5, 6, 10]) expect(VARIANTS[stages[n - 1].boss.skin], `${n}`).toBeUndefined();
  });

  it('변종마다 쓸 그림이 있다', () => {
    for (const { st, n } of variantStages) {
      const keys = bossArtKeys(st, n, customArt);
      expect(keys.some((k) => k.endsWith(`_${st.boss.skin}`)), `${n}`).toBe(true);
    }
  });

  it('공격 목록의 signature 는 있는 전용 공격을 가리킨다', () => {
    for (const { st, n } of variantStages) {
      const uses = st.boss.phases.flat().includes('signature');
      if (uses) expect(SIGNATURES[st.boss.signature], `${n}`).toBeTruthy();
    }
  });
});

describe('전용 공격 계산', () => {
  it('구름은 싸움터 안에서 주인공 쪽으로 간다', () => {
    const p = driftToward({ x: 100, y: 0 }, { x: 200, y: 0 }, 50, 1, 0, 150);
    expect(p).toEqual({ x: 150, y: 0 });
    expect(driftToward({ x: 149, y: 0 }, { x: 900, y: 0 }, 50, 1, 0, 150).x).toBe(150);
  });

  it('구름 자리는 보스가 보는 쪽으로 벌어진다', () => {
    expect(fanOut(500, -1, 2, 100)).toEqual([400, 300]);
  });
});
