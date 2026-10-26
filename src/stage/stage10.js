// =============================================================
//  스테이지 10: 어둠의 왕궁 (1장 마지막 스테이지, 다음은 2장)
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

export const stage10 = {
  name: '어둠의 왕궁',
  width: 6800,
  groundY: 480,
  playerStartX: 120,
  gateX: 5400,
  checkpointX: 5520,

  theme: {
    scenery: 'castle',
    sky: [0x020106, 0x2a0a3a], // 스테이지 5 보다 더 깜깜한 밤
    sun: 0xff4a6a, // 붉은 달
    far: 0x180a22,
    near: 0x0c0412,
    window: 0xff3a8a,
    ground: 0x9080a8,
    smoke: 0x2a1a3a,
    weather: { kind: 'embers', color: 0xb04aff },
  },

  platforms: [
    { x: 500, y: 390, w: 128 },
    { x: 680, y: 300, w: 96 },
    { x: 860, y: 210, w: 96 },
    { x: 1040, y: 120, w: 96 },
    { x: 1600, y: 390, w: 128 },
    { x: 1780, y: 300, w: 96 },
    { x: 1960, y: 210, w: 96 },
    { x: 2140, y: 120, w: 96 },
    { x: 2700, y: 380, w: 192 },
    { x: 2890, y: 290, w: 96 },
    { x: 3070, y: 200, w: 96 },
    { x: 3250, y: 110, w: 128 },
    { x: 3800, y: 390, w: 128 },
    { x: 3980, y: 300, w: 96 },
    { x: 4160, y: 210, w: 96 },
    { x: 4340, y: 120, w: 96 },
    { x: 4800, y: 390, w: 128 },
    { x: 4980, y: 300, w: 96 },
    { x: 5160, y: 210, w: 128 },
  ],

  monsters: [
    800,
    { x: 1000, type: 'fast' },
    { x: 1150, type: 'shield' },
    { x: 1350, type: 'spitter' },
    { x: 1500, type: 'fros' },
    { x: 1700, type: 'tank' },
    { x: 1900, type: 'jumper' },
    { x: 2100, type: 'fast' },
    { x: 2300, type: 'shield' },
    { x: 2500, type: 'fros' },
    { x: 2700, y: 380, type: 'jumper' },
    { x: 2950, type: 'spitter' },
    { x: 3150, type: 'tank' },
    { x: 3400, type: 'fast' },
    { x: 3600, type: 'shield' },
    { x: 3800, type: 'fros' },
    { x: 4000, type: 'jumper' },
    { x: 4250, type: 'spitter' },
    { x: 4500, type: 'tank' },
    { x: 4750, type: 'shield' },
    { x: 5000, type: 'fast' },
    { x: 5250, type: 'jumper' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage10-crown', power: 'star' },
    { id: 'stage10-scepter', power: 'power' },
    { id: 'stage10-mirror' },
    { id: 'stage10-chandelier', power: 'rapid' },
    { id: 'stage10-vault' },
    { id: 'stage10-gem', power: 'shield' },
  ],

  signs: [
    { x: 300, text: '스테이지 10: 어둠의 왕궁\n1장 마지막 싸움!' },
    { x: 5750, text: '모든 괴물의 주인이\n기다리고 있다...' },
  ],

  talks: [
    { x: 0, lines: ['여기가 1장 마지막이야. 어둠의 왕궁!', '모든 몬스터가 가장 세게 나와. 서두르지 말고 하나씩!'] },
    { x: 1500, lines: ['왕궁 탑 꼭대기마다 보물이 숨어 있을지도 몰라!'] },
    { x: 3000, lines: ['힘들면 보물 상자의 힘을 써! 별을 먹으면 잠깐 무적이야.'] },
    { x: 5520, lines: ['1장 마지막 체크포인트!', '그림자 황제는 킹 돌연변이보다 훨씬 빠르고 부하도 더 많이 불러.', '팔을 다 부수면 일어나서 뛰어다닐 거야. 끝까지 가자, 히어로!'] },
  ],

  arena: { startX: 5840, endX: 6800 },


  boss: {
    type: 'king', // 왕좌에 앉은 왕 (src/boss/KingBoss.js)
    name: '그림자 황제',
    arms: 3,
    healthScale: 2.1,
    speedScale: 0.75,
    rockBonus: 3,
    shockwaves: 3,
    colors: { main: 0x2a1a4a, light: 0x4a2a7a, dark: 0x140a26, arm: 0x3a2a6a },
    minions: ['fast', 'jumper', 'shield', 'spitter'],
    // [팔 다 있을 때, 팔 1개 부순 뒤, 팔 2개 부순 뒤] 앉아서 쓰는 공격
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'summon', 'spit', 'shockwave'],
      ['multiSlam', 'doubleSlam', 'sweep', 'rocketPunch', 'inhale', 'summon'],
      ['multiSlam', 'rocketPunch', 'inhale', 'rocks', 'spit', 'summon', 'sweep'],
    ],
    // 팔을 다 부수면 왕좌에서 일어나서 쓰는 공격
    finalPhase: ['leap', 'charge', 'inhale', 'summon', 'rocks', 'leap'],
  },
};
