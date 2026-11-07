// 수영장 물 3D: 물 표면, 풀 가장자리, 물결, 수건 걸이, 고무오리. 물 깊이는 map.water 를 읽는다.
// 물 표면이 바닥 높이에 덮여서 물속에 가라앉은 물괴물은 보이지 않고 물결만 보인다
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';
import { waterAt, DRY, PUDDLE, SHALLOW, DEEP } from '../logic/horrorWater.js';
import { artLoader, loadArt } from './art.js';

const SURFACE = {
  [PUDDLE]: { y: 0.012, color: 0xd8eef8, opacity: 0.4, size: 0.86 },
  [SHALLOW]: { y: 0.02, color: 0xa8e4f2, opacity: 0.92, size: 1 },
  [DEEP]: { y: 0.02, color: 0x58b8d4, opacity: 0.96, size: 1 },
};
const RIM = { w: 0.28, h: 0.05, color: 0xf4f6f8 }; // 풀 가장자리 흰 돌 (미터)
const RINGS = 14; // 동시에 퍼지는 물결 수
const RING_LIFE = 1.3; // 물결 하나가 퍼져 사라지는 시간 (초)
const RING_SIZE = 1.8; // 다 퍼진 물결 반지름 (미터)
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DUCK_SIZE = 0.42; // 고무오리 그림 크기 (미터)
const CHAIR = { w: 1.6, h: 2.6 }; // 감시원 의자 그림 크기 (미터)
const TOWEL = { w: 0.9, h: 1.6 }; // 수건 걸이 그림 크기 (미터)

