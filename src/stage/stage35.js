// =============================================================
//  스테이지 35: 뒤틀린 숲 (4장)
//  나무가 꼬여 길도 꼬인 숲. 올라갔다 내려가는 산길이 이어지고 뜀뛰기가 튀어나온다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage2 } from './stage2.js';

export const stage35 = {
  name: '뒤틀린 숲',
  chapter: 4, // 지도 4장
  width: 8880,
  groundY: 480,
  playerStartX: 120,
  gateX: 7480,
  checkpointX: 7600,

  // 1장 스테이지 2 숲 배경을 마왕의 어둠으로 덮음
  theme: { ...stage2.theme, sky: [0x0c0414, 0x4a2a5a], weather: { kind: 'bubbles', color: 0xd06aff }, tint: { color: 0x560030, alpha: 0.46 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 690, y: 300, w: 128 },
    { x: 860, y: 210, w: 128 },
    { x: 1030, y: 120, w: 128 },
    { x: 1200, y: 210, w: 128 },
    { x: 1370, y: 300, w: 128 },
    { x: 1540, y: 390, w: 128 },
    { x: 1732, y: 390, w: 128 },
    { x: 1902, y: 300, w: 128 },
    { x: 2072, y: 210, w: 128 },
    { x: 2242, y: 300, w: 128 },
    { x: 2412, y: 390, w: 128 },
    { x: 2604, y: 380, w: 192 },
    { x: 2860, y: 390, w: 128 },
    { x: 3030, y: 300, w: 128 },
    { x: 3200, y: 210, w: 128 },
    { x: 3370, y: 120, w: 128 },
    { x: 3540, y: 210, w: 128 },
    { x: 3710, y: 300, w: 128 },
    { x: 3880, y: 390, w: 128 },
    { x: 4072, y: 390, w: 128 },
    { x: 4242, y: 300, w: 128 },
    { x: 4412, y: 210, w: 128 },
    { x: 4582, y: 300, w: 128 },
    { x: 4752, y: 390, w: 128 },
    { x: 4944, y: 380, w: 192 },
    { x: 5200, y: 390, w: 128 },
    { x: 5370, y: 300, w: 128 },
    { x: 5540, y: 210, w: 128 },
    { x: 5710, y: 120, w: 128 },
    { x: 5880, y: 210, w: 128 },
    { x: 6050, y: 300, w: 128 },
    { x: 6220, y: 390, w: 128 },
    { x: 6412, y: 390, w: 128 },
    { x: 6582, y: 300, w: 128 },
    { x: 6752, y: 210, w: 128 },
    { x: 6922, y: 300, w: 128 },
    { x: 7092, y: 390, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'jumper' },
    { x: 990, type: 'tank' },
    { x: 1120, type: 'fros' },
    { x: 1370, type: 'jumper' },
    { x: 1560, type: 'spitter' },
    { x: 1680, type: 'fast' },
    { x: 1940, type: 'shield' },
    { x: 2120, type: 'jumper' },
    { x: 2250, type: 'jumper' },
    { x: 2500, type: 'tank' },
    { x: 2604, y: 380, type: 'jumper' },
    { x: 2690, type: 'fros' },
    { x: 2820, type: 'jumper' },
    { x: 3070, type: 'spitter' },
    { x: 3260, type: 'fast' },
    { x: 3390, type: 'shield' },
    { x: 3640, type: 'jumper' },
    { x: 3830, type: 'jumper' },
    { x: 3950, type: 'tank' },
    { x: 4210, type: 'fros' },
    { x: 4400, type: 'jumper' },
    { x: 4520, type: 'spitter' },
    { x: 4770, type: 'fast' },
    { x: 4944, y: 380, type: 'spitter' },
    { x: 4960, type: 'shield' },
    { x: 5090, type: 'jumper' },
    { x: 5340, type: 'jumper' },
    { x: 5530, type: 'tank' },
    { x: 5660, type: 'fros' },
    { x: 5910, type: 'jumper' },
    { x: 6100, type: 'spitter' },
    { x: 6220, type: 'fast' },
    { x: 6480, type: 'shield' },
    { x: 6670, type: 'jumper' },
    { x: 6790, type: 'jumper' },
    { x: 7040, type: 'tank' },
    { x: 7230, type: 'fros' },
    { x: 7360, type: 'jumper' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage35-thorn', power: 'shield' },
    { id: 'stage35-twistedroot' },
    { id: 'stage35-dreamfruit', power: 'power' },
    { id: 'stage35-spidersilk' },
    { id: 'stage35-purplecap', power: 'speed' },
    { id: 'stage35-wisp' },
    { id: 'stage35-witchstone', power: 'star' },
    { id: 'stage35-crookedbranch' },
    { id: 'stage35-mandrake', power: 'rapid' },
    { id: 'stage35-fogjar' },
  ],

  signs: [
    { x: 300, text: '스테이지 35: 뒤틀린 숲\n4장, 마왕의 세계!' },
    { x: 3800, text: '길을 잃지 말 것\n앞으로만 가면 된다' },
    { x: 7830, text: '보스 뒤틀린 와처\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['나무가 빙빙 꼬여 있어. 어지러워!', '뜀뛰기가 산길 꼭대기에서 뛰어내려. 위를 잘 봐!'] },
    { x: 3400, lines: ['이 숲을 지나면 깊은 바다가 나와. 조금만 더!'] },
    { x: 7600, lines: ['체크포인트!', '뒤틀린 와처는 땅속을 정말 빨리 다녀!', '튀어나온 뒤 지쳤을 때 {strong}(으)로 혼내 줘!'] },
  ],

  arena: { startX: 7920, endX: 8880 },

  boss: {
    type: 'watcher',
    name: '뒤틀린 와처',
    skin: 2,
    healthScale: 2.3,
    speedScale: 0.72,
    colors: { main: 0x3a1e4a, dark: 0x1c0e26, moss: 0x6a2a7a, slime: 0xff6ae0 },
    phases: [
      ['crawl', 'burrow', 'vines', 'claw', 'spit'],
      ['crawl', 'vines', 'burrow', 'spit', 'crawl'],
      ['burrow', 'crawl', 'vines', 'crawl', 'burrow'],
    ],
    intro: ['와처가 온몸을 꼬며 다가와!', '덩굴은 대시, 땅 울림은 비켜서!'],
  },
};
