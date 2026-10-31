import Phaser from 'phaser';
import { gaugeAfterDealing, gaugeAfterHurt, isUltReady, shotAttack, shotDirection, ultimateAttack } from '../logic/combat.js';
import { floatText, ring } from '../fx/effects.js';
import { UltAura } from '../fx/ultAura.js';
import { heroFistOffset } from '../fx/heroTextures.js';
import { HERO_INFO, beamRect, smashRect, spinRect, rushAttack, rainStrikeXs, frostRect, blizzardSlow } from '../logic/heroes.js';

// 궁극기 충격파 색 (진한 것 → 밝은 것 → 가운데 → 바닥 줄)
const SHOCK_WAVE = [0x3f8cff, 0x6fc0ff, 0xe8f7ff, 0x9fd8ff];
const GIANT_WAVE = [0xc0501a, 0xff8a2a, 0xfff0d0, 0xffb060];

// 주인공 기술(궁극기, 에너지탄, 대공 공격 등)을 관리하는 곳.
// GameScene 이 주인공마다 하나씩 만들고 매 프레임 update 를 부른다. Player 는 this.skills 로 접근한다.
export class HeroSkills {
  constructor(scene, player) {
    this.scene = scene;
    this.owner = player;
    this.cfg = scene.cfg;
    this.shots = [];
    this.waves = [];
    this.quakes = [];
    this.spin = null;
    this.ult = null;
    this.ultTipShown = false;
    this.slowLeft = 0; // 궁극기 슬로모션이 남은 시간 (실제 초)
    this.spin = null; // 강철 거인 회오리 { attack, timer }
    this.quakes = []; // 강철 거인 대지진 뒤흔들림 남은 시각
    this.trailTimer = 0;
    this.fx = scene.add.graphics().setDepth(27);
    this.aura = new UltAura(scene, player); // 궁극기가 차면 몸에 빛이 난다 (알아서 따라다님)
  }

  get player() {
    return this.owner;
  }

  update(dt) {
    // 슬로모션 중에도 연출은 실제 시간으로 흐르게
    const realDt = Math.min(this.scene.game.loop.delta, 50) / 1000;
    this.updateShots(dt);
    this.updateSpin(dt);
    this.updateRush();
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
    if (!this.ultTipShown && p === this.scene.player) {
      this.ultTipShown = true;
      this.scene.robot.say('궁극기 준비! {ult} 키를 눌러!', true);
    }
  }

  // 자세별 주먹 위치 (오른쪽을 볼 때, 주인공 기준점에서)
  fistOffset(pose) {
    const f = heroFistOffset(pose);
    const k = this.player?.stats?.scale ?? 1; // 강철 거인은 몸이 커서 주먹도 멀다
    return { x: f.x * k, y: f.y * k };
  }

  // ---------- 위쪽 공격 (어퍼컷) ----------

