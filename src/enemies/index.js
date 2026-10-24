import { Monster } from './Monster.js';

export { makeMonsterTextures } from './textures.js';

// 스테이지 파일의 몬스터 한 줄(spot = { x, y, type })로 몬스터를 만든다.
// 몬스터가 지켜야 할 약속: dead, x, y, m.xp, update(dt), takeHit(attack, dir), getBounds(), flying(하늘을 나는지)
export function createMonster(scene, spot, cfg) {
  return new Monster(scene, spot, cfg);
}
