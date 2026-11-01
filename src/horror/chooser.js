// 공포 모드에 들어가면 맨 먼저 나오는 맵과 괴물 고르기 화면
import { MAP_IDS, MONSTER_IDS, RANDOM } from '../logic/horrorPick.js';
import { MAPS, MONSTERS } from './content.js';

const RANDOM_MAP = '어디가 나올지 몰라요';
const RANDOM_MONSTER = '무엇이 나올지 몰라요';
const LAYER = 'position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;box-sizing:border-box;background:#050506;color:#ddd;text-align:center;overflow:auto';
const TITLE = 'font-size:26px;color:#e8d8c8';
const LABEL = 'font-size:15px;color:#9a9a9a';
const ROW = 'display:flex;flex-wrap:wrap;justify-content:center;gap:10px';
const HINT = 'min-height:22px;font-size:15px;color:#c8a890';
const OPTION = 'font:17px sans-serif;padding:10px 16px;min-width:112px;border-radius:8px;cursor:pointer;touch-action:manipulation';
const ON = 'background:#6a1f1f;color:#fff;border:2px solid #e8a080';
const OFF = 'background:#16161a;color:#bbb;border:2px solid #3a3a42';
const GO = 'font:20px sans-serif;padding:12px 40px;border-radius:8px;border:2px solid #e8a080;background:#3a1212;color:#fff;cursor:pointer;touch-action:manipulation';
const BACK = 'font:16px sans-serif;padding:10px 24px;border-radius:8px;border:2px solid #3a3a42;background:#16161a;color:#bbb;cursor:pointer;touch-action:manipulation';

// 맵 칸과 괴물 칸의 이름과 설명. 랜덤 칸이 맨 뒤에 온다
export function chooserOptions() {
  return {
    mapId: [...MAP_IDS.map((id) => ({ id, name: MAPS[id].name, hint: MAPS[id].blurb })), { id: RANDOM, name: '랜덤', hint: RANDOM_MAP }],
    monsterId: [...MONSTER_IDS.map((id) => ({ id, name: MONSTERS[id].name, hint: MONSTERS[id].hint })), { id: RANDOM, name: '랜덤', hint: RANDOM_MONSTER }],
  };
}

// choice: { mapId, monsterId }. onStart 에 고른 값을 준다. 화면은 스스로 닫는다
export function showChooser(root, { choice, compact, onStart, onQuit }) {
  const picked = { ...choice };
  const layer = document.createElement('div');
  layer.dataset.chooser = '';
  layer.style.cssText = compact ? `${LAYER};gap:5px;padding:6px` : LAYER;
  const add = (tag, css, text = '') => {
    const el = document.createElement(tag);
    el.style.cssText = css;
    el.textContent = text;
    return el;
  };
  const close = (fn) => () => {
    layer.remove();
    fn();
  };
  const section = (label, key, options) => {
    const row = add('div', ROW);
    const hint = add('div', HINT);
    const buttons = options.map((o) => {
      const btn = add('button', '', o.name);
      btn.dataset.pick = o.id;
      btn.addEventListener('click', () => {
        picked[key] = o.id;
        paint();
      });
      row.appendChild(btn);
      return { btn, o };
    });
    const paint = () => buttons.forEach(({ btn, o }) => {
      const on = picked[key] === o.id;
      btn.style.cssText = `${OPTION};${on ? ON : OFF}${compact ? ';font-size:14px;padding:6px 10px;min-width:92px' : ''}`;
      btn.setAttribute('aria-pressed', String(on));
      if (on) hint.textContent = o.hint;
    });
    paint();
    layer.append(add('div', LABEL, label), row, hint);
  };
  const options = chooserOptions();
  if (!compact) layer.appendChild(add('div', TITLE, '어디로 들어갈까요?'));
  section('맵', 'mapId', options.mapId);
  section('누가 기다릴까요', 'monsterId', options.monsterId);
  const actions = add('div', ROW);
  const go = add('button', compact ? `${GO};font-size:16px;padding:6px 28px` : GO, '들어가기');
  const back = add('button', compact ? `${BACK};padding:6px 18px` : BACK, '타이틀로');
  go.addEventListener('click', close(() => onStart({ ...picked })));
  back.addEventListener('click', close(onQuit));
  actions.append(go, back);
  layer.appendChild(actions);
  root.appendChild(layer);
  go.focus(); // Enter 로도 누를 수 있다
}
