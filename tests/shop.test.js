import { describe, it, expect } from 'vitest';
import { cfg } from '../src/config/index.js';
import { SHOP_IDS, SHOP_INFO, shopEntry, buyItem, shopBonuses, scalePowerTimes, maxRankOf, prices } from '../src/logic/shop.js';
import { stageStars, starCount, starText, totalStars, treasureReward, clearReward, gemsFromProgress } from '../src/logic/rewards.js';
import { createSaveStore, defaultSave, resetProgress } from '../src/logic/save.js';
import { stages } from '../src/stage/index.js';

const memory = () => {
  const m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => (m[k] = v) };
};

describe('상점', () => {
  it('모든 물건에 이름과 값이 있다', () => {
    for (const id of SHOP_IDS) {
      expect(SHOP_INFO[id].name).toBeTruthy();
      expect(maxRankOf(cfg.shop, id)).toBeGreaterThan(0);
      for (const p of prices(cfg.shop, id)) expect(p).toBeGreaterThan(0);
    }
  });

  it('보석이 있으면 사고, 모자라면 못 산다', () => {
    const save = { ...defaultSave(), gems: 10 };
    const patch = buyItem(save, 'hp', cfg.shop);
    expect(patch.gems).toBe(10 - cfg.shop.hp.prices[0]);
    expect(patch.shop.hp).toBe(1);
    expect(buyItem({ ...save, gems: 1 }, 'hp', cfg.shop)).toBeNull();
    expect(buyItem(save, 'fly', cfg.shop)).toBeNull();
  });

  it('다 사면 더 못 산다', () => {
    const save = { ...defaultSave(), gems: 999, shop: { ...defaultSave().shop, tripleJump: 1 } };
    expect(shopEntry(save, 'tripleJump', cfg.shop).maxed).toBe(true);
    expect(buyItem(save, 'tripleJump', cfg.shop)).toBeNull();
  });

  it('산 물건의 효과', () => {
    expect(shopBonuses({}, cfg.shop)).toEqual({ maxHealth: 0, heartChance: 0, heartHeal: 0, powerTimeMultiplier: 1, startShield: false, ultStart: 0, airJumps: 0 });
    const b = shopBonuses({ hp: 2, heart: 1, powerTime: 2, startShield: 1, ultStart: 1, tripleJump: 1 }, cfg.shop);
    expect(b.maxHealth).toBe(2 * cfg.shop.hp.perRank);
    expect(b.powerTimeMultiplier).toBeCloseTo(1.5);
    expect(b.startShield).toBe(true);
    expect(b.airJumps).toBe(1);
    // 저장이 이상하게 커도 상점 단계 수를 넘지 않는다
    expect(shopBonuses({ hp: 9 }, cfg.shop).maxHealth).toBe(maxRankOf(cfg.shop, 'hp') * cfg.shop.hp.perRank);
    expect(scalePowerTimes(cfg.powers, 1.5).star.time).toBeCloseTo(cfg.powers.star.time * 1.5);
  });

  it('보석을 다 모으면 상점을 전부 살 수 있다 (별과 보물만으로)', () => {
    const full = { ...defaultSave(), treasures: stages.flatMap((s) => s.treasures.map((t) => t.id)), flawless: stages.map((_, i) => i + 1) };
    stages.forEach((_, i) => (full.bestTimes[i + 1] = 100));
    const all = SHOP_IDS.reduce((sum, id) => sum + prices(cfg.shop, id).reduce((a, b) => a + b, 0), 0);
    expect(gemsFromProgress(full, stages, cfg.gems)).toBeGreaterThanOrEqual(all);
    // 스테이지 1 만 다 해도 첫 물건 하나는 살 수 있다
    const one = { ...defaultSave(), treasures: stages[0].treasures.map((t) => t.id), bestTimes: { 1: 90 } };
    expect(gemsFromProgress(one, stages, cfg.gems)).toBeGreaterThanOrEqual(Math.min(...SHOP_IDS.map((id) => prices(cfg.shop, id)[0])));
  });
});

