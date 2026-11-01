import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { center, cellOf, frontOf, findPath, lineOfSight, reachable, blocked, withOpen, playerSees } from '../src/logic/horrorGrid.js';
import { stepPlayer, noiseFor, createStamina, canRun, stepStamina } from '../src/logic/horrorInput.js';
import { createStalker, tickStalker, sendAway, stunStalker } from '../src/logic/horrorStalker.js';
import { anyChasing, createStalkers, nearestStalker, sendAllAway } from '../src/logic/horrorHunters.js';
import { createNotes, takeNote } from '../src/logic/horrorNotes.js';
import { createRun, takeClue, takeFuse, takeKey, openDoor, chargeShock, useShock, insertFuses, caught, escape, nearestUse, respawnSpot } from '../src/logic/horrorRun.js';
import { factoryMap } from '../src/horror/maps/factory.js';
import { ALL_MAPS } from '../src/horror/content.js';
import { LAST_ROUND, MAP_IDS, MONSTER_IDS, roundMonsters } from '../src/logic/horrorPick.js';
import { balance } from '../src/config/balance.js';
import { TONIGHT_RULES, tonightMet } from '../src/logic/horrorTonight.js';

vi.setConfig({ testTimeout: 120000 }); // 봇이 한 판을 끝까지 돌아서 다른 시험과 함께 돌면 몇 초를 넘는다

const k = balance.horror;
const DT = 1 / 30;
const BOT = readFileSync('tools/bot_horror.js', 'utf8');
const CHILD = readFileSync('tools/bot_child.js', 'utf8');
const HIDE_LOOK = 0.6; // HorrorGame 과 같은 값: 사물함 안에서 돌릴 수 있는 고개 각도

