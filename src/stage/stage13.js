// =============================================================
//  스테이지 13: 불타는 협곡 (2장)
//  1장 스테이지 3 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage3 } from './stage3.js';

export const stage13 = {
  name: '불타는 협곡',
  chapter: 2, // 지도 2장
  width: 6880,
  groundY: 480,
  playerStartX: 120,
  gateX: 5480,
  checkpointX: 5600,

  // 1장 스테이지 3 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage3.theme, sky: [0x200404, 0xc03010], weather: { kind: 'embers', color: 0xff7a2a } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 128 },
    { x: 880, y: 210, w: 96 },
    { x: 1060, y: 120, w: 128 },
    { x: 1452, y: 390, w: 128 },
    { x: 1632, y: 300, w: 96 },
    { x: 1812, y: 210, w: 96 },
    { x: 1992, y: 120, w: 128 },
    { x: 2124, y: 380, w: 192 },
    { x: 2384, y: 390, w: 128 },
    { x: 2564, y: 300, w: 128 },
    { x: 2744, y: 210, w: 96 },
    { x: 2924, y: 120, w: 128 },
    { x: 3316, y: 390, w: 128 },
    { x: 3496, y: 300, w: 128 },
    { x: 3676, y: 210, w: 128 },
    { x: 3988, y: 380, w: 192 },
    { x: 4248, y: 390, w: 128 },
    { x: 4428, y: 300, w: 128 },
    { x: 4608, y: 210, w: 128 },
  ],

  monsters: [
    800,
    { x: 1000, type: 'tank' },
    { x: 1200, type: 'fast' },
    { x: 1390, type: 'shield' },
    { x: 1590, type: 'spitter' },
    { x: 1790, type: 'fros' },
    { x: 1990, type: 'jumper' },
    { x: 2190, type: 'tank' },
    { x: 2390, type: 'fast' },
    { x: 2580, type: 'shield' },
    { x: 2780, type: 'spitter' },
    { x: 2980, type: 'fros' },
    { x: 3180, type: 'jumper' },
    { x: 3380, type: 'tank' },
    { x: 3580, type: 'fast' },
    { x: 3770, type: 'shield' },
    { x: 3988, y: 380, type: 'jumper' },
    { x: 4170, type: 'fros' },
    { x: 4370, type: 'jumper' },
    { x: 4570, type: 'tank' },
    { x: 4770, type: 'fast' },
    { x: 4960, type: 'shield' },
    { x: 5160, type: 'spitter' },
    { x: 5360, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage13-totem', power: 'speed' },
    { id: 'stage13-scale' },
    { id: 'stage13-mask', power: 'star' },
    { id: 'stage13-horn' },
    { id: 'stage13-frost', power: 'rapid' },
    { id: 'stage13-moss' },
  ],

  signs: [
    { x: 300, text: '스테이지 13: 불타는 협곡\n2장, 더 강해진 적들!' },
    { x: 5830, text: '보스 협곡의 아스트라노바X\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['협곡 바닥이 펄펄 끓어. 침뱉기랑 방패병이 같이 나오면 침뱉기부터!'] },
    { x: 5600, lines: ['체크포인트!', '이번 보스는 협곡의 아스트라노바X! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 5920, endX: 6880 },

  boss: {
    type: 'dragon',
    name: '협곡의 아스트라노바X',
    skin: 3,
    healthScale: 1.6,
    speedScale: 0.8,
    colors: { main: 0xc8282a, dark: 0x7a1418, armor: 0x2e2a2c, lava: 0xff7a1f, belly: 0xf0d0a0 },
    phases: [
      ['breath', 'tail', 'wing', 'pillars', 'fly'],
      ['breath', 'tail', 'pillars', 'fly', 'wing'],
      ['breath', 'pillars', 'fly', 'tail', 'pillars'],
    ],
    intro: ['아스트라노바X가 협곡을 막고 있어!', '꼬리가 땅에 떨어지거나 날개가 처지면 그때 때려!'],
  },
};
