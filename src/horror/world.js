// 맵 건물 3D. 7칸 묶음(구역)으로 나눠서 먼 구역은 통째로 그리지 않는다. 생김새는 맵 파일의 theme 이 정한다.
import * as THREE from 'three';
import { CELL, chunksInSight } from '../logic/horrorGrid.js';
import { decorSpots, emergencyGlow } from '../logic/horrorDecor.js';
import { factoryTheme } from './maps/factory.js';

const CHUNK = 7; // 구역 한 변의 칸 수
const WALL_H = 3;
const LOCKER = { w: 1.3, h: 2.2, d: 1.1 };
const DOOR = { d: 0.3, sec: 1.2 }; // 잠긴 문 두께 (미터), 천장으로 말려 올라가는 시간 (초)
const NOTE = { w: 0.4, h: 0.55, color: 0xe8dcc0, y: 0.03, turn: 1.1 }; // 쪽지 크기 (미터), 색, 바닥에서 높이 (미터), 자리마다 돌아가는 각도 (라디안)
const DOOR_COLORS = [0xd83828, 0x2868e0]; // 열쇠와 같은 색. map.locks 순서

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

// 잠긴 문은 공장 셔터다. 양옆이 벽인 쪽으로 세운다
function addShutter(group, c, map, color, wallMat) {
  const mat = new THREE.MeshLambertMaterial({ color, map: wallMat.map, emissive: color, emissiveIntensity: 0.12 }); // 녹슨 벽 그림에 색만 입힌다
  const across = map.rows[c.cy][c.cx - 1] === '#'; // 왼쪽이 벽이면 x 를 따라 놓는다
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(across ? CELL : DOOR.d, WALL_H, across ? DOOR.d : CELL), mat);
  mesh.position.set((c.cx + 0.5) * CELL, WALL_H / 2, (c.cy + 0.5) * CELL);
  mesh.castShadow = true;
  group.add(mesh);
  return { mesh, t: 0 };
}

