const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;

// 누른 시간 → 0(충전 시작) ~ 1(최대 충전)
export function chargeRatio(heldSec, charge) {
  const span = charge.fullTime - charge.minTime;
  if (span <= 0) return heldSec >= charge.minTime ? 1 : 0;
  return clamp((heldSec - charge.minTime) / span, 0, 1);
}

// 버튼을 뗐을 때 어떤 공격이 나가는지 정한다.
// up = 위(W, ↑)를 누르고 있었으면 위쪽 공격(어퍼컷)
export function resolveAttack(heldSec, cfg, damageMultiplier = 1, { up = false } = {}) {
  const sk = cfg.skills;
  if (heldSec < cfg.charge.minTime) {
    if (up && sk) {
      return {
        kind: 'upper',
        damage: Math.round(sk.upperDamage * damageMultiplier),
        knockback: sk.upperKnockback,
        range: sk.upperReach,
        ratio: 0,
        full: false,
        up: true,
      };
    }
    return {
      kind: 'punch',
      damage: Math.round(cfg.punch.damage * damageMultiplier),
      knockback: cfg.punch.knockback,
      range: cfg.punch.range,
      ratio: 0,
      full: false,
      up: false,
    };
  }
  const ratio = chargeRatio(heldSec, cfg.charge);
  const c = cfg.charge;
  const isUp = Boolean(up && sk);
  return {
    kind: 'charged',
    damage: Math.round(lerp(c.minDamage, c.maxDamage, ratio) * damageMultiplier),
    knockback: lerp(c.minKnockback, c.maxKnockback, ratio),
    range: isUp ? sk.upperReach : c.range,
    ratio,
    full: ratio >= 1,
    up: isUp,
  };
}

// 위쪽 공격이 닿는 사각형. (px, py) 는 주인공 몸 한가운데, 머리 꼭대기는 py - 31.
// 앞쪽으로 조금 치우친 키 큰 기둥 모양이다.
export function upperRect(px, py, facing, reach, width) {
  const headTop = py - 31;
  const x = facing > 0 ? px - width * 0.35 : px - width * 0.65;
  return { x, y: headTop - reach, w: width, h: reach + 31 };
}

// 최대 충전 때 나가는 파란 에너지탄
export function shotAttack(cfg, damageMultiplier = 1) {
  const sk = cfg.skills;
  return {
    kind: 'shot',
    damage: Math.round(sk.shotDamage * damageMultiplier),
    knockback: sk.shotKnockback,
    range: sk.shotSize,
    ratio: 1,
    full: true,
  };
}

// 에너지탄이 날아갈 방향 (길이 1). 위 공격이면 위로, 움직이면서 쏘면 대각선 위로.
export function shotDirection(facing, up, moving) {
  if (!up) return { x: facing, y: 0 };
  if (!moving) return { x: 0, y: -1 };
  const a = (45 * Math.PI) / 180;
  return { x: facing * Math.cos(a), y: -Math.sin(a) };
}

// ---------- 궁극기 게이지 (0 ~ 1) ----------

// 적에게 피해를 주면 게이지가 찬다
export function gaugeAfterDealing(gauge, damage, ult) {
  return clamp(gauge + Math.max(0, damage) * ult.gaugePerDamage, 0, 1);
}

// 피해를 받아도 조금 찬다
export function gaugeAfterHurt(gauge, damage, ult) {
  return clamp(gauge + Math.max(0, damage) * ult.gaugePerHurt, 0, 1);
}

export const isUltReady = (gauge) => gauge >= 1;

// 궁극기 공격 (화면 전체)
export function ultimateAttack(cfg, damageMultiplier = 1) {
  const u = cfg.ultimate;
  return {
    attack: {
      kind: 'ultimate',
      damage: Math.round(u.damage * damageMultiplier),
      knockback: u.knockback,
      range: 0,
      ratio: 1,
      full: true,
    },
    bossDamage: Math.round(u.bossDamage * damageMultiplier),
  };
}
