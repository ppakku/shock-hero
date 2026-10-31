# 공포 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 쇼크 히어로에 1인칭 공포 모드(밤의 고철 공장, 파쇄자에게 쫓기며 퓨즈 3개를 찾아 탈출)를 더한다.

**Architecture:** 타이틀에서 고를 때만 Three.js 묶음을 내려받아 Phaser 를 멈추고 그 위에 3D 캔버스를 띄운다. 판단과 계산은 화면과 분리해 `src/logic/horror*.js` 에 두고 자동 테스트로 확인하며, `src/horror/` 는 그리기, 소리, 입력만 맡는다.

**Tech Stack:** Three.js 0.186.1, Web Audio, Vite 동적 import, Vitest, Playwright(시스템 Chrome)

설계 문서: `docs/superpowers/specs/2026-10-31-horror-mode-design.md`

## Global Constraints

- 잔인한 표현, 피를 넣지 않는다. 번쩍임은 `settings.lowFx` 가 켜져 있으면 끈다.
- 소리는 파일 없이 코드로 합성하고 `settings.muted` 를 따른다.
- 휴대폰에서는 공포 모드 입구를 보이지 않는다 (`isPhone()`).
- 기존 스테이지와 보스 코드는 바꾸지 않는다. 타이틀에는 입구만, 저장에는 `horror` 기록만 더한다.
- `three` 는 `src/horror/` 안에서만 import 한다. `src/logic/` 은 three 와 Phaser 를 import 하지 않는다.
- 조절할 숫자는 `src/config/balance.js` 의 `horror` 묶음에 둔다.
- 태블릿에서 초당 30장 이상을 목표로 한다.
- 화면 글자와 문서는 쉬운 한국어로 쓰고, em dash 와 가운뎃점을 쓰지 않는다.
- 코드 주석은 주변 코드처럼 짧은 한국어로 쓴다.
- 커밋 끝에 저장소의 현재 공동 작성자 표시를 붙인다. push 와 PR 은 main 을 base 로 하고, 확인이 끝나면 직접 머지한다.

## 파일 구조

| 파일 | 맡는 일 |
|---|---|
| `src/logic/horrorGrid.js` | 칸 맵 읽기, 막힘, 길 찾기, 시선 |
| `src/logic/horrorInput.js` | 이동 값 계산, 벽 충돌, 소리 크기, 해상도 조절 |
| `src/logic/horrorStalker.js` | 파쇄자 상태 변화 |
| `src/logic/horrorRun.js` | 퓨즈, 충전, 잡힘, 보상, 저장 기록 |
| `src/horror/maps/factory.js` | 공장 맵 데이터 |
| `src/horror/start.js` | 입구: WebGL 확인, 내려받기, 실패 안내 (three 를 import 하지 않음) |
| `src/horror/HorrorGame.js` | 3D 화면 전체 흐름 |
| `src/horror/world.js` | 벽, 바닥, 소품 만들기 |
| `src/horror/input.js` | 키보드, 마우스, 터치 |
| `src/horror/shredderModel.js` | 3D 파쇄자 |
| `src/horror/audio.js` | 공포 소리 |
| `src/horror/hud.js` | 글자, 버튼, 안내 화면 |
| `tools/run_horror.py` | 화면 없는 Chrome 확인 |
| `tools/make_horror_art.py` | Gemini 재질 그림 줄이기 |

## 맵 표기

칸 하나는 게임 안에서 3미터다. 위치 값은 칸 단위 소수(`{ x, y }`)이고, 3D 좌표는 `x * CELL`, `y * CELL` (y 가 Three.js 의 Z)이다.

| 글자 | 뜻 | 지나갈 수 있나 |
|---|---|---|
| `#` | 벽, 기계 | 아니오 |
| `.` | 바닥 | 예 |
| `D` | 열린 문틀 | 예 |
| `S` | 시작 지점 | 예 |
| `M` | 파쇄자 시작 지점 | 예 |
| `F` | 퓨즈 후보 | 예 |
| `R` | 순찰 지점 | 예 |
| `X` | 놀람 장면 | 예 |
| `L` | 사물함 | 아니오 |
| `E` | 전기 상자 | 아니오 |
| `P` | 정문 전원 | 아니오 |
| `G` | 정문 | 아니오 |

---

### Task 1: 칸 맵과 길 찾기

**Files:**
- Create: `src/logic/horrorGrid.js`
- Create: `src/horror/maps/factory.js`
- Test: `tests/horrorGrid.test.js`

**Interfaces:**
- Produces: `CELL`, `parseMap(rows)`, `blocked(map, cx, cy)`, `cellOf(p)`, `center(cell)`, `frontOf(map, cell)`, `findPath(map, from, to)`, `lineOfSight(map, a, b)`, `reachable(map, from)`, `factoryMap`
- `map` 모양: `{ w, h, rows, start, stalker, panel, gate, fuses, lockers, boxes, patrol, scares }`. 자리는 모두 `{ cx, cy }`.

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/horrorGrid.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseMap, blocked, cellOf, center, frontOf, findPath, lineOfSight, reachable } from '../src/logic/horrorGrid.js';
import { factoryMap } from '../src/horror/maps/factory.js';

const small = parseMap([
  '#######',
  '#S..#M#',
  '#.#.#.#',
  '#.#...#',
  '#L#####',
  '#######',
]);

describe('칸 맵', () => {
  it('글자를 자리로 읽는다', () => {
    expect(small.start).toEqual({ cx: 1, cy: 1 });
    expect(small.stalker).toEqual({ cx: 5, cy: 1 });
    expect(small.lockers).toEqual([{ cx: 1, cy: 4 }]);
  });

  it('벽, 사물함, 맵 밖은 막혀 있다', () => {
    expect(blocked(small, 0, 0)).toBe(true);
    expect(blocked(small, 1, 4)).toBe(true);
    expect(blocked(small, -1, 2)).toBe(true);
    expect(blocked(small, 2, 1)).toBe(false);
  });

  it('줄 길이가 다르면 멈춘다', () => {
    expect(() => parseMap(['###', '##'])).toThrow();
  });

  it('위치와 칸을 오간다', () => {
    expect(cellOf({ x: 2.7, y: 1.1 })).toEqual({ cx: 2, cy: 1 });
    expect(center({ cx: 2, cy: 1 })).toEqual({ x: 2.5, y: 1.5 });
  });

  it('사물함 앞 칸을 찾는다', () => {
    expect(frontOf(small, { cx: 1, cy: 4 })).toEqual({ cx: 1, cy: 3 });
  });
});

describe('길 찾기', () => {
  it('벽을 돌아서 간다', () => {
    const path = findPath(small, { cx: 1, cy: 1 }, { cx: 5, cy: 1 });
    expect(path.at(-1)).toEqual({ cx: 5, cy: 1 });
    expect(path).toHaveLength(8);
    for (const c of path) expect(blocked(small, c.cx, c.cy)).toBe(false);
  });

  it('제자리면 빈 길, 갈 수 없으면 null', () => {
    expect(findPath(small, { cx: 1, cy: 1 }, { cx: 1, cy: 1 })).toEqual([]);
    expect(findPath(small, { cx: 1, cy: 1 }, { cx: 0, cy: 0 })).toBeNull();
  });
});

describe('시선', () => {
  it('벽이 가리면 안 보인다', () => {
    expect(lineOfSight(small, { x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 })).toBe(true);
    expect(lineOfSight(small, { x: 3.5, y: 1.5 }, { x: 5.5, y: 1.5 })).toBe(false);
  });
});

