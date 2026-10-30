// 느려짐: 얼음 마법사의 얼음 폭발과 눈보라에 맞으면 잠깐 느려진다. 화면 없이 계산만 한다.
// 상태는 { left, multiplier }. left 는 남은 초, multiplier 는 속도 배수 (0.45 = 평소의 45%).
export const NO_SLOW = { left: 0, multiplier: 1 };
export const SLOW_TINT = 0x9fd8ff; // 느려진 동안 몸이 파래지는 색

// 얼음에 또 맞았을 때: 시간은 긴 쪽, 속도는 느린 쪽을 쓴다. 이상한 값이면 그대로 둔다.
export function addSlow(cur, slow) {
  const time = slow?.time;
  const mult = slow?.multiplier;
  if (!(time > 0) || !(mult > 0) || mult >= 1) return cur;
  const active = cur.left > 0;
  return { left: Math.max(cur.left, time), multiplier: active ? Math.min(cur.multiplier, mult) : mult };
}

// 시간이 흐른다. 다 끝나면 NO_SLOW
export function tickSlow(cur, dt) {
  if (cur.left <= 0) return cur;
  const left = cur.left - dt;
  return left > 0 ? { ...cur, left } : NO_SLOW;
}

// 몬스터 숫자 가운데 느려지는 것들 (걷기, 달려들기, 피라냐 돌진)
const SPEED_KEYS = ['moveSpeed', 'lungeSpeed', 'dartSpeed'];

// 느려진 몬스터 숫자. 원래 숫자는 건드리지 않고 새 묶음을 돌려준다.
export function slowedStats(m, multiplier) {
  const out = { ...m };
  for (const k of SPEED_KEYS) if (typeof m[k] === 'number') out[k] = m[k] * multiplier;
  return out;
}
