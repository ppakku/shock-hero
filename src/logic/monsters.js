// 몬스터 종류별 능력치. 기본 몬스터(balance.monster)에 종류별 배수(balance.monsterTypes)를 곱한다.
export const MONSTER_TYPES = ['basic', 'fast', 'tank', 'jumper'];

export function monsterStats(cfg, type = 'basic') {
  const base = cfg.monster;
  const t = (cfg.monsterTypes && cfg.monsterTypes[type]) || null;
  if (!t || type === 'basic') return { ...base, type: 'basic', size: 1 };
  const mul = (v, k) => (typeof t[k] === 'number' ? v * t[k] : v);
  return {
    ...base,
    type,
    maxHealth: Math.max(1, Math.round(mul(base.maxHealth, 'healthMultiplier'))),
    moveSpeed: mul(base.moveSpeed, 'speedMultiplier'),
    lungeSpeed: mul(base.lungeSpeed, 'speedMultiplier'),
    damage: Math.round(mul(base.damage, 'damageMultiplier')),
    windupTime: mul(base.windupTime, 'windupMultiplier'),
    downKnockback: mul(base.downKnockback, 'downKnockbackMultiplier'),
    size: typeof t.sizeMultiplier === 'number' && t.sizeMultiplier > 0 ? t.sizeMultiplier : 1,
    xp: typeof t.xp === 'number' ? t.xp : base.xp,
  };
}

// 스테이지 파일의 몬스터 한 줄을 { x, y, type } 으로 바꾼다. 숫자만 적으면 땅 위 기본 몬스터.
export function parseMonsterSpot(spot, groundY) {
  if (typeof spot === 'number') return { x: spot, y: groundY, type: 'basic' };
  return {
    x: spot.x,
    y: typeof spot.y === 'number' ? spot.y : groundY,
    type: MONSTER_TYPES.includes(spot.type) ? spot.type : 'basic',
  };
}
