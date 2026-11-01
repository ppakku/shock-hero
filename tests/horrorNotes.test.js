import { describe, it, expect } from 'vitest';
import { createNotes, takeNote, NOTE_TOTAL } from '../src/logic/horrorNotes.js';
import { NOTES, FINAL_LINES, NOTE_DANGER_LINE, fillName } from '../src/horror/story.js';

const spots = Array.from({ length: 12 }, (_, i) => ({ x: i + 0.5, y: 2.5 }));
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('쪽지 이야기 글', () => {
  it('쪽지는 8개이고 2에서 4줄이다', () => {
    expect(NOTES.factory).toHaveLength(NOTE_TOTAL);
    for (const n of NOTES.factory) {
      expect(n.length).toBeGreaterThanOrEqual(2);
      expect(n.length).toBeLessThanOrEqual(4);
    }
  });
  it('em dash 와 가운뎃점, 피 이야기가 없다', () => {
    const all = [...NOTES.factory.flat(), FINAL_LINES.factory].join('\n');
    expect(all).not.toMatch(/[—·]/);
    expect(all).not.toMatch(/피|죽|시체|살해/);
  });
});

describe('맵별 쪽지 이야기', () => {
  const maps = ['factory', 'sewer', 'school'];
  it('맵마다 8개이고 2에서 4줄이며 한 줄이 짧다', () => {
    expect(Object.keys(NOTES)).toEqual(maps);
    for (const id of maps) {
      expect(NOTES[id]).toHaveLength(NOTE_TOTAL);
      for (const n of NOTES[id]) {
        expect(n.length).toBeGreaterThanOrEqual(2);
        expect(n.length).toBeLessThanOrEqual(4);
        for (const line of n) expect(line.length).toBeLessThanOrEqual(34);
      }
    }
  });
  it('em dash, 가운뎃점, 피와 죽음 이야기가 없고 괴물 이름은 {name} 으로만 쓴다', () => {
    for (const id of maps) {
      const all = [...NOTES[id].flat(), FINAL_LINES[id], NOTE_DANGER_LINE].join('\n');
      expect(all).not.toMatch(/[—·]/);
      expect(all).not.toMatch(/피|죽|시체|살해/);
      expect(all).not.toMatch(/세이노|눈뜬이|큰입이/);
    }
  });
  it('fillName 이 모든 {name} 을 바꾼다', () => {
    for (const id of maps) {
      const all = fillName([...NOTES[id].flat(), FINAL_LINES[id], NOTE_DANGER_LINE], '눈뜬이').join('\n');
      expect(all).not.toMatch(/[{}]/);
    }
    expect(fillName(NOTES.factory[7], '큰입이').join('')).toContain('큰입이는');
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
