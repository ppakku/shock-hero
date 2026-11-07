// 숲 판의 해 질 녘 (화면과 상관없는 부분). 판 시작 뒤 지난 초로 하늘, 안개, 주변 밝기를 정한다.
// 남은 시간 숫자는 보여 주지 않는다. 하늘 색과 단계가 바뀔 때의 짧은 알림만 쓴다.

export const FOREST_ID = 'forest'; // 해가 지는 판. horrorPick 을 부르지 않으려고 여기 둔다
export const STAGES = ['glow', 'twilight', 'night']; // 노을, 어스름, 밤
// 단계가 바뀔 때 HUD 에 한 번 띄우는 글
export const DUSK_ALERTS = { twilight: '어디선가 흐느끼는 소리가 들린다', night: '해가 완전히 졌다' };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

// 0xRRGGBB 두 색 사이
export function mixColor(a, b, t) {
  const ch = (c, shift) => (c >> shift) & 0xff;
  const r = Math.round(lerp(ch(a, 16), ch(b, 16), t));
  const g = Math.round(lerp(ch(a, 8), ch(b, 8), t));
  const bl = Math.round(lerp(ch(a, 0), ch(b, 0), t));
  return (r << 16) | (g << 8) | bl;
}

function mixKey(a, b, t) {
  return {
    sky: { top: mixColor(a.top, b.top, t), mid: mixColor(a.mid, b.mid, t), low: mixColor(a.low, b.low, t) },
    fog: mixColor(a.fog, b.fog, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
    ambient: mixColor(a.ambient, b.ambient, t),
    ambientScale: lerp(a.ambientScale, b.ambientScale, t),
  };
}

// t: 판 시작 뒤 지난 초 (일시정지 때는 멈춘다). k: balance.horror.forest.dusk
// level 은 0 (시작) 에서 1 (밤이 시작될 때) 까지. 색은 노을, 어스름, 밤 시작 사이를 고르게 바꾼다
export function duskAt(t, k) {
  const time = Math.max(0, t || 0);
  const stage = time >= k.nightAt ? 'night' : time >= k.twilightAt ? 'twilight' : 'glow';
  const level = clamp01(time / k.nightAt);
  const look = time < k.twilightAt
    ? mixKey(k.glow, k.twilight, clamp01(time / k.twilightAt))
    : mixKey(k.twilight, k.night, clamp01((time - k.twilightAt) / (k.nightAt - k.twilightAt)));
  return { level, stage, ...look };
}

// 단계가 앞으로 바뀌었으면 띄울 글, 아니면 null
export function stageChange(prev, stage) {
  if (!prev || prev === stage || STAGES.indexOf(stage) < STAGES.indexOf(prev)) return null;
  return DUSK_ALERTS[stage] ?? null;
}
