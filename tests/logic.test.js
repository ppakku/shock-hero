import { describe, it, expect, vi } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { Health } from '../src/logic/health.js';
import { Cooldown } from '../src/logic/cooldown.js';
import { chargeRatio, resolveAttack } from '../src/logic/combat.js';
import { addXp, xpToNext, maxHealthFor, damageMultiplierFor } from '../src/logic/progression.js';
import { createSaveStore, defaultSave } from '../src/logic/save.js';
import { chooseBossAttack, bossSpeedMultiplier, coreDamage, rockTargets } from '../src/logic/boss.js';

const cfg = sanitizeNumbers(balance, () => {});

describe('sanitizeNumbers', () => {
  it('고칠 게 없으면 그대로 둔다', () => {
    const warn = vi.fn();
    expect(sanitizeNumbers(balance, warn)).toEqual(balance);
    expect(warn).not.toHaveBeenCalled();
  });

  it('음수, 숫자 아닌 값, 따옴표 숫자를 고친다', () => {
    const warn = vi.fn();
    const out = sanitizeNumbers({ a: { b: -5, c: NaN, d: '12', e: true } }, warn);
    expect(out).toEqual({ a: { b: 5, c: 0, d: 12, e: true } });
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

describe('Health', () => {
  it('피해와 회복은 0과 최대값 사이에 머문다', () => {
    const h = new Health(100);
    expect(h.damage(30)).toBe(30);
    expect(h.heal(50)).toBe(30);
    expect(h.damage(500)).toBe(100);
    expect(h.isDead).toBe(true);
    expect(h.heal(10)).toBe(0);
  });

  it('최대 체력 0 은 1 로 막는다', () => {
    expect(new Health(0).max).toBe(1);
  });
});

describe('Cooldown', () => {
  it('시간이 지나면 다시 쓸 수 있다', () => {
    const c = new Cooldown(0.5);
    c.trigger();
    expect(c.ready).toBe(false);
    c.update(0.25);
    expect(c.progress).toBeCloseTo(0.5);
    c.update(0.3);
    expect(c.ready).toBe(true);
  });

  it('길이 0 이면 언제나 준비 상태', () => {
    const c = new Cooldown(0);
    c.trigger();
    expect(c.ready).toBe(true);
    expect(c.progress).toBe(1);
  });
});

describe('충전 펀치', () => {
  it('짧게 누르면 기본 펀치', () => {
    const a = resolveAttack(0.1, cfg);
    expect(a.kind).toBe('punch');
    expect(a.damage).toBe(cfg.punch.damage);
  });

  it('오래 누를수록 피해와 넉백이 커지고 최대에서 멈춘다', () => {
    const low = resolveAttack(cfg.charge.minTime, cfg);
    const mid = resolveAttack((cfg.charge.minTime + cfg.charge.fullTime) / 2, cfg);
    const full = resolveAttack(cfg.charge.fullTime + 5, cfg);
    expect(low.kind).toBe('charged');
    expect(low.damage).toBe(cfg.charge.minDamage);
    expect(mid.damage).toBeGreaterThan(low.damage);
    expect(mid.knockback).toBeGreaterThan(low.knockback);
    expect(full.damage).toBe(cfg.charge.maxDamage);
    expect(full.full).toBe(true);
  });

  it('레벨 공격력 배수가 피해에 곱해진다', () => {
    expect(resolveAttack(10, cfg, 1.5).damage).toBe(Math.round(cfg.charge.maxDamage * 1.5));
  });

  it('최대 충전 시간이 최소보다 짧게 잘못 설정돼도 멈추지 않는다', () => {
    const broken = { ...cfg.charge, minTime: 1, fullTime: 0.5 };
    expect(chargeRatio(0.9, broken)).toBe(0);
    expect(chargeRatio(1.1, broken)).toBe(1);
  });
});

describe('레벨', () => {
  it('경험치가 차면 레벨이 오르고 남은 경험치는 이어진다', () => {
    const need = xpToNext(1, cfg.level);
    const r = addXp({ level: 1, xp: 0 }, need + 5, cfg.level);
    expect(r).toEqual({ level: 2, xp: 5, levelsGained: 1 });
  });

  it('한 번에 여러 레벨이 오를 수 있다', () => {
    const r = addXp({ level: 1, xp: 0 }, 10000, cfg.level);
    expect(r.levelsGained).toBeGreaterThan(2);
  });

  it('레벨이 오르면 체력과 공격력이 늘어난다', () => {
    expect(maxHealthFor(3, 100, cfg.level)).toBe(100 + 2 * cfg.level.healthPerLevel);
    expect(damageMultiplierFor(1, cfg.level)).toBe(1);
    expect(damageMultiplierFor(2, cfg.level)).toBeCloseTo(1 + cfg.level.damageBonusPerLevel);
  });
});

describe('저장', () => {
  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  }

  it('저장한 경험치와 보물은 다시 불러와도 남아 있다', () => {
    const store = createSaveStore(memoryStorage());
    store.update({ level: 3, xp: 12, treasures: ['stage1-chest'], checkpoint: 'boss' });
    const d = store.load();
    expect(d.level).toBe(3);
    expect(d.xp).toBe(12);
    expect(d.treasures).toEqual(['stage1-chest']);
    expect(d.checkpoint).toBe('boss');
  });

  it('저장소가 없거나 고장 나도 기본값으로 시작한다', () => {
    expect(createSaveStore(null).load()).toEqual(defaultSave());
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const store = createSaveStore(throwing);
    expect(store.load()).toEqual(defaultSave());
    expect(store.save(defaultSave())).toBe(false);
  });

  it('망가진 저장 데이터는 기본값으로 바꾼다', () => {
    const s = memoryStorage();
    s.setItem('shock-hero-save-v1', '{"level":-3,"xp":"lots"');
    expect(createSaveStore(s).load()).toEqual(defaultSave());
  });
});

describe('보스 패턴', () => {
  it('팔 2개면 내려찍기만, 1개면 쓸기도 섞고, 0개면 돌 떨구기', () => {
    expect(chooseBossAttack(['a', 'b'], () => 0.99).type).toBe('slam');
    expect(chooseBossAttack(['a'], () => 0.1).type).toBe('sweep');
    expect(chooseBossAttack(['a'], () => 0.9).type).toBe('slam');
    expect(chooseBossAttack([]).type).toBe('rocks');
  });

  it('팔이 줄수록 빨라진다', () => {
    expect(bossSpeedMultiplier(1)).toBeLessThan(bossSpeedMultiplier(2));
  });

  it('충전 펀치는 코어에 더 아프다', () => {
    expect(coreDamage({ kind: 'charged', damage: 40 }, 1.5)).toBe(60);
    expect(coreDamage({ kind: 'punch', damage: 8 }, 1.5)).toBe(8);
  });

  it('돌 하나는 플레이어 위에 떨어지고, 돌끼리는 떨어져 있다', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const xs = rockTargets(5000, 3, 3060, 3640, rand);
    expect(xs[0]).toBe(3640);
    expect(xs).toHaveLength(3);
    for (let i = 0; i < xs.length; i++)
      for (let j = i + 1; j < xs.length; j++) expect(Math.abs(xs[i] - xs[j])).toBeGreaterThanOrEqual(90);
  });
});
