import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance.js';
import { Cooldown } from '../src/logic/cooldown.js';

describe('대시 회피 뒤 대기시간', () => {
  it('limit 은 남은 시간을 줄이기만 한다', () => {
    const c = new Cooldown(0.7);
    c.trigger();
    c.limit(0.1);
    expect(c.remaining).toBe(0.1);
    c.update(0.08);
    c.limit(0.1);
    expect(c.remaining).toBeCloseTo(0.02);
  });

  it('무적이 끝나기 전에 다음 대시를 쓸 수 있다', () => {
    expect(balance.dash.dodgeCooldown).toBeLessThan(balance.dash.invincibleTime);
  });
});
