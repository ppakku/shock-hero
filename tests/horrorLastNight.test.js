import { describe, it, expect } from 'vitest';
import { LAST_MAP_ID, LAST_ROUND, MAP_IDS, MONSTER_IDS, RANDOM, chooseRound, forcedRound, isLastNight, isRound, pickRound, roundMonsters } from '../src/logic/horrorPick.js';
import { addStamp, boardCells, boardSize, cellKey, normalizeStamps, stampCount, stampsLeft } from '../src/logic/horrorStamps.js';
import { emptyHorror, lastNightReward, normalizeHorror, recordLastNight } from '../src/logic/horrorRun.js';
import { anyChasing, createAlarm, createStalkers, nearestStalker, nextAlarm, raiseAlarm, sendAllAway, warnState } from '../src/logic/horrorHunters.js';
import { createRun } from '../src/logic/horrorRun.js';
import { createStalker } from '../src/logic/horrorStalker.js';
import { blocked, center, reachable } from '../src/logic/horrorGrid.js';
import { LAST_PLACE, MONSTERS } from '../src/horror/content.js';
import { lastNightCard } from '../src/horror/chooser.js';
import { lastNightText } from '../src/horror/hud.js';
import { ENDINGS, FINAL_LINES, clueTexts, fillName, joinNames } from '../src/horror/story.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const fullBoard = (stamp = 'plain') => Object.fromEntries(boardCells({}).map((c) => [cellKey(c), stamp]));

describe('마지막 밤 판', () => {
  it('맵 목록에 없어서 도장판 크기가 그대로다', () => {
    expect(MAP_IDS).not.toContain(LAST_MAP_ID);
    expect(boardSize()).toBe(MAP_IDS.length * MONSTER_IDS.length);
    expect(isRound(LAST_ROUND)).toBe(false);
    expect(isLastNight(LAST_ROUND)).toBe(true);
    expect(isLastNight({ mapId: MAP_IDS[0], monsterId: MONSTER_IDS[0] })).toBe(false);
  });

  it('괴물 목록을 돌려준다. 보통 판은 하나다', () => {
    expect(roundMonsters(LAST_ROUND)).toEqual(MONSTER_IDS.slice(0, 2));
    expect(roundMonsters({ mapId: MAP_IDS[0], monsterId: MONSTER_IDS[2] })).toEqual([MONSTER_IDS[2]]);
  });

  it('랜덤으로는 절대 나오지 않는다', () => {
    for (let i = 0; i < 300; i++) {
      const rand = () => (i + 0.5) / 300;
      expect(pickRound(null, rand).mapId).not.toBe(LAST_MAP_ID);
      expect(chooseRound({ mapId: RANDOM, monsterId: RANDOM }, null, rand).mapId).not.toBe(LAST_MAP_ID);
      expect(chooseRound({ mapId: LAST_MAP_ID, monsterId: RANDOM }, null, rand).mapId).not.toBe(LAST_MAP_ID); // 잘못 고른 값도 보통 판이 된다
    }
  });

  it('지난 판으로 저장되어도 버려진다', () => {
    expect(normalizeHorror({ last: LAST_ROUND }).last).toBe(null);
  });

  it('시험 주소로 바로 들어갈 수 있다', () => {
    expect(forcedRound(`?map=${LAST_MAP_ID}`)).toBe(LAST_ROUND);
    expect(forcedRound(`?map=${LAST_MAP_ID}&monster=${MONSTER_IDS[3]}`)).toBe(LAST_ROUND);
    expect(forcedRound('?map=없는곳')).toBe(null);
  });

  it('도장을 주지 않고 도장판에도 들어가지 않는다', () => {
    expect(addStamp({}, LAST_ROUND, true)).toEqual({ stamps: {}, earned: null });
    expect(normalizeStamps({ [cellKey(LAST_ROUND)]: 'gold' })).toEqual({});
  });
});

