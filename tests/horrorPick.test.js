import { describe, it, expect } from 'vitest';
import { MAP_IDS, MONSTER_IDS, pickRound, forcedRound, isRound } from '../src/logic/horrorPick.js';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('판 고르기', () => {
  it('처음이면 아홉 조합이 다 나온다', () => {
    const rand = seeded(7);
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) {
      const r = pickRound(null, rand);
      expect(isRound(r)).toBe(true);
      seen.add(`${r.mapId}/${r.monsterId}`);
    }
    expect(seen.size).toBe(12);
  });

  it('지난 판과 맵도 괴물도 다르다', () => {
    const rand = seeded(11);
    for (const mapId of MAP_IDS) for (const monsterId of MONSTER_IDS) {
      for (let i = 0; i < 100; i += 1) {
        const r = pickRound({ mapId, monsterId }, rand);
        expect(r.mapId).not.toBe(mapId);
        expect(r.monsterId).not.toBe(monsterId);
      }
    }
  });

  it('이어서 하면 모든 맵과 괴물을 만난다', () => {
    const rand = seeded(3);
    const maps = new Set();
    const monsters = new Set();
    let last = null;
    for (let i = 0; i < 30; i += 1) {
      last = pickRound(last, rand);
      maps.add(last.mapId);
      monsters.add(last.monsterId);
    }
    expect(maps.size).toBe(3);
    expect(monsters.size).toBe(4);
  });

  it('난수가 끝값이어도 고른다', () => {
    expect(isRound(pickRound(null, () => 0))).toBe(true);
    expect(isRound(pickRound({ mapId: 'sewer', monsterId: 'maw' }, () => 0.9999999))).toBe(true);
  });

  it('모르는 지난 판은 없는 것으로 친다', () => {
    expect(isRound(pickRound({ mapId: 'moon', monsterId: 'x' }, () => 0.5))).toBe(true);
  });
});

describe('주소로 판 정하기', () => {
  it('맵과 괴물을 정한다', () => {
    expect(forcedRound('?map=school&monster=gazer')).toEqual({ mapId: 'school', monsterId: 'gazer' });
  });

  it('하나만 주면 나머지는 공장과 세이노다', () => {
    expect(forcedRound('?monster=maw')).toEqual({ mapId: 'factory', monsterId: 'maw' });
    expect(forcedRound('?map=sewer')).toEqual({ mapId: 'sewer', monsterId: 'seino' });
  });

  it('없거나 틀리면 null', () => {
    expect(forcedRound('')).toBeNull();
    expect(forcedRound('?fps')).toBeNull();
    expect(forcedRound('?map=moon')).toBeNull();
    expect(forcedRound('?map=sewer&monster=x')).toBeNull();
  });
});
