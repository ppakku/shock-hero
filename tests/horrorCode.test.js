import { describe, it, expect } from 'vitest';
import { createCode, pressCode, codeDisplay, CODE_LEN } from '../src/logic/horrorCode.js';
import { createRun, takeClue, cluesFound, nearestUse } from '../src/logic/horrorRun.js';
import { reachable, withOpen, center } from '../src/logic/horrorGrid.js';
import { MAPS } from '../src/horror/content.js';
import { clueTexts, ENDINGS } from '../src/horror/story.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const seeded = (seed) => {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};
const type = (code, text) => [...text].map((d) => pressCode(code, d)).at(-1);

describe('정문 번호 만들기', () => {
  it('언제나 네 자리 숫자이고 단서대로 풀린다', () => {
    for (let s = 1; s < 300; s++) {
      const c = createCode(seeded(s));
      expect(c.digits).toHaveLength(CODE_LEN);
      for (const d of c.digits) {
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(9);
      }
      expect(c.digits[1]).toBe(c.digits[0] + c.add);
      expect(c.digits[2]).toBe(c.same ? c.digits[1] : c.digits[1] - 1);
    }
  });

  it('판마다 번호가 달라진다', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, s) => createCode(seeded(s + 1)).digits.join('')));
    expect(seen.size).toBeGreaterThan(30);
  });
});

describe('번호 넣기', () => {
  const code = () => ({ ...createCode(seeded(3)), digits: [2, 4, 4, 7] });

  it('맞으면 풀린다', () => {
    const c = code();
    expect(type(c, '244')).toBe('typing');
    expect(pressCode(c, '7')).toBe('right');
    expect(c.solved).toBe(true);
  });

  it('틀리면 비우고 다시 넣을 수 있다', () => {
    const c = code();
    expect(type(c, '2448')).toBe('wrong');
    expect(c.entered).toBe('');
    expect(type(c, '2447')).toBe('right');
  });

  it('지우기는 한 글자만 지운다', () => {
    const c = code();
    type(c, '24');
    pressCode(c, 'erase');
    expect(c.entered).toBe('2');
    expect(codeDisplay(c)).toBe('2 _ _ _');
    pressCode(c, 'erase');
    pressCode(c, 'erase');
    expect(c.entered).toBe('');
  });
});

describe('붉은 쪽지', () => {
  it.each(Object.keys(MAPS))('%s: 3장이 퓨즈와 겹치지 않고 문을 다 열면 닿는 곳에 있다', (id) => {
    const map = MAPS[id].map;
    for (let s = 1; s < 40; s++) {
      const run = createRun(map, k, seeded(s));
      expect(run.clues).toHaveLength(3);
      const open = reachable(withOpen(map, map.locks.map((_, i) => i)), map.start);
      for (const c of run.clues) {
        expect(run.fuses.some((f) => f.cx === c.cx && f.cy === c.cy)).toBe(false);
        expect(open.has(`${c.cx},${c.cy}`)).toBe(true);
      }
      expect(new Set(run.clues.map((c) => `${c.cx},${c.cy}`)).size).toBe(3);
    }
  });

  it('한 번만 주울 수 있고 곁에 가면 고를 수 있다', () => {
    const map = MAPS.factory.map;
    const run = createRun(map, k, seeded(1));
    const c = run.clues[0];
    const p = center(c);
    expect(nearestUse(run, run.level, p, null, k).kind).toBe('clue');
    expect(takeClue(run, 0)).toBe(true);
    expect(takeClue(run, 0)).toBe(false);
    expect(cluesFound(run)).toBe(1);
  });

  it.each(Object.keys(MAPS))('%s: 글에 번호가 그대로 들어가고 빈칸이 남지 않는다', (id) => {
    const code = { digits: [2, 4, 4, 7], add: 2, same: true };
    const text = clueTexts(id, code);
    expect(text).toHaveLength(3);
    expect(text[0].join(' ')).toContain('2');
    expect(text[1].join(' ')).toContain('2 크다');
    expect(text[2].join(' ')).toContain('같다');
    expect(clueTexts(id, { ...code, same: false })[2].join(' ')).toContain('1 작다');
    expect(text.flat().join(' ')).not.toMatch(/[{}]/);
    expect(ENDINGS[id]).toBeTruthy();
  });
});
