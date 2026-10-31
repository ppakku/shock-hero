// 공포 모드 입력. 키보드와 마우스, 터치를 같은 모양으로 읽는다.
import { moveFromKeys, moveFromStick } from '../logic/horrorInput.js';

const STICK_MAX = 70; // 조이스틱 반지름 (px)
const RUN_AT = 0.92; // 이만큼 밀면 달린다
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
const PRESS = { KeyF: 'light', KeyE: 'use', Escape: 'pause' };
const BUTTONS = [
  { id: 'light', label: '손전등', right: 150, bottom: 110 },
  { id: 'use', label: '사용', right: 40, bottom: 150 },
  { id: 'punch', label: '펀치', right: 40, bottom: 40 },
  { id: 'pause', label: '멈춤', right: 40, bottom: 262 },
];

export class HorrorInput {
  constructor(el, { touch, k }) {
    this.el = el;
    this.touch = touch;
    this.k = k;
    this.keys = {};
    this.look = { x: 0, y: 0 };
    this.pressed = {};
    this.stick = null;
    this.lookTouch = null;
    this.off = [];
    this.buttons = [];
    if (touch) this.bindTouch();
    else this.bindMouse();
    this.bindKeys();
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
  }

  bindMouse() {
    this.on(this.el, 'mousedown', () => {
      if (document.pointerLockElement === this.el) this.pressed.punch = true;
      else this.el.requestPointerLock?.();
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
      btn.style.cssText = `position:absolute;right:${b.right}px;bottom:${b.bottom}px;width:92px;height:92px;border-radius:50%;border:2px solid #777;background:rgba(40,40,40,.55);color:#eee;font:16px sans-serif;z-index:3;touch-action:none`;
      this.on(btn, 'pointerdown', (e) => {
        e.stopPropagation();
        this.pressed[b.id] = true;
      });
      this.el.appendChild(btn);
      this.buttons.push(btn);
    }
  }

  read() {
    const s = this.stick;
    const out = {
      move: s ? moveFromStick(s.x - s.x0, s.y - s.y0, STICK_MAX, RUN_AT) : moveFromKeys(this.keys),
      lookX: this.look.x,
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

  destroy() {
    this.off.forEach((f) => f());
    this.buttons.forEach((b) => b.remove());
    if (document.pointerLockElement === this.el) document.exitPointerLock?.();
  }
}
