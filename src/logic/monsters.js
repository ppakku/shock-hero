// 몬스터 종류별 능력치. 기본 몬스터(balance.monster)에 종류별 배수(balance.monsterTypes)를 곱한다.
export const MONSTER_TYPES = ['basic', 'fast', 'tank', 'jumper', 'bomber', 'spitter', 'shield'];
// 수중 던전(스테이지 6) 몬스터: 골드해파리, 가시복어, 피라냐, 꽃게
export const SEA_TYPES = ['jelly', 'puffer', 'piranha', 'crab'];
MONSTER_TYPES.push(...SEA_TYPES);

// 하늘을 나는 몬스터 (중력 없음)
export const FLYING_TYPES = ['bomber'];
// 물속을 헤엄치는 몬스터도 중력이 없다 (src/enemies/SwimMonster.js)
FLYING_TYPES.push('jelly', 'puffer', 'piranha');

// 폭탄벌레가 날 수 있는 높이 (y 는 아래로 갈수록 커짐, 땅은 480)
// 250 보다 높이 올라가면 주인공이 못 때리니까 이 안에서만 난다.
export const BOMBER_MIN_Y = 250;
export const BOMBER_MAX_Y = 340;
export const BOMBER_DEFAULT_Y = 290;

// 난이도가 없으면 보통
export const NORMAL_DIFFICULTY = { level: 'normal', monsterDamage: 1, monsterSpeed: 1, monsterWindup: 1 };

// 난이도 배수를 곱한다. 피해(monsterDamage), 속도(monsterSpeed), 공격 준비와 경고와 공격 간격(monsterWindup)
const DAMAGE_KEYS = ['damage', 'bombDamage', 'spitDamage'];
const SPEED_KEYS = ['moveSpeed', 'lungeSpeed'];
const WINDUP_KEYS = ['windupTime', 'bombInterval', 'bombWarningTime', 'spitWindup', 'spitCooldown'];
// 수중 던전 몬스터 숫자 (해파리 독, 복어 가시, 피라냐 돌진)
DAMAGE_KEYS.push('boltDamage', 'thornDamage', 'bumpDamage');
SPEED_KEYS.push('boltSpeed', 'dartSpeed');
WINDUP_KEYS.push('boltWindup', 'boltCooldown', 'inflateWarning', 'puffCooldown', 'dartWindup', 'dartCooldown');
export function applyDifficulty(stats, difficulty) {
  const d = { ...NORMAL_DIFFICULTY, ...(difficulty ?? {}) };
  const num = (v) => (typeof v === 'number' && v > 0 ? v : 1);
  const out = { ...stats };
  for (const k of DAMAGE_KEYS) if (typeof out[k] === 'number') out[k] = Math.max(1, Math.round(out[k] * num(d.monsterDamage)));
  for (const k of SPEED_KEYS) if (typeof out[k] === 'number') out[k] *= num(d.monsterSpeed);
  for (const k of WINDUP_KEYS) if (typeof out[k] === 'number') out[k] *= num(d.monsterWindup);
  return out;
}

export function monsterStats(cfg, type = 'basic') {
  return applyDifficulty(baseMonsterStats(cfg, type), cfg.difficulty);
}

function baseMonsterStats(cfg, type) {
  const base = cfg.monster;
  const t = (cfg.monsterTypes && cfg.monsterTypes[type]) || null;
  if (!t || type === 'basic') return { ...base, type: 'basic', size: 1 };
  const mul = (v, k) => (typeof t[k] === 'number' ? v * t[k] : v);
  // 배수가 아닌 숫자(폭탄 피해량 등)는 이름 그대로 넘긴다
  const extras = {};
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === 'number' && !k.endsWith('Multiplier') && k !== 'xp') extras[k] = v;
  }
  return {
    ...base,
    ...extras,
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

// 주먹에 맞은 몬스터가 실제로 밀려나는 힘 (scale 0.6 = 60%)
export function pushedKnockback(knockback, scale = 1) {
  const k = typeof knockback === 'number' && knockback > 0 ? knockback : 0;
  const s = typeof scale === 'number' && scale >= 0 ? scale : 1;
  return k * s;
}

// 폭탄벌레가 떠 있을 높이. 스테이지 파일에 y 를 안 적으면(땅 높이) 기본 높이.
export function bomberHoverY(y, defaultY = BOMBER_DEFAULT_Y) {
  if (typeof y !== 'number' || y > BOMBER_MAX_Y + 60) y = defaultY;
  return Math.min(BOMBER_MAX_Y, Math.max(BOMBER_MIN_Y, y));
}

// 폭탄벌레가 갈 수 있는 가로 범위. 보스 문이 닫혀 있으면 문 앞까지만.
export function bomberXRange(stage, gateOpen) {
  const right = gateOpen ? stage.width - 40 : stage.gateX - 50;
  return { min: 40, max: Math.max(41, right) };
}

// 폭탄이 떨어질 바닥 높이: 아래에 있는 발판 중 가장 높은 곳, 없으면 땅
export function bombLandingY(x, fromY, platforms, groundY) {
  let best = groundY;
  for (const p of platforms || []) {
    if (Math.abs(p.x - x) <= p.w / 2 && p.y > fromY + 10 && p.y < best) best = p.y;
  }
  return best;
}

// 침뱉기 몬스터의 움직임: -1 뒤로 물러남, 0 제자리, 1 다가감
export function spitterMove(dist, keepAway, shootRange) {
  if (dist < keepAway) return -1;
  if (dist > shootRange) return 1;
  return 0;
}

// 방패병이 공격을 받았을 때: 'blocked' 막음, 'break' 방패가 깨짐, 'hit' 그냥 맞음
// dir 은 공격이 미는 방향(주인공이 보는 방향), facing 은 방패병이 보는 방향.
// 앞에서 온 공격 = 방패병 쪽으로 밀어붙이는 방향이 방패병이 보는 방향과 반대.
export function shieldResult(kind, dir, facing, guardUp) {
  if (!guardUp || kind === 'ultimate') return 'hit';
  const fromFront = dir === -facing;
  if (!fromFront) return 'hit';
  if (kind === 'charged') return 'break';
  return 'blocked';
}