// 작은 씨앗 난수. 실패가 늘 같은 판에서 다시 나게 한다
function seeded(seed) {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

// HorrorGame.playFrame 과 같은 순서로 그림 없이 한 판을 돌린다. 봇은 진짜 bot_horror.js 다.
// monsterId 대신 monsterIds 를 주면 그 괴물들이 함께 나온다
function playGame(seed, options, maxSeconds = 900, mapId = 'factory', monsterId = 'seino', monsterIds = [monsterId], onFrame = () => {}) {
  const rand = seeded(seed);
  const run = createRun(ALL_MAPS[mapId].map, k, rand);
  const map = run.level;
  const stalkers = createStalkers(map, k, rand, monsterIds);
  const notes = createNotes(map.notes.map(center), rand);
  const lightOn = !options?.noLight;
  let ranFor = 0;
  const g = {
    map, run, k, notes,
    p: center(map.start),
    yaw: 0,
    hidden: null,
    stalker: stalkers[0],
    stalkers,
    nearestUse: () => nearestUse(run, map, g.p, g.hidden, k, options?.notes && !anyChasing(stalkers) ? notes : undefined),
  };
  const window = { __horror: g, __horrorBot: options, __horrorLogic: { findPath, cellOf, frontOf, center, lineOfSight, reachable } };
  if (options?.child) {
    window.__horrorBot = { rand: seeded(seed + 1000) };
    new Function('window', CHILD)(window);
  } else new Function('window', BOT)(window);
  const catches = [];
  let stamina = createStamina();
  let hideFrom = null;
  let hideYaw = 0;
  let t = 0;
  for (; t < maxSeconds && !run.escaped; t += DT) {
    const inp = g.readInput(DT);
    g.yaw -= inp.lookX;
    if (g.hidden !== null) g.yaw = hideYaw + Math.max(-HIDE_LOOK, Math.min(HIDE_LOOK, Math.atan2(Math.sin(g.yaw - hideYaw), Math.cos(g.yaw - hideYaw))));
    const before = g.p;
    const running = canRun(stamina, inp.move.run);
    if (g.hidden === null) g.p = stepPlayer(g.p, inp.move, g.yaw, running ? k.runSpeed : k.walkSpeed, DT, map, 0.2);
    const moving = g.p.x !== before.x || g.p.y !== before.y;
    stamina = stepStamina(stamina, running && moving, k, DT);
    if (running && moving) ranFor += DT;
    const player = { ...g.p, hidden: g.hidden, lightOn, noise: noiseFor(moving, running, k) };
    const pressure = run.have / k.fuseCount;
    let got = false;
    for (const s of stalkers) {
      const events = tickStalker(s, { map, player, seen: playerSees(g, false, s), pressure }, k, DT, rand);
      got = events.includes('caught') || events.includes('found');
      if (got) break; // 게임도 잡히는 순간 나머지 괴물을 움직이지 않는다
    }
    if (got) {
      caught(run);
      catches.push(t);
      g.hidden = null;
      stamina = createStamina();
      g.p = center(respawnSpot(map, g.p));
      sendAllAway(stalkers, map, g.p, rand);
      continue;
    }
    onFrame(g, t);
    const target = g.nearestUse();
    if (inp.use && target) {
      if (target.kind === 'fuse') takeFuse(run, target.index);
      if (target.kind === 'key') takeKey(run, target.index);
      if (target.kind === 'clue') takeClue(run, target.index);
      if (target.kind === 'note') takeNote(notes, target.index);
      if (target.kind === 'lock') openDoor(run, target.index);
      if (target.kind === 'box') chargeShock(run, target.index);
      if (target.kind === 'panel') insertFuses(run, k);
      if (target.kind === 'gate' && run.clues.every((c) => c.taken)) escape(run); // 단서를 다 찾아야 번호를 맞힌다
      if (target.kind === 'locker') {
        if (g.hidden === null) {
          hideFrom = g.p;
          g.hidden = target.index;
          g.p = center(map.lockers[target.index]);
          const f = center(frontOf(map, map.lockers[target.index]));
          hideYaw = Math.atan2(-(f.x - g.p.x), -(f.y - g.p.y));
          g.yaw = hideYaw;
        } else {
          g.hidden = null;
          g.p = hideFrom;
        }
      }
    }
    if (inp.punch && useShock(run)) {
      const s = nearestStalker(stalkers, g.p);
      if (Math.hypot(s.x - g.p.x, s.y - g.p.y) <= k.shockRange && lineOfSight(map, g.p, s)) stunStalker(s, k);
    }
  }
  const counts = { lit: lightOn, ranFor, shocks: run.shocks, catches: catches.length, notes: notes.found };
  return { won: run.escaped, seconds: t, catches, powered: run.powered, doors: run.doors.filter((d) => d.open).length, counts };
}

const summary = (games) => ({
  won: games.filter((r) => r.won).length,
  meanSeconds: Math.round(games.reduce((a, r) => a + r.seconds, 0) / games.length),
  meanCatches: +(games.reduce((a, r) => a + r.catches.length, 0) / games.length).toFixed(1),
  maxCatches: Math.max(...games.map((r) => r.catches.length)),
  // 잡힌 뒤 다음에 잡힐 때까지 가장 짧은 시간
  minGap: Math.round(Math.min(...games.flatMap((r) => r.catches.slice(1).map((c, i) => c - r.catches[i])), Infinity)),
});

describe('공장 맵을 끝까지 할 수 있다', () => {
  const map = withOpen(factoryMap, factoryMap.locks.map((_, i) => i)); // 문을 다 연 뒤의 공장
  const open = reachable(map, map.start);
  const standable = (cell) => {
    // 그 칸 둘레의 걸을 수 있는 자리 중 손이 닿는 곳이 있는가
    const c = center(cell);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { cx: cell.cx + dx, cy: cell.cy + dy };
      if (!blocked(map, n.cx, n.cy) && open.has(`${n.cx},${n.cy}`) && Math.hypot(n.cx + 0.5 - c.x, n.cy + 0.5 - c.y) <= k.useRange) return true;
    }
    return false;
  };

  it('사물함, 전기 상자, 전원, 정문은 모두 손이 닿는다', () => {
    for (const c of [...map.lockers, ...map.boxes, map.panel, map.gate]) expect(standable(c), `${c.cx},${c.cy}`).toBe(true);
  });

  it('순찰 지점은 모두 걸어갈 수 있다', () => {
    for (const c of map.patrol) expect(open.has(`${c.cx},${c.cy}`)).toBe(true);
  });

  it('벽 너머의 것은 집을 수 없다', () => {
    const run = createRun(map, k, () => 0.3);
    // 시작 방 오른쪽 벽 앞에서 벽 건너 칸의 물건은 닿지 않는다
    expect(nearestUse({ ...run, fuses: [{ cx: 8, cy: 22, taken: false }] }, map, { x: 6.8, y: 22.5 }, null, k)).toBe(null);
  });
});

