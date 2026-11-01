// 공포 모드 칸 맵 계산 (화면과 상관없는 부분). 위치는 칸 단위 소수, 칸은 { cx, cy }.

export const CELL = 3; // 칸 하나의 3D 크기 (미터)

const SOLID = new Set(['#', 'L', 'E', 'P', 'G']);
const LOCK_LETTERS = ['A', 'B']; // 잠긴 문. 글자 순서가 열쇠 순서다
const cellKey = (map, cx, cy) => cy * map.w + cx;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function parseMap(rows) {
  const w = rows[0].length;
  const map = { w, h: rows.length, rows, start: null, stalker: null, panel: null, gate: null, fuses: [], lockers: [], boxes: [], patrol: [], scares: [], notes: [], keys: [], returns: [], locks: [], locked: new Set() };
  const lists = { F: map.fuses, L: map.lockers, E: map.boxes, R: map.patrol, X: map.scares, N: map.notes, K: map.keys, C: map.returns };
  const ones = { S: 'start', M: 'stalker', P: 'panel', G: 'gate' };
  rows.forEach((row, cy) => {
    if (row.length !== w) throw new Error(`맵 ${cy}번 줄 길이가 다릅니다`);
    [...row].forEach((ch, cx) => {
      if (lists[ch]) lists[ch].push({ cx, cy });
      if (ones[ch]) map[ones[ch]] = { cx, cy };
      const lock = LOCK_LETTERS.indexOf(ch);
      if (lock >= 0) {
        map.locks[lock] = { cx, cy };
        map.locked.add(cellKey(map, cx, cy));
      }
    });
  });
  return map;
}

// 잠긴 문 일부를 연 맵 사본. 글자와 자리는 같이 쓰고 locked 만 따로 가진다 (원본 맵은 그대로다)
export function withOpen(map, opened = []) {
  const locked = new Set(map.locked);
  for (const i of opened) locked.delete(cellKey(map, map.locks[i].cx, map.locks[i].cy));
  return { ...map, locked };
}

export function blocked(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return true;
  return SOLID.has(map.rows[cy][cx]) || map.locked.has(cellKey(map, cx, cy));
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

// 눈을 막는 칸. 벽과 정문, 잠긴 문을 친다. 상자는 칸보다 작아서 뒤가 보인다.
// 사물함은 맵마다 다르다: 작으면 뒤가 보이고, map.solidLockers 면 칸을 꽉 채워서 벽과 같다
const opaque = (map, cx, cy) => {
  const ch = map.rows[cy]?.[cx];
  return ch === undefined || ch === '#' || ch === 'G' || (ch === 'L' && !!map.solidLockers) || map.locked.has(cellKey(map, cx, cy));
};

// 주인공 눈에서 (x, y) 까지 벽이나 잠긴 문이 없는지. 주인공 눈에 그린 그대로 보이는 쪽을 따른다.
// 출발 칸은 치지 않는다. 사물함 안에서 밖을 볼 때 그 칸이 막혀 있다
function clearView(map, a, x, y) {
  const n = Math.max(1, Math.ceil(Math.hypot(x - a.x, y - a.y) / 0.1));
  const fromX = Math.floor(a.x);
  const fromY = Math.floor(a.y);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const cx = Math.floor(a.x + (x - a.x) * t);
    const cy = Math.floor(a.y + (y - a.y) * t);
    if ((cx !== fromX || cy !== fromY) && opaque(map, cx, cy)) return false;
  }
  return true;
}

// 주인공이 괴물 쪽을 보고 있는지. 손전등과 상관없이 고개 방향과 가린 것만 본다.
// 몸 일부만 보여도 친다. 눈으로 보고 있는데 움직이면 안 되기 때문이다.
// hidden 이면 사물함 틈으로만 본다. 고개를 조금 돌리면 앞이 안 보여야 눈을 뗄 수 있다
export function inPlayerView(p, yaw, s, map, k, hidden = false) {
  const dx = s.x - p.x;
  const dy = s.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > k.viewCells || d < 0.001) return false; // 몸이 겹치면 볼 방향이 없다. 눈을 뗄 수 없는 일이 없게 안 본 것으로 친다
  if ((-Math.sin(yaw) * dx - Math.cos(yaw) * dy) / d < Math.cos(((hidden ? k.slitFov : k.viewFov) / 2) * Math.PI / 180)) return false;
  for (const [ox, oy] of BODY) {
    if (clearView(map, p, s.x + ox, s.y + oy)) return true;
  }
  return false;
}

// 게임과 시험이 같이 부른다. g: { p, yaw, stalker, map, k, hidden }. 쪽지가 앞을 가리면 본 것이 아니다
export function playerSees(g, noteOpen = false) {
  return !noteOpen && inPlayerView(g.p, g.yaw, g.stalker, g.map, g.k, g.hidden !== null);
}

const VIEW_RAYS = 240; // 한 자리에서 쏘는 시선 수
const VIEW_STEP = 0.25; // 시선을 따라가는 간격 (칸)
const VIEW_FROM = [[0.5, 0.5], [0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]; // 칸 안 어디에 서도 빠지지 않게 가운데와 네 구석에서 본다

// 이 칸에 선 사람 눈에 닿는 구역들 (구역 번호는 cy 묶음 * perRow + cx 묶음).
// mark(구역 번호) 를 부른다. 칸이 바뀔 때만 부르면 되고, 시선은 viewCells 칸까지만 간다
export function chunksInSight(map, cell, viewCells, chunk, mark) {
  const perRow = Math.ceil(map.w / chunk);
  for (const [ox, oy] of VIEW_FROM) {
    for (let r = 0; r < VIEW_RAYS; r++) {
      const a = (r / VIEW_RAYS) * Math.PI * 2;
      const dx = Math.cos(a) * VIEW_STEP;
      const dy = Math.sin(a) * VIEW_STEP;
      const steps = viewCells / VIEW_STEP;
      for (let i = 0; i <= steps; i++) {
        const cx = Math.floor(cell.cx + ox + dx * i);
        const cy = Math.floor(cell.cy + oy + dy * i);
        if (cx >= 0 && cy >= 0 && cx < map.w && cy < map.h) mark(Math.floor(cy / chunk) * perRow + Math.floor(cx / chunk));
        if ((cx !== cell.cx || cy !== cell.cy) && opaque(map, cx, cy)) break; // 사물함 안에서도 밖이 보인다
      }
    }
  }
}
