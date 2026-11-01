// 공포 모드 봇: readInput 을 바꿔 끼워서 진짜 입력만으로 퓨즈를 모으고 탈출한다.
// window.__horrorBot 으로 조종한다.
//   { caughtOnPurpose: true } 세이노를 옆으로 불러 일부러 잡힌다
//   { careful: true }         걸어 다니고, 쫓기면 펀치와 사물함을 쓴다
//                             눈뜬이는 쳐다본 채 뒷걸음으로 가고, 큰입이 곁에서는 달리지 않는다
//   없음                      괴물을 무시하고 목표로 달린다
// 오늘의 밤 조건은 위 옵션에 더한다
//   { noRun: true }           달리지 않는다
//   { noShock: true }         전기충격기를 쏘지 않는다
//   { notes: 3 }              그만큼 쪽지를 읽고 나간다
//   { sneak: true }           안 잡히려고 손전등을 끄고 걷고, 괴물이 가까우면 먼저 숨거나 물러난다
// 괴물이 둘이면 가장 가까운 쪽을 보고 판단한다
(() => {
  const g = window.__horror;
  const { findPath, cellOf, frontOf, center, lineOfSight, reachable } = window.__horrorLogic;
  const B = { path: [], goal: null, pressed: false, stuckT: 0, last: null };
  const same = (a, b) => a && b && a.cx === b.cx && a.cy === b.cy;
  const opts = () => window.__horrorBot || {};
  const blank = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false });
  const gapTo = (s) => Math.hypot(s.x - g.p.x, s.y - g.p.y);
  const foe = () => g.stalkers.reduce((a, s) => (gapTo(s) < gapTo(a) ? s : a));
  const stalkerDist = () => gapTo(foe());
  const chased = () => g.stalkers.some((s) => s.mode === 'chase' && gapTo(s) < 10);

  const press = (inp) => {
    B.pressed = true;
    inp.use = true;
    return inp;
  };

  // 갈 수 있는 곳은 문이 열릴 때만 달라진다
  const canWalk = (c) => {
    const opened = g.run.doors.filter((d) => d.open).length;
    if (B.opened !== opened) {
      B.opened = opened;
      B.area = reachable(g.map, g.map.start);
    }
    return B.area.has(`${c.cx},${c.cy}`);
  };

  // 잠긴 문 앞의 이쪽 칸
  const doorSide = (d) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ cx: d.cx + x, cy: d.cy + y })).find(canWalk);

  // 아직 더 읽어야 하면 가장 가까운 쪽지
  const noteGoal = () => {
    if (g.notes.found >= (opts().notes || 0)) return null;
    const cells = g.notes.spots.filter((_, i) => !g.notes.taken[i]).map(cellOf).filter(canWalk);
    return cells.sort((a, b) => Math.hypot(a.cx - g.p.x, a.cy - g.p.y) - Math.hypot(b.cx - g.p.x, b.cy - g.p.y))[0] || null;
  };

  // 지금 걸어갈 수 있는 퓨즈, 쓸 수 있는 문, 열쇠 순서. 다 끝나면 전원, 정문
  const goalNow = () => {
    const fuse = g.run.fuses.find((f) => !f.taken && canWalk(f));
    if (fuse) return { cx: fuse.cx, cy: fuse.cy };
    const door = g.run.doors.find((d, i) => !d.open && g.run.keys[i].taken);
    const side = door && doorSide(door);
    if (side) return side;
    const key = g.run.keys.find((c) => !c.taken && canWalk(c));
    if (key) return { cx: key.cx, cy: key.cy };
    const clue = g.run.clues.find((c) => !c.taken && canWalk(c));
    if (clue) return { cx: clue.cx, cy: clue.cy };
    const note = noteGoal();
    if (note) return note;
    return frontOf(g.map, g.run.powered ? g.map.gate : g.map.panel);
  };

  // 지금 칸에서 가장 가까운 사물함 앞 칸. 세이노보다 먼저 닿을 수 있을 때만
  const hideGoal = () => {
    let best = null;
    for (const c of g.map.lockers) {
      if (Math.hypot(c.cx + 0.5 - g.p.x, c.cy + 0.5 - g.p.y) > 9) continue;
      const f = frontOf(g.map, c);
      const path = findPath(g.map, cellOf(g.p), f);
      if (!path || path.length > 9) continue;
      const toStalker = Math.min(...g.stalkers.map((s) => Math.hypot(f.cx + 0.5 - s.x, f.cy + 0.5 - s.y)));
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

  // 고개는 괴물 쪽에 둔 채 몸만 가던 길로 움직인다 (눈뜬이는 보고 있으면 멈춘다)
  const keepWatching = (inp) => {
    const s = foe();
    const face = Math.atan2(-(s.x - g.p.x), -(s.y - g.p.y));
    const turn = g.yaw - inp.lookX - face;
    const go = inp.move.z;
    inp.lookX = g.yaw - face;
    inp.move.x = -Math.sin(turn) * go;
    inp.move.z = Math.cos(turn) * go;
    return inp;
  };

  const gazerBrain = (inp) => {
    const near = stalkerDist() < 8 && lineOfSight(g.map, g.p, foe());
    const out = walkTo(inp, goalNow(), chased());
    return near ? keepWatching(out) : out;
  };

  // 괴물에게서 가장 먼 사물함 앞이나 순찰 지점으로 물러난다
  const awayGoal = () => {
    const s = foe();
    const spots = [...g.map.patrol.filter(canWalk), ...g.map.lockers.map((c) => frontOf(g.map, c)).filter(canWalk)];
    const score = (c) => Math.hypot(c.cx + 0.5 - s.x, c.cy + 0.5 - s.y) - Math.hypot(c.cx + 0.5 - g.p.x, c.cy + 0.5 - g.p.y) / 2;
    return spots.sort((a, b) => score(b) - score(a))[0];
  };

  const SNEAK_NEAR = 6; // 이 칸보다 가까우면 하던 일을 멈춘다
  const SNEAK_OUT = 8; // 숨었다가 나오는 거리
  const sneakBrain = (inp, target) => {
    if (g.lightOn) inp.light = true;
    if (stalkerDist() >= SNEAK_NEAR && !chased()) return null;
    if (target?.kind === 'locker') return press(inp);
    return walkTo(inp, hideGoal() || awayGoal(), chased());
  };

  const HIDE_TIRED = 12; // 이만큼 숨었다 나왔으면 더 숨지 않고 달려서 끝낸다. 숨기만 하면 판이 끝나지 않는다
  const HIDE_LIMIT = 1200; // 괴물이 곁을 맴돌아도 이만큼 숨었으면 나온다 (프레임). 사람도 끝없이 숨어 있지 않는다
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
    const kind = foe().monsterId;
    const target = g.nearestUse();
    if (g.hud?.keypadOpen) {
      inp.typed = g.run.code.digits.map(String); // 단서를 다 모은 뒤라 번호를 안다
      return inp;
    }
    if (B.pressed) {
      B.pressed = false; // 한 번 누르면 한 프레임 쉰다
      return inp;
    }
    if (g.hidden !== null) {
      B.hideFrames = (B.hideFrames || 0) + 1;
      const near = opts().sneak && stalkerDist() < SNEAK_OUT;
      const safe = (!near && g.stalkers.every((s) => s.mode === 'patrol' || (s.mode !== 'chase' && gapTo(s) > 9))) || B.hideFrames > HIDE_LIMIT;
      if (safe) {
        B.hideFrames = 0;
        B.hides = (B.hides || 0) + 1;
      }
      return safe ? press(inp) : inp;
    }
    if (opts().sneak && kind !== 'gazer') {
      const out = sneakBrain(inp, target);
      if (out) return out;
    }
    if (careful && kind !== 'gazer' && kind !== 'maw' && chased() && (B.hides || 0) < HIDE_TIRED) {
      const s = foe();
      if (g.run.shock && stalkerDist() <= g.k.shockRange - 0.2 && lineOfSight(g.map, g.p, s)) {
        inp.punch = true;
        return inp;
      }
      if (target?.kind === 'locker') return press(inp);
      const hide = hideGoal();
      if (hide) return walkTo(inp, hide, true);
    }
    const reading = target?.kind === 'note' && g.notes.found < (opts().notes || 0);
    const wanted = reading || ['fuse', 'key', 'clue', 'lock', 'gate', 'box'].includes(target?.kind) || (target?.kind === 'panel' && g.run.have >= g.k.fuseCount);
    if (wanted) return press(inp);
    if (careful && kind === 'gazer') return gazerBrain(inp);
    return walkTo(inp, goalNow(), !careful || (chased() && kind !== 'maw'));
  };

  // 조건을 지키는 봇도 쫓기면 똑같이 판단하고, 달리기와 쏘기만 빠진다
  g.readInput = () => {
    const inp = brain();
    if (opts().noRun) inp.move.run = false;
    if (opts().noShock) inp.punch = false;
    return inp;
  };
  return 'bot on';
})();
