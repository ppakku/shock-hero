// =============================================================
//  스테이지 24: 눈폭풍 능선 (3장)
//  날쌘돌이가 둘씩 달려드는 눈 덮인 능선. 높은 능선을 따라 길게 걷는다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage4 } from './stage4.js';

export const stage24 = {
  name: '눈폭풍 능선',
  chapter: 3, // 지도 3장
  width: 8260,
  groundY: 480,
  playerStartX: 120,
  gateX: 6860,
  checkpointX: 6980,

  // 1장 스테이지 4 얼음 산 배경에 눈폭풍을 덮음
  theme: { ...stage4.theme, sky: [0x0e1a30, 0x88a8c8], weather: { kind: 'snow', color: 0xd8ecff }, tint: { color: 0x102a5a, alpha: 0.34 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 690, y: 300, w: 96 },
    { x: 860, y: 210, w: 96 },
    { x: 1030, y: 120, w: 128 },
    { x: 1236, y: 120, w: 128 },
    { x: 1440, y: 120, w: 128 },
    { x: 1840, y: 380, w: 192 },
    { x: 2302, y: 390, w: 128 },
    { x: 2472, y: 300, w: 96 },
    { x: 2642, y: 210, w: 128 },
    { x: 2848, y: 210, w: 128 },
    { x: 3052, y: 210, w: 128 },
    { x: 3452, y: 390, w: 96 },
    { x: 3616, y: 300, w: 96 },
    { x: 3780, y: 390, w: 96 },
    { x: 3946, y: 300, w: 96 },
    { x: 4312, y: 390, w: 128 },
    { x: 4484, y: 300, w: 96 },
    { x: 4652, y: 210, w: 96 },
    { x: 4824, y: 120, w: 128 },
    { x: 5028, y: 120, w: 128 },
    { x: 5428, y: 380, w: 192 },
    { x: 5890, y: 390, w: 128 },
    { x: 6060, y: 300, w: 128 },
    { x: 6264, y: 300, w: 128 },
    { x: 6470, y: 300, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'fast' },
    { x: 890, type: 'fast' },
    { x: 1210, type: 'shield' },
    { x: 1390, type: 'fros' },
    { x: 1470, type: 'jumper' },
    { x: 1790, type: 'tank' },
    { x: 1840, y: 380, type: 'jumper' },
    { x: 1970, type: 'spitter' },
    { x: 2060, type: 'fast' },
    { x: 2380, type: 'fast' },
    { x: 2560, type: 'shield' },
    { x: 2640, type: 'fros' },
    { x: 2960, type: 'jumper' },
    { x: 3140, type: 'tank' },
    { x: 3230, type: 'spitter' },
    { x: 3550, type: 'fast' },
    { x: 3730, type: 'fast' },
    { x: 3810, type: 'shield' },
    { x: 4130, type: 'fros' },
    { x: 4310, type: 'jumper' },
    { x: 4400, type: 'tank' },
    { x: 4720, type: 'spitter' },
    { x: 4900, type: 'fast' },
    { x: 4980, type: 'fast' },
    { x: 5300, type: 'shield' },
    { x: 5428, y: 380, type: 'jumper' },
    { x: 5480, type: 'fros' },
    { x: 5570, type: 'jumper' },
    { x: 5890, type: 'tank' },
    { x: 6070, type: 'spitter' },
    { x: 6150, type: 'fast' },
    { x: 6470, type: 'fast' },
    { x: 6650, type: 'shield' },
    { x: 6740, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage24-icicle', power: 'shield' },
    { id: 'stage24-mitten' },
    { id: 'stage24-snowball', power: 'speed' },
    { id: 'stage24-crystal' },
    { id: 'stage24-frost', power: 'power' },
    { id: 'stage24-sled' },
    { id: 'stage24-aurora', power: 'star' },
    { id: 'stage24-scarf' },
  ],

  signs: [
    { x: 300, text: '스테이지 24: 눈폭풍 능선\n3장, 폭풍의 땅!' },
    { x: 7210, text: '보스 눈폭풍의 아스트라\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['앞이 안 보일 만큼 눈이 와. 능선 위로 올라가 보자!', '날쌘돌이가 둘씩 달려와. 공격 신호를 놓치지 마!'] },
    { x: 3500, lines: ['높은 능선에 보물이 숨어 있을지도 몰라!'] },
    { x: 6980, lines: ['체크포인트!', '눈폭풍의 아스트라가 머리 위를 돌고 있어!', '날개를 부수면 땅으로 내려와. 그때가 기회야!'] },
  ],

  arena: { startX: 7300, endX: 8260 },

  boss: {
    type: 'ice',
    name: '눈폭풍의 아스트라',
    skin: 'obsidian',
    signature: 'iceWalls',
    healthScale: 2.4,
    speedScale: 0.76,
    colors: { bright: 0x7ab8e8, main: 0x3a70b0, dark: 0x1c2c58, pale: 0xd0dcec, light: 0xe8faff },
    phases: [
      ['dive', 'avalanche', 'freezeBreath', 'icicles', 'signature'],
      ['freezeBreath', 'signature', 'avalanche', 'dive', 'avalanche'],
      ['hop', 'avalanche', 'signature', 'hop', 'icicles'],
    ],
  },
};
