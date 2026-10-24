// 스테이지 6(수중 던전) 자동 플레이 봇: 헤엄쳐서 몬스터를 사냥하고, 심해 아귀왕의 공격을 피하며 싸운다.
// browser-harness 에서 js(open('tools/bot_stage6.js').read()) 로 넣는다. window.__bot6 에 상태가 남는다.
(() => {
  const s = window.__shock.scene;
  const B = (window.__bot6 = { hold: 0, holdFor: 0, t: 0, dashCool: 0, wasJump: false, dodges: 0, mode: '' });
  s.readInput = function () {
    const dt = 1 / 60;
    B.t += dt;
    B.dashCool -= dt;
    const p = this.player;
    const inp = { left: false, right: false, jumpDown: false, jumpPressed: false, attackDown: false, dashPressed: false, upDown: false, ultPressed: false };
    if (this.ended || p.dead) return inp;
    const go = (tx, tol = 8) => {
      if (tx > p.x + tol) inp.right = true;
      else if (tx < p.x - tol) inp.left = true;
    };
    // 높이 맞추기: 위로 가야 하면 점프를 누르고, 아래로 가야 하면 뗀다
    const swimTo = (ty, tol = 14) => {
      if (p.y > ty + tol) {
        inp.jumpDown = true;
        if (!B.wasJump) inp.jumpPressed = true;
      }
    };
    const face = (dir) => {
      if (dir > 0) inp.right = true;
      else inp.left = true;
    };
    const charge = (secs) => {
      B.hold += dt;
      if (B.hold < secs) inp.attackDown = true;
      else B.hold = 0;
    };
    const dash = (dir) => {
      if (B.dashCool <= 0 && p.dashCd.ready) {
        face(dir);
        inp.dashPressed = true;
        B.dashCool = 0.4;
        B.hold = 0;
        B.dodges += 1;
        return true;
      }
      return false;
    };
    const done = () => {
      B.wasJump = inp.jumpDown;
      return inp;
    };
    // 목표 옆으로 가서 펀치. secs 가 0 이면 짧은 펀치를 연타, 아니면 그만큼 충전
    const attackAt = (tx, ty, sideIn, secs, gap = 50) => {
      let side = sideIn;
      // 벽에 막혀 그쪽에 설 수 없으면 반대편에서
      if (tx - side * gap < 30 || tx - side * gap > this.stage.width - 30) side = -side;
      const adx = Math.abs(tx - p.x);
      const inRange = adx < gap + 28 && Math.sign(tx - p.x) === side && Math.abs(p.y - ty) < 30;
      swimTo(ty);
      if (!inRange) {
        if (!p.isCharging) B.hold = 0;
        go(tx - side * gap, 6);
        if (!p.isCharging) return;
      }
      if (p.facing !== side && !p.charging) {
        face(side);
        return;
      }
      if (secs > 0) charge(secs);
      else {
        // 연타: 한 프레임 누르고 떼기
        B.hold += dt;
        if (B.hold > 0.24) {
          inp.attackDown = true;
          B.hold = 0;
        }
      }
    };

    const boss = this.boss;
    if (this.bossStarted && boss.state === 'fight') {
      B.mode = 'boss';
      const d = boss.dangers();
      const top = 162;
      const bottom = this.stage.groundY - 30;
      // 1) 띠(돌진, 꼬리 휩쓸기)
      if (d.band) {
        const [b0, b1] = d.band;
        const pt = p.y - 30;
        const pb = p.y + 28;
        if (pb > b0 - 16 && pt < b1 + 16) {
          const upY = b0 - 50;
          const downY = b1 + 40;
          const canUp = upY >= top;
          const canDown = downY <= bottom;
          const goUp = canUp && (!canDown || Math.abs(p.y - upY) <= Math.abs(p.y - downY));
          B.hold = 0;
          const a = boss.action;
          if (a && a.phase === 'go' && Math.abs(boss.x - p.x) < 200 && dash(a.dir > 0 ? -1 : 1)) return done();
          if (goUp) swimTo(upY, 4);
          return done();
        }
        // 띠 밖: 그대로 기다리며 높이 유지
        if (p.y < b0) swimTo(Math.min(p.y, b0 - 50), 4);
        else if (boss.action?.type === 'sweep') swimTo(b0 - 60, 4);
      }
      // 2) 소용돌이: 입 반대쪽으로 헤엄
      if (d.pull) {
        B.hold = 0;
        go(p.x + (p.x < d.pull.x ? -300 : 300));
        swimTo(p.y < d.pull.y ? top : p.y, 4);
        return done();
      }
      // 3) 거품 기둥 피하기
      const inCol = (x) => d.columns.some(([l, r]) => x > l && x < r);
      if (inCol(p.x)) {
        B.hold = 0;
        let best = null;
        for (let k = 20; k < 500 && best === null; k += 20) for (const x of [p.x - k, p.x + k]) if (x > boss.minX - 40 && x < boss.maxX + 40 && !inCol(x)) { best = x; break; }
        if (best !== null) go(best, 4);
        return done();
      }
      // 4) 공격: 몸 앞쪽으로 가서 충전 펀치 (지쳤거나 어지러울 때는 길게)
      const a = boss.action;
      const open = !a || (a.type === 'rest' && a.phase === 'rest') || (a.type === 'charge' && a.phase === 'dizzy') || a.type === 'bubbles' || a.type === 'whirlpool';
      if (open) {
        const side = p.x < boss.x ? 1 : -1;
        const tx = boss.x - side * 115;
        const ty = Math.min(bottom, Math.max(top, boss.y));
        attackAt(tx, ty, side, 0.95);
        return done();
      }
      B.hold = 0;
      return done();
    }
    if (this.bossStarted) return done();

    // 몬스터 사냥
    B.mode = 'hunt';
    const m = this.monsters.filter((x) => !x.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (m) {
      const dx = m.x - p.x;
      const side = Math.sign(dx) || 1;
      const dist = Math.hypot(dx, m.y - p.y);
      // 피하기
      if (m.type === 'piranha' && m.state === 'windup' && dist < 380) {
        // 돌진 길에서 위아래로 비킨다
        B.hold = 0;
        if (m.dart && m.dart.dir.y > 0.3) swimTo(p.y - 120, 4);
        else if (p.y > 300) swimTo(p.y - 120, 4);
        return done();
      }
      if (m.type === 'piranha' && m.state === 'attack' && dist < 160) {
        if (dash(-side)) return done();
      }
      if (m.type === 'jelly' && m.state === 'windup') {
        // 조준선 위나 아래로
        B.hold = 0;
        if (m.aim && m.aim.y > m.y - 20) swimTo(p.y - 110, 4);
        return done();
      }
      if (m.type === 'puffer' && (m.state === 'spiky' || m.state === 'windup')) {
        // 가시 공에서 떨어져 있기
        B.hold = 0;
        go(p.x - side * 200);
        if (Math.abs(m.y - p.y) < 90) swimTo(m.y - 110, 4);
        return done();
      }
      const ty = m.type === 'crab' ? m.y - 10 : m.y;
      const hard = m.type === 'jelly' && (m.state === 'hard' || m.state === 'curl');
      attackAt(m.x, ty, side, hard ? 0.9 : 0, hard ? 70 : 50);
      return done();
    }
    // 다 잡았으면 오른쪽으로 (바닥 근처)
    B.mode = 'walk';
    B.hold = 0;
    inp.right = true;
    return done();
  };
  return 'bot6 installed';
})();
