import { describe, it, expect, vi, afterEach } from 'vitest';
import { canUseWebGL, startHorror, deviceKind } from '../src/horror/start.js';

const fakeCtx = (loseContext = () => {}) => ({ getExtension: () => ({ loseContext }) });
const docWith = (ctx) => ({ createElement: () => ({ getContext: () => ctx }) });

describe('WebGL 확인', () => {
  it('켜지면 true', () => {
    expect(canUseWebGL(docWith(fakeCtx()))).toBe(true);
  });

  it('webgl2 만 묻는다. webgl1 만 되는 기기는 false', () => {
    const asked = [];
    const doc = { createElement: () => ({ getContext: (name) => { asked.push(name); return name === 'webgl' ? fakeCtx() : null; } }) };
    expect(canUseWebGL(doc)).toBe(false);
    expect(asked).toEqual(['webgl2']);
  });

  it('확인에 쓴 자리를 돌려준다', () => {
    const lose = vi.fn();
    expect(canUseWebGL(docWith(fakeCtx(lose)))).toBe(true);
    expect(lose).toHaveBeenCalledTimes(1);
  });

  it('돌려주는 확장이 없어도 true', () => {
    expect(canUseWebGL(docWith({ getExtension: () => null }))).toBe(true);
  });

  it('없으면 false', () => {
    expect(canUseWebGL(docWith(null))).toBe(false);
  });

  it('오류가 나도 false', () => {
    const doc = { createElement: () => { throw new Error('막힘'); } };
    expect(canUseWebGL(doc)).toBe(false);
  });
});

describe('시작 실패', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function fakeDom() {
    const root = { style: {}, textContent: '', removed: false, remove() { this.removed = true; } };
    const canvas = { getContext: () => fakeCtx() };
    vi.stubGlobal('document', {
      createElement: (tag) => (tag === 'canvas' ? canvas : root),
      body: { appendChild: () => {} },
    });
    return root;
  }

  it('만드는 중 오류가 나면 안내 뒤 타이틀로 돌아온다', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = fakeDom();
    const game = { pause: vi.fn(), resume: vi.fn() };
    const onExit = vi.fn();
    class Boom { constructor() { throw new Error('만들기 실패'); } }
    await startHorror(game, { onExit }, async () => ({ HorrorGame: Boom }));
    expect(game.pause).toHaveBeenCalled();
    expect(game.resume).toHaveBeenCalled();
    expect(root.textContent).toContain('시작하지 못했어요');
    expect(onExit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2600);
    expect(root.removed).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });

  it('start 에서 오류가 나도 만든 화면을 치우고 한 번만 끝낸다', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeDom();
    const game = { pause: vi.fn(), resume: vi.fn() };
    const onExit = vi.fn();
    const exit = vi.fn();
    class Late { start() { throw new Error('시작 실패'); } exit() { exit(); this.onExit(); } constructor(r, o) { this.onExit = o.onExit; } }
    await startHorror(game, { onExit }, async () => ({ HorrorGame: Late }));
    vi.advanceTimersByTime(2600);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(game.resume).toHaveBeenCalledTimes(1);
  });

  it('묶음을 못 불러와도 오류를 기록하고 돌아온다', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeDom();
    const onExit = vi.fn();
    await startHorror({ pause: vi.fn(), resume: vi.fn() }, { onExit }, async () => { throw new Error('네트워크'); });
    vi.advanceTimersByTime(2600);
    expect(console.error).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('기기 고르기', () => {
  it('휴대폰, 태블릿, PC 를 구분한다', () => {
    expect(deviceKind(true, true)).toBe('phone');
    expect(deviceKind(false, true)).toBe('tablet');
    expect(deviceKind(false, false)).toBe('pc');
  });
});
