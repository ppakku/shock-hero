// 공장 건물 3D. 7칸 묶음(구역)으로 나눠서 먼 구역은 통째로 그리지 않는다.
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';

const CHUNK = 7; // 구역 한 변의 칸 수
const WALL_H = 3;
const LOCKER = { w: 1.3, h: 2.2, d: 1.1 };

function prop(group, cell, w, h, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  mesh.position.set((cell.cx + 0.5) * CELL, h / 2, (cell.cy + 0.5) * CELL);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

export function buildWorld(scene, map, mats = {}) {
  const wallMat = mats.wall || new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.9 });
  const floorMat = mats.floor || new THREE.MeshStandardMaterial({ color: 0x35312d, roughness: 1 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 1 });
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
  const lockerMat = mats.locker ? { map: mats.locker } : null;
  const parts = {
    lockers: map.lockers.map((c) => {
      const m = prop(props, c, LOCKER.w, LOCKER.h, LOCKER.d, 0x4a5a58);
      if (lockerMat) m.material = new THREE.MeshStandardMaterial({ ...lockerMat, roughness: 0.8 });
      return m;
    }),
    boxes: map.boxes.map((c) => prop(props, c, 0.9, 1.5, 0.5, 0x3a4a6a)),
    panel: prop(props, map.panel, 1.2, 1.7, 0.6, 0x6a3a2a),
    gate: prop(props, map.gate, CELL, WALL_H, CELL, 0x7a6a30),
  };

  // 어둠 속에서도 찾을 수 있게 전기 상자, 전원, 정문은 살짝 빛낸다
  const glow = (m, color, power) => {
    m.material.emissive.setHex(color);
    m.material.emissiveIntensity = power;
  };
  parts.boxes.forEach((m) => glow(m, 0x3060c0, 0.5));
  glow(parts.panel, 0xc03020, 0.6);
  glow(parts.gate, 0x402808, 0.5);

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
    props: parts,
    addFuses,
    // 전원이 켜지면 전원은 초록으로, 정문은 밝게 바뀐다
    setPowered() {
      glow(parts.panel, 0x20c040, 0.8);
      glow(parts.gate, 0xffc040, 0.7);
    },
    update(p, viewCells) {
      for (const group of chunks.values()) {
        const c = group.userData.center;
        group.visible = Math.hypot(c.x - p.x, c.y - p.y) < viewCells + CHUNK;
      }
    },
  };
}
