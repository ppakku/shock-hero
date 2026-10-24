// =============================================================
//  스테이지 2: 독 공장
// =============================================================

export const stage2 = {
  name: '독 공장',
  width: 4800,
  groundY: 480,
  playerStartX: 120,
  gateX: 3420,
  checkpointX: 3540,

  theme: {
    sky: [0x10261c, 0x5d8a3a],
    sun: 0xc8ff7a,
    far: 0x1f3a2a,
    near: 0x122219,
    window: 0xa6ff5c,
    ground: 0xb0d8a0,
    smoke: 0x5f8f4a,
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
    2400,
    { x: 2800, type: 'fast' },
    3000,
    { x: 3250, type: 'fast' },
  ],

  treasures: [
    { id: 'stage2-pipe', x: 880, y: 210, xp: 40 },
    { id: 'stage2-tower', x: 2640, y: 150, xp: 60 },
    { id: 'stage2-tank', x: 3180, y: 390, xp: 30 },
  ],

  signs: [
    { x: 300, text: '스테이지 2: 독 공장\n빨간 몬스터는 아주 빨라!' },
    { x: 3700, text: '보스 구역!\n독침을 조심해' },
  ],

  talks: [
    { x: 0, lines: ['여긴 독 공장이야. 냄새 진짜 고약하다...', '빨간 녀석은 빠르니까 공격 신호를 잘 봐!'] },
    { x: 1850, lines: ['몬스터를 다 잡아야 보스 문이 열려. 하나도 놓치지 마!'] },
    { x: 2150, lines: ['위로 계속 올라가면 뭔가 있을 것 같은데?'] },
    { x: 3540, lines: ['체크포인트!', '이번 보스는 독침을 뱉어. 멈추지 말고 계속 움직여!'] },
  ],

  arena: { startX: 3840, endX: 4800 },

  boss: {
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
