// =============================================================
//  스테이지 25: 폭풍 성채 (3장)
//  방패병이 벽처럼 서 있는 성채. 세 층으로 나뉜 성벽 길을 지난다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage5 } from './stage5.js';

export const stage25 = {
  name: '폭풍 성채',
  chapter: 3, // 지도 3장
  width: 8380,
  groundY: 480,
  playerStartX: 120,
  gateX: 6980,
  checkpointX: 7100,

  // 1장 스테이지 5 성 배경에 폭풍 하늘을 덮음
  theme: { ...stage5.theme, sky: [0x0a0a20, 0x3a3a6a], weather: { kind: 'rain', color: 0xa8c8ff }, tint: { color: 0x14243c, alpha: 0.32 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 690, y: 300, w: 96 },
    { x: 860, y: 390, w: 96 },
    { x: 860, y: 210, w: 128 },
    { x: 1060, y: 390, w: 96 },
    { x: 1060, y: 210, w: 128 },
    { x: 1260, y: 390, w: 96 },
    { x: 1260, y: 210, w: 128 },
    { x: 1644, y: 380, w: 192 },
    { x: 2092, y: 390, w: 128 },
    { x: 2262, y: 300, w: 96 },
    { x: 2432, y: 390, w: 96 },
    { x: 2432, y: 210, w: 128 },
    { x: 2632, y: 390, w: 96 },
    { x: 2632, y: 210, w: 128 },
    { x: 2832, y: 390, w: 96 },
    { x: 2832, y: 210, w: 128 },
    { x: 3032, y: 390, w: 96 },
    { x: 3032, y: 210, w: 128 },
    { x: 3416, y: 390, w: 128 },
    { x: 3596, y: 300, w: 128 },
    { x: 3776, y: 210, w: 128 },
    { x: 3956, y: 120, w: 128 },
    { x: 4340, y: 380, w: 192 },
    { x: 4788, y: 390, w: 128 },
    { x: 4958, y: 300, w: 96 },
    { x: 5128, y: 390, w: 96 },
    { x: 5128, y: 210, w: 128 },
    { x: 5328, y: 390, w: 96 },
    { x: 5328, y: 210, w: 128 },
    { x: 5528, y: 390, w: 96 },
    { x: 5528, y: 210, w: 128 },
    { x: 5912, y: 390, w: 128 },
    { x: 6082, y: 300, w: 128 },
    { x: 6252, y: 210, w: 128 },
    { x: 6422, y: 300, w: 128 },
    { x: 6592, y: 390, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'shield' },
    { x: 930, type: 'tank' },
    { x: 1060, type: 'shield' },
    { x: 1380, type: 'spitter' },
    { x: 1510, type: 'fros' },
    { x: 1640, type: 'jumper' },
    { x: 1644, y: 380, type: 'spitter' },
    { x: 1960, type: 'fast' },
    { x: 2090, type: 'shield' },
    { x: 2220, type: 'tank' },
    { x: 2540, type: 'shield' },
    { x: 2670, type: 'spitter' },
    { x: 2800, type: 'fros' },
    { x: 3120, type: 'jumper' },
    { x: 3250, type: 'fast' },
    { x: 3380, type: 'shield' },
    { x: 3700, type: 'tank' },
    { x: 3830, type: 'shield' },
    { x: 3960, type: 'spitter' },
    { x: 4280, type: 'fros' },
    { x: 4340, y: 380, type: 'spitter' },
    { x: 4410, type: 'jumper' },
    { x: 4540, type: 'fast' },
    { x: 4860, type: 'shield' },
    { x: 4990, type: 'tank' },
    { x: 5120, type: 'shield' },
    { x: 5440, type: 'spitter' },
    { x: 5570, type: 'fros' },
    { x: 5700, type: 'jumper' },
    { x: 6020, type: 'fast' },
    { x: 6150, type: 'shield' },
    { x: 6280, type: 'tank' },
    { x: 6600, type: 'shield' },
    { x: 6730, type: 'spitter' },
    { x: 6860, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage25-banner', power: 'power' },
    { id: 'stage25-key' },
    { id: 'stage25-armor', power: 'shield' },
    { id: 'stage25-shieldpiece' },
    { id: 'stage25-torch', power: 'rapid' },
    { id: 'stage25-chain' },
    { id: 'stage25-goblet', power: 'speed' },
    { id: 'stage25-gargoyle' },
    { id: 'stage25-seal', power: 'star' },
  ],

  signs: [
    { x: 300, text: '스테이지 25: 폭풍 성채\n3장, 폭풍의 땅!' },
    { x: 3700, text: '성벽 위 길과 아래 길\n어느 쪽으로 갈까?' },
    { x: 7330, text: '보스 폭풍 기사왕\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['폭풍을 다스리는 기사들의 성이야!', '방패병이 줄지어 서 있어. {strong}(으)로 하나씩 깨고 가자!'] },
    { x: 3100, lines: ['성벽 위 길에도 몬스터가 있어. 위아래를 잘 살펴!'] },
    { x: 7100, lines: ['체크포인트!', '폭풍 기사왕이 왕좌에 앉아 있어!', '팔을 다 부수면 일어나서 뛰어 내려찍어. 조심해!'] },
  ],

  arena: { startX: 7420, endX: 8380 },

  boss: {
    type: 'king',
    name: '폭풍 기사왕',
    skin: 5,
    arms: 3,
    healthScale: 2.5,
    speedScale: 0.75,
    rockBonus: 3,
    shockwaves: 3,
    colors: { main: 0x2a3a6a, light: 0x4a6aa0, dark: 0x141e3a, arm: 0x3a4e80 },
    minions: ['fast', 'shield', 'spitter'],
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'summon', 'shockwave', 'sweep'],
      ['multiSlam', 'doubleSlam', 'rocketPunch', 'inhale', 'summon', 'spit'],
      ['multiSlam', 'rocketPunch', 'rocks', 'spit', 'summon', 'sweep', 'shockwave'],
    ],
    finalPhase: ['charge', 'leap', 'summon', 'rocks', 'inhale', 'charge'],
  },
};