  // 머리 위로 키 큰 파란 칼날이 솟는다. 최대 충전이면 에너지탄도 위로 쏜다.
  // width, color: 강철 거인의 망치 올려치기는 더 넓고 주황색
  upperAttack(player, attack, { width, color } = {}) {
    const s = this.scene;
    const dir = player.facing;
    const rect = player.upperRect(attack.range, width);
    const charged = attack.kind === 'charged';
    s.sfxPlay('upper');
    const x = rect.centerX;
    const bladeW = width ? width * 0.5 : charged ? 46 : 30;
    const blade = s.add.ellipse(x, rect.bottom, bladeW, 40, color ?? (charged ? 0x3f8cff : 0x6fc0ff), 0.7).setOrigin(0.5, 1).setDepth(24);
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
    if (s.hitArea(rect, attack, dir, player)) {
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

  // dir = { x, y } 길이 1 방향. opts 로 번개 사수의 번개탄처럼 모양과 숫자를 바꾼다.
  fireShot(player, dir, opts = {}) {
    const sk = this.cfg.skills;
    const up = dir.y < -0.5;
    const x = player.x + (up ? player.facing * 6 : player.facing * 30);
    const y = player.y + (up ? -44 : -6);
    const size = opts.size ?? sk.shotSize;
    const color = opts.color ?? 0x3fb8ff;
    const img = this.scene.add
      .image(x, y, opts.tex || 'hero_ball')
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (opts.tex) img.setDisplaySize(opts.spin ? size : size * 2, size).setRotation(Math.atan2(dir.y, dir.x));
    else img.setDisplaySize(size * 1.4, size * 1.4);
    this.scene.sfxPlay('shot');
    ring(this.scene, x, y, color, opts.tex ? 20 : 40, 200, 3);
    this.shots.push({
      size,
      color,
      speed: opts.speed ?? sk.shotSpeed,
      distance: opts.distance ?? sk.shotDistance,
      spins: !opts.tex || Boolean(opts.spin),
      spinRate: opts.spin ?? 8,
      img,
      x,
      y,
      dir,
      side: dir.x === 0 ? player.facing : Math.sign(dir.x),
      traveled: 0,
      attack: opts.attack || shotAttack(this.cfg, player.damageMultiplier),
    });
  }

  updateShots(dt) {
    if (!this.shots.length) return;
    const blocker = this.scene.boss?.blocker;
    for (const s of this.shots) {
      const r = s.size / 2;
      const step = s.speed * dt;
      s.x += s.dir.x * step;
      s.y += s.dir.y * step;
      s.traveled += step;
      s.img.setPosition(s.x, s.y);
      if (s.spins) s.img.setRotation(s.img.rotation + dt * s.spinRate);
      this.trail(s.x, s.y, s.color);

      const rect = new Phaser.Geom.Rectangle(s.x - r, s.y - r, r * 2, r * 2);
      if (this.scene.hitArea(rect, s.attack, s.side, this.player)) {
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
      if (s.traveled >= s.distance) this.popShot(s, false);
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  trail(x, y, color = 0x6fc0ff) {
    const dot = this.scene.add.image(x, y, 'spark').setTint(color).setDepth(22).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6);
    this.scene.tweens.add({ targets: dot, scale: 0.2, alpha: 0, duration: 260, onComplete: () => dot.destroy() });
  }

  popShot(s, big) {
    s.done = true;
    const small = s.size < 30; // 번개탄은 작게 터진다
    ring(this.scene, s.x, s.y, s.color, small ? 30 : big ? 70 : 36, big ? 260 : 180, big ? 5 : 3);
    this.scene.tweens.add({ targets: s.img, scale: s.img.scale * (big ? 2 : 1.4), alpha: 0, duration: 160, onComplete: () => s.img.destroy() });
    if (big && !small) this.scene.shake(0.006, 120);
  }

  // ---------- 궁극기 ----------

  startUltimate(player) {
    if (this.ult || player.dead || !isUltReady(player.ultGauge)) return false;
    const u = this.cfg.ultimate;
    player.ultGauge = 0;
    player.cancelCharge();
    if (player.dashing) player.endDash();
    if (player.spinLeft > 0) {
      player.spinLeft = 0;
      this.endSpin(player);
    }
    if (player.hero === 'gunner') return this.startRain(player);
    if (player.hero === 'ninja' || player.hero === 'mage') return this.startStorm(player);
    const giant = player.hero === 'giant';
    const info = HERO_INFO[player.hero] || HERO_INFO.shock;
    player.ultActive = true;
    player.ultPose = 'upperGlow';
    player.body.allowGravity = true;
    player.setVelocity(0, -u.jumpSpeed);
    player.setTint(giant ? 0xffd0a0 : 0xbfe6ff);
    this.ult = { phase: 'rise', t: 0, giant };
    this.scene.sfxPlay('ultimate');
    floatText(this.scene, player.x, player.y - 60, info.ultName, info.color, 30);
    ring(this.scene, player.x, player.y, giant ? 0xff9a3a : 0x3fd0ff, 90, 350, 6);
    this.scene.dustAt(player.x, player.y + 28, 10);
    return true;
  }

  updateUltimate(dt) {
    const a = this.ult;
    if (!a) return;
    if (a.phase === 'rain') return this.updateRain(a, dt);
    if (a.phase === 'storm') return this.updateStorm(a, dt);
    const p = this.player;
    const u = this.cfg.ultimate;
    a.t += dt;
    this.updateQuakes(dt);
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
    const giant = this.ult?.giant;
    this.ult = { phase: 'after', t: 0, giant };
    const groundY = p.y + 31 * (p.stats?.scale ?? 1);
    const colors = giant ? GIANT_WAVE : SHOCK_WAVE;

    s.sfxPlay('ultimateBoom');
    if (giant) s.cameras.main.flash(320, 255, 190, 120);
    else s.cameras.main.flash(320, 150, 215, 255);
    s.shake(0.03, 500);
    s.impact?.ultimate(); // 멈칫 + 확대 + 하얀 번쩍임 + 색 갈라짐 (src/fx/impact.js)
    s.dustAt(p.x, groundY - 4, 30);
    s.sparks.explode(40, p.x, groundY - 20);
    ring(s, p.x, groundY - 30, giant ? 0xff9a3a : 0x3fd0ff, 520, 700, 10);
    ring(s, p.x, groundY - 30, 0xffffff, 300, 450, 5);
    for (const dir of [-1, 1]) this.waves.push({ x0: p.x, y: groundY, dir, t: 0, colors });
    // 대지진: 첫 충격 뒤에 땅이 몇 번 더 흔들린다
    if (giant) {
      const n = Math.max(0, Math.round(this.cfg.heroes.giant.quakeShocks) - 1);
      this.quakes = Array.from({ length: n }, (_, i) => 0.3 * (i + 1));
      this.quakeT = 0;
    }

    // 짧은 슬로모션 (보스를 쓰러뜨리는 슬로모션이 있으면 그쪽이 우선)
    if (!s.ended) {
      const k = Math.max(0.05, Math.min(1, u.slowMotionScale));
      s.time.timeScale = k;
      s.tweens.timeScale = k;
      s.physics.world.timeScale = 1 / k;
      this.slowLeft = u.slowMotionTime;
    }

    const { attack, bossDamage } = ultimateAttack(this.cfg, p.damageMultiplier);
    if (s.hitScreen(attack, bossDamage, p)) s.sfxPlay('hit');
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
      const h = 230 * (1 - life * 0.4) * (w.size ?? 1);
      const a = 1 - life;
      const back = -w.dir;
      const c = w.colors || SHOCK_WAVE;
      g.fillStyle(c[0], 0.35 * a).fillTriangle(x, w.y - h, x, w.y, x + back * 160, w.y);
      g.fillStyle(c[1], 0.6 * a).fillTriangle(x, w.y - h * 0.8, x, w.y, x + back * 90, w.y);
      g.fillStyle(c[2], 0.9 * a).fillTriangle(x, w.y - h * 0.55, x + w.dir * 10, w.y, x + back * 30, w.y);
      g.fillStyle(c[3], 0.5 * a).fillRect(Math.min(w.x0, x), w.y - 6, Math.abs(x - w.x0), 6);
    }
    this.waves = this.waves.filter((w) => !w.done);
  }

  // 대지진 뒤흔들림: 정해 둔 시각마다 화면 전체에 약한 충격
  updateQuakes(dt) {
    if (!this.quakes.length) return;
    this.quakeT += dt;
    const s = this.scene;
    const p = this.player;
    while (this.quakes.length && this.quakeT >= this.quakes[0]) {
      this.quakes.shift();
      const groundY = p.y + 31 * (p.stats?.scale ?? 1);
      s.shake(0.02, 300);
      s.dustAt(p.x - 200, groundY - 4, 12);
      s.dustAt(p.x + 200, groundY - 4, 12);
      for (const dir of [-1, 1]) this.waves.push({ x0: p.x, y: groundY, dir, t: 0, colors: GIANT_WAVE, size: 0.6 });
      const { attack, bossDamage } = ultimateAttack(this.cfg, p.damageMultiplier * 0.3);
      if (s.hitScreen(attack, bossDamage, p)) s.sfxPlay('hit');
    }
  }

  // ---------- 주인공마다 다른 공격 ----------

  heroAttack(player, attack) {
    if (attack.style === 'bolt') return this.fireBolt(player, attack);
    if (attack.style === 'beam') return this.fireBeam(player, attack);
    if (attack.style === 'smash') return this.smash(player, attack);
    if (attack.style === 'hammerUp') return this.upperAttack(player, attack, { width: this.cfg.heroes.giant.upperWidth, color: 0xff9a3a });
    if (attack.style === 'spin') return this.startSpin(player, attack);
    if (attack.style === 'star') return this.throwStar(player, attack);
    if (attack.style === 'slash') return this.dashSlash(player, attack);
    if (attack.style === 'ice') return this.fireIce(player, attack);
    if (attack.style === 'frost') return this.frostBlast(player, attack);
  }

  // 번개탄: 작고 빠르고 멀리 간다. 위를 누르면 위로 (움직이면 대각선 위로)
  fireBolt(player, attack) {
    const g = this.cfg.heroes.gunner;
    const dir = shotDirection(player.facing, attack.up, player.lastMoving);
    this.fireShot(player, dir, { tex: 'gunner_bolt', size: g.boltSize, speed: g.boltSpeed, distance: g.boltDistance, color: 0xffd23f, attack });
  }

  // 레이저: 앞(또는 위)으로 길게 뻗어 닿는 적을 모두 뚫는다
  fireBeam(player, attack) {
    const s = this.scene;
    const dir = player.facing;
    const r = beamRect(player.x, player.y, dir, attack.range, attack.width, attack.up);
    const rect = new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h);
    s.sfxPlay('charged');
    const glow = s.add.rectangle(rect.centerX, rect.centerY, r.w, r.h, 0xffd23f, 0.55).setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
    const core = s.add
      .rectangle(rect.centerX, rect.centerY, attack.up ? r.w * 0.35 : r.w, attack.up ? r.h : r.h * 0.35, 0xffffff, 0.95)
      .setDepth(24);
    s.tweens.add({
      targets: [glow, core],
      alpha: 0,
      [attack.up ? 'scaleX' : 'scaleY']: 0.2,
      duration: 260,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        glow.destroy();
        core.destroy();
      },
    });
    const mx = attack.up ? player.x : player.x + dir * 24;
    const my = attack.up ? player.y - 34 : player.y - 6;
    ring(s, mx, my, 0xffe14a, 30 + 30 * attack.ratio, 220, 4);
    if (attack.full) s.shake(0.008, 140);
    if (s.hitArea(rect, attack, dir, player)) {
      s.sfxPlay('hit');
      this.onDealtDamage(attack.damage);
      if (attack.full) s.impact?.chargedHit(dir);
    }
  }

  // 망치 내려찍기: 앞쪽을 넓게, 방패도 깬다
  smash(player, attack) {
    const s = this.scene;
    const g = this.cfg.heroes.giant;
    const dir = player.facing;
    const r = smashRect(player.x, player.y, dir, attack.range, g.smashHeight);
    const rect = new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h);
    const groundY = player.y + 31 * (player.stats?.scale ?? 1);
    const hx = player.x + dir * (attack.range * 0.7);
    s.sfxPlay('charged');
    s.dustAt(hx, groundY - 4, 10);
    ring(s, hx, groundY - 10, 0xff9a3a, 60, 240, 5);
    const crack = s.add.ellipse(hx, groundY - 2, attack.range * 1.2, 14, 0xffb060, 0.7).setDepth(24);
    s.tweens.add({ targets: crack, scaleX: 1.5, alpha: 0, duration: 260, onComplete: () => crack.destroy() });
    s.shake(0.006, 120);
    if (s.hitArea(rect, attack, dir, player)) {
      s.sfxPlay('hit');
      this.onDealtDamage(attack.damage);
      s.shake(0.01, 140);
    }
  }

