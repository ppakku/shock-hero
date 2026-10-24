// 난이도와 "겹치기 공격" 계산 (두꺼비, 골렘 보스가 쓴다)

// cfg.difficulty 가 없으면 보통 난이도
export const NORMAL_DIFFICULTY = { level: 'normal', bossHealth: 1, bossSpeed: 1, bossCombo: 0.15 };

export function difficultyOf(cfg) {
  const d = cfg?.difficulty ?? NORMAL_DIFFICULTY;
  const num = (v, def) => (Number.isFinite(v) && v > 0 ? v : def);
  return {
    level: d.level || 'normal',
    bossHealth: num(d.bossHealth, 1),
    bossSpeed: num(d.bossSpeed, 1),
    bossCombo: Number.isFinite(d.bossCombo) ? Math.min(1, Math.max(0, d.bossCombo)) : NORMAL_DIFFICULTY.bossCombo,
  };
}

// 큰 공격을 시작할 때 chance 확률로 같이 쓸 작은 공격을 고른다.
// map = { 큰공격: [같이 쓸 수 있는 작은 공격들] }. 없으면 null.
export function pickSideAttack(map, mainType, chance, rand = Math.random) {
  const list = map[mainType] || [];
  if (!list.length || chance <= 0) return null;
  if (rand() >= chance) return null;
  return list[Math.floor(rand() * list.length) % list.length];
}
