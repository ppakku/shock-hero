// 지금 레벨에서 다음 레벨까지 필요한 경험치
export function xpToNext(level, levelCfg) {
  return Math.max(1, Math.round(levelCfg.firstLevelXp * Math.pow(levelCfg.xpGrowth, level - 1)));
}

// xp 는 "지금 레벨 안에서 모은 경험치"
export function addXp({ level, xp }, amount, levelCfg) {
  let l = level;
  let x = xp + Math.max(0, amount || 0);
  let levelsGained = 0;
  while (x >= xpToNext(l, levelCfg) && levelsGained < 100) {
    x -= xpToNext(l, levelCfg);
    l += 1;
    levelsGained += 1;
  }
  return { level: l, xp: x, levelsGained };
}

export function maxHealthFor(level, baseHealth, levelCfg) {
  return baseHealth + (level - 1) * levelCfg.healthPerLevel;
}

// 공격력은 이제 레벨이 아니라 레벨 업 카드(공격력)로 오른다. growth.js 의 attackMultiplier 참고.
