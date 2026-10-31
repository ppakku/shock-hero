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
