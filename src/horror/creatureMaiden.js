// 처녀귀신: Gemini 가 그린 소복 입은 귀신의 앞뒤 그림을 입힌다. 발 없이 떠 있고, 소복 자락은 아래로 갈수록 투명해진다.
// 긴 머리카락 띠가 얼굴 앞과 등 뒤로 늘어져 흔들리고, 가까이 오면 머리카락이 갈라지며 하얀 얼굴이 드러난다. 앞은 +Z 다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, damp, lookYaw } from './creatureBase.js';
import { clamp, lerp, sampleKeys, smooth, surface } from './creatureGeometry.js';
import { wrapU } from './creatureShell.js';

// 치수는 Gemini 전신 앞 그림에서 쟀다 (tools/make_maiden_art.py 가 찍어 준다). 정수리까지 2.55m
const NECK_Y = 2.057; // 머리 받침점 높이. 머리 그림의 맨 아랫줄이다
const HEAD_H = 0.49; // 머리 그림이 덮는 높이 (받침점에서 잰다)
const HEAD_KEYS = [ // [받침점 위 높이, 반폭]. 머리카락 윤곽이라 아래로 갈수록 어깨 위로 퍼진다
  [0.5, 0.01], [0.49, 0.061], [0.453, 0.118], [0.415, 0.143], [0.378, 0.156], [0.34, 0.168], [0.303, 0.175], [0.264, 0.177], [0.228, 0.18],
  [0.189, 0.188], [0.152, 0.192], [0.114, 0.201], [0.077, 0.207], [0.038, 0.212], [0, 0.243],
].map(([y, hw]) => [y, hw, Math.min(hw * 0.95, 0.165), 0]);
const BODY_TOP = 2.084; // 몸 그림 맨 윗줄 높이. 머리 속으로 들어간다
const HEM_Y = 0.12; // 밑단 끝 높이. 발 없이 떠 있다
const BODY_KEYS = [ // [높이, 반폭]. 소매 끝 (1.24m) 아래로는 손을 뺀 소복 폭이다
  [2.1, 0.03], [2.084, 0.22], [1.991, 0.307], [1.898, 0.334], [1.804, 0.35], [1.711, 0.373], [1.616, 0.392], [1.523, 0.405], [1.429, 0.424], [1.336, 0.446],
  [1.244, 0.467], [1.149, 0.308], [1.056, 0.317], [0.962, 0.327], [0.869, 0.337], [0.774, 0.344], [0.682, 0.349], [0.589, 0.35], [0.494, 0.361],
  [0.402, 0.364], [0.307, 0.366], [0.214, 0.366], [0.12, 0.366],
].map(([y, hw]) => [y, hw, clamp(hw * 0.62, 0.15, 0.24), 0]);
const FRONT_HEAD = 2 / 3; // 그림 폭 가운데 앞면이 차지하는 몫. 양쪽 끝이 뒷면이다
const FRONT_BODY = 1 / 2;
const RIPPLE_Y = 0.75; // 이 아래 소복 자락이 물결친다
// 머리카락 그림 한 장: 덩어리 넷 (폭 256) 과 손 둘 (폭 128), 높이 1024
const SHEET_W = 1280;
const CLUMP = (i) => [i * 256, 0, 256, 1024];
const HAND_CELLS = [[1024, 0, 128, 512], [1152, 0, 128, 512]];
// 손: [안쪽 x, 바깥쪽 x], 손목 (그림 맨 윗줄) 높이와 손끝까지 길이
const HAND = { inner: 0.287, outer: 0.492, top: 1.235, len: 0.415, z: 0.06 };
// 얼굴 그림 (horror_maiden_face.webp) 이 붙는 자리: 받침점에서 잰 위, 아래, 폭. 눈과 입이 머리 그림의 눈, 입 자리에 온다
const FACE = { top: 0.364, bottom: 0.0085, w: 0.272 };
// 머리카락 띠: 가운데 x, 반폭, 받침점에서 잰 끝 높이, 그림 덩어리
const FRONT_HAIR = [
  { x: -0.075, half: 0.075, end: -0.42, clump: 2 },
  { x: 0.125, half: 0.058, end: -0.3, clump: 3 },
  { x: -0.17, half: 0.05, end: -0.5, clump: 0 },
];
const BACK_HAIR = [
  { x: 0, half: 0.17, end: -0.95, clump: 1, out: 0 },
  { x: -0.12, half: 0.09, end: -0.8, clump: 0, out: 0.02 },
  { x: 0.13, half: 0.09, end: -0.86, clump: 3, out: 0.02 },
];
const HAIR_TOP = 0.47; // 머리카락 띠가 시작하는 높이 (정수리 가르마 근처)

