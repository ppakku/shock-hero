import { sewerMap, sewerTheme } from './sewer.js';

// 해 질 녘 숲. 지금은 자리만 잡아 둔 것이다: 판을 먼저 붙이려고 지하 수로의 맵과 색을 그대로 빌려 쓴다.
// 다음 단계에서 나무와 덤불, 하늘 돔이 있는 진짜 바깥 숲 맵과 테마로 통째로 바꾼다
export const forestMap = sewerMap;
export const forestTheme = { ...sewerTheme };
