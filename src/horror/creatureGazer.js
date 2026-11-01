// 눈뜬이: 아이 그림(3487)을 따라 달걀처럼 긴 머리, 큰 고리 눈, 큰 입, 가는 목, 고깔 몸을 짠다. 팔다리는 없다. 앞은 +Z 다.
// 바라보는 동안에는 몸이 완전히 굳고 눈동자만 주인공을 따라온다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, EYE_GLOW, damp, lookYaw, wrapAngle } from './creatureBase.js';
import { TAU, bone, clamp, lerp, sampleKeys, smooth, surface } from './creatureGeometry.js';
import { disc, shellHead, strip, throat, toothRow } from './creatureShell.js';

const bump = (d, r) => Math.exp(-(d * d) / (r * r));

// 그림의 키는 2.7m. 머리가 키의 절반쯤을 차지한다
const HEAD_H = 1.2;
const CHIN_Y = 1.5; // 턱 끝 높이
const PIVOT = 0.47; // 머리 받침점 (턱에서 잰 높이). 잡히는 장면에서 눈과 입이 함께 화면에 들어온다
const HINGE = { y: 0.47, z: -0.08 };
const LIP = { top: 0.5, bottom: 0.05 };
const MOUTH_W = 0.97;
const EYE = { x: 0.112, y: 0.895, rx: 0.076, ry: 0.102 };
const NOSE_TIP = 0.565;
const FACE_KEYS = [
  [HEAD_H, 0.02, 0.02, -0.02],
  [1.18, 0.09, 0.09, -0.02],
  [1.12, 0.15, 0.15, -0.02],
  [1.02, 0.187, 0.18, -0.02],
  [0.9, 0.205, 0.19, -0.01],
  [0.7, 0.205, 0.185, 0],
  [0.5, 0.197, 0.175, 0],
  [0.3, 0.16, 0.15, 0.005],
  [0.12, 0.125, 0.12, 0.01],
  [0.04, 0.09, 0.09, 0.01],
  [0, 0.02, 0.02, 0.01],
];
// 목에서 바닥까지 넓어지는 고깔: [높이, 반폭, 반두께, 앞뒤 치우침]
const BODY_KEYS = [
  [1.72, 0.07, 0.07, 0],
  [1.55, 0.082, 0.08, 0],
  [1.46, 0.09, 0.088, 0],
  [1.38, 0.115, 0.105, 0],
  [1.28, 0.17, 0.135, 0],
  [1.1, 0.26, 0.195, 0],
  [0.8, 0.36, 0.27, 0],
  [0.5, 0.42, 0.31, 0],
  [0.2, 0.465, 0.34, 0],
  [0, 0.48, 0.35, 0],
];
const FOLD = [-0.45, 0.72]; // 앞판 양옆의 긴 주름 각도
const HEM_Y = 0.55; // 이 아래 옷자락이 흔들린다

const POSE = {
  walk: { lean: 0.03, nod: 0.02, mouth: 0.2 },
  chase: { lean: 0.17, nod: 0.2, mouth: 1 },
  search: { lean: 0.08, nod: 0.08, mouth: 0.45 },
  watch: { lean: 0.02, nod: 0, mouth: 0.35 },
  ambush: { lean: 0.06, nod: 0.12, mouth: 0.1 },
};
POSE.investigate = POSE.search;
const POSE_KEYS = Object.keys(POSE.walk);
const SKIN_COLOR = 0x4a4c42; // 그림이 없을 때 머리 색
const ROBE_COLOR = 0x23272c; // 그림이 없을 때 몸 색
const WHITE = new THREE.Color(0xdfe6c4);
const RING = new THREE.Color(0x9fe0ac);

