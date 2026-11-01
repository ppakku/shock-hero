// 쪽지 위치와 주운 기록. 이야기 글은 src/horror/story.js 에 있다 (이 파일은 글을 모른다).
export const NOTE_TOTAL = 8;

// spots: [{ x, y }] 맵의 N 칸들. 섞어서 최대 NOTE_TOTAL 개를 고른다.
// 지금 맵은 N 이 딱 8칸이라 종이 자리는 판마다 같다. 글은 찾은 순서로 나오므로 어느 자리에서 어떤 글이 나올지만 달라진다.
// read: 이번 판에 읽은 쪽지의 이야기 번호. 저장하지 않는다
export function createNotes(spots, rand = Math.random) {
  const pool = spots.map((s) => ({ x: s.x, y: s.y }));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, NOTE_TOTAL);
  return { spots: picked, taken: picked.map(() => false), found: 0, total: picked.length, read: [] };
}

// index 번 자리의 쪽지를 줍는다. 처음 줍는 것이면 몇 번째로 찾았는지(0부터, 이야기 순서)를 돌려주고,
// 이미 주웠거나 없는 자리면 -1.
export function takeNote(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.spots.length || state.taken[index]) return -1;
  state.taken[index] = true;
  state.read.push(state.found);
  return state.found++;
}
