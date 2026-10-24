// 자동 플레이 봇 (보스 B): bot2 에 주먹 발사, 빨아들이기, 얼음 돌연변이, 킹 돌연변이 대응을 더했다.
// 진짜 키 입력 대신 scene.readInput 을 바꿔 끼워 같은 입력 값을 넣는다.
(() => {
  const s = window.__shock.scene;
  window.__shockAutoPick = true; // 레벨 업 카드는 화면 없이 자동으로 고른다 (봇이 멈추지 않게)
  const B = { hold: 0, dashCool: 0, t: 0, jumpCool: 0, stuck: 0, lastX: 0, jumpHold: 0 };
  window.__botState = B;
  s.readInput = function () {
    const dt = 1 / 60;
    B.t += dt; B.dashCool -= dt; B.jumpCool -= dt; B.jumpHold -= dt;
    const p = this.player;
    const inp = { left: false, right: false, jumpDown: false, jumpPressed: false, attackDown: false, dashPressed: false, upDown: false, ultPressed: false };
    if (this.ended || p.dead) return inp;
    const grounded = p.body.blocked.down || p.body.touching.down;
    const go = (tx, tol = 6) => { if (tx > p.x + tol) inp.right = true; else if (tx < p.x - tol) inp.left = true; };
    const face = (dir) => { if (dir > 0) inp.right = true; else inp.left = true; };
    const dash = (dir) => {
      if (B.dashCool <= 0 && p.dashCd.ready) { face(dir); inp.dashPressed = true; B.dashCool = 0.3; B.hold = 0; return true; }
      return false;
    };
    const jump = () => {
      if (grounded && B.jumpCool <= 0) { inp.jumpPressed = true; inp.jumpDown = true; B.jumpCool = 0.3; B.jumpHold = 0.45; }
      else if (B.jumpHold > 0) inp.jumpDown = true;
    };
    if (B.jumpHold > 0) inp.jumpDown = true;
    const charge = (secs) => { B.hold += dt; if (B.hold < secs) inp.attackDown = true; else B.hold = 0; };
    // 목표 지점(cx)을 때리기: 왼쪽에 서서 오른쪽을 보고 친다 (벽 쪽이면 반대)
    const strike = (cx, secs, wallX, gap = 62) => {
      const fromRight = cx - gap < wallX + 25;
      const tx = fromRight ? cx + gap : cx - gap;
      const want = fromRight ? -1 : 1;
      if (Math.abs(p.x - tx) > 16 && !p.isCharging) { go(tx, 10); B.hold = 0; return; }
      if (p.facing !== want && !p.charging) { face(want); return; }
      charge(secs);
    };
    const flee = (zones, lo, hi) => {
      const inZone = (x) => zones.some(([l, r]) => x > l && x < r);
      if (!inZone(p.x)) return false;
      B.hold = 0;
      let best = null;
      for (let d = 20; d < 700 && best === null; d += 20) {
        for (const x of [p.x - d, p.x + d]) if (x >= lo && x <= hi && !inZone(x)) { best = x; break; }
      }
      if (best !== null) go(best, 4);
      return true;
    };

    const boss = this.boss;
    if (this.bossStarted && boss.state === 'fight') {
      const kind = this.stage.boss.type;
      const plan = (kind === 'ice' && window.__botIcePlan) || (kind === 'king' && window.__botKingPlan) || armPlan;
      return plan.call(this, boss, p, inp, { go, face, dash, jump, charge, strike, flee, grounded, B, dt });
    }
    if (this.bossStarted) return inp;

    // 몬스터 사냥
    const m = this.monsters.filter((x) => !x.dead).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (m) return hunt(m, p, inp, { go, face, dash, jump, charge, B, dt });
    B.hold = 0;
    inp.right = true;
    return inp;
  };

  function hunt(m, p, inp, h) {
    const { go, face, dash, jump, charge, B, dt } = h;
    const dx = m.x - p.x;
    const dist = Math.abs(dx);
    const above = p.y - m.y > 50;
    if (m.type === 'jumper') {
      if (m.state === 'windup') { B.hold = 0; return inp; }
      if (m.state === 'attack') { if (dist < 140) dash(Math.sign(dx)); return inp; }
    } else if (m.state === 'windup' && m.stateTime > 0.25 && dist < 100) { dash(-Math.sign(dx)); return inp; }
    if (dist > 75 && !p.isCharging) {
      go(m.x - Math.sign(dx) * 60, 8); B.hold = 0;
      if (above && dist < 140) jump();
      if (Math.abs(p.x - B.lastX) < 0.5) B.stuck += dt; else B.stuck = 0;
      B.lastX = p.x;
      if (B.stuck > 0.6) { jump(); B.stuck = 0; }
      return inp;
    }
    if (above) { jump(); return inp; }
    if (Math.sign(dx) !== p.facing && !p.charging) { face(Math.sign(dx)); return inp; }
    charge(m.state === 'recover' || m.state === 'stunned' || m.state === 'down' ? 0.35 : 0.6);
    return inp;
  }
  window.__botHunt = hunt;

  // 난이도로 겹쳐 나오는 공격 (보스.combo): 떨어지는 곳과 다가오는 충격파
  function comboWave(boss, p) {
    const j = boss.combo && boss.combo.job;
    if (!j || j.kind !== 'wave' || j.phase !== 'run') return false;
    const d = (p.x - j.x) * j.dir;
    return d > -10 && d < 90;
  }
  function comboZones(boss) {
    return boss.combo ? boss.combo.zones() : [];
  }

  // 팔 보스 (스테이지 1~3, 킹 돌연변이 앉은 단계)
  function armPlan(boss, p, inp, h) {
    const { go, dash, jump, charge, strike, flee, B } = h;
    const a = boss.action;
    const zones = [];
    let sweepArm = null;
    let wave = null;
    const lo = boss.minX - 40, hi = boss.frontX - 30;
    // 부하가 가까이 있으면 먼저 처리
    const minion = this.monsters.find((m) => !m.dead && Math.abs(m.x - p.x) < 120);
    if (comboWave(boss, p)) { B.hold = 0; jump(); return inp; }
    if (a && a.type === 'rocketPunch' && (a.phase === 'aim' || a.phase === 'fly')) {
      B.hold = 0;
      const fist = a.arm.fist;
      if (a.height === 'low') {
        if (a.phase === 'fly' && fist.x > p.x && fist.x - p.x < 150) jump();
        else if (p.x < boss.arenaStart + 40) go(boss.arenaStart + 120, 10);
      }
      // 높으면 가만히 (땅에 서 있기)
      return inp;
    }
    if (a && a.type === 'inhale' && a.phase !== 'after') {
      B.hold = 0;
      inp.left = true;
      return inp;
    }
    if (a && a.jobs) {
      for (const j of a.jobs) {
        if (!j.arm.alive) continue;
        if (j.kind === 'slam' && (j.phase === 'aim' || j.phase === 'drop')) zones.push([j.target - 100, j.target + 100]);
        if (j.kind === 'sweep' && (j.phase === 'drop' || j.phase === 'slide')) sweepArm = j.arm;
      }
    }
    if (a && a.type === 'rocks' && a.phase !== 'after') for (const x of a.targets) zones.push([x - 70, x + 70]);
    if (a && a.type === 'spit') for (const g of boss.globs) if (!g.done) zones.push([g.tx - 65, g.tx + 65]);
    if (a && a.type === 'shockwave') wave = boss.waves.find((w) => w.x > p.x - 30 && w.x - p.x < 95);
    if (a && a.type === 'summon' && a.spots) for (const x of a.spots) zones.push([x - 60, x + 60]);
    zones.push(...comboZones(boss));
    if (comboWave(boss, p)) { B.hold = 0; jump(); return inp; }

    if (sweepArm && sweepArm.sprite.x > p.x && sweepArm.sprite.x - p.x < 120) { if (dash(1)) return inp; }
    if (wave) { B.hold = 0; jump(); return inp; }
    if (flee(zones, lo, hi)) return inp;
    const inZone = (x) => zones.some(([l, r]) => x > l && x < r);
    if (minion) { window.__botHunt(minion, p, inp, h); return inp; }
    const arm = boss.armsAlive.find((x) => x.hittable && !inZone(x.hitRect().centerX - 62));
    if (arm) { strike(arm.hitRect().centerX, arm.fist ? 0.5 : 0.9, boss.arenaStart); return inp; }
    if (boss.coreExposed && !inZone(boss.frontX - 20)) {
      const tx = boss.frontX - 20;
      if (p.x < tx - 25 && !p.isCharging) { go(tx, 10); B.hold = 0; return inp; }
      if (p.facing < 0 && !p.charging) { inp.right = true; return inp; }
      charge(1.3);
      return inp;
    }
    const m2 = this.monsters.find((m) => !m.dead);
    if (m2) { window.__botHunt(m2, p, inp, h); return inp; }
    B.hold = 0;
    go((boss.minX + boss.maxArmX) / 2 - 60, 30);
    return inp;
  }
  window.__botArmPlan = armPlan;

  // 점프해서 공중에서 충전 펀치 (낮게 뜬 얼음 돌연변이용)
  function jumpStrike(p, inp, h, tx) {
    const { go, face, jump, grounded, B } = h;
    if (grounded && !B.air) {
      if (Math.abs(p.x - tx) > 14) { go(tx, 10); B.hold = 0; return; }
      if (p.facing < 0) { face(1); return; }
      jump();
      B.air = true;
      inp.attackDown = true;
      return;
    }
    if (B.air) {
      if (p.body.velocity.y < -40) inp.attackDown = true; // 올라가는 동안 꾹
      if (grounded && p.body.velocity.y >= 0 && B.jumpCool <= 0) B.air = false;
    }
  }

  // 얼음 돌연변이 (날아다니는 보스)
  window.__botIcePlan = function (boss, p, inp, h) {
    const { go, dash, jump, strike, flee, B } = h;
    const a = boss.action;
    const lo = boss.minX - 40, hi = boss.maxX + 40;
    const zones = comboZones(boss);
    if (comboWave(boss, p)) { B.hold = 0; jump(); return inp; }
    if (B.air && !(a && a.type === 'dive' && a.phase === 'hover')) {
      // 점프 공격 중이었으면 마저 떼기
      if (p.body.velocity.y < -40) inp.attackDown = true;
      if (h.grounded) B.air = false;
    }
    if (a) {
      if (a.type === 'icicles' && (a.phase === 'aim' || a.phase === 'fall')) for (const x of a.targets) zones.push([x - 62, x + 62]);
      if (a.type === 'hop' && a.phase !== 'after') zones.push([a.tx - 125, a.tx + 125]);
      if (a.type === 'dive' && a.phase === 'dive') {
        const dx = boss.x - p.x;
        if (Math.sign(dx) === -a.dir && Math.abs(dx) < 175 && boss.y > boss.groundY - 170) { B.hold = 0; dash(Math.sign(dx) || 1); return inp; }
      }
      if (a.type === 'frostBreath' && a.phase === 'blow') {
        const d = (p.x - a.front) * a.dir;
        if (d > 0 && d < 62) { B.hold = 0; jump(); return inp; }
      }
      if (a.type === 'dive' && a.phase === 'hover') {
        jumpStrike(p, inp, h, Phaser_clamp(boss.x - 60, lo + 40, hi - 40));
        return inp;
      }
      if (a.type === 'land' && a.phase === 'rest') { strike(boss.x, 0.9, boss.arenaStart, 112); return inp; }
    }
    if (flee(zones, lo, hi)) return inp;
    if (boss.mode === 'grounded' && !(a && a.type === 'crash')) {
      const inZone = (x) => zones.some(([l, r]) => x > l && x < r);
      if (!(a && a.type === 'frostBreath' && a.phase === 'blow') && !inZone(boss.x - 112)) { strike(boss.x, 1.0, boss.arenaStart, 112); return inp; }
    }
    B.hold = 0;
    // 공격이 없으면 싸움터 가운데쯤에서 기다리기
    const mid = (boss.minX + boss.maxX) / 2;
    go(Phaser_clamp(boss.x + (p.x < boss.x ? -160 : 160), mid - 300, mid + 300), 30);
    return inp;
  };
  function Phaser_clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // 킹 돌연변이: 앉아 있을 땐 팔 보스처럼, 일어서면 따로
  window.__botKingPlan = function (boss, p, inp, h) {
    if (!boss.standing) return armPlan.call(this, boss, p, inp, h);
    const { go, dash, jump, strike, flee, B } = h;
    const a = boss.action;
    const lo = boss.minX - 40, hi = boss.maxX + 40;
    if (boss.standStage !== 'ready') { B.hold = 0; go(boss.minX + 40, 10); return inp; }
    const wave = boss.kwaves.find((w) => { const d = (p.x - w.x) * w.dir; return d > -10 && d < 85; });
    if (wave) { B.hold = 0; jump(); return inp; }
    if (comboWave(boss, p)) { B.hold = 0; jump(); return inp; }
    const zones = comboZones(boss);
    if (a) {
      if (a.type === 'leap' && a.phase !== 'after') zones.push([a.tx - 130, a.tx + 130]);
      if (a.type === 'rocks' && a.phase !== 'after') for (const x of a.targets) zones.push([x - 70, x + 70]);
      if (a.type === 'summon' && a.spots) for (const x of a.spots) zones.push([x - 60, x + 60]);
      if (a.type === 'charge' && a.phase === 'run') {
        const dx = boss.kx - p.x;
        if (Math.sign(dx) === a.dir * -1 && Math.abs(dx) < 160) { B.hold = 0; dash(Math.sign(dx) || 1); return inp; }
      }
      if (a.type === 'inhale' && a.phase !== 'after') { B.hold = 0; if (p.x < boss.kx) inp.left = true; else inp.right = true; return inp; }
    }
    if (flee(zones, lo, hi)) return inp;
    const minion = this.monsters.find((m) => !m.dead && Math.abs(m.x - p.x) < 130);
    if (minion) { window.__botHunt(minion, p, inp, h); return inp; }
    const busy = a && (a.type === 'charge' && a.phase === 'aim');
    if (!busy) { strike(boss.kx, 0.8, boss.arenaStart, 95); return inp; }
    B.hold = 0;
    return inp;
  };
  return 'bot_bossb installed';
})();
