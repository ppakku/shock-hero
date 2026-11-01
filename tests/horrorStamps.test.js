import { describe, it, expect } from 'vitest';
import { MAP_IDS, MONSTER_IDS, RANDOM } from '../src/logic/horrorPick.js';
import { GOLD, PLAIN, addStamp, boardCells, boardSize, cellKey, goldCount, isCurrentCell, lookOptions, nextUnlock, normalizeStamps, openedLooks, stampCount, stepCounts, wornLook } from '../src/logic/horrorStamps.js';
import { emptyHorror, normalizeHorror } from '../src/logic/horrorRun.js';
import { createSaveStore } from '../src/logic/save.js';
import { stampLines } from '../src/horror/hud.js';
import { cfg } from '../src/config/index.js';

const k = cfg.horror.stamps;
const ROUND = { mapId: MAP_IDS[0], monsterId: MONSTER_IDS[0] };
const OTHER = { mapId: MAP_IDS[1], monsterId: MONSTER_IDS[1] };
// 앞에서부터 n 칸에 도장을 찍은 판
const filled = (n, stamp = PLAIN) => Object.fromEntries(boardCells({}).slice(0, n).map((c) => [cellKey(c), stamp]));

describe('도장판', () => {
  it('맵과 괴물 조합마다 한 칸이고 겹치지 않는다', () => {
    const cells = boardCells({});
    expect(cells).toHaveLength(MAP_IDS.length * MONSTER_IDS.length);
    expect(cells).toHaveLength(boardSize());
    expect(new Set(cells.map(cellKey)).size).toBe(cells.length);
  });

  it('탈출하면 도장, 안 잡히면 금 도장을 받는다', () => {
    expect(addStamp({}, ROUND, false)).toEqual({ stamps: { [cellKey(ROUND)]: PLAIN }, earned: PLAIN });
    expect(addStamp({}, ROUND, true)).toEqual({ stamps: { [cellKey(ROUND)]: GOLD }, earned: GOLD });
  });

  it('금 도장은 일반 도장을 바꾸고, 거꾸로는 안 된다', () => {
    const plain = addStamp({}, ROUND, false).stamps;
    const gold = addStamp(plain, ROUND, true);
    expect(gold).toEqual({ stamps: { [cellKey(ROUND)]: GOLD }, earned: GOLD });
    expect(addStamp(gold.stamps, ROUND, false)).toEqual({ stamps: gold.stamps, earned: null });
    expect(stampCount(gold.stamps)).toBe(1);
  });

  it('같은 도장을 또 받으면 소식이 없다', () => {
    const plain = addStamp({}, ROUND, false).stamps;
    expect(addStamp(plain, ROUND, false)).toEqual({ stamps: plain, earned: null });
    const gold = addStamp({}, ROUND, true).stamps;
    expect(addStamp(gold, ROUND, true)).toEqual({ stamps: gold, earned: null });
  });

  it('다른 칸은 건드리지 않는다', () => {
    const one = addStamp({}, ROUND, true).stamps;
    const two = addStamp(one, OTHER, false).stamps;
    expect(two).toEqual({ [cellKey(ROUND)]: GOLD, [cellKey(OTHER)]: PLAIN });
    expect(stampCount(two)).toBe(2);
    expect(goldCount(two)).toBe(1);
  });

  it('없는 판은 찍지 않는다', () => {
    expect(addStamp({}, { mapId: 'nope', monsterId: MONSTER_IDS[0] }, true)).toEqual({ stamps: {}, earned: null });
    expect(addStamp({}, null, true)).toEqual({ stamps: {}, earned: null });
  });
});

describe('지금 고른 칸', () => {
  const count = (choice) => boardCells({}).filter((c) => isCurrentCell(c, choice)).length;
  it('맵과 괴물을 다 고르면 한 칸이다', () => {
    expect(count(ROUND)).toBe(1);
    expect(boardCells({}).find((c) => isCurrentCell(c, ROUND))).toMatchObject(ROUND);
  });
  it('한쪽이 랜덤이면 그 줄 전체다', () => {
    expect(count({ mapId: RANDOM, monsterId: MONSTER_IDS[0] })).toBe(MAP_IDS.length);
    expect(count({ mapId: MAP_IDS[0], monsterId: RANDOM })).toBe(MONSTER_IDS.length);
  });
  it('둘 다 랜덤이면 없다', () => {
    expect(count({ mapId: RANDOM, monsterId: RANDOM })).toBe(0);
  });
});

