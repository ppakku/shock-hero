// 수영장 물 (화면과 상관없는 부분). 물괴물은 눈이 없고 물소리만 듣는다.
// 물 깊이는 맵 글자와 따로 같은 크기의 물 줄로 적는다. 한 칸에 사물함과 물이 같이 있을 수 있어서다.
import { blocked } from './horrorGrid.js';

export const DRY = 0;
export const PUDDLE = 1; // 웅덩이: 샤워실, 풀 가장자리
export const SHALLOW = 2; // 얕은 물: 유아풀, 잠긴 복도. 걸음이 느려진다
export const DEEP = 3; // 깊은 물: 큰 풀장. 헤엄친다
const LEVELS = { '.': DRY, '~': PUDDLE, w: SHALLOW, W: DEEP };

// 물 줄을 읽어 map.water (칸마다 깊이) 를 붙인 맵 사본을 돌려준다
export function withWater(map, rows) {
  if (rows.length !== map.h) throw new Error(`물 줄 수가 맵과 다릅니다: ${rows.length}`);
  const water = new Uint8Array(map.w * map.h);
  rows.forEach((row, cy) => {
    if (row.length !== map.w) throw new Error(`물 ${cy}번 줄 길이가 다릅니다`);
    [...row].forEach((ch, cx) => {
      if (!(ch in LEVELS)) throw new Error(`물 ${cy}번 줄에 모르는 글자: ${ch}`);
      water[cy * map.w + cx] = LEVELS[ch];
    });
  });
  return { ...map, water };
}

// 수건 걸이 (T) 와 고무오리 (U) 자리를 붙인다. 둘 다 바닥 칸이라 지나갈 수 있다
export function withPoolProps(map) {
  const towels = [];
  const ducks = [];
  map.rows.forEach((row, cy) => [...row].forEach((ch, cx) => {
    if (ch === 'T') towels.push({ cx, cy });
    if (ch === 'U') ducks.push({ cx, cy });
  }));
  return { ...map, towels, ducks };
}

export function waterAt(map, cx, cy) {
  if (!map.water || cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return DRY;
  return map.water[cy * map.w + cx];
}

export const waterUnder = (map, p) => waterAt(map, Math.floor(p.x), Math.floor(p.y));

// 주인공 몸이 젖은 정도. dripT 가 남아 있는 동안 물방울이 떨어진다
export function createWet() {
  return { dripT: 0, soak: 0, level: DRY };
}

// 한 프레임. level: 지금 선 칸의 물 깊이. 물에서 나오면 그동안 가장 깊었던 물만큼 물방울이 떨어진다
export function stepWet(wet, level, k, dt) {
  if (level > DRY) {
    wet.soak = Math.max(wet.soak, k.dripFor[level]);
    wet.dripT = wet.soak;
  } else {
    wet.dripT = Math.max(0, wet.dripT - dt);
    if (wet.dripT === 0) wet.soak = 0;
  }
  wet.level = level;
  return wet;
}

// 수건으로 닦으면 바로 마른다
export function dry(wet) {
  wet.dripT = 0;
  wet.soak = 0;
  return wet;
}

// 물괴물이 듣는 거리 (칸). 0 이면 소리가 없다. 마른 바닥은 달려도 소리가 없다
export function waterNoise(wet, moving, running, k) {
  const { level } = wet;
  if (level === DEEP) return moving ? k.hear.swim : k.hear.float; // 헤엄치는 소리는 멀리 간다. 가만히 떠 있어도 찰랑인다
  if (level > DRY) return moving ? k.hear[level === SHALLOW ? 'wade' : 'puddle'] * (running ? k.hear.runBoost : 1) : 0;
  return wet.dripT > 0 ? k.hear.drip : 0;
}

// 물 깊이에 따른 걸음 비율
export const waterSpeed = (level, k) => k.speedIn[level];

// 깊은 물에서는 눈높이가 물 위로 내려온다 (미터)
export const eyeIn = (level, eye, k) => (level === DEEP ? k.swimEye : eye);

// 고무오리를 바라보는 쪽으로 던진다. 벽에 막히기 전까지 range 칸 안에서 가장 먼 물 칸에 떨어진다.
// 물이 없으면 막히기 전 마지막 바닥 칸에 떨어지고 소리는 나지 않는다. 앞이 바로 벽이면 null
export function throwDuck(map, p, yaw, range) {
  const fx = -Math.sin(yaw);
  const fy = -Math.cos(yaw);
  let land = null;
  let wet = null;
  for (let d = 0.5; d <= range; d += 0.25) {
    const cx = Math.floor(p.x + fx * d);
    const cy = Math.floor(p.y + fy * d);
    if (blocked(map, cx, cy)) break;
    land = { cx, cy };
    if (waterAt(map, cx, cy) > DRY) wet = land;
  }
  const at = wet ?? land;
  if (!at || (at.cx === Math.floor(p.x) && at.cy === Math.floor(p.y))) return null;
  return { cell: at, splash: !!wet };
}
