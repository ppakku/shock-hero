// 포레스트 와처 보스 계산 (화면과 상관없는 부분)

export const WATCHER_PATTERNS = ['claw', 'burrow', 'spit', 'vines', 'crawl', 'signature'];

// 단계: 0 = 긴 팔과 등 독혹이 다 있음, 1 = 하나 부서짐, 2 = 둘 다 부서져서 머리가 약점
export function watcherPhaseIndex(armAlive, backAlive) {
  return (armAlive ? 0 : 1) + (backAlive ? 0 : 1);
}

// 다음 공격 고르기. 긴 팔이 부서졌으면 할퀴기는 빼고, 방금 한 공격은 되도록 피한다.
export function chooseWatcherAttack(phases, armAlive, backAlive, last = null, rand = Math.random) {
  const idx = Math.min(watcherPhaseIndex(armAlive, backAlive), phases.length - 1);
  let list = (phases[idx] || []).filter((p) => WATCHER_PATTERNS.includes(p));
  if (!armAlive) list = list.filter((p) => p !== 'claw');
  if (list.length === 0) return 'spit';
  const fresh = list.length > 1 ? list.filter((p) => p !== last) : list;
  return fresh[Math.floor(rand() * fresh.length) % fresh.length];
}

// 땅속에서 튀어나올 자리: 플레이어 근처, 싸움터 안쪽
export function popUpX(playerX, minX, maxX, halfBody, rand = Math.random, spread = 60) {
  const x = playerX + (rand() * 2 - 1) * spread;
  return Math.min(maxX - halfBody, Math.max(minX + halfBody, x));
}

// 싸움터에 퍼진 자리 count 개 (하나는 플레이어 위). 사이에 피할 틈이 있게 gap 만큼 떨어뜨린다.
// 덩굴, 독 방울, 불 폭격 자리에 쓴다.
export function spreadTargets(playerX, count, minX, maxX, rand = Math.random, gap = 130) {
  const clamp = (v) => Math.min(maxX, Math.max(minX, v));
  const xs = [clamp(playerX)];
  let guard = 0;
  while (xs.length < count && guard < 300) {
    guard += 1;
    const x = minX + rand() * (maxX - minX);
    if (xs.every((o) => Math.abs(o - x) >= gap)) xs.push(x);
  }
  return xs;
}

// 벽 타기: 가까운 벽으로 올라가서 천장을 지나 반대편 벽으로 내려온다
export function crawlPlan(x, minX, maxX) {
  const goLeft = x - minX < maxX - x;
  return { startWall: goLeft ? minX : maxX, endWall: goLeft ? maxX : minX, dir: goLeft ? 1 : -1 };
}
