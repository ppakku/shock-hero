import { describe, it, expect } from 'vitest';
import { reachable, blocked, findPath, cellOf, center, withOpen } from '../src/logic/horrorGrid.js';
import { createRun, takeFuse, takeKey, openDoor, insertFuses, takeClue, nearestUse } from '../src/logic/horrorRun.js';
import { createStalker, tickStalker } from '../src/logic/horrorStalker.js';
import { createAids, takeAid, useAid, seeBoard, addMark, addAidTargets, seenBoardNear, makeSound, stepSounds, throwSpot, compassGoal, compassYaw, AID_KINDS } from '../src/logic/horrorAids.js';
import { ALL_MAPS } from '../src/horror/content.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const a = k.aids;

function seeded(seed) {
  let x = seed * 2654435761 + 1;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

const roundOn = (id, seed = 1) => {
  const rand = seeded(seed);
  const run = createRun(ALL_MAPS[id].map, k, rand);
  const taken = [...run.fuses, ...run.keys, ...run.clues, ...run.level.notes];
  return { run, aids: createAids(run.level, a, rand, taken) };
};

describe('도움 아이템 놓기', () => {
  for (const id of Object.keys(ALL_MAPS)) {
    it(`${id}: 정한 수만큼 열쇠 없이 갈 수 있는 빈 칸에 겹치지 않게 놓는다`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { run, aids } = roundOn(id, seed);
        const area = reachable(run.level, run.level.start);
        const total = Object.values(a.count).reduce((x, y) => x + y, 0);
        expect(aids.items).toHaveLength(total);
        expect(aids.boards).toHaveLength(a.boards);
        for (const kind of AID_KINDS) expect(aids.items.filter((i) => i.kind === kind)).toHaveLength(a.count[kind]);
        const cells = [...aids.items, ...aids.boards];
        const busy = [...run.fuses, ...run.keys, ...run.clues];
        expect(new Set(cells.map((c) => `${c.cx},${c.cy}`)).size).toBe(cells.length);
        for (const c of cells) {
          expect(area.has(`${c.cx},${c.cy}`)).toBe(true);
          expect(busy.some((b) => b.cx === c.cx && b.cy === c.cy)).toBe(false);
        }
        // 사물함, 충전 상자, 전원, 정문, 잠긴 문 옆에는 놓지 않는다
        for (const c of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect('LEPGAB').not.toContain(run.level.rows[c.cy + dy][c.cx + dx]);
        // 지도는 평범한 벽에 붙는다
        for (const b of aids.boards) expect(run.level.rows[b.cy + b.dy][b.cx + b.dx]).toBe('#');
      }
    });
  }

  it('벽 지도는 서로 떨어져 있다', () => {
    const { aids } = roundOn('school', 3);
    const [p, q, r] = aids.boards;
    for (const [x, y] of [[p, q], [q, r], [p, r]]) expect(Math.hypot(x.cx - y.cx, x.cy - y.cy)).toBeGreaterThan(6);
  });
});

