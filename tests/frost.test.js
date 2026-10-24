import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { ICE_PATTERNS, FROST, breathCone, avalancheWaves, comboKind } from '../src/logic/boss.js';
import { upperRect } from '../src/logic/combat.js';
import { DIFFICULTY_VALUES } from '../src/logic/difficulty.js';
import { stages } from '../src/stage/index.js';

// 혹한의 아스트라 (스테이지 4 보스, 아들 디자인)
const GROUND = 480;
const HERO_H = 56;
const HERO_HALF_W = 15; // 몸통 판정 30 x 56 (Player.js)
const HERO_Y = GROUND - HERO_H / 2; // 땅에 선 주인공 몸 가운데
const JUMP_HEIGHT = (balance.player.jumpSpeed ** 2) / (2 * balance.world.gravity);
const ic = balance.iceBoss;
const s4 = stages[3];
const arena = { minX: s4.arena.startX + 60, maxX: s4.arena.endX - 60 };

describe('혹한의 아스트라 설정', () => {
  it('스테이지 4 보스 이름과 공격', () => {
    expect(s4.boss.name).toBe('혹한의 아스트라');
    const all = s4.boss.phases.flat();
    expect(all).toContain('freezeBreath');
    expect(all).toContain('avalanche');
    for (const p of all) expect(Object.keys(ICE_PATTERNS)).toContain(p);
    // 날개가 있을 때(처음 두 단계)는 땅 공격(hop)을 쓰지 않는다: 거의 날아서 싸운다
    expect(s4.boss.phases[0]).not.toContain('hop');
    expect(s4.boss.phases[1]).not.toContain('hop');
  });

  it('냉기 브레스와 겹치는 공격은 떨어지는 것(점프와 겹치지 않음)', () => {
    expect(comboKind('freezeBreath')).toBe('rocks');
  });
});

describe('높이: 높이 날면 안 닿고, 낮게 뜨면 위쪽 공격이 닿는다', () => {
  const up = upperRect(1000, HERO_Y, 1, balance.skills.upperReach, balance.skills.upperWidth);
  it('높이 날 때는 위쪽 공격도 안 닿는다', () => {
    expect(FROST.highY + FROST.hitHalfH).toBeLessThan(up.y);
  });
  it('급강하 뒤 낮게 뜨면 맞는 곳 아래쪽이 y 250 아래로 내려와 위쪽 공격이 닿는다', () => {
    const bottom = FROST.lowY + FROST.hitHalfH;
    expect(bottom).toBeGreaterThanOrEqual(250);
    expect(bottom).toBeGreaterThan(up.y);
  });
});

describe('냉기 브레스', () => {
  const dragonX = arena.minX + 70;
  const cone = breathCone(dragonX, 1, ic.breathConeNear, ic.breathConeLength);

  it('용 밑과 뒤에 주인공이 설 만한 안전한 곳이 있다', () => {
    const safeWidth = cone.lo - s4.arena.startX;
    expect(safeWidth).toBeGreaterThan(HERO_HALF_W * 2 + 40);
  });

  it('부채꼴은 싸움터 안에서 끝나고, 그 뒤로 서리가 달린다', () => {
    expect(cone.hi).toBeLessThan(arena.maxX - 200);
    const left = breathCone(arena.maxX - 70, -1, ic.breathConeNear, ic.breathConeLength);
    expect(left.lo).toBeGreaterThan(arena.minX + 200);
    expect(left.hi).toBeLessThan(s4.arena.endX - HERO_HALF_W * 2 - 40);
  });

  it('바닥을 달리는 서리는 점프로 넘을 수 있다', () => {
    expect(JUMP_HEIGHT).toBeGreaterThan(FROST.breathH + 20);
  });

  it('부채꼴 밖으로 걸어 나갈 시간이 있다 (어려움 + 분노에서도)', () => {
    const fastest = ic.breathWarningTime * s4.boss.speedScale * DIFFICULTY_VALUES.hard.bossSpeed * balance.boss.rageSpeed;
    // 부채꼴 한가운데에서 가장 가까운 끝까지
    expect(balance.player.moveSpeed * fastest).toBeGreaterThan(ic.breathConeLength / 2 + HERO_HALF_W);
  });
});

describe('빙천지락', () => {
  const gap = ic.avalancheGap;
  const waves = avalancheWaves(arena.minX - 40, arena.maxX + 40, gap, 37, 3);
  const danger = FROST.spikeW / 2 + HERO_HALF_W;

  it('두 묶음이 번갈아 솟고, 분노면 첫 묶음이 한 번 더', () => {
    expect(waves).toHaveLength(3);
    expect(waves[2]).toEqual(waves[0]);
    for (const x of waves[0]) expect(waves[1]).not.toContain(x);
    expect(avalancheWaves(0, 1000, gap, 0, 2)).toHaveLength(2);
  });

  it('가시 사이에 틈이 있다', () => {
    for (const w of waves) for (let i = 1; i < w.length; i++) expect(w[i] - w[i - 1] - danger * 2).toBeGreaterThan(60);
  });

  it('어디에 서 있든 다음 가시가 솟기 전에 안전한 틈으로 옮길 수 있다', () => {
    const fastest = ic.avalancheWarningTime * s4.boss.speedScale * DIFFICULTY_VALUES.hard.bossSpeed * balance.boss.rageSpeed;
    const reach = balance.player.moveSpeed * fastest;
    for (let x = arena.minX; x <= arena.maxX; x += 5) {
      for (const w of waves) {
        // 가장 가까운 안전한 곳까지 거리
        let need = 0;
        for (const sx of w) if (Math.abs(x - sx) < danger) need = Math.max(need, danger - Math.abs(x - sx));
        expect(need).toBeLessThan(reach);
      }
    }
  });

  it('브레스와 가시 숫자는 0 보다 크다', () => {
    for (const k of ['breathTime', 'breathConeNear', 'breathConeLength', 'avalancheWarningTime', 'avalancheGap', 'avalancheDamage']) expect(ic[k], k).toBeGreaterThan(0);
  });
});
