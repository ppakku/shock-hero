// =============================================================
//  스테이지 16: 심해 협곡 (2장, 헤엄치는 스테이지)
//  1장 스테이지 6 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage6 } from './stage6.js';

export const stage16 = {
  name: '심해 협곡',
  chapter: 2, // 지도 2장
  width: 7300,
  groundY: 480,
  playerStartX: 120,
  gateX: 5900,
  checkpointX: 6020,
  swim: true, // 헤엄치기

  // 1장 스테이지 6 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage6.theme, sky: [0x021820, 0x0a4050], weather: null },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 128 },
    { x: 880, y: 210, w: 128 },
    { x: 1366, y: 390, w: 128 },
    { x: 1546, y: 300, w: 96 },
    { x: 1726, y: 210, w: 128 },
    { x: 1952, y: 380, w: 192 },
    { x: 2212, y: 390, w: 128 },
    { x: 2392, y: 300, w: 96 },
    { x: 2572, y: 210, w: 128 },
    { x: 3058, y: 390, w: 128 },
    { x: 3238, y: 300, w: 96 },
    { x: 3418, y: 210, w: 128 },
    { x: 3644, y: 380, w: 192 },
    { x: 3904, y: 390, w: 128 },
    { x: 4084, y: 300, w: 96 },
    { x: 4264, y: 210, w: 128 },
    { x: 4750, y: 390, w: 128 },
    { x: 4930, y: 300, w: 128 },
    { x: 5110, y: 210, w: 128 },
  ],

  monsters: [
    { x: 800, y: 250, type: 'puffer' },
    { x: 990, y: 340, type: 'jelly' },
    { x: 1180, type: 'crab' },
    { x: 1370, y: 340, type: 'piranha' },
    { x: 1570, y: 340, type: 'puffer' },
    { x: 1760, y: 300, type: 'jelly' },
    { x: 1950, type: 'crab' },
    { x: 2140, y: 340, type: 'piranha' },
    { x: 2330, y: 340, type: 'puffer' },
    { x: 2520, y: 420, type: 'jelly' },
    { x: 2720, type: 'crab' },
    { x: 2910, y: 420, type: 'piranha' },
    { x: 3100, y: 420, type: 'puffer' },
    { x: 3290, y: 380, type: 'jelly' },
    { x: 3480, type: 'crab' },
    { x: 3670, y: 300, type: 'piranha' },
    { x: 3860, y: 300, type: 'puffer' },
    { x: 4060, y: 380, type: 'jelly' },
    { x: 4250, type: 'crab' },
    { x: 4440, y: 380, type: 'piranha' },
    { x: 4630, y: 380, type: 'puffer' },
    { x: 4820, y: 250, type: 'jelly' },
    { x: 5010, type: 'crab' },
    { x: 5210, y: 420, type: 'piranha' },
    { x: 5400, y: 380, type: 'puffer' },
    { x: 5590, y: 340, type: 'jelly' },
    { x: 5780, type: 'crab' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage16-pearl', power: 'power' },
    { id: 'stage16-crown' },
    { id: 'stage16-ember', power: 'shield' },
    { id: 'stage16-vine' },
    { id: 'stage16-lamp', power: 'speed' },
    { id: 'stage16-scale' },
    { id: 'stage16-mask', power: 'star' },
  ],

  signs: [
    { x: 300, text: '스테이지 16: 심해 협곡\n2장, 더 강해진 적들!' },
    { x: 6250, text: '보스 심연의 아귀왕\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['더 깊은 바다야! {jump} 로 헤엄쳐. 피라냐 떼를 조심해!'] },
    { x: 6020, lines: ['체크포인트!', '이번 보스는 심연의 아귀왕! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 6340, endX: 7300 },

  boss: {
    type: 'sea',
    name: '심연의 아귀왕',
    skin: 'ray',
    signature: 'shockRings',
    healthScale: 1.7,
    speedScale: 0.85,
    colors: { main: 0x2a4a6a, light: 0x4a7aa0, dark: 0x14263a, belly: 0x8ab0c0, lure: 0x9dff6a },
    phases: [
      ['charge', 'bubbles', 'signature', 'ink', 'whirlpool'],
      ['charge', 'signature', 'whirlpool', 'sweep', 'ink'],
      ['charge', 'bubbles', 'whirlpool', 'sweep', 'signature'],
    ],
  },
};
