import { Monster } from './Monster.js';
import { makeSeaMonsterTextures } from './seaTextures.js';

// 집게 꽃게: 바닥을 옆걸음으로 다니는 게. 땅 몬스터라서 중력과 발판, 보스 문을 그대로 따른다.
// 움직임은 초록 몬스터와 같다: 쫓아오기 → (빨갛게 깜빡 + "!", 집게를 번쩍) → 집게로 꽉 → 멍하게 쉬기
// 헤엄쳐서 위로 피하거나 대시로 피한 다음, 쉴 때 때리면 된다.
export class Crab extends Monster {
  constructor(scene, spot, cfg) {
    makeSeaMonsterTextures(scene);
    super(scene, spot, cfg);
    this.setTexture('monster_crab');
    this.setDisplaySize(56 * this.m.size, 45 * this.m.size);
    this.body.setSize(this.width * 0.8, this.height * 0.8, true);
    this.baseScaleY = this.scaleY;
    this.walkT = 0;
  }

  update(dt) {
    super.update(dt);
    if (this.dead) return;
    // 옆걸음 들썩들썩, 공격 준비 때는 집게를 들어 올리듯 커짐
    this.walkT += dt * (Math.abs(this.body.velocity.x) > 10 ? 18 : 4);
    const lift = this.state === 'windup' ? 1.12 : 1;
    this.scaleY = this.baseScaleY * lift * (1 + Math.sin(this.walkT) * 0.04);
  }
}
