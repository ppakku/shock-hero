// 공포 모드 3D 화면 전체 흐름
import * as THREE from 'three';
import { cfg } from '../config/index.js';
import { CELL, center } from '../logic/horrorGrid.js';
import { stepPlayer, nextPixelRatio } from '../logic/horrorInput.js';
import { factoryMap } from './maps/factory.js';
import { buildWorld } from './world.js';
import { HorrorInput } from './input.js';

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
    this.fps = 60;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.ratio = Math.min(window.devicePixelRatio || 1, this.k.maxRatio);
    this.showFps = new URLSearchParams(window.location.search).has('fps');

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
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
    this.scene.add(new THREE.AmbientLight(0x8890a8, 0.05));

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, this.k.viewCells * CELL + 6);
    this.scene.add(this.camera);
    this.flash = new THREE.SpotLight(0xfff2d8, 60, 26, 0.5, 0.5, 1.6);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.position.set(0.15, -0.2, 0);
    this.flash.target.position.set(0, -0.2, -1);
    this.camera.add(this.flash, this.flash.target);

    this.world = buildWorld(this.scene, this.map);
    this.input = new HorrorInput(root, { touch, k: this.k });
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
    window.__horror = this;
  }

  start() {
    this.last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const real = (now - this.last) / 1000;
      this.last = now;
      this.update(Math.min(MAX_DT, real)); // 화면이 끊겨도 벽을 뚫지 않게 자른다
      this.renderer.render(this.scene, this.camera);
      this.trackFps(real);
    });
  }

  // 봇은 이 함수를 바꿔 끼워서 진짜 입력처럼 조작한다
  readInput() {
    return this.input.read();
  }

  update(dt) {
    const inp = this.readInput();
    if (inp.pause) return this.exit();
    if (inp.light) this.lightOn = !this.lightOn;
    this.flash.visible = this.lightOn;
    this.yaw -= inp.lookX;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - inp.lookY));
    const speed = inp.move.run ? this.k.runSpeed : this.k.walkSpeed;
    this.p = stepPlayer(this.p, inp.move, this.yaw, speed, dt, this.map, RADIUS);
    this.placeCamera();
    this.world.update(this.p, this.k.viewCells);
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
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    this.input.destroy();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [o.material].flat().forEach((m) => m.dispose());
    });
    this.renderer.dispose();
    window.__horror = null;
    this.onExit();
  }
}
