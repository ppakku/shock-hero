// 공포 모드 아이 봇: 사람처럼 눈과 귀로 아는 것만으로 논다. 난이도를 재는 데 쓴다.
// 괴물 자리는 화면에 보일 때와 소리가 들릴 때만 쓴다. 쪽지와 물건 자리는 몰라서 돌아다니다 찾는다.
// 가는 쪽을 보고 걷고, 몇 초에 한 번 뒤를 돌아보고, 놀라면 늦게 반응하고, 가끔 겁먹고 달린다.
// window.__horrorBot = { rand } 로 난수를 넣으면 같은 판이 다시 난다.
(() => {
  const g = window.__horror;
  const { findPath, cellOf, frontOf, center, lineOfSight, reachable } = window.__horrorLogic;
  const rand = window.__horrorBot?.rand || Math.random;
  const TURN = 5; // 1초에 도는 각도 (라디안). 손이 도는 빠르기
  const SEE = 9; // 손전등으로 보이는 거리
  const HEAR_LOUD = 9; // 쫓길 때 발소리가 크게 들리는 거리
  const HEAR_SOFT = 4; // 걷는 발소리가 들리는 거리
  const B = {
    path: [], goal: null, via: null, goalKey: '', pressed: false, area: null, opened: -1,
    glanceIn: 4 + rand() * 4, glanceT: 0, heardT: 0, react: 0, turnT: 0,
    stareT: 0, patience: 0, ignoreT: 0, freezeT: 0, panicT: 0, runT: 0, hideT: 0, stuckT: 0, last: null,
  };
  const between = (a, b) => a + rand() * (b - a);
  const blank = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false });
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const yawTo = (c) => Math.atan2(-(c.x - g.p.x), -(c.y - g.p.y));
  const monster = () => g.stalker;
  const gap = () => Math.hypot(monster().x - g.p.x, monster().y - g.p.y);

  const canWalk = (c) => {
    const opened = g.run.doors.filter((d) => d.open).length;
    if (B.opened !== opened) {
      B.opened = opened;
      B.area = reachable(g.map, g.map.start);
    }
    return B.area.has(`${c.cx},${c.cy}`);
  };
  const doorSide = (d) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ cx: d.cx + x, cy: d.cy + y })).find(canWalk);

  const goalNow = () => {
    const fuse = g.run.fuses.find((f) => !f.taken && canWalk(f));
    if (fuse) return { cx: fuse.cx, cy: fuse.cy };
    const door = g.run.doors.find((d, i) => !d.open && g.run.keys[i].taken);
    const side = door && doorSide(door);
    if (side) return side;
    const key = g.run.keys.find((c) => !c.taken && canWalk(c));
    if (key) return { cx: key.cx, cy: key.cy };
    return frontOf(g.map, g.run.powered ? g.map.gate : g.map.panel);
  };

  // 다음 목표가 어디 있는지 몰라서 아무 데나 한 곳 들렀다 간다
  const wanderGoal = () => {
    const goal = goalNow();
    const key = `${goal.cx},${goal.cy}`;
    if (key !== B.goalKey) {
      B.goalKey = key;
      const spots = g.map.patrol.filter(canWalk);
      B.via = spots.length ? frontOf(g.map, spots[Math.floor(rand() * spots.length)]) : null;
      B.runT = rand() < 0.25 ? between(3, 6) : 0; // 가끔 급해서 달린다
    }
    if (B.via && Math.hypot(B.via.cx + 0.5 - g.p.x, B.via.cy + 0.5 - g.p.y) < 1.5) B.via = null;
    return B.via || goal;
  };

  const turnTo = (inp, yaw, dt) => {
    const diff = wrap(g.yaw - yaw);
    inp.lookX = Math.max(-TURN * dt, Math.min(TURN * dt, diff));
    return Math.abs(diff);
  };

  const walkTo = (inp, goal, run, dt) => {
    if (!B.goal || B.goal.cx !== goal.cx || B.goal.cy !== goal.cy || !B.path.length) {
      B.goal = goal;
      B.path = findPath(g.map, cellOf(g.p), goal) || [];
    }
    const here = cellOf(g.p);
    if (B.path.length && B.path[0].cx === here.cx && B.path[0].cy === here.cy && Math.hypot(here.cx + 0.5 - g.p.x, here.cy + 0.5 - g.p.y) < 0.3) B.path.shift();
    const t = center(B.path[0] || goal);
    const off = turnTo(inp, yawTo(t), dt);
    inp.move.z = off < 0.5 && Math.hypot(t.x - g.p.x, t.y - g.p.y) > 0.05 ? 1 : 0;
    inp.move.run = run;
    if (B.last && Math.hypot(B.last.x - g.p.x, B.last.y - g.p.y) < 0.0005 && (B.stuckT += 1) > 30) {
      B.path = [];
      B.stuckT = 0;
    }
    B.last = g.p;
    return inp;
  };

  const seesMonster = () => {
    const s = monster();
    const d = gap();
    if (d > SEE) return false;
    if (Math.abs(wrap(yawTo(s) - g.yaw)) > (g.k.viewFov / 2) * Math.PI / 180) return false;
    return lineOfSight(g.map, g.p, s);
  };
  const hearsMonster = () => {
    const mode = monster().mode;
    if (mode === 'stunned') return false;
    return gap() < (mode === 'chase' ? HEAR_LOUD : HEAR_SOFT);
  };
  const press = (inp) => {
    B.pressed = true;
    inp.use = true;
    return inp;
  };

  const inLocker = (inp, sees, dt) => {
    B.hideT += dt;
    if (sees) inp.lookX = -TURN * dt; // 틈 앞의 괴물에게서 고개를 돌린다
    return B.hideT > 25 || (B.hideT > 4 && !hearsMonster()) ? press(inp) : inp;
  };

  // 눈뜬이를 봤다. 쳐다보다가 참을성이 다하면 고개를 돌린다
  const stare = (inp, target, dt) => {
    const s = monster();
    if (!B.stareT) {
      B.patience = between(2, 8);
      if (target?.kind === 'locker' && rand() < 0.3) return press(inp);
    }
    B.stareT += dt;
    if (B.stareT >= B.patience) {
      B.stareT = 0;
      B.ignoreT = between(2, 5);
      return null;
    }
    if (g.run.shock && gap() <= g.k.shockRange - 0.2) inp.punch = true;
    turnTo(inp, yawTo(s), dt);
    return inp;
  };

  // 큰입이 소리에 놀랐다. 대개는 얼어붙고, 가끔 겁먹고 달린다
  const startle = () => {
    if (rand() < 0.3) B.panicT = between(2, 4);
    else B.freezeT = between(3, 8);
  };

  const brain = (dt = 1 / 30) => {
    const inp = blank();
    if (B.pressed) {
      B.pressed = false;
      return inp;
    }
    const sees = seesMonster();
    const hears = hearsMonster();
    if (g.hidden !== null) return inLocker(inp, sees, dt);
    B.hideT = 0;
    const target = g.nearestUse();
    const kind = monster().monsterId;
    B.ignoreT = Math.max(0, B.ignoreT - dt);
    B.panicT = Math.max(0, B.panicT - dt);
    B.freezeT = Math.max(0, B.freezeT - dt);
    B.runT = Math.max(0, B.runT - dt);
    B.glanceIn -= dt;
    B.heardT = hears ? B.heardT + dt : 0;
    if (!hears) B.react = between(0.7, 1.5);

    if (sees && g.run.shock && gap() <= g.k.shockRange - 0.2) {
      inp.punch = true;
      return inp;
    }
    if (kind === 'gazer' && sees && !B.ignoreT) {
      const r = stare(inp, target, dt);
      if (r) return r;
    } else if (!sees) B.stareT = 0;
    if (kind === 'maw' && B.heardT >= B.react && !B.panicT && !B.freezeT && !B.ignoreT) {
      startle();
      B.ignoreT = between(6, 10);
    }
    if (B.freezeT && !(monster().mode === 'chase' && gap() < 3)) return inp;
    // 소리가 들렸거나 때가 되면 뒤를 돌아본다. 돌아보는 동안에는 서 있다
    if (kind === 'gazer' && B.heardT >= B.react && !B.turnT && !B.ignoreT) {
      B.turnT = 1;
      B.heardT = 0;
    }
    if (B.glanceIn <= 0 && !B.turnT) {
      B.glanceIn = between(6, 10);
      B.turnT = 0.8;
    }
    if (B.turnT) {
      B.turnT = Math.max(0, B.turnT - dt);
      turnTo(inp, kind === 'gazer' && hears ? yawTo(monster()) : g.yaw + Math.PI, dt);
      if (!B.turnT) B.ignoreT = Math.max(B.ignoreT, between(1, 3)); // 봤으니 다시 가던 길을 간다
      return inp;
    }
    const wanted = ['fuse', 'key', 'lock', 'gate', 'box'].includes(target?.kind) || (target?.kind === 'panel' && g.run.have >= g.k.fuseCount);
    if (wanted) return press(inp);
    if (target?.kind === 'locker' && B.panicT) {
      B.panicT = 0; // 나오자마자 다시 들어가지 않는다
      return press(inp);
    }
    return walkTo(inp, wanderGoal(), B.panicT > 0 || B.runT > 0, dt);
  };

  g.readInput = brain;
  return 'child bot on';
})();
