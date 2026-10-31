import { describe, it, expect } from 'vitest';
import { hitStopMs, HIT_STOP_MS, landedStop, particleBudget, emitCount, surfaceBelow, shadowShape, foregroundAlpha, ultAuraOn, auraPulse, auraFlame } from '../src/fx/fxLogic.js';
import { createSaveStore, defaultSave } from '../src/logic/save.js';

describe('멈칫 (히트 스톱)', () => {
  it('맞은 공격은 40~90ms 멈춘다', () => {
    for (const kind of Object.keys(HIT_STOP_MS)) {
      const ms = hitStopMs(kind);
      expect(ms).toBeGreaterThanOrEqual(40);
      expect(ms).toBeLessThanOrEqual(90);
    }
    expect(hitStopMs('없는 공격')).toBe(0);
  });

  it('약할수록 짧게 멈추고, 최대 충전은 따로 처리한다', () => {
    expect(landedStop({ kind: 'punch' })).toBe('punch');
    expect(landedStop({ kind: 'charged' })).toBe('chargedSmall');
    expect(landedStop({ kind: 'charged', full: true })).toBe(null);
    expect(HIT_STOP_MS.punch).toBeLessThan(HIT_STOP_MS.chargedSmall);
    expect(HIT_STOP_MS.chargedSmall).toBeLessThan(HIT_STOP_MS.charged);
  });

  it('효과 줄이기면 멈추지 않는다', () => {
    expect(hitStopMs('ultimate', true)).toBe(0);
    expect(hitStopMs('charged', true)).toBe(0);
  });
});

describe('불꽃 알갱이 수', () => {
  it('효과 줄이기면 3분의 1, 언제나 상한을 넘지 않는다', () => {
    expect(particleBudget(30, false, 40)).toBe(30);
    expect(particleBudget(30, true, 40)).toBe(10);
    expect(particleBudget(500, false, 40)).toBe(40);
    expect(particleBudget(-5)).toBe(0);
  });

  it('초당 개수를 프레임마다 나눠 뿌리고, 오래 멈춰도 한꺼번에 쏟아지지 않는다', () => {
    const st = { acc: 0 };
    let total = 0;
    for (let i = 0; i < 60; i++) total += emitCount(st, 120, 1 / 60);
    expect(total).toBeGreaterThanOrEqual(119);
    expect(total).toBeLessThanOrEqual(120);
    const st2 = { acc: 0 };
    expect(emitCount(st2, 300, 5, 8)).toBe(8);
    expect(st2.acc).toBe(0);
  });
});

describe('발밑 그림자', () => {
  const plats = [{ x: 500, y: 400, w: 128 }];
  it('발 아래 발판이 있으면 발판 위, 없으면 땅', () => {
    expect(surfaceBelow(500, 380, plats, 480)).toBe(400);
    expect(surfaceBelow(700, 380, plats, 480)).toBe(480);
    expect(surfaceBelow(500, 450, plats, 480)).toBe(480); // 발판보다 아래에 있으면 땅
  });

  it('높이 뛸수록 작고 흐려진다', () => {
    const ground = shadowShape(0);
    const high = shadowShape(200);
    expect(high.scale).toBeLessThan(ground.scale);
    expect(high.alpha).toBeLessThan(ground.alpha);
    expect(shadowShape(9999).scale).toBeGreaterThan(0.3);
  });
});

describe('앞쪽 실루엣', () => {
  it('키 큰 조각은 화면 가운데에서 사라지고 가장자리에서만 보인다', () => {
    expect(foregroundAlpha(480, 960, true)).toBeLessThan(0.01);
    expect(foregroundAlpha(0, 960, true)).toBeGreaterThan(0.5);
    expect(foregroundAlpha(0, 960, true)).toBeLessThanOrEqual(0.62);
  });

  it('낮은 조각은 늘 반투명하게 보인다', () => {
    const mid = foregroundAlpha(480, 960, false);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
  });
});

describe('효과 줄이기 설정', () => {
  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  }

  it('처음에는 꺼져 있고, 켜면 저장된다', () => {
    expect(defaultSave().settings.lowFx).toBe(false);
    const store = createSaveStore(memoryStorage());
    expect(store.load().settings.lowFx).toBe(false);
    store.update({ settings: { ...store.load().settings, lowFx: true } });
    expect(store.load().settings.lowFx).toBe(true);
    expect(store.load().settings.shake).toBe(true); // 흔들림 설정은 따로 남는다
  });

  it('예전 저장이나 이상한 값이면 꺼짐', () => {
    const storage = memoryStorage();
    storage.setItem('shock-hero-save-v1', JSON.stringify({ settings: { shake: false, lowFx: 'yes' } }));
    const s = createSaveStore(storage).load().settings;
    expect(s.lowFx).toBe(false);
    expect(s.shake).toBe(false);
  });
});

describe('궁극기 아우라', () => {
  it('게이지가 꽉 찼을 때만 켜지고, 궁극기를 쓰면 게이지가 0 이 되어 꺼진다', () => {
    expect(ultAuraOn({ ultGauge: 0.99, dead: false })).toBe(false);
    expect(ultAuraOn({ ultGauge: 1, dead: false })).toBe(true);
    expect(ultAuraOn({ ultGauge: 0, dead: false })).toBe(false);
  });

  it('쓰러지면 게이지가 차 있어도 꺼진다', () => {
    expect(ultAuraOn({ ultGauge: 1, dead: true })).toBe(false);
  });

  it('빛은 사라지지 않고 숨쉬듯 밝아졌다 어두워진다', () => {
    const values = Array.from({ length: 100 }, (_, i) => auraPulse(i / 100));
    expect(Math.min(...values)).toBeCloseTo(0.7, 2);
    expect(Math.max(...values)).toBeCloseTo(1, 2);
  });

  it('불꽃은 발에서 태어나 작아지며 머리 위에서 사라지고, 좌우 양쪽에 나온다', () => {
    const count = 8;
    const start = auraFlame(0, count, 0);
    const end = auraFlame(0, count, 0.799);
    expect(start.y).toBeCloseTo(1);
    expect(start.alpha).toBeCloseTo(0);
    expect(end.y).toBeLessThan(-1);
    expect(end.alpha).toBeLessThan(0.05);
    expect(end.size).toBeLessThan(start.size);
    const sides = Array.from({ length: count }, (_, i) => Math.sign(auraFlame(i, count, 0).x));
    expect(new Set(sides)).toEqual(new Set([-1, 1]));
  });
});