describe('줍기와 쓰기', () => {
  it('주운 만큼만 쓰고, 분필은 한 자루에 여러 번이다', () => {
    const { aids } = roundOn('school');
    const flare = aids.items.findIndex((i) => i.kind === 'flare');
    const chalk = aids.items.findIndex((i) => i.kind === 'chalk');
    expect(useAid(aids, 'flare')).toBe(false);
    expect(takeAid(aids, flare, a)).toBe(true);
    expect(takeAid(aids, flare, a)).toBe(false);
    expect(useAid(aids, 'flare')).toBe(true);
    expect(useAid(aids, 'flare')).toBe(false);
    takeAid(aids, chalk, a);
    expect(aids.held.chalk).toBe(a.chalkUses);
  });

  it('벽 지도는 한 장에 한 번만 본다', () => {
    const { aids } = roundOn('school');
    expect(seeBoard(aids, 0)).toBe(true);
    expect(seeBoard(aids, 0)).toBe(false);
    const seen = [];
    addAidTargets(aids, (kind, i, label) => seen.push({ kind, i, label }));
    expect(seen.filter((s) => s.kind === 'board').map((s) => s.i)).not.toContain(0); // 본 지도는 E 를 가로채지 않는다
    expect(seen.filter((s) => s.kind === 'board')).toHaveLength(a.boards - 1);
    expect(seenBoardNear(aids, center(aids.boards[0]), k.useRange).label).toBe('이 지도는 이미 봤다');
    expect(seenBoardNear(aids, center(aids.boards[1]), k.useRange)).toBeNull();
  });

  it('nearestUse 가 가까운 아이템을 고른다', () => {
    const { run, aids } = roundOn('school');
    const item = aids.items[0];
    const t = nearestUse(run, run.level, center(item), null, k, undefined, (add) => addAidTargets(aids, add));
    expect(t).toMatchObject({ kind: 'aid', index: 0 });
  });

  it('분필은 같은 칸에 다시 그리면 방향만 바뀐다', () => {
    const { aids } = roundOn('school');
    addMark(aids, { cx: 3, cy: 4 }, 0);
    addMark(aids, { cx: 3, cy: 4 }, 1);
    addMark(aids, { cx: 5, cy: 4 }, 2);
    expect(aids.marks).toEqual([{ cx: 3, cy: 4, yaw: 1 }, { cx: 5, cy: 4, yaw: 2 }]);
  });
});

describe('장난감 던지기', () => {
  it('벽 앞에 떨어지고 벽을 넘지 않는다', () => {
    const { run } = roundOn('school');
    const map = run.level;
    const p = center(map.start);
    for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.3) {
      const c = throwSpot(map, p, yaw, a.toyRange);
      expect(blocked(map, c.cx, c.cy)).toBe(false);
      expect(Math.hypot(c.cx + 0.5 - p.x, c.cy + 0.5 - p.y)).toBeLessThanOrEqual(a.toyRange + 1);
    }
  });
});

describe('나침반', () => {
  it('처음에는 길로 가장 가까운 퓨즈, 열쇠, 단서 중 하나를 가리킨다', () => {
    const { run } = roundOn('school');
    const p = center(run.level.start);
    const g = compassGoal(run, k, p);
    expect(['퓨즈', '빨간 열쇠', '붉은 쪽지']).toContain(g.name);
    expect(g.path.length).toBeGreaterThan(0);
  });

  it('전원을 켜고 단서를 다 읽으면 정문을 가리킨다', () => {
    const { run } = roundOn('school');
    run.fuses.forEach((_, i) => takeFuse(run, i));
    run.keys.forEach((_, i) => { takeKey(run, i); openDoor(run, i); });
    run.clues.forEach((_, i) => takeClue(run, i));
    insertFuses(run, k);
    const g = compassGoal(run, k, center(run.level.start));
    expect(g.name).toBe('정문');
  });

  it('열쇠를 가졌으면 그 문을 가리킬 수 있다', () => {
    const { run } = roundOn('school');
    run.fuses.forEach((f, i) => takeFuse(run, i));
    run.clues.forEach((_, i) => takeClue(run, i));
    takeKey(run, 0);
    run.have = 0; // 전원은 빼고 문만 남긴다
    const g = compassGoal(run, k, center(run.level.start));
    expect(['빨간 문', '파란 열쇠']).toContain(g.name);
  });

  it('화살표는 걸어갈 첫 칸 쪽을 본다', () => {
    const map = withOpen(ALL_MAPS.school.map);
    const p = center(map.start);
    const to = { cx: map.start.cx, cy: map.start.cy - 3 };
    const path = findPath(map, cellOf(p), to);
    const yaw = compassYaw(map, p, path, a.compassAhead);
    expect(-Math.sin(yaw)).toBeCloseTo(0, 5); // 위로 곧장 (앞이 -y)
    expect(-Math.cos(yaw)).toBeLessThan(0);
  });
});

