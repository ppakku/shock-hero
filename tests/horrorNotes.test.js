import { describe, it, expect } from 'vitest';
import { createNotes, takeNote, NOTE_TOTAL } from '../src/logic/horrorNotes.js';
import { NOTES, FINAL_LINE, STORY, fillName, notesFor, finalLineFor, dangerLineFor } from '../src/horror/story.js';

const spots = Array.from({ length: 12 }, (_, i) => ({ x: i + 0.5, y: 2.5 }));
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('쪽지 이야기 글', () => {
  it('쪽지는 8개이고 2에서 4줄이다', () => {
    expect(NOTES).toHaveLength(NOTE_TOTAL);
    for (const n of NOTES) {
      expect(n.length).toBeGreaterThanOrEqual(2);
      expect(n.length).toBeLessThanOrEqual(4);
    }
  });
  it('em dash 와 가운뎃점, 피 이야기가 없다', () => {
    const all = [...NOTES.flat(), FINAL_LINE].join('\n');
    expect(all).not.toMatch(/[—·]/);
    expect(all).not.toMatch(/피|죽|시체|살해/);
  });
});

describe('맵별 쪽지 이야기', () => {
  const maps = ['factory', 'sewer', 'school'];
  it('맵마다 8개이고 2에서 4줄이며 한 줄이 짧다', () => {
    for (const id of maps) {
      expect(STORY[id].notes).toHaveLength(NOTE_TOTAL);
      for (const n of STORY[id].notes) {
        expect(n.length).toBeGreaterThanOrEqual(2);
        expect(n.length).toBeLessThanOrEqual(4);
        for (const line of n) expect(line.length).toBeLessThanOrEqual(34);
      }
    }
  });
  it('em dash, 가운뎃점, 피와 죽음 이야기가 없고 괴물 이름은 {name} 으로만 쓴다', () => {
    for (const id of maps) {
      const all = [...STORY[id].notes.flat(), STORY[id].final].join('\n');
      expect(all).not.toMatch(/[—·]/);
      expect(all).not.toMatch(/피|죽|시체|살해/);
      expect(all).not.toMatch(/세이노|눈뜬이|큰입이/);
    }
  });
  it('이름을 바꿔 넣어도 {name 이 남지 않고 이름이 들어간다', () => {
    for (const id of maps) {
      for (const name of ['세이노', '눈뜬이', '큰입이', '곰돌']) {
        const all = [...notesFor(id, name).flat(), finalLineFor(id, name), dangerLineFor(name)].join('\n');
        expect(all).not.toMatch(/[{}]/);
      }
    }
    expect(notesFor('factory', '눈뜬이').flat().join('')).toContain('눈뜬이');
  });
  it('모르는 맵은 공장 이야기를 쓴다', () => {
    expect(notesFor('nowhere')).toEqual(notesFor('factory'));
  });
  it('받침에 따라 조사가 바뀐다', () => {
    expect(fillName('{name:은는} {name:이가} {name:을를}', '곰돌')).toBe('곰돌은 곰돌이 곰돌을');
    expect(fillName('{name:은는} {name:이가} {name:을를}', '세이노')).toBe('세이노는 세이노가 세이노를');
    expect(fillName('{name}도', '눈뜬이')).toBe('눈뜬이도');
    expect(fillName(['{name:은는}', '{name}'], '큰입이')).toEqual(['큰입이는', '큰입이']);
  });
});

describe('쪽지 위치와 줍기', () => {
  it('자리 중 8개를 골라 섞는다', () => {
    const s = createNotes(spots, seeded(7));
    expect(s.spots).toHaveLength(NOTE_TOTAL);
    expect(new Set(s.spots.map((p) => p.x)).size).toBe(NOTE_TOTAL);
    const t = createNotes(spots, seeded(99));
    expect(t.spots.map((p) => p.x)).not.toEqual(s.spots.map((p) => p.x));
  });
  it('자리가 8개보다 적으면 있는 만큼만 쓰고, 원본은 건드리지 않는다', () => {
    const few = spots.slice(0, 3);
    const s = createNotes(few, seeded(1));
    expect(s.total).toBe(3);
    expect(few[0]).toEqual({ x: 0.5, y: 2.5 });
  });
  it('주운 순서대로 이야기 번호를 주고, 같은 쪽지는 두 번 못 줍는다', () => {
    const s = createNotes(spots, seeded(3));
    expect(takeNote(s, 5)).toBe(0);
    expect(takeNote(s, 5)).toBe(-1);
    expect(takeNote(s, 0)).toBe(1);
    expect(s.found).toBe(2);
    expect(takeNote(s, -1)).toBe(-1);
    expect(takeNote(s, 99)).toBe(-1);
  });
  it('마지막 번호는 7이다', () => {
    const s = createNotes(spots, seeded(5));
    let last = -1;
    for (let i = 0; i < s.total; i++) last = takeNote(s, i);
    expect(last).toBe(NOTE_TOTAL - 1);
  });
  it('읽은 쪽지는 찾은 순서대로 남고, 같은 쪽지는 두 번 남지 않는다', () => {
    const s = createNotes(spots, seeded(4));
    expect(s.read).toEqual([]);
    takeNote(s, 3);
    takeNote(s, 3);
    takeNote(s, 1);
    expect(s.read).toEqual([0, 1]);
  });
});
