// 괴물 모양 만들기: 아이 그림을 따라 달걀 머리, 휜 긴 목, 가늘고 긴 팔다리의 그물을 짠다. 앞은 +Z 다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;

// 다리와 팔 길이 (미터). 그림 비율을 키 2.5m 로 옮긴 값
export const THIGH = 0.46;
export const SHIN = 0.5;
export const ANKLE = 0.13;
export const UPPER_ARM = 0.46;
export const FOREARM = 0.48;
export const SHOULDER = { x: 0.2, y: 0.49 };
export const SPINE_UP = 0.05; // 골반 위 허리 높이
export const NECK_UP = 0.53; // 허리 위 목 뿌리 높이

// 머리 크기와, 얼굴 그림이 덮는 폭과 높이
export const HEAD = { w: 0.38, h: 0.54, d: 0.42, up: 0.22, ahead: 0.1 };
const FACE = { w: 0.42, h: 0.5, chinV: 0.03, chinY: -0.26 };
export const EYE_UV = [[0.283, 0.663], [0.708, 0.663]]; // 그림 속 두 눈의 가운데
export const EYE_R = 0.036;
const NOSE_V = 0.41;
const FRONT_ARC = 1.42; // 얼굴과 가슴 그림이 덮는 둘레 (앞에서 좌우로)
const FLAT_ARC = 1.05; // 얼굴 그림을 곧게 비추는 둘레. 그 밖은 옆면에서 늘어나지 않게 둘레 길이로 잇는다

// 허리에서 어깨까지: [높이, 반폭, 반두께, 앞뒤 치우침]
const TORSO_KEYS = [
  [0.57, 0.03, 0.03, 0],
  [0.55, 0.1, 0.06, -0.01],
  [0.52, 0.185, 0.08, -0.015],
  [0.45, 0.19, 0.105, -0.02],
  [0.34, 0.165, 0.12, -0.02],
  [0.22, 0.15, 0.115, -0.015],
  [0.15, 0.125, 0.09, -0.01],
  [0.09, 0.084, 0.058, 0],
  [0.02, 0.078, 0.052, 0],
  [-0.04, 0.09, 0.06, 0],
];
const PELVIS_KEYS = [
  [0.07, 0.01, 0.01, 0],
  [0.06, 0.08, 0.055, 0],
  [0.02, 0.125, 0.07, 0],
  [-0.03, 0.14, 0.078, -0.005],
  [-0.07, 0.115, 0.07, -0.005],
  [-0.12, 0.07, 0.055, 0],
  [-0.15, 0.01, 0.01, 0],
];
const TORSO_TEX = { v0: 0.11, h: 0.45, w: 0.37, cut: 0.135 };

export const NECK_POINTS = [[-0.05, -0.02], [0.1, -0.05], [0.24, -0.01], [0.36, 0.08], [0.43, 0.14]];

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
const bump = (d, r) => Math.exp(-(d * d) / (r * r));

