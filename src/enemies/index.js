import { Monster } from './Monster.js';
import { Fros } from './Fros.js';
import { Spitter } from './Spitter.js';
import { ShieldMonster } from './ShieldMonster.js';

export { makeMonsterTextures } from './textures.js';

// 종류 이름 → 몬스터 클래스. 여기에 없는 종류(basic, fast, tank, jumper)는 기본 Monster 가 맡는다.
const CLASSES = {
  fros: Fros, // 프로스 (하늘을 나는 말벌, 아들 디자인)
  spitter: Spitter, // 침뱉기
  shield: ShieldMonster, // 방패병
};

// 스테이지 파일의 몬스터 한 줄(spot = { x, y, type })로 몬스터를 만든다.
// 몬스터가 지켜야 할 약속: dead, x, y, m.xp, update(dt), takeHit(attack, dir), getBounds(), flying(하늘을 나는지)
export function createMonster(scene, spot, cfg) {
  const Cls = CLASSES[spot.type] || Monster;
  return new Cls(scene, spot, cfg);
}
