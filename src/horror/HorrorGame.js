// 공포 모드 3D 화면 전체 흐름
import * as THREE from 'three';
import { cfg } from '../config/index.js';
import { CELL, center, cellOf, frontOf, findPath, lineOfSight, canSeeBody, reachable, playerSees } from '../logic/horrorGrid.js';
import { stepPlayer, nextPixelRatio, startRatio, noiseFor, createStamina, canRun, stepStamina } from '../logic/horrorInput.js';
import { tickStalker, stunStalker } from '../logic/horrorStalker.js';
import { createStalkers, nearestStalker, anyChasing, sendAllAway, warnState, createAlarm, raiseAlarm, nextAlarm } from '../logic/horrorHunters.js';
import { codeDisplay, pressCode } from '../logic/horrorCode.js';
import { createRun, takeClue, cluesFound, takeFuse, takeKey, openDoor, keysHeld, KEY_NAMES, respawnSpot, chargeShock, useShock, insertFuses, caught, escape, escapeReward, recordEscape, lastNightReward, recordLastNight, nearestUse } from '../logic/horrorRun.js';
import { isForest, isLastNight, isPool, roundMonsters } from '../logic/horrorPick.js';
import { duskAt, stageChange, FOREST_ID } from '../logic/horrorDusk.js';
import { createNotes, takeNote } from '../logic/horrorNotes.js';
import { createScare, stepScare, dreadLevel, figureSpot } from '../logic/horrorScare.js';
import { todayKey } from '../logic/daily.js';
import { NO_LIGHT, finishTonight, tonightEndText, tonightIntroLine, tonightLine, tonightMet } from '../logic/horrorTonight.js';
import { saveStore } from '../save.js';
import { addStamp, wornLook, openedLooks, stampCount, boardSize } from '../logic/horrorStamps.js';
import { sfx } from '../audio/sfx.js';
import { canFullscreen, fullscreenLabel, onFullscreenChange, toggleFullscreen } from '../ui/fullscreen.js';
import { ALL_MAPS, ALL_MONSTERS } from './content.js';
import { buildWorld } from './world.js';
import { createCreature } from './creatureModel.js';
import { WallBulge } from './wallBulge.js';
import { HorrorInput } from './input.js';
import { HorrorHud, startHint, escapeText, forestEscapeHead, lastNightText, stampLines } from './hud.js';
import { HorrorAudio } from './audio.js';
import { StunGun } from './stunGun.js';
import { HorrorAids } from './aids.js';
import { PoolPlay } from './poolPlay.js';

export { showChooser } from './chooser.js';
import { FINAL_LINES, NOTE_DANGER_LINE, ENDINGS, clueTexts, fillName, joinNames } from './story.js';

