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

// 순서대로 스테이지 1 ~ 10 (마지막 스테이지 = 맨 끝). 뒤로 갈수록 조금씩 어려워진다.
export const stages = [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8, stage9, stage10];

export function getStage(n) {
  return stages[Math.min(stages.length, Math.max(1, n)) - 1];
}

export const totalTreasures = stages.reduce((sum, s) => sum + s.treasures.length, 0);