// 벽 등, 벽에 붙은 큰 물건, 배관. 전부 벽에 붙어 있고 종류마다 한 번에 그린다
function addDecor(scene, map, k, wallMat, decor) {
  const { light, machine, pipe } = decor;
  const spots = decorSpots(map, decor.tile);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const group = new THREE.Group();
  scene.add(group);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lights = new THREE.InstancedMesh(box, lightMat, spots.lights.length);
  spots.lights.forEach((f, i) => setOnWall(lights, i, f, light.w, light.h, light.d, light.y));

  const machines = new THREE.InstancedMesh(box, machine.color === undefined ? wallMat : lambert(machine.color), spots.machines.length);
  const tints = machine.tints.map((c) => new THREE.Color(c));
  spots.machines.forEach((f, i) => {
    const h = machine.h[i % machine.h.length];
    setOnWall(machines, i, f, machine.w[i % machine.w.length], h, machine.depth ?? k.machineDepth, machine.y + h / 2);
    machines.setColorAt(i, tints[i % tints.length]);
  });
  machines.castShadow = true;
  machines.receiveShadow = true;

  const pipeGeo = new THREE.CylinderGeometry(pipe.r, pipe.r, CELL, 6, 1, true);
  const pipes = new THREE.InstancedMesh(pipeGeo, lambert(pipe.color), spots.pipes.length * pipe.ys.length);
  spots.pipes.forEach((f, i) => pipe.ys.forEach((y, j) => {
    place.position.set(faceX(f) - f.dx * pipe.off, y, faceZ(f) - f.dy * pipe.off);
    place.rotation.set(f.dx ? Math.PI / 2 : 0, 0, f.dx ? 0 : Math.PI / 2); // 벽과 나란히 눕힌다
    place.scale.set(1, 1, 1);
    place.updateMatrix();
    pipes.setMatrixAt(i * pipe.ys.length + j, place.matrix);
  }));

  for (const mesh of [lights, machines, pipes]) {
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return { lightMat, counts: { lights: spots.lights.length, machines: spots.machines.length, pipes: spots.pipes.length } };
}

// 벽, 바닥, 사물함의 재질. 그림을 못 받으면 밋밋한 색으로 둔다
function themeMaterials(theme, onMissing) {
  const textures = {};
  let reported = false;
  const make = (name) => {
    const { art, plain, repeat, tint = 0xffffff, shiny } = theme[name];
    const mat = shiny ? new THREE.MeshPhongMaterial({ color: tint, specular: shiny.color, shininess: shiny.power }) : new THREE.MeshLambertMaterial({ color: tint });
    const tex = new THREE.TextureLoader().load(`art/${art}.jpg`, undefined, undefined, () => {
      if (!reported) console.error('공포 모드 재질 그림을 못 받아 밋밋한 색으로 둡니다:', name);
      reported = true;
      mat.map = null;
      mat.color.setHex(plain);
      mat.needsUpdate = true;
      onMissing(name);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    textures[name] = tex;
    return mat;
  };
  return { wall: make('wall'), floor: make('floor'), locker: make('locker'), textures };
}

export function buildWorld(scene, map, k, themeIn = factoryTheme) {
  const old = themeIn.decor ? null : themeIn; // HorrorGame 이 theme 을 넘기면 지운다
  const theme = old ? factoryTheme : themeIn;
  // 벽 그림을 못 받으면 셔터도 그림을 버린다. 안 그러면 까맣게 나와서 문 색을 알 수 없다
  const dropDoorArt = () => {
    for (const d of doors) {
      d.mesh.material.map = null;
      d.mesh.material.needsUpdate = true;
    }
  };
  const mats = old ? { ...old, textures: {} } : themeMaterials(theme, (name) => { if (name === 'wall') dropDoorArt(); });
  const wallMat = mats.wall;
  const floorMat = mats.floor;
  const ceilMat = lambert(theme.ceil);
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const chunks = new Map();
  const chunkOf = (cx, cy) => {
    const key = `${Math.floor(cx / CHUNK)},${Math.floor(cy / CHUNK)}`;
    if (!chunks.has(key)) {
      const group = new THREE.Group();
      group.userData.center = { x: Math.floor(cx / CHUNK) * CHUNK + CHUNK / 2, y: Math.floor(cy / CHUNK) * CHUNK + CHUNK / 2 };
      group.userData.index = Math.floor(cy / CHUNK) * Math.ceil(map.w / CHUNK) + Math.floor(cx / CHUNK);
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
  propSet(props, map.lockers, LOCKER.w, LOCKER.h, LOCKER.d, mats.locker);
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

  const { lightMat, counts } = addDecor(scene, map, k, wallMat, theme.decor);
  const lightColor = new THREE.Color(theme.lightColor);
  const flow = theme.floor.flow;
  let lightLevel = -1;
  const doors = map.locks.map((c, i) => addShutter(props, c, map, DOOR_COLORS[i], wallMat));
  const rising = [];
  let lastT = 0;

  // 구역 그리기 여부는 칸마다 한 번 계산해 둔다. 문이 열리면 지운다
  const sight = new Map();
  let shownCell = -1;
  const sightFrom = (index, viewCells) => {
    if (!sight.has(index)) {
      const seen = new Set();
      chunksInSight(map, { cx: index % map.w, cy: Math.floor(index / map.w) }, viewCells, CHUNK, (n) => seen.add(n));
      sight.set(index, seen);
    }
    return sight.get(index);
  };

  // 퓨즈와 열쇠: 어둠 속에서 찾을 수 있게 스스로 살짝 빛난다
  const pickup = (c, geometry, color, group = props) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));
    mesh.position.set((c.cx + 0.5) * CELL, 0.75, (c.cy + 0.5) * CELL);
    mesh.rotation.z = Math.PI / 2;
    group.add(mesh);
    return mesh;
  };
  const addFuses = (fuses) => fuses.map((c) => pickup(c, new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8), 0xffc040));
  const addKeys = (keys) => keys.map((c) => pickup(c, new THREE.BoxGeometry(0.1, 0.34, 0.04), DOOR_COLORS[c.lock]));
  // 쪽지는 바닥에 떨어진 종이 한 장이다. 어느 쪽에서 봐도 납작해지지 않는다.
  // 구역에 넣어서 벽 너머에 있으면 같이 그리지 않는다. spots: horrorNotes 의 자리 (칸 가운데 좌표)
  const addNotes = (spots) => spots.map((s, i) => {
    const c = { cx: Math.floor(s.x), cy: Math.floor(s.y) };
    const mesh = pickup(c, new THREE.BoxGeometry(NOTE.w, 0.012, NOTE.h), NOTE.color, chunkOf(c.cx, c.cy));
    mesh.position.y = NOTE.y;
    mesh.rotation.set(0, NOTE.turn * i, 0);
    return mesh;
  });

  return {
    addFuses,
    addKeys,
    addNotes,
    dropDoorArt,
    counts,
    // 문을 열면 눈길이 달라지니 계산해 둔 구역도 버린다
    openDoor(i) {
      rising.push(doors[i]);
      sight.clear();
      shownCell = -1;
    },
    lightMat,
    textures: Object.values(mats.textures),
    // 전원이 켜지면 전원은 초록으로, 정문은 밝게 바뀐다
    setPowered() {
      glow(panelMat, 0x20c040, 0.8);
      glow(gateMat, 0xffc040, 0.7);
    },
    // t: 놀이 시간 (초). 일시정지 때는 비상등도 멈춘다
    update(p, viewCells, t, lowFx) {
      const index = Math.floor(p.y) * map.w + Math.floor(p.x);
      if (index !== shownCell) {
        shownCell = index;
        const seen = sightFrom(index, viewCells);
        for (const group of chunks.values()) group.visible = seen.has(group.userData.index);
      }
      const dt = t - lastT;
      lastT = t;
      for (let i = rising.length - 1; i >= 0; i--) {
        const d = rising[i];
        d.t += dt;
        d.mesh.position.y = WALL_H / 2 + WALL_H * Math.min(1, d.t / DOOR.sec);
        if (d.t >= DOOR.sec) {
          d.mesh.visible = false;
          rising.splice(i, 1);
        }
      }
      const level = emergencyGlow(t, lowFx, k);
      if (level !== lightLevel) {
        lightLevel = level;
        lightMat.color.copy(lightColor).multiplyScalar(level);
      }
      if (flow && !lowFx) mats.textures.floor.offset.set(t * flow[0], t * flow[1]);
    },
  };
}
