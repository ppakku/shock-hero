// 공포 모드 움직임 계산 (화면과 상관없는 부분)
import { blocked } from './horrorGrid.js';

// keys: { up, down, left, right, run }
export function moveFromKeys(keys) {
  let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let z = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z, run: Boolean(keys.run) };
}

// 조이스틱: dx, dy 는 가운데서 손가락까지 거리. 화면 위쪽이 앞이다.
export function moveFromStick(dx, dy, max, runAt) {
  const len = Math.hypot(dx, dy);
  const s = len > max ? max / len : 1;
  const x = (dx * s) / max;
  const z = -(dy * s) / max || 0;
  return { x: x || 0, z, run: Math.min(1, len / max) >= runAt };
}

function hits(map, x, y, r) {
  return [[-r, -r], [r, -r], [-r, r], [r, r]].some(([ox, oy]) => blocked(map, Math.floor(x + ox), Math.floor(y + oy)));
}

// yaw 0 은 y 가 줄어드는 쪽을 본다. 가로세로를 따로 움직여 벽을 따라 미끄러지게 한다.
export function stepPlayer(p, move, yaw, speed, dt, map, radius) {
  const fx = -Math.sin(yaw);
  const fy = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const ry = -Math.sin(yaw);
  const dx = (rx * move.x + fx * move.z) * speed * dt;
  const dy = (ry * move.x + fy * move.z) * speed * dt;
  const x = hits(map, p.x + dx, p.y, radius) ? p.x : p.x + dx;
  const y = hits(map, x, p.y + dy, radius) ? p.y : p.y + dy;
  return { x, y };
}

export function noiseFor(moving, running, k) {
  if (!moving) return 0;
  return running ? k.runNoise : k.walkNoise;
}

// 느린 기기는 해상도를 낮추고, 여유가 있으면 다시 높인다
export function nextPixelRatio(ratio, fps, k) {
  if (fps < k.lowFps) return Math.max(k.minRatio, ratio - k.ratioStep);
  if (fps > k.highFps) return Math.min(k.maxRatio, ratio + k.ratioStep);
  return ratio;
}
