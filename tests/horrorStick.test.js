import { describe, it, expect } from 'vitest';
import { stickKnob } from '../src/horror/input.js';

describe('조이스틱 손잡이', () => {
  it('반지름 안에서는 손가락을 그대로 따라간다', () => {
    expect(stickKnob(30, 40, 100, 0.92)).toEqual({ x: 30, y: 40, run: false });
  });

  it('반지름 밖은 가장자리에 가둔다', () => {
    const k = stickKnob(300, 400, 100, 0.92);
    expect(Math.hypot(k.x, k.y)).toBeCloseTo(100);
    expect(k.x / k.y).toBeCloseTo(0.75);
  });

  it('바깥 구간에 들어가야 달리기 색이 된다', () => {
    expect(stickKnob(0, -91, 100, 0.92).run).toBe(false);
    expect(stickKnob(0, -92, 100, 0.92).run).toBe(true);
    expect(stickKnob(0, -500, 100, 0.92).run).toBe(true);
  });

  it('제자리는 0 이고 달리지 않는다', () => {
    expect(stickKnob(0, 0, 100, 0.92)).toEqual({ x: 0, y: 0, run: false });
  });
});
