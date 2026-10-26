// 모험 지도의 자리 계산 (Phaser 없이 계산만 해서 테스트할 수 있다)
// 한 장에 스테이지 점 10개가 길을 따라 이어진다. 아래 줄은 왼쪽에서 오른쪽, 위 줄은 오른쪽에서 왼쪽으로 돌아온다.

// 점 자리 (화면 960 x 540 기준). 위 80 은 장 이름, 아래 430 부터는 스테이지 설명이 들어간다.
const NODES = [
  { x: 110, y: 365 },
  { x: 250, y: 320 },
  { x: 390, y: 370 },
  { x: 530, y: 318 },
  { x: 670, y: 368 },
  { x: 820, y: 312 },
  { x: 780, y: 190 },
  { x: 620, y: 150 },
  { x: 460, y: 196 },
  { x: 285, y: 150 },
];

// 장 안에서 i 번째(0부터) 점의 자리. 10개가 넘으면 앞 자리를 되풀이하며 조금 위로.
export function nodePosition(i) {
  const base = NODES[i % NODES.length];
  return { x: base.x, y: base.y - Math.floor(i / NODES.length) * 30 };
}

// 두 점 사이 길: 살짝 휘는 곡선 위의 점들 (그리기용)
export function roadPoints(a, b, steps = 16) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // 진행 방향의 옆으로 조금 휘게
  const cx = mx - (dy / len) * 22;
  const cy = my + (dx / len) * 22;
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const u = 1 - t;
    out.push({ x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y });
  }
  return out;
}

// 스테이지 번호 n 이 몇 번째 장의 몇 번째 점인지. chapters 는 stage/index.js 의 chapters.
export function locateStage(chapters, n) {
  for (let c = 0; c < chapters.length; c++) {
    const i = chapters[c].stages.indexOf(n);
    if (i >= 0) return { chapterIndex: c, index: i };
  }
  return { chapterIndex: 0, index: 0 };
}

// 지도를 열 때 고를 스테이지: 따로 정한 스테이지(깨고 돌아왔을 때 다음 스테이지) > 체크포인트 > 마지막으로 들어간 스테이지 > 1
// 처음 하거나 초기화했으면 1 번부터. 잠긴 스테이지도 골라서 볼 수는 있다(출발만 안 됨).
export function mapStartStage(save, wanted, total) {
  const n = wanted || save.checkpoint || save.lastStage || 1;
  return Math.min(total, Math.max(1, n));
}

// 그 장을 열 수 있는지: 장의 첫 스테이지가 열려 있으면
export const chapterUnlocked = (chapter, unlocked) => chapter.stages[0] <= unlocked;
