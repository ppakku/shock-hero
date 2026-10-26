// 함께하기(친구와 둘이서)에 쓰는 계산. 화면과 상관없어서 테스트한다.
// players 는 { x, y, dead } 를 가진 주인공 목록.

// 살아 있는 주인공들
export const alive = (players) => players.filter((p) => p && !p.dead);

// (x, y) 에서 가장 가까운 살아 있는 주인공. 다 쓰러졌으면 첫 주인공(1P)
export function nearestPlayer(players, x, y = null) {
  let best = null;
  let bestD = Infinity;
  for (const p of alive(players)) {
    const d = y == null ? Math.abs(p.x - x) : Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best || players[0];
}

// 피해 결과 중 더 센 것: 'hit' > 'dodged' > 'ignored' > 'miss'
const RANK = { miss: 0, ignored: 1, dodged: 2, hit: 3 };
export const strongerResult = (a, b) => ((RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : a);

// 카메라가 따라갈 곳: 살아 있는 주인공들의 가운데 (다 쓰러졌으면 모두의 가운데)
export function partyCenter(players) {
  const list = alive(players).length ? alive(players) : players.filter(Boolean);
  const n = Math.max(1, list.length);
  return {
    x: list.reduce((s, p) => s + p.x, 0) / n,
    y: list.reduce((s, p) => s + p.y, 0) / n,
  };
}

// 두 사람이 maxSpread 보다 멀어지지 않게 고친 x 목록.
// 이번 프레임에 바깥쪽으로 더 많이 움직인 사람(prevXs 와 비교)을 멈춰 세운다. 뒤에 있는 사람이 끌려가지 않는다.
// 살아 있는 사람이 하나뿐이면 그대로 둔다.
export function clampSpread(players, maxSpread, prevXs = null) {
  const xs = players.map((p) => p.x);
  const list = alive(players);
  if (list.length < 2) return xs;
  const left = list.reduce((a, b) => (b.x < a.x ? b : a));
  const right = list.reduce((a, b) => (b.x > a.x ? b : a));
  if (right.x - left.x <= maxSpread) return xs;
  const li = players.indexOf(left);
  const ri = players.indexOf(right);
  const outL = prevXs ? prevXs[li] - left.x : 0; // 왼쪽 사람이 왼쪽으로 간 만큼
  const outR = prevXs ? right.x - prevXs[ri] : 0; // 오른쪽 사람이 오른쪽으로 간 만큼
  if (outR > outL) xs[ri] = left.x + maxSpread;
  else if (outL > outR) xs[li] = right.x - maxSpread;
  else {
    // 둘 다 똑같이 멀어졌으면 가운데 쪽으로 반씩
    const c = (left.x + right.x) / 2;
    xs[li] = c - maxSpread / 2;
    xs[ri] = c + maxSpread / 2;
  }
  return xs;
}
