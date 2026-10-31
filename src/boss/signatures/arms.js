import { Rect, WAVE_H } from '../bossKit.js';
import { Signature } from './Signature.js';
import { driftToward } from '../../logic/signature.js';
import { chainPosts, warnTime, zigzag } from '../../logic/sig_arms.js';
import { stamp } from '../../fx/bossArt.js';

const WARN_FLOOR = 0.6; // 보스가 아무리 빨라져도 경고는 이만큼 나온다

const ARM_H = 210; // 팔 그림 높이
const DRILL_W = 100; // 드릴이 솟는 곳 너비
const DRILL_H = 200; // 드릴 높이
const DIVE = 0.35; // 팔이 땅에 들어가는 시간
const RISE = 0.16; // 드릴이 솟구치는 시간
const SINK = 0.25; // 드릴이 다시 들어가는 시간
const BARE_STUCK = 0.4; // 팔 없이 솟았을 때 머무는 시간 (때릴 곳이 없으니 짧게)

// 드릴 파쇄자: 팔이 땅속으로 들어가 주인공을 쫓고, 멈춘 자리에서 솟구친다.
// 솟은 팔은 내려찍기처럼 잠깐 때릴 수 있다. 팔이 다 부서졌으면 코드로 그린 드릴이 솟는다.
export class DrillBurrow extends Signature {
  static tip = '흙더미가 따라온다! 멈추고 빨개지면 얼른 옆으로 비켜!';

  constructor(boss) {
    super(boss);
    const alive = boss.armsAlive;
    this.arm = alive[Math.floor(Math.random() * alive.length)] ?? null;
    this.hadArm = !!this.arm;
    if (this.arm) this.arm.busy = true;
    this.minX = boss.arenaStart + 40; // 구석으로 도망가도 닿는다
    this.maxX = boss.frontX - 50;
    this.x = Math.min(this.maxX, Math.max(this.minX, this.arm ? this.arm.sprite.x : boss.frontX - 60));
    this.fromY = this.arm ? this.arm.sprite.y : this.groundY;
    this.phase = 'dive';
    this.since = 0;
    this.hits = new Set();
    this.damage = boss.c.drillDamage;
  }

  // 팔이 살아 있을 때만 (궁극기는 땅속의 팔도 부순다)
  get live() {
    return this.arm?.alive ? this.arm : null;
  }

  go(phase) {
    this.phase = phase;
    this.since = 0;
  }

  // 팔 아래쪽을 y 로 옮긴다. 땅 밑으로 들어간 만큼은 안 보이게 자른다.
  placeArm(y) {
    const arm = this.live;
    if (!arm) return;
    const s = arm.sprite;
    const under = Math.min(ARM_H, Math.max(0, y - this.groundY));
    s.x = this.x;
    s.y = y;
    s.setVisible(under < ARM_H);
    if (under > 0) s.setCrop(0, 0, s.frame.width, s.frame.height * (1 - under / ARM_H));
    else s.setCrop();
  }

  drawMound(wobble) {
    const y = this.groundY;
    if (stamp(this.scene, 'dirt_mound', this.x, y + 8, 112, 54 + wobble)) return;
    this.g.fillStyle(0x5a4028, 1).fillEllipse(this.x, y, 92, 44 + wobble);
    this.g.fillStyle(0x8a6a44, 1).fillEllipse(this.x - 8, y - 6, 56, 22 + wobble);
    this.g.fillStyle(0x3a2a1a, 1).fillCircle(this.x + 22, y - 8, 5).fillCircle(this.x - 26, y - 4, 4);
  }

  // 팔이 없을 때 쓰는 드릴. 바닥에서 위로 뾰족하다.
  drawDrill(height) {
    const x = this.x;
    const y = this.groundY;
    const hw = 36;
    if (stamp(this.scene, 'boss_fist_drill', x, y - height / 2, height, hw * 2.4, { rotation: Math.PI / 2, depth: 6.9 })) return; // 그림은 끝이 왼쪽
    this.g.fillStyle(0xb8bec8, 1).fillTriangle(x - hw, y, x + hw, y, x, y - height);
    this.g.lineStyle(5, 0x5a6270, 1);
    const shift = (this.t * 4) % 1;
    for (let i = 0; i < 5; i++) {
      const k = (i + shift) / 5;
      const w = hw * (1 - k);
      this.g.lineBetween(x - w, y - height * k, x + w, y - height * k - 14);
    }
  }