// 앞뒤 표(keys)에서 높이 y 의 폭과 두께를 읽는다
function sampleKeys(keys, y) {
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (y >= b[0]) {
      const t = smooth((a[0] - y) / (a[0] - b[0]));
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  return keys[keys.length - 1].slice(1);
}

// 표면 함수 at(t, w) 로 그물을 짠다. t 는 위에서 아래로 0~1, w 는 앞(0)에서 오른쪽(+)으로 돈다.
// keep 으로 칸을 골라 같은 표면을 그림 재질과 피부 재질로 나눈다.
function surface({ rows, segs, at, uv, shade = () => 1, keep = () => true }) {
  const pos = [];
  const nor = [];
  const tex = [];
  const col = [];
  const idx = [];
  const e = 0.004;
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const du = new THREE.Vector3();
  const dv = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    for (let s = 0; s <= segs; s++) {
      const t = r / rows;
      const w = (s / segs - 0.5) * TAU;
      at(t, w, p);
      const ts = clamp(t, 0.012, 0.988);
      at(ts + e, w, q);
      at(ts - e, w, du);
      du.subVectors(q, du);
      at(ts, w + e, q);
      at(ts, w - e, dv);
      dv.subVectors(q, dv);
      du.cross(dv);
      if (du.lengthSq() < 1e-14) du.set(0, t < 0.5 ? 1 : -1, 0); // 뚜껑 면
      du.normalize();
      pos.push(p.x, p.y, p.z);
      nor.push(du.x, du.y, du.z);
      const [a, b] = uv(p, t, w);
      tex.push(a, b);
      const c = shade(p, t, w);
      col.push(c, c, c);
    }
  }
  const row = segs + 1;
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < segs; s++) {
      if (!keep((r + 0.5) / rows, ((s + 0.5) / segs - 0.5) * TAU, r, s)) continue;
      const a = r * row + s;
      const b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(tex, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// 얇은 팔다리에는 피부 그림의 밝은 띠만 입힌다 (어두운 띠가 마디처럼 보이지 않게)
const skinUv = (scale = 0.7) => (p, t, w) => [(w / Math.PI) * 0.2, 0.87 + p.y * scale];

// 팔다리 토막: 어깨에서 아래로 뻗는다. radius(t), push(t) 는 굵기와 앞으로 튀어나온 정도.
// 맨 위와 맨 아래 줄은 끝을 납작하게 막는 뚜껑이다 (끝이 뾰족하면 나무 인형처럼 보인다)
export function limb(len, radius, { rows = 8, segs = 6, push = () => 0, shade } = {}) {
  const lid = 1 / (rows + 2);
  return surface({
    rows: rows + 2,
    segs,
    uv: skinUv(),
    shade,
    at: (t, w, out) => {
      const open = t > 0.001 && t < 0.999 ? 1 : 0;
      const k = clamp((t - lid) / (1 - lid * 2), 0, 1);
      const r = radius(k) * open;
      out.set(Math.sin(w) * r, -k * len, Math.cos(w) * r + push(k));
    },
  });
}

// 관절 공: 다음 토막 맨 위에 붙어서 굽혀도 틈이 보이지 않게 한다
export function knob(r, x = 0, y = 0, z = 0) {
  return surface({
    rows: 5,
    segs: 6,
    uv: skinUv(),
    at: (t, w, out) => {
      const a = t * Math.PI;
      out.set(x + Math.sin(w) * Math.sin(a) * r, y + Math.cos(a) * r, z + Math.cos(w) * Math.sin(a) * r);
    },
  });
}

// 두 점을 잇는 뾰족한 뼈 (손가락, 발톱, 등뼈 돌기)
function bone(a, b, ra, rb, c = 1) {
  const from = new THREE.Vector3(...a);
  const dir = new THREE.Vector3(...b).sub(from);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, 4, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(from.x, from.y, from.z);
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(c), 3));
  return g;
}

// 점을 따라 이어지는 손가락 하나. 끝 토막이 어두운 발톱이다
function digit(points, r0) {
  const parts = [];
  const last = points.length - 2;
  for (let i = 0; i <= last; i++) {
    const claw = i === last;
    const ra = lerp(r0, r0 * 0.5, i / last);
    parts.push(bone(points[i], points[i + 1], ra, claw ? 0.0015 : ra * 0.8, claw ? 0.22 : 1));
  }
  return parts;
}

export function handGeometry() {
  const palm = surface({
    rows: 5,
    segs: 6,
    uv: skinUv(),
    at: (t, w, out) => {
      const close = Math.min(1, Math.min(t, 1 - t) * 10 + 0.2);
      out.set(Math.sin(w) * 0.05 * close, -t * 0.13, Math.cos(w) * 0.018 * close);
    },
  });
  const parts = [palm, knob(0.03)];
  // 네 손가락은 부채처럼 벌어지고 손등 쪽(-Z)으로 굽는다
  [[-0.04, -0.016, 0.21], [-0.014, -0.005, 0.26], [0.014, 0.005, 0.26], [0.04, 0.016, 0.22]].forEach(([x, fan, l]) => {
    parts.push(...digit([
      [x, -0.12, 0],
      [x + fan * 2, -0.12 - l * 0.5, -0.008],
      [x + fan * 3.2, -0.12 - l * 0.9, -0.035],
      [x + fan * 4, -0.12 - l * 1.28, -0.095],
    ], 0.0105));
  });
  parts.push(...digit([[0.05, -0.05, 0], [0.085, -0.11, -0.012], [0.1, -0.17, -0.03], [0.105, -0.25, -0.075]], 0.0105));
  return mergeGeometries(parts);
}

