// =============================================================
//  스테이지 23: 천둥 화구 (3장)
//  뚱보가 길을 막고 그 뒤에서 침이 날아오는 화산. 낮은 발판이 촘촘하다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage3 } from './stage3.js';

export const stage23 = {
  name: '천둥 화구',
  chapter: 3, // 지도 3장
  width: 8140,
  groundY: 480,
  playerStartX: 120,
  gateX: 6740,
  checkpointX: 6860,

  // 1장 스테이지 3 용암 배경에 먹구름을 덮음
  theme: { ...stage3.theme, sky: [0x180a14, 0x8a3a2a], weather: { kind: 'embers', color: 0xffc070 }, tint: { color: 0x14243c, alpha: 0.32 } },

  platforms: [
    { x: 520, y: 390, w: 96 },
    { x: 684, y: 300, w: 96 },
    { x: 850, y: 390, w: 96 },
    { x: 1016, y: 300, w: 96 },
    { x: 1180, y: 390, w: 96 },
    { x: 1344, y: 300, w: 96 },
    { x: 1672, y: 380, w: 192 },
    { x: 2096, y: 390, w: 128 },
    { x: 2096, y: 210, w: 128 },
    { x: 2248, y: 300, w: 128 },
    { x: 2248, y: 120, w: 160 },
    { x: 2640, y: 390, w: 96 },
    { x: 2804, y: 300, w: 96 },
    { x: 2968, y: 390, w: 96 },
    { x: 3134, y: 300, w: 96 },
    { x: 3462, y: 390, w: 192 },
    { x: 3612, y: 300, w: 192 },
    { x: 3762, y: 210, w: 192 },
    { x: 4186, y: 380, w: 192 },
    { x: 4610, y: 390, w: 128 },
    { x: 4780, y: 300, w: 128 },
    { x: 4950, y: 210, w: 128 },
    { x: 5120, y: 120, w: 128 },
    { x: 5290, y: 210, w: 128 },
    { x: 5460, y: 300, w: 128 },
    { x: 5630, y: 390, w: 128 },
    { x: 5990, y: 390, w: 128 },
    { x: 6170, y: 300, w: 128 },
    { x: 6350, y: 210, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'tank' },
    { x: 980, type: 'spitter' },
    { x: 1110, type: 'fast' },
    { x: 1380, type: 'fast' },
    { x: 1590, type: 'jumper' },
    { x: 1672, y: 380, type: 'spitter' },
    { x: 1760, type: 'tank' },
    { x: 1900, type: 'fros' },
    { x: 2170, type: 'tank' },
    { x: 2370, type: 'spitter' },
    { x: 2550, type: 'fast' },
    { x: 2680, type: 'fast' },
    { x: 2950, type: 'jumper' },
    { x: 3160, type: 'tank' },
    { x: 3340, type: 'fros' },
    { x: 3470, type: 'tank' },
    { x: 3740, type: 'spitter' },
    { x: 3950, type: 'fast' },
    { x: 4120, type: 'fast' },
    { x: 4186, y: 380, type: 'jumper' },
    { x: 4260, type: 'jumper' },
    { x: 4530, type: 'tank' },
    { x: 4740, type: 'fros' },
    { x: 4910, type: 'tank' },
    { x: 5050, type: 'spitter' },
    { x: 5320, type: 'fast' },
    { x: 5520, type: 'fast' },
    { x: 5700, type: 'jumper' },
    { x: 5830, type: 'tank' },
    { x: 6100, type: 'fros' },
    { x: 6310, type: 'tank' },
    { x: 6490, type: 'spitter' },
    { x: 6620, type: 'fast' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage23-ember', power: 'rapid' },
    { id: 'stage23-obsidian' },
    { id: 'stage23-magma', power: 'power' },
    { id: 'stage23-ash' },
    { id: 'stage23-spark', power: 'speed' },
    { id: 'stage23-crater' },
    { id: 'stage23-thunder', power: 'shield' },
    { id: 'stage23-cinder' },
  ],

  signs: [
    { x: 300, text: '스테이지 23: 천둥 화구\n3장, 폭풍의 땅!' },
    { x: 7090, text: '보스 천둥의 아스트라노바X\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['화구 위로 번개가 내리꽂혀. 뜨겁고 시끄러워!', '뚱보가 길을 막으면 {strong}(을)를 먼저 먹여!'] },
    { x: 3600, lines: ['침뱉기는 가까이 붙으면 약해. 뚱보 뒤로 돌아가 봐!'] },
    { x: 6860, lines: ['체크포인트!', '아스트라노바X가 번개를 삼켰어!', '불길은 점프로 넘고, 날개 바람은 앞으로 걸어서 버텨!'] },
  ],

  arena: { startX: 7180, endX: 8140 },

  boss: {
    type: 'dragon',
    name: '천둥의 아스트라노바X',
    skin: 3,
    healthScale: 2.0,
    speedScale: 0.76,
    colors: { main: 0x8a3a8a, dark: 0x4a1a5a, armor: 0x2a2a3a, lava: 0x8ad8ff, belly: 0xe0d8f0 },
    phases: [
      ['breath', 'pillars', 'wing', 'tail', 'fly'],
      ['pillars', 'breath', 'fly', 'wing', 'tail'],
      ['fly', 'pillars', 'breath', 'tail', 'pillars'],
    ],
    intro: ['천둥의 아스트라노바X야! 비늘에 번개가 튀어!', '꼬리나 날개가 처지면 그때 때려!'],
  },
};
