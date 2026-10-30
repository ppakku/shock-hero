import { describe, it, expect } from 'vitest';
import { TOUCH_BUTTONS, PAUSE_BUTTON, STICK, TouchPad, drawTouchButtons2D, drawPauseButton2D, labelFontSize } from '../src/ui/touch.js';

// 2D 그리기 문맥 흉내: 무엇을 그렸는지만 적어 둔다
function fakeCtx() {
  const calls = [];
  const ctx = { lineWidth: 0, globalAlpha: 1, font: '', fillStyle: '', strokeStyle: '' };
  for (const m of ['beginPath', 'arc', 'fill', 'stroke', 'fillRect', 'fillText', 'strokeText', 'clearRect']) {
    ctx[m] = (...a) => calls.push({ m, a, alpha: ctx.globalAlpha, font: ctx.font, fill: ctx.fillStyle });
  }
  ctx.calls = calls;
  ctx.of = (m) => calls.filter((c) => c.m === m);
  return ctx;
}

describe('방장 화면 버튼은 HTML 층에 그린다 (함께하기 영상에 안 담기게)', () => {
  it('버튼마다 동그라미 하나와 글자 하나, 손가락이 없으면 조이스틱 자리 표시', () => {
    const ctx = fakeCtx();
    const labels = TOUCH_BUTTONS.map((b) => (b.id === 'attack' ? '번개탄' : b.label));
    drawTouchButtons2D(ctx, labels, new TouchPad());
    const arcs = ctx.of('arc');
    for (const b of TOUCH_BUTTONS) expect(arcs.some((c) => c.a[0] === b.x && c.a[1] === b.y && c.a[2] === b.r)).toBe(true);
    expect(ctx.of('fillText').map((c) => c.a[0])).toEqual(labels); // 공격 버튼은 주인공 공격 이름
    const h = STICK.hint;
    expect(arcs.some((c) => c.a[0] === h.x && c.a[1] === h.y && c.a[2] === STICK.radius + 12)).toBe(true);
  });

  it('누르는 버튼만 또렷하고, 궁극기가 차면 빛난다', () => {
    const ctx = fakeCtx();
    const pad = new TouchPad();
    const jump = TOUCH_BUTTONS.find((b) => b.id === 'jump');
    pad.poll([{ id: 1, x: jump.x, y: jump.y }]);
    drawTouchButtons2D(ctx, TOUCH_BUTTONS.map((b) => b.label), pad, { ultReady: true });
    const texts = ctx.of('fillText');
    expect(texts.find((c) => c.a[0] === '점프').alpha).toBeCloseTo(0.95);
    expect(texts.find((c) => c.a[0] === '궁극기').alpha).toBeCloseTo(0.8);
    expect(texts.find((c) => c.a[0] === '대시').alpha).toBeCloseTo(0.5);
  });

  it('조이스틱을 끌면 엄지를 댄 자리에 받침, 엄지 쪽에 손잡이', () => {
    const ctx = fakeCtx();
    const pad = new TouchPad();
    pad.poll([{ id: 1, x: 200, y: 400 }]);
    pad.poll([{ id: 1, x: 240, y: 400 }]);
    drawTouchButtons2D(ctx, TOUCH_BUTTONS.map((b) => b.label), pad);
    const arcs = ctx.of('arc');
    expect(arcs.some((c) => c.a[0] === 200 && c.a[1] === 400 && c.a[2] === STICK.radius + 12)).toBe(true); // 받침
    expect(arcs.some((c) => c.a[0] === 240 && c.a[1] === 400 && c.a[2] === 26)).toBe(true); // 손잡이
  });

  it('글자 크기와 글꼴 보정은 친구 화면(makeText)과 같은 규칙', () => {
    const ctx = fakeCtx();
    const sizes = [];
    drawTouchButtons2D(ctx, TOUCH_BUTTONS.map((b) => b.label), new TouchPad(), { font: 'TestFont', textSize: (n) => sizes.push(n) && n + 1 });
    expect(sizes).toEqual(TOUCH_BUTTONS.map((b) => labelFontSize(b, b.label)));
    expect(ctx.of('fillText')[0].font).toBe(`${sizes[0] + 1}px TestFont`);
    expect(labelFontSize({ r: 40 }, '펀치')).toBe(18);
    expect(labelFontSize({ r: 40 }, 'A')).toBe(24);
  });

  it('일시정지 버튼: 동그라미와 막대 두 개', () => {
    const ctx = fakeCtx();
    drawPauseButton2D(ctx);
    expect(ctx.of('arc').some((c) => c.a[0] === PAUSE_BUTTON.x && c.a[1] === PAUSE_BUTTON.y && c.a[2] === PAUSE_BUTTON.r)).toBe(true);
    expect(ctx.of('fillRect')).toHaveLength(2);
  });
});
