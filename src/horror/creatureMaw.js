// 큰입이: 아이 그림(3488)을 따라 눈 없이 머리 전체가 입이고, 위에 엉킨 머리털, 옆으로 뻗은 긴 팔과 가는 손가락,
// 좁은 몸, 긴 다리를 짠다. 앞은 +Z 다. 못 보는 괴물이라 주인공을 쳐다보지 않고, 손을 벌려 더듬으며 냄새를 맡는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, Rig, damp } from './creatureBase.js';
import { ANKLE, TAU, bone, clamp, digit, footGeometry, knob, lerp, limb, sampleKeys, smooth, surface } from './creatureGeometry.js';
import { shellHead, throat, toothRow } from './creatureShell.js';

// 그림의 키는 2.7m. 머리와 머리털이 키의 40% 다
const THIGH = 0.5;
const SHIN = 0.5;
const UPPER = 0.33;
const FORE = 0.33;
const HIPS_Y = 1.1;
const SPINE_UP = 0.06;
const CHIN_Y = 1.68;
const PIVOT = 0.22; // 머리 받침점 (턱에서 잰 높이). 잡히는 장면에서 입이 화면 가운데 온다
const SHOULDER = { x: 0.25, y: 0.52 }; // 허리에서 잰 어깨 자리
const HINGE = { y: 0.38, z: -0.17 };
const LIP = { top: 0.7, bottom: 0.04 };
const MOUTH_W = 1.42;
const HEAD_KEYS = [
  [0.84, 0.02, 0.02, -0.01],
  [0.82, 0.13, 0.12, -0.01],
  [0.75, 0.215, 0.19, -0.01],
  [0.62, 0.265, 0.23, 0],
  [0.48, 0.28, 0.245, 0],
  [0.3, 0.285, 0.25, 0],
  [0.15, 0.265, 0.23, 0.005],
  [0.06, 0.2, 0.175, 0.005],
  [0, 0.03, 0.03, 0],
];
const TORSO_KEYS = [
  [0.6, 0.03, 0.03, 0],
  [0.59, 0.19, 0.12, 0],
  [0.55, 0.25, 0.15, 0],
  [0.47, 0.215, 0.13, 0],
  [0.32, 0.165, 0.105, 0],
  [0.1, 0.145, 0.095, 0],
  [-0.05, 0.15, 0.1, 0],
  [-0.13, 0.125, 0.09, 0],
  [-0.18, 0.03, 0.03, 0],
];

const POSE = {
  walk: { lean: 0.1, spread: 1, reach: 0, amp: 0.4, knee: 0.7, stride: 2.8, mouth: 0.25, drop: 0, sweep: 0.3, rate: 0.9 },
  rush: { lean: 0.62, spread: 0.55, reach: 1, amp: 0.8, knee: 1.15, stride: 3.8, mouth: 1, drop: 0.12, sweep: 0.08, rate: 7 },
  sniff: { lean: 0.42, spread: 0.85, reach: 0.25, amp: 0.3, knee: 0.6, stride: 2.2, mouth: 0.45, drop: 0.06, sweep: 0.7, rate: 2.6 },
  watch: { lean: 0.05, spread: 1, reach: 0, amp: 0.4, knee: 0.7, stride: 2.8, mouth: 0.1, drop: 0, sweep: 0.1, rate: 0.5 },
  ambush: { lean: 0.3, spread: 0.3, reach: 0, amp: 0.4, knee: 0.7, stride: 2.8, mouth: 0.05, drop: 0.12, sweep: 0, rate: 0.5 },
};
POSE.chase = POSE.rush;
POSE.search = POSE.sniff;
POSE.investigate = POSE.sniff;
const POSE_KEYS = Object.keys(POSE.walk);
const SKIN_COLOR = 0x2e2522; // 그림이 없을 때 살색
const HAIR_COLOR = 0x12160f; // 그림이 없을 때 머리털 색
const TEETH_GLOW = { patrol: 0.3, investigate: 0.45, search: 0.45, sniff: 0.45, rush: 1, chase: 1, stunned: 0.05, ambush: 0.05, watch: 0.3 };
const TOOTH_LIGHT = 0.3; // 어둠 속에서 이빨이 뜨는 세기

