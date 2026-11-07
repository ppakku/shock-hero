// 공포 모드에 들어가면 맨 먼저 나오는 맵과 괴물 고르기 화면
import { FOREST_MONSTER_ID, LAST_ROUND, MAP_IDS, MONSTER_IDS, RANDOM, roundMonsters } from '../logic/horrorPick.js';
import { boardCells, boardSize, cellKey, cssColor, goldCount, isCurrentCell, lookOptions, nextUnlock, stampCount, stampsLeft, GOLD } from '../logic/horrorStamps.js';
import { tonightPaid, tonightRuleText } from '../logic/horrorTonight.js';
import { cfg } from '../config/index.js';
import { FOREST_PLACE, MAPS, MONSTERS, SPECIAL_MONSTERS } from './content.js';

const RANDOM_MAP = '어디가 나올지 몰라요';
const RANDOM_MONSTER = '무엇이 나올지 몰라요';
const LAYER = 'position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:14px;padding:16px;box-sizing:border-box;background:#050506;color:#ddd;text-align:center;overflow:auto';
const TITLE = 'font-size:26px;color:#e8d8c8';
const LABEL = 'font-size:15px;color:#9a9a9a';
const ROW = 'display:flex;flex-wrap:wrap;justify-content:center;gap:10px';
const HINT = 'min-height:22px;font-size:15px;color:#c8a890';
const OPTION = 'font:17px sans-serif;padding:10px 16px;min-width:112px;border-radius:8px;cursor:pointer;touch-action:manipulation';
const ON = 'background:#6a1f1f;color:#fff;border:2px solid #e8a080';
const OFF = 'background:#16161a;color:#bbb;border:2px solid #3a3a42';
const GO = 'font:20px sans-serif;padding:12px 40px;border-radius:8px;border:2px solid #e8a080;background:#3a1212;color:#fff;cursor:pointer;touch-action:manipulation';
const BACK = 'font:16px sans-serif;padding:10px 24px;border-radius:8px;border:2px solid #3a3a42;background:#16161a;color:#bbb;cursor:pointer;touch-action:manipulation';
const BODY = 'display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:32px';
const SIDE = 'display:flex;flex-direction:column;align-items:center;gap:14px;max-width:560px';
const PANEL = 'display:flex;flex-direction:column;align-items:center;gap:8px;width:400px';
const COUNT = 'font-size:17px;color:#e8d8c8';
const SMALL = 'font-size:13px;line-height:15px;color:#9a9a9a';
const CELL = 'position:relative;box-sizing:border-box;width:100%;height:58px;border-radius:6px;overflow:hidden;background:#101014';
const CELL_ART = 'width:100%;height:100%;object-fit:cover;object-position:top;display:block';
const CELL_EMPTY = 'filter:grayscale(1) brightness(.35)';
const CELL_MARK = 'position:absolute;right:1px;bottom:0;font-size:15px;line-height:17px;text-shadow:0 0 3px #000,0 0 3px #000';
const CELL_LOOK = { [GOLD]: { border: '2px solid #ffd24a', mark: '★', color: '#ffd24a' }, plain: { border: '2px solid #9a9aa4', mark: '✓', color: '#fff' }, none: { border: '2px solid #26262c' } };
const CURRENT = 'outline:3px solid #fff;outline-offset:1px;box-shadow:0 0 12px 3px #e8a080;z-index:1';
const SWATCH = 'box-sizing:border-box;width:36px;height:36px;padding:0;border-radius:50%;font:13px sans-serif;cursor:pointer;touch-action:manipulation';
const LOOK_ROWS = [['bolt', '번개', 'bolts', 'glow'], ['light', '손전등', 'lights', 'color']];
const ALL_OPEN = '색을 모두 열었어요';
const LAST = 'box-sizing:border-box;width:100%;border-radius:8px;font:15px sans-serif;padding:7px 10px;touch-action:manipulation';
const LAST_OPEN = 'background:#2a1c3a;color:#fff;border:2px solid #c8a8ff;cursor:pointer';
const LAST_SHUT = 'background:#101014;color:#8a8a92;border:2px dashed #3a3a42';
const TONIGHT = 'box-sizing:border-box;width:100%;border-radius:8px;font:15px sans-serif;padding:7px 10px;touch-action:manipulation;background:#3a2a10;color:#fff;border:2px solid #ffd24a;cursor:pointer';
// 어른용 숲 칸과 확인 창. 다른 칸보다 어둡고 붉게, 은은하게 빛나게 한다
const ADULT = 'box-sizing:border-box;width:100%;border-radius:8px;font:15px sans-serif;padding:7px 10px;touch-action:manipulation;background:#1a0f12;color:#f2d6dc;border:2px solid #b8435a;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;box-shadow:0 0 14px rgba(184,67,90,.35)';
const ADULT_SMALL = 'font-size:12px;color:#c79aa4';
const VEIL = 'position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(0,0,0,.78)';
const DIALOG = 'box-sizing:border-box;max-width:420px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px 22px 18px;border-radius:10px;background:#110b0d;border:2px solid #b8435a;text-align:center';
const DIALOG_TITLE = 'font-size:21px;color:#f2d6dc';
const DIALOG_TEXT = 'font-size:15px;line-height:1.6;color:#ddd';
const DIALOG_WARN = 'font-size:15px;line-height:1.6;color:#e8a0ae';
const FOREST_TEXT = '해가 막 넘어간 숲이에요. 하늘이 완전히 어두워지기 전에 빠져나가야 해요.';
const FOREST_WARN = '어른도 무서운 판이에요. 갑자기 놀라게 하는 장면과 소리가 많아요. 아이 혼자 하지 않게 해 주세요.';

