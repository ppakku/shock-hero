// =============================================================
//  스테이지 36: 어둠의 심연 (4장, 헤엄치는 스테이지)
//  빛이 닿지 않는 바다. 가시복어와 해파리가 길을 막고 높은 바위가 늘어서 있다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage16 } from './stage16.js';

export const stage36 = {
  name: '어둠의 심연',
  chapter: 4, // 지도 4장
  width: 8400,
  groundY: 480,
  playerStartX: 120,
  gateX: 7000,
  checkpointX: 7120,
  swim: true, // 헤엄치기

  // 2장 스테이지 16 물속 배경을 쓰고 물빛을 어둡게 바꿈
  theme: { ...stage16.theme, sky: [0x02040c, 0x141a3a], weather: null, tint: { color: 0x0a0420, alpha: 0.38 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 690, y: 300, w: 96 },
    { x: 860, y: 210, w: 128 },
    { x: 1064, y: 210, w: 128 },
    { x: 1270, y: 210, w: 128 },
    { x: 1488, y: 390, w: 128 },
    { x: 1668, y: 300, w: 128 },
    { x: 1848, y: 210, w: 128 },
    { x: 2066, y: 380, w: 192 },
    { x: 2348, y: 390, w: 128 },
    { x: 2518, y: 300, w: 96 },
    { x: 2688, y: 210, w: 128 },
    { x: 2892, y: 210, w: 128 },
    { x: 3098, y: 210, w: 128 },
    { x: 3304, y: 210, w: 128 },
    { x: 3520, y: 390, w: 128 },
    { x: 3692, y: 300, w: 128 },
    { x: 3896, y: 300, w: 128 },
    { x: 4100, y: 300, w: 128 },
    { x: 4320, y: 380, w: 192 },
    { x: 4600, y: 390, w: 128 },
    { x: 4772, y: 300, w: 96 },
    { x: 4940, y: 210, w: 128 },
    { x: 5146, y: 210, w: 128 },
    { x: 5352, y: 210, w: 128 },
    { x: 5568, y: 390, w: 128 },
    { x: 5748, y: 300, w: 128 },
    { x: 5928, y: 210, w: 128 },
    { x: 6148, y: 390, w: 96 },
    { x: 6312, y: 300, w: 96 },
    { x: 6476, y: 390, w: 96 },
    { x: 6642, y: 300, w: 96 },
  ],

  monsters: [
    { x: 800, y: 300, type: 'puffer' },
    { x: 950, y: 240, type: 'jelly' },
    { x: 1170, y: 380, type: 'puffer' },
    { x: 1290, type: 'crab' },
    { x: 1450, y: 340, type: 'jelly' },
    { x: 1660, y: 280, type: 'piranha' },
    { x: 1790, y: 420, type: 'puffer' },
    { x: 1940, y: 300, type: 'jelly' },
    { x: 2160, type: 'crab' },
    { x: 2280, y: 360, type: 'piranha' },
    { x: 2440, y: 400, type: 'piranha' },
    { x: 2650, y: 300, type: 'puffer' },
    { x: 2780, y: 240, type: 'jelly' },
    { x: 2930, y: 380, type: 'puffer' },
    { x: 3140, type: 'crab' },
    { x: 3270, y: 340, type: 'jelly' },
    { x: 3420, y: 280, type: 'piranha' },
    { x: 3640, y: 420, type: 'puffer' },
    { x: 3760, y: 300, type: 'jelly' },
    { x: 3920, type: 'crab' },
    { x: 4130, y: 360, type: 'piranha' },
    { x: 4260, y: 400, type: 'piranha' },
    { x: 4410, y: 300, type: 'puffer' },
    { x: 4620, y: 240, type: 'jelly' },
    { x: 4750, y: 380, type: 'puffer' },
    { x: 4900, type: 'crab' },
    { x: 5120, y: 340, type: 'jelly' },
    { x: 5240, y: 280, type: 'piranha' },
    { x: 5400, y: 420, type: 'puffer' },
    { x: 5610, y: 300, type: 'jelly' },
    { x: 5740, type: 'crab' },
    { x: 5890, y: 360, type: 'piranha' },
    { x: 6110, y: 400, type: 'piranha' },
    { x: 6230, y: 300, type: 'puffer' },
    { x: 6390, y: 240, type: 'jelly' },
    { x: 6600, y: 380, type: 'puffer' },
    { x: 6730, type: 'crab' },
    { x: 6880, y: 340, type: 'jelly' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage36-blackpearl', power: 'power' },
    { id: 'stage36-sunkencrown' },
    { id: 'stage36-glowfish', power: 'speed' },
    { id: 'stage36-ghostship' },
    { id: 'stage36-abysslamp', power: 'shield' },
    { id: 'stage36-kraken' },
    { id: 'stage36-deepstone', power: 'star' },
    { id: 'stage36-seaglass' },
    { id: 'stage36-tidebell', power: 'rapid' },
    { id: 'stage36-mooncoral' },
  ],

  signs: [
    { x: 300, text: '스테이지 36: 어둠의 심연\n4장, 마왕의 세계!' },
    { x: 7350, text: '보스 어둠의 아귀왕\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['캄캄해! 빛이 하나도 안 닿는 바다야. {jump} 키로 헤엄쳐!', '복어는 부풀었을 때 때리면 안 돼. 바람이 빠지면 때려!'] },
    { x: 3500, lines: ['해파리가 단단해지면 꾹 눌러서 충전 공격으로 깨뜨려!'] },
    { x: 7120, lines: ['체크포인트!', '어둠의 아귀왕은 먹물을 자주 뿌려!', '초롱불을 먼저 부수면 먹물을 못 뿌려!'] },
  ],

  arena: { startX: 7440, endX: 8400 },

  boss: {
    type: 'sea',
    name: '어둠의 아귀왕',
    skin: 'abyss',
    signature: 'blackout',
    healthScale: 2.1,
    speedScale: 0.76,
    colors: { main: 0x1a1a3a, light: 0x3a3a6a, dark: 0x0a0a1e, belly: 0x6a6a9a, lure: 0xff5ad5 },
    phases: [
      ['signature', 'charge', 'whirlpool', 'bubbles', 'sweep'],
      ['ink', 'whirlpool', 'charge', 'sweep', 'signature'],
      ['signature', 'whirlpool', 'sweep', 'charge', 'bubbles'],
    ],
  },
};
