// 공포 모드 봇: readInput 을 바꿔 끼워서 진짜 입력만으로 퓨즈를 모으고 탈출한다.
// window.__horrorBot 으로 조종한다.
//   { caughtOnPurpose: true } 세이노를 옆으로 불러 일부러 잡힌다
//   { careful: true }         걸어 다니고, 쫓기면 펀치와 사물함을 쓴다
//   없음                      세이노를 무시하고 목표로 달린다
(() => {
  const g = window.__horror;
  const { findPath, cellOf, frontOf, center, lineOfSight } = window.__horrorLogic;
  const B = { path: [], goal: null, pressed: false, stuckT: 0, last: null };
  const same = (a, b) => a && b && a.cx === b.cx && a.cy === b.cy;
  const opts = () => window.__horrorBot || {};
  const blank = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false });
  const stalkerDist = () => Math.hypot(g.stalker.x - g.p.x, g.stalker.y - g.p.y);
  const chased = () => g.stalker.mode === 'chase' && stalkerDist() < 7;

  const press = (inp) => {
    B.pressed = true;
    inp.use = true;
    return inp;
  };

  const goalNow = () => {
    const fuse = g.run.fuses.find((f) => !f.taken);
    if (fuse) return { cx: fuse.cx, cy: fuse.cy };
    return frontOf(g.map, g.run.powered ? g.map.gate : g.map.panel);
  };

  // 지금 칸에서 가장 가까운 사물함 앞 칸. 세이노보다 먼저 닿을 수 있을 때만
  const hideGoal = () => {
    let best = null;
    for (const c of g.map.lockers) {
      const f = frontOf(g.map, c);
      const path = findPath(g.map, cellOf(g.p), f);
      if (!path || path.length > 6) continue;
      const toStalker = Math.hypot(f.cx + 0.5 - g.stalker.x, f.cy + 0.5 - g.stalker.y);
      if (toStalker > path.length && (!best || path.length < best.n)) best = { n: path.length, f };
    }
    return best?.f || null;
  };

  const walkTo = (inp, goal, run) => {
    if (!same(B.goal, goal) || !B.path.length) {
      B.goal = goal;
      B.path = findPath(g.map, cellOf(g.p), goal) || [];
    }
    if (B.path.length && same(B.path[0], cellOf(g.p))) {
      const c = center(B.path[0]);
      if (Math.hypot(c.x - g.p.x, c.y - g.p.y) < 0.3) B.path.shift();
    }
    const t = B.path.length ? center(B.path[0]) : center(goal);
    // 시선은 lookX 로만 돌린다 (HorrorGame 이 yaw -= lookX 를 한다)
    inp.lookX = g.yaw - Math.atan2(-(t.x - g.p.x), -(t.y - g.p.y));
    inp.move.z = Math.hypot(t.x - g.p.x, t.y - g.p.y) > 0.05 ? 1 : 0;
    inp.move.run = run;
    // 모서리에 걸리면 길을 다시 찾는다
    if (B.last && Math.hypot(B.last.x - g.p.x, B.last.y - g.p.y) < 0.0005 && (B.stuckT += 1) > 20) {
      B.path = [];
      B.stuckT = 0;
    }
    B.last = g.p;
    return inp;
  };

  const brain = () => {
    const inp = blank();
    if (opts().caughtOnPurpose) {
      if (g.hidden === null && g.stalker.mode !== 'stunned') {
        g.stalker.x = g.p.x + 0.3;
        g.stalker.y = g.p.y;
      }
      return inp;
    }
    const careful = opts().careful;
    const target = g.nearestUse();
    if (B.pressed) {
      B.pressed = false; // 한 번 누르면 한 프레임 쉰다
      return inp;
    }
    if (g.hidden !== null) {
      const safe = g.stalker.mode === 'patrol' || (g.stalker.mode !== 'chase' && stalkerDist() > 9);
      return safe ? press(inp) : inp;
    }
    if (careful && chased()) {
      const s = g.stalker;
      if (g.run.shock && stalkerDist() <= g.k.shockRange - 0.2 && lineOfSight(g.map, g.p, s)) {
        inp.punch = true;
        return inp;
      }
      if (target?.kind === 'locker') return press(inp);
      const hide = hideGoal();
      if (hide) return walkTo(inp, hide, true);
    }
    const wanted = ['fuse', 'gate', 'box'].includes(target?.kind) || (target?.kind === 'panel' && g.run.have >= g.k.fuseCount);
    if (wanted) return press(inp);
    const near = careful && g.stalker.mode !== 'stunned' && stalkerDist() < g.k.runNoise + 1;
    return walkTo(inp, goalNow(), !near || chased());
  };

  g.readInput = brain;
  return 'bot on';
})();
