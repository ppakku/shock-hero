// 물괴물 3D: 아들이 그린 그림대로 팔다리 없는 장어 몸, 눈 없는 둥근 머리, 앞으로 세로로 벌어진 입,
// 그 안에 여러 겹 바늘 이빨, 목에 아가미 주름. 피부는 Gemini 실사 그림에서 잘라 낸 것이다. 앞은 +Z 다.
// 물속에 가라앉으면 몸이 바닥 아래로 내려가 물 표면에 가려지고 물결만 보인다 (water.js).
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, damp } from './creatureBase.js';
import { clamp, lerp } from './creatureGeometry.js';

const RINGS = 44; // 몸 관을 이루는 고리 수
const SIDES = 18; // 고리 하나의 꼭짓점 수
const LENGTH = 5.6; // 몸 길이 (미터)
const SKIN_REPEAT = 5; // 몸을 따라 피부 그림이 되풀이되는 수
const SKIN_COLOR = 0xb8a8a8; // 그림을 못 받았을 때 칠하는 창백한 살색
const MOUTH_DARK = 0x1a0606;
const TOOTH_COLOR = 0xe8dcc0;
const MOUTH_HOLE = 0.6; // 머리 앞 입 구멍의 크기 (라디안)
// 상태마다 몸 높이와 머리 드는 정도. y 는 몸통 높이 (미터, 바닥이 0), lift 는 머리를 드는 높이, open 은 입 벌림, swing 은 좌우로 휘는 폭
const POSE = {
  lurk: { y: -1.3, lift: 0, open: 0.1, swing: 0.25, rate: 1.2 },
  swim: { y: -0.4, lift: 1.7, open: 0.85, swing: 0.45, rate: 5 },
  crawl: { y: 0.36, lift: 0.6, open: 0.5, swing: 0.55, rate: 2.6 },
  grope: { y: 0.36, lift: 1.1, open: 0.35, swing: 0.3, rate: 1.4 },
  gropeWet: { y: -0.4, lift: 1.1, open: 0.35, swing: 0.3, rate: 1.4 },
  stunned: { y: 0.3, lift: 0.3, open: 1, swing: 0, rate: 0 },
};
const POSE_KEYS = Object.keys(POSE.lurk);
const UP = new THREE.Vector3(0, 1, 0);
const tan = new THREE.Vector3();
const side = new THREE.Vector3();
const up = new THREE.Vector3();
const at = new THREE.Vector3();
const ahead = new THREE.Vector3();

// 머리부터 꼬리까지 몸 두께 (t: 0 머리 쪽, 1 꼬리 끝)
const radiusAt = (t) => (t < 0.15 ? lerp(0.42, 0.5, t / 0.15) : lerp(0.5, 0.02, ((t - 0.15) / 0.85) ** 1.3));

// 원뿔 바늘 이빨 고리. 고리마다 안쪽을 향해 기울어 목구멍으로 이어진다
function teethRings(rx, ry) {
  const geos = [];
  const rings = [{ n: 26, s: 0.96, len: 0.2, tilt: 0.55, z: -0.02 }, { n: 20, s: 0.8, len: 0.17, tilt: 0.75, z: -0.1 }, { n: 16, s: 0.62, len: 0.13, tilt: 0.95, z: -0.19 }];
  for (const r of rings) {
    for (let i = 0; i < r.n; i++) {
      const a = (i / r.n) * Math.PI * 2;
      const len = r.len * (0.7 + 0.3 * Math.abs(Math.sin(i * 2.3)));
      const g = new THREE.ConeGeometry(0.016, len, 5);
      g.translate(0, len / 2, 0);
      g.rotateX(-r.tilt); // 안쪽 앞으로 기운다
      g.rotateZ(a + Math.PI / 2); // 바늘 끝이 입 가운데를 향한다
      g.translate(Math.cos(a) * rx * r.s, Math.sin(a) * ry * r.s, r.z);
      geos.push(g);
    }
  }
  return geos;
}

