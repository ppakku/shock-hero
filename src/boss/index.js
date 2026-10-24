import { ArmBoss } from './ArmBoss.js';

// stage.boss.type 이름 → 보스 클래스
// 아직 따로 만들지 않은 종류는 팔 보스로 대신한다.
export const BOSS_TYPES = {
  arms: ArmBoss,
  toad: ArmBoss,
  golem: ArmBoss,
  ice: ArmBoss,
  king: ArmBoss,
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
