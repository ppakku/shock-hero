// 공포 모드 입구. 3D 묶음은 고를 때만 내려받는다 (이 파일은 three 를 import 하지 않는다).
import { isPhone, isTouchDevice } from '../ui/touch.js';
import { saveStore } from '../save.js';
import { todayKey } from '../logic/daily.js';
import { LAST_ROUND, RANDOM, chooseRound, forcedRound, isRound } from '../logic/horrorPick.js';
import { tonightRound } from '../logic/horrorTonight.js';

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
  let showChooser;
  try {
    ({ HorrorGame, showChooser } = await loadModule());
  } catch (e) {
    console.error('공포 모드 묶음을 불러오지 못했어요', e);
    return fail(root, '공포 모드를 불러오지 못했어요. 인터넷을 확인해 주세요.', onExit);
  }
  root.textContent = '';
  game.pause();
  const leave = () => {
    root.remove();
    game.resume();
    onExit();
  };
  // 판마다 HorrorGame 을 새로 만든다. 지난 판에서 남는 것이 없다
  const play = (round, tonight = null) => {
    let horror = null;
    try {
      const save = saveStore.load();
      if (isRound(round)) save.horror.last = round; // 마지막 밤은 다음 판 고르기에 끼어들지 않는다
      saveStore.save(save);
      horror = new HorrorGame(root, {
        round,
        tonight,
        touch: isTouchDevice(),
        device: deviceKind(),
        lowFx: save.settings.lowFx,
        muted: save.settings.muted,
        onExit: leave,
        onAgain: () => choose(),
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
      fail(root, '공포 모드를 시작하지 못했어요. 다시 시도해 주세요.', onExit);
    }
  };
  let choice = { mapId: RANDOM, monsterId: RANDOM }; // 한 판 더를 누르면 방금 고른 그대로 보여 준다
  const today = () => tonightRound(todayKey());
  const choose = () => showChooser(root, {
    choice,
    tonight: today(),
    compact: deviceKind() === 'phone',
    record: saveStore.load().horror,
    onLook: (key, id) => {
      const save = saveStore.load();
      save.horror[key] = id;
      saveStore.save(save);
    },
    onStart: (picked) => {
      choice = picked;
      play(chooseRound(picked, saveStore.load().horror.last));
    },
    onLastNight: () => play(LAST_ROUND),
    // 날짜는 누른 순간에 다시 본다. 고르기 화면을 띄운 채 자정을 넘겨도 어제 판이 시작되지 않는다
    onTonight: () => {
      const tonight = today();
      play({ mapId: tonight.mapId, monsterId: tonight.monsterId }, tonight);
    },
    onQuit: leave,
  });
  const forced = forcedRound(globalThis.location?.search ?? '');
  if (forced) play(forced);
  else choose();
}
