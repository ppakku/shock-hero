// 공포 모드 글자, 안내 화면. 어두운 화면에서 잘 보이도록 3D 위에 HTML 로 올린다.
const LAYER = 'position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:8px;text-align:center;background:rgba(0,0,0,.82);color:#eee;font:18px sans-serif;padding:12px;box-sizing:border-box;overflow:auto';
const NOTE_BOX = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;width:min(520px,calc(100% - 32px));max-height:calc(100% - 32px);overflow:hidden;pointer-events:none;box-sizing:border-box;padding:16px 20px;background:rgba(18,12,8,.93);color:#f0e6d0;border:1px solid #8a6a3a;border-radius:6px;font:20px/1.5 sans-serif;text-align:center';
const NOTE_PHONE = 'top:calc(50% - 16px);left:calc((100% - 170px - env(safe-area-inset-right,0px) + env(safe-area-inset-left,0px)) / 2);width:min(420px,calc(100% - 190px - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px)))'; // 170px: 오른쪽 버튼 묶음 폭
const BTN = 'padding:12px 28px;margin-top:6px;font:20px sans-serif;background:#3a1414;color:#fff;border:1px solid #a33;border-radius:8px;touch-action:manipulation';

import { fillName } from './story.js';

const INTRO = [
  '조사하러 들어왔다가 문이 잠겼다.',
  '볼트와의 통신도 끊겼다.',
  '퓨즈 3개를 찾아 전원에 꽂고 정문으로 나가자. 잠긴 문은 같은 색 열쇠로 연다.',
  '{name}는 쓰러뜨릴 수 없다. 사물함에 숨어!',
];

const TOUCH_CONTROLS = ['이동: 화면 왼쪽을 누른 채 끌기', '둘러보기: 화면 오른쪽을 누른 채 끌기', '달리기: 왼쪽을 끝까지 끌기 (체력이 줄어요)', '손전등: 손전등 버튼', '줍기, 숨기, 문 열기, 충전: 사용 버튼', '쪽지 닫기: 사용 버튼 또는 닫기 버튼', '전기충격기: 쇼크 버튼', '일시정지: 멈춤 버튼'];

