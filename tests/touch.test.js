import { describe, it, expect } from 'vitest';
import { TOUCH_BUTTONS, PAUSE_BUTTON, STICK, buttonAt, isTouchDevice, TouchPad, stickDirs, inStickZone } from '../src/ui/touch.js';
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
    const jump = { id: 1, x: 752, y: 488 };
    expect(pad.poll([jump]).pressed.jump).toBe(true);
    const second = pad.poll([jump]);
    expect(second.down.jump).toBe(true);
    expect(second.pressed.jump).toBeUndefined();
    expect(pad.poll([]).down.jump).toBeUndefined();
    expect(pad.poll([jump]).pressed.jump).toBe(true);
  });

  it('조이스틱: 엄지를 댄 자리가 가운데, 끄는 방향으로 걷기', () => {
    const pad = new TouchPad();
    expect(pad.poll([{ id: 1, x: 200, y: 400 }]).down).toEqual({}); // 대기만 해서는 안 걷는다
    expect(pad.poll([{ id: 1, x: 205, y: 402 }]).down).toEqual({}); // 살짝 흔들림은 무시
    expect(pad.poll([{ id: 1, x: 240, y: 400 }]).down.right).toBe(true);
    expect(pad.poll([{ id: 1, x: 160, y: 400 }]).down.left).toBe(true);
    expect(pad.poll([]).down).toEqual({});
  });

  it('조이스틱: 멀리 끌었다가 조금만 되돌려도 반대로 바뀐다', () => {
    const pad = new TouchPad();
    pad.poll([{ id: 1, x: 100, y: 400 }]);
    expect(pad.poll([{ id: 1, x: 400, y: 400 }]).down.right).toBe(true); // 가운데가 350 까지 따라옴
    expect(pad.poll([{ id: 1, x: 330, y: 400 }]).down.left).toBe(true);
  });

  it('조이스틱 위로 밀면 어퍼컷 조준, 비스듬히 옆으로는 아님', () => {
    expect(stickDirs(0, -40).up).toBe(true);
    expect(stickDirs(20, -40)).toEqual({ left: false, right: true, up: true });
    expect(stickDirs(60, -32).up).toBe(false);
    expect(stickDirs(0, -20).up).toBe(false);
  });

  it('조이스틱 손가락과 버튼 손가락이 따로: 걸으면서 펀치', () => {
    const pad = new TouchPad();
    pad.poll([{ id: 1, x: 150, y: 450 }]);
    const r = pad.poll([
      { id: 1, x: 200, y: 450 },
      { id: 2, x: 868, y: 462 },
    ]);
    expect(r.down.right && r.down.attack).toBe(true);
  });

  it('오른쪽 버튼 쪽이나 위쪽 체력바 근처에서는 조이스틱이 생기지 않는다', () => {
    expect(inStickZone(600, 400)).toBe(false);
    expect(inStickZone(200, 80)).toBe(false);
    expect(inStickZone(200, 400)).toBe(true);
    const pad = new TouchPad();
    pad.poll([{ id: 1, x: 700, y: 300 }]);
    expect(pad.stick).toBe(null);
  });

  it('조이스틱 손가락을 오른쪽으로 끌고 가도 버튼이 눌리지 않는다', () => {
    const pad = new TouchPad();
    pad.poll([{ id: 1, x: 300, y: 450 }]);
    const r = pad.poll([{ id: 1, x: 868, y: 462 }]);
    expect(r.down.attack).toBeUndefined();
    expect(r.down.right).toBe(true);
    expect(STICK.zoneRight).toBeLessThan(Math.min(...TOUCH_BUTTONS.map((b) => b.x - b.r)));
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
    expect(keyText('{up} 누른 채 {punch}', 'touch')).toBe('조이스틱을 위로 민 채 펀치 버튼');
    expect(keyText('{punch} 또는 마우스 왼쪽\n펀치!', 'touch')).toBe('펀치 버튼\n펀치!');
    // 키보드 조작은 그대로
    expect(keyText('{punch} 를 꾹 눌러!', 'classic')).toBe('J 를 꾹 눌러!');
  });
});