// 코, 눈두덩, 볼. 옆에서 봐도 얼굴이 보이게 한다
function relief(x, y) {
  const ax = Math.abs(x);
  const noseUp = clamp((y - NOSE_TIP) / (EYE.y + 0.03 - NOSE_TIP), 0, 1);
  const ridge = y > NOSE_TIP ? lerp(0.07, 0.03, noseUp) * bump(x, lerp(0.024, 0.016, noseUp)) * (1 - smooth(clamp((y - EYE.y) / 0.08, 0, 1))) : 0;
  return ridge
    + 0.075 * bump(x, 0.034) * bump(y - NOSE_TIP, 0.034)
    + 0.022 * bump(ax - 0.036, 0.018) * bump(y - NOSE_TIP + 0.012, 0.022)
    - 0.03 * bump((ax - EYE.x) / 0.11, 1) * bump((y - EYE.y) / 0.14, 1)
    + 0.016 * bump(y - (EYE.y + 0.145), 0.03) * bump(ax - EYE.x, 0.1)
    - 0.014 * bump(ax - 0.15, 0.05) * bump(y - 0.68, 0.09);
}

// 그림의 콧대 선과 콧구멍, 눈 밑 그늘을 점 밝기로 그린다
function faceShade(x, y) {
  const ax = Math.abs(x);
  const beside = y > NOSE_TIP && y < EYE.y ? bump(ax - 0.03, 0.012) * 0.5 : 0;
  const nostril = 0.6 * bump(ax - 0.03, 0.014) * bump(y - NOSE_TIP + 0.03, 0.014);
  const socket = 0.4 * bump((ax - EYE.x) / 0.1, 1) * bump((y - EYE.y) / 0.135, 1);
  return 1 - Math.min(0.8, beside + nostril + socket);
}

function edgeU(w) {
  const a = Math.abs(w);
  const edge = LIP.top - 0.018 * (a / MOUTH_W) ** 2;
  return lerp(edge, HINGE.y, smooth(clamp((a - MOUTH_W * 0.86) / 0.22, 0, 1)));
}

function edgeL(w) {
  return lerp(LIP.bottom, HINGE.y, clamp(Math.abs(w) / MOUTH_W, 0, 1) ** 2.4);
}

function bodyAt(y, w, out) {
  const [hw, hd, cz] = sampleKeys(BODY_KEYS, y);
  const flare = clamp((1.28 - y) / 0.5, 0, 1); // 목에는 주름이 없다
  const fold = 1 - flare * (0.06 * (bump(w - FOLD[0], 0.08) + bump(w - FOLD[1], 0.08)) + 0.035 * (bump(Math.abs(w) - 1.32, 0.09)) - 0.014 * Math.sin(w * 6 + y * 2.3));
  return out.set(Math.sin(w) * hw * fold, y, Math.cos(w) * hd * fold + cz);
}

function bodyZ(x, y) {
  const [hw, hd, cz] = sampleKeys(BODY_KEYS, y);
  return Math.sqrt(Math.max(0, 1 - (x / hw) ** 2)) * hd + cz;
}

// 갈비뼈: 그림처럼 왼쪽(화면)은 길게 비스듬히, 오른쪽은 짧게 굽는다
function ribs() {
  const parts = [];
  const lift = 0.008;
  for (let i = 0; i < 7; i++) {
    const y = lerp(1.14, 0.78, i / 6);
    const len = lerp(0.19, 0.25, i / 6);
    const line = [0, 1, 2, 3].map((n) => {
      const u = n / 3;
      const x = -0.02 - u * len;
      const yy = y - u * 0.07 - 0.02 * Math.sin(u * Math.PI);
      return [x, yy, bodyZ(x, yy) + lift];
    });
    for (let n = 0; n < 3; n++) parts.push(bone(line[n], line[n + 1], 0.0085, 0.0075, 1.5));
  }
  for (let i = 0; i < 7; i++) {
    const y = lerp(1.13, 0.84, i / 6);
    const line = [0, 1, 2].map((n) => {
      const u = n / 2;
      const x = 0.03 + u * 0.07;
      const yy = y + 0.018 * Math.sin(u * Math.PI);
      return [x, yy, bodyZ(x, yy) + lift];
    });
    for (let n = 0; n < 2; n++) parts.push(bone(line[n], line[n + 1], 0.0075, 0.0065, 1.5));
  }
  return parts;
}

