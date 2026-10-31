// 3D 괴물: 아이 그림을 따라 만든 달걀 머리, 휜 긴 목, 가늘고 긴 팔다리. 앞은 +Z 다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../logic/horrorGrid.js';

const TAU = Math.PI * 2;
const LOOK_CELLS = 8; // 이 안에 들어오면 머리를 돌려 주인공을 본다
const LOOK_LIMIT = 1.15; // 목이 돌아가는 한계 (라디안)
const EYE_H = 1.6; // 주인공 눈높이 (미터)

// 다리와 팔 길이 (미터). 그림 비율을 키 2.5m 로 옮긴 값
const THIGH = 0.46;
const SHIN = 0.5;
const ANKLE = 0.13;
const UPPER_ARM = 0.46;
const FOREARM = 0.48;
const SHOULDER = { x: 0.2, y: 0.49 };
const SPINE_UP = 0.05; // 골반 위 허리 높이
const NECK_UP = 0.53; // 허리 위 목 뿌리 높이

// 머리 크기와, 얼굴 그림이 덮는 폭과 높이
const HEAD = { w: 0.38, h: 0.54, d: 0.42, up: 0.22, ahead: 0.1 };
const FACE = { w: 0.42, h: 0.5, chinV: 0.03, chinY: -0.26 };
const EYE_UV = [[0.283, 0.663], [0.708, 0.663]]; // 그림 속 두 눈의 가운데
const EYE_R = 0.036;
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

const NECK_POINTS = [[-0.05, -0.02], [0.1, -0.05], [0.24, -0.01], [0.36, 0.08], [0.43, 0.14]];