describe('마지막 밤 열기', () => {
  it('도장이 다 찍혀야 열리고 금 도장이 아니어도 된다', () => {
    expect(stampsLeft({})).toBe(boardSize());
    const one = boardCells({}).at(-1);
    const almost = fullBoard();
    delete almost[cellKey(one)];
    expect(stampsLeft(almost)).toBe(1);
    expect(stampsLeft(fullBoard())).toBe(0);
    expect(stampsLeft({ ...almost, [cellKey(one)]: 'gold' })).toBe(0);
  });

  it('고르기 칸은 남은 도장 수를 말하고, 다 모으면 열리고, 깬 뒤에는 다시 할 수 있다', () => {
    const shut = lastNightCard({ stamps: {} });
    expect(shut.open).toBe(false);
    expect(shut.text).toContain(`${boardSize()}개`);
    const open = lastNightCard({ stamps: fullBoard() });
    expect(open.open).toBe(true);
    for (const id of roundMonsters(LAST_ROUND)) expect(open.text).toContain(MONSTERS[id].name);
    expect(lastNightCard({ stamps: fullBoard(), lastCleared: true }).text).toContain('다시');
  });
});

describe('마지막 밤 기록과 보상', () => {
  it('옛 저장은 깬 적 없는 것으로 읽힌다', () => {
    expect(emptyHorror().lastCleared).toBe(false);
    expect(normalizeHorror({ escapes: 3 }).lastCleared).toBe(false);
    expect(normalizeHorror(undefined).lastCleared).toBe(false);
    expect(normalizeHorror({ lastCleared: 'yes' }).lastCleared).toBe(false);
    expect(normalizeHorror({ lastCleared: true }).lastCleared).toBe(true);
  });

  it('보석은 처음 한 번만 받는다', () => {
    const before = emptyHorror();
    expect(lastNightReward(before, k).gems).toBe(k.lastNight.gems);
    expect(k.lastNight.gems).toBeGreaterThan(0);
    const after = recordLastNight(before);
    expect(after).toEqual({ ...before, lastCleared: true });
    expect(lastNightReward(after, k).gems).toBe(0);
  });

  it('끝 글은 받은 보석만 말한다', () => {
    expect(lastNightText({ gems: 30 }, false)).toContain('보석 30개');
    expect(lastNightText({ gems: 0 }, true)).not.toContain('보석');
    expect(lastNightText({ gems: 0 }, true)).toContain('안 잡혔어요');
  });
});

describe('마지막 밤 이야기', () => {
  it('이름이 바뀌어도 받침에 맞고, 이름을 글에 박아 두지 않는다', () => {
    const all = [...LAST_PLACE.notes.flat(), ...ENDINGS[LAST_MAP_ID], FINAL_LINES[LAST_MAP_ID], LAST_PLACE.hint];
    expect(all.join(' ')).not.toMatch(/세이노|눈뜬이/);
    expect(all.join(' ')).not.toMatch(/[—·]|피|죽|시체|살해/);
    expect(fillName(['{other}는 {name}를'], '곰', '눈먼곰')).toEqual(['눈먼곰은 곰을']);
  });

  it('두 이름을 받침에 맞게 잇는다', () => {
    expect(joinNames(['세이노', '눈뜬이'])).toBe('세이노와 눈뜬이');
    expect(joinNames(['눈먼곰', '세이노'])).toBe('눈먼곰과 세이노');
    expect(joinNames(['세이노'])).toBe('세이노');
  });

  it('붉은 쪽지 글이 있다', () => {
    const run = createRun(LAST_PLACE.map, k, () => 0.3);
    expect(clueTexts(LAST_MAP_ID, run.code).flat().join(' ')).not.toContain('{');
  });
});

