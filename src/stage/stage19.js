// =============================================================
//  스테이지 19: 얼음 왕좌 (2장)
//  1장 스테이지 4 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage4 } from './stage4.js';

export const stage19 = {
  name: '얼음 왕좌',
  chapter: 2, // 지도 2장
  width: 7720,
  groundY: 480,
  playerStartX: 120,
  gateX: 6320,
  checkpointX: 6440,

  // 1장 스테이지 4 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage4.theme, sky: [0x060c20, 0x40608a], weather: { kind: 'snow', color: 0xe0f4ff } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 96 },
    { x: 880, y: 210, w: 96 },
    { x: 1060, y: 120, w: 128 },
    { x: 1305, y: 390, w: 128 },
    { x: 1485, y: 300, w: 128 },
    { x: 1665, y: 210, w: 128 },
    { x: 1830, y: 380, w: 192 },
    { x: 1845, y: 120, w: 128 },
    { x: 2090, y: 390, w: 128 },
    { x: 2270, y: 300, w: 128 },
    { x: 2450, y: 210, w: 128 },
    { x: 2875, y: 390, w: 128 },
    { x: 3055, y: 300, w: 96 },
    { x: 3235, y: 210, w: 128 },
    { x: 3400, y: 380, w: 192 },
    { x: 3415, y: 120, w: 128 },
    { x: 3660, y: 390, w: 128 },
    { x: 3840, y: 300, w: 128 },
    { x: 4020, y: 210, w: 96 },
    { x: 4200, y: 120, w: 128 },
    { x: 4445, y: 390, w: 128 },
    { x: 4625, y: 300, w: 128 },
    { x: 4805, y: 210, w: 128 },
    { x: 4970, y: 380, w: 192 },
    { x: 4985, y: 120, w: 128 },
    { x: 5230, y: 390, w: 128 },
    { x: 5410, y: 300, w: 128 },
    { x: 5590, y: 210, w: 96 },
    { x: 5770, y: 120, w: 128 },
  ],

  monsters: [
    800,
    { x: 990, type: 'tank' },
    { x: 1170, type: 'fast' },
    { x: 1360, type: 'shield' },
    { x: 1540, type: 'spitter' },
    { x: 1730, type: 'fros' },
    { x: 1920, type: 'jumper' },
    { x: 2100, type: 'tank' },
    { x: 2290, type: 'fast' },
    { x: 2480, type: 'shield' },
    { x: 2660, type: 'spitter' },
    { x: 2850, type: 'fros' },
    { x: 3030, type: 'jumper' },
    { x: 3220, type: 'tank' },
    { x: 3400, y: 380, type: 'jumper' },
    { x: 3590, type: 'shield' },
    { x: 3780, type: 'spitter' },
    { x: 3970, type: 'fros' },
    { x: 4150, type: 'jumper' },
    { x: 4340, type: 'tank' },
    { x: 4520, type: 'fast' },
    { x: 4710, type: 'shield' },
    { x: 4900, type: 'spitter' },
    { x: 5080, type: 'fros' },
    { x: 5270, type: 'jumper' },
    { x: 5460, type: 'tank' },
    { x: 5640, type: 'fast' },
    { x: 5830, type: 'shield' },
    { x: 6010, type: 'spitter' },
    { x: 6200, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage19-mask', power: 'star' },
    { id: 'stage19-bell' },
    { id: 'stage19-frost', power: 'rapid' },
    { id: 'stage19-totem' },
    { id: 'stage19-gear', power: 'power' },
    { id: 'stage19-crown' },
    { id: 'stage19-scale', power: 'shield' },
    { id: 'stage19-shard' },
  ],

  signs: [
    { x: 300, text: '스테이지 19: 얼음 왕좌\n2장, 더 강해진 적들!' },
    { x: 6670, text: '보스 얼음 여왕 아스트라\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['얼음 왕좌까지 왔어. 거의 다 왔어, 히어로!'] },
    { x: 6440, lines: ['체크포인트!', '이번 보스는 얼음 여왕 아스트라! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 6760, endX: 7720 },

  boss: {
    type: 'ice',
    name: '얼음 여왕 아스트라',
    skin: 4,
    healthScale: 2.4,
    speedScale: 0.72,
    colors: { bright: 0x3d9be0, main: 0x2a5fa8, dark: 0x1a2552, pale: 0xc4cee0, light: 0xd8f6ff },
    phases: [
      ['freezeBreath', 'dive', 'avalanche', 'icicles', 'avalanche'],
      ['dive', 'freezeBreath', 'avalanche', 'icicles', 'dive'],
      ['hop', 'freezeBreath', 'avalanche', 'hop', 'avalanche'],
    ],
  },
};
