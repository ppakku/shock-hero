// 자동 플레이 봇 (독 두꺼비, 용암 골렘용): scene.readInput 을 바꿔 끼워서 진짜 입력으로 싸운다.
// 경고가 뜬 공격은 피하고(옆으로 비키기, 점프, 대시), 때릴 기회에만 때린다.
(() => {
  const s = window.__shock.scene;
  const B = { t: 0, dashCool: 0, jumpCool: 0, hold: 0, tap: false };
  window.__botState = B;
  s.readInput = function () {
    const dt = 1 / 60;
    B.t += dt;
    B.dashCool -= dt;
    B.jumpCool -= dt;
    const p = this.player;
    const inp = { left: false, right: false, jumpDown: false, jumpPressed: false, attackDown: false, dashPressed: false, upDown: false, ultPressed: false };
    if (this.ended || p.dead) return inp;
    const grounded = p.body.blocked.down || p.body.touching.down;
    const go = (tx, tol = 6) => {
      if (tx > p.x + tol) inp.right = true;
      else if (tx < p.x - tol) inp.left = true;
    };
    const face = (dir) => {
      if (dir > 0) inp.right = true;
      else inp.left = true;
    };
    const dash = (dir) => {
      if (B.dashCool <= 0 && p.dashCd.ready) {
        face(dir);
        inp.dashPressed = true;
        B.dashCool = 0.3;
        B.hold = 0;
        return true;
      }
      return false;
    };
    const jump = () => {
      if (grounded && B.jumpCool <= 0) {
        inp.jumpPressed = true;
        B.jumpCool = 0.3;
      }
      inp.jumpDown = true;
    };
    const punch = () => {
      B.tap = !B.tap;
      inp.attackDown = B.tap;
    };
    const charge = (secs) => {
      B.hold += dt;
      if (B.hold < secs) inp.attackDown = true;
      else B.hold = 0;
    };

    const boss = this.boss;
    if (!this.bossStarted) {
      inp.right = true;
      return inp;
    }
    if (boss.state !== 'fight') return inp;

    const lo = boss.arenaStart + 30;
    const hi = boss.arenaEnd - 30;
    const zones = []; // 꼭 피할 곳
    const soft = []; // 되도록 피할 곳 (웅덩이)
    for (const pd of boss.puddles.list) soft.push([pd.x - pd.w / 2 - 22, pd.x + pd.w / 2 + 22]);
    // 다가오는 충격파와 땅을 훑는 불길은 점프
    const waveLists = [boss.waves?.list || [], boss.flames?.list || []];
    const wave = waveLists.flat().find((w) => !w.hasHit && (w.x - p.x) * w.dir < 10 && Math.abs(w.x - p.x) < 110);
    const a = boss.action;
    let target = null; // { x, face, mode }
    // 겹치기 공격 (난이도)
    const sd = boss.side;
    if (sd && sd.phase !== 'wait') {
      if (sd.tx !== undefined) zones.push([sd.tx - 80, sd.tx + 80]);
      if (sd.xs) for (const x of sd.xs) zones.push([x - 58, x + 58]);
    }
    // 가슴 높이로 날아오는 것(긴 팔, 꼬리)은 경고가 끝날 때쯤 점프
    const bandJump = (x0, x1, left, phase, early = 0.1) => {
      const inBand = p.x + 16 > Math.min(x0, x1) && p.x - 16 < Math.max(x0, x1);
      if (!inBand) return false;
      if (phase !== 'aim' || left < early) jump();
      B.hold = 0;
      return true;
    };

    if (boss.arm) {
      // 포레스트 와처
      if (boss.grab) {
        dash(p.x < boss.x ? -1 : 1);
        return inp;
      }
      if (a?.type === 'burrow' && a.phase === 'hidden') zones.push([a.tx - 140, a.tx + 140]);
      for (const g of boss.globs) zones.push([g.tx - 70, g.tx + 70]);
      for (const v of boss.vines) if (v.t < v.warn + 0.7) zones.push([v.x - 62, v.x + 62]);
      if (a?.type === 'crawl') for (const d of a.drops) if (!d.done) zones.push([d.x - 70, d.x + 70]);
      if (a?.type === 'claw' && (a.phase === 'aim' || a.phase === 'shoot' || a.phase === 'hold')) {
        const sx = boss.shoulder.x;
        if (bandJump(sx, sx + boss.facing * a.len, boss.k.clawWarningTime * boss.speed - a.t, a.phase)) return inp;
      }
      if (a?.type === 'claw' && a.phase === 'stuck' && boss.arm.alive) {
        target = { x: (boss.shoulder.x + a.tipX) / 2 + boss.facing * 40, face: -boss.facing, mode: 'punch' };
      }
      if (boss.tired) {
        if (boss.headOpen) {
          const hr = boss.headRect();
          target = { x: hr.centerX + boss.facing * 60, face: -boss.facing, mode: 'charge' };
        } else if (boss.back.alive) target = { x: boss.blisterPos().x - 45, face: 1, mode: 'punch' };
      }
    } else {
      // 아스트라노바X
      const f = boss.facing;
      if (a?.type === 'pillars') {
        for (const w of a.waves) {
          const lt = a.t - w.start;
          if (lt > -0.05 && lt < w.warn + 0.5) for (const x of w.xs) zones.push([x - 58, x + 58]);
        }
      }
      for (const b of boss.balls) zones.push([b.x - 60, b.x + 60]);
      if (a?.type === 'fly') {
        for (const b of a.bombs) if (!b.done) zones.push([b.x - 70, b.x + 70]);
        zones.push([a.lx - 150, a.lx + 150]);
      }
      if (a?.type === 'wing') {
        for (const x of a.pillars) zones.push([x - 70, x + 70]);
        if (a.phase === 'gust') {
          go(boss.x, 60); // 바람을 거슬러 용 쪽으로 걷는다
          return inp;
        }
      }
      if (a?.type === 'tail' && (a.phase === 'aim' || a.phase === 'sweep')) {
        const r0 = boss.x - f * 70;
        const r1 = boss.x - f * ((boss.tailPart.alive ? 310 : 170) + 30);
        if (bandJump(r0, r1, boss.k.tailWarningTime * boss.speed - a.t, a.phase === 'sweep' ? 'shoot' : 'aim', 0.16)) return inp;
      }
      if (a?.type === 'breath' && a.phase === 'fire' && a.spawned < a.count) {
        // 불줄기가 닿는 자리 근처면 불길이 생기기 직전에 점프
        const sx = boss.x + f * 160;
        if (Math.abs(p.x - sx) < 110 && a.next - a.t < 0.1) {
          jump();
          return inp;
        }
      }
      if (a?.type === 'tail' && a.phase === 'stuck' && boss.tailPart.alive) {
        const r = boss.tailRect();
        target = { x: r.centerX - f * 40, face: f, mode: 'punch' };
      }
      if (boss.tired) {
        if (boss.bellyOpen) {
          const r = boss.bellyRect();
          target = { x: r.centerX + f * 75, face: -f, mode: 'charge' };
        } else if (boss.wing.alive) {
          const r = boss.wingRect();
          target = { x: r.centerX - f * 65, face: f, mode: 'punch' };
        }
      }
    }

    if (wave) {
      B.hold = 0;
      jump();
      return inp;
    }
    const inZone = (x, list) => list.some(([l, r]) => x > l && x < r);
    if (inZone(p.x, zones)) {
      B.hold = 0;
      let best = null;
      for (let d = 20; d < 700 && best === null; d += 20) {
        for (const x of [p.x - d, p.x + d]) {
          if (x >= lo && x <= hi && !inZone(x, zones) && !inZone(x, soft)) {
            best = x;
            break;
          }
        }
      }
      if (best === null) for (let d = 20; d < 700 && best === null; d += 20) for (const x of [p.x - d, p.x + d]) if (x >= lo && x <= hi && !inZone(x, zones)) { best = x; break; }
      if (best !== null) go(best, 4);
      return inp;
    }
    if (target && !inZone(target.x, zones)) {
      const tx = Math.min(hi, Math.max(lo, target.x));
      if (Math.abs(p.x - tx) > 18 && !p.isCharging) {
        go(tx, 10);
        B.hold = 0;
        return inp;
      }
      if (p.facing !== target.face && !p.charging) {
        face(target.face);
        return inp;
      }
      if (target.mode === 'charge') charge(1.15);
      else punch();
      return inp;
    }
    B.hold = 0;
    if (inZone(p.x, soft)) {
      for (let d = 20; d < 500; d += 20) {
        const x = p.x + (p.x < (lo + hi) / 2 ? d : -d);
        if (!inZone(x, soft)) {
          go(x, 4);
          break;
        }
      }
      return inp;
    }
    // 기다릴 때: 보스와 적당히 떨어져 있기
    const keep = 230;
    const want = p.x < boss.x ? boss.x - keep : boss.x + keep;
    const tx = want < lo + 20 || want > hi - 20 ? (p.x < boss.x ? boss.x + keep : boss.x - keep) : want;
    if (!inZone(tx, soft)) go(Math.min(hi, Math.max(lo, tx)), 30);
    return inp;
  };
  return 'bot_bossa installed';
})();
