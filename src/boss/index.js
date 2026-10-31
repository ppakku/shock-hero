import { ArmBoss } from './ArmBoss.js';
import { FrostAstraBoss } from './FrostAstraBoss.js';
import { KingBoss } from './KingBoss.js';
import { WatcherBoss } from './WatcherBoss.js';
import { DragonBoss } from './DragonBoss.js';
import { ShredderBoss } from './ShredderBoss.js';
import { SeaBoss } from './SeaBoss.js'; // 스테이지 6 수중 던전 보스 (임시 디자인: 심해 아귀왕)

// stage.boss.type 이름 → 보스 클래스
// 아직 따로 만들지 않은 종류는 팔 보스로 대신한다.
export const BOSS_TYPES = {
  arms: ArmBoss,
  shredder: ShredderBoss, // 스테이지 1: 파쇄자 (아들이 그림). 배 톱니로 싸우고 돌아다닌다
  ice: FrostAstraBoss, // 스테이지 4: 혹한의 아스트라 (아들이 디자인)
  king: KingBoss,
  watcher: WatcherBoss, // 스테이지 2: 포레스트 와처 (아들이 디자인)
  dragon: DragonBoss, // 스테이지 3: 아스트라노바X (아들이 디자인)
  sea: SeaBoss, // 물속을 헤엄치는 보스
};

export function bossClassFor(stage) {
  return BOSS_TYPES[stage.boss.type] || ArmBoss;
}

export function createBoss(scene, cfg, stage, skin) {
  const Cls = bossClassFor(stage);
  return new Cls(scene, cfg, stage, skin);
}

// 시작할 때 모든 스테이지 보스 그림을 만든다
export function makeBossTextures(scene, stages) {
  stages.forEach((st, i) => bossClassFor(st).makeTextures?.(scene, st, i + 1));
}
