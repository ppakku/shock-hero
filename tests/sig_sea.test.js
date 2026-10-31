import { describe, expect, it, vi } from 'vitest';
import { inLane, laneAngle, ringArcs, ringHits, ringReach, scatterLures } from '../src/logic/sig_sea.js';
import { seaPhaseIndex, seaUsableAttacks } from '../src/logic/swim.js';
import { pickPattern } from '../src/logic/boss.js';
import { SIGNATURES } from '../src/boss/signatures/index.js';
import { stages } from '../src/stage/index.js';
import { balance } from '../src/config/balance.js';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {}, Intersects: {} } } }));

const bounds = { minX: 0, maxX: 960, minY: 170, maxY: 440 };

describe('전기 고리', () => {
  it('틈은 헤엄칠 수 있는 곳을 지난다', () => {
    // 보스 바로 아래 바닥에 있는 주인공: 돌린 방향이 바닥 밑이어도 물속 자리로 잡는다
    for (const swing of [-0.6, 0.6]) {
      const a = laneAngle(480, 220, 480, 440, swing, bounds);
      const y = 220 + Math.sin(a) * 200;
      expect(y).toBeLessThanOrEqual(440);
      expect(y).toBeGreaterThanOrEqual(170);
    }
  });

  it('주인공이 그대로 있으면 틈 밖이라 움직여야 한다', () => {
    const a = laneAngle(200, 250, 600, 250, 0.6, bounds);
    expect(inLane(600, 250, 200, 250, a, 65)).toBe(false);
  });

  it('틈 안에 있으면 고리가 지나가도 안 맞고 밖이면 맞는다', () => {
    const gaps = [0];
    expect(ringHits(300, 40, 0, 0, 300, 26, gaps, 65)).toBe(false);
    expect(ringHits(300, 90, 0, 0, 313, 26, gaps, 65)).toBe(true);
    expect(ringHits(-300, 0, 0, 0, 300, 26, gaps, 65)).toBe(true);
    expect(ringHits(100, 0, 0, 0, 300, 26, [Math.PI], 65)).toBe(false); // 고리가 아직 멀다
  });

  it('고리 조각은 틈만큼 비어 있다', () => {
    const [[from, to]] = ringArcs(200, [0], 50);
    const h = Math.asin(50 / 200);
    expect(from).toBeCloseTo(h);
    expect(to).toBeCloseTo(Math.PI * 2 - h);
  });

  it('틈이 둘이면 조각도 둘, 겹치면 하나', () => {
    expect(ringArcs(200, [0, Math.PI], 50)).toHaveLength(2);
    expect(ringArcs(200, [0, 0.01], 50)).toHaveLength(1);
  });

  it('고리는 싸움터 끝까지 지나간다', () => {
    expect(ringReach(100, 200, bounds)).toBeGreaterThan(860);
  });

  it('피할 시간이 있다: 고리가 닿기 전에 틈까지 갈 수 있다', () => {
    const { ringWarningTime, ringSpeed, ringLaneWidth } = balance.seaBoss;
    const swim = 208;
    for (const d of [200, 400, 700]) {
      const need = Math.max(0, d * 0.6 - ringLaneWidth / 2);
      const have = ringWarningTime * 0.5 + (d - 80) / ringSpeed; // 분노한 어려운 보스의 박자로 어림
      expect(need / swim).toBeLessThan(have);
    }
  });
});

describe('가짜 미끼', () => {
  it('주인공과 진짜 불빛에서 떨어져 나온다', () => {
    const keep = [{ x: 300, y: 300 }, { x: 700, y: 260 }];
    const lures = scatterLures(4, keep, bounds, 150);
    expect(lures).toHaveLength(4);
    for (const l of lures) {
      for (const k of keep) expect(Math.hypot(l.x - k.x, l.y - k.y)).toBeGreaterThanOrEqual(150);
      expect(l.y).toBeGreaterThanOrEqual(170);
      expect(l.y).toBeLessThanOrEqual(440);
    }
  });

  it('자리가 없어도 개수만큼 나온다', () => {
    expect(scatterLures(3, [{ x: 5, y: 5 }], { minX: 0, maxX: 10, minY: 0, maxY: 10 }, 500)).toHaveLength(3);
  });

  it('불이 붙으면 터지기 전에 범위 밖으로 달아날 수 있다', () => {
    const { fakeTrigger, fakeFuse, fakeBlast } = balance.seaBoss;
    expect(fakeFuse * 208).toBeGreaterThan(fakeBlast - fakeTrigger + 30);
  });
});

describe('sea 변종 스테이지', () => {
  const want = { 16: ['ray', 'shockRings'], 26: ['ray', 'shockRings'], 36: ['abyss', 'blackout'] };
  for (const [n, [skin, name]] of Object.entries(want)) {
    it(`${n}: 부위가 몇 개 남든 전용 공격을 고를 수 있다`, () => {
      const b = stages[n - 1].boss;
      expect(b.skin).toBe(skin);
      expect(b.signature).toBe(name);
      expect(SIGNATURES[name].tip).toBeTruthy();
      for (const alive of [2, 1, 0]) {
        const list = b.phases[seaPhaseIndex(alive, 2)];
        expect(list).toHaveLength(5);
        for (const lure of [true, false]) expect(seaUsableAttacks(list, lure)).toContain('signature');
      }
    });
  }

  it('공격 고르는 코드가 signature 를 고른다', () => {
    expect(pickPattern(seaUsableAttacks(['signature'], false), 'signature', () => 0, 'charge')).toBe('signature');
  });
});
