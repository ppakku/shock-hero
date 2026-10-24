// 자동 플레이 봇 v2: 몬스터를 모두 사냥하고, 보스의 모든 공격을 피하며 싸운다.
(() => {
  const s = window.__shock.scene;
  const log = (window.__botLog = window.__botLog || []);
  const B = { hold: 0, dashCool: 0, t: 0, jumpCool: 0, stuck: 0, lastX: 0 };
  window.__botState = B;
  s.readInput = function () {
    const dt = 1 / 60;
    B.t += dt; B.dashCool -= dt; B.jumpCool -= dt;
    const p = this.player;
    const inp = { left: false, right: false, jumpDown: false, jumpPressed: false, attackDown: false, dashPressed: false };
    if (this.ended || p.dead) return inp;
    const grounded = p.body.blocked.down || p.body.touching.down;
    const go = (tx, tol = 6) => { if (tx > p.x + tol) inp.right = true; else if (tx < p.x - tol) inp.left = true; };
    const face = (dir) => { if (dir > 0) inp.right = true; else inp.left = true; };
    const dash = (dir) => {
      if (B.dashCool <= 0 && p.dashCd.ready) { face(dir); inp.dashPressed = true; B.dashCool = 0.3; B.hold = 0; return true; }
      return false;
    };
    const jump = () => { if (grounded && B.jumpCool <= 0) { inp.jumpPressed = true; inp.jumpDown = true; B.jumpCool = 0.3; } else inp.jumpDown = true; };
    const charge = (secs) => { B.hold += dt; if (B.hold < secs) inp.attackDown = true; else B.hold = 0; };

    const boss = this.boss;
    if (this.bossStarted && boss.state === 'fight') {
      const a = boss.action;
      const zones = [];
      let sweepArm = null;
      let wave = null;
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
      const inZone = (x) => zones.some(([l, r]) => x > l && x < r);
      const lo = boss.minX - 40, hi = boss.frontX - 30;

      if (sweepArm && sweepArm.sprite.x > p.x && sweepArm.sprite.x - p.x < 120) { if (dash(1)) return inp; }
      if (wave) { B.hold = 0; jump(); return inp; }
      if (inZone(p.x)) {
        B.hold = 0;
        let best = null;
        for (let d = 20; d < 500 && best === null; d += 20) {
          for (const x of [p.x - d, p.x + d]) if (x >= lo && x <= hi && !inZone(x)) { best = x; break; }
        }
        if (best !== null) go(best, 4);
        return inp;
      }
      const arm = boss.armsAlive.find((x) => x.hittable && !inZone(x.sprite.x - 70));
      if (arm) {
        const tx = arm.sprite.x - 70;
        if (Math.abs(p.x - tx) > 14 && !p.isCharging) { go(tx, 10); B.hold = 0; return inp; }
        if (p.facing < 0 && !p.charging) { inp.right = true; return inp; }
        charge(0.9);
        return inp;
      }
      if (boss.coreExposed && !inZone(boss.frontX - 20)) {
        const tx = boss.frontX - 20;
        if (p.x < tx - 25 && !p.isCharging) { go(tx, 10); B.hold = 0; return inp; }
        if (p.facing < 0 && !p.charging) { inp.right = true; return inp; }
        charge(1.3);
        return inp;
      }
      B.hold = 0;
      go((boss.minX + boss.maxArmX) / 2 - 60, 30);
      return inp;
    }
    if (this.bossStarted) return inp;

    // 몬스터 사냥 (왼쪽에 남은 녀석도 찾아감)
    const m = this.monsters.filter((x) => !x.dead).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (m) {
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
        // 막혔으면 점프
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
    B.hold = 0;
    inp.right = true;
    return inp;
  };
  return 'bot2 installed';
})();
