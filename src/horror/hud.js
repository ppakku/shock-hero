// 공포 모드 글자, 안내 화면. 어두운 화면에서 잘 보이도록 3D 위에 HTML 로 올린다.
const LAYER = 'position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:8px;text-align:center;background:rgba(0,0,0,.82);color:#eee;font:18px sans-serif;padding:12px;box-sizing:border-box;overflow:auto';
const BTN = 'padding:12px 28px;margin-top:6px;font:20px sans-serif;background:#3a1414;color:#fff;border:1px solid #a33;border-radius:8px;touch-action:manipulation';

export const MONSTER_NAME = '세이노';

const INTRO = [
  '밤의 고철 공장을 조사하다가 문이 잠겼다.',
  '볼트와의 통신도 끊겼다.',
  '퓨즈 3개를 찾아 전원에 꽂고 정문으로 나가자.',
  '달리면 소리가 나고, 손전등 빛은 들킨다.',
  `${MONSTER_NAME}는 쓰러뜨릴 수 없다. 사물함에 숨어!`,
];

const TOUCH_CONTROLS = ['이동: 화면 왼쪽을 누른 채 끌기', '둘러보기: 화면 오른쪽을 누른 채 끌기', '달리기: 왼쪽을 끝까지 끌기 (체력이 줄어요)', '손전등: 손전등 버튼', '줍기와 숨기, 충전: 사용 버튼', '쇼크 펀치: 펀치 버튼', '일시정지: 멈춤 버튼'];

const CONTROLS = {
  pc: ['조작 방법 (PC)', '이동: W A S D 또는 위아래 방향키', '둘러보기: 마우스 또는 좌우 방향키', '달리기: Shift 를 누른 채 이동 (체력이 줄어요)', '손전등: F', '줍기와 숨기, 충전: E', '쇼크 펀치: J 또는 왼쪽 클릭', '일시정지: Esc'],
  tablet: ['조작 방법 (태블릿)', ...TOUCH_CONTROLS],
  phone: ['조작 방법 (휴대폰, 가로로 눕혀 주세요)', ...TOUCH_CONTROLS],
};

const HINTS = {
  pc: 'W A S D 로 걷고 마우스나 좌우 방향키로 둘러봅니다',
  tablet: '왼쪽을 끌면 걷고, 오른쪽을 끌면 둘러봅니다',
  phone: '왼쪽을 끌면 걷고, 오른쪽을 끌면 둘러봅니다',
};

// 기기에 맞는 조작 안내. device: 'pc' | 'tablet' | 'phone'
export function controlLines(device) {
  return CONTROLS[device] ?? CONTROLS.pc;
}

// 시작한 뒤 잠깐 띄우는 알림
export function startHint(device) {
  return HINTS[device] ?? HINTS.pc;
}

// 끝 화면 글자. 이번에 실제로 받은 보석만 말한다 (reward: logic/horrorRun.js 의 escapeReward)
export function escapeText({ gems, daily, bonus }, clean) {
  if (!gems) return `탈출 성공! 오늘은 이미 보석을 받았어요${clean ? ' (한 번도 안 잡혔어요!)' : ''}`;
  if (!daily) return `탈출 성공! 처음으로 한 번도 안 잡혔어요! 보석 ${bonus}개. 탈출 보석은 오늘 이미 받았어요`;
  if (bonus) return `탈출 성공! 보석 ${gems}개 (처음으로 한 번도 안 잡혔어요!)`;
  return `탈출 성공! 보석 ${gems}개${clean ? ' (한 번도 안 잡혔어요!)' : ''}`;
}

