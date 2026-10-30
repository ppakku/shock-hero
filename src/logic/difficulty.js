// 난이도: 쉬움, 보통, 어려움
// 몬스터는 수와 종류, 세기가 달라지고, 보스는 체력, 빠르기, 공격을 겹쳐 쓰는 확률이 달라진다.
export const DIFFICULTIES = ['easy', 'normal', 'hard'];

export const DIFFICULTY_INFO = {
  easy: { name: '쉬움', desc: '몬스터가 적고 약해요. 때리면 잘 멈춰요.' },
  normal: { name: '보통', desc: '뒤 스테이지일수록 몬스터가 튼튼하고 아파요.' },
  hard: { name: '어려움', desc: '몬스터가 많고 튼튼해요. 내 레벨만큼 같이 세져요.' },
};

// monsterHealth, monsterDamage, bossHealth, bossDamage: 체력과 공격력 배수
// stunGuard: 몬스터가 한 번 비틀거린 뒤 이 초 동안은 맞아도 멈추지 않는다 (0 이면 때릴 때마다 멈춤)
// heartChance: 하트가 떨어질 확률 배수
// catchUp: 내 레벨이 스테이지보다 높을 때 몬스터가 따라오는 정도 (0 = 안 따라옴, 0.8 = 80% 따라옴)
export const DIFFICULTY_VALUES = {
  easy: { monsterHealth: 0.8, monsterDamage: 0.7, monsterSpeed: 0.9, monsterWindup: 1.3, bossHealth: 0.8, bossDamage: 0.8, bossSpeed: 1.2, bossCombo: 0, stunGuard: 0, heartChance: 1, catchUp: 0 },
  normal: { monsterHealth: 1, monsterDamage: 1, monsterSpeed: 1, monsterWindup: 1, bossHealth: 1, bossDamage: 1, bossSpeed: 1, bossCombo: 0.15, stunGuard: 0.8, heartChance: 0.8, catchUp: 0.4 },
  hard: { monsterHealth: 1.3, monsterDamage: 1.25, monsterSpeed: 1.15, monsterWindup: 0.8, bossHealth: 1.4, bossDamage: 1.3, bossSpeed: 0.8, bossCombo: 0.5, stunGuard: 1.4, heartChance: 0.55, catchUp: 0.8 },
};

export function normalizeDifficulty(level) {
  return DIFFICULTIES.includes(level) ? level : 'normal';
}

// 스테이지가 하나 넘어갈 때마다 조금씩 어려워지는 양 (스테이지 1 은 그대로, 10 이면 9번, 20 이면 14번, 40 이면 19번 쌓임)
export const STAGE_RAMP = {
  monsterHealth: 0.1, // 몬스터 체력 +10%
  monsterDamage: 0.07, // 몬스터 피해 +7%
  monsterSpeed: 0.015, // 몬스터 빠르기 +1.5%
  monsterWindup: -0.015, // 공격 준비 시간 -1.5%
  bossHealth: 0.05, // 보스 체력 +5%
  bossDamage: 0.05, // 보스 피해 +5%
  bossSpeed: -0.015, // 보스 공격 간격 -1.5%
  bossCombo: 0.02, // 겹쳐 쓰기 확률 +2%p
};

// 처음부터 차례로 깼을 때 스테이지마다 예상되는 레벨. 이보다 높으면 "레벨이 앞선" 만큼 몬스터가 따라온다.
export const STAGE_LEVELS = [
  1, 4, 6, 8, 9, 10, 10, 11, 12, 12, 12, 13, 13, 14, 14, 14, 14, 15, 15, 15,
  15, 15, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18,
];

// 레벨이 하나 앞설 때마다 늘어나는 양 (catchUp 을 곱해서 쓴다). maxLevels 까지만 쌓인다.
export const LEVEL_CATCHUP = { monsterHealth: 0.08, monsterDamage: 0.04, bossHealth: 0.06, bossDamage: 0.04, maxLevels: 15 };

// 내 레벨이 스테이지 예상 레벨보다 몇 앞서 있는지 (뒤처져 있으면 0)
export function levelsAhead(level, stageNum = 1) {
  if (!Number.isFinite(level)) return 0;
  const i = Math.min(STAGE_LEVELS.length, Math.max(1, Math.floor(stageNum) || 1)) - 1;
  return Math.min(LEVEL_CATCHUP.maxLevels, Math.max(0, Math.floor(level) - STAGE_LEVELS[i]));
}

