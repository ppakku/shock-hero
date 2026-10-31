// 공장을 꾸밀 자리 고르기 (비상등, 기계, 배관). 벽에 붙이기만 하고 다니는 칸은 바꾸지 않는다.
import { blocked } from './horrorGrid.js';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KEEP_CLEAR = new Set(['L', 'E', 'P', 'G', 'D']); // 이것들의 둘레는 비워 둔다
const MACHINE_AT = [[0.2, 0.7], [0.35]]; // 방의 벽면 목록에서 고르는 위치 (방마다 번갈아)
const LIGHT_AT = [0.45, 0.9];
const PIPE_AT = 0.55;
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

// 맵에서 항상 같은 자리가 나온다
export function decorSpots(map) {
  const out = { machines: [], lights: [], pipes: [] };
  roomsOf(map).forEach((cells, i) => {
    const faces = facesOf(map, cells);
    if (!faces.length) return;
    for (const part of MACHINE_AT[i % 2]) out.machines.push(at(faces, part));
    if (i % 3 !== 2) for (const part of LIGHT_AT) out.lights.push(at(faces, part));
    if (i % 2 === 0) out.pipes.push(...pipeRun(faces, at(faces, PIPE_AT)));
  });
  return out;
}

// 비상등 밝기. 낮게 숨 쉬다가 가끔 뚝 떨어진다. 효과 줄이기면 어둡게 멈춰 있다.
export function emergencyGlow(t, lowFx, k) {
  if (lowFx) return k.emergencyLow;
  const hum = 0.85 + 0.15 * Math.sin(t * 2.3);
  const dropping = Math.sin(t * 1.9) * Math.sin(t * 0.73 + 1) > 0.5;
  return k.emergencyHigh * hum * (dropping && Math.sin(t * 9) > 0 ? 0.25 : 1);
}
