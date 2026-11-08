import { describe, it, expect } from 'vitest';
import { duskAt, stageChange, mixColor, DUSK_ALERTS, FOREST_ID } from '../src/logic/horrorDusk.js';
import { balance } from '../src/config/balance.js';
import { cfg } from '../src/config/index.js';

const k = balance.horror.forest.dusk;
const bright = (c) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);

describe('해 질 녘', () => {
  it('숲 아이디는 forest 다', () => {
    expect(FOREST_ID).toBe('forest');
  });

  it('노을 0~180초, 어스름 180~480초, 밤 480초부터', () => {
    expect(duskAt(0, k).stage).toBe('glow');
    expect(duskAt(179.9, k).stage).toBe('glow');
    expect(duskAt(180, k).stage).toBe('twilight');
    expect(duskAt(479, k).stage).toBe('twilight');
    expect(duskAt(480, k).stage).toBe('night');
    expect(duskAt(5000, k).stage).toBe('night');
  });

  it('level 은 시작에 0, 밤이 시작될 때 1 이고 그 뒤로 넘지 않는다', () => {
    expect(duskAt(0, k).level).toBe(0);
    expect(duskAt(240, k).level).toBeCloseTo(0.5);
    expect(duskAt(480, k).level).toBe(1);
    expect(duskAt(9999, k).level).toBe(1);
    expect(duskAt(-5, k).level).toBe(0);
  });

  it('단계가 시작되는 순간에는 정한 색 그대로다', () => {
    expect(duskAt(0, k).sky).toEqual({ top: 0x463c78, mid: 0xd26e78, low: 0xf09650 });
    expect(duskAt(180, k).sky).toEqual({ top: 0x281e50, mid: 0x6e3c6e, low: 0xa0505a });
    expect(duskAt(480, k).sky).toEqual({ top: 0x06080f, mid: 0x0a0c1a, low: 0x10101e });
  });

  it('시간이 갈수록 하늘, 안개, 주변 빛이 어두워진다', () => {
    let last = duskAt(0, k);
    for (let t = 20; t <= 600; t += 20) {
      const d = duskAt(t, k);
      expect(bright(d.sky.low)).toBeLessThanOrEqual(bright(last.sky.low));
      expect(bright(d.fog)).toBeLessThanOrEqual(bright(last.fog));
      expect(d.ambientScale).toBeLessThanOrEqual(last.ambientScale);
      expect(d.fogFar).toBeLessThanOrEqual(last.fogFar);
      last = d;
    }
  });

  it('하늘 돔 그림은 노을에 그대로, 밤에는 짙게 눌린다', () => {
    expect(duskAt(0, k).tint).toBe(0xffffff);
    expect(bright(duskAt(300, k).tint)).toBeLessThan(bright(0xffffff));
    expect(bright(duskAt(600, k).tint)).toBeLessThan(bright(duskAt(300, k).tint));
  });

  it('처음에는 밝고, 밤에는 다른 맵 어둠과 같다', () => {
    expect(duskAt(0, k).ambientScale).toBeGreaterThanOrEqual(3);
    expect(duskAt(600, k).ambientScale).toBe(1);
    expect(bright(duskAt(600, k).fog)).toBeLessThan(40);
  });

  it('설정 정리를 거쳐도 값이 그대로다 (음수 없음)', () => {
    expect(cfg.horror.forest.dusk).toEqual(k);
  });

  it('색 섞기는 끝 값을 그대로 준다', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0x204060, 0.5)).toBe(0x102030);
  });
});

describe('단계 알림', () => {
  it('어스름과 밤이 될 때 한 번씩 알린다', () => {
    expect(stageChange('glow', 'twilight')).toBe('어디선가 흐느끼는 소리가 들린다');
    expect(stageChange('twilight', 'night')).toBe('해가 완전히 졌다');
    expect(DUSK_ALERTS.night).toBe('해가 완전히 졌다');
  });

  it('같은 단계, 처음, 뒤로 가는 일에는 알리지 않는다', () => {
    expect(stageChange('glow', 'glow')).toBeNull();
    expect(stageChange(null, 'glow')).toBeNull();
    expect(stageChange(undefined, 'twilight')).toBeNull();
    expect(stageChange('night', 'glow')).toBeNull();
  });

  it('프레임마다 불러도 바뀌는 순간에만 글이 나온다', () => {
    const lines = [];
    let prev = null;
    for (let t = 0; t <= 600; t += 0.05) {
      const d = duskAt(t, k);
      const line = stageChange(prev, d.stage);
      if (line) lines.push(line);
      prev = d.stage;
    }
    expect(lines).toEqual([DUSK_ALERTS.twilight, DUSK_ALERTS.night]);
  });
});
