// 바깥 맵(숲)의 3D. world.js 가 테마에 outdoor 가 있을 때 부른다.
// '#' 칸은 상자 대신 나무줄기와 수관, 길을 마주한 면마다 덤불 그림으로 그린다. 눈 가림 판정은 그대로 '#' 칸이다.
// 줄기와 수관은 맵 전체를 한 번에 그리고 (덤불 위로 먼 나무가 늘 보이게), 덤불만 구역마다 나눠 먼 구역은 그리지 않는다.
// 그림은 모두 alphaTest 로 잘라 그린다 (섞어 그리기보다 싸고, 순서를 따지지 않는다).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL, frontOf } from '../logic/horrorGrid.js';
import { outdoorSpots } from '../logic/horrorDecor.js';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RING = 3; // 맵 둘레 밖에도 이만큼 (칸) 나무를 심어 숲이 맵 끝에서 끊기지 않게 한다
const CUT = 0.5; // alphaTest
const place = new THREE.Object3D();

// 칸마다 늘 같은 0~1 값. salt 로 같은 칸에서 여러 값을 뽑는다
export function cellRandom(cx, cy, salt = 0) {
  let h = Math.imul(cx + 1013, 73856093) ^ Math.imul(cy + 7919, 19349663) ^ Math.imul(salt + 31, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const between = ([lo, hi], t) => lo + (hi - lo) * t;

// 밑이 y = 0 인 1 x 1 판. 앞면이 +z 를 본다
function standingPlane() {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  return geo;
}

// 가운데가 y = 0 인 십자로 엇갈린 판 두 장. 어느 쪽에서 봐도 납작해지지 않는다
function crossedPlanes(base = 0) {
  const a = new THREE.PlaneGeometry(1, 1);
  const b = new THREE.PlaneGeometry(1, 1);
  b.rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b]);
  geo.translate(0, base, 0);
  return geo;
}

function cardMaterial(side = THREE.DoubleSide) {
  return new THREE.MeshLambertMaterial({ color: 0xffffff, alphaTest: CUT, side, visible: false }); // 그림을 받기 전에는 네모가 보이지 않게 숨긴다
}

// 받은 그림을 끼우고 보이게 한다
const show = (mat) => (tex) => {
  mat.map = tex;
  mat.visible = true;
  mat.needsUpdate = true;
};

function setAt(mesh, i, x, y, z, yaw, sx, sy, sz) {
  place.position.set(x, y, z);
  place.rotation.set(0, yaw, 0);
  place.scale.set(sx, sy, sz);
  place.updateMatrix();
  mesh.setMatrixAt(i, place.matrix);
}

function finish(mesh, parent) {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

// 나무를 심을 칸: 맵 안의 '#' 칸과 맵 둘레 밖 RING 칸
function treeCells(map) {
  const cells = [];
  for (let cy = -RING; cy < map.h + RING; cy++) {
    for (let cx = -RING; cx < map.w + RING; cx++) {
      const inside = cx >= 0 && cy >= 0 && cx < map.w && cy < map.h;
      if (!inside || map.rows[cy][cx] === '#') cells.push([cx, cy]);
    }
  }
  return cells;
}

// 줄기와 수관. 둘 다 맵 전체가 한 번에 그려진다 (그리기 2번)
export function addTrees(scene, map, trees, barkMat, art) {
  const cells = treeCells(map);
  const { trunk, crown } = trees;
  const trunkGeo = new THREE.CylinderGeometry(0.62, 1, 1, trunk.sides, 1, true);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, cells.length);
  const crownMat = cardMaterial();
  art(`${crown.art}.webp`, show(crownMat));
  const crowns = new THREE.InstancedMesh(crossedPlanes(), crownMat, cells.length);
  const shade = new THREE.Color();
  cells.forEach(([cx, cy], i) => {
    const r = between(trunk.r, cellRandom(cx, cy, 1));
    const h = between(trunk.h, cellRandom(cx, cy, 2));
    const room = trunk.jitter * CELL / 3;
    const x = (cx + 0.5) * CELL + (cellRandom(cx, cy, 3) - 0.5) * 2 * room;
    const z = (cy + 0.5) * CELL + (cellRandom(cx, cy, 4) - 0.5) * 2 * room;
    const lean = cellRandom(cx, cy, 5) * Math.PI * 2;
    setAt(trunks, i, x, 0, z, lean, r, h, r);
    const w = between(crown.w, cellRandom(cx, cy, 6));
    setAt(crowns, i, x, h - crown.drop, z, lean, w, w * crown.aspect, w);
    crowns.setColorAt(i, shade.setScalar(0.75 + 0.25 * cellRandom(cx, cy, 7)));
  });
  trunks.castShadow = true;
  const group = new THREE.Group();
  scene.add(group);
  finish(trunks, group);
  finish(crowns, group);
  return group;
}

