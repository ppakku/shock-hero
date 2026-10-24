import { ArmBoss } from './ArmBoss.js';
import { IceBoss } from './IceBoss.js';
import { KingBoss } from './KingBoss.js';
import { WatcherBoss } from './WatcherBoss.js';
import { DragonBoss } from './DragonBoss.js';

// stage.boss.type 이름 → 보스 클래스
// 아직 따로 만들지 않은 종류는 팔 보스로 대신한다.
export const BOSS_TYPES = {
  arms: ArmBoss,
  ice: IceBoss,
  king: KingBoss,
  watcher: WatcherBoss, // 스테이지 2: 포레스트 와처 (아들이 디자인)
  dragon: DragonBoss, // 스테이지 3: 아스트라노바X (아들이 디자인)
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
