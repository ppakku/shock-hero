import { describe, it, expect } from 'vitest';
import { createRun, takeFuse, chargeShock, useShock, insertFuses, caught, escape, nearestUse, normalizeHorror, recordEscape, emptyHorror } from '../src/logic/horrorRun.js';
import { reachable, parseMap } from '../src/logic/horrorGrid.js';
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

  it('실제 공장 맵에는 퓨즈 자리 후보가 정해진 수 이상 걸어갈 수 있는 곳에 있다', () => {
    const open = reachable(factoryMap, factoryMap.start);
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

  it('안 잡히고 탈출하면 추가 보석', () => {
    expect(escape(poweredRun(), k)).toEqual({ gems: k.gemsEscape + k.gemsClean, clean: true });
  });

  it('잡힌 적이 있으면 기본 보석만', () => {
    const run = poweredRun();
    caught(run);
    expect(escape(run, k)).toEqual({ gems: k.gemsEscape, clean: false });
  });

  it('전원이 없으면 탈출 보상이 없고 탈출 표시도 되지 않는다', () => {
    const run = allFuses();
    expect(escape(run, k)).toBeNull();
    expect(run.escaped).toBe(false);
  });

  it('탈출 보상은 한 번만 준다', () => {
    const run = poweredRun();
    expect(escape(run, k)).toEqual({ gems: k.gemsEscape + k.gemsClean, clean: true });
    expect(escape(run, k)).toBeNull();
    expect(run.escaped).toBe(true);
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

  it('깨끗한 탈출 수는 전체 탈출 수를 넘지 않는다', () => {
    expect(normalizeHorror({ escapes: 1, cleanEscapes: 5 })).toEqual({ escapes: 1, cleanEscapes: 1 });
    expect(normalizeHorror({ escapes: 0, cleanEscapes: 2 })).toEqual(emptyHorror());
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

describe('손이 닿는 것 고르기', () => {
  const beside = (c) => ({ x: c.cx - 0.5, y: c.cy + 0.5 }); // 왼쪽 칸 가운데

  it('멀면 아무것도 없다', () => {
    expect(nearestUse(fresh(), factoryMap, { x: 3.5, y: 15.5 }, null, k)).toBe(null);
  });

  it('숨어 있으면 나오기만 할 수 있다', () => {
    expect(nearestUse(fresh(), factoryMap, { x: 3.5, y: 15.5 }, 2, k)).toEqual({ kind: 'locker', index: 2, label: '사물함에서 나오기' });
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
    const p = { x: 2.5, y: 17.5 }; // 시작 방 전기 상자 옆
    expect(nearestUse(run, factoryMap, p, null, k).kind).toBe('box');
    chargeShock(run, factoryMap.boxes.findIndex((c) => c.cx === 1 && c.cy === 17));
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
});
