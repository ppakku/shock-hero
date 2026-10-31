// 용 계열 변종의 전용 공격 계산 (화면과 상관없는 부분)

export const SIGNATURE_BY = 2; // 이만큼 공격하기 전에 전용 공격을 꼭 한 번 보여 준다
const MIN_WARN = 0.7; // 아무리 빨라져도 경고는 이만큼 보여 준다

// 분노와 스테이지 박자를 곱한 경고 시간. 피할 시간이 남도록 바닥을 둔다.
export function warnTime(base, speed) {
  return Math.max(MIN_WARN, base * speed);
}

// 아직 전용 공격을 안 썼으면 이번에 꼭 써야 하나
export function signatureDue(phases, used, attackCount) {
  return !used && attackCount >= SIGNATURE_BY && phases.flat().includes('signature');
}

// 바위는 주인공에게서 먼 쪽 벽에서 출발해 주인공 쪽으로 구른다 (볼 시간이 길게)
export function rollFrom(playerX, minX, maxX, margin = 40) {
  return playerX - minX > maxX - playerX ? { x: minX - margin, dir: 1 } : { x: maxX + margin, dir: -1 };
}

// 바위가 차례로 출발하는 시각 (경고가 끝난 뒤부터 잰다)
export function releaseTimes(count, gap) {
  return Array.from({ length: count }, (_, i) => i * gap);
}

// 낙뢰 자리: 주인공 자리부터 양옆으로 번갈아. 간격이 그대로라 번개 사이로 피할 수 있고, 싸움터를 넘는 자리는 건너뛴다.
export function lightningXs(x, count, gap, minX, maxX, rand = Math.random) {
  const start = Math.min(maxX, Math.max(minX, x));
  const side = rand() < 0.5 ? -1 : 1;
  const xs = [];
  for (let i = 0; xs.length < count && i < count * 4; i++) {
    const step = Math.ceil(i / 2) * (i % 2 ? side : -side);
    const at = start + step * gap;
    if (at >= minX && at <= maxX) xs.push(at);
  }
  return xs;
}

// 어두워지는 정도: 시작할 때 서서히 어두워지고 끝나기 전에 서서히 돌아온다
export function darkAlpha(t, end, fade, max) {
  return max * Math.max(0, Math.min(1, t / fade, (end - t) / fade));
}
