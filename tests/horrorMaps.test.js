import { describe, it, expect } from 'vitest';
import { blocked, center, chunksInSight, findPath, frontOf, lineOfSight, reachable, withOpen, CELL } from '../src/logic/horrorGrid.js';
import { createRun, takeKey, openDoor, respawnSpot } from '../src/logic/horrorRun.js';
import { decorSpots } from '../src/logic/horrorDecor.js';
import { createStalker, sendAway } from '../src/logic/horrorStalker.js';
import { factoryMap, factoryTheme } from '../src/horror/maps/factory.js';
import { sewerMap, sewerTheme } from '../src/horror/maps/sewer.js';
import { schoolMap, schoolTheme } from '../src/horror/maps/school.js';
import { stationMap, stationTheme } from '../src/horror/maps/station.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const MAPS = [
  { id: 'factory', map: factoryMap, theme: factoryTheme, rooms: [18, 24] },
  { id: 'sewer', map: sewerMap, theme: sewerTheme, rooms: [1, 3] }, // 문이 잠긴 문 둘뿐이라 방은 셋이다
  { id: 'school', map: schoolMap, theme: schoolTheme, rooms: [14, 24] },
  { id: 'station', map: stationMap, theme: stationTheme, rooms: [8, 16] },
];

function seeded(seed) {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

const has = (set, c) => set.has(`${c.cx},${c.cy}`);

describe.each(MAPS)('$id 맵', ({ map, theme, rooms: [fewest, most] }) => {
  const m = withOpen(map, map.locks.map((_, i) => i)); // 문을 다 연 뒤의 맵
  const open = reachable(m, m.start);
  const canReach = (c) => has(open, c);
  const canUse = (c) => canReach(frontOf(m, c));
  const base = reachable(map, map.start);
  const wingOf = (lock) => new Set([...reachable(withOpen(map, [lock]), map.start)].filter((c) => !base.has(c)));

  it('필요한 것이 다 있다', () => {
    expect(m.fuses.length).toBeGreaterThanOrEqual(15);
    expect(m.lockers.length).toBeGreaterThan(0);
    expect(m.boxes.length).toBeGreaterThan(0);
    expect(m.patrol.length).toBeGreaterThanOrEqual(20);
    expect(m.scares.length).toBeGreaterThan(0);
    expect(m.returns.length).toBeGreaterThanOrEqual(3);
    expect(m.keys.length).toBeGreaterThanOrEqual(4);
    expect(m.panel).not.toBeNull();
    expect(m.gate).not.toBeNull();
    expect(m.stalker).not.toBeNull();
  });

  it('모든 목표에 걸어갈 수 있다', () => {
    for (const c of [...m.fuses, ...m.keys, ...m.notes, ...m.returns, ...m.patrol, ...m.scares, m.stalker]) expect(canReach(c)).toBe(true);
    for (const c of [...m.lockers, ...m.boxes, m.panel, m.gate]) expect(canUse(c)).toBe(true);
  });

  it('사물함, 전기 상자, 전원, 정문은 모두 손이 닿는다', () => {
    for (const c of [...m.lockers, ...m.boxes, m.panel, m.gate]) {
      const f = frontOf(m, c);
      expect(Math.hypot(f.cx - c.cx, f.cy - c.cy), `${c.cx},${c.cy}`).toBeLessThanOrEqual(k.useRange);
    }
  });

  it('잡혀서 멀리 보낸 괴물은 막힌 칸에 서지 않는다', () => {
    const { level } = createRun(map, k, seeded(1));
    for (const c of level.patrol) {
      const s = createStalker(level);
      sendAway(s, level, center(c), seeded(c.cx + c.cy));
      expect(blocked(level, Math.floor(s.x), Math.floor(s.y))).toBe(false);
    }
  });

  it('크기와 물건 수가 계획대로다', () => {
    expect(m.w).toBeGreaterThanOrEqual(34);
    expect(m.w).toBeLessThanOrEqual(40);
    expect(m.h).toBeGreaterThanOrEqual(24);
    expect(m.h).toBeLessThanOrEqual(27);
    expect(m.notes).toHaveLength(8);
    expect(m.boxes.length).toBeGreaterThanOrEqual(3);
    expect(m.boxes.length).toBeLessThanOrEqual(4);
    expect(m.locks).toHaveLength(2);
    expect(m.lockers.length).toBeGreaterThanOrEqual(20);
    expect(m.scares.length).toBeGreaterThanOrEqual(6);
  });

  it('벽으로 둘러싸여 있어 맵 밖으로 나갈 수 없다', () => {
    m.rows.forEach((row, cy) => [...row].forEach((ch, cx) => {
      if (cx > 0 && cy > 0 && cx < m.w - 1 && cy < m.h - 1) return;
      expect('#LG').toContain(ch);
    }));
  });

  it('방 수가 맵에 맞다', () => {
    const doors = new Set(['D', 'A', 'B']);
    const wall = { ...m, rows: m.rows.map((r) => r.replace(/[DAB]/g, '#')) };
    const seen = new Set();
    let rooms = 0;
    for (let cy = 0; cy < m.h; cy++) {
      for (let cx = 0; cx < m.w; cx++) {
        if (blocked(m, cx, cy) || doors.has(m.rows[cy][cx]) || seen.has(`${cx},${cy}`)) continue;
        rooms += 1;
        for (const key of reachable(wall, { cx, cy })) seen.add(key);
      }
    }
    expect(rooms).toBeGreaterThanOrEqual(fewest);
    expect(rooms).toBeLessThanOrEqual(most);
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
    m.locks.forEach((door, i) => {
      const wing = wingOf(i);
      expect(wing.size).toBeGreaterThan(30);
      expect(m.fuses.filter((c) => has(wing, c)).length).toBeGreaterThanOrEqual(2);
      expect(has(wing, m.stalker)).toBe(false);
      expect(has(wing, m.start)).toBe(false);
      // 문 칸을 빼면 날개와 나머지가 이어지지 않는다
      const shut = { ...m, rows: m.rows.map((r, y) => (y === door.cy ? r.slice(0, door.cx) + '#' + r.slice(door.cx + 1) : r)) };
      for (const c of reachable(withOpen(shut, m.locks.map((__, j) => j).filter((j) => j !== i)), m.start)) expect(wing.has(c) && c !== `${door.cx},${door.cy}`, c).toBe(false);
    });
  });

  it('잠긴 문은 양옆이 벽이다', () => {
    for (const c of m.locks) {
      const sideways = m.rows[c.cy][c.cx - 1] === '#' && m.rows[c.cy][c.cx + 1] === '#';
      const upright = m.rows[c.cy - 1][c.cx] === '#' && m.rows[c.cy + 1][c.cx] === '#';
      expect(sideways || upright).toBe(true);
    }
  });

  it('돌아올 곳은 잠긴 날개 밖이고 괴물을 멀리 보낼 자리가 있다', () => {
    const { patrol } = createRun(map, k, () => 0.3).level; // 판이 시작할 때의 순찰 지점. 게임이 쓰는 목록이다
    for (const c of m.returns) {
      expect(has(base, c)).toBe(true);
      const far = Math.max(...patrol.map((r) => Math.hypot(r.cx - c.cx, r.cy - c.cy)));
      expect(far).toBeGreaterThanOrEqual(15);
    }
  });

  it('돌아올 곳은 잡힌 자리에서 가장 가까운 곳이고 날개 안에서 잡혀도 밖으로 나온다', () => {
    const onCell = (c) => ({ x: c.cx + 0.5, y: c.cy + 0.5 });
    expect(respawnSpot(map, onCell(map.start))).toEqual(map.start);
    for (const c of map.returns) expect(respawnSpot(map, onCell(c))).toEqual(c);
    m.locks.forEach((_, i) => {
      for (const key of wingOf(i)) {
        const [cx, cy] = key.split(',').map(Number);
        expect(has(base, respawnSpot(map, onCell({ cx, cy })))).toBe(true);
      }
    });
  });

  it('어떤 판이든 열쇠 1, 날개 1, 열쇠 2, 날개 2 순서로 다 풀린다', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const run = createRun(map, k, seeded(seed));
      const level = run.level;
      for (let lock = 0; lock < run.keys.length; lock++) {
        expect(reachable(level, level.start).has(`${run.keys[lock].cx},${run.keys[lock].cy}`), `seed ${seed}`).toBe(true);
        takeKey(run, lock);
        expect(openDoor(run, lock)).toBe(true);
      }
      const after = reachable(level, level.start);
      for (const f of run.fuses) expect(has(after, f)).toBe(true);
      expect(new Set(run.keys.map((c) => `${c.cx},${c.cy}`)).size).toBe(run.keys.length);
    }
  });

  it('열쇠는 자기가 여는 날개 안에 없고, 2번 열쇠는 날개 1 에 나올 수 있다', () => {
    const wing1 = wingOf(0);
    const wing2 = wingOf(1);
    let inWing1 = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { keys } = createRun(map, k, seeded(seed));
      expect(has(wing1, keys[0])).toBe(false);
      expect(has(wing2, keys[0])).toBe(false);
      expect(has(wing2, keys[1])).toBe(false);
      if (has(wing1, keys[1])) inWing1 += 1;
    }
    expect(inWing1).toBeGreaterThan(0);
  });

  it('두 날개에 퓨즈가 꼭 들어가서 문을 열어야만 끝난다', () => {
    const wings = [wingOf(0), wingOf(1)];
    for (let seed = 1; seed <= 300; seed++) {
      const { fuses } = createRun(map, k, seeded(seed));
      for (const wing of wings) expect(fuses.filter((f) => has(wing, f)).length).toBeGreaterThanOrEqual(k.wingFuses);
    }
  });

  it('판이 시작할 때 순찰 지점은 갈 수 있는 곳만 남고 문이 열리면 늘어난다', () => {
    const run = createRun(map, k, seeded(1));
    expect(run.level.patrol.length).toBeGreaterThan(5);
    expect(run.level.patrol.length).toBeLessThan(map.patrol.length);
    for (const c of run.level.patrol) expect(has(base, c)).toBe(true);
  });

  describe('눈에 닿는 구역', () => {
    const CHUNK = 7;
    const VIEW = 14;
    const sightOf = (from, level = map) => {
      const seen = new Set();
      chunksInSight(level, from, VIEW, CHUNK, (n) => seen.add(n));
      return seen;
    };
    const chunkOf = (c) => Math.floor(c.cy / CHUNK) * Math.ceil(map.w / CHUNK) + Math.floor(c.cx / CHUNK);
    const cells = [];
    for (let cy = 0; cy < map.h; cy++) for (let cx = 0; cx < map.w; cx++) if (map.rows[cy][cx] !== '#') cells.push({ cx, cy });

    it('시선이 닿는 칸의 구역은 빠지지 않는다', () => {
      for (let i = 0; i < cells.length; i += 3) {
        const from = cells[i];
        const seen = sightOf(from);
        for (const to of cells) {
          if (Math.hypot(to.cx - from.cx, to.cy - from.cy) > VIEW) continue;
          if (lineOfSight(map, center(from), center(to))) expect(seen.has(chunkOf(to)), `${from.cx},${from.cy} > ${to.cx},${to.cy}`).toBe(true);
        }
      }
    });

    it('전체 구역의 절반도 안 그린다', () => {
      const total = Math.ceil(map.w / CHUNK) * Math.ceil(map.h / CHUNK);
      const mean = cells.reduce((sum, c) => sum + sightOf(c).size, 0) / cells.length;
      expect(mean).toBeLessThan(total / 2);
    });

    it('잠긴 문이 열리면 그 너머가 보인다', () => {
      m.locks.forEach((door, i) => {
        const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ cx: door.cx + dx, cy: door.cy + dy, dx, dy })).find((c) => has(base, c));
        const opened = sightOf(side, withOpen(map, [i]));
        expect(opened.size).toBeGreaterThanOrEqual(sightOf(side).size);
        expect(opened.has(chunkOf({ cx: door.cx - side.dx, cy: door.cy - side.dy }))).toBe(true);
      });
    });
  });

  describe('꾸밀 자리', () => {
    const spots = decorSpots(map, theme.decor.tile);
    const all = [...spots.machines, ...spots.lights, ...spots.pipes];
    const areas = (list) => new Set(list.map((f) => `${Math.floor(f.cx / 7)},${Math.floor(f.cy / 6)}`)).size;

    it('여러 곳에 고루 놓는다', () => {
      expect(areas(spots.lights)).toBeGreaterThanOrEqual(6);
      expect(areas(spots.machines)).toBeGreaterThanOrEqual(10);
      expect(areas(spots.pipes)).toBeGreaterThanOrEqual(4);
    });

    it('항상 진짜 벽에 붙는다', () => {
      for (const f of all) {
        expect(blocked(map, f.cx, f.cy)).toBe(false);
        expect(map.rows[f.cy + f.dy][f.cx + f.dx]).toBe('#');
      }
    });

    it('사물함, 전기 상자, 전원, 정문, 문, 열쇠, 쪽지 둘레는 비운다', () => {
      const kept = new Set(['L', 'E', 'P', 'G', 'D', 'A', 'B', 'K', 'N']);
      for (const f of [...spots.machines, ...spots.lights]) {
        for (let y = f.cy - 1; y <= f.cy + 1; y++) {
          for (let x = f.cx - 1; x <= f.cx + 1; x++) expect(kept.has(map.rows[y][x]), `${x},${y}`).toBe(false);
        }
      }
    });

    it('한 자리에 두 개를 겹쳐 놓지 않는다', () => {
      for (const list of [spots.machines, spots.lights]) {
        const keys = list.map((f) => `${f.cx},${f.cy},${f.dx},${f.dy}`);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });

    it('맵을 바꾸지 않고 항상 같은 자리다', () => {
      const before = reachable(map, map.start).size;
      expect(decorSpots(map, theme.decor.tile)).toEqual(spots);
      expect(reachable(map, map.start).size).toBe(before);
    });

    it('벽에 붙은 물건은 주인공 몸이 닿는 곳까지 나오지 않는다', () => {
      expect(theme.decor.machine.depth ?? k.machineDepth).toBeLessThan(0.2 * CELL);
      expect(theme.decor.pipe.off + theme.decor.pipe.r).toBeLessThan(0.2 * CELL);
    });
  });
});

