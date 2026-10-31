// =============================================================
//  스테이지 14: 눈보라 고원 (2장)
//  1장 스테이지 4 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage4 } from './stage4.js';

export const stage14 = {
  name: '눈보라 고원',
  chapter: 2, // 지도 2장
  width: 7020,
  groundY: 480,
  playerStartX: 120,
  gateX: 5620,
  checkpointX: 5740,

  // 1장 스테이지 4 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage4.theme, sky: [0x101830, 0x7090b8], weather: { kind: 'snow', color: 0xffffff } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 96 },
    { x: 880, y: 210, w: 128 },
    { x: 1060, y: 120, w: 128 },
    { x: 1320, y: 390, w: 128 },
    { x: 1500, y: 300, w: 128 },
    { x: 1680, y: 210, w: 128 },
    { x: 1860, y: 380, w: 192 },
    { x: 2120, y: 390, w: 128 },
    { x: 2300, y: 300, w: 96 },
    { x: 2480, y: 210, w: 128 },
    { x: 2660, y: 120, w: 128 },
    { x: 2920, y: 390, w: 128 },
    { x: 3100, y: 300, w: 96 },
    { x: 3280, y: 210, w: 128 },
    { x: 3460, y: 380, w: 192 },
    { x: 3720, y: 390, w: 128 },
    { x: 3900, y: 300, w: 96 },
    { x: 4080, y: 210, w: 96 },
    { x: 4260, y: 120, w: 128 },
    { x: 4520, y: 390, w: 128 },
    { x: 4700, y: 300, w: 128 },
    { x: 4880, y: 210, w: 128 },
    { x: 5060, y: 120, w: 128 },
  ],

  monsters: [
    800,
    { x: 1000, type: 'jumper' },
    { x: 1190, type: 'tank' },
    { x: 1390, type: 'fast' },
    { x: 1580, type: 'shield' },
    { x: 1780, type: 'spitter' },
    { x: 1980, type: 'fros' },
    { x: 2170, type: 'jumper' },
    { x: 2370, type: 'tank' },
    { x: 2560, type: 'fast' },
    { x: 2760, type: 'shield' },
    { x: 2950, type: 'spitter' },
    { x: 3150, type: 'fros' },
    { x: 3350, type: 'jumper' },
    { x: 3540, type: 'tank' },
    { x: 3740, type: 'fast' },
    { x: 3930, type: 'shield' },
    { x: 4130, type: 'spitter' },
    { x: 4320, type: 'fros' },
    { x: 4520, type: 'jumper' },
    { x: 4720, type: 'tank' },
    { x: 4910, type: 'fast' },
    { x: 5110, type: 'shield' },
    { x: 5300, type: 'spitter' },
    { x: 5500, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage14-gear', power: 'star' },
    { id: 'stage14-mask' },
    { id: 'stage14-lamp', power: 'rapid' },
    { id: 'stage14-bell' },
    { id: 'stage14-moss', power: 'power' },
    { id: 'stage14-horn' },
    { id: 'stage14-scale', power: 'shield' },
  ],

  signs: [
    { x: 300, text: '스테이지 14: 눈보라 고원\n2장, 더 강해진 적들!' },
    { x: 5970, text: '보스 눈보라의 아스트라\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['눈보라 때문에 앞이 잘 안 보여. 하늘의 프로스를 조심해!'] },
    { x: 5740, lines: ['체크포인트!', '이번 보스는 눈보라의 아스트라! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 6060, endX: 7020 },

  boss: {
    type: 'ice',
    name: '눈보라의 아스트라',
    skin: 'blizzard',
    healthScale: 2.1,
    speedScale: 0.78,
    colors: { bright: 0x3d9be0, main: 0x2a5fa8, dark: 0x1a2552, pale: 0xc4cee0, light: 0xd8f6ff },
    phases: [
      ['freezeBreath', 'dive', 'avalanche', 'icicles', 'dive'],
      ['dive', 'freezeBreath', 'avalanche', 'icicles', 'avalanche'],
      ['hop', 'freezeBreath', 'avalanche', 'hop'],
    ],
  },
};
