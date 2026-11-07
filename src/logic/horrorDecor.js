// 맵을 꾸밀 자리 고르기 (벽 등, 벽에 붙은 큰 물건, 배관). 벽에 붙이기만 하고 다니는 칸은 바꾸지 않는다.
import { blocked, findPath } from './horrorGrid.js';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KEEP_CLEAR = new Set(['L', 'E', 'P', 'G', 'D', 'A', 'B', 'K', 'N']); // 이것들의 둘레는 비워 둔다
const MACHINE_AT = [[0.2, 0.7], [0.35]]; // 방의 벽면 목록에서 고르는 위치 (방마다 번갈아)
const LIGHT_AT = [0.45, 0.9];
const PIPE_AT = 0.55;
const LOW_AT = [0.08, 0.5, 0.92]; // 낮은 가구를 놓는 위치
const PIPE_CELLS = 2; // 고른 벽면에서 양쪽으로 잇는 칸 수

const open = (map, cx, cy) => !blocked(map, cx, cy) && map.rows[cy][cx] !== 'D';

function nearKept(map, cx, cy) {
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (KEEP_CLEAR.has(map.rows[y]?.[x])) return true;
    }
  }
  return false;
}

// 문으로 나뉜 방마다 칸 목록
function roomsOf(map) {
  const seen = new Set();
  const rooms = [];
  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      if (!open(map, cx, cy) || seen.has(`${cx},${cy}`)) continue;
      seen.add(`${cx},${cy}`);
      const cells = [{ cx, cy }];
      for (let i = 0; i < cells.length; i++) {
        for (const [dx, dy] of STEPS) {
          const x = cells[i].cx + dx;
          const y = cells[i].cy + dy;
          if (!open(map, x, y) || seen.has(`${x},${y}`)) continue;
          seen.add(`${x},${y}`);
          cells.push({ cx: x, cy: y });
        }
      }
      rooms.push(cells);
    }
  }
  return rooms;
}

// 방 안에서 벽을 마주 보는 면. (cx, cy) 는 바닥 칸, (dx, dy) 는 벽 쪽 방향
function facesOf(map, cells) {
  const faces = [];
  for (const { cx, cy } of cells) {
    if (nearKept(map, cx, cy)) continue;
    for (const [dx, dy] of STEPS) {
      if (map.rows[cy + dy]?.[cx + dx] === '#') faces.push({ cx, cy, dx, dy });
    }
  }
  return faces;
}

const at = (faces, part) => faces[Math.floor(faces.length * part)];

// 고른 벽면에서 벽을 따라 이어지는 면들
function pipeRun(faces, start) {
  const sideX = start.dy; // 벽을 따라가는 방향
  const sideY = start.dx;
  const has = (i) => faces.find((f) => f.dx === start.dx && f.dy === start.dy && f.cx === start.cx + sideX * i && f.cy === start.cy + sideY * i);
  const run = [start];
  for (const way of [1, -1]) {
    for (let i = 1; i <= PIPE_CELLS && has(way * i); i++) run.push(has(way * i));
  }
  return run;
}

// 큰 방을 tile 칸 묶음으로 쪼갠다. 문이 적은 긴 굴도 고루 꾸미게 한다
function split(cells, tile) {
  const parts = new Map();
  for (const c of cells) {
    const key = `${Math.floor(c.cx / tile)},${Math.floor(c.cy / tile)}`;
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key).push(c);
  }
  return [...parts.values()];
}

// 맵에서 항상 같은 자리가 나온다. tile 이 있으면 방을 그 크기로 쪼개서 고른다
export function decorSpots(map, tile = 0) {
  const out = { machines: [], lights: [], pipes: [], lows: [] };
  const rooms = roomsOf(map);
  (tile ? rooms.flatMap((cells) => split(cells, tile)) : rooms).forEach((cells, i) => {
    const faces = facesOf(map, cells);
    if (!faces.length) return;
    const addOnce = (list, f) => { if (!list.includes(f)) list.push(f); }; // 벽면이 적으면 같은 면이 또 뽑힌다
    for (const part of MACHINE_AT[i % 2]) addOnce(out.machines, at(faces, part));
    if (i % 3 !== 2) for (const part of LIGHT_AT) addOnce(out.lights, at(faces, part));
    if (i % 2 === 0) out.pipes.push(...pipeRun(faces, at(faces, PIPE_AT)));
    for (const part of LOW_AT) addOnce(out.lows, at(faces, part));
  });
  return out;
}

// 바깥 맵(숲)의 장식 자리. 벽 등과 관 대신 장승 한 쌍, 서낭당 돌무더기, 가지에 걸린 머리카락을 놓는다.
// 자리는 칸 단위 소수 { x, y } 와 그림 앞면이 보는 방향 yaw (라디안, three.js 의 y 축 회전) 다. 맵을 바꾸지 않고 항상 같다.
// decor: 테마의 decor ({ totem: { ahead }, cairn: { count }, hair: { count } })
const yawOf = (dx, dy) => Math.atan2(dx, dy); // 앞면이 (dx, dy) 쪽을 보게 돌리는 각도
const TOTEM_OUT = 0.38; // 장승이 길가 칸 가운데에서 벽 쪽으로 나가 서는 거리 (칸). 둘 사이로 지나갈 수 있다
const CAIRN_GAP = 8; // 돌무더기 사이 가장 짧은 거리 (칸)
const HAIR_GAP = 5; // 머리카락 사이 가장 짧은 거리 (칸)
const HAIR_FROM_START = 6; // 시작 자리에서 이보다 가까운 곳에는 머리카락과 돌무더기를 두지 않는다 (칸)

