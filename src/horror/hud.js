// 공포 모드 글자, 안내 화면. 어두운 화면에서 잘 보이도록 3D 위에 HTML 로 올린다.
const LAYER = 'position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;background:rgba(0,0,0,.82);color:#eee;font:19px sans-serif;padding:16px;box-sizing:border-box';
const BTN = 'padding:12px 28px;margin-top:6px;font:20px sans-serif;background:#3a1414;color:#fff;border:1px solid #a33;border-radius:8px;touch-action:manipulation';

const INTRO = ['아직 시험판이에요. 파쇄자와 퓨즈는 다음 작업에서 들어갑니다.', '지금은 밤의 고철 공장을 걸어 다닐 수 있어요.'];

// 기기에 맞는 조작 안내. 지금 실제로 되는 조작만 적는다.
export function controlLines(touch) {
  if (touch) {
    return ['이동: 화면 왼쪽을 누른 채 끌기', '둘러보기: 화면 오른쪽을 누른 채 끌기', '달리기: 왼쪽을 끝까지 끌기', '손전등: 손전등 버튼', '나가기: 멈춤 버튼'];
  }
  return ['이동: W A S D 또는 방향키', '둘러보기: 마우스', '달리기: Shift 를 누른 채 이동', '손전등: F', '나가기: Esc'];
}

// 시작한 뒤 잠깐 띄우는 알림
export function startHint(touch) {
  return touch ? '왼쪽을 끌면 걷고, 오른쪽을 끌면 둘러봅니다' : 'W A S D 로 걷고 마우스로 둘러봅니다';
}

export class HorrorHud {
  constructor(root) {
    this.root = root;
    this.box = document.createElement('div');
    this.box.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;color:#ddd;font:18px sans-serif';
    this.message = this.add('position:absolute;left:0;right:0;top:18%;text-align:center;color:#ffb0a0;text-shadow:0 0 4px #000');
    this.dot = this.add('position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:rgba(255,255,255,.45)');
    root.appendChild(this.box);
    this.layer = null;
  }

  add(css) {
    const el = document.createElement('div');
    el.style.cssText = css;
    this.box.appendChild(el);
    return el;
  }

  say(text, seconds = 3) {
    this.message.textContent = text;
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => {
      this.message.textContent = '';
    }, seconds * 1000);
  }

  openLayer(lines, buttons) {
    this.closeLayer();
    this.layer = document.createElement('div');
    this.layer.style.cssText = LAYER;
    // 안내 화면을 누른 손가락이 뒤의 조이스틱이나 마우스 잠금으로 가지 않게 막는다
    this.layer.addEventListener('pointerdown', (e) => e.stopPropagation());
    for (const line of lines) {
      const p = document.createElement('div');
      p.textContent = line;
      this.layer.appendChild(p);
    }
    const made = buttons.map((b) => {
      const btn = document.createElement('button');
      btn.textContent = b.text;
      btn.style.cssText = BTN;
      // 소리와 마우스 잠금은 click 에서만 허락되는 기기가 있어 pointerdown 을 쓰지 않는다
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        b.onPress();
      });
      this.layer.appendChild(btn);
      return btn;
    });
    this.root.appendChild(this.layer);
    made[0]?.focus(); // Enter 로도 누를 수 있다
  }

  closeLayer() {
    this.layer?.remove();
    this.layer = null;
  }

  showIntro(touch, onStart, onQuit) {
    this.openLayer(
      ['꽤 무서워요. 어두운 방에서 혼자 하면 더 무섭습니다.', ...INTRO, ' ', ...controlLines(touch)],
      [{ text: '시작', onPress: onStart }, { text: '타이틀로', onPress: onQuit }],
    );
  }

  destroy() {
    clearTimeout(this.sayTimer);
    this.closeLayer();
    this.box.remove();
  }
}
