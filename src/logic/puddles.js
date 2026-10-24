// 바닥에 잠깐 남는 위험 지대 (독 웅덩이, 불붙은 바닥).
// 화면과 상관없는 계산만 둔다. 웅덩이 = { x, w, left }  (left = 남은 시간)

// 시간이 지나면 줄어들고, 다 된 웅덩이는 빠진다
export function agePuddles(puddles, dt) {
  return puddles.map((p) => ({ ...p, left: p.left - dt })).filter((p) => p.left > 0);
}

// 발(x 위치, 몸 반쪽 너비 half)이 웅덩이에 닿았는지. 공중에 있으면 안 닿는다.
export function standingInPuddle(puddles, x, half, onGround) {
  if (!onGround) return null;
  return puddles.find((p) => Math.abs(p.x - x) < p.w / 2 + half) || null;
}

// 웅덩이를 더한다. 너무 많으면 오래된 것부터 지운다.
export function addPuddle(puddles, puddle, max = 8) {
  const out = [...puddles, puddle];
  return out.length > max ? out.slice(out.length - max) : out;
}
