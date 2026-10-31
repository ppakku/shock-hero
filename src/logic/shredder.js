// 파쇄자 보스 계산 (화면과 상관없는 부분)

export const SHREDDER_PATTERNS = ['sawDash', 'sawThrow', 'sawDive', 'crawl', 'stomp', 'rocket', 'grind'];
export const SAW_PATTERNS = ['sawDash', 'sawThrow', 'sawDive', 'grind'];

// 단계: 0 = 쇠팔과 덮개가 다 있음, 1 = 하나 부서짐, 2 = 둘 다 부서져서 코어가 약점
export function shredderPhaseIndex(armAlive, guardAlive) {
  return (armAlive ? 0 : 1) + (guardAlive ? 0 : 1);
}

// 다음 공격 고르기. 쇠팔이 부서졌으면 주먹 발사는 빼고, 방금 한 공격은 되도록 피한다.
// 톱니 공격이 두 번 넘게 빠지면 톱니 공격 중에서만 고른다 (파쇄자는 톱니가 주인공).
export function chooseShredderAttack(phases, armAlive, guardAlive, last = null, sinceSaw = 0, rand = Math.random) {
  const idx = Math.min(shredderPhaseIndex(armAlive, guardAlive), phases.length - 1);
  let list = (phases[idx] || []).filter((p) => SHREDDER_PATTERNS.includes(p));
  if (!armAlive) list = list.filter((p) => p !== 'rocket');
  if (list.length === 0) return 'sawDash';
  if (sinceSaw >= 2) {
    const saws = list.filter((p) => SAW_PATTERNS.includes(p));
    if (saws.length) list = saws;
  }
  const fresh = list.length > 1 ? list.filter((p) => p !== last) : list;
  return fresh[Math.floor(rand() * fresh.length) % fresh.length];
}

// 평소 걸음: 주인공과 keep 만큼 떨어진 자리로 간다. 이미 가까우면 제자리 (1 줄 안쪽이면 멈춘다).
export function walkStep(x, targetX, keep, speed, dt, minX, maxX) {
  const dist = targetX - x;
  const want = Math.abs(dist) <= keep ? x : targetX - Math.sign(dist) * keep;
  const goal = Math.min(maxX, Math.max(minX, want));
  const left = goal - x;
  if (Math.abs(left) < 1) return x;
  return x + Math.sign(left) * Math.min(Math.abs(left), speed * dt);
}

// 돌진: 주인공 쪽 벽까지 달린다. 주인공이 거의 같은 자리면 더 먼 벽으로 달린다.
export function dashEndX(x, playerX, leftWall, rightWall) {
  if (Math.abs(playerX - x) >= 40) return playerX < x ? leftWall : rightWall;
  return x - leftWall > rightWall - x ? leftWall : rightWall;
}

// 땅속 톱날: 주인공을 따라가되 싸움터 밖으로 나가지 않는다
export function finStep(x, targetX, speed, dt, minX, maxX) {
  const d = targetX - x;
  const step = Math.min(Math.abs(d), speed * dt);
  return Math.min(maxX, Math.max(minX, x + Math.sign(d) * step));
}

// 굴러가는 톱날 한 프레임: 벽에 닿으면 한 번 튕겨 돌아온다.
// 돌려주는 값: { x, dir, bounces, bounced(이번 프레임에 튕겼는지) }
export function rollBlade(blade, speed, dt, minX, maxX) {
  let x = blade.x + blade.dir * speed * dt;
  let dir = blade.dir;
  let bounces = blade.bounces;
  let bounced = false;
  if ((x <= minX && dir < 0) || (x >= maxX && dir > 0)) {
    x = Math.min(maxX, Math.max(minX, x));
    if (bounces > 0) {
      dir = -dir;
      bounces -= 1;
      bounced = true;
    }
  }
  return { x, dir, bounces, bounced };
}

// 톱날이 끝났는지: 더 튕길 수 없는데 벽 쪽으로 가서 닿았을 때 (막 튕겨 나온 톱날은 아직 살아 있다)
export function bladeDone(blade, minX, maxX) {
  return blade.bounces <= 0 && ((blade.x <= minX && blade.dir < 0) || (blade.x >= maxX && blade.dir > 0));
}

// 몸통 시트(shredder_body.png) 8칸의 배 구멍 가운데. 칸 크기에 대한 비율이고 tools/make_shredder_saw.py 가 잰 값이다.
const SHREDDER_HOLES = [
  [0.596, 0.411],
  [0.578, 0.411],
  [0.637, 0.417],
  [0.619, 0.427],
  [0.613, 0.422],
  [0.608, 0.38],
  [0.602, 0.443],
  [0.567, 0.438],
];

export function holeSpot(frame) {
  const [x, y] = SHREDDER_HOLES[Number(frame) % SHREDDER_HOLES.length] ?? SHREDDER_HOLES[0];
  return { x, y };
}

// 공격 하나에서 내려온 톱니 회전 속도 (단계: idle < rev < attack, 지치면 멈춘다)
export function sawSpin(mode, raging = false) {
  const base = { stop: 0, idle: 2.5, rev: 16, attack: 28 }[mode] ?? 2.5;
  return base * (raging ? 1.3 : 1);
}
