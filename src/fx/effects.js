import { makeText } from '../ui/text.js';

// 위로 떠오르며 사라지는 글자 (피해량, "회피!" 등)
export function floatText(scene, x, y, str, color = '#ffffff', size = 20) {
  const t = makeText(scene, x, y, str, size, color).setOrigin(0.5).setDepth(40);
  scene.tweens.add({
    targets: t,
    y: y - 45,
    alpha: 0,
    duration: 750,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
  return t;
}

// 퍼지는 원 (충격파)
export function ring(scene, x, y, color, radius, duration = 300, lineWidth = 6) {
  const g = scene.add.graphics().setDepth(25);
  const state = { r: 8, a: 1 };
  scene.tweens.add({
    targets: state,
    r: radius,
    a: 0,
    duration,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      g.clear();
      g.lineStyle(lineWidth, color, state.a);
      g.strokeCircle(x, y, state.r);
    },
    onComplete: () => g.destroy(),
  });
}

// 잠깐 하얗게 번쩍
export function flash(scene, target, restoreTint = null) {
  if (!target || !target.active) return;
  target.setTintFill(0xffffff);
  scene.time.delayedCall(70, () => {
    if (!target.active) return;
    if (restoreTint !== null) target.setTint(restoreTint);
    else target.clearTint();
  });
}
