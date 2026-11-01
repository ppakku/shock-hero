// 공포 모드 판 고르기: 맵과 괴물을 정한다. 지난 판과 달라야 다시 하고 싶어진다.
export const MAP_IDS = ['factory', 'sewer', 'school'];
export const MONSTER_IDS = ['seino', 'gazer', 'maw', 'ward'];

export function isRound(r) {
  return MAP_IDS.includes(r?.mapId) && MONSTER_IDS.includes(r?.monsterId);
}

// 지난 판과 맵도 괴물도 다른 조합에서 고른다. 처음이면 열두 조합 모두 후보다
export function pickRound(last, rand = Math.random) {
  const known = isRound(last) ? last : null;
  const maps = MAP_IDS.filter((id) => id !== known?.mapId);
  const monsters = MONSTER_IDS.filter((id) => id !== known?.monsterId);
  return { mapId: maps[Math.floor(rand() * maps.length)], monsterId: monsters[Math.floor(rand() * monsters.length)] };
}

export const RANDOM = 'random'; // 고르기 화면의 랜덤 칸

// 고르기 화면의 선택을 실제 판으로 바꾼다. 랜덤 칸만 지난 판과 다르게 뽑는다
export function chooseRound(choice, last, rand = Math.random) {
  const drawn = pickRound(last, rand);
  return {
    mapId: MAP_IDS.includes(choice?.mapId) ? choice.mapId : drawn.mapId,
    monsterId: MONSTER_IDS.includes(choice?.monsterId) ? choice.monsterId : drawn.monsterId,
  };
}

// 시험용 주소 ?map=factory&monster=gazer. 하나만 주면 나머지는 첫 조합을 쓰고, 없거나 틀리면 null
export function forcedRound(search) {
  const q = new URLSearchParams(search);
  const r = { mapId: q.get('map') ?? MAP_IDS[0], monsterId: q.get('monster') ?? MONSTER_IDS[0] };
  return (q.has('map') || q.has('monster')) && isRound(r) ? r : null;
}
