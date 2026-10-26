// =============================================================
//  스테이지 1: 파괴된 도시
//  고치는 법은 같은 폴더의 README.md 를 보세요.
// =============================================================

export const stage1 = {
  name: '파괴된 도시',
  width: 3960,
  groundY: 480,
  playerStartX: 120,
  gateX: 2600, // 보스 문: 몬스터를 다 잡아야 열림
  checkpointX: 2700,

  theme: {
    sky: [0x2a1640, 0xe0703c], // 하늘 위쪽, 아래쪽 색
    sun: 0xffc46b,
    far: 0x3a2350, // 먼 건물 색
    near: 0x22152f, // 가까운 건물 색
    window: 0xffd27a,
    ground: 0xffffff, // 땅 색 (흰색 = 원래 색)
    smoke: 0x555060,
    weather: null,
    bgImage: { key: 'city_bg', file: 'city_bg.jpg' }, // 걸어가는 동안 배경 (Gemini 그림, 부서진 도시 저녁)
    arenaImage: { key: 'city_arena', file: 'city_arena.jpg' }, // 보스전 배경 (Gemini 그림, 고철 처리장)
    groundImage: { key: 'city_ground', file: 'city_ground.png', surface: 2 }, // 바닥 그림 (Gemini 그림, 부서진 도로, 좌우로 이어짐)
    platformImage: { key: 'city_platform', file: 'city_platform.png', left: 90, right: 90, surface: 12, scale: 0.45 }, // 녹슨 철골 발판 (Gemini 그림, 양 끝 90 은 그대로, 가운데만 늘림)
  },

  // 올라설 수 있는 철골 발판 (아래에서 뚫고 올라갈 수 있음)
  platforms: [
    { x: 470, y: 400, w: 128 },
    { x: 660, y: 330, w: 128 },
    { x: 1560, y: 370, w: 128 },
    { x: 1730, y: 270, w: 96 },
    { x: 1900, y: 180, w: 128 },
    { x: 2380, y: 390, w: 160 },
    { x: 2500, y: 300, w: 96 },
  ],

  // 몬스터: 숫자만 쓰면 땅 위 초록 몬스터
  monsters: [1020, 1300, 1460, 2000, 2250, 2480],

  // 보물 상자 (먹으면 사라지고, 한 번 찾은 보물은 다시 안 나옴)
  // 보물: 자리는 들어올 때마다 무작위 (src/logic/treasures.js). 개수는 여기 적은 만큼.
  // power 는 상자에서 나오는 특별한 힘 (speed, shield, power, star, rapid). 없으면 아무거나.
  treasures: [
    { id: 'stage1-roof', power: 'power' },
    { id: 'stage1-chest', power: 'shield' },
    { id: 'stage1-crane', power: 'speed' },
  ],

  signs: [
    { x: 280, text: '{move}  이동\n{jump}  점프\n공중에서 {jump} 한 번 더: 더블 점프!' },
    { x: 840, text: '{punch} 또는 마우스 왼쪽\n{atk}!' },
    { x: 1200, text: '{punch} 를 꾹 눌렀다가 떼면\n{hold}!' },
    { x: 1800, text: '몬스터가 빨개지면 공격 신호\n{dashSign}' },
    { x: 2860, text: '이 앞은 위험 지역!\n각오는 됐지?' },
  ],

  talks: [
    { x: 0, lines: ['히어로! 도시가 엉망이야.', '일단 걸어 보자. 설마 걷는 법 까먹은 건 아니지?', '점프한 다음 공중에서 한 번 더 누르면 더블 점프야!'] },
    { x: 560, lines: ['보물 상자가 어딘가에 숨어 있어! 올 때마다 자리가 바뀐대.'] },
    { x: 900, lines: ['저기 초록 녀석! {atk} 한 방 먹여 줘.'] },
    { x: 1180, lines: ['{holdTip}'] },
    { x: 1500, lines: ['발판 위도 잘 살펴봐. 뭔가 반짝일지도?'] },
    { x: 1760, lines: ['빨개지면 공격 신호야. 대시로 쓩 피해!'] },
    { x: 2300, lines: ['저 앞 빨간 문 보여? 몬스터를 다 잡아야 열려!'] },
    {
      x: 2700,
      lines: [
        '체크포인트! 체력을 꽉 채웠어.',
        '저 앞 괴물은 팔을 바닥에 찍고 나면 잠깐 못 움직여.',
        '그때 {strong}(으)로 팔을 부숴!',
        '주먹이 날아오면 낮을 땐 점프, 높을 땐 가만히!',
      ],
    },
  ],

  arena: { startX: 3000, endX: 3960 },

  boss: {
    type: 'arms', // 보스 종류 (src/boss/index.js)
    name: '파쇄자', // 녹슨 파쇄 기계 (아들이 이름 짓고 그림)
    arms: 2, // 팔 개수 (2 또는 3)
    healthScale: 1.6, // 체력 배수 (balance.js 보스 체력에 곱함)
    speedScale: 1, // 공격 속도 (작을수록 빠름)
    colors: { main: 0x6e4232, light: 0x9a6a50, dark: 0x3a2a24, arm: 0x7a5444 }, // 녹슨 쇠 색
    // [팔 다 있을 때, 팔 1개 부순 뒤, 팔 다 부순 뒤(코어)] 쓰는 공격
    phases: [
      ['slam', 'multiSlam', 'rocketPunch'],
      ['slam', 'sweep', 'rocketPunch', 'inhale'],
      ['rocks', 'shockwave', 'inhale'],
    ],
  },
};
