// 보스 변종의 그림 목록. 변종은 stage.boss.skin 에 이름으로 적는다 (예: skin: 'bog').
// 아직 그림이 없는 부위는 원래 보스 그림을 그대로 빌려 쓴다. 새 그림은 OWN_ART 에 적으면 빌린 그림 대신 쓴다.
const WATCHER = ['watcher_', 'watcher_arm_', 'watcher_claw_', 'watcher_vine_'];
const ARMS = ['boss_body_', 'boss_arm_', 'boss_fist_', 'boss_link_'];
const KING = ['boss_body_', 'boss_king_stand_', 'boss_throne_', 'boss_arm_', 'boss_fist_', 'boss_link_'];
const DRAGON = ['dragon_', 'dragon_tail_', 'dragon_tailtip_'];
const ICE = ['astra_'];
const SEA = ['boss_sea_body_', 'boss_sea_jaw_'];

// 변종: [빌려 올 원래 skin, 그림 이름 앞부분]
export const VARIANTS = {
  drill: [1, ARMS],
  volt: [1, ARMS],
  bog: [2, WATCHER],
  wraith: [2, WATCHER],
  rock: [3, DRAGON],
  thunder: [3, DRAGON],
  black: [3, DRAGON],
  blizzard: [4, ICE],
  obsidian: [4, ICE],
  ghost: [5, KING],
  storm: [5, KING],
  demon: [10, KING],
  ray: [6, SEA],
  abyss: [6, SEA],
};

const OWN_ART = {};

export function variantArt(base) {
  const art = {};
  for (const [skin, [from, prefixes]] of Object.entries(VARIANTS)) {
    for (const p of prefixes) if (base[`${p}${from}`]) art[`${p}${skin}`] = base[`${p}${from}`];
  }
  return { ...art, ...OWN_ART };
}
