// 공포 모드 입력. 키보드와 마우스, 터치를 같은 모양으로 읽는다.
import { moveFromKeys, moveFromStick, keyTurn } from '../logic/horrorInput.js';

const STICK_MAX = 70; // 조이스틱 반지름 (px)
const RUN_AT = 0.92; // 이만큼 밀면 달린다
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'turnLeft', KeyD: 'right', ArrowRight: 'turnRight', ShiftLeft: 'run', ShiftRight: 'run' };
const PRESS = { KeyF: 'light', KeyE: 'use', KeyJ: 'punch', Escape: 'pause' };
const SMALL_BUTTONS = 0.68;
const BUTTONS = [
  { id: 'light', label: '손전등', right: 150, bottom: 110 },
  { id: 'use', label: '사용', right: 40, bottom: 150 },
  { id: 'punch', label: '펀치', right: 40, bottom: 40 },
  { id: 'pause', label: '멈춤', right: 40, bottom: 262 },
];

export class HorrorInput {
  constructor(el, { touch, small, k }) {
    this.el = el;
    this.touch = touch;
    this.small = small; // 휴대폰은 화면이 작아서 버튼을 줄인다
    this.k = k;
    this.keys = {};
    this.look = { x: 0, y: 0 };
    this.pressed = {};
    this.stick = null;
    this.lookTouch = null;
    this.off = [];
    this.buttons = [];
    this.bindKeys();
    this.bindMouse(); // 터치 노트북도 마우스로 둘러볼 수 있게 항상 묶는다
    if (touch) this.bindTouch();
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.off.push(() => target.removeEventListener(type, fn, opts));
  }

  bindKeys() {
    this.on(window, 'keydown', (e) => {
      if (KEYS[e.code]) this.keys[KEYS[e.code]] = true;
      if (PRESS[e.code] && !e.repeat) this.pressed[PRESS[e.code]] = true;
    });
    this.on(window, 'keyup', (e) => {
      if (KEYS[e.code]) this.keys[KEYS[e.code]] = false;
    });
    this.on(window, 'blur', () => {
      this.keys = {}; // 창을 나가면 키 떼는 소리를 못 받는다
      this.clearTouch();
    });
  }

  bindMouse() {
    this.on(this.el, 'pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return; // 손가락은 bindTouch 가 맡는다
      if (document.pointerLockElement === this.el) this.pressed.punch = true;
      else this.relock();
    });
    this.on(document, 'mousemove', (e) => {
      if (document.pointerLockElement !== this.el) return;
      this.look.x += e.movementX * this.k.lookSpeed;
      this.look.y += e.movementY * this.k.lookSpeed;
    });
    this.on(document, 'pointerlockchange', () => {
      if (document.pointerLockElement !== this.el) this.pressed.pause = true; // Esc 로 마우스가 풀리면 일시정지
    });
  }

  bindTouch() {
    this.on(this.el, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.clientX < window.innerWidth / 2) {
        if (!this.stick) this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      } else if (!this.lookTouch) this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    this.on(this.el, 'pointermove', (e) => {
      if (this.stick?.id === e.pointerId) Object.assign(this.stick, { x: e.clientX, y: e.clientY });
      if (this.lookTouch?.id === e.pointerId) {
        this.look.x += (e.clientX - this.lookTouch.x) * this.k.touchLookSpeed;
        this.look.y += (e.clientY - this.lookTouch.y) * this.k.touchLookSpeed;
        Object.assign(this.lookTouch, { x: e.clientX, y: e.clientY });
      }
    });
    const up = (e) => {
      if (this.stick?.id === e.pointerId) this.stick = null;
      if (this.lookTouch?.id === e.pointerId) this.lookTouch = null;
    };
    this.on(this.el, 'pointerup', up);
    this.on(this.el, 'pointercancel', up);
    for (const b of BUTTONS) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      const scale = this.small ? SMALL_BUTTONS : 1;
      btn.style.cssText = `position:absolute;right:calc(${b.right * scale}px + env(safe-area-inset-right, 0px));bottom:calc(${b.bottom * scale}px + env(safe-area-inset-bottom, 0px));width:${92 * scale}px;height:${92 * scale}px;border-radius:50%;border:2px solid #777;background:rgba(40,40,40,.55);color:#eee;font:16px sans-serif;z-index:3;touch-action:none`;
      this.on(btn, 'pointerdown', (e) => {
        e.preventDefault(); // 손가락을 뗀 뒤 같은 자리로 마우스 클릭이 새어 나가 타이틀 버튼을 누르는 일을 막는다
        e.stopPropagation();
        this.pressed[b.id] = true;
      });
      this.el.appendChild(btn);
      this.buttons.push(btn);
    }
  }

  // 손가락을 뗀 소식을 못 받을 수 있을 때 부른다. 안 그러면 혼자 걷거나 시점이 튄다
  clearTouch() {
    this.stick = null;
    this.lookTouch = null;
  }

  read(dt = 0) {
    const s = this.stick;
    const out = {
      move: s ? moveFromStick(s.x - s.x0, s.y - s.y0, STICK_MAX, RUN_AT) : moveFromKeys(this.keys),
      lookX: this.look.x + keyTurn(this.keys, this.k.keyTurnSpeed, dt),
      lookY: this.look.y,
      light: Boolean(this.pressed.light),
      use: Boolean(this.pressed.use),
      punch: Boolean(this.pressed.punch),
      pause: Boolean(this.pressed.pause),
    };
    this.look = { x: 0, y: 0 };
    this.pressed = {};
    return out;
  }

  // 마우스를 화면에 잠근다. 막히면 화면을 한 번 누르면 다시 잠긴다.
  locked() {
    return document.pointerLockElement === this.el;
  }

  relock(onDenied = () => {}) {
    if (!this.touch) this.el.requestPointerLock?.()?.catch?.(onDenied);
  }

  destroy() {
    this.off.forEach((f) => f());
    this.buttons.forEach((b) => b.remove());
    if (document.pointerLockElement === this.el) document.exitPointerLock?.();
  }
}
