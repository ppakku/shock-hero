// =============================================================
//  스테이지 22: 비바람 숲 (3장)
//  프로스 떼가 비바람을 타고 날아다니는 숲. 높은 나뭇가지 길이 많다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage2 } from './stage2.js';

export const stage22 = {
  name: '비바람 숲',
  chapter: 3, // 지도 3장
  width: 8020,
  groundY: 480,
  playerStartX: 120,
  gateX: 6620,
  checkpointX: 6740,

  // 1장 스테이지 2 숲 배경에 폭풍 하늘을 덮음
  theme: { ...stage2.theme, sky: [0x081418, 0x2a5a4a], weather: { kind: 'rain', color: 0xa8c8ff }, tint: { color: 0x102a5a, alpha: 0.34 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 690, y: 300, w: 128 },
    { x: 896, y: 300, w: 128 },
    { x: 1122, y: 390, w: 128 },
    { x: 1292, y: 300, w: 96 },
    { x: 1462, y: 210, w: 96 },
    { x: 1632, y: 120, w: 128 },
    { x: 1836, y: 120, w: 128 },
    { x: 2064, y: 380, w: 192 },
    { x: 2356, y: 390, w: 128 },
    { x: 2524, y: 300, w: 128 },
    { x: 2696, y: 210, w: 128 },
    { x: 2864, y: 300, w: 128 },
    { x: 3036, y: 390, w: 128 },
    { x: 3262, y: 390, w: 128 },
    { x: 3432, y: 300, w: 96 },
    { x: 3602, y: 390, w: 96 },
    { x: 3602, y: 210, w: 128 },
    { x: 3802, y: 390, w: 96 },
    { x: 3802, y: 210, w: 128 },
    { x: 4002, y: 390, w: 96 },
    { x: 4002, y: 210, w: 128 },
    { x: 4228, y: 390, w: 128 },
    { x: 4408, y: 300, w: 128 },
    { x: 4588, y: 210, w: 128 },
    { x: 4768, y: 120, w: 128 },
    { x: 4996, y: 390, w: 96 },
    { x: 5160, y: 300, w: 96 },
    { x: 5326, y: 390, w: 96 },
    { x: 5492, y: 300, w: 96 },
    { x: 5686, y: 390, w: 128 },
    { x: 5856, y: 300, w: 96 },
    { x: 6026, y: 210, w: 128 },
    { x: 6232, y: 210, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'fros' },
    { x: 980, type: 'jumper' },
    { x: 1120, type: 'fros' },
    { x: 1350, type: 'tank' },
    { x: 1530, type: 'fast' },
    { x: 1670, type: 'jumper' },
    { x: 1900, type: 'shield' },
    { x: 2064, y: 380, type: 'jumper' },
    { x: 2080, type: 'fros' },
    { x: 2220, type: 'jumper' },
    { x: 2460, type: 'fros' },
    { x: 2630, type: 'tank' },
    { x: 2770, type: 'fast' },
    { x: 3010, type: 'jumper' },
    { x: 3190, type: 'shield' },
    { x: 3330, type: 'fros' },
    { x: 3560, type: 'jumper' },
    { x: 3740, type: 'fros' },
    { x: 3880, type: 'tank' },
    { x: 4110, type: 'fast' },
    { x: 4290, type: 'jumper' },
    { x: 4430, type: 'shield' },
    { x: 4670, type: 'fros' },
    { x: 4840, type: 'jumper' },
    { x: 4980, type: 'fros' },
    { x: 5220, type: 'tank' },
    { x: 5400, type: 'fast' },
    { x: 5540, type: 'jumper' },
    { x: 5770, type: 'shield' },
    { x: 5950, type: 'fros' },
    { x: 6090, type: 'jumper' },
    { x: 6320, type: 'fros' },
    { x: 6500, type: 'tank' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage22-acorn', power: 'speed' },
    { id: 'stage22-leaf' },
    { id: 'stage22-raindrop', power: 'shield' },
    { id: 'stage22-nest' },
    { id: 'stage22-mushroom', power: 'power' },
    { id: 'stage22-bark' },
    { id: 'stage22-feather', power: 'star' },
    { id: 'stage22-root' },
  ],

  signs: [
    { x: 300, text: '스테이지 22: 비바람 숲\n3장, 폭풍의 땅!' },
    { x: 6970, text: '보스 폭풍의 와처\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['비바람에 나무가 휘청거려. 프로스가 바람을 타고 와!', '{upAtk}(으)로 위를 조심해. 프로스는 쉴 때 낮게 내려와!'] },
    { x: 3400, lines: ['뜀뛰기가 나뭇가지에서 뛰어내려. {dash} 키로 밑으로 빠져나가!'] },
    { x: 6740, lines: ['체크포인트!', '폭풍의 와처가 진흙 속에 숨어 있어!', '땅이 들썩이면 바로 비켜. 덩굴에 잡히면 대시!'] },
  ],

  arena: { startX: 7060, endX: 8020 },

  boss: {
    type: 'watcher',
    name: '폭풍의 와처',
    skin: 2,
    healthScale: 2.0,
    speedScale: 0.78,
    colors: { main: 0x3a4a3a, dark: 0x1e2a22, moss: 0x4a6a4a, slime: 0x8affd0 },
    phases: [
      ['claw', 'burrow', 'vines', 'spit', 'crawl'],
      ['burrow', 'crawl', 'vines', 'spit', 'claw'],
      ['vines', 'burrow', 'crawl', 'burrow', 'spit'],
    ],
    intro: ['폭풍의 와처다! 진흙이 사방으로 튀어!', '지쳐서 엎드리면 그때 {strong}(으)로 때려!'],
  },
};
