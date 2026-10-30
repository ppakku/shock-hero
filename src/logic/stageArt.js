// 그림을 한꺼번에 받지 않고 필요한 때 받기 위한 목록. 화면과 상관없어서 테스트한다.
//   처음(BootScene): 어디서나 쓰는 작은 그림만 (아이콘, 하트, 깃발, 상자, 볼트)
//   스테이지에 들어갈 때(GameScene): 그 스테이지 배경, 나오는 몬스터, 보스 그림
//   도감(DexScene), 보스 러시 고르기(RushScene): 거기서 보여 주는 그림
// 받기 전이나 못 받았을 때는 코드로 그린 임시 도형이 대신 나온다 (src/fx/textures.js).
import { artFile } from '../fx/spriteSheets.js';
import { dexIdFor } from './dex.js';
import { parseMonsterSpot } from './monsters.js';

// 처음에 받는 그림 (타이틀, 상점, 레벨 업 카드, HUD, 모든 스테이지에서 쓴다)
export const BOOT_ART = [
  'robot',
  'heart',
  'flag',
  'flag_on',
  'chest',
  'chest_open',
  'boss_core',
  'boss_armor',
  'pw_speed',
  'pw_shield',
  'pw_power',
  'pw_star',
  'pw_rapid',
  'up_attack',
  'up_defense',
  'up_speed',
  'up_robot',
];

// 몬스터 그림과 같이 쓰는 그림 (조준, 침, 깨진 방패, 부푼 복어)
const MONSTER_EXTRA = {
  monster_spitter: ['monster_spitter_aim', 'monster_spitter_spit', 'monster_spit'],
  monster_shield: ['monster_shield_broken', 'monster_shield_piece'],
  monster_puffer: ['monster_puffer_big'],
};

// 보스 그림 이름은 이 말로 시작하고 _<skin> 으로 끝난다 (예: boss_arm_5, astra_4)
const BOSS_PREFIXES = ['boss_', 'astra_', 'watcher_', 'dragon_'];
// 보스 종류마다 쓰는 효과 그림. 이름이 _<skin> 으로 끝나지 않는 보스 그림도 여기에 적는다.
// (여기 빠지면 그림 대신 임시 도형이 조용히 나온다)
const ARM_FX = ['rock', 'glob', 'fx_shockwave', 'fx_rocket_trail', 'fx_whirl'];
const BOSS_FX = {
  arms: ARM_FX,
  king: [...ARM_FX, 'fx_portal'],
  dragon: ['fx_breath', 'fx_pillar', 'fx_explosion', 'fx_fireball', 'fx_shockwave', 'fx_puddle_fire'],
  watcher: ['watcher_blister', 'slime_glob', 'fx_puddle_poison', 'fx_star'],
  ice: ['ice_heart', 'ice_icicle', 'frost_spike', 'fx_frost_cone', 'fx_frost_wall', 'fx_shockwave'],
  sea: ['boss_sea_lure', 'boss_sea_heart', 'boss_sea_bubble', 'rock', 'fx_shockwave', 'fx_sand_wave', 'fx_star', 'fx_ink', 'fx_whirl'],
};
// 킹 보스가 따로 정하지 않았을 때 부르는 부하 (src/boss/KingBoss.js)
const KING_MINIONS = ['basic', 'fast', 'jumper'];

// 스테이지에 나오는 몬스터 그림 이름들 (보스가 부르는 부하 포함)
export function monsterArtKeys(stage) {
  const types = (stage.monsters || []).map((spot) => parseMonsterSpot(spot, stage.groundY || 480).type);
  if (stage.boss?.type === 'king') types.push(...(stage.boss.minions || KING_MINIONS));
  const keys = new Set();
  for (const t of types) {
    const id = dexIdFor(stage, t);
    keys.add(id);
    for (const extra of MONSTER_EXTRA[id] || []) keys.add(extra);
  }
  return [...keys];
}

// 스테이지 보스 그림 이름들. n: 스테이지 번호 (skin 을 따로 안 적었으면 이 번호)
export function bossArtKeys(stage, n, art) {
  const skin = stage.boss?.skin || n;
  const keys = Object.keys(art).filter((k) => BOSS_PREFIXES.some((p) => k.startsWith(p)) && k.endsWith(`_${skin}`));
  return [...keys, ...(BOSS_FX[stage.boss?.type] || [])];
}

// art.js 이름들을 받을 파일 목록으로 ({ key, file }). art.js 에 없는 이름은 뺀다
export function artEntries(keys, art) {
  return [...new Set(keys)].filter((k) => art[k]).map((key) => ({ key, file: artFile(art[key]) }));
}

export function bootArt(art) {
  return artEntries(BOOT_ART, art);
}

// 스테이지 테마의 그림 (배경, 바닥, 발판)
export function themeArt(st) {
  const th = st.theme || {};
  const pics = [th.bgImage, th.arenaImage, th.groundImage, th.platformImage].filter(Boolean).map((p) => ({ key: p.key, file: p.file }));
  if (th.scenery === 'underwater') pics.push({ key: 'underwater_bg', file: 'underwater_bg.jpg' });
  return pics;
}

// 스테이지 n 에 들어갈 때 받을 그림 (배경, 바닥, 발판, 몬스터, 보스)
export function stageArt(n, stages, art) {
  const st = stages[n - 1];
  if (!st) return [];
  return [...themeArt(st), ...artEntries([...monsterArtKeys(st), ...bossArtKeys(st, n, art)], art)];
}

// 도감과 보스 러시에서 보여 주는 보스 얼굴 그림
export function portraitArt(keys, art) {
  return artEntries(keys.filter(Boolean), art);
}
