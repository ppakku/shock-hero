import { describe, it, expect } from 'vitest';
import { MAPS } from '../src/horror/content.js';
import { MAP_IDS } from '../src/logic/horrorPick.js';
import { center, frontOf, chunksInSight, inPlayerView, canSeeBody, playerSees, reachable, withOpen, blocked } from '../src/logic/horrorGrid.js';
import { nearestUse, createRun } from '../src/logic/horrorRun.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const CHUNK = 7; // world.js 의 구역 크기
const allOpen = (map) => withOpen(map, map.locks.map((_, i) => i));
const chunkOf = (map, c) => Math.floor(c.cy / CHUNK) * Math.ceil(map.w / CHUNK) + Math.floor(c.cx / CHUNK);
const sightOf = (map, cell) => {
  const seen = new Set();
  chunksInSight(map, cell, k.viewCells, CHUNK, (n) => seen.add(n));
  return seen;
};
const beside = (map, c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ cx: c.cx + x, cy: c.cy + y })).filter((n) => !blocked(map, n.cx, n.cy));

describe.each(MAP_IDS)('%s 맵의 시선', (id) => {
  const map = allOpen(MAPS[id].map);
  const area = reachable(map, map.start);

  it('퓨즈, 열쇠, 쪽지 자리는 걸어가서 손이 닿고, 그 자리에서 보인다', () => {
    const base = createRun(MAPS[id].map, k, () => 0.3);
    for (const c of [...map.fuses, ...map.keys, ...map.notes]) {
      const stand = [c, ...beside(map, c)].filter((n) => area.has(`${n.cx},${n.cy}`));
      expect(stand.length, `${c.cx},${c.cy}`).toBeGreaterThan(0);
      for (const n of stand) expect(sightOf(map, n).has(chunkOf(map, c)), `${c.cx},${c.cy}`).toBe(true);
      expect(nearestUse({ ...base, fuses: [{ ...c, taken: false }] }, map, center(stand[0]), null, k)?.kind).toBeDefined();
    }
  });

  it('사물함 안에서도 제 구역과 앞 구역이 보인다', () => {
    for (const c of map.lockers) {
      const seen = sightOf(map, c);
      expect(seen.has(chunkOf(map, c))).toBe(true);
      expect(seen.has(chunkOf(map, frontOf(map, c)))).toBe(true);
    }
  });

  it('사물함 안에서 앞의 괴물을 볼 수 있다', () => {
    for (const c of map.lockers) {
      const p = center(c);
      const f = center(frontOf(map, c));
      const yaw = Math.atan2(-(f.x - p.x), -(f.y - p.y));
      expect(inPlayerView(p, yaw, f, map, k, true), `${c.cx},${c.cy}`).toBe(true);
    }
  });
});

describe('마트의 긴 통로', () => {
  const map = MAPS.mart.map;
  const east = -Math.PI / 2; // +x 쪽을 보는 yaw
  const p = { x: 3.5, y: 1.5 };

  it('통로 끝까지 눈뜬이를 보고 있을 수 있다', () => {
    expect(inPlayerView(p, east, { x: p.x + k.viewCells - 0.5, y: 1.5 }, map, k)).toBe(true);
    expect(inPlayerView(p, east, { x: p.x + k.viewCells + 1, y: 1.5 }, map, k)).toBe(false);
  });

  it('진열대 너머는 보이지 않는다', () => {
    expect(inPlayerView({ x: 8.5, y: 4.5 }, Math.PI, { x: 8.5, y: 8 }, map, k)).toBe(false);
  });

  it('통로에 서면 멀리 있는 구역까지 그린다', () => {
    const far = { cx: 16, cy: 1 };
    expect(sightOf(map, { cx: 3, cy: 1 }).has(chunkOf(map, far))).toBe(true);
  });
});

describe('꽉 찬 사물함은 벽이다', () => {
  // 사물함 하나만 사이에 둔 복도
  const rows = [
    '#########',
    '#...L...#',
    '#########',
  ];
  const base = { w: 9, h: 3, rows, locked: new Set(), locks: [] };
  const p = { x: 1.5, y: 1.5 };
  const s = { x: 7.5, y: 1.5 };
  const east = -Math.PI / 2;

  it('작은 사물함은 뒤가 보이고, 꽉 찬 사물함은 뒤가 안 보인다', () => {
    expect(inPlayerView(p, east, s, base, k)).toBe(true);
    expect(inPlayerView(p, east, s, { ...base, solidLockers: true }, k)).toBe(false);
  });

  it('수로와 학교만 꽉 차 있고, 문을 열어도 그대로다', () => {
    expect(!!MAPS.factory.map.solidLockers).toBe(false);
    for (const id of ['sewer', 'school']) {
      expect(MAPS[id].map.solidLockers).toBe(true);
      expect(createRun(MAPS[id].map, k, () => 0.3).level.solidLockers).toBe(true);
      expect(allOpen(MAPS[id].map).solidLockers).toBe(true);
    }
  });

  it.each(['sewer', 'school'])('%s: 보고 있다고 치면 몸도 그린다', (id) => {
    const map = allOpen(MAPS[id].map);
    const cells = [...reachable(map, map.start)].map((t) => t.split(',').map(Number));
    let looked = 0;
    let wrong = 0;
    for (let a = 0; a < cells.length; a += 3) {
      for (let b = 0; b < cells.length; b += 5) {
        const from = { x: cells[a][0] + 0.5, y: cells[a][1] + 0.5 };
        const to = { x: cells[b][0] + 0.5, y: cells[b][1] + 0.5 };
        const d = Math.hypot(to.x - from.x, to.y - from.y);
        if (d < k.creatureNear || d > k.viewCells) continue;
        const yaw = Math.atan2(-(to.x - from.x), -(to.y - from.y));
        if (!inPlayerView(from, yaw, to, map, k)) continue;
        looked += 1;
        if (!canSeeBody(map, from, to, k.creatureNear)) wrong += 1;
      }
    }
    expect(looked).toBeGreaterThan(100);
    expect(wrong / looked).toBeLessThan(0.03);
  });

  it('쪽지가 앞을 가리면 본 것이 아니다', () => {
    const g = { p, yaw: east, stalker: s, map: base, k, hidden: null };
    expect(playerSees(g)).toBe(true);
    expect(playerSees(g, true)).toBe(false);
  });

  it('사물함 안은 좁은 틈으로만 본다', () => {
    const open = { ...base, rows: ['#########', '#.......#', '#########'] };
    const turned = { p, yaw: east + 0.6, stalker: s, map: open, k };
    expect(playerSees({ ...turned, hidden: null })).toBe(true);
    expect(playerSees({ ...turned, hidden: 0 })).toBe(false);
  });
});
