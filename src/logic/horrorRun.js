// 공포 모드 한 판의 규칙과 기록 (화면과 상관없는 부분)
import { reachable, center } from './horrorGrid.js';

export function createRun(map, k, rand = Math.random) {
  const open = reachable(map, map.start);
  const spots = map.fuses.filter((c) => open.has(`${c.cx},${c.cy}`));
  if (spots.length < k.fuseCount) {
    throw new Error(`퓨즈 자리가 모자랍니다: ${spots.length} / ${k.fuseCount}`);
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return {
    fuses: spots.slice(0, k.fuseCount).map((c) => ({ ...c, taken: false })),
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

// 손이 닿는 가장 가까운 것. 없으면 null. hidden 은 숨어 있는 사물함 번호 (아니면 null)
export function nearestUse(run, map, p, hidden, k) {
  if (hidden !== null) return { kind: 'locker', index: hidden, label: '사물함에서 나오기' };
  const list = [];
  const add = (kind, index, label, cell) => {
    const c = center(cell);
    list.push({ kind, index, label, d: Math.hypot(c.x - p.x, c.y - p.y) });
  };
  run.fuses.forEach((f, i) => !f.taken && add('fuse', i, '퓨즈 줍기', f));
  map.lockers.forEach((c, i) => add('locker', i, '사물함에 숨기', c));
  if (!run.shock) map.boxes.forEach((c, i) => !run.usedBoxes.includes(i) && add('box', i, '쇼크 충전', c));
  if (!run.powered) add('panel', 0, run.have >= k.fuseCount ? '퓨즈 꽂기' : `퓨즈가 ${k.fuseCount}개 필요해`, map.panel);
  else add('gate', 0, '정문으로 탈출', map.gate);
  const near = list.filter((t) => t.d <= k.useRange);
  if (!near.length) return null;
  const { kind, index, label } = near.reduce((a, b) => (b.d < a.d ? b : a));
  return { kind, index, label };
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

// gemDay: 탈출 보석을 마지막으로 받은 날. 없으면 아직 받은 적이 없다
export function emptyHorror() {
  return { escapes: 0, cleanEscapes: 0, gemDay: null };
}

export function normalizeHorror(data) {
  const d = emptyHorror();
  if (Number.isInteger(data?.escapes) && data.escapes > 0) d.escapes = data.escapes;
  if (Number.isInteger(data?.cleanEscapes) && data.cleanEscapes > 0) d.cleanEscapes = Math.min(data.cleanEscapes, d.escapes);
  if (typeof data?.gemDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.gemDay)) d.gemDay = data.gemDay;
  return d;
}

export function recordEscape(record, clean, today) {
  return { escapes: record.escapes + 1, cleanEscapes: record.cleanEscapes + (clean ? 1 : 0), gemDay: today };
}
