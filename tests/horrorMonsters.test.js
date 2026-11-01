import { describe, it, expect } from 'vitest';
import { createStalker, tickStalker, stunStalker, sendAway } from '../src/logic/horrorStalker.js';
import { parseMap, inPlayerView, withOpen, center, findPath, cellOf, blocked } from '../src/logic/horrorGrid.js';
import { factoryMap } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const gz = k.monsters.gazer;
const mw = k.monsters.maw;
const DT = 0.05;
const seeded = (seed) => {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};
// 긴 복도 둘을 이은 맵. 순찰 지점은 양쪽 끝이다
const hall = parseMap([
  '##############################',
  '#MR.........................R#',
  '#.##########################.#',
  '#L..........................R#',
  '##############################',
]);
const SOUTH = 0; // yaw 0 은 y 가 줄어드는 쪽, 아래 값들은 x 쪽을 본다
const LOOK_EAST = -Math.PI / 2;
const LOOK_WEST = Math.PI / 2;
const player = (o) => ({ x: 20.5, y: 1.5, hidden: null, lightOn: false, noise: 0, ...o });
const monster = (id, o, map = hall) => Object.assign(createStalker(map, k, Math.random, id), o);
const run = (s, world, seconds, rand = () => 0.5) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...tickStalker(s, world, k, DT, rand));
  return events;
};
const dist = (s, p) => Math.hypot(s.x - p.x, s.y - p.y);

describe('주인공이 괴물을 보고 있는가', () => {
  const s = { x: 10.5, y: 1.5 };

  it('바라보는 쪽만 친다', () => {
    expect(inPlayerView({ x: 5.5, y: 1.5 }, LOOK_EAST, s, hall, k)).toBe(true);
    expect(inPlayerView({ x: 5.5, y: 1.5 }, LOOK_WEST, s, hall, k)).toBe(false);
    expect(inPlayerView({ x: 5.5, y: 1.5 }, SOUTH, s, hall, k)).toBe(false);
  });

  it('시야각 안쪽 경계를 지킨다', () => {
    const half = ((k.viewFov / 2) * Math.PI) / 180;
    expect(inPlayerView({ x: 5.5, y: 1.5 }, LOOK_EAST + half - 0.05, s, hall, k)).toBe(true);
    expect(inPlayerView({ x: 5.5, y: 1.5 }, LOOK_EAST + half + 0.05, s, hall, k)).toBe(false);
  });

  it('몸이 겹쳐 있으면 안 본 것으로 친다 (눈을 뗄 수 없는 일이 없다)', () => {
    expect(inPlayerView({ x: 10.5, y: 1.5 }, LOOK_EAST, s, hall, k)).toBe(false);
  });

  it('벽에 가리면 못 본다', () => {
    expect(inPlayerView({ x: 10.5, y: 3.5 }, SOUTH, s, hall, k)).toBe(false);
  });

  it('닫힌 문은 가리고 연 문은 가리지 않는다', () => {
    const door = parseMap([
      '#######',
      '#..A..#',
      '#######',
    ]);
    const from = { x: 1.5, y: 1.5 };
    const to = { x: 5.5, y: 1.5 };
    expect(inPlayerView(from, LOOK_EAST, to, door, k)).toBe(false);
    expect(inPlayerView(from, LOOK_EAST, to, withOpen(door, [0]), k)).toBe(true);
  });

  it('사물함은 눈을 막지 않는다', () => {
    const room = parseMap([
      '#######',
      '#..L..#',
      '#######',
    ]);
    expect(inPlayerView({ x: 1.5, y: 1.5 }, LOOK_EAST, { x: 5.5, y: 1.5 }, room, k)).toBe(true);
  });

  it('너무 멀면 못 본다 (그리지도 않는 거리)', () => {
    expect(inPlayerView({ x: 1.5, y: 1.5 }, LOOK_EAST, { x: 1.5 + k.viewCells + 1, y: 1.5 }, hall, k)).toBe(false);
  });

  it('벽 모서리에 몸 일부만 걸쳐도 본 것이다', () => {
    const corner = parseMap([
      '#####',
      '#...#',
      '###.#',
      '###.#',
      '#####',
    ]);
    // 눈에서 몸 가운데는 벽에 가리고 왼쪽 가장자리는 보인다
    const eye = { x: 1.5, y: 1.5 };
    const body = { x: 3.3, y: 2.5 };
    expect(inPlayerView(eye, -2, { x: 3.3 + 0.4, y: 3.5 }, corner, k)).toBe(false);
    expect(inPlayerView(eye, -2, body, corner, k)).toBe(true);
  });

  it('사물함 안에서는 틈으로 보이는 쪽만 친다. 고개를 돌리면 눈을 뗄 수 있다', () => {
    const p = center(hall.lockers[0]);
    const front = { x: p.x + 2, y: p.y };
    expect(inPlayerView(p, LOOK_EAST, front, hall, k, true)).toBe(true);
    const lookLimit = 0.6; // HorrorGame 의 HIDE_LOOK
    expect(inPlayerView(p, LOOK_EAST + lookLimit, front, hall, k, true)).toBe(false);
    expect(inPlayerView(p, LOOK_EAST + lookLimit, front, hall, k)).toBe(true); // 틈이 없으면 눈을 못 뗀다
  });
});

