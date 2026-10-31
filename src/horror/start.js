// 공포 모드 입구. 3D 묶음은 고를 때만 내려받는다 (이 파일은 three 를 import 하지 않는다).
import { isPhone, isTouchDevice } from '../ui/touch.js';
import { saveStore } from '../save.js';

// 안내 화면에 어느 기기의 조작법을 보여 줄지 고른다
export function deviceKind(phone = isPhone(), touch = isTouchDevice()) {
  if (phone) return 'phone';
  return touch ? 'tablet' : 'pc';
}

export function canUseWebGL(doc = globalThis.document) {
  try {
    const ctx = doc.createElement('canvas').getContext('webgl2'); // three 는 webgl2 만 쓴다
    if (!ctx) return false;
    ctx.getExtension('WEBGL_lose_context')?.loseContext(); // 확인용 자리를 바로 돌려준다
    return true;
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
// loadModule: 시험에서 바꿔 끼운다
export async function startHorror(game, { onExit }, loadModule = () => import('./HorrorGame.js')) {
  const root = makeRoot();
  if (!canUseWebGL()) return fail(root, '이 기기에서는 공포 모드를 켤 수 없어요.', onExit);
  let HorrorGame;
  try {
    ({ HorrorGame } = await loadModule());
  } catch (e) {
    console.error('공포 모드 묶음을 불러오지 못했어요', e);
    return fail(root, '공포 모드를 불러오지 못했어요. 인터넷을 확인해 주세요.', onExit);
  }
  root.textContent = '';
  game.pause();
  let horror = null;
  try {
    const { settings } = saveStore.load();
    horror = new HorrorGame(root, {
      touch: isTouchDevice(),
      device: deviceKind(),
      lowFx: settings.lowFx,
      muted: settings.muted,
      onExit: () => {
        root.remove();
        game.resume();
        onExit();
      },
    });
    horror.start();
  } catch (e) {
    console.error('공포 모드를 시작하지 못했어요', e);
    try {
      if (horror) {
        horror.onExit = () => {}; // 안내 뒤에 한 번만 끝내려고 여기서는 알리지 않는다
        horror.exit();
      }
    } catch {
      // 정리 중 오류는 무시하고 아래 실패 안내로 간다
    }
    game.resume();
    return fail(root, '공포 모드를 시작하지 못했어요. 다시 시도해 주세요.', onExit);
  }
}
