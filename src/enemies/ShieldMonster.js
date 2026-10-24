import { Monster } from './Monster.js';
import { floatText } from '../fx/effects.js';
import { shieldResult } from '../logic/monsters.js';

// balance.js 에서 숫자를 지워 버려도 돌아가게 쓰는 기본값
const DEFAULTS = { guardBreakTime: 3.0, guardBreakStun: 1.0, turnDelay: 0.5 };

// 방패병: 앞쪽 방패로 기본 펀치를 막는다 ("막힘!").
// 충전 펀치를 앞에서 맞으면 방패가 깨지고 비틀거린다. 뒤에서 때리면 언제나 들어간다.
// 몸을 천천히 돌려서, 뒤로 돌아가거나 넘어가면 잠깐 등이 보인다.
export class ShieldMonster extends Monster {
  constructor(scene, spot, cfg) {
    super(scene, spot, cfg);
    this.m = { ...DEFAULTS, ...this.m };
    this.guardUp = true;
    this.guardTimer = 0;
    this.turnTimer = 0;
  }

  update(dt) {
    if (!this.dead && !this.guardUp) {
      this.guardTimer -= dt;
      if (this.guardTimer <= 0) this.raiseGuard();
    }
    super.update(dt);
  }

  // 방향을 바로 바꾸지 않고 turnDelay 초 뒤에 돈다
  faceToward(dx, dt) {
    const want = Math.sign(dx) || this.facing;
    if (want === this.facing) {
      this.turnTimer = 0;
      return;
    }
    this.turnTimer += dt;
    if (this.turnTimer >= this.m.turnDelay) {
      this.facing = want;
      this.turnTimer = 0;
    }
  }

  takeHit(attack, dir) {
    if (this.dead) return false;
    const result = shieldResult(attack.kind, dir, this.facing, this.guardUp);
    if (result === 'blocked') {
      this.block(dir);
      return true;
    }
    const hit = super.takeHit(attack, dir);
    if (result === 'break' && !this.dead) this.breakGuard();
    return hit;
  }

  // 방패로 막음: 피해 없음, 살짝 밀림
  block(dir) {
    const s = this.scene;
    s.sfxPlay('tink');
    floatText(s, this.x + this.facing * 20, this.y - 40, '막힘!', '#bfe4ff', 22);
    s.sparks.explode(6, this.x + this.facing * 24, this.y - 4);
    this.setVelocityX(dir * 90);
    if (!s.shieldTipShown) {
      s.shieldTipShown = true;
      s.robot?.say('방패에 막혔어! 충전 펀치로 방패를 깨거나 뒤로 돌아가서 때려!', true);
    }
  }

  // 충전 펀치에 방패가 깨짐
  breakGuard() {
    const s = this.scene;
    this.guardUp = false;
    this.guardTimer = this.m.guardBreakTime;
    this.setTexture('monster_shield_broken').setDisplaySize(52 * this.m.size, 48 * this.m.size);
    s.sfxPlay('shieldBreak');
    floatText(s, this.x, this.y - 56, '방패 깨짐!', '#ffd23f', 24);
    s.sparks.explode(14, this.x + this.facing * 24, this.y - 4);
    // 깨진 방패 조각이 날아감
    const piece = s.add.image(this.x + this.facing * 22, this.y, 'monster_shield_piece').setDepth(6);
    s.tweens.add({
      targets: piece,
      x: piece.x - this.facing * 80,
      y: piece.y - 60,
      angle: 260,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => piece.destroy(),
    });
    if (this.state === 'stunned') this.stunTime = Math.max(this.stunTime, this.m.guardBreakStun);
  }

  raiseGuard() {
    this.guardUp = true;
    this.setTexture('monster_shield').setDisplaySize(52 * this.m.size, 48 * this.m.size);
    floatText(this.scene, this.x, this.y - 50, '방패!', '#bfe4ff', 18);
  }
}