// 스테이지 번호에 맞춘 배수. 난이도(쉬움, 보통, 어려움) 값에 곱한다(겹쳐 쓰기는 더한다).
// 스테이지 11 부터(2장)는 반씩, 스테이지 21 부터(3장, 4장)는 4분의 1씩만 쌓인다. 공격력 카드가 다 차서 주인공은 더 안 세지므로 너무 가파르지 않게.
export function stageRamp(stageNum = 1) {
  const raw = Math.max(0, (Number.isFinite(stageNum) ? Math.floor(stageNum) : 1) - 1);
  const n = Math.min(raw, 9) + Math.max(0, Math.min(raw, 19) - 9) * 0.5 + Math.max(0, raw - 19) * 0.25;
  const out = {};
  for (const [k, step] of Object.entries(STAGE_RAMP)) out[k] = k === 'bossCombo' ? step * n : 1 + step * n;
  return out;
}

// 보스 숫자가 들어 있는 곳. 이름이 Damage 로 끝나는 숫자가 보스가 주는 피해다.
const BOSS_SECTIONS = ['boss', 'iceBoss', 'kingBoss', 'watcherBoss', 'dragonBoss', 'seaBoss'];

function scaleBossDamage(section, mul) {
  const out = { ...section };
  for (const [k, v] of Object.entries(out)) {
    if (k.endsWith('Damage') && typeof v === 'number') out[k] = Math.max(1, Math.round(v * mul));
  }
  return out;
}

// 게임 설정(cfg)에 난이도 값을 붙인다. 몬스터와 보스는 cfg.difficulty 를 읽는다.
// playerLevel 을 주면 그 레벨이 스테이지보다 앞선 만큼 몬스터와 보스도 따라온다.
export function withDifficulty(cfg, level, stageNum = 1, playerLevel = null) {
  const lv = normalizeDifficulty(level);
  const base = DIFFICULTY_VALUES[lv];
  const r = stageRamp(stageNum);
  const ahead = levelsAhead(playerLevel, stageNum) * base.catchUp;
  const d = { level: lv };
  for (const [k, v] of Object.entries(base)) {
    if (!(k in r)) d[k] = v;
    else if (k === 'bossCombo') d[k] = Math.min(1, v + r[k]);
    else d[k] = v * r[k] * (1 + ahead * (LEVEL_CATCHUP[k] || 0));
  }
  const out = { ...cfg, difficulty: d };
  for (const key of BOSS_SECTIONS) if (cfg[key]) out[key] = scaleBossDamage(cfg[key], d.bossDamage);
  return out;
}

// 어려움에서 더할 몬스터 종류 (스테이지에 이미 나오는 종류 중에서 돌아가며)
const HARD_EXTRA = ['fast', 'tank', 'jumper'];

// 스테이지 몬스터 목록을 난이도에 맞게 바꾼다. spots 는 { x, y, type } 목록.
// 쉬움: 세 마리 중 한 마리를 빼고, 특수 몬스터 절반을 초록 몬스터로 바꾼다.
// 어려움: 두 마리마다 한 마리를 더하고(스테이지에 나오는 종류로), 초록 몬스터 절반을 더 센 종류로 바꾼다.
export function adjustMonsters(spots, level, gateX) {
  const lv = normalizeDifficulty(level);
  if (lv === 'normal') return spots.map((s) => ({ ...s }));
  if (lv === 'easy') {
    let special = 0;
    return spots
      .filter((_, i) => i % 3 !== 2)
      .map((s) => {
        if (s.type === 'basic') return { ...s };
        special += 1;
        return special % 2 === 0 ? { ...s, type: 'basic' } : { ...s };
      });
  }
  const present = [...new Set(spots.map((s) => s.type).filter((t) => t !== 'basic'))];
  const pool = present.length ? present : HARD_EXTRA;
  const out = [];
  let basics = 0;
  spots.forEach((s, i) => {
    let type = s.type;
    if (type === 'basic') {
      basics += 1;
      if (basics % 2 === 0) type = pool[basics % pool.length];
    }
    out.push({ ...s, type });
    if (i % 2 === 1) {
      const x = Math.min(s.x + 140, gateX - 80);
      out.push({ x, y: s.y, type: pool[i % pool.length] });
    }
  });
  return out;
}
