import { describe, it, expect } from 'vitest';
import { createNotes, takeNote } from '../src/logic/horrorNotes.js';
import { createRun, takeFuse, takeKey, openDoor, keysHeld, respawnSpot, chargeShock, useShock, insertFuses, caught, escape, escapeReward, nearestUse, normalizeHorror, recordEscape, emptyHorror } from '../src/logic/horrorRun.js';
import { reachable, parseMap, blocked, lineOfSight, withOpen, findPath } from '../src/logic/horrorGrid.js';
import { createSaveStore } from '../src/logic/save.js';
import { factoryMap } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const DAY1 = '2026-11-01';
const DAY2 = '2026-11-02';
const k = balance.horror;
const fresh = () => createRun(factoryMap, k, () => 0.3);
const allOpen = withOpen(factoryMap, [0, 1]);
const onCell = (c) => ({ x: c.cx + 0.5, y: c.cy + 0.5 });

// 작은 씨앗 난수
function seeded(seed) {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

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
    const open = reachable(allOpen, factoryMap.start);
    for (let i = 0; i < 50; i++) {
      for (const f of createRun(factoryMap, k).fuses) expect(open.has(`${f.cx},${f.cy}`)).toBe(true);
    }
  });

  it('실제 공장 맵에는 퓨즈 자리 후보가 정해진 수 이상 걸어갈 수 있는 곳에 있다', () => {
    const open = reachable(allOpen, factoryMap.start);
    const usable = factoryMap.fuses.filter((c) => open.has(`${c.cx},${c.cy}`));
    expect(usable.length).toBeGreaterThanOrEqual(k.fuseCount);
  });

  it('자리 후보가 모자라면 판을 만들지 않고 오류를 낸다', () => {
    // S 와 F 사이가 벽으로 막혀 있어 F 에 갈 수 없다
    const broken = parseMap(['#####', '#S#F#', '#####']);
    expect(() => createRun(broken, k, () => 0.3)).toThrow();
  });

  it('한 번만 주울 수 있다', () => {
    const run = fresh();
    expect(takeFuse(run, 0)).toBe(true);
    expect(takeFuse(run, 0)).toBe(false);
    expect(run.have).toBe(1);
  });
});