describe('공장 맵', () => {
  const m = factoryMap;
  const open = reachable(m, m.start);
  const canReach = (c) => open.has(`${c.cx},${c.cy}`);
  const canUse = (c) => canReach(frontOf(m, c));

  it('필요한 것이 다 있다', () => {
    expect(m.fuses.length).toBeGreaterThanOrEqual(3);
    expect(m.lockers.length).toBeGreaterThan(0);
    expect(m.boxes.length).toBeGreaterThan(0);
    expect(m.patrol.length).toBeGreaterThan(0);
    expect(m.scares.length).toBeGreaterThan(0);
    expect(m.panel).not.toBeNull();
    expect(m.gate).not.toBeNull();
  });

  it('모든 목표에 걸어갈 수 있다', () => {
    for (const c of [...m.fuses, ...m.patrol, ...m.scares, m.stalker]) expect(canReach(c)).toBe(true);
    for (const c of [...m.lockers, ...m.boxes, m.panel, m.gate]) expect(canUse(c)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/horrorGrid.test.js`
Expected: FAIL, `horrorGrid.js` 를 찾을 수 없음

- [ ] **Step 3: 맵 계산 쓰기**

`src/logic/horrorGrid.js`:

```js
// 공포 모드 칸 맵 계산 (화면과 상관없는 부분). 위치는 칸 단위 소수, 칸은 { cx, cy }.

export const CELL = 3; // 칸 하나의 3D 크기 (미터)

const SOLID = new Set(['#', 'L', 'E', 'P', 'G']);
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function parseMap(rows) {
  const w = rows[0].length;
  const map = { w, h: rows.length, rows, start: null, stalker: null, panel: null, gate: null, fuses: [], lockers: [], boxes: [], patrol: [], scares: [] };
  const lists = { F: map.fuses, L: map.lockers, E: map.boxes, R: map.patrol, X: map.scares };
  const ones = { S: 'start', M: 'stalker', P: 'panel', G: 'gate' };
  rows.forEach((row, cy) => {
    if (row.length !== w) throw new Error(`맵 ${cy}번 줄 길이가 다릅니다`);
    [...row].forEach((ch, cx) => {
      if (lists[ch]) lists[ch].push({ cx, cy });
      if (ones[ch]) map[ones[ch]] = { cx, cy };
    });
  });
  return map;
}

export function blocked(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return true;
  return SOLID.has(map.rows[cy][cx]);
}

export const cellOf = (p) => ({ cx: Math.floor(p.x), cy: Math.floor(p.y) });
export const center = (c) => ({ x: c.cx + 0.5, y: c.cy + 0.5 });

// 막힌 칸(사물함 등)이면 그 앞의 빈 칸, 아니면 그 칸
export function frontOf(map, cell) {
  if (!blocked(map, cell.cx, cell.cy)) return cell;
  for (const [dx, dy] of STEPS) {
    if (!blocked(map, cell.cx + dx, cell.cy + dy)) return { cx: cell.cx + dx, cy: cell.cy + dy };
  }
  return cell;
}

// 상하좌우 너비 우선 탐색. 출발 칸은 빼고 도착 칸까지의 칸들. 같은 칸이면 [], 길이 없으면 null
export function findPath(map, from, to) {
  if (from.cx === to.cx && from.cy === to.cy) return [];
  if (blocked(map, to.cx, to.cy)) return null;
  const key = (x, y) => y * map.w + x;
  const prev = new Map([[key(from.cx, from.cy), null]]);
  const queue = [[from.cx, from.cy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === to.cx && y === to.cy) {
      const path = [];
      for (let k = key(x, y); prev.get(k) !== null; k = prev.get(k)) path.unshift({ cx: k % map.w, cy: Math.floor(k / map.w) });
      return path;
    }
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (blocked(map, nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// 두 위치 사이에 막힌 칸이 없는지 (0.1 칸씩 걸어 본다)
export function lineOfSight(map, a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / 0.1));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocked(map, Math.floor(a.x + (b.x - a.x) * t), Math.floor(a.y + (b.y - a.y) * t))) return false;
  }
  return true;
}

// from 에서 걸어갈 수 있는 칸들 ("x,y" 글자 묶음)
export function reachable(map, from) {
  const seen = new Set([`${from.cx},${from.cy}`]);
  const queue = [[from.cx, from.cy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of STEPS) {
      const k = `${x + dx},${y + dy}`;
      if (blocked(map, x + dx, y + dy) || seen.has(k)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}
```

- [ ] **Step 4: 공장 맵 쓰기**

`src/horror/maps/factory.js`:

```js
import { parseMap } from '../../logic/horrorGrid.js';

// 밤의 고철 공장. 글자 뜻은 docs/superpowers/plans/2026-10-31-horror-mode.md 의 맵 표기 참고.
export const factoryMap = parseMap([
  '############################',
  '#L.....#....F.#......#...F.#',
  '#....F.#......#....F.#.....#',
  '#..R...D..##..D..R...#..M..#',
  '#......#......#....X.D..R..#',
  '#.....E#L.R..E#L.....#....L#',
  '###D#############D######D###',
  '#......#L.....#L.....#....L#',
  '#.FR...#..R...D.R...F#.R...#',
  '#...#..D......#..##..D..#..#',
  '#......#..X.F.D..#...#.....#',
  '#L....E#......#.....E#F....#',
  '####D#####D#############D###',
  '#.....L#......#L.....#.X...#',
  '#......#....R.#...#..D.....#',
  '#..R...D..##..D...#..#..R..#',
  '#.S....#......#.XR..F#....P#',
  '#E.....#L....F#......#L....G',
  '############################',
]);
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/horrorGrid.test.js`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/logic/horrorGrid.js src/horror/maps/factory.js tests/horrorGrid.test.js
git commit -m "Horror mode grid, path finding and factory map"
```

---

### Task 2: 이동, 벽 충돌, 소리 크기, 해상도 조절

**Files:**
- Create: `src/logic/horrorInput.js`
- Modify: `src/config/balance.js` (마지막 `effects` 묶음 앞에 `horror` 묶음 추가)
- Test: `tests/horrorInput.test.js`

**Interfaces:**
- Consumes: `blocked(map, cx, cy)`
- Produces: `moveFromKeys(keys)`, `moveFromStick(dx, dy, max, runAt)`, `stepPlayer(p, move, yaw, speed, dt, map, radius)`, `noiseFor(moving, running, k)`, `nextPixelRatio(ratio, fps, k)`
- `move` 모양: `{ x, z, run }`. `x` 는 오른쪽, `z` 는 앞쪽, 각각 -1 ~ 1.
- `cfg.horror` 숫자 묶음

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/horrorInput.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { moveFromKeys, moveFromStick, stepPlayer, noiseFor, nextPixelRatio } from '../src/logic/horrorInput.js';
import { parseMap } from '../src/logic/horrorGrid.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const room = parseMap(['#####', '#...#', '#...#', '#####']);

describe('이동 값', () => {
  it('대각선도 빨라지지 않는다', () => {
    const m = moveFromKeys({ up: true, right: true });
    expect(Math.hypot(m.x, m.z)).toBeCloseTo(1);
  });

  it('달리기 키를 읽는다', () => {
    expect(moveFromKeys({ up: true, run: true }).run).toBe(true);
    expect(moveFromKeys({}).run).toBe(false);
  });

  it('조이스틱을 끝까지 밀면 달린다', () => {
    expect(moveFromStick(0, -60, 60, 0.92)).toEqual({ x: 0, z: 1, run: true });
    expect(moveFromStick(0, -30, 60, 0.92).run).toBe(false);
  });
});

describe('벽 충돌', () => {
  it('앞으로 걷는다 (yaw 0 은 y 가 줄어드는 쪽)', () => {
    const p = stepPlayer({ x: 2.5, y: 2.5 }, { x: 0, z: 1 }, 0, 1, 0.5, room, 0.2);
    expect(p.y).toBeCloseTo(2);
    expect(p.x).toBeCloseTo(2.5);
  });

  it('벽을 지나가지 못한다', () => {
    let p = { x: 2.5, y: 1.5 };
    for (let i = 0; i < 60; i++) p = stepPlayer(p, { x: 0, z: 1 }, 0, 2, 0.05, room, 0.2);
    expect(p.y).toBeGreaterThanOrEqual(1.2);
  });

  it('벽을 따라 미끄러진다', () => {
    const p = stepPlayer({ x: 2.5, y: 1.25 }, { x: 0.7, z: 0.7 }, 0, 1, 0.5, room, 0.2);
    expect(p.x).toBeGreaterThan(2.5);
    expect(p.y).toBeCloseTo(1.25);
  });
});

describe('소리 크기', () => {
  it('멈추면 0, 달리면 걸을 때보다 크다', () => {
    expect(noiseFor(false, false, k)).toBe(0);
    expect(noiseFor(true, true, k)).toBeGreaterThan(noiseFor(true, false, k));
  });
});

describe('해상도 조절', () => {
  it('느리면 낮추고 충분히 빠르면 높인다', () => {
    expect(nextPixelRatio(1.5, 20, k)).toBeCloseTo(1.5 - k.ratioStep);
    expect(nextPixelRatio(1, 58, k)).toBeCloseTo(1 + k.ratioStep);
    expect(nextPixelRatio(1, 40, k)).toBe(1);
  });

  it('범위를 넘지 않는다', () => {
    expect(nextPixelRatio(k.minRatio, 5, k)).toBe(k.minRatio);
    expect(nextPixelRatio(k.maxRatio, 60, k)).toBe(k.maxRatio);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/horrorInput.test.js`
Expected: FAIL, `horrorInput.js` 를 찾을 수 없음

- [ ] **Step 3: 숫자 묶음 추가**

`src/config/balance.js` 의 `// ---------- 효과 ----------` 줄 바로 앞에 넣는다:

```js
  // ---------- 공포 모드 (거리와 속도는 칸 단위, 칸 하나는 3미터) ----------
  horror: {
    walkSpeed: 1.3, // 걷는 속도 (1초에 몇 칸)
    runSpeed: 2.3, // 달리는 속도. 파쇄자 추격 속도보다 빨라야 도망칠 수 있다
    lookSpeed: 0.0025, // 마우스 시점 속도
    touchLookSpeed: 0.005, // 화면 끌기 시점 속도
    walkNoise: 3, // 걸을 때 소리가 들리는 거리
    runNoise: 9, // 달릴 때 소리가 들리는 거리
    stalkerWalk: 0.9, // 파쇄자 순찰, 조사 속도
    stalkerChase: 2.0, // 파쇄자 추격 속도
    seeDark: 3, // 손전등을 껐을 때 파쇄자가 보는 거리
    seeLight: 8, // 손전등을 켰을 때 파쇄자가 보는 거리
    noticeLight: 10, // 손전등 빛을 알아채고 조사하러 오는 거리
    fov: 120, // 파쇄자 시야각 (도)
    loseTime: 2.5, // 이만큼 못 보면 놓치고 수색을 시작한다
    searchTime: 14, // 수색하는 시간
    searchRadius: 5, // 수색할 때 뒤지는 사물함 거리
    lockerCheckChance: 0.5, // 수색 범위 안의 사물함을 뒤질 확률
    repathTime: 0.4, // 추격할 때 길을 다시 찾는 간격
    catchDist: 0.7, // 이만큼 가까우면 잡힌다
    stunTime: 5, // 쇼크 펀치로 멈추는 시간
    shockRange: 2.5, // 쇼크 펀치가 닿는 거리
    useRange: 1.2, // 줍기, 숨기 등이 닿는 거리
    fuseCount: 3, // 찾아야 하는 퓨즈 수
    gemsEscape: 5, // 탈출 보석
    gemsClean: 5, // 한 번도 안 잡히고 탈출한 추가 보석
    viewCells: 14, // 이보다 먼 구역은 그리지 않는다 (어둠에 묻혀 안 보임)
    minRatio: 0.6, // 가장 낮은 화면 해상도 배율
    maxRatio: 1.5, // 가장 높은 화면 해상도 배율
    ratioStep: 0.1, // 한 번에 바꾸는 배율
    lowFps: 28, // 초당 장수가 이보다 낮으면 해상도를 낮춘다
    highFps: 55, // 초당 장수가 이보다 높으면 해상도를 높인다
  },

```

- [ ] **Step 4: 계산 쓰기**

`src/logic/horrorInput.js`:

```js
// 공포 모드 움직임 계산 (화면과 상관없는 부분)
import { blocked } from './horrorGrid.js';

// keys: { up, down, left, right, run }
export function moveFromKeys(keys) {
  let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let z = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z, run: Boolean(keys.run) };
}

// 조이스틱: dx, dy 는 가운데서 손가락까지 거리. 화면 위쪽이 앞이다.
export function moveFromStick(dx, dy, max, runAt) {
  const len = Math.hypot(dx, dy);
  const s = len > max ? max / len : 1;
  const x = (dx * s) / max;
  const z = -(dy * s) / max || 0;
  return { x: x || 0, z, run: Math.min(1, len / max) >= runAt };
}

function hits(map, x, y, r) {
  return [[-r, -r], [r, -r], [-r, r], [r, r]].some(([ox, oy]) => blocked(map, Math.floor(x + ox), Math.floor(y + oy)));
}

// yaw 0 은 y 가 줄어드는 쪽을 본다. 가로세로를 따로 움직여 벽을 따라 미끄러지게 한다.
export function stepPlayer(p, move, yaw, speed, dt, map, radius) {
  const fx = -Math.sin(yaw);
  const fy = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const ry = -Math.sin(yaw);
  const dx = (rx * move.x + fx * move.z) * speed * dt;
  const dy = (ry * move.x + fy * move.z) * speed * dt;
  const x = hits(map, p.x + dx, p.y, radius) ? p.x : p.x + dx;
  const y = hits(map, x, p.y + dy, radius) ? p.y : p.y + dy;
  return { x, y };
}

export function noiseFor(moving, running, k) {
  if (!moving) return 0;
  return running ? k.runNoise : k.walkNoise;
}

// 느린 기기는 해상도를 낮추고, 여유가 있으면 다시 높인다
export function nextPixelRatio(ratio, fps, k) {
  if (fps < k.lowFps) return Math.max(k.minRatio, ratio - k.ratioStep);
  if (fps > k.highFps) return Math.min(k.maxRatio, ratio + k.ratioStep);
  return ratio;
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/horrorInput.test.js`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/logic/horrorInput.js src/config/balance.js tests/horrorInput.test.js
git commit -m "Horror mode movement, collision and resolution rules"
```

---

### Task 3: 3D 화면과 타이틀 입구 (회색 맵 걷기)

손전등을 켜고 회색 맵을 걸을 수 있게 한다. 여기까지 머지하면 태블릿 속도를 볼 수 있다.

**Files:**
- Modify: `package.json` (`three` 추가)
- Create: `src/horror/start.js`, `src/horror/HorrorGame.js`, `src/horror/world.js`, `src/horror/input.js`
- Modify: `src/scenes/TitleScene.js` (입구)
- Create: `tools/run_horror.py`
- Test: `tests/horrorStart.test.js`

**Interfaces:**
- Consumes: `factoryMap`, `CELL`, `moveFromKeys`, `moveFromStick`, `stepPlayer`, `nextPixelRatio`, `cfg.horror`
- Produces:
  - `canUseWebGL(doc)`, `startHorror(game, { onExit })`
  - `class HorrorGame`: `constructor(root, { touch, lowFx, muted, onExit })`, `start()`, `update(dt)`, `readInput()`, `exit()`, 값 `p`(`{ x, y }`), `yaw`, `pitch`, `lightOn`, `fps`
  - `buildWorld(scene, map)` 는 `{ update(p, viewCells), props }` 를 돌려준다. `props` 는 `{ lockers: [Mesh], boxes: [Mesh], panel: Mesh, gate: Mesh }`
  - `class HorrorInput`: `constructor(el, { touch, k })`, `read()`, `destroy()`. `read()` 는 `{ move, lookX, lookY, light, use, punch, pause }`
  - 브라우저 확인용 `window.__horror` (HorrorGame 객체)

- [ ] **Step 1: three 설치**

Run: `npm install three@0.186.1 --save-exact`
Expected: `package.json` 의 dependencies 에 `"three": "0.186.1"`

- [ ] **Step 2: 실패하는 테스트 쓰기**

`tests/horrorStart.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { canUseWebGL } from '../src/horror/start.js';

const docWith = (ctx) => ({ createElement: () => ({ getContext: () => ctx }) });

describe('WebGL 확인', () => {
  it('켜지면 true', () => {
    expect(canUseWebGL(docWith({}))).toBe(true);
  });

  it('없으면 false', () => {
    expect(canUseWebGL(docWith(null))).toBe(false);
  });

  it('오류가 나도 false', () => {
    const doc = { createElement: () => { throw new Error('막힘'); } };
    expect(canUseWebGL(doc)).toBe(false);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/horrorStart.test.js`
Expected: FAIL, `start.js` 를 찾을 수 없음

- [ ] **Step 4: 입구 쓰기**

`src/horror/start.js`:

```js
// 공포 모드 입구. 3D 묶음은 고를 때만 내려받는다 (이 파일은 three 를 import 하지 않는다).
import { isTouchDevice } from '../ui/touch.js';
import { saveStore } from '../save.js';

export function canUseWebGL(doc = globalThis.document) {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function makeRoot() {
  const root = document.createElement('div');
  root.id = 'horror';
  root.style.cssText = 'position:fixed;inset:0;z-index:50;background:#000;color:#ddd;font:18px sans-serif;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none';
  root.textContent = '불러오는 중...';
  document.body.appendChild(root);
  return root;
}

function fail(root, text, onExit) {
  root.textContent = text;
  setTimeout(() => {
    root.remove();
    onExit();
  }, 2500);
}

// onExit: 공포 모드가 끝나고 타이틀로 돌아갈 때 부른다
export async function startHorror(game, { onExit }) {
  const root = makeRoot();
  if (!canUseWebGL()) return fail(root, '이 기기에서는 공포 모드를 켤 수 없어요.', onExit);
  let HorrorGame;
  try {
    ({ HorrorGame } = await import('./HorrorGame.js'));
  } catch {
    return fail(root, '공포 모드를 불러오지 못했어요. 인터넷을 확인해 주세요.', onExit);
  }
  root.textContent = '';
  game.pause();
  const { settings } = saveStore.load();
  const horror = new HorrorGame(root, {
    touch: isTouchDevice(),
    lowFx: settings.lowFx,
    muted: settings.muted,
    onExit: () => {
      root.remove();
      game.resume();
      onExit();
    },
  });
  horror.start();
}
```

- [ ] **Step 5: 입력 쓰기**

`src/horror/input.js`:

```js
// 공포 모드 입력. 키보드와 마우스, 터치를 같은 모양으로 읽는다.
import { moveFromKeys, moveFromStick } from '../logic/horrorInput.js';

const STICK_MAX = 70; // 조이스틱 반지름 (px)
const RUN_AT = 0.92; // 이만큼 밀면 달린다
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
const PRESS = { KeyF: 'light', KeyE: 'use', Escape: 'pause' };
const BUTTONS = [
  { id: 'light', label: '손전등', right: 150, bottom: 110 },
  { id: 'use', label: '사용', right: 40, bottom: 150 },
  { id: 'punch', label: '펀치', right: 40, bottom: 40 },
  { id: 'pause', label: '멈춤', right: 40, bottom: 262 },
];

export class HorrorInput {
  constructor(el, { touch, k }) {
    this.el = el;
    this.touch = touch;
    this.k = k;
    this.keys = {};
    this.look = { x: 0, y: 0 };
    this.pressed = {};
    this.stick = null;
    this.lookTouch = null;
    this.off = [];
    this.buttons = [];
    if (touch) this.bindTouch();
    else this.bindMouse();
    this.bindKeys();
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.off.push(() => target.removeEventListener(type, fn, opts));
  }

  bindKeys() {
    this.on(window, 'keydown', (e) => {
      if (KEYS[e.code]) this.keys[KEYS[e.code]] = true;
      if (PRESS[e.code] && !e.repeat) this.pressed[PRESS[e.code]] = true;
    });
    this.on(window, 'keyup', (e) => {
      if (KEYS[e.code]) this.keys[KEYS[e.code]] = false;
    });
  }

  bindMouse() {
    this.on(this.el, 'mousedown', () => {
      if (document.pointerLockElement === this.el) this.pressed.punch = true;
      else this.el.requestPointerLock?.();
    });
    this.on(document, 'mousemove', (e) => {
      if (document.pointerLockElement !== this.el) return;
      this.look.x += e.movementX * this.k.lookSpeed;
      this.look.y += e.movementY * this.k.lookSpeed;
    });
    this.on(document, 'pointerlockchange', () => {
      if (document.pointerLockElement !== this.el) this.pressed.pause = true; // Esc 로 마우스가 풀리면 일시정지
    });
  }

  bindTouch() {
    this.on(this.el, 'pointerdown', (e) => {
      if (e.clientX < window.innerWidth / 2) {
        if (!this.stick) this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      } else if (!this.lookTouch) this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    this.on(this.el, 'pointermove', (e) => {
      if (this.stick?.id === e.pointerId) Object.assign(this.stick, { x: e.clientX, y: e.clientY });
      if (this.lookTouch?.id === e.pointerId) {
        this.look.x += (e.clientX - this.lookTouch.x) * this.k.touchLookSpeed;
        this.look.y += (e.clientY - this.lookTouch.y) * this.k.touchLookSpeed;
        Object.assign(this.lookTouch, { x: e.clientX, y: e.clientY });
      }
    });
    const up = (e) => {
      if (this.stick?.id === e.pointerId) this.stick = null;
      if (this.lookTouch?.id === e.pointerId) this.lookTouch = null;
    };
    this.on(this.el, 'pointerup', up);
    this.on(this.el, 'pointercancel', up);
    for (const b of BUTTONS) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.style.cssText = `position:absolute;right:${b.right}px;bottom:${b.bottom}px;width:92px;height:92px;border-radius:50%;border:2px solid #777;background:rgba(40,40,40,.55);color:#eee;font:16px sans-serif;z-index:3;touch-action:none`;
      this.on(btn, 'pointerdown', (e) => {
        e.stopPropagation();
        this.pressed[b.id] = true;
      });
      this.el.appendChild(btn);
      this.buttons.push(btn);
    }
  }

  read() {
    const s = this.stick;
    const out = {
      move: s ? moveFromStick(s.x - s.x0, s.y - s.y0, STICK_MAX, RUN_AT) : moveFromKeys(this.keys),
      lookX: this.look.x,
      lookY: this.look.y,
      light: Boolean(this.pressed.light),
      use: Boolean(this.pressed.use),
      punch: Boolean(this.pressed.punch),
      pause: Boolean(this.pressed.pause),
    };
    this.look = { x: 0, y: 0 };
    this.pressed = {};
    return out;
  }

  destroy() {
    this.off.forEach((f) => f());
    this.buttons.forEach((b) => b.remove());
    if (document.pointerLockElement === this.el) document.exitPointerLock?.();
  }
}
```

- [ ] **Step 6: 세상 만들기 쓰기**

`src/horror/world.js`:

```js
// 공장 건물 3D. 7칸 묶음(구역)으로 나눠서 먼 구역은 통째로 그리지 않는다.
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';

const CHUNK = 7; // 구역 한 변의 칸 수
const WALL_H = 3;
const LOCKER = { w: 1.3, h: 2.2, d: 1.1 };

function prop(group, cell, w, h, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  mesh.position.set((cell.cx + 0.5) * CELL, h / 2, (cell.cy + 0.5) * CELL);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

export function buildWorld(scene, map, mats = {}) {
  const wallMat = mats.wall || new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.9 });
  const floorMat = mats.floor || new THREE.MeshStandardMaterial({ color: 0x35312d, roughness: 1 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 1 });
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const chunks = new Map();
  const chunkOf = (cx, cy) => {
    const key = `${Math.floor(cx / CHUNK)},${Math.floor(cy / CHUNK)}`;
    if (!chunks.has(key)) {
      const group = new THREE.Group();
      group.userData.center = { x: Math.floor(cx / CHUNK) * CHUNK + CHUNK / 2, y: Math.floor(cy / CHUNK) * CHUNK + CHUNK / 2 };
      group.userData.walls = [];
      scene.add(group);
      chunks.set(key, group);
    }
    return chunks.get(key);
  };

  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      const c = chunkOf(cx, cy);
      if (map.rows[cy][cx] === '#') c.userData.walls.push([cx, cy]);
    }
  }

  const matrix = new THREE.Matrix4();
  for (const group of chunks.values()) {
    const walls = group.userData.walls;
    if (walls.length) {
      const mesh = new THREE.InstancedMesh(wallGeo, wallMat, walls.length);
      walls.forEach(([cx, cy], i) => mesh.setMatrixAt(i, matrix.makeTranslation((cx + 0.5) * CELL, WALL_H / 2, (cy + 0.5) * CELL)));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    const size = CHUNK * CELL;
    const { x, y } = group.userData.center;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x * CELL, 0, y * CELL);
    floor.receiveShadow = true;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(x * CELL, WALL_H, y * CELL);
    group.add(floor, ceil);
  }

  const props = new THREE.Group();
  scene.add(props);
  const lockerMat = mats.locker ? { map: mats.locker } : null;
  const parts = {
    lockers: map.lockers.map((c) => {
      const m = prop(props, c, LOCKER.w, LOCKER.h, LOCKER.d, 0x4a5a58);
      if (lockerMat) m.material = new THREE.MeshStandardMaterial({ ...lockerMat, roughness: 0.8 });
      return m;
    }),
    boxes: map.boxes.map((c) => prop(props, c, 0.9, 1.5, 0.5, 0x3a4a6a)),
    panel: prop(props, map.panel, 1.2, 1.7, 0.6, 0x6a3a2a),
    gate: prop(props, map.gate, CELL, WALL_H, CELL, 0x7a6a30),
  };

  return {
    props: parts,
    update(p, viewCells) {
      for (const group of chunks.values()) {
        const c = group.userData.center;
        group.visible = Math.hypot(c.x - p.x, c.y - p.y) < viewCells + CHUNK;
      }
    },
  };
}
```

- [ ] **Step 7: 게임 뼈대 쓰기**

`src/horror/HorrorGame.js`:

```js
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
```

- [ ] **Step 8: 타이틀 입구 쓰기**

`src/scenes/TitleScene.js` 위쪽 import 에 더한다 (`isPhone` 이 없으면 `../ui/touch.js` 에서 함께 가져온다):

```js
import { startHorror } from '../horror/start.js';
```

`create()` 의 키 설정에 더한다 (`keydown-T` 줄 아래):

```js
    kb.on('keydown-H', () => this.ready && !this.confirming && this.openHorror());
```

`build()` 의 오늘의 도전 버튼 코드 바로 뒤에 더한다:

```js
    // 공포 모드 (보스 러시 위, 검은 철판). 휴대폰에서는 작은 화면에서 안 보여서 뺀다
    if (!isPhone()) {
      this.horrorBtn = this.add.container(width / 2 - 330, 228).setDepth(15).setAngle(-1.5);
      const plate = this.add.graphics();
      plate.fillStyle(0x000000, 0.45).fillRoundedRect(-82, -22, 168, 50, 8);
      plate.fillStyle(0x10161c, 1).fillRoundedRect(-88, -27, 176, 54, 10);
      plate.fillStyle(0x1a0d0d, 1).fillRoundedRect(-84, -23, 168, 46, 7);
      const horrorLabel = brushText(this, 0, -7, '공포 모드', 20, '#ff5a4a', { strokeThickness: 5 }).setOrigin(0.5);
      const horrorInfo = makeText(this, 0, 13, '꽤 무서워요', 13, '#ffffff').setOrigin(0.5);
      this.horrorBtn.add([plate, horrorLabel, horrorInfo]);
      this.horrorBtn.setSize(176, 54).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.confirming) return;
        this.openHorror();
      });
    }
```

`openMap()` 바로 앞에 더한다:

```js
  // 공포 모드는 타이틀을 멈추고 그 위에 3D 화면을 띄운다 (src/horror/start.js)
  openHorror() {
    if (this.started || !this.ready || isPhone()) return;
    this.started = true;
    this.input.keyboard.enabled = false; // 공포 모드에서 누른 키가 돌아왔을 때 타이틀에서 눌리지 않게
    sfx.unlock();
    sfx.muted = this.save.settings.muted;
    startHorror(this.game, {
      onExit: () => {
        this.started = false;
        this.build();
        this.time.delayedCall(200, () => {
          this.input.keyboard.enabled = true;
        });
      },
    });
  }
```

- [ ] **Step 9: 화면 확인 도구 쓰기**

`tools/run_horror.py`:

```python
# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤 python3 tools/run_horror.py 출력폴더 [이름]
# 시스템 Chrome 으로 타이틀에서 공포 모드를 켜고 몇 초 걸은 뒤 화면을 찍는다.
import os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
os.makedirs(OUT, exist_ok=True)


def open_horror(pg):
    pg.goto('http://localhost:5288/?timer&fps')
    time.sleep(3)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)


def walk_script(forward_seconds):
    return f"""() => {{
      const g = window.__horror, end = performance.now() + {forward_seconds * 1000};
      g.readInput = () => ({{ move: {{ x: 0, z: performance.now() < end ? 1 : 0, run: false }}, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false }});
    }}"""


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    open_horror(pg)
    print('start', pg.evaluate('({ p: window.__horror.p, fps: window.__horror.fps })'))
    pg.screenshot(path=f'{OUT}/light_on.png')
    pg.evaluate(walk_script(3))
    time.sleep(3.5)
    print('walked', pg.evaluate('window.__horror.p'))
    pg.evaluate('window.__horror.lightOn = false')
    time.sleep(0.5)
    pg.screenshot(path=f'{OUT}/light_off.png')
    pg.evaluate('window.__horror.exit()')
    time.sleep(1.5)
    print('title back', pg.evaluate("window.__shockGame.scene.isActive('Title')"), 'errors', errs)
    b.close()
```

- [ ] **Step 10: 테스트, 빌드, 묶음 분리 확인**

Run: `npx vitest run && npx vite build 2>&1 | tail -8`
Expected: 모든 테스트 통과. `HorrorGame` 이 들어간 묶음이 첫 `index` 묶음과 따로 나온다.

Run: `grep -l "WebGLRenderer" dist/assets/*.js | head; grep -c "WebGLRenderer" dist/assets/index-*.js`
Expected: three 는 `index-*` 가 아닌 묶음에 있다. 두 번째 명령 값이 0 이다. 0 이 아니면 `src/horror/start.js` 나 타이틀이 three 를 직접 import 하는지 찾아 고친다.

- [ ] **Step 11: 실제 화면 확인**

Run: `npx vite --port 5288 --strictPort` 를 다른 프로세스로 켠 뒤 `python3 tools/run_horror.py /tmp/horror-shots`
Expected: `walked` 위치가 시작 위치와 다르고, `title back True`, `errors []`. `light_on.png` 는 손전등에 벽이 보이고 `light_off.png` 는 거의 까맣다. 그림을 직접 열어 확인한다. 타이틀 화면도 찍어서 공포 모드 버튼이 다른 버튼이나 로고와 겹치지 않는지 본다. 겹치면 `horrorBtn` 의 y 값을 옮긴다.

- [ ] **Step 12: 커밋하고 태블릿 확인 받기**

```bash
git add package.json package-lock.json src/horror src/scenes/TitleScene.js tools/run_horror.py tests/horrorStart.test.js
git commit -m "Horror mode gray box: 3D walking with flashlight from the title"
```

PR 을 머지한 뒤 배포가 끝나면 사용자에게 주소 끝에 `?fps` 를 붙여 태블릿에서 공포 모드를 켜고, 왼쪽 위 숫자를 알려 달라고 요청한다. **초당 30장이 안 나오면 다음 Task 로 가지 않는다.** 그림자 크기를 256 으로 줄이고 `maxRatio` 를 1 로 낮춰 다시 확인한다.

---

### Task 4: 파쇄자 행동

**Files:**
- Create: `src/logic/horrorStalker.js`
- Test: `tests/horrorStalker.test.js`

**Interfaces:**
- Consumes: `findPath`, `lineOfSight`, `frontOf`, `cellOf`, `center`, `cfg.horror`
- Produces: `createStalker(map)`, `seesPlayer(s, player, map, k)`, `tickStalker(s, world, k, dt, rand)`, `stunStalker(s, k)`, `sendAway(s, map, player)`, `heartInterval(dist)`
- `world` 모양: `{ map, player }`. `player` 모양: `{ x, y, hidden, lightOn, noise }`. `hidden` 은 숨은 사물함 번호 또는 `null`.
- `s.mode` 는 `'patrol' | 'investigate' | 'chase' | 'search' | 'stunned'`
- `tickStalker` 는 사건 글자 배열을 돌려준다: `'notice'`, `'chase'`, `'lost'`, `'locker'`, `'found'`, `'caught'`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/horrorStalker.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createStalker, seesPlayer, tickStalker, stunStalker, sendAway, heartInterval } from '../src/logic/horrorStalker.js';
import { parseMap, blocked } from '../src/logic/horrorGrid.js';
import { factoryMap } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const hall = parseMap([
  '##############',
  '#M..........R#',
  '#.##########.#',
  '#L..........R#',
  '##############',
]);
const player = (o) => ({ x: 8.5, y: 1.5, hidden: null, lightOn: false, noise: 0, ...o });
const run = (s, world, seconds, rand = () => 0.5) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...tickStalker(s, world, k, 0.05, rand));
  return events;
};
const facing = (o) => ({ ...createStalker(hall), heading: Math.PI / 2, ...o }); // x 가 커지는 쪽을 본다

describe('보기', () => {
  it('어두우면 가까이서만 본다', () => {
    const s = facing({ x: 1.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 3.5 }), hall, k)).toBe(true);
    expect(seesPlayer(s, player({ x: 8.5 }), hall, k)).toBe(false);
  });

  it('손전등을 켜면 멀리서 보인다', () => {
    const s = facing({ x: 1.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 8.5, lightOn: true }), hall, k)).toBe(true);
  });

  it('뒤쪽, 벽 너머, 사물함 안은 못 본다', () => {
    const s = facing({ x: 5.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 3.5 }), hall, k)).toBe(false);
    expect(seesPlayer(s, player({ x: 5.5, y: 3.5 }), hall, k)).toBe(false);
    expect(seesPlayer(s, player({ x: 6.5, hidden: 0 }), hall, k)).toBe(false);
  });
});

describe('상태 변화', () => {
  it('아무 일이 없으면 순찰 지점을 돈다', () => {
    const s = createStalker(hall);
    const x0 = s.x;
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5 }) }, 3);
    expect(s.mode).toBe('patrol');
    expect(Math.hypot(s.x - x0, s.y - 1.5)).toBeGreaterThan(1);
  });

  it('소리를 들으면 조사하러 간다', () => {
    const s = facing({ x: 6.5, y: 1.5 }); // 돌아봐도 안 보일 만큼 멀리 있어야 조사에 머문다
    const events = run(s, { map: hall, player: player({ x: 1.5, y: 1.5, noise: 6 }) }, 0.1);
    expect(events).toContain('notice');
    expect(s.mode).toBe('investigate');
  });

  it('보면 쫓고 잡는다', () => {
    const s = facing({ x: 6.5, y: 1.5 });
    const events = run(s, { map: hall, player: player() }, 4);
    expect(events).toContain('chase');
    expect(events).toContain('caught');
  });

  it('놓치면 수색을 하고, 시간이 지나면 순찰로 돌아간다', () => {
    const s = facing({ x: 6.5, y: 1.5 });
    const world = { map: hall, player: player({ x: 8.5 }) };
    run(s, world, 0.1);
    world.player = player({ x: 3.5, y: 3.5, hidden: null });
    const events = run(s, world, k.loseTime + 0.3);
    expect(events).toContain('lost');
    expect(s.mode).toBe('search');
    run(s, world, k.searchTime + 1);
    expect(s.mode).toBe('patrol');
  });

  it('수색 중 숨은 사물함을 뒤지면 들킨다', () => {
    const s = facing({ x: 2.5, y: 3.5, mode: 'chase', lastSeen: { cx: 2, cy: 3 } });
    const world = { map: hall, player: player({ x: 1.5, y: 3.5, hidden: 0 }) };
    const events = run(s, world, k.loseTime + 3, () => 0.1);
    expect(events).toContain('locker');
    expect(events).toContain('found');
  });

  it('사물함을 뒤지지 않으면 들키지 않는다', () => {
    const s = facing({ x: 2.5, y: 3.5, mode: 'chase', lastSeen: { cx: 2, cy: 3 } });
    const world = { map: hall, player: player({ x: 1.5, y: 3.5, hidden: 0 }) };
    expect(run(s, world, k.loseTime + 3, () => 0.9)).not.toContain('found');
  });

  it('쇼크 펀치를 맞으면 멈췄다가 수색한다', () => {
    const s = facing({ x: 6.5, y: 1.5, mode: 'chase' });
    stunStalker(s, k);
    const x = s.x;
    run(s, { map: hall, player: player({ x: 7.2 }) }, k.stunTime - 0.2);
    expect(s.mode).toBe('stunned');
    expect(s.x).toBe(x);
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5 }) }, 0.5);
    expect(s.mode).toBe('search');
  });

  it('맵 위에서 오래 돌아도 벽 안으로 들어가지 않는다', () => {
    const s = createStalker(factoryMap);
    let n = 0;
    const rand = () => {
      n = (n * 9301 + 49297) % 233280;
      return n / 233280;
    };
    const world = { map: factoryMap, player: { x: 2.5, y: 16.5, hidden: null, lightOn: true, noise: 9 } };
    for (let t = 0; t < 300; t += 0.05) {
      tickStalker(s, world, k, 0.05, rand);
      expect(blocked(factoryMap, Math.floor(s.x), Math.floor(s.y))).toBe(false);
      world.player.x = 2.5 + (t % 3);
    }
  });
});

describe('잡힌 뒤', () => {
  it('주인공에게서 가장 먼 순찰 지점으로 옮긴다', () => {
    const s = createStalker(factoryMap);
    s.mode = 'chase';
    sendAway(s, factoryMap, { x: 2.5, y: 16.5 });
    expect(s.mode).toBe('patrol');
    expect(Math.hypot(s.x - 2.5, s.y - 16.5)).toBeGreaterThan(15);
  });
});

describe('심장 소리', () => {
  it('가까울수록 빨라진다', () => {
    expect(heartInterval(1)).toBeLessThan(heartInterval(10));
    expect(heartInterval(100)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/horrorStalker.test.js`
Expected: FAIL, `horrorStalker.js` 를 찾을 수 없음

- [ ] **Step 3: 행동 쓰기**

`src/logic/horrorStalker.js`:

```js
// 파쇄자 행동 (화면과 상관없는 부분). 순찰, 조사, 추격, 수색, 멈춤 다섯 상태로 움직인다.
import { cellOf, center, findPath, frontOf, lineOfSight, blocked } from './horrorGrid.js';

const HEART_FAR = 14; // 이보다 멀면 심장 소리가 없다

export function createStalker(map) {
  const c = center(map.stalker);
  return { x: c.x, y: c.y, heading: 0, mode: 'patrol', path: [], patrolIndex: 0, lostT: 0, searchT: 0, stunT: 0, repathT: 0, lockers: [], checking: null, lastSeen: null };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function seesPlayer(s, player, map, k) {
  if (player.hidden !== null) return false;
  const d = dist(s, player);
  if (d > (player.lightOn ? k.seeLight : k.seeDark)) return false;
  const toPlayer = Math.atan2(player.x - s.x, player.y - s.y);
  const diff = Math.atan2(Math.sin(toPlayer - s.heading), Math.cos(toPlayer - s.heading));
  if (Math.abs(diff) > ((k.fov / 2) * Math.PI) / 180) return false;
  return lineOfSight(map, s, player);
}

function notices(s, player, map, k) {
  if (player.hidden !== null) return false;
  const d = dist(s, player);
  if (player.noise > 0 && d <= player.noise) return true;
  return player.lightOn && d <= k.noticeLight && lineOfSight(map, s, player);
}

function goTo(s, map, cell) {
  s.path = findPath(map, cellOf(s), frontOf(map, cell)) || [];
}

// 길을 따라 한 걸음. 길이 다 끝났으면 false
function walk(s, speed, dt) {
  let left = speed * dt;
  while (left > 0 && s.path.length) {
    const t = center(s.path[0]);
    const d = dist(s, t);
    if (d > 0.001) s.heading = Math.atan2(t.x - s.x, t.y - s.y);
    if (d <= left) {
      s.x = t.x;
      s.y = t.y;
      s.path.shift();
      left -= d;
    } else {
      s.x += ((t.x - s.x) / d) * left;
      s.y += ((t.y - s.y) / d) * left;
      left = 0;
    }
  }
  return s.path.length > 0;
}

function startSearch(s, map, k, rand) {
  s.mode = 'search';
  s.searchT = k.searchTime;
  s.checking = null;
  s.lockers = map.lockers
    .map((c, i) => ({ i, d: dist(center(c), s) }))
    .filter((l) => l.d <= k.searchRadius && rand() < k.lockerCheckChance)
    .sort((a, b) => a.d - b.d)
    .map((l) => l.i);
  if (s.lastSeen) goTo(s, map, s.lastSeen);
  else s.path = [];
}

function wander(s, map, k, rand) {
  const c = cellOf(s);
  const r = Math.ceil(k.searchRadius);
  for (let i = 0; i < 8; i++) {
    const cx = c.cx + Math.floor(rand() * (r * 2 + 1)) - r;
    const cy = c.cy + Math.floor(rand() * (r * 2 + 1)) - r;
    if (blocked(map, cx, cy)) continue;
    const path = findPath(map, c, { cx, cy });
    if (path?.length) {
      s.path = path;
      return;
    }
  }
}

function tickSearch(s, world, k, dt, rand, events) {
  s.searchT -= dt;
  if (s.searchT <= 0) {
    s.mode = 'patrol';
    s.path = [];
    return;
  }
  if (walk(s, k.stalkerWalk, dt)) return;
  if (s.checking !== null) {
    events.push('locker');
    if (world.player.hidden === s.checking) events.push('found');
    s.checking = null;
  }
  if (s.lockers.length) {
    s.checking = s.lockers.shift();
    goTo(s, world.map, world.map.lockers[s.checking]);
  } else wander(s, world.map, k, rand);
}

function tickPatrol(s, map, k, dt) {
  if (walk(s, k.stalkerWalk, dt)) return;
  s.patrolIndex = (s.patrolIndex + 1) % map.patrol.length;
  goTo(s, map, map.patrol[s.patrolIndex]);
}

export function tickStalker(s, world, k, dt, rand = Math.random) {
  const { map, player } = world;
  const events = [];
  if (s.mode === 'stunned') {
    s.stunT -= dt;
    if (s.stunT <= 0) {
      s.lastSeen = null;
      startSearch(s, map, k, rand);
    }
    return events;
  }
  const sees = seesPlayer(s, player, map, k);
  if (sees) {
    if (s.mode !== 'chase') {
      events.push('chase');
      s.repathT = 0;
    }
    s.mode = 'chase';
    s.lostT = 0;
    s.lastSeen = cellOf(player);
  } else if (s.mode !== 'chase' && notices(s, player, map, k)) {
    if (s.mode !== 'investigate') events.push('notice');
    s.mode = 'investigate';
    goTo(s, map, cellOf(player));
  }

  if (s.mode === 'chase') {
    s.repathT -= dt;
    if (s.repathT <= 0 && s.lastSeen) {
      goTo(s, map, s.lastSeen);
      s.repathT = k.repathTime;
    }
    walk(s, k.stalkerChase, dt);
    if (!sees) {
      s.lostT += dt;
      if (s.lostT >= k.loseTime) {
        events.push('lost');
        startSearch(s, map, k, rand);
      }
    }
  } else if (s.mode === 'investigate') {
    if (!walk(s, k.stalkerWalk, dt)) s.mode = 'patrol';
  } else if (s.mode === 'search') tickSearch(s, world, k, dt, rand, events);
  else tickPatrol(s, map, k, dt);

  if (player.hidden === null && dist(s, player) < k.catchDist) events.push('caught');
  return events;
}

export function stunStalker(s, k) {
  s.mode = 'stunned';
  s.stunT = k.stunTime;
  s.path = [];
}

// 잡은 뒤에는 멀리 옮겨서, 다시 시작하자마자 또 잡히지 않게 한다
export function sendAway(s, map, player) {
  let best = map.patrol[0];
  map.patrol.forEach((c, i) => {
    if (dist(center(c), player) >= dist(center(best), player)) {
      best = c;
      s.patrolIndex = i;
    }
  });
  const c = center(best);
  Object.assign(s, { x: c.x, y: c.y, mode: 'patrol', path: [], lostT: 0, checking: null, lockers: [], lastSeen: null });
}

// 심장이 뛰는 간격(초). 멀면 null
export function heartInterval(d) {
  if (d > HEART_FAR) return null;
  return 0.35 + (d / HEART_FAR) * 0.85;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/horrorStalker.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/logic/horrorStalker.js tests/horrorStalker.test.js
git commit -m "Horror mode stalker behavior"
```

---

### Task 5: 3D 파쇄자를 맵에 풀기

**Files:**
- Create: `src/horror/shredderModel.js`
- Modify: `src/horror/HorrorGame.js`

**Interfaces:**
- Consumes: `createStalker`, `tickStalker`, `noiseFor`, `public/art/shredder_saw.png`
- Produces: `class ShredderModel`: `constructor(scene, { barrel })`, `update(stalker, dt)`, 값 `sawTexture`
- HorrorGame 에 더해지는 값: `stalker`, `model`, `hidden`(사물함 번호 또는 `null`), `onStalkerEvents(events)`

- [ ] **Step 1: 모형 쓰기**

`src/horror/shredderModel.js`:

```js
// 3D 파쇄자: 드럼통 몸, 돌아가는 톱날, 네 다리, 배 구멍의 붉은빛
import * as THREE from 'three';
import { CELL } from '../logic/horrorGrid.js';

const BODY_R = 0.62;
const BODY_H = 1.7;
const LEG_Y = 0.95; // 다리가 몸에 붙는 높이
const SAW_R = 0.42;
const SPIN = { patrol: 5, investigate: 7, search: 7, chase: 22, stunned: 0 };
const STRIDE = { patrol: 5, investigate: 5, search: 5, chase: 11, stunned: 0 };

export class ShredderModel {
  constructor(scene, { barrel } = {}) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const steel = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.75 });
    const bodyMat = barrel ? new THREE.MeshStandardMaterial({ map: barrel, roughness: 0.75 }) : steel;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R, BODY_R * 0.92, BODY_H, 16), bodyMat);
    body.position.y = LEG_Y + BODY_H / 2 - 0.1;
    body.castShadow = true;
    this.group.add(body);

    this.sawTexture = new THREE.TextureLoader().load('art/shredder_saw.png');
    this.saw = new THREE.Mesh(
      new THREE.CircleGeometry(SAW_R, 24),
      new THREE.MeshStandardMaterial({ map: this.sawTexture, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 }),
    );
    this.saw.position.set(0, LEG_Y + BODY_H / 2, BODY_R + 0.04);
    this.group.add(this.saw);

    // 배 구멍의 붉은빛: 어둠 속에서 멀리서도 자리가 보인다
    this.glow = new THREE.PointLight(0xff3010, 6, 7, 1.8);
    this.glow.position.set(0, LEG_Y + BODY_H / 2, BODY_R + 0.5);
    this.group.add(this.glow);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(SAW_R * 1.15, 24), new THREE.MeshBasicMaterial({ color: 0x500800 }));
    hole.position.set(0, LEG_Y + BODY_H / 2, BODY_R + 0.02);
    this.group.add(hole);

    const legGeo = new THREE.BoxGeometry(0.26, LEG_Y, 0.3);
    legGeo.translate(0, -LEG_Y / 2, 0);
    this.legs = [[-0.4, 0.34, 0], [0.4, 0.34, Math.PI], [-0.4, -0.34, Math.PI], [0.4, -0.34, 0]].map(([x, z, phase]) => {
      const leg = new THREE.Mesh(legGeo, steel);
      leg.position.set(x, LEG_Y, z);
      leg.castShadow = true;
      leg.userData.phase = phase;
      this.group.add(leg);
      return leg;
    });
    this.walkT = 0;
  }

  update(s, dt) {
    this.group.position.set(s.x * CELL, 0, s.y * CELL);
    this.group.rotation.y = s.heading;
    this.saw.rotation.z += SPIN[s.mode] * dt;
    this.walkT += STRIDE[s.mode] * dt;
    for (const leg of this.legs) leg.rotation.x = Math.sin(this.walkT + leg.userData.phase) * (s.mode === 'stunned' ? 0 : 0.5);
    this.glow.intensity = s.mode === 'chase' ? 14 : s.mode === 'stunned' ? 1 : 6;
  }
}
```

- [ ] **Step 2: 게임에 연결**

`src/horror/HorrorGame.js` 위쪽 import 를 고친다:

```js
import { stepPlayer, nextPixelRatio, noiseFor } from '../logic/horrorInput.js';
import { createStalker, tickStalker } from '../logic/horrorStalker.js';
import { ShredderModel } from './shredderModel.js';
```

생성자의 `this.input = new HorrorInput(...)` 바로 앞에 더한다:

```js
    this.stalker = createStalker(this.map);
    this.model = new ShredderModel(this.scene);
    this.hidden = null;
```

`update(dt)` 메서드 전체를 아래로 바꾸고, 그 바로 뒤에 `onStalkerEvents` 를 더한다:

```js
  update(dt) {
    const inp = this.readInput();
    if (inp.pause) return this.exit();
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
    this.model.update(this.stalker, dt);
    this.placeCamera();
    this.world.update(this.p, this.k.viewCells);
  }

  onStalkerEvents(events) {
    this.lastEvents = events;
  }
```

- [ ] **Step 3: 화면 확인 도구에 파쇄자 찍기 더하기**

`tools/run_horror.py` 의 `light_off.png` 찍는 줄 뒤에 더한다:

```python
    pg.evaluate("""() => {
      const g = window.__horror;
      g.lightOn = true;
      g.stalker.x = g.p.x + 2.5; // 시작 지점 오른쪽은 같은 방의 빈 칸이다
      g.stalker.y = g.p.y;
      g.stalker.mode = 'stunned'; // 찍는 동안 서 있게 한다
      g.stalker.stunT = 99;
      g.stalker.heading = -Math.PI / 2; // 주인공 쪽을 본다
      g.yaw = -Math.PI / 2; // 주인공은 오른쪽을 본다
      g.pitch = 0;
    }""")
    time.sleep(0.3)
    print('stalker', pg.evaluate('window.__horror.stalker.mode'))
    pg.screenshot(path=f'{OUT}/stalker.png')
```

- [ ] **Step 4: 확인**

Run: `npx vitest run && python3 tools/run_horror.py /tmp/horror-shots`
Expected: 테스트 통과, `errors []`, `stalker.png` 에 어둠 속 드럼통, 톱날, 붉은빛이 보인다. 그림을 직접 열어 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add src/horror tools/run_horror.py
git commit -m "Horror mode: 3D Shredder walks the factory"
```

---

### Task 6: 공포 소리

> **먼저 읽기:** 시험 플레이 요청으로 `src/horror/audio.js` 가 이미 들어갔다 (배경 음악, `HorrorAudio({ muted })`, `update(dt, rand)`, `setActive(on)`, `destroy()`). 아래 코드로 파일을 덮어쓰지 말고 톱날, 발소리, 심장 소리, `play(name)` 를 이 클래스에 더한다. 소리 객체는 생성자가 아니라 `beginPlay()` 에서 만들어지므로 `this.audio` 는 안내 화면 동안 `null` 이다. 위치를 받는 갱신은 `updateStalker(camera, stalkerPos, mode, dist, dt)` 로 따로 두고 `state === 'play'` 일 때만 부른다.

**Files:**
- Create: `src/horror/audio.js`
- Modify: `src/horror/HorrorGame.js`

**Interfaces:**
- Consumes: `sfx.ctx`, `sfx.master`, `sfx.noise`, `sfx.unlock()`, `heartInterval(dist)`
- Produces: `class HorrorAudio`: `constructor({ muted })`, `update(camera, stalkerPos, mode, dist, dt)`, `footstep()`, `play(name)` (`'fuse'`, `'punch'`, `'scare'`, `'caught'`, `'door'`), `suspend()`, `destroy()`

- [ ] **Step 1: 소리 쓰기**

`src/horror/audio.js`:

```js
// 공포 모드 소리. 파일 없이 합성하고, 파쇄자 소리는 방향이 들리게 한다.
import { sfx } from '../audio/sfx.js';
import { heartInterval } from '../logic/horrorStalker.js';

const SAW_LEVEL = { patrol: 0.25, investigate: 0.3, search: 0.3, chase: 0.6, stunned: 0 };
const STEP_EVERY = { patrol: 0.75, investigate: 0.75, search: 0.75, chase: 0.42, stunned: 0 };

export class HorrorAudio {
  constructor({ muted }) {
    sfx.unlock();
    this.ctx = sfx.ctx;
    this.heartT = 0;
    this.stepT = 0;
    if (!this.ctx) return;
    this.out = this.ctx.createGain();
    this.out.gain.value = muted ? 0 : 1;
    this.out.connect(sfx.master);
    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 3;
    this.panner.rolloffFactor = 1.6;
    this.panner.connect(this.out);

    // 톱날: 끝없는 잡음을 좁은 주파수로 걸러 윙 소리를 만든다
    this.saw = this.ctx.createBufferSource();
    this.saw.buffer = sfx.noise;
    this.saw.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 780;
    band.Q.value = 7;
    this.sawGain = this.ctx.createGain();
    this.sawGain.gain.value = 0;
    this.saw.connect(band).connect(this.sawGain).connect(this.panner);
    this.saw.start();
  }

  burst(dest, { freq, dur, vol, type = 'sine', slide = 0.5 }) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + dur);
  }

  footstep() {
    if (this.ctx) this.burst(this.panner, { freq: 62, dur: 0.28, vol: 1.1 });
  }

  play(name) {
    if (!this.ctx) return;
    if (name === 'fuse') this.burst(this.out, { freq: 880, dur: 0.18, vol: 0.2, type: 'triangle', slide: 1.5 });
    if (name === 'door') this.burst(this.out, { freq: 140, dur: 0.5, vol: 0.5, type: 'sawtooth' });
    if (name === 'punch') this.burst(this.out, { freq: 1400, dur: 0.35, vol: 0.4, type: 'sawtooth', slide: 0.1 });
    if (name === 'scare') {
      this.burst(this.out, { freq: 95, dur: 0.9, vol: 0.9, type: 'sawtooth', slide: 0.6 });
      this.burst(this.out, { freq: 2300, dur: 0.5, vol: 0.2, type: 'square', slide: 0.4 });
    }
    if (name === 'caught') {
      this.burst(this.out, { freq: 700, dur: 1.1, vol: 0.7, type: 'sawtooth', slide: 3 });
      this.burst(this.out, { freq: 55, dur: 1.1, vol: 0.9 });
    }
  }

  setPos(node, x, y, z) {
    if (node.positionX) {
      node.positionX.value = x;
      node.positionY.value = y;
      node.positionZ.value = z;
    } else node.setPosition(x, y, z);
  }

  // stalkerPos: 3D 좌표 { x, y, z }, dist: 칸 단위 거리
  update(camera, stalkerPos, mode, dist, dt) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const e = camera.matrixWorld.elements;
    this.setPos(l, camera.position.x, camera.position.y, camera.position.z);
    if (l.forwardX) {
      l.forwardX.value = -e[8];
      l.forwardY.value = -e[9];
      l.forwardZ.value = -e[10];
      l.upX.value = e[4];
      l.upY.value = e[5];
      l.upZ.value = e[6];
    } else l.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
    this.setPos(this.panner, stalkerPos.x, stalkerPos.y, stalkerPos.z);
    this.sawGain.gain.setTargetAtTime(SAW_LEVEL[mode], this.ctx.currentTime, 0.2);

    this.stepT -= dt;
    if (STEP_EVERY[mode] && this.stepT <= 0) {
      this.stepT = STEP_EVERY[mode];
      this.footstep();
    }
    const gap = heartInterval(dist);
    this.heartT -= dt;
    if (gap !== null && this.heartT <= 0) {
      this.heartT = gap;
      this.burst(this.out, { freq: 58, dur: 0.14, vol: 0.45 });
    }
  }

  suspend() {
    if (this.ctx) this.sawGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  destroy() {
    if (!this.ctx) return;
    this.saw.stop();
    this.saw.disconnect();
    this.panner.disconnect();
    this.out.disconnect();
  }
}
```

- [ ] **Step 2: 게임에 연결**

`src/horror/HorrorGame.js` 에 import 를 더한다:

```js
import { HorrorAudio } from './audio.js';
```

생성자의 `this.hidden = null;` 뒤에 더한다:

```js
    this.audio = new HorrorAudio({ muted });
```

`update` 의 `this.placeCamera();` 뒤에 더한다:

```js
    this.camera.updateMatrixWorld();
    const sd = Math.hypot(this.stalker.x - this.p.x, this.stalker.y - this.p.y);
    this.audio.update(this.camera, { x: this.stalker.x * CELL, y: 1.5, z: this.stalker.y * CELL }, this.stalker.mode, sd, dt);
```

`exit()` 의 `this.input.destroy();` 뒤에 더한다:

```js
    this.audio.destroy();
```

- [ ] **Step 3: 확인**

Run: `npx vitest run && python3 tools/run_horror.py /tmp/horror-shots`
Expected: 테스트 통과, `errors []`. 화면 없는 Chrome 으로는 소리를 들을 수 없으므로, 소리 품질은 Task 9 의 사람 확인 목록에 남긴다.

- [ ] **Step 4: 커밋**

```bash
git add src/horror
git commit -m "Horror mode: synthesized positional saw, steps and heartbeat"
```

---

### Task 7: 판 규칙과 저장

**Files:**
- Create: `src/logic/horrorRun.js`
- Modify: `src/logic/save.js`
- Test: `tests/horrorRun.test.js`

**Interfaces:**
- Consumes: `reachable`, `center`
- Produces: `createRun(map, k, rand)`, `takeFuse(run, i)`, `chargeShock(run, boxIndex)`, `useShock(run)`, `insertFuses(run, k)`, `caught(run)`, `escape(run, k)`, `emptyHorror()`, `normalizeHorror(data)`, `recordEscape(record, clean)`
- `run` 모양: `{ fuses: [{ cx, cy, taken }], have, inserted, shock, usedBoxes: [], caughtCount, powered, escaped }`
- `escape` 는 `{ gems, clean }` 를 돌려준다.
- 저장: `save.horror = { escapes, cleanEscapes }`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/horrorRun.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRun, takeFuse, chargeShock, useShock, insertFuses, caught, escape, normalizeHorror, recordEscape, emptyHorror } from '../src/logic/horrorRun.js';
import { reachable } from '../src/logic/horrorGrid.js';
import { createSaveStore } from '../src/logic/save.js';
import { factoryMap } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const fresh = () => createRun(factoryMap, k, () => 0.3);

describe('퓨즈', () => {
  it('정해진 수만큼 서로 다른 자리에 놓는다', () => {
    const run = fresh();
    expect(run.fuses).toHaveLength(k.fuseCount);
    expect(new Set(run.fuses.map((f) => `${f.cx},${f.cy}`)).size).toBe(k.fuseCount);
  });

  it('판마다 자리가 달라질 수 있다', () => {
    const a = createRun(factoryMap, k, () => 0.1).fuses;
    const b = createRun(factoryMap, k, () => 0.9).fuses;
    expect(a).not.toEqual(b);
  });

  it('언제나 걸어갈 수 있는 자리다', () => {
    const open = reachable(factoryMap, factoryMap.start);
    for (let i = 0; i < 50; i++) {
      for (const f of createRun(factoryMap, k).fuses) expect(open.has(`${f.cx},${f.cy}`)).toBe(true);
    }
  });

  it('한 번만 주울 수 있다', () => {
    const run = fresh();
    expect(takeFuse(run, 0)).toBe(true);
    expect(takeFuse(run, 0)).toBe(false);
    expect(run.have).toBe(1);
  });
});

describe('쇼크 충전', () => {
  it('한 번에 1회분만 든다', () => {
    const run = fresh();
    expect(chargeShock(run, 0)).toBe(true);
    expect(chargeShock(run, 1)).toBe(false);
  });

  it('상자마다 한 번만 쓴다', () => {
    const run = fresh();
    chargeShock(run, 0);
    expect(useShock(run)).toBe(true);
    expect(useShock(run)).toBe(false);
    expect(chargeShock(run, 0)).toBe(false);
    expect(chargeShock(run, 1)).toBe(true);
  });
});

describe('전원과 탈출', () => {
  const allFuses = () => {
    const run = fresh();
    run.fuses.forEach((_, i) => takeFuse(run, i));
    return run;
  };

  it('퓨즈가 다 있어야 전원이 들어온다', () => {
    const run = fresh();
    takeFuse(run, 0);
    expect(insertFuses(run, k)).toBe(false);
    const full = allFuses();
    expect(insertFuses(full, k)).toBe(true);
    expect(full.powered).toBe(true);
  });

  it('잡혀도 찾은 퓨즈는 남는다', () => {
    const run = fresh();
    takeFuse(run, 0);
    caught(run);
    expect(run.have).toBe(1);
    expect(run.caughtCount).toBe(1);
  });

  it('안 잡히고 탈출하면 추가 보석', () => {
    expect(escape(allFuses(), k)).toEqual({ gems: k.gemsEscape + k.gemsClean, clean: true });
  });

  it('잡힌 적이 있으면 기본 보석만', () => {
    const run = allFuses();
    caught(run);
    expect(escape(run, k)).toEqual({ gems: k.gemsEscape, clean: false });
  });
});

describe('저장', () => {
  it('기록을 더한다', () => {
    expect(recordEscape(emptyHorror(), true)).toEqual({ escapes: 1, cleanEscapes: 1 });
    expect(recordEscape({ escapes: 2, cleanEscapes: 1 }, false)).toEqual({ escapes: 3, cleanEscapes: 1 });
  });

  it('이상한 값은 0 으로 읽는다', () => {
    expect(normalizeHorror(null)).toEqual(emptyHorror());
    expect(normalizeHorror({ escapes: -1, cleanEscapes: 'a' })).toEqual(emptyHorror());
  });

  it('예전 저장을 읽고, 새 기록을 저장한다', () => {
    const box = {};
    const storage = { getItem: (key) => box[key] ?? null, setItem: (key, v) => { box[key] = v; } };
    const store = createSaveStore(storage);
    box['shock-hero-save-v1'] = JSON.stringify({ level: 3 });
    const old = store.load();
    expect(old.horror).toEqual(emptyHorror());
    old.horror = { escapes: 1, cleanEscapes: 1 };
    store.save(old);
    expect(store.load().horror).toEqual({ escapes: 1, cleanEscapes: 1 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/horrorRun.test.js`
Expected: FAIL, `horrorRun.js` 를 찾을 수 없음

- [ ] **Step 3: 규칙 쓰기**

`src/logic/horrorRun.js`:

```js
// 공포 모드 한 판의 규칙과 기록 (화면과 상관없는 부분)
import { reachable } from './horrorGrid.js';

export function createRun(map, k, rand = Math.random) {
  const open = reachable(map, map.start);
  const spots = map.fuses.filter((c) => open.has(`${c.cx},${c.cy}`));
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return {
    fuses: spots.slice(0, k.fuseCount).map((c) => ({ ...c, taken: false })),
    have: 0,
    shock: false,
    usedBoxes: [],
    caughtCount: 0,
    powered: false,
    escaped: false,
  };
}

export function takeFuse(run, i) {
  const f = run.fuses[i];
  if (!f || f.taken) return false;
  f.taken = true;
  run.have += 1;
  return true;
}

export function chargeShock(run, box) {
  if (run.shock || run.usedBoxes.includes(box)) return false;
  run.shock = true;
  run.usedBoxes.push(box);
  return true;
}

export function useShock(run) {
  if (!run.shock) return false;
  run.shock = false;
  return true;
}

export function insertFuses(run, k) {
  if (run.have < k.fuseCount) return false;
  run.powered = true;
  return true;
}

export function caught(run) {
  run.caughtCount += 1;
}

export function escape(run, k) {
  run.escaped = true;
  const clean = run.caughtCount === 0;
  return { gems: k.gemsEscape + (clean ? k.gemsClean : 0), clean };
}

export function emptyHorror() {
  return { escapes: 0, cleanEscapes: 0 };
}

export function normalizeHorror(data) {
  const d = emptyHorror();
  if (Number.isInteger(data?.escapes) && data.escapes > 0) d.escapes = data.escapes;
  if (Number.isInteger(data?.cleanEscapes) && data.cleanEscapes > 0) d.cleanEscapes = data.cleanEscapes;
  return d;
}

export function recordEscape(record, clean) {
  return { escapes: record.escapes + 1, cleanEscapes: record.cleanEscapes + (clean ? 1 : 0) };
}
```

- [ ] **Step 4: 저장에 연결**

`src/logic/save.js` 위쪽에 더한다:

```js
import { emptyHorror, normalizeHorror } from './horrorRun.js';
```

`defaultSave()` 의 `daily: emptyDaily(), ...` 줄 뒤에 더한다:

```js
    horror: emptyHorror(), // 공포 모드 기록 { escapes, cleanEscapes } (src/logic/horrorRun.js)
```

`normalize()` 의 `d.daily = normalizeDaily(...)` 줄 뒤에 더한다:

```js
  d.horror = normalizeHorror(data.horror);
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/logic/horrorRun.js src/logic/save.js tests/horrorRun.test.js
git commit -m "Horror mode run rules, rewards and save record"
```

---

### Task 8: 줍기, 숨기, 펀치, 잡힘, 탈출, 일시정지

> **먼저 읽기:** 시험 플레이 요청으로 이미 들어간 것: `src/horror/hud.js` (`controlLines(touch)`, `startHint(touch)`, `say`, `openLayer`, `closeLayer`, `showIntro(touch, onStart, onQuit)`), `HorrorGame` 의 `state`, `beginPlay()`, 소리용 `onVisibility`, `input.relock()`. 아래 코드로 덮어쓰지 말고 없는 부분(`setStatus`, `setPrompt`, `showSlit`, `fade`, `showPause`, `showEnd`, 상태 글자)만 더한다. 버튼은 `click` 을 쓴다 (`pointerdown` 은 iPad 에서 소리를 켜지 못한다). `INTRO` 의 시험판 문구는 아래 이야기 문구로 바꾸고, `controlLines` 에 줍기와 숨기(E, 사용 버튼), 쇼크 펀치(왼쪽 클릭, 펀치 버튼)를 더한다. `onVisibility` 는 소리를 끄는 일과 `pause()` 를 함께 한다. 봇은 `pg.click` 으로 시작 버튼을 진짜로 누른다.

**Files:**
- Create: `src/horror/hud.js`
- Modify: `src/horror/HorrorGame.js`, `src/horror/world.js`, `src/horror/input.js`
- Create: `tools/bot_horror.js`
- Modify: `tools/run_horror.py`

**Interfaces:**
- Consumes: Task 4, 7 의 함수 전부, `saveStore`, `factoryMap`
- Produces:
  - `class HorrorHud`: `constructor(root)`, `setStatus({ have, need, shock, powered })`, `setPrompt(text)`, `say(text, seconds)`, `showSlit(on)`, `showIntro(onStart)`, `showPause(onResume, onQuit)`, `hidePause()`, `showEnd(text, onDone)`, `fade(on)`, `destroy()`
  - HorrorGame 값: `run`, `state` (`'intro' | 'play' | 'paused' | 'caught' | 'end'`), 메서드 `nearestUse()`, `doUse(target)`, `doPunch()`, `getCaught()`, `win()`
  - `nearestUse()` 는 `{ kind, index, label }` 또는 `null`. `kind` 는 `'fuse' | 'locker' | 'box' | 'panel' | 'gate'`

- [ ] **Step 1: 글자 화면 쓰기**

`src/horror/hud.js`:

```js
// 공포 모드 글자, 안내 화면. 어두운 화면에서 잘 보이도록 3D 위에 HTML 로 올린다.
const LAYER = 'position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;background:rgba(0,0,0,.82);color:#eee;font:20px sans-serif;padding:24px;box-sizing:border-box';
const BTN = 'padding:12px 28px;font:20px sans-serif;background:#3a1414;color:#fff;border:1px solid #a33;border-radius:8px;touch-action:none';

const INTRO = ['밤의 고철 공장을 조사하다가 문이 잠겼다.', '볼트와의 통신도 끊겼다.', '퓨즈 3개를 찾아 전원에 꽂고 정문으로 나가자.', '달리면 소리가 나고, 손전등 빛은 들킨다.', '파쇄자는 쓰러뜨릴 수 없다. 사물함에 숨어!'];

export class HorrorHud {
  constructor(root) {
    this.root = root;
    this.box = document.createElement('div');
    this.box.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;color:#ddd;font:18px sans-serif';
    this.status = this.add('position:absolute;left:16px;top:12px;text-shadow:0 0 4px #000');
    this.prompt = this.add('position:absolute;left:0;right:0;bottom:22%;text-align:center;text-shadow:0 0 4px #000');
    this.message = this.add('position:absolute;left:0;right:0;top:18%;text-align:center;color:#ffb0a0;text-shadow:0 0 4px #000');
    this.dot = this.add('position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:rgba(255,255,255,.45)');
    this.slit = this.add('position:absolute;inset:0;display:none;background:linear-gradient(90deg,#000 0 40%,transparent 44% 56%,#000 60% 100%)');
    this.black = this.add('position:absolute;inset:0;background:#000;opacity:0;transition:opacity .35s');
    root.appendChild(this.box);
    this.layer = null;
  }

  add(css) {
    const el = document.createElement('div');
    el.style.cssText = css;
    this.box.appendChild(el);
    return el;
  }

  setStatus({ have, need, shock, powered }) {
    this.status.textContent = `퓨즈 ${have}/${need}   쇼크 ${shock ? '충전됨' : '없음'}${powered ? '   전원 켜짐, 정문으로!' : ''}`;
  }

  setPrompt(text) {
    this.prompt.textContent = text;
  }

  say(text, seconds = 3) {
    this.message.textContent = text;
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => {
      this.message.textContent = '';
    }, seconds * 1000);
  }

  showSlit(on) {
    this.slit.style.display = on ? 'block' : 'none';
  }

  fade(on) {
    this.black.style.opacity = on ? '1' : '0';
  }

  openLayer(lines, buttons) {
    this.closeLayer();
    this.layer = document.createElement('div');
    this.layer.style.cssText = LAYER;
    for (const line of lines) {
      const p = document.createElement('div');
      p.textContent = line;
      this.layer.appendChild(p);
    }
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.text;
      btn.style.cssText = BTN;
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        b.onPress();
      });
      this.layer.appendChild(btn);
    }
    this.root.appendChild(this.layer);
  }

  closeLayer() {
    this.layer?.remove();
    this.layer = null;
  }

  showIntro(onStart) {
    this.openLayer(['꽤 무서워요. 어두운 방에서 혼자 하면 더 무섭습니다.', ...INTRO], [{ text: '시작', onPress: onStart }]);
  }

  showPause(onResume, onQuit) {
    this.openLayer(['일시정지'], [{ text: '계속하기', onPress: onResume }, { text: '타이틀로', onPress: onQuit }]);
  }

  hidePause() {
    this.closeLayer();
  }

  showEnd(text, onDone) {
    this.openLayer([text], [{ text: '타이틀로', onPress: onDone }]);
  }

  destroy() {
    clearTimeout(this.sayTimer);
    this.closeLayer();
    this.box.remove();
  }
}
```

- [ ] **Step 2: 퓨즈 모형을 세상에 더하기**

`src/horror/world.js` 의 `buildWorld` 안 `return` 앞에 더한다:

```js
  // 퓨즈: 어둠 속에서 찾을 수 있게 스스로 살짝 빛난다
  const addFuses = (fuses) =>
    fuses.map((c) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8), new THREE.MeshBasicMaterial({ color: 0xffc040 }));
      mesh.position.set((c.cx + 0.5) * CELL, 0.75, (c.cy + 0.5) * CELL);
      mesh.rotation.z = Math.PI / 2;
      props.add(mesh);
      return mesh;
    });
```

그리고 돌려주는 객체에 `addFuses,` 를 더한다.

- [ ] **Step 3: 마우스 다시 잠그기**

`src/horror/input.js` 의 `destroy()` 바로 앞에 더한다:

```js
  // 일시정지에서 돌아올 때 마우스를 다시 잠근다
  relock() {
    if (!this.touch) this.el.requestPointerLock?.();
  }
```

- [ ] **Step 4: 게임 흐름 쓰기**

`src/horror/HorrorGame.js` import 에 더한다:

```js
import { sendAway, stunStalker } from '../logic/horrorStalker.js';
import { createRun, takeFuse, chargeShock, useShock, insertFuses, caught, escape, recordEscape } from '../logic/horrorRun.js';
import { saveStore } from '../save.js';
import { HorrorHud } from './hud.js';
```

기존 `import { CELL, center } ...` 줄은 아래로 바꾼다:

```js
import { CELL, center, cellOf, frontOf, findPath } from '../logic/horrorGrid.js';
```

생성자의 `this.audio = new HorrorAudio({ muted });` 뒤에 더한다:

```js
    this.run = createRun(this.map, this.k);
    this.fuseMeshes = this.world.addFuses(this.run.fuses);
    this.hud = new HorrorHud(root);
    this.state = 'intro';
    this.onVisibility = () => document.hidden && this.pause();
    document.addEventListener('visibilitychange', this.onVisibility);
```

`start()` 의 맨 앞에 더한다:

```js
    this.placeCamera();
    this.hud.setStatus(this.statusNow());
    this.hud.showIntro(() => {
      this.hud.closeLayer();
      this.state = 'play';
      this.input.relock();
    });
```

`update(dt)` 전체를 아래로 바꾼다 (Task 5, 6 에서 더한 내용 포함):

```js
  update(dt) {
    const inp = this.readInput();
    if (this.state !== 'play') return;
    if (inp.pause) return this.pause();
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
    if (this.state !== 'play') return;
    this.model.update(this.stalker, dt);
    this.placeCamera();
    this.camera.updateMatrixWorld();
    const sd = Math.hypot(this.stalker.x - this.p.x, this.stalker.y - this.p.y);
    this.audio.update(this.camera, { x: this.stalker.x * CELL, y: 1.5, z: this.stalker.y * CELL }, this.stalker.mode, sd, dt);
    this.world.update(this.p, this.k.viewCells);
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
    if (events.includes('chase')) this.hud.say('들켰다! 도망쳐!', 2);
    if (events.includes('caught') || events.includes('found')) this.getCaught();
  }

  // 손이 닿는 가장 가까운 것
  nearestUse() {
    const reach = this.k.useRange;
    const near = (c) => Math.hypot(c.cx + 0.5 - this.p.x, c.cy + 0.5 - this.p.y);
    if (this.hidden !== null) return { kind: 'locker', index: this.hidden, label: '사물함에서 나오기' };
    const list = [];
    this.run.fuses.forEach((f, i) => !f.taken && list.push({ kind: 'fuse', index: i, label: '퓨즈 줍기', d: near(f) }));
    this.map.lockers.forEach((c, i) => list.push({ kind: 'locker', index: i, label: '사물함에 숨기', d: near(c) }));
    this.map.boxes.forEach((c, i) => !this.run.usedBoxes.includes(i) && !this.run.shock && list.push({ kind: 'box', index: i, label: '쇼크 충전', d: near(c) }));
    if (!this.run.powered) list.push({ kind: 'panel', index: 0, label: this.run.have >= this.k.fuseCount ? '퓨즈 꽂기' : `퓨즈가 ${this.k.fuseCount}개 필요해`, d: near(this.map.panel) });
    else list.push({ kind: 'gate', index: 0, label: '정문으로 탈출', d: near(this.map.gate) });
    const best = list.filter((t) => t.d <= reach).sort((a, b) => a.d - b.d)[0];
    return best || null;
  }

  doUse(t) {
    if (!t) return;
    if (t.kind === 'fuse' && takeFuse(this.run, t.index)) {
      this.fuseMeshes[t.index].visible = false;
      this.audio.play('fuse');
    }
    if (t.kind === 'box' && chargeShock(this.run, t.index)) this.audio.play('fuse');
    if (t.kind === 'panel' && insertFuses(this.run, this.k)) {
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
      this.p = { x: this.map.lockers[i].cx + 0.5, y: this.map.lockers[i].cy + 0.5 };
      const f = frontOf(this.map, this.map.lockers[i]);
      this.yaw = Math.atan2(-(f.cx + 0.5 - this.p.x), -(f.cy + 0.5 - this.p.y));
      this.hud.showSlit(true);
    } else {
      this.hidden = null;
      this.p = this.beforeHide;
      this.hud.showSlit(false);
    }
  }

  doPunch() {
    const d = Math.hypot(this.stalker.x - this.p.x, this.stalker.y - this.p.y);
    if (!this.run.shock) return;
    useShock(this.run);
    this.audio.play('punch');
    if (d <= this.k.shockRange) {
      stunStalker(this.stalker, this.k);
      this.hud.say('맞았다! 지금 도망쳐!', 3);
    } else this.hud.say('빗나갔다...', 2);
    this.hud.setStatus(this.statusNow());
  }

  getCaught() {
    if (this.state !== 'play') return;
    this.state = 'caught';
    caught(this.run);
    this.audio.play('caught');
    this.hidden = null;
    this.hud.showSlit(false);
    this.hud.setPrompt('');
    this.showCatchSaw();
    setTimeout(() => this.hud.fade(true), 700);
    setTimeout(() => {
      this.p = center(this.map.start);
      this.yaw = 0;
      this.pitch = 0;
      sendAway(this.stalker, this.map, this.p);
      this.hideCatchSaw();
      this.placeCamera();
      this.hud.fade(false);
      this.hud.say('다시 시작 지점이다. 찾은 퓨즈는 그대로야.', 4);
      this.state = 'play';
    }, 2200);
  }

  // 톱날이 화면 가득 다가온다
  showCatchSaw() {
    const saw = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshBasicMaterial({ map: this.model.sawTexture, alphaTest: 0.5 }));
    saw.position.set(0, 0, -1.4);
    this.camera.add(saw);
    this.catchSaw = saw;
    const t0 = performance.now();
    const spin = () => {
      if (this.catchSaw !== saw) return;
      const t = (performance.now() - t0) / 700;
      saw.rotation.z = t * 22;
      saw.position.z = -1.4 + Math.min(1, t) * 1.1;
      requestAnimationFrame(spin);
    };
    spin();
  }

  hideCatchSaw() {
    if (!this.catchSaw) return;
    this.camera.remove(this.catchSaw);
    this.catchSaw.geometry.dispose();
    this.catchSaw.material.dispose();
    this.catchSaw = null;
  }

  win() {
    if (this.state !== 'play') return;
    this.state = 'end';
    this.audio.suspend();
    const { gems, clean } = escape(this.run, this.k);
    const save = saveStore.load();
    save.gems += gems;
    save.horror = recordEscape(save.horror, clean);
    saveStore.save(save);
    document.exitPointerLock?.();
    this.hud.showEnd(`탈출 성공! 보석 ${gems}개${clean ? ' (한 번도 안 잡혔어요!)' : ''}`, () => this.exit());
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.audio.suspend();
    document.exitPointerLock?.();
    this.hud.showPause(
      () => {
        this.hud.hidePause();
        this.state = 'play';
        this.input.relock();
      },
      () => this.exit(),
    );
  }
```

`exit()` 의 `this.audio.destroy();` 뒤에 더한다:

```js
    this.hud.destroy();
    this.hideCatchSaw();
    document.removeEventListener('visibilitychange', this.onVisibility);
```

주의: `getCaught` 의 `setTimeout` 이 도는 중에 `exit()` 가 불릴 수 있다. `state` 가 `'caught'` 인 동안에는 일시정지가 막혀 있어 `exit()` 가 불리지 않는다. 탭을 벗어나도 `pause()` 가 `'play'` 가 아니면 그냥 돌아가므로 안전하다.

- [ ] **Step 5: 봇 쓰기**

`tools/bot_horror.js`:

```js
// 공포 모드 봇: readInput 을 바꿔 끼워서 진짜 입력으로 퓨즈를 모으고 탈출한다.
// window.__horrorBot = { caughtOnPurpose: true } 면 파쇄자에게 일부러 잡힌다.
(() => {
  const g = window.__horror;
  const B = { path: [], goal: null, use: false };
  const { findPath, cellOf, frontOf, center } = window.__horrorLogic;
  const same = (a, b) => a && b && a.cx === b.cx && a.cy === b.cy;
  const goalNow = () => {
    const fuse = g.run.fuses.find((f) => !f.taken);
    if (fuse) return fuse;
    return frontOf(g.map, g.run.powered ? g.map.gate : g.map.panel);
  };
  g.readInput = function () {
    const inp = { move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false };
    if (window.__horrorBot?.caughtOnPurpose) {
      g.stalker.x = g.p.x + 0.3;
      g.stalker.y = g.p.y;
      return inp;
    }
    const target = g.nearestUse();
    if (target && !B.use && ['fuse', 'panel', 'gate'].includes(target.kind) && !(target.kind === 'panel' && g.run.have < g.k.fuseCount)) {
      B.use = true;
      inp.use = true;
      return inp;
    }
    B.use = false;
    const goal = goalNow();
    if (!same(B.goal, goal) || !B.path.length) {
      B.goal = goal;
      B.path = findPath(g.map, cellOf(g.p), { cx: goal.cx, cy: goal.cy }) || [];
    }
    while (B.path.length && same(B.path[0], cellOf(g.p))) {
      const c = center(B.path[0]);
      if (Math.hypot(c.x - g.p.x, c.y - g.p.y) > 0.25) break;
      B.path.shift();
    }
    if (!B.path.length) return inp;
    const t = center(B.path[0]);
    g.yaw = Math.atan2(-(t.x - g.p.x), -(t.y - g.p.y));
    inp.move.z = 1;
    inp.move.run = true;
    return inp;
  };
  return 'bot on';
})();
```

`src/horror/HorrorGame.js` 생성자의 `window.__horror = this;` 뒤에 더한다:

```js
    window.__horrorLogic = { findPath, cellOf, frontOf, center };
```


- [ ] **Step 6: 끝까지 도는 확인 쓰기**

`tools/run_horror.py` 의 `open_horror` 함수 끝에 더한다 (안내 화면을 넘긴다):

```python
    pg.evaluate("""() => { const g = window.__horror; g.hud.closeLayer(); g.state = 'play'; }""")
```

파일 끝 `b.close()` 앞에 더한다:

```python
    # 잡히는 판과 탈출하는 판
    bot = open('tools/bot_horror.js').read()
    pg2 = b.new_page(viewport={'width': 640, 'height': 360})  # 화면 없는 Chrome 은 느려서 작게 돌린다
    pg2.on('pageerror', lambda e: errs.append(str(e)[:300]))
    open_horror(pg2)
    pg2.evaluate("window.__horrorBot = { caughtOnPurpose: true }")
    pg2.evaluate(bot)
    pg2.wait_for_function("window.__horror.run.caughtCount >= 1", timeout=15000)
    time.sleep(0.5)
    pg2.screenshot(path=f'{OUT}/caught.png')
    pg2.evaluate("window.__horrorBot = null")
    time.sleep(2.5)
    print('after caught', pg2.evaluate("({ state: window.__horror.state, p: window.__horror.p, stalker: window.__horror.stalker.mode })"))
    pg2.evaluate("window.__horror.stalker.stunT = 9999; window.__horror.stalker.mode = 'stunned'")  # 길 찾기와 줍기 확인이라 파쇄자를 세운다
    pg2.wait_for_function("window.__horror.state === 'end'", timeout=400000)
    pg2.screenshot(path=f'{OUT}/escape.png')
    print('escaped', pg2.evaluate("({ have: window.__horror.run.have, powered: window.__horror.run.powered })"))
    print('saved', pg2.evaluate("JSON.parse(localStorage.getItem('shock-hero-save-v1')).horror"))
    print('errors', errs)
```

- [ ] **Step 7: 확인**

Run: `npx vitest run && python3 tools/run_horror.py /tmp/horror-shots`
Expected: 테스트 통과. `after caught` 의 `state` 는 `play`, 위치는 시작 지점. `escaped` 는 `have: 3, powered: true`. `saved` 는 `escapes` 1 이상. `errors []`. `caught.png` 에 톱날이 크게 보인다. 그림을 직접 열어 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add src/horror tools/bot_horror.js tools/run_horror.py
git commit -m "Horror mode full loop: fuses, lockers, shock punch, capture and escape"
```

---

### Task 9: 그림, 놀람 장면, 문서

**Files:**
- Create: `tools/make_horror_art.py`
- Create: `public/art/horror_wall.jpg`, `public/art/horror_floor.jpg`, `public/art/horror_locker.jpg`, `public/art/horror_barrel.jpg`
- Modify: `src/horror/HorrorGame.js`, `README.md`, `tools/README.md`, `docs/DECISIONS.md`

**Interfaces:**
- Consumes: `tools/gemini_batch.py`, `buildWorld(scene, map, mats)`, `ShredderModel(scene, { barrel })`, `map.scares`
- Produces: 없음 (마지막 Task)

- [ ] **Step 1: 그림 주문서 쓰기**

`/tmp/horror_orders.json` 에 쓴다 (`out` 은 절대 경로로 바꾼다):

```json
[
  { "prompt": "Create an image: seamless tileable texture of a rusty riveted steel factory wall panel, hand-painted comic style with bold black ink lines, dark brown and red rust, flat front view, no shadows, no text, square.", "out": "/tmp/horror_raw/wall.png" },
  { "prompt": "Create an image: seamless tileable texture of a dirty cracked concrete factory floor with oil stains, hand-painted comic style with bold black ink lines, dark grey, flat top view, no text, square.", "out": "/tmp/horror_raw/floor.png" },
  { "prompt": "Create an image: front view of a dented green-grey metal factory locker door with three horizontal vent slits, rust stains, hand-painted comic style with bold black ink lines, door fills the whole image edge to edge, no background, no text, square.", "out": "/tmp/horror_raw/locker.png" },
  { "prompt": "Create an image: seamless tileable texture of rusty riveted drum barrel steel plates, brown and red rust, hand-painted comic style with bold black ink lines, flat front view, no text, square.", "out": "/tmp/horror_raw/barrel.png" }
]
```

- [ ] **Step 2: 그림 받기**

`tools/gemini_batch.py` 맨 위 설명을 읽고 안전 규칙을 따른다.

Run: `GEMINI_BATCH=/tmp/horror_orders.json browser-harness < tools/gemini_batch.py`
Expected: `/tmp/horror_raw/` 에 PNG 4장. Chrome 연결 문제나 거절이 나면 멈추고 사용자에게 알린다. 다른 세션의 탭에 입력하면 안 된다.

- [ ] **Step 3: 그림 줄이기 도구 쓰기**

`tools/make_horror_art.py`:

```python
# 사용법: python3 tools/make_horror_art.py 원본폴더 public/art
# Gemini 재질 그림을 512x512 JPG 로 줄이고, 별 표시가 있는 오른쪽 아래를 옆 그림으로 덮는다.
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
for name in ('wall', 'floor', 'locker', 'barrel'):
    im = Image.open(f'{src}/{name}.png').convert('RGB')
    w, h = im.size
    size = int(w * 0.12)
    patch = im.crop((w - size * 2, h - size, w - size, h))
    im.paste(patch, (w - size, h - size))
    im.resize((512, 512), Image.LANCZOS).save(f'{dst}/horror_{name}.jpg', quality=82)
```

Run: `python3 tools/make_horror_art.py /tmp/horror_raw public/art && ls -la public/art/horror_*`
Expected: 4개, 각각 200KB 이하

- [ ] **Step 4: 재질 입히기**

`src/horror/HorrorGame.js` 의 `this.world = buildWorld(this.scene, this.map);` 를 아래로 바꾼다:

```js
    const tex = (name, repeat = 1) => {
      const t = new THREE.TextureLoader().load(`art/horror_${name}.jpg`);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    this.world = buildWorld(this.scene, this.map, {
      wall: new THREE.MeshStandardMaterial({ map: tex('wall'), roughness: 0.9 }),
      floor: new THREE.MeshStandardMaterial({ map: tex('floor', 7), roughness: 1 }),
      locker: tex('locker'),
    });
```

`new ShredderModel(this.scene)` 를 `new ShredderModel(this.scene, { barrel: tex('barrel') })` 로 바꾼다. 이 줄은 `tex` 정의 뒤에 있어야 한다.

- [ ] **Step 5: 놀람 장면 쓰기**

`src/horror/HorrorGame.js` 생성자의 `this.state = 'intro';` 뒤에 더한다:

```js
    this.scaresLeft = [...this.map.scares];
```

`update` 의 `const target = this.nearestUse();` 앞에 더한다:

```js
    this.checkScare();
```

`statusNow()` 앞에 더한다:

```js
  // 밟으면 큰 소리가 나고 손전등이 깜빡인다. 효과 줄이기를 켜면 깜빡임은 뺀다
  checkScare() {
    const i = this.scaresLeft.findIndex((c) => c.cx === cellOf(this.p).cx && c.cy === cellOf(this.p).cy);
    if (i < 0) return;
    this.scaresLeft.splice(i, 1);
    this.audio.play('scare');
    if (this.lowFx) return;
    const base = this.flash.intensity;
    let n = 0;
    const blink = setInterval(() => {
      this.flash.intensity = n % 2 ? base : base * 0.1;
      n += 1;
      if (n >= 7) {
        clearInterval(blink);
        this.flash.intensity = base;
      }
    }, 90);
  }
```

- [ ] **Step 6: 문서 쓰기**

`README.md` 의 조작법 구역 끝(휴대폰 구역 뒤)에 더한다:

```markdown
### 공포 모드

타이틀의 공포 모드 버튼이나 H 키로 켭니다. 밤의 고철 공장에서 파쇄자를 피해 퓨즈 3개를 찾아 전원에 꽂고 정문으로 탈출합니다. 꽤 무서우니 어린 아이는 어른과 함께 하세요. PC 와 태블릿에서 할 수 있고 휴대폰은 지원하지 않습니다.

| 동작 | PC | 태블릿 |
|---|---|---|
| 이동 | WASD | 왼쪽 조이스틱 |
| 시점 | 마우스 | 오른쪽 화면 끌기 |
| 달리기 | Shift | 조이스틱 끝까지 밀기 |
| 손전등 | F | 손전등 버튼 |
| 줍기, 숨기 | E | 사용 버튼 |
| 쇼크 펀치 | 왼쪽 클릭 | 펀치 버튼 |
| 일시정지 | Esc | 멈춤 버튼 |

주소 끝에 `?fps` 를 붙이면 왼쪽 위에 초당 장수가 나옵니다.
```

`tools/README.md` 목록에 더한다:

```markdown
- `run_horror.py`: 공포 모드를 켜서 걷기, 잡히기, 탈출까지 돌리고 화면을 찍음 (`bot_horror.js` 를 씀)
- `make_horror_art.py`: Gemini 재질 그림을 512 JPG 로 줄이고 별 표시를 덮음
```

`docs/DECISIONS.md` 끝에 더한다:

```markdown
## 공포 모드

2026-10-31 설계는 `docs/superpowers/specs/2026-10-31-horror-mode-design.md` 에 있습니다.

- **Three.js 를 고를 때만 내려받습니다.** 기존 게임 첫 로딩이 무거워지지 않게, `src/horror/start.js` 만 타이틀이 import 하고 3D 묶음은 동적 import 입니다.
- **먼 구역은 그리지 않습니다.** 벽 뒤 가림 계산 대신, 어둠에 묻히는 거리(`viewCells`)보다 먼 7칸 구역을 숨깁니다. 계산이 없어서 태블릿에 가볍습니다.
- **파쇄자는 2D 그림을 세우지 않고 드럼통 모형으로 만들었습니다.** 옆이나 뒤에서 납작하게 보이지 않습니다.
- **잡혀도 퓨즈는 남습니다.** 아이가 지치지 않게 하기 위해서이고, 대신 파쇄자를 먼 순찰 지점으로 보냅니다.
```

- [ ] **Step 8: 전체 확인**

Run: `npx vitest run && npx vite build 2>&1 | tail -3 && python3 tools/run_horror.py /tmp/horror-shots`
Expected: 테스트와 빌드 통과. `errors []`. 찍힌 그림을 직접 열어 벽, 바닥, 사물함, 파쇄자 재질이 보이는지, 손전등을 끄면 거의 안 보이는지 확인한다. `grep -c "WebGLRenderer" dist/assets/index-*.js` 가 0 이다.

- [ ] **Step 9: 커밋하고 머지**

```bash
git add public/art/horror_* tools/make_horror_art.py src/horror README.md tools/README.md docs/DECISIONS.md
git commit -m "Horror mode art, scares and docs"
```

main 을 base 로 PR 을 만들고 머지한다. 사용자에게 남기는 확인은 실제 태블릿 속도, 무서운 정도, 소리 품질, 파쇄자 속도(`balance.js` 의 `horror`)다.
