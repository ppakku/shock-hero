import { describe, it, expect, vi } from 'vitest';
import { TOUCH_BUTTONS, PHONE_BUTTONS, PHONE_PAUSE, isPhone } from '../src/ui/touch.js';
import { textSize } from '../src/ui/text.js';

vi.mock('peerjs', () => ({ default: class {} }));
const { coop } = await import('../src/net/coop.js');

const fakeWin = ({ search = '', points = 5, coarse = true, w = 844, h = 390 } = {}) => ({
  location: { search },
  navigator: { maxTouchPoints: points },
  matchMedia: () => ({ matches: coarse }),
  screen: { width: w, height: h },
});

// 휴대폰 화면은 게임 화면이 약 0.63 배로 줄어든다 (아이폰을 가로로, 사파리 주소창 포함)
const PHONE_SCALE = 0.63;

describe('휴대폰', () => {
  it('화면 짧은 쪽이 600 보다 작은 터치 기기만 휴대폰', () => {
    expect(isPhone(fakeWin())).toBe(true);
    expect(isPhone(fakeWin({ w: 390, h: 844 }))).toBe(true);
    expect(isPhone(fakeWin({ w: 1180, h: 820 }))).toBe(false); // 아이패드
    expect(isPhone(fakeWin({ points: 0, coarse: false }))).toBe(false); // 작은 창의 컴퓨터
    expect(isPhone(fakeWin({ points: 0, coarse: false, search: '?phone' }))).toBe(true);
    expect(isPhone(fakeWin({ search: '?nophone' }))).toBe(false);
  });

  it('휴대폰 버튼: 실제 화면에서 지름 44px 이상, 태블릿보다 크고, 겹치지 않고, 화면 안', () => {
    const bs = TOUCH_BUTTONS.map((b) => ({ id: b.id, tablet: b.r, ...PHONE_BUTTONS[b.id] }));
    for (const b of bs) {
      expect(b.r * 2 * PHONE_SCALE).toBeGreaterThanOrEqual(44);
      expect(b.r).toBeGreaterThan(b.tablet);
      expect(b.x + b.r).toBeLessThanOrEqual(960);
      expect(b.y + b.r).toBeLessThanOrEqual(540);
      expect(b.y - b.r).toBeGreaterThan(140);
    }
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) expect(Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y)).toBeGreaterThan(bs[i].r + bs[j].r);
    expect(PHONE_PAUSE.r * 2 * PHONE_SCALE).toBeGreaterThanOrEqual(32);
  });

  it('휴대폰은 16 보다 작은 글자만 키운다', () => {
    expect(textSize(12, true)).toBe(14);
    expect(textSize(14, true)).toBe(16);
    expect(textSize(15, true)).toBe(16);
    expect(textSize(20, true)).toBe(20);
    expect(textSize(12, false)).toBe(12);
  });
});

describe('다른 앱으로 넘어갔을 때 함께하기', () => {
  const fakeConn = () => {
    const sent = [];
    return { sent, conn: { open: true, send: (m) => sent.push(m) } };
  };

  it('방장: 친구 화면에 기다려 달라고 알리고, 돌아오면 지운다', () => {
    const { sent, conn } = fakeConn();
    Object.assign(coop, { role: 'host', status: 'connected', conn });
    coop.away(true);
    coop.away(false);
    expect(sent[0].t).toBe('info');
    expect(sent[0].text).toMatch(/기다려/);
    expect(sent[1]).toEqual({ t: 'info', text: '' });
  });

  it('친구: 누르던 키를 다 뗀 걸로 보낸다', () => {
    const { sent, conn } = fakeConn();
    Object.assign(coop, { role: 'guest', status: 'connected', conn });
    coop.away(true);
    coop.away(false);
    expect(sent).toEqual([{ t: 'in' }]);
  });

  it('연결이 없으면 아무것도 안 보낸다', () => {
    const { sent, conn } = fakeConn();
    Object.assign(coop, { role: 'host', status: 'waiting', conn });
    coop.away(true);
    expect(sent).toEqual([]);
    coop.reset();
  });
});
