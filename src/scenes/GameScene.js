import Phaser from 'phaser';
import { cfg } from '../config/index.js';
import { getStage, stages } from '../stage/index.js';
import { Player } from '../player/Player.js';
import { Robot } from '../player/Robot.js';
import { Monster } from '../enemies/Monster.js';
import { Boss } from '../boss/Boss.js';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { clearStagePatch } from '../logic/save.js';
import { parseMonsterSpot } from '../logic/monsters.js';
import { addXp, maxHealthFor, damageMultiplierFor } from '../logic/progression.js';
import { floatText, ring } from '../fx/effects.js';
import { makeText, FONT } from '../ui/text.js';

const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
const KEY = Phaser.Input.Keyboard.KeyCodes;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(data = {}) {
    this.cfg = cfg;
    this.save = saveStore.load();
    this.stageNum = Phaser.Math.Clamp(data.stage || 1, 1, stages.length);
    this.stage = getStage(this.stageNum);
    this.isLastStage = this.stageNum === stages.length;
    this.ended = false;
    this.bossStarted = false;
    this.lowHealthWarned = false;
    this.firedTalks = new Set();
    this.bossTips = new Set();
    this.gateNagAt = -10;
    this.fromCheckpoint = data.fromCheckpoint && this.save.checkpoint === this.stageNum;
    if (!this.registry.has('runTime')) this.registry.set('runTime', 0);

    // 슬로모션이 남아 있을 수 있으니 시간 속도를 되돌린다
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.physics.world.timeScale = 1;

    const st = this.stage;
    this.physics.world.setBounds(0, 0, st.width, 540);
    this.cameras.main.setBounds(0, 0, st.width, 540);

    this.drawBackground();
    this.buildLevel();
    this.makeParticles();

    const startX = this.fromCheckpoint ? st.checkpointX + 40 : st.playerStartX;
    this.player = new Player(this, startX, st.groundY - 40, cfg, {
      maxHealth: maxHealthFor(this.save.level, cfg.player.maxHealth, cfg.level),
      damageMultiplier: damageMultiplierFor(this.save.level, cfg.level),
    });
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.oneWays);

    this.monsters = [];
    if (!this.fromCheckpoint) {
      for (const spot of st.monsters) this.monsters.push(new Monster(this, parseMonsterSpot(spot, st.groundY), cfg));
      this.physics.add.collider(this.monsters, this.solids);
      this.physics.add.collider(this.monsters, this.oneWays);
    }
    this.buildGate();

    this.boss = new Boss(this, cfg, st, this.stageNum);
    this.physics.add.collider(this.player, this.boss.blocker);

    this.robot = new Robot(this, this.player);
    this.chargeG = this.add.graphics().setDepth(12);
    this.maxLabel = makeText(this, 0, 0, 'MAX!', 14, '#ffd23f').setOrigin(0.5).setDepth(13).setVisible(false);

    if (this.fromCheckpoint) {
      for (const t of st.talks) if (t.x < st.checkpointX) this.firedTalks.add(t);
      this.robot.say(['다시 가 보자! 이번엔 할 수 있어.']);
    } else {
      this.showStageBanner();
    }

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(120, 80);
    this.cameras.main.fadeIn(300);

    this.keys = this.input.keyboard.addKeys({
      left: KEY.A, right: KEY.D, left2: KEY.LEFT, right2: KEY.RIGHT,
      jump: KEY.SPACE, jump2: KEY.W, jump3: KEY.UP,
      attack: KEY.J, dash: KEY.K, dash2: KEY.SHIFT,
    });
    this.input.mouse?.disableContextMenu();

    const hud = this.scene.get('HUD');
    if (hud?.onGameStart) hud.onGameStart();

    // 자동 확인용 (브라우저 콘솔에서 window.__shock 으로 접근)
    window.__shock = { game: this.game, scene: this };
  }

  // ---------- 맵 ----------

  drawBackground() {
    const st = this.stage;
    const th = st.theme;
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-20);
    sky.fillGradientStyle(th.sky[0], th.sky[0], th.sky[1], th.sky[1], 1).fillRect(0, 0, 960, 540);
    sky.fillStyle(th.sun, 0.9).fillCircle(760, 150, 46);

    const rng = new Phaser.Math.RandomDataGenerator([`shock-hero-${this.stageNum}`]);
    const layer = (factor, color, minH, maxH, depth, windows) => {
      const g = this.add.graphics().setScrollFactor(factor, 1).setDepth(depth);
      const span = st.width * factor + 960;
      let x = -40;
      while (x < span) {
        const w = rng.between(60, 130);
        const h = rng.between(minH, maxH);
        const top = st.groundY - h;
        g.fillStyle(color, 1).fillRect(x, top, w, h + 60);
        // 부서진 꼭대기
        g.fillStyle(color, 1).fillTriangle(x, top, x + w * 0.4, top - rng.between(10, 40), x + w * 0.7, top);
        if (windows) {
          for (let wy = top + 14; wy < st.groundY - 20; wy += 26) {
            for (let wx = x + 10; wx < x + w - 14; wx += 20) {
              if (rng.frac() < 0.35) g.fillStyle(th.window, 0.7).fillRect(wx, wy, 8, 12);
            }
          }
        }
        x += w + rng.between(6, 30);
      }
    };
    layer(0.25, th.far, 160, 320, -15, false);
    layer(0.55, th.near, 90, 230, -12, true);

    // 연기
    const smoke = this.add.graphics().setScrollFactor(0.4, 1).setDepth(-14);
    for (let i = 0; i < 12; i++) {
      const sx = rng.between(0, st.width * 0.4 + 960);
      for (let j = 0; j < 5; j++) smoke.fillStyle(th.smoke, 0.18).fillCircle(sx + j * 12, 300 - j * 40, 30 + j * 8);
    }

    // 날씨 (눈, 불씨, 독 거품)
    const w = th.weather;
    if (w) {
      const opts = {
        snow: { y: -10, speedY: { min: 40, max: 90 }, speedX: { min: -20, max: 20 }, scale: { min: 0.15, max: 0.35 }, lifespan: 9000 },
        embers: { y: 560, speedY: { min: -80, max: -30 }, speedX: { min: -15, max: 15 }, scale: { start: 0.35, end: 0 }, lifespan: 6000 },
        bubbles: { y: 560, speedY: { min: -60, max: -25 }, speedX: { min: -10, max: 10 }, scale: { min: 0.2, max: 0.5 }, lifespan: 7000 },
      }[w.kind];
      if (opts) {
        const { y, ...rest } = opts;
        this.add
          .particles(0, y, 'puff', { x: { min: 0, max: 960 }, frequency: 120, alpha: { start: 0.8, end: 0.1 }, tint: w.color, ...rest })
          .setScrollFactor(0)
          .setDepth(-5);
      }
    }
  }

  buildLevel() {
    const st = this.stage;
    this.solids = [];
    this.oneWays = [];

    const ground = this.add.tileSprite(st.width / 2, st.groundY + 30, st.width, 60, 'ground').setDepth(0).setTint(st.theme.ground);
    this.physics.add.existing(ground, true);
    this.solids.push(ground);

    // 길가 잔해
    const rubble = this.add.graphics().setDepth(-1);
    for (let x = 200; x < st.width; x += 330) {
      rubble.fillStyle(0x4a4553, 1).fillTriangle(x, st.groundY, x + 30, st.groundY - 22, x + 64, st.groundY);
    }

    for (const p of st.platforms) {
      const plat = this.add.tileSprite(p.x, p.y + 10, p.w, 20, 'platform').setDepth(0);
      this.physics.add.existing(plat, true);
      // 아래와 옆에서는 통과하고 위에만 설 수 있다
      plat.body.checkCollision.down = false;
      plat.body.checkCollision.left = false;
      plat.body.checkCollision.right = false;
      this.oneWays.push(plat);
    }

    for (const s of st.signs) {
      const t = this.add
        .text(s.x, st.groundY - 120, s.text, {
          fontFamily: FONT, fontSize: '16px', color: '#1b1b1b', align: 'center',
          backgroundColor: '#f2e6c9', padding: { x: 10, y: 8 },
        })
        .setOrigin(0.5, 1)
        .setDepth(1);
      const post = this.add.graphics().setDepth(0.5);
      post.fillStyle(0x6b4a2b, 1).fillRect(s.x - 4, st.groundY - 120, 8, 120);
      t.setStroke('#6b4a2b', 0);
    }

    // 체크포인트 깃발
    this.flagActive = this.fromCheckpoint;
    this.flag = this.add.image(st.checkpointX, st.groundY, this.flagActive ? 'flag_on' : 'flag').setOrigin(0.2, 1).setDepth(2);

    // 보물 상자: 이미 찾은 보물은 나오지 않는다
    this.chests = [];
    for (const tr of st.treasures) {
      if (this.save.treasures.includes(tr.id)) continue;
      const img = this.add.image(tr.x, tr.y, 'chest').setOrigin(0.5, 1).setDepth(2).setDisplaySize(44, 34);
      this.tweens.add({ targets: img, y: tr.y - 4, duration: 500, yoyo: true, repeat: -1 });
      this.chests.push({ tr, img });
    }
  }

  // 보스 문: 몬스터를 다 잡아야 열린다
  buildGate() {
    const st = this.stage;
    this.gateOpen = this.fromCheckpoint || this.monsters.length === 0;
    if (this.gateOpen) return;
    const x = st.gateX;
    this.gateWall = this.add.rectangle(x, 270, 24, 540, 0xff3040, 0);
    this.physics.add.existing(this.gateWall, true);
    this.physics.add.collider(this.player, this.gateWall);
    this.physics.add.collider(this.monsters, this.gateWall);
    this.gateG = this.add.graphics().setDepth(3);
    this.gateLabel = makeText(this, x, st.groundY - 300, '', 18, '#ffffff', { backgroundColor: '#5a0010cc', padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setDepth(4);
  }

  updateGate() {
    if (this.gateOpen || !this.gateG) return;
    const st = this.stage;
    const left = this.monsters.length;
    if (left === 0) {
      this.openGate();
      return;
    }
    const x = st.gateX;
    const t = this.time.now / 1000;
    const g = this.gateG.clear();
    g.fillStyle(0xff3040, 0.25 + 0.1 * Math.sin(t * 6)).fillRect(x - 12, 0, 24, st.groundY);
    for (let y = (t * 120) % 40; y < st.groundY; y += 40) g.fillStyle(0xffa0a8, 0.7).fillRect(x - 10, y, 20, 6);
    g.lineStyle(3, 0xff6070, 1).lineBetween(x - 12, 0, x - 12, st.groundY).lineBetween(x + 12, 0, x + 12, st.groundY);
    this.gateLabel.setText(`몬스터 ${left}마리 남음`);

    const p = this.player;
    if (!p.dead && p.x > x - 50 && this.time.now / 1000 - this.gateNagAt > 5) {
      this.gateNagAt = this.time.now / 1000;
      this.sfxPlay('locked');
      this.robot.say(`문이 잠겼어! 몬스터가 ${left}마리 남았어. 뒤로 가서 다 잡자!`, true);
    }
  }

  openGate() {
    this.gateOpen = true;
    const x = this.stage.gateX;
    this.gateWall.destroy();
    this.gateLabel.destroy();
    this.tweens.add({ targets: this.gateG, alpha: 0, duration: 500, onComplete: () => this.gateG.destroy() });
    this.sparks.explode(30, x, this.stage.groundY - 100);
    floatText(this, x, this.stage.groundY - 160, '문이 열렸다!', '#3ff07a', 28);
    this.sfxPlay('gate');
    this.robot.say('몬스터를 다 잡았어! 문이 열렸다. 보스한테 가 보자!', true);
  }

  showStageBanner() {
    const t = makeText(this, 480, 200, `스테이지 ${this.stageNum}\n${this.stage.name}`, 44, '#ffd23f', { strokeThickness: 8 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60);
    this.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 600, onComplete: () => t.destroy() });
  }

  makeParticles() {
    const base = { lifespan: 450, speed: { min: 80, max: 320 }, scale: { start: 0.9, end: 0 }, emitting: false };
    this.sparks = this.add.particles(0, 0, 'spark', { ...base, tint: [0xffffff, 0xffe066, 0xffb030] }).setDepth(26);
    this.dust = this.add.particles(0, 0, 'puff', {
      ...base, lifespan: 600, speed: { min: 40, max: 200 }, angle: { min: 200, max: 340 },
      scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.7, end: 0 }, tint: [0x9b8f80, 0x6f665c],
    }).setDepth(9);
    this.goo = this.add.particles(0, 0, 'spark', { ...base, gravityY: 600, tint: [0xb06cff, 0x7a3cbf] }).setDepth(26);
    this.greenGoo = this.add.particles(0, 0, 'spark', { ...base, gravityY: 600, tint: [0x6fd34a, 0x2e7d1b] }).setDepth(26);
  }

  // ---------- 매 프레임 ----------

  update(_time, deltaMs) {
    const dt = (Math.min(deltaMs, 50) / 1000) * this.time.timeScale;
    const input = this.readInput();
    this.player.update(dt, input);
    for (const m of this.monsters) m.update(dt);
    this.monsters = this.monsters.filter((m) => !m.dead);
    this.updateGate();
    this.boss.update(dt);
    this.robot.update(dt);
    this.drawCharge();
    this.checkTriggers();

    if (!this.ended && !this.player.dead) this.registry.set('runTime', this.registry.get('runTime') + dt);

    if (!this.lowHealthWarned && !this.player.dead && this.player.health.ratio < 0.3) {
      this.lowHealthWarned = true;
      this.robot.say('체력이 위험해! 조심해!', true);
    }
  }

  readInput() {
    const k = this.keys;
    const justDown = (...keys) => keys.map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    const p = this.input.activePointer;
    if (this.ended) return { left: false, right: false, jumpDown: false, jumpPressed: false, attackDown: false, dashPressed: false };
    return {
      left: k.left.isDown || k.left2.isDown,
      right: k.right.isDown || k.right2.isDown,
      jumpDown: k.jump.isDown || k.jump2.isDown || k.jump3.isDown,
      jumpPressed: justDown(k.jump, k.jump2, k.jump3),
      attackDown: k.attack.isDown || (p.isDown && p.leftButtonDown()),
      dashPressed: justDown(k.dash, k.dash2),
    };
  }

  drawCharge() {
    const p = this.player;
    this.chargeG.clear();
    if (!p.isCharging || p.dead) {
      this.maxLabel.setVisible(false);
      return;
    }
    const r = p.chargeRatio;
    const full = r >= 1;
    const pulse = full ? 1 + Math.sin(this.time.now / 60) * 0.12 : 1;
    this.chargeG.lineStyle(4, 0x000000, 0.35).strokeCircle(p.x, p.y, 40);
    this.chargeG.lineStyle(full ? 6 : 4, full ? 0xffd23f : 0xffffff, 1);
    this.chargeG.beginPath();
    this.chargeG.arc(p.x, p.y, 40 * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, r), false);
    this.chargeG.strokePath();
    this.maxLabel.setPosition(p.x, p.y - 52).setVisible(full);
    p.setTint(full && Math.floor(this.time.now / 80) % 2 === 0 ? 0xfff3a0 : 0xffffff);
  }

  checkTriggers() {
    const p = this.player;
    const st = this.stage;
    if (p.dead) return;

    for (const t of st.talks) {
      if (!this.firedTalks.has(t) && p.x >= t.x) {
        this.firedTalks.add(t);
        this.robot.say(t.lines);
      }
    }

    if (!this.flagActive && p.x >= st.checkpointX - 10) {
      this.flagActive = true;
      this.flag.setTexture('flag_on');
      p.health.healFull();
      this.save = saveStore.update({ checkpoint: this.stageNum });
      floatText(this, st.checkpointX, st.groundY - 110, '체크포인트! 체력 회복', '#3ff07a', 22);
      this.sfxPlay('coin');
    }

    for (const c of this.chests) {
      const tr = c.tr;
      if (c.taken || Math.abs(p.x - tr.x) >= 34 || Math.abs(p.y - (tr.y - 20)) >= 50) continue;
      this.takeTreasure(c);
    }
    this.chests = this.chests.filter((c) => !c.taken);

    if (!this.bossStarted && p.x >= st.arena.startX + 80) this.startBossFight();
  }

  // 보물을 먹으면 상자가 열리고 위로 떠오르며 사라진다
  takeTreasure(c) {
    const { tr, img } = c;
    c.taken = true;
    this.tweens.killTweensOf(img);
    img.setTexture('chest_open').setY(tr.y);
    this.tweens.add({ targets: img, y: tr.y - 40, alpha: 0, scale: img.scale * 1.3, delay: 150, duration: 500, onComplete: () => img.destroy() });
    this.save = saveStore.update({ treasures: [...this.save.treasures, tr.id] });
    this.sparks.explode(24, tr.x, tr.y - 20);
    const found = this.stage.treasures.filter((t) => this.save.treasures.includes(t.id)).length;
    floatText(this, tr.x, tr.y - 50, `보물 발견! (${found}/${this.stage.treasures.length})`, '#ffd23f', 24);
    this.sfxPlay('coin');
    this.robot.say(found === this.stage.treasures.length ? '이 스테이지 보물을 전부 찾았어! 대단해!' : '보물이다! 역시 내 눈은 정확해.', true);
    this.gainXp(tr.xp, tr.x, tr.y - 70);
  }

  startBossFight() {
    const a = this.stage.arena;
    this.bossStarted = true;
    const wall = this.add.rectangle(a.startX - 10, 270, 20, 540, 0x8a8f99, 0.0);
    this.physics.add.existing(wall, true);
    this.physics.add.collider(this.player, wall);
    const gate = this.add.graphics().setDepth(3);
    gate.fillStyle(0xff4040, 0.35).fillRect(a.startX - 12, 0, 12, this.stage.groundY);

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(a.startX + 480, 270, 700, 'Sine.easeInOut');
    this.boss.startFight();
    this.sfxPlay('roar');
    this.shake(0.01, 600);
    const title = makeText(this, a.startX + 480, 150, `${this.boss.name} 등장!`, 40, '#ff5555', { strokeThickness: 8 }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: title, alpha: 0, delay: 1400, duration: 500, onComplete: () => title.destroy() });
    this.robot.say(['으악, 크다!', '빨간 곳에 팔이 떨어져. 피한 다음 바닥에 박힌 팔을 때려!'], true);
    this.bossTips.add('slam');
  }

  // ---------- 플레이어 이벤트 ----------

  onPlayerAttack(player, attack) {
    const rect = player.attackRect(attack.range);
    const dir = player.facing;
    const cx = dir > 0 ? rect.right - 10 : rect.x + 10;
    const cy = player.y - 2;

    if (attack.kind === 'punch') {
      this.sfxPlay('punch');
      const puff = this.add.ellipse(cx, cy, 34, 24, 0xffffff, 0.85).setDepth(24);
      this.tweens.add({ targets: puff, scaleX: 1.5, scaleY: 1.3, alpha: 0, duration: 140, onComplete: () => puff.destroy() });
    } else {
      this.sfxPlay('charged');
      const w = attack.range + 20;
      const h = 44 + 40 * attack.ratio;
      const wave = this.add.ellipse(player.x + dir * (w / 2 + 6), cy, w, h, 0xffaa22, 0.8).setDepth(24);
      this.tweens.add({ targets: wave, scaleX: 1.4, scaleY: 1.2, alpha: 0, duration: 220, onComplete: () => wave.destroy() });
      this.sparks.explode(Math.round(6 + 14 * attack.ratio), cx, cy);
      if (attack.full) {
        ring(this, cx, cy, 0xffd23f, 90, 320);
        this.shake(0.01, 160);
      }
    }

    let hitAny = false;
    for (const m of this.monsters) {
      if (!m.dead && intersects(rect, m.getBounds())) {
        m.takeHit(attack, dir);
        hitAny = true;
      }
    }
    if (this.boss.receiveAttack(rect, attack)) hitAny = true;

    if (hitAny) {
      this.sfxPlay('hit');
      if (attack.kind === 'charged') this.shake(0.004 + 0.008 * attack.ratio, 120);
    }
  }

  onChargeFull(player) {
    this.sfxPlay('chargeFull');
    ring(this, player.x, player.y, 0xffffff, 50, 200, 3);
  }

  onChargeCancelled(player) {
    player.setTint(0xffffff);
    floatText(this, player.x, player.y - 50, '충전 취소!', '#bfc7d5', 16);
  }

  onDash(player) {
    this.sfxPlay('dash');
    this.dust.explode(5, player.x, player.y + 28);
  }

  onPlayerJump() {
    this.sfxPlay('jump');
  }

  onDodge(player) {
    this.sfxPlay('dodge');
    floatText(this, player.x, player.y - 50, '회피!', '#3ff0ff', 20);
  }

  onPlayerHurt(player, damage) {
    this.sfxPlay('hurt');
    player.setTint(0xffffff);
    floatText(this, player.x, player.y - 40, `-${damage}`, '#ff5555', 20);
    this.shake(0.008, 150);
  }

  onPlayerDied() {
    this.chargeG.clear();
    this.maxLabel.setVisible(false);
    this.robot.say('히어로! 일어나! 체크포인트로 돌아가자.', true);
    this.time.delayedCall(1300, () => this.scene.get('HUD')?.showGameOver(this.save.checkpoint === this.stageNum));
  }

  spawnGhost(player) {
    const g = this.add.image(player.x, player.y, 'player').setDisplaySize(40, 60).setFlipX(player.flipX).setAlpha(0.5).setTint(0x66ccff).setDepth(9);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  onMonsterKilled(monster) {
    this.greenGoo.explode(16, monster.x, monster.y);
    this.gainXp(monster.m.xp, monster.x, monster.y - 40);
    if (Math.random() < cfg.monster.heartDropChance) this.dropHeart(monster.x, monster.y - 10);
  }

  // 하트: 먹으면 체력이 찬다. 10초 뒤 사라진다.
  dropHeart(x, y) {
    const h = this.physics.add.image(x, y, 'heart').setDepth(6).setBounce(0.3).setVelocity(Phaser.Math.Between(-60, 60), -320);
    h.body.setSize(24, 22);
    this.physics.add.collider(h, this.solids);
    this.physics.add.collider(h, this.oneWays);
    this.physics.add.overlap(this.player, h, () => {
      const ph = this.player.health;
      if (!h.active || this.player.dead || ph.current >= ph.max) return;
      const healed = ph.heal(cfg.monster.heartHeal);
      floatText(this, h.x, h.y - 20, `+${Math.round(healed)} 체력`, '#ff8aa0', 18);
      this.sfxPlay('coin');
      h.destroy();
    });
    this.time.delayedCall(8000, () => {
      if (h.active) this.tweens.add({ targets: h, alpha: 0, duration: 200, yoyo: true, repeat: 4, onComplete: () => h.destroy() });
    });
  }

  gainXp(amount, x, y) {
    const before = this.save;
    const r = addXp(before, amount, cfg.level);
    this.save = saveStore.update({ level: r.level, xp: r.xp });
    floatText(this, x, y, `+${amount} XP`, '#9fe8ff', 16);
    if (r.levelsGained > 0) {
      const p = this.player;
      p.health.setMax(maxHealthFor(r.level, cfg.player.maxHealth, cfg.level));
      p.health.heal(cfg.level.healthPerLevel * r.levelsGained);
      p.damageMultiplier = damageMultiplierFor(r.level, cfg.level);
      this.time.delayedCall(250, () => {
        floatText(this, p.x, p.y - 70, `레벨 업! Lv ${r.level}`, '#ffd23f', 26);
        ring(this, p.x, p.y, 0xffd23f, 70, 400, 4);
        this.sfxPlay('levelup');
      });
      this.robot.say('레벨 업! 근육이 0.1mm 커졌어!');
    }
  }

  onBossDefeated(boss) {
    const fx = cfg.effects;
    const scale = Math.max(0.05, Math.min(1, fx.slowMotionScale));
    this.time.timeScale = scale;
    this.tweens.timeScale = scale;
    this.physics.world.timeScale = 1 / scale;
    this.cameras.main.flash(250, 255, 255, 255);
    this.sfxPlay('break');
    this.ended = true;

    // time 은 timeScale 영향을 받으므로 실제 시간 = delay / scale
    const real = (ms) => ms * scale;
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(real(i * 180), () => {
        const x = boss.bodyX + Phaser.Math.Between(-90, 90);
        const y = boss.groundY - Phaser.Math.Between(40, 260);
        this.goo.explode(20, x, y);
        ring(this, x, y, 0xffd23f, 80, 300);
        this.shake(0.012, 150);
      });
    }

    this.time.delayedCall(real(fx.slowMotionTime * 1000), () => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
      this.physics.world.timeScale = 1;
      boss.collapse();
      this.sfxPlay('slam');
      this.shake(0.02, 600);
      this.gainXp(cfg.boss.xp, boss.bodyX, boss.groundY - 300);
      this.robot.say(this.isLastStage ? ['해냈다! 괴물들의 왕을 쓰러뜨렸어!', '도시가 완전히 평화를 되찾았어!'] : ['해냈다!', '다음엔 좀 덜 무서운 괴물이면 좋겠어.'], true);
      this.time.delayedCall(1800, () => this.finishVictory());
    });
  }

  finishVictory() {
    const time = this.registry.get('runTime');
    const { patch, isRecord, best } = clearStagePatch(saveStore.load(), this.stageNum, time);
    this.save = saveStore.update(patch);
    this.sfxPlay('victory');
    this.robot.queue = [];
    this.robot.bubble.setVisible(false);
    const found = this.stage.treasures.filter((t) => this.save.treasures.includes(t.id)).length;
    this.scene.get('HUD')?.showVictory({
      stage: this.stageNum,
      last: this.isLastStage,
      time,
      best,
      isRecord,
      level: this.save.level,
      treasures: `${found}/${this.stage.treasures.length}`,
    });
  }

  // ---------- 도우미 ----------

  shake(intensity, duration) {
    if (!cfg.effects.screenShake || !saveStore.load().settings.shake) return;
    this.cameras.main.shake(duration, intensity);
  }

  sfxPlay(name) {
    sfx.play(name);
  }

  dustAt(x, y, n) {
    this.dust.explode(n, x, y);
  }

  gooAt(x, y, n) {
    this.goo.explode(n, x, y);
  }

  greenGooAt(x, y, n) {
    this.greenGoo.explode(n, x, y);
  }
}
