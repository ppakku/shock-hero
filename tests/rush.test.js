import { describe, it, expect } from 'vitest';
import { rushCourses, courseUnlocked, normalizeRush, finishRush, carryHealth, emptyRush, RECORD_MAX } from '../src/logic/rush.js';
import { createSaveStore, resetProgress } from '../src/logic/save.js';
import { stages } from '../src/stage/index.js';

const gems = { rushClear: 5 };
const entry = (name, time, at = time) => ({ name, hero: 'shock', time, duo: false, at });

describe('보스 러시', () => {
  it('스테이지 다섯 개씩 코스 여덟 개', () => {
    const c = rushCourses(stages.length);
    expect(c).toHaveLength(8);
    expect(c[0].stages).toEqual([1, 2, 3, 4, 5]);
    expect(c[3].stages).toEqual([16, 17, 18, 19, 20]);
    expect(c[7].stages).toEqual([36, 37, 38, 39, 40]);
    expect(new Set(c.map((x) => x.name)).size).toBe(8);
  });

  it('코스의 스테이지를 다 깨야 열린다', () => {
    const [c1] = rushCourses(20);
    expect(courseUnlocked({ bestTimes: { 1: 9, 2: 9, 3: 9, 4: 9 } }, c1)).toBe(false);
    expect(courseUnlocked({ bestTimes: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9 } }, c1)).toBe(true);
  });

  it('기록은 빠른 순, 처음 깨면 보석, 다시 깨면 보석 없음', () => {
    let save = { gems: 2, rush: emptyRush() };
    const a = finishRush(save, 1, entry('꿀곰이', 300), gems);
    expect(a.rank).toBe(1);
    expect(a.gems).toBe(5);
    expect(a.patch.gems).toBe(7);
    save = { ...save, ...a.patch };
    const b = finishRush(save, 1, entry('말랑베개', 250), gems);
    expect(b.rank).toBe(1);
    expect(b.gems).toBe(0);
    expect(b.patch.gems).toBeUndefined();
    save = { ...save, ...b.patch };
    expect(save.rush.records[1].map((r) => r.name)).toEqual(['말랑베개', '꿀곰이']);
    expect(save.rush.player).toBe('말랑베개');
    expect(save.rush.cleared).toEqual([1]);
  });

  it('기록표는 최대 8개, 못 들면 rank 가 없다', () => {
    let save = { gems: 0, rush: emptyRush() };
    for (let i = 0; i < RECORD_MAX; i++) save = { ...save, ...finishRush(save, 2, entry('쿨쿨대장', 100 + i), gems).patch };
    const slow = finishRush(save, 2, entry('불꼬리', 999), gems);
    expect(slow.rank).toBeNull();
    expect(slow.patch.rush.records[2]).toHaveLength(RECORD_MAX);
    const fast = finishRush(save, 2, entry('불꼬리', 50), gems);
    expect(fast.rank).toBe(1);
    expect(fast.patch.rush.records[2].at(-1).time).toBe(106);
  });

  it('이상한 저장은 걸러 낸다', () => {
    const d = normalizeRush({ player: '누구', records: { 1: [entry('꿀곰이', 10), { name: '해커', time: 1 }, entry('꿀곰이', -5)], 9: [entry('꿀곰이', 10)] }, cleared: [1, 1, 7] }, 4);
    expect(d.player).toBe('꿀곰이');
    expect(d.records[1]).toHaveLength(1);
    expect(d.records[9]).toBeUndefined();
    expect(d.cleared).toEqual([1]);
  });

  it('예전 이름(아빠, 형) 기록은 별명으로 바꿔 읽는다', () => {
    const d = normalizeRush({ player: '동생', records: { 1: [{ name: '아빠', hero: 'giant', time: 300, at: 1 }, { name: '친구', hero: 'shock', time: 320, at: 2 }] } }, 4);
    expect(d.player).toBe('말랑베개');
    expect(d.records[1].map((r) => r.name)).toEqual(['쿨쿨대장', '꼬르륵']);
  });

  it('다음 보스로 갈 때 체력을 조금 채운다', () => {
    expect(carryHealth(0.4, 0.35)).toBeCloseTo(0.75);
    expect(carryHealth(0.9, 0.35)).toBe(1);
    expect(carryHealth(0, 0.35)).toBeCloseTo(0.35);
  });

  it('저장에 들어가고 레벨 초기화로 지워진다', () => {
    const mem = new Map();
    const store = createSaveStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) });
    const r = finishRush(store.load(), 1, entry('불꼬리', 123), gems);
    store.update(r.patch);
    expect(store.load().rush.records[1][0].name).toBe('불꼬리');
    store.save(resetProgress(store.load()));
    expect(store.load().rush.records).toEqual({});
  });
});
