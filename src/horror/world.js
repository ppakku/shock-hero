// 공장 건물 3D. 7칸 묶음(구역)으로 나눠서 먼 구역은 통째로 그리지 않는다.
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';
import { decorSpots, emergencyGlow } from '../logic/horrorDecor.js';

const CHUNK = 7; // 구역 한 변의 칸 수
const WALL_H = 3;
const LOCKER = { w: 1.3, h: 2.2, d: 1.1 };
const LIGHT = { w: 0.7, h: 0.16, d: 0.06, y: 2.4 }; // 비상등 크기와 높이 (미터)
const LIGHT_COLOR = new THREE.Color(0xff3a14);
const MACHINE_TINT = new THREE.Color(0xb4bcc4); // 벽 그림을 어둡게 눌러 철판처럼 보이게 한다
const PIPE = { r: 0.07, off: 0.12, ys: [2.62, 2.8] }; // 벽을 따라가는 배관 두 줄

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const place = new THREE.Object3D();

function prop(group, cell, w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set((cell.cx + 0.5) * CELL, h / 2, (cell.cy + 0.5) * CELL);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

// 같은 모양 여러 개를 한 번에 그린다
function propSet(group, cells, w, h, d, material) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), material, cells.length);
  const m = new THREE.Matrix4();
  cells.forEach((c, i) => mesh.setMatrixAt(i, m.makeTranslation((c.cx + 0.5) * CELL, h / 2, (c.cy + 0.5) * CELL)));
  mesh.castShadow = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

// 벽 바깥면의 미터 좌표
const faceX = (f) => (f.cx + 0.5 + f.dx / 2) * CELL;
const faceZ = (f) => (f.cy + 0.5 + f.dy / 2) * CELL;

// 벽면에 붙는 네모. 벽을 따라 w, 벽에서 나오는 길이 d
function setOnWall(mesh, i, f, w, h, d, y) {
  place.position.set(faceX(f) - (f.dx * d) / 2, y, faceZ(f) - (f.dy * d) / 2);
  place.rotation.set(0, 0, 0);
  place.scale.set(f.dx ? d : w, h, f.dx ? w : d);
  place.updateMatrix();
  mesh.setMatrixAt(i, place.matrix);
}

// 비상등, 기계, 배관. 전부 벽에 붙어 있고 종류마다 한 번에 그린다
function addDecor(scene, map, k, wallMat) {
  const spots = decorSpots(map);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const decor = new THREE.Group();
  scene.add(decor);

  const lightMat = new THREE.MeshBasicMaterial({ color: LIGHT_COLOR.clone() });
  const lights = new THREE.InstancedMesh(box, lightMat, spots.lights.length);
  spots.lights.forEach((f, i) => setOnWall(lights, i, f, LIGHT.w, LIGHT.h, LIGHT.d, LIGHT.y));

  const machines = new THREE.InstancedMesh(box, wallMat, spots.machines.length);
  spots.machines.forEach((f, i) => {
    const h = 1.5 + (i % 3) * 0.3;
    setOnWall(machines, i, f, 1.7 + (i % 2) * 0.5, h, k.machineDepth, h / 2);
    machines.setColorAt(i, MACHINE_TINT);
  });
  machines.castShadow = true;
  machines.receiveShadow = true;

  const pipeGeo = new THREE.CylinderGeometry(PIPE.r, PIPE.r, CELL, 6, 1, true);
  const pipes = new THREE.InstancedMesh(pipeGeo, lambert(0x2e3236), spots.pipes.length * PIPE.ys.length);
  spots.pipes.forEach((f, i) => PIPE.ys.forEach((y, j) => {
    place.position.set(faceX(f) - f.dx * PIPE.off, y, faceZ(f) - f.dy * PIPE.off);
    place.rotation.set(f.dx ? Math.PI / 2 : 0, 0, f.dx ? 0 : Math.PI / 2); // 벽과 나란히 눕힌다
    place.scale.set(1, 1, 1);
    place.updateMatrix();
    pipes.setMatrixAt(i * PIPE.ys.length + j, place.matrix);
  }));

  for (const mesh of [lights, machines, pipes]) {
    mesh.computeBoundingSphere();
    decor.add(mesh);
  }
  return { lightMat, counts: { lights: spots.lights.length, machines: spots.machines.length, pipes: spots.pipes.length } };
}

