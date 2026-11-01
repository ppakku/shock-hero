// 한 판에 나오는 괴물 목록 계산. 한 마리 판도 두 마리 판도 같은 길을 지난다.
import { createStalker, sendAway } from './horrorStalker.js';

// ids 순서대로 맵의 괴물 칸에 세운다. 둘째는 맵의 둘째 칸 (map.stalker2) 에서 시작한다
export function createStalkers(map, k, rand, ids) {
  return ids.map((id, i) => createStalker(map, k, rand, id, i === 0 ? map.stalker : map.stalker2));
}

const gapTo = (s, p) => Math.hypot(s.x - p.x, s.y - p.y);

export function nearestStalker(list, p) {
  return list.reduce((best, s) => (gapTo(s, p) < gapTo(best, p) ? s : best));
}

export const anyChasing = (list) => list.some((s) => s.mode === 'chase');

// 잡힌 뒤에는 모두 멀리 보낸다. 잡히지 않은 쪽도 함께 쉬어야 돌아오자마자 잡히지 않는다. 서로 다른 곳으로 보낸다
export function sendAllAway(list, map, player, rand = Math.random) {
  const taken = [];
  for (const s of list) {
    sendAway(s, map, player, rand, taken);
    taken.push(s.patrolIndex);
  }
}

// 왼쪽 위 이름표의 상태: 쫓아온다, 보고 있어서 멈췄다, 가까이 있다, 멀다
export function warnState(s, p, k) {
  if (s.mode === 'chase') return 'chase';
  if (s.mode === 'watch' && s.frozenT > 0) return 'still';
  return gapTo(s, p) <= k.lastNight.warnNear ? 'near' : 'far';
}

// 알림 글은 한 줄뿐이다. 다른 괴물의 알림이 뜬 지 얼마 안 됐으면 지우지 않고 기다렸다가 띄운다.
// 같은 괴물의 알림은 지금처럼 바로 바꾼다. 그래서 한 마리 판은 기다리는 일이 없다
export const createAlarm = () => ({ owner: null, until: 0, waiting: null });

export function raiseAlarm(a, owner, line, now, hold) {
  if (a.owner !== null && a.owner !== owner && now < a.until) {
    a.waiting = { owner, line };
    return null;
  }
  a.owner = owner;
  a.until = now + hold;
  return line;
}

// 기다리던 알림을 띄울 때가 됐으면 돌려준다
export function nextAlarm(a, now, hold) {
  if (!a.waiting || now < a.until) return null;
  const { owner, line } = a.waiting;
  a.waiting = null;
  a.owner = owner;
  a.until = now + hold;
  return line;
}