export function footGeometry() {
  const heel = limb(0.25, (t) => lerp(0.05, 0.03, t), { rows: 5, segs: 6 });
  heel.rotateX(-Math.PI / 2);
  heel.scale(1, 0.6, 1);
  heel.translate(0, -ANKLE + 0.045, -0.06);
  const parts = [heel, knob(0.036), limb(0.1, () => 0.03, { rows: 3, segs: 6 })];
  const sole = -ANKLE + 0.012;
  [[-0.05, -0.09, 0.23], [-0.018, -0.03, 0.29], [0.018, 0.03, 0.29], [0.05, 0.09, 0.22]].forEach(([x, fan, l]) => {
    parts.push(...digit([
      [x, sole + 0.03, 0.14],
      [x + fan * 0.6, sole + 0.02, 0.14 + l * 0.6],
      [x + fan, sole + 0.012, 0.14 + l],
      [x + fan * 1.35, sole - 0.008, 0.14 + l * 1.42],
    ], 0.017));
  });
  parts.push(...digit([[0, sole + 0.035, -0.02], [0, sole + 0.022, -0.1], [0, sole + 0.012, -0.16], [0, sole - 0.008, -0.24]], 0.019)); // 뒤꿈치 발톱
  return mergeGeometries(parts);
}

// 머리 앞뒤 윤곽
const eggX = (yn) => (yn > -0.1 ? 1 - 0.2 * ((yn + 0.1) / 1.1) : 1 - 0.34 * ((-0.1 - yn) / 0.9) ** 2);
const eggZ = (yn) => 1 - 0.08 * yn;
const skullBack = (yn) => -0.06 * Math.max(0, yn + 0.2) + 0.03 * Math.max(0, -yn - 0.2);

// 코, 눈두덩, 턱의 굴곡. 옆에서 봐도 얼굴이 보이게 한다
function faceRelief(x, y) {
  const noseY = FACE.chinY + (NOSE_V - FACE.chinV) * FACE.h;
  const eyeY = faceY(EYE_UV[0][1]);
  return 0.04 * bump(x, 0.026) * bump(y - noseY, 0.045)
    + 0.016 * bump(x, 0.02) * bump(y - (noseY + eyeY) / 2, 0.08)
    - 0.02 * bump(Math.abs(x) - 0.09, 0.055) * bump(y - eyeY, 0.055)
    + 0.022 * bump(y - (FACE.chinY + 0.08), 0.075);
}

export const faceY = (v) => FACE.chinY + (v - FACE.chinV) * FACE.h;
export const faceX = (u) => (u - 0.5) * FACE.w;

export function headAt(t, w, out) {
  const polar = t * Math.PI;
  const yn = Math.cos(polar);
  const s = Math.sin(polar);
  const x = Math.sin(w) * s * (HEAD.w / 2) * eggX(yn);
  const y = (yn * HEAD.h) / 2;
  const front = Math.max(0, Math.cos(w));
  const z = Math.cos(w) * s * (HEAD.d / 2) * eggZ(yn) + skullBack(yn) + faceRelief(x, y) * front * s;
  return out.set(x, y, z);
}

// 얼굴 위 (x, y) 를 지나는 표면 점. 눈 자리를 정확히 찾을 때 쓴다
export function faceSurface(x, y) {
  const yn = (y * 2) / HEAD.h;
  const polar = Math.acos(yn);
  const s = Math.sin(polar);
  const w = Math.asin(clamp(x / (s * (HEAD.w / 2) * eggX(yn)), -1, 1));
  return { t: polar / Math.PI, w };
}

function faceU(p, t, w) {
  if (Math.abs(w) <= FLAT_ARC) return 0.5 + p.x / FACE.w;
  const side = Math.sign(w);
  const edge = at => 0.5 + side * ((HEAD.w / 2) * eggX(Math.cos(t * Math.PI)) * Math.sin(Math.PI * t) * at) / FACE.w;
  return edge(Math.sin(FLAT_ARC) + Math.cos(FLAT_ARC) * (Math.abs(w) - FLAT_ARC));
}

export function headGeometries() {
  const seam = (t, w) => lerp(0.68, 1, smooth(clamp(Math.abs(Math.abs(w) - FRONT_ARC) / 0.5, 0, 1)));
  const front = (t, w) => Math.abs(w) < FRONT_ARC;
  const rows = 22;
  const segs = 30;
  const face = surface({
    rows,
    segs,
    at: headAt,
    keep: front,
    shade: seam,
    uv: (p, t, w) => [faceU(p, t, w), FACE.chinV + (p.y - FACE.chinY) / FACE.h],
  });
  const back = surface({
    rows,
    segs,
    at: headAt,
    keep: (t, w) => !front(t, w),
    shade: seam,
    uv: (p, t, w) => [0.5 + w / TAU, p.y * 1.4],
  });
  return { face, back };
}

