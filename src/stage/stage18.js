// =============================================================
//  스테이지 18: 용의 둥지 (2장)
//  1장 스테이지 3 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage3 } from './stage3.js';

export const stage18 = {
  name: '용의 둥지',
  chapter: 2, // 지도 2장
  width: 7580,
  groundY: 480,
  playerStartX: 120,
  gateX: 6180,
  checkpointX: 6300,

  // 1장 스테이지 3 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage3.theme, sky: [0x180202, 0xa02008], weather: { kind: 'embers', color: 0xff5a1a } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 96 },
    { x: 880, y: 210, w: 96 },
    { x: 1060, y: 120, w: 128 },
    { x: 1285, y: 390, w: 128 },
    { x: 1465, y: 300, w: 128 },
    { x: 1645, y: 210, w: 128 },
    { x: 1790, y: 380, w: 192 },
    { x: 1825, y: 120, w: 128 },
    { x: 2050, y: 390, w: 128 },
    { x: 2230, y: 300, w: 128 },
    { x: 2410, y: 210, w: 96 },
    { x: 2590, y: 120, w: 128 },
    { x: 2815, y: 390, w: 128 },
    { x: 2995, y: 300, w: 96 },
    { x: 3175, y: 210, w: 128 },
    { x: 3320, y: 380, w: 192 },
    { x: 3355, y: 120, w: 128 },
    { x: 3580, y: 390, w: 128 },
    { x: 3760, y: 300, w: 96 },
    { x: 3940, y: 210, w: 96 },
    { x: 4120, y: 120, w: 128 },
    { x: 4345, y: 390, w: 128 },
    { x: 4525, y: 300, w: 96 },
    { x: 4705, y: 210, w: 128 },
    { x: 4850, y: 380, w: 192 },
    { x: 5110, y: 390, w: 128 },
    { x: 5290, y: 300, w: 128 },
    { x: 5470, y: 210, w: 128 },
    { x: 5650, y: 120, w: 128 },
  ],

  monsters: [
    800,
    { x: 990, type: 'fast' },
    { x: 1180, type: 'shield' },
    { x: 1360, type: 'spitter' },
    { x: 1550, type: 'fros' },
    { x: 1790, y: 380, type: 'jumper' },
    { x: 1930, type: 'tank' },
    { x: 2120, type: 'fast' },
    { x: 2300, type: 'shield' },
    { x: 2490, type: 'spitter' },
    { x: 2680, type: 'fros' },
    { x: 2870, type: 'jumper' },
    { x: 3050, type: 'tank' },
    { x: 3240, type: 'fast' },
    { x: 3430, type: 'shield' },
    { x: 3620, type: 'spitter' },
    { x: 3810, type: 'fros' },
    { x: 3990, type: 'jumper' },
    { x: 4180, type: 'tank' },
    { x: 4370, type: 'fast' },
    { x: 4560, type: 'shield' },
    { x: 4740, type: 'spitter' },
    { x: 4930, type: 'fros' },
    { x: 5120, type: 'jumper' },
    { x: 5310, type: 'tank' },
    { x: 5500, type: 'fast' },
    { x: 5680, type: 'shield' },
    { x: 5870, type: 'spitter' },
    { x: 6060, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage18-scale', power: 'speed' },
    { id: 'stage18-relic' },
    { id: 'stage18-mask', power: 'star' },
    { id: 'stage18-coin' },
    { id: 'stage18-shard', power: 'rapid' },
    { id: 'stage18-horn' },
    { id: 'stage18-pearl', power: 'power' },
    { id: 'stage18-frost' },
  ],

  signs: [
    { x: 300, text: '스테이지 18: 용의 둥지\n2장, 더 강해진 적들!' },
    { x: 6530, text: '보스 둥지의 아스트라노바X\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['용의 둥지야. 바위 탑 꼭대기에 보물이 숨어 있을 거야!'] },
    { x: 6300, lines: ['체크포인트!', '이번 보스는 둥지의 아스트라노바X! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 6620, endX: 7580 },

  boss: {
    type: 'dragon',
    name: '둥지의 아스트라노바X',
    skin: 'rock',
    healthScale: 1.9,
    speedScale: 0.72,
    colors: { main: 0xc8282a, dark: 0x7a1418, armor: 0x2e2a2c, lava: 0xff7a1f, belly: 0xf0d0a0 },
    phases: [
      ['breath', 'fly', 'wing', 'pillars', 'tail'],
      ['breath', 'pillars', 'fly', 'wing', 'pillars'],
      ['breath', 'pillars', 'fly', 'tail', 'fly'],
    ],
    intro: ['여기가 아스트라노바X의 둥지야!', '불길은 점프로, 날개 바람은 앞으로 걸어서 버텨!'],
  },
};
