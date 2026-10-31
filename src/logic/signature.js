// 변종 보스의 전용 공격에서 쓰는 계산 (화면과 상관없는 부분)

// 포자 구름이 주인공 쪽으로 천천히 다가간 다음 위치. 싸움터 밖으로 나가지 않는다.
export function driftToward(pos, target, speed, dt, minX, maxX) {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;
  if (dist <= step) return { x: clamp(target.x, minX, maxX), y: target.y };
  return { x: clamp(pos.x + (dx / dist) * step, minX, maxX), y: pos.y + (dy / dist) * step };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 구름 count 개를 보스 앞쪽에 고르게 놓을 x 자리들
export function fanOut(x, dir, count, gap) {
  return Array.from({ length: count }, (_, i) => x + dir * gap * (i + 1));
}
