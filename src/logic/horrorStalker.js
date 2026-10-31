// 파쇄자 행동 (화면과 상관없는 부분). 순찰, 조사, 추격, 수색, 멈춤 다섯 상태로 움직인다.
import { cellOf, center, findPath, frontOf, lineOfSight, blocked } from './horrorGrid.js';

export function createStalker(map) {
  const c = center(map.stalker);
  return { x: c.x, y: c.y, heading: 0, mode: 'patrol', path: [], patrolIndex: 0, lostT: 0, searchT: 0, stunT: 0, repathT: 0, lockers: [], checking: null, lastSeen: null, target: null };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sameCell = (a, b) => !!b && a.cx === b.cx && a.cy === b.cy;

export function seesPlayer(s, player, map, k) {
  if (player.hidden !== null) return false;
  const d = dist(s, player);
  if (d > (player.lightOn ? k.seeLight : k.seeDark)) return false;
  const toPlayer = Math.atan2(player.x - s.x, player.y - s.y);
  const diff = Math.atan2(Math.sin(toPlayer - s.heading), Math.cos(toPlayer - s.heading));
  if (Math.abs(diff) > ((k.fov / 2) * Math.PI) / 180) return false;
  return lineOfSight(map, s, player);
}

function notices(s, player, map, k) {
  if (player.hidden !== null) return false;
  const d = dist(s, player);
  if (player.noise > 0 && d <= player.noise) return true;
  return player.lightOn && d <= k.noticeLight && lineOfSight(map, s, player);
}

function goTo(s, map, cell) {
  s.path = findPath(map, cellOf(s), frontOf(map, cell)) || [];
}

// 길을 따라 한 걸음. 길이 다 끝났으면 false
function walk(s, speed, dt) {
  let left = speed * dt;
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
  s.mode = 'search';
  s.searchT = k.searchTime;
  s.checking = null;
  s.lockers = map.lockers
    .map((c, i) => ({ i, d: dist(center(c), s) }))
    .filter((l) => l.d <= k.searchRadius && rand() < k.lockerCheckChance)
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
    const path = findPath(map, c, { cx, cy });
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
    const path = findPath(map, cellOf(s), frontOf(map, map.lockers[i]));
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
  if (walk(s, k.stalkerWalk, dt)) return;
  if (s.checking !== null) {
    events.push('locker');
    if (world.player.hidden === s.checking) events.push('found');
    s.checking = null;
  }
  if (!nextLocker(s, world.map)) wander(s, world.map, k, rand);
}

function tickPatrol(s, map, k, dt) {
  if (walk(s, k.stalkerWalk, dt)) return;
  s.patrolIndex = (s.patrolIndex + 1) % map.patrol.length;
  goTo(s, map, map.patrol[s.patrolIndex]);
}

// 파쇄자를 한 번 움직인다. 일어난 일을 events 로 돌려준다.
// 'found' 는 여기서 잡힘이 되지 않는다. 호출하는 쪽이 이 이벤트를 받아 잡힘으로 처리한다.
export function tickStalker(s, world, k, dt, rand = Math.random) {
  const { map, player } = world;
  const events = [];
  if (s.mode === 'stunned') {
    s.stunT -= dt;
    if (s.stunT <= 0) {
      s.lastSeen = null;
      startSearch(s, map, k, rand);
    }
    return events;
  }
  const sees = seesPlayer(s, player, map, k);
  const heard = !sees && s.mode !== 'chase' && notices(s, player, map, k);
  if (sees) {
    if (s.mode !== 'chase') {
      events.push('chase');
      s.repathT = 0;
    }
    s.mode = 'chase';
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
        startSearch(s, map, k, rand);
      }
    }
  } else if (s.mode === 'investigate') {
    // 도착해도 소리가 이어지면 그 자리에 머문다. 순찰로 돌아갔다가 다시 알리는 일을 막는다
    const moving = walk(s, k.stalkerWalk, dt);
    if (!moving && !heard) s.mode = 'patrol';
  } else if (s.mode === 'search') tickSearch(s, world, k, dt, rand, events);
  else tickPatrol(s, map, k, dt);

  if (player.hidden === null && dist(s, player) < k.catchDist) events.push('caught');
  return events;
}

export function stunStalker(s, k) {
  s.mode = 'stunned';
  s.stunT = k.stunTime;
  s.path = [];
}

// 잡은 뒤에는 멀리 옮겨서, 다시 시작하자마자 또 잡히지 않게 한다
// 멀리 있는 순찰 지점 몇 곳 중 하나로 보낸다. 늘 같은 곳이면 같은 길목에서 계속 마주친다.
export function sendAway(s, map, player, rand = Math.random) {
  const far = map.patrol
    .map((c, i) => ({ c, i, d: dist(center(c), player) }))
    .sort((a, b) => b.d - a.d)
    .slice(0, Math.max(1, Math.min(3, map.patrol.length)));
  const pick = far[Math.floor(rand() * far.length) % far.length];
  s.patrolIndex = pick.i;
  const c = center(pick.c);
  Object.assign(s, { x: c.x, y: c.y, mode: 'patrol', path: [], lostT: 0, checking: null, lockers: [], lastSeen: null, target: null });
}

// 심장이 뛰는 간격(초). 멀면 null. k 는 balance.horror
export function heartInterval(d, k) {
  if (d > k.heartFar) return null;
  return k.heartFast + (d / k.heartFar) * k.heartSlow;
}
