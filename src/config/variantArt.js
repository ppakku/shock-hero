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

const sheet = (file, frameRate = 7) => ({ file, cols: 4, rows: 2, frameRate, faces: 'right' });

// 변종이 새로 받은 그림 (Gemini 그림, 모두 오른쪽을 본다. 용 시트만 왼쪽으로 뒤집어 저장)
const OWN_ART = {
  boss_body_drill: sheet('boss_body_drill.png'),
  boss_arm_drill: { file: 'boss_drill_arm.png', armCut: 130 }, // 드릴이 아래로. armCut 아래가 드릴
  boss_fist_drill: 'boss_drill_fist.png',
  boss_body_volt: sheet('boss_body_volt.png'),
  boss_arm_volt: { file: 'boss_volt_arm.png', armCut: 165 },
  boss_fist_volt: 'boss_volt_fist.png',
  watcher_bog: sheet('watcher_bog.png', 6),
  watcher_arm_bog: 'watcher_bog_arm.png',
  watcher_claw_bog: 'watcher_bog_claw.png',
  watcher_wraith: sheet('watcher_wraith.png', 8),
  watcher_arm_wraith: 'watcher_wraith_arm.png',
  watcher_claw_wraith: 'watcher_wraith_claw.png',
  dragon_rock: { file: 'dragon_rock.png', cols: 4, rows: 2, frameRate: 6 },
  dragon_tail_rock: 'dragon_rock_tail.png',
  dragon_tailtip_rock: 'dragon_rock_tailtip.png',
  dragon_thunder: { file: 'dragon_thunder.png', cols: 4, rows: 2, frameRate: 9 },
  dragon_tail_thunder: 'dragon_thunder_tail.png',
  dragon_tailtip_thunder: 'dragon_thunder_tailtip.png',
  dragon_black: { file: 'dragon_black.png', cols: 4, rows: 2, frameRate: 7 },
  dragon_tail_black: 'dragon_black_tail.png',
  dragon_tailtip_black: 'dragon_black_tailtip.png',
  astra_blizzard: sheet('astra_blizzard.png', 8),
  astra_obsidian: sheet('astra_obsidian.png', 8),
  boss_body_ghost: sheet('king_ghost_seated.png', 6),
  boss_king_stand_ghost: { file: 'king_ghost_stand.png', cols: 4, rows: 2, frameRate: 8 },
  boss_throne_ghost: 'king_ghost_throne.png',
  boss_arm_ghost: { file: 'boss_ghost_arm.png', armCut: 170 },
  boss_fist_ghost: 'boss_ghost_fist.png',
  boss_body_storm: sheet('king_storm_seated.png', 6),
  boss_king_stand_storm: sheet('king_storm_stand.png', 8),
  boss_throne_storm: 'king_storm_throne.png',
  boss_arm_storm: { file: 'boss_storm_arm.png', armCut: 175 },
  boss_fist_storm: 'boss_storm_fist.png',
  boss_body_demon: sheet('king_demon_seated.png', 6),
  boss_king_stand_demon: sheet('king_demon_stand.png', 8),
  boss_throne_demon: 'king_demon_throne.png',
  boss_arm_demon: { file: 'boss_demon_arm.png', armCut: 170 },
  boss_fist_demon: 'boss_demon_fist.png',
  boss_sea_body_ray: 'boss_sea_body_ray.png',
  boss_sea_jaw_ray: 'boss_sea_jaw_ray.png',
  boss_sea_body_abyss: 'boss_sea_body_abyss.png',
  boss_sea_jaw_abyss: 'boss_sea_jaw_abyss.png',
};

export function variantArt(base) {
  const art = {};
  for (const [skin, [from, prefixes]] of Object.entries(VARIANTS)) {
    for (const p of prefixes) if (base[`${p}${from}`]) art[`${p}${skin}`] = base[`${p}${from}`];
  }
  return { ...art, ...OWN_ART };
}
