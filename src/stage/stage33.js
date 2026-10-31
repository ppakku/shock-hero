// =============================================================
//  스테이지 33: 붉은 용암강 (4장)
//  붉은 달 아래 용암강. 프로스가 높은 곳을 차지하고, 긴 공중 다리를 건넌다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage8 } from './stage8.js';

export const stage33 = {
  name: '붉은 용암강',
  chapter: 4, // 지도 4장
  width: 8640,
  groundY: 480,
  playerStartX: 120,
  gateX: 7240,
  checkpointX: 7360,

  // 1장 스테이지 8 용암 배경을 마왕의 어둠으로 덮음
  theme: { ...stage8.theme, sky: [0x1a0206, 0xc01a1a], weather: { kind: 'embers', color: 0xff3a3a }, tint: { color: 0x560030, alpha: 0.46 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 690, y: 300, w: 96 },
    { x: 860, y: 210, w: 96 },
    { x: 1030, y: 120, w: 128 },
    { x: 1236, y: 120, w: 128 },
    { x: 1440, y: 120, w: 128 },
    { x: 1644, y: 120, w: 128 },
    { x: 2048, y: 380, w: 192 },
    { x: 2512, y: 390, w: 128 },
    { x: 2684, y: 300, w: 96 },
    { x: 2852, y: 210, w: 96 },
    { x: 3024, y: 120, w: 128 },
    { x: 3228, y: 120, w: 128 },
    { x: 3432, y: 120, w: 128 },
    { x: 3836, y: 390, w: 96 },
    { x: 4000, y: 300, w: 96 },
    { x: 4164, y: 390, w: 96 },
    { x: 4330, y: 300, w: 96 },
    { x: 4700, y: 390, w: 128 },
    { x: 4870, y: 300, w: 96 },
    { x: 5040, y: 210, w: 96 },
    { x: 5210, y: 120, w: 128 },
    { x: 5416, y: 120, w: 128 },
    { x: 5620, y: 120, w: 128 },
    { x: 6022, y: 380, w: 192 },
    { x: 6488, y: 390, w: 128 },
    { x: 6668, y: 300, w: 128 },
    { x: 6848, y: 210, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'fros' },
    { x: 990, type: 'fros' },
    { x: 1220, type: 'spitter' },
    { x: 1360, type: 'jumper' },
    { x: 1540, type: 'tank' },
    { x: 1770, type: 'fast' },
    { x: 1920, type: 'fros' },
    { x: 2048, y: 380, type: 'tank' },
    { x: 2100, type: 'fros' },
    { x: 2330, type: 'spitter' },
    { x: 2470, type: 'jumper' },
    { x: 2660, type: 'tank' },
    { x: 2890, type: 'fast' },
    { x: 3030, type: 'fros' },
    { x: 3220, type: 'fros' },
    { x: 3450, type: 'spitter' },
    { x: 3590, type: 'jumper' },
    { x: 3770, type: 'tank' },
    { x: 4000, type: 'fast' },
    { x: 4150, type: 'fros' },
    { x: 4330, type: 'fros' },
    { x: 4560, type: 'spitter' },
    { x: 4700, type: 'jumper' },
    { x: 4890, type: 'tank' },
    { x: 5120, type: 'fast' },
    { x: 5260, type: 'fros' },
    { x: 5450, type: 'fros' },
    { x: 5680, type: 'spitter' },
    { x: 5820, type: 'jumper' },
    { x: 6000, type: 'tank' },
    { x: 6022, y: 380, type: 'jumper' },
    { x: 6230, type: 'fast' },
    { x: 6380, type: 'fros' },
    { x: 6560, type: 'fros' },
    { x: 6790, type: 'spitter' },
    { x: 6930, type: 'jumper' },
    { x: 7120, type: 'tank' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage33-redmoon', power: 'power' },
    { id: 'stage33-basalt' },
    { id: 'stage33-lavapearl', power: 'rapid' },
    { id: 'stage33-rowboat' },
    { id: 'stage33-heatstone', power: 'shield' },
    { id: 'stage33-firefly' },
    { id: 'stage33-bloodruby', power: 'star' },
    { id: 'stage33-oar' },
    { id: 'stage33-sunset', power: 'speed' },
    { id: 'stage33-stepstone' },
  ],

  signs: [
    { x: 300, text: '스테이지 33: 붉은 용암강\n4장, 마왕의 세계!' },
    { x: 7590, text: '보스 붉은 달의 아스트라노바X\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['달이 빨개! 용암강이 끓고 있어.', '프로스가 쌍으로 날아와. 독구름 속에 서 있지 마!'] },
    { x: 3600, lines: ['공중 다리에서 떨어져도 괜찮아. 다시 올라가면 돼!'] },
    { x: 7360, lines: ['체크포인트!', '붉은 달의 아스트라노바X는 불기둥을 쉬지 않고 써!', '불길은 점프로 넘고, 지칠 때까지 살아남아!'] },
  ],

  arena: { startX: 7680, endX: 8640 },

  boss: {
    type: 'dragon',
    name: '붉은 달의 아스트라노바X',
    skin: 'black',
    healthScale: 2.2,
    speedScale: 0.72,
    colors: { main: 0xa01420, dark: 0x5a0a12, armor: 0x241c20, lava: 0xff3a2a, belly: 0xe8b0a0 },
    phases: [
      ['breath', 'pillars', 'tail', 'fly', 'wing'],
      ['pillars', 'fly', 'breath', 'wing', 'pillars'],
      ['fly', 'pillars', 'tail', 'pillars', 'breath'],
    ],
    intro: ['붉은 달의 아스트라노바X야. 눈이 달처럼 빛나!', '날개 바람에 밀리지 말고 앞으로 걸어!'],
  },
};
