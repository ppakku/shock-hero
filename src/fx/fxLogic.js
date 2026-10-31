import { isUltReady } from '../logic/combat.js';

// 효과 계산만 모아 둔 곳 (Phaser 없이 테스트할 수 있게).
// 그림은 impact.js, fireFx.js, shadows.js, foreground.js, ultAura.js 가 그린다.

// 멈칫(히트 스톱) 길이 (밀리초). 효과 줄이기면 0.
export const HIT_STOP_MS = {
  punch: 40, // 일반 공격이 맞았을 때
  chargedSmall: 55, // 덜 찬 충전 공격이 맞았을 때
  charged: 70, // 최대 충전 펀치가 맞았을 때
  ultimate: 90, // 궁극기 쿵
  bossSlam: 60, // 보스가 크게 내려찍을 때
  partBreak: 80, // 보스 부위를 부쉈을 때
};

export function hitStopMs(kind, lowFx = false) {
  if (lowFx) return 0;
  const ms = HIT_STOP_MS[kind] || 0;
  return Math.max(0, Math.min(90, ms)); // 너무 길면 끊기는 느낌이라 90ms 를 넘지 않는다
}

// 공격이 맞았을 때 멈칫 종류. 최대 충전은 따로 크게 처리한다 (ImpactFx.chargedHit)
export const landedStop = (attack) => (attack.full ? null : attack.kind === 'charged' ? 'chargedSmall' : 'punch');

// 불꽃 알갱이 수. 효과 줄이기면 3분의 1, 언제나 cap 을 넘지 않는다.
export function particleBudget(count, lowFx = false, cap = 40) {
  const n = lowFx ? Math.floor(count / 3) : count;
  return Math.max(0, Math.min(cap, Math.round(n)));
}

// 초당 rate 개를 뿌릴 때 이번 프레임에 몇 개인지 (남은 조각은 acc 에 모은다).
// state = { acc } 를 계속 넘겨 쓴다. 한 프레임에 max 개를 넘지 않는다.
export function emitCount(state, rate, dt, max = 8) {
  state.acc = (state.acc || 0) + Math.max(0, rate) * Math.max(0, dt);
  const n = Math.min(max, Math.floor(state.acc));
  state.acc -= n;
  if (state.acc > max) state.acc = 0; // 오래 멈췄다 돌아와도 한꺼번에 쏟아지지 않게
  return n;
}

// 발밑 바닥 높이: 발 아래에 있는 가장 가까운 발판 윗면, 없으면 땅.
// platforms 는 스테이지 파일의 { x(가운데), y(윗면), w } 목록.
export function surfaceBelow(x, feetY, platforms, groundY) {
  let best = groundY;
  for (const p of platforms || []) {
    if (x < p.x - p.w / 2 || x > p.x + p.w / 2) continue;
    if (p.y >= feetY - 4 && p.y < best) best = p.y;
  }
  return best;
}

// 그림자 모양: 바닥에서 높이 h 만큼 떠 있으면 작고 흐려진다.
export function shadowShape(h, maxH = 320) {
  const q = Math.max(0, Math.min(1, h / maxH));
  return { scale: 1 - 0.65 * q, alpha: 0.38 * (1 - 0.7 * q) };
}

// 앞쪽 실루엣(전경)의 투명도: 화면 가장자리에서는 진하고, 가운데로 올수록 거의 안 보인다.
// screenX 는 화면 기준 x (0~width), tall 이면 키 큰 조각(주인공을 가릴 수 있음).
export function foregroundAlpha(screenX, width = 960, tall = false) {
  const edge = Math.min(Math.abs(screenX), Math.abs(width - screenX)) / (width / 2); // 0 = 가장자리, 1 = 가운데
  const e = Math.max(0, Math.min(1, edge));
  if (tall) return 0.62 * (1 - e) * (1 - e); // 키 큰 조각은 가운데에서 사라진다
  return 0.85 - 0.25 * e;
}

// 궁극기 아우라를 보여 줄지: 게이지가 꽉 찼고 쓰러지지 않았을 때
export const ultAuraOn = (p) => isUltReady(p.ultGauge) && !p.dead;

// 아우라 뒤쪽 빛의 숨쉬기 (0.7 ~ 1, 약 1초에 한 번). t 는 초.
export const auraPulse = (t) => 0.85 + 0.15 * Math.sin(t * Math.PI * 2);

// 몸 둘레로 피어오르는 불꽃 하나의 모습. 위치는 몸 크기 기준 비율이다.
// x: 왼쪽 -1 ~ 오른쪽 1, y: 발 1 ~ 머리 -1 (머리 위로 조금 넘어감), size: 1 ~ 0.25, alpha: 0 ~ 1
export function auraFlame(i, count, t, life = 0.8) {
  const q = (t / life + i / count) % 1;
  const side = i % 2 === 0 ? -1 : 1;
  const spread = 0.45 + 0.5 * ((i * 7) % count) / count; // 불꽃마다 몸에서 떨어진 정도가 다르다
  return {
    x: side * spread * (1 - 0.45 * q) + 0.1 * Math.sin(t * 7 + i * 2),
    y: 1 - 2.5 * q,
    size: 1 - 0.75 * q,
    alpha: Math.sin(q * Math.PI),
  };
}
