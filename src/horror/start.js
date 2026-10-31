// 공포 모드 입구. 3D 묶음은 고를 때만 내려받는다 (이 파일은 three 를 import 하지 않는다).
import { isTouchDevice } from '../ui/touch.js';
import { saveStore } from '../save.js';

export function canUseWebGL(doc = globalThis.document) {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function makeRoot() {
  const root = document.createElement('div');
  root.id = 'horror';
  root.style.cssText = 'position:fixed;inset:0;z-index:50;background:#000;color:#ddd;font:18px sans-serif;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none';
  root.textContent = '불러오는 중...';
  document.body.appendChild(root);
  return root;
}

function fail(root, text, onExit) {
  root.textContent = text;
  setTimeout(() => {
    root.remove();
    onExit();
  }, 2500);
}

// onExit: 공포 모드가 끝나고 타이틀로 돌아갈 때 부른다
export async function startHorror(game, { onExit }) {
  const root = makeRoot();
  if (!canUseWebGL()) return fail(root, '이 기기에서는 공포 모드를 켤 수 없어요.', onExit);
  let HorrorGame;
  try {
    ({ HorrorGame } = await import('./HorrorGame.js'));
  } catch {
    return fail(root, '공포 모드를 불러오지 못했어요. 인터넷을 확인해 주세요.', onExit);
  }
  root.textContent = '';
  game.pause();
  const { settings } = saveStore.load();
  const horror = new HorrorGame(root, {
    touch: isTouchDevice(),
    lowFx: settings.lowFx,
    muted: settings.muted,
    onExit: () => {
      root.remove();
      game.resume();
      onExit();
    },
  });
  horror.start();
}