// 맵 칸과 괴물 칸의 이름과 설명. 랜덤 칸이 맨 뒤에 온다
export function chooserOptions() {
  return {
    mapId: [...MAP_IDS.map((id) => ({ id, name: MAPS[id].name, hint: MAPS[id].blurb })), { id: RANDOM, name: '랜덤', hint: RANDOM_MAP }],
    monsterId: [...MONSTER_IDS.map((id) => ({ id, name: MONSTERS[id].name, hint: MONSTERS[id].hint })), { id: RANDOM, name: '랜덤', hint: RANDOM_MONSTER }],
  };
}

// 다음에 무엇이 열리는지 알리는 줄
function nextLine(stamps, k) {
  const next = nextUnlock(stamps, k);
  return next ? `도장 ${next.need}개면 열려요: ${next.looks.map((look) => look.name).join(', ')}` : ALL_OPEN;
}

// 마지막 밤 칸의 글. 도장판을 다 채우면 열리고, 깬 뒤에는 다시 할 수 있다고 알린다
export function lastNightCard(record) {
  const left = stampsLeft(record.stamps);
  const names = roundMonsters(LAST_ROUND).map((id) => MONSTERS[id].name).join(', ');
  if (left > 0) return { open: false, text: `마지막 밤: 도장 ${left}개 더 모으면 열려요` };
  return { open: true, text: `${record.lastCleared ? '마지막 밤 다시 하기' : '마지막 밤 들어가기'}: ${names}` };
}

// 오늘의 밤 칸의 두 줄. tonight: logic/horrorTonight.js 의 tonightRound
export function tonightCard(record, tonight, k) {
  const reward = tonightPaid(record, tonight.date) ? '오늘 보석 받음' : `보석 ${k.tonight.gems}개`;
  return [`오늘의 밤: ${MAPS[tonight.mapId].name}, ${MONSTERS[tonight.monsterId].name}`, `${tonightRuleText(tonight.rule, k)} (${reward})`];
}

// 어른용 숲 칸의 두 줄. 휴대폰은 첫 줄만 쓴다
export function forestCard() {
  return [`어른용: ${FOREST_PLACE.name}, ${SPECIAL_MONSTERS[FOREST_MONSTER_ID].name}`, '어른도 무서워요. 눌러서 들어가기'];
}

