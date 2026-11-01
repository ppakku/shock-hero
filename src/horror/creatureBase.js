// 괴물들이 함께 쓰는 것: 각도 계산과, 세이노를 뺀 괴물의 재질, 뼈대, 마지막 정리.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp } from './creatureGeometry.js';

export const LOOK_CELLS = 8; // 이 안에 들어오면 머리를 돌려 주인공을 본다
const LOOK_LIMIT = 1.15; // 목이 돌아가는 한계 (라디안)
export const EYE_GLOW = { patrol: 0.42, investigate: 0.55, search: 0.55, chase: 1, stunned: 0.04, ambush: 0.12, watch: 1 };

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// 머리를 돌릴 각도. 멀면 0, 가까우면 목 한계 안에서 주인공 쪽 (s 는 칸 좌표, heading 은 몸 방향)
export function lookYaw(s, heading, player) {
  if (Math.hypot(player.x - s.x, player.y - s.y) > LOOK_CELLS) return 0;
  return clamp(wrapAngle(Math.atan2(player.x - s.x, player.y - s.y) - heading), -LOOK_LIMIT, LOOK_LIMIT);
}

export class CreatureBase {
  constructor(scene, loader = new THREE.TextureLoader()) {
    this.scene = scene;
    this.loader = loader;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.loadFailed = false;
    this.materials = [];
    this.textures = []; // 안내 화면이 '다 받았다'를 볼 목록. 실패한 그림은 뺀다
    this.owned = [];
    this.yaw = 0;
    this.glow = EYE_GLOW.patrol;
    this.hasLast = false;
    this.lastX = 0;
    this.lastY = 0;
    this.time = 0;
  }

  // 그림을 입힌 재질. 그림이 없거나 못 받으면 color 색만 칠해서 괴물은 그대로 보인다
  paper(url, color, shine = 0xa8a8a8, make = (o) => new THREE.MeshStandardMaterial({ ...o, roughness: 1 }), lost = () => {}) {
    const m = make({ color: shine, vertexColors: true });
    // 점 밝기가 0 인 곳(입안, 찢어진 틈)은 손전등 반사도 없이 완전히 까맣다
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight *= step(0.01, vColor.r);\n#include <opaque_fragment>');
    };
    m.map = this.picture(url, () => {
      m.map = null;
      m.color.setHex(color);
      m.needsUpdate = true;
      lost();
    });
    this.materials.push(m);
    return m;
  }

  // 흑백 그림의 밝은 곳만 어둠에서 뜬다. 그림을 못 받으면 뜨는 빛만 없다
  glowMap(m, url, color = 0xffffff) {
    m.emissive = new THREE.Color(color);
    m.emissiveMap = this.picture(url, () => {
      m.emissiveMap = null;
      m.emissive.setHex(0);
      m.needsUpdate = true;
    });
  }

  picture(url, lost) {
    const fail = () => {
      if (!this.loadFailed) {
        this.loadFailed = true;
        console.error(`괴물 그림을 못 받았습니다: ${url}`);
      }
      this.textures = this.textures.filter((x) => x !== t);
      lost();
    };
    const t = this.loader.load(url, undefined, undefined, fail);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    this.textures.push(t);
    this.owned.push(t);
    return t;
  }

  add(parent, geometry, material, shadow, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    parent.add(m);
    return m;
  }

  pivot(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  // 위치와 움직인 거리(미터로 cell 을 곱한 값)를 잰다. 처음 부를 때는 0 이다
  track(s, dt, cell) {
    this.time += dt;
    const first = !this.hasLast;
    const moved = first ? 0 : Math.hypot(s.x - this.lastX, s.y - this.lastY) * cell;
    this.hasLast = true;
    this.lastX = s.x;
    this.lastY = s.y;
    this.group.position.set(s.x * cell, 0, s.y * cell);
    return moved;
  }

  turn(s, dt, first) {
    this.yaw += wrapAngle(s.heading - this.yaw) * (first ? 1 : damp(11, dt));
    this.group.rotation.set(0, this.yaw, 0);
  }

  // 멈춘 동안: 자세는 그대로 두고 잘게 떤다
  shake(s, node, a) {
    this.yaw = s.heading;
    this.group.rotation.set(0, s.heading, 0);
    this.group.position.x += (Math.random() - 0.5) * a;
    this.group.position.z += (Math.random() - 0.5) * a;
    node.rotation.z = (Math.random() - 0.5) * a;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
      o.skeleton?.dispose();
    });
    this.owned.forEach((t) => t.dispose());
  }
}

// 몸을 한 덩어리로 합치는 뼈대. 점마다 뼈 하나를 따라가서 그리기 호출이 재질 수만큼만 든다
export class Rig {
  constructor(parent) {
    this.parent = parent;
    this.bones = [];
    this.slots = {};
    this.at = new THREE.Vector3();
  }

  bone(parent, x = 0, y = 0, z = 0) {
    const b = new THREE.Bone();
    b.position.set(x, y, z);
    (parent ?? this.parent).add(b);
    this.bones.push(b);
    return b;
  }

  // geometry 는 뼈 자리를 원점으로 만든 그물이다. slot 이 같은 것끼리 합친다
  part(slot, bone, geometry, x = 0, y = 0, z = 0) {
    bone.updateWorldMatrix(true, false);
    this.at.setFromMatrixPosition(bone.matrixWorld);
    this.at.sub(this.parent.getWorldPosition(new THREE.Vector3()));
    geometry.translate(this.at.x + x, this.at.y + y, this.at.z + z);
    const n = geometry.attributes.position.count;
    const i = this.bones.indexOf(bone);
    const index = new Uint16Array(n * 4);
    const weight = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      index[v * 4] = i;
      weight[v * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(index, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
    (this.slots[slot] ??= []).push(geometry);
  }

  // radius 는 몸을 다 덮는 구의 크기. 뼈마다 점을 다시 재지 않게 정해 둔다
  mesh(slot, material, shadow, center, radius) {
    const m = new THREE.SkinnedMesh(mergeGeometries(this.slots[slot]), material);
    m.castShadow = shadow;
    m.boundingSphere = new THREE.Sphere(center, radius);
    this.parent.add(m);
    return m;
  }

  bind(meshes) {
    this.parent.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones);
    for (const m of meshes) m.bind(skeleton);
    return skeleton;
  }
}
