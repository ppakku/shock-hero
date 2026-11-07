// 물괴물 3D: 아들이 그린 그림대로 팔다리 없는 장어 몸, 눈 없는 둥근 머리, 앞으로 세로로 벌어진 입,
// 그 안에 여러 겹 바늘 이빨, 목에 아가미 주름. 앞은 +Z 다.
// 얼굴은 Gemini 실사 정면 그림을 휘어진 판에 그대로 입힌다 (입, 이빨, 아가미 주름이 그림과 같다).
// 몸과 머리 뒤쪽 피부는 같은 그림의 옆모습에서 잘라 냈다.
// 물속에 가라앉으면 몸이 바닥 아래로 내려가 물 표면에 가려지고 물결만 보인다 (water.js).
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, damp } from './creatureBase.js';
import { clamp, lerp } from './creatureGeometry.js';

const RINGS = 44; // 몸 관을 이루는 고리 수
const SIDES = 18; // 고리 하나의 꼭짓점 수
const LENGTH = 6.6; // 몸 길이 (미터)
const SKIN_REPEAT = 5; // 몸을 따라 피부 그림이 되풀이되는 수
const SKIN_COLOR = 0xb8a8a8; // 그림을 못 받았을 때 칠하는 창백한 살색
const SKULL = { x: 0.6, y: 0.82, z: 0.72 }; // 머리 반지름 (미터). 세로로 길다
// 얼굴 판: 정면 그림의 가운데 6할이 머리라서 판은 머리보다 넓다. 가장자리는 뒤로 휘어 옆에서 보면 머리를 감싼다
const FACE = { w: 2.05, h: 2.35, y: -0.18, z: 0.74, bendX: 0.42, bendY: 0.16 };
// 상태마다 몸 높이와 머리 드는 정도. y 는 몸통 높이 (미터, 바닥이 0), lift 는 머리를 드는 높이, open 은 입 벌림, swing 은 좌우로 휘는 폭
// 머리 그림: 보는 각도마다 Gemini 그림 한 장. from 은 머리 정면에서 돈 각도 (라디안).
// right 는 그림 속 머리가 오른쪽을 본다는 뜻이다. 괴물의 왼쪽에서 보면 머리가 왼쪽을 봐야 해서 뒤집는다.
// 그림은 늘 주인공 쪽을 보는 판에 입힌다. 그림을 못 받은 각도는 가장 가까운 다른 각도 그림을 쓴다
const VIEWS = [
  { file: 'horror_swimmer_face.webp', from: 0 },
  { file: 'horror_swimmer_head34.webp', from: Math.PI / 4, right: true },
  { file: 'horror_swimmer_side.webp', from: Math.PI / 2, right: true },
  { file: 'horror_swimmer_back.webp', from: Math.PI },
];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const POSE = {
  lurk: { y: -2.2, lift: 0, open: 0.1, swing: 0.25, rate: 1.2 },
  swim: { y: -0.5, lift: 2.2, open: 0.85, swing: 0.5, rate: 5 },
  crawl: { y: 0.45, lift: 0.8, open: 0.5, swing: 0.6, rate: 2.6 },
  grope: { y: 0.45, lift: 1.4, open: 0.35, swing: 0.3, rate: 1.4 },
  gropeWet: { y: -0.5, lift: 1.6, open: 0.35, swing: 0.3, rate: 1.4 },
  stunned: { y: 0.4, lift: 0.4, open: 1, swing: 0, rate: 0 },
};
const POSE_KEYS = Object.keys(POSE.lurk);
const UP = new THREE.Vector3(0, 1, 0);
const tan = new THREE.Vector3();
const side = new THREE.Vector3();
const up = new THREE.Vector3();
const at = new THREE.Vector3();
const ahead = new THREE.Vector3();

// 머리부터 꼬리까지 몸 두께 (t: 0 머리 쪽, 1 꼬리 끝)
const radiusAt = (t) => (t < 0.15 ? lerp(0.6, 0.64, t / 0.15) : lerp(0.64, 0.03, ((t - 0.15) / 0.85) ** 1.2)); // 목은 머리만큼 굵다