  step(dt) {
    this.since += dt;
    const { boss, groundY } = this;
    if (this.hadArm && !this.live && (this.phase === 'stuck' || this.phase === 'sink')) return true;

    if (this.phase === 'dive') {
      const k = Math.min(1, this.since / DIVE);
      this.placeArm(this.fromY + (groundY + ARM_H - this.fromY) * k * k);
      if (k >= 1) {
        this.scene.sfxPlay('slam');
        this.scene.dustAt(this.x, groundY, 12);
        this.go('chase');
      }
      return false;
    }

    if (this.phase === 'chase') {
      const aimAt = this.scene.nearestPlayer(this.x);
      this.x = driftToward({ x: this.x, y: 0 }, { x: aimAt.x, y: 0 }, boss.c.drillSpeed, dt, this.minX, this.maxX).x;
      this.placeArm(groundY + ARM_H);
      this.drawMound(Math.sin(this.t * 30) * 4);
      if (Math.random() < 0.5) this.scene.dustAt(this.x, groundY, 1);
      boss.label(0, '땅속에서 온다!', this.x, groundY - 70, 20);
      if (this.since >= boss.c.drillChaseTime * this.speed) {
        this.warnFor = warnTime(boss.c.drillWarningTime, this.speed, WARN_FLOOR);
        this.scene.sfxPlay('warn');
        this.go('warn');
      }
      return false;
    }

    if (this.phase === 'warn') {
      this.warnAt(this.x - DRILL_W / 2, groundY - DRILL_H, DRILL_W, DRILL_H);
      this.drawMound(Math.sin(this.t * 50) * 7);
      boss.label(0, '!', this.x, groundY - 100);
      if (this.since >= this.warnFor) {
        this.live?.sprite.setFlipY(true); // 드릴이 위를 보게
        this.scene.sfxPlay('slam');
        this.scene.shake(0.012, 220);
        this.scene.impact?.bossSlam(1);
        this.scene.dustAt(this.x, groundY, 18);
        this.go('rise');
      }
      return false;
    }

    if (this.phase === 'rise') {
      const k = Math.min(1, this.since / RISE);
      const height = DRILL_H * k;
      this.placeArm(groundY + ARM_H * (1 - k));
      if (!this.live) this.drawDrill(height);
      this.hurt(new Rect(this.x - 36, groundY - height, 72, height), this.damage, this.x, this.hits);
      if (k >= 1) {
        this.live?.setHittable(true);
        this.go('stuck');
      }
      return false;
    }

    if (this.phase === 'stuck') {
      if (!this.live) this.drawDrill(DRILL_H);
      if (this.since >= (this.live ? boss.c.armRestTime : BARE_STUCK)) {
        this.live?.setHittable(false);
        this.go('sink');
      }
      return false;
    }

    const k = Math.min(1, this.since / SINK);
    this.placeArm(groundY + ARM_H * k);
    if (!this.live) this.drawDrill(DRILL_H * (1 - k));
    return k >= 1;
  }

  // 끝나거나 보스가 쓰러지면 팔을 되돌린다
  destroy() {
    const arm = this.live;
    if (arm) {
      arm.setHittable(false);
      arm.busy = false;
      arm.sprite.setFlipY(false).setVisible(true).setCrop();
    }
    super.destroy();
  }
}

const POST_H = 96; // 전기 기둥 높이
const POST_UP = 0.3; // 기둥이 올라오는 시간
const FADE = 0.25; // 사슬이 사라지는 시간
const CHAIN_Y = WAVE_H / 2; // 사슬 높이 (땅에서)

// 번개 파쇄자: 바닥 두 곳에 기둥을 세우고 그 사이를 번개 사슬로 잇는다. 낮아서 점프로 넘는다.
export class VoltChain extends Signature {
  static tip = '기둥 사이에 번개가 친다! 빨간 곳을 벗어나거나 점프, 대시로 넘어!';

  constructor(boss) {
    super(boss);
    this.posts = chainPosts(boss.target.x, boss.c.voltSpan, boss.arenaStart + 10, boss.frontX - 10);
    this.warnFor = warnTime(boss.c.voltWarningTime, this.speed, WARN_FLOOR);
    this.hits = new Set();
    this.struck = false;
    for (const x of this.posts) this.scene.dustAt(x, this.groundY, 8);
  }

  drawPost(x, up, lit) {
    const h = POST_H * up;
    const top = this.groundY - h;
    if (!stamp(this.scene, 'volt_post', x, this.groundY + 6, 40, h + 6)) {
      this.g.fillStyle(0x2a3a5a, 1).fillRect(x - 10, top, 20, h);
      this.g.fillStyle(0x6a8ac8, 1).fillRect(x - 15, top + h * 0.3, 30, 7).fillRect(x - 15, top + h * 0.6, 30, 7);
    }
    this.g.fillStyle(lit ? 0xffffff : 0x9fd8ff, 1).fillCircle(x, top, 12);
    this.g.fillStyle(0x4ac8ff, 0.3 + 0.2 * Math.sin(this.t * 30)).fillCircle(x, top, 24);
  }

  drawChain(alpha) {
    const [a, b] = this.posts;
    const y = this.groundY - CHAIN_Y;
    if (stamp(this.scene, 'fx_arc', (a + b) / 2, y, b - a, 64, { alpha, flipY: Math.floor(this.t * 24) % 2 === 0 })) return;
    for (const [width, color] of [[12, 0x2a8aff], [4, 0xeaffff]]) {
      const pts = zigzag(a, b, y, Math.round((b - a) / 34), 14);
      this.g.lineStyle(width, color, alpha).beginPath().moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) this.g.lineTo(p.x, p.y);
      this.g.strokePath();
    }
  }

  step() {
    const { boss, groundY } = this;
    const [a, b] = this.posts;
    const strikeAt = POST_UP + this.warnFor;
    const strikeEnd = strikeAt + boss.c.voltStrikeTime;
    const up = Math.min(1, this.t / POST_UP);
    const lit = this.t >= strikeAt;
    this.drawPost(a, up, lit);
    this.drawPost(b, up, lit);

    if (!lit) {
      if (up >= 1) {
        this.warnAt(a, groundY - WAVE_H, b - a, WAVE_H);
        boss.label(0, '번개 사슬! 점프!', (a + b) / 2, groundY - 110, 24);
      }
      return false;
    }
    if (!this.struck) {
      this.struck = true;
      this.scene.sfxPlay('slam');
      this.scene.shake(0.01, 200);
    }
    if (this.t < strikeEnd) {
      this.drawChain(1);
      this.hurt(new Rect(a, groundY - WAVE_H, b - a, WAVE_H), boss.c.voltDamage, (a + b) / 2, this.hits);
      return false;
    }
    const left = strikeEnd + FADE - this.t;
    this.drawChain(Math.max(0, left / FADE) * 0.6);
    return left <= 0;
  }
}

export const armsSignatures = { drillBurrow: DrillBurrow, voltChain: VoltChain };
