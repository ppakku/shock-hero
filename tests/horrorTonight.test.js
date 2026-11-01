import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { LAST_MAP_ID, MAP_IDS, MONSTER_IDS } from '../src/logic/horrorPick.js';
import { emptyHorror, normalizeHorror } from '../src/logic/horrorRun.js';
import { DONE_MAX } from '../src/logic/daily.js';
import { NOTES, NO_CATCH, NO_LIGHT, NO_RUN, NO_SHOCK, TONIGHT_RULES, finishTonight, tonightBroken, tonightEndText, tonightIntroLine, tonightLine, tonightMet, tonightPaid, tonightRound, tonightRuleText } from '../src/logic/horrorTonight.js';
import { tonightCard } from '../src/horror/chooser.js';
import { MAPS, MONSTERS } from '../src/horror/content.js';

const k = balance.horror;
const clean = { lit: false, ranFor: 0, shocks: 0, catches: 0, notes: 0 };
const days = Array.from({ length: 365 }, (_, i) => `2026-${String(Math.floor(i / 31) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`);

describe('오늘의 판 고르기', () => {
  it('같은 날은 언제나 같고, 날이 바뀌면 달라진다', () => {
    expect(tonightRound('2026-11-01')).toEqual(tonightRound('2026-11-01'));
    expect(new Set(days.map((d) => JSON.stringify({ ...tonightRound(d), date: 0 }))).size).toBeGreaterThan(20);
  });

  it('날짜를 그대로 들고 있다', () => {
    expect(tonightRound('2026-11-01').date).toBe('2026-11-01');
  });

  it('목록의 맵, 괴물, 조건만 나오고 마지막 밤은 나오지 않는다', () => {
    for (const d of days) {
      const t = tonightRound(d);
      expect(MAP_IDS).toContain(t.mapId);
      expect(MONSTER_IDS).toContain(t.monsterId);
      expect(TONIGHT_RULES).toContain(t.rule);
      expect(t.mapId).not.toBe(LAST_MAP_ID);
      expect(t.monsterIds).toBeUndefined();
    }
  });

  it('한 해면 모든 맵, 괴물, 조건이 나온다', () => {
    const seen = (key) => new Set(days.map((d) => tonightRound(d)[key]));
    expect(seen('mapId').size).toBe(MAP_IDS.length);
    expect(seen('monsterId').size).toBe(MONSTER_IDS.length);
    expect(seen('rule').size).toBe(TONIGHT_RULES.length);
  });
});

describe('조건 판정', () => {
  it('아무것도 안 했으면 쪽지 말고는 지킨 것이다', () => {
    for (const rule of [NO_LIGHT, NO_RUN, NO_SHOCK, NO_CATCH]) expect(tonightMet(rule, clean, k)).toBe(true);
    expect(tonightMet(NOTES, clean, k)).toBe(false);
  });

  it.each([
    [NO_LIGHT, { lit: true }],
    [NO_RUN, { ranFor: k.tonight.runGrace + 0.01 }],
    [NO_SHOCK, { shocks: 1 }],
    [NO_CATCH, { catches: 1 }],
  ])('%s 는 어기면 깨진다', (rule, broke) => {
    expect(tonightBroken(rule, { ...clean, ...broke }, k)).toBe(true);
    expect(tonightMet(rule, { ...clean, ...broke }, k)).toBe(false);
  });

  it('다른 조건을 어긴 것은 치지 않는다', () => {
    const all = { lit: true, ranFor: 99, shocks: 3, catches: 2, notes: 0 };
    expect(tonightBroken(NO_LIGHT, { ...all, lit: false }, k)).toBe(false);
    expect(tonightBroken(NO_RUN, { ...all, ranFor: 0 }, k)).toBe(false);
    expect(tonightBroken(NO_SHOCK, { ...all, shocks: 0 }, k)).toBe(false);
    expect(tonightBroken(NO_CATCH, { ...all, catches: 0 }, k)).toBe(false);
  });

  it('달리기는 조이스틱에 잠깐 닿은 만큼은 봐준다', () => {
    expect(tonightBroken(NO_RUN, { ...clean, ranFor: k.tonight.runGrace }, k)).toBe(false);
  });

  it('쪽지는 깨지지 않고 수가 차면 지킨 것이다', () => {
    expect(tonightBroken(NOTES, clean, k)).toBe(false);
    expect(tonightMet(NOTES, { ...clean, notes: k.tonight.notes - 1 }, k)).toBe(false);
    expect(tonightMet(NOTES, { ...clean, notes: k.tonight.notes }, k)).toBe(true);
  });
});