describe('세이노는 그대로다', () => {
  it('기본값은 세이노이고 world.seen 을 읽지 않는다', () => {
    const trace = (seen) => {
      const s = createStalker(hall);
      const rand = seeded(7);
      const out = [];
      for (let t = 0; t < 40; t += DT) {
        out.push(...tickStalker(s, { map: hall, player: player({ x: 7.5, noise: 3 }), seen }, k, DT, rand), s.mode, s.x);
      }
      return out;
    };
    expect(createStalker(hall).monsterId).toBe('seino');
    expect(trace(true)).toEqual(trace(false));
  });

  it('createStalker 는 세이노의 첫 상태를 바꾸지 않는다', () => {
    const s = createStalker(hall, k, Math.random);
    expect([s.mode, s.x, s.y, s.path.length]).toEqual(['patrol', 1.5, 1.5, 0]);
  });
});

describe('눈뜬이: 보고 있으면 멈춘다', () => {
  it('보는 동안은 한 치도 움직이지 않고, 발소리 상태로도 가지 않는다', () => {
    const s = monster('gazer', { x: 18.5, y: 1.5 });
    run(s, { map: hall, player: player(), seen: false }, 0.2); // 일단 움직이는 중이다
    const { x, y } = s;
    const events = run(s, { map: hall, player: player(), seen: true }, 4);
    expect([s.x, s.y]).toEqual([x, y]);
    expect(s.mode).toBe('watch');
    expect(k.stepEvery.watch).toBe(0);
    expect(events).not.toContain('caught');
  });

  it('닿을 만큼 가까워도 보고 있으면 잡지 않는다', () => {
    const s = monster('gazer', { x: 20.9, y: 1.5, mode: 'chase', warnT: 0 });
    expect(run(s, { map: hall, player: player(), seen: true }, 3)).not.toContain('caught');
  });

  it('소리를 내지 않아도 멀리서 천천히 다가온다', () => {
    const s = monster('gazer');
    const p = player();
    const before = dist(s, p);
    run(s, { map: hall, player: p, seen: false }, 5);
    expect(s.mode).toBe('patrol');
    expect(before - dist(s, p)).toBeCloseTo(gz.creep * 5, 0);
    expect(gz.creep).toBeLessThan(k.walkSpeed);
  });

  it('가까워지면 걷기보다 빠르고 달리기보다 느리게 온다', () => {
    expect(gz.rushSpeed).toBeGreaterThan(k.walkSpeed);
    expect(gz.rushSpeed).toBeLessThan(k.runSpeed);
    const s = monster('gazer', { x: 16.5, y: 1.5, calmT: 99 });
    const events = run(s, { map: hall, player: player(), seen: false }, 1);
    expect(events).toContain('chase');
    expect(s.mode).toBe('chase');
    expect(20.5 - s.x).toBeCloseTo(4 - gz.rushSpeed * 1, 0);
  });

  it('뒤에서 잡으려면 발소리가 커진 뒤로 chaseWarn 이 지나야 한다', () => {
    const s = monster('gazer', { x: 20.2, y: 1.5, calmT: 99 });
    const p = player();
    const events = [];
    let tChase = null;
    let tCaught = null;
    for (let t = 0; t < 3 && tCaught === null; t += DT) {
      const e = tickStalker(s, { map: hall, player: p, seen: false }, k, DT, () => 0.5);
      events.push(...e);
      if (e.includes('chase')) tChase = t;
      if (e.includes('caught')) tCaught = t;
    }
    expect(tChase).toBe(0);
    expect(tCaught).toBeGreaterThanOrEqual(gz.chaseWarn - DT);
  });

  it('눈을 뗀 순간 코앞이어도 바로 잡지 않는다', () => {
    const s = monster('gazer', { x: 20.2, y: 1.5, mode: 'chase' });
    run(s, { map: hall, player: player(), seen: true }, 1);
    expect(run(s, { map: hall, player: player(), seen: false }, gz.chaseWarn - 0.2)).not.toContain('caught');
    expect(run(s, { map: hall, player: player(), seen: false }, 0.5)).toContain('caught');
  });

  it('코앞까지 와도 몸이 겹치기 전에 선다', () => {
    const s = monster('gazer', { x: 20.05, y: 1.5, mode: 'chase', warnT: 9 });
    run(s, { map: hall, player: player(), seen: false }, 1);
    expect(dist(s, player())).toBeGreaterThanOrEqual(k.catchDist / 2 - 0.001);
  });

  it('돌아보기를 되풀이해도 안내가 쏟아지지 않는다', () => {
    const s = monster('gazer', { x: 15.5, y: 1.5, calmT: 99 });
    const events = [];
    for (let i = 0; i < 40; i++) {
      events.push(...tickStalker(s, { map: hall, player: player(), seen: i % 4 === 0 }, k, DT, () => 0.5));
    }
    expect(events.filter((e) => e === 'chase').length).toBe(1);
  });

  it('오래 보다가 눈을 떼면 사라지고, 얼마간 잡지 않는다', () => {
    const s = monster('gazer', { x: 8.5, y: 1.5 });
    const p = player({ x: 10.5 });
    run(s, { map: hall, player: p, seen: true }, gz.slipAfter + 0.1);
    expect(dist(s, p)).toBeLessThan(3); // 보는 동안에는 사라지지 않는다
    const events = run(s, { map: hall, player: p, seen: false }, 0.1);
    expect(events).toContain('slip');
    expect(dist(s, p)).toBeGreaterThan(10);
    expect(s.mode).toBe('patrol');
    expect(s.graceT).toBeGreaterThan(0);
  });

  it('짧게 봤으면 사라지지 않고 다시 온다', () => {
    const s = monster('gazer', { x: 18.5, y: 1.5 });
    run(s, { map: hall, player: player(), seen: true }, gz.slipAfter - 1);
    expect(run(s, { map: hall, player: player(), seen: false }, 0.1)).not.toContain('slip');
    expect(s.mode).toBe('chase');
  });

  it('펀치를 맞으면 안 봐도 멈추고, 끝나면 다시 온다', () => {
    const s = monster('gazer', { x: 18.5, y: 1.5, mode: 'chase' });
    stunStalker(s, k);
    const x = s.x;
    run(s, { map: hall, player: player(), seen: false }, k.stunTime - 0.2);
    expect(s.x).toBe(x);
    expect(s.mode).toBe('stunned');
    run(s, { map: hall, player: player(), seen: false }, 1);
    expect(s.x).toBeGreaterThan(x);
  });

  it('잡은 뒤에는 옆에 있어도 respawnGrace 동안 잡지 않는다', () => {
    const s = monster('gazer');
    const p = player();
    sendAway(s, hall, p);
    Object.assign(s, { x: p.x, y: p.y });
    expect(run(s, { map: hall, player: p, seen: false }, k.respawnGrace - 0.2)).not.toContain('caught');
  });

  it('사물함에 숨으면 문 앞까지 왔다가 떠난다. 들키는 일은 없다', () => {
    const p = player({ ...center(hall.lockers[0]), hidden: 0 });
    const s = monster('gazer', { x: 8.5, y: 3.5 });
    const events = [];
    let atDoor = false;
    for (let t = 0; t < 12 && !events.includes('slip'); t += DT) {
      events.push(...tickStalker(s, { map: hall, player: p, seen: false }, k, DT, () => 0.5));
      if (dist(s, p) <= 1.01) atDoor = true;
    }
    expect(atDoor).toBe(true);
    expect(events).toContain('slip');
    expect(events).not.toContain('found');
    expect(events).not.toContain('caught');
    expect(dist(s, p)).toBeGreaterThan(10);
  });

  it('틈으로 계속 보면 문 앞에서 얼어붙고, 눈을 떼야 떠난다', () => {
    const p = player({ ...center(hall.lockers[0]), hidden: 0 });
    const s = monster('gazer', { x: 2.5, y: 3.5 });
    expect(run(s, { map: hall, player: p, seen: true }, 30)).not.toContain('slip');
    expect(run(s, { map: hall, player: p, seen: false }, 0.1)).toContain('slip');
  });

  it('문 앞에 있을 때 나와도 바로 잡지 않는다', () => {
    const hiding = player({ ...center(hall.lockers[0]), hidden: 0 });
    const s = monster('gazer', { x: 2.5, y: 3.5 });
    run(s, { map: hall, player: hiding, seen: false }, 1);
    const out = player({ x: 2.5, y: 3.5, noise: 3 });
    expect(run(s, { map: hall, player: out, seen: false }, gz.chaseWarn - 0.2)).not.toContain('caught');
  });

  it('막다른 곳에서도 보고만 있으면 빠져나올 수 있다', () => {
    const p = player({ x: 2.5, y: 3.5 }); // 복도 끝
    const s = monster('gazer', { x: 6.5, y: 3.5, mode: 'chase' });
    run(s, { map: hall, player: p, seen: true }, gz.slipAfter + 0.5);
    const events = run(s, { map: hall, player: p, seen: false }, k.respawnGrace - 0.5);
    expect(events).toContain('slip');
    expect(events).not.toContain('caught');
  });

  it('퓨즈를 다 찾으면 멀리서 조금 더 빨리 다가온다', () => {
    const speed = (pressure) => {
      const s = monster('gazer');
      run(s, { map: hall, player: player(), seen: false, pressure }, 2);
      return s.x;
    };
    expect(speed(1)).toBeGreaterThan(speed(0));
  });
});

