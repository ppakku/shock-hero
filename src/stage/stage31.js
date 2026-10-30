// =============================================================
//  스테이지 31: 그림자 도시 (4장)
//  문 너머 마왕의 세계. 날쌘돌이가 떼로 달리는 까만 도시.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage1 } from './stage1.js';

export const stage31 = {
  name: '그림자 도시',
  chapter: 4, // 지도 4장
  width: 8400,
  groundY: 480,
  playerStartX: 120,
  gateX: 7000,
  checkpointX: 7120,

  // 1장 스테이지 1 배경을 마왕의 어둠으로 덮음
  theme: { ...stage1.theme, sky: [0x0a0208, 0x4a1a2a], weather: { kind: 'embers', color: 0xc06aff }, tint: { color: 0x2a0018, alpha: 0.42 } },

  platforms: [
    { x: 520, y: 390, w: 96 },
    { x: 684, y: 300, w: 96 },
    { x: 850, y: 390, w: 96 },
    { x: 1016, y: 300, w: 96 },
    { x: 1180, y: 390, w: 96 },
    { x: 1388, y: 390, w: 128 },
    { x: 1568, y: 300, w: 128 },
    { x: 1748, y: 210, w: 128 },
    { x: 1928, y: 120, w: 128 },
    { x: 2168, y: 380, w: 192 },
    { x: 2472, y: 390, w: 128 },
    { x: 2642, y: 300, w: 128 },
    { x: 2848, y: 300, w: 128 },
    { x: 3052, y: 300, w: 128 },
    { x: 3256, y: 300, w: 128 },
    { x: 3496, y: 390, w: 128 },
    { x: 3496, y: 210, w: 128 },
    { x: 3648, y: 300, w: 128 },
    { x: 3648, y: 120, w: 160 },
    { x: 3920, y: 380, w: 192 },
    { x: 4224, y: 390, w: 96 },
    { x: 4388, y: 300, w: 96 },
    { x: 4552, y: 390, w: 96 },
    { x: 4718, y: 300, w: 96 },
    { x: 4884, y: 390, w: 96 },
    { x: 5048, y: 300, w: 96 },
    { x: 5256, y: 390, w: 128 },
    { x: 5426, y: 300, w: 96 },
    { x: 5596, y: 210, w: 128 },
    { x: 5800, y: 210, w: 128 },
    { x: 6006, y: 210, w: 128 },
    { x: 6246, y: 390, w: 128 },
    { x: 6426, y: 300, w: 128 },
    { x: 6606, y: 210, w: 128 },
  ],

  monsters: [
    { x: 800, type: 'fast' },
    { x: 890, type: 'fast' },
    { x: 1000, type: 'spitter' },
    { x: 1290, type: 'fast' },
    { x: 1430, type: 'shield' },
    { x: 1710, type: 'fros' },
    { x: 1800, type: 'fast' },
    { x: 1900, type: 'fast' },
    { x: 2168, y: 380, type: 'fast' },
    { x: 2200, type: 'spitter' },
    { x: 2340, type: 'fast' },
    { x: 2620, type: 'shield' },
    { x: 2710, type: 'fros' },
    { x: 2810, type: 'fast' },
    { x: 3110, type: 'fast' },
    { x: 3250, type: 'spitter' },
    { x: 3520, type: 'fast' },
    { x: 3620, type: 'shield' },
    { x: 3720, type: 'fros' },
    { x: 3920, y: 380, type: 'jumper' },
    { x: 4020, type: 'fast' },
    { x: 4160, type: 'fast' },
    { x: 4430, type: 'spitter' },
    { x: 4520, type: 'fast' },
    { x: 4630, type: 'shield' },
    { x: 4930, type: 'fros' },
    { x: 5060, type: 'fast' },
    { x: 5340, type: 'fast' },
    { x: 5430, type: 'spitter' },
    { x: 5540, type: 'fast' },
    { x: 5830, type: 'shield' },
    { x: 5970, type: 'fros' },
    { x: 6250, type: 'fast' },
    { x: 6340, type: 'fast' },
    { x: 6440, type: 'spitter' },
    { x: 6740, type: 'fast' },
    { x: 6880, type: 'shield' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage31-shadow', power: 'speed' },
    { id: 'stage31-lantern' },
    { id: 'stage31-mirror', power: 'shield' },
    { id: 'stage31-clocktower' },
    { id: 'stage31-nightpass', power: 'power' },
    { id: 'stage31-streetlamp' },
    { id: 'stage31-darkgem', power: 'rapid' },
    { id: 'stage31-bellpiece' },
    { id: 'stage31-moonstone', power: 'star' },
    { id: 'stage31-rooftile' },
  ],

  signs: [
    { x: 300, text: '스테이지 31: 그림자 도시\n4장, 마왕의 세계!' },
    { x: 7350, text: '보스 그림자 와처\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['문을 지나왔더니... 여기가 마왕의 세계야!', '우리 도시랑 똑같은데 온통 까매. 날쌘돌이 떼를 조심해!'] },
    { x: 3400, lines: ['몬스터가 더 세졌어. 체력이 줄면 무리하지 마!'] },
    { x: 7120, lines: ['체크포인트!', '그림자 와처가 땅속에서 기다려!', '그림자가 움직이면 바로 비켜!'] },
  ],

  arena: { startX: 7440, endX: 8400 },

  boss: {
    type: 'watcher',
    name: '그림자 와처',
    skin: 2,
    healthScale: 2.2,
    speedScale: 0.74,
    colors: { main: 0x2a1e3a, dark: 0x140e20, moss: 0x4a2a6a, slime: 0xd06aff },
    phases: [
      ['burrow', 'claw', 'spit', 'vines', 'crawl'],
      ['burrow', 'crawl', 'spit', 'vines', 'burrow'],
      ['crawl', 'burrow', 'vines', 'burrow', 'spit'],
    ],
    intro: ['그림자 와처야! 까만 진흙을 뱉어!', '4장 보스는 더 세. 공격 신호를 끝까지 봐!'],
  },
};
