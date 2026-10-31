import { describe, it, expect } from 'vitest';
import { parseMap, blocked, cellOf, center, frontOf, findPath, lineOfSight, reachable } from '../src/logic/horrorGrid.js';
import { factoryMap } from '../src/horror/maps/factory.js';

const small = parseMap([
  '#######',
  '#S..#M#',
  '#.#.#.#',
  '#.#...#',
  '#L#####',
  '#######',
]);

describe('칸 맵', () => {
  it('글자를 자리로 읽는다', () => {
    expect(small.start).toEqual({ cx: 1, cy: 1 });
    expect(small.stalker).toEqual({ cx: 5, cy: 1 });
    expect(small.lockers).toEqual([{ cx: 1, cy: 4 }]);
  });

  it('벽, 사물함, 맵 밖은 막혀 있다', () => {
    expect(blocked(small, 0, 0)).toBe(true);
    expect(blocked(small, 1, 4)).toBe(true);
    expect(blocked(small, -1, 2)).toBe(true);
    expect(blocked(small, 2, 1)).toBe(false);
  });

  it('줄 길이가 다르면 멈춘다', () => {
    expect(() => parseMap(['###', '##'])).toThrow();
  });

  it('위치와 칸을 오간다', () => {
    expect(cellOf({ x: 2.7, y: 1.1 })).toEqual({ cx: 2, cy: 1 });
    expect(center({ cx: 2, cy: 1 })).toEqual({ x: 2.5, y: 1.5 });
  });

  it('사물함 앞 칸을 찾는다', () => {
    expect(frontOf(small, { cx: 1, cy: 4 })).toEqual({ cx: 1, cy: 3 });
  });
});

describe('길 찾기', () => {
  it('벽을 돌아서 간다', () => {
    const path = findPath(small, { cx: 1, cy: 1 }, { cx: 5, cy: 1 });
    expect(path.at(-1)).toEqual({ cx: 5, cy: 1 });
    expect(path).toHaveLength(8);
    for (const c of path) expect(blocked(small, c.cx, c.cy)).toBe(false);
  });

  it('제자리면 빈 길, 갈 수 없으면 null', () => {
    expect(findPath(small, { cx: 1, cy: 1 }, { cx: 1, cy: 1 })).toEqual([]);
    expect(findPath(small, { cx: 1, cy: 1 }, { cx: 0, cy: 0 })).toBeNull();
  });
});

describe('시선', () => {
  it('벽이 가리면 안 보인다', () => {
    expect(lineOfSight(small, { x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 })).toBe(true);
    expect(lineOfSight(small, { x: 3.5, y: 1.5 }, { x: 5.5, y: 1.5 })).toBe(false);
  });
});

describe('공장 맵', () => {
  const m = factoryMap;
  const open = reachable(m, m.start);
  const canReach = (c) => open.has(`${c.cx},${c.cy}`);
  const canUse = (c) => canReach(frontOf(m, c));

  it('필요한 것이 다 있다', () => {
    expect(m.fuses.length).toBeGreaterThanOrEqual(3);
    expect(m.lockers.length).toBeGreaterThan(0);
    expect(m.boxes.length).toBeGreaterThan(0);
    expect(m.patrol.length).toBeGreaterThan(0);
    expect(m.scares.length).toBeGreaterThan(0);
    expect(m.panel).not.toBeNull();
    expect(m.gate).not.toBeNull();
  });

  it('모든 목표에 걸어갈 수 있다', () => {
    for (const c of [...m.fuses, ...m.patrol, ...m.scares, m.stalker]) expect(canReach(c)).toBe(true);
    for (const c of [...m.lockers, ...m.boxes, m.panel, m.gate]) expect(canUse(c)).toBe(true);
  });
});
