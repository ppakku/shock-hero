// 큰입이: 아이 그림(3488)과 초상화를 따라 Gemini 가 그린 앞뒤 그림을 입힌다. 눈 없이 머리 전체가 입이고, 위에 엉킨 머리털,
// 옆으로 뻗은 긴 팔과 가는 손가락, 좁은 몸, 긴 다리. 앞은 +Z 다. 못 보는 괴물이라 주인공을 쳐다보지 않고, 손을 벌려 더듬으며 냄새를 맡는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, Rig, damp } from './creatureBase.js';
import { ANKLE, TAU, bone, clamp, knob, lerp, limb, sampleKeys, smooth, surface } from './creatureGeometry.js';
import { jawMorph, morphed, shellHead, throat, warp, wrapU } from './creatureShell.js';

// 치수는 Gemini 그림에서 쟀다 (tools/make_maw_art.py 가 찍어 준다). 머리털까지 키는 2.7m
const THIGH = 0.53;
const SHIN = 0.54;
const UPPER = 0.46;
const FORE = 0.29;
const PALM = 0.16;
const HIPS_Y = 1.29;
const SPINE_UP = 0.06;
const CHIN_Y = 1.78;
const PIVOT = 0.13; // 머리 받침점 (턱에서 잰 높이). 잡히는 장면에서 입이 화면 가운데 온다
const SHOULDER = { x: 0.224, y: 0.344 }; // 허리에서 잰 어깨 자리
const HIP_X = 0.105;
const HEAD_H = 0.913;
const MOUTH = { y: 0.315, x: 0.245, drop: 0.13, w: 1.05, depth: 0.15, rim: 0.13 }; // 입 가운데 높이, 입꼬리 반폭, 쫓을 때 내려가는 턱, 입꼬리 각도, 파 넣은 깊이와 입술 벽 너비
// 입 테두리: 윗입술 가운데에서 입꼬리를 지나 아랫입술 가운데까지 15도마다 잰 반지름
const MOUTH_EDGE = [0.226, 0.231, 0.243, 0.255, 0.259, 0.253, 0.245, 0.241, 0.241, 0.241, 0.237, 0.233, 0.231];
const HEAD_KEYS = [ // [높이, 반폭, 반두께, 앞뒤 치우침]
  [HEAD_H, 0.01], [0.908, 0.038], [0.855, 0.155], [0.802, 0.207], [0.748, 0.243], [0.695, 0.267], [0.642, 0.283], [0.588, 0.293], [0.534, 0.297],
  [0.481, 0.3], [0.427, 0.299], [0.374, 0.283], [0.321, 0.271], [0.267, 0.261], [0.214, 0.249], [0.161, 0.234], [0.107, 0.202], [0.054, 0.161], [0.012, 0.09], [0, 0.02],
].map(([y, hw]) => [y, hw, hw * 0.86, 0]);
const TORSO_KEYS = [ // 허리에서 잰 높이
  [0.56, 0.03, 0.03, 0], [0.54, 0.1, 0.09, 0], [0.42, 0.115, 0.1, 0], [0.39, 0.18, 0.115, 0], [0.353, 0.25, 0.135, 0], [0.298, 0.235, 0.125, 0], [0.245, 0.166, 0.11, 0],
  [0.19, 0.152, 0.1, 0], [0.137, 0.135, 0.09, 0], [0.082, 0.111, 0.08, 0], [0.029, 0.112, 0.08, 0], [-0.026, 0.147, 0.1, 0], [-0.078, 0.146, 0.105, 0], [-0.133, 0.145, 0.1, 0], [-0.17, 0.09, 0.07, 0], [-0.19, 0.02, 0.02, 0],
];
// 손목에서 잰 손가락 중심선: [바깥쪽, 아래쪽]. 바깥쪽은 팔이 뻗은 쪽이다
const FINGERS = [
  [[0.018, 0.117], [0.11, 0.211], [0.205, 0.304], [0.2, 0.436], [0.183, 0.568], [0.123, 0.777]],
  [[0.051, 0.183], [0.095, 0.27], [0.139, 0.348], [0.12, 0.47], [0.088, 0.59], [-0.033, 0.827]],
  [[0.04, 0.194], [0.065, 0.27], [0.09, 0.348], [0.055, 0.44], [0.018, 0.524], [-0.097, 0.667]],
  [[-0.015, 0.084], [-0.05, 0.14], [-0.07, 0.194], [-0.066, 0.26], [-0.059, 0.326], [-0.033, 0.469]],
];
const WRIST_DROP = 0.085; // 손가락 뼈가 손목보다 내려간 거리
const FRONT_HEAD = 2 / 3; // 그림 폭 가운데 앞면이 차지하는 몫. 양쪽 끝이 뒷면이다
const FRONT_LIMB = 1 / 2;
const HAIR = { top: 1.005, bottom: 0.4335, x: 0.42, z: 0.34, inner: 0.84 }; // 머리털 그림이 덮는 높이와 둘레
const INK_UV = [0.004, 0.012]; // 머리털 그림 구석의 먹빛 칸
// 몸 그림 한 장의 칸: [왼쪽, 위, 폭, 높이] (tools/make_maw_art.py 와 같다)
const SHEET = 1024;
const TORSO_CELL = [0, 0, 640, 620];
const ARM_CELL = [640, 0, 128, 1024];
const LEG_CELL = [768, 0, 128, 1024];
const FINGER_CELL = [896, 0, 64, 1024];
const FOOT_CELL = [0, 640, 256, 256];
const SKIN_CELL = [300, 660, 300, 300];
const ART_TOP = 1.756; // 몸통 그림의 맨 위와 맨 아래 줄이 오는 땅 위 높이
const ART_BOTTOM = 1.162;

