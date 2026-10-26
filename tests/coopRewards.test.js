import { describe, it, expect } from 'vitest';
import { cfg } from '../src/config/index.js';
import { defaultSave } from '../src/logic/save.js';
import { stages } from '../src/stage/index.js';
import { guestProfile, cleanProfile, applyGuestReward } from '../src/logic/coopRewards.js';

const stage1 = stages[0];

describe('함께하기 친구 정보', () => {
  it('저장에서 주인공, 레벨, 강화, 상점을 뽑는다', () => {
    const save = { ...defaultSave(), level: 4, xp: 7, settings: { ...defaultSave().settings, hero: 'giant' } };
    const p = guestProfile(save);
    expect(p.hero).toBe('giant');
    expect(p.level).toBe(4);
    expect(p.xp).toBe(7);
  });

  it('이상한 값은 기본값으로 고친다', () => {
    const p = cleanProfile({ hero: 'nobody', level: -3, xp: 'a', upgrades: { attack: 99 }, shop: { hp: 'x' } }, 5);
    expect(p.hero).toBe('shock');
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.upgrades.attack).toBe(5);
    expect(p.shop.hp).toBe(0);
    expect(cleanProfile(null).level).toBe(1);
  });
});

describe('함께하기 친구 보상', () => {
  it('보물: 처음 찾은 보물이면 친구도 보석을 받는다', () => {
    const save = defaultSave();
    const id = stage1.treasures[0].id;
    const r = applyGuestReward(save, { kind: 'treasure', stage: 1, id }, stage1, cfg);
    expect(r.patch.treasures).toContain(id);
    expect(r.gems).toBeGreaterThan(0);
    // 이미 찾은 보물이면 아무것도 없다
    const again = applyGuestReward({ ...save, ...r.patch }, { kind: 'treasure', stage: 1, id }, stage1, cfg);
    expect(again.gems).toBe(0);
    expect(again.patch).toEqual({});
  });

  it('경험치: 레벨이 오르면 고를 카드가 쌓인다', () => {
    const save = defaultSave();
    const r = applyGuestReward(save, { kind: 'xp', amount: 10000 }, null, cfg);
    expect(r.patch.level).toBeGreaterThan(1);
    expect(r.patch.picksPending).toBeGreaterThan(0);
    expect(r.text).toMatch(/레벨 업/);
  });

  it('클리어: 다음 스테이지가 열리고 별과 보석을 받는다', () => {
    const save = defaultSave();
    const r = applyGuestReward(save, { kind: 'clear', stage: 1, time: 90, flawless: true }, stage1, cfg);
    expect(r.patch.unlocked).toBe(2);
    expect(r.patch.bestTimes[1]).toBe(90);
    expect(r.patch.flawless).toContain(1);
    expect(r.patch.gems).toBeGreaterThan(save.gems || 0);
  });

  it('모르는 소식은 무시한다', () => {
    expect(applyGuestReward(defaultSave(), { kind: 'zzz' }, null, cfg)).toEqual({ patch: {}, gems: 0, text: '' });
  });
});
