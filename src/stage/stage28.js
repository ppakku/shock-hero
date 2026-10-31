// =============================================================
//  스테이지 28: 벼락 고목 숲 (3장)
//  벼락 맞은 고목 사이로 뜀뛰기가 쏟아지는 숲. 지그재그 가지 길이 길게 이어진다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage2 } from './stage2.js';

export const stage28 = {
  name: '벼락 고목 숲',
  chapter: 3, // 지도 3장
  width: 8620,
  groundY: 480,
  playerStartX: 120,
  gateX: 7220,
  checkpointX: 7340,

  // 1장 스테이지 2 숲 배경에 어두운 먹구름을 덮음
  theme: { ...stage2.theme, sky: [0x0a100c, 0x3a4a30], weather: { kind: 'embers', color: 0xd0e8ff }, tint: { color: 0x102a5a, alpha: 0.34 } },

  platforms: [
    { x: 520, y: 390, w: 96 },
    { x: 684, y: 300, w: 96 },
    { x: 850, y: 390, w: 96 },
    { x: 1016, y: 300, w: 96 },
    { x: 1180, y: 390, w: 96 },
    { x: 1344, y: 300, w: 96 },
    { x: 1510, y: 390, w: 96 },
    { x: 1824, y: 390, w: 128 },
    { x: 1994, y: 300, w: 128 },
    { x: 2164, y: 210, w: 128 },
    { x: 2334, y: 300, w: 128 },
    { x: 2504, y: 390, w: 128 },
    { x: 2850, y: 390, w: 96 },
    { x: 3016, y: 300, w: 96 },
    { x: 3180, y: 390, w: 96 },
    { x: 3344, y: 300, w: 96 },
    { x: 3510, y: 390, w: 96 },
    { x: 3676, y: 300, w: 96 },
    { x: 3840, y: 390, w: 96 },
    { x: 4154, y: 380, w: 192 },
    { x: 4564, y: 390, w: 128 },
    { x: 4734, y: 300, w: 96 },
    { x: 4904, y: 210, w: 96 },
    { x: 5074, y: 120, w: 128 },
    { x: 5280, y: 120, w: 128 },
    { x: 5624, y: 390, w: 96 },
    { x: 5790, y: 300, w: 96 },
    { x: 5956, y: 390, w: 96 },
    { x: 6120, y: 300, w: 96 },
    { x: 6284, y: 390, w: 96 },
    { x: 6450, y: 300, w: 96 },
    { x: 6764, y: 380, w: 192 },
  ],

  monsters: [
    { x: 800, type: 'jumper' },
    { x: 940, type: 'jumper' },
    { x: 1140, type: 'fros' },
    { x: 1280, type: 'spitter' },
    { x: 1570, type: 'fast' },
    { x: 1710, type: 'tank' },
    { x: 1910, type: 'jumper' },
    { x: 2050, type: 'shield' },
    { x: 2340, type: 'jumper' },
    { x: 2480, type: 'jumper' },
    { x: 2680, type: 'fros' },
    { x: 2820, type: 'spitter' },
    { x: 3110, type: 'fast' },
    { x: 3250, type: 'tank' },
    { x: 3460, type: 'jumper' },
    { x: 3590, type: 'shield' },
    { x: 3880, type: 'jumper' },
    { x: 4020, type: 'jumper' },
    { x: 4154, y: 380, type: 'jumper' },
    { x: 4230, type: 'fros' },
    { x: 4360, type: 'spitter' },
    { x: 4650, type: 'fast' },
    { x: 4790, type: 'tank' },
    { x: 5000, type: 'jumper' },
    { x: 5130, type: 'shield' },
    { x: 5420, type: 'jumper' },
    { x: 5560, type: 'jumper' },
    { x: 5770, type: 'fros' },
    { x: 5900, type: 'spitter' },
    { x: 6190, type: 'fast' },
    { x: 6330, type: 'tank' },
    { x: 6540, type: 'jumper' },
    { x: 6670, type: 'shield' },
    { x: 6764, y: 380, type: 'jumper' },
    { x: 6960, type: 'jumper' },
    { x: 7100, type: 'jumper' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage28-stump', power: 'power' },
    { id: 'stage28-sap' },
    { id: 'stage28-lightning', power: 'rapid' },
    { id: 'stage28-hollow' },
    { id: 'stage28-owl', power: 'shield' },
    { id: 'stage28-moss' },
    { id: 'stage28-ring', power: 'speed' },
    { id: 'stage28-twig' },
    { id: 'stage28-charcoal', power: 'star' },
  ],

  signs: [
    { x: 300, text: '스테이지 28: 벼락 고목 숲\n3장, 폭풍의 땅!' },
    { x: 7570, text: '보스 고목의 와처\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['벼락을 맞은 고목이 활활 타고 있어!', '뜀뛰기가 위에서 덮쳐. 그림자를 잘 봐!'] },
    { x: 3900, lines: ['침뱉기는 점프로 넘거나 대시로 뚫어!'] },
    { x: 7340, lines: ['체크포인트!', '고목의 와처는 덩굴을 더 자주 써!', '덩굴에 잡히면 대시, 땅이 흔들리면 비켜!'] },
  ],

  arena: { startX: 7660, endX: 8620 },

  boss: {
    type: 'watcher',
    name: '고목의 와처',
    skin: 'bog',
    signature: 'spores',
    healthScale: 2.1,
    speedScale: 0.74,
    colors: { main: 0x3a2e22, dark: 0x1e160e, moss: 0x5a5a2a, slime: 0xffd24a },
    phases: [
      ['vines', 'claw', 'burrow', 'crawl', 'signature'],
      ['vines', 'burrow', 'spit', 'signature', 'claw'],
      ['burrow', 'vines', 'crawl', 'signature', 'spit'],
    ],
    intro: ['고목이 움직여! 저건 나무가 아니라 와처야!', '덩굴이 많아. 지쳐서 엎드릴 때까지 침착하게!'],
  },
};
