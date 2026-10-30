// =============================================================
//  스테이지 34: 검은 빙하 (4장)
//  얼음까지 까맣게 물든 빙하. 쌍방패병이 지키는 좁은 얼음길과 큰 얼음 계단.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage9 } from './stage9.js';

export const stage34 = {
  name: '검은 빙하',
  chapter: 4, // 지도 4장
  width: 8760,
  groundY: 480,
  playerStartX: 120,
  gateX: 7360,
  checkpointX: 7480,

  // 1장 스테이지 9 얼음 배경을 마왕의 어둠으로 덮음
  theme: { ...stage9.theme, sky: [0x060818, 0x3a4a78], weather: { kind: 'snow', color: 0x9a8aff }, tint: { color: 0x2a0018, alpha: 0.42 } },

  platforms: [
    { x: 520, y: 390, w: 192 },
    { x: 670, y: 300, w: 192 },
    { x: 820, y: 210, w: 192 },
    { x: 1280, y: 390, w: 192 },
    { x: 1428, y: 300, w: 192 },
    { x: 1580, y: 210, w: 192 },
    { x: 2038, y: 380, w: 192 },
    { x: 2496, y: 390, w: 128 },
    { x: 2668, y: 300, w: 96 },
    { x: 2836, y: 390, w: 96 },
    { x: 2836, y: 210, w: 128 },
    { x: 3036, y: 390, w: 96 },
    { x: 3036, y: 210, w: 128 },
    { x: 3236, y: 390, w: 96 },
    { x: 3236, y: 210, w: 128 },
    { x: 3632, y: 390, w: 192 },
    { x: 3782, y: 300, w: 192 },
    { x: 3932, y: 210, w: 192 },
    { x: 4392, y: 380, w: 192 },
    { x: 4850, y: 390, w: 192 },
    { x: 5000, y: 300, w: 192 },
    { x: 5460, y: 390, w: 128 },
    { x: 5628, y: 300, w: 96 },
    { x: 5800, y: 210, w: 128 },
    { x: 6004, y: 210, w: 128 },
    { x: 6208, y: 210, w: 128 },
    { x: 6604, y: 390, w: 192 },
    { x: 6754, y: 300, w: 192 },
    { x: 6904, y: 210, w: 192 },
  ],

  monsters: [
    { x: 800, type: 'shield' },
    { x: 900, type: 'shield' },
    { x: 1210, type: 'spitter' },
    { x: 1350, type: 'fast' },
    { x: 1450, type: 'tank' },
    { x: 1750, type: 'fros' },
    { x: 1900, type: 'jumper' },
    { x: 2000, type: 'shield' },
    { x: 2038, y: 380, type: 'shield' },
    { x: 2300, type: 'shield' },
    { x: 2450, type: 'spitter' },
    { x: 2550, type: 'fast' },
    { x: 2850, type: 'tank' },
    { x: 2990, type: 'fros' },
    { x: 3100, type: 'jumper' },
    { x: 3400, type: 'shield' },
    { x: 3540, type: 'shield' },
    { x: 3640, type: 'spitter' },
    { x: 3950, type: 'fast' },
    { x: 4090, type: 'tank' },
    { x: 4190, type: 'fros' },
    { x: 4392, y: 380, type: 'spitter' },
    { x: 4500, type: 'jumper' },
    { x: 4640, type: 'shield' },
    { x: 4740, type: 'shield' },
    { x: 5050, type: 'spitter' },
    { x: 5190, type: 'fast' },
    { x: 5290, type: 'tank' },
    { x: 5590, type: 'fros' },
    { x: 5740, type: 'jumper' },
    { x: 5840, type: 'shield' },
    { x: 6140, type: 'shield' },
    { x: 6290, type: 'spitter' },
    { x: 6390, type: 'fast' },
    { x: 6690, type: 'tank' },
    { x: 6830, type: 'fros' },
    { x: 6940, type: 'jumper' },
    { x: 7240, type: 'shield' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage34-blackice', power: 'shield' },
    { id: 'stage34-fang' },
    { id: 'stage34-frozenrose', power: 'power' },
    { id: 'stage34-snowglobe' },
    { id: 'stage34-coldflame', power: 'rapid' },
    { id: 'stage34-bonecharm' },
    { id: 'stage34-polarstar', power: 'star' },
    { id: 'stage34-skate' },
    { id: 'stage34-hailstone', power: 'speed' },
    { id: 'stage34-icepick' },
  ],

  signs: [
    { x: 300, text: '스테이지 34: 검은 빙하\n4장, 마왕의 세계!' },
    { x: 7710, text: '보스 검은 얼음의 아스트라\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['얼음이 까매. 마왕의 힘이 스며들었나 봐!', '방패병이 둘씩 서 있어. {strong}(으)로 앞뒤를 차례로 깨!'] },
    { x: 3900, lines: ['얼음 계단이 커서 올라가기 쉬워. 위에서 내려다보며 가자!'] },
    { x: 7480, lines: ['체크포인트!', '아스트라도 마왕의 힘에 물들었어!', '날개를 먼저 부숴서 땅으로 끌어내려!'] },
  ],

  arena: { startX: 7800, endX: 8760 },

  boss: {
    type: 'ice',
    name: '검은 얼음의 아스트라',
    skin: 4,
    healthScale: 2.6,
    speedScale: 0.72,
    colors: { bright: 0x5a5ac0, main: 0x2a2a78, dark: 0x101030, pale: 0x9aa0c8, light: 0xc0c8ff },
    phases: [
      ['avalanche', 'dive', 'icicles', 'freezeBreath', 'avalanche'],
      ['dive', 'avalanche', 'freezeBreath', 'dive', 'icicles'],
      ['hop', 'avalanche', 'hop', 'freezeBreath', 'icicles'],
    ],
  },
};
