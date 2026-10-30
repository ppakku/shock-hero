// 아스트라노바X(붉은 용) 보스 계산 (화면과 상관없는 부분)

export const DRAGON_PATTERNS = ['breath', 'wing', 'tail', 'fly', 'pillars'];

// 단계: 0 = 꼬리와 날개가 다 있음, 1 = 하나 부서짐, 2 = 둘 다 부서져서 배가 약점
export function dragonPhaseIndex(tailAlive, wingAlive) {
  return (tailAlive ? 0 : 1) + (wingAlive ? 0 : 1);
}

export function chooseDragonAttack(phases, tailAlive, wingAlive, last = null, rand = Math.random) {
  const idx = Math.min(dragonPhaseIndex(tailAlive, wingAlive), phases.length - 1);
  const list = (phases[idx] || []).filter((p) => DRAGON_PATTERNS.includes(p));
  if (list.length === 0) return 'breath';
  const fresh = list.length > 1 ? list.filter((p) => p !== last) : list;
  return fresh[Math.floor(rand() * fresh.length) % fresh.length];
}

// 불기둥 자리: 싸움터를 spacing 간격으로 나눠서 짝수 번째, 홀수 번째 두 묶음으로.
// 첫 묶음이 터지는 동안 두 번째 묶음 자리(아직 안 터진 곳)에 서 있으면 안전하다.
// offset 만큼 줄 전체를 밀어도 기둥 사이 간격은 그대로다.
export function pillarWaves(minX, maxX, spacing, offset = 0) {
  const xs = [];
  for (let x = minX + spacing / 2 + offset; x <= maxX; x += spacing) xs.push(Math.round(x));
  return [xs.filter((_, i) => i % 2 === 0), xs.filter((_, i) => i % 2 === 1)];
}

// 날아올라 반대편으로: 지금 자리에서 먼 쪽 끝에 내려앉는다
export function flyLandingX(x, leftStop, rightStop) {
  return x - leftStop > rightStop - x ? leftStop : rightStop;
}

// 날개 바람: 용에게서 멀어지는 쪽으로 미는 속도 (용 뒤에 있으면 반대로)
export function gustVelocity(playerX, dragonX, strength) {
  return playerX < dragonX ? -strength : strength;
}

// 날개 바람 끝에 불기둥이 솟을 자리: 바람이 미는 쪽 벽 근처 두 곳
export function gustPillarXs(playerX, dragonX, minX, maxX) {
  return playerX < dragonX ? [minX + 40, minX + 140] : [maxX - 40, maxX - 140];
}