// 상태마다 몸짓: lean 몸 숙임, nod 고개 숙임, tilt 고개 갸웃, reach 손 들기, sway 머리카락 흔들림, glow 어둠에서 뜨는 빛
const POSE = {
  walk: { lean: 0.02, nod: 0.16, tilt: 0.16, reach: 0, sway: 1, glow: 0.14 },
  investigate: { lean: 0.06, nod: 0.22, tilt: 0.22, reach: 0.25, sway: 1.3, glow: 0.18 },
  search: { lean: 0.06, nod: 0.24, tilt: 0.24, reach: 0.3, sway: 1.3, glow: 0.18 },
  chase: { lean: 0.15, nod: 0.3, tilt: 0.04, reach: 1, sway: 2.4, glow: 0.3 },
  watch: { lean: 0, nod: 0.06, tilt: 0.32, reach: 0, sway: 0.35, glow: 0.24 }, // 노을에 멀리 서서 바라본다
  stunned: { lean: -0.05, nod: -0.1, tilt: 0.1, reach: 0.2, sway: 0.6, glow: 0.02 },
};
const POSE_KEYS = Object.keys(POSE.walk);
const ROBE_COLOR = 0xc9ccd2; // 그림이 없을 때 소복 색
const SKIN_COLOR = 0x18181c; // 그림이 없을 때 머리 색
const HAIR_COLOR = 0x0b0b0e;
const ROBE_TINT = 0x868a90; // 흰 소복이 손전등 아래서 하얗게 날아가지 않게 누른다
const HEAD_TINT = 0x9a9ca2;
const HAIR_TINT = 0x7a7a84; // 머리카락 윤기가 손전등 아래서 회색으로 뜨지 않게 누른다
const HOVER = 0.05; // 위아래로 떠오르는 폭 (미터)
const BOB = 1.2; // 떠오르는 빠르기 (라디안/초)
const REVEAL = [1.7, 0.8]; // 이 칸 안으로 들어오면 머리카락이 갈라지기 시작해서, 이만큼 가까우면 얼굴이 다 보인다

const headWidth = (y) => sampleKeys(HEAD_KEYS, clamp(y, 0, HEAD_H));
// 머리 앞쪽 표면의 깊이 (z). 머리카락 띠와 얼굴 그림이 여기에 붙는다
function headZ(x, y) {
  const [hw, hd] = headWidth(y);
  return hd * Math.sqrt(Math.max(0, 1 - (x / hw) ** 2));
}

const cellUv = ([x, y, w, h], u, v) => [(x + u * w) / SHEET_W, 1 - (y + (1 - v) * h) / 1024];

function bodyAt(y, w, out) {
  const [hw, hd] = sampleKeys(BODY_KEYS, y);
  const low = clamp((1.1 - y) / 0.9, 0, 1); // 그림의 긴 주름을 따라 자락이 물결친다
  const fold = 1 + low * 0.035 * Math.sin(w * 7 + 0.6) + low * 0.02 * Math.sin(w * 13 + y * 3);
  return out.set(Math.sin(w) * hw * fold, y, Math.cos(w) * hd * fold);
}

function bodyGeometry() {
  return surface({
    rows: 34,
    segs: 40,
    at: (t, w, out) => bodyAt(lerp(BODY_KEYS[0][0], HEM_Y, t), w, out),
    uv: (p, t, w) => [wrapU(w, FRONT_BODY), clamp((p.y - HEM_Y) / (BODY_TOP - HEM_Y), 0, 1)],
  });
}