export function buildWater(scene, map) {
  const group = new THREE.Group();
  scene.add(group);
  const loader = artLoader();
  const textures = [];
  const place = new THREE.Object3D();
  const cells = { [PUDDLE]: [], [SHALLOW]: [], [DEEP]: [] };
  for (let cy = 0; cy < map.h; cy++) for (let cx = 0; cx < map.w; cx++) {
    const level = waterAt(map, cx, cy);
    if (level > DRY) cells[level].push({ cx, cy });
  }

  // 얕은 물과 깊은 물은 풀 바닥 타일이 비쳐 보인다. 그림을 못 받으면 물 색만 남는다
  const pools = [];
  for (const level of [PUDDLE, SHALLOW, DEEP]) {
    const list = cells[level];
    if (!list.length) continue;
    const s = SURFACE[level];
    const mat = new THREE.MeshPhongMaterial({ color: s.color, transparent: true, opacity: s.opacity, shininess: 140, specular: 0xffffff, depthWrite: level !== PUDDLE });
    if (level !== PUDDLE) pools.push(mat);
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(CELL * s.size, CELL * s.size), mat, list.length);
    list.forEach((c, i) => {
      place.position.set((c.cx + 0.5) * CELL, s.y, (c.cy + 0.5) * CELL);
      place.rotation.set(-Math.PI / 2, 0, level === PUDDLE ? (c.cx * 7 + c.cy * 3) % 4 * 0.4 : 0);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    });
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  const bottom = loadArt(loader, 'horror_pool_bottom.jpg', () => {
    bottom.wrapS = bottom.wrapT = THREE.RepeatWrapping;
    bottom.repeat.set(1, 1);
    for (const m of pools) {
      m.map = bottom;
      m.needsUpdate = true;
    }
  });
  if (bottom) textures.push(bottom);

  // 얕은 물이나 깊은 물이 마른 바닥과 닿는 쪽에 흰 가장자리 돌을 놓는다
  const rims = [];
  for (const level of [SHALLOW, DEEP]) {
    for (const c of cells[level]) {
      for (const [dx, dy] of STEPS) {
        if (waterAt(map, c.cx + dx, c.cy + dy) >= SHALLOW || map.rows[c.cy + dy]?.[c.cx + dx] === '#') continue;
        rims.push({ c, dx, dy });
      }
    }
  }
  if (rims.length) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: RIM.color }), rims.length);
    rims.forEach(({ c, dx, dy }, i) => {
      place.position.set((c.cx + 0.5 + dx * 0.5) * CELL - dx * RIM.w / 2, RIM.h / 2, (c.cy + 0.5 + dy * 0.5) * CELL - dy * RIM.w / 2);
      place.rotation.set(0, 0, 0);
      place.scale.set(dx ? RIM.w : CELL, RIM.h, dy ? RIM.w : CELL);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    });
    place.scale.set(1, 1, 1);
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // 물결: 고리가 퍼지며 옅어진다. 미리 만들어 두고 돌려 쓴다
  const ringGeo = new THREE.RingGeometry(0.82, 1, 32);
  const rings = Array.from({ length: RINGS }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    group.add(m);
    return { m, t: RING_LIFE, power: 1 };
  });
  let next = 0;
  const ripple = (x, y, power = 1) => {
    const r = rings[next];
    next = (next + 1) % RINGS;
    r.t = 0;
    r.power = power;
    r.m.position.set(x * CELL, 0.03, y * CELL);
    r.m.visible = true;
  };

  // 수건 걸이: 서 있는 봉에 파란 수건이 걸려 있다. 쓰면 수건만 사라진다
  const towelMat = new THREE.MeshLambertMaterial({ color: 0x5aa8d8 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd0 });
  const towelSprite = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.2 });
  const towels = (map.towels ?? []).map((c) => {
    const g = new THREE.Group();
    g.position.set((c.cx + 0.5) * CELL, 0, (c.cy + 0.5) * CELL);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), poleMat);
    pole.position.y = 0.75;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), poleMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.45;
    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.06), towelMat);
    towel.position.y = 1.05;
    towel.castShadow = true;
    const sprite = new THREE.Sprite(towelSprite);
    sprite.scale.set(TOWEL.w, TOWEL.h, 1);
    sprite.position.y = TOWEL.h / 2;
    sprite.visible = false;
    g.add(pole, bar, towel, sprite);
    group.add(g);
    return { towel, sprite, used: false };
  });
  // Gemini 수건 걸이 그림을 받으면 그림을 띄운다. 쓴 걸이는 봉만 남는다
  const towelArt = loadArt(loader, 'horror_pool_towel.webp', () => {
    towelSprite.map = towelArt;
    towelSprite.needsUpdate = true;
    for (const t of towels) {
      t.towel.visible = false;
      t.sprite.visible = !t.used;
      t.sprite.parent.children.forEach((m) => { if (m !== t.sprite && m !== t.towel) m.visible = t.used; });
    }
  });
  if (towelArt) textures.push(towelArt);

  // 빈 감시원 의자: 늘 주인공 쪽을 보는 그림 한 장. 그림을 못 받으면 없다
  const chairMat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.2 });
  const chairs = (map.chairs ?? []).map((c) => {
    const sprite = new THREE.Sprite(chairMat);
    sprite.scale.set(CHAIR.w, CHAIR.h, 1);
    sprite.position.set((c.cx + 0.5) * CELL, CHAIR.h / 2, (c.cy + 0.5) * CELL);
    sprite.visible = false;
    group.add(sprite);
    return sprite;
  });
  const chairArt = loadArt(loader, 'horror_pool_chair.webp', () => {
    chairMat.map = chairArt;
    chairMat.needsUpdate = true;
    chairs.forEach((c) => { c.visible = true; });
  });
  if (chairArt) textures.push(chairArt);

  // 고무오리: 노란 몸과 머리, 주황 부리. 물 위에서는 살짝 떠서 흔들린다
  const duckBody = new THREE.SphereGeometry(0.14, 12, 8);
  duckBody.scale(1.25, 0.8, 1);
  const duckHead = new THREE.SphereGeometry(0.08, 10, 8);
  const beak = new THREE.ConeGeometry(0.035, 0.08, 6);
  const yellow = new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0x302000 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xff8a20 });
  const duckSprite = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.2 });
  const ducks = (map.ducks ?? []).map(() => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(duckBody, yellow);
    body.position.y = 0.1;
    const head = new THREE.Mesh(duckHead, yellow);
    head.position.set(0.11, 0.24, 0);
    const b = new THREE.Mesh(beak, orange);
    b.rotation.z = -Math.PI / 2;
    b.position.set(0.21, 0.23, 0);
    const sprite = new THREE.Sprite(duckSprite);
    sprite.scale.set(DUCK_SIZE, DUCK_SIZE, 1);
    sprite.position.y = DUCK_SIZE * 0.42;
    sprite.visible = false;
    g.add(body, head, b, sprite);
    g.userData.shape = [body, head, b];
    g.userData.sprite = sprite;
    group.add(g);
    return g;
  });
  // Gemini 고무오리 그림을 받으면 그림을 띄우고 만든 모양은 숨긴다
  const duckArt = loadArt(loader, 'horror_pool_duck.webp', () => {
    duckSprite.map = duckArt;
    duckSprite.needsUpdate = true;
    for (const d of ducks) {
      d.userData.sprite.visible = true;
      d.userData.shape.forEach((m) => { m.visible = false; });
    }
  });
  if (duckArt) textures.push(duckArt);

  return {
    textures,
    ripple,
    setTowel(i, on) {
      const t = towels[i];
      t.used = !on;
      if (towelSprite.map) {
        t.sprite.visible = on;
        t.sprite.parent.children.forEach((m) => { if (m !== t.sprite && m !== t.towel) m.visible = !on; });
      } else t.towel.visible = on;
    },
    // spot: { cx, cy } 이면 그 칸에 놓고, null 이면 손에 들어서 숨긴다
    setDuck(i, spot) {
      const g = ducks[i];
      g.visible = !!spot;
      if (!spot) return;
      g.userData.wet = waterAt(map, spot.cx, spot.cy) >= SHALLOW;
      g.position.set((spot.cx + 0.5) * CELL, 0, (spot.cy + 0.5) * CELL);
      g.rotation.y = (spot.cx * 5 + spot.cy * 3) % 6;
    },
    update(t, dt) {
      if (bottom) bottom.offset.set(Math.sin(t * 0.6) * 0.012, Math.cos(t * 0.5) * 0.012); // 물이 일렁여 바닥 타일이 흔들려 보인다
      for (const d of ducks) {
        d.position.y = d.userData.wet ? 0.02 + Math.sin(t * 2 + d.rotation.y) * 0.015 : 0;
        d.rotation.z = d.userData.wet ? Math.sin(t * 1.6 + d.rotation.y) * 0.08 : 0;
      }
      for (const r of rings) {
        if (!r.m.visible) continue;
        r.t += dt;
        const f = r.t / RING_LIFE;
        if (f >= 1) {
          r.m.visible = false;
          continue;
        }
        const s = 0.2 + f * RING_SIZE * r.power;
        r.m.scale.set(s, s, s);
        r.m.material.opacity = (1 - f) * 0.55;
      }
    },
  };
}
