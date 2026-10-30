// =============================================================
//  스테이지 38: 흑룡의 화산 (4장)
//  흑룡이 사는 화산. 탑과 산길이 번갈아 나오고 침뱉기가 높은 곳에서 쏜다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage13 } from './stage13.js';

export const stage38 = {
  name: '흑룡의 화산',
  chapter: 4, // 지도 4장
  width: 9220,
  groundY: 480,
  playerStartX: 120,
  gateX: 7820,
  checkpointX: 7940,

  // 2장 스테이지 13 용암 배경을 마왕의 어둠으로 덮음
  theme: { ...stage13.theme, sky: [0x0a0204, 0x7a1a0a], weather: { kind: 'embers', color: 0xffa040 }, tint: { color: 0x2a0018, alpha: 0.42 } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 520, y: 210, w: 128 },
    { x: 670, y: 300, w: 128 },
    { x: 670, y: 120, w: 160 },
    { x: 1028, y: 390, w: 128 },
    { x: 1196, y: 300, w: 128 },
    { x: 1368, y: 210, w: 128 },
    { x: 1536, y: 120, w: 128 },
    { x: 1708, y: 210, w: 128 },
    { x: 1876, y: 300, w: 128 },
    { x: 2048, y: 390, w: 128 },
    { x: 2372, y: 380, w: 192 },
    { x: 2760, y: 390, w: 128 },
    { x: 2760, y: 210, w: 128 },
    { x: 2912, y: 300, w: 128 },
    { x: 2912, y: 120, w: 160 },
    { x: 3268, y: 390, w: 128 },
    { x: 3438, y: 300, w: 128 },
    { x: 3608, y: 210, w: 128 },
    { x: 3778, y: 120, w: 128 },
    { x: 3948, y: 210, w: 128 },
    { x: 4118, y: 300, w: 128 },
    { x: 4288, y: 390, w: 128 },
    { x: 4612, y: 380, w: 192 },
    { x: 5002, y: 390, w: 128 },
    { x: 5002, y: 210, w: 128 },
    { x: 5152, y: 300, w: 128 },
    { x: 5152, y: 120, w: 160 },
    { x: 5508, y: 390, w: 128 },
    { x: 5680, y: 300, w: 128 },
    { x: 5848, y: 210, w: 128 },
    { x: 6020, y: 120, w: 128 },
    { x: 6188, y: 210, w: 128 },
    { x: 6360, y: 300, w: 128 },
    { x: 6528, y: 390, w: 128 },
    { x: 6854, y: 380, w: 192 },
    { x: 7244, y: 390, w: 128 },
    { x: 7244, y: 210, w: 128 },
    { x: 7392, y: 300, w: 128 },
    { x: 7392, y: 120, w: 160 },
  ],

  monsters: [
    { x: 800, type: 'spitter' },
    { x: 980, type: 'tank' },
    { x: 1150, type: 'fast' },
    { x: 1400, type: 'fros' },
    { x: 1580, type: 'shield' },
    { x: 1740, type: 'spitter' },
    { x: 1990, type: 'jumper' },
    { x: 2180, type: 'tank' },
    { x: 2340, type: 'spitter' },
    { x: 2372, y: 380, type: 'spitter' },
    { x: 2590, type: 'tank' },
    { x: 2770, type: 'fast' },
    { x: 2930, type: 'fros' },
    { x: 3180, type: 'shield' },
    { x: 3370, type: 'spitter' },
    { x: 3530, type: 'jumper' },
    { x: 3780, type: 'tank' },
    { x: 3960, type: 'spitter' },
    { x: 4130, type: 'tank' },
    { x: 4370, type: 'fast' },
    { x: 4560, type: 'fros' },
    { x: 4612, y: 380, type: 'spitter' },
    { x: 4720, type: 'shield' },
    { x: 4970, type: 'spitter' },
    { x: 5150, type: 'jumper' },
    { x: 5320, type: 'tank' },
    { x: 5570, type: 'spitter' },
    { x: 5750, type: 'tank' },
    { x: 5910, type: 'fast' },
    { x: 6160, type: 'fros' },
    { x: 6350, type: 'shield' },
    { x: 6510, type: 'spitter' },
    { x: 6760, type: 'jumper' },
    { x: 6854, y: 380, type: 'tank' },
    { x: 6940, type: 'tank' },
    { x: 7100, type: 'spitter' },
    { x: 7350, type: 'tank' },
    { x: 7540, type: 'fast' },
    { x: 7700, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage38-blackscale', power: 'power' },
    { id: 'stage38-cindertooth' },
    { id: 'stage38-eggshell', power: 'shield' },
    { id: 'stage38-volcanoglass' },
    { id: 'stage38-dragonheart', power: 'star' },
    { id: 'stage38-clawmark' },
    { id: 'stage38-flarestone', power: 'rapid' },
    { id: 'stage38-charredbone' },
    { id: 'stage38-emberwing', power: 'speed' },
    { id: 'stage38-hoard' },
  ],

  signs: [
    { x: 300, text: '스테이지 38: 흑룡의 화산\n4장, 마왕의 세계!' },
    { x: 8170, text: '보스 흑룡 아스트라노바X\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['마왕의 흑룡이 사는 화산이야. 땅이 계속 흔들려!', '높은 곳 침뱉기부터 잡으면 편해!'] },
    { x: 3900, lines: ['탑 꼭대기는 위험하지만 보물이 많을 거야!'] },
    { x: 7940, lines: ['체크포인트!', '흑룡이야! 지금까지 본 용 중에 가장 세!', '꼬리, 날개, 몸통 순서로 차근차근!'] },
  ],

  arena: { startX: 8260, endX: 9220 },

  boss: {
    type: 'dragon',
    name: '흑룡 아스트라노바X',
    skin: 3,
    healthScale: 2.4,
    speedScale: 0.7,
    colors: { main: 0x2a2228, dark: 0x120e12, armor: 0x4a1a1a, lava: 0xff6a1a, belly: 0x8a7a70 },
    phases: [
      ['pillars', 'breath', 'tail', 'wing', 'fly'],
      ['fly', 'pillars', 'wing', 'breath', 'pillars'],
      ['pillars', 'fly', 'pillars', 'tail', 'breath'],
    ],
    intro: ['흑룡이 날개를 펼쳤어! 하늘이 까매져!', '불길은 점프, 날개 바람은 앞으로! 잊지 마!'],
  },
};