// 얼굴 판. 가운데는 앞으로 나오고 가장자리는 뒤로 휜다. uv 는 정면 그림을 그대로 편다
function faceGeometry() {
  const g = new THREE.PlaneGeometry(FACE.w, FACE.h, 24, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (FACE.w / 2);
    const y = p.getY(i) / (FACE.h / 2);
    p.setZ(i, -FACE.bendX * x * x - FACE.bendY * y * y);
  }
  g.computeVertexNormals();
  g.translate(0, FACE.y, FACE.z);
  return g;
}

export class SwimmerModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const skinMat = (url) => {
      const m = new THREE.MeshPhongMaterial({ color: 0xe4dede, emissive: 0x302828, shininess: 80, specular: 0x8a8a8a }); // 그림처럼 창백하고 젖어 번들거린다
      m.map = this.picture(url, () => {
        m.map = null;
        m.color.setHex(SKIN_COLOR);
        m.needsUpdate = true;
      });
      this.materials.push(m);
      return m;
    };
    const body = skinMat('art/horror_swimmer_skin.jpg');
    const headSkin = skinMat('art/horror_swimmer_head.jpg');
    this.materials.forEach((m) => { if (m.map) m.map.wrapS = m.map.wrapT = THREE.MirroredRepeatWrapping; });

    // 몸: 머리부터 꼬리까지 이어진 관 하나. 프레임마다 점을 다시 놓아 S 자로 휜다
    this.tube = new THREE.BufferGeometry();
    const verts = RINGS * (SIDES + 1);
    this.tube.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    const uv = new Float32Array(verts * 2);
    const index = [];
    for (let r = 0; r < RINGS; r++) {
      for (let j = 0; j <= SIDES; j++) {
        uv[(r * (SIDES + 1) + j) * 2] = j / SIDES;
        uv[(r * (SIDES + 1) + j) * 2 + 1] = (r / (RINGS - 1)) * SKIN_REPEAT;
        if (r < RINGS - 1 && j < SIDES) {
          const a = r * (SIDES + 1) + j;
          const b = a + SIDES + 1;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    this.tube.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.tube.setIndex(index);
    this.body = this.add(this.group, this.tube, body, true);
    this.body.frustumCulled = false; // 몸이 휘어 둘레가 프레임마다 바뀐다

    // 머리: 세로로 긴 달걀 모양. 눈이 없다. 목 바로 앞에 붙는다
    this.head = this.pivot(this.group);
    this.head.rotation.order = 'YXZ';
    const skull = new THREE.SphereGeometry(1, 28, 20);
    skull.scale(SKULL.x, SKULL.y, SKULL.z);
    this.skull = this.add(this.head, skull, headSkin, true);
    // 얼굴: 각도별 그림을 입힌 휘어진 판. 그림의 투명한 곳은 그리지 않는다. 그림이 하나도 없으면 머리 모양만 남는다
    this.views = VIEWS.map((v) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xeeeaea, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
      const mesh = this.add(this.head, faceGeometry(), mat, false);
      mesh.visible = false;
      const view = { ...v, mesh, lost: false };
      mat.map = this.picture(`art/${v.file}`, () => { view.lost = true; });
      mat.map.wrapS = mat.map.wrapT = THREE.ClampToEdgeWrapping;
      this.materials.push(mat);
      return view;
    });
    this.face = this.views[0].mesh;

    this.faceNear = 2.2; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 얼굴 그림이 화면을 채운다
    this.faceTilt = 0;
    this.pose = { ...POSE.lurk };
    this.phase = 0;
  }

  poseFor(s) {
    if (s.mode === 'stunned') return POSE.stunned;
    if (s.mode === 'search') return s.inWater ? POSE.gropeWet : POSE.grope;
    if (s.mode === 'chase') return s.inWater ? POSE.swim : POSE.crawl;
    return s.inWater === false ? POSE.crawl : POSE.lurk; // 물 밖에서 순찰로 돌아가는 중이면 긴다
  }

  update(s, dt, player) {
    const first = !this.hasLast;
    this.track(s, dt, CELL);
    const goal = this.poseFor(s);
    const k = first ? 1 : damp(4, dt);
    for (const key of POSE_KEYS) this.pose[key] += (goal[key] - this.pose[key]) * k;
    if (s.mode === 'stunned') this.shake(s, this.head, 0.03);
    else this.turn(s, dt, first);
    this.phase += dt * this.pose.rate;
    this.bend(player, s);
  }

  // 몸 선 위의 점. t: 0 머리 쪽, 1 꼬리 끝. 머리 쪽은 들고 꼬리 쪽은 바닥이나 물속에 남는다
  spine(t, out) {
    const p = this.pose;
    const rise = p.lift * Math.max(0, 1 - t * 3.2) ** 1.6; // 앞쪽 3분의 1 까지만 든다
    return out.set(Math.sin(this.phase - t * 5) * p.swing * t * 1.4, p.y + rise, -t * LENGTH);
  }

  // 관의 고리마다 몸 선을 따라 꼭짓점을 놓는다. 배 쪽은 조금 납작하다
  bend(player, s) {
    const p = this.pose;
    const pos = this.tube.attributes.position;
    for (let r = 0; r < RINGS; r++) {
      const t = r / (RINGS - 1);
      this.spine(t, at);
      this.spine(Math.max(0, t - 0.02), ahead);
      tan.subVectors(ahead, at);
      if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1);
      tan.normalize();
      side.crossVectors(UP, tan).normalize();
      up.crossVectors(tan, side).normalize();
      const rad = radiusAt(t);
      for (let j = 0; j <= SIDES; j++) {
        const a = (j / SIDES) * Math.PI * 2;
        const c = Math.cos(a) * rad;
        const sn = Math.sin(a) * rad * (Math.sin(a) < 0 ? 0.8 : 1);
        pos.setXYZ(r * (SIDES + 1) + j, at.x + side.x * c + up.x * sn, at.y + side.y * c + up.y * sn, at.z + side.z * c + up.z * sn);
      }
    }
    pos.needsUpdate = true;
    this.tube.computeVertexNormals();
    const neck = this.spine(0, at);
    // 머리는 첫 마디 앞. 가까우면 주인공 쪽으로 고개를 돌린다 (눈은 없지만 소리 난 쪽을 향한다)
    const near = Math.hypot(player.x - s.x, player.y - s.y) < 6;
    this.head.position.set(neck.x, neck.y + 0.3, 0.5);
    const yaw = near ? clamp(Math.atan2(player.x - s.x, player.y - s.y) - this.yaw, -0.8, 0.8) : Math.sin(this.phase * 0.5) * 0.3;
    this.head.rotation.set(-0.05 - p.lift * 0.04, Math.atan2(Math.sin(yaw), Math.cos(yaw)) * (near ? 1 : 0.5), 0);
    const open = clamp(p.open + 0.06 * Math.sin(this.time * 3), 0.05, 1);
    this.showView(wrap(Math.atan2(player.x - s.x, player.y - s.y) - this.yaw - this.head.rotation.y), 0.96 + 0.06 * open); // 입을 벌릴수록 얼굴이 조금 길어진다
    this.faceTilt = 0;
  }

  // rel: 머리 정면에서 주인공 쪽까지 돈 각도. 가장 가까운 각도의 그림 판만 보이고, 판은 주인공 쪽을 본다
  showView(rel, tall) {
    const ready = this.views.filter((v) => !v.lost && v.mesh.material.map?.image);
    for (const v of this.views) v.mesh.visible = false;
    this.skull.visible = !ready.length;
    if (!ready.length) return;
    const view = ready.reduce((a, b) => (Math.abs(Math.abs(rel) - b.from) < Math.abs(Math.abs(rel) - a.from) ? b : a));
    const img = view.mesh.material.map.image;
    view.aspect ??= (img.width / img.height) / (FACE.w / FACE.h); // 그림마다 가로세로 비율이 달라서 폭을 맞춘다
    view.mesh.visible = true;
    view.mesh.rotation.y = rel;
    view.mesh.scale.set(view.aspect * (view.right && rel > 0 ? -1 : 1), tall, 1);
  }
}
