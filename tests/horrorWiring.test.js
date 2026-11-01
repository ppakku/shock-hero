// 진짜 HorrorGame 을 그림과 소리와 화면 글자만 가짜로 바꿔서 돌린다.
// 규칙은 따로 시험하므로, 여기서는 게임이 규칙과 재료를 제대로 잇는지만 본다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { center, frontOf, reachable, lineOfSight } from '../src/logic/horrorGrid.js';
import { MAPS, MONSTERS } from '../src/horror/content.js';

const fakes = vi.hoisted(() => ({ loads: [], failArt: null, audio: [], late: [] }));

vi.mock('three', async (original) => {
  const real = await original();
  class WebGLRenderer {
    constructor() {
      this.domElement = { style: {}, addEventListener() {}, removeEventListener() {}, remove: vi.fn() };
      this.shadowMap = {};
      this.info = { render: { calls: 0 } };
    }
    setPixelRatio() {}
    setSize() {}
    setAnimationLoop() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }
  class TextureLoader {
    load(url, onLoad, onProgress, onError) {
      const tex = new real.Texture();
      fakes.loads.push(url);
      if (fakes.failArt && url.includes(fakes.failArt)) fakes.late.push(() => onError?.(new Error('없음'))); // 진짜처럼 늦게 온다
      return tex;
    }
  }
  return { ...real, WebGLRenderer, TextureLoader };
});

vi.mock('../src/horror/hud.js', () => {
  class HorrorHud {
    constructor() {
      this.noteOpen = false;
      this.noteLines = null;
      this.said = [];
      this.destroy = vi.fn();
    }
    setStatus() {}
    setPrompt() {}
    setStamina() {}
    showSlit() {}
    fade() {}
    closeLayer() {}
    setNotice() {}
    showPause() {}
    say(text) { this.said.push(text); }
    showIntro(device, round, onStart, onQuit) { this.intro = { round, onStart, onQuit }; }
    showEnd(text, onAgain, onDone, notes) { this.end = { text, onAgain, onDone, notes }; }
    showNote(lines) { this.noteOpen = true; this.noteLines = lines; }
    closeNote() {
      const was = this.noteOpen;
      this.noteOpen = false;
      this.noteLines = null;
      return was;
    }
  }
  return { HorrorHud, startHint: () => '', escapeText: () => '탈출' };
});

vi.mock('../src/horror/input.js', () => ({
  HorrorInput: class {
    destroy = vi.fn();
    read() { return null; }
    relock() {}
    clearTouch() {}
    locked() { return true; }
  },
}));

vi.mock('../src/horror/audio.js', () => ({
  HorrorAudio: class {
    constructor(o) {
      this.options = o;
      this.destroy = vi.fn();
      fakes.audio.push(this);
    }
    update() {}
    updateStalker() {}
    play() {}
    suspend() {}
    resume() {}
    setActive() {}
    setHum() {}
  },
}));

vi.mock('../src/save.js', () => ({
  saveStore: {
    load: () => ({ gems: 0, horror: { escapes: 0, cleanEscapes: 0, gemDay: null, last: null }, settings: {} }),
    save: () => {},
  },
}));

const { HorrorGame } = await import('../src/horror/HorrorGame.js');

const DT = 1 / 30;
const idle = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false });

function makeGame(mapId, monsterId) {
  const onExit = vi.fn();
  const onAgain = vi.fn();
  const g = new HorrorGame({ appendChild() {} }, { round: { mapId, monsterId }, touch: false, device: 'pc', lowFx: false, muted: true, onExit, onAgain });
  fakes.late.splice(0).forEach((fail) => fail());
  g.start();
  g.hud.intro.onStart();
  g.readInput = idle;
  return Object.assign(g, { onExitSpy: onExit, onAgainSpy: onAgain });
}

const frames = (g, seconds) => {
  for (let t = 0; t < seconds; t += DT) g.update(DT);
};