describe('테마', () => {
  it('맵마다 정해진 항목이 다 있다', () => {
    for (const { theme } of MAPS) {
      for (const part of ['wall', 'floor', 'locker']) {
        expect(theme[part].art).toMatch(/^horror_/);
        expect(typeof theme[part].plain).toBe('number');
        expect(theme[part].repeat).toBeGreaterThan(0);
      }
      for (const color of ['ceil', 'fog', 'ambient', 'lightColor']) expect(typeof theme[color]).toBe('number');
      expect(theme.decor.light.y).toBeLessThan(3);
      expect(theme.decor.machine.tints.length).toBeGreaterThan(0);
      expect(theme.decor.pipe.ys.length).toBeGreaterThan(0);
      if (theme.doorArt) expect(theme[theme.doorArt].art).toMatch(/^horror_/);
    }
  });

  it('공장은 오늘 모습 그대로다', () => {
    expect(factoryTheme.lightColor).toBe(0xff3a14);
    expect(factoryTheme.floor.repeat).toBe(7);
    expect(factoryTheme.floor.shiny).toBeUndefined();
    expect(factoryTheme.floor.flow).toBeUndefined();
    expect(factoryTheme.decor.tile).toBeUndefined();
    expect(factoryTheme.locker.box).toBeUndefined();
    expect(decorSpots(factoryMap, factoryTheme.decor.tile)).toEqual(decorSpots(factoryMap));
  });
});

describe('세 맵이 다르게 느껴진다', () => {
  const longestRun = (map) => {
    let best = 0;
    for (const row of map.rows) {
      for (const part of row.split(/[#LEPG]/)) best = Math.max(best, part.length);
    }
    return best;
  };
  const doors = (map) => map.rows.join('').replace(/[^D]/g, '').length;

  it('수로는 곧은 길이 짧고 문이 없다', () => {
    expect(longestRun(sewerMap)).toBeLessThan(longestRun(schoolMap));
    expect(doors(sewerMap)).toBeLessThan(doors(factoryMap) / 4);
  });

  it('학교는 곧은 복도가 길고 교실 문이 많다', () => {
    expect(longestRun(schoolMap)).toBeGreaterThanOrEqual(30);
    expect(doors(schoolMap)).toBeGreaterThanOrEqual(20);
  });
});
