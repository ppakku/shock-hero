import Phaser from 'phaser';
import { Monster } from './Monster.js';
import { spitterMove } from '../logic/monsters.js';

// balance.js 에서 숫자를 지워 버려도 돌아가게 쓰는 기본값
const DEFAULTS = { keepAway: 220, shootRange: 460, spitWindup: 0.8, spitSpeed: 230, spitDamage: 12, spitCooldown: 2.2 };

// 침뱉기: 주인공과 거리를 두고 가슴 높이로 느린 침을 뱉는다.
// 거리 두기 → (볼이 부풀고 초록으로 깜빡 + 조준선) 뱉기 준비 → 침 발사 → 쉬기
// 침은 점프로 넘거나 대시로 뚫고 지나가면 된다. 가까이 붙으면 약하다.
export class Spitter extends Monster {
  constructor(scene, spot, cfg) {
    super(scene, spot, cfg);
    this.m = { ...DEFAULTS, ...this.m };
    this.spitCd = 1.0;
    this.aimG = scene.add.graphics().setDepth(4);
    this.baseScale = { x: this.scaleX, y: this.scaleY };
    this.walkTex = this.texture.key;
    this.pose = null;
  }

  // 자세 그림 바꾸기: 'aim'(볼 부풀림), 'spit'(뱉는 순간), null(걷기 시트로 돌아감)
  // art.js 에 걷기 시트와 '<걷기키>_aim' 같은 그림이 있을 때만 바꾸고, 없으면 코드 그림 그대로 둔다.
  // 자세 그림은 걷기 시트 한 칸과 같은 픽셀 크기라서 크기를 다시 맞출 필요가 없다.
  setPose(pose) {
    if (pose === this.pose) return;
    const anim = `${this.walkTex}_anim`;
    const tex = pose ? `${this.walkTex}_${pose}` : this.walkTex;
    if (!this.scene.anims.exists(anim) || !this.scene.textures.exists(tex)) return;
    this.pose = pose;
    if (pose) this.stop().setTexture(tex);
    else this.setTexture(tex).play(anim);
  }

  // 침이 나오는 높이 (주인공 가슴 높이)
  get mouthY() {
    return this.y - 4;
  }

  update(dt) {
    this.spitCd -= dt;
    super.update(dt);
    if (this.state !== 'windup' && !this.dead) {
      this.aimG.clear();
      this.setScale(this.baseScale.x, this.baseScale.y);
      if (this.state !== 'recover') this.setPose(null);
    }
  }

  think(dt) {
    const p = this.scene.nearestPlayer(this.x, this.y); // 함께하기: 가까운 사람을 노린다
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const sameFloor = !p.dead && Math.abs(p.y - this.y) < 90;

    switch (this.state) {
      case 'idle': {
        if (Math.abs(this.x - this.origin) > 70) this.patrolDir = this.x > this.origin ? -1 : 1;
        this.facing = this.patrolDir;
        this.setVelocityX(this.patrolDir * this.m.moveSpeed * 0.4);
        if (dist < this.m.sightRange + 80 && sameFloor) this.changeState('chase');
        break;
      }
      case 'chase': {
        // 주인공을 바라보면서 알맞은 거리를 유지한다 (뒤로 걸을 땐 조금 느림)
        this.faceToward(dx, dt);
        const move = spitterMove(dist, this.m.keepAway, this.m.shootRange);
        this.setVelocityX(move * this.facing * this.m.moveSpeed * (move < 0 ? 0.8 : 1));
        if (this.spitCd <= 0 && sameFloor && dist > this.m.keepAway * 0.7 && dist <= this.m.shootRange) {
          this.setVelocityX(0);
          this.scene.sfxPlay('spitCharge');
          this.changeState('windup');
        } else if (dist > this.m.sightRange * 1.8 || p.dead) {
          this.origin = this.x;
          this.changeState('idle');
        }
        break;
      }
      case 'windup': {
        this.setVelocityX(0);
        this.faceToward(dx, dt);
        this.setPose('aim');
        const k = Math.min(1, this.stateTime / this.m.spitWindup);
        // 볼이 부풀어 오르고 초록으로 깜빡임
        this.setScale(this.baseScale.x * (1 + 0.12 * k), this.baseScale.y * (1 + 0.18 * k));
        if (Math.floor(this.stateTime * 10) % 2 === 0) this.setTint(0x9dff5a);
        else this.clearTint();
        // 침이 날아갈 길을 점선으로 보여 줌
        const g = this.aimG.clear();
        const len = 60 + 200 * k;
        for (let d = 30; d < len; d += 22) g.fillStyle(0x9dff5a, 0.35 + 0.4 * k).fillRect(this.x + this.facing * d - 5, this.mouthY - 2, 10, 4);
        if (this.stateTime >= this.m.spitWindup) {
          this.fireSpit();
          this.setPose('spit'); // 쉬는 동안 뱉은 자세로 있다가 다시 걷기
          this.spitCd = this.m.spitCooldown;
          this.changeState('recover');
        }
        break;
      }
      case 'recover': {
        this.setVelocityX(0);
        if (this.stateTime >= this.m.recoverTime) this.changeState('chase');
        break;
      }
      default:
        this.changeState('chase');
        break;
    }
  }

  fireSpit() {
    const s = this.scene;
    const m = this.m;
    const dir = this.facing;
    s.sfxPlay('spit');
    const ball = s.physics.add.image(this.x + dir * 26, this.mouthY, 'monster_spit').setDepth(8).setFlipX(dir < 0);
    ball.setDisplaySize((22 * ball.width) / ball.height, 22); // 그림 비율 그대로, 높이 22
    ball.body.setAllowGravity(false);
    ball.body.setSize(ball.width * 0.7, ball.height * 0.7, true);
    ball.setVelocityX(dir * m.spitSpeed);
    s.greenGooAt(ball.x, ball.y, 4);
    const pop = () => {
      if (!ball.active) return;
      s.greenGooAt(ball.x, ball.y, 8);
      ball.destroy();
    };
    s.physics.add.collider(ball, s.solids, pop);
    s.physics.add.overlap(s.players, ball, (who) => {
      if (!ball.active || ball.getData('dodged')) return;
      const r = who.hurt(m.spitDamage, ball.x, m.heroKnockback);
      if (r === 'hit') pop();
      else if (r === 'dodged') ball.setData('dodged', true); // 대시로 뚫고 지나감
    });
    // 너무 멀리 가면 사라짐
    const life = (m.shootRange + 300) / Math.max(40, m.spitSpeed);
    s.time.delayedCall(life * 1000, () => {
      if (ball.active) s.tweens.add({ targets: ball, alpha: 0, duration: 150, onComplete: () => ball.destroy() });
    });
  }

  takeHit(attack, dir) {
    this.aimG.clear();
    return super.takeHit(attack, dir);
  }

  die() {
    this.aimG.destroy();
    this.setPose(null);
    this.setScale(this.baseScale.x, this.baseScale.y);
    super.die();
  }
}
