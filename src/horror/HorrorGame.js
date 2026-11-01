// 공포 모드 3D 화면 전체 흐름
import * as THREE from 'three';
import { cfg } from '../config/index.js';
import { CELL, center, cellOf, frontOf, findPath, lineOfSight, canSeeBody, reachable, inPlayerView } from '../logic/horrorGrid.js';
import { stepPlayer, nextPixelRatio, startRatio, noiseFor, createStamina, canRun, stepStamina } from '../logic/horrorInput.js';
import { createStalker, tickStalker, sendAway, stunStalker } from '../logic/horrorStalker.js';
import { createRun, takeFuse, takeKey, openDoor, keysHeld, KEY_NAMES, respawnSpot, chargeShock, useShock, insertFuses, caught, escape, escapeReward, recordEscape, nearestUse } from '../logic/horrorRun.js';
import { createNotes, takeNote } from '../logic/horrorNotes.js';
import { todayKey } from '../logic/daily.js';
import { saveStore } from '../save.js';
import { sfx } from '../audio/sfx.js';
import { MAPS, MONSTERS } from './content.js';
import { buildWorld } from './world.js';
import { createCreature } from './creatureModel.js';
import { HorrorInput } from './input.js';
import { HorrorHud, startHint, escapeText } from './hud.js';
import { HorrorAudio } from './audio.js';
import { FINAL_LINES, NOTE_DANGER_LINE, fillName } from './story.js';

