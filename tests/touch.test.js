import { describe, it, expect } from 'vitest';
import { TOUCH_BUTTONS, PAUSE_BUTTON, buttonAt, isTouchDevice, TouchPad } from '../src/ui/touch.js';
import { keyText } from '../src/logic/controls.js';

const fakeWin = ({ search = '', points = 0, coarse = false } = {}) => ({
  location: { search },
  navigator: { maxTouchPoints: points },
  matchMedia: () => ({ matches: coarse }),
});

describe('태블릿 터치 버튼', () => {
  it('버튼 가운데를 누르면 그 버튼, 빈 곳은 없음', () => {
    for (const b of TOUCH_BUTTONS) expect(buttonAt(b.x, b.y)?.id).toBe(b.id);
    expect(buttonAt(480, 270)).toBe(null);
  });

  it('테두리 조금 밖을 눌러도 눌린다 (아이 손가락)', () => {
    const b = TOUCH_BUTTONS.find((x) => x.id === 'attack');
    expect(buttonAt(b.x + b.r * 1.15, b.y)?.id).toBe('attack');
    expect(buttonAt(b.x + b.r * 1.6, b.y)).toBe(null);
  });

  it('버튼끼리 겹치지 않고 화면 안에 있다', () => {
    for (const b of TOUCH_BUTTONS) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(0);
      expect(b.x + b.r).toBeLessThanOrEqual(960);
      expect(b.y + b.r).toBeLessThanOrEqual(540);
      expect(b.y - b.r).toBeGreaterThan(140); // 위쪽 체력바, 보스 체력, 시간 글자를 가리지 않게
    }
    for (let i = 0; i < TOUCH_BUTTONS.length; i++) {
      for (let j = i + 1; j < TOUCH_BUTTONS.length; j++) {
        const a = TOUCH_BUTTONS[i];
        const b = TOUCH_BUTTONS[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
      }
    }
    expect(PAUSE_BUTTON.x + PAUSE_BUTTON.r).toBeLessThanOrEqual(960);
  });

  it('누르고 있는 동안 down, 처음 누른 프레임만 pressed', () => {
    const pad = new TouchPad();
    const jump = TOUCH_BUTTONS.find((b) => b.id === 'jump');
    expect(pad.poll([jump]).pressed.jump).toBe(true);
    const second = pad.poll([jump]);
    expect(second.down.jump).toBe(true);
    expect(second.pressed.jump).toBeUndefined();
    expect(pad.poll([]).down.jump).toBeUndefined();
    expect(pad.poll([jump]).pressed.jump).toBe(true);
  });

  it('손가락 두 개: 이동하면서 펀치', () => {
    const pad = new TouchPad();
    const right = TOUCH_BUTTONS.find((b) => b.id === 'right');
    const attack = TOUCH_BUTTONS.find((b) => b.id === 'attack');
    const r = pad.poll([right, attack]);
    expect(r.down.right && r.down.attack).toBe(true);
  });

  it('손가락을 ◀ 에서 ▶ 로 미끄러뜨리면 따라간다', () => {
    const pad = new TouchPad();
    const left = TOUCH_BUTTONS.find((b) => b.id === 'left');
    const right = TOUCH_BUTTONS.find((b) => b.id === 'right');
    pad.poll([left]);
    const r = pad.poll([right]);
    expect(r.down.left).toBeUndefined();
    expect(r.down.right).toBe(true);
  });

  it('손가락 화면인 기기만 터치 버튼, 주소로 켜고 끌 수 있다', () => {
    expect(isTouchDevice(fakeWin({ points: 5, coarse: true }))).toBe(true); // 태블릿 (아이패드 포함)
    expect(isTouchDevice(fakeWin({ points: 0, coarse: false }))).toBe(false); // 컴퓨터
    expect(isTouchDevice(fakeWin({ points: 10, coarse: false }))).toBe(false); // 터치 화면 노트북 (마우스가 주)
    expect(isTouchDevice(fakeWin({ search: '?touch' }))).toBe(true);
    expect(isTouchDevice(fakeWin({ search: '?notouch', points: 5, coarse: true }))).toBe(false);
    expect(isTouchDevice(undefined)).toBe(false);
  });

  it('안내 글이 버튼 이름으로 바뀌고 뒷말도 맞는다', () => {
    expect(keyText('{punch} 를 꾹 눌러!', 'touch')).toBe('펀치 버튼을 꾹 눌러!');
    expect(keyText('{dash} 로 대시해서', 'touch')).toBe('대시 버튼으로 대시해서');
    expect(keyText('궁극기 준비! {ult} 키를 눌러!', 'touch')).toBe('궁극기 준비! 궁극기 버튼을 눌러!');
    expect(keyText('궁극기 준비! {ult} 키', 'touch')).toBe('궁극기 준비! 궁극기 버튼');
    expect(keyText('{up} 누른 채 {punch}', 'touch')).toBe('▲ 버튼 누른 채 펀치 버튼');
    expect(keyText('{punch} 또는 마우스 왼쪽\n펀치!', 'touch')).toBe('펀치 버튼\n펀치!');
    // 키보드 조작은 그대로
    expect(keyText('{punch} 를 꾹 눌러!', 'classic')).toBe('J 를 꾹 눌러!');
  });
});
