// =============================================================
//  스테이지 20: 최후의 요새 (2장 마지막)
//  1장 스테이지 5 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage5 } from './stage5.js';

export const stage20 = {
  name: '최후의 요새',
  chapter: 2, // 지도 2장
  width: 7860,
  groundY: 480,
  playerStartX: 120,
  gateX: 6460,
  checkpointX: 6580,

  // 1장 스테이지 5 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage5.theme, sky: [0x020004, 0x2a0418], weather: { kind: 'embers', color: 0xff3a3a } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 128 },
    { x: 880, y: 210, w: 128 },
    { x: 1060, y: 120, w: 128 },
    { x: 1225, y: 390, w: 128 },
    { x: 1405, y: 300, w: 128 },
    { x: 1585, y: 210, w: 128 },
    { x: 1670, y: 380, w: 192 },
    { x: 1765, y: 120, w: 128 },
    { x: 1930, y: 390, w: 128 },
    { x: 2110, y: 300, w: 96 },
    { x: 2290, y: 210, w: 96 },
    { x: 2470, y: 120, w: 128 },
    { x: 2635, y: 390, w: 128 },
    { x: 2815, y: 300, w: 128 },
    { x: 2995, y: 210, w: 96 },
    { x: 3080, y: 380, w: 192 },
    { x: 3175, y: 120, w: 128 },
    { x: 3340, y: 390, w: 128 },
    { x: 3520, y: 300, w: 128 },
    { x: 3700, y: 210, w: 96 },
    { x: 3880, y: 120, w: 128 },
    { x: 4045, y: 390, w: 128 },
    { x: 4225, y: 300, w: 128 },
    { x: 4405, y: 210, w: 128 },
    { x: 4490, y: 380, w: 192 },
    { x: 4585, y: 120, w: 128 },
    { x: 4750, y: 390, w: 128 },
    { x: 4930, y: 300, w: 96 },
    { x: 5110, y: 210, w: 128 },
    { x: 5455, y: 390, w: 128 },
    { x: 5635, y: 300, w: 96 },
    { x: 5815, y: 210, w: 128 },
  ],

  monsters: [
    800,
    { x: 980, type: 'jumper' },
    { x: 1170, type: 'tank' },
    { x: 1350, type: 'fast' },
    { x: 1540, type: 'shield' },
    { x: 1670, y: 380, type: 'jumper' },
    { x: 1910, type: 'fros' },
    { x: 2090, type: 'jumper' },
    { x: 2280, type: 'tank' },
    { x: 2460, type: 'fast' },
    { x: 2650, type: 'shield' },
    { x: 2830, type: 'spitter' },
    { x: 3020, type: 'fros' },
    { x: 3200, type: 'jumper' },
    { x: 3390, type: 'tank' },
    { x: 3570, type: 'fast' },
    { x: 3750, type: 'shield' },
    { x: 3940, type: 'spitter' },
    { x: 4120, type: 'fros' },
    { x: 4310, type: 'jumper' },
    { x: 4490, y: 380, type: 'jumper' },
    { x: 4680, type: 'fast' },
    { x: 4860, type: 'shield' },
    { x: 5050, type: 'spitter' },
    { x: 5230, type: 'fros' },
    { x: 5420, type: 'jumper' },
    { x: 5600, type: 'tank' },
    { x: 5790, type: 'fast' },
    { x: 5970, type: 'shield' },
    { x: 6160, type: 'spitter' },
    { x: 6340, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage20-relic', power: 'rapid' },
    { id: 'stage20-vine' },
    { id: 'stage20-totem', power: 'power' },
    { id: 'stage20-scale' },
    { id: 'stage20-gear', power: 'shield' },
    { id: 'stage20-bell' },
    { id: 'stage20-coin', power: 'speed' },
    { id: 'stage20-horn' },
  ],

  signs: [
    { x: 300, text: '스테이지 20: 최후의 요새\n2장, 더 강해진 적들!' },
    { x: 6810, text: '보스 괴물 대왕\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['여기가 2장의 끝이야. 모든 괴물의 대왕이 여기 있어!'] },
    { x: 6580, lines: ['체크포인트!', '이번 보스는 괴물 대왕! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 6900, endX: 7860 },

  boss: {
    type: 'king',
    name: '괴물 대왕',
    skin: 5,
    arms: 3,
    healthScale: 2.6,
    speedScale: 0.7,
    rockBonus: 3,
    shockwaves: 3,
    colors: { main: 0x5a1a2a, light: 0x8a2a3a, dark: 0x30101a, arm: 0x7a2a3a },
    minions: ['fast', 'jumper', 'shield', 'spitter'],
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'summon', 'spit', 'shockwave'],
      ['multiSlam', 'doubleSlam', 'sweep', 'rocketPunch', 'inhale', 'summon'],
      ['multiSlam', 'rocketPunch', 'inhale', 'rocks', 'spit', 'summon', 'sweep'],
    ],
    finalPhase: ['leap', 'charge', 'inhale', 'summon', 'rocks', 'leap'],
  },
};