describe('봇이 끝까지 한 판을 한다', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  it('조심하는 봇은 드물게 잡히고 언제나 탈출한다', () => {
    const s = summary(seeds.map((seed) => playGame(seed, { careful: true })));
    console.log('조심하는 봇', s);
    expect(s.won).toBe(seeds.length);
    expect(s.meanCatches).toBeLessThan(5);
    expect(s.meanSeconds).toBeGreaterThanOrEqual(150); // 찾아다녀야 하는 사람은 몇 배 더 걸린다
  }, 120000);

  it('세이노를 무시하고 달리기만 해도 탈출할 수 있다 (잡혀도 퓨즈가 남는다)', () => {
    const s = summary(seeds.map((seed) => playGame(seed, null)));
    console.log('달리기만 하는 봇', s);
    expect(s.won).toBe(seeds.length);
  }, 120000);

  it('다시 시작하자마자 또 잡히지 않는다', () => {
    // 세이노 쪽으로 곧장 달려도 8초는 걸린다. 가만히 있으면 순찰 속도로 15칸을 와야 한다
    expect(summary(seeds.map((seed) => playGame(seed, null))).minGap).toBeGreaterThanOrEqual(8);
    const map = createRun(factoryMap, k, seeded(1)).level; // 게임처럼 지금 갈 수 있는 순찰 지점만 쓴다
    const s = createStalker(map);
    const p = center(map.start);
    Object.assign(s, { x: p.x + 0.3, y: p.y, mode: 'chase', stunT: 0 });
    sendAway(s, map, p);
    expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThanOrEqual(15);
    expect(s.mode).toBe('patrol');
  });
});

describe.each(MAP_IDS.flatMap((mapId) => MONSTER_IDS.map((monsterId) => [mapId, monsterId])))('%s 맵의 %s', (mapId, monsterId) => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  it('조심하는 봇은 언제나 탈출하고 잡히는 일이 적다', () => {
    const s = summary(seeds.map((seed) => playGame(seed, { careful: true }, 900, mapId, monsterId)));
    console.log(mapId, monsterId, '조심하는 봇', s);
    expect(s.won).toBe(seeds.length);
    expect(s.meanCatches).toBeLessThan(5); // 봇은 붉은 쪽지를 맨 마지막에 모아서 사람보다 오래 돌아다닌다
  });

  it('달리기만 하는 봇도 언제나 탈출한다', () => {
    const s = summary(seeds.map((seed) => playGame(seed, null, 900, mapId, monsterId)));
    console.log(mapId, monsterId, '달리기만 하는 봇', s);
    expect(s.won).toBe(seeds.length);
  });
});

describe('마지막 밤: 둘이 함께 나온다', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
  const ids = roundMonsters(LAST_ROUND);
  const last = (seed, options, onFrame) => playGame(seed, options, 1500, LAST_ROUND.mapId, ids[0], ids, onFrame);

  it('조심하는 봇은 40판 모두 탈출한다', () => {
    const s = summary(seeds.map((seed) => last(seed, { careful: true })));
    console.log('마지막 밤 조심하는 봇', s);
    expect(s.won).toBe(40);
    expect(s.meanCatches).toBeLessThan(8);
  });

  it('달리기만 하는 봇도 40판 모두 탈출한다', () => {
    const s = summary(seeds.map((seed) => last(seed, null)));
    console.log('마지막 밤 달리기만 하는 봇', s);
    expect(s.won).toBe(40);
  });

  it('아이처럼 노는 봇은 40판 모두 탈출한다', () => {
    const s = summary(seeds.map((seed) => last(seed, { child: true })));
    console.log('마지막 밤 아이 봇', s);
    expect(s.won).toBe(40);
    expect(s.minGap).toBeGreaterThanOrEqual(8); // 잡힌 뒤 둘 다 쉬어서 바로 또 잡히지 않는다
  });

  it('둘 다 잠긴 문을 넘어가지 않는다', () => {
    const base = reachable(createRun(ALL_MAPS[LAST_ROUND.mapId].map, k, seeded(1)).level, ALL_MAPS[LAST_ROUND.mapId].map.start);
    for (const seed of seeds.slice(0, 10)) {
      last(seed, { child: true }, (g) => {
        const closed = g.run.doors.every((d) => !d.open);
        if (closed) for (const s of g.stalkers) expect(base.has(`${Math.floor(s.x)},${Math.floor(s.y)}`)).toBe(true);
      });
    }
  });
});

