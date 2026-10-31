import { describe, expect, it } from 'vitest';
import { balance as cfg } from '../src/config/balance.js';
import { stages } from '../src/stage/index.js';
import { galeDir, pushOutOfWall, shardStrips, snowLanes, wallRooms, wallSpots, windPush } from '../src/logic/sig_ice.js';

describe('강풍', () => {
  it('날 때는 주인공 가까운 끝에서 먼 끝으로 분다', () => {
    expect(galeDir(true, 900, 500, 500)).toBe(-1);
    expect(galeDir(true, 100, 500, 500)).toBe(1);
  });

  it('땅에서는 보스에게서 주인공 쪽으로 분다', () => {
    expect(galeDir(false, 900, 950, 500)).toBe(-1);
    expect(galeDir(false, 200, 100, 500)).toBe(1);
  });

  it('바람은 싸움터 끝을 넘겨 밀지 않고 끝 너머 사람을 끌어오지도 않는다', () => {
    expect(windPush(100, 1, 130, 1, 0, 1000)).toBe(230);
    expect(windPush(990, 1, 130, 1, 0, 1000)).toBe(1000);
    expect(windPush(5, -1, 130, 1, 0, 1000)).toBe(0);
    expect(windPush(1010, 1, 130, 1, 0, 1000)).toBe(1010);
  });

  it('바람은 걷기보다 느려서 맞서 걸을 수 있다', () => {
    expect(cfg.iceBoss.galeSpeed).toBeLessThan(cfg.player.moveSpeed);
  });

  it('눈덩이는 낮게, 높게 순서로 시작한다', () => {
    expect(snowLanes(4, () => 0)).toEqual(['low', 'high', 'low', 'low']);
    expect(snowLanes(3, () => 0.9)).toEqual(['low', 'high', 'high']);
  });
});

describe('얼음벽', () => {
  const start = 0;
  const end = 960;
  const gap = cfg.iceBoss.iceWallGap;

  it('주인공을 가운데 두고 벽이 선다', () => {
    expect(wallSpots(480, start, end, gap, 240)).toEqual([330, 630]);
  });

  it('구석에 있어도 끝 방이 좁아지지 않는다', () => {
    for (const hero of [0, 40, 920, 960]) {
      const [a, b] = wallSpots(hero, start, end, gap, 240);
      expect(a - start).toBeGreaterThanOrEqual(240);
      expect(end - b).toBeGreaterThanOrEqual(240);
      expect(b - a).toBe(gap);
    }
  });

  it('벽 속의 주인공은 가까운 쪽으로 빠진다', () => {
    expect(pushOutOfWall(495, 15, 500, 22, 0, 960)).toBe(463);
    expect(pushOutOfWall(505, 15, 500, 22, 0, 960)).toBe(537);
  });

  it('벽에 닿아 있기만 하면 건드리지 않는다', () => {
    expect(pushOutOfWall(463, 15, 500, 22, 0, 960)).toBe(463);
    expect(pushOutOfWall(100, 15, 500, 22, 0, 960)).toBe(100);
  });

  it('끝 너머로는 빼내지 않는다', () => {
    expect(pushOutOfWall(25, 15, 30, 22, 0, 960)).toBe(67);
  });

  it('방은 벽을 뺀 나머지다', () => {
    expect(wallRooms(0, 960, [330, 630], 22)).toEqual([[0, 308], [352, 608], [652, 960]]);
  });

  it('얼음은 방마다 절반이고 다음 번엔 반대쪽이라 늘 피할 곳이 있다', () => {
    const hero = 30; // 주인공 몸 폭
    for (const heroAt of [480, 0, 960]) {
      const rooms = wallRooms(start, end, wallSpots(heroAt, start, end, gap, 240), 22);
      for (const flip of [false, true]) {
        const one = shardStrips(rooms, 0, flip, 8);
        const two = shardStrips(rooms, 1, flip, 8);
        rooms.forEach(([a, b], i) => {
          const [x0, x1] = one[i];
          const [y0, y1] = two[i];
          expect(x1 <= y0 || y1 <= x0, `방 ${i}`).toBe(true); // 두 번이 겹치지 않는다
          const safe = Math.max(x0 - a, b - x1);
          expect(safe, `방 ${i}`).toBeGreaterThan(hero);
        });
      }
    }
  });
});

describe('얼음 변종 스테이지', () => {
  const uses = (n, sig) => {
    const b = stages[n - 1].boss;
    expect(b.signature, `${n}`).toBe(sig);
    for (const phase of b.phases) expect(phase, `${n}`).toContain('signature');
  };

  it('눈보라 아스트라는 강풍을 쓴다', () => {
    for (const n of [9, 14, 19]) uses(n, 'gale');
  });

  it('검은 얼음 아스트라는 얼음벽을 쓴다', () => {
    for (const n of [24, 34, 39]) uses(n, 'iceWalls');
  });

  it('땅에서 쓰는 뛰어 내려찍기와 날 때의 급강하는 남아 있다', () => {
    for (const n of [9, 14, 19, 24, 34, 39]) {
      const [a, b, c] = stages[n - 1].boss.phases;
      expect(a, `${n}`).toContain('dive');
      expect(b, `${n}`).toContain('dive');
      expect(c, `${n}`).toContain('hop');
    }
  });
});
