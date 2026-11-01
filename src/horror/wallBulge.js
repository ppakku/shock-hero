// 호러워드가 벽 속을 지나갈 때 벽이 떨리고 몸 모양으로 불룩 튀어나온다.
// 벽은 인스턴스로 한꺼번에 그려서 한 칸만 휠 수 없으므로, 곁의 벽 칸마다 같은 그림의 잘게 나눈 상자를 덧씌워 휜다.
import * as THREE from 'three';
import { CELL, wallAt } from '../logic/horrorGrid.js';

const WALL_H = 3;
const POOL = 4; // 몸 곁의 벽 칸은 많아야 넷이다
const SEG = 14; // 벽 한 면을 나누는 수
const SEG_Y = 12;
const PROUD = 0.02; // 덧씌운 상자가 벽보다 큰 만큼 (미터)
const PUSH = 0.62; // 가장 많이 튀어나오는 길이 (미터)
const OUT = 0.5; // 몸이 벽 밖으로 이만큼 나오면 벽이 제자리로 돌아간다 (미터)
const DEEP = 2.4; // 벽 속 이만큼 깊이 들어가면 겉으로 드러나지 않는다 (미터)
const HEAD = { y: 2.25, ry: 0.62, r: 0.42 }; // 그림의 머리와 몸 크기로 튀어나온다 (미터)
const BODY = { y: 1, ry: 1.25, r: 0.5 };
const JITTER = 0.022; // 벽이 떨리는 폭 (미터)
const THROB = 0.14; // 튀어나온 곳이 꿈틀대는 비율
const THROB_RATE = 24;

const bump = (d, r) => Math.exp(-(d * d) / (r * r));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 벽 면을 따라 잰 자리(t)와 높이(y)에서 몸 모양이 얼마나 미는지 (0~1)
export function bodyShape(t, y) {
  return Math.max(bump(t, HEAD.r) * bump(y - HEAD.y, HEAD.ry / 1.6), 0.8 * bump(t, BODY.r) * bump(y - BODY.y, BODY.ry));
}

// 몸이 벽 면 뒤로 depth 미터 들어가 있을 때 미는 세기 (0~1). 표면 가까이에서 가장 세다
export function pushAt(depth) {
  return clamp01((depth + OUT) / OUT) * clamp01((DEEP - depth) / DEEP);
}

export class WallBulge {
  constructor(scene, map, material) {
    this.map = map;
    this.time = 0;
    this.meshes = [];
    for (let i = 0; i < POOL; i++) {
      const geo = new THREE.BoxGeometry(CELL + PROUD, WALL_H, CELL + PROUD, SEG, SEG_Y, SEG);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), CELL * 1.2); // 휘어도 다시 재지 않는다
      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = true;
      mesh.visible = false;
      mesh.userData.base = geo.attributes.position.array.slice();
      mesh.userData.normal = geo.attributes.normal.array.slice();
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  get active() {
    return this.meshes.some((m) => m.visible);
  }

  // s 는 칸 좌표의 괴물. 곁의 벽을 몸이 지나는 만큼 휜다
  update(s, dt, lowFx) {
    this.time += dt;
    const shakeX = lowFx ? 0 : (Math.random() - 0.5) * JITTER;
    const shakeZ = lowFx ? 0 : (Math.random() - 0.5) * JITTER;
    const left = Math.floor(s.x - 0.5);
    const top = Math.floor(s.y - 0.5);
    let used = 0;
    for (let cy = top; cy <= top + 1; cy++) {
      for (let cx = left; cx <= left + 1; cx++) {
        if (!wallAt(this.map, cx, cy)) continue;
        const mesh = this.meshes[used];
        if (!this.bend(mesh, cx, cy, s.x * CELL, s.y * CELL, lowFx)) continue;
        mesh.position.set((cx + 0.5) * CELL + shakeX, WALL_H / 2, (cy + 0.5) * CELL + shakeZ);
        mesh.visible = true;
        used += 1;
      }
    }
    for (let i = used; i < POOL; i++) this.meshes[i].visible = false;
  }

  // 사람이 볼 수 있는 면만 민다. 민 곳이 있으면 true
  bend(mesh, cx, cy, mx, mz, lowFx) {
    const open = (x, y) => !wallAt(this.map, x, y);
    const faces = [
      [1, 0, open(cx + 1, cy) ? (cx + 1) * CELL - mx : -1e3],
      [-1, 0, open(cx - 1, cy) ? mx - cx * CELL : -1e3],
      [0, 1, open(cx, cy + 1) ? (cy + 1) * CELL - mz : -1e3],
      [0, -1, open(cx, cy - 1) ? mz - cy * CELL : -1e3],
    ].map(([nx, nz, depth]) => ({ nx, nz, power: pushAt(depth) }));
    if (!faces.some((f) => f.power > 0)) return false;
    const { base, normal } = mesh.userData;
    const pos = mesh.geometry.attributes.position;
    const a = pos.array;
    const middleX = (cx + 0.5) * CELL;
    const middleZ = (cy + 0.5) * CELL;
    const throb = 1 + (lowFx ? 0 : THROB * Math.sin(this.time * THROB_RATE));
    a.set(base);
    for (let i = 0; i < a.length; i += 3) {
      const face = faces.find((f) => f.nx === normal[i] && f.nz === normal[i + 2]);
      if (!face?.power) continue;
      const t = face.nx ? base[i + 2] + middleZ - mz : base[i] + middleX - mx;
      const push = PUSH * face.power * throb * bodyShape(t, base[i + 1] + WALL_H / 2);
      a[i] += face.nx * push;
      a[i + 2] += face.nz * push;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    return true;
  }
}
