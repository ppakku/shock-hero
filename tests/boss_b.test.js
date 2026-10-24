import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import {
  BOSS_PATTERNS, ICE_PATTERNS, KING_FINAL_PATTERNS, chooseBossAttack, pickPattern, pickRocketHeight, rocketBand,
  inhaleStep, shouldRage, restAfterAttack, canSummon, summonSpots, landingX, difficultyOf, comboKind, DIFFICULTY_NORMAL,
} from '../src/logic/boss.js';
import { stages } from '../src/stage/index.js';

// 주인공 몸 크기 (Player.js: 60 높이 그림의 93%)
const HERO_H = 56;
const GROUND = 480;
const JUMP_HEIGHT = (balance.player.jumpSpeed ** 2) / (2 * balance.world.gravity); // 약 136

describe('주먹 발사', () => {
  it('처음은 낮게, 두 번째는 높게, 그 뒤는 무작위', () => {
    expect(pickRocketHeight(0)).toBe('low');
    expect(pickRocketHeight(1)).toBe('high');
    expect(pickRocketHeight(2, () => 0.1)).toBe('low');
    expect(pickRocketHeight(5, () => 0.9)).toBe('high');
  });

  it('낮은 주먹은 점프로 넘을 수 있고, 서 있으면 맞는다', () => {
    const band = rocketBand('low', GROUND);
    expect(band.bottom).toBe(GROUND);
    const standingTop = GROUND - HERO_H;
    expect(standingTop).toBeLessThan(band.bottom); // 서 있으면 겹친다
    expect(JUMP_HEIGHT).toBeGreaterThan(band.bottom - band.top + 20); // 점프하면 발이 띠 위로
  });

  it('높은 주먹은 서 있으면 머리 위로 지나가고, 점프하면 맞는다', () => {
    const band = rocketBand('high', GROUND);
    const standingTop = GROUND - HERO_H;
    expect(band.bottom).toBeLessThan(standingTop); // 가만히 서 있으면 안 맞음
    const jumpTop = standingTop - JUMP_HEIGHT;
    expect(jumpTop).toBeLessThan(band.bottom); // 점프하면 머리가 띠에 닿음
  });

  it('주먹 발사는 팔이 있어야 쓴다', () => {
    expect(BOSS_PATTERNS.rocketPunch.arms).toBe(1);
    expect(chooseBossAttack([['rocketPunch']], 0, 2)).toBe('rocks');
  });
});

describe('빨아들이기', () => {
  it('입 쪽으로 끌려가지만 지나치지 않는다', () => {
    expect(inhaleStep(100, 500, 150, 1)).toBe(250);
    expect(inhaleStep(480, 500, 150, 1)).toBe(500);
    expect(inhaleStep(900, 500, 150, 1)).toBe(750);
  });

  it('반대로 걸으면 끌려가지 않고 도망칠 수 있다', () => {
    const b = balance.boss;
    expect(b.inhalePull).toBeLessThan(balance.player.moveSpeed);
    // 1초 동안 반대로 걸으면 오히려 멀어진다
    let x = 3400;
    for (let i = 0; i < 60; i++) x = inhaleStep(x - balance.player.moveSpeed / 60, 3700, b.inhalePull, 1 / 60);
    expect(x).toBeLessThan(3400);
  });

  it('충전하면서 걸으면 끌려간다 (충전은 위험!)', () => {
    const slow = balance.player.moveSpeed * balance.charge.moveSpeedMultiplier;
    expect(slow).toBeLessThan(balance.boss.inhalePull);
  });
});

describe('분노 모드', () => {
  it('체력이 기준 아래로 내려가면 한 번만 분노한다', () => {
    expect(shouldRage(0.6, 0.5)).toBe(false);
    expect(shouldRage(0.5, 0.5)).toBe(true);
    expect(shouldRage(0.3, 0.5, true)).toBe(false);
    expect(shouldRage(0, 0.5)).toBe(false); // 이미 쓰러짐
  });

  it('분노하면 두 공격을 쉬지 않고 잇고, 그다음엔 쉰다', () => {
    const r1 = restAfterAttack(true, false, 1.0, 0.3);
    expect(r1).toEqual({ wait: 0.3, chained: true });
    const r2 = restAfterAttack(true, r1.chained, 1.0, 0.3);
    expect(r2).toEqual({ wait: 1.0, chained: false });
    expect(restAfterAttack(false, false, 1.0, 0.3).wait).toBe(1.0);
  });
});

