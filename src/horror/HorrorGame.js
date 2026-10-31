// 공포 모드 3D 화면 전체 흐름
import * as THREE from 'three';
import { cfg } from '../config/index.js';
import { CELL, center, cellOf, frontOf, findPath, lineOfSight } from '../logic/horrorGrid.js';
import { stepPlayer, nextPixelRatio, noiseFor } from '../logic/horrorInput.js';
import { createStalker, tickStalker, sendAway, stunStalker } from '../logic/horrorStalker.js';
import { createRun, takeFuse, chargeShock, useShock, insertFuses, caught, escape, recordEscape, nearestUse } from '../logic/horrorRun.js';
import { saveStore } from '../save.js';
import { factoryMap } from './maps/factory.js';
import { buildWorld } from './world.js';
import { CreatureModel } from './creatureModel.js';
import { HorrorInput } from './input.js';
import { HorrorHud, MONSTER_NAME, startHint } from './hud.js';
import { HorrorAudio } from './audio.js';

const EYE = 1.6; // 눈높이 (미터)
const RADIUS = 0.2; // 주인공 몸 반지름 (칸)
const MAX_DT = 0.05;
const HIDE_LOOK = 0.6; // 사물함 안에서 고개를 돌릴 수 있는 각도 (라디안)
// 잡히는 장면 (초): 얼굴이 달려든다, 화면 가득 찬 채 있다가 어두워진다, 시작 지점으로 돌아간다
const LUNGE_TIME = 0.16;
const FADE_AT = 0.8;
const BACK_AT = 1.5;
const FACE_FAR = 1.5; // 달려들기 시작하는 얼굴 거리 (미터)
const FACE_NEAR = 0.6; // 화면을 채우는 얼굴 거리 (미터)
const FACE_UP = 0.2; // 머리 받침점에서 화면 가운데로 올 곳까지 높이 (미터). 웃는 입까지 보이게 낮춰 잡는다
const FACE_LIGHT = 0.14; // 코앞의 얼굴이 하얗게 날아가지 않게 줄이는 손전등 비율
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

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
    this.state = 'intro'; // 'intro' | 'play' | 'paused' | 'caught' | 'end'
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
    this.run = createRun(this.map, this.k);
    this.fuseMeshes = this.world.addFuses(this.run.fuses);
    this.input = new HorrorInput(root, { touch, k: this.k });
    this.hud = new HorrorHud(root);
    this.hud.setStatus(this.statusNow());
    if (this.showFps) {
      this.fpsLabel = document.createElement('div');
      this.fpsLabel.style.cssText = 'position:absolute;left:16px;top:36px;color:#8f8;font:14px monospace;z-index:4';
      root.appendChild(this.fpsLabel);
    }
    this.onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.onResize);
    this.onVisibility = () => {
      this.audio?.setActive(!document.hidden);
      if (document.hidden) this.pause();
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    window.__horror = this;
    window.__horrorLogic = { findPath, cellOf, frontOf, center, lineOfSight }; // 봇이 쓴다
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
    this.relock();
    this.hud.say(startHint(this.touch), 6);
  }

  // 봇은 이 함수를 바꿔 끼워서 진짜 입력처럼 조작한다
  readInput() {
    return this.input.read();
  }

  relock() {
    this.input.relock(() => this.hud.say('화면을 한 번 누르면 마우스로 둘러볼 수 있어요', 3));
  }

  update(dt) {
    const inp = this.readInput();
    if (this.state === 'play') this.playFrame(inp, dt);
    else if (this.state === 'caught') this.caughtFrame(dt);
    this.placeCamera();
    this.world.update(this.p, this.k.viewCells);
    if (this.state !== 'play') return;
    this.camera.updateMatrixWorld();
    const s = this.stalker;
    this.audio.update(dt);
    this.audio.updateStalker(this.camera, { x: s.x * CELL, y: 1.5, z: s.y * CELL }, s.mode, Math.hypot(s.x - this.p.x, s.y - this.p.y), dt);
  }

  playFrame(inp, dt) {
    if (inp.pause) {
      this.pause();
      return;
    }
    if (inp.light) this.lightOn = !this.lightOn;
    this.flash.visible = this.lightOn && this.hidden === null; // 숨으면 불빛도 가린다
    this.yaw -= inp.lookX;
    if (this.hidden !== null) this.yaw = this.hideYaw + Math.max(-HIDE_LOOK, Math.min(HIDE_LOOK, wrapAngle(this.yaw - this.hideYaw)));
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - inp.lookY));
    const speed = inp.move.run ? this.k.runSpeed : this.k.walkSpeed;
    const before = this.p;
    if (this.hidden === null) this.p = stepPlayer(this.p, inp.move, this.yaw, speed, dt, this.map, RADIUS);
    const moving = this.p.x !== before.x || this.p.y !== before.y;
    const player = { ...this.p, hidden: this.hidden, lightOn: this.lightOn, noise: noiseFor(moving, inp.move.run, this.k) };
    this.onStalkerEvents(tickStalker(this.stalker, { map: this.map, player }, this.k, dt));
    if (this.state !== 'play') return;
    this.model.update(this.stalker, dt, this.p);
    const target = this.nearestUse();
    this.hud.setPrompt(target ? `${this.touch ? '사용' : 'E'}: ${target.label}` : '');
    if (inp.use) this.doUse(target);
    if (inp.punch) this.doPunch();
  }

  statusNow() {
    return { have: this.run.have, need: this.k.fuseCount, shock: this.run.shock, powered: this.run.powered };
  }

  onStalkerEvents(events) {
    this.lastEvents = events;
    if (events.includes('chase')) this.hud.say(`${MONSTER_NAME}에게 들켰다! 도망쳐!`, 2);
    if (events.includes('caught') || events.includes('found')) this.getCaught();
  }

  nearestUse() {
    return nearestUse(this.run, this.map, this.p, this.hidden, this.k);
  }

  doUse(t) {
    if (!t) return;
    if (t.kind === 'fuse' && takeFuse(this.run, t.index)) {
      this.fuseMeshes[t.index].visible = false;
      this.audio.play('fuse');
      if (this.run.have >= this.k.fuseCount) this.hud.say('퓨즈를 다 찾았다! 전원을 찾아 꽂자', 4);
    }
    if (t.kind === 'box' && chargeShock(this.run, t.index)) this.audio.play('fuse');
    if (t.kind === 'panel' && insertFuses(this.run, this.k)) {
      this.world.setPowered();
      this.audio.play('door');
      this.hud.say('전원이 켜졌다! 정문으로 가자!', 4);
    }
    if (t.kind === 'locker') this.toggleLocker(t.index);
    if (t.kind === 'gate') this.win();
    this.hud.setStatus(this.statusNow());
  }

  toggleLocker(i) {
    if (this.hidden === null) {
      this.beforeHide = this.p;
      this.hidden = i;
      const c = this.map.lockers[i];
      this.p = center(c);
      const f = center(frontOf(this.map, c));
      this.hideYaw = Math.atan2(-(f.x - this.p.x), -(f.y - this.p.y));
      this.yaw = this.hideYaw;
      this.pitch = 0;
      this.hud.showSlit(true);
    } else {
      this.hidden = null;
      this.p = this.beforeHide;
      this.hud.showSlit(false);
    }
  }

  doPunch() {
    if (this.hidden !== null) return;
    if (!useShock(this.run)) {
      this.hud.say('쇼크가 없다. 전기 상자에서 충전하자', 2);
      return;
    }
    this.audio.play('punch');
    const s = this.stalker;
    if (Math.hypot(s.x - this.p.x, s.y - this.p.y) <= this.k.shockRange && lineOfSight(this.map, this.p, s)) {
      stunStalker(s, this.k);
      this.hud.say('맞았다! 지금 도망쳐!', 3);
    } else this.hud.say('빗나갔다...', 2);
    this.hud.setStatus(this.statusNow());
  }

  // 잡혔다. 카메라를 괴물 쪽으로 돌리고 얼굴이 코앞으로 달려든다
  getCaught() {
    if (this.state !== 'play') return;
    this.state = 'caught';
    caught(this.run);
    this.audio.suspend();
    this.audio.play('caught');
    this.hidden = null;
    this.hud.showSlit(false);
    this.hud.setPrompt('');
    this.hud.say('', 0);
    const s = this.stalker;
    const dx = s.x - this.p.x;
    const dy = s.y - this.p.y;
    const heading = Math.atan2(-dx, -dy); // 괴물이 주인공을 보는 쪽이자 주인공이 괴물을 보는 yaw
    this.lunge = { t: 0, faded: false, dir: heading, shown: { x: s.x, y: s.y, heading, mode: 'chase' } };
    this.model.yaw = heading;
    this.flash.visible = true;
    this.flash.intensity = this.k.flashIntensity * FACE_LIGHT;
  }

  caughtFrame(dt) {
    const l = this.lunge;
    l.t += dt;
    this.yaw += wrapAngle(l.dir - this.yaw) * Math.min(1, dt * 22);
    this.pitch += (0 - this.pitch) * Math.min(1, dt * 22);
    this.placeFace(l, dt);
    if (!l.faded && l.t >= FADE_AT) {
      l.faded = true;
      this.hud.fade(true);
    }
    if (l.t >= BACK_AT) this.respawn();
  }

  // 머리가 정확히 눈앞에 오도록 몸 전체를 옮긴다. 자세마다 머리 위치가 달라서 재서 맞춘다
  placeFace(l, dt) {
    const m = this.model;
    m.update(l.shown, dt, this.p);
    m.head.rotation.set(0, 0, 0);
    const near = FACE_NEAR + (FACE_FAR - FACE_NEAR) * (1 - Math.min(1, l.t / LUNGE_TIME)) ** 2;
    m.group.updateMatrixWorld(true);
    const face = m.head.getWorldPosition(new THREE.Vector3());
    const fx = -Math.sin(l.dir);
    const fz = -Math.cos(l.dir);
    m.group.position.x += this.p.x * CELL + fx * near - face.x;
    m.group.position.y += EYE - face.y - FACE_UP;
    m.group.position.z += this.p.y * CELL + fz * near - face.z;
  }

  respawn() {
    this.p = center(this.map.start);
    this.yaw = 0;
    this.pitch = 0;
    sendAway(this.stalker, this.map, this.p);
    this.model.update(this.stalker, 0, this.p);
    this.flash.intensity = this.k.flashIntensity;
    this.flash.visible = this.lightOn;
    this.audio.resume();
    this.hud.fade(false);
    this.hud.setStatus(this.statusNow());
    this.hud.say('다시 시작 지점이다. 찾은 퓨즈는 그대로야.', 4);
    this.state = 'play';
  }

  win() {
    if (this.state !== 'play') return;
    const result = escape(this.run, this.k);
    if (!result) return;
    this.state = 'end';
    this.audio.suspend();
    this.audio.play('door');
    const save = saveStore.load();
    save.gems += result.gems;
    save.horror = recordEscape(save.horror, result.clean);
    saveStore.save(save);
    document.exitPointerLock?.();
    this.hud.setPrompt('');
    this.hud.showEnd(`탈출 성공! 보석 ${result.gems}개${result.clean ? ' (한 번도 안 잡혔어요!)' : ''}`, () => this.exit());
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.audio.suspend();
    document.exitPointerLock?.();
    this.hud.showPause(
      () => {
        this.hud.hidePause();
        this.audio.resume();
        this.state = 'play';
        this.relock();
      },
      () => this.exit(),
    );
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