function edgeU(w) {
  const a = clamp(Math.abs(w) / MOUTH_W, 0, 1);
  return lerp(HINGE.y, LIP.top, 1 - a ** 2.6);
}

function edgeL(w) {
  const a = clamp(Math.abs(w) / MOUTH_W, 0, 1);
  return lerp(HINGE.y, LIP.bottom, 1 - a ** 2.6);
}

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

// 머리털: 낮은 덩어리 위에 낙서처럼 엉킨 가닥을 얹고, 이마 쪽은 삐죽한 띠가 두른다
function hairGeometry() {
  const rand = seeded(3488);
  const cy = 0.8;
  const mound = surface({
    rows: 8,
    segs: 18,
    uv: (p, t, w) => [(w / Math.PI) * 1.5, p.y * 2.5],
    shade: () => 0.75,
    at: (t, w, out) => {
      const a = t * Math.PI;
      const bumpy = 1 + 0.09 * Math.sin(w * 7 + t * 9) * Math.sin(a);
      return out.set(Math.sin(w) * Math.sin(a) * 0.31 * bumpy, cy + Math.cos(a) * 0.2 * bumpy, Math.cos(w) * Math.sin(a) * 0.28 * bumpy - 0.01);
    },
  });
  const parts = [mound];
  const dot = (x, y, z, r) => [x * r, cy + y * r * 0.72, z * r * 0.92];
  for (let i = 0; i < 38; i++) {
    let a = rand() * TAU;
    let e = rand() * 1.3;
    const step = 0.5 + rand() * 0.5;
    let p = null;
    for (let n = 0; n < 5; n++) {
      a += (rand() - 0.5) * step * 2;
      e += (rand() - 0.5) * step;
      const r = 0.31 + rand() * 0.075;
      const q = dot(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e), r);
      if (q[1] < 0.66) q[1] = 0.66;
      if (p) parts.push(bone(p, q, 0.009, 0.008, 0.5 + rand() * 0.7));
      p = q;
    }
  }
  // 이마 띠: 그림의 들쭉날쭉한 윤곽선
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const b = a + TAU / 26;
    const r0 = 0.31;
    const y0 = 0.68 + (i % 2 ? 0.05 : -0.03);
    const y1 = 0.68 + (i % 2 ? -0.03 : 0.05);
    parts.push(bone([Math.sin(a) * r0, y0, Math.cos(a) * r0 * 0.9], [Math.sin(b) * r0, y1, Math.cos(b) * r0 * 0.9], 0.012, 0.011, 0.6));
  }
  return mergeGeometries(parts);
}

function torsoGeometry() {
  const top = TORSO_KEYS[0][0];
  const bottom = TORSO_KEYS[TORSO_KEYS.length - 1][0];
  return surface({
    rows: 16,
    segs: 14,
    uv: (p, t, w) => [w / Math.PI, p.y * 1.4],
    shade: (p, t, w) => lerp(0.75, 1, Math.max(0, Math.cos(w))),
    at: (t, w, out) => {
      const y = lerp(top, bottom, t);
      const [hw, hd, cz] = sampleKeys(TORSO_KEYS, y);
      return out.set(Math.sin(w) * hw, y, Math.cos(w) * hd + cz);
    },
  });
}

// 그림처럼 아래로 늘어진 다섯 손가락
function fingersGeometry() {
  const parts = [];
  [[-0.05, -0.028, 0.33], [-0.025, -0.012, 0.4], [0, 0, 0.42], [0.025, 0.012, 0.4], [0.05, 0.028, 0.33]].forEach(([x, fan, l]) => {
    parts.push(...digit([
      [x, 0, 0],
      [x + fan * 0.6, -l * 0.42, -0.006],
      [x + fan, -l * 0.8, -0.02],
      [x + fan * 1.2, -l, -0.05],
    ], 0.011));
  });
  return mergeGeometries(parts);
}