const CONTROLS = {
  pc: ['조작 방법 (PC)', '이동: W A S D 또는 위아래 방향키', '둘러보기: 마우스 또는 좌우 방향키', '달리기: Shift 를 누른 채 이동 (체력이 줄어요)', '손전등: F', '줍기, 숨기, 문 열기, 충전: E', '쪽지 닫기: E 또는 Enter', '전기충격기: R 또는 왼쪽 클릭', '일시정지: Esc'],
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

// 시작 전 안내 이야기. 맨 앞은 이번 판의 맵, 괴물, 힌트다. 휴대폰은 화면이 작아서 이야기 앞의 두 줄을 빼고 맵과 힌트를 한 줄로 쓴다
// round: { mapName, monsterName, hint }
export function introLines(device, { mapName, monsterName, hint }) {
  if (device === 'phone') return [`${mapName}: ${monsterName}. ${hint}`, ...fillName(INTRO.slice(2), monsterName)];
  return [`${mapName}: ${monsterName}`, hint, ...fillName(INTRO, monsterName)];
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
  // dangerLine: 쪽지 아래에 붙는 작은 줄
  constructor(root, dangerLine) {
    this.root = root;
    this.dangerLine = dangerLine;
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
    // 손전등이 비춘 밝은 벽에서도 읽히게 그림자를 겹친다
    this.prompt = this.add('position:absolute;left:0;right:0;bottom:22%;text-align:center;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000,0 1px 6px #000');
    this.message = this.add('position:absolute;left:0;right:0;top:18%;text-align:center;color:#ffb0a0;text-shadow:0 0 4px #000');
    this.dot = this.add('position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:rgba(255,255,255,.45)');
    this.zap = this.add('position:absolute;inset:0;background:#7cc4ff;opacity:0');
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

  // keys: 가진 열쇠 수 (맵이 알려 줄 때만 보인다). notesFound/notesTotal: 쪽지
  setStatus({ have, need, shock, powered, keys, notesFound, notesTotal = 8 }) {
    const keyText = keys === undefined ? '' : `   열쇠 ${keys}`;
    const noteText = notesFound === undefined ? '' : `   쪽지 ${notesFound}/${notesTotal}`;
    this.status.textContent = `퓨즈 ${have}/${need}   쇼크 ${shock ? '충전됨' : '없음'}${keyText}${noteText}${powered ? '   전원 켜짐, 정문으로!' : ''}`;
  }

  // 쪽지 읽기. 세이노는 멈추지 않는다. Enter 나 버튼으로 닫고, 사용 키는 Game 이 closeNote 로 닫는다
  // 상자는 손가락을 그대로 통과시킨다. 쪽지 위에서도 걷고 둘러보다가 도망칠 수 있어야 한다
  get noteOpen() {
    return !!this.noteEl;
  }

  showNote(lines, compact = false) {
    this.closeNote();
    this.noteLines = lines;
    const box = document.createElement('div');
    // 휴대폰은 오른쪽 버튼을 가리지 않게 좁히고 버튼 왼쪽 공간의 가운데에 놓는다. 안내 줄이 보이게 조금 올린다
    box.style.cssText = compact ? `${NOTE_BOX};${NOTE_PHONE};font-size:15px;padding:8px 14px;line-height:1.35` : NOTE_BOX;
    for (const line of lines) {
      const p = document.createElement('div');
      p.textContent = line;
      box.appendChild(p);
    }
    const warn = document.createElement('div');
    warn.textContent = this.dangerLine;
    warn.style.cssText = `margin-top:${compact ? 4 : 10}px;font-size:${compact ? 12 : 14}px;color:#e08a7a`;
    box.appendChild(warn);
    const btn = document.createElement('button');
    btn.textContent = '닫기';
    btn.style.cssText = `${BTN};pointer-events:auto;${compact ? 'padding:6px 20px;font-size:16px;margin-top:4px' : ''}`;
    btn.addEventListener('pointerdown', (e) => e.stopPropagation()); // 닫기를 누른 손가락이 조이스틱이 되지 않게 한다
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeNote();
    });
    box.appendChild(btn);
    this.noteEl = box;
    this.noteKey = (e) => {
      if (e.code === 'Enter' && !e.repeat) {
        e.preventDefault();
        this.closeNote();
      }
    };
    window.addEventListener('keydown', this.noteKey);
    this.root.appendChild(box);
    btn.focus();
  }

  // 사용 키와 사용 버튼이 눌리면 Game 이 부른다. 열려 있었으면 true
  closeNote() {
    if (!this.noteEl) return false;
    window.removeEventListener('keydown', this.noteKey);
    this.noteEl.remove();
    this.noteEl = null;
    this.noteLines = null;
    return true;
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

  // 전기충격기를 쏘면 화면이 파랗게 번쩍인다 (초)
  flashShock(power, time) {
    this.zap.animate?.([{ opacity: power }, { opacity: 0 }], { duration: time * 1000, easing: 'ease-out' });
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

  showIntro(device, round, onStart, onQuit) {
    this.openLayer(
      ['꽤 무서워요. 어두운 방에서 혼자 하면 더 무섭습니다.', ...introLines(device, round), ...(device === 'phone' ? [] : [' ']), ...controlLines(device)],
      [{ text: '시작', onPress: onStart }, { text: '타이틀로', onPress: onQuit }],
      device === 'phone',
    );
  }

  // onNotes: 읽은 쪽지가 있을 때만 준다
  showPause(onResume, onQuit, onNotes, compact = false) {
    const buttons = [{ text: '계속하기', onPress: onResume }];
    if (onNotes) buttons.push({ text: '읽은 쪽지', onPress: onNotes });
    buttons.push({ text: '타이틀로', onPress: onQuit });
    this.openLayer(['일시정지'], buttons, compact);
  }

  // 읽은 쪽지를 한 장씩 보여 준다. notes: 줄 배열의 배열. 처음에는 가장 최근 쪽지를 보여 준다
  showReadNotes(notes, onBack, compact = false, page = notes.length - 1) {
    const go = (n) => () => this.showReadNotes(notes, onBack, compact, n);
    const buttons = [];
    if (page > 0) buttons.push({ text: '이전 쪽지', onPress: go(page - 1) });
    if (page < notes.length - 1) buttons.push({ text: '다음 쪽지', onPress: go(page + 1) });
    buttons.push({ text: '돌아가기', onPress: onBack });
    this.openLayer([`읽은 쪽지 ${page + 1}/${notes.length}`, ...notes[page]], buttons, compact);
  }

  hidePause() {
    this.closeLayer();
  }

  // notes: { found, total, final } 를 주면 쪽지 수를 보여 주고, 다 모았으면 마지막 한 줄을 더한다
  showEnd(text, onAgain, onDone, notes) {
    const lines = [text];
    if (notes) {
      lines.push(`쪽지 ${notes.found}/${notes.total}`);
      if (notes.total > 0 && notes.found >= notes.total) lines.push(notes.final);
    }
    this.openLayer(lines, [{ text: '한 판 더', onPress: onAgain }, { text: '타이틀로', onPress: onDone }]);
  }

  destroy() {
    clearTimeout(this.sayTimer);
    this.closeNote();
    this.closeLayer();
    this.box.remove();
    this.slit.remove();
    this.notice.remove();
  }
}
