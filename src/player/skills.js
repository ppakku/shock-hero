import Phaser from 'phaser';
import { gaugeAfterDealing, gaugeAfterHurt, isUltReady, shotAttack, shotDirection, ultimateAttack } from '../logic/combat.js';
import { floatText, ring } from '../fx/effects.js';
import { heroFistOffset } from '../fx/heroTextures.js';

// 주인공 기술(궁극기, 에너지탄, 대공 공격 등)을 관리하는 곳.
// GameScene 이 만들고 매 프레임 update 를 부른다. Player 는 scene.skills 로 접근한다.
export class HeroSkills {
  constructor(scene) {
    this.scene = scene;
    this.cfg = scene.cfg;
    this.shots = [];
    this.waves = [];
    this.ult = null;
    this.ultTipShown = false;
    this.slowLeft = 0; // 궁극기 슬로모션이 남은 시간 (실제 초)
    this.trailTimer = 0;
    this.fx = scene.add.graphics().setDepth(27);
  }

  get player() {
    return this.scene.player;
  }

  update(dt) {
    // 슬로모션 중에도 연출은 실제 시간으로 흐르게
    const realDt = Math.min(this.scene.game.loop.delta, 50) / 1000;
    this.updateShots(dt);
    this.updateUltimate(realDt);
    this.updateWaves(realDt);
    if (this.slowLeft > 0) {
      this.slowLeft -= realDt;
      if (this.slowLeft <= 0) this.endSlowMotion();
    }
  }

  // ---------- 궁극기 게이지 ----------

  // 적에게 피해를 줬을 때
  onDealtDamage(damage) {
    const p = this.player;
    if (!p || p.dead || this.ult) return;
    this.setGauge(gaugeAfterDealing(p.ultGauge, damage, this.cfg.ultimate));
  }

  // 내가 맞았을 때
  onHurt(damage) {
    const p = this.player;
    if (!p || p.dead || this.ult) return;
    this.setGauge(gaugeAfterHurt(p.ultGauge, damage, this.cfg.ultimate));
  }

  setGauge(value) {
    const p = this.player;
    const wasReady = isUltReady(p.ultGauge);
    p.ultGauge = value;
    if (wasReady || !isUltReady(value)) return;
    this.scene.sfxPlay('ultReady');
    floatText(this.scene, p.x, p.y - 60, '궁극기 준비!', '#3fd0ff', 22);
    ring(this.scene, p.x, p.y, 0x3fd0ff, 70, 400, 4);
    if (!this.ultTipShown) {
      this.ultTipShown = true;
      this.scene.robot.say('궁극기 준비! {ult} 키를 눌러!', true);
    }
  }

  // 자세별 주먹 위치 (오른쪽을 볼 때, 주인공 기준점에서)
  fistOffset(pose) {
    return heroFistOffset(pose);
  }

  // ---------- 위쪽 공격 (어퍼컷) ----------

  // 머리 위로 키 큰 파란 칼날이 솟는다. 최대 충전이면 에너지탄도 위로 쏜다.
  upperAttack(player, attack) {
    const s = this.scene;
    const dir = player.facing;
    const rect = player.upperRect(attack.range);
    const charged = attack.kind === 'charged';
    s.sfxPlay('upper');
    const x = rect.centerX;
    const blade = s.add.ellipse(x, rect.bottom, charged ? 46 : 30, 40, charged ? 0x3f8cff : 0x6fc0ff, 0.7).setOrigin(0.5, 1).setDepth(24);
    const core = s.add.ellipse(x, rect.bottom, charged ? 16 : 10, 40, 0xe8f7ff, 0.95).setOrigin(0.5, 1).setDepth(24);
    s.tweens.add({ targets: [blade, core], displayHeight: rect.height, duration: 90, ease: 'Cubic.easeOut' });
    s.tweens.add({
      targets: [blade, core], alpha: 0, scaleX: 1.8, delay: 90, duration: 160,
      onComplete: () => { blade.destroy(); core.destroy(); },
    });
    ring(s, x, rect.y + 20, 0x9fe8ff, charged ? 60 : 36, 220, 3);
    if (attack.full) {
      s.shake(0.01, 160);
      this.fireShotFrom(player, true);
    }
    if (s.hitArea(rect, attack, dir)) {
      s.sfxPlay('hit');
      this.onDealtDamage(attack.damage);
      s.sparks.explode(10, x, rect.y + 30);
    }
  }

