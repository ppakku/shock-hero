// =============================================================
//  스테이지 5: 괴물 성 (마지막 스테이지)
// =============================================================

export const stage5 = {
  name: '괴물 성',
  width: 5800,
  groundY: 480,
  playerStartX: 120,
  gateX: 4420,
  checkpointX: 4540,

  theme: {
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
    { x: 1300, type: 'bomber' },
    { x: 1500, type: 'jumper' },
    { x: 2000, type: 'tank' },
    { x: 2200, type: 'fast' },
    { x: 2500, y: 380, type: 'jumper' },
    { x: 2800, type: 'shield' },
    { x: 3000, type: 'tank' },
    { x: 3150, type: 'bomber' },
    { x: 3300, type: 'jumper' },
    { x: 3700, type: 'spitter' },
    { x: 4000, type: 'tank' },
    { x: 4250, type: 'shield' },
  ],

  treasures: [
    { id: 'stage5-tower', x: 1920, y: 80, xp: 80 },
    { id: 'stage5-hall', x: 3280, y: 300, xp: 50 },
    { id: 'stage5-throne', x: 4160, y: 210, xp: 60 },
  ],

  signs: [
    { x: 300, text: '스테이지 5: 괴물 성\n마지막 싸움!' },
    { x: 4700, text: '괴물들의 왕이\n기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['여기가 괴물들의 성이야.', '모든 몬스터가 다 나와. 지금까지 배운 걸 다 써!'] },
    { x: 1150, lines: ['탑 꼭대기까지 올라가면 큰 보물이 있대!'] },
    { x: 2650, lines: ['방패병, 폭탄벌레, 침뱉기까지 다 모였어.', '빨간 원은 피하고, 침은 넘고, 방패는 충전 펀치로!'] },
    { x: 4540, lines: ['마지막 체크포인트!', '킹 돌연변이는 모든 공격을 다 써.', '우린 할 수 있어. 가자, 히어로!'] },
  ],

  arena: { startX: 4840, endX: 5800 },

  boss: {
    type: 'king', // 보스 종류 (src/boss/index.js)
    name: '킹 돌연변이',
    arms: 3,
    healthScale: 1.8,
    speedScale: 0.85,
    rockBonus: 2,
    shockwaves: 2,
    crown: true,
    colors: { main: 0x5a1a2a, light: 0x8a2a3a, dark: 0x30101a, arm: 0x7a2a3a },
    phases: [
      ['slam', 'doubleSlam', 'multiSlam', 'spit'],
      ['doubleSlam', 'sweep', 'shockwave', 'rocks'],
      ['sweep', 'multiSlam', 'spit', 'shockwave'],
      ['rocks', 'shockwave', 'spit'],
    ],
  },
};