// 앞자락을 세로로 가르는 들쭉날쭉한 틈
function splitLine() {
  const n = 16;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const y = lerp(0.78, 0, u);
    const x = lerp(0.13, 0.07, smooth(clamp(u * 1.6, 0, 1))) + 0.13 * smooth(clamp((u - 0.62) / 0.38, 0, 1)) + (i % 2 ? 0.026 : -0.02) * (0.5 + u);
    pts.push([x, y]);
  }
  return strip(pts, (u) => lerp(0.006, 0.042, u * u), (x, y) => bodyZ(x, y) + 0.007);
}

function bodyGeometry() {
  const top = BODY_KEYS[0][0];
  const panel = (w) => (w > FOLD[0] && w < FOLD[1] ? 1 : 0.6);
  const robe = surface({
    rows: 22,
    segs: 36,
    at: (t, w, out) => bodyAt(lerp(top, 0, t), w, out),
    uv: (p, t, w) => [(w / Math.PI) * 2, p.y * 1.4],
    shade: (p, t, w) => {
      if (p.y > 1.3) return 0.9;
      const f = 1 - 0.55 * (bump(w - FOLD[0], 0.06) + bump(w - FOLD[1], 0.06));
      return panel(w) * f * lerp(0.55, 1, clamp(p.y / 0.6, 0, 1));
    },
  });
  return mergeGeometries([robe, ...ribs(), splitLine()]);
}

function eyeGeometries() {
  const head = EYE;
  const white = (frontZ) => [-1, 1].map((side) => {
    const g = disc({
      rx: head.rx,
      ry: head.ry,
      rings: [[0, 1], [0.5, 1], [0.86, 0.95], [1, 0.4]],
      depth: (x, y, r) => frontZ(side * head.x + x, head.y + y) + 0.016 * (1 - r * r) + 0.002,
    });
    g.translate(side * head.x, head.y, 0);
    return g;
  });
  // 고리 눈동자: 까만 고리, 빛나는 고리, 까만 가운데
  const ring = (frontZ, side) => disc({
    rx: head.rx * 0.74,
    ry: head.ry * 0.74,
    rings: [[0, 0], [0.34, 0], [0.4, 0.9], [0.62, 0.9], [0.68, 0], [0.92, 0], [1, 0]],
    depth: (x, y, r) => frontZ(side * head.x + x, head.y + y) + 0.016 * (1 - (r * 0.74) ** 2) + 0.009,
  });
  return { white, ring };
}

