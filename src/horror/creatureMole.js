// 땅속이: 아이 그림(3489)을 따라 달걀 머리, 얼굴 절반을 차지한 웃는 입, 긴 코, 몸에 붙은 긴 팔, 바닥까지 끌리는 옷자락 몸을 짠다.
// 다리가 없고 땅속으로 다닌다. 땅속에서는 바닥 구멍만 움직이고, 솟아오를 때 몸이 바닥을 뚫고 올라온다. 앞은 +Z 다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cfg } from '../config/index.js';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, Rig, damp, lookYaw } from './creatureBase.js';
import { TAU, bone, clamp, digit, knob, lerp, limb, sampleKeys, surface } from './creatureGeometry.js';
import { shellHead, throat } from './creatureShell.js';

const bump = (d, r) => Math.exp(-(d * d) / (r * r));

// 치수는 Gemini 전신 그림의 윤곽에서 쟀다 (tools/make_mole_art.py 가 찍어 준다). 키는 2.7m
const CHIN_Y = 1.769;
const HEAD_H = 0.93;
const PIVOT = 0.2; // 머리 받침점 (턱에서 잰 높이). 잡히는 장면에서 눈과 입이 함께 화면에 들어온다
const HINGE = { y: 0.42, z: -0.12 };
const LIP = { mid: 0.2, rise: 0.22 }; // 위아래 이빨이 만나는 선: 가운데 높이와 입꼬리까지 오르는 높이
const MOUTH_W = 1.19;
const MOUTH_OPEN = 0.15; // 쫓을 때 입이 벌어지는 각도 (라디안). 얼굴 그림의 이빨이 찢어지지 않을 만큼만
const NOSE = { y: 0.385, top: 0.56 };
const DEPTH = 0.88; // 앞뒤 두께 / 좌우 폭
const HEAD_KEYS = [
  [HEAD_H, 0.02], [0.905, 0.12], [0.842, 0.215], [0.757, 0.278], [0.674, 0.312], [0.589, 0.331], [0.505, 0.342],
  [0.421, 0.349], [0.337, 0.35], [0.252, 0.348], [0.169, 0.333], [0.084, 0.3], [0.03, 0.2], [0, 0.03],
].map(([y, hw]) => [y, hw, hw * DEPTH, 0]);
const BODY_KEYS = [
  [1.95, 0.02], [1.9, 0.2], [1.769, 0.3], [1.609, 0.3], [1.449, 0.269], [1.288, 0.285], [1.129, 0.304], [0.968, 0.327],
  [0.808, 0.36], [0.647, 0.395], [0.488, 0.422], [0.327, 0.475], [0.167, 0.56], [0, 0.6],
].map(([y, hw]) => [y, hw, hw * 0.78, 0]);
const BODY_TEX = { top: 1.83, bottom: 0.04 }; // 몸 그림이 덮는 높이
const HEM_Y = 0.55; // 이 아래 옷자락이 흔들린다
const SHOULDER = { x: 0.3, y: 1.72 };
const UPPER = 0.62;
const FORE = 0.58;

const SINK = 2.85; // 다 들어갔을 때 몸이 내려간 깊이 (미터). 머리까지 바닥 밑에 숨는다
const RISE_RATE = 9; // 솟아오르는 빠르기
const SINK_RATE = 4;
const UP_MODES = ['chase', 'stunned', 'watch']; // 그 밖의 상태에서는 땅속이다 ('search' 는 가라앉는 중)
const HOLE = { crawl: 0.95, up: 1.5 }; // 구멍 반지름 (미터)
const SKIN_COLOR = 0x4a3f36; // 그림이 없을 때 머리 색
const ROBE_COLOR = 0x332b25; // 그림이 없을 때 몸 색
const HOLE_COLOR = 0x0c0a08; // 그림이 없을 때 구멍 색
const FACE_GLOW = { patrol: 0.1, chase: 0.14, stunned: 0.03 }; // 어둠에서 얼굴이 희미하게 뜨는 세기

