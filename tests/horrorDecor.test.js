import { describe, it, expect } from 'vitest';
import { decorSpots, emergencyGlow } from '../src/logic/horrorDecor.js';
import { blocked, reachable, CELL } from '../src/logic/horrorGrid.js';
import { factoryMap as map } from '../src/horror/maps/factory.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const spots = decorSpots(map);
const all = [...spots.machines, ...spots.lights, ...spots.pipes];

describe('공장 꾸밀 자리', () => {
  it('여러 방에 고루 놓는다', () => {
    const room = (f) => `${Math.floor(f.cx / 7)},${Math.floor(f.cy / 6)}`;
    expect(new Set(spots.lights.map(room)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(spots.machines.map(room)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(spots.pipes.map(room)).size).toBeGreaterThanOrEqual(4);
  });

  it('항상 진짜 벽에 붙는다', () => {
    for (const f of all) {
      expect(blocked(map, f.cx, f.cy)).toBe(false);
      expect(map.rows[f.cy + f.dy][f.cx + f.dx]).toBe('#');
    }
  });

  it('사물함, 전기 상자, 전원, 정문, 문 둘레는 비운다', () => {
    const kept = new Set(['L', 'E', 'P', 'G', 'D']);
    for (const f of [...spots.machines, ...spots.lights]) {
      for (let y = f.cy - 1; y <= f.cy + 1; y++) {
        for (let x = f.cx - 1; x <= f.cx + 1; x++) expect(kept.has(map.rows[y][x]), `${x},${y}`).toBe(false);
      }
    }
  });

  it('맵을 바꾸지 않고 항상 같은 자리다', () => {
    const before = reachable(map, map.start).size;
    expect(decorSpots(map)).toEqual(spots);
    expect(reachable(map, map.start).size).toBe(before);
  });

  it('기계는 주인공 몸이 닿는 곳까지 나오지 않는다', () => {
    expect(k.machineDepth).toBeLessThan(0.2 * CELL); // HorrorGame 의 RADIUS 는 0.2 칸
  });
});

describe('비상등 밝기', () => {
  it('효과 줄이기면 어둡게 멈춰 있다', () => {
    const levels = new Set();
    for (let t = 0; t < 60; t += 0.03) levels.add(emergencyGlow(t, true, k));
    expect([...levels]).toEqual([k.emergencyLow]);
    expect(k.emergencyLow).toBeLessThan(k.emergencyHigh);
  });

  it('평소에는 범위 안에서 깜빡이고, 1초에 세 번을 넘지 않는다', () => {
    const dt = 1 / 120;
    const drops = [];
    let last = emergencyGlow(0, false, k);
    let lowest = 1;
    for (let t = dt; t < 120; t += dt) {
      const v = emergencyGlow(t, false, k);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(k.emergencyHigh);
      if (v < last * 0.5) drops.push(t);
      lowest = Math.min(lowest, v);
      last = v;
    }
    expect(drops.length).toBeGreaterThan(5); // 정말 깜빡인다
    expect(lowest).toBeLessThan(k.emergencyHigh * 0.4);
    for (const t of drops) expect(drops.filter((d) => d >= t && d < t + 1).length).toBeLessThanOrEqual(3);
  });
});
