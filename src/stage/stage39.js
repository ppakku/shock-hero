// =============================================================
//  스테이지 39: 영원의 얼음벽 (4장)
//  마왕성 앞을 가로막은 얼음 절벽. 가장 높은 하늘길과 탑으로만 이어진 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage19 } from './stage19.js';

export const stage39 = {
  name: '영원의 얼음벽',
  chapter: 4, // 지도 4장
  width: 9300,
  groundY: 480,
  playerStartX: 120,
  gateX: 7900,
  checkpointX: 8020,

  // 2장 스테이지 19 얼음 배경을 마왕의 어둠으로 덮음
  theme: { ...stage19.theme, sky: [0x04081a, 0x2a3a70], weather: { kind: 'snow', color: 0xbcd0ff }, tint: { color: 0x560030, alpha: 0.46 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 690, y: 300, w: 96 },
    { x: 860, y: 210, w: 96 },
    { x: 1030, y: 120, w: 128 },
    { x: 1236, y: 120, w: 128 },
    { x: 1440, y: 120, w: 128 },
    { x: 1696, y: 390, w: 128 },
    { x: 1696, y: 210, w: 128 },
    { x: 1844, y: 300, w: 128 },
    { x: 1844, y: 120, w: 160 },
    { x: 2132, y: 390, w: 128 },
    { x: 2302, y: 300, w: 96 },
    { x: 2472, y: 210, w: 96 },
    { x: 2642, y: 120, w: 128 },
    { x: 2848, y: 120, w: 128 },
    { x: 3052, y: 120, w: 128 },
    { x: 3256, y: 120, w: 128 },
    { x: 3512, y: 380, w: 192 },
    { x: 3832, y: 390, w: 128 },
    { x: 4000, y: 300, w: 96 },
    { x: 4172, y: 210, w: 128 },
    { x: 4376, y: 210, w: 128 },
    { x: 4580, y: 210, w: 128 },
    { x: 4786, y: 210, w: 128 },
    { x: 5040, y: 390, w: 128 },
    { x: 5040, y: 210, w: 128 },
    { x: 5192, y: 300, w: 128 },
    { x: 5192, y: 120, w: 160 },
    { x: 5478, y: 390, w: 128 },
    { x: 5648, y: 300, w: 96 },
    { x: 5818, y: 210, w: 96 },
    { x: 5988, y: 120, w: 128 },
    { x: 6192, y: 120, w: 128 },
    { x: 6398, y: 120, w: 128 },
    { x: 6652, y: 380, w: 192 },
    { x: 6972, y: 390, w: 128 },
    { x: 7152, y: 300, w: 128 },
    { x: 7332, y: 210, w: 128 },
    { x: 7512, y: 120, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'fros' },
    { x: 970, type: 'shield' },
    { x: 1160, type: 'tank' },
    { x: 1290, type: 'spitter' },
    { x: 1560, type: 'fast' },
    { x: 1730, type: 'fast' },
    { x: 1920, type: 'jumper' },
    { x: 2040, type: 'fros' },
    { x: 2310, type: 'shield' },
    { x: 2480, type: 'fros' },
    { x: 2670, type: 'shield' },
    { x: 2800, type: 'tank' },
    { x: 3070, type: 'spitter' },
    { x: 3240, type: 'fast' },
    { x: 3430, type: 'fast' },
    { x: 3512, y: 380, type: 'tank' },
    { x: 3560, type: 'jumper' },
    { x: 3830, type: 'fros' },
    { x: 4000, type: 'shield' },
    { x: 4190, type: 'fros' },
    { x: 4310, type: 'shield' },
    { x: 4580, type: 'tank' },
    { x: 4750, type: 'spitter' },
    { x: 4950, type: 'fast' },
    { x: 5070, type: 'fast' },
    { x: 5340, type: 'jumper' },
    { x: 5510, type: 'fros' },
    { x: 5700, type: 'shield' },
    { x: 5830, type: 'fros' },
    { x: 6100, type: 'shield' },
    { x: 6270, type: 'tank' },
    { x: 6460, type: 'spitter' },
    { x: 6580, type: 'fast' },
    { x: 6652, y: 380, type: 'shield' },
    { x: 6850, type: 'fast' },
    { x: 7020, type: 'jumper' },
    { x: 7220, type: 'fros' },
    { x: 7340, type: 'shield' },
    { x: 7610, type: 'fros' },
    { x: 7780, type: 'shield' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage39-glacierheart', power: 'power' },
    { id: 'stage39-frostcrown' },
    { id: 'stage39-eternalsnow', power: 'shield' },
    { id: 'stage39-icemirror' },
    { id: 'stage39-northwind', power: 'speed' },
    { id: 'stage39-wallstone' },
    { id: 'stage39-wintersoul', power: 'star' },
    { id: 'stage39-snowflakepin' },
    { id: 'stage39-blizzardhorn', power: 'rapid' },
    { id: 'stage39-iceharp' },
  ],

  signs: [
    { x: 300, text: '스테이지 39: 영원의 얼음벽\n4장, 마왕의 세계!' },
    { x: 4000, text: '이 얼음벽 너머가\n마왕성이다' },
    { x: 8250, text: '보스 얼음 여제 아스트라\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['이 벽만 넘으면 마왕성이야!', '바람이 너무 차가워. 그래도 우리는 여기까지 왔잖아!'] },
    { x: 3800, lines: ['보물을 찾아 가면 마지막 싸움이 편해져. 상점도 잊지 마!'] },
    { x: 8020, lines: ['체크포인트!', '얼음 여제 아스트라가 마지막 길을 막고 있어!', '땅에 내려오면 뛰어서 내려찍어. 피한 다음 때려!'] },
  ],

  arena: { startX: 8340, endX: 9300 },

  boss: {
    type: 'ice',
    name: '얼음 여제 아스트라',
    skin: 'obsidian',
    signature: 'iceWalls',
    healthScale: 2.7,
    speedScale: 0.7,
    colors: { bright: 0x8ab8ff, main: 0x3a4aa8, dark: 0x141a52, pale: 0xd8dcf0, light: 0xf0f8ff },
    phases: [
      ['freezeBreath', 'avalanche', 'dive', 'signature', 'avalanche'],
      ['dive', 'icicles', 'freezeBreath', 'avalanche', 'signature'],
      ['hop', 'freezeBreath', 'signature', 'icicles', 'hop'],
    ],
  },
};
