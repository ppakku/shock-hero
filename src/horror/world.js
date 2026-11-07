// 맵 건물 3D. 7칸 묶음(구역)으로 나눠서 먼 구역은 통째로 그리지 않는다. 생김새는 맵 파일의 theme 이 정한다.
import * as THREE from 'three';
import { CELL, chunksInSight, frontOf } from '../logic/horrorGrid.js';
import { decorSpots, emergencyGlow } from '../logic/horrorDecor.js';
import { artLoader, loadArt, faceBox, bandBox, piecesBox } from './art.js';
import { addTrees, addBushes, addHollowTrees, addGateCard, addOutdoorDecor, addSky } from './forest3d.js';

const CHUNK = 7; // 구역 한 변의 칸 수
const WALL_H = 3;
const LOCKER = { w: 1.3, h: 2.2, d: 1.1 };
const DOOR = { d: 0.3, sec: 1.2 }; // 잠긴 문 두께 (미터), 천장으로 말려 올라가는 시간 (초)
const CLUE_COLOR = 0xe02828;
const NOTE = { w: 0.4, h: 0.55, color: 0xe8dcc0, y: 0.03, turn: 1.1 }; // 쪽지 크기 (미터), 색, 바닥에서 높이 (미터), 자리마다 돌아가는 각도 (라디안)
const LIGHT_EDGE = 0.04; // 등의 옆면과 위아래에 쓰는 그림 맨 위 띠 (틀 부분)
const DOOR_COLORS = [0xd83828, 0x2868e0]; // 열쇠와 같은 색. map.locks 순서
const LOCK_NAMES = ['red', 'blue']; // 그림 파일 이름. map.locks 순서

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const place = new THREE.Object3D();

// 물건이 서는 자리. 보통은 칸 가운데, front 를 주면 (숲) 길 쪽 칸 끝에 길을 보고 선다: 덤불 뒤에 묻히지 않게
function spotOf(cell, d, front) {
  if (!front) return { x: (cell.cx + 0.5) * CELL, z: (cell.cy + 0.5) * CELL, yaw: 0 };
  const dx = front.cx - cell.cx;
  const dy = front.cy - cell.cy;
  const out = CELL / 2 - d / 2 - 0.1;
  return { x: (cell.cx + 0.5) * CELL + dx * out, z: (cell.cy + 0.5) * CELL + dy * out, yaw: Math.atan2(dx, dy) };
}

function prop(group, cell, w, h, d, material, front = null) {
  const mesh = new THREE.Mesh(faceBox(w, h, d), material);
  const s = spotOf(cell, d, front);
  mesh.position.set(s.x, h / 2, s.z);
  mesh.rotation.y = s.yaw;
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

// 같은 모양 여러 개를 한 번에 그린다
function propSet(group, cells, w, h, d, material, fronts = null) {
  const mesh = new THREE.InstancedMesh(faceBox(w, h, d), material, cells.length);
  cells.forEach((c, i) => {
    const s = spotOf(c, d, fronts?.[i]);
    place.position.set(s.x, h / 2, s.z);
    place.rotation.set(0, s.yaw, 0);
    place.scale.set(1, 1, 1);
    place.updateMatrix();
    mesh.setMatrixAt(i, place.matrix);
  });
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
  place.rotation.set(0, f.dx ? Math.PI / 2 : 0, 0); // 돌려 세워서 그림 앞면이 늘 방 쪽을 본다
  place.scale.set(w, h, d);
  place.updateMatrix();
  mesh.setMatrixAt(i, place.matrix);
}

// 잠긴 문은 말려 올라가는 셔터다. 양옆이 벽인 쪽으로 세운다
function addShutter(group, c, map, color, art) {
  const mat = new THREE.MeshLambertMaterial({ color, map: art.map, emissive: color, emissiveIntensity: 0.12 }); // 그림에 색만 입힌다
  const across = map.rows[c.cy][c.cx - 1] === '#'; // 왼쪽이 벽이면 x 를 따라 놓는다
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(across ? CELL : DOOR.d, WALL_H, across ? DOOR.d : CELL), mat);
  mesh.position.set((c.cx + 0.5) * CELL, WALL_H / 2, (c.cy + 0.5) * CELL);
  mesh.castShadow = true;
  group.add(mesh);
  return { mesh, t: 0 };
}

// 빛을 받는 물건에 그림을 입힌다. 못 받으면 부르지 않아 원래 색 그대로다
function paintPlain(mat, tex, tint = 0xffffff) {
  mat.map = tex;
  mat.color.setHex(tint);
  mat.needsUpdate = true;
}

