// 보스가 읽히지 않게 박자와 공격 모양을 흔드는 계산 (화면과 상관없는 부분)
// rest: 쉬는 시간을 1 ± 이 값 사이로, tired: 지치기까지 횟수를 기준 ± 이 값 사이로,
// shape: 공격 모양을 바꿀 확률, feint: 속임 동작을 할 확률
export const BOSS_VARIETY = {
  easy: { rest: 0.15, tired: 0, shape: 0, feint: 0 },
  normal: { rest: 0.3, tired: 1, shape: 0.3, feint: 0 },
  hard: { rest: 0.4, tired: 1, shape: 0.6, feint: 0.25 },
};

export const LATE_WARNING_MAX = 1.4; // 경고를 가장 많이 늘릴 때 배수
export const FEINT_AT = 0.4; // 경고가 이만큼 지나면 속임 동작으로 취소

export function bossVarietyOf(level) {
  return BOSS_VARIETY[level] ?? BOSS_VARIETY.normal;
}

// 쉬는 시간 하나 뽑기. 평균은 base 그대로다.
export function jitterRest(base, v, rand = Math.random) {
  return base * (1 + v.rest * (2 * rand() - 1));
}

// 다음에 지치기까지 공격 횟수. 평균은 base 그대로다.
export function nextTiredAfter(base, v, rand = Math.random, min = 2) {
  const n = Math.round(base) + Math.floor(rand() * (2 * v.tired + 1)) - v.tired;
  return Math.max(min, n);
}

// 경고 시간을 늘리기만 한다. 지금보다 짧아지는 일은 없다.
export function lateWarning(base, v, rand = Math.random) {
  if (rand() >= v.shape) return base;
  return base * (1 + (LATE_WARNING_MAX - 1) * rand());
}

// 개수를 하나 늘리거나 줄인다
export function varyCount(base, v, rand = Math.random, min = 1) {
  if (rand() >= v.shape) return base;
  return Math.max(min, base + (rand() < 0.5 ? -1 : 1));
}

// allowed: 경고 단계에서 취소해도 남는 것이 없는 공격들
export function shouldFeint(type, allowed, v, rand = Math.random) {
  return allowed.includes(type) && rand() < v.feint;
}
