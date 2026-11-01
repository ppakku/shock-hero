// 눈뜬이: 아이 그림(3487)과 초상화를 따라 Gemini 가 그린 앞뒤 그림을 입힌다. 달걀처럼 긴 머리, 가는 목, 고깔 몸. 팔다리는 없다. 앞은 +Z 다.
// 바라보는 동안에는 몸이 완전히 굳고 눈동자만 주인공을 따라온다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, EYE_GLOW, damp, lookYaw, wrapAngle } from './creatureBase.js';
import { TAU, clamp, lerp, sampleKeys, surface } from './creatureGeometry.js';
import { disc, shellHead, throat, warp } from './creatureShell.js';

const bump = (d, r) => Math.exp(-(d * d) / (r * r));

// 치수는 Gemini 그림의 윤곽에서 쟀다 (tools/make_gazer_art.py 가 찍어 준다). 키는 2.7m
const HEAD_H = 1.05;
const CHIN_Y = 1.65; // 턱 끝 높이
const PIVOT = 0.3; // 머리 받침점 (턱에서 잰 높이). 잡히는 장면에서 눈과 입이 함께 화면에 들어온다
const MOUTH = { y: 0.277, w: 0.56, x: 0.122, drop: 0.1 }; // 그림 속 까만 입안을 가르는 선의 높이, 입꼬리 각도와 반폭, 쫓을 때 내려가는 턱
const EYE = { x: 0.14, y: 0.685, r: 0.056, iris: 0.034 };
const NOSE = { y: 0.45, top: 0.71 };
const HEAD_KEYS = [ // [높이, 반폭, 반두께, 앞뒤 치우침]
  [HEAD_H, 0.01, 0.01, -0.03], [1.046, 0.05, 0.055, -0.03], [1.035, 0.09, 0.095, -0.03], [1.015, 0.13, 0.135, -0.03], [0.977, 0.184, 0.19, -0.03], [0.908, 0.238, 0.25, -0.03], [0.838, 0.265, 0.28, -0.03], [0.768, 0.275, 0.29, -0.03],
  [0.698, 0.276, 0.285, -0.03], [0.628, 0.271, 0.275, -0.025], [0.559, 0.28, 0.265, -0.02], [0.489, 0.253, 0.24, -0.01], [0.419, 0.228, 0.215, 0],
  [0.349, 0.212, 0.195, 0.01], [0.279, 0.202, 0.18, 0.02], [0.209, 0.187, 0.16, 0.03], [0.14, 0.157, 0.135, 0.04], [0.07, 0.127, 0.105, 0.045], [0, 0.03, 0.03, 0.05],
];
// 목에서 바닥까지 넓어지는 고깔: [높이, 반폭, 반두께]
const BODY_TOP = 1.75;
const BODY_KEYS = [
  [BODY_TOP + 0.02, 0.02], [BODY_TOP, 0.135], [1.62, 0.14], [1.52, 0.18], [1.42, 0.27], [1.3, 0.31], [1.1, 0.34], [0.9, 0.37], [0.7, 0.4], [0.5, 0.43], [0.3, 0.47], [0.12, 0.52], [0, 0.55],
].map(([y, hw]) => [y, hw, hw * 0.8, 0]);
const FRONT_HEAD = 2 / 3; // 그림 폭 가운데 앞면이 차지하는 몫. 양쪽 끝이 뒷면이다
const FRONT_BODY = 1 / 2;
const BEND = 0.96; // 이 각도까지는 정면 그림 그대로, 그 뒤로는 옆구리로 곧게 잇는다 (옆에서 봐도 줄무늬로 늘어지지 않게)
const HEM_Y = 0.55; // 이 아래 옷자락이 흔들린다

const POSE = {
  walk: { lean: 0.03, nod: 0.02, mouth: 0 },
  chase: { lean: 0.17, nod: 0.12, mouth: 1 },
};
const POSE_KEYS = Object.keys(POSE.walk);
const SKIN_COLOR = 0x6a6e5e; // 그림이 없을 때 머리 색
const ROBE_COLOR = 0x3f4238; // 그림이 없을 때 몸 색
const WHITE_COLOR = 0xdfe6c4; // 그림이 없을 때 흰자 색
const RING_COLOR = 0x0a0a08; // 그림이 없을 때 눈동자 색
const TINT = 0x8c9a92; // 따뜻한 손전등 아래서도 그림의 회록색이 남게 붉은빛을 뺀다
const HEAD_TINT = 0x626b66; // 머리 그림은 몸보다 훨씬 밝아서 더 누른다
const FACE_GLOW = 0.1; // 어둠에서 얼굴이 희미하게 뜨는 세기
const LIT = new THREE.Color(0xffffff);
const PLAIN_WHITE = new THREE.Color(WHITE_COLOR);
const PLAIN_RING = new THREE.Color(RING_COLOR);

