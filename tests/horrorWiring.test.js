// 진짜 HorrorGame 을 그림과 소리와 화면 글자만 가짜로 바꿔서 돌린다.
// 규칙은 따로 시험하므로, 여기서는 게임이 규칙과 재료를 제대로 잇는지만 본다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { center, frontOf, reachable, lineOfSight, cellOf } from '../src/logic/horrorGrid.js';
import { ALL_MAPS, ALL_MONSTERS, FOREST_PLACE, MAPS, MONSTERS } from '../src/horror/content.js';
import { FOREST_ROUND, LAST_ROUND, roundMonsters } from '../src/logic/horrorPick.js';
import { boardCells, cellKey } from '../src/logic/horrorStamps.js';
import { normalizeHorror } from '../src/logic/horrorRun.js';

const fakes = vi.hoisted(() => ({ loads: [], failArt: null, okArt: false, audio: [], late: [], save: null }));

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
      else if (fakes.okArt) fakes.late.push(() => onLoad?.(tex));
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
    setZapColor() {}
    setDread() {}
    setHunters(list) { this.tags = list; }
    get keypadOpen() { return false; }
    closeKeypad() { return false; }
    closeLayer() {}
    setNotice() {}
    showPause() {}
    say(text) { this.said.push(text); }
    showIntro(device, round, onStart, onQuit) { this.intro = { round, onStart, onQuit }; }
    showEnd(text, onAgain, onDone, notes, news, compact, tonight) { this.end = { text, onAgain, onDone, notes, tonight }; }
    setTonight(line) { this.tonight = line; }
    showNote(lines) { this.noteOpen = true; this.noteLines = lines; }
    closeNote() {
      const was = this.noteOpen;
      this.noteOpen = false;
      this.noteLines = null;
      return was;
    }
  }
  return { HorrorHud, startHint: () => '', levelLine: (easy) => (easy ? '쉬움' : '어려움'), escapeText: (r, c, head) => head ?? '탈출', forestEscapeHead: (name) => `${name} 나옴`, lastNightText: ({ gems }) => `끝 ${gems}`, stampLines: (earned) => (earned ? ['도장'] : []) };
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
    play(name) { (this.played ??= []).push(name); }
    hush() {}
    suspend() {}
    resume() {}
    setActive() {}
    setHum() {}
  },
}));

vi.mock('../src/save.js', () => ({
  saveStore: {
    load: () => fakes.save ?? { gems: 0, horror: { escapes: 0, cleanEscapes: 0, gemDay: null, last: null, stamps: {}, bolt: null, light: null }, settings: {} },
    save: (s) => { if (fakes.save) fakes.save = s; },
  },
}));

const { HorrorGame } = await import('../src/horror/HorrorGame.js');
const { artMap } = await import('../src/horror/aids.js');
const { AID_KINDS } = await import('../src/logic/horrorAids.js');

// 도움 아이템 화면(src/horror/aids.js)이 만드는 글자 칸과 그림판. 그리기는 하지 않는다
function fakeEl() {
  const el = { style: {}, children: [], appendChild(c) { el.children.push(c); return c; }, append(...c) { el.children.push(...c); }, addEventListener() {}, remove() {}, getContext: () => null, textContent: '' };
  el.firstChild = { style: {} };
  el.lastChild = { style: {}, textContent: '' };
  return el;
}

const DT = 1 / 30;
const idle = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false });

