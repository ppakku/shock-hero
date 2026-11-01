// 공포 모드 1인칭 손과 전기충격기. 벽을 뚫고 보이지 않게 자기 장면을 따로 그려 맨 앞에 겹친다.
import * as THREE from 'three';
import { createGunFx, fireGunFx, chargeGunFx, stepGunFx, gunPush, jagged, ribbonPositions } from '../logic/horrorStunGun.js';
import { artLoader, loadArt } from './art.js';

const FOV = 70; // 게임 카메라와 같아야 번개가 괴물에 닿아 보인다
const DEPTH = 0.5; // 손이 놓이는 카메라 앞 거리 (미터)
const SPOT_X = { pc: 0.5, touch: 0.2 }; // 화면 가운데에서 오른쪽 끝까지를 1 로 친 손 위치. 터치는 버튼을 피해 안쪽에 둔다
const SPOT_Y = -0.62;
const PARTS = 7; // 번개 한 줄의 마디 수
const ARC_PAIRS = 4; // 미리 만들어 두는 번개 수
const FLICKER = 0.05; // 번개 모양을 바꾸는 간격 (초)
const ARC_WIDTH = 0.012; // 번개 빛 번짐 굵기 (거리 1미터 기준)
const CORE_WIDTH = 0.004; // 번개 흰 심 굵기
const SPARK_LEN = 0.22; // 빗나갈 때 앞으로 튀는 불꽃 길이 (미터)
const PUSH_LEN = 0.11; // 찌를 때 앞으로 나가는 거리 (미터)
const BOB = 0.008; // 걸을 때 손이 흔들리는 폭 (미터)
const BOB_SPEED = 9;
const FRONT = -0.3; // 괴물이 이보다 뒤에 있으면 번개를 앞으로 쏜 것처럼 그린다 (미터)
const COLD = { body: 0x24262b, strip: 0x34373d, lamp: 0x4a1c1c };
const LIVE = { body: 0x30343c, strip: 0x46c8ff, lamp: 0x7ce8ff };

function glowTexture() {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.max(0, 1 - d) ** 2 * 255;
      data.set([a, a, a, 255], (y * size + x) * 4); // 더하는 방식으로 그려서 밝기가 곧 투명도다
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.magFilter = THREE.LinearFilter; // 크게 번쩍여도 모서리가 각지지 않게 한다
  tex.needsUpdate = true;
  return tex;
}

