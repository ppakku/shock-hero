// 공포 모드 판 고르기: 맵과 괴물을 정한다. 지난 판과 달라야 다시 하고 싶어진다.
export const MAP_IDS = ['factory', 'sewer', 'school'];
export const MONSTER_IDS = ['seino', 'gazer', 'maw', 'ward'];

// 마지막 밤: 도장판을 채우면 열리는 특별 판. MAP_IDS 에 넣지 않는다. 넣으면 도장판이 커지고 랜덤으로도 나온다
export const LAST_MAP_ID = 'station';
export const LAST_ROUND = { mapId: LAST_MAP_ID, monsterId: MONSTER_IDS[0], monsterIds: MONSTER_IDS.slice(0, 2) }; // 소리를 쫓는 괴물과 보면 멈추는 괴물

export function isRound(r) {
  return MAP_IDS.includes(r?.mapId) && MONSTER_IDS.includes(r?.monsterId);
}

export const isLastNight = (r) => r?.mapId === LAST_MAP_ID;

// 어른용 판: 해 질 녘 숲과 처녀귀신은 항상 짝이다. 마지막 밤처럼 목록 밖에 두어 랜덤, 도장판, 오늘의 밤에 나오지 않는다
export const FOREST_MAP_ID = 'forest';
export const FOREST_MONSTER_ID = 'maiden';
export const FOREST_ROUND = { mapId: FOREST_MAP_ID, monsterId: FOREST_MONSTER_ID };
export const isForest = (r) => r?.mapId === FOREST_MAP_ID;

// 이번 판에 나오는 괴물 id 목록. 보통 판은 하나다
export const roundMonsters = (r) => r.monsterIds ?? [r.monsterId];

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

// 시험용 주소 ?map=factory&monster=gazer. 하나만 주면 나머지는 첫 조합을 쓰고, 없거나 틀리면 null. ?map=station 은 마지막 밤,
// ?map=forest 나 ?monster=maiden 은 어른용 숲이다
export function forcedRound(search) {
  const q = new URLSearchParams(search);
  if (q.get('map') === LAST_MAP_ID) return LAST_ROUND;
  if (q.get('map') === FOREST_MAP_ID || q.get('monster') === FOREST_MONSTER_ID) return FOREST_ROUND;
  const r = { mapId: q.get('map') ?? MAP_IDS[0], monsterId: q.get('monster') ?? MONSTER_IDS[0] };
  return (q.has('map') || q.has('monster')) && isRound(r) ? r : null;
}
