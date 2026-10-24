// 태블릿 터치 버튼. 키보드가 없는 기기에서 화면 위에 버튼을 그리고, 손가락 위치로 누름을 읽는다.
// 좌표는 게임 화면(960 x 540) 기준. HUD 장면은 카메라가 움직이지 않아서 그대로 쓴다.
// 버튼 위치나 크기를 바꾸고 싶으면 아래 숫자만 고치면 된다 (r = 반지름).
export const TOUCH_BUTTONS = [
  { id: 'left', label: '◀', x: 66, y: 478, r: 38 },
  { id: 'right', label: '▶', x: 158, y: 478, r: 38 },
  { id: 'up', label: '▲', x: 112, y: 394, r: 32 }, // 누른 채 펀치하면 어퍼컷
  { id: 'jump', label: '점프', x: 752, y: 488, r: 38 },
  { id: 'attack', label: '펀치', x: 868, y: 462, r: 48 },
  { id: 'dash', label: '대시', x: 768, y: 400, r: 32 },
  { id: 'ult', label: '궁극기', x: 880, y: 362, r: 32 },
];

// 일시정지 버튼 (오른쪽 위, 시간 글자 아래)
export const PAUSE_BUTTON = { x: 916, y: 94, r: 22 };

// 손가락이 버튼 테두리 조금 밖을 눌러도 눌린 걸로 친다 (아이 손가락은 자주 빗나간다)
const SLACK = 1.25;

// (x, y) 에 있는 버튼. 여러 개에 걸치면 가운데가 가장 가까운 것.
export function buttonAt(x, y, buttons = TOUCH_BUTTONS) {
  let best = null;
  let bestD = Infinity;
  for (const b of buttons) {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d <= b.r * SLACK && d / b.r < bestD) {
      best = b;
      bestD = d / b.r;
    }
  }
  return best;
}

// 터치 버튼을 보여 줄 기기인가. 주소에 ?touch 를 붙이면 컴퓨터에서도 켜고, ?notouch 면 끈다.
// 아이패드는 사파리가 자기를 맥이라고 알려서 기기 이름 대신 "손가락으로 누르는 화면" 인지로 본다.
export function isTouchDevice(win = globalThis.window) {
  if (!win) return false;
  const q = new URLSearchParams(win.location?.search || '');
  if (q.has('touch')) return true;
  if (q.has('notouch')) return false;
  const points = win.navigator?.maxTouchPoints || 0;
  const coarse = !!win.matchMedia?.('(pointer: coarse)')?.matches;
  return points > 0 && coarse;
}

// 매 프레임 손가락 위치들을 받아서 어떤 버튼이 눌려 있는지(down), 이번에 막 눌렸는지(pressed) 알려 준다.
// 손가락을 미끄러뜨려 ◀ 에서 ▶ 로 옮겨도 따라간다.
export class TouchPad {
  constructor(buttons = TOUCH_BUTTONS) {
    this.buttons = buttons;
    this.down = {};
    this.pressed = {};
  }

  poll(points) {
    const now = {};
    for (const p of points) {
      const b = buttonAt(p.x, p.y, this.buttons);
      if (b) now[b.id] = true;
    }
    const pressed = {};
    for (const id of Object.keys(now)) if (!this.down[id]) pressed[id] = true;
    this.down = now;
    this.pressed = pressed;
    return { down: now, pressed };
  }

  reset() {
    this.down = {};
    this.pressed = {};
  }
}

export const touchPad = new TouchPad();

// Phaser 장면에서 지금 화면을 누르고 있는 손가락들 (마우스는 빼고)
export function touchPoints(scene) {
  return scene.input.manager.pointers.filter((p) => p.isDown && p.wasTouch).map((p) => ({ x: p.x, y: p.y }));
}
