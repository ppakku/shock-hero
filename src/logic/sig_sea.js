// sea 계열 전용 공격의 계산 (화면과 상관없는 부분)

const TAU = Math.PI * 2;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 전기 고리의 틈 방향. 주인공 쪽에서 swing 만큼 돌리되, 틈이 헤엄칠 수 있는 곳을 지나게 한다.
export function laneAngle(cx, cy, px, py, swing, bounds, minDist = 200) {
  const d = Math.max(minDist, Math.hypot(px - cx, py - cy));
  const a = Math.atan2(py - cy, px - cx) + swing;
  const x = clamp(cx + Math.cos(a) * d, bounds.minX, bounds.maxX);
  const y = clamp(cy + Math.sin(a) * d, bounds.minY, bounds.maxY);
  return Math.atan2(y - cy, x - cx);
}

// (px, py) 가 보스에서 angle 쪽으로 뻗은 폭 half*2 의 통로 안에 있는지
export function inLane(px, py, cx, cy, angle, half) {
  const dx = px - cx;
  const dy = py - cy;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  const side = -dx * Math.sin(angle) + dy * Math.cos(angle);
  return along > 0 && Math.abs(side) <= half;
}

// 고리에 닿았는지: 고리 띠 위에 있고 어느 틈에도 없으면 맞는다
export function ringHits(px, py, cx, cy, r, band, gaps, half) {
  if (Math.abs(Math.hypot(px - cx, py - cy) - r) > band) return false;
  return !gaps.some((a) => inLane(px, py, cx, cy, a, half));
}

// 틈을 뺀 고리 조각들 [[시작 각, 끝 각]]. 틈은 폭이 일정해서 고리가 커질수록 각도가 좁아진다.
export function ringArcs(r, gaps, half) {
  if (!gaps.length) return [[0, TAU]];
  const h = r <= half ? Math.PI / 2 : Math.asin(half / r);
  const merged = [];
  for (const a of gaps.map((g) => ((g % TAU) + TAU) % TAU).sort((x, y) => x - y)) {
    const last = merged[merged.length - 1];
    if (last && a - h <= last[1]) last[1] = a + h;
    else merged.push([a - h, a + h]);
  }
  const arcs = [];
  merged.forEach(([, end], i) => {
    const next = i + 1 < merged.length ? merged[i + 1][0] : merged[0][0] + TAU;
    if (next > end) arcs.push([end, next]);
  });
  return arcs;
}

// 고리가 싸움터를 다 지나가는 반지름
export function ringReach(cx, cy, bounds) {
  const w = Math.max(cx - bounds.minX, bounds.maxX - cx);
  const h = Math.max(cy - bounds.minY, bounds.maxY - cy);
  return Math.hypot(w, h);
}

// 가짜 미끼 자리 count 개: 주인공, 진짜 불빛, 서로에게서 떨어진 곳. 자리가 없으면 가장 나은 곳을 쓴다.
export function scatterLures(count, keepAway, bounds, gap, rand = Math.random) {
  const lures = [];
  const distTo = (s, list) => Math.min(Infinity, ...list.map((o) => Math.hypot(s.x - o.x, s.y - o.y)));
  for (let i = 0; i < count; i++) {
    let best = null;
    let bestScore = -Infinity;
    for (let tries = 0; tries < 24; tries++) {
      const s = { x: bounds.minX + rand() * (bounds.maxX - bounds.minX), y: bounds.minY + rand() * (bounds.maxY - bounds.minY) };
      const score = Math.min(distTo(s, keepAway), distTo(s, lures));
      if (score > bestScore) {
        best = s;
        bestScore = score;
      }
      if (score >= gap) break;
    }
    lures.push(best);
  }
  return lures;
}
