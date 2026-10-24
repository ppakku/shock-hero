import { describe, it, expect } from 'vitest';
import { jumpKind } from '../src/logic/jump.js';
import { balance } from '../src/config/balance.js';

describe('더블 점프', () => {
  it('땅에서 누르면 땅 점프', () => {
    expect(jumpKind({ jumpPressed: true, jumpBuffer: 0.12, coyote: 0.1, airJumpsLeft: 1 })).toBe('ground');
  });

  it('공중에서 새로 누르면 더블 점프, 다 쓰면 더는 안 뜀', () => {
    expect(jumpKind({ jumpPressed: true, jumpBuffer: 0.12, coyote: 0, airJumpsLeft: 1 })).toBe('air');
    expect(jumpKind({ jumpPressed: true, jumpBuffer: 0.12, coyote: 0, airJumpsLeft: 0 })).toBe(null);
  });

  it('누른 채로 있거나 미리 눌러 둔 건 공중 점프를 쓰지 않는다', () => {
    expect(jumpKind({ jumpPressed: false, jumpBuffer: 0.05, coyote: 0, airJumpsLeft: 1 })).toBe(null);
  });

  it('땅에서 떨어진 직후(코요테 시간)엔 공중 점프를 아끼고 땅 점프', () => {
    expect(jumpKind({ jumpPressed: true, jumpBuffer: 0.12, coyote: 0.05, airJumpsLeft: 1 })).toBe('ground');
  });

  it('설정: 공중 점프 1번, 첫 점프보다 조금 약함', () => {
    expect(balance.player.airJumps).toBe(1);
    expect(balance.player.doubleJumpSpeed).toBeLessThan(balance.player.jumpSpeed);
    expect(balance.player.doubleJumpSpeed).toBeGreaterThan(0);
  });
});
