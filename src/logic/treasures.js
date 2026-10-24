// 보물 상자 자리: 스테이지에 들어갈 때마다 무작위로 정한다.
// 스테이지 파일의 treasures 는 보물 id 와 힘(power)만 적고, 자리는 여기서 고른다.
// 뒤 스테이지일수록 높은 발판을 더 자주 고른다(찾기 어려워짐). 스테이지 1 은 땅과 발판을 고르게 고른다.

const MIN_GAP = 260; // 보물끼리 떨어진 가로 거리
const EDGE = 20; // 발판 끝에서 이만큼 안쪽에 둔다

// 높이에 따른 가중치. stageNum 이 클수록 높은 곳이 훨씬 잘 뽑힌다.
export function heightWeight(height, stageNum) {
  const k = Math.max(0, stageNum - 1) * 0.4;
  return Math.exp((k * height) / 300);
}

// 보물을 둘 수 있는 자리 목록 (보스 문 앞의 발판 위, 땅 위)
export function treasureCandidates(stage, rand = Math.random) {
  const out = [];
  for (const p of stage.platforms) {
    if (p.x >= stage.gateX - 40) continue;
    const half = Math.max(0, p.w / 2 - EDGE);
    out.push({ x: Math.round(p.x + (rand() * 2 - 1) * half), y: p.y, height: stage.groundY - p.y });
  }
  const from = stage.playerStartX + 300;
  const to = stage.gateX - 150;
  const groundCount = 6;
  for (let i = 0; i < groundCount; i++) {
    const lo = from + ((to - from) * i) / groundCount;
    const hi = from + ((to - from) * (i + 1)) / groundCount;
    out.push({ x: Math.round(lo + rand() * (hi - lo)), y: stage.groundY, height: 0 });
  }
  return out;
}

// 스테이지 보물 하나하나에 자리를 붙여서 돌려준다: [{ id, power, x, y }]
export function placeTreasures(stage, stageNum, rand = Math.random) {
  const pool = treasureCandidates(stage, rand).map((c) => ({ ...c, w: heightWeight(c.height, stageNum) }));
  const picked = [];
  // 처음엔 서로 멀리 떨어진 자리만, 모자라면 간격 조건을 풀고 다시 고른다
  for (const gap of [MIN_GAP, MIN_GAP / 2, 0]) {
    while (picked.length < stage.treasures.length) {
      const ok = pool.filter((c) => !c.used && picked.every((q) => Math.abs(q.x - c.x) >= gap));
      if (!ok.length) break;
      const total = ok.reduce((s, c) => s + c.w, 0);
      let r = rand() * total;
      let chosen = ok[ok.length - 1];
      for (const c of ok) {
        r -= c.w;
        if (r <= 0) {
          chosen = c;
          break;
        }
      }
      chosen.used = true;
      picked.push(chosen);
    }
  }
  // 앞에서부터 차례로 보물 id 를 붙인다 (자리가 모자라면 땅 위 아무 곳)
  picked.sort((a, b) => a.x - b.x);
  return stage.treasures.map((t, i) => {
    const spot = picked[i] || { x: stage.gateX - 200, y: stage.groundY };
    return { ...t, x: spot.x, y: spot.y };
  });
}
