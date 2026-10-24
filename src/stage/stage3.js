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
    scenery: 'volcano', // 배경 모양 (그림을 못 불러오면 이걸 그림)
    bgImage: { key: 'lava_bg', file: 'lava_bg.jpg' }, // 걸어가는 동안 배경 (아들 그림)
    arenaImage: { key: 'lava_arena', file: 'lava_arena.jpg' }, // 보스전 배경 (아들 그림)
    platform: 0x9a6a5a, // 발판 색 (그을린 바위 느낌)
    groundImage: { key: 'lava_ground', file: 'lava_ground.png', surface: 30 }, // 바닥 그림 (아들 그림, 좌우로 이어짐)
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
    { x: 2750, type: 'fros' },
    2900,
    { x: 3200, type: 'fast' },
    { x: 3400, type: 'spitter' },
    { x: 3650, type: 'tank' },
  ],

  // 보물: power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage3-ledge', x: 780, y: 300, power: 'shield' },
    { id: 'stage3-peak', x: 1840, y: 130 },
    { id: 'stage3-ember', x: 3650, y: 300, power: 'power' },
  ],

  signs: [
    { x: 300, text: '스테이지 3: 용암 지대\n파란 뚱보는 아주 튼튼해!' },
    { x: 1980, text: '침뱉기 주의!\n침은 점프로 넘거나 대시로 뚫기' },
    { x: 4100, text: '보스 구역!\n불길은 점프로 넘어!' },
  ],

  talks: [
    { x: 0, lines: ['으, 뜨거워! 신발 녹는 거 아니야?', '파란 뚱보는 튼튼해. 충전 펀치를 여러 번 먹여!'] },
    { x: 1250, lines: ['저 높은 곳까지 올라갈 수 있겠어?'] },
    { x: 1950, lines: ['저기 청록 녀석은 멀리서 침을 뱉어.', '볼이 부풀고 초록으로 깜빡이면 침이 날아와. 점프로 넘거나 대시로 뚫고 가!', '가까이 붙으면 약해!'] },
    { x: 3940, lines: ['체크포인트!', '이번 보스는 붉은 용 아스트라노바X야!', '땅을 훑는 불길은 점프로 넘고, 날개 바람은 앞으로 걸어서 버텨!'] },
  ],

  arena: { startX: 4240, endX: 5200 },

  boss: {
    type: 'dragon', // 보스 종류 (src/boss/index.js). 숫자는 balance.js 의 dragonBoss
    name: '아스트라노바X', // 아들이 디자인한 붉은 용
    healthScale: 1, // 체력 배수 (1.5 = 1.5배 튼튼)
    speedScale: 1, // 공격 속도 배수 (작을수록 빠름)
    colors: { main: 0xc8282a, dark: 0x7a1418, armor: 0x2e2a2c, lava: 0xff7a1f, belly: 0xf0d0a0 },
    // 공격: breath(불 뿜기), wing(날개 바람), tail(꼬리 휘두르기), fly(날아올라 불 폭격), pillars(용암 불기둥)
    // [꼬리와 날개가 다 있을 때, 하나 부서졌을 때, 둘 다 부서졌을 때]
    // fly 는 가끔만 나오게 목록에 한 번씩만 넣었어요
    phases: [
      ['breath', 'tail', 'wing', 'pillars'],
      ['breath', 'tail', 'wing', 'pillars', 'fly'],
      ['breath', 'tail', 'pillars', 'fly', 'wing'],
    ],
    intro: ['저건... 아스트라노바X! 용이다!', '꼬리가 땅에 떨어지거나 날개가 처지면 그때 때려!'],
  },
};
