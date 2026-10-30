// =============================================================
//  스테이지 21: 번개 폐허 (3장)
//  괴물 대왕이 쓰러지자 하늘이 갈라졌다. 방패병과 침뱉기가 짝지어 나오는 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage1 } from './stage1.js';

export const stage21 = {
  name: '번개 폐허',
  chapter: 3, // 지도 3장
  width: 7900,
  groundY: 480,
  playerStartX: 120,
  gateX: 6500,
  checkpointX: 6620,

  // 1장 스테이지 1 배경에 폭풍 하늘을 덮음
  theme: { ...stage1.theme, sky: [0x0c1428, 0x3a5a7a], weather: { kind: 'rain', color: 0xa8c8ff }, tint: { color: 0x14243c, alpha: 0.32 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 128 },
    { x: 880, y: 210, w: 128 },
    { x: 1060, y: 120, w: 128 },
    { x: 1436, y: 380, w: 192 },
    { x: 1874, y: 390, w: 96 },
    { x: 2040, y: 300, w: 96 },
    { x: 2204, y: 390, w: 96 },
    { x: 2368, y: 300, w: 96 },
    { x: 2534, y: 390, w: 96 },
    { x: 2876, y: 390, w: 128 },
    { x: 3048, y: 300, w: 96 },
    { x: 3216, y: 210, w: 128 },
    { x: 3422, y: 210, w: 128 },
    { x: 3796, y: 380, w: 192 },
    { x: 4236, y: 390, w: 128 },
    { x: 4416, y: 300, w: 128 },
    { x: 4596, y: 210, w: 128 },
    { x: 4972, y: 390, w: 128 },
    { x: 5140, y: 300, w: 128 },
    { x: 5346, y: 300, w: 128 },
    { x: 5552, y: 300, w: 128 },
    { x: 5926, y: 390, w: 128 },
    { x: 5926, y: 210, w: 128 },
    { x: 6076, y: 300, w: 128 },
    { x: 6076, y: 120, w: 160 },
  ],

  monsters: [
    { x: 800, type: 'shield' },
    { x: 910, type: 'spitter' },
    { x: 1190, type: 'fast' },
    { x: 1300, type: 'shield' },
    { x: 1436, y: 380, type: 'jumper' },
    { x: 1580, type: 'spitter' },
    { x: 1690, type: 'jumper' },
    { x: 1970, type: 'tank' },
    { x: 2080, type: 'shield' },
    { x: 2360, type: 'spitter' },
    { x: 2470, type: 'fast' },
    { x: 2750, type: 'shield' },
    { x: 2860, type: 'spitter' },
    { x: 3140, type: 'jumper' },
    { x: 3250, type: 'tank' },
    { x: 3530, type: 'shield' },
    { x: 3650, type: 'spitter' },
    { x: 3796, y: 380, type: 'spitter' },
    { x: 3930, type: 'fast' },
    { x: 4040, type: 'shield' },
    { x: 4320, type: 'spitter' },
    { x: 4430, type: 'jumper' },
    { x: 4710, type: 'tank' },
    { x: 4820, type: 'shield' },
    { x: 5100, type: 'spitter' },
    { x: 5210, type: 'fast' },
    { x: 5490, type: 'shield' },
    { x: 5600, type: 'spitter' },
    { x: 5880, type: 'jumper' },
    { x: 5990, type: 'tank' },
    { x: 6270, type: 'shield' },
    { x: 6380, type: 'spitter' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage21-rod', power: 'power' },
    { id: 'stage21-wire' },
    { id: 'stage21-cloud', power: 'shield' },
    { id: 'stage21-siren' },
    { id: 'stage21-battery', power: 'speed' },
    { id: 'stage21-sign' },
    { id: 'stage21-antenna', power: 'rapid' },
    { id: 'stage21-helmet' },
  ],

  signs: [
    { x: 300, text: '스테이지 21: 번개 폐허\n3장, 폭풍의 땅!' },
    { x: 3300, text: '번개 조심!\n방패 뒤에 침뱉기가 숨어 있다' },
    { x: 6850, text: '보스 파쇄자 MK4\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['괴물 대왕을 쓰러뜨렸더니 하늘이 쩍 갈라졌어!', '번개가 쏟아져. 폭풍이 어디서 오는지 찾아보자!'] },
    { x: 2300, lines: ['방패병과 침뱉기가 짝을 지어 나와. {strong}(으)로 방패부터 깨!'] },
    { x: 6620, lines: ['체크포인트!', '파쇄자가 번개를 맞고 또 깨어났어!', '팔이 바닥에 박혀 멈칫할 때 {strong}(으)로 부숴!'] },
  ],

  arena: { startX: 6940, endX: 7900 },

  boss: {
    type: 'arms',
    name: '파쇄자 MK4',
    skin: 1,
    arms: 3,
    healthScale: 2.2,
    speedScale: 0.82,
    rockBonus: 2,
    shockwaves: 2,
    colors: { main: 0x3a4a6e, light: 0x5a78a8, dark: 0x1e2a44, arm: 0x4a5e88 },
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'sweep', 'shockwave'],
      ['multiSlam', 'doubleSlam', 'rocketPunch', 'inhale', 'rocks'],
      ['multiSlam', 'sweep', 'rocketPunch', 'shockwave', 'rocks'],
      ['rocks', 'shockwave', 'inhale', 'rocketPunch'],
    ],
  },
};
