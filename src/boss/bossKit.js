import Phaser from 'phaser';
import { Health } from '../logic/health.js';
import { agePuddles, standingInPuddle, addPuddle } from '../logic/puddles.js';
import { floatText } from '../fx/effects.js';

// 두꺼비 보스와 골렘 보스가 같이 쓰는 작은 도우미들.

export const Rect = Phaser.Geom.Rectangle;
export const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
export const WAVE_H = 44; // 바닥 충격파 높이 (점프로 넘을 수 있음)

// 부술 수 있는 부위 하나 (혀, 독 주머니, 무릎 판 등)
export class BossPart {
  constructor(label, maxHealth) {
    this.label = label;
    this.health = new Health(maxHealth);
    this.alive = true;
  }

  hud(kind = 'part', locked = false) {
    return {
      label: this.alive ? this.label : `${this.label} 파괴`,
      ratio: this.alive ? this.health.ratio : 0,
      kind,
      locked,
    };
  }
}

// 부위에 피해를 주고 숫자를 띄운다. 부서졌으면 true. (번쩍임은 보스가 직접 처리)
export function damagePart(scene, part, damage, x, y, opts = {}) {
  part.health.damage(damage);
  const big = opts.charged || opts.ult;
  const color = opts.ult ? '#3fd0ff' : opts.charged ? '#ffd23f' : '#ffffff';
  floatText(scene, x, y, String(damage), color, big ? 30 : 20);
  if (part.health.isDead && part.alive) {
    part.alive = false;
    return true;
  }
  return false;
}

// 바닥 웅덩이 (독, 불): 서 있으면 조금씩 아프다
export class Puddles {
  constructor(scene, g, { damage, color, edge, tickTime = 0.6, name = '웅덩이' }) {
    this.scene = scene;
    this.g = g;
    this.damage = damage;
    this.color = color;
    this.edge = edge;
    this.tickTime = tickTime;
    this.name = name;
    this.list = [];
    this.tick = 0;
    this.warned = false;
  }

  add(x, w, time) {
    this.list = addPuddle(this.list, { x, w, left: time, max: time });
  }

  clear() {
    this.list = [];
    this.g.clear();
  }

  update(dt, groundY, t) {
    this.list = agePuddles(this.list, dt);
    this.tick = Math.max(0, this.tick - dt);
    const g = this.g.clear();
    for (const p of this.list) {
      const fade = Math.min(1, p.left / 0.6);
      const wob = Math.sin(t * 6 + p.x) * 3;
      g.fillStyle(this.color, 0.75 * fade).fillEllipse(p.x, groundY - 2, p.w + wob, 16);
      g.lineStyle(2, this.edge, 0.9 * fade).strokeEllipse(p.x, groundY - 2, p.w + wob, 16);
      g.fillStyle(this.edge, 0.8 * fade).fillCircle(p.x - p.w * 0.2, groundY - 6 - ((t * 30 + p.x) % 14), 3);
      g.fillStyle(this.edge, 0.8 * fade).fillCircle(p.x + p.w * 0.25, groundY - 4 - ((t * 24 + p.x * 3) % 12), 2.5);
    }
    if (this.tick > 0) return;
    let stung = false;
    for (const pl of this.scene.players) {
      if (pl.dead || pl.dashInvuln > 0) continue;
      const onGround = pl.body.blocked.down || pl.body.touching.down;
      const hit = standingInPuddle(this.list, pl.x, 12, onGround && pl.y > groundY - 60);
      if (!hit) continue;
      stung = true;
      if (pl.hurt(this.damage, hit.x, 120) === 'hit' && !this.warned) {
        this.warned = true;
        floatText(this.scene, pl.x, pl.y - 70, `${this.name}! 빨리 나와!`, '#ffb0b0', 18);
      }
    }
    if (stung) this.tick = this.tickTime;
  }
}

// 바닥을 달리는 충격파들
export class GroundWaves {
  constructor(scene, g, { damage, speed, color = 0xffb030, light = 0xfff3a0 }) {
    this.scene = scene;
    this.g = g;
    this.damage = damage;
    this.speed = speed;
    this.color = color;
    this.light = light;
    this.list = [];
  }

  spawn(x, dir, maxDist) {
    this.list.push({ x, dir, left: maxDist, hits: new Set() }); // hits: 이미 맞은 주인공
  }

  clear() {
    this.list = [];
  }

  // 그리기는 fxG 에 (보스가 프레임마다 지운다)
  update(dt, groundY, minX, maxX) {
    for (const w of this.list) {
      const step = this.speed * dt;
      w.x += w.dir * step;
      w.left -= step;
      const s = Math.min(1, w.left / 60);
      const h = WAVE_H * Math.max(0.3, s);
      this.g.fillStyle(this.color, 0.85).fillTriangle(w.x - 26, groundY, w.x, groundY - h, w.x + 26, groundY);
      this.g.fillStyle(this.light, 0.9).fillTriangle(w.x - 12, groundY, w.x, groundY - h * 0.6, w.x + 12, groundY);
      if (Math.random() < 0.4) this.scene.dustAt(w.x, groundY, 1);
      this.scene.hurtPlayersIn(new Rect(w.x - 18, groundY - h, 36, h), this.damage, w.x - w.dir * 40, undefined, w.hits);
    }
    this.list = this.list.filter((w) => w.left > 0 && w.x > minX - 40 && w.x < maxX + 40);
  }
}

// 바닥의 빨간 경고 칸 (테두리 + 반짝임)
export function warnBox(g, x0, y0, w, h, t, color = 0xff2020, edge = 0xff4444) {
  const alpha = 0.2 + 0.16 * Math.sin(t * 18);
  g.fillStyle(color, alpha).fillRect(x0, y0, w, h);
  g.lineStyle(3, edge, 1).strokeRect(x0, y0, w, h);
}
