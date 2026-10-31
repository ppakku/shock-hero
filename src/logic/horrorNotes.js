// 쪽지 위치와 주운 기록. 이야기 글은 src/horror/story.js 에 있다 (이 파일은 글을 모른다).
export const NOTE_TOTAL = 8;

// spots: [{ x, y }] 맵의 N 칸들. 섞어서 최대 NOTE_TOTAL 개를 고른다.
export function createNotes(spots, rand = Math.random) {
  const pool = spots.map((s) => ({ x: s.x, y: s.y }));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, NOTE_TOTAL);
  return { spots: picked, taken: picked.map(() => false), found: 0, total: picked.length };
}

// index 번 자리의 쪽지를 줍는다. 처음 줍는 것이면 몇 번째로 찾았는지(0부터, 이야기 순서)를 돌려주고,
// 이미 주웠거나 없는 자리면 -1.
export function takeNote(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.spots.length || state.taken[index]) return -1;
  state.taken[index] = true;
  return state.found++;
}

// x, y 가까이에 아직 안 주운 쪽지가 있으면 그 자리 번호, 없으면 -1
export function noteNear(state, x, y, range) {
  let best = -1;
  let bestD = range * range;
  for (let i = 0; i < state.spots.length; i++) {
    if (state.taken[i]) continue;
    const dx = state.spots[i].x - x;
    const dy = state.spots[i].y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}

// 8개를 다 모았나 (자리가 8개보다 적은 맵이면 모든 쪽지가 모였을 때)
export function allFound(state) {
  return state.total > 0 && state.found >= state.total;
}