describe('보석', () => {
  const record = (done = []) => ({ ...emptyHorror(), tonightDone: done });

  it('값은 balance 에 있다', () => {
    expect(k.tonight.gems).toBe(15);
    expect(k.tonight.notes).toBe(3);
  });

  it('처음 성공한 날만 주고, 날짜를 적는다', () => {
    expect(finishTonight(record(), '2026-11-01', true, k)).toEqual({ met: true, gems: k.tonight.gems, done: ['2026-11-01'] });
  });

  it('같은 날 다시 지키면 주지 않는다', () => {
    expect(finishTonight(record(['2026-11-01']), '2026-11-01', true, k)).toEqual({ met: true, gems: 0, done: ['2026-11-01'] });
  });

  it('못 지키면 주지 않고 적지도 않는다', () => {
    expect(finishTonight(record(), '2026-11-01', false, k)).toEqual({ met: false, gems: 0, done: [] });
  });

  it('다음 날 받은 뒤에 끝난 어제 판도 어제 몫으로 한 번만 받는다', () => {
    const late = finishTonight(record(['2026-11-02']), '2026-11-01', true, k);
    expect(late.gems).toBe(k.tonight.gems);
    expect(late.done).toEqual(['2026-11-01', '2026-11-02']);
    expect(finishTonight(record(late.done), '2026-11-01', true, k).gems).toBe(0);
  });

  it('오래된 날짜는 정리해도 보석이 더 나가지 않는다', () => {
    const many = Array.from({ length: DONE_MAX + 5 }, (_, i) => `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`);
    expect(normalizeHorror({ tonightDone: many }).tonightDone).toHaveLength(DONE_MAX);
    expect(finishTonight(record(many.slice(-DONE_MAX)), many.at(-1), true, k).gems).toBe(0);
  });

  it('옛 저장은 빈 목록이고, 틀린 값은 버린다', () => {
    expect(normalizeHorror({ escapes: 2 }).tonightDone).toEqual([]);
    expect(normalizeHorror(undefined).tonightDone).toEqual([]);
    expect(normalizeHorror({ tonightDone: 'x' }).tonightDone).toEqual([]);
    expect(normalizeHorror({ tonightDone: ['2026-11-01', '2026-11-01', 'x', 3] }).tonightDone).toEqual(['2026-11-01']);
    expect(tonightPaid(normalizeHorror({ tonightDone: ['2026-11-01'] }), '2026-11-01')).toBe(true);
  });
});

describe('글', () => {
  it('조건마다 글이 있다', () => {
    expect(new Set(TONIGHT_RULES.map((r) => tonightRuleText(r, k))).size).toBe(TONIGHT_RULES.length);
  });

  it('쪽지 조건은 붉은 쪽지를 세지 않는다고 안내한다', () => {
    expect(tonightIntroLine(NOTES, k)).toContain('붉은 쪽지');
    expect(tonightIntroLine(NO_RUN, k)).not.toContain('붉은 쪽지');
  });

  it('게임 중 줄은 깨지면 알리고, 쪽지는 모은 수를 보인다', () => {
    expect(tonightLine(NO_RUN, clean, k)).toEqual({ text: tonightRuleText(NO_RUN, k), broken: false });
    expect(tonightLine(NO_SHOCK, { ...clean, shocks: 1 }, k)).toMatchObject({ broken: true });
    expect(tonightLine(NO_SHOCK, { ...clean, shocks: 1 }, k).text).toContain('깨졌어요');
    expect(tonightLine(NOTES, { ...clean, notes: 1 }, k).text).toContain(`1/${k.tonight.notes}`);
    expect(tonightLine(NOTES, { ...clean, notes: 7 }, k).text).toContain(`${k.tonight.notes}/${k.tonight.notes}`);
  });

  it('끝 화면은 지켰는지 분명하게 말한다', () => {
    expect(tonightEndText(NO_RUN, { met: false, gems: 0 }, k)).toContain('못 지켰어요');
    expect(tonightEndText(NO_RUN, { met: true, gems: 15 }, k)).toContain('보석 15개');
    expect(tonightEndText(NO_RUN, { met: true, gems: 0 }, k)).toContain('이미 받았어요');
  });

  it('카드는 이름을 맵과 괴물 표에서 읽고, 받았는지 보인다', () => {
    const t = { date: '2026-11-01', mapId: MAP_IDS[1], monsterId: MONSTER_IDS[2], rule: NO_RUN };
    const [top, low] = tonightCard(emptyHorror(), t, k);
    expect(top).toContain(MAPS[t.mapId].name);
    expect(top).toContain(MONSTERS[t.monsterId].name);
    expect(low).toContain(tonightRuleText(NO_RUN, k));
    expect(low).toContain(`보석 ${k.tonight.gems}개`);
    expect(tonightCard({ ...emptyHorror(), tonightDone: [t.date] }, t, k)[1]).toContain('받음');
  });
});