// 한 구역의 덤불. walls: 그 구역의 '#' 칸들. 다닐 수 있는 칸(사물함, 문 칸 포함)을 마주한 면마다 한두 겹 세운다
export function addBushes(group, map, walls, bush, mat, lowFx) {
  const spots = [];
  for (const [cx, cy] of walls) {
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || map.rows[ny][nx] === '#') continue;
      const layers = lowFx ? 1 : bush.inset.length;
      for (let layer = 0; layer < layers; layer++) spots.push({ cx, cy, dx, dy, layer });
    }
  }
  if (!spots.length) return null;
  const mesh = new THREE.InstancedMesh(standingPlane(), mat, spots.length);
  const shade = new THREE.Color();
  spots.forEach(({ cx, cy, dx, dy, layer }, i) => {
    const salt = 10 + layer * 4 + (dx + 1) * 2 + dy;
    const inset = bush.inset[layer];
    const slide = (cellRandom(cx, cy, salt) - 0.5) * 2 * bush.slide;
    const x = (cx + 0.5 + dx / 2) * CELL - dx * inset - dy * slide;
    const z = (cy + 0.5 + dy / 2) * CELL - dy * inset + dx * slide;
    const w = bush.w * (0.9 + 0.25 * cellRandom(cx, cy, salt + 1));
    const flip = cellRandom(cx, cy, salt + 2) < 0.5 ? -1 : 1; // 좌우를 뒤집어 같은 덤불이 줄지어 보이지 않게
    setAt(mesh, i, x, 0, z, Math.atan2(dx, dy), w * flip, between(bush.h, cellRandom(cx, cy, salt + 3)), 1);
    mesh.setColorAt(i, shade.setScalar((layer ? 0.7 : 0.85) + 0.15 * cellRandom(cx, cy, salt + 4))); // 뒤 겹은 조금 어둡게
  });
  return finish(mesh, group);
}

// 속 빈 고목 (숨는 곳). 길 쪽 칸 경계에 길을 보는 그림 한 장. 앞면만 그려서 안에 숨으면 그림이 시야를 막지 않는다
export function addHollowTrees(group, map, card, file, art) {
  const mat = cardMaterial(THREE.FrontSide);
  art(file, show(mat));
  const mesh = new THREE.InstancedMesh(standingPlane(), mat, map.lockers.length);
  map.lockers.forEach((c, i) => {
    const f = frontOf(map, c);
    const dx = f.cx - c.cx;
    const dy = f.cy - c.cy;
    const x = (c.cx + 0.5 + dx * 0.45) * CELL;
    const z = (c.cy + 0.5 + dy * 0.45) * CELL;
    setAt(mesh, i, x, 0, z, Math.atan2(dx, dy), card.w, card.h, 1);
  });
  return finish(mesh, group);
}

// 충전 상자와 전원처럼 칸 하나에 선 물건을 길 쪽을 보는 그림 한 장으로 세운다. card: { art, h }, aspect: 그림 가로/세로.
// mat 은 world 의 빛나는 재질 (전원이 켜지면 색이 바뀐다). 그림을 받으면 onShow() 로 원래 상자를 숨긴다
export function addPropCards(group, map, cells, card, aspect, mat, art, onShow) {
  mat.alphaTest = CUT;
  mat.side = THREE.DoubleSide;
  mat.visible = false;
  const mesh = new THREE.InstancedMesh(standingPlane(), mat, cells.length);
  cells.forEach((c, i) => {
    const f = frontOf(map, c);
    const dx = f.cx - c.cx;
    const dy = f.cy - c.cy;
    setAt(mesh, i, (c.cx + 0.5 + dx * 0.3) * CELL, 0, (c.cy + 0.5 + dy * 0.3) * CELL, Math.atan2(dx, dy), card.h * aspect, card.h, 1);
  });
  art(`${card.art}.webp`, (tex) => {
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.visible = true;
    mat.needsUpdate = true;
    onShow();
  });
  return finish(mesh, group);
}