describe('큰입이: 소리로만 찾는다', () => {
  it('가만히 서 있으면 듣지 못한다. 손전등을 켜도 코앞에서 봐도 같다', () => {
    const s = monster('maw', { x: 17.5, y: 1.5 });
    const events = run(s, { map: hall, player: player({ lightOn: true }), seen: true }, 1);
    expect(events).not.toContain('chase');
    expect(events).not.toContain('notice');
  });

  it('달리는 소리는 멀리서 듣는다', () => {
    const s = monster('maw', { x: 20.5 - mw.hearRun + 1, y: 1.5 });
    expect(run(s, { map: hall, player: player({ noise: k.runNoise }) }, DT)).toContain('chase');
    expect(s.mode).toBe('chase');
    expect(mw.hearRun).toBeGreaterThan(k.runNoise); // 세이노보다 귀가 밝다
  });

  it('거리 밖의 달리는 소리는 못 듣는다', () => {
    const s = monster('maw', { x: 20.5 - mw.hearRun - 1, y: 1.5 });
    expect(run(s, { map: hall, player: player({ noise: k.runNoise }) }, DT)).not.toContain('chase');
  });

  it('걷는 소리는 가까이서만 듣는다', () => {
    const near = monster('maw', { x: 20.5 - mw.hearWalk + 0.5, y: 1.5 });
    const far = monster('maw', { x: 20.5 - mw.hearWalk - 1, y: 1.5 });
    expect(run(near, { map: hall, player: player({ noise: k.walkNoise }) }, DT)).toContain('chase');
    expect(run(far, { map: hall, player: player({ noise: k.walkNoise }) }, DT)).not.toContain('chase');
  });

  it('문 여는 소리를 멀리서 듣는다', () => {
    const map = parseMap([
      '#################',
      '#M.............A#',
      '#R.............R#',
      '#################',
    ]);
    const level = withOpen(map);
    const s = monster('maw', { x: 4.5, y: 1.5 }, level);
    const p = player({ x: 14.5, y: 1.5 });
    expect(run(s, { map: level, player: p }, DT)).not.toContain('chase');
    level.locked.clear();
    expect(run(s, { map: level, player: p }, DT)).toContain('chase');
    expect(s.target).toEqual({ cx: 14, cy: 1 });
  });

  it('달리기보다 빠르게 잠깐만 달려들고, 소리 난 곳을 코로 찾는다', () => {
    expect(mw.rushSpeed).toBeGreaterThan(k.runSpeed);
    const s = monster('maw', { x: 16.5, y: 1.5 });
    const heard = player({ noise: k.runNoise });
    run(s, { map: hall, player: heard }, DT);
    const quiet = player({ x: 26.5 }); // 소리를 내고 멀리 간 뒤 멈췄다
    run(s, { map: hall, player: quiet }, 1);
    expect(s.x).toBeCloseTo(16.5 + mw.rushSpeed * (1 + DT), 0);
    run(s, { map: hall, player: quiet }, 1.5);
    expect(s.mode).toBe('search');
    expect(s.x).toBeLessThan(23); // 주인공이 아니라 소리 난 칸으로 갔다
  });

  it('멀리서 들었으면 달려든 뒤 나머지 길은 걸어간다', () => {
    const s = monster('maw', { x: 8.5, y: 1.5 });
    run(s, { map: hall, player: player({ noise: k.runNoise }) }, DT);
    const quiet = player({ x: 28.5 });
    run(s, { map: hall, player: quiet }, mw.rushTime);
    expect(s.mode).toBe('investigate');
    const x = s.x;
    run(s, { map: hall, player: quiet }, 1);
    expect(s.x - x).toBeLessThan(k.stalkerWalk + 0.1);
    run(s, { map: hall, player: quiet }, 12);
    expect(s.mode === 'search' || s.mode === 'patrol').toBe(true);
  });

  it('달려든 뒤에는 쉬어야 다시 달려든다', () => {
    const s = monster('maw', { x: 12.5, y: 1.5 });
    const events = [];
    let p = 18.5;
    for (let t = 0; t < mw.rushTime + mw.rushRest - 0.3; t += DT) {
      p += k.runSpeed * DT; // 달아나는 주인공
      events.push(...tickStalker(s, { map: hall, player: player({ x: Math.min(p, 28.5), noise: k.runNoise }) }, k, DT, () => 0.5));
    }
    expect(events.filter((e) => e === 'chase').length).toBe(1);
  });

  it('달려드는 첫 순간에는 닿아도 잡지 않는다', () => {
    const s = monster('maw', { x: 20.2, y: 1.5 });
    const p = player({ noise: k.walkNoise });
    expect(run(s, { map: hall, player: p }, mw.rushWarn - 0.1)).not.toContain('caught');
  });

  it('달려드는 앞에서 멈춰도 그 자리에 있으면 잡힌다', () => {
    const s = monster('maw', { x: 15.5, y: 1.5 });
    const heard = player({ noise: k.runNoise });
    run(s, { map: hall, player: heard }, DT);
    expect(run(s, { map: hall, player: player() }, 6)).toContain('caught');
  });

  it('칸 구석에 멈춰 있어도 달려든 칸이면 잡힌다', () => {
    const s = monster('maw', { x: 15.5, y: 1.5 });
    run(s, { map: hall, player: player({ noise: k.runNoise }) }, DT);
    expect(run(s, { map: hall, player: player({ x: 20.85, y: 1.2 }) }, 6)).toContain('caught');
  });

  it('달려드는 동안 옆으로 비켜서 멈추면 피한다', () => {
    const s = monster('maw', { x: 9.5, y: 1.5 });
    run(s, { map: hall, player: player({ noise: k.runNoise }) }, DT);
    expect(run(s, { map: hall, player: player({ x: 25.5 }) }, 3)).not.toContain('caught');
  });

  it('달려들지 않아도 닿으면 잡힌다', () => {
    const s = monster('maw', { x: 20.3, y: 1.5, brushT: 9, warnT: 0 });
    expect(tickStalker(s, { map: hall, player: player() }, k, DT, () => 0.5)).toContain('caught');
  });

  it('달려드는 중에 움직이면 잡힌다', () => {
    const s = monster('maw', { x: 15.5, y: 1.5 });
    const heard = player({ noise: k.runNoise });
    run(s, { map: hall, player: heard }, DT);
    expect(run(s, { map: hall, player: player({ noise: k.walkNoise }) }, 3)).toContain('caught');
  });

  it('닿기 전에는 잡지 않는다', () => {
    const s = monster('maw', { x: 20.5 - mw.touchDist - 0.2, y: 1.5, mode: 'search', searchT: 5, warnT: 0 });
    s.path = [];
    const e = tickStalker(s, { map: hall, player: player({ noise: k.walkNoise }) }, k, DT, () => 0.5);
    expect(e).not.toContain('caught');
  });

  it('소리 없이 서 있으면 처음 다가올 때는 코앞에서 멈췄다 돌아선다', () => {
    const p = player({ x: 2.5, y: 3.5 }); // 복도 끝
    const s = monster('maw', { x: 5.5, y: 3.5 });
    s.path = findPath(hall, cellOf(s), { cx: 2, cy: 3 });
    const events = run(s, { map: hall, player: p }, mw.sniffPause + 2, seeded(3));
    expect(events).toContain('sniff');
    expect(events).not.toContain('caught');
    expect(events).not.toContain('found');
  });

  it('숨어 있으면 닿아도 잡히지 않는다', () => {
    const s = monster('maw', { x: 20.3, y: 1.5, brushT: 9, warnT: 0 });
    expect(tickStalker(s, { map: hall, player: player({ hidden: 0 }) }, k, DT, () => 0.5)).not.toContain('caught');
  });

  it('쉬는 중이면 소리를 들어도 달려들지 않고 걸어온다', () => {
    const s = monster('maw', { x: 16.5, y: 1.5, rushRestT: 9, warnT: 0 });
    run(s, { map: hall, player: player({ x: s.x + 1.5, noise: k.walkNoise }) }, 0.5);
    expect(s.mode).not.toBe('chase');
  });

  it('걷는 소리는 퓨즈를 다 찾아도 멀리서 듣지 못한다. 달리는 소리만 멀어진다', () => {
    const walk = monster('maw', { x: 20.5 - mw.hearWalk - 0.5, y: 1.5 });
    expect(run(walk, { map: hall, player: player({ noise: k.walkNoise }), pressure: 1 }, DT)).not.toContain('chase');
    const far = monster('maw', { x: 20.5 - mw.hearRun - 1, y: 1.5 });
    expect(run(far, { map: hall, player: player({ noise: k.runNoise }), pressure: 1 }, DT)).toContain('chase');
  });

  it('냄새를 맡으면 바로 돌아서지 않고 잠깐 멈춘다 (도망칠 틈)', () => {
    const p = player();
    const s = monster('maw', { x: 19.5, y: 1.5 });
    s.path = findPath(hall, cellOf(s), { cx: 28, cy: 1 });
    expect(run(s, { map: hall, player: p }, DT)).toContain('sniff');
    const x = s.x;
    run(s, { map: hall, player: p }, mw.sniffPause - 0.1);
    expect(s.x).toBe(x);
    run(s, { map: hall, player: p }, 2);
    expect(s.x).toBeLessThan(x); // 주인공을 밟지 않고 돌아갔다
  });

  it('걸어서 사물함에 들어가면 옆에 있어도 안전하다', () => {
    const s = monster('maw', { x: 2.5, y: 3.5 });
    run(s, { map: hall, player: player({ x: 3.5, y: 3.5 }) }, DT);
    const hid = player({ ...center(hall.lockers[0]), hidden: 0 });
    const events = run(s, { map: hall, player: hid }, 20, seeded(2));
    expect(events).not.toContain('found');
    expect(events).not.toContain('caught');
  });

  it('달려서 사물함에 들어가는데 바로 옆이면 들킨다', () => {
    const s = monster('maw', { x: 3.5, y: 3.5, rushRestT: 9 }); // 이미 곁에 와 있다
    run(s, { map: hall, player: player({ x: 2.5, y: 3.5, noise: k.runNoise }) }, DT);
    const hid = player({ ...center(hall.lockers[0]), hidden: 0 });
    expect(run(s, { map: hall, player: hid }, DT)).toContain('found');
  });

  it('달려들기 시작한 순간에 뛰어든 사물함은 들키지 않는다', () => {
    const s = monster('maw', { x: 3.5, y: 3.5 });
    run(s, { map: hall, player: player({ x: 2.5, y: 3.5, noise: k.runNoise }) }, DT);
    const hid = player({ ...center(hall.lockers[0]), hidden: 0 });
    expect(run(s, { map: hall, player: hid }, 1, seeded(2))).not.toContain('found');
  });

  it('달려서 들어가도 멀리 있으면 안전하고, 달린 지 오래면 안전하다', () => {
    const hid = player({ ...center(hall.lockers[0]), hidden: 0 });
    const far = monster('maw', { x: 1.5 + mw.lockerNear + 2, y: 3.5 });
    run(far, { map: hall, player: player({ x: 2.5, y: 3.5, noise: k.runNoise }) }, DT);
    expect(run(far, { map: hall, player: hid }, 10, seeded(2))).not.toContain('found');
    const late = monster('maw', { x: 3.5, y: 3.5 });
    run(late, { map: hall, player: player({ x: 2.5, y: 3.5, noise: k.runNoise }) }, DT);
    run(late, { map: hall, player: player({ x: 2.5, y: 3.5 }) }, mw.lockerRun + 0.1);
    expect(run(late, { map: hall, player: hid }, 10, seeded(2))).not.toContain('found');
  });

  it('펀치를 맞으면 멈추고, 끝나면 그 자리를 코로 찾는다', () => {
    const s = monster('maw', { x: 16.5, y: 1.5, mode: 'chase', rushT: 2 });
    stunStalker(s, k);
    const x = s.x;
    run(s, { map: hall, player: player({ noise: k.runNoise }) }, k.stunTime - 0.2);
    expect(s.x).toBe(x);
    run(s, { map: hall, player: player() }, 0.4);
    expect(s.mode).toBe('search');
  });

  it('잡은 뒤에는 달려도 respawnGrace 동안 듣지도 잡지도 않는다', () => {
    const s = monster('maw');
    const p = player({ noise: k.runNoise });
    sendAway(s, hall, p);
    Object.assign(s, { x: p.x, y: p.y, path: [] });
    const events = run(s, { map: hall, player: p }, k.respawnGrace - 0.2);
    expect(events).not.toContain('caught');
    expect(events).not.toContain('chase');
  });
});

