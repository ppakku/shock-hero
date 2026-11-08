import { describe, it, expect, vi } from 'vitest';
import { canFullscreen, isFullscreen, toggleFullscreen, onFullscreenChange, fullscreenLabel } from '../src/ui/fullscreen.js';

function fakeDoc({ enabled = true, prefixed = false } = {}) {
  const listeners = {};
  const doc = {
    fullscreenElement: null,
    addEventListener: (t, f) => (listeners[t] = f),
    removeEventListener: (t) => delete listeners[t],
    listeners,
  };
  const el = {};
  doc.documentElement = el;
  if (prefixed) {
    doc.webkitFullscreenEnabled = enabled;
    el.webkitRequestFullscreen = vi.fn(() => (doc.webkitFullscreenElement = el));
    doc.webkitExitFullscreen = vi.fn(() => (doc.webkitFullscreenElement = null));
  } else {
    doc.fullscreenEnabled = enabled;
    el.requestFullscreen = vi.fn(async () => (doc.fullscreenElement = el));
    doc.exitFullscreen = vi.fn(async () => (doc.fullscreenElement = null));
  }
  return doc;
}

describe('전체 화면', () => {
  it('캔버스가 아니라 페이지 전체를 키우고, 다시 누르면 끈다', async () => {
    const doc = fakeDoc();
    expect(canFullscreen(doc)).toBe(true);
    expect(fullscreenLabel(doc)).toBe('전체 화면');
    await toggleFullscreen(doc);
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalled();
    expect(isFullscreen(doc)).toBe(true);
    expect(fullscreenLabel(doc)).toBe('전체 화면 끄기');
    await toggleFullscreen(doc);
    expect(doc.exitFullscreen).toHaveBeenCalled();
    expect(isFullscreen(doc)).toBe(false);
  });

  it('webkit 이름만 있는 사파리에서도 켠다', async () => {
    const doc = fakeDoc({ prefixed: true });
    expect(canFullscreen(doc)).toBe(true);
    await toggleFullscreen(doc);
    expect(isFullscreen(doc)).toBe(true);
  });

  it('아이폰처럼 못 하는 기기는 false 이고, 눌러도 오류가 나지 않는다', async () => {
    const doc = fakeDoc({ enabled: false });
    delete doc.documentElement.requestFullscreen;
    expect(canFullscreen(doc)).toBe(false);
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
  });

  it('브라우저가 거절해도 오류가 밖으로 나가지 않는다', async () => {
    const doc = fakeDoc();
    doc.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('no gesture')));
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
  });

  it('바뀔 때 알려 주고, 그만 들을 수 있다', () => {
    const doc = fakeDoc();
    const fn = () => {};
    const stop = onFullscreenChange(fn, doc);
    expect(doc.listeners.fullscreenchange).toBe(fn);
    expect(doc.listeners.webkitfullscreenchange).toBe(fn);
    stop();
    expect(doc.listeners).toEqual({});
  });
});