// 곧게 보이는 칸 둘을 찾아 주인공과 괴물을 세우고 괴물 쪽을 보게 한다
function faceOff(g, gap) {
  const area = [...reachable(g.map, g.map.start)].map((t) => t.split(',').map(Number));
  for (const [cx, cy] of area) {
    const from = center({ cx, cy });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const to = { x: from.x + dx * gap, y: from.y + dy * gap };
      if (!area.some(([x, y]) => x === Math.floor(to.x) && y === Math.floor(to.y)) || !lineOfSight(g.map, from, to)) continue;
      g.p = from;
      Object.assign(g.stalker, { x: to.x, y: to.y, path: [], mode: 'patrol', graceT: 0, warnT: 0 });
      g.yaw = Math.atan2(-(to.x - from.x), -(to.y - from.y));
      return;
    }
  }
  throw new Error('곧은 자리가 없다');
}

// 사물함에 들어가 있고 괴물은 문 앞에 있다
function inLocker(g) {
  g.toggleLocker(0);
  const f = center(frontOf(g.map, g.map.lockers[0]));
  Object.assign(g.stalker, { x: f.x, y: f.y, path: [], mode: 'patrol', graceT: 0, warnT: 0 });
}

beforeEach(() => {
  fakes.loads.length = 0;
  fakes.failArt = null;
  fakes.audio.length = 0;
  vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, location: { search: '' }, addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, exitPointerLock() {}, hidden: false });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('판 재료', () => {
  it.each(['factory', 'sewer', 'school'])('%s: 안개, 배경, 환경광, 그림이 맵 테마를 따른다', (mapId) => {
    const { theme } = MAPS[mapId];
    const g = makeGame(mapId, 'seino');
    expect(g.scene.fog.color.getHex()).toBe(new THREE.Color(theme.fog).getHex());
    expect(g.scene.background.getHex()).toBe(new THREE.Color(theme.fog).getHex());
    const ambient = g.scene.children.find((o) => o.isAmbientLight);
    expect(ambient.color.getHex()).toBe(new THREE.Color(theme.ambient).getHex());
    expect(fakes.loads).toContain(`art/${theme.wall.art}.jpg`);
    expect(fakes.loads).toContain(`art/${theme.floor.art}.jpg`);
    g.exit();
  });

  it('괴물마다 제 몸과 목소리를 쓴다', () => {
    for (const id of Object.keys(MONSTERS)) {
      const g = makeGame('factory', id);
      expect(g.stalker.monsterId).toBe(id);
      expect(fakes.audio.at(-1).options.voice).toBe(MONSTERS[id].voice);
      if (id === 'maw') expect(g.model.faceNear).toBeDefined();
      g.exit();
    }
  });

  it('쪽지 글에 이번 괴물 이름이 들어간다', () => {
    const g = makeGame('sewer', 'maw');
    expect(g.noteTexts.flat().join(' ')).toContain('큰입이');
    expect(g.noteTexts.flat().join(' ')).not.toContain('{name');
    g.exit();
  });

  it.each([['wall'], ['floor'], ['locker']])('%s 그림을 못 받으면 맵의 밋밋한 색이 된다', (part) => {
    const theme = MAPS.sewer.theme[part];
    fakes.failArt = theme.art;
    const g = makeGame('sewer', 'seino');
    const mats = [];
    g.scene.traverse((o) => { if (o.material) mats.push(o.material); });
    expect(mats.some((m) => m.color?.getHex() === new THREE.Color(theme.plain).getHex() && !m.map)).toBe(true);
    g.exit();
  });
});