// 행동 코드의 chase 는 소리 난 곳으로 달려드는 것, search 는 코로 찾는 것이다
const POSE = {
  walk: { lean: 0.1, spread: 1, reach: 0, amp: 0.4, knee: 0.7, stride: 2.8, mouth: 0.25, drop: 0, sweep: 0.3, rate: 0.9 },
  chase: { lean: 0.62, spread: 0.55, reach: 1, amp: 0.8, knee: 1.15, stride: 3.8, mouth: 1, drop: 0.12, sweep: 0.08, rate: 7 },
  search: { lean: 0.42, spread: 0.85, reach: 0.25, amp: 0.3, knee: 0.6, stride: 2.2, mouth: 0.45, drop: 0.06, sweep: 0.7, rate: 2.6 },
  investigate: { lean: 0.26, spread: 0.9, reach: 0.15, amp: 0.45, knee: 0.8, stride: 2.8, mouth: 0.4, drop: 0.03, sweep: 0.5, rate: 2 },
};
const POSE_KEYS = Object.keys(POSE.walk);
const SKIN_COLOR = 0x2e2522; // 그림이 없을 때 살색
const HAIR_COLOR = 0x12160f; // 그림이 없을 때 머리털 색
const TINT = 0x6e7476; // 그림이 손전등 아래서 희게 날아가지 않게 누른다
const HEAD_TINT = 0x6e7476;
const TEETH_GLOW = { patrol: 0.3, investigate: 0.4, search: 0.4, chase: 0.65, stunned: 0.05 };
const TOOTH_LIGHT = 2.2; // 어둠 속에서 이빨이 뜨는 세기
const TOOTH_COLOR = 0xe6ddbe;
const TOOTH_FAR = 3; // 이 칸보다 가까우면 빛을 줄여 그림의 먹선이 보이게 한다
const TOOTH_NEAR = 0.2; // 코앞에서 남는 빛의 몫

const cell = ([x, y, w, h], u, v) => [(x + u * w) / SHEET, 1 - (y + (1 - v) * h) / SHEET];
const skinUv = () => cell(SKIN_CELL, 0.5, 0.5);

