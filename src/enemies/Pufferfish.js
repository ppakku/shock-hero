import Phaser from 'phaser';
import { SwimMonster } from './SwimMonster.js';
import { floatText, ring } from '../fx/effects.js';
import { pufferResult } from '../logic/swim.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;

// balance.js 에서 숫자를 지워 버려도 돌아가게 쓰는 기본값
const DEFAULTS = {
  swimY: 380, puffRange: 170, inflateWarning: 0.7, spikyTime: 1.8, thornDamage: 8,
  bumpDamage: 12, puffCooldown: 3.0, dizzyTime: 1.4,
};

// 가시복어 뿌뿌: 평소에는 동글동글 순한 물고기. 가까이 가면
// (부르르 떨며 빨갛게 "!") → 펑! 가시 공으로 부풀어 천천히 다가옴 (닿으면 아픔)
// 가시가 섰을 때 맨손 펀치나 어퍼컷은 내가 찔린다("따끔!"). 에너지탄, 충전 펀치, 궁극기는 통함.
// 바람이 빠지면 어지러워서 빙글빙글 (때릴 기회)
export class Pufferfish extends SwimMonster {
  constructor(scene, spot, cfg) {
    super(scene, spot, cfg, 'monster_puffer', 54, 45);
    this.m = { ...DEFAULTS, ...this.m };
    this.puffCd = 1.0;
    this.baseScale = { x: this.scaleX, y: this.scaleY };
    this.fxG = scene.add.graphics().setDepth(6);
  }

  get spiky() {
    return this.state === 'spiky';
  }

  think(dt) {
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dist = Math.hypot(dx, p.y - this.y);
    this.puffCd -= dt;
    const bobY = Math.sin(this.bob) * 10;

    switch (this.state) {
      case 'idle': {
        this.steer(this.origin + Math.sin(this.bob * 0.5) * 60, this.homeY + bobY, this.m.moveSpeed * 0.5, dt, 2);
        this.facing = this.body.velocity.x >= 0 ? 1 : -1;
        if (this.sees()) this.changeState('chase');
        break;
      }
      case 'chase': {
        // 주인공 높이로 천천히 다가옴
        this.facing = Math.sign(dx) || this.facing;
        this.steer(p.x - Math.sign(dx) * 70, p.y + bobY, this.m.moveSpeed, dt, 2);
        if (this.puffCd <= 0 && dist < this.m.puffRange && !p.dead) {
          this.scene.sfxPlay('warn');
          this.changeState('windup');
        } else if (!this.sees(this.m.sightRange * 1.6)) {
          this.origin = this.x;
          this.homeY = this.y;
          this.changeState('idle');
        }
        break;
      }
      case 'windup': {
        // 부르르 떨며 조금씩 커짐 (부풀기 신호)
        this.stopMoving(dt, 8);
        const k = Math.min(1, this.stateTime / this.m.inflateWarning);
        const shake = Math.sin(this.stateTime * 60) * 2;
        this.x += shake * 0.3;
        this.setScale(this.baseScale.x * (1 + 0.3 * k), this.baseScale.y * (1 + 0.3 * k));
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTint(0xff6050);
        else this.clearTint();
        if (this.stateTime >= this.m.inflateWarning) this.inflate();
        break;
      }
      case 'spiky': {
        // 가시 공: 천천히 주인공 쪽으로 굴러옴. 닿으면 아픔
        this.facing = Math.sign(dx) || this.facing;
        this.steer(p.x, p.y, this.m.moveSpeed * 0.55, dt, 1.5);
        if (!this.hasHit && !p.dead && intersects(this.spikeRect(), p.getBounds())) {
          if (p.hurt(this.m.bumpDamage, this.x, this.m.heroKnockback) !== 'ignored') this.hasHit = true;
        }
        if (this.stateTime >= this.m.spikyTime) this.deflate();
        break;
      }
      case 'dizzy': {
        this.stopMoving(dt, 3);
        this.setAngle(Math.sin(this.stateTime * 8) * 25);
        if (this.stateTime >= this.m.dizzyTime) {
          this.setAngle(0);
          this.changeState('chase');
        }
        break;
      }
      default:
        this.changeState('chase');
        break;
    }
  }

  spikeRect() {
    return new Rect(this.x - 34, this.y - 34, 68, 68);
  }

  inflate() {
    this.clearTint();
    this.setTexture('monster_puffer_big');
    this.setDisplaySize(78 * this.m.size, 78 * this.m.size);
    this.body.setSize(this.width * 0.7, this.height * 0.7, true);
    this.hasHit = false;
    this.scene.sfxPlay('puff');
    ring(this.scene, this.x, this.y, 0xfff1c8, 60, 220, 4);
    floatText(this.scene, this.x, this.y - 54, '뿌우!', '#ffb050', 20);
    this.changeState('spiky');
    if (!this.scene.pufferTipSaid) {
      this.scene.pufferTipSaid = true;
      this.scene.robot.say('가시복어가 부풀었어! {pufferTip}', true);
    }
  }

  deflate(popped = false) {
    this.setTexture('monster_puffer');
    this.setScale(this.baseScale.x, this.baseScale.y);
    this.body.setSize(this.width * 0.8, this.height * 0.8, true);
    this.puffCd = this.m.puffCooldown;
    this.scene.sfxPlay('deflate');
    floatText(this.scene, this.x, this.y - 36, popped ? '퓨슝!' : '피유우...', '#fff1c8', 16);
    this.changeState('dizzy');
    this.stateTime = popped ? -0.5 : 0; // 터뜨리면 더 오래 어지러움
  }

  takeHit(attack, dir) {
    if (this.dead) return false;
    this.setAngle(0);
    if (this.state === 'windup') {
      // 부풀기 전에 때리면 부풀기가 취소된다
      this.clearTint();
      this.setScale(this.baseScale.x, this.baseScale.y);
      this.puffCd = 1.2;
      return super.takeHit(attack, dir);
    }
    if (this.state === 'spiky') {
      const r = pufferResult(attack.kind, true);
      if (r === 'thorns') {
        // 가시에 찔림: 주인공이 아프고 복어는 멀쩡
        const p = this.scene.player;
        floatText(this.scene, this.x, this.y - 50, '따끔!', '#ff8a5a', 22);
        this.scene.sfxPlay('tink');
        p.hurt(this.m.thornDamage, this.x, 180);
        return true;
      }
      // 에너지탄, 충전 펀치, 궁극기: 가시를 뚫고 바람을 뺀다
      this.deflate(true);
      const ok = super.takeHit(attack, dir);
      if (!this.dead) {
        this.changeState('dizzy');
        this.stateTime = -0.5;
      }
      return ok;
    }
    return super.takeHit(attack, dir);
  }

  afterUpdate() {
    const g = this.fxG.clear();
    if (this.state === 'dizzy') {
      // 머리 위 빙글빙글 별
      for (let i = 0; i < 3; i++) {
        const a = this.stateTime * 5 + i * 2.1;
        g.fillStyle(0xffe066, 1).fillCircle(this.x + Math.cos(a) * 18, this.y - 30 + Math.sin(a) * 5, 3);
      }
    }
    if (this.spiky) {
      const pulse = 0.5 + 0.5 * Math.sin(this.stateTime * 12);
      g.lineStyle(2, 0xff6050, 0.4 + 0.4 * pulse).strokeCircle(this.x, this.y, 44);
    }
  }

  onDie() {
    this.fxG.destroy();
  }
}
