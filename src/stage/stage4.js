// =============================================================
//  스테이지 4: 얼음 산
// =============================================================

export const stage4 = {
  name: '얼음 산',
  width: 5400,
  groundY: 480,
  playerStartX: 120,
  gateX: 4020,
  checkpointX: 4140,

  theme: {
    // 얼음 산에 어울리는 생김새 (움직임과 세기는 그대로)
    monsterSkins: { basic: 'monster_ice_basic', fast: 'monster_ice_fast', tank: 'monster_ice_tank', jumper: 'monster_ice_jumper' },
    scenery: 'mountains', // 배경 모양
    sky: [0x1a2a50, 0x9ec8e8],
    sun: 0xf0f8ff,
    far: 0x4a6a90,
    near: 0x2a3e60,
    window: 0xd8f4ff,
    ground: 0xc8e0f8,
    smoke: 0xe0f0ff,
    weather: { kind: 'snow', color: 0xffffff },
    bgImage: { key: 'ice_bg', file: 'ice_bg.jpg' }, // 걸어가는 동안 배경 (Gemini 그림, 오로라 얼음 산맥)
    arenaImage: { key: 'ice_arena', file: 'ice_arena.jpg' }, // 보스전 배경 (Gemini 그림, 오로라 아래 얼음 평원)
    groundImage: { key: 'ice_ground', file: 'ice_ground.png', surface: 4 }, // 바닥 그림 (Gemini 그림, 눈과 얼음층, 좌우로 이어짐)
    platformImage: { key: 'ice_platform', file: 'ice_platform.png', left: 70, right: 70, surface: 7, scale: 0.45 }, // 눈 덮인 얼음 바위 발판 (Gemini 그림, 양 끝은 그대로, 가운데만 늘림)
  },

  platforms: [
    { x: 500, y: 390, w: 128 },
    { x: 680, y: 310, w: 96 },
    { x: 860, y: 230, w: 96 },
    { x: 1040, y: 150, w: 128 },
    { x: 1700, y: 380, w: 192 },
    { x: 2300, y: 390, w: 128 },
    { x: 2480, y: 300, w: 128 },
    { x: 3000, y: 390, w: 128 },
    { x: 3180, y: 300, w: 96 },
    { x: 3360, y: 210, w: 96 },
    { x: 3540, y: 130, w: 128 },
    { x: 3800, y: 390, w: 128 },
  ],

  monsters: [
    900,
    { x: 1300, type: 'jumper' },
    { x: 1500, type: 'fast' },
    { x: 1650, type: 'fros' },
    { x: 1850, type: 'tank' },
    { x: 2100, type: 'jumper' },
    { x: 2400, type: 'shield' }, // 방패병
    { x: 2700, type: 'fast' },
    { x: 2900, type: 'jumper' },
    { x: 3100, type: 'spitter' },
    { x: 3300, type: 'shield' },
    { x: 3600, type: 'fast' },
    { x: 3850, type: 'jumper' },
  ],

  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage4-icicle', power: 'speed' },
    { id: 'stage4-cave' },
    { id: 'stage4-summit', power: 'star' },
    { id: 'stage4-glacier' },
  ],

  signs: [
    { x: 300, text: '스테이지 4: 얼음 산\n얼음 뜀뛰기는 점프해서 덮쳐!' },
    { x: 2180, text: '방패병 주의!\n{shieldSign}' },
    { x: 4300, text: '보스 구역!\n혹한의 아스트라가 하늘에서 지켜보고 있어' },
  ],

  talks: [
    { x: 0, lines: ['으슬으슬 추워... 내 회로가 얼겠어.', '얼음 뜀뛰기는 점프해서 덮쳐. 대시로 밑으로 빠져나가!'] },
    { x: 2200, lines: ['방패를 든 녀석이야! 앞에서 그냥 치면 막혀.', '{shieldTip}'] },
    { x: 2950, lines: ['보물은 갈수록 높은 곳에 숨어 있어. 올라가 보자!'] },
    { x: 4140, lines: ['체크포인트!', '혹한의 아스트라는 하늘을 나는 얼음 용이야.', '냉기 브레스는 파란 부채꼴 밖으로, 빙천지락은 빛나는 바닥을 피해!', '지쳐서 내려오거나 낮게 뜨면 그때 때려!'] },
  ],

  arena: { startX: 4440, endX: 5400 },

  boss: {
    type: 'ice', // 보스 종류 (src/boss/index.js): 하늘을 나는 얼음 용 (아들 디자인, src/boss/FrostAstraBoss.js)
    name: '혹한의 아스트라',
    healthScale: 1.5, // 체력 배수 (balance.js 의 iceBoss 체력에 곱함)
    speedScale: 0.9, // 공격 속도 (작을수록 빠름)
    // 디자인 시트 색: 밝은 파랑, 중간 파랑(몸), 짙은 남색(테두리), 연한 회청색(배), 밝은 하늘색(결정)
    colors: { bright: 0x3d9be0, main: 0x2a5fa8, dark: 0x1a2552, pale: 0xc4cee0, light: 0xd8f6ff },
    // [날개 둘 다 있을 때, 날개 하나 부서진 뒤, 날개 다 부서져 땅에 떨어진 뒤] 쓰는 공격
    // icicles(고드름 비), dive(급강하), freezeBreath(냉기 브레스), avalanche(빙천지락), hop(뛰어 내려찍기, 땅에서만)
    phases: [
      ['freezeBreath', 'dive', 'avalanche', 'icicles'],
      ['dive', 'freezeBreath', 'avalanche', 'icicles'],
      ['hop', 'freezeBreath', 'avalanche'],
    ],
  },
};