// 입 안쪽이면 1, 입술 바깥이면 0. 그 사이가 입술 벽이다
function inMouth(x, y) {
  const dy = y - MOUTH.y;
  const r = Math.hypot(x, dy);
  const i = clamp(Math.atan2(Math.abs(x), dy) / (Math.PI / 12), 0, MOUTH_EDGE.length - 1.001);
  const k = Math.floor(i);
  return lerp(MOUTH_EDGE[k], MOUTH_EDGE[k + 1], i - k) - r;
}

// 입 자리를 머리 속으로 파 넣는다. 정면 그림은 그대로이고, 옆에서 보면 입술이 입안을 가린다
function relief(x, y) {
  const d = inMouth(x, y);
  return -MOUTH.depth * smooth(clamp(d / MOUTH.rim, 0, 1)) + 0.012 * Math.exp(-(((d + 0.012) / 0.02) ** 2));
}

const headUv = (p, t, u) => [wrapU(warp(u), FRONT_HEAD), p.y / HEAD_H];
const split = () => MOUTH.y;

// 씨앗이 같으면 머리털 모양도 같다
function seeded(n) {
  let s = n >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 머리털: 그림에서 뜬 낙서 머리털을 두 겹 원통에 두르고, 옆과 뒤 윤곽은 낙서처럼 엉킨 가닥으로 살린다
function hairGeometry() {
  const rand = seeded(3488);
  const shell = (k, flip) => surface({
    rows: 3,
    segs: 28,
    uv: (p, t, w) => [flip ? 1 - wrapU(w, FRONT_LIMB) : wrapU(w, FRONT_LIMB), (p.y - HAIR.bottom) / (HAIR.top - HAIR.bottom)],
    at: (t, w, out) => out.set(Math.sin(w) * HAIR.x * k, lerp(HAIR.top, HAIR.bottom + 0.04, t), Math.cos(w) * HAIR.z * k), // 맨 아랫줄의 먹빛 칸은 비켜 간다
  });
  const parts = [shell(1, false), shell(HAIR.inner, true)];
  const cy = 0.74;
  const dot = (x, y, z, r) => [x * r, cy + y * r * 0.72, z * r * 0.9];
  for (let i = 0; i < 12; i++) {
    let a = rand() * TAU;
    let e = rand() * 1.3;
    const step = 0.5 + rand() * 0.5;
    let p = null;
    for (let n = 0; n < 5; n++) {
      a += (rand() - 0.5) * step * 2;
      e += (rand() - 0.5) * step;
      const r = 0.34 + rand() * 0.085;
      const q = dot(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e), r);
      if (q[1] < 0.5) q[1] = 0.5;
      if (p) {
        const g = bone(p, q, 0.006, 0.005, 1);
        const uv = g.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setXY(v, INK_UV[0], INK_UV[1]);
        parts.push(g);
      }
      p = q;
    }
  }
  return mergeGeometries(parts);
}

// 몸통: 허리 위아래 두 토막. 몸을 숙여도 틈이 보이지 않게 조금 겹친다
function torsoGeometry(top, bottom, y0) {
  return surface({
    rows: 8,
    segs: 16,
    uv: (p, t, w) => cell(TORSO_CELL, wrapU(w, FRONT_LIMB), clamp((p.y + y0 - ART_BOTTOM) / (ART_TOP - ART_BOTTOM), 0, 0.99)),
    at: (t, w, out) => {
      const y = lerp(top, bottom, t);
      const [hw, hd, cz] = sampleKeys(TORSO_KEYS, y);
      return out.set(Math.sin(w) * hw, y, Math.cos(w) * hd + cz);
    },
  });
}

// 팔다리 그림 띠의 from~to 구간을 입힌다
const stripUv = (strip, len, from, to) => (p, t, w) => cell(strip, wrapU(w, FRONT_LIMB), 1 - lerp(from, to, clamp(-p.y / len, 0, 1)));

