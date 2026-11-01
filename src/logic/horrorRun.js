// 공포 모드 한 판의 규칙과 기록 (화면과 상관없는 부분)
import { isRound } from './horrorPick.js';
import { reachable, withOpen } from './horrorGrid.js';
import { createCode, CLUE_COUNT } from './horrorCode.js';
import { normalizeStamps } from './horrorStamps.js';

export const KEY_NAMES = ['빨간', '파란']; // 잠긴 문과 열쇠의 색. map.locks 순서

const inArea = (area) => (c) => area.has(`${c.cx},${c.cy}`);

function shuffled(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 앞 문들을 연 뒤에 갈 수 있는 곳에서 고른다. 그래서 어떤 판이든 열쇠 1, 날개 1, 열쇠 2, 날개 2 순서로 풀린다
function placeKeys(map, rand) {
  const used = [];
  return map.locks.map((_, lock) => {
    const area = reachable(withOpen(map, map.locks.map((__, i) => i).slice(0, lock)), map.start);
    const spot = shuffled(map.keys.filter(inArea(area)), rand).find((c) => !used.includes(c));
    if (!spot) throw new Error(`${lock + 1}번 열쇠 자리가 없습니다`);
    used.push(spot);
    return { ...spot, lock, taken: false };
  });
}

// 날개마다 퓨즈를 정해진 수만큼 먼저 놓는다. 그래야 잠긴 문을 꼭 열게 된다
function placeFuses(map, k, rand) {
  const all = map.locks.map((_, i) => i);
  const base = reachable(map, map.start);
  const spots = map.fuses.filter(inArea(reachable(withOpen(map, all), map.start)));
  if (spots.length < k.fuseCount) {
    throw new Error(`퓨즈 자리가 모자랍니다: ${spots.length} / ${k.fuseCount}`);
  }
  const picked = [];
  for (const lock of all) {
    const wing = inArea(reachable(withOpen(map, [lock]), map.start));
    picked.push(...shuffled(spots.filter((c) => wing(c) && !base.has(`${c.cx},${c.cy}`)), rand).slice(0, k.wingFuses));
  }
  const rest = shuffled(spots.filter((c) => !picked.includes(c)), rand);
  return shuffled([...picked, ...rest].slice(0, k.fuseCount), rand);
}

// 세이노가 지금 갈 수 있는 순찰 지점만 남긴다. 닫힌 날개로 보내면 나오지 못한다
function refreshPatrol(level, all) {
  const area = reachable(level, level.stalker || level.start);
  level.patrol = all.filter(inArea(area));
}

// 이번 판에 퓨즈가 없는 자리 가운데 열쇠 없이 갈 수 있는 곳에 놓는다. 다 끝난 날개로 다시 돌아가지 않게 한다
function placeClues(map, fuses, rand) {
  const open = inArea(reachable(withOpen(map), map.start));
  return shuffled(map.fuses.filter((c) => open(c) && !fuses.includes(c)), rand).slice(0, CLUE_COUNT);
}

export function createRun(map, k, rand = Math.random) {
  const level = withOpen(map); // 판마다 따로 여는 맵 사본
  refreshPatrol(level, map.patrol);
  const fuses = placeFuses(map, k, rand);
  return {
    level,
    allPatrol: map.patrol,
    fuses: fuses.map((c) => ({ ...c, taken: false })),
    clues: placeClues(map, fuses, rand).map((c) => ({ ...c, taken: false })),
    code: createCode(rand),
    keys: placeKeys(map, rand),
    doors: map.locks.map((c) => ({ ...c, open: false })),
    have: 0,
    shock: false,
    usedBoxes: [],
    caughtCount: 0,
    powered: false,
    escaped: false,
  };
}

export function takeFuse(run, i) {
  const f = run.fuses[i];
  if (!f || f.taken) return false;
  f.taken = true;
  run.have += 1;
  return true;
}

export function takeClue(run, i) {
  const clue = run.clues[i];
  if (!clue || clue.taken) return false;
  clue.taken = true;
  return true;
}

export const cluesFound = (run) => run.clues.filter((c) => c.taken).length;

export function takeKey(run, i) {
  const key = run.keys[i];
  if (!key || key.taken) return false;
  key.taken = true;
  return true;
}

// 맞는 열쇠가 있어야 열린다. 열린 뒤로는 주인공도 세이노도 지나다니고 시선도 통한다
export function openDoor(run, i) {
  const door = run.doors[i];
  if (!door || door.open || !run.keys[i].taken) return false;
  door.open = true;
  run.level.locked.delete(door.cy * run.level.w + door.cx);
  refreshPatrol(run.level, run.allPatrol);
  return true;
}

// 주웠고 아직 쓰지 않은 열쇠 수
export const keysHeld = (run) => run.keys.filter((key) => key.taken && !run.doors[key.lock].open).length;

export function chargeShock(run, box) {
  if (run.shock || run.usedBoxes.includes(box)) return false;
  run.shock = true;
  run.usedBoxes.push(box);
  return true;
}

export function useShock(run) {
  if (!run.shock) return false;
  run.shock = false;
  return true;
}

export function insertFuses(run, k) {
  if (run.have < k.fuseCount) return false;
  run.powered = true;
  return true;
}

// 손이 닿는 가장 가까운 것. 없으면 null. hidden 은 숨어 있는 사물함 번호 (아니면 null).
// 'locked' 는 맞는 열쇠가 없는 문이다. 누를 수 없고 안내만 보인다
// notes: logic/horrorNotes.js 의 쪽지 상태. 사물함과 거리로 겨뤄서, 쫓길 때 쪽지가 숨기를 가로막지 않는다
export function nearestUse(run, map, p, hidden, k, notes) {
  if (hidden !== null) return { kind: 'locker', index: hidden, label: '사물함에서 나오기' };
  let best = null;
  let bestD = Infinity;
  const add = (kind, index, label, cell) => {
    const d = Math.hypot(cell.cx + 0.5 - p.x, cell.cy + 0.5 - p.y);
    if (d > k.useRange || d >= bestD) return;
    bestD = d;
    best = { kind, index, label };
  };
  run.fuses.forEach((f, i) => !f.taken && add('fuse', i, '퓨즈 줍기', f));
  run.keys.forEach((c, i) => !c.taken && add('key', i, `${KEY_NAMES[i]} 열쇠 줍기`, c));
  run.clues.forEach((c, i) => !c.taken && add('clue', i, '붉은 쪽지 읽기', c));
  notes?.spots.forEach((s, i) => !notes.taken[i] && add('note', i, '쪽지 읽기', { cx: s.x - 0.5, cy: s.y - 0.5 }));
  run.doors.forEach((c, i) => {
    if (!c.open) add(run.keys[i].taken ? 'lock' : 'locked', i, run.keys[i].taken ? '문 열기' : `${KEY_NAMES[i]} 열쇠가 필요해`, c);
  });
  map.lockers.forEach((c, i) => add('locker', i, '사물함에 숨기', c));
  if (!run.shock) map.boxes.forEach((c, i) => !run.usedBoxes.includes(i) && add('box', i, '쇼크 충전', c));
  if (!run.powered) add('panel', 0, run.have >= k.fuseCount ? '퓨즈 꽂기' : `퓨즈가 ${k.fuseCount}개 필요해`, map.panel);
  else add('gate', 0, '정문 번호 넣기', map.gate);
  return best;
}

// 잡힌 자리에서 가장 가까운 돌아올 곳 (시작 지점 포함). 맵이 커서 늘 시작 지점으로 보내면
// 세이노도 늘 시작 지점에서 먼 곳, 곧 남은 목표 옆으로 가서 같은 자리에서 또 잡힌다
export function respawnSpot(map, p) {
  let best = map.start;
  for (const c of map.returns) {
    if (Math.hypot(c.cx + 0.5 - p.x, c.cy + 0.5 - p.y) < Math.hypot(best.cx + 0.5 - p.x, best.cy + 0.5 - p.y)) best = c;
  }
  return best;
}

export function caught(run) {
  run.caughtCount += 1;
}

// 전원이 들어와 있고 아직 탈출 전일 때만 탈출이 된다. 아니면 null (HorrorGame 은 null 이면 보상을 주지 않는다).
export function escape(run) {
  if (!run.powered || run.escaped) return null;
  run.escaped = true;
  return { clean: run.caughtCount === 0 };
}

// 이번 탈출에 받을 보석. 탈출 보석은 날마다 첫 탈출에만, 안 잡힌 보너스는 처음 한 번만 준다.
// today 는 기기 날짜 'YYYY-MM-DD' (src/logic/daily.js 의 todayKey). 시계를 재지 않도록 밖에서 받는다.
export function escapeReward(record, clean, today, k) {
  const daily = record.gemDay === today ? 0 : k.gemsEscape;
  const bonus = clean && record.cleanEscapes === 0 ? k.gemsClean : 0;
  return { daily, bonus, gems: daily + bonus };
}

// 마지막 밤의 보석은 처음 깼을 때 한 번만 준다. 다시 해도 탈출 보석과 도장은 없다
export function lastNightReward(record, k) {
  return { gems: record.lastCleared ? 0 : k.lastNight.gems };
}

export const recordLastNight = (record) => ({ ...record, lastCleared: true });

// gemDay: 탈출 보석을 마지막으로 받은 날. 없으면 아직 받은 적이 없다
// last: 지난 판의 { mapId, monsterId }. 다음 판을 다르게 고르는 데 쓴다
// stamps: 도장판 { '맵/괴물': 'plain' | 'gold' }. bolt, light: 고른 번개와 손전등 색 id (logic/horrorStamps.js)
// lastCleared: 마지막 밤을 깬 적이 있는지
export function emptyHorror() {
  return { escapes: 0, cleanEscapes: 0, gemDay: null, last: null, stamps: {}, bolt: null, light: null, lastCleared: false };
}

export function normalizeHorror(data) {
  const d = emptyHorror();
  if (Number.isInteger(data?.escapes) && data.escapes > 0) d.escapes = data.escapes;
  if (Number.isInteger(data?.cleanEscapes) && data.cleanEscapes > 0) d.cleanEscapes = Math.min(data.cleanEscapes, d.escapes);
  if (typeof data?.gemDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.gemDay)) d.gemDay = data.gemDay;
  if (isRound(data?.last)) d.last = { mapId: data.last.mapId, monsterId: data.last.monsterId };
  d.stamps = normalizeStamps(data?.stamps);
  if (typeof data?.bolt === 'string') d.bolt = data.bolt;
  if (typeof data?.light === 'string') d.light = data.light;
  d.lastCleared = data?.lastCleared === true;
  return d;
}

export function recordEscape(record, clean, today) {
  return { ...record, escapes: record.escapes + 1, cleanEscapes: record.cleanEscapes + (clean ? 1 : 0), gemDay: today };
}
