// 물괴물: 눈이 없고 물소리만 듣는다. 물속에서는 빠르고 물 밖에서는 몸을 끌며 느리게 긴다.
// 평소에는 물속에 가라앉아 떠돌고 (patrol), 물소리가 나면 그 칸으로 간다 (chase),
// 도착하면 둘레를 더듬다가 (search) 가까운 물로 돌아간다. 소리와 몸짓 표는 이 이름을 그대로 읽는다.
import { cellOf, center, blocked } from './horrorGrid.js';
import { waterAt, DRY } from './horrorWater.js';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sameCell = (a, b) => !!b && a.cx === b.cx && a.cy === b.cy;
const wetAt = (map, c) => waterAt(map, c.cx, c.cy) > DRY;

// 물로 가는 길이 싸다. 물 칸은 1, 마른 칸은 landCost. 출발 칸은 빼고 도착 칸까지. 같은 칸이면 [], 길이 없으면 null
export function swimPath(map, from, to, landCost) {
  if (from.cx === to.cx && from.cy === to.cy) return [];
  if (blocked(map, to.cx, to.cy)) return null;
  const n = map.w * map.h;
  const cost = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const start = from.cy * map.w + from.cx;
  const goal = to.cy * map.w + to.cx;
  cost[start] = 0;
  const heap = [[0, start]]; // [비용, 칸]
  const push = (item) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0;) {
      const up = (i - 1) >> 1;
      if (heap[up][0] <= heap[i][0]) break;
      [heap[up], heap[i]] = [heap[i], heap[up]];
      i = up;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [c, i] = pop();
    if (c > cost[i]) continue;
    if (i === goal) break;
    const x = i % map.w;
    const y = (i - x) / map.w;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (blocked(map, nx, ny)) continue;
      const j = ny * map.w + nx;
      const nc = c + (waterAt(map, nx, ny) > DRY ? 1 : landCost);
      if (nc < cost[j]) {
        cost[j] = nc;
        prev[j] = i;
        push([nc, j]);
      }
    }
  }
  if (cost[goal] === Infinity) return null;
  const path = [];
  for (let i = goal; i !== start; i = prev[i]) path.unshift({ cx: i % map.w, cy: Math.floor(i / map.w) });
  return path;
}

// 물속 순찰 지점. 맵에 물 위 순찰 지점이 없으면 모든 순찰 지점을 쓴다
export function poolSpots(map) {
  const wet = map.patrol.filter((c) => wetAt(map, c));
  return wet.length ? wet : map.patrol;
}

// 길을 따라 한 걸음. 물속은 swim, 물 밖은 crawl 속도다. 길이 다 끝났으면 false
function glide(s, map, m, slow, dt) {
  let t = dt;
  while (t > 0 && s.path.length) {
    const speed = (wetAt(map, cellOf(s)) ? m.swimSpeed : m.crawlSpeed) * slow;
    const to = center(s.path[0]);
    const d = dist(s, to);
    if (d > 0.001) s.heading = Math.atan2(to.x - s.x, to.y - s.y);
    const step = speed * t;
    if (d <= step) {
      s.x = to.x;
      s.y = to.y;
      s.path.shift();
      t -= d / speed;
    } else {
      s.x += ((to.x - s.x) / d) * step;
      s.y += ((to.y - s.y) / d) * step;
      t = 0;
    }
  }
  return s.path.length > 0;
}

function head(s, map, m, cell) {
  s.path = swimPath(map, cellOf(s), cell, m.landCost) || [];
}

function lurk(s, map, m, rand) {
  const spots = poolSpots(map);
  if (!spots.length) return;
  let i = Math.floor(rand() * spots.length) % spots.length;
  if (spots.length > 1 && sameCell(spots[i], cellOf(s))) i = (i + 1) % spots.length;
  head(s, map, m, spots[i]);
}

function startGrope(s, m) {
  s.mode = 'search';
  s.searchT = m.gropeTime;
  s.path = [];
}

// 더듬기가 끝나면 가장 가까운 물속 순찰 지점으로 돌아간다
function goBack(s, map, m) {
  s.mode = 'patrol';
  const spots = poolSpots(map);
  if (!spots.length) return;
  const near = spots.reduce((a, b) => (dist(center(a), s) <= dist(center(b), s) ? a : b));
  head(s, map, m, near);
}

// 소리 난 칸 둘레 한 칸 안을 천천히 더듬는다
function grope(s, map, m, dt, rand) {
  s.searchT -= dt;
  if (s.searchT <= 0) {
    goBack(s, map, m);
    return;
  }
  if (glide(s, map, m, m.gropeSlow, dt)) return;
  const at = s.target ?? cellOf(s);
  const [dx, dy] = STEPS[Math.floor(rand() * STEPS.length) % STEPS.length];
  const next = { cx: at.cx + dx, cy: at.cy + dy };
  s.path = blocked(map, next.cx, next.cy) ? [at] : [next];
}

// 들은 곳: 주인공의 물소리가 먼저고, 없으면 고무오리가 떨어진 물소리
function heardAt(s, world, k) {
  const { player, splash } = world;
  const reach = (r) => r * (1 + k.pressureHear * s.pressure);
  if (player.hidden === null && player.noise > 0 && dist(s, player) <= reach(player.noise)) return cellOf(player);
  if (splash && dist(s, splash) <= reach(splash.range)) return cellOf(splash);
  return null;
}

// world: { map, player: { x, y, hidden, noise }, splash: { x, y, range } | null }. player.noise 는 물소리 거리다
export function tickSwimmer(s, world, m, k, dt, rand, events) {
  const { map, player } = world;
  s.inWater = wetAt(map, cellOf(s));
  if (s.mode === 'stunned') {
    s.stunT -= dt;
    if (s.stunT <= 0) startGrope(s, m);
    return;
  }
  if (s.graceT > 0) {
    if (!glide(s, map, m, m.lurkSlow, dt)) lurk(s, map, m, rand);
    return;
  }
  const heard = heardAt(s, world, k);
  if (heard) {
    if (s.mode !== 'chase') {
      events.push('chase');
      s.mode = 'chase';
      s.warnT = m.rushWarn;
    }
    if (!sameCell(heard, s.target) || !s.path.length) {
      s.target = heard;
      head(s, map, m, heard);
    }
  }
  if (s.mode === 'chase') {
    s.calmT = 0;
    if (!glide(s, map, m, 1, dt)) startGrope(s, m);
  } else if (s.mode === 'search') grope(s, map, m, dt, rand);
  else if (!glide(s, map, m, m.lurkSlow, dt)) lurk(s, map, m, rand);
  // 소리를 안 내도 몸에 닿으면 잡는다. 달려들기 시작한 직후에는 잡지 않는다
  if (s.warnT <= 0 && player.hidden === null && dist(s, player) < m.touchDist) events.push('caught');
}