  // 회오리: 도는 동안 몸 둘레를 계속 때린다
  startSpin(player, attack) {
    this.spin = { attack, timer: 0 };
    this.scene.sfxPlay('upper');
    ring(this.scene, player.x, player.y, 0xff9a3a, attack.range, 260, 5);
  }

  updateSpin(dt) {
    const p = this.player;
    if (!this.spin || !p) return;
    if (p.spinLeft <= 0 || p.dead) return this.endSpin(p);
    const s = this.scene;
    const g = this.cfg.heroes.giant;
    const a = this.spin.attack;
    this.spin.timer -= dt;
    if (this.spin.timer > 0) return;
    this.spin.timer = g.spinTick;
    const r = spinRect(p.x, p.y, a.range);
    // 왼쪽 반은 왼쪽으로, 오른쪽 반은 오른쪽으로 밀어낸다
    const left = new Phaser.Geom.Rectangle(r.x, r.y, r.w / 2, r.h);
    const right = new Phaser.Geom.Rectangle(r.x + r.w / 2, r.y, r.w / 2, r.h);
    const hitL = s.hitArea(left, a, -1, p);
    const hitR = s.hitArea(right, a, 1, p);
    if (hitL || hitR) {
      s.sfxPlay('hit');
      this.onDealtDamage(a.damage);
    }
    const swirl = s.add.ellipse(p.x, p.y, a.range * 2, a.range * 0.9, 0xff9a3a, 0.28).setDepth(24);
    swirl.setStrokeStyle(4, 0xffd08a, 0.8);
    s.tweens.add({ targets: swirl, scaleX: 1.15, alpha: 0, duration: g.spinTick * 1000 * 1.6, onComplete: () => swirl.destroy() });
  }

