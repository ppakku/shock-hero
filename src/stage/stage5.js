// =============================================================
//  스테이지 5: 괴물 성 (다음은 스테이지 6 수중 던전)
// =============================================================

export const stage5 = {
  name: '괴물 성',
  width: 5800,
  groundY: 480,
  playerStartX: 120,
  gateX: 4420,
  checkpointX: 4540,

  theme: {
    scenery: 'castle', // 배경 모양
    sky: [0x08040f, 0x4a1a5a],
    sun: 0xd8d8ff, // 달
    far: 0x24102e,
    near: 0x140818,
    window: 0xff5ad5,
    ground: 0xa898c0,
    smoke: 0x3a2a4a,
    weather: { kind: 'embers', color: 0xff5ad5 },
  },

  platforms: [
    { x: 500, y: 390, w: 128 },
    { x: 680, y: 300, w: 128 },
    { x: 1200, y: 390, w: 128 },
    { x: 1380, y: 310, w: 96 },
    { x: 1560, y: 230, w: 96 },
    { x: 1740, y: 150, w: 96 },
    { x: 1920, y: 80, w: 128 },
    { x: 2500, y: 380, w: 192 },
    { x: 3100, y: 390, w: 128 },
    { x: 3280, y: 300, w: 128 },
    { x: 3800, y: 390, w: 128 },
    { x: 3980, y: 300, w: 96 },
    { x: 4160, y: 210, w: 128 },
  ],

  monsters: [
    900,
    { x: 1100, type: 'fast' },
    { x: 1300, type: 'fros' },
    { x: 1500, type: 'jumper' },
    { x: 2000, type: 'tank' },
    { x: 2200, type: 'fast' },
    { x: 2500, y: 380, type: 'jumper' },
    { x: 2800, type: 'shield' },
    { x: 3000, type: 'tank' },
    { x: 3300, type: 'jumper' },
    { x: 3480, type: 'fros' },
    { x: 3700, type: 'spitter' },
    { x: 4000, type: 'tank' },
    { x: 4250, type: 'shield' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage5-tower', power: 'rapid' },
    { id: 'stage5-hall' },
    { id: 'stage5-throne', power: 'star' },
    { id: 'stage5-dungeon' },
  ],

  signs: [
    { x: 300, text: '스테이지 5: 괴물 성\n왕과의 싸움!' },
    { x: 4700, text: '괴물들의 왕이\n왕좌에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['여기가 괴물들의 성이야.', '모든 몬스터가 다 나와. 지금까지 배운 걸 다 써!'] },
    { x: 1150, lines: ['탑 꼭대기에도 보물이 있을지 몰라!'] },
    { x: 2650, lines: ['방패병, 프로스, 침뱉기까지 다 모였어.', '보라 독구름은 피하고, 침은 넘고, 방패는 충전 펀치로!'] },
    { x: 4540, lines: ['마지막 체크포인트!', '킹 돌연변이는 부하도 부르고 주먹도 날려.', '팔을 다 부수면 일어나서 뛰어다닐 거야. 끝까지 가자, 히어로!'] },
  ],

  arena: { startX: 4840, endX: 5800 },

  boss: {
    type: 'king', // 보스 종류 (src/boss/index.js): 왕좌에 앉은 왕
    name: '킹 돌연변이',
    arms: 3, // 팔 개수 (2 또는 3)
    healthScale: 1.5, // 체력 배수 (balance.js 보스 체력에 곱함)
    speedScale: 0.85, // 공격 속도 (작을수록 빠름)
    rockBonus: 2, // 돌 떨구기 때 더 떨어지는 돌
    shockwaves: 2, // 충격파 개수
    colors: { main: 0x5a1a2a, light: 0x8a2a3a, dark: 0x30101a, arm: 0x7a2a3a },
    minions: ['basic', 'fast', 'jumper'], // 부를 수 있는 부하 종류
    // [팔 다 있을 때, 팔 1개 부순 뒤, 팔 2개 부순 뒤] 앉아서 쓰는 공격
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'summon', 'spit'],
      ['multiSlam', 'sweep', 'rocketPunch', 'inhale', 'summon', 'shockwave'],
      ['rocketPunch', 'inhale', 'rocks', 'spit', 'summon', 'sweep'],
    ],
    // 팔을 다 부수면 왕좌에서 일어나서 쓰는 공격
    // leap(뛰어 내려찍기), charge(돌진), inhale(빨아들이기), summon(부하 부르기), rocks(돌 떨구기)
    finalPhase: ['leap', 'charge', 'inhale', 'summon', 'rocks'],
  },
};
