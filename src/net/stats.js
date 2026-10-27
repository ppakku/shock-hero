// 방문 통계 (GoatCounter, https://shockhero.goatcounter.com). index.html 이 count.js 를 불러온다.
// 접속(페이지 열기)은 count.js 가 알아서 센다. 여기서는 게임 안에서 일어난 일을 센다.
// 이름이나 저장 기록 같은 개인 정보는 보내지 않는다. 자기 컴퓨터(localhost)에서 할 때는 count.js 가 세지 않는다.

const pad = (n) => String(n).padStart(2, '0');

// 통계 화면에 보이는 이름. kind: 'start' | 'clear' | 'fall' (스테이지), 'rush-start' | 'rush-done' | 'rush-over' (보스 러시 코스), 'coop-host' | 'coop-join'
export function statEvent(kind, n) {
  if (kind === 'start') return { path: `stage-${pad(n)}-start`, title: `스테이지 ${n} 시작` };
  if (kind === 'clear') return { path: `stage-${pad(n)}-clear`, title: `스테이지 ${n} 클리어` };
  if (kind === 'fall') return { path: `stage-${pad(n)}-fall`, title: `스테이지 ${n} 쓰러짐` };
  if (kind === 'rush-start') return { path: `rush-${n}-start`, title: `보스 러시 코스 ${n} 시작` };
  if (kind === 'rush-done') return { path: `rush-${n}-done`, title: `보스 러시 코스 ${n} 완주` };
  if (kind === 'rush-over') return { path: `rush-${n}-over`, title: `보스 러시 코스 ${n} 실패` };
  if (kind === 'coop-host') return { path: 'coop-host', title: '함께하기 방 만들기' };
  if (kind === 'coop-join') return { path: 'coop-join', title: '함께하기 친구 들어옴' };
  return null;
}

// 센다. count.js 를 못 받았거나(광고 차단 등) 막혀 있어도 게임은 그대로 돈다
export function countStat(kind, n, win = globalThis.window) {
  const e = statEvent(kind, n);
  if (!e) return;
  try {
    win?.goatcounter?.count?.({ ...e, event: true });
  } catch {
    // 통계는 못 세도 괜찮다
  }
}