export function buildWorld(scene, map, k, mats = {}) {
  const wallMat = mats.wall || lambert(0x5a5148);
  const floorMat = mats.floor || lambert(0x35312d);
  const ceilMat = lambert(0x1b1a19);
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const chunks = new Map();
  const chunkOf = (cx, cy) => {
    const key = `${Math.floor(cx / CHUNK)},${Math.floor(cy / CHUNK)}`;
    if (!chunks.has(key)) {
      const group = new THREE.Group();
      group.userData.center = { x: Math.floor(cx / CHUNK) * CHUNK + CHUNK / 2, y: Math.floor(cy / CHUNK) * CHUNK + CHUNK / 2 };
      group.userData.walls = [];
      scene.add(group);
      chunks.set(key, group);
    }
    return chunks.get(key);
  };

  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      const c = chunkOf(cx, cy);
      if (map.rows[cy][cx] === '#') c.userData.walls.push([cx, cy]);
    }
  }

  const matrix = new THREE.Matrix4();
  for (const group of chunks.values()) {
    const walls = group.userData.walls;
    if (walls.length) {
      const mesh = new THREE.InstancedMesh(wallGeo, wallMat, walls.length);
      walls.forEach(([cx, cy], i) => mesh.setMatrixAt(i, matrix.makeTranslation((cx + 0.5) * CELL, WALL_H / 2, (cy + 0.5) * CELL)));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    const size = CHUNK * CELL;
    const { x, y } = group.userData.center;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x * CELL, 0, y * CELL);
    floor.receiveShadow = true;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(x * CELL, WALL_H, y * CELL);
    group.add(floor, ceil);
  }

  const props = new THREE.Group();
  scene.add(props);
  propSet(props, map.lockers, LOCKER.w, LOCKER.h, LOCKER.d, mats.locker || lambert(0x4a5a58));
  const boxMat = lambert(0x3a4a6a);
  propSet(props, map.boxes, 0.9, 1.5, 0.5, boxMat);
  const panelMat = lambert(0x6a3a2a);
  const gateMat = lambert(0x7a6a30);
  prop(props, map.panel, 1.2, 1.7, 0.6, panelMat);
  prop(props, map.gate, CELL, WALL_H, CELL, gateMat);

  // 어둠 속에서도 찾을 수 있게 전기 상자, 전원, 정문은 살짝 빛낸다
  const glow = (m, color, power) => {
    m.emissive.setHex(color);
    m.emissiveIntensity = power;
  };
  glow(boxMat, 0x3060c0, 0.5);
  glow(panelMat, 0xc03020, 0.6);
  glow(gateMat, 0x402808, 0.5);

  const { lightMat, counts } = addDecor(scene, map, k, wallMat);
  let lightLevel = -1;

  // 퓨즈: 어둠 속에서 찾을 수 있게 스스로 살짝 빛난다
  const addFuses = (fuses) =>
    fuses.map((c) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8), new THREE.MeshBasicMaterial({ color: 0xffc040 }));
      mesh.position.set((c.cx + 0.5) * CELL, 0.75, (c.cy + 0.5) * CELL);
      mesh.rotation.z = Math.PI / 2;
      props.add(mesh);
      return mesh;
    });

  return {
    addFuses,
    counts,
    // 전원이 켜지면 전원은 초록으로, 정문은 밝게 바뀐다
    setPowered() {
      glow(panelMat, 0x20c040, 0.8);
      glow(gateMat, 0xffc040, 0.7);
    },
    // t: 놀이 시간 (초). 일시정지 때는 비상등도 멈춘다
    update(p, viewCells, t, lowFx) {
      for (const group of chunks.values()) {
        const c = group.userData.center;
        group.visible = Math.hypot(c.x - p.x, c.y - p.y) < viewCells + CHUNK;
      }
      const level = emergencyGlow(t, lowFx, k);
      if (level !== lightLevel) {
        lightLevel = level;
        lightMat.color.copy(LIGHT_COLOR).multiplyScalar(level);
      }
    },
  };
}
