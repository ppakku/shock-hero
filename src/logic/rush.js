// 보스 러시: 보스 다섯 마리와 쉬지 않고 연달아 싸우고, 걸린 시간으로 가족 기록표에 이름을 올린다.
// 화면 없이 계산만 한다 (게임 장면은 src/scenes/GameScene.js, 고르는 화면은 src/scenes/RushScene.js).
//
// 저장: save.rush = {
//   player: '형',                     지난번에 고른 사람
//   records: { 1: [{ name, hero, time, duo, at }] },  코스별 기록 (빠른 순, 최대 RECORD_MAX 개)
//   cleared: [1, 3],                  한 번이라도 끝까지 깬 코스 (처음 깨면 보석)
// }

export const COURSE_SIZE = 5;
export const RECORD_MAX = 8;
export const PLAYERS = ['아빠', '엄마', '형', '동생', '친구'];
const COURSE_NAMES = ['처음 만난 보스들', '더 세진 보스들', '돌아온 보스들', '마지막 보스들'];

// 스테이지 다섯 개씩 한 코스. [{ id, name, stages: [1..5] }]
export function rushCourses(stageCount) {
  const out = [];
  for (let s = 1, id = 1; s <= stageCount; s += COURSE_SIZE, id++) {
    const list = [];
    for (let n = s; n < s + COURSE_SIZE && n <= stageCount; n++) list.push(n);
    out.push({ id, name: COURSE_NAMES[id - 1] || `코스 ${id}`, stages: list });
  }
  return out;
}

// 코스의 스테이지를 모두 깼으면 열린다
export function courseUnlocked(save, course) {
  return course.stages.every((n) => save.bestTimes?.[n] > 0);
}

export function emptyRush() {
  return { player: PLAYERS[2], records: {}, cleared: [] };
}

const validTime = (t) => typeof t === 'number' && Number.isFinite(t) && t > 0 && t < 360000;

export function normalizeRush(data, courseCount) {
  const d = emptyRush();
  if (!data || typeof data !== 'object') return d;
  if (PLAYERS.includes(data.player)) d.player = data.player;
  const validCourse = (n) => Number.isInteger(n) && n >= 1 && n <= courseCount;
  if (data.records && typeof data.records === 'object') {
    for (const [k, list] of Object.entries(data.records)) {
      if (!validCourse(Number(k)) || !Array.isArray(list)) continue;
      const ok = list
        .filter((r) => r && PLAYERS.includes(r.name) && validTime(r.time))
        .map((r) => ({ name: r.name, hero: typeof r.hero === 'string' ? r.hero : 'shock', time: r.time, duo: r.duo === true, at: Number.isFinite(r.at) ? r.at : 0 }));
      if (ok.length) d.records[Number(k)] = sortRecords(ok).slice(0, RECORD_MAX);
    }
  }
  if (Array.isArray(data.cleared)) d.cleared = [...new Set(data.cleared.filter(validCourse))].sort((a, b) => a - b);
  return d;
}

// 빠른 순, 같은 시간이면 먼저 세운 기록이 위
function sortRecords(list) {
  return [...list].sort((a, b) => a.time - b.time || a.at - b.at);
}

// 코스를 끝까지 깼을 때. entry = { name, hero, time, duo, at }
// 돌려줌: { patch: { rush, gems? }, rank (1부터, 기록표에 못 들면 null), gems, firstClear, best }
export function finishRush(save, courseId, entry, gemCfg, courseCount = 4) {
  const rush = normalizeRush(save.rush, courseCount);
  const prev = rush.records[courseId] || [];
  const all = sortRecords([...prev, entry]);
  const rank = all.indexOf(entry) + 1;
  const list = all.slice(0, RECORD_MAX);
  const firstClear = !rush.cleared.includes(courseId);
  const gems = firstClear ? gemCfg?.rushClear || 0 : 0;
  const patch = {
    rush: {
      ...rush,
      player: entry.name,
      records: { ...rush.records, [courseId]: list },
      cleared: firstClear ? [...rush.cleared, courseId].sort((a, b) => a - b) : rush.cleared,
    },
  };
  if (gems > 0) patch.gems = (save.gems || 0) + gems;
  return { patch, rank: rank <= RECORD_MAX ? rank : null, gems, firstClear, best: list[0] };
}

// 다음 보스로 넘어갈 때 체력: 지난 보스전이 끝났을 때 남은 비율에 회복을 더한다 (0~1)
export function carryHealth(ratio, heal) {
  const r = Number.isFinite(ratio) ? ratio : 1;
  return Math.max(0.05, Math.min(1, r + heal));
}
