import Phaser from 'phaser';
import { rockTargets, comboKind } from '../logic/boss.js';
import { stampWave } from '../fx/bossArt.js';

const Rect = Phaser.Geom.Rectangle;
const lerp = Phaser.Math.Linear;
const WAVE_H = 44;

// 겹쳐 쓰는 공격: 난이도의 bossCombo 확률로, 보스가 공격하는 도중에 하나를 더 쓴다.
// 위에서 떨어지는 것(그림자 피하기) 또는 땅 울림 충격파(점프) 둘 중 하나.
// 보스의 지금 공격과 따로 돌아가서 진짜로 동시에 나온다.
export class ComboHazards {
  // opts: rockTexture, rockW, rockH, rockDamage, waveMaxX(충격파가 시작할 수 있는 오른쪽 끝)
  constructor(boss, opts = {}) {
    this.boss = boss;
    this.scene = boss.scene;
    this.opts = opts;
    this.g = this.scene.add.graphics().setDepth(2);
    this.fx = this.scene.add.graphics().setDepth(8);
    this.pending = null;
    this.job = null;
    this.sprites = [];
  }

  get busy() {
    return !!(this.pending || this.job);
  }

  // 공격을 시작할 때 부른다. 확률에 걸리면 조금 뒤 다른 공격을 겹친다.
  maybeStart(mainType, chance, rand = Math.random) {
    if (this.busy || !(chance > 0) || rand() >= chance) return false;
    this.pending = { kind: comboKind(mainType, rand), delay: 0.45 };
    return true;
  }

  // 봇과 테스트용: 피해야 할 곳
  zones() {
    const j = this.job;
    if (!j || j.kind !== 'rocks' || j.phase === 'after') return [];
    return j.targets.map((x) => [x - 70, x + 70]);
  }

  update(dt) {
    this.g.clear();
    this.fx.clear();
    if (this.pending) {
      this.pending.delay -= dt;
      if (this.pending.delay <= 0) {
        this.begin(this.pending.kind);
        this.pending = null;
      }
    }
    const j = this.job;
    if (!j) return;
    j.t += dt;
    if (j.kind === 'rocks') this.runRocks(j);
    else this.runWave(j, dt);
  }

  begin(kind) {
    const b = this.boss;
    const p = b.target;
    if (kind === 'rocks') {
      const xs = rockTargets(p.x, 2, b.minX - 20, (this.opts.waveMaxX ?? b.maxX) + 20);
      this.job = { kind, phase: 'aim', t: 0, targets: xs };
    } else {
      const mid = (b.minX + b.maxX) / 2;
      const right = Math.min(b.maxX + 40, this.opts.waveMaxX ?? b.maxX + 40);
      const fromRight = p.x < mid || this.opts.waveMaxX !== undefined;
      this.job = { kind, phase: 'aim', t: 0, x: fromRight ? right : b.minX - 40, dir: fromRight ? -1 : 1, hits: new Set() };
    }
    this.scene.sfxPlay('warn');
  }

  runRocks(j) {
    const b = this.boss;
    const c = b.c;
    if (j.phase === 'aim') {
      const dur = c.rockWarningTime * b.speed;
      const k = Math.min(1, j.t / dur);
      for (const x of j.targets) {
        this.g.fillStyle(0x000000, 0.35 + 0.3 * k).fillEllipse(x, b.groundY, 30 + 40 * k, 10 + 8 * k);
        this.g.lineStyle(2, 0xffaa22, 0.5 + 0.5 * Math.sin(b.t * 20)).strokeEllipse(x, b.groundY, 70, 18);
      }
      b.label(5, '위에서도 떨어져!', (b.minX + b.maxX) / 2, 90, 22, '#ffaa22');
      if (j.t >= dur) {
        j.phase = 'fall';
        j.t = 0;
        const tex = this.opts.rockTexture || 'rock';
        this.sprites = j.targets.map((x) => this.scene.add.image(x, -60, tex).setDepth(8).setDisplaySize(this.opts.rockW || 44, this.opts.rockH || 40));
      }
      return;
    }
    if (j.phase === 'fall') {
      const k = Math.min(1, j.t / 0.35);
      for (const r of this.sprites) r.y = lerp(-60, b.groundY - 20, k * k);
      if (k >= 1) {
        const hits = new Set(); // 바위 여러 개가 한 사람을 두 번 때리지 않게
        this.scene.sfxPlay('slam');
        for (const r of this.sprites) {
          this.scene.dustAt(r.x, b.groundY, 8);
          this.scene.hurtPlayersIn(new Rect(r.x - 28, b.groundY - 60, 56, 60), this.opts.rockDamage ?? c.rockDamage, r.x, undefined, hits);
          r.destroy();
        }
        this.sprites = [];
        j.phase = 'after';
        j.t = 0;
      }
      return;
    }
    if (j.t >= 0.3) this.job = null;
  }

  runWave(j, dt) {
    const b = this.boss;
    const c = b.c;
    const gy = b.groundY;
    if (j.phase === 'aim') {
      const dur = c.shockwaveWarningTime * b.speed;
      const alpha = 0.15 + 0.15 * Math.sin(b.t * 20);
      const x0 = Math.min(j.x, b.minX - 60);
      const x1 = Math.max(j.x, b.maxX + 60);
      this.g.fillStyle(0xffaa22, alpha).fillRect(x0, gy - WAVE_H, x1 - x0, WAVE_H);
      this.g.lineStyle(2, 0xffaa22, 1).strokeRect(x0, gy - WAVE_H, x1 - x0, WAVE_H);
      b.label(6, j.dir < 0 ? '◀ 충격파도 온다! 점프!' : '충격파도 온다! 점프! ▶', (b.minX + b.maxX) / 2, gy - 70, 20, '#ffaa22');
      if (j.t >= dur) {
        j.phase = 'run';
        j.t = 0;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.008, 160);
      }
      return;
    }
    j.x += j.dir * c.shockwaveSpeed * dt;
    if (!stampWave(this.scene, j.x, gy)) {
      this.fx.fillStyle(0xffb030, 0.85).fillTriangle(j.x - 26, gy, j.x, gy - WAVE_H, j.x + 26, gy);
      this.fx.fillStyle(0xfff3a0, 0.9).fillTriangle(j.x - 12, gy, j.x, gy - WAVE_H * 0.6, j.x + 12, gy);
    }
    this.scene.hurtPlayersIn(new Rect(j.x - 18, gy - WAVE_H, 36, WAVE_H), c.shockwaveDamage, j.x - j.dir * 40, undefined, j.hits);
    if (j.x < b.arenaStart - 80 || j.x > b.arenaEnd + 80) this.job = null;
  }

  clear() {
    this.pending = null;
    this.job = null;
    for (const r of this.sprites) r.destroy();
    this.sprites = [];
    this.g.clear();
    this.fx.clear();
  }
}