// 숲 끝의 쇠문. 길 쪽을 보는 그림 한 장. mat 은 world 의 정문 재질 (전원이 켜지면 빛난다)
export function addGateCard(group, map, gate, mat) {
  const f = frontOf(map, map.gate);
  const dx = f.cx - map.gate.cx;
  const dy = f.cy - map.gate.cy;
  mat.alphaTest = CUT;
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(standingPlane(), mat);
  mesh.position.set((map.gate.cx + 0.5 + dx * 0.3) * CELL, 0, (map.gate.cy + 0.5 + dy * 0.3) * CELL);
  mesh.rotation.y = Math.atan2(dx, dy);
  mesh.scale.set(gate.w, gate.h, 1);
  group.add(mesh);
  return mesh;
}

// 장승 한 쌍, 서낭당 돌무더기, 가지에 걸린 머리카락. 종류마다 한 번에 그린다 (그리기 3번)
export function addOutdoorDecor(scene, map, decor, art) {
  const spots = outdoorSpots(map, decor);
  const group = new THREE.Group();
  scene.add(group);
  const kinds = [
    { list: spots.totems, part: decor.totem, geo: crossedPlanes(0.5), y: 0 },
    { list: spots.cairns, part: decor.cairn, geo: standingPlane(), y: 0 },
    { list: spots.hair, part: decor.hair, geo: crossedPlanes(0.5), y: decor.hair.y },
  ];
  for (const { list, part, geo, y } of kinds) {
    if (!list.length) continue;
    const mat = cardMaterial();
    art(`${part.art}.webp`, show(mat));
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => setAt(mesh, i, s.x * CELL, y, s.y * CELL, s.yaw, part.w, part.h, part.w));
    finish(mesh, group);
  }
  return { group, counts: { totems: spots.totems.length, cairns: spots.cairns.length, hair: spots.hair.length } };
}

const SKY_VERTEX = `
varying vec2 vUv;
varying float vUp;
void main() {
  vUv = uv;
  vUp = normalize(position).y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAGMENT = `
uniform sampler2D map;
uniform vec3 tint;
uniform vec3 low;
uniform vec3 ground;
uniform float horizon;
varying vec2 vUv;
varying float vUp;
void main() {
  vec3 c = texture2D(map, vUv).rgb * tint;
  c = mix(c, low, (1.0 - smoothstep(-0.05, 0.45, vUp)) * horizon);
  c = mix(c, ground, 1.0 - smoothstep(0.0, 0.1, vUp)); // 지평선 아래와 바로 위는 안개 색: 나무 사이 틈으로 먼 숲이 어둡게 보인다
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 하늘 돔. 사진기를 따라다니는 반구 (반지름은 사진기 먼 끝보다 안쪽). 맨 먼저, 깊이 없이 그려서 모든 것 뒤에 보인다.
// 그림을 받기 전과 못 받았을 때는 숨어 있고, 그동안은 scene.background 색이 하늘이다.
// setDusk(d): 그림에 d.tint 를 곱하고 지평선 쪽을 d.sky.low 로, 지평선 아래를 안개 색 d.fog 로 덮는다
export function addSky(scene, sky, art) {
  const geo = new THREE.SphereGeometry(sky.radius, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2 + 0.2);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const up = Math.asin(Math.max(-1, Math.min(1, pos.getY(i) / sky.radius)));
    uv.setXY(i, uv.getX(i), Math.max(0, up) / (Math.PI / 2)); // 가로는 한 바퀴에 그림 한 장 (이음매 없이 되감은 그림), 세로는 지평선에서 꼭대기까지
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, tint: { value: new THREE.Color(0xffffff) }, low: { value: new THREE.Color(0x000000) }, ground: { value: new THREE.Color(0x000000) }, horizon: { value: sky.horizon } },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  art(`${sky.art}.jpg`, (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    material.uniforms.map.value = tex;
    mesh.visible = true;
  });
  return {
    mesh,
    setDusk(d) {
      material.uniforms.tint.value.setHex(d.tint);
      material.uniforms.low.value.setHex(d.sky.low);
      material.uniforms.ground.value.setHex(d.fog);
    },
    follow(x, z) {
      mesh.position.set(x, 0, z);
    },
  };
}
