// =============================================================
//  스테이지 32: 마왕의 대장간 (4장)
//  마왕의 군대를 만드는 대장간. 뚱보 둘이 앞을 막고, 낮은 쇠발판이 이어진다.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage7 } from './stage7.js';

export const stage32 = {
  name: '마왕의 대장간',
  chapter: 4, // 지도 4장
  width: 8520,
  groundY: 480,
  playerStartX: 120,
  gateX: 7120,
  checkpointX: 7240,

  // 1장 스테이지 7 공장 배경을 마왕의 어둠으로 덮음
  theme: { ...stage7.theme, sky: [0x100408, 0x6a2a1a], weather: { kind: 'embers', color: 0xff5a2a }, tint: { color: 0x560030, alpha: 0.46 } },

  platforms: [
    { x: 520, y: 380, w: 192 },
    { x: 942, y: 380, w: 192 },
    { x: 1364, y: 390, w: 128 },
    { x: 1544, y: 300, w: 128 },
    { x: 1724, y: 210, w: 128 },
    { x: 2082, y: 380, w: 192 },
    { x: 2504, y: 380, w: 192 },
    { x: 2926, y: 390, w: 128 },
    { x: 2926, y: 210, w: 128 },
    { x: 3076, y: 300, w: 128 },
    { x: 3076, y: 120, w: 160 },
    { x: 3466, y: 380, w: 192 },
    { x: 3888, y: 380, w: 192 },
    { x: 4310, y: 390, w: 128 },
    { x: 4480, y: 300, w: 128 },
    { x: 4650, y: 210, w: 128 },
    { x: 4820, y: 300, w: 128 },
    { x: 4990, y: 390, w: 128 },
    { x: 5348, y: 380, w: 192 },
    { x: 5770, y: 380, w: 192 },
    { x: 6192, y: 390, w: 128 },
    { x: 6372, y: 300, w: 128 },
    { x: 6552, y: 210, w: 128 },
    { x: 6732, y: 120, w: 128 },
  ],

  monsters: [
    { x: 520, y: 380, type: 'jumper' },
    { x: 800, type: 'tank' },
    { x: 910, type: 'tank' },
    { x: 1220, type: 'shield' },
    { x: 1410, type: 'spitter' },
    { x: 1520, type: 'fast' },
    { x: 1830, type: 'tank' },
    { x: 2020, type: 'fros' },
    { x: 2082, y: 380, type: 'spitter' },
    { x: 2130, type: 'tank' },
    { x: 2440, type: 'tank' },
    { x: 2630, type: 'shield' },
    { x: 2740, type: 'spitter' },
    { x: 3050, type: 'fast' },
    { x: 3240, type: 'tank' },
    { x: 3350, type: 'fros' },
    { x: 3466, y: 380, type: 'jumper' },
    { x: 3660, type: 'tank' },
    { x: 3840, type: 'tank' },
    { x: 3960, type: 'shield' },
    { x: 4270, type: 'spitter' },
    { x: 4450, type: 'fast' },
    { x: 4560, type: 'tank' },
    { x: 4870, type: 'fros' },
    { x: 5060, type: 'tank' },
    { x: 5170, type: 'tank' },
    { x: 5348, y: 380, type: 'spitter' },
    { x: 5480, type: 'shield' },
    { x: 5670, type: 'spitter' },
    { x: 5770, y: 380, type: 'jumper' },
    { x: 5780, type: 'fast' },
    { x: 6090, type: 'tank' },
    { x: 6280, type: 'fros' },
    { x: 6390, type: 'tank' },
    { x: 6700, type: 'tank' },
    { x: 6890, type: 'shield' },
    { x: 7000, type: 'spitter' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage32-anvil', power: 'power' },
    { id: 'stage32-tongs' },
    { id: 'stage32-ingot', power: 'shield' },
    { id: 'stage32-bellows' },
    { id: 'stage32-hammerhead', power: 'rapid' },
    { id: 'stage32-mold' },
    { id: 'stage32-darksteel', power: 'star' },
    { id: 'stage32-rivet' },
    { id: 'stage32-forgefire', power: 'speed' },
    { id: 'stage32-coalbucket' },
  ],

  signs: [
    { x: 300, text: '스테이지 32: 마왕의 대장간\n4장, 마왕의 세계!' },
    { x: 3800, text: '이 몬스터들은\n여기서 만들어진다' },
    { x: 7470, text: '보스 마왕의 파쇄자\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['쾅쾅 소리가 들려? 마왕의 몬스터를 만드는 대장간이야!', '뚱보가 둘씩 나와. {strong}(을)를 꽉 채워서 때려!'] },
    { x: 3500, lines: ['쇠발판 위 침뱉기는 점프 공격으로 잡아!'] },
    { x: 7240, lines: ['체크포인트!', '마왕이 파쇄자를 데려다 다시 만들었어!', '이제 파쇄자는 마왕의 부하야. 꼭 쓰러뜨리자!'] },
  ],

  arena: { startX: 7560, endX: 8520 },

  boss: {
    type: 'arms',
    name: '마왕의 파쇄자',
    skin: 1,
    arms: 3,
    healthScale: 2.5,
    speedScale: 0.74,
    rockBonus: 3,
    shockwaves: 3,
    colors: { main: 0x5a1a2a, light: 0x8a2a3a, dark: 0x2a0a14, arm: 0x6a2030 },
    phases: [
      ['doubleSlam', 'multiSlam', 'rocketPunch', 'sweep', 'shockwave'],
      ['multiSlam', 'rocketPunch', 'inhale', 'shockwave', 'rocks'],
      ['multiSlam', 'rocketPunch', 'sweep', 'inhale', 'rocks'],
      ['rocketPunch', 'rocks', 'shockwave', 'inhale'],
    ],
  },
};
