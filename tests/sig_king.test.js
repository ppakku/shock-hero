import { describe, expect, it, vi } from 'vitest';
import { behindSpot, boltSpots, fireRows, mixPlan, needsSignature, zoneAround } from '../src/logic/sig_king.js';
import { stages } from '../src/stage/index.js';
import { SIGNATURES } from '../src/boss/signatures/index.js';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {}, Intersects: {} } } }));

const HERO = 40; // 주인공 몸 너비 (대략)

describe('킹 전용 공격 계산', () => {
  it('등 뒤 자리는 바라보는 반대쪽이고 벽이면 앞으로 나온다', () => {
    expect(behindSpot(500, 1, 70, 100, 900)).toBe(430);
    expect(behindSpot(500, -1, 70, 100, 900)).toBe(570);
    expect(behindSpot(120, 1, 70, 100, 900)).toBe(190);
    expect(behindSpot(880, -1, 70, 100, 900)).toBe(810);
  });

  it('구역은 싸움터를 넘지 않고 번개는 구역 안에 떨어진다', () => {
    const z = zoneAround(150, 130, 100, 900);
    expect(z).toEqual({ x0: 100, w: 180 });
    expect(zoneAround(850, 130, 100, 900)).toEqual({ x0: 720, w: 180 });
    for (const x of boltSpots(z, 5)) {
      expect(x).toBeGreaterThan(z.x0);
      expect(x).toBeLessThan(z.x0 + z.w);
    }
  });

  it('불기둥은 앞에서부터 차례로 터지고 사이에 주인공이 설 빈틈이 있다', () => {
    const rows = fireRows(800, 100, { gap: 180, warn: 1, step: 0.16, rest: 0.3 });
    expect(rows.map((p) => p.x)).toEqual([800, 625, 450, 275, 100]);
    expect(rows.map((p) => p.at)).toEqual([1, 1.16, 1.32, 1.48, 1.64].map((v) => expect.closeTo(v)));
    for (const p of rows) expect(p.warnAt).toBeLessThan(p.at);
    expect(175 - 90).toBeGreaterThan(HERO);
  });

  it('둘째 줄은 첫 줄이 다 터진 뒤 경고가 나오고 빈틈에 선다', () => {
    const list = fireRows(100, 800, { rows: 2, gap: 180, warn: 1, step: 0.16, rest: 0.3 });
    const first = list.filter((p) => p.warnAt === 0);
    const second = list.filter((p) => p.warnAt > 0);
    expect(second.length).toBeGreaterThan(0);
    expect(Math.min(...second.map((p) => p.warnAt))).toBeGreaterThan(Math.max(...first.map((p) => p.at)));
    for (const p of second) {
      expect(first.some((q) => q.x === p.x)).toBe(false);
      expect(p.x).toBeLessThanOrEqual(800);
    }
  });

  it('마지막 공격에는 낙뢰, 얼음 가시, 포자가 모두 나온다', () => {
    for (const r of [0, 0.4, 0.99]) {
      const plan = mixPlan(6, 0.6, () => r);
      expect(new Set(plan.map((h) => h.kind))).toEqual(new Set(['bolt', 'spike', 'spore']));
      expect(plan[1].at).toBeCloseTo(0.6);
    }
  });

  it('아직 안 쓴 전용 공격만 꼭 내보낸다', () => {
    expect(needsSignature(['leap', 'signature'], new Set(), 'hellfire')).toBe(true);
    expect(needsSignature(['leap', 'signature'], new Set(['hellfire']), 'hellfire')).toBe(false);
    expect(needsSignature(['leap'], new Set(), 'hellfire')).toBe(false);
    expect(needsSignature(['signature'], new Set(), undefined)).toBe(false);
  });
});

describe('킹 변종 스테이지', () => {
  const want = { 15: 'phantomStep', 20: 'phantomStep', 25: 'stormLance', 30: 'stormLance', 37: 'hellfire', 40: 'hellfire' };

  it('앉은 단계마다, 일어선 단계에도 전용 공격이 있다', () => {
    for (const [n, name] of Object.entries(want)) {
      const b = stages[n - 1].boss;
      expect(b.signature, n).toBe(name);
      for (const list of [...b.phases, b.finalPhase]) expect(list, n).toContain('signature');
    }
  });

  it('스테이지 40 은 일어서면 마지막 공격을 쓴다', () => {
    const name = stages[39].boss.finalSignature;
    expect(name).toBe('finalMix');
    expect(SIGNATURES[name]).toBeTruthy();
  });

  it('전용 공격마다 안내문이 있다', () => {
    for (const name of ['phantomStep', 'stormLance', 'hellfire', 'finalMix']) expect(SIGNATURES[name].tip, name).toBeTruthy();
  });
});