export class SwimmerModel extends CreatureBase {
  constructor(scene, loader) {
    super(scene, loader);
    const skinMat = (url) => {
      const m = new THREE.MeshPhongMaterial({ color: 0xc4c0c0, shininess: 70, specular: 0x6a6a6a }); // 젖은 몸이라 형광등이 번들거린다. 밝은 수영장에서 하얗게 날아가지 않게 누른다
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

    // 머리: 매끈하게 부푼 달걀 모양. 눈이 없다. 목 바로 앞, 첫 마디에 붙는다
    this.head = this.pivot(this.group);
    this.head.rotation.order = 'YXZ';
    const skull = new THREE.SphereGeometry(0.62, 28, 20, 0, Math.PI * 2, MOUTH_HOLE, Math.PI - MOUTH_HOLE); // 앞쪽에 입 구멍이 뚫린 구
    skull.rotateX(Math.PI / 2); // 구멍 난 극을 앞 (+Z) 으로 돌린다
    skull.scale(0.95, 1.05, 1.15);
    this.add(this.head, skull, headSkin, true, 0, 0.16, 0.1);
    // 입: 앞쪽에서 세로로 길게 벌어진다. 입술 고리, 까만 목구멍, 바늘 이빨 세 겹
    this.mouth = this.pivot(this.head, 0, 0.16, 0.7); // 머리 구멍 가장자리에 입술이 걸린다
    const lip = new THREE.TorusGeometry(0.34, 0.07, 8, 32);
    lip.scale(1, 1.35, 1);
    this.add(this.mouth, lip, headSkin, false);
    const throat = new THREE.CircleGeometry(0.34, 28);
    throat.scale(1, 1.35, 1);
    this.add(this.mouth, throat, new THREE.MeshBasicMaterial({ color: MOUTH_DARK }), false, 0, 0, -0.32);
    const inner = new THREE.CylinderGeometry(0.34, 0.3, 0.32, 24, 1, true);
    inner.rotateX(Math.PI / 2);
    inner.scale(1, 1.35, 1);
    this.add(this.mouth, inner, new THREE.MeshLambertMaterial({ color: 0x5a1c1c, side: THREE.BackSide }), false, 0, 0, -0.16);
    const gullet = new THREE.CylinderGeometry(0.3, 0.1, 0.7, 16, 1, true);
    gullet.rotateX(Math.PI / 2);
    gullet.scale(1, 1.3, 1);
    this.add(this.mouth, gullet, new THREE.MeshBasicMaterial({ color: 0x080202, side: THREE.BackSide }), false, 0, 0, -0.62);
    const teeth = new THREE.Group();
    for (const g of teethRings(0.34, 0.45)) teeth.add(new THREE.Mesh(g, this.toothMat ??= new THREE.MeshPhongMaterial({ color: TOOTH_COLOR, shininess: 90, emissive: 0x201a10 })));
    this.mouth.add(teeth);
    // 아가미 주름: 머리 뒤 목을 둘러 너덜너덜하게 선다
    const frill = new THREE.PlaneGeometry(0.22, 0.5);
    const frillMat = new THREE.MeshPhongMaterial({ color: 0x9a8484, side: THREE.DoubleSide, shininess: 30 });
    this.materials.push(frillMat);
    for (let i = 0; i < 14; i++) {
      const a = -0.5 + (i / 13) * (Math.PI + 1); // 왼쪽 아래부터 위를 지나 오른쪽 아래까지. 턱 밑은 비운다
      const f = this.add(this.head, frill, frillMat, false, Math.cos(a) * 0.5, Math.sin(a) * 0.52 + 0.1, -0.5);
      f.rotation.set(-1.15, 0, a - Math.PI / 2); // 뒤로 젖혀 목에 붙는다
      f.scale.set(0.7 + 0.4 * Math.abs(Math.sin(i * 1.7)), 0.8 + 0.5 * Math.abs(Math.cos(i * 2.3)), 1);
    }

    this.faceNear = 1.4; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 입이 화면을 채운다
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
    this.head.position.set(neck.x, neck.y + 0.08, 0.45);
    const yaw = near ? clamp(Math.atan2(player.x - s.x, player.y - s.y) - this.yaw, -0.8, 0.8) : Math.sin(this.phase * 0.5) * 0.3;
    this.head.rotation.set(-0.15 - p.lift * 0.08, Math.atan2(Math.sin(yaw), Math.cos(yaw)) * (near ? 1 : 0.5), 0);
    const open = clamp(p.open + 0.06 * Math.sin(this.time * 3), 0.05, 1);
    this.mouth.scale.set(0.75 + 0.35 * open, 0.55 + 0.6 * open, 1);
    this.faceTilt = 0;
  }
}