const bent = (a) => (a < BEND ? Math.sin(a) : Math.sin(BEND) + Math.cos(BEND) * (a - BEND));
const SIDE = bent(Math.PI / 2);

// 각도 w 를 그림의 가로 자리로 바꾼다. 가운데가 앞면, 양쪽 끝이 뒷면이다
function wrapU(w, front) {
  const a = Math.abs(w);
  const u = a <= Math.PI / 2 ? (front / 2) * bent(a) / SIDE : front / 2 + (0.5 - front / 2) * (1 - bent(Math.PI - a) / SIDE);
  return 0.5 + Math.sign(w) * u;
}

const headUv = (p, t, u) => [wrapU(warp(u), FRONT_HEAD), p.y / HEAD_H];
const mouthLine = () => MOUTH.y;

// 코, 눈두덩, 광대, 턱. 옆에서 봐도 얼굴 윤곽이 보이게 한다
function relief(x, y) {
  const ax = Math.abs(x);
  const up = clamp((y - NOSE.y) / (NOSE.top - NOSE.y), 0, 1);
  const ridge = y > NOSE.y ? lerp(0.06, 0.02, up) * bump(x, lerp(0.05, 0.03, up)) * bump(Math.max(0, y - NOSE.top), 0.04) : 0;
  return ridge
    + 0.075 * bump(x, 0.06) * bump(y - NOSE.y, 0.05)
    - 0.03 * bump((ax - EYE.x) / 0.1, 1) * bump((y - EYE.y) / 0.11, 1)
    + 0.02 * bump(y - (EYE.y + 0.13), 0.04) * bump(ax - EYE.x, 0.13)
    + 0.015 * bump(ax - 0.19, 0.05) * bump(y - 0.5, 0.07);
}

// 아래턱을 따로 잘라 돌리지 않고 입 둘레만 늘린다. 입꼬리는 그대로라서 볼에 틈이 생기지 않는다
function jawMorph(g) {
  const pos = g.attributes.position;
  const d = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const reach = MOUTH.x + 0.6 * (MOUTH.y - pos.getY(i)); // 입꼬리는 그대로 두고, 아래로 갈수록 턱 전체가 함께 내려간다
    const open = (1 - clamp(Math.abs(pos.getX(i)) / reach, 0, 1) ** 4) * clamp((pos.getZ(i) + 0.1) / 0.12, 0, 1);
    d[i * 3 + 1] = -MOUTH.drop * open;
    d[i * 3 + 2] = -0.3 * MOUTH.drop * open;
  }
  return d;
}

function morphed(g, delta = new Float32Array(g.attributes.position.count * 3)) {
  g.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)];
  g.morphTargetsRelative = true;
  return g;
}

function bodyAt(y, w, out) {
  const [hw, hd, cz] = sampleKeys(BODY_KEYS, y);
  const low = clamp((1 - y) / 0.8, 0, 1); // 그림의 긴 주름을 따라 옷자락이 물결친다
  const fold = 1 + low * 0.03 * Math.sin(w * 7 + 0.6) + low * 0.016 * Math.sin(w * 13 + y * 3);
  return out.set(Math.sin(w) * hw * fold, y, Math.cos(w) * hd * fold + cz);
}

function bodyGeometry() {
  return surface({
    rows: 22,
    segs: 40,
    at: (t, w, out) => bodyAt(lerp(BODY_KEYS[0][0], 0, t), w, out),
    uv: (p, t, w) => [wrapU(w, FRONT_BODY), Math.min(1, p.y / BODY_TOP)],
    shade: (p) => lerp(0.62, 1, clamp(p.y / 0.5, 0, 1)),
  });
}

// 그림에서 뜬 흰자와 고리 눈동자. 왼쪽 눈은 거울처럼 뒤집어 쓴다
function eyeGeometries() {
  const white = (frontZ) => [-1, 1].map((side) => {
    const g = disc({
      rx: EYE.r,
      ry: EYE.r,
      rings: [[0, 1], [0.5, 1], [0.86, 0.96], [1, 0.45]],
      uv: (p) => [0.5 + (side * 0.42 * p.x) / EYE.r, 0.5 + (0.42 * p.y) / EYE.r],
      depth: (x, y, r) => frontZ(side * EYE.x + x, EYE.y + y) + 0.007 * (1 - r * r) + 0.002,
    });
    g.translate(side * EYE.x, EYE.y, 0);
    return g;
  });
  const ring = (frontZ, side) => disc({
    rx: EYE.iris,
    ry: EYE.iris,
    rings: [[0, 1], [0.5, 1], [1, 1]],
    uv: (p) => [0.5 + (side * 0.5 * p.x) / EYE.iris, 0.5 + (0.5 * p.y) / EYE.iris],
    depth: (x, y, r) => frontZ(side * EYE.x + x, EYE.y + y) - frontZ(side * EYE.x, EYE.y) + 0.007 * (1 - (r * EYE.iris / EYE.r) ** 2) + 0.006,
  });
  return { white, ring };
}

