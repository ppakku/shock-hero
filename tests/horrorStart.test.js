import { describe, it, expect } from 'vitest';
import { canUseWebGL } from '../src/horror/start.js';

const docWith = (ctx) => ({ createElement: () => ({ getContext: () => ctx }) });

describe('WebGL 확인', () => {
  it('켜지면 true', () => {
    expect(canUseWebGL(docWith({}))).toBe(true);
  });

  it('없으면 false', () => {
    expect(canUseWebGL(docWith(null))).toBe(false);
  });

  it('오류가 나도 false', () => {
    const doc = { createElement: () => { throw new Error('막힘'); } };
    expect(canUseWebGL(doc)).toBe(false);
  });
});