describe('공격 고르기', () => {
  it('방금 한 공격은 되도록 피하고, 목록이 비면 대신할 공격', () => {
    for (let i = 0; i < 10; i++) expect(pickPattern(['dive', 'icicles'], 'dive', () => i / 10)).toBe('icicles');
    expect(pickPattern(['dive'], 'dive')).toBe('dive');
    expect(pickPattern([], null, Math.random, 'hop')).toBe('hop');
  });
});

describe('킹 돌연변이 부하', () => {
  it('부하는 최대 수까지만', () => {
    expect(canSummon(0, 2)).toBe(true);
    expect(canSummon(2, 2)).toBe(false);
  });

  it('부하는 플레이어와 떨어진 곳에서 나온다', () => {
    const xs = summonSpots(5000, 2, 4900, 5600);
    expect(xs.length).toBeGreaterThan(0);
    expect(xs.length).toBeLessThanOrEqual(2);
    for (const x of xs) expect(Math.abs(x - 5000)).toBeGreaterThanOrEqual(220);
    expect(summonSpots(5000, 0, 4900, 5600)).toEqual([]);
  });
});

describe('얼음 돌연변이 착지', () => {
  it('플레이어 바로 위에는 내려앉지 않는다', () => {
    for (let i = 0; i < 20; i++) {
      const x = landingX(4900, 4540, 5300, 190, () => i / 20);
      expect(Math.abs(x - 4900)).toBeGreaterThanOrEqual(189);
      expect(x).toBeGreaterThanOrEqual(4540);
      expect(x).toBeLessThanOrEqual(5300);
    }
  });
});

describe('스테이지 1, 4, 5 보스 설정', () => {
  const s1 = stages[0];
  const s4 = stages[3];
  const s5 = stages[4];

  it('스테이지 1 은 새 공격(주먹 발사, 빨아들이기)을 쓴다', () => {
    const all = s1.boss.phases.flat();
    expect(all).toContain('rocketPunch');
    expect(all).toContain('inhale');
  });

  it('스테이지 4 는 날아다니는 얼음 보스, 공격 이름이 맞다', () => {
    expect(s4.boss.type).toBe('ice');
    expect(s4.boss.phases).toHaveLength(3);
    for (const list of s4.boss.phases) for (const p of list) expect(Object.keys(ICE_PATTERNS)).toContain(p);
  });

  it('스테이지 5 는 킹 돌연변이, 앉은 단계와 일어선 단계 공격 이름이 맞다', () => {
    const b = s5.boss;
    expect(b.type).toBe('king');
    expect(b.phases).toHaveLength(b.arms);
    for (const list of b.phases) for (const p of list) expect(Object.keys(BOSS_PATTERNS)).toContain(p);
    expect(b.phases.flat()).toContain('summon');
    expect(b.phases.flat()).toContain('rocketPunch');
    expect(b.phases.flat()).toContain('inhale');
    for (const p of b.finalPhase) expect(Object.keys(KING_FINAL_PATTERNS)).toContain(p);
  });

  it('보스 숫자는 모두 0 보다 크다', () => {
    for (const sec of ['iceBoss', 'kingBoss']) for (const [k, v] of Object.entries(balance[sec])) expect(v, `${sec}.${k}`).toBeGreaterThan(0);
  });
});

describe('난이도', () => {
  it('cfg.difficulty 가 없으면 보통', () => {
    expect(difficultyOf({})).toEqual(DIFFICULTY_NORMAL);
    expect(difficultyOf(undefined).bossHealth).toBe(1);
  });

  it('넘겨준 난이도 값을 쓴다', () => {
    const hard = difficultyOf({ difficulty: { level: 'hard', bossHealth: 1.25, bossSpeed: 0.8, bossCombo: 0.5 } });
    expect(hard).toEqual({ level: 'hard', bossHealth: 1.25, bossSpeed: 0.8, bossCombo: 0.5 });
    expect(difficultyOf({ difficulty: { level: 'easy', bossHealth: 0.8, bossSpeed: 1.2, bossCombo: 0 } }).bossCombo).toBe(0);
  });

  it('겹쳐 쓰는 공격은 지금 공격과 피하는 법이 다르다', () => {
    expect(comboKind('rocks')).toBe('wave');
    expect(comboKind('icicles')).toBe('wave');
    expect(comboKind('shockwave')).toBe('rocks');
    expect(comboKind('frostBreath')).toBe('rocks');
    expect(['rocks', 'wave']).toContain(comboKind('slam', () => 0.2));
  });
});

describe('높은 주먹 발사', () => {
  it('가만히 서 있는 주인공 몸통(키 56) 위로 지나간다', async () => {
    const { rocketBand } = await import('../src/logic/boss.js');
    const groundY = 480;
    expect(rocketBand('high', groundY).bottom).toBeLessThan(groundY - 56);
  });
});