// choice: { mapId, monsterId }. record: 저장된 공포 모드 기록. onStart 에 고른 값을 준다. 화면은 스스로 닫는다
// onLook(key, id): 번개 ('bolt') 나 손전등 ('light') 색을 고르면 부른다. onLastNight: 마지막 밤 칸을 누르면 부른다
// tonight: 오늘의 밤 판, onTonight: 그 칸을 누르면 부른다. onForest: 어른용 칸의 확인 창에서 들어가기를 누르면 부른다
export function showChooser(root, { choice, compact, record, tonight, onLook, onStart, onLastNight, onTonight, onForest, onQuit }) {
  const picked = { ...choice };
  const worn = { bolt: record.bolt, light: record.light };
  const k = cfg.horror.stamps;
  const layer = document.createElement('div');
  layer.dataset.chooser = '';
  layer.style.cssText = compact ? `${LAYER};gap:5px;padding:6px max(6px,env(safe-area-inset-right,0px)) 6px max(6px,env(safe-area-inset-left,0px))` : LAYER;
  const add = (tag, css, text = '') => {
    const el = document.createElement(tag);
    el.style.cssText = css;
    el.textContent = text;
    return el;
  };
  let shutConfirm = () => {};
  const close = (fn) => () => {
    shutConfirm(false);
    layer.remove();
    fn();
  };
  const body = add('div', compact ? `${BODY};flex-wrap:nowrap;gap:8px` : BODY);
  const side = add('div', compact ? `${SIDE};width:296px;gap:4px` : SIDE);
  const panel = add('div', compact ? `${PANEL};width:250px;gap:3px` : PANEL);
  const smallFont = compact ? ';font-size:13px;min-height:18px' : '';
  const section = (label, key, options) => {
    const row = add('div', compact ? `${ROW};gap:4px 6px` : ROW);
    const hint = add('div', HINT + smallFont);
    const buttons = options.map((o) => {
      const btn = add('button', '', o.name);
      btn.dataset.pick = o.id;
      btn.addEventListener('click', () => {
        picked[key] = o.id;
        paint();
        paintBoard();
      });
      row.appendChild(btn);
      return { btn, o };
    });
    const paint = () => buttons.forEach(({ btn, o }) => {
      const on = picked[key] === o.id;
      btn.style.cssText = `${OPTION};${on ? ON : OFF}${compact ? ';font-size:14px;padding:5px 8px;min-width:64px' : ''}`;
      btn.setAttribute('aria-pressed', String(on));
      if (on) hint.textContent = o.hint;
    });
    paint();
    side.append(add('div', compact ? `${LABEL};font-size:13px` : LABEL, label), row, hint);
  };
  // 도장판. 맵이 줄, 괴물이 칸이다. 지금 고른 칸은 밝은 테두리로 보인다
  const board = add('div', `display:grid;grid-template-columns:${compact ? '56px repeat(4,42px)' : '92px repeat(4,70px)'};gap:${compact ? 3 : 6}px;align-items:center`);
  const tiles = [];
  const buildBoard = () => {
    const small = compact ? `${SMALL};font-size:11px;line-height:12px` : SMALL;
    board.appendChild(add('div', ''));
    MONSTER_IDS.forEach((id) => board.appendChild(add('div', small, MONSTERS[id].name)));
    const all = boardCells(record.stamps);
    MAP_IDS.forEach((mapId) => {
      board.appendChild(add('div', `${small};text-align:right`, MAPS[mapId].name));
      all.filter((c) => c.mapId === mapId).forEach((c) => {
        const look = CELL_LOOK[c.stamp ?? 'none'];
        const tile = add('div', '');
        tile.dataset.cell = cellKey(c);
        tile.dataset.stamp = c.stamp ?? '';
        const art = document.createElement('img');
        art.alt = '';
        art.style.cssText = `${CELL_ART};${c.stamp ? '' : CELL_EMPTY}`;
        art.onerror = () => art.remove();
        art.src = `art/horror_face_${c.monsterId}.webp`;
        tile.appendChild(art);
        if (look.mark) tile.appendChild(add('div', `${CELL_MARK};color:${look.color}`, look.mark));
        board.appendChild(tile);
        tiles.push({ tile, c, look });
      });
    });
  };
  const paintBoard = () => tiles.forEach(({ tile, c, look }) => {
    tile.style.cssText = `${CELL};border:${look.border}${compact ? ';height:30px' : ''}${isCurrentCell(c, picked) ? `;${CURRENT}` : ''}`;
  });
  // 번개와 손전등 색 고르기. 잠긴 색에는 필요한 도장 수를 적어 둔다
  const lookHint = add('div', `${SMALL};min-height:30px;max-width:100%`, nextLine(record.stamps, k));
  const lookRow = ([key, label, listName, colorField]) => {
    const row = add('div', `${ROW};align-items:center;flex-wrap:nowrap;gap:${compact ? 4 : 8}px`);
    row.appendChild(add('div', `${SMALL};width:${compact ? 38 : 48}px;text-align:right`, label));
    const options = () => lookOptions(k[listName], record.stamps, k, worn[key]);
    const buttons = options().map(({ look, need, open }) => {
      const btn = add('button', '', open ? '' : String(need));
      btn.dataset.look = `${key}:${look.id}`;
      btn.setAttribute('aria-label', open ? look.name : `${look.name}, 도장 ${need}개`);
      btn.addEventListener('click', () => {
        if (!open) {
          lookHint.textContent = `${look.name}: 도장 ${need}개가 있어야 열려요`;
          return;
        }
        worn[key] = look.id;
        onLook(key, look.id);
        lookHint.textContent = look.name;
        paintRow();
      });
      row.appendChild(btn);
      return btn;
    });
    const paintRow = () => options().forEach(({ look, open, on }, i) => {
      const color = cssColor(look[colorField]);
      const size = compact ? ';width:28px;height:28px' : '';
      const face = open ? `background:${color};color:#000;border:3px solid ${on ? '#fff' : '#3a3a42'}` : `background:#16161a;color:${color};border:2px dashed ${color}`;
      buttons[i].style.cssText = `${SWATCH}${size};${face}`;
      buttons[i].setAttribute('aria-pressed', String(on));
    });
    paintRow();
    panel.appendChild(row);
  };
  const options = chooserOptions();
  if (!compact) layer.appendChild(add('div', TITLE, '어디로 들어갈까요?'));
  layer.appendChild(body);
  body.append(side, panel);
  section('맵', 'mapId', options.mapId);
  section('누가 기다릴까요', 'monsterId', options.monsterId);
  const actions = add('div', compact ? `${ROW};margin-top:2px` : ROW);
  const go = add('button', compact ? `${GO};font-size:16px;padding:6px 28px` : GO, '들어가기');
  const back = add('button', compact ? `${BACK};padding:6px 18px` : BACK, '타이틀로');
  go.addEventListener('click', close(() => onStart({ ...picked })));
  back.addEventListener('click', close(onQuit));
  actions.append(go, back);
  side.appendChild(actions);
  const card = lastNightCard(record);
  const last = add('button', `${LAST};${card.open ? LAST_OPEN : LAST_SHUT}${compact ? ';font-size:13px;padding:3px 8px' : ''}`, card.text);
  last.dataset.lastNight = card.open ? 'open' : 'locked';
  last.disabled = !card.open;
  last.addEventListener('click', close(onLastNight));
  const tonightBtn = add('button', `${TONIGHT}${compact ? ';font-size:12px;line-height:14px;padding:2px 6px' : ''}`);
  tonightBtn.dataset.tonight = '';
  tonightCard(record, tonight, cfg.horror).forEach((line) => tonightBtn.appendChild(add('div', '', line)));
  tonightBtn.addEventListener('click', close(onTonight));
  const [forestTop, forestSub] = forestCard();
  const forestBtn = add('button', `${ADULT}${compact ? ';font-size:13px;line-height:15px;padding:3px 8px' : ''}`);
  forestBtn.dataset.forest = '';
  forestBtn.appendChild(add('div', '', forestTop));
  if (!compact) forestBtn.appendChild(add('div', ADULT_SMALL, forestSub)); // 휴대폰은 한 줄만 넣는다
  // 누를 때마다 확인 창을 띄운다. 처음 손이 가는 곳은 돌아가기라서 Enter 를 눌러도 들어가지 않는다
  const openConfirm = () => {
    const veil = add('div', VEIL);
    veil.dataset.forestConfirm = '';
    const box = add('div', compact ? `${DIALOG};gap:6px;padding:10px 16px;max-width:520px` : DIALOG);
    box.setAttribute('role', 'dialog');
    const enter = add('button', compact ? `${GO};font-size:16px;padding:6px 28px` : GO, '들어가기');
    enter.dataset.forestEnter = '';
    const cancel = add('button', compact ? `${BACK};padding:6px 18px` : BACK, '돌아가기');
    cancel.dataset.forestBack = '';
    const textCss = compact ? ';font-size:13px;line-height:1.4' : '';
    box.append(
      add('div', compact ? `${DIALOG_TITLE};font-size:17px` : DIALOG_TITLE, FOREST_PLACE.name),
      add('div', DIALOG_TEXT + textCss, FOREST_TEXT),
      add('div', DIALOG_WARN + textCss, FOREST_WARN),
      add('div', compact ? `${ROW};gap:16px` : ROW),
    );
    box.lastChild.append(enter, cancel);
    veil.appendChild(box);
    const onKey = (e) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      shutConfirm();
    };
    // back: 고르기 화면으로 돌아가면 어른용 칸에 다시 손이 가게 한다
    shutConfirm = (back = true) => {
      window.removeEventListener('keydown', onKey);
      veil.remove();
      shutConfirm = () => {};
      if (back) forestBtn.focus();
    };
    window.addEventListener('keydown', onKey);
    enter.addEventListener('click', close(onForest));
    cancel.addEventListener('click', () => shutConfirm());
    layer.appendChild(veil);
    cancel.focus();
  };
  forestBtn.addEventListener('click', openConfirm);
  buildBoard();
  paintBoard();
  const gold = goldCount(record.stamps);
  panel.append(add('div', compact ? `${COUNT};font-size:14px` : COUNT, `도장 ${stampCount(record.stamps)}/${boardSize()}${gold ? `, 금 ${gold}` : ''}`), board);
  LOOK_ROWS.forEach(lookRow);
  panel.append(lookHint, last, tonightBtn, forestBtn);
  root.appendChild(layer);
  go.focus(); // Enter 로도 누를 수 있다
}
