// 파쇄자 행동 (화면과 상관없는 부분). 순찰, 조사, 추격, 수색, 멈춤 다섯 상태로 움직인다.
import { cellOf, center, findPath, frontOf, lineOfSight, blocked } from './horrorGrid.js';

const HEART_FAR = 14; // 이보다 멀면 심장 소리가 없다

export function createStalker(map) {
  const c = center(map.stalker);
  return { x: c.x, y: c.y, heading: 0, mode: 'patrol', path: [], patrolIndex: 0, lostT: 0, searchT: 0, stunT: 0, repathT: 0, lockers: [], checking: null, lastSeen: null };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
  if (s.lockers.length) {
    s.checking = s.lockers.shift();
    goTo(s, world.map, world.map.lockers[s.checking]);
  } else wander(s, world.map, k, rand);
}

function tickPatrol(s, map, k, dt) {
  if (walk(s, k.stalkerWalk, dt)) return;
  s.patrolIndex = (s.patrolIndex + 1) % map.patrol.length;
  goTo(s, map, map.patrol[s.patrolIndex]);
}

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
  if (sees) {
    if (s.mode !== 'chase') {
      events.push('chase');
      s.repathT = 0;
    }
    s.mode = 'chase';
    s.lostT = 0;
    s.lastSeen = cellOf(player);
  } else if (s.mode !== 'chase' && notices(s, player, map, k)) {
    if (s.mode !== 'investigate') events.push('notice');
    s.mode = 'investigate';
    goTo(s, map, cellOf(player));
  }

  if (s.mode === 'chase') {
    s.repathT -= dt;
    if (s.repathT <= 0 && s.lastSeen) {
      goTo(s, map, s.lastSeen);
      s.repathT = k.repathTime;
    }
    walk(s, k.stalkerChase, dt);
    if (!sees) {
      s.lostT += dt;
      if (s.lostT >= k.loseTime) {
        events.push('lost');
        startSearch(s, map, k, rand);
      }
    }
  } else if (s.mode === 'investigate') {
    if (!walk(s, k.stalkerWalk, dt)) s.mode = 'patrol';
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
export function sendAway(s, map, player) {
  let best = map.patrol[0];
  map.patrol.forEach((c, i) => {
    if (dist(center(c), player) >= dist(center(best), player)) {
      best = c;
      s.patrolIndex = i;
    }
  });
  const c = center(best);
  Object.assign(s, { x: c.x, y: c.y, mode: 'patrol', path: [], lostT: 0, checking: null, lockers: [], lastSeen: null });
}

// 심장이 뛰는 간격(초). 멀면 null
export function heartInterval(d) {
  if (d > HEART_FAR) return null;
  return 0.35 + (d / HEART_FAR) * 0.85;
}
