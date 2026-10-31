// 와처 변종의 전용 공격에서 쓰는 계산 (화면과 상관없는 부분)

// 싸움터에 고르게 놓을 분신 자리 count 개
export function cloneSlots(minX, maxX, count) {
  if (count <= 1) return [(minX + maxX) / 2];
  const gap = (maxX - minX) / (count - 1);
  return Array.from({ length: count }, (_, i) => minX + gap * i);
}

// 진짜가 들어갈 자리 번호
export function pickReal(count, rand = Math.random) {
  return Math.floor(rand() * count) % count;
}

// 분신이 달려드는 길: 주인공 쪽으로, 싸움터 안에서 reach 만큼
export function rushPath(x, targetX, reach, minX, maxX) {
  const dir = targetX < x ? -1 : 1;
  return { dir, from: x, to: Math.min(maxX, Math.max(minX, x + dir * reach)) };
}

// 달려드는 길을 다 갔는지
export function rushDone(x, path) {
  return (x - path.to) * path.dir >= 0;
}

// 처음 지치기 전에 전용 공격을 꼭 한 번 쓰게 한다. 이번이 지치기 전 마지막 공격이면 true.
export function owedSignature(def, seen, combo, tiredRoll) {
  if (seen || !def.signature || !def.phases.flat().includes('signature')) return false;
  return combo + 1 >= tiredRoll;
}
