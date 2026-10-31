// 공포 모드 칸 맵 계산 (화면과 상관없는 부분). 위치는 칸 단위 소수, 칸은 { cx, cy }.

export const CELL = 3; // 칸 하나의 3D 크기 (미터)

const SOLID = new Set(['#', 'L', 'E', 'P', 'G']);
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function parseMap(rows) {
  const w = rows[0].length;
  const map = { w, h: rows.length, rows, start: null, stalker: null, panel: null, gate: null, fuses: [], lockers: [], boxes: [], patrol: [], scares: [] };
  const lists = { F: map.fuses, L: map.lockers, E: map.boxes, R: map.patrol, X: map.scares };
  const ones = { S: 'start', M: 'stalker', P: 'panel', G: 'gate' };
  rows.forEach((row, cy) => {
    if (row.length !== w) throw new Error(`맵 ${cy}번 줄 길이가 다릅니다`);
    [...row].forEach((ch, cx) => {
      if (lists[ch]) lists[ch].push({ cx, cy });
      if (ones[ch]) map[ones[ch]] = { cx, cy };
    });
  });
  return map;
}

export function blocked(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return true;
  return SOLID.has(map.rows[cy][cx]);
}

export const cellOf = (p) => ({ cx: Math.floor(p.x), cy: Math.floor(p.y) });
export const center = (c) => ({ x: c.cx + 0.5, y: c.cy + 0.5 });

// 막힌 칸(사물함 등)이면 그 앞의 빈 칸, 아니면 그 칸
export function frontOf(map, cell) {
  if (!blocked(map, cell.cx, cell.cy)) return cell;
  for (const [dx, dy] of STEPS) {
    if (!blocked(map, cell.cx + dx, cell.cy + dy)) return { cx: cell.cx + dx, cy: cell.cy + dy };
  }
  return cell;
}

// 상하좌우 너비 우선 탐색. 출발 칸은 빼고 도착 칸까지의 칸들. 같은 칸이면 [], 길이 없으면 null
export function findPath(map, from, to) {
  if (from.cx === to.cx && from.cy === to.cy) return [];
  if (blocked(map, to.cx, to.cy)) return null;
  const key = (x, y) => y * map.w + x;
  const prev = new Map([[key(from.cx, from.cy), null]]);
  const queue = [[from.cx, from.cy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === to.cx && y === to.cy) {
      const path = [];
      for (let k = key(x, y); prev.get(k) !== null; k = prev.get(k)) path.unshift({ cx: k % map.w, cy: Math.floor(k / map.w) });
      return path;
    }
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (blocked(map, nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// 두 위치 사이에 막힌 칸이 없는지 (0.1 칸씩 걸어 본다)
export function lineOfSight(map, a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / 0.1));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocked(map, Math.floor(a.x + (b.x - a.x) * t), Math.floor(a.y + (b.y - a.y) * t))) return false;
  }
  return true;
}

// 몸 가운데와 둘레 네 점. 벽 모서리에 몸 일부만 걸쳐 보이는 때까지 친다
const BODY = [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]];

// 이 몸이 화면에 보일 수 있는지. near 칸 안이면 벽 너머여도 그린다 (팔과 고개가 벽을 넘어올 수 있다)
export function canSeeBody(map, from, to, near) {
  if (Math.hypot(to.x - from.x, to.y - from.y) <= near) return true;
  return BODY.some(([ox, oy]) => lineOfSight(map, from, { x: to.x + ox, y: to.y + oy }));
}

// from 에서 걸어갈 수 있는 칸들 ("x,y" 글자 묶음)
export function reachable(map, from) {
  const seen = new Set([`${from.cx},${from.cy}`]);
  const queue = [[from.cx, from.cy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of STEPS) {
      const k = `${x + dx},${y + dy}`;
      if (blocked(map, x + dx, y + dy) || seen.has(k)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}
