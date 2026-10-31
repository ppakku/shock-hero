// 공포 모드 3D 화면 전체 흐름
import * as THREE from 'three';
import { cfg } from '../config/index.js';
import { CELL, center } from '../logic/horrorGrid.js';
import { stepPlayer, nextPixelRatio, noiseFor } from '../logic/horrorInput.js';
import { createStalker, tickStalker } from '../logic/horrorStalker.js';
import { factoryMap } from './maps/factory.js';
import { buildWorld } from './world.js';
import { CreatureModel } from './creatureModel.js';
import { HorrorInput } from './input.js';
import { HorrorHud, startHint } from './hud.js';
import { HorrorAudio } from './audio.js';

const EYE = 1.6; // 눈높이 (미터)
const RADIUS = 0.2; // 주인공 몸 반지름 (칸)
const MAX_DT = 0.05;

export class HorrorGame {
  constructor(root, { touch, lowFx, muted, onExit }) {
    this.root = root;
    this.touch = touch;
    this.lowFx = lowFx;
    this.muted = muted;
    this.onExit = onExit;
    this.k = cfg.horror;
    this.map = factoryMap;
    this.p = center(this.map.start);
    this.yaw = 0;
    this.pitch = 0;
    this.lightOn = true;
    this.state = 'intro'; // 'intro' | 'play'
    this.audio = null;
    this.fps = 60;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.ratio = Math.min(window.devicePixelRatio || 1, this.k.maxRatio);
    this.showFps = new URLSearchParams(window.location.search).has('fps');

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    try {
      this.build(root, touch);
    } catch (e) {
      this.input?.destroy();
      this.hud?.destroy();
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
      this.renderer.dispose(); // 만들다 실패하면 WebGL 자리를 돌려준다
      this.renderer.forceContextLoss();
      throw e;
    }
  }

  build(root, touch) {
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    root.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 3, this.k.viewCells * CELL);
    this.scene.add(new THREE.AmbientLight(0x8890a8, this.k.ambient));

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, this.k.viewCells * CELL + 6);
    this.scene.add(this.camera);
    this.flash = new THREE.SpotLight(0xfff2d8, this.k.flashIntensity, this.k.flashDistance, this.k.flashAngle, this.k.flashPenumbra, this.k.flashDecay);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.position.set(0.15, -0.2, 0);
    this.flash.target.position.set(0.15, -0.2, -1);
    this.camera.add(this.flash, this.flash.target);

    this.world = buildWorld(this.scene, this.map);
    this.stalker = createStalker(this.map);
    this.model = new CreatureModel(this.scene);
    this.model.update(this.stalker, 0, this.p); // 시작 전에도 제자리에 서 있게 한다
    this.hidden = null;
    this.input = new HorrorInput(root, { touch, k: this.k });
    this.hud = new HorrorHud(root);
    if (this.showFps) {
      this.fpsLabel = document.createElement('div');
      this.fpsLabel.style.cssText = 'position:absolute;left:8px;top:8px;color:#8f8;font:14px monospace;z-index:4';
      root.appendChild(this.fpsLabel);
    }
    this.onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.onResize);
    this.onVisibility = () => this.audio?.setActive(!document.hidden);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.__horror = this;
  }

  start() {
    this.hud.showIntro(this.touch, () => this.beginPlay(), () => this.exit());
    this.last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const real = (now - this.last) / 1000;
      this.last = now;
      this.update(Math.min(MAX_DT, real)); // 화면이 끊겨도 벽을 뚫지 않게 자른다
      if (this.dead) return; // 이번 프레임에 나갔으면 그리지 않는다
      this.renderer.render(this.scene, this.camera);
      this.trackFps(real);
    });
  }

  // 시작 버튼을 누른 순간에 부른다. 소리와 마우스 잠금은 이때만 허락된다.
  beginPlay() {
    this.hud.closeLayer();
    this.state = 'play';
    this.audio = new HorrorAudio({ muted: this.muted });
    this.input.relock();
    this.hud.say(startHint(this.touch), 6);
  }

  // 봇은 이 함수를 바꿔 끼워서 진짜 입력처럼 조작한다
  readInput() {
    return this.input.read();
  }

  update(dt) {
    const inp = this.readInput();
    if (inp.pause) {
      this.exit();
      return;
    }
    if (this.state === 'play') {
      if (inp.light) this.lightOn = !this.lightOn;
      this.flash.visible = this.lightOn;
      this.yaw -= inp.lookX;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - inp.lookY));
      const speed = inp.move.run ? this.k.runSpeed : this.k.walkSpeed;
      const before = this.p;
      if (this.hidden === null) this.p = stepPlayer(this.p, inp.move, this.yaw, speed, dt, this.map, RADIUS);
      const moving = this.p.x !== before.x || this.p.y !== before.y;
      const player = { ...this.p, hidden: this.hidden, lightOn: this.lightOn, noise: noiseFor(moving, inp.move.run, this.k) };
      this.onStalkerEvents(tickStalker(this.stalker, { map: this.map, player }, this.k, dt));
      this.model.update(this.stalker, dt, this.p);
      this.audio.update(dt);
    }
    this.placeCamera();
    this.world.update(this.p, this.k.viewCells);
  }

  onStalkerEvents(events) {
    this.lastEvents = events;
  }

  placeCamera() {
    this.camera.position.set(this.p.x * CELL, EYE, this.p.y * CELL);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  trackFps(dt) {
    this.fpsFrames += 1;
    this.fpsTime += dt;
    if (this.fpsTime < 2) return;
    this.fps = this.fpsFrames / this.fpsTime;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    const next = nextPixelRatio(this.ratio, this.fps, this.k);
    if (next !== this.ratio) {
      this.ratio = next;
      this.renderer.setPixelRatio(next);
    }
    if (this.fpsLabel) this.fpsLabel.textContent = `${Math.round(this.fps)} fps, 배율 ${this.ratio.toFixed(1)}`;
  }

  exit() {
    if (this.dead) return;
    this.dead = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.destroy();
    this.hud.destroy();
    this.audio?.destroy();
    this.model.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [o.material].flat().forEach((m) => m.dispose());
      if (o.isInstancedMesh) o.dispose(); // 벽 인스턴스 버퍼
    });
    this.flash.shadow.dispose(); // 손전등 그림자 지도
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // 태블릿은 WebGL 을 몇 개만 허용한다
    window.__horror = null;
    this.onExit();
  }
}