// 그림처럼 굽어 뻗는 긴 손가락. 뼈 자리가 원점이고, 끝으로 갈수록 가늘어져 발톱이 된다
function fingerGeometry(points, side) {
  const a = new THREE.Vector2();
  const at = (t) => {
    const i = t * (points.length - 1);
    const k = Math.min(Math.floor(i), points.length - 2);
    const [x0, y0] = points[k];
    const [x1, y1] = points[k + 1];
    return a.set(side * lerp(x0, x1, i - k), WRIST_DROP - lerp(y0, y1, i - k));
  };
  return surface({
    rows: 7,
    segs: 4,
    uv: (p, t, w) => cell(FINGER_CELL, wrapU(w, FRONT_LIMB), 1 - t),
    at: (t, w, out) => {
      const { x: ax, y: ay } = at(Math.max(0, t - 0.02));
      const { x: bx, y: by } = at(Math.min(1, t + 0.02));
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const r = lerp(0.017, 0.0015, t ** 1.6);
      const c = at(t);
      return out.set(c.x + (Math.sin(w) * r * -(by - ay)) / l, c.y + (Math.sin(w) * r * (bx - ax)) / l, Math.cos(w) * r - 0.05 * t * t);
    },
  });
}

function fingersGeometry(side) {
  return mergeGeometries(FINGERS.map((f) => fingerGeometry(f, side)));
}

function palmGeometry() {
  return surface({
    rows: 4,
    segs: 8,
    uv: stripUv(ARM_CELL, PALM, (UPPER + FORE) / (UPPER + FORE + PALM), 1),
    at: (t, w, out) => {
      const close = Math.min(1, Math.min(t, 1 - t) * 10 + 0.2);
      return out.set(Math.sin(w) * lerp(0.03, 0.048, t) * close, -t * PALM, Math.cos(w) * 0.02 * close);
    },
  });
}

// 그림 속 옆모습 발. 발끝이 앞이다
function footGeometry(side) {
  const sole = -ANKLE;
  const g = surface({
    rows: 8,
    segs: 8,
    uv: (p) => cell(FOOT_CELL, 1 - (p.z + 0.08) / 0.3, (p.y - sole) / 0.26),
    at: (t, w, out) => {
      const z = lerp(-0.075, 0.2, t);
      const close = Math.min(1, Math.min(t, 1 - t) * 8 + 0.15);
      const h = lerp(0.11, 0.022, smooth(t));
      return out.set(Math.sin(w) * lerp(0.045, 0.062, t) * close, sole + (h * (1 + Math.cos(w) * close)) / 2, z);
    },
  });
  return mergeGeometries([g, knob(0.036, 0, 0, 0, skinUv), limb(0.04, () => 0.03, { rows: 2, uv: skinUv })]);
}

