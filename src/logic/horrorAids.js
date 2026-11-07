// 공포 모드 도움 아이템 (화면과 상관없는 부분). 벽 지도, 조명탄, 나침반, 소리 장난감, 분필.
// 모두 쓸 수 있는 수가 정해져 있고, 지도와 조명탄은 괴물을 부르는 소리가 난다.
import { reachable, findPath, lineOfSight, blocked, cellOf, center } from './horrorGrid.js';
import { KEY_NAMES } from './horrorRun.js';

// 아이템 칸 순서. 컴퓨터에서는 이 순서대로 숫자 1~4 를 누른다
export const AID_KINDS = ['flare', 'compass', 'toy', 'chalk'];
export const AID_NAMES = { flare: '조명탄', compass: '나침반', toy: '소리 장난감', chalk: '분필' };
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const THROW_STEP = 0.25; // 장난감이 날아가는 길을 살피는 간격 (칸)

const keyOf = (c) => `${c.cx},${c.cy}`;
const gap = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

function shuffled(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 서로 멀리 떨어진 칸을 n 개 고른다. 처음 하나는 아무거나, 다음부터는 이미 고른 칸에서 가장 먼 칸
function spread(cells, n, rand, taken = []) {
  const left = shuffled(cells, rand);
  const out = [];
  while (out.length < n && left.length) {
    let best = 0;
    if (out.length || taken.length) {
      let top = -1;
      left.forEach((c, i) => {
        const d = Math.min(...[...out, ...taken].map((o) => gap(c, o)));
        if (d > top) {
          top = d;
          best = i;
        }
      });
    }
    out.push(left.splice(best, 1)[0]);
  }
  return out;
}

// 열쇠 없이 갈 수 있는 빈 바닥 칸. 시작 칸과 그 옆은 뺀다
function openFloor(level) {
  const area = reachable(level, level.start);
  const out = [];
  level.rows.forEach((row, cy) => [...row].forEach((ch, cx) => {
    if (ch === '.' && area.has(`${cx},${cy}`) && gap({ cx, cy }, level.start) > 1.5) out.push({ cx, cy });
  }));
  return out;
}

// 벽 지도는 평범한 벽(#)에 붙는다. 붙는 벽 쪽 (dx, dy) 도 같이 준다
function wallSide(level, c) {
  for (const [dx, dy] of STEPS) if (level.rows[c.cy + dy]?.[c.cx + dx] === '#') return { dx, dy };
  return null;
}

// 판마다 벽 지도와 줍는 아이템을 놓는다. level: 이번 판 맵 사본 (잠긴 문이 닫힌 상태)
// taken: 퓨즈, 열쇠, 단서처럼 이미 물건이 놓인 칸
export function createAids(level, k, rand = Math.random, taken = []) {
  const used = new Set(taken.map(keyOf));
  const floor = openFloor(level).filter((c) => !used.has(keyOf(c)));
  const boardCells = floor.filter((c) => wallSide(level, c));
  const boards = spread(boardCells, k.boards, rand).map((c) => ({ ...c, ...wallSide(level, c), seen: false }));
  boards.forEach((b) => used.add(keyOf(b)));
  const kinds = AID_KINDS.flatMap((kind) => Array(k.count[kind]).fill(kind));
  const spots = spread(floor.filter((c) => !used.has(keyOf(c))), kinds.length, rand, boards);
  return {
    boards,
    items: shuffled(kinds, rand).slice(0, spots.length).map((kind, i) => ({ ...spots[i], kind, taken: false })),
    held: { flare: 0, compass: 0, toy: 0, chalk: 0 },
    marks: [], // 분필 표시 { cx, cy, yaw }
    sounds: [], // 괴물이 들을 소리 { id, cx, cy, range, lure, t }
    nextSound: 1,
  };
}

export function takeAid(aids, i, k) {
  const item = aids.items[i];
  if (!item || item.taken) return false;
  item.taken = true;
  aids.held[item.kind] += item.kind === 'chalk' ? k.chalkUses : 1;
  return true;
}

export function useAid(aids, kind) {
  if (!(aids.held[kind] > 0)) return false;
  aids.held[kind] -= 1;
  return true;
}

export function seeBoard(aids, i) {
  const b = aids.boards[i];
  if (!b || b.seen) return false;
  b.seen = true;
  return true;
}

// 같은 칸에 다시 그리면 방향만 바뀐다
export function addMark(aids, cell, yaw) {
  const old = aids.marks.findIndex((m) => m.cx === cell.cx && m.cy === cell.cy);
  if (old >= 0) aids.marks.splice(old, 1);
  aids.marks.push({ cx: cell.cx, cy: cell.cy, yaw });
  return aids.marks.at(-1);
}

// 손이 닿는 아이템과 벽 지도를 nearestUse 의 add 로 넘긴다
export function addAidTargets(aids, add) {
  aids.items.forEach((c, i) => !c.taken && add('aid', i, `${AID_NAMES[c.kind]} 줍기`, c));
  aids.boards.forEach((b, i) => add(b.seen ? 'seenBoard' : 'board', i, b.seen ? '이 지도는 이미 봤다' : '벽 지도 보기', b));
}

// 소리를 낸다. 괴물마다 한 번씩만 듣는다 (id 로 가린다)
// lure: 장난감처럼 쫓던 괴물도 돌려세우는 소리인지
export function makeSound(aids, cell, range, time, lure) {
  aids.sounds.push({ id: aids.nextSound++, cx: cell.cx, cy: cell.cy, range, lure, t: time });
}

export function stepSounds(aids, dt) {
  for (const s of aids.sounds) s.t -= dt;
  aids.sounds = aids.sounds.filter((s) => s.t > 0);
}

// 보는 쪽으로 range 칸까지 날아가다 벽 앞에 떨어진다. 바로 앞이 벽이면 발밑에 떨어진다
export function throwSpot(map, p, yaw, range) {
  const fx = -Math.sin(yaw);
  const fy = -Math.cos(yaw);
  let last = cellOf(p);
  for (let d = THROW_STEP; d <= range; d += THROW_STEP) {
    const c = cellOf({ x: p.x + fx * d, y: p.y + fy * d });
    if (blocked(map, c.cx, c.cy)) break;
    last = c;
  }
  return last;
}

// 지금 할 일 목록. 전원 전에는 퓨즈, 열쇠, 열쇠가 맞는 문, 단서, 퓨즈를 다 모았으면 전원.
// 전원 뒤에는 남은 단서와 정문
function goals(run, k) {
  const out = [];
  run.clues.forEach((c) => !c.taken && out.push({ cell: c, name: '붉은 쪽지' }));
  if (run.powered) {
    out.push({ cell: run.level.gate, name: '정문' });
    return out;
  }
  run.fuses.forEach((c) => !c.taken && out.push({ cell: c, name: '퓨즈' }));
  run.keys.forEach((c, i) => {
    if (!c.taken) out.push({ cell: c, name: `${KEY_NAMES[i]} 열쇠` });
    else if (!run.doors[i].open) out.push({ cell: run.doors[i], name: `${KEY_NAMES[i]} 문` });
  });
  if (run.have >= k.fuseCount) out.push({ cell: run.level.panel, name: '전원' });
  return out;
}

// 막힌 칸(문, 전원, 정문)이면 옆 빈 칸 가운데 길이 가장 짧은 곳으로 간다
function pathTo(level, from, cell) {
  if (!blocked(level, cell.cx, cell.cy)) return findPath(level, from, cell);
  let best = null;
  for (const [dx, dy] of STEPS) {
    if (blocked(level, cell.cx + dx, cell.cy + dy)) continue;
    const path = findPath(level, from, { cx: cell.cx + dx, cy: cell.cy + dy });
    if (path && (!best || path.length < best.length)) best = path;
  }
  return best;
}

// 나침반: 길로 가장 가까운 할 일과 그 길. 갈 수 있는 곳이 없으면 null
export function compassGoal(run, k, p) {
  const level = run.level;
  const from = cellOf(p);
  let best = null;
  for (const g of goals(run, k)) {
    const path = pathTo(level, from, g.cell);
    if (path && (!best || path.length < best.path.length)) best = { name: g.name, path };
  }
  return best;
}

// 화살표가 가리킬 방향 (yaw 와 같은 각). 길에서 ahead 칸 안쪽 가운데 눈으로 보이는 가장 먼 칸 쪽이다
export function compassYaw(map, p, path, ahead) {
  let to = null;
  for (const c of path.slice(0, ahead)) {
    if (!to || lineOfSight(map, p, center(c))) to = center(c);
  }
  if (!to) return null;
  return Math.atan2(-(to.x - p.x), -(to.y - p.y));
}
