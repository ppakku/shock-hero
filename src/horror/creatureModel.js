// 3D 괴물: 모양은 creatureGeometry.js 에서 받고, 여기서는 뼈대를 세워 걷고 쫓고 쳐다보게 한다. 앞은 +Z 다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../logic/horrorGrid.js';
import {
  TAU, THIGH, SHIN, ANKLE, UPPER_ARM, FOREARM, SHOULDER, SPINE_UP, NECK_UP, HEAD, EYE_UV, EYE_R, NECK_POINTS,
  clamp, lerp, smooth, limb, knob, handGeometry, footGeometry, headAt, faceSurface, faceX, faceY,
  headGeometries, eyeGeometry, torsoGeometries, pelvisGeometry, neckGeometry,
} from './creatureGeometry.js';

const LOOK_CELLS = 8; // 이 안에 들어오면 머리를 돌려 주인공을 본다
const LOOK_LIMIT = 1.15; // 목이 돌아가는 한계 (라디안)
const EYE_H = 1.6; // 주인공 눈높이 (미터)

const POSE = {
  walk: { lean: 0.56, neck: -0.42, stretch: 1, reach: 0, amp: 0.56, knee: 0.8, stride: 2.1, tilt: -0.08 },
  chase: { lean: 1.02, neck: -0.62, stretch: 1.3, reach: 1, amp: 0.82, knee: 1.15, stride: 3, tilt: -0.3 },
};
const POSE_KEYS = Object.keys(POSE.walk);
const SKIN_TINT = 0x8a7f74; // 그림을 못 받았을 때 대신 칠하는 살색
const EYE_GLOW = { patrol: 0.42, investigate: 0.55, search: 0.55, chase: 1, stunned: 0.04 };

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// 머리를 돌릴 각도. 멀면 0, 가까우면 목 한계 안에서 주인공 쪽 (s 는 칸 좌표, heading 은 몸 방향)
export function lookYaw(s, heading, player) {
  if (Math.hypot(player.x - s.x, player.y - s.y) > LOOK_CELLS) return 0;
  return clamp(wrapAngle(Math.atan2(player.x - s.x, player.y - s.y) - heading), -LOOK_LIMIT, LOOK_LIMIT);
}

export class CreatureModel {
  constructor(scene, loader = new THREE.TextureLoader()) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.loadFailed = false;
    this.materials = [];
    const srgb = (url, repeat) => {
      const t = loader.load(url, undefined, undefined, () => this.textureFailed(url, t));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const faceTex = srgb('art/horror_creature_face.jpg');
    faceTex.wrapT = THREE.MirroredRepeatWrapping; // 그림 위쪽 이마를 정수리까지 잇는다
    this.textures = [faceTex, srgb('art/horror_creature_skin.jpg', true), srgb('art/horror_creature_torso.jpg')];
    const paper = (map) => { // 손전등에 하얗게 날아가지 않게 어둡게 둔다
      const m = new THREE.MeshStandardMaterial({ map, color: 0xa8a8a8, roughness: 1, vertexColors: true });
      this.materials.push(m);
      return m;
    };
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
      add(hip, thighGeo, skin, false);
      const knee = pivot(hip, 0, -THIGH);
      add(knee, shinGeo, skin, false);
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
      add(shoulder, upperGeo, skin, false);
      const elbow = pivot(shoulder, 0, -UPPER_ARM);
      add(elbow, foreGeo, skin, false);
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
    const aim = new THREE.Object3D();
    const eyeParts = [];
    this.eyes = EYE_UV.map(([eu, ev]) => {
      const { t, w } = faceSurface(faceX(eu), faceY(ev));
      const p = headAt(t, w, new THREE.Vector3());
      headAt(t + 0.01, w, u).sub(headAt(t - 0.01, w, n));
      headAt(t, w + 0.01, v).sub(headAt(t, w - 0.01, n));
      n.crossVectors(u, v).normalize();
      const center = new THREE.Vector3(p.x + n.x * 0.004, p.y + n.y * 0.004, p.z + n.z * 0.004);
      aim.lookAt(n);
      aim.updateMatrix();
      const part = eyeGeo.clone().applyMatrix4(aim.matrix);
      eyeParts.push(part);
      return { center, offsets: part.attributes.position.array.slice() };
    });
    // 두 눈은 한 덩어리로 합치고, 멀리서는 점 위치를 다시 써서 키운다
    this.eyeMesh = add(inner, mergeGeometries(eyeParts), this.eyeMat, false);
    this.eyeMesh.renderOrder = 2;
    this.eyeMesh.frustumCulled = false;
    this.eyeCount = eyeParts[0].attributes.position.count;
    this.eyeScale = 0;
    this.setEyeScale(EYE_R);

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
    this.hasLast = false;
    this.lastX = 0;
    this.lastY = 0;
    this.time = 0;
  }

  // 그림을 못 받으면 한 번만 알리고, 그 재질은 살색으로 칠해 괴물이 보이게 한다
  textureFailed(url, tex) {
    if (!this.loadFailed) {
      this.loadFailed = true;
      console.error(`괴물 그림을 못 받았습니다: ${url}`);
    }
    for (const m of this.materials) {
      if (m.map !== tex) continue;
      m.map = null;
      m.color.setHex(SKIN_TINT);
      m.needsUpdate = true;
    }
  }

  // 눈 모양 점 위치를 각자 중심에서 r 배로 다시 쓴다
  setEyeScale(r) {
    if (r === this.eyeScale) return;
    this.eyeScale = r;
    const pos = this.eyeMesh.geometry.attributes.position;
    const a = pos.array;
    const n3 = this.eyeCount * 3;
    for (let e = 0; e < this.eyes.length; e++) {
      const { center, offsets } = this.eyes[e];
      for (let i = 0; i < n3; i += 3) {
        const k = e * n3 + i;
        a[k] = center.x + offsets[i] * r;
        a[k + 1] = center.y + offsets[i + 1] * r;
        a[k + 2] = center.z + offsets[i + 2] * r;
      }
    }
    pos.needsUpdate = true;
  }

  update(s, dt, player) {
    this.time += dt;
    const first = !this.hasLast;
    const moved = first ? 0 : Math.hypot(s.x - this.lastX, s.y - this.lastY) * CELL;
    this.hasLast = true;
    this.lastX = s.x;
    this.lastY = s.y;
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
    for (let i = 0; i < POSE_KEYS.length; i++) {
      const key = POSE_KEYS[i];
      p[key] += (goal[key] - p[key]) * k;
    }
    const speed = dt > 0 ? moved / dt : 0;
    this.gait += ((speed > 0.1 ? 1 : 0) - this.gait) * damp(7, dt);
    this.phase = (this.phase + (moved / p.stride) * TAU) % TAU;
    const sway = this.gait * Math.sin(this.phase);
    const breath = Math.sin(this.time * 1.4);

    let reachDown = 0;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
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

    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i];
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
    this.setEyeScale(r);
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
