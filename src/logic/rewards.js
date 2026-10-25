// 별과 보석: 스테이지마다 별 3개, 별과 보물로 보석을 모은다. 숫자는 balance.js 의 gems.
//   별 1: 스테이지 깨기
//   별 2: 그 스테이지 보물 전부 찾기 (여러 번에 나눠 찾아도 됨)
//   별 3: 한 번도 쓰러지지 않고 깨기 (체크포인트에서 다시 시작하지 않고)

export const STAR_KINDS = ['clear', 'treasures', 'flawless'];

export const STAR_INFO = {
  clear: '스테이지 깨기',
  treasures: '보물 전부 찾기',
  flawless: '한 번도 안 쓰러지고 깨기',
};

const allFound = (save, stage) => stage.treasures.every((t) => save.treasures.includes(t.id));

// 스테이지 n 의 별 { clear, treasures, flawless }
export function stageStars(save, stage, n) {
  return {
    clear: Boolean(save.bestTimes?.[n]),
    treasures: allFound(save, stage),
    flawless: (save.flawless || []).includes(n),
  };
}

export const starCount = (stars) => STAR_KINDS.filter((k) => stars[k]).length;

export function totalStars(save, stages) {
  return stages.reduce((sum, st, i) => sum + starCount(stageStars(save, st, i + 1)), 0);
}

// 별 그림 글자: ★★☆
export const starText = (stars) => STAR_KINDS.map((k) => (stars[k] ? '★' : '☆')).join('');

// 보물을 처음 찾았을 때: 저장할 내용, 받은 보석, 새로 받은 별
export function treasureReward(save, stage, n, id, gemCfg) {
  if (save.treasures.includes(id)) return { patch: {}, gems: 0, newStars: [] };
  const before = stageStars(save, stage, n);
  const next = { ...save, treasures: [...save.treasures, id] };
  const after = stageStars(next, stage, n);
  const newStars = STAR_KINDS.filter((k) => after[k] && !before[k]);
  const gems = gemCfg.treasure + newStars.length * gemCfg.star;
  return { patch: { treasures: next.treasures, gems: (save.gems || 0) + gems }, gems, newStars };
}

// 스테이지를 깼을 때 (clearStagePatch 를 적용하기 전 저장을 넘긴다)
export function clearReward(save, stage, n, { flawless }, gemCfg) {
  const before = stageStars(save, stage, n);
  const next = {
    ...save,
    bestTimes: { ...save.bestTimes, [n]: save.bestTimes?.[n] || 1 },
    flawless: flawless && !before.flawless ? [...(save.flawless || []), n] : save.flawless || [],
  };
  const after = stageStars(next, stage, n);
  const newStars = STAR_KINDS.filter((k) => after[k] && !before[k]);
  const gems = gemCfg.clear + newStars.length * gemCfg.star;
  return { patch: { flawless: next.flawless, gems: (save.gems || 0) + gems }, gems, newStars, stars: after };
}

// 보석이 생기기 전 저장: 지금까지 찾은 보물, 깬 스테이지, 받은 별만큼 보석을 준다
export function gemsFromProgress(save, stages, gemCfg) {
  let gems = 0;
  stages.forEach((st, i) => {
    const n = i + 1;
    gems += st.treasures.filter((t) => save.treasures.includes(t.id)).length * gemCfg.treasure;
    const stars = stageStars(save, st, n);
    if (stars.clear) gems += gemCfg.clear;
    gems += starCount(stars) * gemCfg.star;
  });
  return gems;
}
