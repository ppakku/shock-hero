import { describe, it, expect } from 'vitest';
import { createStalker, seesPlayer, tickStalker, stunStalker, sendAway, heartInterval } from '../src/logic/horrorStalker.js';
import { parseMap, blocked } from '../src/logic/horrorGrid.js';
import { factoryMap } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const hall = parseMap([
  '##############',
  '#M..........R#',
  '#.##########.#',
  '#L..........R#',
  '##############',
]);
const player = (o) => ({ x: 8.5, y: 1.5, hidden: null, lightOn: false, noise: 0, ...o });
const run = (s, world, seconds, rand = () => 0.5) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...tickStalker(s, world, k, 0.05, rand));
  return events;
};
const facing = (o) => ({ ...createStalker(hall), heading: Math.PI / 2, ...o }); // x 가 커지는 쪽을 본다

describe('보기', () => {
  it('어두우면 가까이서만 본다', () => {
    const s = facing({ x: 1.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 3.5 }), hall, k)).toBe(true);
    expect(seesPlayer(s, player({ x: 8.5 }), hall, k)).toBe(false);
  });

  it('손전등을 켜면 멀리서 보인다', () => {
    const s = facing({ x: 1.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 8.5, lightOn: true }), hall, k)).toBe(true);
  });

  it('뒤쪽, 벽 너머, 사물함 안은 못 본다', () => {
    const s = facing({ x: 5.5, y: 1.5 });
    expect(seesPlayer(s, player({ x: 3.5 }), hall, k)).toBe(false);
    expect(seesPlayer(s, player({ x: 5.5, y: 3.5 }), hall, k)).toBe(false);
    expect(seesPlayer(s, player({ x: 6.5, hidden: 0 }), hall, k)).toBe(false);
  });
});

describe('상태 변화', () => {
  it('아무 일이 없으면 순찰 지점을 돈다', () => {
    const s = createStalker(hall);
    const x0 = s.x;
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5 }) }, 3);
    expect(s.mode).toBe('patrol');
    expect(Math.hypot(s.x - x0, s.y - 1.5)).toBeGreaterThan(1);
  });

  it('소리를 들으면 조사하러 간다', () => {
    const s = facing({ x: 6.5, y: 1.5 }); // 돌아봐도 안 보일 만큼 멀리 있어야 조사에 머문다
    const events = run(s, { map: hall, player: player({ x: 1.5, y: 1.5, noise: 6 }) }, 0.1);
    expect(events).toContain('notice');
    expect(s.mode).toBe('investigate');
  });

  it('보면 쫓고 잡는다', () => {
    const s = facing({ x: 6.5, y: 1.5 });
    const events = run(s, { map: hall, player: player() }, 4);
    expect(events).toContain('chase');
    expect(events).toContain('caught');
  });

  it('놓치면 수색을 하고, 시간이 지나면 순찰로 돌아간다', () => {
    const s = facing({ x: 6.5, y: 1.5 });
    const world = { map: hall, player: player({ x: 8.5 }) };
    run(s, world, 0.1);
    world.player = player({ x: 3.5, y: 3.5, hidden: null });
    const events = run(s, world, k.loseTime + 0.3);
    expect(events).toContain('lost');
    expect(s.mode).toBe('search');
    run(s, world, k.searchTime + 1);
    expect(s.mode).toBe('patrol');
  });

  it('수색 중 숨은 사물함을 뒤지면 들킨다', () => {
    const s = facing({ x: 2.5, y: 3.5, mode: 'chase', lastSeen: { cx: 2, cy: 3 } });
    const world = { map: hall, player: player({ x: 1.5, y: 3.5, hidden: 0 }) };
    const events = run(s, world, k.loseTime + 3, () => 0.1);
    expect(events).toContain('locker');
    expect(events).toContain('found');
  });

  it('사물함을 뒤지지 않으면 들키지 않는다', () => {
    const s = facing({ x: 2.5, y: 3.5, mode: 'chase', lastSeen: { cx: 2, cy: 3 } });
    const world = { map: hall, player: player({ x: 1.5, y: 3.5, hidden: 0 }) };
    expect(run(s, world, k.loseTime + 3, () => 0.9)).not.toContain('found');
  });

  it('쇼크 펀치를 맞으면 멈췄다가 수색한다', () => {
    const s = facing({ x: 6.5, y: 1.5, mode: 'chase' });
    stunStalker(s, k);
    const x = s.x;
    run(s, { map: hall, player: player({ x: 7.2 }) }, k.stunTime - 0.2);
    expect(s.mode).toBe('stunned');
    expect(s.x).toBe(x);
    run(s, { map: hall, player: player({ x: 1.5, y: 3.5 }) }, 0.5);
    expect(s.mode).toBe('search');
  });

  it('맵 위에서 오래 돌아도 벽 안으로 들어가지 않는다', () => {
    const s = createStalker(factoryMap);
    let n = 0;
    const rand = () => {
      n = (n * 9301 + 49297) % 233280;
      return n / 233280;
    };
    const world = { map: factoryMap, player: { x: 2.5, y: 16.5, hidden: null, lightOn: true, noise: 9 } };
    for (let t = 0; t < 300; t += 0.05) {
      tickStalker(s, world, k, 0.05, rand);
      expect(blocked(factoryMap, Math.floor(s.x), Math.floor(s.y))).toBe(false);
      world.player.x = 2.5 + (t % 3);
    }
  });
});

describe('잡힌 뒤', () => {
  it('주인공에게서 가장 먼 순찰 지점으로 옮긴다', () => {
    const s = createStalker(factoryMap);
    s.mode = 'chase';
    sendAway(s, factoryMap, { x: 2.5, y: 16.5 });
    expect(s.mode).toBe('patrol');
    expect(Math.hypot(s.x - 2.5, s.y - 16.5)).toBeGreaterThan(15);
  });
});

describe('심장 소리', () => {
  it('가까울수록 빨라진다', () => {
    expect(heartInterval(1)).toBeLessThan(heartInterval(10));
    expect(heartInterval(100)).toBeNull();
  });
});
