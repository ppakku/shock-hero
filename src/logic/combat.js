const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;

// 누른 시간 → 0(충전 시작) ~ 1(최대 충전)
export function chargeRatio(heldSec, charge) {
  const span = charge.fullTime - charge.minTime;
  if (span <= 0) return heldSec >= charge.minTime ? 1 : 0;
  return clamp((heldSec - charge.minTime) / span, 0, 1);
}

// 버튼을 뗐을 때 어떤 공격이 나가는지 정한다.
export function resolveAttack(heldSec, cfg, damageMultiplier = 1) {
  if (heldSec < cfg.charge.minTime) {
    return {
      kind: 'punch',
      damage: Math.round(cfg.punch.damage * damageMultiplier),
      knockback: cfg.punch.knockback,
      range: cfg.punch.range,
      ratio: 0,
      full: false,
    };
  }
  const ratio = chargeRatio(heldSec, cfg.charge);
  const c = cfg.charge;
  return {
    kind: 'charged',
    damage: Math.round(lerp(c.minDamage, c.maxDamage, ratio) * damageMultiplier),
    knockback: lerp(c.minKnockback, c.maxKnockback, ratio),
    range: c.range,
    ratio,
    full: ratio >= 1,
  };
}
