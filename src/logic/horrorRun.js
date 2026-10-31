// 공포 모드 한 판의 규칙과 기록 (화면과 상관없는 부분)
import { reachable } from './horrorGrid.js';

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

export function caught(run) {
  run.caughtCount += 1;
}

// 전원이 들어와 있고 아직 탈출 전일 때만 보상을 준다. 아니면 null (HorrorGame 은 null 이면 보상을 주지 않는다).
export function escape(run, k) {
  if (!run.powered || run.escaped) return null;
  run.escaped = true;
  const clean = run.caughtCount === 0;
  return { gems: k.gemsEscape + (clean ? k.gemsClean : 0), clean };
}

export function emptyHorror() {
  return { escapes: 0, cleanEscapes: 0 };
}

export function normalizeHorror(data) {
  const d = emptyHorror();
  if (Number.isInteger(data?.escapes) && data.escapes > 0) d.escapes = data.escapes;
  if (Number.isInteger(data?.cleanEscapes) && data.cleanEscapes > 0) d.cleanEscapes = Math.min(data.cleanEscapes, d.escapes);
  return d;
}

export function recordEscape(record, clean) {
  return { escapes: record.escapes + 1, cleanEscapes: record.cleanEscapes + (clean ? 1 : 0) };
}
