import { Monster } from './Monster.js';
import { Fros } from './Fros.js';
import { Spitter } from './Spitter.js';
import { ShieldMonster } from './ShieldMonster.js';
// 수중 던전(스테이지 6) 몬스터
import { GoldJellyfish } from './GoldJellyfish.js';
import { Pufferfish } from './Pufferfish.js';
import { Piranha } from './Piranha.js';
import { Crab } from './Crab.js';

export { makeMonsterTextures } from './textures.js';

// 종류 이름 → 몬스터 클래스. 여기에 없는 종류(basic, fast, tank, jumper)는 기본 Monster 가 맡는다.
const CLASSES = {
  fros: Fros, // 프로스 (하늘을 나는 말벌, 아들 디자인)
  spitter: Spitter, // 침뱉기
  shield: ShieldMonster, // 방패병
  // 수중 던전(스테이지 6)
  jelly: GoldJellyfish, // 골드해파리 GX (헤엄침, 아들 디자인)
  puffer: Pufferfish, // 가시복어 뿌뿌 (헤엄침)
  piranha: Piranha, // 이빨 피라냐 (헤엄침)
  crab: Crab, // 집게 꽃게 (바닥을 걸음)
};

// 스테이지 파일의 몬스터 한 줄(spot = { x, y, type })로 몬스터를 만든다.
// 몬스터가 지켜야 할 약속: dead, x, y, m.xp, update(dt), takeHit(attack, dir), getBounds(), flying(하늘을 나는지)
// 느려짐(slowDown, updateSlow)은 Monster 를 물려받으면 저절로 된다.
export function createMonster(scene, spot, cfg) {
  // 수중 스테이지에서는 초록 몬스터(쉬움 난이도가 바꿔 넣는 것) 대신 꽃게가 나온다
  if (scene.stage?.swim && (spot.type === 'basic' || !spot.type)) spot = { ...spot, type: 'crab' };
  const Cls = CLASSES[spot.type] || Monster;
  return new Cls(scene, spot, cfg);
}