export class GazerModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const matte = (o) => new THREE.MeshLambertMaterial(o); // 반사가 없어야 그림의 까만 입안과 먹선이 손전등 아래서도 까맣다
    const skin = this.paper('art/horror_gazer_head.jpg', SKIN_COLOR, HEAD_TINT, matte);
    skin.emissive = new THREE.Color(0xffffff);
    skin.emissiveMap = skin.map;
    this.faceMat = skin;
    const robe = this.paper('art/horror_gazer_body.jpg', ROBE_COLOR, TINT, matte);
    const glow = (o) => new THREE.MeshBasicMaterial({ ...o, fog: false });
    this.whiteMat = this.paper('art/horror_gazer_white.jpg', WHITE_COLOR, 0xffffff, glow); // 흰자는 어둠에서도 희미하게 뜬다
    this.ringMat = this.paper('art/horror_gazer_iris.jpg', RING_COLOR, 0xffffff, glow);

    this.root = this.pivot(this.group);
    this.bodyMesh = this.add(this.root, bodyGeometry(), robe, true);
    this.neck = this.pivot(this.root, 0, 1.62);
    this.head = this.pivot(this.neck, 0, CHIN_Y + PIVOT - 1.62);
    this.head.rotation.order = 'YXZ';
    const inner = this.pivot(this.head, 0, -PIVOT);

    const shell = shellHead({ keys: HEAD_KEYS, edgeU: mouthLine, edgeL: mouthLine, mouthW: MOUTH.w, relief, uv: headUv, lipShade: 0, rows: 26, segs: 44 });
    const jaw = morphed(shell.jaw, jawMorph(shell.jaw));
    const face = mergeGeometries([morphed(shell.skull), jaw, morphed(throat(0.12, 0.3, -0.03)), morphed(throat(0.125, 0.17, 0.03))]);
    face.morphTargetsRelative = true; // 합치면 이 표시가 사라진다. 까만 덩어리 둘은 벌어진 입으로 목이 보이지 않게 막는다
    this.face = this.add(inner, face, skin, true);

    const eyes = eyeGeometries();
    this.add(inner, mergeGeometries(eyes.white(shell.frontZ)), this.whiteMat, false).renderOrder = 1;
    this.pupils = [-1, 1].map((side) => {
      const x = side * EYE.x;
      const m = this.add(inner, eyes.ring(shell.frontZ, side), this.ringMat, false, x, EYE.y, shell.frontZ(x, EYE.y));
      m.renderOrder = 2;
      return { mesh: m, x, y: EYE.y };
    });
    this.eyes = this.pupils.map((p) => ({ center: p.mesh.position }));

    this.setupHem();
    this.headHeight = CHIN_Y + 0.7;
    this.faceNear = 0.95; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 얼굴이 카메라에 파고들지 않는다
    this.pose = { ...POSE.walk };
    this.phase = 0;
    this.gait = 0;
    this.lookY = 0;
    this.lookX = 0;
    this.tilt = 0;
    this.tiltGoal = 0;
    this.gape = 0;
    this.mouth = 0;
    this.driftT = 0;
    this.gazeX = 0;
    this.gazeY = 0;
    this.pupilScale = 1;
    this.frozen = false;
  }

  setupHem() {
    const pos = this.bodyMesh.geometry.attributes.position;
    const list = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < HEM_Y) list.push(i);
    this.hem = {
      index: Uint32Array.from(list),
      x: Float32Array.from(list, (i) => pos.getX(i)),
      z: Float32Array.from(list, (i) => pos.getZ(i)),
      weight: Float32Array.from(list, (i) => (1 - pos.getY(i) / HEM_Y) ** 2),
      angle: Float32Array.from(list, (i) => Math.atan2(pos.getX(i), pos.getZ(i))),
    };
  }

  update(s, dt, player) {
    const first = !this.hasLast;
    const moved = this.track(s, dt, CELL);
    this.frozen = s.mode === 'watch'; // 주인공이 바라보는 동안
    if (s.mode === 'stunned') {
      this.shake(s, this.root, 0.012);
    } else if (!this.frozen) {
      this.turn(s, dt, first);
      this.body(s, dt, moved < 1.5 ? moved : 0, player);
      this.look(s, dt, player);
    }
    this.gaze(s, dt, player);
    this.lightEyes(s, dt);
  }

  // 안 보는 사이에만 자세가 바뀐다: 다시 볼 때마다 다른 모습으로 서 있다
  body(s, dt, moved, player) {
    const goal = POSE[s.mode] ?? POSE.walk;
    const k = damp(6, dt);
    const p = this.pose;
    for (let i = 0; i < POSE_KEYS.length; i++) {
      const key = POSE_KEYS[i];
      p[key] += (goal[key] - p[key]) * k;
    }
    const speed = dt > 0 ? moved / dt : 0;
    this.gait += ((speed > 0.1 ? 1 : 0) - this.gait) * damp(7, dt);
    this.phase = (this.phase + dt * lerp(1.4, 6, this.gait)) % TAU;
    this.driftT -= dt;
    if (this.driftT <= 0) {
      this.driftT = 0.7 + Math.random() * 0.8;
      this.tiltGoal = (Math.random() - 0.5) * 0.44;
      this.gape = Math.random() * 0.2;
    }
    this.tilt += (this.tiltGoal - this.tilt) * damp(9, dt);
    const near = 1 - clamp(Math.hypot(player.x - s.x, player.y - s.y) / LOOK_NEAR, 0, 1); // 가까울수록 입이 벌어진다
    this.root.rotation.set(p.lean, 0, 0.02 * this.gait * Math.sin(this.phase));
    this.root.position.y = 0.012 * this.gait * Math.sin(this.phase * 2);
    this.neck.rotation.z = this.tilt;
    this.mouth = clamp(p.mouth + this.gape + near * 0.5, 0, 1);
    this.face.morphTargetInfluences[0] = this.mouth;
    if (this.group.visible) this.rippleHem();
  }

  rippleHem() {
    const { index, x, z, weight, angle } = this.hem;
    const pos = this.bodyMesh.geometry.attributes.position;
    const a = pos.array;
    const t = this.phase;
    const amp = lerp(0.03, 0.09, this.gait);
    for (let i = 0; i < index.length; i++) {
      const r = 1 + amp * weight[i] * (Math.sin(angle[i] * 5 + t) + 0.6 * Math.sin(angle[i] * 3 - t * 2));
      const k = index[i] * 3;
      a[k] = x[i] * r;
      a[k + 2] = z[i] * r;
    }
    pos.needsUpdate = true;
  }

  look(s, dt, player) {
    const yaw = lookYaw(s, this.yaw, player);
    const k = damp(5, dt);
    this.lookY += (yaw - this.lookY) * k;
    this.lookX += (this.pose.nod - this.lookX) * k;
    this.head.rotation.set(this.lookX, this.lookY, 0);
  }

  // 눈동자는 언제나 주인공을 따라온다. 얼음처럼 굳어 있을 때도 이것만 움직인다
  gaze(s, dt, player) {
    const off = wrapAngle(Math.atan2(player.x - s.x, player.y - s.y) - this.yaw - this.lookY);
    const dist = Math.hypot(player.x - s.x, player.y - s.y) * CELL;
    const goalX = Math.abs(off) < 1.5 ? clamp(off / 0.9, -1, 1) : 0;
    const goalY = -clamp(1.1 / Math.max(1, dist), 0, 0.6);
    const k = damp(this.frozen ? 14 : 7, dt);
    this.gazeX += (goalX - this.gazeX) * k;
    this.gazeY += (goalY - this.gazeY) * k;
    for (let i = 0; i < this.pupils.length; i++) {
      const p = this.pupils[i];
      p.mesh.position.x = p.x + this.gazeX * GAZE;
      p.mesh.position.y = p.y + this.gazeY * GAZE;
    }
  }

  lightEyes(s, dt) {
    const goal = this.frozen ? 1 : EYE_GLOW[s.mode] ?? EYE_GLOW.patrol;
    this.glow += (goal - this.glow) * damp(s.mode === 'chase' || this.frozen ? 9 : 4, dt);
    const light = 0.3 + 0.6 * this.glow;
    this.faceMat.emissiveIntensity = FACE_GLOW * (0.4 + this.glow);
    this.whiteMat.color.copy(this.whiteMat.map ? LIT : PLAIN_WHITE).multiplyScalar(light);
    this.ringMat.color.copy(this.ringMat.map ? LIT : PLAIN_RING).multiplyScalar(light);
    // 흥분할수록 눈동자가 바늘처럼 작아진다
    const size = lerp(1.1, 0.72, this.glow);
    if (size !== this.pupilScale) {
      this.pupilScale = size;
      this.pupils[0].mesh.scale.set(size, size, 1);
      this.pupils[1].mesh.scale.set(size, size, 1);
    }
  }
}

const LOOK_NEAR = 6; // 이 칸 안에서 입이 점점 벌어진다
const GAZE = EYE.r - EYE.iris - 0.002; // 눈동자가 흰자 안에서 움직이는 거리
