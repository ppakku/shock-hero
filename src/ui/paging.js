// 칸이 한 화면에 다 안 들어갈 때 쪽으로 나누는 계산 (Phaser 없이 계산만 해서 테스트할 수 있다)
// 보스 도감(보스 40마리), 보스 러시(코스 8개)에서 쓴다.

// 칸 수와 쪽 크기로 쪽 수를 구한다. 칸이 없어도 1쪽
export const pageCount = (total, size) => Math.max(1, Math.ceil(total / size));

// i 번째 칸이 있는 쪽 (0부터)
export const pageOf = (i, size) => Math.floor(Math.max(0, i) / size);

// 쪽을 넘긴 뒤 고를 칸: 같은 자리의 칸, 마지막 쪽이 짧으면 마지막 칸. 넘길 쪽이 없으면 그대로
export function turnPage(i, dir, size, total) {
  const page = pageOf(i, size) + dir;
  if (page < 0 || page >= pageCount(total, size)) return i;
  return Math.min(total - 1, page * size + (i % size));
}
