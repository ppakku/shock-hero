// 보스 공격 종류. 팔이 몇 개 있어야 쓸 수 있는지 함께 적는다.
export const BOSS_PATTERNS = {
  slam: { arms: 1 }, // 팔 하나로 내려찍기
  multiSlam: { arms: 1 }, // 팔 하나로 연속 내려찍기
  doubleSlam: { arms: 2 }, // 두 팔로 동시에 내려찍기
  sweep: { arms: 1 }, // 바닥 쓸기 (대시로 통과)
  rocks: { arms: 0 }, // 돌 떨구기
  shockwave: { arms: 0 }, // 땅 울림 충격파 (점프로 넘기)
  spit: { arms: 0 }, // 독침 뱉기
  rocketPunch: { arms: 1 }, // 주먹 발사 (낮으면 점프, 높으면 가만히)
  inhale: { arms: 0 }, // 빨아들이기 (반대쪽으로 달려서 버티기)
  summon: { arms: 0 }, // 부하 부르기 (킹 돌연변이)
};

// 얼음 돌연변이(날아다니는 보스) 공격 이름
export const ICE_PATTERNS = {
  icicles: '고드름 비', // 그림자를 피하기
  dive: '급강하', // 대시로 통과
  frostBreath: '얼음 숨결', // 점프로 넘기
  hop: '뛰어 내려찍기', // 날개가 부서진 뒤. 그림자를 피하기
};

// 일어선 킹 돌연변이(마지막 단계) 공격 이름
export const KING_FINAL_PATTERNS = {
  leap: '뛰어 내려찍기', // 그림자를 피하고 충격파는 점프
  charge: '돌진', // 대시로 통과
  inhale: '빨아들이기',
  summon: '부하 부르기',
  rocks: '돌 떨구기',
};

// 보스가 다음에 무슨 공격을 할지 정한다.
// phases[부서진 팔 개수] 목록에서 고르고, 팔이 다 부서지면 마지막 목록을 쓴다.
// 방금 한 공격은 되도록 피한다.
export function chooseBossAttack(phases, armsAlive, totalArms, last = null, rand = Math.random) {
  const lost = totalArms - armsAlive;
  const idx = armsAlive === 0 ? phases.length - 1 : Math.min(lost, phases.length - 1);
  const usable = (phases[idx] || []).filter((p) => BOSS_PATTERNS[p] && BOSS_PATTERNS[p].arms <= armsAlive);
  if (usable.length === 0) return armsAlive > 0 ? 'slam' : 'rocks';
  const fresh = usable.length > 1 ? usable.filter((p) => p !== last) : usable;
  return fresh[Math.floor(rand() * fresh.length) % fresh.length];
}

// 팔이 줄면 화가 나서 빨라진다 (시간에 곱하는 값, 작을수록 빠름)
export function bossSpeedMultiplier(armsAlive, totalArms = 2) {
  if (armsAlive <= 0) return 0.7;
  if (armsAlive >= totalArms) return 1;
  return Math.max(0.75, 1 - (0.25 * (totalArms - armsAlive)) / Math.max(1, totalArms - 1));
}

export function coreDamage(attack, chargedMultiplier) {
  return Math.round(attack.damage * (attack.kind === 'charged' ? chargedMultiplier : 1));
}

// 돌 떨어질 자리: 하나는 플레이어 위, 나머지는 서로 떨어진 무작위 자리
export function rockTargets(playerX, count, minX, maxX, rand = Math.random, minGap = 90) {
  const clamp = (v) => Math.min(maxX, Math.max(minX, v));
  const xs = [clamp(playerX)];
  let guard = 0;
  while (xs.length < count && guard < 200) {
    guard += 1;
    const x = minX + rand() * (maxX - minX);
    if (xs.every((o) => Math.abs(o - x) >= minGap)) xs.push(x);
  }
  return xs;
}

// 두 팔 동시 내려찍기 자리: 하나는 플레이어 위, 하나는 옆 (빈 틈으로 피할 수 있게 gap 만큼 떨어뜨림)
export function doubleSlamTargets(playerX, minX, maxX, gap = 190) {
  const a = Math.min(maxX, Math.max(minX, playerX));
  const b = a - gap >= minX ? a - gap : a + gap;
  return [a, Math.min(maxX, Math.max(minX, b))];
}