describe('호러워드', () => {
  // 두 복도 사이에 벽이 있다
  const seenAt = (o) => monster('ward', { heading: Math.PI / 2, ...o });

  it('세이노처럼 보면 쫓고, 가까우면 바로 잡는다', () => {
    const p = player({ lightOn: true });
    const s = seenAt({ x: 15.5, y: 1.5 });
    const events = run(s, { map: hall, player: p }, 4);
    expect(events).toContain('chase');
    expect(events).toContain('caught');
    expect(dist(s, p)).toBeLessThan(k.catchDist);
  });

  it('벽을 뚫고 곧장 가서 길을 돌아가는 세이노보다 먼저 온다', () => {
    const p = player({ x: 2.5, y: 1.5, lightOn: true, noise: k.walkNoise });
    const start = { x: 2.5, y: 3.5, mode: 'chase', lastSeen: { cx: 2, cy: 1 } };
    const ward = monster('ward', start);
    const seino = monster('seino', start);
    run(ward, { map: hall, player: p }, 1);
    run(seino, { map: hall, player: p }, 1);
    expect(dist(ward, p)).toBeLessThan(dist(seino, p));
    expect(ward.y).toBeLessThan(3.5);
    expect(seino.y).toBeCloseTo(3.5, 1);
  });

  it('벽에 들어가는 순간 한 번 알린다', () => {
    const s = monster('ward', { x: 15.5, y: 3.5, mode: 'chase', lastSeen: { cx: 15, cy: 1 } });
    const p = player({ x: 15.5, y: 1.5, hidden: 0 });
    const events = run(s, { map: hall, player: p }, 1.4);
    expect(events.filter((e) => e === 'wall')).toHaveLength(1);
  });

  it('쫓는 중이면 벽 속에서도 닿으면 잡고, 그냥 지나갈 때는 잡지 않는다', () => {
    const p = player({ x: 15.5, y: 1.9, hidden: null });
    const hunting = monster('ward', { x: 15.5, y: 2.3, mode: 'chase', lastSeen: { cx: 15, cy: 1 }, warnT: 0, inWall: true });
    expect(run(hunting, { map: hall, player: p }, DT)).toContain('caught');
    const passing = monster('ward', { x: 15.5, y: 2.3, heading: Math.PI, inWall: true }); // 등지고 지나간다
    expect(run(passing, { map: hall, player: p }, DT)).not.toContain('caught');
  });

  it('사물함 안은 세이노처럼 안전하고, 뒤질 때는 벽을 뚫고 간다', () => {
    const s = monster('ward', { x: 15.5, y: 1.5 });
    const p = player({ x: 1.5, y: 3.5, hidden: 0 });
    expect(run(s, { map: hall, player: p }, 2)).not.toContain('caught');
  });

  it('매복 없이 수색으로 넘어간다', () => {
    const s = monster('ward', { x: 15.5, y: 1.5, mode: 'chase', lastSeen: { cx: 15, cy: 1 }, lostT: k.loseTime });
    const p = player({ x: 25.5, y: 3.5 });
    const events = run(s, { map: hall, player: p }, DT, () => 0);
    expect(events).toContain('lost');
    expect(events).not.toContain('ambush');
    expect(s.mode).toBe('search');
  });

  it('맵 밖으로 나가지 않는다', () => {
    const rand = seeded(9);
    const map = withOpen(factoryMap, []);
    const s = createStalker(map, k, rand, 'ward');
    const p = { ...center(map.start), hidden: 0, lightOn: false, noise: 0 };
    for (let t = 0; t < 120; t += DT) {
      tickStalker(s, { map, player: p }, k, DT, rand);
      expect(s.x > 0 && s.y > 0 && s.x < map.w && s.y < map.h).toBe(true);
    }
  });
});

