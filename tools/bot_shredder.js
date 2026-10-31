// 파쇄자 보스 봇: scene.readInput 을 바꿔 끼워서 진짜 입력으로 싸운다.
// 경고가 뜬 공격은 피하고(점프, 대시, 비키기), 때릴 기회에만 때린다.
(() => {
  const s = window.__shock.scene;
  const B = { dashCool: 0, jumpCool: 0, hold: 0, tap: false, air: 0 };
  window.__shockAutoPick = true;
  s.readInput = function () {
    const dt = 1 / 60;
    B.dashCool -= dt;
    B.jumpCool -= dt;
    const p = this.player;
    const inp = { left: false, right: false, jumpDown: false, jumpPressed: false, attackDown: false, dashPressed: false, upDown: false, ultPressed: false };
    if (this.ended || p.dead) return inp;
    const grounded = p.body.blocked.down || p.body.touching.down;
    if (grounded) B.air = 0;
    const go = (tx, tol = 8) => {
      if (tx > p.x + tol) inp.right = true;
      else if (tx < p.x - tol) inp.left = true;
    };
    const dash = (dir) => {
      if (B.dashCool > 0 || !p.dashCd.ready) return false;
      if (dir > 0) inp.right = true;
      else inp.left = true;
      inp.dashPressed = true;
      B.dashCool = 0.3;
      B.hold = 0;
      return true;
    };
    const jump = (high = false) => {
      inp.jumpDown = true;
      if (grounded && B.jumpCool <= 0) {
        inp.jumpPressed = true;
        B.jumpCool = 0.25;
        B.air = 1;
      } else if (high && B.air === 1 && p.body.velocity.y > -60) {
        inp.jumpPressed = true;
        B.air = 2;
      }
    };
    const punch = () => {
      B.tap = !B.tap;
      inp.attackDown = B.tap;
    };
    const boss = this.boss;
    if (!this.bossStarted) {
      inp.right = true;
      return inp;
    }
    if (boss.state !== 'fight') return inp;
    const a = boss.action;
    const lo = boss.arenaStart + 40;
    const hi = boss.arenaEnd - 40;
    const flee = (x0, x1) => {
      const left = x0 - 30;
      const right = x1 + 30;
      const goLeft = left > lo && (right > hi || Math.abs(p.x - left) < Math.abs(p.x - right));
      go(goLeft ? left : right);
    };

    if (boss.chew?.who === p) {
      dash(p.x < boss.x ? -1 : 1);
      return inp;
    }
    // 낮게 오는 것은 점프
    const low = [...boss.blades.filter((b) => b.y > boss.groundY - 80), ...boss.waves.list];
    if (low.some((b) => (b.x - p.x) * b.dir < 20 && Math.abs(b.x - p.x) < 130)) jump();
    if (boss.fin && a?.phase === 'chase' && Math.abs(boss.fin.x - p.x) < 110) jump();
    for (const sc of boss.scrap) if (Math.abs(sc.x - p.x) < 60) flee(sc.x - 40, sc.x + 40);
    for (const pd of boss.puddles.list) if (Math.abs(pd.x - p.x) < pd.w / 2 + 16) flee(pd.x - pd.w / 2, pd.x + pd.w / 2);

    if (a?.type === 'sawDash' && (a.phase === 'aim' || a.phase === 'run')) {
      const ahead = (p.x - boss.x) * boss.facing;
      if (ahead > 0 && a.phase === 'run' && ahead < 300) dash(-boss.facing);
      return inp;
    }
    if (a?.type === 'sawDive' && a.phase === 'lock') {
      flee(boss.fin.x - 130, boss.fin.x + 130);
      return inp;
    }
    if (a?.type === 'sawDive' && a.phase === 'chase') {
      go(p.x < boss.fin.x ? lo : hi);
      return inp;
    }
    if (a?.type === 'crawl') {
      for (const d of a.drops) if (!d.done && Math.abs(d.x - p.x) < 70) flee(d.x - 50, d.x + 50);
      return inp;
    }
    if (a?.type === 'stomp' && a.phase !== 'land') {
      if (Math.abs(a.tx - p.x) < 150) flee(a.tx - 130, a.tx + 130);
      return inp;
    }
    if (a?.type === 'rocket' && !boss.fist?.stuck) {
      const f = boss.fist;
      if (a.height === 'low' && f && Math.abs(f.x - p.x) < 190) jump();
      return inp;
    }
    if (a?.type === 'grind') {
      go(p.x < boss.x ? lo : hi);
      return inp;
    }
    if (boss.fist?.stuck) {
      const fr = boss.fistRect();
      const side = p.x < fr.centerX && fr.x - 60 > lo ? -1 : 1;
      go(fr.centerX + side * 62);
      punch();
      return inp;
    }
    if (boss.exposed && (boss.guardPart.alive || boss.coreOpen)) {
      const r = boss.bellyRect();
      const side = p.x < r.centerX ? -1 : 1;
      if (Math.abs(p.x - r.centerX) > 150) go(r.centerX + side * 100);
      else if (side > 0) inp.left = Math.abs(p.x - r.centerX) > 90;
      else inp.right = Math.abs(p.x - r.centerX) > 90;
      punch();
      return inp;
    }
    // 평소에는 보스와 거리를 둔다
    if (Math.abs(p.x - boss.x) < 200) go(p.x < boss.x && boss.x - 240 > lo ? boss.x - 240 : boss.x + 240);
    return inp;
  };
  return 'bot on';
})();