const EYE = 1.6; // 눈높이 (미터)
const GUN_AIM_Y = 1.3; // 전기충격기 번개가 닿는 괴물 몸 높이 (미터)
const RADIUS = 0.2; // 주인공 몸 반지름 (칸)
const MAX_DT = 0.05;
const FPS_GAP = 0.5; // 이보다 긴 프레임은 화면이 가려졌던 틈이라 초당 장수에 넣지 않는다 (초)
const LOST_TEXT = '화면이 잠깐 꺼졌어요. 돌아올 때까지 기다려 주세요';
const BACK_TEXT = '화면이 돌아왔어요. 계속하기를 누르세요';
const HIDE_LOOK = 0.6; // 사물함 안에서 고개를 돌릴 수 있는 각도 (라디안)
// 잡히는 장면 (초): 잠깐 깜깜하고 조용하다가 얼굴이 달려든다, 화면 가득 찬 채 있다가 어두워진다, 가까운 돌아올 곳으로 돌아간다
const LUNGE_TIME = 0.16;
const FADE_AT = 1.3;
const BACK_AT = 2;
const FACE_FAR = 1.5; // 달려들기 시작하는 얼굴 거리 (미터)
const FACE_NEAR = 0.6; // 화면을 채우는 얼굴 거리 (미터)
const FACE_UP = 0.2; // 머리 받침점에서 화면 가운데로 올 곳까지 높이 (미터). 웃는 입까지 보이게 낮춰 잡는다
const WALL_SAY_NEAR = 8; // 호러워드가 이 칸 안의 벽에 들어가면 글로 알린다
const WALL_SAY_GAP = 6; // 그 글이 다시 나올 때까지 시간 (초)
const FACE_LIGHT = 0.14; // 코앞의 얼굴이 하얗게 날아가지 않게 줄이는 손전등 비율
// 놀람 장면 (map.scares) 이 끝난 뒤 뜨는 글. 피나 다친 모습 없이 어둠과 소리, 갑작스러운 얼굴로만 놀라게 한다
const SCARE_LINES = ['바로 뒤에서 숨소리가 들린 것 같다...', '어디선가 무언가 바닥을 긁는다', '불빛이 깜빡인다. {name}가 가까이 있나?', '쇠 긁는 소리가 천장에서 난다'];
const BLINK_STEP = 0.09; // 손전등이 켜졌다 꺼지는 간격 (초)
const BLINK_COUNT = 7;
const BLINK_DIM = 0.1; // 꺼진 순간에 남는 밝기 비율
const NOTE_AGAIN = '쪽지는 일시정지 화면에서 다시 읽을 수 있어'; // 쪽지가 저절로 닫혔을 때 덧붙인다
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class HorrorGame {
  // round: { mapId, monsterId } 에 괴물이 여럿이면 monsterIds. onAgain: 끝 화면의 한 판 더. 정리를 마친 뒤에 부른다
  // tonight: 오늘의 밤 판이면 logic/horrorTonight.js 의 { date, rule }. 날짜는 시작한 날로 끝까지 간다
  constructor(root, { round, tonight = null, touch, device, lowFx, muted, onExit, onAgain }) {
    this.root = root;
    this.round = round;
    this.tonight = tonight;
    this.place = ALL_MAPS[round.mapId];
    this.monsters = roundMonsters(round).map((id) => ALL_MONSTERS[id]);
    this.allNames = joinNames(this.monsters.map((m) => m.name));
    this.touch = touch;
    this.device = device;
    this.lowFx = lowFx;
    this.muted = muted;
    this.onExit = onExit;
    this.onAgain = onAgain;
    this.k = cfg.horror;
    this.ambient = this.k.ambient * (tonight?.rule === NO_LIGHT ? this.k.tonight.darkAmbient : 1) * (this.place.theme.bright ?? 1); // 수영장은 늘 밝다
    this.run = createRun(this.place.map, this.k);
    this.map = this.run.level; // 잠긴 문이 판마다 따로 열리는 맵 사본
    this.notes = createNotes(this.map.notes.map(center));
    this.noteTexts = this.named(this.place.notes);
    this.clueTexts = clueTexts(round.mapId, this.run.code);
    this.alarmT = 0; // 번호가 틀려서 난 소리가 남은 시간
    this.alarm = createAlarm(); // 괴물 알림 차례
    this.p = center(this.map.start);
    this.yaw = 0;
    this.pitch = 0;
    this.lightOn = tonight?.rule !== NO_LIGHT && !this.place.theme.bright; // 손전등 조건과 늘 밝은 수영장은 꺼진 채로 시작한다
    this.lit = this.lightOn; // 이번 판에 손전등을 켠 적이 있는지
    this.ranFor = 0; // 이번 판에 달린 시간 (초)
    this.state = 'intro'; // 'intro' | 'play' | 'paused' | 'caught' | 'end'
    this.scaresLeft = [...this.map.scares];
    this.blink = null; // 손전등 깜빡임 진행 상태. 잡힘과 나가기에서 끊는다
    this.scare = null; // 놀람 장면 진행 상태
    this.scaresSeen = 0;
    this.figure = null; // 멀리 잠깐 서 있는 형체
    this.figureT = cfg.horror.scare.figureMin;
    this.flickerT = 0;
    this.flickering = false;
    this.shakeT = 0;
    this.shakeTime = 1;
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
      this.stopFullscreen?.();
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
    const { stamps, bolt: boltId, light: lightId } = saveStore.load().horror;
    const light = wornLook(this.k.stamps.lights, stamps, this.k.stamps, lightId);
    this.bolt = wornLook(this.k.stamps.bolts, stamps, this.k.stamps, boltId);
    this.scene.background = new THREE.Color(theme.fog);
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear ?? 3, this.k.fogCells * CELL);
    this.ambientLight = new THREE.AmbientLight(theme.ambient, this.ambient);
    this.scene.add(this.ambientLight);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, this.k.viewCells * CELL + 6);
    this.scene.add(this.camera);
    this.flash = new THREE.SpotLight(light.color, this.k.flashIntensity, this.k.flashDistance, this.k.flashAngle, this.k.flashPenumbra, this.k.flashDecay);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.position.set(0.15, -0.2, 0);
    this.flash.target.position.set(0.15, -0.2, -1);
    this.camera.add(this.flash, this.flash.target);

    // 놀이를 시작하면 바로 보이는 손 그림부터 받는다
    this.gun = new StunGun({ aspect: window.innerWidth / window.innerHeight, touch, lowFx: this.lowFx, k: this.k.stunGun, bolt: this.bolt });
    this.world = buildWorld(this.scene, this.map, this.k, theme, { lowFx: this.lowFx });
    this.pool = this.map.water ? new PoolPlay({ root, scene: this.scene, map: this.map, k: this.k, eye: EYE }) : null; // 물이 있는 맵만
    this.stalkers = createStalkers(this.map, this.k, Math.random, roundMonsters(this.round));
    // 괴물마다 하나씩이다. 판의 모든 일은 이 목록을 돌며 처리한다
    this.hunters = this.stalkers.map((stalker, index) => {
      const monster = this.monsters[index];
      const model = createCreature(monster.model, this.scene);
      const bulge = monster.throughWalls ? new WallBulge(this.scene, this.map, this.world.wallMaterial) : null;
      model.update(stalker, 0, this.p); // 시작 전에도 제자리에 서 있게 한다
      return { index, monster, stalker, model, bulge };
    });
    this.wallSaidAt = -WALL_SAY_GAP;
    this.gunTarget = new THREE.Vector3();
    this.hidden = null;
    this.stamina = createStamina();
    this.fuseMeshes = this.world.addFuses(this.run.fuses);
    this.keyMeshes = this.world.addKeys(this.run.keys);
    this.noteMeshes = this.world.addNotes(this.notes.spots);
    this.clueMeshes = this.world.addClues(this.run.clues);
    this.input = new HorrorInput(root, { touch, small: this.device === 'phone', k: this.k });
    this.hud = new HorrorHud(root, fillName(NOTE_DANGER_LINE, this.allNames), this.round);
    this.hud.setZapColor(this.bolt.screen);
    this.aids = new HorrorAids(this);
    this.hud.setStatus(this.statusNow());
    this.showTonight();
    if (this.showFps) {
      this.fpsLabel = document.createElement('div');
      this.fpsLabel.style.cssText = 'position:absolute;left:16px;top:56px;color:#8f8;font:14px monospace;z-index:4';
      root.appendChild(this.fpsLabel);
    }
    this.onResize = () => {
      if (this.device === 'phone' && window.innerHeight > window.innerWidth) this.pause(); // 세로로 돌리면 '가로로 돌려 주세요' 화면이 덮는다
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.gun.resize(this.camera.aspect);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.onResize);
    this.onVisibility = () => {
      this.audio?.setActive(!document.hidden);
      if (document.hidden) this.pause();
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    // 일시정지 화면의 전체 화면 버튼 글자를 바꾼다 (Esc 로 나간 때도). 쪽지를 읽는 중이면 그대로 둔다
    this.stopFullscreen = onFullscreenChange(() => {
      if (this.state === 'paused' && this.pauseMenu) this.openPause();
    });
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
    this.tickDusk(); // 숲은 소개 화면부터 노을빛이다
  }

  // 숲: 해가 지는 만큼 하늘, 안개, 주변 빛을 바꾼다. 놀람과 잡힘 뒤에는 this.ambient 로 돌아가서 그 순간의 밝기가 된다
  tickDusk() {
    if (this.round.mapId !== FOREST_ID) return;
    const d = duskAt(this.playTime, this.k.forest.dusk);
    const line = stageChange(this.dusk?.stage, d.stage);
    this.dusk = d;
    this.ambient = this.k.ambient * d.ambientScale;
    this.ambientLight.color.setHex(d.ambient);
    if (!this.scare) this.ambientLight.intensity = this.ambient; // 놀람의 어둠은 덮어쓰지 않는다
    this.scene.fog.color.setHex(d.fog);
    this.scene.fog.far = this.fogFar;
    this.world.setSky(d); // 하늘 돔 (숲 테마). 돔 그림을 못 받으면 아래 배경색이 하늘이다
    if (this.scene.background?.isColor) this.scene.background.setHex(d.sky.low);
    if (line) this.hud.say(line, 4);
  }

  // 지금 안개 끝 거리. 숲은 해가 지는 만큼 줄어든다. 조명탄은 여기서 늘렸다가 여기로 돌아온다
  get fogFar() {
    return this.k.fogCells * CELL * (this.dusk?.fogFar ?? 1);
  }

  get stalker() {
    return this.hunters[0].stalker;
  }

  get model() {
    return this.hunters[0].model;
  }

  get bulge() {
    return this.hunters[0].bulge;
  }

  // 글 속의 {name} 을 괴물 이름으로 바꾼다. 둘째 괴물이 있으면 {other} 도 바꾼다
  named(text, monster = this.monsters[0]) {
    return fillName(text, monster.name, this.monsters.at(-1).name);
  }

  unbindContext() {
    if (!this.onContextLost) return;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  start() {
    const round = { mapName: this.place.name, monsterName: this.allNames, hint: this.named(this.place.hint ?? this.monsters[0].hint), tonight: this.tonight ? tonightIntroLine(this.tonight.rule, this.k) : null, forest: isForest(this.round), adult: isForest(this.round) || isPool(this.round) };
    this.hud.showIntro(this.device, round, () => this.beginPlay(), () => this.exit());
    this.last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const real = (now - this.last) / 1000;
      this.last = now;
      this.update(Math.min(MAX_DT, real)); // 화면이 끊겨도 벽을 뚫지 않게 자른다
      if (this.dead) return; // 이번 프레임에 나갔으면 그리지 않는다
      this.renderer.render(this.scene, this.camera);
      this.gun.render(this.renderer);
      this.trackFps(real);
    });
  }

  // 시작 버튼을 누른 순간에 부른다. 소리와 마우스 잠금은 이때만 허락된다.
  beginPlay() {
    if (this.contextLost) return; // 화면이 돌아오면 다시 누른다
    this.hud.closeLayer();
    this.state = 'play';
    try {
      const [voice, ...more] = this.monsters.map((m) => m.voice);
      this.audio = new HorrorAudio({ muted: this.muted, voice, more });
    } catch (e) {
      console.error('공포 모드 소리를 켜지 못해 소리 없이 합니다', e);
    }
    this.relock();
    this.hud.say(startHint(this.device), 6);
  }

  // 세이노를 처음 볼 때와 손전등을 처음 끌 때 화면이 멈추지 않게, 안내 화면 뒤에서 한 장씩 그려 둔다
  warmUp() {
    this.warmed = true;
    for (const { model } of this.hunters) model.group.position.set(this.p.x * CELL, 0, (this.p.y - 1) * CELL); // 시작할 때 보는 쪽
    this.renderer.render(this.scene, this.camera);
    this.flash.visible = false;
    this.renderer.render(this.scene, this.camera);
    this.flash.visible = this.lightOn;
    this.gun.show(true);
    this.gun.render(this.renderer);
    for (const h of this.hunters) h.model.update(h.stalker, 0, this.p);
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
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.placeCamera();
    this.camera.updateMatrixWorld();
    this.updateGun(dt);
    this.world.update(this.p, this.k.viewCells, this.playTime, this.lowFx);
    if (this.state !== 'paused') this.pool?.update(this.playTime, dt, this.stalkers.filter((s) => s.monsterId === 'swimmer'), this.p);
    if (this.state === 'intro' && !this.warmed && this.hunters.every((h) => h.model.textures.every((t) => t.image))) this.warmUp();
    if (this.state !== 'play') return;
    this.showTonight();
    const near = this.gapTo(nearestStalker(this.stalkers, this.p));
    this.audio?.update(dt);
    for (const { index, stalker: s } of this.hunters) this.audio?.updateStalker(this.camera, { x: s.x * CELL, y: 1.5, z: s.y * CELL }, s.mode, near, dt, index);
  }

  // 주인공과 괴물 사이 거리 (칸)
  gapTo(s) {
    return Math.hypot(s.x - this.p.x, s.y - this.p.y);
  }

  // 일시정지 때는 손도 멈춘다. 숨거나 잡힌 동안에는 손을 치운다
  updateGun(dt) {
    const holding = this.state === 'play' && this.hidden === null && !this.scare;
    const s = (this.shockTarget() ?? this.hunters[0]).stalker;
    this.audio?.setHum(holding && this.run.shock);
    this.gun.setCharged(this.run.shock);
    this.gun.show(holding || this.state === 'paused' || this.state === 'intro');
    if (this.state === 'paused') return;
    this.camera.worldToLocal(this.gunTarget.set(s.x * CELL, GUN_AIM_Y, s.y * CELL));
    this.gun.update(dt, { lit: this.lightOn, walking: this.walking, target: this.gunTarget });
  }

  playFrame(inp, dt) {
    if (inp.pause) {
      this.pause();
      return;
    }
    if (inp.light) this.lightOn = !this.lightOn;
    this.lit ||= this.lightOn;
    this.flash.visible = this.lightOn && this.hidden === null; // 숨으면 불빛도 가린다
    this.yaw -= inp.lookX;
    if (this.hidden !== null) this.yaw = this.hideYaw + Math.max(-HIDE_LOOK, Math.min(HIDE_LOOK, wrapAngle(this.yaw - this.hideYaw)));
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - inp.lookY));
    const running = canRun(this.stamina, inp.move.run);
    const speed = (running ? this.k.runSpeed : this.k.walkSpeed) * (this.pool?.speedScale(this.p) ?? 1);
    const before = this.p;
    if (this.hidden === null && !this.aids.frozen) this.p = stepPlayer(this.p, inp.move, this.yaw, speed, dt, this.map, RADIUS);
    const moving = this.p.x !== before.x || this.p.y !== before.y;
    this.walking = moving;
    this.alarmT = Math.max(0, this.alarmT - dt);
    // 지도를 보는 동안은 달릴 때만큼 소리가 난다 (지도를 넘기며 서 있는 소리).
    // 수영장에서는 물소리만 소리다. 마른 바닥은 달려도, 지도를 넘겨도 조용하다
    const step = this.pool ? this.pool.step(this.p, moving, running, dt, this.audio) : noiseFor(moving, running, this.k);
    const noise = this.alarmT > 0 || (this.aids.mapOpen && !this.pool) ? this.k.runNoise : step;
    const player = { ...this.p, hidden: this.hidden, lightOn: this.lightOn, noise, yaw: this.yaw }; // yaw: 처녀귀신이 등 뒤를 고른다
    const splash = this.pool?.takeSplash() ?? null;
    this.tickStamina(running && moving, dt);
    if (running && moving) this.ranFor += dt;
    const pressure = this.run.have / this.k.fuseCount;
    this.tickDusk();
    const { level: dusk, stage } = this.dusk ?? {};
    for (const h of this.hunters) {
      const seen = playerSees(this, this.hud.noteOpen || this.aids.mapOpen, h.stalker);
      this.onStalkerEvents(tickStalker(h.stalker, { map: this.map, player, seen, pressure, dusk, stage, sounds: this.aids.state.sounds, splash }, this.k, dt), h);
      if (this.state !== 'play') return;
    }
    // 쪽지가 앞을 가린 채로 쫓기지 않게 한다. 눈뜬이는 빨라져도 알림 없이 올 수 있어서 이벤트와 따로 본다
    if (anyChasing(this.stalkers) && this.hud.closeNote()) this.hud.say(NOTE_AGAIN, 3);
    if (anyChasing(this.stalkers) && this.aids.closeMap()) this.hud.say('쫓아온다! 지도를 닫았다', 2);
    for (const h of this.hunters) {
      h.model.update(h.stalker, dt, this.p);
      h.bulge?.update(h.stalker, dt, this.lowFx);
    }
    this.cullCreature();
    this.showWarnings();
    this.checkScare();
    this.tickScare(dt);
    this.tickFigure(dt);
    this.tickBlink(dt);
    this.tickDread(dt);
    const target = this.nearestUse();
    this.hud.setPrompt(this.promptFor(target));
    if (this.hud.keypadOpen && target?.kind !== 'gate') this.hud.closeKeypad(); // 정문에서 멀어지면 닫는다
    if (this.hud.keypadOpen) inp.typed?.forEach((key) => this.keypadPress(key));
    if (this.state !== 'play') return; // 번호를 맞혀 탈출했다
    this.aids.tick(dt, this.hud.keypadOpen ? null : inp.typed);
    if (inp.use && !this.aids.closeMap() && !this.hud.closeNote() && !this.hud.closeKeypad()) this.doUse(target); // 쪽지나 입력 칸이 열려 있으면 닫기만 한다
    if (inp.punch) this.doPunch();
  }

  promptFor(target) {
    if (this.aids.mapOpen) return '';
    if (this.hud.noteOpen) return `${this.touch ? '사용' : 'E'}: 쪽지 닫기`;
    if (this.hud.keypadOpen) return '';
    if (!target) return '';
    return target.kind === 'locked' || target.kind === 'seenBoard' ? target.label : `${this.touch ? '사용' : 'E'}: ${target.label}`;
  }

  // 벽에 가린 세이노는 그리지 않는다. 몸이 무거워서 태블릿에서 크게 차이 난다.
  // 사물함 안은 시선 계산의 출발 칸이 막혀 있어서 늘 그린다.
  cullCreature() {
    for (const h of this.hunters) h.model.group.visible = this.hidden !== null || canSeeBody(this.map, this.p, h.stalker, this.k.creatureNear);
  }

  // 괴물이 여럿이면 누가 어떤 상태인지 이름표로 보이고, 기다리던 알림을 띄운다
  showWarnings() {
    if (this.hunters.length < 2) return;
    this.hud.setHunters(this.hunters.map((h) => ({ name: h.monster.name, state: warnState(h.stalker, this.p, this.k) })));
    this.showAlarm(nextAlarm(this.alarm, this.playTime, this.k.lastNight.alarmHold));
  }

  showAlarm(line) {
    if (line) this.hud.say(line.text, line.seconds);
  }

  // 괴물이 알리는 글. 다른 괴물의 글이 뜬 지 얼마 안 됐으면 차례를 기다린다
  warn(h, text, seconds) {
    this.showAlarm(raiseAlarm(this.alarm, h.index, { text, seconds }, this.playTime, this.k.lastNight.alarmHold));
  }

  // 놀람 칸을 처음 밟으면 불이 툭 꺼지고 소리가 죽는다. 첫 번째와 세 번째처럼 번갈아 얼굴이 코앞에 나타난다
  checkScare() {
    if (this.scare) return;
    const c = cellOf(this.p);
    const i = this.scaresLeft.findIndex((s) => s.cx === c.cx && s.cy === c.cy);
    if (i < 0) return;
    this.scaresLeft.splice(i, 1);
    this.scaresSeen += 1;
    this.scare = createScare(this.scaresSeen % 2 === 1, this.k.scare);
    this.scare.who = this.hunters[Math.floor(this.scaresSeen / 2) % this.hunters.length]; // 큰 놀람마다 번갈아 나온다
    this.cancelBlink();
    this.flash.intensity = 0;
    this.ambientLight.intensity = this.ambient * this.k.scare.darkAmbient;
    this.audio?.hush(true);
  }

  tickScare(dt) {
    const s = this.scare;
    if (!s) return;
    const was = s.phase;
    const phase = stepScare(s, dt);
    if (phase === 'dark') return;
    if (was === 'dark') this.scareHits(phase === 'face');
    if (phase === 'done') {
      this.scare = null;
      this.flash.intensity = this.k.flashIntensity; // 얼굴을 비추던 낮은 밝기를 돌려놓는다
      if (!this.lowFx) this.blink = { t: 0, n: 0 };
      this.hud.say(this.named(SCARE_LINES[Math.floor(Math.random() * SCARE_LINES.length)], s.who.monster), 3);
      return;
    }
    s.lunge.t += dt;
    this.flash.visible = true;
    this.placeFace(s.lunge, dt);
    s.who.model.group.visible = true;
  }

  // 어둠이 끝나는 순간: 소리가 터지고, 큰 놀람이면 얼굴이 코앞에 나타난다
  scareHits(face) {
    this.ambientLight.intensity = this.ambient;
    this.flash.intensity = this.k.flashIntensity * (face ? FACE_LIGHT : 1);
    this.audio?.hush(false);
    const { who } = this.scare;
    this.audio?.play('scare', who.index);
    this.startShake(this.k.scare.shakeTime);
    if (!face) return;
    this.scare.lunge = { t: 0, model: who.model, dir: this.yaw, shown: { x: this.p.x, y: this.p.y, heading: this.yaw, mode: 'chase' } };
    who.model.yaw = this.yaw;
  }

  // 놀람을 중간에 끊는다 (일시정지, 잡힘, 숨기)
  cancelScare() {
    if (!this.scare) return;
    this.scare = null;
    this.ambientLight.intensity = this.ambient;
    this.flash.intensity = this.k.flashIntensity;
    this.audio?.hush(false);
  }

  // 복도 끝에 괴물의 형체가 잠깐 서 있다가 사라진다. 진짜 괴물은 그대로 다른 곳에 있다
  tickFigure(dt) {
    const k = this.k.scare;
    this.figureT -= dt;
    const f = this.figure;
    if (f) {
      f.t -= dt;
      if (f.t <= 0 || this.scare) this.figure = null;
      else {
        f.model.update(f.shown, 0, this.p);
        f.model.group.visible = true;
      }
      return;
    }
    if (this.figureT > 0 || this.scare || this.hidden !== null || this.hunters.some((h) => h.model.group.visible) || anyChasing(this.stalkers)) return;
    this.figureT = k.figureMin + Math.random() * (k.figureMax - k.figureMin);
    const spot = figureSpot(this.map, this.p, this.yaw, k.figureNear, k.figureFar);
    if (!spot) return;
    const heading = Math.atan2(this.p.x - spot.x, this.p.y - spot.y);
    const { model } = this.hunters[Math.floor(Math.random() * this.hunters.length)];
    this.figure = { t: k.figureShow, model, shown: { ...spot, heading, mode: 'patrol' } };
    model.yaw = heading;
  }

  // 괴물이 가까우면 화면 가장자리가 어두워지고, 쫓기는 동안 손전등이 떨린다
  tickDread(dt) {
    const chased = anyChasing(this.stalkers);
    this.hud.setDread(Math.max(...this.stalkers.map((s) => dreadLevel(this.gapTo(s), s.mode === 'chase', this.k.scare))));
    if (this.scare || this.blink) return;
    if (!chased || this.lowFx) {
      if (this.flickering) this.flash.intensity = this.k.flashIntensity;
      this.flickering = false;
      return;
    }
    this.flickering = true;
    this.flickerT -= dt;
    if (this.flickerT > 0) return;
    this.flickerT = this.k.scare.flickerEvery;
    this.flash.intensity = this.k.flashIntensity * (1 - Math.random() * this.k.scare.chaseFlicker);
  }

  startShake(time) {
    if (this.lowFx) return;
    this.shakeT = time;
    this.shakeTime = time;
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

  tonightCounts() {
    return { lit: this.lit, ranFor: this.ranFor, shocks: this.run.shocks, catches: this.run.caughtCount, notes: this.notes.found };
  }

  // 조건과 깨졌는지를 작은 줄로 놓아서 끝 화면에서 놀라지 않게 한다
  showTonight() {
    if (this.tonight) this.hud.setTonight(tonightLine(this.tonight.rule, this.tonightCounts(), this.k));
  }

  statusNow() {
    return { have: this.run.have, need: this.k.fuseCount, shock: this.run.shock, powered: this.run.powered, keys: keysHeld(this.run), notesFound: this.notes.found, notesTotal: this.notes.total, clues: cluesFound(this.run), cluesTotal: this.run.clues.length };
  }

  // h: 이 일이 일어난 괴물
  onStalkerEvents(events, h = this.hunters[0]) {
    this.lastEvents = events;
    const { monster } = h;
    if (events.includes('chase')) {
      if (h.stalker.monsterId === 'swimmer') this.audio?.play('rise', h.index); // 물에서 솟구친다
      const cut = this.hud.closeNote(); // 쪽지가 앞을 가린 채로 쫓기지 않게 한다
      this.hud.closeKeypad();
      this.warn(h, `${this.named(monster.alarm, monster)}${cut ? ` ${NOTE_AGAIN}` : ''}`, cut ? 4 : 2);
    }
    if (events.includes('wall')) this.onWall(h);
    if (events.includes('slip') || events.includes('vanish')) this.warn(h, this.named('{name}가 사라졌다...', monster), 3);
    // 처녀귀신: 순간이동은 글 없이 귓가 속삭임만, 쇼크에 사라질 때는 비명
    if (events.includes('blink')) this.audio?.play('blink', h.index);
    if (events.includes('vanish')) this.audio?.play('vanish', h.index);
    if (events.includes('sniff')) this.warn(h, this.named('움직이지 마! {name}가 냄새를 맡고 있다', monster), 2);
    if (events.includes('caught') || events.includes('found')) this.getCaught(h);
  }

  // 호러워드가 벽으로 들어갔다. 벽 안에서는 몸이 안 보이니 소리와 글로도 알린다
  onWall(h) {
    this.audio?.play('wall', h.index);
    if (this.gapTo(h.stalker) > WALL_SAY_NEAR || this.playTime < this.wallSaidAt + WALL_SAY_GAP) return;
    this.wallSaidAt = this.playTime;
    this.warn(h, this.named('벽이 흔들린다! {name}가 지나간다!', h.monster), 2);
  }

  nearestUse() {
    // 쫓기는 동안에는 쪽지를 고르지 않는다. 열자마자 앞을 가리고 숨기가 한 번 늦어진다
    const best = nearestUse(this.run, this.map, this.p, this.hidden, this.k, anyChasing(this.stalkers) ? undefined : this.notes, (add) => this.aids.targets(add));
    return best ?? this.pool?.target(this.p) ?? this.aids.seenNear(); // 수건, 고무오리는 다른 할 일이 없을 때만 고른다
  }

  doUse(t) {
    if (!t || this.aids.use(t)) return;
    if (this.pool?.use(t, this.p, this.yaw, this.audio, this.hud)) return;
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
    if (t.kind === 'clue' && takeClue(this.run, t.index)) {
      this.clueMeshes[t.index].visible = false;
      this.audio?.play('fuse');
      this.hud.showNote(this.clueTexts[t.index], this.device === 'phone');
    }
    if (t.kind === 'lock' && openDoor(this.run, t.index)) {
      this.world.openDoor(t.index);
      this.audio?.play('door');
      this.hud.say(this.monsters[0].throughWalls ? '문이 열렸다!' : `문이 열렸다. ${this.allNames}도 이제 들어올 수 있어!`, 4);
    }
    if (t.kind === 'box' && chargeShock(this.run, t.index)) {
      this.audio?.play('shockCharge');
      this.gun.chargeUp();
      this.hud.say(`쇼크 충전! ${this.touch ? '쇼크 버튼을' : 'R 키를'} 눌러 쓰자`, 3);
    }
    if (t.kind === 'panel' && insertFuses(this.run, this.k)) {
      this.world.setPowered();
      this.audio?.play('door');
      this.hud.say(`전원이 켜졌다! 화면에 숫자 ${this.run.code.digits[3]}: 정문 번호 넷째 자리다!`, 6);
    }
    if (t.kind === 'locker') this.toggleLocker(t.index);
    if (t.kind === 'gate') this.openKeypad();
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

  // 입력 칸에는 찾은 단서와 전원 화면의 숫자가 보여서 외우지 않아도 된다
  openKeypad() {
    const code = this.run.code;
    const lines = this.run.clues.map((c, i) => (c.taken ? this.clueTexts[i].at(-1) : null)).filter(Boolean);
    const missing = this.run.clues.length - lines.length;
    if (missing) lines.push(`붉은 쪽지가 ${missing}장 더 있다`);
    lines.push(`넷째 자리는 ${code.digits[3]}`);
    this.hud.showKeypad({
      lines,
      shown: codeDisplay(code),
      touch: this.touch,
      compact: this.device === 'phone',
      onKey: (key) => this.keypadPress(key),
      onClose: () => this.hud.closeKeypad(),
    });
  }

  keypadPress(key) {
    if (this.state !== 'play') return;
    const code = this.run.code;
    const result = pressCode(code, key);
    this.audio?.play(result === 'wrong' ? 'codeWrong' : 'codeKey');
    this.hud.setKeypad(codeDisplay(code));
    if (result === 'right') {
      this.hud.closeKeypad();
      this.win();
    }
    if (result === 'wrong') {
      this.alarmT = this.k.codeAlarm;
      this.hud.say(this.named('번호가 틀렸다! 경고음이 크게 울린다. {name}가 들었을지 몰라!'), 3);
    }
  }

  toggleLocker(i) {
    this.cancelScare();
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

  // 쇼크가 닿는 괴물 가운데 가장 가까운 쪽. 없으면 null
  shockTarget() {
    const inReach = this.hunters.filter((h) => this.gapTo(h.stalker) <= this.k.shockRange && lineOfSight(this.map, this.p, h.stalker));
    return inReach.reduce((best, h) => (!best || this.gapTo(h.stalker) < this.gapTo(best.stalker) ? h : best), null);
  }

  doPunch() {
    if (this.hidden !== null) return;
    if (!useShock(this.run)) {
      this.audio?.play('shockEmpty');
      this.gun.fire('empty');
      this.hud.say('쇼크가 없다. 전기 상자에서 충전하자', 2);
      return;
    }
    const target = this.shockTarget();
    const hit = target !== null;
    const result = hit ? 'hit' : 'miss';
    this.audio?.play(hit ? 'shockHit' : 'shockMiss');
    this.gun.fire(result);
    this.hud.flashShock(this.k.stunGun.flash[result] * (this.lowFx ? this.k.stunGun.flashLow : 1), this.k.stunGun.flashTime);
    if (hit) {
      stunStalker(target.stalker, this.k);
      this.hud.say('맞았다! 지금 도망쳐!', 3);
    } else this.hud.say('빗나갔다...', 2);
    this.hud.setStatus(this.statusNow());
  }

  // 잡혔다. 카메라를 괴물 쪽으로 돌리고 얼굴이 코앞으로 달려든다. h: 잡은 괴물
  getCaught(h = this.hunters[0]) {
    if (this.state !== 'play') return;
    this.state = 'caught';
    this.cancelScare();
    this.cancelBlink(); // 깜빡임이 잡히는 장면의 밝기를 덮어쓰지 않게 한다
    this.figure = null;
    this.noteCut = this.hud.closeNote();
    this.hud.closeKeypad();
    this.aids.stop();
    caught(this.run);
    this.audio?.suspend();
    this.audio?.hush(true); // 비명 전에 소리를 뚝 끊는다
    this.hidden = null;
    this.hud.showSlit(false);
    this.hud.setPrompt('');
    this.hud.say('', 0);
    const s = h.stalker;
    const dx = s.x - this.p.x;
    const dy = s.y - this.p.y;
    const heading = Math.atan2(-dx, -dy); // 괴물이 주인공을 보는 쪽이자 주인공이 괴물을 보는 yaw
    this.lunge = { t: 0, faded: false, hush: this.k.scare.hush, who: h, model: h.model, dir: heading, shown: { x: s.x, y: s.y, heading, mode: 'chase' } };
    h.model.yaw = heading;
    for (const { model } of this.hunters) model.group.visible = false; // 얼굴이 하나만 보이게 다른 괴물도 치운다
    this.flash.visible = false;
    this.ambientLight.intensity = this.ambient * this.k.scare.darkAmbient;
  }

  // 정적이 끝나는 순간 비명과 함께 얼굴이 달려든다
  caughtHits() {
    const { who } = this.lunge;
    this.audio?.play('caught', who.index);
    who.model.group.visible = true; // 사물함 밖에서 벽 너머로 잡혀도 얼굴은 보여야 한다
    this.flash.visible = true;
    this.flash.intensity = this.k.flashIntensity * FACE_LIGHT;
    this.ambientLight.intensity = this.ambient;
    this.startShake(this.k.scare.caughtShake);
  }

  caughtFrame(dt) {
    const l = this.lunge;
    this.yaw += wrapAngle(l.dir - this.yaw) * Math.min(1, dt * 22);
    this.pitch += (0 - this.pitch) * Math.min(1, dt * 22);
    if (l.hush > 0) {
      l.hush -= dt;
      if (l.hush <= 0) this.caughtHits();
      return;
    }
    l.t += dt;
    this.placeFace(l, dt);
    if (!l.faded && l.t >= FADE_AT) {
      l.faded = true;
      this.hud.fade(true);
    }
    if (l.t >= BACK_AT) this.respawn();
  }

  // 머리가 정확히 눈앞에 오도록 몸 전체를 옮긴다. 자세마다 머리 위치가 달라서 재서 맞춘다
  placeFace(l, dt) {
    const m = l.model;
    m.update(l.shown, dt, this.p);
    m.head.rotation.set(m.faceTilt ?? 0, 0, 0);
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
    this.pool?.reset();
    sendAllAway(this.stalkers, this.map, this.p); // 잡히지 않은 쪽도 함께 멀리 가서 쉰다
    this.alarm = createAlarm();
    for (const h of this.hunters) h.model.update(h.stalker, 0, this.p);
    this.cullCreature();
    this.flash.intensity = this.k.flashIntensity;
    this.flash.visible = this.lightOn;
    this.ambientLight.intensity = this.ambient;
    this.audio?.hush(false);
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
    this.cancelScare();
    this.hud.setDread(0);
    this.audio?.suspend();
    this.audio?.play('door');
    const { text, news, tonight } = isLastNight(this.round) ? this.settleLastNight(result.clean) : this.settleEscape(result.clean);
    document.exitPointerLock?.();
    this.input.clearTouch();
    this.hud.closeNote();
    this.aids.stop();
    this.hud.setPrompt('');
    this.hud.showEnd(text, () => this.exit(this.onAgain), () => this.exit(), { found: this.notes.found, total: this.notes.total, final: this.named(FINAL_LINES[this.round.mapId]), ending: this.named(ENDINGS[this.round.mapId]) }, news, this.device === 'phone', tonight);
  }

  // 보통 판과 숲: 탈출 보석과 도장을 저장하고 끝 화면 글을 돌려준다. 숲은 도장판 칸이 아니라 addStamp 가 도장을 주지 않는다
  settleEscape(clean) {
    const save = saveStore.load();
    const today = todayKey();
    const reward = escapeReward(save.horror, clean, today, this.k);
    const was = save.horror.stamps;
    const { stamps, earned } = addStamp(was, this.round, clean);
    const result = this.tonight && finishTonight(save.horror, this.tonight.date, tonightMet(this.tonight.rule, this.tonightCounts(), this.k), this.k);
    save.gems += reward.gems + (result?.gems ?? 0);
    save.horror = { ...recordEscape(save.horror, clean, today), stamps };
    if (result) save.horror.tonightDone = result.done;
    saveStore.save(save);
    const tonight = result && { text: tonightEndText(this.tonight.rule, result, this.k), met: result.met };
    const head = isForest(this.round) ? forestEscapeHead(this.place.name) : undefined;
    return { text: escapeText(reward, clean, head), tonight, news: stampLines(earned, { count: stampCount(stamps), total: boardSize(), opened: openedLooks(was, stamps, this.k.stamps) }) };
  }

  // 마지막 밤: 처음 깼을 때만 보석을 준다. 도장판과 오늘의 탈출 보석은 건드리지 않는다
  settleLastNight(clean) {
    const save = saveStore.load();
    const reward = lastNightReward(save.horror, this.k);
    save.gems += reward.gems;
    save.horror = recordLastNight(save.horror);
    saveStore.save(save);
    this.audio?.play('bell');
    return { text: lastNightText(reward, clean), news: [] };
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.cancelScare();
    this.cancelBlink();
    this.noteAtPause = this.hud.noteLines; // 계속하기를 누르면 다시 펼친다
    this.hud.closeNote();
    this.hud.closeKeypad();
    this.aids.setPaused(true);
    this.input.clearTouch();
    this.audio?.suspend();
    document.exitPointerLock?.();
    this.openPause();
  }

  openPause() {
    const read = [...this.notes.read.map((order) => this.noteTexts[order]), ...this.clueTexts.filter((_, i) => this.run.clues[i].taken)];
    const phone = this.device === 'phone';
    const onNotes = read.length
      ? () => {
          this.pauseMenu = false;
          this.hud.showReadNotes(read, () => this.openPause(), phone);
        }
      : null;
    this.pauseMenu = true;
    const full = canFullscreen() ? { text: fullscreenLabel(), onPress: () => toggleFullscreen() } : null;
    this.hud.showPause(() => this.resumePlay(), () => this.exit(), onNotes, phone, full);
  }

  // 계속하기를 누른 순간에 부른다. iPad 는 밖에 나갔다 오면 소리를 멈춰 두므로 여기서 다시 깨운다
  resumePlay() {
    if (this.contextLost) return; // 화면이 없는 채로 쫓기지 않게 돌아올 때까지 기다린다
    sfx.unlock();
    this.hud.setNotice('');
    this.hud.hidePause();
    this.pauseMenu = false;
    if (this.noteAtPause) this.hud.showNote(this.noteAtPause, this.device === 'phone');
    this.noteAtPause = null;
    this.aids.setPaused(false);
    this.audio?.resume();
    this.state = 'play';
    this.relock();
  }

  placeCamera() {
    this.camera.position.set(this.p.x * CELL, this.pool?.eye ?? EYE, this.p.y * CELL); // 깊은 물에서는 머리만 물 위로 나온다
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.shakeT <= 0) return;
    const r = this.k.scare.shakePower * (this.shakeT / this.shakeTime);
    this.camera.position.x += (Math.random() - 0.5) * r;
    this.camera.position.y += (Math.random() - 0.5) * r;
    this.camera.rotation.z = (Math.random() - 0.5) * r * 0.4;
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
    this.stopFullscreen();
    this.unbindContext();
    try {
      this.world.textures.forEach((t) => t.dispose());
      this.pool?.textures.forEach((t) => t.dispose());
      this.pool?.destroy();
      this.input.destroy();
      this.hud.destroy();
      this.aids?.destroy();
      this.audio?.destroy();
      for (const { model } of this.hunters) model.dispose();
      this.gun.dispose();
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
