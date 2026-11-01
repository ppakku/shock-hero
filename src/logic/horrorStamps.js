// 공포 모드 도장판: 맵과 괴물 조합마다 한 칸. 탈출하면 도장, 안 잡히고 탈출하면 금 도장을 찍고, 도장 수로 색을 연다.
import { MAP_IDS, MONSTER_IDS, isRound } from './horrorPick.js';

export const PLAIN = 'plain';
export const GOLD = 'gold';

export const cellKey = ({ mapId, monsterId }) => `${mapId}/${monsterId}`;
export const boardSize = () => MAP_IDS.length * MONSTER_IDS.length;
const cells = () => MAP_IDS.flatMap((mapId) => MONSTER_IDS.map((monsterId) => ({ mapId, monsterId })));

// 맵 순서대로 줄을 이룬 칸. stamp 는 PLAIN, GOLD, null 중 하나
export function boardCells(stamps) {
  return cells().map((c) => ({ ...c, stamp: stamps[cellKey(c)] ?? null }));
}

// 없는 조합과 틀린 값은 버린다. 지금 판에 있는 칸만 수에 들어가게 한다
export function normalizeStamps(data) {
  const out = {};
  for (const c of cells()) {
    const stamp = data?.[cellKey(c)];
    if (stamp === PLAIN || stamp === GOLD) out[cellKey(c)] = stamp;
  }
  return out;
}

export const stampCount = (stamps) => boardCells(stamps).filter((c) => c.stamp).length;
export const goldCount = (stamps) => boardCells(stamps).filter((c) => c.stamp === GOLD).length;

// 강제로 정한 판이든 랜덤 판이든 실제로 한 판에 찍는다. 금 도장은 일반 도장으로 돌아가지 않는다.
// earned: 이번에 새로 받은 도장. 칸이 그대로면 null
export function addStamp(stamps, round, clean) {
  if (!isRound(round)) return { stamps, earned: null };
  const key = cellKey(round);
  const stamp = clean ? GOLD : PLAIN;
  if (stamps[key] === GOLD || stamps[key] === stamp) return { stamps, earned: null };
  return { stamps: { ...stamps, [key]: stamp }, earned: stamp };
}

// 지금 고른 칸인지. 한쪽이 랜덤이면 그 줄 전체가 후보이고, 둘 다 랜덤이면 정해진 칸이 없다
export function isCurrentCell(cell, choice) {
  const anyMap = !MAP_IDS.includes(choice?.mapId);
  const anyMonster = !MONSTER_IDS.includes(choice?.monsterId);
  if (anyMap && anyMonster) return false;
  return (anyMap || cell.mapId === choice.mapId) && (anyMonster || cell.monsterId === choice.monsterId);
}

// 단계마다 필요한 도장 수. k.steps 는 판 크기에 대한 비율이라 마지막 단계는 언제나 판 전체다
export const stepCounts = (k) => k.steps.map((part) => Math.ceil(part * boardSize()));

// 색 목록의 맨 앞은 처음부터 쓰는 색이고, 그 뒤로 한 단계에 하나씩 열린다
const needOf = (index, k) => (index === 0 ? 0 : stepCounts(k)[index - 1]);

// list: k.bolts 또는 k.lights. picked: 저장된 색 id
export function lookOptions(list, stamps, k, picked) {
  const have = stampCount(stamps);
  const worn = wornLook(list, stamps, k, picked);
  return list.map((look, i) => ({ look, need: needOf(i, k), open: have >= needOf(i, k), on: look === worn }));
}

// 실제로 쓸 색. 없는 색이거나 아직 잠긴 색이면 기본 색이다
export function wornLook(list, stamps, k, picked) {
  const i = list.findIndex((look) => look.id === picked);
  return i >= 0 && stampCount(stamps) >= needOf(i, k) ? list[i] : list[0];
}

// 도장 수가 before 에서 after 로 늘며 새로 열린 색
export function openedLooks(before, after, k) {
  const was = stampCount(before);
  const now = stampCount(after);
  const opened = (list) => list.filter((_, i) => was < needOf(i, k) && now >= needOf(i, k));
  return [...opened(k.bolts), ...opened(k.lights)];
}

// 다음에 열리는 단계. 다 열렸으면 null
export function nextUnlock(stamps, k) {
  const have = stampCount(stamps);
  const step = stepCounts(k).findIndex((need) => need > have);
  if (step < 0) return null;
  return { need: stepCounts(k)[step], looks: [k.bolts[step + 1], k.lights[step + 1]] };
}

export const cssColor = (n) => `#${n.toString(16).padStart(6, '0')}`;
