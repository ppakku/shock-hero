// 보스가 다음에 무슨 공격을 할지 정한다. 팔이 줄수록 공격이 바뀐다.
export function chooseBossAttack(armsAlive, rand = Math.random) {
  if (armsAlive.length === 0) return { type: 'rocks' };
  if (armsAlive.length === 1) {
    return { type: rand() < 0.5 ? 'sweep' : 'slam', arm: armsAlive[0] };
  }
  return { type: 'slam', arm: armsAlive[Math.floor(rand() * armsAlive.length) % armsAlive.length] };
}

// 팔이 줄면 화가 나서 빨라진다 (시간에 곱하는 값)
export function bossSpeedMultiplier(armsAliveCount) {
  if (armsAliveCount >= 2) return 1;
  if (armsAliveCount === 1) return 0.75;
  return 0.7;
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
