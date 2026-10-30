// =============================================================
//  스테이지 29: 불비 계곡 (3장)
//  하늘에서 불비가 내리는 계곡. 큰 계단과 다리가 번갈아 나온다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage3 } from './stage3.js';

export const stage29 = {
  name: '불비 계곡',
  chapter: 3, // 지도 3장
  width: 8740,
  groundY: 480,
  playerStartX: 120,
  gateX: 7340,
  checkpointX: 7460,

  // 1장 스테이지 3 용암 배경에 먹구름을 덮음
  theme: { ...stage3.theme, sky: [0x200806, 0xa84a1a], weather: { kind: 'embers', color: 0xff8a3a }, tint: { color: 0x102a5a, alpha: 0.34 } },

  platforms: [
    { x: 520, y: 390, w: 192 },
    { x: 670, y: 300, w: 192 },
    { x: 820, y: 210, w: 192 },
    { x: 1200, y: 390, w: 128 },
    { x: 1370, y: 300, w: 128 },
    { x: 1576, y: 300, w: 128 },
    { x: 1780, y: 300, w: 128 },
    { x: 1984, y: 300, w: 128 },
    { x: 2300, y: 390, w: 192 },
    { x: 2452, y: 300, w: 192 },
    { x: 2600, y: 210, w: 192 },
    { x: 2980, y: 380, w: 192 },
    { x: 3360, y: 390, w: 128 },
    { x: 3532, y: 300, w: 128 },
    { x: 3736, y: 300, w: 128 },
    { x: 3940, y: 300, w: 128 },
    { x: 4146, y: 300, w: 128 },
    { x: 4462, y: 390, w: 192 },
    { x: 4612, y: 300, w: 192 },
    { x: 4762, y: 210, w: 192 },
    { x: 5142, y: 390, w: 128 },
    { x: 5312, y: 300, w: 96 },
    { x: 5482, y: 210, w: 128 },
    { x: 5688, y: 210, w: 128 },
    { x: 5892, y: 210, w: 128 },
    { x: 6208, y: 380, w: 192 },
    { x: 6588, y: 390, w: 192 },
    { x: 6738, y: 300, w: 192 },
    { x: 6888, y: 210, w: 192 },
  ],

  monsters: [
    { x: 800, type: 'spitter' },
    { x: 1030, type: 'fros' },
    { x: 1190, type: 'tank' },
    { x: 1410, type: 'fast' },
    { x: 1570, type: 'shield' },
    { x: 1800, type: 'jumper' },
    { x: 1960, type: 'spitter' },
    { x: 2190, type: 'spitter' },
    { x: 2350, type: 'fros' },
    { x: 2570, type: 'tank' },
    { x: 2740, type: 'fast' },
    { x: 2960, type: 'shield' },
    { x: 2980, y: 380, type: 'spitter' },
    { x: 3120, type: 'jumper' },
    { x: 3350, type: 'spitter' },
    { x: 3510, type: 'spitter' },
    { x: 3740, type: 'fros' },
    { x: 3900, type: 'tank' },
    { x: 4120, type: 'fast' },
    { x: 4280, type: 'shield' },
    { x: 4510, type: 'jumper' },
    { x: 4670, type: 'spitter' },
    { x: 4900, type: 'spitter' },
    { x: 5060, type: 'fros' },
    { x: 5280, type: 'tank' },
    { x: 5450, type: 'fast' },
    { x: 5670, type: 'shield' },
    { x: 5830, type: 'jumper' },
    { x: 6060, type: 'spitter' },
    { x: 6208, y: 380, type: 'tank' },
    { x: 6220, type: 'spitter' },
    { x: 6450, type: 'fros' },
    { x: 6610, type: 'tank' },
    { x: 6830, type: 'fast' },
    { x: 6990, type: 'shield' },
    { x: 7220, type: 'jumper' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage29-flame', power: 'rapid' },
    { id: 'stage29-lavarock' },
    { id: 'stage29-meteor', power: 'power' },
    { id: 'stage29-bridgepiece' },
    { id: 'stage29-sunstone', power: 'shield' },
    { id: 'stage29-smoke' },
    { id: 'stage29-phoenix', power: 'star' },
    { id: 'stage29-scorch' },
    { id: 'stage29-dragonscale', power: 'speed' },
  ],

  signs: [
    { x: 300, text: '스테이지 29: 불비 계곡\n3장, 폭풍의 땅!' },
    { x: 7690, text: '보스 불비의 아스트라노바X\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['불비가 내려! 폭풍이 불까지 끌고 왔어.', '침뱉기와 프로스가 멀리서 쏘아 대. 멈추지 말고 달려!'] },
    { x: 3800, lines: ['거의 다 왔어. 폭풍의 문이 멀지 않아!'] },
    { x: 7460, lines: ['체크포인트!', '불비의 아스트라노바X가 하늘을 막고 있어!', '불기둥이 솟는 자리를 잘 보고 피해!'] },
  ],

  arena: { startX: 7780, endX: 8740 },

  boss: {
    type: 'dragon',
    name: '불비의 아스트라노바X',
    skin: 3,
    healthScale: 2.1,
    speedScale: 0.74,
    colors: { main: 0xd84a1a, dark: 0x8a2410, armor: 0x3a2a24, lava: 0xffc23a, belly: 0xf8e0a8 },
    phases: [
      ['pillars', 'breath', 'fly', 'wing', 'pillars'],
      ['fly', 'pillars', 'breath', 'tail', 'wing'],
      ['pillars', 'fly', 'breath', 'pillars', 'tail'],
    ],
    intro: ['하늘에서 불기둥이 쏟아져!', '꼬리와 날개를 먼저 부수면 훨씬 쉬워!'],
  },
};