describe('열쇠와 잠긴 문', () => {
  const wingOf = (lock) => {
    const base = reachable(factoryMap, factoryMap.start);
    return new Set([...reachable(withOpen(factoryMap, [lock]), factoryMap.start)].filter((c) => !base.has(c)));
  };
  const has = (set, c) => set.has(`${c.cx},${c.cy}`);

  it('어떤 판이든 열쇠 1, 날개 1, 열쇠 2, 날개 2 순서로 다 풀린다', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const run = createRun(factoryMap, k, seeded(seed));
      const m = run.level;
      for (let lock = 0; lock < run.keys.length; lock++) {
        expect(reachable(m, m.start).has(`${run.keys[lock].cx},${run.keys[lock].cy}`), `seed ${seed}`).toBe(true);
        takeKey(run, lock);
        expect(openDoor(run, lock)).toBe(true);
      }
      const open = reachable(m, m.start);
      for (const f of run.fuses) expect(has(open, f)).toBe(true);
      expect(new Set(run.keys.map((c) => `${c.cx},${c.cy}`)).size).toBe(run.keys.length);
    }
  });

  it('열쇠는 자기가 여는 날개 안에 없고, 2번 열쇠는 날개 1 에 나올 수 있다', () => {
    const wing1 = wingOf(0);
    const wing2 = wingOf(1);
    let inWing1 = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { keys } = createRun(factoryMap, k, seeded(seed));
      expect(has(wing1, keys[0])).toBe(false);
      expect(has(wing2, keys[0])).toBe(false);
      expect(has(wing2, keys[1])).toBe(false);
      if (has(wing1, keys[1])) inWing1 += 1;
    }
    expect(inWing1).toBeGreaterThan(0);
  });

  it('두 날개에 퓨즈가 꼭 들어가서 문을 열어야만 끝난다', () => {
    const wings = [wingOf(0), wingOf(1)];
    for (let seed = 1; seed <= 300; seed++) {
      const { fuses } = createRun(factoryMap, k, seeded(seed));
      for (const wing of wings) expect(fuses.filter((f) => has(wing, f)).length).toBeGreaterThanOrEqual(k.wingFuses);
    }
  });

  it('열쇠가 있어야 열리고, 맞는 문만 열린다', () => {
    const run = fresh();
    expect(openDoor(run, 0)).toBe(false);
    takeKey(run, 0);
    expect(takeKey(run, 0)).toBe(false);
    expect(openDoor(run, 1)).toBe(false);
    expect(keysHeld(run)).toBe(1);
    expect(openDoor(run, 0)).toBe(true);
    expect(openDoor(run, 0)).toBe(false);
    expect(keysHeld(run)).toBe(0);
  });

  it('문을 열면 주인공, 시선, 세이노 모두 지나가고 원본 맵은 그대로다', () => {
    const run = fresh();
    const m = run.level;
    const door = run.doors[0];
    const behind = { cx: door.cx, cy: door.cy - 1 };
    const front = { cx: door.cx, cy: door.cy + 1 };
    expect(findPath(m, m.stalker, behind)).toBeNull();
    expect(lineOfSight(m, onCell(front), onCell(behind))).toBe(false);
    takeKey(run, 0);
    openDoor(run, 0);
    expect(blocked(m, door.cx, door.cy)).toBe(false);
    expect(findPath(m, m.stalker, behind)).not.toBeNull();
    expect(lineOfSight(m, onCell(front), onCell(behind))).toBe(true);
    expect(blocked(factoryMap, door.cx, door.cy)).toBe(true);
    expect(factoryMap.locked.size).toBe(2);
  });

  it('두 판은 서로의 문을 열지 않는다', () => {
    const a = fresh();
    const b = fresh();
    takeKey(a, 0);
    openDoor(a, 0);
    expect(blocked(b.level, b.doors[0].cx, b.doors[0].cy)).toBe(true);
  });

  it('세이노 순찰은 닫힌 날개를 빼고, 문이 열리면 그 날개가 더해진다', () => {
    const run = fresh();
    const wing = wingOf(0);
    const count = run.level.patrol.length;
    expect(run.level.patrol.some((c) => has(wing, c))).toBe(false);
    expect(run.level.patrol.length).toBeLessThan(factoryMap.patrol.length);
    takeKey(run, 0);
    openDoor(run, 0);
    expect(run.level.patrol.some((c) => has(wing, c))).toBe(true);
    expect(run.level.patrol.length).toBeGreaterThan(count);
  });

  it('문 앞에서는 열쇠가 없으면 안내만, 있으면 열기를 고른다', () => {
    const run = fresh();
    const door = run.doors[0];
    const p = { x: door.cx + 0.5, y: door.cy + 1.3 };
    expect(nearestUse(run, run.level, p, null, k)).toEqual({ kind: 'locked', index: 0, label: '빨간 열쇠가 필요해' });
    takeKey(run, 0);
    expect(nearestUse(run, run.level, p, null, k)).toEqual({ kind: 'lock', index: 0, label: '문 열기' });
    openDoor(run, 0);
    expect(nearestUse(run, run.level, p, null, k)?.kind).not.toBe('lock');
  });

  it('열쇠를 주울 수 있고 주운 뒤에는 고르지 않는다', () => {
    const run = fresh();
    const p = onCell(run.keys[0]);
    expect(nearestUse(run, run.level, p, null, k).kind).toBe('key');
    takeKey(run, 0);
    expect(nearestUse(run, run.level, p, null, k)?.kind).not.toBe('key');
  });

  it('열쇠 자리가 모자라면 판을 만들지 않는다', () => {
    const noKey = parseMap(['#########', '#SF.A.F.#', '#.#####F#', '#########']);
    expect(() => createRun(noKey, { ...k, fuseCount: 2 }, () => 0.3)).toThrow();
  });

  it('잠긴 문이 없는 맵도 그대로 돈다', () => {
    const plain = parseMap(['#######', '#SFFFM#', '#######']);
    const run = createRun(plain, k, () => 0.3);
    expect(run.fuses).toHaveLength(k.fuseCount);
    expect(run.keys).toEqual([]);
  });
});