describe('괴물이 아이템 소리를 듣는다', () => {
  const quiet = (p) => ({ ...p, hidden: null, lightOn: false, noise: 0 });

  it('세이노는 조명탄 소리 쪽으로 조사하러 오고, 같은 소리는 한 번만 듣는다', () => {
    const { run, aids } = roundOn('school');
    const map = run.level;
    const s = createStalker(map, k, seeded(2));
    const spot = { cx: Math.floor(s.x) + 3, cy: Math.floor(s.y) };
    makeSound(aids, blocked(map, spot.cx, spot.cy) ? cellOf(s) : spot, a.flareNoise, 0.1, false);
    const far = quiet(center(map.start));
    const ev = tickStalker(s, { map, player: far, seen: false, pressure: 0, sounds: aids.sounds }, k, 1 / 30, seeded(3));
    expect(s.mode).toBe('investigate');
    expect(ev).toContain('notice');
    expect(s.soundId).toBe(1);
    stepSounds(aids, 1);
    expect(aids.sounds).toHaveLength(0);
  });

  it('쫓던 세이노는 조명탄으로는 안 돌아서고 장난감으로는 돌아선다', () => {
    const { run, aids } = roundOn('school');
    const map = run.level;
    const s = createStalker(map, k, seeded(2));
    s.mode = 'chase';
    const far = quiet(center(map.start));
    const here = findPath(map, cellOf(s), map.start)[4]; // 몇 칸 떨어진 곳
    makeSound(aids, here, 99, 1, false);
    tickStalker(s, { map, player: far, seen: false, pressure: 0, sounds: aids.sounds }, k, 1 / 30, seeded(3));
    expect(s.mode).toBe('chase');
    makeSound(aids, here, 99, 1, true);
    tickStalker(s, { map, player: far, seen: false, pressure: 0, sounds: aids.sounds }, k, 1 / 30, seeded(3));
    expect(s.mode).toBe('investigate');
  });

  it('멀리 있는 소리는 듣지 못한다', () => {
    const { run, aids } = roundOn('school');
    const map = run.level;
    const s = createStalker(map, k, seeded(2));
    makeSound(aids, map.start, 1, 1, true);
    tickStalker(s, { map, player: quiet(center(map.start)), seen: false, pressure: 0, sounds: aids.sounds }, k, 1 / 30, seeded(3));
    expect(s.mode).toBe('patrol');
  });

  it('큰입이는 장난감 쪽으로 달려가되 알림 글은 없다', () => {
    const { run, aids } = roundOn('school');
    const map = run.level;
    const s = createStalker(map, k, seeded(2), 'maw');
    makeSound(aids, cellOf(s), 99, 1, true);
    const ev = tickStalker(s, { map, player: quiet(center(map.start)), seen: false, pressure: 0, sounds: aids.sounds }, k, 1 / 30, seeded(3));
    expect(['chase', 'investigate', 'search']).toContain(s.mode);
    expect(ev).not.toContain('chase');
  });

  it('눈뜬이는 장난감에만 잠깐 끌려간다', () => {
    const { run, aids } = roundOn('school');
    const map = run.level;
    const s = createStalker(map, k, seeded(2), 'gazer');
    makeSound(aids, cellOf(s), 99, 1, false);
    tickStalker(s, { map, player: quiet(center(map.start)), seen: false, pressure: 0, sounds: aids.sounds }, k, 1 / 30, seeded(3));
    expect(s.repathT).toBeLessThan(a.gazerLure);
    makeSound(aids, cellOf(s), 99, 1, true);
    tickStalker(s, { map, player: quiet(center(map.start)), seen: false, pressure: 0, sounds: aids.sounds }, k, 0, seeded(3));
    expect(s.repathT).toBeCloseTo(a.gazerLure);
  });
});