export class GazerModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const skin = this.paper('art/horror_gazer_skin.jpg', SKIN_COLOR);
    const robe = this.paper('art/horror_gazer_robe.jpg', ROBE_COLOR);

    this.root = this.pivot(this.group);
    this.bodyMesh = this.add(this.root, bodyGeometry(), robe, true);
    this.neck = this.pivot(this.root, 0, 1.62);
    this.head = this.pivot(this.neck, 0, CHIN_Y + PIVOT - 1.62);
    this.head.rotation.order = 'YXZ';
    const inner = this.pivot(this.head, 0, -PIVOT);

    const shell = shellHead({ keys: FACE_KEYS, edgeU, edgeL, mouthW: MOUTH_W, relief, skin: faceShade, rows: 24, segs: 40 });
    this.add(inner, mergeGeometries([shell.skull, throat(0.13, 0.28, -0.03)]), skin, true);
    this.jaw = this.pivot(inner, 0, HINGE.y, HINGE.z);
    shell.jaw.translate(0, -HINGE.y, -HINGE.z);
    this.add(this.jaw, shell.jaw, skin, true);

    // 이빨: 위는 네모나게, 아래는 U 자로 뾰족하게 (그림 그대로)
    this.teethMat = new THREE.MeshStandardMaterial({ color: 0x8a8670, roughness: 0.7, vertexColors: true });
    const on = (edge) => (w, out) => shell.point(edge(w), w, 0.97, out);
    const upper = toothRow({ count: 8, reach: MOUTH_W * 0.82, width: 0.024, wide: 1.1, base: on(edgeU), sign: -1, length: () => 0.1, inward: 0.03 });
    upper.forEach((t, i) => upper[i] = squareTooth(t));
    this.add(inner, mergeGeometries(upper), this.teethMat, false);
    const lower = mergeGeometries(toothRow({ count: 7, reach: MOUTH_W * 0.7, width: 0.022, base: on(edgeL), sign: 1, length: (u) => lerp(0.12, 0.06, u), inward: 0.05 }));
    lower.translate(0, -HINGE.y, -HINGE.z);
    this.add(this.jaw, lower, this.teethMat, false);

    // 눈: 흰자는 어둠에서도 희미하게 뜨고, 고리 눈동자는 따로 움직인다
    this.whiteMat = new THREE.MeshBasicMaterial({ color: WHITE.clone(), vertexColors: true, fog: false });
    this.ringMat = new THREE.MeshBasicMaterial({ color: RING.clone(), vertexColors: true, fog: false });
    const eyes = eyeGeometries();
    this.add(inner, mergeGeometries(eyes.white(shell.frontZ)), this.whiteMat, false).renderOrder = 1;
    this.pupils = [-1, 1].map((side) => {
      const x = side * EYE.x;
      const m = this.add(inner, eyes.ring(shell.frontZ, side), this.ringMat, false, x, EYE.y);
      m.renderOrder = 2;
      return { mesh: m, x, y: EYE.y };
    });
    this.eyes = this.pupils.map((p) => ({ center: p.mesh.position }));

    this.setupHem();
    this.headHeight = CHIN_Y + 0.7;
    this.faceNear = 0.8; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 얼굴이 카메라에 파고들지 않는다
    this.pose = { ...POSE.walk };
    this.phase = 0;
    this.gait = 0;
    this.lookY = 0;
    this.lookX = 0;
    this.tilt = 0;
    this.tiltGoal = 0;
    this.gape = 0;
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
    this.frozen = s.mode === 'frozen' || s.frozen === true;
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
      this.gape = Math.random() * 0.28;
    }
    this.tilt += (this.tiltGoal - this.tilt) * damp(9, dt);
    const near = 1 - clamp(Math.hypot(player.x - s.x, player.y - s.y) / LOOK_NEAR, 0, 1); // 가까울수록 입이 벌어진다
    this.root.rotation.set(p.lean, 0, 0.02 * this.gait * Math.sin(this.phase));
    this.root.position.y = 0.012 * this.gait * Math.sin(this.phase * 2);
    this.neck.rotation.z = this.tilt;
    this.jaw.rotation.x = lerp(-0.08, 0.3, clamp(p.mouth + this.gape + near * 0.5, 0, 1));
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
      p.mesh.position.x = p.x + this.gazeX * EYE.rx * 0.22;
      p.mesh.position.y = p.y + this.gazeY * EYE.ry * 0.22;
    }
  }

  lightEyes(s, dt) {
    const goal = this.frozen ? 1 : EYE_GLOW[s.mode] ?? EYE_GLOW.patrol;
    this.glow += (goal - this.glow) * damp(s.mode === 'chase' || this.frozen ? 9 : 4, dt);
    const light = 0.3 + 0.7 * this.glow;
    this.whiteMat.color.copy(WHITE).multiplyScalar(light);
    this.ringMat.color.copy(RING).multiplyScalar(light);
    // 흥분할수록 눈동자가 바늘처럼 작아진다
    const size = lerp(1.1, 0.72, this.glow);
    if (size !== this.pupilScale) {
      this.pupilScale = size;
      this.pupils[0].mesh.scale.setScalar(size);
      this.pupils[1].mesh.scale.setScalar(size);
    }
  }
}

const LOOK_NEAR = 6; // 이 칸 안에서 입이 점점 벌어진다

// 뾰족한 뿔을 그림 속 네모난 이빨로 만든다: 끝을 뭉툭하게 자른다
function squareTooth(g) {
  const p = g.attributes.position;
  let top = -Infinity;
  let bottom = Infinity;
  for (let i = 0; i < p.count; i++) {
    top = Math.max(top, p.getY(i));
    bottom = Math.min(bottom, p.getY(i));
  }
  const mid = (top + bottom) / 2;
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > mid) continue;
    cx += p.getX(i);
    cz += p.getZ(i);
    n += 1;
  }
  cx /= n;
  cz /= n;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > mid) continue;
    p.setXYZ(i, lerp(cx, p.getX(i), 7), p.getY(i), lerp(cz, p.getZ(i), 7));
  }
  return g;
}