// 둘레 5 x 5 칸에서 다닐 수 있는 칸 수. 빈터일수록 크다
function openness(map, cx, cy) {
  let n = 0;
  for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) if (open(map, x, y)) n += 1;
  return n;
}

// 앞에서부터 보며 이미 고른 자리와 gap 칸 넘게 떨어진 것만 count 개
function spread(list, gap, count) {
  const out = [];
  for (const c of list) {
    if (out.length >= count) break;
    if (out.every((o) => Math.hypot(o.cx - c.cx, o.cy - c.cy) >= gap)) out.push(c);
  }
  return out;
}

export function outdoorSpots(map, decor) {
  const totems = [];
  const path = findPath(map, map.start, map.gate ? frontOfGate(map) : map.start) || [];
  // 시작에서 ahead 칸 나아간 뒤, 길이 두 칸 너비 안으로 좁아지는 첫 자리. 장승이 빈터 가운데가 아니라 길목에 선다
  const edge = (c, sx, sy) => {
    let e = c;
    while (open(map, e.cx + sx, e.cy + sy)) e = { cx: e.cx + sx, cy: e.cy + sy };
    return e;
  };
  for (let i = Math.max(0, decor.totem.ahead - 1); i < path.length - 1; i++) {
    const at = path[i];
    const dx = path[i + 1].cx - at.cx;
    const dy = path[i + 1].cy - at.cy;
    const ends = [1, -1].map((side) => ({ side, c: edge(at, -dy * side, dx * side) }));
    if (Math.abs(ends[0].c.cx - ends[1].c.cx) + Math.abs(ends[0].c.cy - ends[1].c.cy) > 1) continue;
    // 길 양옆 끝 칸의 가장자리에 세운다. 둘 다 시작 쪽 (오는 사람) 을 본다
    for (const { side, c } of ends) totems.push({ x: c.cx + 0.5 - dy * side * TOTEM_OUT, y: c.cy + 0.5 + dx * side * TOTEM_OUT, yaw: yawOf(-dx, -dy) });
    break;
  }

  // 돌무더기: 빈터 가장자리 벽 앞. 빈터가 넓은 곳부터 고루
  const faces = [];
  for (let cy = 1; cy < map.h - 1; cy++) {
    for (let cx = 1; cx < map.w - 1; cx++) {
      if (!open(map, cx, cy) || nearKept(map, cx, cy) || Math.hypot(cx - map.start.cx, cy - map.start.cy) < HAIR_FROM_START) continue;
      const room = openness(map, cx, cy);
      if (room < 13) continue;
      for (const [dx, dy] of STEPS) if (map.rows[cy + dy][cx + dx] === '#') faces.push({ cx, cy, dx, dy, room });
    }
  }
  faces.sort((a, b) => b.room - a.room || a.cy - b.cy || a.cx - b.cx || a.dx - b.dx || a.dy - b.dy);
  const cairns = spread(faces, CAIRN_GAP, decor.cairn.count).map((f) => ({ x: f.cx + 0.5 + f.dx * 0.3, y: f.cy + 0.5 + f.dy * 0.3, yaw: yawOf(-f.dx, -f.dy) }));

  // 머리카락: 곧은 오솔길 칸 (양쪽이 벽). 길을 따라 들어오는 사람 눈앞에 늘어지게 길을 가로질러 건다
  const lanes = [];
  for (let cy = 1; cy < map.h - 1; cy++) {
    for (let cx = 1; cx < map.w - 1; cx++) {
      if (!open(map, cx, cy) || nearKept(map, cx, cy) || Math.hypot(cx - map.start.cx, cy - map.start.cy) < HAIR_FROM_START) continue;
      const ns = open(map, cx, cy - 1) && open(map, cx, cy + 1) && !open(map, cx - 1, cy) && !open(map, cx + 1, cy);
      const ew = open(map, cx - 1, cy) && open(map, cx + 1, cy) && !open(map, cx, cy - 1) && !open(map, cx, cy + 1);
      if (ns || ew) lanes.push({ cx, cy, ns });
    }
  }
  // 맵 위쪽에만 몰리지 않게 칸 번호를 섞어 본다 (항상 같은 순서)
  lanes.sort((a, b) => ((a.cx * 7 + a.cy * 13) % 17) - ((b.cx * 7 + b.cy * 13) % 17) || a.cy - b.cy || a.cx - b.cx);
  const hair = spread(lanes, HAIR_GAP, decor.hair.count).map((c) => ({ x: c.cx + 0.5, y: c.cy + 0.5, yaw: c.ns ? 0 : Math.PI / 2 }));
  return { totems, cairns, hair };
}

// 정문 앞 칸 (정문은 막힌 칸이라 길 찾기의 끝으로 쓸 수 없다)
function frontOfGate(map) {
  for (const [dx, dy] of STEPS) if (open(map, map.gate.cx + dx, map.gate.cy + dy)) return { cx: map.gate.cx + dx, cy: map.gate.cy + dy };
  return map.start;
}

// 비상등 밝기. 낮게 숨 쉬다가 가끔 뚝 떨어진다. 효과 줄이기면 어둡게 멈춰 있다.
export function emergencyGlow(t, lowFx, k) {
  if (lowFx) return k.emergencyLow;
  const hum = 0.85 + 0.15 * Math.sin(t * 2.3);
  const dropping = Math.sin(t * 1.9) * Math.sin(t * 0.73 + 1) > 0.5;
  return k.emergencyHigh * hum * (dropping && Math.sin(t * 9) > 0 ? 0.25 : 1);
}
