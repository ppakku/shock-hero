// =============================================================
//  스테이지 7: 고철 공장 (파쇄자가 고쳐져서 더 세게 돌아왔다)
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

export const stage7 = {
  name: '고철 공장',
  width: 6000,
  groundY: 480,
  playerStartX: 120,
  gateX: 4600,
  checkpointX: 4720,

  theme: {
    sky: [0x1a1c22, 0x6a5a4a], // 매연 낀 하늘
    sun: 0xffb060,
    far: 0x30343c, // 먼 굴뚝과 공장
    near: 0x1c1f26,
    window: 0xffa040,
    ground: 0xc8c0b0,
    smoke: 0x4a4a50,
    weather: { kind: 'embers', color: 0xffb040 }, // 용접 불똥
  },

  platforms: [
    { x: 500, y: 390, w: 128 },
    { x: 690, y: 300, w: 96 },
    { x: 880, y: 210, w: 128 },
    { x: 1400, y: 390, w: 160 },
    { x: 1580, y: 300, w: 96 },
    { x: 1760, y: 210, w: 96 },
    { x: 1940, y: 120, w: 128 },
    { x: 2500, y: 380, w: 192 },
    { x: 3000, y: 390, w: 128 },
    { x: 3180, y: 300, w: 128 },
    { x: 3360, y: 210, w: 96 },
    { x: 3900, y: 390, w: 128 },
    { x: 4080, y: 300, w: 96 },
    { x: 4260, y: 210, w: 96 },
    { x: 4440, y: 130, w: 128 },
  ],

  monsters: [
    900,
    { x: 1100, type: 'fast' },
    { x: 1250, type: 'shield' },
    { x: 1450, type: 'fros' },
    { x: 1650, type: 'spitter' },
    { x: 1900, type: 'tank' },
    { x: 2150, type: 'jumper' },
    { x: 2350, type: 'fast' },
    { x: 2500, y: 380, type: 'jumper' },
    { x: 2750, type: 'shield' },
    { x: 2950, type: 'spitter' },
    { x: 3150, type: 'fros' },
    { x: 3400, type: 'tank' },
    { x: 3600, type: 'fast' },
    { x: 3800, type: 'jumper' },
    { x: 4050, type: 'shield' },
    { x: 4300, type: 'spitter' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage7-gear', power: 'power' },
    { id: 'stage7-bolt' },
    { id: 'stage7-chimney', power: 'shield' },
    { id: 'stage7-crate' },
    { id: 'stage7-furnace', power: 'rapid' },
  ],

  signs: [
    { x: 300, text: '스테이지 7: 고철 공장\n여기부터는 진짜 실력!' },
    { x: 4950, text: '멈췄던 기계가\n다시 돌아간다...' },
  ],

  talks: [
    { x: 0, lines: ['여긴 고철 공장이야. 쿵쾅쿵쾅 시끄러워!', '몬스터가 더 많고, 더 빨라졌어. 공격 신호를 잘 봐!'] },
    { x: 1300, lines: ['굴뚝 위까지 올라가 볼까? 보물이 숨어 있을지도!'] },
    { x: 2650, lines: ['방패병 뒤에 침뱉기가 숨어 있어. 하나씩 차근차근!'] },
    { x: 4720, lines: ['체크포인트!', '파쇄자가 고쳐져서 돌아왔어. 이번엔 팔이 세 개야!', '팔을 찍고 멈칫할 때 충전 펀치로 부숴!'] },
  ],

  arena: { startX: 5040, endX: 6000 },

  boss: {
    type: 'arms',
    name: '파쇄자 MK2', // 스테이지 1 파쇄자가 고쳐져서 더 세짐
    skin: 1, // 스테이지 1 파쇄자 그림을 그대로 씀 (art.js 의 _1 그림)
    arms: 3,
    healthScale: 1.9,
    speedScale: 0.9,
    rockBonus: 1,
    shockwaves: 2,
    colors: { main: 0x6e4232, light: 0x9a6a50, dark: 0x3a2a24, arm: 0x7a5444 },
    // [팔 다 있을 때, 1개 부순 뒤, 2개 부순 뒤, 다 부순 뒤(코어)]
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'sweep'],
      ['multiSlam', 'doubleSlam', 'rocketPunch', 'inhale'],
      ['multiSlam', 'sweep', 'rocketPunch', 'shockwave', 'rocks'],
      ['rocks', 'shockwave', 'inhale'],
    ],
  },
};