describe('눈뜬이를 보는 일', () => {
  it('보고 있으면 멈추고, 눈을 떼면 다가온다', () => {
    const g = makeGame('factory', 'gazer');
    faceOff(g, 4);
    const at = { x: g.stalker.x, y: g.stalker.y };
    frames(g, 1);
    expect({ x: g.stalker.x, y: g.stalker.y }).toEqual(at);
    expect(g.stalker.mode).toBe('watch');
    g.yaw += Math.PI;
    frames(g, 1);
    expect(Math.hypot(g.stalker.x - at.x, g.stalker.y - at.y)).toBeGreaterThan(0.5);
    g.exit();
  });

  it('쪽지를 열면 본 것이 아니고, 빨라지면 쪽지가 닫힌다', () => {
    const g = makeGame('factory', 'gazer');
    faceOff(g, 3);
    frames(g, 1); // 3초 안쪽으로 봐서 알림이 안 나오는 때
    g.hud.showNote(['쪽지']);
    const left = () => g.hud.noteOpen;
    for (let t = 0; t < 4 && left() && g.state === 'play'; t += DT) g.update(DT);
    expect(g.hud.noteOpen).toBe(false);
    expect(g.state).toBe('play'); // 쪽지가 먼저 닫혀서 잡히기 전에 돌아볼 수 있다
    expect(g.hud.said.at(-1)).toContain('쪽지');
    g.exit();
  });

  it('사물함 안에서 고개를 돌리면 눈을 뗀 것이고, 문 앞에서 떠난다', () => {
    const g = makeGame('factory', 'gazer');
    inLocker(g);
    const at = { x: g.stalker.x, y: g.stalker.y };
    frames(g, 0.5);
    expect(g.stalker.mode).toBe('watch'); // 틈으로 보고 있다
    g.readInput = () => ({ ...idle(), lookX: 0.2 }); // 끝까지 돌린다
    frames(g, 1);
    g.readInput = idle;
    frames(g, g.k.monsters.gazer.doorWait + 1);
    expect(g.stalker.mode).not.toBe('watch');
    expect(Math.hypot(g.stalker.x - at.x, g.stalker.y - at.y)).toBeGreaterThan(3);
    expect(g.state).toBe('play');
    g.exit();
  });

  it('사물함 안에서는 고개를 끝까지 돌려도 정해진 각도까지만 돌아간다', () => {
    const g = makeGame('factory', 'seino');
    g.toggleLocker(0);
    const home = g.yaw;
    g.readInput = () => ({ ...idle(), lookX: 0.5 });
    frames(g, 0.5);
    expect(Math.abs(Math.atan2(Math.sin(g.yaw - home), Math.cos(g.yaw - home)))).toBeLessThanOrEqual(0.6001);
    g.exit();
  });
});

describe('잡히는 장면', () => {
  it.each(['seino', 'gazer', 'maw'])('%s: 얼굴은 정해진 거리에서 멈춘다', (id) => {
    const g = makeGame('factory', id);
    Object.assign(g.stalker, { x: g.p.x + 0.4, y: g.p.y });
    g.getCaught();
    frames(g, 0.4);
    g.model.group.updateMatrixWorld(true);
    const head = g.model.head.getWorldPosition(new THREE.Vector3());
    const d = Math.hypot(head.x - g.p.x * 3, head.z - g.p.y * 3);
    expect(d).toBeCloseTo(g.model.faceNear ?? 0.6, 1);
    g.exit();
  });
});

describe('끝내기', () => {
  it('한 판 더는 정리를 마친 뒤 onAgain 만 부른다', () => {
    const g = makeGame('factory', 'seino');
    const dispose = vi.fn();
    g.world.textures.forEach((t) => t.addEventListener('dispose', dispose));
    const count = g.world.textures.length;
    const audio = fakes.audio.at(-1);
    const { input } = g;
    g.run.powered = true;
    g.win();
    expect(g.state).toBe('end');
    g.hud.end.onAgain();
    expect(g.dead).toBe(true);
    expect(g.onAgainSpy).toHaveBeenCalledTimes(1);
    expect(g.onExitSpy).not.toHaveBeenCalled();
    expect(audio.destroy).toHaveBeenCalledTimes(1);
    expect(input.destroy).toHaveBeenCalledTimes(1);
    expect(g.hud.destroy).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(count);
    expect(g.canvas.remove).toHaveBeenCalled();
  });

  it('타이틀로는 onExit 만 부른다', () => {
    const g = makeGame('factory', 'seino');
    g.run.powered = true;
    g.win();
    g.hud.end.onDone();
    expect(g.onExitSpy).toHaveBeenCalledTimes(1);
    expect(g.onAgainSpy).not.toHaveBeenCalled();
  });
});