function headGeometry() {
  return surface({
    rows: 18,
    segs: 36,
    at: (t, w, out) => {
      const y = lerp(HEAD_KEYS[0][0], 0, t);
      const [hw, hd] = headWidth(y);
      return out.set(Math.sin(w) * hw, y, Math.cos(w) * hd);
    },
    uv: (p, t, w) => [wrapU(w, FRONT_HEAD), Math.min(1, p.y / HEAD_H)],
  });
}

// 늘어진 띠 하나. path(t) 가 위에서 아래로 [x, y, z] 를, across 는 가로 칸 수다. 띠마다 hang (매달린 곳에서 내려온 길이) 을 남긴다
function band({ rows, across = 2, path, half, cell, normalZ }) {
  const pos = [];
  const nor = [];
  const tex = [];
  const col = [];
  const idx = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    for (let c = 0; c <= across; c++) {
      const s = c / across;
      const [x, y, z] = path(t, (s * 2 - 1) * half(t));
      pos.push(x, y, z);
      nor.push(0, 0, normalZ);
      tex.push(...cellUv(cell, s, 1 - t));
      col.push(1, 1, 1);
      if (r && c) {
        const a = (r - 1) * (across + 1) + c - 1;
        const b = a + across + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
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

// 머리카락 띠들. 앞 띠는 가르마에서 이마를 덮고 얼굴 앞으로, 뒤 띠는 뒤통수를 덮고 허리까지 늘어진다
function hairGeometry() {
  const parts = [];
  const side = [];
  const fan = (t, k) => lerp(k, 1, smooth(clamp(t / 0.35, 0, 1)));
  const add = (g, s) => {
    parts.push(g);
    for (let i = 0; i < g.attributes.position.count; i++) side.push(s);
  };
  for (const h of FRONT_HAIR) {
    const path = (t, dx) => {
      const y = lerp(HAIR_TOP, h.end, t);
      const x = h.x * fan(t, 0.35) + dx;
      const z = y >= 0 ? headZ(x, y) + 0.016 : lerp(headZ(x, 0) + 0.02, 0.255, smooth(clamp(-y / 0.25, 0, 1)));
      return [x, y, z];
    };
    add(band({ rows: 14, path, half: (t) => h.half * fan(t, 0.5), cell: CLUMP(h.clump), normalZ: 1 }), Math.sign(h.x));
  }
  for (const h of BACK_HAIR) {
    const path = (t, dx) => {
      const y = lerp(HAIR_TOP, h.end, t);
      const x = h.x * fan(t, 0.5) + dx;
      const z = y >= 0 ? -headZ(x, y) - 0.016 - h.out * smooth(clamp(1 - y / 0.3, 0, 1)) : -lerp(headZ(x, 0) + 0.02 + h.out, 0.275 + h.out, smooth(clamp(-y / 0.3, 0, 1)));
      return [x, y, z];
    };
    add(band({ rows: 16, path, half: (t) => h.half * fan(t, 0.6), cell: CLUMP(h.clump), normalZ: -1 }), 0);
  }
  const g = mergeGeometries(parts);
  g.userData.side = Float32Array.from(side); // 가까이 오면 앞 띠가 이쪽으로 갈라진다. 뒤 띠는 0
  return g;
}

// 두 손. 소매 끝 (손목) 을 원점으로 아래로 늘어진다. 손등이 살짝 불룩하다
function handsGeometry() {
  return mergeGeometries([-1, 1].map((s, i) => band({
    rows: 6,
    across: 4,
    half: () => (HAND.outer - HAND.inner) / 2,
    cell: HAND_CELLS[i],
    normalZ: 1,
    path: (t, dx) => {
      const k = dx / ((HAND.outer - HAND.inner) / 2);
      return [s * (HAND.inner + HAND.outer) / 2 + dx, -t * HAND.len, HAND.z + 0.025 * Math.cos(k * Math.PI / 2)];
    },
  })));
}

// 얼굴 그림을 머리 앞면에 맞춰 휜 조각
function faceGeometry() {
  return band({
    rows: 8,
    across: 8,
    half: () => FACE.w / 2,
    cell: [0, 0, SHEET_W, 1024], // 얼굴은 그림 한 장 전체를 쓴다
    normalZ: 1,
    path: (t, x) => {
      const y = lerp(FACE.top, FACE.bottom, t);
      return [x, y, headZ(x, y) + 0.008];
    },
  });
}

export class MaidenModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const matte = (o) => new THREE.MeshLambertMaterial(o);
    const sheer = (o) => new THREE.MeshLambertMaterial({ ...o, transparent: true, alphaTest: 0.03 });
    const strand = (o) => new THREE.MeshLambertMaterial({ ...o, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide, depthWrite: false });
    const robe = this.paper('art/horror_maiden_body.webp', ROBE_COLOR, ROBE_TINT, sheer);
    robe.emissive = new THREE.Color(0xdde6ff); // 어스름과 어둠에서 소복이 희미하게 뜬다
    robe.emissiveMap = robe.map;
    const skin = this.paper('art/horror_maiden_head.jpg', SKIN_COLOR, HEAD_TINT, matte);
    skin.emissive = new THREE.Color(0xdde6ff);
    skin.emissiveMap = skin.map;
    const hair = this.paper('art/horror_maiden_hair.webp', HAIR_COLOR, HAIR_TINT, strand, () => {
      this.hair.visible = false; // 그림이 없으면 네모난 띠만 남으니 숨긴다. 손은 흰 띠로 남는다
    });
    const face = this.paper('art/horror_maiden_face.webp', 0xffffff, 0xd8d8d8, (o) => new THREE.MeshLambertMaterial({ ...o, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), () => {
      this.face.visible = false;
    });
    face.emissive = new THREE.Color(0xdde6ff);
    face.emissiveMap = face.map;
    this.robeMat = robe;
    this.skinMat = skin;
    this.faceMat = face;

    this.root = this.pivot(this.group);
    this.bodyMesh = this.add(this.root, bodyGeometry(), robe, true);
    this.head = this.pivot(this.root, 0, NECK_Y);
    this.head.rotation.order = 'YXZ';
    this.add(this.head, headGeometry(), skin, true);
    this.face = this.add(this.head, faceGeometry(), face, false);
    this.face.renderOrder = 1;
    this.hair = this.add(this.head, hairGeometry(), hair, false);
    this.hair.renderOrder = 2;
    this.hands = this.pivot(this.root, 0, HAND.top);
    this.add(this.hands, handsGeometry(), hair, false).renderOrder = 1;
    this.setupHem();
    this.setupHair();

    this.headHeight = NECK_Y + 0.25;
    this.faceNear = 0.42; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 얼굴이 화면을 채운다
    this.faceTilt = 0; // 잡히는 장면의 고개. 몸을 숙인 만큼 되돌려 얼굴이 정면을 본다
    this.pose = { ...POSE.walk };
    this.glow = this.pose.glow;
    this.lookY = 0;
    this.tiltGoal = 0;
    this.tilt = 0;
    this.driftT = 0;
    this.gait = 0;
    this.reveal = 0;
  }

  setupHem() {
    const pos = this.bodyMesh.geometry.attributes.position;
    const list = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < RIPPLE_Y) list.push(i);
    this.hem = {
      index: Uint32Array.from(list),
      x: Float32Array.from(list, (i) => pos.getX(i)),
      z: Float32Array.from(list, (i) => pos.getZ(i)),
      weight: Float32Array.from(list, (i) => (1 - pos.getY(i) / RIPPLE_Y) ** 2),
      angle: Float32Array.from(list, (i) => Math.atan2(pos.getX(i), pos.getZ(i))),
    };
  }

  setupHair() {
    const g = this.hair.geometry;
    const pos = g.attributes.position;
    const n = pos.count;
    this.strands = {
      rest: Float32Array.from(pos.array),
      side: g.userData.side,
      hang: Float32Array.from({ length: n }, (_, i) => Math.max(0, 0.12 - pos.getY(i))), // 턱 아래로 늘어진 길이
      phase: Float32Array.from({ length: n }, (_, i) => pos.getX(i) * 9), // 띠마다 조금씩 다르게 흔들린다
    };
  }

  update(s, dt, player) {
    const first = !this.hasLast;
    const moved = this.track(s, dt, CELL);
    if (s.mode === 'stunned') this.shake(s, this.root, 0.02);
    else this.turn(s, dt, first);
    this.body(s, dt, moved < 1.5 ? moved : 0, player);
  }

  body(s, dt, moved, player) {
    const goal = POSE[s.mode] ?? POSE.walk;
    const k = damp(s.mode === 'chase' ? 5 : 2.5, dt);
    const p = this.pose;
    for (let i = 0; i < POSE_KEYS.length; i++) {
      const key = POSE_KEYS[i];
      p[key] += (goal[key] - p[key]) * k;
    }
    const t = this.time;
    const speed = dt > 0 ? moved / dt : 0;
    this.gait += (clamp(speed / 3, 0, 1) - this.gait) * damp(4, dt);
    // 발 없이 떠서 천천히 오르내리고 좌우로 흔들린다. 움직이면 자락이 뒤로 끌린다
    if (s.mode !== 'stunned') this.root.rotation.set(p.lean + 0.02 * Math.sin(t * 0.8) + 0.05 * this.gait, 0, 0.035 * Math.sin(t * 0.9));
    this.root.position.y = HOVER * Math.sin(t * BOB);
    // 고개는 천천히 갸웃거리고 가까우면 주인공 쪽으로 돈다
    this.driftT -= dt;
    if (this.driftT <= 0) {
      this.driftT = 1.5 + Math.random() * 2;
      this.tiltGoal = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
    }
    this.tilt += (this.tiltGoal * p.tilt - this.tilt) * damp(1.5, dt);
    this.lookY += (lookYaw(s, this.yaw, player) - this.lookY) * damp(2, dt);
    this.head.rotation.set(p.nod, this.lookY, this.tilt);
    this.faceTilt = -p.lean;
    this.hands.rotation.set(-0.85 * p.reach + 0.04 * Math.sin(t * 1.7), 0, 0);
    this.glow = p.glow;
    this.robeMat.emissiveIntensity = p.glow;
    this.skinMat.emissiveIntensity = p.glow * 0.6;
    const dist = Math.hypot(player.x - s.x, player.y - s.y);
    this.reveal += (1 - clamp((dist - REVEAL[1]) / (REVEAL[0] - REVEAL[1]), 0, 1) - this.reveal) * damp(4, dt);
    this.faceMat.opacity = this.reveal;
    this.faceMat.emissiveIntensity = p.glow * 0.8;
    this.face.visible = this.reveal > 0.01 && this.faceMat.map !== null;
    if (this.group.visible) {
      this.rippleHem(t);
      this.swayHair(t, p);
    }
  }

  rippleHem(t) {
    const { index, x, z, weight, angle } = this.hem;
    const pos = this.bodyMesh.geometry.attributes.position;
    const a = pos.array;
    const amp = lerp(0.035, 0.08, this.gait);
    for (let i = 0; i < index.length; i++) {
      const r = 1 + amp * weight[i] * (Math.sin(angle[i] * 5 + t * 1.4) + 0.6 * Math.sin(angle[i] * 3 - t * 2.1));
      const k = index[i] * 3;
      a[k] = x[i] * r;
      a[k + 2] = z[i] * r - 0.12 * this.gait * weight[i];
    }
    pos.needsUpdate = true;
  }

  // 머리카락은 고개를 숙여도 아래로 늘어지고, 바람에 흔들리고, 가까이 오면 앞 띠가 양옆으로 갈라진다
  swayHair(t, p) {
    const { rest, side, hang, phase } = this.strands;
    const pos = this.hair.geometry.attributes.position;
    const a = pos.array;
    const pitch = p.nod + p.lean;
    const fall = Math.sin(pitch) * 0.9;
    const amp = 0.03 * p.sway;
    for (let i = 0; i < side.length; i++) {
      const h = hang[i];
      const k = i * 3;
      const w = h * h;
      a[k] = rest[k] + w * amp * 2.2 * Math.sin(t * 1.6 + phase[i]) + side[i] * this.reveal * Math.min(1, h * 2.5 + 0.35) * 0.07;
      a[k + 1] = rest[k + 1] + h * (1 - Math.cos(pitch)) * 0.9;
      a[k + 2] = rest[k + 2] + h * fall + w * amp * Math.sin(t * 1.1 + phase[i] * 0.7) + Math.abs(side[i]) * this.reveal * 0.02;
    }
    pos.needsUpdate = true;
  }
}
