import { describe, it, expect } from 'vitest';
import {
  todayKey, makeChallenge, todayChallenge, timeLimit, normalizeDaily, emptyDaily, finishDaily, ruleBroken,
  challengeText, doneToday, numberEul, DONE_MAX,
} from '../src/logic/daily.js';
import { defaultSave, createSaveStore } from '../src/logic/save.js';
import { HERO_IDS } from '../src/logic/heroes.js';

const saveWith = (bestTimes) => ({ ...defaultSave(), bestTimes });

describe('오늘의 도전', () => {
  it('날짜는 기기 현지 날짜 YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
    expect(todayKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });

  it('같은 날짜와 같은 저장이면 늘 같은 도전', () => {
    const s = saveWith({ 1: 80, 2: 120, 3: 150, 4: 200 });
    expect(makeChallenge('2026-10-27', s, 20)).toEqual(makeChallenge('2026-10-27', s, 20));
  });

  it('날짜가 바뀌면 도전도 여러 가지로 바뀐다', () => {
    const s = saveWith({ 1: 80, 2: 120, 3: 150, 4: 200, 5: 210 });
    const seen = new Set();
    for (let d = 1; d <= 28; d++) {
      const c = makeChallenge(`2026-11-${String(d).padStart(2, '0')}`, s, 20);
      seen.add(`${c.stage}-${c.hero}-${c.rule}`);
      expect(Object.keys(s.bestTimes).map(Number)).toContain(c.stage);
      expect(HERO_IDS).toContain(c.hero);
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('깬 스테이지가 없으면 스테이지 1, 시간 규칙은 안 나온다', () => {
    for (let d = 1; d <= 28; d++) {
      const c = makeChallenge(`2026-12-${String(d).padStart(2, '0')}`, defaultSave(), 20);
      expect(c.stage).toBe(1);
      expect(c.rule).not.toBe('time');
      expect(c.limit).toBeNull();
    }
  });

  it('시간 제한은 기록의 1.3배를 10초 단위로 올림, 적어도 60초', () => {
    expect(timeLimit(100)).toBe(130);
    expect(timeLimit(101)).toBe(140);
    expect(timeLimit(20)).toBe(60);
    const s = saveWith({ 4: 150 });
    for (let d = 1; d <= 28; d++) {
      const c = makeChallenge(`2027-01-${String(d).padStart(2, '0')}`, s, 20);
      if (c.rule === 'time') expect(c.limit).toBe(200);
    }
  });

  it('오늘 골라 둔 도전은 그날 스테이지를 더 깨도 그대로', () => {
    const s = saveWith({ 1: 80 });
    const first = todayChallenge(s, '2026-10-27', 20);
    expect(first.patch).not.toBeNull();
    const later = { ...s, bestTimes: { 1: 80, 2: 90, 3: 100 }, daily: first.patch.daily };
    expect(todayChallenge(later, '2026-10-27', 20)).toEqual({ challenge: first.challenge, patch: null });
    expect(todayChallenge(later, '2026-10-28', 20).challenge.date).toBe('2026-10-28');
  });

  it('규칙 위반', () => {
    const base = { deaths: 0, ults: 0, dashes: 0, time: 10 };
    expect(ruleBroken({ rule: 'noDeath' }, { ...base, deaths: 1 })).toBe(true);
    expect(ruleBroken({ rule: 'noUlt' }, { ...base, ults: 1 })).toBe(true);
    expect(ruleBroken({ rule: 'noDash' }, { ...base, dashes: 2 })).toBe(true);
    expect(ruleBroken({ rule: 'time', limit: 60 }, { ...base, time: 61 })).toBe(true);
    expect(ruleBroken({ rule: 'time', limit: 60 }, { ...base, time: 59 })).toBe(false);
    expect(ruleBroken({ rule: 'noUlt' }, { ...base, deaths: 3, dashes: 3 })).toBe(false);
  });

  it('그날 처음 성공했을 때만 보석', () => {
    const s = { ...saveWith({ 1: 80 }), gems: 5 };
    const c = { date: '2026-10-27', stage: 1, hero: 'shock', rule: 'noUlt', limit: null };
    expect(finishDaily(s, c, false, 3).gems).toBe(0);
    const r = finishDaily(s, c, true, 3);
    expect(r).toMatchObject({ gems: 3, first: true });
    expect(r.patch.gems).toBe(8);
    expect(r.patch.daily.count).toBe(1);
    const after = { ...s, ...r.patch };
    expect(doneToday(after, '2026-10-27')).toBe(true);
    expect(finishDaily(after, c, true, 3)).toMatchObject({ gems: 0, first: false, patch: null });
  });

  it('깬 날은 최근 것만 남기고 수는 계속 센다', () => {
    const done = Array.from({ length: 70 }, (_, i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`);
    const d = normalizeDaily({ done, count: 70 });
    expect(d.done.length).toBe(DONE_MAX);
    expect(d.count).toBe(70);
    expect(d.done[d.done.length - 1]).toBe(done[done.length - 1]);
  });

  it('이상한 저장은 빈 것으로', () => {
    expect(normalizeDaily(null)).toEqual(emptyDaily());
    expect(normalizeDaily({ done: ['어제', 3], count: -1, pick: { date: 'x' } })).toEqual(emptyDaily());
    expect(normalizeDaily({ pick: { date: '2026-10-27', stage: 2, hero: 'giant', rule: 'time' } }).pick).toBeNull(); // 시간 규칙인데 제한이 없음
  });

  it('저장소를 거쳐도 남는다', () => {
    const mem = new Map();
    const store = createSaveStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) });
    store.update({ daily: { done: ['2026-10-27'], count: 1, pick: { date: '2026-10-27', stage: 3, hero: 'gunner', rule: 'noDash', limit: null } } });
    expect(store.load().daily.pick.hero).toBe('gunner');
    expect(store.load().daily.count).toBe(1);
  });

  it('설명 문구 (조사, 금지 기호)', () => {
    expect(challengeText({ hero: 'giant', stage: 4, rule: 'time', limit: 180 })).toBe('강철 거인으로 스테이지 4를 3분 안에 깨기');
    expect(challengeText({ hero: 'shock', stage: 1, rule: 'noDeath' })).toBe('쇼크 히어로로 스테이지 1을 한 번도 안 쓰러지고 깨기');
    expect(challengeText({ hero: 'gunner', stage: 10, rule: 'time', limit: 130 })).toBe('번개 사수로 스테이지 10을 2분 10초 안에 깨기');
    expect(numberEul(12)).toBe('를');
    expect(numberEul(20)).toBe('을');
    for (const rule of ['time', 'noDeath', 'noUlt', 'noDash']) {
      const t = challengeText({ hero: 'giant', stage: 3, rule, limit: 90 });
      expect(t).not.toMatch(/[—·]/);
    }
  });
});
