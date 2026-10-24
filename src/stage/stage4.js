// =============================================================
//  스테이지 4: 얼음 산
// =============================================================

export const stage4 = {
  name: '얼음 산',
  width: 5400,
  groundY: 480,
  playerStartX: 120,
  gateX: 4020,
  checkpointX: 4140,

  theme: {
    sky: [0x1a2a50, 0x9ec8e8],
    sun: 0xf0f8ff,
    far: 0x4a6a90,
    near: 0x2a3e60,
    window: 0xd8f4ff,
    ground: 0xc8e0f8,
    smoke: 0xe0f0ff,
    weather: { kind: 'snow', color: 0xffffff },
  },

  platforms: [
    { x: 500, y: 390, w: 128 },
    { x: 680, y: 310, w: 96 },
    { x: 860, y: 230, w: 96 },
    { x: 1040, y: 150, w: 128 },
    { x: 1700, y: 380, w: 192 },
    { x: 2300, y: 390, w: 128 },
    { x: 2480, y: 300, w: 128 },
    { x: 3000, y: 390, w: 128 },
    { x: 3180, y: 300, w: 96 },
    { x: 3360, y: 210, w: 96 },
    { x: 3540, y: 130, w: 128 },
    { x: 3800, y: 390, w: 128 },
  ],

  monsters: [
    900,
    { x: 1300, type: 'jumper' },
    { x: 1500, type: 'fast' },
    { x: 1850, type: 'tank' },
    { x: 2100, type: 'jumper' },
    2400,
    { x: 2700, type: 'fast' },
    { x: 2900, type: 'jumper' },
    { x: 3300, type: 'tank' },
    { x: 3600, type: 'fast' },
    { x: 3850, type: 'jumper' },
  ],

  treasures: [
    { id: 'stage4-icicle', x: 1040, y: 150, xp: 50 },
    { id: 'stage4-cave', x: 2480, y: 300, xp: 40 },
    { id: 'stage4-summit', x: 3540, y: 130, xp: 70 },
  ],

  signs: [
    { x: 300, text: '스테이지 4: 얼음 산\n보라 몬스터는 점프해서 덮쳐!' },
    { x: 4300, text: '보스 구역!\n충격파가 두 번 와' },
  ],

  talks: [
    { x: 0, lines: ['으슬으슬 추워... 내 회로가 얼겠어.', '보라 녀석은 점프해서 덮쳐. 대시로 밑으로 빠져나가!'] },
    { x: 2950, lines: ['산꼭대기에 뭔가 있을 거야. 올라가 보자!'] },
    { x: 4140, lines: ['체크포인트!', '얼음 돌연변이는 빨라. 침착하게!'] },
  ],

  arena: { startX: 4440, endX: 5400 },

  boss: {
    type: 'ice', // 보스 종류 (src/boss/index.js)
    name: '얼음 돌연변이',
    arms: 3,
    healthScale: 1.5,
    speedScale: 0.9,
    shockwaves: 2, // 충격파 개수
    colors: { main: 0x2f6aa8, light: 0x6fa8e0, dark: 0x1d3f6a, arm: 0x4a8ad0 },
    phases: [
      ['slam', 'doubleSlam', 'spit'],
      ['multiSlam', 'doubleSlam', 'shockwave', 'rocks'],
      ['sweep', 'multiSlam', 'spit'],
      ['rocks', 'shockwave', 'spit'],
    ],
  },
};
