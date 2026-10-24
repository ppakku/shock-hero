// =============================================================
//  스테이지 2: 독 숲 (보스: 포레스트 와처, 아들이 디자인)
// =============================================================

export const stage2 = {
  name: '독 숲',
  width: 4800,
  groundY: 480,
  playerStartX: 120,
  gateX: 3420,
  checkpointX: 3540,

  theme: {
    scenery: 'forest', // 배경을 건물 대신 나무로
    sky: [0x0c1a10, 0x3f5a2a],
    sun: 0xe8ffb0, // 흐린 달
    far: 0x1c2e1a,
    near: 0x0f1a0e,
    window: 0xd4ff3a, // 반딧불 색
    ground: 0x9a8a6a,
    platform: 0x8a7050, // 발판 색 (나무 느낌)
    smoke: 0x4f7a3a,
    weather: { kind: 'bubbles', color: 0x9cff6a },
  },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 128 },
    { x: 880, y: 210, w: 112 },
    { x: 1500, y: 380, w: 160 },
    { x: 2100, y: 390, w: 128 },
    { x: 2280, y: 310, w: 128 },
    { x: 2460, y: 230, w: 96 },
    { x: 2640, y: 150, w: 128 },
    { x: 3150, y: 390, w: 192 },
  ],

  monsters: [
    1000,
    { x: 1250, type: 'fast' },
    { x: 1500, y: 380 },
    1750,
    { x: 2000, type: 'fast' },
    { x: 2200, type: 'fros' }, // 프로스 (하늘을 나는 말벌)
    2400,
    { x: 2800, type: 'fast' },
    { x: 2950, type: 'fros' },
    3000,
    { x: 3250, type: 'fast' },
  ],

  treasures: [
    { id: 'stage2-pipe', x: 880, y: 210, xp: 40 },
    { id: 'stage2-tower', x: 2640, y: 150, xp: 60 },
    { id: 'stage2-tank', x: 3180, y: 390, xp: 30 },
  ],

  signs: [
    { x: 300, text: '스테이지 2: 독 숲\n빨간 몬스터는 아주 빨라!' },
    { x: 1880, text: '프로스 주의!\n보라 독과 독구름을 피하고 점프 펀치!' },
    { x: 3700, text: '보스 구역!\n독침을 조심해' },
  ],

  talks: [
    { x: 0, lines: ['여긴 독 숲이야. 나무에서 초록 독이 뚝뚝 떨어져...', '빨간 녀석은 빠르니까 공격 신호를 잘 봐!'] },
    { x: 1850, lines: ['몬스터를 다 잡아야 보스 문이 열려. 하나도 놓치지 마!'] },
    { x: 1960, lines: ['하늘에 프로스다! 엄청 큰 말벌이야.', '배를 앞으로 구부리고 보라색으로 빛나면 맹독을 쏴. 점선이 가리키는 곳에서 비켜!', '독이 떨어진 곳엔 독구름이 잠깐 남아. 안에 있으면 체력이 조금씩 깎이니까 피하거나 대시로 지나가!', '독을 쏜 뒤엔 낮게 내려와 쉬어. 점프 펀치나 위쪽 공격({up} 누른 채 {punch})으로 잡아!'] },
    { x: 2150, lines: ['위로 계속 올라가면 뭔가 있을 것 같은데?'] },
    { x: 3540, lines: ['체크포인트!', '이번 보스는 독침을 뱉어. 멈추지 말고 계속 움직여!'] },
  ],

  arena: { startX: 3840, endX: 4800 },

  boss: {
    type: 'toad', // 보스 종류 (src/boss/index.js)
    name: '독침 돌연변이',
    arms: 2,
    healthScale: 1.2,
    speedScale: 0.95,
    colors: { main: 0x2f7a2f, light: 0x4fae4f, dark: 0x1d4d1d, arm: 0x3f9a3f },
    phases: [
      ['slam', 'spit', 'doubleSlam'],
      ['sweep', 'spit', 'multiSlam'],
      ['rocks', 'spit', 'shockwave'],
    ],
  },
};