describe.each(MAP_IDS)('아이처럼 노는 봇: %s 맵의 호러워드', (mapId) => {
  // 이 봇은 세이노에게서도 도망치지 않아서 세이노에게 판마다 8번에서 12번 잡힌다. 호러워드도 그만큼이면 된다
  it('언제나 탈출하고 세이노보다 크게 더 잡히지 않는다', () => {
    const s = summary(Array.from({ length: 40 }, (_, i) => playGame(i + 1, { child: true }, 1500, mapId, 'ward')));
    console.log(mapId, 'ward', '아이 봇', s);
    expect(s.won).toBe(40);
    expect(s.meanCatches).toBeLessThanOrEqual(13);
  }, 120000);
});

describe.each(MAP_IDS.flatMap((mapId) => ['gazer', 'maw'].map((monsterId) => [mapId, monsterId])))('아이처럼 노는 봇: %s 맵의 %s', (mapId, monsterId) => {
  it('언제나 탈출하고 평균 1번 이상 잡히되 너무 자주는 아니다', () => {
    const s = summary(Array.from({ length: 40 }, (_, i) => playGame(i + 1, { child: true }, 1500, mapId, monsterId)));
    console.log(mapId, monsterId, '아이 봇', s);
    expect(s.won).toBe(40);
    expect(s.meanCatches).toBeGreaterThanOrEqual(1);
    // 봇은 앞이 안 보이는 큰입이에게도 곧장 달려가 부딪힌다. 닿으면 잡히므로 큰입이만 여유를 둔다
    expect(s.meanCatches).toBeLessThanOrEqual(monsterId === 'maw' ? 6 : 4.5);
  }, 120000);
});

describe('오늘의 밤: 어느 판이든 조건을 지키고 탈출할 수 있다', () => {
  const PAIRS = MAP_IDS.flatMap((mapId) => MONSTER_IDS.map((monsterId) => [mapId, monsterId]));
  const OPTIONS = {
    noLight: { careful: true, noLight: true },
    noRun: { careful: true, noRun: true },
    noShock: { careful: true, noShock: true },
    notes: { careful: true, notes: k.tonight.notes },
  };

  it.each(PAIRS.flatMap((pair) => Object.keys(OPTIONS).map((rule) => [...pair, rule])))('%s 맵의 %s: %s', (mapId, monsterId, rule) => {
    for (const seed of [1, 2, 3, 4]) {
      const game = playGame(seed, OPTIONS[rule], 1500, mapId, monsterId);
      expect(game.won, `씨앗 ${seed}`).toBe(true);
      expect(tonightMet(rule, game.counts, k), `씨앗 ${seed}`).toBe(true);
    }
  });

  // 안 잡히기는 어렵지만 살금살금 다니면 된다. 손전등을 끄고 걷고 괴물이 가까우면 먼저 숨는다
  it.each(PAIRS)('%s 맵의 %s: 안 잡히기', (mapId, monsterId) => {
    const games = Array.from({ length: 8 }, (_, i) => playGame(i + 1, { careful: true, sneak: true, noLight: true }, 1500, mapId, monsterId));
    expect(games.every((r) => r.won)).toBe(true);
    expect(games.filter((r) => tonightMet('noCatch', r.counts, k)).length).toBeGreaterThanOrEqual(4);
  });

  it.each(MAP_IDS)('%s 맵: 쪽지는 읽어야 하는 수보다 많고 모두 갈 수 있다', (mapId) => {
    const { map } = ALL_MAPS[mapId];
    const open = reachable(withOpen(map, map.locks.map((_, i) => i)), map.start);
    const spots = map.notes.filter((c) => open.has(`${c.cx},${c.cy}`));
    expect(spots.length).toBeGreaterThanOrEqual(k.tonight.notes);
    expect(spots).toHaveLength(map.notes.length);
  });
});
