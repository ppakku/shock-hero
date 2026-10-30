import { stage1 } from './stage1.js';

// 겨루기 경기장: 화면 한 칸 크기라 스크롤이 없다. 모험 지도의 스테이지가 아니라서 stages 목록에는 없다.
const { bgImage: _walkBg, arenaImage, ...theme } = stage1.theme;

export const versusArena = {
  name: '겨루기 경기장',
  width: 960,
  groundY: 480,
  playerStartX: 170, // 1P 자리 (2P 는 오른쪽 끝에서 같은 거리)
  checkpointX: -200, // 깃발은 화면 밖에 둔다
  theme: { ...theme, bgImage: arenaImage }, // 파괴된 도시의 보스 방 배경을 다시 쓴다
  platforms: [
    { x: 250, y: 370, w: 160 },
    { x: 710, y: 370, w: 160 },
    { x: 480, y: 270, w: 180 },
  ],
  monsters: [],
  treasures: [],
  signs: [],
  talks: [],
};

// 겨루기에는 보스가 없다. GameScene 과 주인공 기술이 부르는 자리만 채운다
export const noBoss = {
  blocker: null,
  defeated: false,
  state: 'dead',
  update() {},
  receiveAttack: () => false,
  receiveUltimate: () => false,
};

// 겨루기에는 볼트도 나오지 않는다 (대사는 조용히 넘어간다)
export const noRobot = {
  queue: [],
  bubble: { setVisible() {} },
  say() {},
  update() {},
  setStats() {},
};
