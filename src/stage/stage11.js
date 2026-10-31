// =============================================================
//  스테이지 11: 독안개 늪 (2장)
//  1장 스테이지 2 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage2 } from './stage2.js';

export const stage11 = {
  name: '독안개 늪',
  chapter: 2, // 지도 2장
  width: 6600,
  groundY: 480,
  playerStartX: 120,
  gateX: 5200,
  checkpointX: 5320,

  // 1장 스테이지 2 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage2.theme, sky: [0x08140a, 0x2a4020], weather: { kind: 'bubbles', color: 0x9cff6a } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 96 },
    { x: 880, y: 210, w: 96 },
    { x: 1060, y: 120, w: 128 },
    { x: 1396, y: 390, w: 128 },
    { x: 1576, y: 300, w: 128 },
    { x: 1756, y: 210, w: 128 },
    { x: 1936, y: 120, w: 128 },
    { x: 2012, y: 380, w: 192 },
    { x: 2272, y: 390, w: 128 },
    { x: 2452, y: 300, w: 96 },
    { x: 2632, y: 210, w: 128 },
    { x: 2812, y: 120, w: 128 },
    { x: 3148, y: 390, w: 128 },
    { x: 3328, y: 300, w: 96 },
    { x: 3508, y: 210, w: 128 },
    { x: 3688, y: 120, w: 128 },
    { x: 3764, y: 380, w: 192 },
    { x: 4024, y: 390, w: 128 },
    { x: 4204, y: 300, w: 96 },
    { x: 4384, y: 210, w: 96 },
    { x: 4564, y: 120, w: 128 },
  ],

  monsters: [
    800,
    { x: 1000, type: 'shield' },
    { x: 1210, type: 'spitter' },
    { x: 1410, type: 'fros' },
    { x: 1620, type: 'jumper' },
    { x: 1820, type: 'tank' },
    { x: 2012, y: 380, type: 'jumper' },
    { x: 2230, type: 'shield' },
    { x: 2430, type: 'spitter' },
    { x: 2630, type: 'fros' },
    { x: 2840, type: 'jumper' },
    { x: 3040, type: 'tank' },
    { x: 3250, type: 'fast' },
    { x: 3450, type: 'shield' },
    { x: 3650, type: 'spitter' },
    { x: 3860, type: 'fros' },
    { x: 4060, type: 'jumper' },
    { x: 4260, type: 'tank' },
    { x: 4470, type: 'fast' },
    { x: 4670, type: 'shield' },
    { x: 4880, type: 'spitter' },
    { x: 5080, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage11-totem', power: 'power' },
    { id: 'stage11-bell' },
    { id: 'stage11-frost', power: 'shield' },
    { id: 'stage11-relic' },
    { id: 'stage11-shard', power: 'speed' },
    { id: 'stage11-moss' },
  ],

  signs: [
    { x: 300, text: '스테이지 11: 독안개 늪\n2장, 더 강해진 적들!' },
    { x: 5550, text: '보스 늪의 와처\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['독안개가 자욱해. 프로스가 안개 속에 숨어 있을지도 몰라!'] },
    { x: 5320, lines: ['체크포인트!', '이번 보스는 늪의 와처! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 5640, endX: 6600 },

  boss: {
    type: 'watcher',
    name: '늪의 와처',
    skin: 'bog',
    signature: 'spores',
    healthScale: 1.6,
    speedScale: 0.85,
    colors: { main: 0x4a3526, dark: 0x2b1d14, moss: 0x55602a, slime: 0xb6ff2a },
    phases: [
      ['claw', 'spit', 'signature', 'vines', 'claw'],
      ['claw', 'signature', 'vines', 'crawl', 'spit'],
      ['signature', 'vines', 'crawl', 'spit', 'claw'],
    ],
    intro: ['포레스트 와처가 늪에서 다시 나타났어!', '빨간 신호를 보고 피한 다음, 지쳐서 엎드리면 때려!'],
  },
};