// 벽 등, 벽에 붙은 큰 물건, 배관. 전부 벽에 붙어 있고 종류마다 한 번에 그린다
function addDecor(scene, map, k, mats, decor, tiled) {
  const { wall: wallMat, board: boardMat } = mats;
  const { light, machine, pipe, low, lintel } = decor;
  const spots = decorSpots(map, decor.tile);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const group = new THREE.Group();
  scene.add(group);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lights = new THREE.InstancedMesh(bandBox(LIGHT_EDGE), lightMat, spots.lights.length);
  spots.lights.forEach((f, i) => setOnWall(lights, i, f, light.w, light.h, light.d, light.y));

  const machines = new THREE.InstancedMesh(box, boardMat || wallMat, spots.machines.length);
  const tints = machine.tints.map((c) => new THREE.Color(c));
  spots.machines.forEach((f, i) => {
    const h = machine.h[i % machine.h.length];
    setOnWall(machines, i, f, machine.w[i % machine.w.length], h, machine.depth ?? k.machineDepth, machine.y + h / 2);
    machines.setColorAt(i, tints[i % tints.length]);
  });
  machines.castShadow = true;
  machines.receiveShadow = true;

  const pipeGeo = new THREE.CylinderGeometry(pipe.r, pipe.r, CELL, 6, 1, true);
  const pipeMat = lambert(pipe.color);
  tiled(`${pipe.art}.jpg`, 1, pipe.repeat, (tex) => paintPlain(pipeMat, tex, pipe.tint));
  const pipes = new THREE.InstancedMesh(pipeGeo, pipeMat, spots.pipes.length * pipe.ys.length);
  spots.pipes.forEach((f, i) => pipe.ys.forEach((y, j) => {
    place.position.set(faceX(f) - f.dx * pipe.off, y, faceZ(f) - f.dy * pipe.off);
    place.rotation.set(f.dx ? Math.PI / 2 : 0, 0, f.dx ? 0 : Math.PI / 2); // 벽과 나란히 눕힌다
    place.scale.set(1, 1, 1);
    place.updateMatrix();
    pipes.setMatrixAt(i * pipe.ys.length + j, place.matrix);
  }));

  const meshes = [lights, machines, pipes];
  if (low) {
    const lowMat = lambert(low.color);
    tiled(`${low.art}.jpg`, 1, 1, (tex) => paintPlain(lowMat, tex, low.tint));
    const lows = new THREE.InstancedMesh(piecesBox(low.parts), lowMat, spots.lows.length);
    spots.lows.forEach((f, i) => setOnWall(lows, i, f, low.w, low.h, low.d, low.h / 2));
    meshes.push(lows);
  }
  if (lintel) {
    const doors = [];
    map.rows.forEach((row, cy) => [...row].forEach((ch, cx) => { if (ch === 'D') doors.push({ cx, cy }); }));
    const tops = new THREE.InstancedMesh(box, wallMat, doors.length);
    doors.forEach((c, i) => {
      place.position.set((c.cx + 0.5) * CELL, WALL_H - lintel.h / 2, (c.cy + 0.5) * CELL);
      place.rotation.set(0, 0, 0);
      place.scale.set(CELL, lintel.h, CELL);
      place.updateMatrix();
      tops.setMatrixAt(i, place.matrix);
    });
    meshes.push(tops);
  }
  for (const mesh of meshes) {
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
    const { art, plain, repeat, repeatY = repeat, tint = 0xffffff, shiny } = theme[name];
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
    tex.repeat.set(repeat, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    textures[name] = tex;
    return mat;
  };
  // 숲의 고목은 알파 그림 한 장이라 여기서 받지 않는다 (forest3d.addHollowTrees)
  return { wall: make('wall'), floor: make('floor'), locker: theme.locker.card ? null : make('locker'), board: theme.board && make('board'), textures };
}

// lowFx: 효과 줄이기. 숲은 덤불을 한 겹만 세운다
export function buildWorld(scene, map, k, theme, { lowFx = false } = {}) {
  const outdoor = !!theme.outdoor;
  // 문 그림을 못 받으면 셔터도 그림을 버린다. 안 그러면 까맣게 나와서 문 색을 알 수 없다
  const doorPart = theme.doorArt || 'wall';
  const dropDoorArt = () => {
    for (const d of doors) {
      if (d.ownArt) continue;
      d.mesh.material.map = null;
      d.mesh.material.needsUpdate = true;
    }
  };
  const mats = themeMaterials(theme, (name) => { if (name === doorPart) dropDoorArt(); });
  const loader = artLoader();
  const textures = Object.values(mats.textures);
  // 새 그림을 받아 끼운다. 못 받으면 ready 가 불리지 않아 지금 모습 그대로다
  const art = (file, ready) => {
    const tex = loadArt(loader, file, () => ready(tex));
    if (tex) textures.push(tex);
  };
  // 되풀이해서 까는 그림. 받은 뒤 가로 x 번, 세로 y 번 되풀이한다
  const tiled = (file, x, y, ready) => art(file, (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(x, y);
    ready(tex);
  });
  const wallMat = mats.wall;
  const floorMat = mats.floor;
  // 바깥 맵은 천장이 없다 (하늘 돔이 덮는다)
  const ceilMat = outdoor ? null : lambert(theme.ceil);
  if (!outdoor) {
    const { art: ceilArt, repeat: ceilRepeat, tint: ceilTint } = theme.ceilArt;
    tiled(`${ceilArt}.jpg`, ceilRepeat, ceilRepeat, (tex) => paintPlain(ceilMat, tex, ceilTint));
  }
  let bushMat = null;
  if (outdoor) {
    bushMat = new THREE.MeshLambertMaterial({ color: 0xffffff, alphaTest: 0.5, side: THREE.DoubleSide, visible: false });
    art(`${theme.trees.bush.art}.webp`, (tex) => {
      bushMat.map = tex;
      bushMat.visible = true;
      bushMat.needsUpdate = true;
    });
  }
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
    if (outdoor) addBushes(group, map, walls, theme.trees.bush, bushMat, lowFx);
    else if (walls.length) {
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
    group.add(floor);
    if (outdoor) continue;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(x * CELL, WALL_H, y * CELL);
    group.add(ceil);
  }
  if (outdoor) addTrees(scene, map, theme.trees, wallMat, art);
  const sky = outdoor && theme.sky ? addSky(scene, theme.sky, art) : null;

  const props = new THREE.Group();
  scene.add(props);
  if (theme.locker.card) addHollowTrees(props, map, theme.locker.card, `${theme.locker.art}.webp`, art);
  else {
    const locker = theme.locker.box || LOCKER;
    propSet(props, map.lockers, locker.w, locker.h, locker.d, mats.locker);
  }
  const boxMat = lambert(0x3a4a6a);
  const frontFor = (c) => (outdoor ? frontOf(map, c) : null); // 숲은 칸 둘레가 덤불이라 길 쪽으로 내놓는다
  propSet(props, map.boxes, 0.9, 1.5, 0.5, boxMat, map.boxes.map(frontFor));
  const panelMat = lambert(0x6a3a2a);
  const gateMat = lambert(0x7a6a30);
  prop(props, map.panel, 1.2, 1.7, 0.6, panelMat, frontFor(map.panel));
  if (theme.gate) addGateCard(props, map, theme.gate, gateMat);
  else prop(props, map.gate, CELL, WALL_H, CELL, gateMat);

  // 어둠 속에서도 찾을 수 있게 전기 상자, 전원, 정문은 살짝 빛낸다
  const glow = (m, color, power) => {
    m.emissive.setHex(color);
    m.emissiveIntensity = power * (m.emissiveMap ? k.art.lift : 1);
  };
  glow(boxMat, 0x3060c0, 0.5);
  glow(panelMat, 0xc03020, 0.6);
  glow(gateMat, 0x402808, 0.5);
  // 그림을 받으면 색을 빼고, 빛도 그림 모양대로 나게 한다
  const paint = (m, tex, lift = k.art.lift) => {
    m.map = tex;
    m.emissiveMap = tex;
    m.emissiveIntensity *= lift;
    m.color.setHex(0x8a8a8a); // 가까이서 손전등에 하얗게 날아가지 않게 누른다
    m.needsUpdate = true;
  };
  art('horror_box.jpg', (tex) => paint(boxMat, tex));
  art('horror_panel.jpg', (tex) => paint(panelMat, tex));
  art(theme.gate ? `${theme.gate.art}.webp` : 'horror_gate.jpg', (tex) => paint(gateMat, tex));

  // 바깥 맵은 벽 등, 관, 기계 대신 숲 장식이다. 등이 없으니 비상등 재질은 아무 데도 쓰지 않는 빈 재질이다
  const { lightMat, counts } = theme.decor.outdoor
    ? { lightMat: new THREE.MeshBasicMaterial(), counts: addOutdoorDecor(scene, map, theme.decor, art).counts }
    : addDecor(scene, map, k, mats, theme.decor, tiled);
  const lightColor = new THREE.Color(theme.lightColor);
  const flow = theme.floor.flow;
  let lightLevel = -1;
  // 등 그림에는 제 색이 있다. 색을 입히면 비상구의 흰 글자가 초록에 묻혀서 밝기만 남긴다
  if (theme.decor.light) art(`${theme.decor.light.art}.jpg`, (tex) => {
    lightMat.map = tex;
    lightMat.needsUpdate = true;
    lightColor.setHex(0xffffff);
    lightLevel = -1;
  });
  const doors = map.locks.map((c, i) => addShutter(props, c, map, DOOR_COLORS[i], mats[doorPart]));
  doors.forEach((d, i) => art(`${theme.doorSet}_${LOCK_NAMES[i]}.jpg`, (tex) => {
    d.ownArt = true;
    paint(d.mesh.material, tex, 1);
  }));
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
  // 그림을 받으면 물건마다 어디서 봐도 정면인 그림을 띄우고 3D 모양은 그리지 않는다
  const wear = (meshes, file, size) => {
    const mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.1 });
    mat.color.setScalar(k.art.glow); // 어둠 속에서 찾을 수 있게 그림보다 밝게 그린다
    const sprites = meshes.map((mesh) => {
      const s = new THREE.Sprite(mat);
      s.scale.set(size, size, 1);
      s.visible = false;
      mesh.add(s);
      return s;
    });
    art(file, (tex) => {
      mat.map = tex;
      mat.needsUpdate = true;
      sprites.forEach((s) => { s.visible = true; });
      meshes.forEach((m) => { m.material.visible = false; });
    });
    return meshes;
  };
  const addFuses = (fuses) => wear(fuses.map((c) => pickup(c, new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8), 0xffc040)), 'horror_fuse.webp', k.art.fuse);
  const addKeys = (keys) => {
    const meshes = keys.map((c) => pickup(c, new THREE.BoxGeometry(0.1, 0.34, 0.04), DOOR_COLORS[c.lock]));
    LOCK_NAMES.forEach((name, lock) => wear(meshes.filter((_, i) => keys[i].lock === lock), `horror_key_${name}.webp`, k.art.key));
    return meshes;
  };
  const paintPapers = (meshes, file) => art(file, (tex) => meshes.forEach((m) => paintPlain(m.material, tex)));
  // 쪽지는 바닥에 떨어진 종이 한 장이다. 어느 쪽에서 봐도 납작해지지 않는다.
  // 구역에 넣어서 벽 너머에 있으면 같이 그리지 않는다. spots: horrorNotes 의 자리 (칸 가운데 좌표)
  const addNotes = (spots) => {
    const meshes = spots.map((s, i) => {
      const c = { cx: Math.floor(s.x), cy: Math.floor(s.y) };
      const mesh = pickup(c, new THREE.BoxGeometry(NOTE.w, 0.012, NOTE.h), NOTE.color, chunkOf(c.cx, c.cy));
      mesh.position.y = NOTE.y;
      mesh.rotation.set(0, NOTE.turn * i, 0);
      return mesh;
    });
    paintPapers(meshes, 'horror_note.jpg');
    return meshes;
  };

  // 정문 번호 단서: 평범한 쪽지와 달리 붉고 어둠 속에서도 눈에 띈다
  const addClues = (spots) => {
    const meshes = spots.map((c, i) => {
      const mesh = pickup(c, new THREE.BoxGeometry(NOTE.w, 0.012, NOTE.h), CLUE_COLOR, chunkOf(c.cx, c.cy));
      mesh.position.y = NOTE.y;
      mesh.rotation.set(0, NOTE.turn * i, 0);
      return mesh;
    });
    paintPapers(meshes, 'horror_clue.jpg');
    return meshes;
  };

  return {
    wallMaterial: wallMat,
    addFuses,
    addKeys,
    addNotes,
    addClues,
    counts,
    // 문을 열면 눈길이 달라지니 계산해 둔 구역도 버린다
    openDoor(i) {
      rising.push(doors[i]);
      sight.clear();
      shownCell = -1;
    },
    lightMat,
    textures,
    // 전원이 켜지면 전원은 초록으로, 정문은 밝게 바뀐다
    setPowered() {
      glow(panelMat, 0x20c040, 0.8);
      glow(gateMat, 0xffc040, 0.7);
    },
    // 숲: 해 질 녘 색을 하늘 돔에 입힌다 (HorrorGame.tickDusk). 돔이 없으면 아무것도 하지 않는다
    setSky(d) {
      sky?.setDusk(d);
    },
    hasSky: () => !!sky?.mesh.visible,
    // t: 놀이 시간 (초). 일시정지 때는 비상등도 멈춘다
    update(p, viewCells, t, lowFx) {
      sky?.follow(p.x * CELL, p.y * CELL);
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
        d.mesh.position.y = WALL_H / 2 + (outdoor ? -1 : 1) * WALL_H * Math.min(1, d.t / DOOR.sec); // 셔터는 천장으로 말려 올라가고, 숲의 울타리 문은 땅으로 꺼진다
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
