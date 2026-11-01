// 공포 모드 오늘의 밤: 날짜로 맵, 괴물, 조건을 정한다. 같은 날이면 누구나 같은 판이다.
// 조건을 못 지켜도 판은 끝까지 간다. 지키고 탈출하면 하루에 한 번 보석을 더 받는다.
// 판이 자정을 넘겨도 시작한 날로 따진다. 그래서 date 는 시작할 때 정해서 끝까지 들고 간다.
import { DONE_MAX, seededRandom } from './daily.js';
import { MAP_IDS, MONSTER_IDS } from './horrorPick.js';

export const NO_LIGHT = 'noLight';
export const NO_RUN = 'noRun';
export const NO_SHOCK = 'noShock';
export const NO_CATCH = 'noCatch';
export const NOTES = 'notes';
export const TONIGHT_RULES = [NO_LIGHT, NO_RUN, NO_SHOCK, NO_CATCH, NOTES];

// 어느 맵과 괴물이 나와도 다섯 조건 모두 지킬 수 있다 (tests/horrorPlay.test.js 의 봇이 잰다).
// 마지막 밤의 맵과 두 괴물 판은 목록에 없어서 나오지 않는다
export function tonightRound(date) {
  const rand = seededRandom(`horror-tonight-${date}`);
  const pickOne = (list) => list[Math.floor(rand() * list.length) % list.length];
  const mapId = pickOne(MAP_IDS);
  const monsterId = pickOne(MONSTER_IDS);
  return { date, mapId, monsterId, rule: pickOne(TONIGHT_RULES) };
}

// 조건 설명 한 줄
export function tonightRuleText(rule, k) {
  if (rule === NO_LIGHT) return '손전등을 켜지 않기';
  if (rule === NO_RUN) return '달리지 않기';
  if (rule === NO_SHOCK) return '전기충격기를 쏘지 않기';
  if (rule === NO_CATCH) return '한 번도 안 잡히기';
  return `쪽지 ${k.tonight.notes}장 읽기`;
}

// 안내 화면의 한 줄. 정문 번호를 알려 주는 붉은 쪽지는 어차피 읽으므로 세지 않는다고 알린다
export function tonightIntroLine(rule, k) {
  return `오늘의 밤 조건: ${tonightRuleText(rule, k)}${rule === NOTES ? ' (붉은 쪽지는 빼고)' : ''}`;
}

// 게임 중 조건이 깨졌는지. counts = { lit, ranFor, shocks, catches, notes }
// lit: 손전등을 켠 적이 있는지, ranFor: 달린 시간 (초). 쪽지 조건은 깨지지 않고, 끝날 때까지 모으면 된다
export function tonightBroken(rule, counts, k) {
  if (rule === NO_LIGHT) return counts.lit;
  if (rule === NO_RUN) return counts.ranFor > k.tonight.runGrace; // 손가락이 조이스틱 끝에 잠깐 닿은 것은 치지 않는다
  if (rule === NO_SHOCK) return counts.shocks > 0;
  if (rule === NO_CATCH) return counts.catches > 0;
  return false;
}

export function tonightMet(rule, counts, k) {
  return rule === NOTES ? counts.notes >= k.tonight.notes : !tonightBroken(rule, counts, k);
}

// 게임 중 화면에 놓는 작은 줄. broken: 깨졌으면 빨간색으로 놓는다
export function tonightLine(rule, counts, k) {
  if (tonightBroken(rule, counts, k)) return { text: `${tonightRuleText(rule, k)} (깨졌어요)`, broken: true };
  if (rule === NOTES) return { text: `쪽지 읽기 ${Math.min(counts.notes, k.tonight.notes)}/${k.tonight.notes}`, broken: false };
  return { text: tonightRuleText(rule, k), broken: false };
}

// 탈출한 뒤 판정. date: 판을 시작한 날. 그날 처음 성공했을 때만 보석을 준다
// { met, gems, done } done 은 저장할 성공한 날 목록이다
export function finishTonight(record, date, met, k) {
  if (!met || record.tonightDone.includes(date)) return { met, gems: 0, done: record.tonightDone };
  return { met, gems: k.tonight.gems, done: [...record.tonightDone, date].sort().slice(-DONE_MAX) };
}

// 끝 화면의 한 줄. result: finishTonight 의 결과
export function tonightEndText(rule, result, k) {
  const name = tonightRuleText(rule, k);
  if (!result.met) return `오늘의 밤 조건을 못 지켰어요: ${name}. 다시 해 볼 수 있어요`;
  return `오늘의 밤 조건 성공: ${name}! ${result.gems ? `보석 ${result.gems}개 더` : '오늘 보석은 이미 받았어요'}`;
}

// 고르기 화면에서 오늘 보석을 이미 받았는지
export const tonightPaid = (record, date) => record.tonightDone.includes(date);

// 저장된 날짜 목록을 고른다. 틀린 값은 버리고 최근 날짜만 남긴다
export function normalizeTonightDone(list) {
  if (!Array.isArray(list)) return [];
  const dates = list.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  return [...new Set(dates)].sort().slice(-DONE_MAX);
}
