// 난이도: 쉬움, 보통, 어려움
// 몬스터는 수와 종류, 세기가 달라지고, 보스는 체력, 빠르기, 공격을 겹쳐 쓰는 확률이 달라진다.
export const DIFFICULTIES = ['easy', 'normal', 'hard'];

export const DIFFICULTY_INFO = {
  easy: { name: '쉬움', desc: '몬스터가 적고 약해요. 보스도 느려요.' },
  normal: { name: '보통', desc: '처음 만든 그대로의 게임이에요.' },
  hard: { name: '어려움', desc: '몬스터가 많고 다양해요. 보스가 빠르고 공격을 겹쳐 써요.' },
};

export const DIFFICULTY_VALUES = {
  easy: { monsterDamage: 0.7, monsterSpeed: 0.9, monsterWindup: 1.3, bossHealth: 0.8, bossSpeed: 1.2, bossCombo: 0 },
  normal: { monsterDamage: 1, monsterSpeed: 1, monsterWindup: 1, bossHealth: 1, bossSpeed: 1, bossCombo: 0.15 },
  hard: { monsterDamage: 1.25, monsterSpeed: 1.15, monsterWindup: 0.8, bossHealth: 1.25, bossSpeed: 0.8, bossCombo: 0.5 },
};

export function normalizeDifficulty(level) {
  return DIFFICULTIES.includes(level) ? level : 'normal';
}

// 게임 설정(cfg)에 난이도 값을 붙인다. 몬스터와 보스는 cfg.difficulty 를 읽는다.
export function withDifficulty(cfg, level) {
  const lv = normalizeDifficulty(level);
  return { ...cfg, difficulty: { level: lv, ...DIFFICULTY_VALUES[lv] } };
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
