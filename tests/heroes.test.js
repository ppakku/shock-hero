import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { createSaveStore } from '../src/logic/save.js';
import { shieldResult } from '../src/logic/monsters.js';
import {
  HERO_IDS, normalizeHero, cycleHero, heroStats, gunnerAttack, giantAttack, beamRect, smashRect, spinRect, spinHits, rushAttack, rainStrikeXs,
} from '../src/logic/heroes.js';

const cfg = sanitizeNumbers(balance, () => {});
const full = cfg.charge.fullTime + 1;

describe('주인공 고르기', () => {
  it('모르는 이름은 쇼크 히어로', () => {
    expect(normalizeHero('ninja')).toBe('shock');
    expect(normalizeHero(undefined)).toBe('shock');
    for (const id of HERO_IDS) expect(normalizeHero(id)).toBe(id);
  });

  it('다음, 이전으로 돌아가며 고른다', () => {
    expect(cycleHero('shock', 1)).toBe('gunner');
    expect(cycleHero('giant', 1)).toBe('shock');
    expect(cycleHero('shock', -1)).toBe('giant');
  });

  it('고른 주인공이 저장되고, 예전 저장은 쇼크 히어로', () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const store = createSaveStore(storage);
    expect(store.load().settings.hero).toBe('shock');
    store.update({ settings: { ...store.load().settings, hero: 'giant' } });
    expect(store.load().settings.hero).toBe('giant');
    store.update({ settings: { ...store.load().settings, hero: 'robot' } });
    expect(store.load().settings.hero).toBe('shock');
  });

  it('번개 사수는 체력이 적고, 강철 거인은 많고 느리다', () => {
    const shock = heroStats('shock', cfg);
    const gunner = heroStats('gunner', cfg);
    const giant = heroStats('giant', cfg);
    expect(shock).toEqual({ health: 1, move: 1, jump: 1, scale: 1 });
    expect(gunner.health).toBeLessThan(1);
    expect(giant.health).toBeGreaterThan(1);
    expect(giant.move).toBeLessThan(1);
    expect(giant.scale).toBeGreaterThan(1);
  });
});

describe('번개 사수', () => {
  it('짧게 떼면 번개탄 (방패는 못 뚫음)', () => {
    const a = gunnerAttack(0.05, cfg);
    expect(a.style).toBe('bolt');
    expect(a.kind).toBe('shot');
    expect(a.damage).toBe(cfg.heroes.gunner.boltDamage);
    expect(shieldResult(a.kind, 1, -1, true)).toBe('blocked');
  });

  it('위를 누르면 번개탄도 위로', () => {
    expect(gunnerAttack(0.05, cfg, 1, { up: true }).up).toBe(true);
  });

  it('꾹 누르면 레이저, 최대 충전이면 가장 세고 굵고 방패를 깬다', () => {
    const low = gunnerAttack(cfg.charge.minTime + 0.01, cfg);
    const max = gunnerAttack(full, cfg);
    expect(max.style).toBe('beam');
    expect(max.full).toBe(true);
    expect(max.damage).toBe(cfg.heroes.gunner.beamMaxDamage);
    expect(max.width).toBeGreaterThan(low.width);
    expect(shieldResult(max.kind, 1, -1, true)).toBe('break');
  });

  it('레이저는 앞으로 길게, 위로 쏘면 세로로', () => {
    const right = beamRect(100, 400, 1, 600, 20, false);
    expect(right.x).toBeGreaterThan(100);
    expect(right.w).toBe(600);
    const left = beamRect(1000, 400, -1, 600, 20, false);
    expect(left.x + left.w).toBeLessThan(1000);
    const up = beamRect(100, 400, 1, 600, 20, true);
    expect(up.h).toBe(600);
    expect(up.y + up.h).toBeLessThan(400);
  });

  it('번개비: 적마다 한 줄기, 모자라면 화면에 고르게 채운다', () => {
    const xs = rainStrikeXs([300, 500], 0, 900, 5);
    expect(xs.length).toBe(5);
    expect(xs.slice(0, 2)).toEqual([300, 500]);
    expect(xs.slice(2).every((x) => x > 0 && x < 900)).toBe(true);
    expect(rainStrikeXs([1, 2, 3, 4, 5, 6], 0, 900, 3).length).toBe(6);
  });
});

describe('강철 거인', () => {
  it('짧게 떼면 망치 내려찍기, 방패를 깬다', () => {
    const a = giantAttack(0.05, cfg);
    expect(a.style).toBe('smash');
    expect(a.damage).toBe(cfg.heroes.giant.smashDamage);
    expect(a.damage).toBeGreaterThan(cfg.punch.damage);
    expect(shieldResult(a.kind, 1, -1, true)).toBe('break');
  });

  it('위를 누르면 망치 올려치기', () => {
    const a = giantAttack(0.05, cfg, 1, { up: true });
    expect(a.style).toBe('hammerUp');
    expect(a.kind).toBe('upper');
  });

  it('꾹 누르면 회오리, 오래 누를수록 오래 돈다', () => {
    const low = giantAttack(cfg.charge.minTime + 0.01, cfg);
    const max = giantAttack(full, cfg);
    expect(max.style).toBe('spin');
    expect(low.time).toBeCloseTo(cfg.heroes.giant.spinMinTime, 1);
    expect(max.time).toBe(cfg.heroes.giant.spinMaxTime);
    expect(spinHits(max.time, cfg.heroes.giant.spinTick)).toBeGreaterThan(spinHits(low.time, cfg.heroes.giant.spinTick));
  });

  it('망치는 키보다 높게, 회오리는 양쪽 다 닿는다', () => {
    const r = smashRect(100, 400, 1, 90, 120);
    expect(r.x).toBeGreaterThan(100);
    expect(r.h).toBe(120);
    const s = spinRect(100, 400, 80);
    expect(s.x).toBeLessThan(100);
    expect(s.x + s.w).toBeGreaterThan(100);
  });

  it('몸통 박치기도 공격력 배수를 받는다', () => {
    expect(rushAttack(cfg, 2).damage).toBe(cfg.heroes.giant.rushDamage * 2);
  });

  it('공격력 배수가 모든 공격에 붙는다', () => {
    expect(gunnerAttack(full, cfg, 2).damage).toBe(cfg.heroes.gunner.beamMaxDamage * 2);
    expect(giantAttack(0.05, cfg, 2).damage).toBe(cfg.heroes.giant.smashDamage * 2);
  });
});