// 위아래 이빨이 만나는 초승달 선. 입을 다물면 틈 없이 그림만 보인다
function lipLine(w) {
  return LIP.mid + LIP.rise * clamp(Math.abs(w) / MOUTH_W, 0, 1) ** 2.2;
}

function relief(x, y) {
  const up = clamp((y - NOSE.y) / (NOSE.top - NOSE.y), 0, 1);
  const ridge = y > NOSE.y ? lerp(0.075, 0.025, up) * bump(x, lerp(0.05, 0.025, up)) * bump(Math.max(0, y - NOSE.top), 0.04) : 0;
  return ridge + 0.085 * bump(x, 0.055) * bump(y - NOSE.y, 0.05) + 0.02 * bump(Math.abs(x) - 0.2, 0.09) * bump(y - 0.32, 0.08);
}

// 머리 그림은 가운데 절반이 앞얼굴, 양쪽 끝이 뒤통수다. 줄마다 윤곽을 펼쳐 놨으니 앞면은 x / 폭 으로 찾는다
function headUv(p) {
  const s = clamp(p.x / sampleKeys(HEAD_KEYS, p.y)[0], -1, 1);
  const u = p.z >= 0 ? 0.5 + 0.25 * s : s >= 0 ? 1 - 0.25 * s : -0.25 * s;
  return [u, p.y / HEAD_H];
}

function bodyAt(y, w, out) {
  const [hw, hd] = sampleKeys(BODY_KEYS, y);
  const low = clamp((1 - y) / 0.8, 0, 1);
  const fold = 1 + low * 0.045 * Math.sin(w * 7 + 0.6) + low * 0.025 * Math.sin(w * 13 + y * 3);
  return out.set(Math.sin(w) * hw * fold, y, Math.cos(w) * hd * fold);
}

function bodyGeometry() {
  return surface({
    rows: 14,
    segs: 22,
    at: (t, w, out) => bodyAt(lerp(BODY_KEYS[0][0], 0, t), w, out),
    uv: (p, t, w) => [0.5 + w / Math.PI, (p.y - BODY_TEX.bottom) / (BODY_TEX.top - BODY_TEX.bottom)], // 뒷면은 앞면을 거울처럼 쓴다
    shade: (p) => lerp(0.6, 1, clamp(p.y / 0.3, 0, 1)),
  });
}

// 그림처럼 듬성듬성 난 가는 머리카락: 정수리에서 나와 머리를 따라 흘러내린다
function hairGeometry() {
  const parts = [];
  for (let i = 0; i < 11; i++) {
    const a = ((i - 5) / 5) * 1.35 + (i % 2 ? 0.08 : -0.05);
    const z = i % 2 ? -0.07 : 0.06;
    const len = 0.09 + (i % 3) * 0.03;
    let p = null;
    for (let n = 0; n < 4; n++) {
      const y = 0.9 - Math.abs(a) * 0.08 - n * len * (0.3 + n * 0.25);
      const [hw, hd] = sampleKeys(HEAD_KEYS, y);
      const lift = 1.02 + n * 0.05;
      const q = [Math.sin(a + n * 0.12 * Math.sign(a)) * hw * lift, y, Math.cos(a) * hd * 0.55 * lift + z];
      if (p) parts.push(bone(p, q, 0.0034 - n * 0.0005, 0.0026 - n * 0.0005, 0.22, 3));
      p = q;
    }
  }
  return mergeGeometries(parts);
}

// 그림의 뾰족한 손끝 넷
function clawsGeometry() {
  const parts = [];
  [[-0.05, -0.03, 0.2], [-0.018, -0.01, 0.26], [0.018, 0.012, 0.25], [0.052, 0.034, 0.2]].forEach(([x, fan, l]) => {
    parts.push(...digit([
      [x, 0, 0],
      [x + fan * 0.6, -l * 0.42, 0.006],
      [x + fan, -l * 0.8, 0.012],
      [x + fan * 1.25, -l, 0.03],
    ], 0.015));
  });
  return mergeGeometries(parts);
}

