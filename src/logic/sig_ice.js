// 얼음 계열 전용 공격에서 쓰는 계산 (화면과 상관없는 부분)

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 바람이 부는 쪽 (1 오른쪽, -1 왼쪽). 날 때는 주인공 가까운 끝에서 먼 끝으로, 땅에서는 보스에게서 주인공 쪽으로.
export function galeDir(flying, heroX, bossX, mid) {
  if (flying) return heroX > mid ? -1 : 1;
  return heroX >= bossX ? 1 : -1;
}

// 바람에 밀린 x. 싸움터 끝에서 멈추고, 끝 너머에 있던 사람을 끌어오지는 않는다.
export function windPush(x, dir, speed, dt, minX, maxX) {
  const next = x + dir * speed * dt;
  if (dir > 0) return Math.max(x, Math.min(next, maxX));
  return Math.min(x, Math.max(next, minX));
}

// 눈덩이 높이 차례: 낮게(점프), 높게(가만히), 그 뒤로는 무작위
export function snowLanes(count, rand = Math.random) {
  return Array.from({ length: count }, (_, i) => {
    if (i < 2) return i === 0 ? 'low' : 'high';
    return rand() < 0.5 ? 'low' : 'high';
  });
}

// 얼음벽 두 개의 x. 주인공을 가운데에 두되, 끝 방도 좁아지지 않게 edge 만큼 띄운다.
export function wallSpots(heroX, minX, maxX, gap, edge) {
  const left = clamp(heroX - gap / 2, minX + edge, maxX - edge - gap);
  return [left, left + gap];
}

// 벽에 끼었으면 가까운 쪽으로 빼낸 x. 안 끼었으면 그대로.
export function pushOutOfWall(x, heroHalf, wallX, wallHalf, minX, maxX) {
  const need = heroHalf + wallHalf;
  if (Math.abs(x - wallX) >= need - 2) return x;
  const side = x < wallX ? -1 : 1;
  const out = wallX + side * need;
  if (out >= minX && out <= maxX) return out;
  return wallX - side * need;
}

// 벽으로 나뉜 방들 [왼쪽 x, 오른쪽 x]
export function wallRooms(minX, maxX, walls, wallHalf) {
  const rooms = [];
  let from = minX;
  for (const x of walls) {
    rooms.push([from, x - wallHalf]);
    from = x + wallHalf;
  }
  rooms.push([from, maxX]);
  return rooms;
}

// 얼음이 떨어질 자리: 방마다 절반. volley 가 바뀌면 반대쪽 절반이라 늘 옮겨 갈 곳이 있다.
export function shardStrips(rooms, volley, flip, margin) {
  return rooms.map(([a, b], i) => {
    const mid = (a + b) / 2;
    const leftHalf = (volley + i + (flip ? 1 : 0)) % 2 === 0;
    return leftHalf ? [a, mid - margin] : [mid + margin, b];
  });
}
