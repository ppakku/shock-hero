import { describe, it, expect } from 'vitest';
import { parseMap, blocked, cellOf, center, frontOf, findPath, lineOfSight, reachable, canSeeBody, withOpen, chunksInSight } from '../src/logic/horrorGrid.js';
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

describe('잠긴 문', () => {
  const gated = parseMap([
    '#########',
    '#S..A..F#',
    '#########',
  ]);

  it('닫혀 있으면 걷기, 시선, 길 찾기, 갈 수 있는 곳이 모두 막힌다', () => {
    expect(gated.locks).toEqual([{ cx: 4, cy: 1 }]);
    expect(blocked(gated, 4, 1)).toBe(true);
    expect(lineOfSight(gated, { x: 1.5, y: 1.5 }, { x: 7.5, y: 1.5 })).toBe(false);
    expect(findPath(gated, { cx: 1, cy: 1 }, { cx: 7, cy: 1 })).toBeNull();
    expect(reachable(gated, gated.start).has('7,1')).toBe(false);
  });

  it('연 사본에서만 지나갈 수 있고 원본은 그대로다', () => {
    const open = withOpen(gated, [0]);
    expect(blocked(open, 4, 1)).toBe(false);
    expect(lineOfSight(open, { x: 1.5, y: 1.5 }, { x: 7.5, y: 1.5 })).toBe(true);
    expect(reachable(open, open.start).has('7,1')).toBe(true);
    expect(blocked(gated, 4, 1)).toBe(true);
    expect(gated.locked.size).toBe(1);
  });
});

