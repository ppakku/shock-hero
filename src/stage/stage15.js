// =============================================================
//  스테이지 15: 망령의 성 (2장)
//  1장 스테이지 5 의 배경 그림을 같이 쓰고, 더 어렵게 만든 곳.
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

import { stage5 } from './stage5.js';

export const stage15 = {
  name: '망령의 성',
  chapter: 2, // 지도 2장
  width: 7160,
  groundY: 480,
  playerStartX: 120,
  gateX: 5760,
  checkpointX: 5880,

  // 1장 스테이지 5 배경을 쓰고 하늘과 날씨만 바꿈
  theme: { ...stage5.theme, sky: [0x06020c, 0x3a1048], weather: { kind: 'embers', color: 0xc06aff } },

  platforms: [
    { x: 520, y: 390, w: 128 },
    { x: 700, y: 300, w: 96 },
    { x: 880, y: 210, w: 96 },
    { x: 1060, y: 120, w: 128 },
    { x: 1343, y: 390, w: 128 },
    { x: 1523, y: 300, w: 96 },
    { x: 1703, y: 210, w: 128 },
    { x: 1883, y: 120, w: 128 },
    { x: 1906, y: 380, w: 192 },
    { x: 2166, y: 390, w: 128 },
    { x: 2346, y: 300, w: 128 },
    { x: 2526, y: 210, w: 128 },
    { x: 2989, y: 390, w: 128 },
    { x: 3169, y: 300, w: 128 },
    { x: 3349, y: 210, w: 128 },
    { x: 3529, y: 120, w: 128 },
    { x: 3552, y: 380, w: 192 },
    { x: 3812, y: 390, w: 128 },
    { x: 3992, y: 300, w: 96 },
    { x: 4172, y: 210, w: 128 },
    { x: 4635, y: 390, w: 128 },
    { x: 4815, y: 300, w: 128 },
    { x: 4995, y: 210, w: 96 },
    { x: 5175, y: 120, w: 128 },
  ],

  monsters: [
    800,
    { x: 990, type: 'fros' },
    { x: 1190, type: 'jumper' },
    { x: 1380, type: 'tank' },
    { x: 1570, type: 'fast' },
    { x: 1770, type: 'shield' },
    { x: 1906, y: 380, type: 'jumper' },
    { x: 2160, type: 'fros' },
    { x: 2350, type: 'jumper' },
    { x: 2540, type: 'tank' },
    { x: 2740, type: 'fast' },
    { x: 2930, type: 'shield' },
    { x: 3120, type: 'spitter' },
    { x: 3320, type: 'fros' },
    { x: 3552, y: 380, type: 'jumper' },
    { x: 3700, type: 'tank' },
    { x: 3900, type: 'fast' },
    { x: 4090, type: 'shield' },
    { x: 4280, type: 'spitter' },
    { x: 4480, type: 'fros' },
    { x: 4670, type: 'jumper' },
    { x: 4870, type: 'tank' },
    { x: 5060, type: 'fast' },
    { x: 5250, type: 'shield' },
    { x: 5450, type: 'spitter' },
    { x: 5640, type: 'fros' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage15-mask', power: 'rapid' },
    { id: 'stage15-totem' },
    { id: 'stage15-ember', power: 'power' },
    { id: 'stage15-shard' },
    { id: 'stage15-lamp', power: 'shield' },
    { id: 'stage15-frost' },
    { id: 'stage15-moss', power: 'speed' },
  ],

  signs: [
    { x: 300, text: '스테이지 15: 망령의 성\n2장, 더 강해진 적들!' },
    { x: 6110, text: '보스 망령 킹\n이 앞에서 기다린다...' },
  ],

  talks: [
    { x: 0, lines: ['으스스해... 킹 돌연변이가 망령이 되어 돌아왔대!'] },
    { x: 5880, lines: ['체크포인트!', '이번 보스는 망령 킹! 1장보다 훨씬 세.', '공격 신호를 잘 보고 피한 다음 때려!'] },
  ],

  arena: { startX: 6200, endX: 7160 },

  boss: {
    type: 'king',
    name: '망령 킹',
    skin: 'ghost',
    signature: 'phantomStep',
    arms: 3,
    healthScale: 2.2,
    speedScale: 0.75,
    rockBonus: 2,
    shockwaves: 2,
    colors: { main: 0x5a1a2a, light: 0x8a2a3a, dark: 0x30101a, arm: 0x7a2a3a },
    minions: ['fast', 'jumper', 'shield'],
    phases: [
      ['slam', 'doubleSlam', 'rocketPunch', 'summon', 'signature'],
      ['multiSlam', 'sweep', 'rocketPunch', 'inhale', 'summon', 'signature'],
      ['rocketPunch', 'inhale', 'rocks', 'signature', 'summon', 'sweep'],
    ],
    finalPhase: ['leap', 'charge', 'inhale', 'summon', 'signature'],
  },
};