describe('색 열기', () => {
  it('네 단계이고 마지막은 판 전체다', () => {
    const steps = stepCounts(k);
    expect(steps).toHaveLength(4);
    expect(steps.at(-1)).toBe(boardSize());
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(new Set(steps).size).toBe(4);
  });

  it('단계마다 번개와 손전등이 하나씩 열린다', () => {
    expect(k.bolts).toHaveLength(k.steps.length + 1);
    expect(k.lights).toHaveLength(k.steps.length + 1);
    for (const n of [0, ...stepCounts(k)]) {
      const stamps = filled(n);
      const open = (list) => lookOptions(list, stamps, k, null).filter((o) => o.open).length;
      expect(open(k.bolts)).toBe(stepCounts(k).filter((need) => need <= n).length + 1);
      expect(open(k.lights)).toBe(open(k.bolts));
    }
  });

  it('필요한 도장 수에서 딱 열리고 한 칸 모자라면 잠겨 있다', () => {
    for (const [i, need] of stepCounts(k).entries()) {
      const at = (n) => lookOptions(k.bolts, filled(n), k, null)[i + 1];
      expect(at(need - 1)).toMatchObject({ open: false, need });
      expect(at(need)).toMatchObject({ open: true, need });
    }
  });

  it('금 도장도 한 칸으로 센다', () => {
    const [first] = stepCounts(k);
    expect(lookOptions(k.lights, filled(first, GOLD), k, null)[1].open).toBe(true);
  });

  it('잠긴 색이나 없는 색을 고른 저장은 기본 색을 쓴다', () => {
    expect(wornLook(k.bolts, {}, k, k.bolts[1].id)).toBe(k.bolts[0]);
    expect(wornLook(k.lights, {}, k, 'nope')).toBe(k.lights[0]);
    expect(wornLook(k.lights, {}, k, null)).toBe(k.lights[0]);
    expect(wornLook(k.bolts, filled(stepCounts(k)[0]), k, k.bolts[1].id)).toBe(k.bolts[1]);
  });

  it('고른 색 하나만 켜져 있다', () => {
    const on = lookOptions(k.bolts, filled(stepCounts(k)[1]), k, k.bolts[2].id).filter((o) => o.on);
    expect(on.map((o) => o.look)).toEqual([k.bolts[2]]);
  });

  it('새로 열린 색을 알려 준다', () => {
    const [first, second] = stepCounts(k);
    expect(openedLooks(filled(first - 1), filled(first), k)).toEqual([k.bolts[1], k.lights[1]]);
    expect(openedLooks(filled(first), filled(first + 1), k)).toEqual([]);
    expect(openedLooks(filled(first - 1), filled(second), k)).toEqual([k.bolts[1], k.bolts[2], k.lights[1], k.lights[2]]);
  });

  it('다음 단계를 알려 주고 다 열리면 null 이다', () => {
    const [first, second] = stepCounts(k);
    expect(nextUnlock({}, k)).toEqual({ need: first, looks: [k.bolts[1], k.lights[1]] });
    expect(nextUnlock(filled(first), k).need).toBe(second);
    expect(nextUnlock(filled(boardSize()), k)).toBeNull();
  });
});

describe('손전등 색은 공평하다', () => {
  const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const channels = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => linear(v / 255));
  const luma = (hex) => {
    const [r, g, b] = channels(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  it.each(k.lights.map((l) => [l.name, l.color]))('%s 는 눈에 보이는 밝기가 처음 색과 5% 안이다', (_, color) => {
    expect(Math.abs(luma(color) / luma(k.lights[0].color) - 1)).toBeLessThan(0.05);
  });
  it.each(k.lights.map((l) => [l.name, l.color]))('%s 는 어떤 벽 색도 지우지 않는다', (_, color) => {
    expect(Math.min(...channels(color))).toBeGreaterThan(0.3);
  });
});

describe('저장', () => {
  it('도장판이 없던 저장은 빈 판으로 읽는다', () => {
    const old = { escapes: 3, cleanEscapes: 1, gemDay: '2026-10-01', last: ROUND };
    expect(normalizeHorror(old)).toEqual({ ...emptyHorror(), ...old });
    expect(normalizeHorror(undefined)).toEqual(emptyHorror());
  });

  it('틀린 칸과 틀린 값은 버린다', () => {
    const key = cellKey(ROUND);
    expect(normalizeStamps({ [key]: GOLD, 'nope/seen': GOLD, [cellKey(OTHER)]: 'silver' })).toEqual({ [key]: GOLD });
    expect(normalizeStamps('nonsense')).toEqual({});
    expect(normalizeStamps(null)).toEqual({});
  });

  it('고른 색이 글자가 아니면 버린다', () => {
    expect(normalizeHorror({ bolt: 3, light: {} })).toEqual(emptyHorror());
    expect(normalizeHorror({ bolt: k.bolts[1].id })).toEqual({ ...emptyHorror(), bolt: k.bolts[1].id });
  });

  it('저장을 지나도 도장과 색이 남는다', () => {
    const data = new Map();
    const store = createSaveStore({ getItem: (key) => data.get(key) ?? null, setItem: (key, v) => data.set(key, v) });
    const save = store.load();
    expect(save.horror.stamps).toEqual({});
    save.horror.stamps = addStamp({}, ROUND, true).stamps;
    save.horror.light = k.lights[1].id;
    store.save(save);
    expect(store.load().horror).toMatchObject({ stamps: { [cellKey(ROUND)]: GOLD }, light: k.lights[1].id });
  });
});

describe('끝 화면 소식', () => {
  const opened = [];
  it('받은 것이 없으면 아무 말도 없다', () => {
    expect(stampLines(null, { count: 3, total: 12, opened })).toEqual([]);
  });
  it('새 도장과 금 도장을 다르게 말하고 수를 보여 준다', () => {
    expect(stampLines(PLAIN, { count: 4, total: 12, opened })).toEqual(['새 도장을 받았어요! 도장 4/12']);
    expect(stampLines(GOLD, { count: 1, total: 12, opened })).toEqual(['금 도장을 받았어요! 도장 1/12']);
  });
  it('열린 색의 이름을 말한다', () => {
    const lines = stampLines(PLAIN, { count: 3, total: 12, opened: [k.bolts[1], k.lights[1]] });
    expect(lines[1]).toContain(k.bolts[1].name);
    expect(lines[1]).toContain(k.lights[1].name);
  });
});