function makeGame(mapId, monsterId, o = {}) {
  const onExit = vi.fn();
  const onAgain = vi.fn();
  const g = new HorrorGame({ appendChild() {} }, { round: o.round ?? { mapId, monsterId }, touch: false, device: 'pc', lowFx: false, muted: true, onExit, onAgain, ...o });
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
function faceOff(g, gap, s = g.stalker) {
  const area = [...reachable(g.map, g.map.start)].map((t) => t.split(',').map(Number));
  for (const [cx, cy] of area) {
    const from = center({ cx, cy });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const to = { x: from.x + dx * gap, y: from.y + dy * gap };
      if (!area.some(([x, y]) => x === Math.floor(to.x) && y === Math.floor(to.y)) || !lineOfSight(g.map, from, to)) continue;
      g.p = from;
      Object.assign(s, { x: to.x, y: to.y, path: [], mode: 'patrol', graceT: 0, warnT: 0 });
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
  fakes.okArt = false;
  fakes.audio.length = 0;
  fakes.save = null;
  vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, location: { search: '' }, addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, exitPointerLock() {}, hidden: false, createElement: fakeEl });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('판 재료', () => {
  it.each(['factory', 'sewer', 'school', 'park', 'mart'])('%s: 안개, 배경, 환경광, 그림이 맵 테마를 따른다', (mapId) => {
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

  const materialsOf = (g) => {
    const mats = new Set();
    g.scene.traverse((o) => { if (o.material) mats.add(o.material); });
    return [...mats];
  };
  const hex = (color) => new THREE.Color(color).getHex();

  it.each(['school', 'station', 'factory', 'sewer', 'park', 'mart'])('%s: 소품 그림을 하나도 못 받아도 예전 색 그대로 돈다', (mapId) => {
    const { theme } = ALL_MAPS[mapId];
    fakes.failArt = 'horror_'; // 이 맵의 그림을 전부 막는다
    const g = makeGame(mapId, 'seino');
    const plain = materialsOf(g).filter((m) => !m.map).map((m) => m.color.getHex());
    expect(plain).toContain(hex(theme.ceil));
    expect(plain).toContain(hex(theme.decor.pipe.color));
    if (theme.decor.low) expect(plain).toContain(hex(theme.decor.low.color));
    for (const kind of theme.decor.extra ?? []) expect(plain).toContain(hex(kind.plain));
    expect(g.clueMeshes.every((m) => !m.material.map && m.material.color.getHex() === 0xe02828)).toBe(true);
    g.world.update(g.p, 14, 0, true);
    expect(g.world.lightMat.map).toBeNull();
    expect(g.world.lightMat.color.getHex()).toBe(new THREE.Color(theme.lightColor).multiplyScalar(g.k.emergencyLow).getHex());
    g.exit();
  });

  it('소품 그림을 받으면 천장은 눌린 색으로 되풀이되고 쪽지는 그림 제 색이다', () => {
    const { theme } = MAPS.school;
    fakes.okArt = true;
    const g = makeGame('school', 'seino');
    const painted = materialsOf(g).filter((m) => m.map);
    const ceil = painted.find((m) => m.color.getHex() === hex(theme.ceilArt.tint));
    expect(ceil.map.repeat.x).toBe(theme.ceilArt.repeat);
    expect(ceil.map.wrapS).toBe(THREE.RepeatWrapping);
    expect(painted.find((m) => m.color.getHex() === hex(theme.decor.pipe.tint)).map.repeat.y).toBe(theme.decor.pipe.repeat);
    expect(painted.some((m) => m.color.getHex() === hex(theme.decor.low.tint))).toBe(true);
    expect(g.clueMeshes.every((m) => m.material.map && m.material.color.getHex() === 0xffffff)).toBe(true);
    g.exit();
  });

  it('등 그림을 받아도 깜빡이고, 색은 입히지 않아 흰 글자가 희다', () => {
    fakes.okArt = true;
    const g = makeGame('school', 'seino');
    const mat = g.world.lightMat;
    expect(mat.map).toBeTruthy();
    const levels = [0, 1, 2, 3, 4].map((t) => {
      g.world.update(g.p, 14, t * 1.37, false);
      expect(mat.color.r).toBeCloseTo(mat.color.g);
      expect(mat.color.g).toBeCloseTo(mat.color.b);
      return mat.color.r;
    });
    expect(new Set(levels).size).toBeGreaterThan(1);
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

describe('호러워드', () => {
  it('벽에 들어가면 소리가 나고, 가까우면 글로도 알리되 자주 알리지는 않는다', () => {
    const g = makeGame('factory', 'ward');
    g.audio = { play: vi.fn(), destroy() {} };
    g.playTime = 100;
    Object.assign(g.stalker, { x: g.p.x + 3, y: g.p.y });
    g.onStalkerEvents(['wall']);
    g.onStalkerEvents(['wall']);
    expect(g.audio.play).toHaveBeenCalledTimes(2);
    expect(g.hud.said.filter((t) => t.includes('호러워드'))).toHaveLength(1);
    g.exit();
  });

  it('호러워드 판에만 벽이 휘는 조각을 만든다', () => {
    const a = makeGame('factory', 'ward');
    expect(a.bulge).not.toBeNull();
    a.exit();
    const b = makeGame('factory', 'seino');
    expect(b.bulge).toBeNull();
    b.exit();
  });
});

describe('정문 번호', () => {
  const atGate = () => {
    const g = makeGame('factory', 'seino');
    g.state = 'play';
    g.audio = { play: vi.fn(), hush() {}, update() {}, updateStalker() {}, suspend() {}, resume() {}, setHum() {}, setActive() {}, destroy() {} };
    g.hud.showKeypad = vi.fn(function open(o) { this.keypad = o; });
    g.hud.setKeypad = vi.fn();
    g.hud.closeKeypad = vi.fn(function close() { const was = Boolean(this.keypad); this.keypad = null; return was; });
    Object.defineProperty(g.hud, 'keypadOpen', { get() { return Boolean(this.keypad); } });
    g.run.powered = true;
    g.p = center(frontOf(g.map, g.map.gate));
    Object.assign(g.stalker, { x: 1.5, y: 1.5, graceT: 99 });
    return g;
  };
  const press = (g, key) => {
    g.readInput = () => ({ ...idle(), ...key });
    g.update(DT);
    g.readInput = idle;
  };
  const code = (g) => g.run.code.digits.map(String);

  it('정문은 바로 열리지 않고 입력 칸이 뜬다', () => {
    const g = atGate();
    press(g, { use: true });
    expect(g.state).toBe('play');
    expect(g.hud.showKeypad).toHaveBeenCalledTimes(1);
    expect(g.hud.keypad.lines.join(' ')).toContain('붉은 쪽지가 3장');
    expect(g.hud.keypad.lines.at(-1)).toContain(String(g.run.code.digits[3]));
    g.exit();
  });

  it('찾은 단서는 입력 칸에 보인다', () => {
    const g = atGate();
    g.run.clues[1].taken = true;
    press(g, { use: true });
    expect(g.hud.keypad.lines.join(' ')).toContain(g.clueTexts[1].at(-1));
    expect(g.hud.keypad.lines.join(' ')).toContain('2장');
    g.exit();
  });

  it('맞히면 탈출하고 끝 화면에 맵 결말이 나온다', () => {
    const g = atGate();
    press(g, { use: true });
    press(g, { typed: code(g) });
    expect(g.state).toBe('end');
    expect(g.hud.end.notes.ending).toContain('공장');
    g.exit();
  });

  it('틀리면 경고음이 나고 그동안 괴물에게 달리는 소리처럼 들린다', () => {
    const g = atGate();
    press(g, { use: true });
    press(g, { typed: code(g).map((d, i) => (i === 3 ? String((Number(d) + 1) % 10) : d)) });
    expect(g.state).toBe('play');
    expect(g.audio.play).toHaveBeenCalledWith('codeWrong');
    expect(g.alarmT).toBeGreaterThan(0);
    expect(g.hud.keypadOpen).toBe(true); // 다시 넣을 수 있다
    frames(g, g.k.codeAlarm + 0.1);
    expect(g.alarmT).toBe(0);
    g.exit();
  });

  it('입력 칸이 닫혀 있으면 숫자 키는 아무 일도 하지 않는다', () => {
    const g = atGate();
    press(g, { typed: code(g) });
    expect(g.run.code.entered).toBe('');
    expect(g.state).toBe('play');
    g.exit();
  });

  it('E 를 다시 누르면 닫히고, 멀어져도 닫힌다', () => {
    const g = atGate();
    press(g, { use: true });
    press(g, { use: true });
    expect(g.hud.keypadOpen).toBe(false);
    press(g, { use: true });
    g.p = center(g.map.start);
    g.update(DT);
    expect(g.hud.keypadOpen).toBe(false);
    g.exit();
  });

  it('단서를 주우면 쪽지로 보여 주고 일시정지의 읽은 쪽지에 남는다', () => {
    const g = atGate();
    g.run.powered = false;
    g.hud.showNote = vi.fn();
    g.doUse({ kind: 'clue', index: 2 });
    expect(g.run.clues[2].taken).toBe(true);
    expect(g.clueMeshes[2].visible).toBe(false);
    expect(g.hud.showNote).toHaveBeenCalledWith(g.clueTexts[2], false);
    g.exit();
  });
});

describe('놀람 장면', () => {
  // 시작하자마자 놀람 칸을 밟게 한다
  const stepOnScare = (id = 'seino', o) => {
    const g = makeGame('factory', id, o);
    g.state = 'play';
    g.audio = { play: vi.fn(), hush: vi.fn(), update() {}, updateStalker() {}, suspend() {}, resume() {}, setHum() {}, setActive() {}, destroy() {} };
    const c = cellOf(g.p);
    g.scaresLeft = [{ cx: c.cx, cy: c.cy }, { cx: c.cx, cy: c.cy }];
    Object.assign(g.stalker, { x: 1.5, y: 1.5, graceT: 99 }); // 진짜 괴물은 멀리 둔다
    g.readInput = idle;
    return g;
  };

  it('불이 꺼지고 소리가 죽었다가, 얼굴이 나타나며 터지고, 모두 돌아온다', () => {
    const g = stepOnScare();
    g.scaresLeft.pop();
    const k = g.k.scare;
    frames(g, k.dark / 2);
    expect(g.flash.intensity).toBe(0);
    expect(g.ambientLight.intensity).toBeLessThan(g.k.ambient);
    expect(g.audio.hush).toHaveBeenCalledWith(true);
    expect(g.audio.play).not.toHaveBeenCalledWith('scare');
    expect(g.gun.root.visible).toBe(false);
    frames(g, k.dark / 2 + k.show / 2);
    expect(g.audio.play).toHaveBeenCalledWith('scare', 0);
    expect(g.model.group.visible).toBe(true);
    const head = g.model.head.getWorldPosition(new THREE.Vector3());
    expect(Math.hypot(head.x - g.p.x * 3, head.z - g.p.y * 3)).toBeLessThan(2);
    expect(g.stalker.x).toBe(1.5); // 진짜 괴물은 오지 않았다
    frames(g, k.show);
    expect(g.scare).toBe(null);
    expect(g.ambientLight.intensity).toBe(g.k.ambient);
    expect(g.audio.hush).toHaveBeenLastCalledWith(false);
    expect(g.hud.said.length).toBeGreaterThan(0);
    g.exit();
  });

  it('두 번째 놀람은 얼굴 없이 어둠과 소리만 있다', () => {
    const g = stepOnScare();
    frames(g, g.k.scare.dark + g.k.scare.show + 0.1);
    const again = g.audio.play.mock.calls.length;
    frames(g, g.k.scare.dark + 0.1);
    expect(g.audio.play.mock.calls.length).toBeGreaterThan(again);
    expect(g.model.group.visible).toBe(false);
    g.exit();
  });

  it('일시정지하면 끊기고 불이 돌아온다', () => {
    const g = stepOnScare();
    frames(g, 0.2);
    g.pause();
    expect(g.scare).toBe(null);
    expect(g.flash.intensity).toBe(g.k.flashIntensity);
    expect(g.ambientLight.intensity).toBe(g.k.ambient);
    expect(g.audio.hush).toHaveBeenLastCalledWith(false);
    g.exit();
  });

  it('효과 줄이기면 화면이 흔들리지 않는다', () => {
    const g = stepOnScare('seino', { lowFx: true });
    frames(g, g.k.scare.dark + 0.05);
    expect(g.shakeT).toBe(0);
    g.exit();
  });

  it('효과 줄이기여도 얼굴이 지나가면 손전등 밝기가 돌아온다', () => {
    const g = stepOnScare('seino', { lowFx: true });
    g.scaresLeft.pop();
    frames(g, g.k.scare.dark + g.k.scare.show + 0.1);
    expect(g.scare).toBe(null);
    expect(g.flash.intensity).toBe(g.k.flashIntensity);
    g.exit();
  });

  it('정적이 먼저 오고 그 뒤에 비명과 얼굴이 온다', () => {
    const g = makeGame('factory', 'seino');
    g.state = 'play';
    g.audio = { play: vi.fn(), hush: vi.fn(), update() {}, updateStalker() {}, suspend: vi.fn(), resume() {}, setHum() {}, setActive() {}, destroy() {} };
    g.readInput = idle;
    Object.assign(g.stalker, { x: g.p.x + 0.4, y: g.p.y });
    g.getCaught();
    expect(g.audio.hush).toHaveBeenCalledWith(true);
    expect(g.audio.play).not.toHaveBeenCalled();
    expect(g.model.group.visible).toBe(false);
    frames(g, g.k.scare.hush + 0.05);
    expect(g.audio.play).toHaveBeenCalledWith('caught', 0);
    expect(g.model.group.visible).toBe(true);
    g.exit();
  });

  it.each(['seino', 'gazer', 'maw', 'ward'])('%s: 얼굴은 정해진 거리에서 멈춘다', (id) => {
    const g = makeGame('factory', id);
    Object.assign(g.stalker, { x: g.p.x + 0.4, y: g.p.y });
    g.getCaught();
    frames(g, 0.6);
    g.model.group.updateMatrixWorld(true);
    const head = g.model.head.getWorldPosition(new THREE.Vector3());
    const d = Math.hypot(head.x - g.p.x * 3, head.z - g.p.y * 3);
    expect(d).toBeCloseTo(g.model.faceNear ?? 0.6, 1);
    g.exit();
  });
});

describe('마지막 밤', () => {
  const start = () => makeGame(null, null, { round: LAST_ROUND });
  const ids = roundMonsters(LAST_ROUND);
  const quiet = (g) => {
    g.audio = { play: vi.fn(), hush() {}, update() {}, updateStalker() {}, suspend() {}, resume() {}, setHum() {}, setActive() {}, destroy() {} };
    return g;
  };

  it('괴물마다 몸과 목소리가 따로 있고 맵의 다른 칸에서 시작한다', () => {
    const g = start();
    expect(g.stalkers.map((s) => s.monsterId)).toEqual(ids);
    expect(new Set(g.hunters.map((h) => h.model)).size).toBe(2);
    expect([fakes.audio.at(-1).options.voice, ...fakes.audio.at(-1).options.more]).toEqual(ids.map((id) => MONSTERS[id].voice));
    expect(Math.hypot(g.stalkers[0].x - g.stalkers[1].x, g.stalkers[0].y - g.stalkers[1].y)).toBeGreaterThan(5);
    g.exit();
  });

  it('안내와 쪽지에 두 괴물 이름이 들어가고 빈칸이 남지 않는다', () => {
    const g = start();
    const names = ids.map((id) => MONSTERS[id].name);
    expect(g.hud.intro.round.monsterName).toContain(names[0]);
    expect(g.hud.intro.round.monsterName).toContain(names[1]);
    const all = [g.hud.intro.round.hint, ...g.noteTexts.flat()].join(' ');
    expect(all).toContain(names[1]);
    expect(all).not.toMatch(/\{(name|other)/);
    g.exit();
  });

  it('눈뜬이를 보고 있으면 눈뜬이만 멈추고 세이노는 계속 움직인다', () => {
    const g = start();
    const [seino, gazer] = g.stalkers;
    faceOff(g, 4, gazer);
    const stay = { x: gazer.x, y: gazer.y };
    const from = { x: seino.x, y: seino.y };
    frames(g, 2);
    expect({ x: gazer.x, y: gazer.y }).toEqual(stay);
    expect(gazer.mode).toBe('watch');
    expect(Math.hypot(seino.x - from.x, seino.y - from.y)).toBeGreaterThan(0.5);
    g.exit();
  });

  it('둘 다 벽에 가리면 둘 다 그리지 않고, 한쪽만 보이면 그쪽만 그린다', () => {
    const g = start();
    g.cullCreature();
    expect(g.hunters.map((h) => h.model.group.visible)).toEqual([false, false]);
    Object.assign(g.stalkers[1], { x: g.p.x + 1, y: g.p.y });
    g.cullCreature();
    expect(g.hunters.map((h) => h.model.group.visible)).toEqual([false, true]);
    g.exit();
  });

  it('둘째 괴물이 잡으면 그 얼굴이 나오고, 돌아오면 둘 다 멀리 가서 쉰다', () => {
    const g = quiet(start());
    Object.assign(g.stalkers[1], { x: g.p.x + 0.3, y: g.p.y, mode: 'chase' });
    Object.assign(g.stalkers[0], { x: g.p.x + 2, y: g.p.y, mode: 'chase' });
    const respawn = g.respawn.bind(g);
    let sent = null; // 보낸 순간의 순찰 지점. 다음 프레임부터는 각자 새 지점을 뽑아서 우연히 같을 수 있다
    g.respawn = () => {
      respawn();
      sent = g.stalkers.map((s) => s.patrolIndex);
    };
    g.getCaught(g.hunters[1]);
    expect(g.lunge.model).toBe(g.hunters[1].model);
    frames(g, g.k.scare.hush + 0.05);
    expect(g.audio.play).toHaveBeenCalledWith('caught', 1);
    expect(g.hunters.map((h) => h.model.group.visible)).toEqual([false, true]);
    frames(g, 2.2);
    expect(g.state).toBe('play');
    for (const s of g.stalkers) {
      expect(s.graceT).toBeGreaterThan(0);
      expect(s.mode).not.toBe('chase');
      expect(Math.hypot(s.x - g.p.x, s.y - g.p.y)).toBeGreaterThan(8);
    }
    expect(sent[0]).not.toBe(sent[1]);
    g.exit();
  });

  it('두 알림이 한꺼번에 나도 앞 글을 지우지 않고 차례로 띄운다', () => {
    const g = start();
    g.hud.said.length = 0;
    g.onStalkerEvents(['chase'], g.hunters[0]);
    g.onStalkerEvents(['chase'], g.hunters[1]);
    expect(g.hud.said).toHaveLength(1);
    expect(g.hud.said[0]).toContain(MONSTERS[ids[0]].name);
    g.playTime += g.k.lastNight.alarmHold;
    g.showWarnings();
    expect(g.hud.said).toHaveLength(2);
    expect(g.hud.said[1]).toContain(MONSTERS[ids[1]].name);
    g.exit();
  });

  it('이름표는 두 괴물의 상태를 보인다', () => {
    const g = start();
    g.stalkers[1].mode = 'chase';
    g.showWarnings();
    expect(g.hud.tags).toEqual([{ name: MONSTERS[ids[0]].name, state: 'far' }, { name: MONSTERS[ids[1]].name, state: 'chase' }]);
    g.exit();
  });

  it('쇼크는 가까운 쪽만 맞히고 나머지는 계속 온다', () => {
    const g = quiet(start());
    g.state = 'play';
    g.hud.flashShock = () => {};
    g.run.shock = true;
    Object.assign(g.stalkers[1], { x: g.p.x + 1, y: g.p.y });
    Object.assign(g.stalkers[0], { x: g.p.x + 2, y: g.p.y });
    g.doPunch();
    expect(g.stalkers.map((s) => s.mode)).toEqual(['patrol', 'stunned']);
    g.exit();
  });

  it('처음 깨면 보석을 주고, 도장과 오늘의 탈출 보석은 건드리지 않고, 다시 깨면 보석이 없다', () => {
    fakes.save = { gems: 0, horror: normalizeHorror({ stamps: Object.fromEntries(boardCells({}).map((c) => [cellKey(c), 'plain'])) }), settings: {} };
    const stamps = { ...fakes.save.horror.stamps };
    const win = () => {
      const g = quiet(start());
      g.run.powered = true;
      g.win();
      return g;
    };
    const a = win();
    expect(fakes.save.gems).toBe(a.k.lastNight.gems);
    expect(fakes.save.horror.lastCleared).toBe(true);
    expect(fakes.save.horror.stamps).toEqual(stamps);
    expect(fakes.save.horror.gemDay).toBe(null);
    expect(a.audio.play).toHaveBeenCalledWith('bell');
    expect(a.hud.end.text).toBe(`끝 ${a.k.lastNight.gems}`);
    a.exit();
    const b = win();
    expect(fakes.save.gems).toBe(b.k.lastNight.gems);
    expect(b.hud.end.text).toBe('끝 0');
    b.exit();
  });

  it('끝 화면에 쪽지 이야기의 끝이 두 괴물 이름으로 나온다', () => {
    const g = quiet(start());
    g.run.powered = true;
    g.win();
    const ending = g.hud.end.notes.ending;
    expect(ending.length).toBeGreaterThan(2);
    expect(ending.join(' ')).toContain(MONSTERS[ids[0]].name);
    expect(ending.join(' ')).toContain(MONSTERS[ids[1]].name);
    expect(ending.join(' ')).not.toContain('{');
    g.exit();
  });

  it('두 몸을 모두 정리한다', () => {
    const g = start();
    const spies = g.hunters.map((h) => vi.spyOn(h.model, 'dispose'));
    g.exit();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('한 마리 판은 그대로다', () => {
  it('맵 목록은 그대로이고, 괴물도 몸도 하나다', () => {
    expect(ALL_MAPS.factory).toBe(MAPS.factory);
    expect(Object.keys(MAPS)).not.toContain(LAST_ROUND.mapId);
    const g = makeGame('factory', 'seino');
    expect(g.hunters).toHaveLength(1);
    expect(fakes.audio.at(-1).options.more).toEqual([]);
    g.showWarnings();
    expect(g.hud.tags).toBeUndefined(); // 이름표가 없다
    g.exit();
  });

  it('알림이 기다리지 않고 바로 뜬다', () => {
    const g = makeGame('factory', 'seino');
    g.hud.said.length = 0;
    g.onStalkerEvents(['chase']);
    g.onStalkerEvents(['chase']);
    expect(g.hud.said).toHaveLength(2);
    g.exit();
  });

  it('탈출 보석과 도장은 전처럼 준다', () => {
    fakes.save = { gems: 0, horror: normalizeHorror({}), settings: {} };
    const g = makeGame('factory', 'seino');
    g.run.powered = true;
    g.win();
    expect(fakes.save.gems).toBeGreaterThan(0);
    expect(fakes.save.horror.escapes).toBe(1);
    expect(Object.keys(fakes.save.horror.stamps)).toHaveLength(1);
    expect(fakes.save.horror.lastCleared).toBe(false);
    g.exit();
  });
});

describe('오늘의 밤', () => {
  const round = { mapId: 'factory', monsterId: 'seino' };
  const start = (rule, date = '2026-11-01') => {
    const g = makeGame('factory', 'seino', { round, tonight: { date, rule } });
    g.getCaught = () => {};
    return g;
  };
  const win = (g) => {
    g.run.powered = true;
    g.win();
  };
  beforeEach(() => {
    fakes.save = { gems: 0, horror: normalizeHorror({}), settings: {} };
  });

  it('손전등 조건은 꺼진 채로 시작하고, 켜면 깨지며 판은 계속된다', () => {
    const g = start('noLight');
    expect(g.lightOn).toBe(false);
    expect(g.ambientLight.intensity).toBe(g.k.ambient * g.k.tonight.darkAmbient);
    frames(g, 0.1);
    expect(g.hud.tonight.broken).toBe(false);
    g.readInput = () => ({ ...idle(), light: true });
    g.update(DT);
    g.readInput = idle;
    g.update(DT);
    expect(g.hud.tonight.broken).toBe(true);
    expect(g.state).toBe('play');
    win(g);
    expect(g.hud.end.tonight.met).toBe(false);
    expect(fakes.save.horror.tonightDone).toEqual([]);
    expect(fakes.save.gems).toBe(g.k.gemsEscape + g.k.gemsClean);
    g.exit();
  });

  it('보통 판은 손전등을 켜고 밝기도 그대로이고 조건 줄이 없다', () => {
    const g = makeGame('factory', 'seino');
    expect(g.lightOn).toBe(true);
    expect(g.ambientLight.intensity).toBe(g.k.ambient);
    frames(g, 0.1);
    expect(g.hud.tonight).toBeUndefined();
    win(g);
    expect(g.hud.end.tonight).toBeFalsy();
    expect(fakes.save.gems).toBe(g.k.gemsEscape + g.k.gemsClean);
    g.exit();
  });

  it('달리기는 봐주는 시간을 넘으면 깨진다', () => {
    const g = start('noRun');
    Object.assign(g.stalker, { x: 30, y: 2, mode: 'stunned', stunT: 999 });
    g.readInput = () => ({ ...idle(), move: { x: 0, z: 1, run: true } });
    g.update(DT);
    expect(g.ranFor).toBeGreaterThan(0);
    expect(g.hud.tonight.broken).toBe(false);
    g.ranFor = g.k.tonight.runGrace + 0.01;
    g.update(DT);
    expect(g.hud.tonight.broken).toBe(true);
    g.exit();
  });

  it('쇼크를 쏘면 깨지고, 충전만 하거나 빈손으로 누르면 깨지지 않는다', () => {
    const g = start('noShock');
    g.hud.flashShock = () => {};
    g.doPunch();
    expect(g.tonightCounts().shocks).toBe(0);
    g.run.shock = true;
    g.doPunch();
    expect(g.tonightCounts().shocks).toBe(1);
    g.exit();
  });

  it('성공하면 탈출 보석에 더해 주고, 같은 날 다시 지켜도 더 주지 않는다', () => {
    const a = start('noRun');
    win(a);
    const k = a.k;
    expect(a.hud.end.tonight.met).toBe(true);
    expect(fakes.save.gems).toBe(k.gemsEscape + k.gemsClean + k.tonight.gems);
    expect(fakes.save.horror.tonightDone).toEqual(['2026-11-01']);
    expect(fakes.save.horror.stamps).toEqual({ 'factory/seino': 'gold' }); // 보통 판처럼 도장을 찍는다
    a.exit();
    const gems = fakes.save.gems;
    const b = start('noRun');
    win(b);
    expect(b.hud.end.tonight.met).toBe(true);
    expect(fakes.save.gems).toBe(gems);
    b.exit();
  });

  it('자정을 넘긴 판은 시작한 날로 받고, 그날 이미 받았으면 주지 않고, 다음 날 판은 따로 받는다', () => {
    fakes.save.horror.gemDay = '2026-11-02'; // 탈출 보석은 끝난 날 기준이라 뺀다
    vi.useFakeTimers({ now: new Date(2026, 10, 2, 0, 10), toFake: ['Date'] });
    try {
      const a = start('noRun', '2026-11-01');
      win(a);
      expect(fakes.save.horror.tonightDone).toEqual(['2026-11-01']);
      const paid = fakes.save.gems;
      expect(paid).toBeGreaterThanOrEqual(a.k.tonight.gems);
      a.exit();
      const b = start('noRun', '2026-11-01');
      win(b);
      expect(fakes.save.gems).toBe(paid);
      b.exit();
      const c = start('noRun', '2026-11-02');
      win(c);
      expect(fakes.save.horror.tonightDone).toEqual(['2026-11-01', '2026-11-02']);
      expect(fakes.save.gems).toBe(paid + c.k.tonight.gems);
      c.exit();
    } finally {
      vi.useRealTimers();
    }
  });

  it('쪽지 조건은 모은 만큼 줄에 보이고 모자라면 성공이 아니다', () => {
    const g = start('notes');
    frames(g, 0.1);
    expect(g.hud.tonight.text).toContain(`0/${g.k.tonight.notes}`);
    g.notes.found = g.k.tonight.notes - 1;
    win(g);
    expect(g.hud.end.tonight.met).toBe(false);
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

describe('어른용 숲', () => {
  const start = () => makeGame(null, null, { round: FOREST_ROUND });

  it('처녀귀신 하나로 돌고, 소개에 숲 표시와 숲 이름이 간다', () => {
    const g = start();
    expect(g.hunters).toHaveLength(1);
    expect(g.monsters[0]).toBe(ALL_MONSTERS.maiden);
    expect(fakes.audio.at(-1).options.voice).toBe('maiden');
    expect(g.hud.intro.round.forest).toBe(true);
    expect(g.hud.intro.round.mapName).toBe(FOREST_PLACE.name);
    expect(g.noteTexts.flat().join(' ')).not.toContain('{');
    g.exit();
  });

  it('탈출하면 오늘의 탈출 보석을 주고 도장은 찍지 않는다', () => {
    fakes.save = { gems: 0, horror: normalizeHorror({}), settings: {} };
    const g = start();
    g.run.powered = true;
    g.win();
    expect(fakes.save.gems).toBeGreaterThan(0);
    expect(fakes.save.horror.escapes).toBe(1);
    expect(fakes.save.horror.gemDay).not.toBe(null);
    expect(fakes.save.horror.stamps).toEqual({});
    expect(fakes.save.horror.lastCleared).toBe(false);
    expect(g.hud.end.text).toBe(`${FOREST_PLACE.name} 나옴`);
    expect(g.hud.end.notes.ending).toContain(ALL_MONSTERS.maiden.name);
    g.exit();
  });
});

describe('도움 아이템', () => {
  const play = (mapId = 'school', monsterId = 'seino') => {
    const g = makeGame(mapId, monsterId);
    Object.assign(g.stalker, { graceT: 99 });
    return g;
  };
  const press = (g, key) => {
    g.readInput = () => ({ ...idle(), ...key });
    g.update(DT);
    g.readInput = idle;
  };
  const pickUp = (g, kind) => {
    const i = g.aids.state.items.findIndex((c) => c.kind === kind);
    g.p = center(g.aids.state.items[i]);
    press(g, { use: true });
    return i;
  };

  it('바닥의 아이템을 E 로 주우면 칸 수가 늘고 바닥에서 사라진다', () => {
    const g = play();
    const i = pickUp(g, 'flare');
    expect(g.aids.state.held.flare).toBe(1);
    expect(g.aids.itemMeshes[i].visible).toBe(false);
    expect(g.hud.said.at(-1)).toContain('1번');
    g.exit();
  });

  it('조명탄은 잠깐 환하게 했다가 원래 어둠으로 돌아오고, 소리를 남긴다', () => {
    const g = play();
    pickUp(g, 'flare');
    const dark = g.ambientLight.intensity;
    press(g, { typed: ['1'] });
    expect(g.aids.state.held.flare).toBe(0);
    expect(g.ambientLight.intensity).toBeGreaterThan(dark * 3);
    expect(g.scene.fog.far).toBeGreaterThan(g.k.fogCells * 3);
    expect(g.audio.played).toContain('flare');
    frames(g, g.k.aids.flareTime + 0.2);
    expect(g.ambientLight.intensity).toBeCloseTo(dark);
    press(g, { typed: ['1'] });
    expect(g.hud.said.at(-1)).toBe('조명탄이 없다');
    g.exit();
  });

  it('벽 지도를 보는 동안 못 움직이고 시끄럽고, 10초 뒤 닫히며 다시는 못 본다', () => {
    const g = play();
    const b = g.aids.state.boards[0];
    g.p = center(b);
    press(g, { use: true });
    expect(g.aids.mapOpen).toBe(true);
    const at = g.p;
    g.readInput = () => ({ ...idle(), move: { x: 0, z: 1, run: false } });
    frames(g, 1);
    expect(g.p).toEqual(at);
    g.readInput = idle;
    expect(g.lastEvents).toBeDefined();
    frames(g, g.k.aids.boardTime);
    expect(g.aids.mapOpen).toBe(false);
    press(g, { use: true });
    expect(g.aids.mapOpen).toBe(false);
    expect(g.nearestUse().label).toBe('이 지도는 이미 봤다');
    g.exit();
  });

  it('지도를 보는 동안 세이노가 가까우면 소리를 듣고 오며, 쫓기면 지도가 닫힌다', () => {
    const g = play();
    g.p = center(g.aids.state.boards[0]);
    press(g, { use: true });
    const near = findNear(g, 6);
    Object.assign(g.stalker, { ...center(near), graceT: 0, mode: 'patrol', path: [] });
    g.update(DT);
    expect(['investigate', 'chase']).toContain(g.stalker.mode);
    g.stalker.mode = 'chase';
    g.update(DT);
    expect(g.aids.mapOpen).toBe(false);
    g.exit();
  });

  it('지도를 보는 동안 눈뜬이는 안 본 것으로 친다', () => {
    const g = play('school', 'gazer');
    g.p = center(g.aids.state.boards[0]);
    press(g, { use: true });
    faceOff(g, 4);
    g.aids.mapT = 5;
    g.update(DT);
    expect(g.stalker.mode).not.toBe('watch');
    g.exit();
  });

  it('나침반은 화살표를 띄우고, 장난감은 앞에 떨어지고, 분필은 바닥에 표시를 남긴다', () => {
    const g = play();
    for (const kind of ['compass', 'toy', 'chalk']) pickUp(g, kind);
    g.p = center(g.map.start);
    press(g, { typed: ['2'] });
    expect(g.aids.arrow.style.display).toBe('flex');
    expect(g.aids.compass.name).toBeTruthy();
    press(g, { typed: ['3'] });
    expect(g.aids.toy.visible).toBe(true);
    expect(g.aids.state.sounds.some((s) => s.lure)).toBe(true);
    press(g, { typed: ['4'] });
    expect(g.aids.state.marks).toHaveLength(1);
    expect(g.aids.state.held.chalk).toBe(g.k.aids.chalkUses - 1);
    g.exit();
  });

  // 아이템 자리마다 [빛나는 모양, 그림] 이 있다
  const looks = (g) => g.aids.itemMeshes.map((h) => h.children);

  it.each(['factory', 'sewer', 'school', 'station', 'pool', 'forest'])('%s: 아이템과 지도판 그림을 받으면 그 맵 그림으로 바뀐다', (mapId) => {
    fakes.okArt = true;
    const g = play(mapId);
    for (const kind of AID_KINDS) expect(fakes.loads).toContain(`art/aid_${mapId}_${kind}.webp`);
    expect(fakes.loads).toContain(`art/aid_board_${mapId}.webp`);
    for (const [prim, sprite] of looks(g)) {
      expect(prim.visible).toBe(false);
      expect(sprite.visible).toBe(true);
      expect(sprite.material.map).toBeTruthy();
    }
    pickUp(g, 'toy');
    g.p = center(g.map.start);
    press(g, { typed: ['3'] });
    expect(g.aids.toy.visible).toBe(true);
    expect(g.aids.toy.children[1].visible).toBe(true);
    g.exit();
  });

  it('모르는 맵은 공장 그림을 쓴다', () => {
    expect(artMap('nowhere')).toBe('factory');
    expect(artMap(undefined)).toBe('factory');
    expect(artMap('pool')).toBe('pool');
  });

  it('아이템과 지도판 그림을 못 받으면 빛나는 모양과 그린 지도판 그대로 돌고, 줍고 던지고 지도도 본다', () => {
    fakes.failArt = 'aid_';
    const g = play('station');
    for (const [prim, sprite] of looks(g)) {
      expect(prim.visible).toBe(true);
      expect(sprite.visible).toBe(false);
    }
    expect(g.aids.boardMeshes.every((m) => m.material.map?.isCanvasTexture)).toBe(true);
    pickUp(g, 'toy');
    g.p = center(g.map.start);
    press(g, { typed: ['3'] });
    expect(g.aids.toy.children[0].visible).toBe(true);
    g.p = center(g.aids.state.boards[0]);
    press(g, { use: true });
    expect(g.aids.mapOpen).toBe(true);
    g.exit();
  });

  // 충전 상자 재질 (파랗게 빛난다): 그림 판(alphaTest) 과 원래 상자
  const chargeLooks = (g) => {
    const found = [];
    g.scene.traverse((o) => { if (o.isMesh && o.material?.emissive?.getHex() === 0x3060c0) found.push(o); });
    return { cards: found.filter((o) => o.material.alphaTest > 0), boxes: found.filter((o) => !o.material.alphaTest) };
  };

  it('숲의 충전 상자와 전원은 그림을 받으면 숲 그림으로, 못 받으면 상자 그대로다', () => {
    fakes.okArt = true;
    const g = makeGame('forest', FOREST_ROUND.monsterId, { round: FOREST_ROUND });
    expect(fakes.loads).toContain('art/horror_forest_box.webp');
    expect(fakes.loads).toContain('art/horror_forest_panel.webp');
    expect(fakes.loads).not.toContain('art/horror_box.jpg');
    let { cards, boxes } = chargeLooks(g);
    expect(cards.length).toBe(1);
    expect(cards[0].material.visible && cards[0].material.map).toBeTruthy();
    expect(boxes.every((o) => !o.visible)).toBe(true);
    g.exit();
    fakes.okArt = false;
    fakes.failArt = 'horror_forest_';
    const h = makeGame('forest', FOREST_ROUND.monsterId, { round: FOREST_ROUND });
    ({ cards, boxes } = chargeLooks(h));
    expect(cards[0].material.visible).toBe(false);
    expect(boxes.some((o) => o.visible)).toBe(true);
    h.exit();
  });

  it('숨어 있을 때는 아이템을 쓰지 않는다', () => {
    const g = play();
    pickUp(g, 'flare');
    g.toggleLocker(0);
    press(g, { typed: ['1'] });
    expect(g.aids.state.held.flare).toBe(1);
    g.exit();
  });
});

// 주인공에게서 길로 가까운 빈 칸 (dist 칸쯤)
function findNear(g, dist) {
  const from = cellOf(g.p);
  const area = [...reachable(g.map, from)].map((t) => t.split(',').map(Number));
  const [cx, cy] = area.find(([x, y]) => Math.abs(Math.hypot(x - from.cx, y - from.cy) - dist) < 1);
  return { cx, cy };
}