const EYE = 1.6; // 눈높이 (미터)
const RADIUS = 0.2; // 주인공 몸 반지름 (칸)
const MAX_DT = 0.05;
const FPS_GAP = 0.5; // 이보다 긴 프레임은 화면이 가려졌던 틈이라 초당 장수에 넣지 않는다 (초)
const LOST_TEXT = '화면이 잠깐 꺼졌어요. 돌아올 때까지 기다려 주세요';
const BACK_TEXT = '화면이 돌아왔어요. 계속하기를 누르세요';
const HIDE_LOOK = 0.6; // 사물함 안에서 고개를 돌릴 수 있는 각도 (라디안)
// 잡히는 장면 (초): 얼굴이 달려든다, 화면 가득 찬 채 있다가 어두워진다, 가까운 돌아올 곳으로 돌아간다
const LUNGE_TIME = 0.16;
const FADE_AT = 0.8;
const BACK_AT = 1.5;
const FACE_FAR = 1.5; // 달려들기 시작하는 얼굴 거리 (미터)
const FACE_NEAR = 0.6; // 화면을 채우는 얼굴 거리 (미터)
const FACE_UP = 0.2; // 머리 받침점에서 화면 가운데로 올 곳까지 높이 (미터). 웃는 입까지 보이게 낮춰 잡는다
const FACE_LIGHT = 0.14; // 코앞의 얼굴이 하얗게 날아가지 않게 줄이는 손전등 비율
// 놀람 장면 (map.scares) 에서 한 번씩 뜨는 글. 피나 다친 모습 없이 소리와 불빛으로만 놀라게 한다
const SCARE_LINES = ['바로 뒤에서 숨소리가 들린 것 같다...', '어디선가 발톱이 바닥을 긁는다', '불빛이 깜빡인다. {name}가 가까이 있나?', '쇠 긁는 소리가 천장에서 난다'];
const BLINK_STEP = 0.09; // 손전등이 켜졌다 꺼지는 간격 (초)
const BLINK_COUNT = 7;
const BLINK_DIM = 0.1; // 꺼진 순간에 남는 밝기 비율
const NOTE_AGAIN = '쪽지는 일시정지 화면에서 다시 읽을 수 있어'; // 쪽지가 저절로 닫혔을 때 덧붙인다
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class HorrorGame {
  // round: { mapId, monsterId }. onAgain: 끝 화면의 한 판 더. 정리를 마친 뒤에 부른다
  constructor(root, { round, touch, device, lowFx, muted, onExit, onAgain }) {
    this.root = root;
    this.round = round;
    this.place = MAPS[round.mapId];
    this.monster = MONSTERS[round.monsterId];
    this.touch = touch;
    this.device = device;
    this.lowFx = lowFx;
    this.muted = muted;
    this.onExit = onExit;
    this.onAgain = onAgain;
    this.k = cfg.horror;
    this.run = createRun(this.place.map, this.k);
    this.map = this.run.level; // 잠긴 문이 판마다 따로 열리는 맵 사본
    this.notes = createNotes(this.map.notes.map(center));
    this.noteTexts = fillName(this.place.notes, this.monster.name);
    this.p = center(this.map.start);
    this.yaw = 0;
    this.pitch = 0;
    this.lightOn = true;
    this.state = 'intro'; // 'intro' | 'play' | 'paused' | 'caught' | 'end'
    this.scaresLeft = [...this.map.scares];
    this.blink = null; // 손전등 깜빡임 진행 상태. 잡힘과 나가기에서 끊는다
    this.playTime = 0;
    this.audio = null;
    this.fps = 60;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.ratio = startRatio(window.devicePixelRatio, touch, this.k);
    this.showFps = new URLSearchParams(window.location.search).has('fps');

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    try {
      this.build(root, touch);
    } catch (e) {
      this.input?.destroy();
      this.hud?.destroy();
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
      this.unbindContext();
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
    const { theme } = this.place;
    this.scene.background = new THREE.Color(theme.fog);
    this.scene.fog = new THREE.Fog(theme.fog, 3, this.k.viewCells * CELL);
    this.scene.add(new THREE.AmbientLight(theme.ambient, this.k.ambient));

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, this.k.viewCells * CELL + 6);
    this.scene.add(this.camera);
    this.flash = new THREE.SpotLight(0xfff2d8, this.k.flashIntensity, this.k.flashDistance, this.k.flashAngle, this.k.flashPenumbra, this.k.flashDecay);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.position.set(0.15, -0.2, 0);
    this.flash.target.position.set(0.15, -0.2, -1);
    this.camera.add(this.flash, this.flash.target);

    this.world = buildWorld(this.scene, this.map, this.k, theme);
    this.stalker = createStalker(this.map, this.k, Math.random, this.round.monsterId);
    this.model = createCreature(this.monster.model, this.scene);
    this.model.update(this.stalker, 0, this.p); // 시작 전에도 제자리에 서 있게 한다
    this.hidden = null;
    this.stamina = createStamina();
    this.fuseMeshes = this.world.addFuses(this.run.fuses);
    this.keyMeshes = this.world.addKeys(this.run.keys);
    this.noteMeshes = this.world.addNotes(this.notes.spots);
    this.input = new HorrorInput(root, { touch, small: this.device === 'phone', k: this.k });
    this.hud = new HorrorHud(root, this.named(NOTE_DANGER_LINE));
    this.hud.setStatus(this.statusNow());
    if (this.showFps) {
      this.fpsLabel = document.createElement('div');
      this.fpsLabel.style.cssText = 'position:absolute;left:16px;top:56px;color:#8f8;font:14px monospace;z-index:4';
      root.appendChild(this.fpsLabel);
    }
    this.onResize = () => {
      if (this.device === 'phone' && window.innerHeight > window.innerWidth) this.pause(); // 세로로 돌리면 '가로로 돌려 주세요' 화면이 덮는다
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
    this.onContextLost = (e) => {
      e.preventDefault(); // 이렇게 해야 복구 신호가 온다
      this.contextLost = true;
      this.hud.setNotice(LOST_TEXT);
      this.pause(); // 까만 화면에서 쫓기지 않게 한다
    };
    this.onContextRestored = () => {
      this.contextLost = false;
      this.hud.setNotice(this.state === 'paused' ? BACK_TEXT : ''); // 스스로 다시 시작하지 않고 일시정지에 머문다
    };
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    window.__horror = this;
    window.__horrorLogic = { findPath, cellOf, frontOf, center, lineOfSight, reachable }; // 봇이 쓴다
  }

  // 글 속의 {name} 을 이번 판 괴물 이름으로 바꾼다
  named(text) {
    return fillName(text, this.monster.name);
  }

  unbindContext() {
    if (!this.onContextLost) return;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  start() {
    const round = { mapName: this.place.name, monsterName: this.monster.name, hint: this.monster.hint };
    this.hud.showIntro(this.device, round, () => this.beginPlay(), () => this.exit());
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
    if (this.contextLost) return; // 화면이 돌아오면 다시 누른다
    this.hud.closeLayer();
    this.state = 'play';
    try {
      this.audio = new HorrorAudio({ muted: this.muted, voice: this.monster.voice });
    } catch (e) {
      console.error('공포 모드 소리를 켜지 못해 소리 없이 합니다', e);
    }
    this.relock();
    this.hud.say(startHint(this.device), 6);
  }

  // 세이노를 처음 볼 때와 손전등을 처음 끌 때 화면이 멈추지 않게, 안내 화면 뒤에서 한 장씩 그려 둔다
  warmUp() {
    this.warmed = true;
    const m = this.model;
    m.group.position.set(this.p.x * CELL, 0, (this.p.y - 1) * CELL); // 시작할 때 보는 쪽
    this.renderer.render(this.scene, this.camera);
    this.flash.visible = false;
    this.renderer.render(this.scene, this.camera);
    this.flash.visible = this.lightOn;
    m.update(this.stalker, 0, this.p);
  }

  // 봇은 이 함수를 바꿔 끼워서 진짜 입력처럼 조작한다
  readInput(dt) {
    return this.input.read(dt);
  }

  relock() {
    this.input.relock(() => this.hud.say('화면을 한 번 누르면 마우스로 둘러볼 수 있어요', 3));
  }

  update(dt) {
    const inp = this.readInput(dt);
    if (this.state === 'play') {
      this.playTime += dt;
      this.playFrame(inp, dt);
    }
    else if (this.state === 'caught') this.caughtFrame(dt);
    this.placeCamera();
    this.world.update(this.p, this.k.viewCells, this.playTime, this.lowFx);
    if (this.state === 'intro' && !this.warmed && this.model.textures.every((t) => t.image)) this.warmUp();
    if (this.state !== 'play') return;
    this.camera.updateMatrixWorld();
    const s = this.stalker;
    this.audio?.update(dt);
    this.audio?.updateStalker(this.camera, { x: s.x * CELL, y: 1.5, z: s.y * CELL }, s.mode, Math.hypot(s.x - this.p.x, s.y - this.p.y), dt);
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
    const running = canRun(this.stamina, inp.move.run);
    const speed = running ? this.k.runSpeed : this.k.walkSpeed;
    const before = this.p;
    if (this.hidden === null) this.p = stepPlayer(this.p, inp.move, this.yaw, speed, dt, this.map, RADIUS);
    const moving = this.p.x !== before.x || this.p.y !== before.y;
    const player = { ...this.p, hidden: this.hidden, lightOn: this.lightOn, noise: noiseFor(moving, running, this.k) };
    this.tickStamina(running && moving, dt);
    const seen = inPlayerView(this.p, this.yaw, this.stalker, this.map, this.k, this.hidden !== null);
    this.onStalkerEvents(tickStalker(this.stalker, { map: this.map, player, seen, pressure: this.run.have / this.k.fuseCount }, this.k, dt));
    if (this.state !== 'play') return;
    this.model.update(this.stalker, dt, this.p);
    this.cullCreature();
    this.checkScare();
    this.tickBlink(dt);
    const target = this.nearestUse();
    this.hud.setPrompt(this.promptFor(target));
    if (inp.use && !this.hud.closeNote()) this.doUse(target); // 쪽지가 열려 있으면 닫기만 한다
    if (inp.punch) this.doPunch();
  }

  promptFor(target) {
    if (this.hud.noteOpen) return `${this.touch ? '사용' : 'E'}: 쪽지 닫기`;
    if (!target) return '';
    return target.kind === 'locked' ? target.label : `${this.touch ? '사용' : 'E'}: ${target.label}`;
  }

  // 벽에 가린 세이노는 그리지 않는다. 몸이 무거워서 태블릿에서 크게 차이 난다.
  // 사물함 안은 시선 계산의 출발 칸이 막혀 있어서 늘 그린다.
  cullCreature() {
    this.model.group.visible = this.hidden !== null || canSeeBody(this.map, this.p, this.stalker, this.k.creatureNear);
  }

  // 놀람 칸을 처음 밟으면 큰 소리가 나고 손전등이 깜빡인다. 효과 줄이기를 켜면 깜빡임은 뺀다
  checkScare() {
    const c = cellOf(this.p);
    const i = this.scaresLeft.findIndex((s) => s.cx === c.cx && s.cy === c.cy);
    if (i < 0) return;
    this.scaresLeft.splice(i, 1);
    this.audio?.play('scare');
    this.hud.say(this.named(SCARE_LINES[Math.floor(Math.random() * SCARE_LINES.length)]), 3);
    if (!this.lowFx) this.blink = { t: 0, n: 0 };
  }

  // 시간으로 깜빡임을 돌린다 (일시정지 때는 같이 멈춘다)
  tickBlink(dt) {
    const b = this.blink;
    if (!b) return;
    b.t += dt;
    while (b.t >= BLINK_STEP && this.blink) {
      b.t -= BLINK_STEP;
      b.n += 1;
      if (b.n >= BLINK_COUNT) this.cancelBlink();
      else this.flash.intensity = b.n % 2 ? this.k.flashIntensity * BLINK_DIM : this.k.flashIntensity;
    }
  }

  // 깜빡임을 끊고 손전등을 원래 밝기로 돌려놓는다 (밝기는 balance 에서 다시 읽는다)
  cancelBlink() {
    this.blink = null;
    this.flash.intensity = this.k.flashIntensity;
  }

  tickStamina(running, dt) {
    const wasTired = this.stamina.tired;
    this.stamina = stepStamina(this.stamina, running, this.k, dt);
    if (this.stamina.tired && !wasTired) this.hud.say('숨이 찼다! 잠깐 걸어야 해', 2);
    this.hud.setStamina(this.stamina);
  }

  statusNow() {
    return { have: this.run.have, need: this.k.fuseCount, shock: this.run.shock, powered: this.run.powered, keys: keysHeld(this.run), notesFound: this.notes.found, notesTotal: this.notes.total };
  }

  onStalkerEvents(events) {
    this.lastEvents = events;
    if (events.includes('chase')) {
      const cut = this.hud.closeNote(); // 쪽지가 앞을 가린 채로 쫓기지 않게 한다
      this.hud.say(`${this.named(this.monster.alarm)}${cut ? ` ${NOTE_AGAIN}` : ''}`, cut ? 4 : 2);
    }
    if (events.includes('slip')) this.hud.say(this.named('{name}가 사라졌다...'), 3);
    if (events.includes('sniff')) this.hud.say(this.named('움직이지 마! {name}가 냄새를 맡고 있다'), 2);
    if (events.includes('caught') || events.includes('found')) this.getCaught();
  }

  nearestUse() {
    // 쫓기는 동안에는 쪽지를 고르지 않는다. 열자마자 앞을 가리고 숨기가 한 번 늦어진다
    return nearestUse(this.run, this.map, this.p, this.hidden, this.k, this.stalker.mode === 'chase' ? undefined : this.notes);
  }

  doUse(t) {
    if (!t) return;
    if (t.kind === 'fuse' && takeFuse(this.run, t.index)) {
      this.fuseMeshes[t.index].visible = false;
      this.audio?.play('fuse');
      if (this.run.have >= this.k.fuseCount) this.hud.say('퓨즈를 다 찾았다! 전원을 찾아 꽂자', 4);
    }
    if (t.kind === 'key' && takeKey(this.run, t.index)) {
      this.keyMeshes[t.index].visible = false;
      this.audio?.play('fuse');
      this.hud.say(`${KEY_NAMES[t.index]} 열쇠를 찾았다! ${KEY_NAMES[t.index]} 문을 찾자`, 4);
    }
    if (t.kind === 'note') this.readNote(t.index);
    if (t.kind === 'lock' && openDoor(this.run, t.index)) {
      this.world.openDoor(t.index);
      this.audio?.play('door');
      this.hud.say(`문이 열렸다. ${this.monster.name}도 이제 들어올 수 있어!`, 4);
    }
    if (t.kind === 'box' && chargeShock(this.run, t.index)) this.audio?.play('fuse');
    if (t.kind === 'panel' && insertFuses(this.run, this.k)) {
      this.world.setPowered();
      this.audio?.play('door');
      this.hud.say('전원이 켜졌다! 정문으로 가자!', 4);
    }
    if (t.kind === 'locker') this.toggleLocker(t.index);
    if (t.kind === 'gate') this.win();
    this.hud.setStatus(this.statusNow());
  }

  // 세이노는 읽는 동안에도 움직인다
  readNote(i) {
    const order = takeNote(this.notes, i);
    if (order < 0) return;
    this.noteMeshes[i].visible = false;
    this.audio?.play('fuse');
    this.hud.showNote(this.noteTexts[order], this.device === 'phone');
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
    this.audio?.play('punch');
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
    this.cancelBlink(); // 깜빡임이 잡히는 장면의 밝기를 덮어쓰지 않게 한다
    this.noteCut = this.hud.closeNote();
    caught(this.run);
    this.audio?.suspend();
    this.audio?.play('caught');
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
    this.model.group.visible = true; // 사물함 밖에서 벽 너머로 잡혀도 얼굴은 보여야 한다
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
    const stop = m.faceNear ?? FACE_NEAR; // 긴 이빨이 카메라를 뚫는 괴물은 더 멀리 선다
    const near = stop + (FACE_FAR - stop) * (1 - Math.min(1, l.t / LUNGE_TIME)) ** 2;
    m.group.updateMatrixWorld(true);
    const face = m.head.getWorldPosition(new THREE.Vector3());
    const fx = -Math.sin(l.dir);
    const fz = -Math.cos(l.dir);
    m.group.position.x += this.p.x * CELL + fx * near - face.x;
    m.group.position.y += EYE - face.y - FACE_UP;
    m.group.position.z += this.p.y * CELL + fz * near - face.z;
  }

  respawn() {
    this.p = center(respawnSpot(this.map, this.p));
    this.yaw = 0;
    this.pitch = 0;
    this.stamina = createStamina();
    this.hud.setStamina(this.stamina);
    sendAway(this.stalker, this.map, this.p);
    this.model.update(this.stalker, 0, this.p);
    this.cullCreature();
    this.flash.intensity = this.k.flashIntensity;
    this.flash.visible = this.lightOn;
    this.audio?.resume();
    this.hud.fade(false);
    this.hud.setStatus(this.statusNow());
    this.hud.say(`안전한 곳으로 돌아왔다. 찾은 것은 그대로야.${this.noteCut ? ` ${NOTE_AGAIN}` : ''}`, 4);
    this.state = 'play';
    // 잡히는 동안 Esc 로 마우스가 풀렸거나 화면이 꺼졌으면 쫓기기 전에 멈춘다
    if (this.contextLost || (!this.touch && !this.input.locked())) this.pause();
  }

  win() {
    if (this.state !== 'play') return;
    const result = escape(this.run);
    if (!result) return;
    this.state = 'end';
    this.audio?.suspend();
    this.audio?.play('door');
    const save = saveStore.load();
    const today = todayKey();
    const reward = escapeReward(save.horror, result.clean, today, this.k);
    save.gems += reward.gems;
    save.horror = recordEscape(save.horror, result.clean, today);
    saveStore.save(save);
    document.exitPointerLock?.();
    this.input.clearTouch();
    this.hud.closeNote();
    this.hud.setPrompt('');
    this.hud.showEnd(escapeText(reward, result.clean), () => this.exit(this.onAgain), () => this.exit(), { found: this.notes.found, total: this.notes.total, final: this.named(FINAL_LINES[this.round.mapId]) });
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.cancelBlink();
    this.noteAtPause = this.hud.noteLines; // 계속하기를 누르면 다시 펼친다
    this.hud.closeNote();
    this.input.clearTouch();
    this.audio?.suspend();
    document.exitPointerLock?.();
    this.openPause();
  }

  openPause() {
    const read = this.notes.read.map((order) => this.noteTexts[order]);
    const phone = this.device === 'phone';
    const onNotes = read.length ? () => this.hud.showReadNotes(read, () => this.openPause(), phone) : null;
    this.hud.showPause(() => this.resumePlay(), () => this.exit(), onNotes, phone);
  }

  // 계속하기를 누른 순간에 부른다. iPad 는 밖에 나갔다 오면 소리를 멈춰 두므로 여기서 다시 깨운다
  resumePlay() {
    if (this.contextLost) return; // 화면이 없는 채로 쫓기지 않게 돌아올 때까지 기다린다
    sfx.unlock();
    this.hud.setNotice('');
    this.hud.hidePause();
    if (this.noteAtPause) this.hud.showNote(this.noteAtPause, this.device === 'phone');
    this.noteAtPause = null;
    this.audio?.resume();
    this.state = 'play';
    this.relock();
  }

  placeCamera() {
    this.camera.position.set(this.p.x * CELL, EYE, this.p.y * CELL);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  trackFps(dt) {
    if (dt > FPS_GAP) return; // 가려진 틈 때문에 해상도가 내려가지 않게 한다
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

  // next: 정리가 끝난 뒤 부른다. 기본은 타이틀로 돌아가기
  exit(next = this.onExit) {
    if (this.dead) return;
    this.dead = true;
    this.blink = null;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.unbindContext();
    try {
      this.world.textures.forEach((t) => t.dispose());
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
      this.canvas.remove(); // 한 판 더는 같은 root 를 다시 쓴다
      this.fpsLabel?.remove();
    } finally {
      window.__horror = null;
      window.__horrorLogic = null;
      next(); // 정리에 실패해도 까만 화면과 멈춘 Phaser 를 남기지 않는다
    }
  }
}
