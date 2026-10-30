import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { flash, floatText } from '../fx/effects.js';
import { makeText } from '../ui/text.js';
import { monsterStats, pushedKnockback, canStagger } from '../logic/monsters.js';
import { workshopStats } from '../logic/workshop.js';
import { NO_SLOW, SLOW_TINT, addSlow, tickSlow, slowedStats } from '../logic/slow.js';

export const TEXTURE = {
  basic: 'monster',
  fast: 'monster_fast',
  tank: 'monster_tank',
  jumper: 'monster_jumper',
  fros: 'monster_fros',
  spitter: 'monster_spitter',
  shield: 'monster_shield',
};

const SHEET_SIZE = 1.15; // 스프라이트 시트 그림은 칸에 꽉 차게 잘라서 코드 그림보다 조금 크게
const Rect = Phaser.Geom.Rectangle;

// 몬스터: 순찰 → 추격 → (빨개짐) 공격 준비 → 달려들기(뜀뛰기는 점프) → 멍하게 쉬기
export class Monster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, spot, cfg) {
    // 몬스터 공방 작품이면 spot.workshop 에 작품, spot.tex 에 칠한 그림 이름이 온다 (크기와 체력은 작품대로)
    const w = spot.workshop || null;
    const m = w ? workshopStats(monsterStats(cfg, spot.type), w) : monsterStats(cfg, spot.type);
    const x = spot.x;
    const y = spot.y - 30 * m.size;
    // 스테이지마다 어울리는 생김새 (theme.monsterSkins, 예: 용암 지대의 초록 몬스터는 불꽃 슬라임). 움직임과 세기는 그대로
    const skin = scene.stage?.theme?.monsterSkins?.[m.type];
    const tex = w && spot.tex && scene.textures.exists(spot.tex) ? spot.tex : skin && scene.textures.exists(skin) ? skin : TEXTURE[m.type];
    super(scene, x, y, tex);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.workshop = w;
    this.dexId = w ? null : tex; // 몬스터 도감 칸 (src/logic/dex.js). 공방 작품은 따로 센다
    this.sizeToLook(tex, m.size);
    this.body.setSize(this.width * 0.8, this.height * 0.85, true);
    this.setCollideWorldBounds(true);
    this.setDragX(900);
    this.setDepth(5);

