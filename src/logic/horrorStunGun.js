// 공포 모드 전기충격기: 쏜 뒤 움직임과 번개 모양을 계산한다. 그리기는 src/horror/stunGun.js 가 맡는다.

export function createGunFx() {
  return { kickT: 0, kickPower: 0, zapT: 0, boltT: 0, chargeT: 0 };
}

// result: 'hit' 맞힘, 'miss' 빗나감, 'empty' 충전 없이 누름
export function fireGunFx(fx, result, k) {
  fx.kickT = k.kickTime;
  fx.kickPower = k.kick[result];
  fx.zapT = result === 'empty' ? 0 : k.zapTime;
  fx.boltT = result === 'hit' ? k.boltTime : 0;
}

export function chargeGunFx(fx, k) {
  fx.chargeT = k.chargeTime;
}

export function stepGunFx(fx, dt) {
  const pass = Math.max(0, dt); // 첫 프레임은 시간이 거꾸로 올 수 있다. 그대로 빼면 번쩍임이 저절로 켜진다
  fx.kickT = Math.max(0, fx.kickT - pass);
  fx.zapT = Math.max(0, fx.zapT - pass);
  fx.boltT = Math.max(0, fx.boltT - pass);
  fx.chargeT = Math.max(0, fx.chargeT - pass);
}

// 앞으로 찌른 정도. 빨리 나갔다가 천천히 돌아온다
export function gunPush(fx, k) {
  if (fx.kickT <= 0) return 0;
  return fx.kickPower * Math.sin(Math.PI * Math.sqrt(1 - fx.kickT / k.kickTime));
}

// from 에서 to 까지 꺾이는 번개의 점들. 양 끝은 정확히 닿고 가운데가 가장 크게 흔들린다
export function jagged(from, to, parts, jitter, rand = Math.random) {
  const points = [];
  for (let i = 0; i <= parts; i++) {
    const t = i / parts;
    const swing = Math.sin(Math.PI * t) * jitter;
    const shake = () => (i === 0 || i === parts ? 0 : (rand() - 0.5) * 2 * swing);
    points.push({
      x: from.x + (to.x - from.x) * t + shake(),
      y: from.y + (to.y - from.y) * t + shake(),
      z: from.z + (to.z - from.z) * t,
    });
  }
  return points;
}

// 카메라 공간의 점들을 얇은 띠로 펼친다. 멀어져도 화면에서 같은 굵기로 보이게 거리만큼 넓힌다
export function ribbonPositions(points, width, out) {
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const half = (width * Math.max(0.1, -p.z)) / 2;
    const nx = len === 1 && !dx && !dy ? half : (-dy / len) * half;
    const ny = len === 1 && !dx && !dy ? 0 : (dx / len) * half;
    out.set([p.x + nx, p.y + ny, p.z, p.x - nx, p.y - ny, p.z], i * 6);
  });
  return out;
}
