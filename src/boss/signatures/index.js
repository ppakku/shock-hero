import { armsSignatures } from './arms.js';
import { dragonSignatures } from './dragon.js';
import { iceSignatures } from './ice.js';
import { kingSignatures } from './king.js';
import { seaSignatures } from './sea.js';
import { watcherSignatures } from './watcher.js';

// stage.boss.signature 이름 → 전용 공격 클래스
export const SIGNATURES = { ...armsSignatures, ...dragonSignatures, ...iceSignatures, ...kingSignatures, ...seaSignatures, ...watcherSignatures };
