import { describe, it, expect } from 'vitest';
import { balance as cfg } from '../src/config/balance.js';
import { withDifficulty, levelsAhead, STAGE_LEVELS, LEVEL_CATCHUP } from '../src/logic/difficulty.js';
import { monsterStats, canStagger } from '../src/logic/monsters.js';
import { attackMultiplier } from '../src/logic/growth.js';

const green = (level, stage, playerLevel) => monsterStats(withDifficulty(cfg, level, stage, playerLevel), 'basic');
// 예상 레벨의 주인공이 공격 카드를 고르게 골랐을 때 펀치로 몇 대인지
const punches = (level, stage) => {
  const lv = STAGE_LEVELS[stage - 1];
  const atk = attackMultiplier({ attack: Math.min(5, Math.ceil((lv - 1) / 4)) }, cfg.upgrades);
  return Math.ceil(green(level, stage).maxHealth / Math.round(cfg.punch.damage * atk));
};

describe('몬스터 세기', () => {
  it('뒤 스테이지일수록 펀치를 더 많이 때려야 한다', () => {
    expect(punches('normal', 1)).toBe(4);
    expect(punches('normal', 10)).toBeGreaterThanOrEqual(6);
    expect(punches('normal', 20)).toBeGreaterThanOrEqual(6);
    expect(punches('hard', 20)).toBeGreaterThanOrEqual(8);
  });

  it('난이도에 따라 체력이 다르다', () => {
    expect(green('easy', 5).maxHealth).toBeLessThan(green('normal', 5).maxHealth);
    expect(green('normal', 5).maxHealth).toBeLessThan(green('hard', 5).maxHealth);
  });

  it('어려움 스테이지 20 은 꽉 채운 충전 펀치 한 방에 안 죽는다', () => {
    const atk = attackMultiplier({ attack: 5 }, cfg.upgrades);
    expect(green('hard', 20).maxHealth).toBeGreaterThan(cfg.charge.maxDamage * atk);
  });
});

describe('레벨 맞춤', () => {
  it('예상 레벨보다 앞선 만큼만 센다', () => {
    expect(levelsAhead(1, 1)).toBe(0);
    expect(levelsAhead(5, 9)).toBe(0);
    expect(levelsAhead(9, 3)).toBe(3);
    expect(levelsAhead(99, 1)).toBe(LEVEL_CATCHUP.maxLevels);
    expect(levelsAhead(undefined, 3)).toBe(0);
  });

  it('어려움이 가장 많이, 보통은 절반, 쉬움은 안 따라온다', () => {
    const grow = (d) => green(d, 1, 11).maxHealth / green(d, 1).maxHealth;
    expect(grow('hard')).toBeCloseTo(1.64, 1);
    expect(grow('normal')).toBeCloseTo(1.32, 1);
    expect(grow('easy')).toBe(1);
  });

  it('레벨을 안 주면 스테이지와 난이도만 본다', () => {
    expect(withDifficulty(cfg, 'hard', 3).difficulty).toEqual(withDifficulty(cfg, 'hard', 3, 1).difficulty);
  });
});

describe('보스 세기', () => {
  it('보스 공격 피해만 오르고 주인공 숫자는 그대로다', () => {
    const c = withDifficulty(cfg, 'hard', 10);
    expect(c.boss.slamDamage).toBeGreaterThan(cfg.boss.slamDamage);
    expect(c.dragonBoss.tailDamage).toBeGreaterThan(cfg.dragonBoss.tailDamage);
    expect(c.seaBoss.chargeDamage).toBeGreaterThan(cfg.seaBoss.chargeDamage);
    expect(c.boss.coreHealth).toBe(cfg.boss.coreHealth);
    expect(c.punch.damage).toBe(cfg.punch.damage);
    expect(c.robot).toEqual(cfg.robot);
  });

  it('원래 설정은 바뀌지 않는다', () => {
    const before = cfg.boss.slamDamage;
    withDifficulty(cfg, 'hard', 20, 30);
    expect(cfg.boss.slamDamage).toBe(before);
  });
});

describe('비틀거리기', () => {
  it('한 번 비틀거린 뒤 정해진 시간 동안은 버틴다', () => {
    expect(canStagger(-Infinity, 0, 1.4)).toBe(true);
    expect(canStagger(1, 2, 1.4)).toBe(false);
    expect(canStagger(1, 2.4, 1.4)).toBe(true);
  });

  it('쉬움은 언제나 비틀거린다', () => {
    expect(canStagger(1, 1, 0)).toBe(true);
    expect(green('easy', 1).stunGuard).toBe(0);
    expect(green('hard', 1).stunGuard).toBeGreaterThan(green('normal', 1).stunGuard);
  });
});
