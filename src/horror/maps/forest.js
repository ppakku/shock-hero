import { parseMap } from '../../logic/horrorGrid.js';

// 해 질 녘 숲. 글자 뜻은 docs/superpowers/plans/2026-10-31-horror-mode.md 의 맵 표기 참고.
// '#' 은 나무와 덤불, L 은 속 빈 고목 (숨는 곳), G 는 숲 끝의 쇠문이다. 문은 잠긴 울타리 문 둘뿐이다.
// 한두 칸 너비의 오솔길이 빈터(공터)들을 굽이굽이 잇고, 곳곳이 고리로 돈다.
// 날개 두 곳은 잠긴 문 하나로만 들어간다: A 는 왼쪽 위 빈터, B 는 오른쪽 아래 빈터.
export const forestMap = { ...parseMap([
  '######################################',
  '#######E#######N..#.F####E############',
  '##F.........##..F.......R..########L##',
  '#L....#####.#L...R.K.#####.....X.....G',
  '##.R..##....###........L##.#####L##.##',
  '##N...##.K#.####X#E###.###R#L######.##',
  '####.#L####F####.#####R###......###RL#',
  '####...X..R.####R####L.####...C..##X##',
  '######A###L####L.#####........M.....##',
  '#L....R...######.#######L##..R..N##.##',
  '##..#L###.#####....#########...F###R##',
  '##..#####R####R..F..########.######.L#',
  '##F.###.X.R#L#...........R...L#####F##',
  '##..###.F.......C.N.###.####F######.##',
  '##R.###K...###.....R##L.####.#####..##',
  '#L.......#####F....####.####.K.R...###',
  '##.N####P###....#.#####F#L#####E######',
  '##X.L#######R##L#.#####...######..F.##',
  '##..########.####.#L###R#.##.....##.##',
  '#........R...####.......#.#.F...###RL#',
  '#...C.######.....######.#.B...R.....##',
  '#..S..######...R..#####X#L#.....#L#.##',
  '#....N#####L.F....###L#K####.N...##F##',
  '#F..F.L#####.....F..N...######L#.X..##',
  '######################################',
]), solidLockers: true, hideName: '고목' }; // 고목이 칸을 꽉 채워서 눈을 막는다. 숨을 곳을 사물함 대신 고목이라 부른다

export const forestTheme = {
  outdoor: true, // 천장 대신 하늘 돔, 상자 벽 대신 나무와 덤불, 벽 장식 대신 숲 장식 (world.js)
  doorSet: 'horror_door_forest', // 사슬 감긴 나무 울타리 문. 뒤에 _red, _blue 가 붙는다
  wall: { art: 'horror_forest_bark', plain: 0x3a2e26, repeat: 1, repeatY: 3, tint: 0xb8a898 }, // 나무줄기 껍질
  floor: { art: 'horror_forest_floor', plain: 0x2a2418, repeat: 7, tint: 0xb0a898 },
  locker: { art: 'horror_forest_hollow', plain: 0x4a3a2a, repeat: 1, card: { w: 3.4, h: 3 } }, // 속 빈 고목. 길 쪽을 보는 그림 한 장
  fog: 0x8c5a4b,
  ambient: 0xffd8b0,
  lightColor: 0xffb040,
  sky: { art: 'horror_forest_sky', radius: 40, horizon: 0.55 }, // 하늘 돔. horizon: 지평선 쪽을 dusk 의 낮은 하늘색으로 덮는 정도
  trees: {
    trunk: { h: [5, 8], r: [0.22, 0.4], jitter: 0.7, sides: 7 }, // 높이, 밑동 반지름 (미터), 칸 가운데에서 벗어나는 거리
    crown: { art: 'horror_forest_crown', w: [4.5, 6.5], aspect: 0.58, drop: 0.6 }, // 줄기 끝에서 drop 만큼 내려온 곳이 수관 가운데
    bush: { art: 'horror_forest_bush', w: 3.8, h: [2.3, 3], inset: [0.15, 0.95], slide: 0.9 }, // 길을 마주한 면마다 두 겹 (효과 줄이기면 앞 겹만)
  },
  gate: { art: 'horror_forest_gate', w: 5.4, h: 3.8 },
  decor: {
    outdoor: true,
    totem: { art: 'horror_forest_totem', w: 1.15, h: 3.2, ahead: 4 }, // 장승 한 쌍. 시작에서 ahead 칸 나아간 길 양옆
    cairn: { art: 'horror_forest_cairn', w: 2.4, h: 2.25, count: 3 }, // 서낭당 돌무더기. 빈터 가장자리
    hair: { art: 'horror_forest_hair', w: 1.5, h: 1.9, y: 1.95, count: 9 }, // 가지에 걸린 머리카락. 눈높이 바로 위에서 늘어진다
  },
};
