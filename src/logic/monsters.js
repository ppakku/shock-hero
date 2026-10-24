// 몬스터 종류별 능력치. 기본 몬스터(balance.monster)에 종류별 배수(balance.monsterTypes)를 곱한다.
export const MONSTER_TYPES = ['basic', 'fast', 'tank', 'jumper', 'fros', 'spitter', 'shield'];

// 하늘을 나는 몬스터 (중력 없음)
export const FLYING_TYPES = ['fros'];

// 예전 이름으로 적어도 알아듣게 (폭탄벌레 bomber → 프로스 fros)
const OLD_TYPE_NAMES = { bomber: 'fros' };

// 프로스(말벌)가 날 수 있는 높이 (y 는 아래로 갈수록 커짐, 땅은 480)
// 250 보다 높이 올라가면 주인공이 못 때리니까 이 안에서만 난다.
export const FROS_MIN_Y = 250;
export const FROS_MAX_Y = 340;
export const FROS_DEFAULT_Y = 290;

// 난이도가 없으면 보통
export const NORMAL_DIFFICULTY = { level: 'normal', monsterDamage: 1, monsterSpeed: 1, monsterWindup: 1 };

// 난이도 배수를 곱한다. 피해(monsterDamage), 속도(monsterSpeed), 공격 준비와 경고와 공격 간격(monsterWindup)
const DAMAGE_KEYS = ['damage', 'venomDamage', 'cloudDamage', 'spitDamage'];
const SPEED_KEYS = ['moveSpeed', 'lungeSpeed'];
const WINDUP_KEYS = ['windupTime', 'venomInterval', 'venomWarningTime', 'venomLockTime', 'spitWindup', 'spitCooldown'];
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
  // 배수가 아닌 숫자(독 피해량 등)는 이름 그대로 넘긴다
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
  const type = OLD_TYPE_NAMES[spot.type] || spot.type;
  return {
    x: spot.x,
    y: typeof spot.y === 'number' ? spot.y : groundY,
    type: MONSTER_TYPES.includes(type) ? type : 'basic',
  };
}

// 주먹에 맞은 몬스터가 실제로 밀려나는 힘 (scale 0.6 = 60%)
export function pushedKnockback(knockback, scale = 1) {
  const k = typeof knockback === 'number' && knockback > 0 ? knockback : 0;
  const s = typeof scale === 'number' && scale >= 0 ? scale : 1;
  return k * s;
}

// 프로스가 떠 있을 높이. 스테이지 파일에 y 를 안 적으면(땅 높이) 기본 높이.
export function frosHoverY(y, defaultY = FROS_DEFAULT_Y) {
  if (typeof y !== 'number' || y > FROS_MAX_Y + 60) y = defaultY;
  return Math.min(FROS_MAX_Y, Math.max(FROS_MIN_Y, y));
}

// 프로스가 갈 수 있는 가로 범위. 보스 문이 닫혀 있으면 문 앞까지만.
export function frosXRange(stage, gateOpen) {
  const right = gateOpen ? stage.width - 40 : stage.gateX - 50;
  return { min: 40, max: Math.max(41, right) };
}

// x 위치에서 fromY 보다 아래에 있는 바닥 높이: 발판 중 가장 높은 곳, 없으면 땅
export function floorBelowY(x, fromY, platforms, groundY) {
  let best = groundY;
  for (const p of platforms || []) {
    if (Math.abs(p.x - x) <= p.w / 2 && p.y > fromY + 10 && p.y < best) best = p.y;
  }
  return best;
}

// 프로스가 떠 있고 싶은 가로 위치: 주인공 옆으로 preferDist 만큼 떨어진 곳 (비스듬히 쏘려고)
// 가려는 곳이 갈 수 있는 범위 밖이면 반대편으로 간다.
export function frosHoverX(frosX, heroX, preferDist, range) {
  const side = frosX >= heroX ? 1 : -1;
  let x = heroX + side * preferDist;
  if (x < range.min || x > range.max) x = heroX - side * preferDist;
  return Math.min(range.max, Math.max(range.min, x));
}

// 맹독이 날아갈 방향(길이 1). 언제나 아래쪽으로 비스듬히 날아가서 꼭 바닥에 떨어진다.
export function venomDirection(fromX, fromY, toX, toY, minDown = 0.35) {
  let dx = toX - fromX;
  let dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  if (dy < minDown) {
    dy = minDown;
    dx = (Math.sign(dx) || 1) * Math.sqrt(1 - minDown * minDown);
  }
  return { x: dx, y: dy };
}

// 맹독이 바닥(발판 위나 땅)에 떨어지는 곳. 출발점에서 dir 방향으로 조금씩 따라가 본다.
export function venomLanding(fromX, fromY, dir, platforms, groundY, step = 4) {
  let x = fromX;
  let y = fromY;
  for (let i = 0; i < 400; i++) {
    const nx = x + dir.x * step;
    const ny = y + dir.y * step;
    // 발판은 위에서 아래로 지나갈 때만 막는다 (한쪽 발판)
    for (const p of platforms || []) {
      if (Math.abs(p.x - nx) <= p.w / 2 && y < p.y && ny >= p.y && fromY < p.y - 10) return { x: nx, y: p.y };
    }
    if (ny >= groundY) return { x: nx, y: groundY };
    x = nx;
    y = ny;
  }
  return { x, y: groundY };
}

// 독구름에 계속 서 있으면 최대로 받는 피해 (처음 닿을 때 한 번 + 간격마다)
export function maxCloudDamage(cloudTime, tickTime, damage) {
  if (!(tickTime > 0)) return 0;
  return (Math.floor(cloudTime / tickTime) + 1) * damage;
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
