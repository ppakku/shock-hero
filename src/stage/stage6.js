// =============================================================
//  스테이지 6: 수중 던전 (마지막 스테이지, 헤엄치는 스테이지)
//  고치는 법은 같은 폴더의 README.md 를 보세요.
//  swim: true 이면 주인공이 헤엄칩니다 (숫자는 balance.js 의 swim).
// =============================================================

export const stage6 = {
  name: '수중 던전',
  width: 6000,
  groundY: 480,
  playerStartX: 120,
  gateX: 4600,
  checkpointX: 4720,
  swim: true, // 헤엄치기: 점프를 누르면 위로 헤엄치고, 떼면 천천히 가라앉음

  theme: {
    scenery: 'underwater', // 물속 동굴 배경 (아들 그림 + 해초, 산호, 빛줄기, 거품)
    sky: [0x04202a, 0x0d5560], // 물 위쪽, 아래쪽 색
    sun: 0xbff8ff, // 위에서 내려오는 빛줄기 색
    far: 0x0a3440, // 먼 바위 색
    near: 0x082a33, // 가까운 바위 색
    window: 0x9dff6a, // 빛나는 버섯과 산호 색
    ground: 0x9fc8c4, // 바닥 돌 색
    platform: 0x8fbfbf, // 바위 발판 색
    smoke: 0x0a3440,
    weather: null, // 거품은 배경에서 따로 그림
  },

  // 바위 발판 (헤엄쳐서 어디든 올라갈 수 있지만, 보물은 높은 곳에 숨어 있음)
  // 헤엄 천장(balance.js swim.ceilingY 150) 때문에 발판은 y 190 보다 아래에 두세요.
  platforms: [
    { x: 700, y: 380, w: 128 },
    { x: 880, y: 290, w: 96 },
    { x: 1060, y: 200, w: 128 },
    { x: 2000, y: 390, w: 160 },
    { x: 2200, y: 300, w: 96 },
    { x: 2400, y: 200, w: 128 },
    { x: 3500, y: 380, w: 128 },
    { x: 3700, y: 290, w: 128 },
    { x: 3880, y: 200, w: 96 },
  ],

  // 헤엄치는 몬스터는 y 로 높이를 정해요 (170 ~ 446 사이만 됨, 안 적으면 몬스터마다 기본 높이)
  monsters: [
    { x: 1000, type: 'crab' },
    { x: 1350, y: 340, type: 'jelly' },
    { x: 1700, type: 'crab' },
    { x: 1900, y: 300, type: 'piranha' },
    { x: 1960, y: 350, type: 'piranha' },
    { x: 2020, y: 400, type: 'piranha' },
    { x: 2500, y: 390, type: 'puffer' },
    { x: 2850, y: 300, type: 'jelly' },
    { x: 3100, type: 'crab' },
    { x: 3300, y: 360, type: 'puffer' },
    { x: 3620, y: 280, type: 'piranha' },
    { x: 3680, y: 340, type: 'piranha' },
    { x: 4000, y: 330, type: 'jelly' },
    { x: 4250, type: 'crab' },
    { x: 4420, y: 380, type: 'puffer' },
  ],

  treasures: [
    { id: 'stage6-shell', x: 1060, y: 200, power: 'speed' },
    { id: 'stage6-pearl', x: 2400, y: 200 },
    { id: 'stage6-anchor', x: 3880, y: 200, power: 'shield' },
  ],

  signs: [
    { x: 300, text: '스테이지 6: 수중 던전\n{jump} 로 헤엄쳐 올라가기' },
    { x: 1220, text: '골드해파리 GX 주의!\n단단해지면 충전 펀치' },
    { x: 2300, text: '가시복어가 부풀면\n맨손 펀치 금지!' },
    { x: 4900, text: '깊은 곳에서\n무언가 빛난다...' },
  ],

  talks: [
    { x: 0, lines: ['물속이야! 보글보글.', '{jump} 를 누르면 위로 헤엄치고, 떼면 천천히 가라앉아.', '{jump} 를 꾹 누르고 있으면 계속 올라가!'] },
    { x: 560, lines: ['저 위 바위에 보물이 보여! 헤엄쳐서 올라가 봐.'] },
    { x: 1150, lines: ['저기 금색 해파리! 골드해파리 GX야.', '보라색 점선이 보이면 독이 날아와. 위나 아래로 헤엄쳐 피해!', '가까이 가면 단단한 공이 돼. 그땐 {punch} 를 꾹 눌러 충전 펀치!'] },
    { x: 1780, lines: ['피라냐 떼다! 빨간 점선은 돌진할 길이야. 점선 밖으로 비켜!'] },
    { x: 2350, lines: ['가시복어가 부르르 떨면 곧 부풀어. 맨손으로 때리면 따끔해!', '바람이 빠져서 빙글빙글 돌 때 때려!'] },
    { x: 4720, lines: ['마지막 체크포인트!', '이 앞 깊은 곳에 심해의 왕이 산대.', '바닥을 휩쓰는 꼬리는 위로 헤엄쳐서 피하고, 지쳐서 내려앉으면 마구 때려!'] },
  ],

  arena: { startX: 5040, endX: 6000 },

  // 마지막 스테이지를 깼을 때 로봇 대사
  endingLines: ['해냈다! 심해의 왕까지 쓰러뜨렸어!', '도시도 바다도 모두 평화를 되찾았어!'],

  boss: {
    type: 'sea', // 보스 종류 (src/boss/index.js): 물속을 헤엄치는 큰 아귀
    name: '심해 아귀왕',
    healthScale: 1.3, // 체력 배수 (balance.js 의 seaBoss 체력에 곱함)
    speedScale: 0.95, // 공격 속도 (작을수록 빠름)
    colors: { main: 0x2a4a6a, light: 0x4a7aa0, dark: 0x14263a, belly: 0x8ab0c0, lure: 0x9dff6a },
    // [부위 다 있을 때, 하나 부순 뒤, 둘 다 부순 뒤(심장)] 쓰는 공격
    // charge(돌진), bubbles(거품 폭탄), whirlpool(소용돌이), ink(먹물, 초롱불이 있어야 씀), sweep(꼬리 휩쓸기)
    phases: [
      ['charge', 'bubbles', 'sweep', 'ink'],
      ['charge', 'bubbles', 'whirlpool', 'sweep', 'ink'],
      ['charge', 'bubbles', 'whirlpool', 'sweep'],
    ],
  },
};
