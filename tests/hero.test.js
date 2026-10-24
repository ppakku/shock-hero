import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import {
  resolveAttack,
  upperRect,
  shotAttack,
  shotDirection,
  gaugeAfterDealing,
  gaugeAfterHurt,
  isUltReady,
  ultimateAttack,
} from '../src/logic/combat.js';

const cfg = sanitizeNumbers(balance, () => {});
const GROUND_Y = 480;
const standingY = GROUND_Y - 31; // 땅에 선 주인공의 몸 한가운데

describe('위쪽 공격 (어퍼컷)', () => {
  it('위를 누르고 짧게 치면 upper 공격', () => {
    const a = resolveAttack(0.1, cfg, 1, { up: true });
    expect(a.kind).toBe('upper');
    expect(a.up).toBe(true);
    expect(a.damage).toBe(cfg.skills.upperDamage);
    expect(a.range).toBe(cfg.skills.upperReach);
  });

  it('위를 누르고 충전하면 위쪽 충전 공격, 최대면 full', () => {
    const a = resolveAttack(cfg.charge.fullTime + 1, cfg, 1, { up: true });
    expect(a.kind).toBe('charged');
    expect(a.up).toBe(true);
    expect(a.full).toBe(true);
  });

  it('위를 안 누르면 예전 펀치 그대로', () => {
    expect(resolveAttack(0.1, cfg).kind).toBe('punch');
    expect(resolveAttack(0.1, cfg).up).toBe(false);
  });

  it('땅에 서서 쳐도 하늘(y 250) 몬스터에 닿는다', () => {
    const r = upperRect(500, standingY, 1, cfg.skills.upperReach, cfg.skills.upperWidth);
    expect(r.y).toBeLessThanOrEqual(250);
    expect(r.y + r.h).toBeGreaterThanOrEqual(standingY);
    // 바로 위 몬스터(폭 40)와 겹친다
    expect(r.x).toBeLessThan(500 - 20 + 40);
    expect(r.x + r.w).toBeGreaterThan(500 - 20);
  });

  it('보는 방향 쪽으로 조금 더 길다', () => {
    const right = upperRect(500, standingY, 1, 220, 80);
    const left = upperRect(500, standingY, -1, 220, 80);
    expect(right.x + right.w - 500).toBeGreaterThan(500 - right.x);
    expect(500 - left.x).toBeGreaterThan(left.x + left.w - 500);
  });
});

describe('에너지탄', () => {
  it('shot 공격, 레벨 배수 적용', () => {
    const s = shotAttack(cfg, 1.5);
    expect(s.kind).toBe('shot');
    expect(s.damage).toBe(Math.round(cfg.skills.shotDamage * 1.5));
  });

  it('방향: 앞, 위, 대각선 위', () => {
    expect(shotDirection(-1, false, false)).toEqual({ x: -1, y: 0 });
    expect(shotDirection(1, true, false)).toEqual({ x: 0, y: -1 });
    const d = shotDirection(1, true, true);
    expect(d.x).toBeGreaterThan(0);
    expect(d.y).toBeLessThan(0);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  });
});

describe('궁극기 게이지', () => {
  const u = cfg.ultimate;

  it('피해를 주면 차고 1에서 멈춘다', () => {
    expect(gaugeAfterDealing(0, 10, u)).toBeCloseTo(10 * u.gaugePerDamage);
    expect(gaugeAfterDealing(0.99, 1000, u)).toBe(1);
  });

  it('맞으면 조금 찬다 (주는 것보다 적게)', () => {
    expect(gaugeAfterHurt(0, 10, u)).toBeGreaterThan(0);
    expect(u.gaugePerHurt).toBeLessThan(u.gaugePerDamage);
  });

  it('음수 피해는 게이지를 줄이지 않는다', () => {
    expect(gaugeAfterDealing(0.5, -20, u)).toBe(0.5);
  });

  it('꽉 차야 준비 완료', () => {
    expect(isUltReady(0.999)).toBe(false);
    expect(isUltReady(1)).toBe(true);
  });

  it('몬스터 몇 마리 잡으면 찬다 (너무 빠르지도 느리지도 않게)', () => {
    const toFill = 1 / u.gaugePerDamage;
    const monsterHp = cfg.monster.maxHealth;
    expect(toFill / monsterHp).toBeGreaterThan(3);
    expect(toFill / monsterHp).toBeLessThan(15);
  });

  it('궁극기 공격은 ultimate 종류, 보스 피해 따로', () => {
    const { attack, bossDamage } = ultimateAttack(cfg, 2);
    expect(attack.kind).toBe('ultimate');
    expect(attack.damage).toBe(u.damage * 2);
    expect(bossDamage).toBe(u.bossDamage * 2);
  });
});
