// =============================================================
//  스테이지 12: 폐허 고속도로 (2장)
//  1장 스테이지 1 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage1 } from './stage1.js';

export const stage12 = {
  name: '폐허 고속도로',
  chapter: 2, // 지도 2장
  width: 6740,
  groundY: 480,
  playerStartX: 120,
  gateX: 5340,
  checkpointX: 5460,

  // 1장 스테이지 1 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage1.theme, sky: [0x1a1020, 0x803a2a], weather: { kind: 'embers', color: 0xffa040 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 128 },
    { x: 880, y: 210, w: 128 },
    { x: 1424, y: 390, w: 128 },
    { x: 1604, y: 300, w: 128 },
    { x: 1784, y: 210, w: 96 },
    { x: 1964, y: 120, w: 128 },
    { x: 2068, y: 380, w: 192 },
    { x: 2328, y: 390, w: 128 },
    { x: 2508, y: 300, w: 96 },
    { x: 2688, y: 210, w: 128 },
    { x: 2868, y: 120, w: 128 },
    { x: 3232, y: 390, w: 128 },
    { x: 3412, y: 300, w: 128 },
    { x: 3592, y: 210, w: 128 },
    { x: 3772, y: 120, w: 128 },
    { x: 3876, y: 380, w: 192 },
    { x: 4136, y: 390, w: 128 },
    { x: 4316, y: 300, w: 96 },
    { x: 4496, y: 210, w: 128 },
  ],

  monsters: [
    800,
    { x: 1000, type: 'fast' },
    { x: 1200, type: 'shield' },
    { x: 1400, type: 'spitter' },
    { x: 1600, type: 'fros' },
    { x: 1800, type: 'jumper' },
    { x: 2068, y: 380, type: 'jumper' },
    { x: 2210, type: 'fast' },
    { x: 2410, type: 'shield' },
    { x: 2610, type: 'spitter' },
    { x: 2810, type: 'fros' },
    { x: 3010, type: 'jumper' },
    { x: 3210, type: 'tank' },
    { x: 3410, type: 'fast' },
    { x: 3610, type: 'shield' },
    { x: 3810, type: 'spitter' },
    { x: 4010, type: 'fros' },
    { x: 4220, type: 'jumper' },
    { x: 4420, type: 'tank' },
    { x: 4620, type: 'fast' },
    { x: 4820, type: 'shield' },
    { x: 5020, type: 'spitter' },
    { x: 5220, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage12-horn', power: 'shield' },
    { id: 'stage12-bell' },
    { id: 'stage12-coin', power: 'speed' },
    { id: 'stage12-ember' },
    { id: 'stage12-pearl', power: 'star' },
    { id: 'stage12-lamp' },
  ],

  signs: [
    { x: 300, text: '스테이지 12: 폐허 고속도로\n2장, 더 강해진 적들!' },
    { x: 5690, text: '보스 파쇄자 MK3\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['고속도로가 끊겼어! 차 위로 올라가면 보물이 보일지도.'] },
    { x: 5460, lines: ['체크포인트!', '이번 보스는 파쇄자 MK3! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 5780, endX: 6740 },

  boss: {
    type: 'arms',
    name: '파쇄자 MK3',
    skin: 1,
    arms: 3,
    healthScale: 2.1,
    speedScale: 0.85,
    rockBonus: 2,
    shockwaves: 2,
    colors: { main: 0x6e4232, light: 0x9a6a50, dark: 0x3a2a24, arm: 0x7a5444 },
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'sweep', 'multiSlam'],
      ['multiSlam', 'doubleSlam', 'rocketPunch', 'inhale', 'sweep'],
      ['multiSlam', 'sweep', 'rocketPunch', 'shockwave', 'rocks'],
      ['rocks', 'shockwave', 'inhale', 'rocks'],
    ],
  },
};
