// 물괴물 3D: 아들이 그린 그림대로 팔다리 없는 장어 몸, 눈 없는 둥근 머리, 앞으로 세로로 벌어진 입,
// 그 안에 여러 겹 바늘 이빨, 목에 아가미 주름. 피부는 Gemini 실사 그림에서 잘라 낸 것이다. 앞은 +Z 다.
// 물속에 가라앉으면 몸이 바닥 아래로 내려가 물 표면에 가려지고 물결만 보인다 (water.js).
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';
import { CreatureBase, damp } from './creatureBase.js';
import { clamp, lerp } from './creatureGeometry.js';

const SEGS = 14; // 몸 마디 수
const SEG_LEN = 0.34; // 마디 길이 (미터). 몸 전체는 4.8 미터쯤
const SKIN_COLOR = 0xb8a8a8; // 그림을 못 받았을 때 칠하는 창백한 살색
const MOUTH_DARK = 0x1a0606;
const TOOTH_COLOR = 0xe8dcc0;
// 상태마다 몸 높이와 머리 드는 정도. y 는 몸통 높이 (미터, 바닥이 0), lift 는 머리를 드는 높이, open 은 입 벌림, swing 은 좌우로 휘는 폭
const POSE = {
  lurk: { y: -1.3, lift: 0, open: 0.1, swing: 0.25, rate: 1.2 },
  swim: { y: -0.35, lift: 1.5, open: 0.85, swing: 0.45, rate: 5 },
  crawl: { y: 0.24, lift: 0.5, open: 0.5, swing: 0.55, rate: 2.6 },
  grope: { y: 0.24, lift: 0.95, open: 0.35, swing: 0.3, rate: 1.4 },
  gropeWet: { y: -0.4, lift: 1.1, open: 0.35, swing: 0.3, rate: 1.4 },
  stunned: { y: 0.1, lift: 0.3, open: 1, swing: 0, rate: 0 },
};
const POSE_KEYS = Object.keys(POSE.lurk);
const FRONT = new THREE.Vector3(0, 0, 1);
const dir = new THREE.Vector3();

// 머리부터 꼬리까지 몸 두께 (t: 0 머리 쪽, 1 꼬리 끝)
const radiusAt = (t) => (t < 0.15 ? lerp(0.27, 0.34, t / 0.15) : lerp(0.34, 0.02, ((t - 0.15) / 0.85) ** 1.3));

