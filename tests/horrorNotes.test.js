import { describe, it, expect } from 'vitest';
import { createNotes, takeNote, noteNear, allFound, NOTE_TOTAL } from '../src/logic/horrorNotes.js';
import { NOTES, FINAL_LINE } from '../src/horror/story.js';

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
  it('8개를 다 주워야 allFound 이고 마지막 번호는 7이다', () => {
    const s = createNotes(spots, seeded(5));
    let last = -1;
    for (let i = 0; i < s.total; i++) {
      expect(allFound(s)).toBe(false);
      last = takeNote(s, i);
    }
    expect(last).toBe(NOTE_TOTAL - 1);
    expect(allFound(s)).toBe(true);
  });
  it('가까운 쪽지만 찾고, 주운 것은 건너뛴다', () => {
    const s = createNotes(spots, seeded(2));
    const p = s.spots[4];
    expect(noteNear(s, p.x + 0.3, p.y, 1.2)).toBe(4);
    takeNote(s, 4);
    expect(noteNear(s, p.x, p.y, 0.5)).toBe(-1);
  });
  it('자리가 없으면 allFound 가 아니다', () => {
    expect(allFound(createNotes([], Math.random))).toBe(false);
  });
});
