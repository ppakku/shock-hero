// 보스들이 같이 쓰는 그림 효과

// 빨아들이기 소용돌이: 입 쪽으로 빨려 들어가는 선들.
// dir = -1 이면 왼쪽에서, 1 이면 오른쪽에서 끌어온다. strength 0~1.
export function drawSwirl(g, mx, my, t, strength, dir = -1) {
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
