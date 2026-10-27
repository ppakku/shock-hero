// =============================================================
//  스테이지 9: 빙하 요새 (혹한의 아스트라가 더 사나워져 돌아왔다)
// =============================================================

export const stage9 = {
  name: '빙하 요새',
  width: 6400,
  groundY: 480,
  playerStartX: 120,
  gateX: 5000,
  checkpointX: 5120,

  theme: {
    // 얼음 산에 어울리는 생김새 (움직임과 세기는 그대로)
    monsterSkins: { basic: 'monster_ice_basic', fast: 'monster_ice_fast', tank: 'monster_ice_tank', jumper: 'monster_ice_jumper' },
    scenery: 'mountains',
    bgImage: { key: 'ice_bg', file: 'ice_bg.jpg' }, // 스테이지 4 그림을 같이 씀
    arenaImage: { key: 'ice_arena', file: 'ice_arena.jpg' },
    groundImage: { key: 'ice_ground', file: 'ice_ground.png', surface: 4 },
    platformImage: { key: 'ice_platform', file: 'ice_platform.png', left: 70, right: 70, surface: 7, scale: 0.45 },
    sky: [0x0a1430, 0x5a88b8], // 스테이지 4 보다 어두운 눈보라 하늘
    sun: 0xd8ecff,
    far: 0x34507a,
    near: 0x1c2c4a,
    window: 0xb8e8ff,
    ground: 0xb8d4f0,
    smoke: 0xd0e4ff,
    weather: { kind: 'snow', color: 0xffffff },
  },

  platforms: [
    { x: 500, y: 390, w: 128 },
    { x: 680, y: 300, w: 96 },
    { x: 860, y: 210, w: 96 },
    { x: 1040, y: 120, w: 128 },
    { x: 1600, y: 390, w: 128 },
    { x: 1780, y: 300, w: 96 },
    { x: 1960, y: 210, w: 96 },
    { x: 2140, y: 120, w: 96 },
    { x: 2800, y: 380, w: 192 },
    { x: 3300, y: 390, w: 128 },
    { x: 3480, y: 300, w: 96 },
    { x: 3660, y: 210, w: 96 },
    { x: 3840, y: 120, w: 128 },
    { x: 4400, y: 390, w: 128 },
    { x: 4580, y: 300, w: 96 },
    { x: 4760, y: 210, w: 128 },
  ],

  monsters: [
    800,
    { x: 1000, type: 'fast' },
    { x: 1200, type: 'jumper' },
    { x: 1400, type: 'fros' },
    { x: 1550, type: 'shield' },
    { x: 1800, type: 'spitter' },
    { x: 2000, type: 'tank' },
    { x: 2250, type: 'fast' },
    { x: 2500, type: 'fros' },
    { x: 2800, y: 380, type: 'jumper' },
    { x: 3000, type: 'shield' },
    { x: 3150, type: 'spitter' },
    { x: 3350, type: 'tank' },
    { x: 3550, type: 'fast' },
    { x: 3750, type: 'fros' },
    { x: 3950, type: 'jumper' },
    { x: 4150, type: 'shield' },
    { x: 4350, type: 'spitter' },
    { x: 4600, type: 'tank' },
    { x: 4850, type: 'fast' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage9-frost', power: 'speed' },
    { id: 'stage9-crystal' },
    { id: 'stage9-iceberg', power: 'shield' },
    { id: 'stage9-blizzard' },
    { id: 'stage9-aurora', power: 'power' },
    { id: 'stage9-throne', power: 'star' },
  ],

  signs: [
    { x: 300, text: '스테이지 9: 빙하 요새\n하늘의 프로스를 조심해!' },
    { x: 5350, text: '얼음 날개가\n다시 펄럭인다...' },
  ],

  talks: [
    { x: 0, lines: ['빙하 요새야. 얼음산보다 더 추워!', '프로스가 여기저기 날아다녀. 독구름을 조심해!'] },
    { x: 1500, lines: ['얼음 탑이 아주 높아. 보물은 꼭대기에 있을 때가 많아!'] },
    { x: 5120, lines: ['체크포인트!', '혹한의 아스트라가 더 사나워져서 돌아왔어.', '냉기 브레스는 파란 부채꼴 밖으로, 빙천지락은 빛나는 바닥을 피해!'] },
  ],

  arena: { startX: 5440, endX: 6400 },

  boss: {
    type: 'ice',
    name: '사나운 혹한의 아스트라',
    skin: 4, // 스테이지 4 혹한의 아스트라 그림을 그대로 씀
    healthScale: 1.9,
    speedScale: 0.8,
    colors: { bright: 0x3d9be0, main: 0x2a5fa8, dark: 0x1a2552, pale: 0xc4cee0, light: 0xd8f6ff },
    // icicles(고드름 비), dive(급강하), freezeBreath(냉기 브레스), avalanche(빙천지락), hop(뛰어 내려찍기, 땅에서만)
    phases: [
      ['freezeBreath', 'dive', 'avalanche', 'icicles', 'dive'],
      ['dive', 'freezeBreath', 'avalanche', 'icicles', 'avalanche'],
      ['hop', 'freezeBreath', 'avalanche', 'hop'],
    ],
  },
};
