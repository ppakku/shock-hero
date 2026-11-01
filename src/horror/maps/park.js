import { parseMap } from '../../logic/horrorGrid.js';

// 문 닫은 놀이공원. 글자 뜻은 docs/superpowers/plans/2026-10-31-horror-mode.md 의 맵 표기 참고.
// 유령의 집 안처럼 꺾인 복도와 작은 방이 얽혀 있어 멀리 보이지 않는다. 오른쪽 아래 입구에서 시작해 왼쪽 위 정문으로 나간다.
// 날개 두 곳은 잠긴 문 하나로만 들어간다: A 는 오른쪽 위 거울 방, B 는 왼쪽 아래 놀이기구 창고.
export const parkMap = { ...parseMap([
  '####L########L#######L########L####L####',
  '#....N##.....F###...R...###.F..#...K...#',
  '#.R....##..........##.....#....#.F...N.#',
  'G..F...###..R..##....X.......C.#..##...#',
  '#........##...###..F...##......A..##.R.#',
  '##L#..R..#...##.....###.##.R...#.......#',
  '#...........##..N.#L#.....##...#.##..E.#',
  '#..C.##.F...#...##..K...R..#..L#..##...#',
  '#...###.....D...#.....##...D...#F.##...#',
  '##.....R..###..###.F.###..###..#.....R.L',
  '#L..X...###.....#.......#....#.#########',
  '##..F..##...R.###...X...D..R...#......L#',
  '#...#L#.....##...M......#..###..F.##...#',
  '#.R.....F.###...R###.N.##..P...#.....R.#',
  '#L#.##.....#..F..#.....#..X.####.##....#',
  '#....###.X.D.....D..R...##.....#..#.F..#',
  '#.K....N##.###.###...##...#.E..##.....R#',
  '#####B######.#..C...###.F.##.....##.X..#',
  '#..F....R..#.R..##.....#.....#.R....#..#',
  '#.......#..#.....##.F...###.....F..##..#',
  '#.##..N.#..L..#.......##...X.##..N..K..L',
  '#..L.......#..##.R..#L#..N.###...##....#',
  '#..##.F.##.#....##.......##.....##..E..#',
  '#.......E..#.F.....##.R......#...S.....#',
  '#L....#....#..K..#.....C..#.......F....#',
  '####L#########L#######L#####L####L######',
]), solidLockers: true }; // 옷장이 칸을 꽉 채워서 눈을 막는다

export const parkTheme = {
  doorSet: 'horror_door_park', // 잠긴 문 그림. 뒤에 _red, _blue 가 붙는다
  wall: { art: 'horror_park_wall', plain: 0x5a3e38, repeat: 1, tint: 0xa8a0a0 },
  floor: { art: 'horror_park_floor', plain: 0x2e2628, repeat: 7, tint: 0xa8a8a8 },
  locker: { art: 'horror_park_locker', plain: 0x3a5a58, repeat: 1, tint: 0xa8a8a8, box: { w: 3, h: 3, d: 3 } }, // 벽에 박힌 낡은 옷장
  doorArt: 'locker',
  board: { art: 'horror_park_board', plain: 0xffffff, repeat: 1 }, // 빛바랜 간판
  ceil: 0x1c1820,
  ceilArt: { art: 'horror_ceil_park', repeat: 7, tint: 0x807888 },
  fog: 0x060308,
  ambient: 0x8a6c98,
  lightColor: 0xffa848, // 희미한 색 전구
  decor: {
    tile: 7,
    light: { w: 1.5, h: 0.42, d: 0.08, y: 2.45, art: 'horror_light_park' }, // 색 전구 줄
    machine: { w: [2.2, 1.6], h: [1.1, 0.8], y: 1.5, depth: 0.07, tints: [0xc0b0a0, 0xa8b0b8] },
    // 놀이기구와 매표소는 벽에 붙은 한 조각으로 보인다
    extra: [
      { art: 'horror_park_ride', plain: 0x5a4030, w: [2.6], h: [2.6], y: 0, depth: 0.1, tints: [0xc0b8b0] },
      { art: 'horror_park_booth', plain: 0x6a4a3a, w: [2.3], h: [2.5], y: 0, depth: 0.1, tints: [0xc0b8b0] },
    ],
    pipe: { r: 0.05, off: 0.1, ys: [1.0], color: 0x6a3a34, art: 'horror_pipe_park', repeat: 4, tint: 0xa8a0a0 }, // 줄무늬 난간
    low: { w: 1.6, h: 0.95, d: 0.4, color: 0x5a3028, art: 'horror_rail_park', cut: true, band: 0.03, tint: 0xa0a0a0 }, // 줄 서던 울타리
    lintel: { h: 0.7 },
  },
};
