// 보스 공격 종류. 팔이 몇 개 있어야 쓸 수 있는지 함께 적는다.
export const BOSS_PATTERNS = {
  slam: { arms: 1 }, // 팔 하나로 내려찍기
  multiSlam: { arms: 1 }, // 팔 하나로 연속 내려찍기
  doubleSlam: { arms: 2 }, // 두 팔로 동시에 내려찍기
  sweep: { arms: 1 }, // 바닥 쓸기 (대시로 통과)
  rocks: { arms: 0 }, // 돌 떨구기
  shockwave: { arms: 0 }, // 땅 울림 충격파 (점프로 넘기)
  spit: { arms: 0 }, // 독침 뱉기
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