function holeGeometry() {
  const g = new THREE.CircleGeometry(1, 24);
  g.rotateX(-Math.PI / 2);
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

export class MoleModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const skin = this.paper('art/horror_mole_head.jpg', SKIN_COLOR);
    this.faceMat = skin;
    skin.emissive = new THREE.Color(0xffffff);
    skin.emissiveMap = skin.map;
    const robe = this.paper('art/horror_mole_body.jpg', ROBE_COLOR);
    robe.map.wrapS = THREE.MirroredRepeatWrapping;

    const rig = new Rig(this.group);
    this.root = rig.bone(null);
    rig.part('body', this.root, bodyGeometry());

    this.head = rig.bone(this.root, 0, CHIN_Y + PIVOT, 0);
    this.head.rotation.order = 'YXZ';
    const shell = shellHead({ keys: HEAD_KEYS, edgeU: lipLine, edgeL: lipLine, mouthW: MOUTH_W, relief, uv: headUv, rows: 16, segs: 30 });
    rig.part('head', this.head, mergeGeometries([shell.skull, throat(0.15, 0.3, -0.05), hairGeometry()]), 0, -PIVOT, 0);
    this.jaw = rig.bone(this.head, 0, HINGE.y - PIVOT, HINGE.z);
    const jaw = mergeGeometries([shell.jaw, throat(0.12, 0.13, -0.03)]); // 벌어진 입으로 몸이 보이지 않게 막는다
    jaw.translate(0, -HINGE.y, -HINGE.z);
    rig.part('head', this.jaw, jaw);

    this.arms = [-1, 1].map((side) => {
      const shoulder = rig.bone(this.root, side * SHOULDER.x, SHOULDER.y, 0);
      rig.part('body', shoulder, mergeGeometries([knob(0.06), limb(UPPER, (t) => lerp(0.055, 0.04, t), { rows: 5 })]));
      const elbow = rig.bone(shoulder, 0, -UPPER);
      rig.part('body', elbow, mergeGeometries([knob(0.042), limb(FORE, (t) => lerp(0.04, 0.05, t), { rows: 5 })]));
      const wrist = rig.bone(elbow, 0, -FORE);
      rig.part('body', wrist, mergeGeometries([knob(0.05, 0, -0.02), clawsGeometry()]), 0, -0.04, 0);
      return { shoulder, elbow, wrist, side, phase: side > 0 ? Math.PI : 0 };
    });

    const middle = new THREE.Vector3(0, 1.4, 0);
    this.face = rig.mesh('head', skin, true, middle, 2.2);
    this.robe = rig.mesh('body', robe, true, middle, 2.2);
    this.skeleton = rig.bind([this.face, this.robe]);
    this.setupHem();

    const hole = this.paper('art/horror_mole_hole.webp', HOLE_COLOR);
    hole.transparent = true;
    hole.depthWrite = false;
    this.hole = this.add(this.group, holeGeometry(), hole, false, 0, 0.03, 0);
    this.hole.renderOrder = 1;

    this.headHeight = CHIN_Y + HEAD_H;
    this.faceNear = 0.85; // 잡히는 장면에서 머리 받침점까지 거리 (미터)
    this.rise = 0;
    this.holeSize = HOLE.crawl;
    this.mouth = 0;
    this.lookY = 0;
    this.phase = 0;
    this.setRise(0);
  }

  setupHem() {
    const g = this.robe.geometry;
    const pos = g.attributes.position;
    const owner = this.skeleton.bones.indexOf(this.root);
    const list = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < HEM_Y && g.attributes.skinIndex.getX(i) === owner) list.push(i);
    this.hem = {
      index: Uint32Array.from(list),
      x: Float32Array.from(list, (i) => pos.getX(i)),
      z: Float32Array.from(list, (i) => pos.getZ(i)),
      weight: Float32Array.from(list, (i) => (1 - pos.getY(i) / HEM_Y) ** 2),
      angle: Float32Array.from(list, (i) => Math.atan2(pos.getX(i), pos.getZ(i))),
    };
  }

  // 0 은 다 들어간 자리, 1 은 다 올라온 자리. 안내 화면 뒤에서 몸을 한 번 그려 둘 때도 쓴다
  setRise(r) {
    this.rise = r;
    this.root.position.y = -SINK * (1 - r);
    this.face.visible = this.robe.visible = r > 0.005; // 땅속에서는 그리지 않는다
  }

  update(s, dt, player) {
    const first = !this.hasLast;
    this.track(s, dt, CELL);
    const up = UP_MODES.includes(s.mode);
    const rate = up ? RISE_RATE : SINK_RATE;
    this.setRise(this.rise + ((up ? 1 : 0) - this.rise) * damp(rate, dt));
    this.lightFace(s, dt);
    this.moveHole(s, dt, first, up);
    if (!this.face.visible) return;
    if (s.mode === 'stunned') {
      this.shake(s, this.root, 0.012);
      return;
    }
    this.turn(s, dt, first);
    this.body(s, dt, player);
  }

  // 땅속에서는 구멍만 꿈틀대며 간다. 땅이 흔들리는 동안 위험한 넓이까지 벌어진다
  moveHole(s, dt, first, up) {
    this.phase = (this.phase + dt * (up ? 2 : 5)) % TAU;
    const danger = cfg.horror.monsters.mole.eruptDist * CELL;
    const goal = s.mode === 'investigate' ? danger : up || s.mode === 'search' ? HOLE.up : HOLE.crawl;
    const rate = s.mode === 'investigate' ? 3 : 4;
    this.holeSize = first ? goal : this.holeSize + (goal - this.holeSize) * damp(rate, dt);
    const wobble = up ? 0 : 0.05 * Math.sin(this.phase);
    this.hole.scale.set(this.holeSize * (1 + wobble), 1, this.holeSize * (1 - wobble));
  }

  body(s, dt, player) {
    const chasing = s.mode === 'chase';
    this.root.rotation.set(chasing ? 0.08 : 0.02, 0, 0.025 * Math.sin(this.time * 1.7));
    const k = damp(6, dt);
    this.lookY += (lookYaw(s, this.yaw, player) - this.lookY) * k;
    this.head.rotation.set(chasing ? 0.1 : 0, this.lookY, 0.05 * Math.sin(this.time * 0.9));
    this.mouth += ((chasing ? 1 : 0) - this.mouth) * k;
    this.jaw.rotation.x = lerp(0, MOUTH_OPEN, this.mouth);
    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i];
      const sway = Math.sin(this.time * 1.5 + arm.phase);
      arm.shoulder.rotation.set(-0.08 + 0.05 * sway - this.mouth * 0.3, 0, arm.side * 0.17);
      arm.elbow.rotation.set(-0.1 - this.mouth * 0.25, 0, arm.side * 0.03);
      arm.wrist.rotation.set(0.1 * sway, 0, arm.side * -0.06);
    }
    if (this.group.visible) this.rippleHem();
  }

  rippleHem() {
    const { index, x, z, weight, angle } = this.hem;
    const pos = this.robe.geometry.attributes.position;
    const a = pos.array;
    const t = this.time * 3;
    for (let i = 0; i < index.length; i++) {
      const r = 1 + 0.05 * weight[i] * (Math.sin(angle[i] * 5 + t) + 0.6 * Math.sin(angle[i] * 3 - t * 2));
      const k = index[i] * 3;
      a[k] = x[i] * r;
      a[k + 2] = z[i] * r;
    }
    pos.needsUpdate = true;
  }

  lightFace(s, dt) {
    const goal = FACE_GLOW[s.mode] ?? FACE_GLOW.patrol;
    this.glow += (goal - this.glow) * damp(5, dt);
    this.faceMat.emissiveIntensity = this.glow;
  }
}
