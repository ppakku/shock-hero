// 호러워드가 벽 속을 지나갈 때 벽이 떨리고 몸 모양으로 불룩 튀어나온다.
// 벽은 인스턴스로 한꺼번에 그려서 한 칸만 휠 수 없으므로, 곁의 벽 칸마다 같은 그림의 잘게 나눈 상자를 덧씌워 휜다.
import * as THREE from 'three';
import { CELL, wallAt } from '../logic/horrorGrid.js';

const WALL_H = 3;
const POOL = 4; // 몸 곁의 벽 칸은 많아야 넷이다
const SEG = 20; // 벽 한 면을 나누는 수
const SEG_Y = 16;
const PROUD = 0.02; // 덧씌운 상자가 벽보다 큰 만큼 (미터)
const PUSH = 1; // 가장 많이 튀어나오는 길이 (미터)
const OUT = 0.5; // 몸이 벽 밖으로 이만큼 나오면 벽이 제자리로 돌아간다 (미터)
const DEEP = 3.3; // 벽 속 이만큼 깊이 들어가면 겉으로 드러나지 않는다 (미터). 벽 한 칸보다 커서 들어가자마자 맞은편이 부푼다
// 그림의 머리와 옷자락 몸 크기로 튀어나온다 (미터). 몸은 아래로 갈수록 넓다
const HEAD = { y: 2.1, ry: 0.62, r: 0.5 };
const BODY = { top: 1.65, topR: 0.34, bottomR: 0.8 };
const JITTER = 0.022; // 벽이 떨리는 폭 (미터)
const THROB = 0.14; // 튀어나온 곳이 꿈틀대는 비율
const THROB_RATE = 24;
const RIM_DARK = 0.88; // 윤곽을 따라 생기는 그늘의 세기
const RIM_AT = 0.3; // 그늘이 가장 진한 자리 (0 은 벽, 1 은 꼭대기)
const RIM_WIDTH = 0.26;
const CROWN_LIGHT = 0.45; // 꼭대기가 밝아지는 세기

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 벽 면을 따라 잰 자리(t)와 높이(y)에서 몸 모양이 얼마나 미는지 (0~1). 꼭대기는 판판하고 가장자리가 가파르다
export function bodyShape(t, y) {
  const head = (t / HEAD.r) ** 2 + ((y - HEAD.y) / HEAD.ry) ** 2;
  const low = clamp01(y / BODY.top);
  const across = (t / (BODY.bottomR + (BODY.topR - BODY.bottomR) * low)) ** 2;
  const body = y <= BODY.top ? across : across + ((y - BODY.top) / 0.25) ** 2;
  return Math.exp(-(Math.min(head, body) ** 2));
}

// 몸이 벽 면 뒤로 depth 미터 들어가 있을 때 미는 세기 (0~1). 표면 가까이에서 가장 세다
export function pushAt(depth) {
  return clamp01((depth + OUT) / OUT) * Math.sqrt(clamp01((DEEP - depth) / DEEP)); // 멀리서도 일찍 부풀기 시작한다
}

export class WallBulge {
  // wallMaterial: 벽 재질. 그림이 나중에 끼워져도 따라간다
  constructor(scene, map, wallMaterial) {
    this.map = map;
    this.source = wallMaterial;
    this.time = 0;
    this.meshes = [];
    // 벽 그림은 스스로 빛나서 빛으로는 굴곡이 안 보인다. 그래서 점마다 칠한 밝기를 마지막 색에 곱한다
    const material = wallMaterial.clone();
    material.vertexColors = true;
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight *= vColor.rgb;\n#include <opaque_fragment>');
    };
    this.material = material;
    for (let i = 0; i < POOL; i++) {
      const geo = new THREE.BoxGeometry(CELL + PROUD, WALL_H, CELL + PROUD, SEG, SEG_Y, SEG);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), CELL * 1.2); // 휘어도 다시 재지 않는다
      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = true;
      mesh.visible = false;
      mesh.userData.base = geo.attributes.position.array.slice();
      mesh.userData.normal = geo.attributes.normal.array.slice();
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
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
    this.followArt();
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

  followArt() {
    const { source: from, material: to } = this;
    if (to.map === from.map && to.emissiveMap === from.emissiveMap) return;
    to.map = from.map;
    to.emissiveMap = from.emissiveMap;
    to.emissive.copy(from.emissive);
    to.emissiveIntensity = from.emissiveIntensity;
    to.color.copy(from.color);
    to.needsUpdate = true;
  }

  // 윤곽을 따라 그늘을 칠하고 꼭대기를 밝힌다
  paint(mesh) {
    const { lift } = mesh.userData;
    const color = mesh.geometry.attributes.color;
    for (let v = 0; v < lift.length; v++) {
      const rim = Math.exp(-(((lift[v] - RIM_AT) / RIM_WIDTH) ** 2)) * Math.min(1, lift[v] * 12);
      const shade = (1 - RIM_DARK * rim) * (1 + CROWN_LIGHT * lift[v] ** 3);
      color.setXYZ(v, shade, shade, shade);
    }
    color.needsUpdate = true;
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
    const lift = (mesh.userData.lift ??= new Float32Array(a.length / 3));
    lift.fill(0);
    for (let i = 0; i < a.length; i += 3) {
      const face = faces.find((f) => f.nx === normal[i] && f.nz === normal[i + 2]);
      if (!face?.power) continue;
      const t = face.nx ? base[i + 2] + middleZ - mz : base[i] + middleX - mx;
      const shape = face.power * bodyShape(t, base[i + 1] + WALL_H / 2);
      const push = PUSH * throb * shape;
      lift[i / 3] = shape;
      a[i] += face.nx * push;
      a[i + 2] += face.nz * push;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    this.paint(mesh);
    return true;
  }
}
