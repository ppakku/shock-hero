import { describe, it, expect, vi, afterEach } from 'vitest';
import { HorrorHud, controlLines, introLines, startHint, escapeText, MONSTER_NAME } from '../src/horror/hud.js';

describe('공포 모드 조작 안내', () => {
  it('PC 는 키보드와 마우스를 알려 준다', () => {
    const text = controlLines('pc').join(' ');
    for (const word of ['(PC)', 'W A S D', '마우스', 'Shift', '체력', 'F', 'Esc', '충전: E', '쇼크 펀치: J 또는 왼쪽 클릭', '좌우 방향키']) expect(text).toContain(word);
    expect(text).not.toContain('버튼');
  });

  it('태블릿은 손가락 조작과 화면 버튼을 알려 준다', () => {
    const text = controlLines('tablet').join(' ');
    for (const word of ['(태블릿)', '체력', '왼쪽', '오른쪽', '손전등 버튼', '멈춤 버튼', '사용 버튼', '펀치 버튼']) expect(text).toContain(word);
    expect(text).not.toContain('Esc');
  });

  it('어느 기기든 시작 안내가 퓨즈와 열쇠, 잠긴 문을 알려 준다', () => {
    for (const d of ['pc', 'tablet', 'phone']) {
      const text = introLines(d).join(' ');
      for (const word of ['퓨즈', '열쇠', '잠긴 문']) expect(text).toContain(word);
    }
  });

  it('문 여는 조작도 알려 준다', () => {
    expect(controlLines('pc').join(' ')).toContain('문 열기');
    expect(controlLines('tablet').join(' ')).toContain('문 열기');
  });

  it('기기마다 다른 시작 알림을 준다', () => {
    expect(startHint('tablet')).toContain('왼쪽');
    expect(startHint('phone')).toContain('왼쪽');
    expect(startHint('pc')).toContain('마우스');
  });

  it('끝 화면은 실제로 받은 보석만 말한다', () => {
    expect(escapeText({ gems: 10, daily: 5, bonus: 5 }, true)).toContain('보석 10개');
    expect(escapeText({ gems: 5, daily: 5, bonus: 0 }, false)).toBe('탈출 성공! 보석 5개');
    expect(escapeText({ gems: 5, daily: 5, bonus: 0 }, true)).toContain('보석 5개');
    const bonusOnly = escapeText({ gems: 5, daily: 0, bonus: 5 }, true);
    expect(bonusOnly).toContain('보석 5개');
    expect(bonusOnly).toContain('오늘 이미');
    for (const clean of [true, false]) {
      const none = escapeText({ gems: 0, daily: 0, bonus: 0 }, clean);
      expect(none).toContain('오늘은 이미 보석을 받았어요');
      expect(none).not.toMatch(/보석 \d/);
    }
  });

  it('휴대폰은 눕혀 달라고 알려 주고, 조작은 터치로 알려 준다', () => {
    const text = controlLines('phone').join(' ');
    expect(text).toContain('가로로');
    expect(text).toContain('펀치 버튼');
    expect(text).not.toContain('Esc');
  });

  it('괴물 이름은 세이노다', () => {
    expect(MONSTER_NAME).toBe('세이노');
  });
});

// HorrorHud 가 쓰는 만큼만 흉내 낸 화면 조각
const fakeEl = () => ({
  style: {},
  kids: [],
  on: {},
  addEventListener(type, fn) { this.on[type] = fn; },
  appendChild(k) { this.kids.push(k); },
  remove() { this.gone = true; },
  focus() {},
});

function fakeHud() {
  vi.stubGlobal('document', { createElement: fakeEl });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  return new HorrorHud(fakeEl());
}

const layerButtons = (hud) => hud.layer.kids.at(-1).kids;
const layerText = (hud) => hud.layer.kids.slice(0, -1).map((k) => k.textContent).join(' ');
const press = (btn) => btn.on.click({ stopPropagation() {} });

describe('읽은 쪽지 다시 보기', () => {
  const notes = [['첫째 쪽지'], ['둘째 쪽지', '둘째 줄'], ['셋째 쪽지']];
  afterEach(() => vi.unstubAllGlobals());

  it('읽은 쪽지가 없으면 일시정지에 버튼이 없다', () => {
    const hud = fakeHud();
    hud.showPause(() => {}, () => {}, null);
    expect(layerButtons(hud).map((b) => b.textContent)).toEqual(['계속하기', '타이틀로']);
  });

  it('버튼을 누르면 쪽지를 넘겨 보고 돌아올 수 있다', () => {
    const hud = fakeHud();
    const back = vi.fn();
    hud.showPause(() => {}, () => {}, () => hud.showReadNotes(notes, back));
    const open = layerButtons(hud).find((b) => b.textContent === '읽은 쪽지');
    press(open);
    expect(layerText(hud)).toContain('읽은 쪽지 3/3');
    expect(layerText(hud)).toContain('셋째 쪽지');
    expect(layerButtons(hud).map((b) => b.textContent)).toEqual(['이전 쪽지', '돌아가기']);
    press(layerButtons(hud)[0]);
    expect(layerText(hud)).toContain('둘째 줄');
    expect(layerButtons(hud).map((b) => b.textContent)).toEqual(['이전 쪽지', '다음 쪽지', '돌아가기']);
    press(layerButtons(hud)[0]);
    expect(layerText(hud)).toContain('첫째 쪽지');
    expect(layerButtons(hud).map((b) => b.textContent)).toEqual(['다음 쪽지', '돌아가기']);
    press(layerButtons(hud)[1]);
    expect(back).toHaveBeenCalledOnce();
  });

  it('닫힌 쪽지의 글은 남지 않는다', () => {
    const hud = fakeHud();
    hud.showNote(['글'], false);
    expect(hud.noteLines).toEqual(['글']);
    expect(hud.closeNote()).toBe(true);
    expect(hud.noteLines).toBe(null);
    expect(hud.closeNote()).toBe(false);
  });
});

describe('쪽지 화면', () => {
  it('조작 안내에 쪽지 읽기와 닫기가 있다', () => {
    for (const d of ['pc', 'tablet', 'phone']) expect(controlLines(d).join(' ')).toContain('쪽지');
  });
});