describe('별과 보석', () => {
  const st = stages[0];

  it('별 3개: 깨기, 보물 전부, 안 쓰러지고 깨기', () => {
    const save = { ...defaultSave(), bestTimes: { 1: 80 }, treasures: st.treasures.map((t) => t.id), flawless: [1] };
    const stars = stageStars(save, st, 1);
    expect(stars).toEqual({ clear: true, treasures: true, flawless: true });
    expect(starCount(stars)).toBe(3);
    expect(starText(stars)).toBe('★★★');
    expect(starText(stageStars(defaultSave(), st, 1))).toBe('☆☆☆');
    expect(totalStars(save, stages)).toBe(3);
  });

  it('보물: 처음 찾으면 보석, 마지막 보물이면 별 보석도', () => {
    const save = { ...defaultSave(), treasures: st.treasures.slice(0, -1).map((t) => t.id) };
    const last = st.treasures[st.treasures.length - 1].id;
    const r = treasureReward(save, st, 1, last, cfg.gems);
    expect(r.newStars).toEqual(['treasures']);
    expect(r.gems).toBe(cfg.gems.treasure + cfg.gems.star);
    expect(r.patch.gems).toBe(r.gems);
    // 이미 찾은 보물은 보석 없음
    expect(treasureReward({ ...save, treasures: [last] }, st, 1, last, cfg.gems).gems).toBe(0);
  });

  it('클리어: 처음엔 별 보석, 다시 깨면 깨기 보석만, 안 쓰러지면 별 3', () => {
    const first = clearReward(defaultSave(), st, 1, { flawless: false }, cfg.gems);
    expect(first.newStars).toEqual(['clear']);
    expect(first.gems).toBe(cfg.gems.clear + cfg.gems.star);
    const again = clearReward({ ...defaultSave(), bestTimes: { 1: 80 } }, st, 1, { flawless: false }, cfg.gems);
    expect(again.gems).toBe(cfg.gems.clear);
    const clean = clearReward({ ...defaultSave(), bestTimes: { 1: 80 } }, st, 1, { flawless: true }, cfg.gems);
    expect(clean.newStars).toEqual(['flawless']);
    expect(clean.patch.flawless).toEqual([1]);
    expect(clearReward({ ...defaultSave(), bestTimes: { 1: 80 }, flawless: [1] }, st, 1, { flawless: true }, cfg.gems).newStars).toEqual([]);
  });

  it('저장: 보석, 별 3, 상점이 남고, 초기화하면 지워진다', () => {
    const store = createSaveStore(memory());
    store.update({ gems: 12, flawless: [1, 1, 99], shop: { hp: 1, nope: 3 } });
    const d = store.load();
    expect(d.gems).toBe(12);
    expect(d.flawless).toEqual([1]);
    expect(d.shop.hp).toBe(1);
    expect(d.shop.nope).toBeUndefined();
    const r = resetProgress(d);
    expect(r.gems).toBe(0);
    expect(r.flawless).toEqual([]);
    expect(r.shop.hp).toBe(0);
  });

  it('보석이 생기기 전 저장은 지금까지 한 만큼 보석을 받는다', () => {
    const s = memory();
    s.setItem('shock-hero-save-v1', JSON.stringify({ level: 3, treasures: [st.treasures[0].id], bestTimes: { 1: 90 } }));
    const store = createSaveStore(s, { gemsFor: (save) => gemsFromProgress(save, stages, cfg.gems) });
    expect(store.load().gems).toBe(cfg.gems.treasure + cfg.gems.clear + cfg.gems.star);
    // 한 번 저장한 뒤에는 다시 계산하지 않는다
    store.update({ gems: 1 });
    expect(store.load().gems).toBe(1);
  });
});