  // ---------- 에너지탄 ----------

  // 앞으로, 또는 위(움직이면서 쏘면 대각선 위)로 쏜다
  fireShotFrom(player, up) {
    this.fireShot(player, shotDirection(player.facing, up, player.lastMoving));
  }

  // dir = { x, y } 길이 1 방향
  fireShot(player, dir) {
    const sk = this.cfg.skills;
    const up = dir.y < -0.5;
    const x = player.x + (up ? player.facing * 6 : player.facing * 30);
    const y = player.y + (up ? -44 : -6);
    const img = this.scene.add
      .image(x, y, 'hero_ball')
      .setDisplaySize(sk.shotSize * 1.4, sk.shotSize * 1.4)
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.sfxPlay('shot');
    ring(this.scene, x, y, 0x3fb8ff, 40, 200, 3);
    this.shots.push({
      img,
      x,
      y,
      dir,
      side: dir.x === 0 ? player.facing : Math.sign(dir.x),
      traveled: 0,
      attack: shotAttack(this.cfg, player.damageMultiplier),
    });
  }

  updateShots(dt) {
    if (!this.shots.length) return;
    const sk = this.cfg.skills;
    const r = sk.shotSize / 2;
    const blocker = this.scene.boss?.blocker;
    for (const s of this.shots) {
      const step = sk.shotSpeed * dt;
      s.x += s.dir.x * step;
      s.y += s.dir.y * step;
      s.traveled += step;
      s.img.setPosition(s.x, s.y).setRotation(s.img.rotation + dt * 8);
      this.trail(s.x, s.y);

      const rect = new Phaser.Geom.Rectangle(s.x - r, s.y - r, r * 2, r * 2);
      if (this.scene.hitArea(rect, s.attack, s.side)) {
        this.onDealtDamage(s.attack.damage);
        this.scene.sfxPlay('hit');
        this.popShot(s, true);
        continue;
      }
      // 보스 몸통에 부딪히면 터진다
      if (blocker?.body && Phaser.Geom.Intersects.RectangleToRectangle(rect, blocker.getBounds())) {
        this.popShot(s, true);
        continue;
      }
      if (s.traveled >= sk.shotDistance) this.popShot(s, false);
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  trail(x, y) {
    const dot = this.scene.add.image(x, y, 'spark').setTint(0x6fc0ff).setDepth(22).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6);
    this.scene.tweens.add({ targets: dot, scale: 0.2, alpha: 0, duration: 260, onComplete: () => dot.destroy() });
  }

  popShot(s, big) {
    s.done = true;
    ring(this.scene, s.x, s.y, 0x3fb8ff, big ? 70 : 36, big ? 260 : 180, big ? 5 : 3);
    this.scene.tweens.add({ targets: s.img, scale: s.img.scale * (big ? 2 : 1.4), alpha: 0, duration: 160, onComplete: () => s.img.destroy() });
    if (big) this.scene.shake(0.006, 120);
  }

  // ---------- 궁극기 ----------

  startUltimate(player) {
    if (this.ult || player.dead || !isUltReady(player.ultGauge)) return false;
    const u = this.cfg.ultimate;
    player.ultGauge = 0;
    player.cancelCharge();
    if (player.dashing) player.endDash();
    player.ultActive = true;
    player.ultPose = 'upperGlow';
    player.body.allowGravity = true;
    player.setVelocity(0, -u.jumpSpeed);
    player.setTint(0xbfe6ff);
    this.ult = { phase: 'rise', t: 0 };
    this.scene.sfxPlay('ultimate');
    floatText(this.scene, player.x, player.y - 60, '쇼크 임팩트!', '#3fd0ff', 30);
    ring(this.scene, player.x, player.y, 0x3fd0ff, 90, 350, 6);
    this.scene.dustAt(player.x, player.y + 28, 10);
    return true;
  }

  updateUltimate(dt) {
    const a = this.ult;
    if (!a) return;
    const p = this.player;
    const u = this.cfg.ultimate;
    a.t += dt;
    p.setVelocityX(0);

    this.trailTimer -= dt;
    if (this.trailTimer <= 0 && a.phase !== 'after') {
      this.trailTimer = 0.04;
      this.scene.spawnGhost(p);
    }

    if (a.phase === 'rise') {
      if (p.body.velocity.y > -80 || a.t > 0.5) {
        a.phase = 'slam';
        a.t = 0;
        p.ultPose = 'slam';
        p.setVelocityY(u.slamSpeed);
      }
    } else if (a.phase === 'slam') {
      p.setVelocityY(u.slamSpeed);
      const onGround = p.body.blocked.down || p.body.touching.down;
      if (onGround || a.t > 1.2) this.impact();
    } else if (a.phase === 'after' && a.t > 0.7) {
      this.ult = null;
      p.ultActive = false;
      p.ultPose = null;
      p.setTint(0xffffff);
      p.hurtInvuln = Math.max(p.hurtInvuln, u.invincibleAfter);
    }
  }

  impact() {
    const s = this.scene;
    const p = this.player;
    const u = this.cfg.ultimate;
    this.ult = { phase: 'after', t: 0 };
    const groundY = p.y + 31;

    s.sfxPlay('ultimateBoom');
    s.cameras.main.flash(320, 150, 215, 255);
    s.shake(0.03, 500);
    s.impact?.ultimate(); // 멈칫 + 확대 + 하얀 번쩍임 + 색 갈라짐 (src/fx/impact.js)
    s.dustAt(p.x, groundY - 4, 30);
    s.sparks.explode(40, p.x, groundY - 20);
    ring(s, p.x, groundY - 30, 0x3fd0ff, 520, 700, 10);
    ring(s, p.x, groundY - 30, 0xffffff, 300, 450, 5);
    for (const dir of [-1, 1]) this.waves.push({ x0: p.x, y: groundY, dir, t: 0 });

    // 짧은 슬로모션 (보스를 쓰러뜨리는 슬로모션이 있으면 그쪽이 우선)
    if (!s.ended) {
      const k = Math.max(0.05, Math.min(1, u.slowMotionScale));
      s.time.timeScale = k;
      s.tweens.timeScale = k;
      s.physics.world.timeScale = 1 / k;
      this.slowLeft = u.slowMotionTime;
    }

    const { attack, bossDamage } = ultimateAttack(this.cfg, p.damageMultiplier);
    if (s.hitScreen(attack, bossDamage)) s.sfxPlay('hit');
  }

  endSlowMotion() {
    this.slowLeft = 0;
    const s = this.scene;
    if (s.ended) return; // 보스 쓰러짐 슬로모션이 시작됐으면 건드리지 않는다
    s.time.timeScale = 1;
    s.tweens.timeScale = 1;
    s.physics.world.timeScale = 1;
  }

  // 화면을 휩쓰는 파란 충격파
  updateWaves(dt) {
    const g = this.fx.clear();
    if (!this.waves.length) return;
    for (const w of this.waves) {
      w.t += dt;
      const life = w.t / 0.6;
      if (life >= 1) {
        w.done = true;
        continue;
      }
      const x = w.x0 + w.dir * 1500 * w.t;
      const h = 230 * (1 - life * 0.4);
      const a = 1 - life;
      const back = -w.dir;
      g.fillStyle(0x3f8cff, 0.35 * a).fillTriangle(x, w.y - h, x, w.y, x + back * 160, w.y);
      g.fillStyle(0x6fc0ff, 0.6 * a).fillTriangle(x, w.y - h * 0.8, x, w.y, x + back * 90, w.y);
      g.fillStyle(0xe8f7ff, 0.9 * a).fillTriangle(x, w.y - h * 0.55, x + w.dir * 10, w.y, x + back * 30, w.y);
      g.fillStyle(0x9fd8ff, 0.5 * a).fillRect(Math.min(w.x0, x), w.y - 6, Math.abs(x - w.x0), 6);
    }
    this.waves = this.waves.filter((w) => !w.done);
  }

  // 화면을 바꾸거나 스테이지가 끝날 때
  destroy() {
    for (const s of this.shots) s.img.destroy();
    this.shots = [];
    this.waves = [];
    if (this.slowLeft > 0) this.endSlowMotion();
    this.fx.destroy();
  }
}
