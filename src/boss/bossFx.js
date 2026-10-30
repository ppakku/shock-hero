// 보스들이 같이 쓰는 그림 효과
import { stamp } from '../fx/bossArt.js';

// 빨아들이기 소용돌이: 입 쪽으로 빨려 들어가는 선들.
// dir = -1 이면 왼쪽에서, 1 이면 오른쪽에서 끌어온다. strength 0~1.
export function drawSwirl(g, mx, my, t, strength, dir = -1) {
  stamp(g.scene, 'fx_whirl', mx, my, 150, 150, { rotation: t * 4 * dir, alpha: strength * 0.7 });
  const n = 16;
  for (let i = 0; i < n; i++) {
    const ph = (t * 1.3 + i * 0.37) % 1;
    const r = 50 + 520 * (1 - ph);
    const off = -0.6 + ((i * 0.618) % 1) * 1.35; // 위쪽 왼편부터 바닥 쪽까지
    const curl = Math.sin(t * 6 + i) * 0.12;
    const x = mx + dir * r * Math.cos(off + curl);
    const y = my + r * Math.sin(off + curl);
    const r2 = Math.max(20, r - 46);
    const x2 = mx + dir * r2 * Math.cos(off + curl * 1.6);
    const y2 = my + r2 * Math.sin(off + curl * 1.6);
    g.lineStyle(3, i % 3 === 0 ? 0xbff8ff : 0xffffff, Math.min(1, strength * (0.25 + 0.75 * ph)));
    g.lineBetween(x, y, x2, y2);
  }
}

// 뜨거운 빨간 기운(분노)
export function drawRageAura(g, x, y, w, h, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 10);
  g.fillStyle(0xff2020, 0.12 + 0.12 * pulse).fillEllipse(x, y, w + pulse * 20, h + pulse * 10);
  return pulse;
}

// 얼음 조각 하나 (마름모). angle 은 뾰족한 쪽 방향(라디안)
export function drawIceShard(g, x, y, size, angle, color = 0xe8fbff, alpha = 1) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const L = size;
  const W = size * 0.35;
  g.fillStyle(color, alpha).fillPoints(
    [
      { x: x + c * L, y: y + s * L },
      { x: x - s * W, y: y + c * W },
      { x: x - c * L * 0.6, y: y - s * L * 0.6 },
      { x: x + s * W, y: y - c * W },
    ],
    true,
  );
}

// 냉기 브레스 부채꼴: 입(mx, my)에서 바닥 x0~x1 까지 퍼지는 서리.
// power 0~1 (뿜기 시작할 때 커짐), t 는 흔들림용 시간
export function drawFrostCone(g, mx, my, x0, x1, gy, t, power = 1) {
  // 그림: 뾰족한 위쪽이 입, 아래쪽이 바닥 x0~x1 (입이 한쪽으로 치우친 만큼 돌려 놓는다)
  const cx = (x0 + x1) / 2;
  const reach = Math.hypot(cx - mx, gy - my);
  const lean = Math.atan2(gy - my, cx - mx) - Math.PI / 2;
  if (stamp(g.scene, 'fx_frost_cone', mx, my, Math.abs(x1 - x0) * 1.15, reach * 1.1, { rotation: lean, alpha: power })) {
    g.fillStyle(0xf0fbff, 0.7 * power).fillEllipse(cx, gy, Math.abs(x1 - x0) * 1.05, 26);
    return;
  }
  const wob = Math.sin(t * 30) * 6;
  const pts = (shrink) => {
    const mid = (x0 + x1) / 2;
    const a = Phaser_lerp(x0, mid, shrink);
    const b = Phaser_lerp(x1, mid, shrink);
    return [{ x: mx, y: my }, { x: a, y: gy + 6 }, { x: b + wob, y: gy + 6 }];
  };
  g.fillStyle(0x7fd8ff, 0.35 * power).fillPoints(pts(0), true);
  g.fillStyle(0xbff4ff, 0.45 * power).fillPoints(pts(0.25), true);
  g.fillStyle(0xffffff, 0.55 * power).fillPoints(pts(0.6), true);
  // 바닥이 하얗게 얼어붙음
  g.fillStyle(0xf0fbff, 0.7 * power).fillEllipse((x0 + x1) / 2, gy, Math.abs(x1 - x0) * 1.05, 26);
  g.lineStyle(3, 0xffffff, 0.8 * power).strokePoints(pts(0), true);
}

function Phaser_lerp(a, b, k) {
  return a + (b - a) * k;
}