  endSpin(player) {
    this.spin = null;
    if (player && !player.dead) player.setFlipX(player.facing < 0);
  }

  // 표창: 빠르지만 짧게 날아가고 빙글빙글 돈다. 위를 누르면 위로 (움직이면 대각선 위로)
  throwStar(player, attack) {
    const g = this.cfg.heroes.ninja;
    const dir = shotDirection(player.facing, attack.up, player.lastMoving);
    this.fireShot(player, dir, { tex: 'ninja_star', size: g.starSize, speed: g.starSpeed, distance: g.starDistance, color: 0x2fe6c0, spin: 24, attack });
  }

  // 돌진 베기: 지나가는 길에 칼바람 한 줄을 남기며 앞으로 뻗어 나간다 (피해는 updateRush 가 준다)
  dashSlash(player, attack) {
    const s = this.scene;
    const dir = player.facing;
    const len = attack.speed * attack.time * (player.swim?.dashScale ?? 1);
    s.sfxPlay('charged');
    ring(s, player.x, player.y, 0x2fe6c0, 40 + 30 * attack.ratio, 200, 4);
    const glow = s.add.rectangle(player.x + (dir * len) / 2, player.y - 4, len, 20, 0x2fe6c0, 0.45).setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
    const core = s.add.rectangle(player.x + (dir * len) / 2, player.y - 4, len, 4, 0xffffff, 0.95).setDepth(24);
    s.tweens.add({
      targets: [glow, core],
      alpha: 0,
      scaleY: 0.2,
      delay: attack.time * 1000,
      duration: 200,
      onComplete: () => {
        glow.destroy();
        core.destroy();
      },
    });
    if (attack.full) s.shake(0.008, 140);
    player.startSlash(attack);
  }