// 눈 빛: 가운데를 비워 그린 눈동자가 보이고, 가장자리는 어둠으로 녹아든다
export function eyeGeometry() {
  const g = new THREE.RingGeometry(0.16, 1, 14, 3);
  const p = g.attributes.position;
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    const c = r < 0.2 ? 0 : 1 - smooth(clamp((r - 0.6) / 0.4, 0, 1));
    colors.push(c, c, c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

export function torsoGeometries() {
  const top = TORSO_KEYS[0][0];
  const bottom = TORSO_KEYS[TORSO_KEYS.length - 1][0];
  const at = (t, w, out) => {
    const y = lerp(top, bottom, t);
    const [hw, hd, cz] = sampleKeys(TORSO_KEYS, y);
    return out.set(Math.sin(w) * hw, y, Math.cos(w) * hd + cz);
  };
  const front = (t, w) => Math.abs(w) < FRONT_ARC && lerp(top, bottom, t) > TORSO_TEX.cut;
  const shade = (p, t, w) => {
    const edge = Math.abs(Math.abs(w) - FRONT_ARC);
    const low = Math.abs(p.y - TORSO_TEX.cut);
    return lerp(0.5, 1, clamp(Math.min(edge / 0.35, low / 0.05 + (Math.abs(w) > 1.45 ? 1 : 0)), 0, 1));
  };
  const rows = 22;
  const segs = 18;
  const chest = surface({
    rows,
    segs,
    at,
    keep: front,
    shade,
    uv: (p) => [0.5 + p.x / TORSO_TEX.w, (p.y - TORSO_TEX.v0) / TORSO_TEX.h],
  });
  const skin = surface({
    rows,
    segs,
    at,
    keep: (t, w) => !front(t, w),
    shade,
    uv: (p, t, w) => [0.5 + w / TAU, p.y * 1.4],
  });
  // 등에 튀어나온 등뼈 돌기
  const spikes = [];
  for (let i = 0; i < 9; i++) {
    const y = lerp(0.1, 0.52, i / 8);
    const [, hd, cz] = sampleKeys(TORSO_KEYS, y);
    const z = cz - hd + 0.01;
    spikes.push(bone([0, y, z], [0, y + 0.015, z - 0.034], 0.019, 0.002, 0.8));
  }
  return { chest, skin: mergeGeometries([skin, ...spikes]) };
}

export function pelvisGeometry() {
  const top = PELVIS_KEYS[0][0];
  const bottom = PELVIS_KEYS[PELVIS_KEYS.length - 1][0];
  return surface({
    rows: 12,
    segs: 12,
    uv: (p, t, w) => [(w / Math.PI) * 0.5, 0.75 + p.y],
    at: (t, w, out) => {
      const y = lerp(top, bottom, t);
      const [hw, hd, cz] = sampleKeys(PELVIS_KEYS, y);
      return out.set(Math.sin(w) * hw, y, Math.cos(w) * hd + cz);
    },
  });
}

// 휜 긴 목: 관 모양에 고리 주름을 새기고 뒤쪽에 돌기를 붙인다
export function neckGeometry(curve) {
  const tubular = 34;
  const radial = 7;
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = g.attributes.position;
  const c = new THREE.Vector3();
  const colors = [];
  const ring = (t) => Math.sin(t * TAU * 7.5);
  for (let i = 0; i < pos.count; i++) {
    const u = Math.floor(i / (radial + 1)) / tubular;
    curve.getPointAt(u, c);
    const r = lerp(0.088, 0.052, smooth(clamp(u * 1.2, 0, 1))) * (1 + 0.12 * ring(u));
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * r, c.y + (pos.getY(i) - c.y) * r, c.z + (pos.getZ(i) - c.z) * r);
    const shade = lerp(0.62, 1, (ring(u) + 1) / 2);
    colors.push(shade, shade, shade);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const spikes = [];
  for (let i = 0; i < 6; i++) {
    curve.getPointAt(lerp(0.12, 0.8, i / 5), c);
    const r = lerp(0.08, 0.05, i / 5);
    spikes.push(bone([0, c.y, c.z - r + 0.008], [0, c.y + 0.01, c.z - r - 0.026], 0.015, 0.002, 0.8));
  }
  return mergeGeometries([g, ...spikes]);
}