    this.m = m;
    this.type = m.type;
    this.health = new Health(this.m.maxHealth);
    this.state = 'idle';
    this.stateTime = 0;
    this.stunTime = 0;
    this.lastStaggerAt = -Infinity;
    this.facing = -1;
    this.origin = x;
    this.patrolDir = -1;
    this.hasHit = false;
    this.dead = false;
    this.flying = false; // 하늘을 나는 몬스터만 true
    this.slow = NO_SLOW; // 얼음에 맞아 느려진 상태 (src/logic/slow.js)
    this.baseStats = null; // 느려지기 전 숫자 (느려진 동안만)
    this.alert = makeText(scene, x, y - 40, '!', 28, '#ff4444').setOrigin(0.5).setDepth(30).setVisible(false);
    // 공방 작품은 머리 위에 이름표
    this.nameTag = w ? makeText(scene, x, y, w.name, 13, '#ffe14a').setOrigin(0.5, 1).setDepth(29) : null;
  }

  changeState(state) {
    this.state = state;
    this.stateTime = 0;
    this.alert.setVisible(state === 'windup');
    if (state !== 'windup') this.clearTint();
  }

  // 그림 크기 맞추기: art.js 에 걷기 스프라이트 시트(8장, 오른쪽을 봄)가 있으면 칸 비율대로 맞추고 반복 재생, 없으면 코드 그림 한 장
  sizeToLook(tex, size) {
    if (this.scene.anims.exists(`${tex}_anim`)) {
      const h = 48 * size * SHEET_SIZE;
      this.setDisplaySize((h * this.width) / this.height, h).play({ key: `${tex}_anim`, startFrame: Phaser.Math.Between(0, 7) });
    } else {
      this.setDisplaySize(52 * size, 48 * size);
    }
  }

  // 생김새 바꾸기 (예: 방패병의 방패가 깨짐)
  setLook(tex) {
    this.stop().setTexture(tex);
    this.sizeToLook(tex, this.m.size);
  }

  update(dt) {
    if (this.dead) return;
    this.stateTime += dt;
    this.alert.setPosition(this.x, this.y - 40 * this.m.size);
    this.nameTag?.setPosition(this.x, this.y - this.displayHeight / 2 - 4);
    if (!this.updateHurt()) this.think(dt);
    this.setFlipX(this.facing < 0);
  }

  // 맞고 비틀거리거나 쓰러져 있는 동안. 그런 상태면 true
  updateHurt() {
    if (this.state === 'stunned') {
      if (this.stateTime >= this.stunTime) this.changeState('chase');
      return true;
    }
    if (this.state === 'down') {
      if (this.stateTime >= 1.0) {
        this.setAngle(0);
        this.changeState('chase');
      }
      return true;
    }
    return false;
  }

  // 주인공 쪽으로 몸을 돌린다 (방패병은 천천히 돈다)
  faceToward(dx, _dt) {
    this.facing = Math.sign(dx) || this.facing;
  }

  // 종류마다 다르게 움직이는 부분 (기본: 순찰, 추격, 공격 준비, 달려들기, 쉬기)
  think(dt) {
    const p = this.scene.nearestPlayer(this.x, this.y); // 함께하기: 가까운 사람을 노린다
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const playerReachable = !p.dead && Math.abs(p.y - this.y) < 90;

    switch (this.state) {
      case 'idle': {
        if (Math.abs(this.x - this.origin) > 80) this.patrolDir = this.x > this.origin ? -1 : 1;
        this.facing = this.patrolDir;
        this.setVelocityX(this.patrolDir * this.m.moveSpeed * 0.4);
        if (dist < this.m.sightRange && playerReachable) this.changeState('chase');
        break;
      }
      case 'chase': {
        this.faceToward(dx, dt);
        this.setVelocityX(dist > 30 ? this.facing * this.m.moveSpeed : 0);
        if (dist <= this.m.attackRange && playerReachable) {
          this.setVelocityX(0);
          this.changeState('windup');
        } else if (dist > this.m.sightRange * 1.5 || p.dead) {
          this.origin = this.x;
          this.changeState('idle');
        }
        break;
      }
      case 'windup': {
        this.setVelocityX(0);
        this.faceToward(dx, dt);
        // 빨간 깜빡임 + "!" 로 공격 신호
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xff3030);
        else this.clearTint();
        if (this.stateTime >= this.m.windupTime) {
          this.hasHit = false;
          this.setVelocityX(this.facing * this.m.lungeSpeed);
          if (this.type === 'jumper') this.setVelocityY(-520);
          this.changeState('attack');
        }
        break;
      }
      case 'attack': {
        if (!this.hasHit) {
          const result = this.scene.hurtPlayersIn(this.attackRect(), this.m.damage, this.x, this.m.heroKnockback);
          if (result !== 'ignored' && result !== 'miss') this.hasHit = true;
        }
        if (this.type === 'jumper') {
          // 뜀뛰기는 땅에 내려앉을 때까지 날아간다
          this.setVelocityX(this.hasHit ? this.body.velocity.x * 0.9 : this.facing * this.m.lungeSpeed * 0.8);
          const landed = this.stateTime > 0.15 && (this.body.blocked.down || this.body.touching.down);
          if (landed || this.stateTime > 1.4) {
            this.scene.dustAt(this.x, this.y + 20, 5);
            this.changeState('recover');
          }
          break;
        }
        // 주인공에게 닿으면 멈춘다 (뚫고 지나가지 않게)
        const ahead = dx * this.facing;
        this.setVelocityX(this.hasHit || ahead < 36 ? 0 : this.facing * this.m.lungeSpeed);
        if (this.stateTime >= this.m.attackTime) this.changeState('recover');
        break;
      }
      case 'recover': {
        if (this.stateTime >= this.m.recoverTime) this.changeState('chase');
        break;
      }
      default:
        break;
    }
  }

  attackRect() {
    const s = this.m.size;
    if (this.type === 'jumper' && this.state === 'attack') return new Rect(this.x - 26, this.y - 24, 52, 48);
    const w = 46 * s;
    const x = this.facing > 0 ? this.x + 8 : this.x - 8 - w;
    return new Rect(x, this.y - 20 * s, w, 40 * s);
  }

  takeHit(attack, dir) {
    if (this.dead) return false;
    this.health.damage(attack.damage);
    floatText(this.scene, this.x, this.y - 30, String(attack.damage), attack.kind === 'charged' ? '#ffd23f' : '#ffffff', attack.kind === 'charged' ? 26 : 20);
    flash(this.scene, this);
    // 쓰러질지는 원래 펀치 힘으로 정하고, 실제로 밀리는 거리만 줄인다
    const k = attack.knockback || 0;
    const push = pushedKnockback(k, this.m.knockbackScale);
    if (!this.health.isDead && k < this.m.downKnockback && !this.stagger(0.25 + k / 1200)) {
      // 버티는 중: 하던 일을 계속하고 살짝만 밀린다
      this.setVelocityX(dir * push * 0.25);
      return true;
    }
    this.setVelocity(dir * push, -Math.min(push * 0.5, 420));
    this.facing = -dir;

    if (this.health.isDead) {
      this.die();
    } else if (k >= this.m.downKnockback) {
      this.changeState('down');
      this.setAngle(90 * dir);
    }
    return true;
  }

  // 얼음에 맞아 잠깐 느려진다 (slow = { time, multiplier }). 움직임은 모두 this.m 의 속도를 읽으니 숫자만 바꾼다.
  slowDown(slow) {
    if (this.dead) return;
    this.slow = addSlow(this.slow, slow);
    if (this.slow.left <= 0) return;
    this.baseStats ??= this.m;
    this.m = slowedStats(this.baseStats, this.slow.multiplier);
  }

  // 느려짐 시간이 흐른다 (GameScene 이 update 뒤에 부른다. 종류마다 update 가 달라서 여기로 뺐다)
  updateSlow(dt) {
    if (this.dead || !this.baseStats) return;
    this.slow = tickSlow(this.slow, dt);
    if (this.slow.left <= 0) {
      this.m = this.baseStats;
      this.baseStats = null;
      if (this.tintTopLeft === SLOW_TINT) this.clearTint();
    } else if (!this.isTinted) {
      this.setTint(SLOW_TINT); // 공격 신호처럼 다른 색을 쓰는 동안은 양보한다
    }
  }

  // 맞고 비틀거린다. 얼마 전에 비틀거렸으면 버티고 false (cfg.difficulty.stunGuard)
  stagger(time) {
    const now = this.scene.time.now / 1000;
    if (!canStagger(this.lastStaggerAt, now, this.m.stunGuard)) return false;
    this.lastStaggerAt = now;
    this.stunTime = time;
    this.changeState('stunned');
    return true;
  }

  die() {
    this.dead = true;
    this.alert.destroy();
    this.nameTag?.destroy();
    this.body.enable = false;
    this.scene.onMonsterKilled(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: 180,
      y: this.y - 30,
      duration: 450,
      onComplete: () => this.destroy(),
    });
  }
}