export class HorrorHud {
  constructor(root) {
    this.root = root;
    this.box = document.createElement('div');
    // 휴대폰 노치에 글자가 가리지 않게 안전 여백만큼 안쪽에 놓는다
    this.box.style.cssText = 'position:absolute;top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px);z-index:4;pointer-events:none;color:#ddd;font:18px sans-serif';
    this.status = this.add('position:absolute;left:16px;top:12px;text-shadow:0 0 4px #000');
    // 달리기 체력 막대. 다 쓰면 빨갛게 바뀐다
    this.add('position:absolute;left:16px;top:35px;font-size:13px;text-shadow:0 0 4px #000').textContent = '체력';
    this.staminaBar = this.add('position:absolute;left:52px;top:39px;width:130px;height:8px;border:1px solid rgba(255,255,255,.45);border-radius:4px;overflow:hidden;background:rgba(0,0,0,.5)');
    this.staminaFill = document.createElement('div');
    this.staminaFill.style.cssText = 'width:100%;height:100%;background:#e8b84a';
    this.staminaBar.appendChild(this.staminaFill);
    this.staminaShown = 100;
    this.prompt = this.add('position:absolute;left:0;right:0;bottom:22%;text-align:center;text-shadow:0 0 4px #000');
    this.message = this.add('position:absolute;left:0;right:0;top:18%;text-align:center;color:#ffb0a0;text-shadow:0 0 4px #000');
    this.dot = this.add('position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:rgba(255,255,255,.45)');
    this.black = this.add('position:absolute;inset:0;background:#000;opacity:0;transition:opacity .35s');
    root.appendChild(this.box);
    // 틈 화면은 글자 밑, 터치 버튼 밑에 깐다. 숨은 채로도 사용 버튼이 보여야 나올 수 있다
    this.slit = document.createElement('div');
    this.slit.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;display:none;background:linear-gradient(90deg,#000 0 40%,transparent 44% 56%,#000 60% 100%)';
    root.appendChild(this.slit);
    // 안내 화면 위에도 보이는 알림. 화면이 꺼졌을 때 쓴다
    this.notice = document.createElement('div');
    this.notice.style.cssText = 'position:absolute;left:12px;right:12px;top:10%;z-index:6;pointer-events:none;text-align:center;color:#ffd080;font:20px sans-serif;text-shadow:0 0 4px #000';
    root.appendChild(this.notice);
    this.layer = null;
  }

  add(css) {
    const el = document.createElement('div');
    el.style.cssText = css;
    this.box.appendChild(el);
    return el;
  }

  setStatus({ have, need, shock, powered }) {
    this.status.textContent = `퓨즈 ${have}/${need}   쇼크 ${shock ? '충전됨' : '없음'}${powered ? '   전원 켜짐, 정문으로!' : ''}`;
  }

  // 매 프레임 불린다. 글자가 같으면 화면을 건드리지 않는다
  setStamina({ value, tired }) {
    const shown = Math.round(value * 100) * (tired ? -1 : 1) - (tired ? 1 : 0);
    if (shown === this.staminaShown) return; // 매 프레임 화면을 고치지 않는다
    this.staminaShown = shown;
    this.staminaFill.style.width = `${value * 100}%`;
    this.staminaFill.style.background = tired ? '#d0402c' : '#e8b84a';
  }

  setPrompt(text) {
    if (text === this.promptText) return;
    this.promptText = text;
    this.prompt.textContent = text;
  }

  say(text, seconds = 3) {
    this.message.textContent = text;
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => {
      this.message.textContent = '';
    }, seconds * 1000);
  }

  setNotice(text) {
    this.notice.textContent = text;
  }

  showSlit(on) {
    this.slit.style.display = on ? 'block' : 'none';
  }

  fade(on) {
    this.black.style.opacity = on ? '1' : '0';
  }

  // compact: 휴대폰 가로 화면에 다 들어가게 글자를 줄이고 버튼을 옆으로 놓는다
  openLayer(lines, buttons, compact = false) {
    this.closeLayer();
    this.layer = document.createElement('div');
    this.layer.style.cssText = compact ? `${LAYER};gap:2px;font-size:14px;padding:6px` : LAYER;
    // 안내 화면을 누른 손가락이 뒤의 조이스틱이나 마우스 잠금으로 가지 않게 막는다
    this.layer.addEventListener('pointerdown', (e) => e.stopPropagation());
    for (const line of lines) {
      const p = document.createElement('div');
      p.textContent = line;
      this.layer.appendChild(p);
    }
    const row = document.createElement('div');
    row.style.cssText = compact ? 'display:flex;gap:16px' : 'display:flex;flex-direction:column;align-items:center;gap:18px';
    const made = buttons.map((b) => {
      const btn = document.createElement('button');
      btn.textContent = b.text;
      btn.style.cssText = BTN;
      // 소리와 마우스 잠금은 click 에서만 허락되는 기기가 있어 pointerdown 을 쓰지 않는다
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        b.onPress();
      });
      row.appendChild(btn);
      return btn;
    });
    this.layer.appendChild(row);
    this.root.appendChild(this.layer);
    made[0]?.focus(); // Enter 로도 누를 수 있다
  }

  closeLayer() {
    this.layer?.remove();
    this.layer = null;
  }

  showIntro(device, onStart, onQuit) {
    this.openLayer(
      ['꽤 무서워요. 어두운 방에서 혼자 하면 더 무섭습니다.', ...(device === 'phone' ? INTRO.slice(2) : INTRO), ...(device === 'phone' ? [] : [' ']), ...controlLines(device)],
      [{ text: '시작', onPress: onStart }, { text: '타이틀로', onPress: onQuit }],
      device === 'phone',
    );
  }

  showPause(onResume, onQuit) {
    this.openLayer(['일시정지'], [{ text: '계속하기', onPress: onResume }, { text: '타이틀로', onPress: onQuit }]);
  }

  hidePause() {
    this.closeLayer();
  }

  showEnd(text, onDone) {
    this.openLayer([text], [{ text: '타이틀로', onPress: onDone }]);
  }

  destroy() {
    clearTimeout(this.sayTimer);
    this.closeLayer();
    this.box.remove();
    this.slit.remove();
    this.notice.remove();
  }
}
