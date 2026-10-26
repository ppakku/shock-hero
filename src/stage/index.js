import { stage1 } from './stage1.js';
import { stage2 } from './stage2.js';
import { stage3 } from './stage3.js';
import { stage4 } from './stage4.js';
import { stage5 } from './stage5.js';
import { stage6 } from './stage6.js'; // 수중 던전 (헤엄치는 스테이지)
import { stage7 } from './stage7.js';
import { stage8 } from './stage8.js';
import { stage9 } from './stage9.js';
import { stage10 } from './stage10.js';
import { stage11 } from './stage11.js';
import { stage12 } from './stage12.js';
import { stage13 } from './stage13.js';
import { stage14 } from './stage14.js';
import { stage15 } from './stage15.js';
import { stage16 } from './stage16.js'; // 심해 협곡 (헤엄치는 스테이지)
import { stage17 } from './stage17.js';
import { stage18 } from './stage18.js';
import { stage19 } from './stage19.js';
import { stage20 } from './stage20.js';

// 순서대로 스테이지 1 ~ 20 (마지막 스테이지 = 맨 끝). 뒤로 갈수록 조금씩 어려워진다.
// 지도는 장(chapter)으로 나뉜다: 스테이지 파일에 chapter 를 적고, 안 적으면 1장.
export const stages = [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8, stage9, stage10, stage11, stage12, stage13, stage14, stage15, stage16, stage17, stage18, stage19, stage20];

export function getStage(n) {
  return stages[Math.min(stages.length, Math.max(1, n)) - 1];
}

export const totalTreasures = stages.reduce((sum, s) => sum + s.treasures.length, 0);

// 장 목록: [{ chapter: 1, name, stages: [스테이지 번호...] }]
export const CHAPTER_NAMES = { 1: '1장: 무너진 도시', 2: '2장: 괴물 대륙' };
export const chapterOf = (st) => st.chapter || 1;
export const chapters = [...new Set(stages.map(chapterOf))].map((c) => ({
  chapter: c,
  name: CHAPTER_NAMES[c] || `${c}장`,
  stages: stages.map((st, i) => (chapterOf(st) === c ? i + 1 : null)).filter(Boolean),
}));
