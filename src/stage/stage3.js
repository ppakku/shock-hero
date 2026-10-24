// =============================================================
//  스테이지 3: 용암 지대
// =============================================================

export const stage3 = {
  name: '용암 지대',
  width: 5200,
  groundY: 480,
  playerStartX: 120,
  gateX: 3820,
  checkpointX: 3940,

  theme: {
    sky: [0x2a0a08, 0xd8401c],
    sun: 0xff8a3d,
    far: 0x4a1a12,
    near: 0x2a0d08,
    window: 0xff9a3d,
    ground: 0xe0a090,
    smoke: 0x6a3a2a,
    weather: { kind: 'embers', color: 0xff9a3d },
  },

  platforms: [
    { x: 600, y: 390, w: 128 },
    { x: 780, y: 300, w: 128 },
    { x: 1300, y: 390, w: 128 },
    { x: 1480, y: 300, w: 96 },
    { x: 1660, y: 210, w: 96 },
    { x: 1840, y: 130, w: 128 },
    { x: 2400, y: 380, w: 192 },
    { x: 2900, y: 390, w: 128 },
    { x: 3080, y: 310, w: 128 },
    { x: 3500, y: 390, w: 160 },
    { x: 3650, y: 300, w: 96 },
  ],

  monsters: [
    1000,
    { x: 1200, type: 'fast' },
    { x: 1600, type: 'tank' },
    { x: 2100, type: 'spitter' }, // 침뱉기
    { x: 2300, type: 'fast' },
    { x: 2600, type: 'tank' },
    { x: 2750, type: 'bomber' },
    2900,
    { x: 3200, type: 'fast' },
    { x: 3400, type: 'spitter' },
    { x: 3650, type: 'tank' },
  ],

  treasures: [
    { id: 'stage3-ledge', x: 780, y: 300, xp: 40 },
    { id: 'stage3-peak', x: 1840, y: 130, xp: 60 },
    { id: 'stage3-ember', x: 3650, y: 300, xp: 50 },
  ],

  signs: [
    { x: 300, text: '스테이지 3: 용암 지대\n파란 뚱보는 아주 튼튼해!' },
    { x: 1980, text: '침뱉기 주의!\n침은 점프로 넘거나 대시로 뚫기' },
    { x: 4100, text: '보스 구역!\n땅이 울리면 점프!' },
  ],

  talks: [
    { x: 0, lines: ['으, 뜨거워! 신발 녹는 거 아니야?', '파란 뚱보는 튼튼해. 충전 펀치를 여러 번 먹여!'] },
    { x: 1250, lines: ['저 높은 곳까지 올라갈 수 있겠어?'] },
    { x: 1950, lines: ['저기 청록 녀석은 멀리서 침을 뱉어.', '볼이 부풀고 초록으로 깜빡이면 침이 날아와. 점프로 넘거나 대시로 뚫고 가!', '가까이 붙으면 약해!'] },
    { x: 3940, lines: ['체크포인트!', '이번 보스는 팔이 세 개야!', '땅이 울리면 점프로 충격파를 넘어!'] },
  ],

  arena: { startX: 4240, endX: 5200 },

  boss: {
    type: 'golem', // 보스 종류 (src/boss/index.js)
    name: '용암 돌연변이',
    arms: 3,
    healthScale: 1.3,
    speedScale: 0.95,
    rockBonus: 1, // 돌을 더 많이 떨굼
    colors: { main: 0xa83a1f, light: 0xd8602f, dark: 0x6a200f, arm: 0xc04a26 },
    // 팔이 3개라 [팔 3개, 2개, 1개, 0개(코어)] 네 단계
    phases: [
      ['slam', 'doubleSlam', 'shockwave'],
      ['doubleSlam', 'multiSlam', 'rocks'],
      ['sweep', 'multiSlam', 'shockwave'],
      ['rocks', 'shockwave', 'spit'],
    ],
  },
};