describe('돌아올 곳', () => {
  it('잡힌 자리에서 가장 가까운 곳을 고른다', () => {
    const m = factoryMap;
    expect(respawnSpot(m, onCell(m.start))).toEqual(m.start);
    for (const c of m.returns) expect(respawnSpot(m, onCell(c))).toEqual(c);
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

  const poweredRun = () => {
    const run = allFuses();
    insertFuses(run, k);
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

  it('전원을 여러 번 넣어도 그대로 켜져 있다', () => {
    const run = allFuses();
    expect(insertFuses(run, k)).toBe(true);
    expect(insertFuses(run, k)).toBe(true);
    expect(run.powered).toBe(true);
    expect(run.have).toBe(k.fuseCount);
  });

  it('잡혀도 찾은 퓨즈는 남는다', () => {
    const run = fresh();
    takeFuse(run, 0);
    caught(run);
    expect(run.have).toBe(1);
    expect(run.caughtCount).toBe(1);
  });

  it('안 잡히고 탈출하면 clean 이다', () => {
    expect(escape(poweredRun())).toEqual({ clean: true });
  });

  it('잡힌 적이 있으면 clean 이 아니다', () => {
    const run = poweredRun();
    caught(run);
    expect(escape(run)).toEqual({ clean: false });
  });

  it('전원이 없으면 탈출 표시가 되지 않는다', () => {
    const run = allFuses();
    expect(escape(run)).toBeNull();
    expect(run.escaped).toBe(false);
  });

  it('탈출은 한 번만 된다', () => {
    const run = poweredRun();
    expect(escape(run)).toEqual({ clean: true });
    expect(escape(run)).toBeNull();
    expect(run.escaped).toBe(true);
  });
});

describe('저장', () => {
  it('기록을 더한다', () => {
    expect(recordEscape(emptyHorror(), true, DAY1)).toEqual({ ...emptyHorror(), escapes: 1, cleanEscapes: 1, gemDay: DAY1 });
    expect(recordEscape({ escapes: 2, cleanEscapes: 1, gemDay: DAY1 }, false, DAY2)).toEqual({ escapes: 3, cleanEscapes: 1, gemDay: DAY2 });
  });

  it('이상한 값은 0 으로 읽는다', () => {
    expect(normalizeHorror(null)).toEqual(emptyHorror());
    expect(normalizeHorror({ escapes: -1, cleanEscapes: 'a' })).toEqual(emptyHorror());
  });

  it('깨끗한 탈출 수는 전체 탈출 수를 넘지 않는다', () => {
    expect(normalizeHorror({ escapes: 1, cleanEscapes: 5 })).toEqual({ ...emptyHorror(), escapes: 1, cleanEscapes: 1 });
    expect(normalizeHorror({ escapes: 0, cleanEscapes: 2 })).toEqual(emptyHorror());
  });

  it('예전 저장을 읽고, 새 기록을 저장한다', () => {
    const box = {};
    const storage = { getItem: (key) => box[key] ?? null, setItem: (key, v) => { box[key] = v; } };
    const store = createSaveStore(storage);
    box['shock-hero-save-v1'] = JSON.stringify({ level: 3 });
    const old = store.load();
    expect(old.horror).toEqual(emptyHorror());
    old.horror = { escapes: 1, cleanEscapes: 1, gemDay: DAY1 };
    store.save(old);
    expect(store.load().horror).toEqual({ ...emptyHorror(), escapes: 1, cleanEscapes: 1, gemDay: DAY1 });
  });

  it('날짜가 없는 예전 기록은 보석을 아직 안 받은 것으로 읽는다', () => {
    const old = normalizeHorror({ escapes: 4, cleanEscapes: 1 });
    expect(old.gemDay).toBeNull();
    expect(escapeReward(old, false, DAY1, k).daily).toBe(k.gemsEscape);
  });

  it('지난 판을 지키고, 모르는 맵이나 괴물은 버린다', () => {
    const last = { mapId: 'sewer', monsterId: 'maw' };
    expect(normalizeHorror({ last }).last).toEqual(last);
    expect(recordEscape({ ...emptyHorror(), last }, false, DAY1).last).toEqual(last);
    for (const bad of [null, 'sewer', { mapId: 'moon', monsterId: 'maw' }, { mapId: 'sewer' }]) expect(normalizeHorror({ last: bad }).last).toBeNull();
  });

  it('이상한 날짜는 버린다', () => {
    for (const gemDay of [20261101, 'tomorrow', '', {}]) expect(normalizeHorror({ gemDay }).gemDay).toBeNull();
  });
});

describe('탈출 보석', () => {
  const after = (record, clean, today) => recordEscape(record, clean, today);

  it('처음 탈출은 탈출 보석을 받고, 안 잡혔으면 보너스도 받는다', () => {
    expect(escapeReward(emptyHorror(), false, DAY1, k)).toEqual({ daily: k.gemsEscape, bonus: 0, gems: k.gemsEscape });
    expect(escapeReward(emptyHorror(), true, DAY1, k)).toEqual({ daily: k.gemsEscape, bonus: k.gemsClean, gems: k.gemsEscape + k.gemsClean });
  });

  it('같은 날 두 번째 탈출은 보석이 없다', () => {
    const r = after(emptyHorror(), true, DAY1);
    expect(escapeReward(r, true, DAY1, k)).toEqual({ daily: 0, bonus: 0, gems: 0 });
    expect(escapeReward(r, false, DAY1, k).gems).toBe(0);
  });

  it('다음 날에는 탈출 보석을 다시 받는다', () => {
    const r = after(emptyHorror(), false, DAY1);
    expect(escapeReward(r, false, DAY2, k).gems).toBe(k.gemsEscape);
  });

  it('안 잡힌 보너스는 처음 한 번뿐이다', () => {
    const r = after(emptyHorror(), true, DAY1);
    expect(escapeReward(r, true, DAY2, k)).toEqual({ daily: k.gemsEscape, bonus: 0, gems: k.gemsEscape });
  });

  it('탈출 보석을 이미 받은 날에도 처음 안 잡히면 보너스는 받는다', () => {
    const r = after(emptyHorror(), false, DAY1);
    expect(escapeReward(r, true, DAY1, k)).toEqual({ daily: 0, bonus: k.gemsClean, gems: k.gemsClean });
  });

  it('보석 없이 다시 탈출해도 횟수는 늘고 날짜는 그대로다', () => {
    const r = after(after(emptyHorror(), true, DAY1), true, DAY1);
    expect(r).toEqual({ ...emptyHorror(), escapes: 2, cleanEscapes: 2, gemDay: DAY1 });
  });
});

describe('손이 닿는 것 고르기', () => {
  const beside = (c) => ({ x: c.cx - 0.5, y: c.cy + 0.5 }); // 왼쪽 칸 가운데

  it('멀면 아무것도 없다', () => {
    expect(nearestUse(fresh(), factoryMap, { x: 3.5, y: 22.5 }, null, k)).toBe(null);
  });

  it('숨어 있으면 나오기만 할 수 있다', () => {
    expect(nearestUse(fresh(), factoryMap, { x: 3.5, y: 22.5 }, 2, k)).toEqual({ kind: 'locker', index: 2, label: '사물함에서 나오기' });
  });

  it('주운 퓨즈는 고르지 않는다', () => {
    const run = fresh();
    const f = run.fuses[0];
    const p = { x: f.cx + 0.5, y: f.cy + 0.5 };
    expect(nearestUse(run, factoryMap, p, null, k).kind).toBe('fuse');
    takeFuse(run, 0);
    expect(nearestUse(run, factoryMap, p, null, k)?.kind).not.toBe('fuse');
  });

  it('쇼크가 있거나 쓴 상자는 고르지 않는다', () => {
    const run = fresh();
    const p = { x: 2.5, y: 25.5 }; // 시작 방 전기 상자 옆
    expect(nearestUse(run, factoryMap, p, null, k).kind).toBe('box');
    chargeShock(run, factoryMap.boxes.findIndex((c) => c.cx === 1 && c.cy === 25));
    expect(nearestUse(run, factoryMap, p, null, k)).toBe(null);
    useShock(run);
    expect(nearestUse(run, factoryMap, p, null, k)).toBe(null);
  });

  it('전원은 퓨즈가 모자라면 안내만, 켠 뒤에는 정문을 고른다', () => {
    const run = fresh();
    const p = beside(factoryMap.panel);
    expect(nearestUse(run, factoryMap, p, null, k).label).toBe(`퓨즈가 ${k.fuseCount}개 필요해`);
    run.have = k.fuseCount;
    expect(nearestUse(run, factoryMap, p, null, k).label).toBe('퓨즈 꽂기');
    insertFuses(run, k);
    expect(nearestUse(run, factoryMap, beside(factoryMap.gate), null, k).kind).toBe('gate');
  });

  it('쪽지는 거리로 겨루고, 주운 뒤나 숨은 동안에는 고르지 않는다', () => {
    const run = createRun(factoryMap, k, () => 0.3);
    const locker = factoryMap.lockers[0];
    const spot = { x: locker.cx + 1.5, y: locker.cy + 0.5 };
    const notes = createNotes([spot], () => 0);
    expect(nearestUse(run, factoryMap, spot, null, k, notes)).toEqual({ kind: 'note', index: 0, label: '쪽지 읽기' });
    // 사물함에 더 가까우면 쪽지가 숨기를 가로막지 않는다
    expect(nearestUse(run, factoryMap, { x: locker.cx + 0.9, y: locker.cy + 0.5 }, null, k, notes).kind).toBe('locker');
    expect(nearestUse(run, factoryMap, spot, 0, k, notes).kind).toBe('locker');
    takeNote(notes, 0);
    expect(nearestUse(run, factoryMap, spot, null, k, notes)?.kind).not.toBe('note');
  });
});
