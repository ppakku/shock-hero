// 헤엄치기 계산 (화면 없이 테스트할 수 있는 순수 함수들)
// 수중 스테이지(stage.swim = true)에서 주인공과 헤엄치는 몬스터가 쓴다.

// balance.js 의 swim 숫자를 지워 버려도 돌아가게 쓰는 기본값
export const SWIM_DEFAULTS = {
  gravityScale: 0.3, // 물속 중력 (0.3 = 땅의 30%)
  maxFallSpeed: 210, // 가라앉는 가장 빠른 속도
  strokeSpeed: 330, // 점프 한 번에 위로 차고 오르는 힘
  strokeInterval: 0.3, // 점프를 꾹 누르고 있으면 이 간격마다 다시 헤엄침
  maxRiseSpeed: 380, // 위로 오르는 가장 빠른 속도
  moveMultiplier: 0.8, // 옆으로 헤엄치는 속도 (걷는 속도에 곱함)
  waterDrag: 7, // 물의 저항 (클수록 빨리 멈추고 빨리 출발)
  dashMultiplier: 0.8, // 헤엄 대시 속도 (대시 속도에 곱함)
  ceilingY: 150, // 이보다 위로는 못 올라감 (화면 위 체력바에 가리지 않게)
};

export function swimConfig(c) {
  return { ...SWIM_DEFAULTS, ...(c ?? {}) };
}

// 몸에 따로 줄 중력 (world 중력에 더해짐). 음수면 덜 떨어진다.
export function swimGravityOffset(worldGravity, gravityScale) {
  const s = Math.min(1, Math.max(0, gravityScale));
  return -worldGravity * (1 - s);
}

// 위아래 헤엄. 점프를 누른 순간 한 번 차고, 꾹 누르고 있으면 strokeInterval 마다 또 찬다.
// 결과: { vy, strokeTimer, stroked }
export function swimVertical(vy, input, strokeTimer, dt, c) {
  const k = swimConfig(c);
  let timer = Math.max(0, strokeTimer - dt);
  let v = vy;
  let stroked = false;
  if (input.jumpPressed || (input.jumpDown && timer <= 0)) {
    v = Math.min(v, -k.strokeSpeed);
    timer = k.strokeInterval;
    stroked = true;
  }
  if (!input.jumpDown && !input.jumpPressed) timer = 0; // 떼면 다음 누름은 바로 헤엄
  v = Math.max(-k.maxRiseSpeed, Math.min(k.maxFallSpeed, v));
  return { vy: v, strokeTimer: timer, stroked };
}

// 옆으로 헤엄: 물의 저항 때문에 원하는 속도로 부드럽게 바뀐다
export function swimHorizontal(vx, dir, speed, dt, drag) {
  const target = dir * speed;
  const k = 1 - Math.exp(-Math.max(0, drag) * dt);
  return vx + (target - vx) * k;
}

// 천장 아래로 붙잡아 두기. 결과: { y, vy }
export function clampToCeiling(y, vy, ceilingY) {
  if (y >= ceilingY) return { y, vy };
  return { y: ceilingY, vy: Math.max(0, vy) };
}

// 헤엄치는 몬스터가 다닐 수 있는 높이 (주인공이 닿는 물속 범위 안)
export const SWIMMER_MIN_Y = 170;
export function swimmerYRange(groundY) {
  return { min: SWIMMER_MIN_Y, max: groundY - 34 };
}

// 헤엄치는 몬스터 높이. 스테이지 파일에 y 를 안 적으면(땅 높이) defaultY.
export function swimmerY(y, groundY, defaultY = groundY - 120) {
  const r = swimmerYRange(groundY);
  const v = typeof y === 'number' && y < groundY ? y : defaultY;
  return Math.min(r.max, Math.max(r.min, v));
}

// 헤엄치는 몬스터의 가로 범위. 보스 문이 닫혀 있으면 문 앞(gateX - 50)까지만.
export function swimmerXRange(stage, gateOpen) {
  const right = gateOpen ? stage.width - 40 : stage.gateX - 50;
  return { min: 40, max: Math.max(41, right) };
}

// 피라냐 돌진 방향: 주인공 쪽 단위 벡터
export function dartVector(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

// 골드해파리가 단단해진(경화) 동안 공격을 막는지. 충전 펀치(일정 이상)와 궁극기는 뚫는다.
export function jellyBlocks(kind, hardened, chargeRatio = 0, breakRatio = 0.5) {
  if (!hardened) return false;
  if (kind === 'ultimate') return false;
  if (kind === 'charged') return chargeRatio < breakRatio;
  return true;
}

// 가시복어가 부풀어 가시가 섰을 때: 'thorns' 맨손 공격이 찔림, 'hit' 그냥 맞음
// 에너지탄과 충전 펀치, 궁극기는 가시를 뚫는다.
export function pufferResult(kind, spiky) {
  if (!spiky) return 'hit';
  if (kind === 'punch' || kind === 'upper') return 'thorns';
  return 'hit';
}

// ---------- 심해 아귀왕 (스테이지 6 보스) ----------

// 소용돌이: 한 프레임 동안 입(mx, my) 쪽으로 끌려간 위치 (지나치지는 않음)
export function whirlPullStep(x, y, mx, my, pull, dt) {
  const dx = mx - x;
  const dy = my - y;
  const d = Math.hypot(dx, dy);
  const step = Math.max(0, pull) * dt;
  if (d <= step || d === 0) return { x: mx, y: my };
  return { x: x + (dx / d) * step, y: y + (dy / d) * step };
}

// 돌진 높이: 주인공 높이를 따라가되 싸움터 위아래 안에서
export function seaChargeY(playerY, topY, bottomY) {
  return Math.min(bottomY, Math.max(topY, playerY));
}

// 공격 목록 단계: 부순 부위 수 (0, 1, 2)
export function seaPhaseIndex(partsAlive, totalParts = 2) {
  return Math.max(0, Math.min(totalParts, totalParts - partsAlive));
}

// 쓸 수 있는 공격만 남긴다: 먹물은 초롱불이 있어야 쓴다
export function seaUsableAttacks(list, lureAlive) {
  return (list || []).filter((t) => t !== 'ink' || lureAlive);
}

// 주인공 발이 바닥 휩쓸기 띠(바닥에서 height 만큼 위까지) 안에 있는지
export function inSweepBand(playerBottom, groundY, height) {
  return playerBottom > groundY - height;
}