function palmGeometry() {
  return surface({
    rows: 4,
    segs: 6,
    uv: (p, t, w) => [w / Math.PI, p.y],
    at: (t, w, out) => {
      const close = Math.min(1, Math.min(t, 1 - t) * 10 + 0.2);
      return out.set(Math.sin(w) * 0.062 * close, -t * 0.09, Math.cos(w) * 0.018 * close);
    },
  });
}

export class MawModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const skin = this.paper('art/horror_maw_skin.jpg', SKIN_COLOR);
    const hair = this.paper('art/horror_maw_hair.jpg', HAIR_COLOR, 0x9a9a9a);
    this.teethMat = new THREE.MeshStandardMaterial({ color: 0x8c8672, roughness: 0.6, vertexColors: true, emissive: 0xe6ddbe, emissiveIntensity: 0, fog: false });

    const rig = new Rig(this.group);
    this.hips = rig.bone(null, 0, HIPS_Y, 0);
    rig.part('body', this.hips, limbBlock());
    this.spine = rig.bone(this.hips, 0, SPINE_UP, 0);
    rig.part('body', this.spine, torsoGeometry());

    this.head = rig.bone(this.spine, 0, CHIN_Y + PIVOT - HIPS_Y - SPINE_UP, 0.0);
    this.head.rotation.order = 'YXZ';
    const shell = shellHead({ keys: HEAD_KEYS, edgeU, edgeL, mouthW: MOUTH_W, rows: 18 });
    rig.part('body', this.head, mergeGeometries([shell.skull, throat(0.16, 0.32, -0.06)]), 0, -PIVOT, 0);
    this.jaw = rig.bone(this.head, 0, HINGE.y - PIVOT, HINGE.z);
    const jaw = mergeGeometries([shell.jaw, throat(0.13, 0.15, -0.03)]); // 벌어진 입으로 몸이 보이지 않게 막는다
    jaw.translate(0, -HINGE.y, -HINGE.z);
    rig.part('body', this.jaw, jaw);

    const on = (edge, k) => (w, out) => shell.point(edge(w), w, k, out);
    const reach = MOUTH_W * 0.86;
    const longTop = (u) => lerp(0.34, 0.1, u * u);
    const longLow = (u) => lerp(0.27, 0.09, u * u);
    const teethU = mergeGeometries([
      ...toothRow({ count: 13, reach, width: 0.024, base: on(edgeU, 0.97), sign: -1, length: longTop, inward: 0.06 }),
      ...toothRow({ count: 12, reach: reach * 0.9, width: 0.02, base: on(edgeU, 0.9), sign: -1, length: (u) => longTop(u) * 0.8, inward: 0.1, tone: 0.72 }),
    ]);
    rig.part('teeth', this.head, teethU, 0, -PIVOT, 0);
    const teethL = mergeGeometries([
      ...toothRow({ count: 13, reach, width: 0.023, base: on(edgeL, 0.97), sign: 1, length: longLow, inward: 0.06 }),
      ...toothRow({ count: 12, reach: reach * 0.9, width: 0.019, base: on(edgeL, 0.9), sign: 1, length: (u) => longLow(u) * 0.8, inward: 0.1, tone: 0.72 }),
    ]);
    teethL.translate(0, -HINGE.y, -HINGE.z);
    rig.part('teeth', this.jaw, teethL);

    this.legs = [-1, 1].map((side) => {
      const hip = rig.bone(this.hips, side * 0.09, -0.08);
      rig.part('body', hip, mergeGeometries([knob(0.062, 0, -0.02), limb(THIGH, (t) => lerp(0.06, 0.03, smooth(t)), { rows: 6 })]));
      const knee = rig.bone(hip, 0, -THIGH);
      rig.part('body', knee, mergeGeometries([knob(0.044, 0, -0.005, 0.01), limb(SHIN, (t) => 0.024 + 0.008 * Math.sin(t * Math.PI), { rows: 6 })]));
      const ankle = rig.bone(knee, 0, -SHIN);
      const foot = footGeometry();
      foot.scale(side, 1, 1);
      if (side < 0) flipWinding(foot);
      rig.part('body', ankle, foot);
      return { hip, knee, ankle, phase: side > 0 ? 0 : Math.PI };
    });

    this.arms = [-1, 1].map((side) => {
      const shoulder = rig.bone(this.spine, side * SHOULDER.x, SHOULDER.y, 0);
      rig.part('body', shoulder, mergeGeometries([knob(0.05), limb(UPPER, (t) => lerp(0.04, 0.026, t), { rows: 5 })]));
      const elbow = rig.bone(shoulder, 0, -UPPER);
      rig.part('body', elbow, mergeGeometries([knob(0.03), limb(FORE, (t) => lerp(0.027, 0.018, t), { rows: 5 })]));
      const wrist = rig.bone(elbow, 0, -FORE);
      rig.part('body', wrist, mergeGeometries([knob(0.024), palmGeometry()]));
      const fingers = rig.bone(wrist, 0, -0.085);
      rig.part('body', fingers, fingersGeometry());
      return { shoulder, elbow, wrist, fingers, side, phase: side > 0 ? Math.PI : 0 };
    });

    const middle = new THREE.Vector3(0, 1.4, 0);
    this.skin = rig.mesh('body', skin, true, middle, 2.2);
    this.teeth = rig.mesh('teeth', this.teethMat, false, middle, 2.2);
    this.skeleton = rig.bind([this.skin, this.teeth]);
    this.hair = this.add(this.head, hairGeometry(), hair, true, 0, -PIVOT, 0);

    this.headHeight = CHIN_Y + 0.4;
    this.faceNear = 1.05; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 긴 이빨이 카메라를 뚫지 않는다
    this.pose = { ...POSE.walk };
    this.phase = 0;
    this.gait = 0;
    this.sweep = 0;
    this.chew = 0;
    this.chewT = 1;
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
    const goal = POSE[s.mode] ?? POSE.walk;
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
    this.head.rotation.set(-p.lean * 0.75 + 0.05 * breath, sniff, sniff * 0.22);
    this.chewT -= dt;
    if (this.chewT <= 0) {
      this.chewT = 0.5 + Math.random() * 2.2;
      this.chew = Math.random() * 0.35;
    }
    this.chew *= 1 - damp(5, dt);
    this.jaw.rotation.x = lerp(-0.1, 0.3, clamp(p.mouth + this.chew + 0.03 * breath, 0, 1));

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
  lightTeeth(s, dt) {
    const goal = TEETH_GLOW[s.mode] ?? TEETH_GLOW.patrol;
    this.glow += (goal - this.glow) * damp(5, dt);
    this.teethMat.emissiveIntensity = this.glow * TOOTH_LIGHT;
  }
}

// 왼쪽으로 뒤집은 그물이 안쪽을 보지 않게 삼각형 순서를 바꾼다
function flipWinding(g) {
  const a = g.index.array;
  for (let i = 0; i < a.length; i += 3) {
    const t = a[i + 1];
    a[i + 1] = a[i + 2];
    a[i + 2] = t;
  }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setX(i, -n.getX(i));
}

function limbBlock() {
  return surface({
    rows: 8,
    segs: 10,
    uv: (p, t, w) => [w / Math.PI, p.y],
    at: (t, w, out) => {
      const y = lerp(0.04, -0.17, t);
      const close = Math.sin(t * Math.PI) ** 0.5;
      return out.set(Math.sin(w) * 0.15 * close, y, Math.cos(w) * 0.095 * close);
    },
  });
}