// 원뿔 바늘 이빨 고리. 고리마다 안쪽을 향해 기울어 목구멍으로 이어진다
function teethRings(rx, ry) {
  const geos = [];
  const rings = [{ n: 22, s: 1, len: 0.14, tilt: 0.55, z: 0 }, { n: 18, s: 0.78, len: 0.11, tilt: 0.75, z: -0.06 }, { n: 14, s: 0.56, len: 0.08, tilt: 0.95, z: -0.12 }];
  for (const r of rings) {
    for (let i = 0; i < r.n; i++) {
      const a = (i / r.n) * Math.PI * 2;
      const len = r.len * (0.7 + 0.3 * Math.abs(Math.sin(i * 2.3)));
      const g = new THREE.ConeGeometry(0.012, len, 5);
      g.translate(0, len / 2, 0);
      g.rotateX(-r.tilt); // 안쪽 앞으로 기운다
      g.rotateZ(a - Math.PI / 2);
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
      const m = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 70, specular: 0x8a8a8a }); // 젖은 몸이라 형광등이 번들거린다
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

    // 몸 마디: 이음매가 보이지 않게 마디마다 공을 겹친다
    this.segs = [];
    for (let i = 0; i < SEGS; i++) {
      const t0 = i / SEGS;
      const t1 = (i + 1) / SEGS;
      const g = new THREE.CylinderGeometry(radiusAt(t0), radiusAt(t1), SEG_LEN, 12, 1, true);
      g.rotateX(Math.PI / 2); // 원기둥 축을 Z 로 눕힌다. -Z 쪽이 꼬리다
      g.translate(0, 0, -SEG_LEN / 2);
      const seg = this.pivot(this.group);
      this.add(seg, g, body, true);
      this.add(seg, new THREE.SphereGeometry(radiusAt(t0), 12, 8), body, false);
      this.segs.push(seg);
    }

    // 머리: 매끈하게 부푼 달걀 모양. 눈이 없다. 목 바로 앞, 첫 마디에 붙는다
    this.head = this.pivot(this.group);
    this.head.rotation.order = 'YXZ';
    const skull = new THREE.SphereGeometry(0.42, 24, 18);
    skull.scale(0.95, 1.05, 1.15);
    this.add(this.head, skull, headSkin, true, 0, 0.12, 0.12);
    // 입: 앞쪽에서 세로로 길게 벌어진다. 입술 고리, 까만 목구멍, 바늘 이빨 세 겹
    this.mouth = this.pivot(this.head, 0, -0.08, 0.52);
    const lip = new THREE.TorusGeometry(0.24, 0.05, 8, 28);
    lip.scale(1, 1.35, 1);
    this.add(this.mouth, lip, headSkin, false);
    const throat = new THREE.CircleGeometry(0.24, 24);
    throat.scale(1, 1.35, 1);
    this.add(this.mouth, throat, new THREE.MeshBasicMaterial({ color: MOUTH_DARK }), false, 0, 0, -0.03);
    const gullet = new THREE.CylinderGeometry(0.2, 0.08, 0.5, 16, 1, true);
    gullet.rotateX(Math.PI / 2);
    gullet.scale(1, 1.3, 1);
    this.add(this.mouth, gullet, new THREE.MeshBasicMaterial({ color: 0x080202, side: THREE.BackSide }), false, 0, 0, -0.28);
    const teeth = new THREE.Group();
    for (const g of teethRings(0.24, 0.32)) teeth.add(new THREE.Mesh(g, this.toothMat ??= new THREE.MeshPhongMaterial({ color: TOOTH_COLOR, shininess: 90, emissive: 0x201a10 })));
    this.mouth.add(teeth);
    // 아가미 주름: 머리 뒤 목을 둘러 너덜너덜하게 선다
    const frill = new THREE.PlaneGeometry(0.16, 0.36);
    const frillMat = new THREE.MeshPhongMaterial({ color: 0x9a8484, side: THREE.DoubleSide, shininess: 30 });
    this.materials.push(frillMat);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) < 0) continue; // 아래쪽 턱 밑은 비운다
      const f = this.add(this.head, frill, frillMat, false, Math.cos(a) * 0.4, Math.sin(a) * 0.42 + 0.08, -0.32);
      f.rotation.set(-0.5, 0, a - Math.PI / 2);
      f.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(i * 1.7)));
    }

    this.faceNear = 1.05; // 잡히는 장면에서 머리 받침점까지 거리 (미터). 입이 화면을 채운다
    this.faceTilt = 0;
    this.pose = { ...POSE.lurk };
    this.phase = 0;
    this.points = Array.from({ length: SEGS + 1 }, () => new THREE.Vector3());
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

  // 몸을 S 자로 휘게 놓는다. 머리 쪽은 들고 꼬리 쪽은 바닥이나 물속에 남는다
  bend(player, s) {
    const p = this.pose;
    const pts = this.points;
    for (let i = 0; i <= SEGS; i++) {
      const t = i / SEGS;
      const rise = p.lift * Math.max(0, 1 - t * 3.2) ** 1.6; // 앞쪽 셋째 마디까지만 든다
      pts[i].set(Math.sin(this.phase - t * 5) * p.swing * t * 1.4, p.y + rise, -t * SEGS * SEG_LEN * 0.92);
    }
    for (let i = 0; i < SEGS; i++) {
      const seg = this.segs[i];
      seg.position.copy(pts[i]);
      seg.quaternion.setFromUnitVectors(FRONT, dir.subVectors(pts[i], pts[i + 1]).normalize()); // 마디의 -Z 쪽이 다음 마디로 간다
    }
    // 머리는 첫 마디 앞. 가까우면 주인공 쪽으로 고개를 돌린다 (눈은 없지만 소리 난 쪽을 향한다)
    const near = Math.hypot(player.x - s.x, player.y - s.y) < 6;
    this.head.position.set(pts[0].x, pts[0].y + 0.05, 0.3);
    const yaw = near ? clamp(Math.atan2(player.x - s.x, player.y - s.y) - this.yaw, -0.8, 0.8) : Math.sin(this.phase * 0.5) * 0.3;
    this.head.rotation.set(-0.15 - p.lift * 0.08, Math.atan2(Math.sin(yaw), Math.cos(yaw)) * (near ? 1 : 0.5), 0);
    const open = clamp(p.open + 0.06 * Math.sin(this.time * 3), 0.05, 1);
    this.mouth.scale.set(0.75 + 0.35 * open, 0.55 + 0.6 * open, 1);
    this.faceTilt = 0;
  }
}
