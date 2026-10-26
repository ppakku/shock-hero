// 태블릿 터치 조작. 키보드가 없는 기기에서 화면 위에 조이스틱과 버튼을 그리고, 손가락 위치로 누름을 읽는다.
// 좌표는 게임 화면(960 x 540) 기준. HUD 장면은 카메라가 움직이지 않아서 그대로 쓴다.
//
// 왼쪽 절반: 떠다니는 조이스틱. 아무 데나 엄지를 대면 그 자리가 가운데가 되고, 끄는 방향으로 움직인다.
//           위로 밀면 어퍼컷 조준 (키보드의 W, ↑).
// 오른쪽: 점프, 펀치, 대시, 궁극기 버튼.
// 버튼 위치나 크기를 바꾸고 싶으면 아래 숫자만 고치면 된다 (r = 반지름).
export const TOUCH_BUTTONS = [
  { id: 'jump', label: '점프', x: 782, y: 496, r: 30 },
  { id: 'attack', label: '펀치', x: 884, y: 474, r: 40 },
  { id: 'dash', label: '대시', x: 790, y: 418, r: 26 },
  { id: 'ult', label: '궁극기', x: 892, y: 392, r: 26 },
];

// 일시정지 버튼 (오른쪽 위, 시간 글자 아래)
export const PAUSE_BUTTON = { x: 920, y: 92, r: 19 };

export const STICK = {
  zoneRight: 480, // 이 x 보다 왼쪽에서 누르면 조이스틱
  zoneTop: 140, // 위쪽 체력바 근처는 빼기
  radius: 50, // 손잡이가 움직이는 거리. 더 멀리 끌면 가운데가 따라온다
  dead: 14, // 이만큼은 움직여야 걷기 시작 (살짝 닿은 건 무시)
  up: 20, // 위로 이만큼 밀면 위쪽 조준 (어퍼컷, 에너지탄 위로)
  hint: { x: 130, y: 440 }, // 손가락을 안 댔을 때 흐리게 보여 주는 자리
};

// 휴대폰은 게임 화면이 원래의 60 ~ 70% 로 줄어서 버튼을 크게, 화면 가장자리 쪽으로 둔다.
// 가장 작은 버튼도 실제 화면에서 지름 44px (손가락으로 누르기 좋은 크기) 이상이 되게 맞췄다.
export const PHONE_BUTTONS = {
  jump: { x: 772, y: 494, r: 40 },
  attack: { x: 894, y: 478, r: 52 },
  dash: { x: 782, y: 398, r: 36 },
  ult: { x: 900, y: 366, r: 36 },
};
export const PHONE_PAUSE = { x: 916, y: 100, r: 26 };
export const PHONE_STICK = { radius: 58, hint: { x: 140, y: 430 } };

// 휴대폰 크기로 바꾼다 (main.js 가 게임을 만들기 전에 한 번 부른다). 모든 장면이 같은 값을 보게 그 자리에서 고친다.
export function usePhoneLayout() {
  for (const b of TOUCH_BUTTONS) Object.assign(b, PHONE_BUTTONS[b.id]);
  Object.assign(PAUSE_BUTTON, PHONE_PAUSE);
  Object.assign(STICK, PHONE_STICK);
}

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

export function inStickZone(x, y, s = STICK) {
  return x < s.zoneRight && y > s.zoneTop;
}