describe('공장 맵', () => {
  const m = withOpen(factoryMap, factoryMap.locks.map((_, i) => i)); // 문을 다 연 뒤의 공장
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
    for (const c of [...m.fuses, ...m.keys, ...m.notes, ...m.returns, ...m.patrol, ...m.scares, m.stalker]) expect(canReach(c)).toBe(true);
    for (const c of [...m.lockers, ...m.boxes, m.panel, m.gate]) expect(canUse(c)).toBe(true);
  });

  it('크기와 물건 수가 계획대로다', () => {
    expect(m.w).toBeGreaterThanOrEqual(38);
    expect(m.h).toBeGreaterThanOrEqual(25);
    expect(m.notes).toHaveLength(8);
    expect(m.boxes.length).toBeGreaterThanOrEqual(3);
    expect(m.boxes.length).toBeLessThanOrEqual(4);
    expect(m.locks).toHaveLength(2);
    expect(m.lockers.length).toBeGreaterThanOrEqual(20);
    expect(m.scares.length).toBeGreaterThanOrEqual(6);
  });

  it('방이 18개에서 24개 사이다', () => {
    const doors = new Set(['D', 'A', 'B']);
    const seen = new Set();
    let rooms = 0;
    for (let cy = 0; cy < m.h; cy++) {
      for (let cx = 0; cx < m.w; cx++) {
        if (blocked(m, cx, cy) || doors.has(m.rows[cy][cx]) || seen.has(`${cx},${cy}`)) continue;
        rooms += 1;
        const wall = { ...m, rows: m.rows.map((r) => r.replace(/[DAB]/g, '#')) };
        for (const k of reachable(wall, { cx, cy })) seen.add(k);
      }
    }
    expect(rooms).toBeGreaterThanOrEqual(18);
    expect(rooms).toBeLessThanOrEqual(24);
  });

  it('시작과 정문은 멀리 떨어져 있다', () => {
    expect(findPath(m, m.start, frontOf(m, m.gate)).length).toBeGreaterThanOrEqual(45);
  });

  it('어느 보통 문 하나가 막혀도 다른 길이 있다 (외길 방이 없다)', () => {
    m.rows.forEach((row, cy) => [...row].forEach((ch, cx) => {
      if (ch !== 'D') return;
      const cut = { ...m, rows: m.rows.map((r, y) => (y === cy ? r.slice(0, cx) + '#' + r.slice(cx + 1) : r)) };
      expect(reachable(cut, m.start).size, `${cx},${cy}`).toBe(open.size - 1);
    }));
  });

  it('잠긴 날개마다 퓨즈 자리가 있고 다른 입구가 없다', () => {
    const base = reachable(factoryMap, factoryMap.start);
    m.locks.forEach((_, i) => {
      const wing = [...reachable(withOpen(factoryMap, [i]), m.start)].filter((key) => !base.has(key));
      expect(wing.length).toBeGreaterThan(30);
      expect(m.fuses.filter((c) => wing.includes(`${c.cx},${c.cy}`)).length).toBeGreaterThanOrEqual(2);
      expect(wing.includes(`${m.stalker.cx},${m.stalker.cy}`)).toBe(false);
    });
  });

  it('돌아올 곳은 잠긴 날개 밖이고 세이노를 멀리 보낼 자리가 있다', () => {
    const base = reachable(factoryMap, factoryMap.start);
    for (const c of m.returns) {
      expect(base.has(`${c.cx},${c.cy}`)).toBe(true);
      const far = Math.max(...m.patrol.map((r) => Math.hypot(r.cx - c.cx, r.cy - c.cy)));
      expect(far).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('눈에 닿는 구역', () => {
  const CHUNK = 7;
  const VIEW = 14;
  const sightOf = (map, cell) => {
    const seen = new Set();
    chunksInSight(map, cell, VIEW, CHUNK, (n) => seen.add(n));
    return seen;
  };
  const chunkOf = (map, c) => Math.floor(c.cy / CHUNK) * Math.ceil(map.w / CHUNK) + Math.floor(c.cx / CHUNK);
  const cells = (map) => {
    const out = [];
    for (let cy = 0; cy < map.h; cy++) for (let cx = 0; cx < map.w; cx++) if (map.rows[cy][cx] !== '#') out.push({ cx, cy });
    return out;
  };

  it('시선이 닿는 칸의 구역은 빠지지 않는다', () => {
    const all = cells(factoryMap);
    for (let i = 0; i < all.length; i += 3) {
      const from = all[i];
      const seen = sightOf(factoryMap, from);
      for (const to of all) {
        if (Math.hypot(to.cx - from.cx, to.cy - from.cy) > VIEW) continue;
        if (lineOfSight(factoryMap, center(from), center(to))) expect(seen.has(chunkOf(factoryMap, to)), `${from.cx},${from.cy} > ${to.cx},${to.cy}`).toBe(true);
      }
    }
  });

  it('전체 구역의 절반도 안 그린다', () => {
    const all = cells(factoryMap);
    const total = Math.ceil(factoryMap.w / CHUNK) * Math.ceil(factoryMap.h / CHUNK);
    const mean = all.reduce((sum, c) => sum + sightOf(factoryMap, c).size, 0) / all.length;
    expect(mean).toBeLessThan(total / 2);
  });

  it('잠긴 문이 열리면 그 너머 구역이 보인다', () => {
    const before = factoryMap.locks[0];
    const front = { cx: before.cx, cy: before.cy + 1 };
    const shut = sightOf(factoryMap, front);
    const open = sightOf(withOpen(factoryMap, [0]), front);
    expect(open.has(chunkOf(factoryMap, { cx: before.cx, cy: before.cy - 3 }))).toBe(true);
    expect(open.size).toBeGreaterThanOrEqual(shut.size);
  });
});

describe('세이노를 그릴지', () => {
  // 복도에서 멀리 보이는 자리, 벽 너머 자리를 공장 맵으로 확인한다
  const NEAR = 4;

  it('긴 복도 끝은 멀어도 보인다', () => {
    expect(canSeeBody(factoryMap, { x: 14.5, y: 11.5 }, { x: 24.5, y: 11.5 }, NEAR)).toBe(true);
  });

  it('벽 너머 먼 곳은 안 그린다', () => {
    expect(canSeeBody(factoryMap, { x: 15.5, y: 12.5 }, { x: 15.5, y: 18.5 }, NEAR)).toBe(false);
    expect(canSeeBody(factoryMap, { x: 3.5, y: 23.5 }, { x: 30.5, y: 2.5 }, NEAR)).toBe(false);
  });

  it('가까우면 벽 너머여도 그린다', () => {
    expect(canSeeBody(factoryMap, { x: 6.2, y: 21.5 }, { x: 8.5, y: 21.5 }, NEAR)).toBe(true);
  });

  it('몸 가운데가 가려져도 옆이 트였으면 그린다', () => {
    // 가운데 시선은 문틀 모서리에 막히고 몸 옆쪽은 문을 지난다
    const from = { x: 13.7, y: 15.1 };
    const to = { x: 2.12, y: 16.6 };
    expect(lineOfSight(factoryMap, from, to)).toBe(false);
    expect(canSeeBody(factoryMap, from, to, NEAR)).toBe(true);
  });
});
