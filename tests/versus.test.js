import { describe, expect, it } from 'vitest';
import { afterRound, newMatch, sideName, timeUpWinner, VERSUS_PROFILE, versusDamage, winPips } from '../src/logic/versus.js';
import { cfg } from '../src/config/index.js';
import { versusArena } from '../src/stage/arena.js';
import { themeArt } from '../src/logic/stageArt.js';

describe('겨루기 승부', () => {
  it('먼저 3 승을 채운 쪽이 우승한다', () => {
    let m = newMatch();
    for (const winner of [0, 1, 0, 1]) {
      m = afterRound(m, winner, 3);
      expect(m.champion).toBeNull();
    }
    expect(m.wins).toEqual([2, 2]);
    expect(m.round).toBe(5);
    m = afterRound(m, 1, 3);
    expect(m.wins).toEqual([2, 3]);
    expect(m.champion).toBe(1);
  });

  it('3 대 0 이면 세 판 만에 끝난다', () => {
    let m = newMatch();
    for (let i = 0; i < 3; i++) m = afterRound(m, 0, 3);
    expect(m.champion).toBe(0);
    expect(m.round).toBe(4);
  });

  it('무승부는 승수 없이 같은 판을 다시 한다', () => {
    const m = afterRound({ round: 2, wins: [1, 0] }, null, 3);
    expect(m).toEqual({ round: 2, wins: [1, 0], champion: null });
  });

  it('시간이 다 되면 체력 비율이 높은 쪽이 이긴다', () => {
    expect(timeUpWinner([0.5, 0.4])).toBe(0);
    expect(timeUpWinner([0.1, 0.4])).toBe(1);
    expect(timeUpWinner([0.5, 0.5])).toBeNull();
  });
});

describe('겨루기 피해', () => {
  it('궁극기만 최대 체력의 일정 비율로 막는다', () => {
    expect(versusDamage({ kind: 'ultimate', damage: 60 }, 100, 0.35)).toBe(35);
    expect(versusDamage({ kind: 'ultimate', damage: 18 }, 100, 0.35)).toBe(18);
    expect(versusDamage({ kind: 'charged', damage: 40 }, 100, 0.35)).toBe(40);
  });
});

describe('겨루기 표시와 준비물', () => {
  it('승수를 동그라미로 보여 준다', () => {
    expect(winPips(0, 3)).toBe('○○○');
    expect(winPips(2, 3)).toBe('●●○');
    expect(winPips(3, 3)).toBe('●●●');
  });

  it('쪽 번호를 1P, 2P 로 읽는다', () => {
    expect(sideName(0)).toBe('1P');
    expect(sideName(1)).toBe('2P');
  });

  it('성장치 없는 몸으로 시작한다', () => {
    expect(VERSUS_PROFILE).toEqual({ level: 1, upgrades: {}, shop: {} });
  });

  it('5 판 3 선승 설정과 경기장이 맞물린다', () => {
    expect(cfg.versus.winsNeeded).toBe(3);
    expect(versusArena.width).toBe(960);
    expect(versusArena.monsters).toEqual([]);
    expect(versusArena.treasures).toEqual([]);
  });

  it('경기장은 배경 그림만 받는다 (보스와 몬스터 그림은 받지 않는다)', () => {
    const keys = themeArt(versusArena).map((p) => p.key);
    expect(keys).toContain('city_arena');
    expect(keys.some((k) => k.startsWith('boss_') || k.startsWith('monster_'))).toBe(false);
  });
});