// 조이스틱을 가운데에서 (dx, dy) 만큼 끌었을 때 방향.
// 위쪽(위에서 좌우 45도 안)으로 밀면 걷지 않고 위쪽 조준만 한다. 엄지로 위를 밀면 옆으로도 조금 밀리는데,
// 그걸 걷기로 치면 에너지탄이 대각선으로 나가서 바로 위로 쏠 수가 없었다.
export function stickDirs(dx, dy, s = STICK) {
  const up = dy < -s.up && Math.abs(dx) <= -dy;
  return {
    left: !up && dx < -s.dead,
    right: !up && dx > s.dead,
    up,
  };
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

// 휴대폰인가 (태블릿보다 화면이 작아서 버튼과 글자를 키운다). 화면의 짧은 쪽이 600 보다 작으면 휴대폰으로 본다.
// 주소에 ?phone 을 붙이면 컴퓨터에서도 휴대폰처럼 (확인용), ?nophone 이면 끈다.
export function isPhone(win = globalThis.window) {
  if (!win) return false;
  const q = new URLSearchParams(win.location?.search || '');
  if (q.has('phone')) return true;
  if (q.has('nophone')) return false;
  const sc = win.screen || {};
  return isTouchDevice(win) && Math.min(sc.width || 0, sc.height || 0) > 0 && Math.min(sc.width, sc.height) < 600;
}

// 매 프레임 손가락들을 받아서 어떤 동작이 눌려 있는지(down), 이번에 막 눌렸는지(pressed) 알려 준다.
// 손가락 = { id, x, y }. 조이스틱은 처음 왼쪽에 닿은 손가락 하나가 맡고, 뗄 때까지 그 손가락만 따라간다.
export class TouchPad {
  constructor(buttons = TOUCH_BUTTONS, stick = STICK) {
    this.buttons = buttons;
    this.cfg = stick;
    this.reset();
  }

  poll(points) {
    const now = {};
    const s = this.cfg;
    let stickPt = this.stick && points.find((p) => p.id === this.stick.id);
    if (!stickPt) {
      this.stick = null;
      const p = points.find((q) => inStickZone(q.x, q.y, s) && !buttonAt(q.x, q.y, this.buttons));
      if (p) {
        this.stick = { id: p.id, ax: p.x, ay: p.y, x: p.x, y: p.y };
        stickPt = p;
      }
    }
    if (stickPt) {
      const st = this.stick;
      let dx = stickPt.x - st.ax;
      let dy = stickPt.y - st.ay;
      const d = Math.hypot(dx, dy);
      // 너무 멀리 끌면 가운데가 손가락 쪽으로 따라온다 (반대로 바꿀 때 바로 반응하게)
      if (d > s.radius) {
        st.ax = stickPt.x - (dx / d) * s.radius;
        st.ay = stickPt.y - (dy / d) * s.radius;
        dx = stickPt.x - st.ax;
        dy = stickPt.y - st.ay;
      }
      st.x = stickPt.x;
      st.y = stickPt.y;
      const dirs = stickDirs(dx, dy, s);
      for (const k of Object.keys(dirs)) if (dirs[k]) now[k] = true;
    }
    for (const p of points) {
      if (stickPt && p.id === stickPt.id) continue;
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
    this.stick = null;
  }
}

export const touchPad = new TouchPad();

// Phaser 장면에서 지금 화면을 누르고 있는 손가락들 (마우스는 빼고)
export function touchPoints(scene) {
  return scene.input.manager.pointers.filter((p) => p.isDown && p.wasTouch).map((p) => ({ id: p.id, x: p.x, y: p.y }));
}

// 화면 버튼과 조이스틱 그리기 (HUD 와 함께하기 친구 화면이 같이 쓴다).
// g: Phaser Graphics, labels: 버튼 글자들 (TOUCH_BUTTONS 순서), pad: 지금 상태의 TouchPad, ultReady: 궁극기 준비됨
export function drawTouchButtons(g, labels, pad, ultReady = false) {
  // 버튼은 게임이 잘 보이게 흐릿하게, 누르는 동안만 또렷하게
  TOUCH_BUTTONS.forEach((b, i) => {
    const down = !!pad.down[b.id];
    const glow = b.id === 'ult' && ultReady;
    g.fillStyle(down ? 0xffffff : glow ? 0x3fd0ff : 0x000000, down ? 0.35 : glow ? 0.3 : 0.14).fillCircle(b.x, b.y, b.r);
    g.lineStyle(3, glow ? 0x9fe8ff : 0xffffff, down ? 0.8 : glow ? 0.6 : 0.32).strokeCircle(b.x, b.y, b.r);
    labels[i]?.setAlpha(down ? 0.95 : glow ? 0.8 : 0.5);
  });
  // 왼쪽 조이스틱: 엄지를 댄 자리에 받침, 엄지 쪽에 손잡이. 안 댔으면 왼쪽 아래에 흐리게.
  const st = pad.stick;
  const r = STICK.radius;
  if (!st) {
    const h = STICK.hint;
    g.fillStyle(0x000000, 0.1).fillCircle(h.x, h.y, r + 12);
    g.lineStyle(3, 0xffffff, 0.22).strokeCircle(h.x, h.y, r + 12);
    g.fillStyle(0xffffff, 0.18).fillCircle(h.x, h.y, 24);
    return;
  }
  g.fillStyle(0x000000, 0.16).fillCircle(st.ax, st.ay, r + 12);
  g.lineStyle(3, 0xffffff, 0.4).strokeCircle(st.ax, st.ay, r + 12);
  let dx = st.x - st.ax;
  let dy = st.y - st.ay;
  const d = Math.hypot(dx, dy);
  if (d > r) {
    dx = (dx / d) * r;
    dy = (dy / d) * r;
  }
  g.fillStyle(0xffffff, 0.45).fillCircle(st.ax + dx, st.ay + dy, 26);
}
