// =============================================================
//  스테이지 17: 썩은 정글 (2장)
//  1장 스테이지 2 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage2 } from './stage2.js';

export const stage17 = {
  name: '썩은 정글',
  chapter: 2, // 지도 2장
  width: 7440,
  groundY: 480,
  playerStartX: 120,
  gateX: 6040,
  checkpointX: 6160,

  // 1장 스테이지 2 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage2.theme, sky: [0x0a1006, 0x304818], weather: { kind: 'bubbles', color: 0xc0ff4a } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 128 },
    { x: 880, y: 210, w: 128 },
    { x: 1265, y: 390, w: 128 },
    { x: 1445, y: 300, w: 128 },
    { x: 1625, y: 210, w: 128 },
    { x: 1750, y: 380, w: 192 },
    { x: 1805, y: 120, w: 128 },
    { x: 2010, y: 390, w: 128 },
    { x: 2190, y: 300, w: 96 },
    { x: 2370, y: 210, w: 96 },
    { x: 2550, y: 120, w: 128 },
    { x: 2755, y: 390, w: 128 },
    { x: 2935, y: 300, w: 128 },
    { x: 3115, y: 210, w: 128 },
    { x: 3240, y: 380, w: 192 },
    { x: 3500, y: 390, w: 128 },
    { x: 3680, y: 300, w: 128 },
    { x: 3860, y: 210, w: 96 },
    { x: 4040, y: 120, w: 128 },
    { x: 4245, y: 390, w: 128 },
    { x: 4425, y: 300, w: 96 },
    { x: 4605, y: 210, w: 128 },
    { x: 4730, y: 380, w: 192 },
    { x: 4785, y: 120, w: 128 },
    { x: 4990, y: 390, w: 128 },
    { x: 5170, y: 300, w: 96 },
    { x: 5350, y: 210, w: 128 },
    { x: 5530, y: 120, w: 128 },
  ],

  monsters: [
    800,
    { x: 990, type: 'shield' },
    { x: 1180, type: 'spitter' },
    { x: 1370, type: 'fros' },
    { x: 1560, type: 'jumper' },
    { x: 1750, y: 380, type: 'jumper' },
    { x: 1940, type: 'fast' },
    { x: 2130, type: 'shield' },
    { x: 2320, type: 'spitter' },
    { x: 2510, type: 'fros' },
    { x: 2700, type: 'jumper' },
    { x: 2890, type: 'tank' },
    { x: 3080, type: 'fast' },
    { x: 3240, y: 380, type: 'jumper' },
    { x: 3450, type: 'spitter' },
    { x: 3640, type: 'fros' },
    { x: 3830, type: 'jumper' },
    { x: 4020, type: 'tank' },
    { x: 4210, type: 'fast' },
    { x: 4400, type: 'shield' },
    { x: 4590, type: 'spitter' },
    { x: 4730, y: 380, type: 'jumper' },
    { x: 4970, type: 'jumper' },
    { x: 5160, type: 'tank' },
    { x: 5350, type: 'fast' },
    { x: 5540, type: 'shield' },
    { x: 5730, type: 'spitter' },
    { x: 5920, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage17-moss', power: 'shield' },
    { id: 'stage17-scale' },
    { id: 'stage17-mask', power: 'speed' },
    { id: 'stage17-coin' },
    { id: 'stage17-bell', power: 'star' },
    { id: 'stage17-shard' },
    { id: 'stage17-horn', power: 'rapid' },
    { id: 'stage17-frost' },
  ],

  signs: [
    { x: 300, text: '스테이지 17: 썩은 정글\n2장, 더 강해진 적들!' },
    { x: 6390, text: '보스 정글의 와처\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['정글이 썩어서 독 냄새가 나. 몬스터가 정말 많아!'] },
    { x: 6160, lines: ['체크포인트!', '이번 보스는 정글의 와처! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 6480, endX: 7440 },

  boss: {
    type: 'watcher',
    name: '정글의 와처',
    skin: 2,
    healthScale: 1.9,
    speedScale: 0.75,
    colors: { main: 0x4a3526, dark: 0x2b1d14, moss: 0x55602a, slime: 0xb6ff2a },
    phases: [
      ['claw', 'spit', 'burrow', 'vines', 'crawl'],
      ['claw', 'burrow', 'vines', 'crawl', 'spit'],
      ['burrow', 'vines', 'crawl', 'spit', 'burrow'],
    ],
    intro: ['와처가 정글 깊은 곳에서 기다리고 있었어!', '덩굴에 잡히면 대시로 빠져나와!'],
  },
};