const POSE = {
  walk: { lean: 0.56, neck: -0.42, stretch: 1, reach: 0, amp: 0.56, knee: 0.8, stride: 2.1, tilt: -0.08 },
  chase: { lean: 1.02, neck: -0.62, stretch: 1.3, reach: 1, amp: 0.82, knee: 1.15, stride: 3, tilt: -0.3 },
};
const EYE_GLOW = { patrol: 0.42, investigate: 0.55, search: 0.55, chase: 1, stunned: 0.04 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const bump = (d, r) => Math.exp(-(d * d) / (r * r));

// 머리를 돌릴 각도. 멀면 0, 가까우면 목 한계 안에서 주인공 쪽 (s 는 칸 좌표, heading 은 몸 방향)
export function lookYaw(s, heading, player) {
  if (Math.hypot(player.x - s.x, player.y - s.y) > LOOK_CELLS) return 0;
  return clamp(wrapAngle(Math.atan2(player.x - s.x, player.y - s.y) - heading), -LOOK_LIMIT, LOOK_LIMIT);
}

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
function limb(len, radius, { rows = 8, segs = 6, push = () => 0, shade } = {}) {
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
function knob(r, x = 0, y = 0, z = 0) {
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
function bone(a, b, ra, rb, c = 1, radial = 4) {
  const from = new THREE.Vector3(...a);
  const dir = new THREE.Vector3(...b).sub(from);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, radial, 1, true);
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

function handGeometry() {
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

function footGeometry() {
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

const faceY = (v) => FACE.chinY + (v - FACE.chinV) * FACE.h;
const faceX = (u) => (u - 0.5) * FACE.w;

function headAt(t, w, out) {
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
function faceSurface(x, y) {
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

function headGeometries() {
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
function eyeGeometry() {
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

function torsoGeometries() {
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

function pelvisGeometry() {
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
function neckGeometry(curve) {
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
  return mergeGeometries([g.index ? g : g.toNonIndexed(), ...spikes]);
}

export class CreatureModel {
  constructor(scene, loader = new THREE.TextureLoader()) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    const srgb = (url, repeat) => {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const faceTex = srgb('art/horror_creature_face.jpg');
    faceTex.wrapT = THREE.MirroredRepeatWrapping; // 그림 위쪽 이마를 정수리까지 잇는다
    this.textures = [faceTex, srgb('art/horror_creature_skin.jpg', true), srgb('art/horror_creature_torso.jpg')];
    const paper = (map) => new THREE.MeshStandardMaterial({ map, color: 0xa8a8a8, roughness: 1, vertexColors: true }); // 손전등에 하얗게 날아가지 않게 어둡게 둔다
    const skin = paper(this.textures[1]);
    const add = (parent, geometry, material, shadow, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      parent.add(m);
      return m;
    };
    const pivot = (parent, x = 0, y = 0, z = 0) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    this.hips = pivot(this.group);
    add(this.hips, pelvisGeometry(), skin, true);

    const thighGeo = mergeGeometries([knob(0.07, 0, -0.02), limb(THIGH, (t) => lerp(0.066, 0.032, smooth(t)), { rows: 6 })]);
    const shinGeo = mergeGeometries([
      limb(SHIN, (t) => 0.024 + 0.012 * Math.sin(t * Math.PI), { rows: 8 }),
      knob(0.058, 0, -0.005, 0.014), // 툭 튀어나온 무릎
    ]);
    const footGeo = footGeometry();
    this.legs = [-1, 1].map((side) => {
      const hip = pivot(this.hips, side * 0.082, -0.07);
      add(hip, thighGeo, skin, true);
      const knee = pivot(hip, 0, -THIGH);
      add(knee, shinGeo, skin, true);
      const ankle = pivot(knee, 0, -SHIN);
      add(ankle, footGeo, skin, false).scale.x = side;
      return { hip, knee, ankle, phase: side > 0 ? 0 : Math.PI };
    });

    this.spine = pivot(this.hips, 0, SPINE_UP);
    const torso = torsoGeometries();
    add(this.spine, torso.chest, paper(this.textures[2]), true);
    add(this.spine, torso.skin, skin, true);

    const upperGeo = mergeGeometries([knob(0.058), limb(UPPER_ARM, (t) => lerp(0.042, 0.026, t), { rows: 6 })]);
    const foreGeo = mergeGeometries([knob(0.04), limb(FOREARM, (t) => lerp(0.03, 0.018, t), { rows: 6 })]);
    const handGeo = handGeometry();
    this.arms = [-1, 1].map((side) => {
      const shoulder = pivot(this.spine, side * SHOULDER.x, SHOULDER.y, -0.015);
      add(shoulder, upperGeo, skin, true);
      const elbow = pivot(shoulder, 0, -UPPER_ARM);
      add(elbow, foreGeo, skin, true);
      const wrist = pivot(elbow, 0, -FOREARM);
      add(wrist, handGeo, skin, false).scale.x = side;
      return { shoulder, elbow, wrist, side, phase: side > 0 ? Math.PI : 0 };
    });

    const curve = new THREE.CatmullRomCurve3(NECK_POINTS.map(([y, z]) => new THREE.Vector3(0, y, z)));
    this.neckEnd = curve.getPointAt(1);
    this.neck = pivot(this.spine, 0, NECK_UP, -0.01);
    this.neckMesh = add(this.neck, neckGeometry(curve), skin, true);
    this.headLevel = pivot(this.neck);
    this.head = pivot(this.headLevel);
    this.head.rotation.order = 'YXZ';
    const inner = pivot(this.head, 0, HEAD.up, HEAD.ahead); // 목이 턱 끝이 아니라 턱 뒤로 들어간다
    const head = headGeometries();
    add(inner, head.face, paper(this.textures[0]), true);
    add(inner, head.back, skin, true);

    // 그림 속 눈 자리에 붙인 희미한 빛. 더하기 합성이라 불빛 아래서는 그린 눈동자가 그대로 보인다
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.eyeTint = new THREE.Color(0xdde6ff);
    const eyeGeo = eyeGeometry();
    const n = new THREE.Vector3();
    const u = new THREE.Vector3();
    const v = new THREE.Vector3();
    this.eyes = EYE_UV.map(([eu, ev]) => {
      const { t, w } = faceSurface(faceX(eu), faceY(ev));
      const p = headAt(t, w, new THREE.Vector3());
      headAt(t + 0.01, w, u).sub(headAt(t - 0.01, w, n));
      headAt(t, w + 0.01, v).sub(headAt(t, w - 0.01, n));
      n.crossVectors(u, v).normalize();
      const eye = add(inner, eyeGeo, this.eyeMat, false, p.x + n.x * 0.004, p.y + n.y * 0.004, p.z + n.z * 0.004);
      eye.scale.setScalar(EYE_R);
      eye.lookAt(n.clone().add(eye.position));
      eye.renderOrder = 2;
      return eye;
    });

    this.pose = { ...POSE.walk };
    this.phase = 0;
    this.gait = 0;
    this.yaw = 0;
    this.lookY = 0;
    this.lookX = 0;
    this.glow = EYE_GLOW.patrol;
    this.twitchT = 2 + Math.random() * 3;
    this.twitchHold = 0;
    this.twitchRoll = 0;
    this.twitchPitch = 0;
    this.last = null;
    this.time = 0;
  }

  update(s, dt, player) {
    this.time += dt;
    const first = this.last === null;
    const moved = first ? 0 : Math.hypot(s.x - this.last.x, s.y - this.last.y) * CELL;
    this.last = { x: s.x, y: s.y };
    this.group.position.set(s.x * CELL, 0, s.y * CELL);
    if (s.mode === 'stunned') {
      this.yaw = s.heading;
      this.group.rotation.set(0, s.heading, 0);
      this.shake(0.012);
    } else {
      this.yaw += wrapAngle(s.heading - this.yaw) * (first ? 1 : damp(11, dt));
      this.group.rotation.set(0, this.yaw, 0);
      this.body(s, dt, moved < 1.5 ? moved : 0);
      this.look(s, dt, player);
    }
    this.lightEyes(s, dt, player);
  }

  // 멈춘 동안: 자세는 그대로 두고 잘게 떤다
  shake(a) {
    this.group.position.x += (Math.random() - 0.5) * a;
    this.group.position.z += (Math.random() - 0.5) * a;
    this.hips.rotation.z = (Math.random() - 0.5) * a;
  }

  body(s, dt, moved) {
    const goal = s.mode === 'chase' ? POSE.chase : POSE.walk;
    const k = damp(5, dt);
    const p = this.pose;
    for (const key of Object.keys(goal)) p[key] += (goal[key] - p[key]) * k;
    const speed = dt > 0 ? moved / dt : 0;
    this.gait += ((speed > 0.1 ? 1 : 0) - this.gait) * damp(7, dt);
    this.phase = (this.phase + (moved / p.stride) * TAU) % TAU;
    const sway = this.gait * Math.sin(this.phase);
    const breath = Math.sin(this.time * 1.4);

    let reachDown = 0;
    for (const leg of this.legs) {
      const ph = this.phase + leg.phase;
      const swing = Math.max(0, Math.cos(ph));
      const push = Math.max(0, -Math.sin(ph)) * this.gait; // 뒤로 간 다리는 뒤꿈치를 든다
      const a = -0.24 - this.gait * p.amp * Math.sin(ph);
      const b = 0.5 + this.gait * p.knee * swing;
      leg.hip.rotation.x = a;
      leg.knee.rotation.x = b;
      leg.ankle.rotation.x = -(a + b) + this.gait * 0.45 * swing + push * 0.45;
      reachDown = Math.max(reachDown, THIGH * Math.cos(a) + SHIN * Math.cos(a + b) + push * 0.12);
    }
    this.hips.position.set(0, reachDown + ANKLE + 0.07, -0.1 * p.lean);
    this.hips.rotation.set(0, sway * 0.12, sway * 0.035);
    this.spine.rotation.set(p.lean, sway * -0.2, 0);

    this.neck.rotation.x = p.neck + breath * 0.015;
    this.neckMesh.scale.set(1, p.stretch, p.stretch);
    this.headLevel.position.set(0, this.neckEnd.y * p.stretch, this.neckEnd.z * p.stretch);
    this.headLevel.rotation.x = -(p.lean + p.neck);

    for (const arm of this.arms) {
      const swing = this.gait * Math.sin(this.phase + arm.phase);
      const lift = p.reach * 1.42;
      arm.shoulder.rotation.set(-p.lean - lift + swing * lerp(0.42, 0.14, p.reach), 0, arm.side * lerp(0.075, -0.03, p.reach));
      arm.elbow.rotation.x = lerp(-0.32, -0.24, p.reach) + swing * -0.16;
      arm.wrist.rotation.x = -p.reach * 0.62 + breath * 0.03;
    }
  }

  look(s, dt, player) {
    const dist = Math.hypot(player.x - s.x, player.y - s.y) * CELL;
    const yaw = lookYaw(s, this.yaw, player);
    const near = dist <= LOOK_CELLS * CELL;
    const pitch = near ? Math.atan2(2.2 - EYE_H, Math.max(1, dist)) : 0.12;
    const k = damp(4.5, dt);
    this.lookY += (yaw - this.lookY) * k;
    this.lookX += (pitch - this.lookX) * k;

    // 가끔 머리가 툭 꺾인다
    this.twitchT -= dt;
    if (this.twitchT <= 0) {
      this.twitchT = 1.6 + Math.random() * 3.6;
      this.twitchHold = 0.08 + Math.random() * 0.14;
      this.twitchRoll = (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.3);
      this.twitchPitch = (Math.random() - 0.5) * 0.36;
    }
    if (this.twitchHold > 0) this.twitchHold -= dt;
    else {
      const fade = 1 - damp(13, dt);
      this.twitchRoll *= fade;
      this.twitchPitch *= fade;
    }
    this.head.rotation.set(this.pose.tilt + this.lookX + this.twitchPitch, this.lookY, this.twitchRoll);
  }

  lightEyes(s, dt, player) {
    const goal = EYE_GLOW[s.mode] ?? EYE_GLOW.patrol;
    this.glow += (goal - this.glow) * damp(s.mode === 'chase' ? 9 : 4, dt);
    // 멀어도 작은 두 점으로 남게 조금 키우고 밝힌다
    const far = clamp((Math.hypot(player.x - s.x, player.y - s.y) * CELL) / 10, 1, 2.6);
    this.eyeMat.color.copy(this.eyeTint).multiplyScalar(Math.min(1, this.glow * (0.5 + far * 0.5)));
    const r = EYE_R * far;
    this.eyes[0].scale.setScalar(r);
    this.eyes[1].scale.setScalar(r);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.textures.forEach((t) => t.dispose());
  }
}
