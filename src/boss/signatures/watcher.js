import { GroundWaves, Rect } from '../bossKit.js';
import { Signature } from './Signature.js';
import { driftToward, fanOut } from '../../logic/signature.js';

const AIM = 0.9; // 구름이 나올 자리를 보여 주는 시간
const LIFE = 3.2; // 구름이 떠다니는 시간
const R = 44; // 구름 반지름
const CLOUD_Y = 70; // 구름 높이 (땅에서, 주인공 몸높이)

// 늪 괴물 와처: 천천히 따라오는 포자 구름, 구름이 사라지면 양쪽으로 진흙 파도
export class Spores extends Signature {
  static tip = '포자 구름이 따라온다! 느리니까 멀리 달아나고, 구름이 사라지면 진흙 파도를 뛰어넘어!';

  constructor(boss) {
    super(boss);
    const dir = boss.facing || -1;
    const count = boss.raging ? 3 : 2;
    const y = this.groundY - CLOUD_Y;
    this.clouds = fanOut(boss.x, dir, count, 150).map((x) => ({ x: Math.min(boss.maxX, Math.max(boss.minX, x)), y, hits: new Set() }));
    this.damage = boss.k.signatureDamage;
    this.drift = boss.k.sporeSpeed;
    this.mud = new GroundWaves(this.scene, this.g, { damage: this.damage, speed: boss.k.mudWaveSpeed, color: 0x5a4a22, light: 0x9acd32 });
  }

  step(dt) {
    const aim = AIM * this.speed;
    if (this.t < aim) {
      for (const c of this.clouds) this.warnAt(c.x - R, c.y - R, R * 2, R * 2);
      return false;
    }
    const left = aim + LIFE - this.t;
    if (left <= 0) {
      if (!this.waved) {
        this.waved = true;
        for (const dir of [-1, 1]) this.mud.spawn(this.boss.x, dir, this.boss.maxX - this.boss.minX);
      }
      this.mud.update(dt, this.groundY, this.boss.minX, this.boss.maxX);
      return this.mud.list.length === 0;
    }
    const alpha = Math.min(0.75, left);
    for (const c of this.clouds) {
      const aimAt = this.boss.scene.nearestPlayer(c.x);
      Object.assign(c, driftToward(c, { x: aimAt.x, y: this.groundY - CLOUD_Y }, this.drift, dt, this.boss.minX, this.boss.maxX));
      this.g.fillStyle(0x9acd32, alpha * 0.55).fillCircle(c.x, c.y, R);
      this.g.fillStyle(0xd8ff6a, alpha * 0.7).fillCircle(c.x - 12, c.y - 8, R * 0.45).fillCircle(c.x + 16, c.y + 6, R * 0.35);
      this.hurt(new Rect(c.x - R * 0.7, c.y - R * 0.7, R * 1.4, R * 1.4), this.damage, c.x, c.hits);
    }
    return false;
  }
}

export const watcherSignatures = { spores: Spores };
