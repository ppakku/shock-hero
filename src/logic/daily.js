// 오늘의 도전: 날마다 바뀌는 짧은 과제. 깬 스테이지 하나를 정해진 주인공과 규칙으로 다시 깨면 보석을 받는다.
// 화면 없이 계산만 한다 (고르는 화면은 src/scenes/DailyScene.js, 게임 속 확인은 src/scenes/GameScene.js).
// 연속 출석 보상이나 연속 일수는 일부러 없다. 안 한 날이 있어도 손해가 없게.
//
// 저장: save.daily = {
//   done: ['2026-10-27', ...]   도전을 깬 날 (최근 DONE_MAX 개만)
//   count: 12                   지금까지 깬 도전 수
//   pick: { date, stage, hero, rule, limit }  오늘 고른 도전 (같은 날 스테이지를 더 깨도 도전이 바뀌지 않게)
// }
import { HERO_IDS, HERO_INFO } from './heroes.js';

export const DONE_MAX = 60;
export const RULES = ['time', 'noDeath', 'noUlt', 'noDash'];

// 기기 시계의 오늘 날짜 'YYYY-MM-DD'
export function todayKey(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// 글자로 시작값을 정하는 작은 난수 (같은 글자면 늘 같은 순서)
export function seededRandom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 시간 제한: 가장 빠른 기록의 1.3배를 10초 단위로 올림, 적어도 60초
export function timeLimit(best) {
  return Math.max(60, Math.ceil((best * 1.3) / 10) * 10);
}

const validDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// 오늘의 도전 고르기. 깬 스테이지 중 하나 (없으면 스테이지 1), 주인공 하나, 규칙 하나
export function makeChallenge(date, save, stageCount) {
  const rand = seededRandom(`daily-${date}`);
  const pickOne = (list) => list[Math.floor(rand() * list.length) % list.length];
  const cleared = Object.keys(save.bestTimes || {})
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= stageCount && save.bestTimes[n] > 0)
    .sort((a, b) => a - b);
  const stage = cleared.length ? pickOne(cleared) : 1;
  const hero = pickOne(HERO_IDS);
  const best = save.bestTimes?.[stage];
  const rules = best > 0 ? RULES : RULES.filter((r) => r !== 'time');
  const rule = pickOne(rules);
  return { date, stage, hero, rule, limit: rule === 'time' ? timeLimit(best) : null };
}

function validPick(p, stageCount) {
  return (
    p && typeof p === 'object' && validDate(p.date) && Number.isInteger(p.stage) && p.stage >= 1 && p.stage <= stageCount &&
    HERO_IDS.includes(p.hero) && RULES.includes(p.rule) && (p.rule !== 'time' || (typeof p.limit === 'number' && p.limit > 0))
  );
}

// 오늘 도전: 이미 오늘 골라 둔 게 있으면 그대로, 없으면 새로 고른다. { challenge, patch } (patch 는 저장할 것, 없으면 null)
export function todayChallenge(save, date, stageCount) {
  const d = normalizeDaily(save.daily, stageCount);
  if (d.pick && d.pick.date === date) return { challenge: d.pick, patch: null };
  const challenge = makeChallenge(date, save, stageCount);
  return { challenge, patch: { daily: { ...d, pick: challenge } } };
}

export function emptyDaily() {
  return { done: [], count: 0, pick: null };
}

export function normalizeDaily(data, stageCount = 99) {
  const d = emptyDaily();
  if (!data || typeof data !== 'object') return d;
  if (Array.isArray(data.done)) d.done = [...new Set(data.done.filter(validDate))].sort().slice(-DONE_MAX);
  if (Number.isInteger(data.count) && data.count >= 0) d.count = Math.max(data.count, d.done.length);
  else d.count = d.done.length;
  if (validPick(data.pick, stageCount)) d.pick = { ...data.pick, limit: data.pick.rule === 'time' ? data.pick.limit : null };
  return d;
}

export function doneToday(save, date) {
  return Boolean(save.daily?.done?.includes(date));
}

// 주인공 이름에 맞는 조사 (으로/로)
function withRo(name) {
  const last = name.charCodeAt(name.length - 1) - 0xac00;
  const jong = last >= 0 && last <= 11171 ? last % 28 : 0;
  return `${name}${jong === 0 || jong === 8 ? '로' : '으로'}`;
}

// 숫자를 읽었을 때 받침이 있으면 을, 없으면 를 (1 일, 3 삼, 10 십 은 을 / 2 이, 4 사 는 를)
export function numberEul(n) {
  return [2, 4, 5, 9].includes(n % 10) ? '를' : '을';
}

function minutesText(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

export const RULE_SHORT = { time: '시간 안에', noDeath: '안 쓰러지고', noUlt: '궁극기 없이', noDash: '대시 없이' };

// 도전 설명 한 줄. 예: "강철 거인으로 스테이지 4를 3분 안에 깨기"
export function challengeText(c) {
  const who = withRo(HERO_INFO[c.hero]?.name || '쇼크 히어로');
  const st = `스테이지 ${c.stage}${numberEul(c.stage)}`;
  if (c.rule === 'time') return `${who} ${st} ${minutesText(c.limit)} 안에 깨기`;
  if (c.rule === 'noDeath') return `${who} ${st} 한 번도 안 쓰러지고 깨기`;
  if (c.rule === 'noUlt') return `${who} ${st} 궁극기 안 쓰고 깨기`;
  return `${who} ${st} 대시 안 쓰고 깨기`;
}

// 게임 중 규칙이 깨졌는지. counts = { deaths, ults, dashes, time }
export function ruleBroken(c, counts) {
  if (c.rule === 'time') return counts.time > c.limit;
  if (c.rule === 'noDeath') return counts.deaths > 0;
  if (c.rule === 'noUlt') return counts.ults > 0;
  if (c.rule === 'noDash') return counts.dashes > 0;
  return false;
}

// 도전 스테이지를 깼을 때. ok: 규칙을 지켰는지. { patch, gems, first } (오늘 처음 성공했을 때만 보석)
export function finishDaily(save, c, ok, gemReward, stageCount = 99) {
  const d = normalizeDaily(save.daily, stageCount);
  if (!ok || d.done.includes(c.date)) return { patch: null, gems: 0, first: false };
  const daily = { ...d, done: [...d.done, c.date].sort().slice(-DONE_MAX), count: d.count + 1 };
  return { patch: { daily, gems: (save.gems || 0) + gemReward }, gems: gemReward, first: true };
}
