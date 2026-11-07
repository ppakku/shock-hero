// 파쇄자 행동 (화면과 상관없는 부분). 순찰, 조사, 추격, 수색, 멈춤, 매복, 응시 일곱 상태로 움직인다.
import { cellOf, center, findPath, frontOf, lineOfSight, blocked, wallAt } from './horrorGrid.js';

// 소리와 몸짓 표가 읽는 상태 이름
export const MODES = ['patrol', 'investigate', 'chase', 'search', 'stunned', 'ambush', 'watch'];

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const trailCell = { cx: 0, cy: 0 }; // 매 프레임 새로 만들지 않는다

// monsterId 는 balance.horror.monsters 의 이름. 눈뜬이와 큰입이는 tickGazer, tickMaw 로 움직인다. 호러워드는 세이노와 같고 벽만 통과한다
// spot: 처음 서는 칸. 둘이 나오는 판의 둘째 괴물은 맵의 다른 칸에서 시작한다
export function createStalker(map, k, rand, monsterId = 'seino', spot = map.stalker) {
  const c = center(spot);
  return {
    monsterId, frozenT: 0, doorT: 0, rushT: 0, rushRestT: 0, ranT: 0, pauseT: 0, brushT: 0, wasHidden: false, lockedN: map.locked.size,
    x: c.x, y: c.y, heading: 0, mode: 'patrol', path: [], patrolIndex: 0, lostT: 0, searchT: 0, stunT: 0, repathT: 0, lockers: [], checking: null, lastSeen: null, target: null,
    inWall: false, wallSlow: 1,
    pressure: 0, graceT: 0, warnT: 0, calmT: 0, watchT: 0, ambushT: 0, ambushKind: null,
    heat: new Float32Array(map.w * map.h), heatW: map.w, heatT: 0, // 주인공이 걸어 다닌 자리. 저장하지 않는다
    weights: new Float32Array(map.patrol.length), recent: new Int16Array(8).fill(-1), recentAt: 0,
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sameCell = (a, b) => !!b && a.cx === b.cx && a.cy === b.cy;
const walkSpeed = (s, k) => k.stalkerWalk * (1 + k.pressureWalk * s.pressure);

// 주인공이 걸어간 자리를 기억한다. 식는 일은 coolHeat 가 맡는다
export function noteTrail(s, cell, dt) {
  s.heat[cell.cy * s.heatW + cell.cx] += dt;
}

// 배열 전체를 도는 일이라 1초에 한 번만 식힌다
function coolHeat(s, k, dt) {
  s.heatT += dt;
  if (s.heatT < 1) return;
  const keep = 0.5 ** (s.heatT / k.heatHalfLife);
  for (let i = 0; i < s.heat.length; i++) s.heat[i] *= keep;
  s.heatT = 0;
}

function heatAround(s, map, c, r) {
  let sum = 0;
  for (let y = Math.max(0, c.cy - r); y <= Math.min(map.h - 1, c.cy + r); y++) {
    for (let x = Math.max(0, c.cx - r); x <= Math.min(map.w - 1, c.cx + r); x++) sum += s.heat[y * s.heatW + x];
  }
  return sum;
}

// 가장 뜨거운 칸. 아무 데도 안 걸어 봤으면 null
function hottest(s, map) {
  let best = -1;
  let top = 0;
  for (let i = 0; i < s.heat.length; i++) {
    if (s.heat[i] > top) {
      top = s.heat[i];
      best = i;
    }
  }
  return best < 0 ? null : { cx: best % map.w, cy: Math.floor(best / map.w) };
}

export function seesPlayer(s, player, map, k) {
  if (player.hidden !== null) return false;
  const d = dist(s, player);
  if (d > (player.lightOn ? k.seeLight : k.seeDark)) return false;
  const toPlayer = Math.atan2(player.x - s.x, player.y - s.y);
  const diff = Math.atan2(Math.sin(toPlayer - s.heading), Math.cos(toPlayer - s.heading));
  if (Math.abs(diff) > ((k.fov / 2) * Math.PI) / 180) return false;
  return lineOfSight(map, s, player);
}

function hears(s, player, k) {
  return player.noise > 0 && dist(s, player) <= player.noise * (1 + k.pressureHear * s.pressure);
}

function notices(s, player, map, k) {
  if (player.hidden !== null) return false;
  if (hears(s, player, k)) return true;
  return player.lightOn && dist(s, player) <= k.noticeLight && lineOfSight(map, s, player);
}

// 호러워드는 벽을 뚫고 곧장 간다. 다른 괴물은 걸어갈 수 있는 길로 간다
const throughWalls = (s) => s.monsterId === 'ward';
const route = (s, map, to) => (throughWalls(s) ? [to] : findPath(map, cellOf(s), to));

function goTo(s, map, cell) {
  s.path = route(s, map, frontOf(map, cell)) || [];
}

// 길을 따라 한 걸음. 길이 다 끝났으면 false
function walk(s, speed, dt) {
  let left = speed * dt * (s.inWall ? s.wallSlow : 1);
  while (left > 0 && s.path.length) {
    const t = center(s.path[0]);
    const d = dist(s, t);
    if (d > 0.001) s.heading = Math.atan2(t.x - s.x, t.y - s.y);
    if (d <= left) {
      s.x = t.x;
      s.y = t.y;
      s.path.shift();
      left -= d;
    } else {
      s.x += ((t.x - s.x) / d) * left;
      s.y += ((t.y - s.y) / d) * left;
      left = 0;
    }
  }
  return s.path.length > 0;
}

// 같은 칸 안에서는 칸 가운데가 아니라 주인공에게 곧장 다가간다. 칸 모서리에 서 있어도 확실히 잡힌다
function closeIn(s, player, step) {
  const d = dist(s, player);
  if (d < 0.001) return;
  s.heading = Math.atan2(player.x - s.x, player.y - s.y);
  const f = Math.min(1, step / d);
  s.x += (player.x - s.x) * f;
  s.y += (player.y - s.y) * f;
  s.path = [];
}

function startSearch(s, map, k, rand) {
  const chance = k.lockerCheckChance + k.pressureLocker * s.pressure;
  s.mode = 'search';
  s.searchT = k.searchTime * (1 + k.pressureSearch * s.pressure);
  s.checking = null;
  // 호러워드는 벽은 뚫어도 사물함은 열지 않는다. 숨으면 안전하다
  s.lockers = throughWalls(s) ? [] : map.lockers
    .map((c, i) => ({ i, d: dist(center(c), s) }))
    .filter((l) => l.d <= k.searchRadius && rand() < chance)
    .sort((a, b) => a.d - b.d)
    .map((l) => l.i);
  if (s.lastSeen) goTo(s, map, s.lastSeen);
  else s.path = [];
}

function wander(s, map, k, rand) {
  const c = cellOf(s);
  const r = Math.ceil(k.searchRadius);
  for (let i = 0; i < 8; i++) {
    const cx = c.cx + Math.floor(rand() * (r * 2 + 1)) - r;
    const cy = c.cy + Math.floor(rand() * (r * 2 + 1)) - r;
    if (blocked(map, cx, cy)) continue;
    const path = route(s, map, { cx, cy });
    if (path?.length) {
      s.path = path;
      return;
    }
  }
}

// 길이 있는 다음 사물함으로 간다. 길이 없는 사물함은 건너뛴다 (못 간 곳을 뒤진 것으로 치지 않는다)
function nextLocker(s, map) {
  while (s.lockers.length) {
    const i = s.lockers.shift();
    const path = route(s, map, frontOf(map, map.lockers[i]));
    if (path) {
      s.checking = i;
      s.path = path;
      return true;
    }
  }
  return false;
}

function tickSearch(s, world, k, dt, rand, events) {
  s.searchT -= dt;
  if (s.searchT <= 0) {
    s.mode = 'patrol';
    s.path = [];
    return;
  }
  if (walk(s, walkSpeed(s, k), dt)) return;
  if (s.checking !== null) {
    events.push('locker');
    if (world.player.hidden === s.checking) events.push('found');
    s.checking = null;
  }
  if (!nextLocker(s, world.map)) wander(s, world.map, k, rand);
}

function recentlyVisited(s, i, k) {
  const size = s.recent.length;
  for (let n = 1; n <= k.patrolMemory; n++) {
    if (s.recent[(s.recentAt - n + size) % size] === i) return true;
  }
  return false;
}

// 주인공이 자주 다니는 곳일수록, 방금 다녀온 곳이 아닐수록 잘 뽑힌다
function pickPatrol(s, map, k, rand) {
  const n = map.patrol.length;
  if (s.weights.length < n) s.weights = new Float32Array(n); // 문이 열리면 순찰 지점이 늘어난다
  const w = s.weights;
  let top = 0;
  for (let i = 0; i < n; i++) {
    w[i] = heatAround(s, map, map.patrol[i], k.heatRadius);
    top = Math.max(top, w[i]);
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    const pull = i === s.patrolIndex ? 0 : 1 + (top > 0 ? (k.patrolHeatPull * w[i]) / top : 0);
    w[i] = recentlyVisited(s, i, k) ? pull * k.patrolRecent : pull;
    total += w[i];
  }
  let left = rand() * total;
  for (let i = 0; i < n; i++) {
    left -= w[i];
    if (w[i] > 0 && left < 0) return i;
  }
  return (s.patrolIndex + 1) % n;
}

function tickPatrol(s, map, k, dt, rand) {
  if (walk(s, walkSpeed(s, k), dt) || !map.patrol.length) return;
  s.recent[s.recentAt] = s.patrolIndex;
  s.recentAt = (s.recentAt + 1) % s.recent.length;
  // 잠긴 곳처럼 길이 없는 지점을 뽑으면 다시 뽑는다
  for (let tries = 0; tries < 3 && !s.path.length; tries++) {
    s.patrolIndex = pickPatrol(s, map, k, rand);
    goTo(s, map, map.patrol[s.patrolIndex]);
  }
}

// avoid 로 표시한 칸을 밟지 않는 길. 없으면 null
function pathAround(map, from, to, avoid) {
  const size = map.w * map.h;
  const prev = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);
  const start = from.cy * map.w + from.cx;
  const goal = to.cy * map.w + to.cx;
  prev[start] = start;
  queue[0] = start;
  for (let head = 0, tail = 1; head < tail; head++) {
    const at = queue[head];
    if (at === goal) {
      const path = [];
      for (let i = at; i !== start; i = prev[i]) path.unshift({ cx: i % map.w, cy: Math.floor(i / map.w) });
      return path;
    }
    for (const [dx, dy] of STEPS) {
      const x = at % map.w + dx;
      const y = Math.floor(at / map.w) + dy;
      if (blocked(map, x, y) || prev[y * map.w + x] !== -1 || avoid[y * map.w + x]) continue;
      prev[y * map.w + x] = at;
      queue[tail++] = y * map.w + x;
    }
  }
  return null;
}

// 지름길과 그 둘레를 막고 돌아가는 길을 찾는다. 돌아서 다른 쪽으로 다가간다
function planFlank(s, map, player, k) {
  const goal = cellOf(player);
  const from = cellOf(s);
  const direct = findPath(map, from, goal);
  if (!direct || direct.length < 4) return false;
  const avoid = new Uint8Array(map.w * map.h);
  const mark = (x, y) => {
    if (x >= 0 && y >= 0 && x < map.w && y < map.h) avoid[y * map.w + x] = 1;
  };
  direct.slice(0, -1).forEach((c, i) => {
    mark(c.cx, c.cy);
    if (i < direct.length - 3) for (const [dx, dy] of STEPS) mark(c.cx + dx, c.cy + dy);
  });
  avoid[goal.cy * map.w + goal.cx] = 0;
  const path = pathAround(map, from, goal, avoid);
  if (!path || path.length > k.ambushMaxPath) return false;
  s.path = path;
  s.ambushKind = 'flank';
  s.ambushT = path.length / k.ambushSpeed + 1;
  s.lastSeen = goal;
  return true;
}

// 문이나 복도 또는 복도가 만나는 칸
function isChoke(map, x, y) {
  const n = !blocked(map, x, y - 1);
  const s = !blocked(map, x, y + 1);
  const e = !blocked(map, x + 1, y);
  const w = !blocked(map, x - 1, y);
  if ((n && s && !e && !w) || (e && w && !n && !s)) return true;
  if (n + s + e + w < 3) return false;
  const walls = blocked(map, x + 1, y + 1) + blocked(map, x + 1, y - 1) + blocked(map, x - 1, y + 1) + blocked(map, x - 1, y - 1);
  return walls >= 3;
}

// 뜨거운 곳 가까운 길목으로 가서 기다린다. 주인공 눈앞이나 코앞은 고르지 않는다
function planWait(s, map, player, k, rand) {
  const peak = hottest(s, map) ?? s.lastSeen;
  if (!peak) return false;
  let best = null;
  let bestScore = Infinity;
  const r = k.ambushRadius;
  for (let cy = peak.cy - r; cy <= peak.cy + r; cy++) {
    for (let cx = peak.cx - r; cx <= peak.cx + r; cx++) {
      if (blocked(map, cx, cy) || !isChoke(map, cx, cy)) continue;
      const c = center({ cx, cy });
      if (dist(c, player) < k.ambushMinDist || lineOfSight(map, c, player)) continue;
      const score = dist(c, center(peak)) + rand() * 2;
      if (score < bestScore) {
        bestScore = score;
        best = { cx, cy };
      }
    }
  }
  const path = best && findPath(map, cellOf(s), best);
  if (!path || path.length > k.ambushMaxPath) return false;
  s.path = path;
  s.ambushKind = 'wait';
  s.ambushT = path.length / k.ambushSpeed + k.ambushWaitMin + rand() * (k.ambushWaitMax - k.ambushWaitMin);
  s.target = peak;
  return true;
}

function startAmbush(s, map, player, k, rand) {
  const wait = rand() < k.ambushWaitChance;
  const planned = wait
    ? planWait(s, map, player, k, rand) || planFlank(s, map, player, k)
    : planFlank(s, map, player, k) || planWait(s, map, player, k, rand);
  if (!planned) return false;
  s.mode = 'ambush';
  s.checking = null;
  return true;
}

// 길이 끝나면 수색으로 넘어가고, 기다리는 쪽은 시간이 다 되면 넘어간다
function tickAmbush(s, map, k, dt, rand) {
  s.ambushT -= dt;
  const moving = walk(s, k.ambushSpeed, dt);
  if (!moving && s.ambushKind === 'wait' && s.target) {
    const t = center(s.target);
    s.heading = Math.atan2(t.x - s.x, t.y - s.y);
    s.target = null;
  }
  if (s.ambushT > 0 && (moving || s.ambushKind === 'wait')) return;
  if (s.ambushKind === 'wait') s.lastSeen = null;
  startSearch(s, map, k, rand);
}

// 들키지 않은 지 오래됐을 때만, 멀리서 볼 때만 멈춰 서서 바라본다
function wantsToWatch(s, player, k, rand) {
  if (s.mode === 'ambush' || s.calmT < k.watchCalm || dist(s, player) < k.watchMinDist || hears(s, player, k)) return false;
  return rand() < k.watchChance;
}

function charge(s, k, events) {
  events.push('chase');
  s.mode = 'chase';
  s.repathT = 0;
  s.warnT = k.pounceWarn; // 들킨 순간에 바로 잡히지 않는다
}

function startWatch(s, k, rand, events) {
  events.push('watch');
  s.mode = 'watch';
  s.path = [];
  s.checking = null;
  s.calmT = 0; // 한 번 바라봤으면 다음에는 바로 쫓는다
  s.watchT = k.watchMin + rand() * (k.watchMax - k.watchMin);
}

// 눈이 보이는 동안만 이어진다. 시선이 끊기면 마지막 자리를 수색한다
function tickWatch(s, map, player, k, dt, rand, events) {
  if (player.hidden !== null || !lineOfSight(map, s, player)) {
    startSearch(s, map, k, rand);
    return;
  }
  s.watchT -= dt;
  s.heading = Math.atan2(player.x - s.x, player.y - s.y);
  s.lastSeen = cellOf(player);
  if (s.watchT <= 0 || dist(s, player) <= k.watchBreak || hears(s, player, k)) charge(s, k, events);
}

function spotted(s, player, map, k) {
  if (s.graceT > 0) return false;
  if (s.mode !== 'ambush') return seesPlayer(s, player, map, k);
  // 매복 중에는 먼 곳을 쫓지 않고 가까이 올 때까지 참는다
  return player.hidden === null && dist(s, player) <= k.ambushSpring && lineOfSight(map, s, player);
}

// 눈뜬이가 사라진다. 등을 돌린 사이에만 부르고, 멀리서 다시 천천히 다가온다
function slipAway(s, map, player, rand, events) {
  events.push('slip');
  sendAway(s, map, player, rand);
  s.frozenT = 0;
  s.doorT = 0;
}

// 눈뜬이: 보고 있으면 멈추고, 안 보면 주인공 쪽으로 온다. 듣지 않아도 어디 있는지 안다.
// 멀면 천천히 (patrol), 길이 가까우면 빠르게 (chase) 온다. 소리와 몸짓 표는 그 이름을 그대로 읽는다.
function tickGazer(s, world, m, k, dt, rand, events) {
  const { map, player } = world;
  if (s.mode === 'stunned') {
    s.stunT -= dt;
    if (s.stunT <= 0) s.mode = 'patrol';
    s.repathT = 0;
    return;
  }
  if (world.seen) {
    s.mode = 'watch';
    s.frozenT += dt;
    return;
  }
  if (s.mode === 'watch') {
    s.mode = 'patrol';
    if (s.frozenT >= m.slipAfter) {
      slipAway(s, map, player, rand, events);
      return;
    }
  }
  s.frozenT = Math.max(0, s.frozenT - dt);
  if (s.graceT > 0) {
    s.repathT = 0;
    tickPatrol(s, map, k, dt, rand);
    return;
  }
  s.repathT -= dt;
  if (s.repathT <= 0) {
    goTo(s, map, cellOf(player));
    s.repathT = m.repath;
  }
  const near = s.path.length <= m.rushPath + (s.mode === 'chase' ? m.rushSlack : 0);
  if (near && s.mode !== 'chase') {
    if (s.calmT >= m.alarmAgain) events.push('chase');
    s.mode = 'chase';
    s.warnT = m.chaseWarn; // 발소리가 들리기 시작한 뒤 이 시간 동안은 잡지 않는다
  } else if (!near) s.mode = 'patrol';
  if (near) s.calmT = 0;
  if (player.hidden !== null) {
    s.warnT = Math.max(s.warnT, m.chaseWarn); // 문 앞에 있어도 나오는 순간 바로 잡지 않는다
    if (s.path.length) s.doorT = 0;
    else if ((s.doorT += dt) >= m.doorWait) {
      slipAway(s, map, player, rand, events);
      return;
    }
  }
  // 같은 칸이면 곧장 다가가되 몸이 겹치기 전에 선다
  if (near && sameCell(cellOf(s), cellOf(player))) closeIn(s, player, Math.max(0, Math.min(m.rushSpeed * dt, dist(s, player) - k.catchDist / 2)));
  else walk(s, near ? m.rushSpeed : m.creep * (1 + k.pressureWalk * s.pressure), dt);
  if (s.mode === 'chase' && s.warnT <= 0 && player.hidden === null && dist(s, player) < k.catchDist) events.push('caught');
}

function startSniff(s, m) {
  s.mode = 'search';
  s.searchT = m.sniffTime;
  s.lockers = [];
  s.checking = null;
  s.path = [];
}

// 소리가 난 칸으로 간다. 쉬는 중이면 달리지 않고 걸어간다
function hearAt(s, map, cell, m, events) {
  s.pauseT = 0;
  const following = s.mode === 'chase' || s.mode === 'investigate';
  if (!following || !sameCell(cell, s.target)) {
    s.target = cell;
    goTo(s, map, cell);
  }
  if (s.mode === 'chase') return;
  s.checking = null;
  if (s.rushRestT > 0) {
    s.mode = 'investigate';
    return;
  }
  events.push('chase');
  s.mode = 'chase';
  s.rushT = m.rushTime;
  s.warnT = m.rushWarn;
}

// 소리 없이 서 있는 주인공 앞에서 돌아선다. 주인공 칸을 밟지 않는 길로 다른 순찰 지점에 간다
function turnAway(s, map, player, k, rand) {
  s.mode = 'patrol';
  s.path = [];
  const avoid = new Uint8Array(map.w * map.h);
  const c = cellOf(player);
  avoid[c.cy * map.w + c.cx] = 1;
  const n = map.patrol.length;
  const first = n ? pickPatrol(s, map, k, rand) : 0;
  for (let i = 0; i < n && !s.path.length; i++) {
    s.patrolIndex = (first + i) % n;
    s.path = pathAround(map, cellOf(s), frontOf(map, map.patrol[s.patrolIndex]), avoid) || [];
  }
}

// 큰입이: 눈이 없다. 달리는 소리와 문 여는 소리는 멀리서, 걷는 소리는 가까이서만 듣는다.
// 소리 난 곳으로 잠깐 달려들고 (chase), 남은 길은 걸어가서 (investigate), 코로 찾는다 (search).
// 소리를 내지 않으면 찾지 못하지만 닿으면 잡는다. 달려올 때는 멈추지 말고 자리를 옮겨야 한다.
function tickMaw(s, world, m, k, dt, rand, events) {
  const { map, player } = world;
  const hiding = player.hidden !== null;
  const running = player.noise >= k.runNoise;
  const loud = running || map.locked.size < s.lockedN; // 문이 열리면 잠긴 칸이 줄어든다
  const slammed = hiding && !s.wasHidden && s.ranT > 0;
  s.lockedN = map.locked.size;
  s.wasHidden = hiding;
  s.ranT = running ? m.lockerRun : Math.max(0, s.ranT - dt);
  s.rushRestT = Math.max(0, s.rushRestT - dt);
  s.brushT = Math.max(0, s.brushT - dt);
  if (s.mode === 'stunned') {
    s.stunT -= dt;
    if (s.stunT <= 0) startSniff(s, m);
    return;
  }
  if (s.graceT > 0) {
    tickPatrol(s, map, k, dt, rand);
    return;
  }
  if (slammed && s.warnT <= 0 && dist(s, player) <= m.lockerNear) {
    events.push('found');
    return;
  }
  const range = loud ? m.hearRun * (1 + k.pressureHear * s.pressure) : m.hearWalk; // 걷는 소리는 끝까지 가까이서만 듣는다
  const heard = !hiding && (loud || player.noise > 0) && dist(s, player) <= range;
  if (heard) hearAt(s, map, cellOf(player), m, events);
  const rushing = s.mode === 'chase';
  if (rushing) {
    s.calmT = 0;
    s.rushT -= dt;
    const moving = walk(s, m.rushSpeed, dt);
    if (!moving || s.rushT <= 0) {
      s.rushRestT = m.rushRest;
      if (moving) s.mode = 'investigate';
      else startSniff(s, m);
    }
  } else if (s.pauseT > 0) {
    s.pauseT -= dt;
    if (s.pauseT <= 0) turnAway(s, map, player, k, rand);
  } else if (!hiding && player.noise === 0 && s.brushT <= 0 && dist(s, player) <= m.brushDist && lineOfSight(map, s, player)) {
    events.push('sniff');
    s.pauseT = m.sniffPause;
    s.brushT = m.brushRest;
  } else if (s.mode === 'investigate') {
    if (!walk(s, walkSpeed(s, k), dt)) startSniff(s, m);
  } else if (s.mode === 'search') tickSearch(s, world, k, dt, rand, events);
  else tickPatrol(s, map, k, dt, rand);
  // 멈추면 듣지 못할 뿐이다. 달려든 곳에 그대로 서 있거나 몸에 닿으면 잡힌다
  if (rushing && !hiding && sameCell(cellOf(s), cellOf(player))) closeIn(s, player, Math.max(0, Math.min(m.rushSpeed * dt, dist(s, player) - m.touchDist / 2)));
  if (s.warnT <= 0 && !hiding && dist(s, player) < m.touchDist) events.push('caught');
}

// 파쇄자를 한 번 움직인다. 일어난 일을 events 로 돌려준다.
// 'found' 는 여기서 잡힘이 되지 않는다. 호출하는 쪽이 이 이벤트를 받아 잡힘으로 처리한다.
export function tickStalker(s, world, k, dt, rand = Math.random) {
  const { map, player } = world;
  const events = [];
  s.pressure = Math.min(1, world.pressure || 0);
  s.graceT = Math.max(0, Math.min(s.graceT, k.respawnGrace) - dt); // sendAway 가 넣은 Infinity 를 여기서 맞춘다
  s.warnT = Math.max(0, s.warnT - dt);
  s.calmT += dt;
  if (s.monsterId === 'gazer') {
    tickGazer(s, world, k.monsters.gazer, k, dt, rand, events);
    return events;
  }
  if (s.monsterId === 'maw') {
    tickMaw(s, world, k.monsters.maw, k, dt, rand, events);
    return events;
  }
  if (throughWalls(s)) {
    const inside = wallAt(map, Math.floor(s.x), Math.floor(s.y));
    if (inside && !s.inWall) events.push('wall');
    s.inWall = inside;
    s.wallSlow = k.monsters.ward.wallSlow;
  }
  if (player.hidden === null && player.noise > 0) {
    trailCell.cx = Math.floor(player.x);
    trailCell.cy = Math.floor(player.y);
    noteTrail(s, trailCell, dt);
  }
  coolHeat(s, k, dt);
  if (s.mode === 'stunned') {
    s.stunT -= dt;
    if (s.stunT <= 0) {
      s.lastSeen = null;
      startSearch(s, map, k, rand);
    }
    return events;
  }
  if (s.mode === 'watch') {
    tickWatch(s, map, player, k, dt, rand, events);
    return events;
  }
  const sees = spotted(s, player, map, k);
  const heard = !sees && s.graceT <= 0 && s.mode !== 'chase' && s.mode !== 'ambush' && notices(s, player, map, k);
  if (sees) {
    if (s.mode !== 'chase') {
      if (wantsToWatch(s, player, k, rand)) startWatch(s, k, rand, events);
      else charge(s, k, events);
    }
    s.lostT = 0;
    s.lastSeen = cellOf(player);
  } else if (heard) {
    // 조사 중이면 다시 알리지 않는다. 소리 난 칸이 바뀔 때만 길을 새로 찾는다
    if (s.mode !== 'investigate') events.push('notice');
    const cell = cellOf(player);
    if (s.mode !== 'investigate' || !sameCell(cell, s.target)) {
      s.target = cell;
      goTo(s, map, cell);
    }
    s.mode = 'investigate';
  }

  if (s.mode === 'chase') {
    s.calmT = 0;
    s.repathT -= dt;
    if (s.repathT <= 0 && s.lastSeen) {
      goTo(s, map, s.lastSeen);
      s.repathT = k.repathTime;
    }
    if (sees && sameCell(cellOf(s), cellOf(player))) closeIn(s, player, k.stalkerChase * dt);
    else walk(s, k.stalkerChase, dt);
    if (!sees) {
      s.lostT += dt;
      if (s.lostT >= k.loseTime) {
        events.push('lost');
        // 사물함에 숨은 주인공은 늘 수색한다. 매복을 뽑으면 숨기만 해도 안전해진다
        if (player.hidden === null && !throughWalls(s) && rand() < k.ambushChance && startAmbush(s, map, player, k, rand)) events.push('ambush');
        else startSearch(s, map, k, rand);
      }
    }
  } else if (s.mode === 'investigate') {
    // 도착해도 소리가 이어지면 그 자리에 머문다. 순찰로 돌아갔다가 다시 알리는 일을 막는다
    const moving = walk(s, walkSpeed(s, k), dt);
    if (!moving && !heard) s.mode = 'patrol';
  } else if (s.mode === 'search') tickSearch(s, world, k, dt, rand, events);
  else if (s.mode === 'ambush') tickAmbush(s, map, k, dt, rand);
  else if (s.mode === 'patrol') tickPatrol(s, map, k, dt, rand);

  // 벽 속을 그냥 지나가다가 경고 없이 잡지는 않는다. 쫓는 중이면 벽 너머로도 잡는다
  const armed = s.graceT <= 0 && s.warnT <= 0 && s.mode !== 'ambush' && s.mode !== 'watch' && (!s.inWall || s.mode === 'chase');
  if (armed && player.hidden === null && dist(s, player) < k.catchDist) events.push('caught');
  return events;
}

export function stunStalker(s, k) {
  s.mode = 'stunned';
  s.stunT = k.stunTime;
  s.path = [];
  s.calmT = 0;
}

// 잡은 뒤에는 멀리 옮겨서, 다시 시작하자마자 또 잡히지 않게 한다
// 멀리 있는 순찰 지점 몇 곳 중 하나로 보낸다. 늘 같은 곳이면 같은 길목에서 계속 마주친다.
// taken: 다른 괴물이 이미 간 순찰 지점 번호
export function sendAway(s, map, player, rand = Math.random, taken = []) {
  const far = map.patrol
    .map((c, i) => ({ c, i, d: dist(center(c), player) }))
    .filter(({ i }) => !taken.includes(i))
    .sort((a, b) => b.d - a.d)
    .slice(0, Math.max(1, Math.min(3, map.patrol.length)));
  const pick = far[Math.floor(rand() * far.length) % far.length];
  s.patrolIndex = pick.i;
  const c = center(pick.c);
  // graceT 는 다음 움직임에서 balance 값으로 줄어든다. 사물함 잡힘 뒤에도 같다
  Object.assign(s, { x: c.x, y: c.y, mode: 'patrol', path: [], lostT: 0, checking: null, lockers: [], lastSeen: null, target: null, graceT: Infinity, warnT: 0, calmT: 0 });
}

// 심장이 뛰는 간격(초). 멀면 null. k 는 balance.horror
export function heartInterval(d, k) {
  if (d > k.heartFar) return null;
  return k.heartFast + (d / k.heartFar) * k.heartSlow;
}