describe('공정함: 진짜 맵에서 마구 움직여도', () => {
  // 주인공이 무작위로 돌아다니는 동안 잡힘 앞에는 늘 경고가 있다
  const wander = (monsterId, seed) => {
    const rand = seeded(seed);
    const map = withOpen(factoryMap, factoryMap.locks.map((_, i) => i));
    const s = createStalker(map, k, rand, monsterId);
    const p = { ...center(map.start), hidden: null, lightOn: true, noise: k.walkNoise };
    let dir = { x: 1, y: 0 };
    let warnedAt = -Infinity;
    let graceUntil = 0;
    let bad = 0;
    let catches = 0;
    for (let t = 0; t < 300; t += DT) {
      if (rand() < 0.02) {
        const a = rand() * Math.PI * 2;
        dir = { x: Math.cos(a), y: Math.sin(a) };
        p.noise = rand() < 0.3 ? k.runNoise : k.walkNoise;
      }
      const speed = p.noise === k.runNoise ? k.runSpeed : k.walkSpeed;
      const nx = p.x + dir.x * speed * DT;
      const ny = p.y + dir.y * speed * DT;
      if (!blocked(map, Math.floor(nx), Math.floor(ny))) Object.assign(p, { x: nx, y: ny });
      const seen = rand() < 0.3 && inPlayerView(p, Math.atan2(-(s.x - p.x), -(s.y - p.y)), s, map, k);
      const e = tickStalker(s, { map, player: p, seen, pressure: t / 300 }, k, DT, rand);
      if (e.includes('chase')) warnedAt = t;
      if (e.includes('caught')) {
        catches += 1;
        if (t < graceUntil) bad += 1;
        if (t - warnedAt < 0.5 && monsterId === 'maw') bad += 1; // 달려드는 경고가 있어야 한다
        sendAway(s, map, p, rand);
        graceUntil = t + k.respawnGrace - 0.1;
      }
    }
    return { bad, catches };
  };

  it.each(['gazer', 'maw', 'ward'])('%s 는 경고와 쉬는 시간을 지킨다', (id) => {
    const games = Array.from({ length: 12 }, (_, i) => wander(id, i + 1));
    expect(games.reduce((a, g) => a + g.bad, 0)).toBe(0);
    expect(games.reduce((a, g) => a + g.catches, 0)).toBeGreaterThan(0); // 정말 잡는 판을 지나왔다
  });

  it('눈뜬이는 빨라진 뒤 chaseWarn 이 지나야 잡는다 (진짜 맵)', () => {
    const rand = seeded(5);
    const map = withOpen(factoryMap, factoryMap.locks.map((_, i) => i));
    const s = createStalker(map, k, rand, 'gazer');
    const c = center(map.start);
    const p = { x: c.x, y: c.y, hidden: null, lightOn: true, noise: 0 };
    let fast = null;
    for (let t = 0; t < 200; t += DT) {
      const e = tickStalker(s, { map, player: p, seen: false }, k, DT, rand);
      if (s.mode === 'chase' && fast === null) fast = t;
      if (e.includes('caught')) {
        expect(t - fast).toBeGreaterThanOrEqual(gz.chaseWarn);
        return;
      }
    }
    throw new Error('잡지 못했다');
  });
});
