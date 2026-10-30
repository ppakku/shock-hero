// =============================================================
//  스테이지 26: 소용돌이 해구 (3장, 헤엄치는 스테이지)
//  피라냐가 떼로 몰려다니고 꽃게가 바닥을 지키는 바다. 낮은 바위 사이를 헤엄친다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage6 } from './stage6.js';

export const stage26 = {
  name: '소용돌이 해구',
  chapter: 3, // 지도 3장
  width: 8000,
  groundY: 480,
  playerStartX: 120,
  gateX: 6600,
  checkpointX: 6720,
  swim: true, // 헤엄치기

  // 1장 스테이지 6 물속 배경을 쓰고 물빛만 바꿈
  theme: { ...stage6.theme, sky: [0x021028, 0x0a3a70], weather: null },

  platforms: [
    { x: 520, y: 390, w: 96 },
    { x: 684, y: 300, w: 96 },
    { x: 850, y: 390, w: 96 },
    { x: 1016, y: 300, w: 96 },
    { x: 1202, y: 380, w: 192 },
    { x: 1484, y: 390, w: 128 },
    { x: 1664, y: 300, w: 128 },
    { x: 1844, y: 210, w: 128 },
    { x: 2064, y: 390, w: 128 },
    { x: 2234, y: 300, w: 128 },
    { x: 2440, y: 300, w: 128 },
    { x: 2644, y: 300, w: 128 },
    { x: 2848, y: 300, w: 128 },
    { x: 3068, y: 390, w: 96 },
    { x: 3232, y: 300, w: 96 },
    { x: 3398, y: 390, w: 96 },
    { x: 3564, y: 300, w: 96 },
    { x: 3728, y: 390, w: 96 },
    { x: 3916, y: 380, w: 192 },
    { x: 4198, y: 390, w: 128 },
    { x: 4368, y: 300, w: 96 },
    { x: 4538, y: 210, w: 128 },
    { x: 4744, y: 210, w: 128 },
    { x: 4948, y: 210, w: 128 },
    { x: 5168, y: 390, w: 96 },
    { x: 5332, y: 300, w: 96 },
    { x: 5496, y: 390, w: 96 },
    { x: 5662, y: 300, w: 96 },
    { x: 5848, y: 390, w: 128 },
    { x: 6028, y: 300, w: 128 },
    { x: 6208, y: 210, w: 128 },
  ],

  monsters: [
    { x: 800, y: 340, type: 'piranha' },
    { x: 880, y: 300, type: 'piranha' },
    { x: 960, y: 380, type: 'piranha' },
    { x: 1260, type: 'crab' },
    { x: 1440, y: 260, type: 'jelly' },
    { x: 1640, y: 340, type: 'puffer' },
    { x: 1720, type: 'crab' },
    { x: 1800, y: 420, type: 'piranha' },
    { x: 2100, y: 260, type: 'piranha' },
    { x: 2280, y: 380, type: 'jelly' },
    { x: 2480, y: 340, type: 'piranha' },
    { x: 2560, y: 300, type: 'piranha' },
    { x: 2640, y: 380, type: 'piranha' },
    { x: 2940, type: 'crab' },
    { x: 3120, y: 260, type: 'jelly' },
    { x: 3320, y: 340, type: 'puffer' },
    { x: 3400, type: 'crab' },
    { x: 3480, y: 420, type: 'piranha' },
    { x: 3780, y: 260, type: 'piranha' },
    { x: 3960, y: 380, type: 'jelly' },
    { x: 4160, y: 340, type: 'piranha' },
    { x: 4240, y: 300, type: 'piranha' },
    { x: 4320, y: 380, type: 'piranha' },
    { x: 4620, type: 'crab' },
    { x: 4800, y: 260, type: 'jelly' },
    { x: 5000, y: 340, type: 'puffer' },
    { x: 5080, type: 'crab' },
    { x: 5170, y: 420, type: 'piranha' },
    { x: 5460, y: 260, type: 'piranha' },
    { x: 5640, y: 380, type: 'jelly' },
    { x: 5840, y: 340, type: 'piranha' },
    { x: 5920, y: 300, type: 'piranha' },
    { x: 6010, y: 380, type: 'piranha' },
    { x: 6300, type: 'crab' },
    { x: 6480, y: 260, type: 'jelly' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage26-shell', power: 'speed' },
    { id: 'stage26-pearl' },
    { id: 'stage26-coral', power: 'shield' },
    { id: 'stage26-anchor' },
    { id: 'stage26-compass', power: 'power' },
    { id: 'stage26-bottle' },
    { id: 'stage26-whirl', power: 'star' },
    { id: 'stage26-trident' },
    { id: 'stage26-buoy' },
  ],

  signs: [
    { x: 300, text: '스테이지 26: 소용돌이 해구\n3장, 폭풍의 땅!' },
    { x: 6950, text: '보스 소용돌이 아귀왕\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['폭풍이 바닷속까지 휘저어. {jump} 키로 헤엄쳐!', '피라냐는 떼로 와. 빨간 점선 밖으로 비켜!'] },
    { x: 3200, lines: ['꽃게가 바닥을 막고 있어. 위로 헤엄쳐 피한 다음 때려!'] },
    { x: 6720, lines: ['체크포인트!', '소용돌이 아귀왕이 물살을 일으키고 있어!', '초롱불과 턱을 부수면 심장이 드러나!'] },
  ],

  arena: { startX: 7040, endX: 8000 },

  boss: {
    type: 'sea',
    name: '소용돌이 아귀왕',
    skin: 6,
    healthScale: 1.9,
    speedScale: 0.8,
    colors: { main: 0x1e4a7a, light: 0x3a7ab8, dark: 0x0e2440, belly: 0x90c0d8, lure: 0x8af0ff },
    phases: [
      ['whirlpool', 'charge', 'bubbles', 'ink', 'sweep'],
      ['charge', 'whirlpool', 'bubbles', 'sweep', 'ink'],
      ['whirlpool', 'charge', 'sweep', 'bubbles', 'whirlpool'],
    ],
  },
};
