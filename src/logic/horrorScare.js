// 공포 모드 놀람 연출의 시간표와 위치 계산. 화면과 소리는 HorrorGame 이 맡는다.
import { lineOfSight, blocked } from './horrorGrid.js';

// full: 어둠 뒤에 얼굴이 나타나는 큰 놀람. 아니면 어둠과 소리만 있다
export function createScare(full, k) {
  return { t: 0, dark: k.dark, show: full ? k.show : 0, phase: 'dark' };
}

export function stepScare(s, dt) {
  s.t += Math.max(0, dt);
  if (s.t >= s.dark + s.show) s.phase = 'done';
  else if (s.t >= s.dark) s.phase = 'face';
  return s.phase;
}

// 괴물이 가까울수록 1 에 가까워진다. 쫓기는 동안에는 멀어도 일정 이상이다
export function dreadLevel(dist, chased, k) {
  const near = Math.max(0, Math.min(1, (k.dreadFar - dist) / (k.dreadFar - k.dreadNear)));
  return Math.max(near, chased ? k.dreadChase : 0) * k.dreadMax;
}

// 보고 있는 쪽으로 곧게 보이는 먼 자리. 없으면 null
export function figureSpot(map, p, yaw, near, far) {
  const dx = -Math.sin(yaw);
  const dy = -Math.cos(yaw);
  for (let d = far; d >= near; d -= 1) {
    const spot = { x: p.x + dx * d, y: p.y + dy * d };
    if (!blocked(map, Math.floor(spot.x), Math.floor(spot.y)) && lineOfSight(map, p, spot)) return spot;
  }
  return null;
}