// 찌를 때 소매 끝이 화면 안으로 들어와도 잘린 자리가 안 보이게, 오른쪽과 아래 끝을 서서히 지운다. fade: 그림 폭에 대한 비율
function edgeFade(fade) {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = Math.min(1, (1 - x / (size - 1)) / fade) * Math.min(1, y / (size - 1) / fade) * 255;
      data.set([a, a, a, 255], (y * size + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// 번개 한 줄. 파란 번짐과 흰 심 두 겹이다
class Arc {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array((PARTS + 1) * 6);
    this.glow = this.layer(0x3aa8ff, 0.55);
    this.core = this.layer(0xffffff, 1);
    this.hide();
  }

  layer(color, opacity) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.positions.length), 3));
    const index = [];
    for (let i = 0; i < PARTS; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(index);
    const mat = new THREE.MeshBasicMaterial({ color, opacity, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; // 점이 매번 바뀌어서 범위 계산이 맞지 않는다
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    return mesh;
  }

  draw(mesh, points, width) {
    const attr = mesh.geometry.getAttribute('position');
    ribbonPositions(points, width, attr.array);
    attr.needsUpdate = true;
    mesh.visible = true;
  }

  show(points, power = 1) {
    this.draw(this.glow, points, ARC_WIDTH * power);
    this.draw(this.core, points, CORE_WIDTH * power);
  }

  hide() {
    this.glow.visible = false;
    this.core.visible = false;
  }
}

export class StunGun {
  constructor({ aspect, touch, lowFx, k, loader = artLoader() }) {
    this.k = k;
    this.spotX = touch ? SPOT_X.touch : SPOT_X.pc;
    this.arcLimit = lowFx ? k.arcsLow : k.arcs;
    this.fx = createGunFx();
    this.time = 0;
    this.flicker = 0;
    this.charged = false;
    this.bob = 0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.01, 40);
    this.scene.add(this.camera);
    this.ambient = new THREE.AmbientLight(0x9fb0d0, 1);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2);
    this.sun.position.set(-0.4, 0.8, 1);
    this.scene.add(this.ambient, this.sun);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.mats = [];
    this.model = new THREE.Group(); // 그림을 못 받았을 때 보이는 3D 손
    this.root.add(this.model);
    this.buildBody();
    this.buildHand();
    this.buildArt(loader);
    this.glowTex = glowTexture();
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x66c8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
    this.halo.renderOrder = 1;
    this.halo.visible = false;
    this.scene.add(this.halo);
    this.arcs = Array.from({ length: ARC_PAIRS }, () => new Arc(this.scene));
    this.resize(aspect);
    this.show(false);
    this.paint();
  }

  mat(color, extra = {}) {
    const m = new THREE.MeshLambertMaterial({ color, fog: false, ...extra });
    this.mats.push(m);
    return m;
  }

  box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.model.add(m);
    return m;
  }

  rod(r, len, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    this.model.add(m);
    return m;
  }

  // 앞쪽이 -z 다. 몸통, 빛나는 띠, 표시등, 끝의 금속 침 두 개
  buildBody() {
    this.bodyMat = this.mat(COLD.body);
    this.stripMat = new THREE.MeshBasicMaterial({ color: COLD.strip, fog: false });
    this.lampMat = new THREE.MeshBasicMaterial({ color: COLD.lamp, fog: false });
    const steel = this.mat(0xb8bcc4);
    const stripe = this.mat(0xd8a820);
    this.box(0.055, 0.062, 0.2, this.bodyMat, 0, 0, -0.04);
    this.box(0.066, 0.074, 0.05, this.bodyMat, 0, 0, -0.155);
    this.box(0.057, 0.016, 0.02, stripe, 0, 0, -0.02);
    this.box(0.012, 0.008, 0.13, this.stripMat, 0, 0.033, -0.05);
    this.lamp = this.box(0.016, 0.01, 0.016, this.lampMat, 0, 0.034, 0.04);
    this.rod(0.0055, 0.05, steel, 0.02, 0, -0.2);
    this.rod(0.0055, 0.05, steel, -0.02, 0, -0.2);
    this.tipA = new THREE.Object3D();
    this.tipA.position.set(0.02, 0, -0.226);
    this.tipB = new THREE.Object3D();
    this.tipB.position.set(-0.02, 0, -0.226);
    this.root.add(this.tipA, this.tipB);
  }

  // 손잡이를 쥔 손과 화면 밖으로 이어지는 소매
  buildHand() {
    const skin = this.mat(0xb98a68);
    const sleeve = this.mat(0x2c3a4e);
    this.box(0.05, 0.1, 0.05, this.bodyMat, 0, -0.07, 0.03);
    this.box(0.07, 0.085, 0.07, skin, 0.002, -0.08, 0.04);
    for (let i = 0; i < 4; i++) this.box(0.074, 0.018, 0.022, skin, 0.002, -0.05 - i * 0.021, 0.0);
    this.box(0.02, 0.022, 0.06, skin, -0.036, -0.038, 0.02);
    const cuff = this.box(0.095, 0.095, 0.12, sleeve, 0.012, -0.11, 0.13);
    cuff.rotation.x = 0.55;
    const arm = this.box(0.1, 0.1, 0.5, sleeve, 0.04, -0.27, 0.36);
    arm.rotation.x = 0.55;
  }

  // 손 그림 두 장을 다 받아야 3D 손과 바꾼다. 충전하는 순간 그림만 갈아 끼우니 움직임은 그대로다
  buildArt(loader) {
    const { hand } = this.k;
    this.fadeTex = edgeFade(hand.fade);
    this.artMat = new THREE.MeshBasicMaterial({ alphaMap: this.fadeTex, transparent: true, depthTest: false, depthWrite: false, fog: false });
    this.art = new THREE.Mesh(new THREE.PlaneGeometry(hand.w, hand.h), this.artMat);
    this.art.position.y = -hand.drop;
    this.art.rotation.set(-hand.turn[0], -hand.turn[1], 0);
    this.art.visible = false;
    this.root.add(this.art);
    const got = {};
    const ready = (name) => (tex) => {
      got[name] = tex;
      if (got.cold && got.live) this.useArt(got);
    };
    this.artTex = [loadArt(loader, 'horror_hand_cold.png', ready('cold')), loadArt(loader, 'horror_hand_live.png', ready('live'))];
  }

  useArt(tex) {
    const { hand } = this.k;
    this.handArt = tex;
    this.artWaiting = true;
    this.model.visible = false;
    this.art.visible = true;
    const spot = ([u, v]) => new THREE.Vector3((u - 0.5) * hand.w, (0.5 - v) * hand.h, 0).applyEuler(this.art.rotation).add(this.art.position);
    this.tipA.position.copy(spot(hand.tips[0]));
    this.tipB.position.copy(spot(hand.tips[1]));
    this.paint();
    this.artMat.needsUpdate = true;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * DEPTH;
    this.home = { x: halfH * aspect * this.spotX, y: halfH * SPOT_Y, z: -DEPTH };
  }

  show(on) {
    this.root.visible = on;
    if (on) return;
    this.halo.visible = false;
    this.arcs.forEach((a) => a.hide());
  }

  setCharged(on) {
    if (on === this.charged) return;
    this.charged = on;
    this.paint();
  }

  paint() {
    const look = this.charged ? LIVE : COLD;
    this.bodyMat.color.setHex(look.body);
    this.stripMat.color.setHex(look.strip);
    this.lampMat.color.setHex(look.lamp);
    if (this.handArt) this.artMat.map = this.charged ? this.handArt.live : this.handArt.cold;
  }

  fire(result) {
    fireGunFx(this.fx, result, this.k);
    this.flicker = 0;
  }

  chargeUp() {
    chargeGunFx(this.fx, this.k);
    this.flicker = 0;
  }

  // lit: 손전등이 켜졌는지, walking: 걷는 중인지, target: 번개가 향할 곳 (카메라 공간)
  update(dt, { lit, walking, target }) {
    stepGunFx(this.fx, dt);
    this.time += dt;
    this.ambient.intensity = lit ? 1 : 0.55; // 손전등을 꺼도 손은 보여야 한다
    this.sun.intensity = lit ? 2 : 0.5;
    this.artMat.color.setScalar(lit ? 1 : this.k.hand.dark);
    if (walking) this.bob = Math.sin(this.time * BOB_SPEED) * BOB;
    const push = gunPush(this.fx, this.k) * PUSH_LEN;
    this.root.position.set(this.home.x - push * 0.3, this.home.y + this.bob + push * 0.25, this.home.z - push);
    this.root.rotation.set(0.1 + push * 1.2, 0.14 + this.home.x * 0.18, 0);
    this.root.updateMatrixWorld(true);
    if (!this.root.visible) return;
    const a = this.tipA.getWorldPosition(new THREE.Vector3());
    const b = this.tipB.getWorldPosition(new THREE.Vector3());
    this.placeHalo(a, b);
    this.flicker -= dt;
    if (this.flicker > 0) return;
    this.flicker = FLICKER;
    this.drawArcs(a, b, target);
  }

  placeHalo(a, b) {
    const fx = this.fx;
    const flare = Math.max(fx.chargeT / this.k.chargeTime, fx.zapT / this.k.zapTime);
    this.halo.visible = this.charged || flare > 0;
    if (!this.halo.visible) return;
    const pulse = 0.09 + Math.sin(this.time * 40) * 0.012;
    const size = pulse + flare * this.k.flareSize;
    this.halo.position.copy(a).add(b).multiplyScalar(0.5);
    this.halo.scale.set(size, size, 1);
  }

  drawArcs(a, b, target) {
    this.arcs.forEach((arc) => arc.hide());
    const mid = a.clone().add(b).multiplyScalar(0.5);
    let n = 0;
    const put = (from, to, jitter, power) => {
      if (n < this.arcLimit) this.arcs[n++].show(jagged(from, to, PARTS, jitter), power);
    };
    if (this.fx.boltT > 0) {
      const end = target && target.z < FRONT ? target : new THREE.Vector3(0, 0, -2);
      const jitter = this.k.boltJitter * Math.min(1, -end.z);
      for (let i = 0; i < this.arcLimit; i++) put(mid, end, jitter, 1.6);
      return;
    }
    if (this.fx.zapT > 0) {
      for (let i = 0; i < this.arcLimit; i++) {
        const end = mid.clone().add(new THREE.Vector3((Math.random() - 0.5) * SPARK_LEN, (Math.random() - 0.5) * SPARK_LEN, -SPARK_LEN * Math.random()));
        put(mid, end, 0.02, 1.2);
      }
      return;
    }
    if (this.fx.chargeT > 0) {
      for (let i = 0; i < this.arcLimit; i++) put(a, b, 0.035, 1.3);
      return;
    }
    if (this.charged) put(a, b, 0.018, 1); // 탁탁 튀는 평소 전기
  }

  // 게임 화면을 그린 다음에 부른다
  render(renderer) {
    if (this.artWaiting) { // 첫 충전 때 멈칫하지 않게 두 장 다 미리 올린다
      this.artWaiting = false;
      renderer.initTexture(this.handArt.cold);
      renderer.initTexture(this.handArt.live);
    }
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }

  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.glowTex.dispose();
    this.fadeTex.dispose();
    this.artTex.forEach((t) => t?.dispose());
  }
}
