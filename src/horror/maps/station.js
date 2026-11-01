import { parseMap } from '../../logic/horrorGrid.js';

// 마지막 밤의 기차역. 글자 뜻은 docs/superpowers/plans/2026-10-31-horror-mode.md 의 맵 표기 참고. Y 는 둘째 괴물이 서는 칸이다.
// 위에서부터 멈춰 선 막차, 승강장, 대합실과 매표소와 상점, 지하도, 아래층 방이 층층이 놓인다.
// 날개 두 곳은 잠긴 문 하나로만 들어간다: A 는 막차 안, B 는 오른쪽 아래 짐 창고.
export const stationMap = { ...parseMap([
  '########################################',
  '#...F...R.#..N...F.R.#...K....R.#..F..R#',
  '#.R.........F.............X.........F..#',
  '#..N.F....#....R.....#..F.....F.#...X..#',
  '##L##L###L###L###L##A##L###L###L###L####',
  '#..R....C.......X......R......X....R...#',
  '#.....#.....#..R..#.....#..R..#.....#..G',
  '#.R.....F....R..........C.....R...F..R.#',
  '##D#L#D#L##D#L###D#L##D##L#D#L##D#L#####',
  '#......E...#......R...#....N.......#.R.#',
  '#.R..F.....#...F......#..R.........#...#',
  '#.......R..#.....#....#.......F....#...#',
  '#..X...N...#.....#.R..#...X....K...D...#',
  '#.....F....#.K........#.......R....#.N.#',
  '#R.........#..F......E#...F......P.#...#',
  '##D#L#D#L##D#L#####D#L##D#L#D#L#D#L##D##',
  '#...R........X.......R..........C......#',
  '#.................M.........R......Y...#',
  '#.R.....C.........R........X.........R.#',
  '##D#L#D#L##D#L#D#L#D#L##B#L####L####L###',
  '#......L.......#.N...#.................#',
  '#.R....#..F.R..#..R..#..F..R...K....F..#',
  '#..S...D.....N.D.....#......##...R.....#',
  '#......#..K....#.X.F.#..R...##..X...N..#',
  '#E.....L....C..#...C.#....F.....R....E.#',
  '########################################',
]), solidLockers: true }; // 보관함이 칸을 꽉 채워서 눈을 막는다

export const stationTheme = {
  doorSet: 'horror_door_station', // 잠긴 문 그림. 뒤에 _red, _blue 가 붙는다
  wall: { art: 'horror_station_wall', plain: 0x6a7068, repeat: 1, tint: 0x8a94a8 },
  floor: { art: 'horror_station_floor', plain: 0x4a4a4e, repeat: 7, tint: 0xa0a0a8 },
  locker: { art: 'horror_station_locker', plain: 0x5a6a78, repeat: 2, repeatY: 1, tint: 0xc8c8c8, box: { w: 3, h: 3, d: 3 } }, // 벽에 박힌 물품 보관함
  doorArt: 'locker',
  board: { art: 'horror_station_board', plain: 0xffffff, repeat: 1 }, // 시간표와 안내판
  ceil: 0x1c1e26,
  fog: 0x03040c,
  ambient: 0x6a78a0,
  lightColor: 0xffc060, // 남아 있는 노란 역 전등
  decor: {
    tile: 7,
    light: { w: 0.8, h: 0.26, d: 0.08, y: 2.5 },
    machine: { w: [2.4, 1.3], h: [1.1, 0.9], y: 1.05, depth: 0.07, tints: [0xb0a890, 0x8fa0b0, 0xc8b070, 0xa0a8a0] },
    pipe: { r: 0.05, off: 0.1, ys: [0.3, 0.42], color: 0x4a4a46 },
    low: { w: 1.6, h: 0.5, d: 0.5, color: 0x3a3028 }, // 벽에 붙은 긴 의자
    lintel: { h: 0.7 },
  },
};