// 목록에서 하나 고르기 (방금 한 것은 되도록 피함). 목록이 비면 fallback.
export function pickPattern(list, last = null, rand = Math.random, fallback = null) {
  const usable = (list || []).filter(Boolean);
  if (usable.length === 0) return fallback;
  const fresh = usable.length > 1 ? usable.filter((p) => p !== last) : usable;
  return fresh[Math.floor(rand() * fresh.length) % fresh.length];
}

// 주먹 발사 높이: 처음은 낮게(점프 배우기), 두 번째는 높게(가만히 배우기), 그 뒤로는 무작위
export function pickRocketHeight(count, rand = Math.random) {
  if (count <= 0) return 'low';
  if (count === 1) return 'high';
  return rand() < 0.5 ? 'low' : 'high';
}

// 주먹이 지나가는 높이 띠 (위 y, 아래 y). 낮은 주먹은 땅에 붙고, 높은 주먹은 서 있는 머리 위로 지나간다.
export function rocketBand(height, groundY) {
  return height === 'high' ? { top: groundY - 134, bottom: groundY - 68 } : { top: groundY - 56, bottom: groundY };
}

// 빨아들이기: 한 프레임 동안 targetX 쪽으로 끌려간 위치 (지나치지는 않음)
export function inhaleStep(x, targetX, pull, dt) {
  if (x < targetX) return Math.min(targetX, x + pull * dt);
  return Math.max(targetX, x - pull * dt);
}

// 분노 모드에 들어갈 때인지 (체력 비율이 기준 아래, 아직 분노 전)
export function shouldRage(ratio, threshold, alreadyRaging = false) {
  return !alreadyRaging && ratio > 0 && ratio <= threshold;
}

// 공격이 끝난 뒤 쉬는 시간. 분노 중이면 두 공격을 쉬지 않고 이어서 한다.
export function restAfterAttack(raging, chained, idle, chainGap) {
  if (raging && !chained) return { wait: chainGap, chained: true };
  return { wait: idle, chained: false };
}

// 부하를 더 부를 수 있는지 (살아 있는 부하 수가 최대보다 적을 때)
export function canSummon(aliveMinions, max) {
  return aliveMinions < max;
}

// 부하가 나올 자리: 플레이어에게서 minGap 이상 떨어진 곳 (없으면 가장 먼 끝)
export function summonSpots(playerX, count, minX, maxX, minGap = 220) {
  const candidates = [minX, (minX + maxX) / 2, maxX, minX + (maxX - minX) * 0.25, minX + (maxX - minX) * 0.75];
  const far = candidates.filter((x) => Math.abs(x - playerX) >= minGap);
  const list = far.length ? far : [Math.abs(minX - playerX) > Math.abs(maxX - playerX) ? minX : maxX];
  return list.slice(0, Math.max(0, count));
}

// 날아다니는 보스가 내려앉을 자리: 플레이어에게서 gap 이상 떨어진 곳
export function landingX(playerX, minX, maxX, gap = 170, rand = Math.random) {
  const left = [minX, playerX - gap];
  const right = [playerX + gap, maxX];
  const ok = [left, right].filter(([a, b]) => b - a >= 0);
  if (ok.length === 0) return Math.abs(minX - playerX) > Math.abs(maxX - playerX) ? minX : maxX;
  const [a, b] = ok[Math.floor(rand() * ok.length) % ok.length];
  return a + (b - a) * rand();
}

// 난이도 (GameScene 이 cfg.difficulty 로 넘겨 줌). 없으면 보통.
export const DIFFICULTY_NORMAL = { level: 'normal', bossHealth: 1, bossSpeed: 1, bossCombo: 0.15 };
export function difficultyOf(cfg) {
  return { ...DIFFICULTY_NORMAL, ...(cfg?.difficulty ?? {}) };
}

// 겹쳐 쓰는 공격 종류: 지금 공격과 피하는 법이 겹치지 않게 고른다
// 'rocks' = 위에서 떨어지는 것(그림자 피하기), 'wave' = 땅 울림 충격파(점프)
export function comboKind(mainType, rand = Math.random) {
  if (['rocks', 'icicles', 'leap', 'hop'].includes(mainType)) return 'wave';
  if (['shockwave', 'frostBreath'].includes(mainType)) return 'rocks';
  return rand() < 0.5 ? 'rocks' : 'wave';
}