export class MawModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const matte = (o) => new THREE.MeshLambertMaterial(o); // 반사가 없어야 그림의 까만 입안과 먹선이 손전등 아래서도 까맣다
    const skin = this.paper('art/horror_maw_head.jpg', SKIN_COLOR, HEAD_TINT, (o) => matte({ ...o, fog: false })); // 어둠 속 이빨 빛이 안개에 묻히지 않게
    this.glowMap(skin, 'art/horror_maw_glow.jpg', TOOTH_COLOR);
    this.faceMat = skin;
    const body = this.paper('art/horror_maw_body.jpg', SKIN_COLOR, TINT, matte);
    const hair = this.paper('art/horror_maw_hair.webp', HAIR_COLOR, TINT, (o) => new THREE.MeshLambertMaterial({ ...o, alphaTest: 0.3, side: THREE.DoubleSide }));

    const rig = new Rig(this.group);
    this.hips = rig.bone(null, 0, HIPS_Y, 0);
    rig.part('body', this.hips, torsoGeometry(0.04, TORSO_KEYS[TORSO_KEYS.length - 1][0], HIPS_Y + SPINE_UP).translate(0, SPINE_UP, 0));
    this.spine = rig.bone(this.hips, 0, SPINE_UP, 0);
    rig.part('body', this.spine, torsoGeometry(TORSO_KEYS[0][0], -0.03, HIPS_Y + SPINE_UP));

    this.head = rig.bone(this.spine, 0, CHIN_Y + PIVOT - HIPS_Y - SPINE_UP, 0.0);
    this.head.rotation.order = 'YXZ';
    const shell = shellHead({ keys: HEAD_KEYS, edgeU: split, edgeL: split, mouthW: MOUTH.w, relief, uv: headUv, lipShade: 0, rows: 22, segs: 50 });
    const face = mergeGeometries([morphed(shell.skull), morphed(shell.jaw, jawMorph(shell.jaw, MOUTH)), morphed(throat(0.17, 0.42, -0.08)), morphed(throat(0.15, 0.22, -0.06))]);
    face.morphTargetsRelative = true; // 합치면 이 표시가 사라진다. 까만 덩어리 둘은 벌어진 입으로 몸이 보이지 않게 막는다
    this.face = this.add(this.head, face, skin, true, 0, -PIVOT, 0);

    const armLen = UPPER + FORE + PALM;
    const legLen = THIGH + SHIN;
    this.legs = [-1, 1].map((side) => {
      const hip = rig.bone(this.hips, side * HIP_X, -0.08);
      rig.part('body', hip, mergeGeometries([knob(0.062, 0, -0.02, 0, skinUv), limb(THIGH, (t) => lerp(0.06, 0.036, smooth(t)), { rows: 6, segs: 6, uv: stripUv(LEG_CELL, THIGH, 0, THIGH / legLen) })]));
      const knee = rig.bone(hip, 0, -THIGH);
      rig.part('body', knee, mergeGeometries([knob(0.04, 0, -0.005, 0.005, skinUv), limb(SHIN, (t) => 0.026 + 0.01 * Math.sin(t * Math.PI), { rows: 6, segs: 6, uv: stripUv(LEG_CELL, SHIN, THIGH / legLen, 1) })]));
      const ankle = rig.bone(knee, 0, -SHIN);
      rig.part('body', ankle, footGeometry(side));
      return { hip, knee, ankle, phase: side > 0 ? 0 : Math.PI };
    });

    this.arms = [-1, 1].map((side) => {
      const shoulder = rig.bone(this.spine, side * SHOULDER.x, SHOULDER.y, 0);
      rig.part('body', shoulder, mergeGeometries([knob(0.05, 0, 0, 0, skinUv), limb(UPPER, (t) => lerp(0.042, 0.03, t), { rows: 5, segs: 6, uv: stripUv(ARM_CELL, UPPER, 0, UPPER / armLen) })]));
      const elbow = rig.bone(shoulder, 0, -UPPER);
      rig.part('body', elbow, mergeGeometries([knob(0.03, 0, 0, 0, skinUv), limb(FORE, (t) => lerp(0.031, 0.021, t), { rows: 5, segs: 6, uv: stripUv(ARM_CELL, FORE, UPPER / armLen, (UPPER + FORE) / armLen) })]));
      const wrist = rig.bone(elbow, 0, -FORE);
      rig.part('body', wrist, mergeGeometries([knob(0.022, 0, 0, 0, skinUv), palmGeometry()]));
      const fingers = rig.bone(wrist, 0, -WRIST_DROP);
      rig.part('body', fingers, fingersGeometry(side));
      return { shoulder, elbow, wrist, fingers, side, phase: side > 0 ? Math.PI : 0 };
    });

    this.skin = rig.mesh('body', body, true, new THREE.Vector3(0, 1.4, 0), 2.2);
    this.skeleton = rig.bind([this.skin]);
    this.hair = this.add(this.head, hairGeometry(), hair, false, 0, -PIVOT, 0);

    this.headHeight = 2.08;
    this.faceNear = 0.85; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 입이 화면을 채운다
    this.faceTilt = 0; // 잡히는 장면의 머리 기울기. 등을 숙인 만큼 되돌려 입이 정면을 본다
    this.pose = { ...POSE.walk };
    this.phase = 0;
    this.gait = 0;
    this.sweep = 0;
    this.chew = 0;
    this.chewT = 1;
    this.mouth = 0;
    this.glow = TEETH_GLOW.patrol;
  }

  update(s, dt, player) {
    const first = !this.hasLast;
    const moved = this.track(s, dt, CELL);
    if (s.mode === 'stunned') {
      this.shake(s, this.hips, 0.014);
    } else {
      this.turn(s, dt, first);
      this.body(s, dt, moved < 1.5 ? moved : 0);
    }
    this.lightTeeth(s, dt, player);
  }

  body(s, dt, moved) {
    const goal = s.pauseT > 0 ? POSE.search : POSE[s.mode] ?? POSE.walk; // 코앞에서 멈춰 킁킁대는 동안
    const k = damp(5, dt);
    const p = this.pose;
    for (let i = 0; i < POSE_KEYS.length; i++) {
      const key = POSE_KEYS[i];
      p[key] += (goal[key] - p[key]) * k;
    }
    const speed = dt > 0 ? moved / dt : 0;
    this.gait += ((speed > 0.1 ? 1 : 0) - this.gait) * damp(7, dt);
    this.phase = (this.phase + (moved / p.stride) * TAU) % TAU;
    this.sweep = (this.sweep + dt * p.rate) % TAU;
    const sway = this.gait * Math.sin(this.phase);
    const breath = Math.sin(this.time * 1.6);

    let reachDown = 0;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      const ph = this.phase + leg.phase;
      const swing = Math.max(0, Math.cos(ph));
      const push = Math.max(0, -Math.sin(ph)) * this.gait;
      const a = -0.16 - p.drop * 2 - this.gait * p.amp * Math.sin(ph);
      const b = 0.32 + p.drop * 4 + this.gait * p.knee * swing;
      leg.hip.rotation.x = a;
      leg.knee.rotation.x = b;
      leg.ankle.rotation.x = -(a + b) + this.gait * 0.45 * swing + push * 0.45;
      reachDown = Math.max(reachDown, THIGH * Math.cos(a) + SHIN * Math.cos(a + b) + push * 0.1);
    }
    this.hips.position.set(0, reachDown + ANKLE + 0.08, -0.12 * p.lean);
    this.hips.rotation.set(0, sway * 0.1, sway * 0.04);
    this.spine.rotation.set(p.lean, sway * -0.12, 0);

    // 앞을 못 보니 머리를 좌우로 저으며 냄새를 맡는다
    const sniff = Math.sin(this.sweep) * p.sweep;
    this.faceTilt = -p.lean;
    this.head.rotation.set(-p.lean * 0.75 + 0.05 * breath, sniff, sniff * 0.22);
    this.chewT -= dt;
    if (this.chewT <= 0) {
      this.chewT = 0.5 + Math.random() * 2.2;
      this.chew = Math.random() * 0.35;
    }
    this.chew *= 1 - damp(5, dt);
    this.mouth = clamp(p.mouth + this.chew + 0.03 * breath, 0, 1);
    this.face.morphTargetInfluences[0] = this.mouth;

    // 팔은 어깨에서 옆으로 뻗어 허공을 더듬는다
    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i];
      const feel = Math.sin(this.time * 1.9 + arm.phase);
      const swing = this.gait * Math.sin(this.phase + arm.phase) * (1 - p.reach);
      const out = lerp(0.2, 0.9, p.spread) + 0.06 * feel;
      arm.shoulder.rotation.set(-p.lean - p.reach * 1.2 + swing * 0.3 + 0.1 * feel, 0, arm.side * out);
      arm.elbow.rotation.set(-0.1 - p.reach * 0.2, 0, arm.side * 0.08);
      arm.wrist.rotation.set(p.reach * 0.3, 0, -arm.side * (out * 0.9));
      arm.fingers.rotation.set(0.15 * Math.sin(this.time * 4.3 + arm.phase) - p.reach * 0.5, 0, 0);
    }
  }

  // 눈이 없으니 어둠에서는 이빨이 희미하게 뜬다
  lightTeeth(s, dt, player) {
    const goal = TEETH_GLOW[s.mode] ?? TEETH_GLOW.patrol;
    this.glow += (goal - this.glow) * damp(5, dt);
    const far = clamp(Math.hypot(player.x - s.x, player.y - s.y) / TOOTH_FAR, 0, 1);
    this.faceMat.emissiveIntensity = this.glow * TOOTH_LIGHT * lerp(TOOTH_NEAR, 1, far);
  }
}