describe('괴물 목록', () => {
  const seeded = () => { let x = 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
  const level = createRun(LAST_PLACE.map, k, seeded()).level;
  const ids = roundMonsters(LAST_ROUND);

  it('둘째는 맵의 둘째 칸에서 시작하고 그 칸은 잠긴 날개 밖이다', () => {
    const [a, b] = createStalkers(level, k, seeded(), ids);
    expect(a).toMatchObject({ monsterId: ids[0], ...center(level.stalker) });
    expect(b).toMatchObject({ monsterId: ids[1], ...center(level.stalker2) });
    expect(reachable(level, level.start).has(`${level.stalker2.cx},${level.stalker2.cy}`)).toBe(true);
  });

  it('한 마리면 맵의 괴물 칸에 선다', () => {
    const [only] = createStalkers(level, k, seeded(), [ids[1]]);
    expect(only).toMatchObject({ ...center(level.stalker) });
  });

  it('잡힌 뒤 둘 다 멀리, 서로 다른 곳으로, 쉬는 시간을 갖고 간다', () => {
    for (let seed = 1; seed < 60; seed++) {
      const list = createStalkers(level, k, seeded(), ids);
      list.forEach((s) => Object.assign(s, { mode: 'chase', x: 3.5, y: 22.5 }));
      let x = seed;
      sendAllAway(list, level, { x: 3.5, y: 22.5 }, () => ((x = (x * 7 + 3) % 101) / 101));
      expect(list[0].patrolIndex).not.toBe(list[1].patrolIndex);
      for (const s of list) {
        expect(s.graceT).toBe(Infinity);
        expect(s.mode).toBe('patrol');
        expect(blocked(level, Math.floor(s.x), Math.floor(s.y))).toBe(false);
      }
    }
  });

  it('가까운 괴물을 고르고 쫓기는지 안다', () => {
    const a = { x: 1, y: 1, mode: 'patrol' };
    const b = { x: 5, y: 1, mode: 'chase' };
    expect(nearestStalker([a, b], { x: 4, y: 1 })).toBe(b);
    expect(nearestStalker([a], { x: 40, y: 1 })).toBe(a);
    expect(anyChasing([a])).toBe(false);
    expect(anyChasing([a, b])).toBe(true);
  });

  it('이름표 상태: 쫓아옴, 멈춤, 가까움, 멂', () => {
    const p = { x: 0, y: 0 };
    const near = k.lastNight.warnNear;
    expect(warnState({ mode: 'chase', x: 99, y: 0 }, p, k)).toBe('chase');
    expect(warnState({ mode: 'watch', frozenT: 0.1, x: 3, y: 0 }, p, k)).toBe('still');
    expect(warnState({ mode: 'watch', frozenT: 0, x: 3, y: 0 }, p, k)).toBe('near'); // 세이노가 바라보는 것은 멈춘 것이 아니다
    expect(warnState({ mode: 'patrol', x: near, y: 0 }, p, k)).toBe('near');
    expect(warnState({ mode: 'patrol', x: near + 1, y: 0 }, p, k)).toBe('far');
  });
});

describe('알림 차례', () => {
  const line = (text) => ({ text, seconds: 2 });
  it('같은 괴물은 바로 바꾸고 다른 괴물은 기다린다', () => {
    const a = createAlarm();
    expect(raiseAlarm(a, 0, line('가'), 0, 2)).toEqual(line('가'));
    expect(raiseAlarm(a, 0, line('나'), 0.1, 2)).toEqual(line('나'));
    expect(raiseAlarm(a, 1, line('다'), 0.2, 2)).toBe(null);
    expect(nextAlarm(a, 1, 2)).toBe(null);
    expect(nextAlarm(a, 2.1, 2)).toEqual(line('다'));
    expect(nextAlarm(a, 9, 2)).toBe(null);
  });

  it('앞 글이 끝났으면 다른 괴물도 바로 뜬다', () => {
    const a = createAlarm();
    raiseAlarm(a, 0, line('가'), 0, 2);
    expect(raiseAlarm(a, 1, line('나'), 3, 2)).toEqual(line('나'));
  });

  it('기다리는 알림은 가장 새 것 하나만 남는다', () => {
    const a = createAlarm();
    raiseAlarm(a, 0, line('가'), 0, 2);
    raiseAlarm(a, 1, line('나'), 0.1, 2);
    raiseAlarm(a, 1, line('다'), 0.2, 2);
    expect(nextAlarm(a, 2, 2)).toEqual(line('다'));
  });
});

describe('봇이 쓰는 기본값', () => {
  it('createStalker 는 자리를 주지 않으면 맵의 괴물 칸에 선다', () => {
    const level = createRun(LAST_PLACE.map, k, () => 0.3).level;
    expect(createStalker(level, k, Math.random, MONSTER_IDS[0])).toMatchObject(center(level.stalker));
    expect(createStalker(level, k, Math.random, MONSTER_IDS[0], level.stalker2)).toMatchObject(center(level.stalker2));
  });
});

it('stampCount 는 마지막 밤과 상관없다', () => {
  expect(stampCount(fullBoard())).toBe(boardSize());
});
