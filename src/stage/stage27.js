// =============================================================
//  스테이지 27: 번개탑 공장 (3장)
//  번개를 모으는 탑이 줄지어 선 공장. 높은 탑을 타고 오르내린다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage7 } from './stage7.js';

export const stage27 = {
  name: '번개탑 공장',
  chapter: 3, // 지도 3장
  width: 8500,
  groundY: 480,
  playerStartX: 120,
  gateX: 7100,
  checkpointX: 7220,

  // 1장 스테이지 7 공장 배경에 폭풍 하늘을 덮음
  theme: { ...stage7.theme, sky: [0x10141e, 0x4a5a6a], weather: { kind: 'rain', color: 0xa8c8ff }, tint: { color: 0x102a5a, alpha: 0.34 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 520, y: 210, w: 128 },
    { x: 670, y: 300, w: 128 },
    { x: 670, y: 120, w: 160 },
    { x: 1268, y: 390, w: 96 },
    { x: 1432, y: 300, w: 96 },
    { x: 1596, y: 390, w: 96 },
    { x: 2130, y: 390, w: 128 },
    { x: 2130, y: 210, w: 128 },
    { x: 2280, y: 300, w: 128 },
    { x: 2280, y: 120, w: 160 },
    { x: 2876, y: 380, w: 192 },
    { x: 3506, y: 390, w: 128 },
    { x: 3506, y: 210, w: 128 },
    { x: 3656, y: 300, w: 128 },
    { x: 3656, y: 120, w: 160 },
    { x: 4252, y: 390, w: 192 },
    { x: 4404, y: 300, w: 192 },
    { x: 4552, y: 210, w: 192 },
    { x: 5182, y: 390, w: 128 },
    { x: 5182, y: 210, w: 128 },
    { x: 5332, y: 300, w: 128 },
    { x: 5332, y: 120, w: 160 },
    { x: 5928, y: 380, w: 192 },
    { x: 6558, y: 390, w: 128 },
    { x: 6558, y: 210, w: 160 },
    { x: 6708, y: 300, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'tank' },
    { x: 970, type: 'shield' },
    { x: 1230, type: 'spitter' },
    { x: 1380, type: 'tank' },
    { x: 1550, type: 'fast' },
    { x: 1800, type: 'fros' },
    { x: 1950, type: 'jumper' },
    { x: 2120, type: 'tank' },
    { x: 2380, type: 'shield' },
    { x: 2530, type: 'spitter' },
    { x: 2700, type: 'tank' },
    { x: 2876, y: 380, type: 'spitter' },
    { x: 2950, type: 'fast' },
    { x: 3100, type: 'fros' },
    { x: 3270, type: 'jumper' },
    { x: 3530, type: 'tank' },
    { x: 3680, type: 'shield' },
    { x: 3850, type: 'spitter' },
    { x: 4100, type: 'tank' },
    { x: 4250, type: 'fast' },
    { x: 4420, type: 'fros' },
    { x: 4680, type: 'jumper' },
    { x: 4830, type: 'tank' },
    { x: 5000, type: 'shield' },
    { x: 5250, type: 'spitter' },
    { x: 5400, type: 'tank' },
    { x: 5570, type: 'fast' },
    { x: 5830, type: 'fros' },
    { x: 5928, y: 380, type: 'jumper' },
    { x: 5980, type: 'jumper' },
    { x: 6150, type: 'tank' },
    { x: 6400, type: 'shield' },
    { x: 6550, type: 'spitter' },
    { x: 6720, type: 'tank' },
    { x: 6980, type: 'fast' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage27-coil', power: 'rapid' },
    { id: 'stage27-bolt' },
    { id: 'stage27-fuse', power: 'power' },
    { id: 'stage27-piston' },
    { id: 'stage27-lever', power: 'shield' },
    { id: 'stage27-gauge' },
    { id: 'stage27-valve', power: 'speed' },
    { id: 'stage27-cog' },
    { id: 'stage27-dynamo', power: 'star' },
  ],

  signs: [
    { x: 300, text: '스테이지 27: 번개탑 공장\n3장, 폭풍의 땅!' },
    { x: 4000, text: '번개탑 꼭대기\n오를 수 있으면 올라 봐!' },
    { x: 7450, text: '보스 파쇄자 MK5\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['폭풍의 힘을 모으는 공장이야. 탑마다 전기가 찌릿찌릿!', '뚱보와 방패병이 같이 와. 침착하게 {strong}!'] },
    { x: 3700, lines: ['탑 꼭대기까지 올라가면 보물이 보일지도 몰라!'] },
    { x: 7220, lines: ['체크포인트!', '파쇄자가 다섯 번째로 돌아왔어. 이번이 진짜 마지막이길!', '주먹이 날아오면 옆으로 피해. 팔이 없어도 코어가 싸워!'] },
  ],

  arena: { startX: 7540, endX: 8500 },

  boss: {
    type: 'arms',
    name: '파쇄자 MK5',
    skin: 'volt',
    arms: 3,
    healthScale: 2.4,
    speedScale: 0.76,
    rockBonus: 3,
    shockwaves: 3,
    colors: { main: 0x4a4a5a, light: 0x8a8aa0, dark: 0x22222e, arm: 0x5a5a70 },
    phases: [
      ['doubleSlam', 'rocketPunch', 'sweep', 'shockwave', 'slam'],
      ['multiSlam', 'rocketPunch', 'inhale', 'doubleSlam', 'rocks'],
      ['multiSlam', 'rocketPunch', 'shockwave', 'rocks', 'sweep'],
      ['rocketPunch', 'rocks', 'shockwave', 'inhale'],
    ],
  },
};
