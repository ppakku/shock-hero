// 전체 화면. 게임 캔버스가 아니라 페이지 전체(html)를 키운다.
// 캔버스만 키우면 그 위에 덮는 공포 모드 화면(#horror)이 전체 화면 밖에 남아 보이지 않는다.
// 아이폰 사파리는 전체 화면을 못 한다 (canFullscreen 이 false). 그때는 홈 화면에 추가하는 방법을 알려 준다.

export function canFullscreen(doc = globalThis.document) {
  return Boolean(doc?.fullscreenEnabled || doc?.webkitFullscreenEnabled);
}

export function isFullscreen(doc = globalThis.document) {
  return Boolean(doc?.fullscreenElement || doc?.webkitFullscreenElement);
}

// 켜져 있으면 끄고, 꺼져 있으면 켠다. 누르는 손을 뗄 때(click, pointerup) 불러야 브라우저가 허락한다
export function toggleFullscreen(doc = globalThis.document) {
  if (isFullscreen(doc)) {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
    return Promise.resolve(exit?.call(doc)).catch(() => {});
  }
  const el = doc.documentElement;
  const enter = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!enter) return Promise.resolve();
  return Promise.resolve(enter.call(el, { navigationUI: 'hide' }))
    .then(() => globalThis.screen?.orientation?.lock?.('landscape')) // 안드로이드: 가로로 고정. 컴퓨터는 거절하고 그냥 넘어간다
    .catch(() => {});
}

// 전체 화면이 켜지고 꺼질 때마다 부른다. 돌려주는 함수를 부르면 그만 듣는다
export function onFullscreenChange(fn, doc = globalThis.document) {
  doc.addEventListener('fullscreenchange', fn);
  doc.addEventListener('webkitfullscreenchange', fn);
  return () => {
    doc.removeEventListener('fullscreenchange', fn);
    doc.removeEventListener('webkitfullscreenchange', fn);
  };
}

export const fullscreenLabel = (doc = globalThis.document) => (isFullscreen(doc) ? '전체 화면 끄기' : '전체 화면');
