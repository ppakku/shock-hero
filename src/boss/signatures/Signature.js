import { warnBox } from '../bossKit.js';

// 변종 보스의 전용 공격 하나. 보스 파일을 키우지 않으려고 따로 둔다.
// 하위 클래스는 step(dt) 만 채운다. 끝나면 true 를 돌려준다.
// this.g 는 프레임마다 지워지니 step 에서 매번 그린다. 함께하기에서도 맞도록 피해는 this.hurt 로 준다.
export class Signature {
  constructor(boss) {
    this.boss = boss;
    this.scene = boss.scene;
    this.t = 0;
    this.g = this.scene.add.graphics().setDepth(7);
    this.objects = [];
  }

  get groundY() {
    return this.boss.groundY;
  }

  // 분노하면 빨라지는 보스 박자. 시간에 곱한다.
  get speed() {
    return this.boss.speed;
  }

  update(dt) {
    this.t += dt;
    this.g.clear();
    return this.step(dt);
  }

  step(_dt) {
    return true;
  }

  warnAt(x0, y0, w, h) {
    warnBox(this.g, x0, y0, w, h, this.t);
  }

  hurt(rect, damage, fromX, hits = null) {
    return this.boss.hurtPlayer(rect, damage, fromX, undefined, hits);
  }

  // 공격이 끝나면 같이 지울 그림
  own(obj) {
    this.objects.push(obj);
    return obj;
  }

  destroy() {
    this.g.destroy();
    for (const o of this.objects) o.destroy?.();
    this.objects = [];
  }
}
