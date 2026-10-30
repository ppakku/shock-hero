import { describe, it, expect } from 'vitest';
import { MONSTER_DEX, dexIdFor, monsterStages, bossDex, normalizeDex, dexReward, dexCounts, emptyDex } from '../src/logic/dex.js';
import { stages } from '../src/stage/index.js';
import { customArt } from '../src/config/art.js';

describe('몬스터 도감', () => {
  it('칸은 20개, 이름이 겹치지 않는다', () => {
    expect(MONSTER_DEX).toHaveLength(20);
    expect(new Set(MONSTER_DEX.map((e) => e.id)).size).toBe(20);
  });

  it('스테이지 몬스터는 모두 도감 칸이 있다 (스킨, 물속 꽃게 포함)', () => {
    const ids = new Set(MONSTER_DEX.map((e) => e.id));
    const where = monsterStages(stages);
    for (const id of Object.keys(where)) expect(ids.has(id), id).toBe(true);
    expect(where.monster_lava_basic).toContain(3);
    expect(where.monster_ice_tank).toContain(4);
    expect(where.monster_crab).toContain(6);
  });

  it('스테이지 스킨과 물속 규칙을 따른다', () => {
    expect(dexIdFor(stages[2], 'basic')).toBe('monster_lava_basic');
    expect(dexIdFor(stages[2], 'fast')).toBe('monster_fast');
    expect(dexIdFor(stages[5], 'basic')).toBe('monster_crab');
    expect(dexIdFor(stages[0], 'tank')).toBe('monster_tank');
  });

  it('보스 20마리 모두 그림이 있다', () => {
    const b = bossDex(stages);
    expect(b).toHaveLength(stages.length);
    for (const e of b) expect(customArt[e.portrait], `${e.stage} ${e.portrait}`).toBeTruthy();
  });

  it('처음 잡으면 등록하고 보석, 다시 잡으면 수만 센다', () => {
    const gems = { dexMonster: 1, dexBoss: 3 };
    let save = { gems: 5, dex: emptyDex() };
    const r1 = dexReward(save, 'monster', 'monster', gems);
    expect(r1.isNew).toBe(true);
    expect(r1.patch.gems).toBe(6);
    save = { ...save, ...r1.patch };
    const r2 = dexReward(save, 'monster', 'monster', gems);
    expect(r2.isNew).toBe(false);
    expect(r2.patch.dex.monsters.monster).toBe(2);
    expect(r2.patch.gems).toBeUndefined();
    const r3 = dexReward(save, 'boss', 3, gems);
    expect(r3.gems).toBe(3);
    save = { ...save, ...r3.patch };
    expect(dexReward(save, 'boss', 3, gems).patch).toEqual({});
    expect(dexCounts(save, 20)).toMatchObject({ monsters: 1, bosses: 1 });
  });

  it('모르는 몬스터와 이상한 저장 값은 버린다', () => {
    expect(dexReward({ dex: emptyDex() }, 'monster', 'nope', {}).patch).toEqual({});
    expect(normalizeDex({ monsters: { monster: 3, nope: 2, monster_fast: -1 }, bosses: [1, 1, 0, 'x', 21] }, 20)).toEqual({ monsters: { monster: 3 }, bosses: [1] });
    expect(normalizeDex(null)).toEqual(emptyDex());
  });
});

import { applyGuestReward } from '../src/logic/coopRewards.js';
import { cfg } from '../src/config/index.js';
import { defaultSave } from '../src/logic/save.js';

describe('함께하기 친구 도감', () => {
  it('방장이 잡은 몬스터와 보스가 친구 도감에도 적힌다', () => {
    const save = defaultSave();
    const m = applyGuestReward(save, { kind: 'dexMonster', id: 'monster_ice_tank' }, null, cfg);
    expect(m.patch.dex.monsters.monster_ice_tank).toBe(1);
    expect(m.text).toContain('설인 뚱보');
    const b = applyGuestReward(save, { kind: 'dexBoss', stage: 4 }, stages[3], cfg);
    expect(b.patch.dex.bosses).toEqual([4]);
    expect(b.gems).toBe(cfg.gems.dexBoss);
  });
});

import { dexFromProgress } from '../src/logic/dex.js';
import { createSaveStore } from '../src/logic/save.js';

describe('도감 전 저장', () => {
  it('깬 스테이지의 몬스터와 보스를 채운다', () => {
    const d = dexFromProgress({ bestTimes: { 1: 90, 3: 120 } }, stages);
    expect(d.bosses).toEqual([1, 3]);
    expect(d.monsters.monster).toBeGreaterThan(0);
    expect(d.monsters.monster_lava_basic).toBeGreaterThan(0);
    expect(d.monsters.monster_ice_basic).toBeUndefined();
  });

  it('도감이 없는 예전 저장만 채우고, 이미 있으면 그대로', () => {
    const mem = {};
    const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = v) };
    const store = createSaveStore(storage, { dexFor: (s) => dexFromProgress(s, stages) });
    mem['shock-hero-save-v1'] = JSON.stringify({ bestTimes: { 2: 80 }, unlocked: 3 });
    expect(store.load().dex.bosses).toEqual([2]);
    mem['shock-hero-save-v1'] = JSON.stringify({ bestTimes: { 2: 80 }, unlocked: 3, dex: { monsters: {}, bosses: [] } });
    expect(store.load().dex.bosses).toEqual([]);
  });
});
