// =============================================================
//  스테이지 8: 화산 심장부 (아스트라노바X가 화가 나서 돌아왔다)
// =============================================================

export const stage8 = {
  name: '화산 심장부',
  width: 6200,
  groundY: 480,
  playerStartX: 120,
  gateX: 4800,
  checkpointX: 4920,

  theme: {
    // 용암 지대에 어울리는 생김새 (움직임과 세기는 그대로). 빨강 날쌘돌이는 원래 불 도깨비라 그대로
    monsterSkins: { basic: 'monster_lava_basic', tank: 'monster_lava_tank', jumper: 'monster_lava_jumper' },
    scenery: 'volcano',
    bgImage: { key: 'lava_bg', file: 'lava_bg.jpg' }, // 스테이지 3 그림을 같이 씀
    arenaImage: { key: 'lava_arena', file: 'lava_arena.jpg' },
    platform: 0x8a5a4a,
    platformImage: { key: 'lava_platform', file: 'lava_platform.png', left: 80, right: 80, surface: 4, scale: 0.5 },
    groundImage: { key: 'lava_ground', file: 'lava_ground.png', surface: 30 },
    sky: [0x1a0404, 0xb02a10], // 스테이지 3 보다 더 어둡고 붉게
    sun: 0xff6a2a,
    far: 0x3a0e08,
    near: 0x200604,
    window: 0xff7a2a,
    ground: 0xd08878,
    smoke: 0x5a2a1a,
    weather: { kind: 'embers', color: 0xff6a2a },
  },

  platforms: [
    { x: 500, y: 390, w: 128 },
    { x: 680, y: 300, w: 96 },
    { x: 860, y: 210, w: 96 },
    { x: 1040, y: 120, w: 128 },
    { x: 1600, y: 390, w: 160 },
    { x: 1780, y: 300, w: 128 },
    { x: 2300, y: 380, w: 192 },
    { x: 2490, y: 290, w: 96 },
    { x: 2670, y: 200, w: 96 },
    { x: 2850, y: 110, w: 128 },
    { x: 3400, y: 390, w: 128 },
    { x: 3580, y: 300, w: 96 },
    { x: 3760, y: 210, w: 128 },
    { x: 4200, y: 390, w: 128 },
    { x: 4380, y: 300, w: 96 },
    { x: 4560, y: 210, w: 96 },
  ],

  monsters: [
    900,
    { x: 1100, type: 'fast' },
    { x: 1300, type: 'spitter' },
    { x: 1500, type: 'tank' },
    { x: 1700, type: 'fros' },
    { x: 1900, type: 'shield' },
    { x: 2100, type: 'jumper' },
    { x: 2300, y: 380, type: 'jumper' },
    { x: 2550, type: 'fast' },
    { x: 2750, type: 'spitter' },
    { x: 3000, type: 'tank' },
    { x: 3200, type: 'fros' },
    { x: 3450, type: 'shield' },
    { x: 3650, type: 'fast' },
    { x: 3900, type: 'jumper' },
    { x: 4100, type: 'tank' },
    { x: 4350, type: 'spitter' },
    { x: 4600, type: 'shield' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage8-magma', power: 'shield' },
    { id: 'stage8-obsidian' },
    { id: 'stage8-geyser', power: 'speed' },
    { id: 'stage8-ash' },
    { id: 'stage8-core', power: 'star' },
  ],

  signs: [
    { x: 300, text: '스테이지 8: 화산 심장부\n바닥이 끓고 있어!' },
    { x: 5150, text: '익숙한 날갯소리가\n들려온다...' },
  ],

  talks: [
    { x: 0, lines: ['화산 한가운데야! 용암 지대보다 훨씬 뜨거워.', '방패병이랑 침뱉기가 같이 나오면 침뱉기부터 잡아!'] },
    { x: 2200, lines: ['저 높은 바위 탑, 꼭대기까지 갈 수 있겠어?'] },
    { x: 4920, lines: ['체크포인트!', '아스트라노바X가 다시 나타났어. 더 화가 났나 봐!', '불길은 점프로, 날개 바람은 앞으로 걸어서 버텨!'] },
  ],

  arena: { startX: 5240, endX: 6200 },

  boss: {
    type: 'dragon',
    name: '분노한 아스트라노바X',
    skin: 'rock', // 스테이지 3 아스트라노바X 그림을 그대로 씀
    signature: 'boulders',
    healthScale: 1.45,
    speedScale: 0.85,
    colors: { main: 0xc8282a, dark: 0x7a1418, armor: 0x2e2a2c, lava: 0xff7a1f, belly: 0xf0d0a0 },
    // 공격: breath(불 뿜기), wing(날개 바람), tail(꼬리 휘두르기), fly(날아올라 불 폭격), pillars(용암 불기둥)
    phases: [
      ['breath', 'tail', 'wing', 'signature', 'fly'],
      ['signature', 'tail', 'pillars', 'fly', 'wing'],
      ['breath', 'pillars', 'fly', 'tail', 'signature'],
    ],
    intro: ['아스트라노바X! 아까보다 훨씬 화가 났어!', '꼬리가 땅에 떨어지거나 날개가 처지면 그때 때려!'],
  },
};