  // 얼음탄: 천천히 날아가는 얼음 조각. 위를 누르면 위로 (움직이면 대각선 위로)
  fireIce(player, attack) {
    const g = this.cfg.heroes.mage;
    const dir = shotDirection(player.facing, attack.up, player.lastMoving);
    this.fireShot(player, dir, { tex: 'mage_ice', size: g.iceSize, speed: g.iceSpeed, distance: g.iceDistance, color: 0x9fd8ff, attack });
  }

  // 얼음 폭발: 앞쪽(또는 위쪽) 멀리서 터지고, 맞은 적은 잠깐 느려진다 (attack.slow, GameScene.hitArea)
  frostBlast(player, attack) {
    const s = this.scene;
    const dir = player.facing;
    const r = frostRect(player.x, player.y, dir, attack.range, attack.radius, attack.up);
    const rect = new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h);
    s.sfxPlay('charged');
    const blast = s.add.circle(rect.centerX, rect.centerY, attack.radius, 0x9fd8ff, 0.45).setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
    const core = s.add.circle(rect.centerX, rect.centerY, attack.radius * 0.5, 0xffffff, 0.8).setDepth(24);
    s.tweens.add({
      targets: [blast, core],
      scale: 1.25,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        blast.destroy();
        core.destroy();
      },
    });
    ring(s, rect.centerX, rect.centerY, 0xd8f0ff, attack.radius * 1.2, 280, 5);
    for (let i = 0; i < 8; i++) this.iceChip(rect.centerX, rect.centerY, attack.radius, (i / 8) * Math.PI * 2);
    if (attack.full) s.shake(0.008, 140);
    if (s.hitArea(rect, attack, dir, player)) {
      s.sfxPlay('hit');
      this.onDealtDamage(attack.damage);
      if (attack.full) s.impact?.chargedHit(dir);
    }
  }

  // 폭발에서 사방으로 튀는 얼음 조각
  iceChip(x, y, radius, angle) {
    const s = this.scene;
    const chip = s.add.image(x, y, 'spark').setTint(0xd8f0ff).setDepth(25).setScale(1.4);
    s.tweens.add({
      targets: chip,
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      alpha: 0,
      duration: 320,
      onComplete: () => chip.destroy(),
    });
  }

  // 몸통 박치기와 돌진 베기: 대시하는 동안 부딪힌 적을 한 번씩 때린다
  updateRush() {
    const p = this.player;
    if (!p || !p.dashing || !p.rushHits) return;
    const s = this.scene;
    const b = p.getBounds();
    const rect = new Phaser.Geom.Rectangle(b.x - 12, b.y, b.width + 24, b.height);
    const attack = p.slashAttack || rushAttack(this.cfg, p.damageMultiplier);
    let hit = false;
    for (const m of s.monsters) {
      if (m.dead || p.rushHits.has(m) || !Phaser.Geom.Intersects.RectangleToRectangle(rect, m.getBounds())) continue;
      p.rushHits.add(m);
      m.takeHit(attack, p.facing);
      hit = true;
    }
    if (!p.rushHits.has(s.boss) && s.boss?.receiveAttack(rect, attack)) {
      p.rushHits.add(s.boss);
      hit = true;
    }
    if (!p.rushHits.has('rival') && s.hitRival(p, rect, attack, p.facing)) {
      p.rushHits.add('rival'); // 겨루기: 상대도 한 번만 날려 보낸다
      hit = true;
    }
    if (hit) {
      s.sfxPlay('hit');
      this.onDealtDamage(attack.damage);
      s.shake(0.008, 120);
      ring(s, p.x + p.facing * 24, p.y, p.slashAttack ? 0x2fe6c0 : 0xff9a3a, 50, 200, 4);
    }
  }

  // ---------- 번개 사수 궁극기: 번개비 ----------

  startRain(player) {
    const s = this.scene;
    const g = this.cfg.heroes.gunner;
    player.ultActive = true;
    player.ultPose = 'upperGlow';
    player.setVelocity(0, 0);
    player.setTint(0xfff0a0);
    const view = s.cameras.main.worldView;
    const targets = s.monsters.filter((m) => !m.dead && view.contains(m.x, m.y)).map((m) => m.x);
    if (s.bossStarted && s.boss?.x != null) targets.push(s.boss.x);
    if (s.versus) targets.push(s.rivalOf(player).x);
    const xs = rainStrikeXs(targets, view.x + 40, view.width - 80, g.rainStrikes);
    // 번개가 한 줄기씩 순서대로 떨어진다
    const strikes = xs.map((x, i) => ({ x, at: 0.15 + (0.9 * i) / Math.max(1, xs.length) }));
    this.ult = { phase: 'rain', t: 0, strikes, hit: false };
    s.sfxPlay('ultimate');
    floatText(s, player.x, player.y - 60, HERO_INFO.gunner.ultName, HERO_INFO.gunner.color, 30);
    ring(s, player.x, player.y, 0xffe14a, 90, 350, 6);
    s.cameras.main.flash(200, 60, 60, 90);
    return true;
  }

  updateRain(a, dt) {
    const s = this.scene;
    const p = this.player;
    const u = this.cfg.ultimate;
    a.t += dt;
    p.setVelocityX(0);
    for (const st of a.strikes) {
      if (st.done || a.t < st.at) continue;
      st.done = true;
      this.lightning(st.x);
    }
    // 번개가 반쯤 떨어졌을 때 화면 안 적 모두에게 피해
    if (!a.hit && a.t >= 0.55) {
      a.hit = true;
      s.sfxPlay('ultimateBoom');
      s.cameras.main.flash(260, 255, 240, 160);
      s.shake(0.02, 400);
      s.impact?.ultimate();
      const { attack, bossDamage } = ultimateAttack(this.cfg, p.damageMultiplier);
      if (s.hitScreen(attack, bossDamage, p)) s.sfxPlay('hit');
    }
    if (a.t > 1.4) {
      this.ult = null;
      p.ultActive = false;
      p.ultPose = null;
      p.setTint(0xffffff);
      p.hurtInvuln = Math.max(p.hurtInvuln, u.invincibleAfter);
    }
  }

  // 하늘에서 땅까지 지그재그 번개 한 줄기
  lightning(x) {
    const s = this.scene;
    const top = s.cameras.main.worldView.y - 10;
    const groundY = s.stage?.groundY ?? 480;
    const g = s.add.graphics().setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) pts.push({ x: x + (i === 0 || i === n ? 0 : Phaser.Math.Between(-22, 22)), y: top + ((groundY - top) * i) / n });
    g.lineStyle(14, 0xffd23f, 0.35).strokePoints(pts);
    g.lineStyle(6, 0xffe14a, 0.9).strokePoints(pts);
    g.lineStyle(2, 0xffffff, 1).strokePoints(pts);
    s.tweens.add({ targets: g, alpha: 0, duration: 320, delay: 60, onComplete: () => g.destroy() });
    ring(s, x, groundY - 10, 0xffe14a, 60, 260, 4);
    s.sparks.explode(8, x, groundY - 20);
    s.dustAt(x, groundY - 4, 6);
  }

  // ---------- 바람 닌자와 얼음 마법사 궁극기: 회오리 베기, 눈보라 ----------
  // 둘 다 제자리에서 화면 전체를 휩쓴다. 반쯤 지났을 때 화면 안 적 모두에게 피해.

  startStorm(player) {
    const s = this.scene;
    const ninja = player.hero === 'ninja';
    const info = HERO_INFO[player.hero];
    player.ultActive = true;
    player.ultPose = ninja ? 'spin' : 'upperGlow';
    player.setVelocity(0, 0);
    player.setTint(ninja ? 0xb0ffe8 : 0xd8f0ff);
    this.ult = { phase: 'storm', t: 0, ninja, hit: false, next: 0 };
    s.sfxPlay('ultimate');
    floatText(s, player.x, player.y - 60, info.ultName, info.color, 30);
    ring(s, player.x, player.y, ninja ? 0x2fe6c0 : 0x9fd8ff, 90, 350, 6);
    s.cameras.main.flash(200, ...(ninja ? [20, 90, 80] : [120, 170, 210]));
    return true;
  }

  updateStorm(a, dt) {
    const s = this.scene;
    const p = this.player;
    const u = this.cfg.ultimate;
    a.t += dt;
    p.setVelocityX(0);
    if (a.ninja) p.setFlipX(Math.floor(a.t / 0.07) % 2 === 0); // 빙글빙글
    a.next -= dt;
    if (a.next <= 0) {
      a.next = a.ninja ? 0.07 : 0.03;
      if (a.ninja) this.windCut();
      else this.snowflake();
    }
    if (!a.hit && a.t >= 0.55) {
      a.hit = true;
      s.sfxPlay('ultimateBoom');
      if (a.ninja) s.cameras.main.flash(260, 170, 255, 235);
      else s.cameras.main.flash(320, 225, 240, 255);
      s.shake(0.02, 400);
      s.impact?.ultimate();
      const { attack, bossDamage } = ultimateAttack(this.cfg, p.damageMultiplier);
      const final = a.ninja ? attack : { ...attack, slow: blizzardSlow(this.cfg) };
      if (s.hitScreen(final, bossDamage, p)) s.sfxPlay('hit');
    }
    if (a.t > 1.4) {
      this.ult = null;
      p.ultActive = false;
      p.ultPose = null;
      p.setTint(0xffffff);
      p.setFlipX(p.facing < 0);
      p.hurtInvuln = Math.max(p.hurtInvuln, u.invincibleAfter);
    }
  }

  // 회오리 베기: 화면 아무 데나 번쩍이는 칼바람 한 줄
  windCut() {
    const s = this.scene;
    const v = s.cameras.main.worldView;
    const x = v.x + Math.random() * v.width;
    const y = v.y + Math.random() * v.height;
    const cut = s.add.rectangle(x, y, 320, 5, 0xffffff, 0.95).setDepth(26).setRotation(Math.random() * Math.PI);
    cut.setStrokeStyle(3, 0x2fe6c0, 0.8);
    s.tweens.add({ targets: cut, scaleX: 1.6, scaleY: 0.2, alpha: 0, duration: 200, onComplete: () => cut.destroy() });
  }

  // 눈보라: 화면 위에서 비스듬히 쏟아지는 눈송이 하나
  snowflake() {
    const s = this.scene;
    const v = s.cameras.main.worldView;
    const x = v.x + Math.random() * (v.width + 200);
    const flake = s.add.image(x, v.y - 10, 'spark').setTint(0xffffff).setDepth(26).setScale(1 + Math.random() * 1.6);
    s.tweens.add({ targets: flake, x: x - 200, y: v.bottom + 10, duration: 500 + Math.random() * 300, onComplete: () => flake.destroy() });
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
