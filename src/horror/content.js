// 맵과 괴물의 이름, 내용을 한곳에 모은다. 이름을 바꾸려면 여기 한 줄만 고치면 된다.
import { factoryMap, factoryTheme } from './maps/factory.js';
import { sewerMap, sewerTheme } from './maps/sewer.js';
import { schoolMap, schoolTheme } from './maps/school.js';
import { stationMap, stationTheme } from './maps/station.js';
import { forestMap, forestTheme } from './maps/forest.js';
import { poolMap, poolTheme } from './maps/pool.js';
import { NOTES } from './story.js';
import { FOREST_MAP_ID, FOREST_MONSTER_ID, LAST_MAP_ID, POOL_MAP_ID, POOL_MONSTER_ID } from '../logic/horrorPick.js';

export const MAPS = {
  factory: { name: '밤의 고철 공장', map: factoryMap, theme: factoryTheme, notes: NOTES.factory, blurb: '녹슨 기계 사이로 쇳소리가 울려요' },
  sewer: { name: '지하 수로', map: sewerMap, theme: sewerTheme, notes: NOTES.sewer, blurb: '젖은 바닥, 끝없이 이어지는 어둠' },
  school: { name: '밤의 학교', map: schoolMap, theme: schoolTheme, notes: NOTES.school, blurb: '아무도 없는데 시계만 멈춰 있어요' },
};

// 마지막 밤의 맵. MAPS 는 고르기 화면과 도장판의 맵이라 따로 둔다. hint 의 {name} 은 첫째, {other} 는 둘째 괴물이다
export const LAST_PLACE = { name: '막차를 기다리는 역', map: stationMap, theme: stationTheme, notes: NOTES[LAST_MAP_ID], blurb: '둘이 함께 기다려요', hint: '{other}를 보면 멈춰도 {name}는 계속 와요. 계속 움직이세요' };

const FOREST_HINT = '해가 질수록 강해져요. 어두워지기 전에 나가세요';

// 어른용 판의 숲. 처녀귀신과 항상 짝이라 힌트도 맵에 둔다
export const FOREST_PLACE = { name: '해 질 녘 숲', map: forestMap, theme: forestTheme, notes: NOTES[FOREST_MAP_ID], blurb: '해가 질수록 귀신이 강해져요', hint: FOREST_HINT };

// 불 켜진 수영장 (특별판). 물괴물과 늘 짝이다
export const POOL_PLACE = { name: '불 켜진 수영장', map: poolMap, theme: poolTheme, notes: NOTES[POOL_MAP_ID], blurb: '너무 밝고, 너무 조용해요' };

export const ALL_MAPS = { ...MAPS, [LAST_MAP_ID]: LAST_PLACE, [POOL_MAP_ID]: POOL_PLACE, [FOREST_MAP_ID]: FOREST_PLACE };

export const MONSTERS = {
  seino: { name: '세이노', hint: '달리면 소리가 나고, 손전등 빛은 들켜요', alarm: '{name}에게 들켰다! 도망쳐!', model: 'seino', voice: 'seino' },
  gazer: { name: '눈뜬이', hint: '눈을 떼지 마세요', alarm: '{name}가 빨라졌다! 돌아서서 봐!', model: 'gazer', voice: 'gazer' },
  maw: { name: '큰입이', hint: '앞을 못 봐요. 소리를 내지 말고, 닿지 마세요', alarm: '{name}가 소리를 들었다! 자리를 옮겨!', model: 'maw', voice: 'maw' },
  ward: { name: '호러워드', hint: '벽을 뚫고 와요. 벽이 튀어나오면 도망치세요', alarm: '{name}에게 들켰다! 벽도 소용없어!', model: 'ward', voice: 'ward', throughWalls: true },
};

// 목록 밖 괴물. MONSTERS 는 고르기 화면과 도장판의 괴물이라 따로 둔다. 이름은 여기 한 줄만 고치면 된다
export const SPECIAL_MONSTERS = {
  [POOL_MONSTER_ID]: { name: '물괴물', hint: '눈이 없어요. 물소리만 들어요. 물에 들어가면 조심하세요', alarm: '{name}가 물소리를 들었다! 물에서 멀어져!', model: 'swimmer', voice: 'swimmer' },
  [FOREST_MONSTER_ID]: { name: '처녀귀신', hint: FOREST_HINT, alarm: '{name}가 따라온다! 도망쳐!', model: 'maiden', voice: 'maiden' },
};

// 게임이 괴물을 찾는 표. 보통 괴물과 목록 밖 괴물을 함께 둔다
export const ALL_MONSTERS = { ...MONSTERS, ...SPECIAL_MONSTERS };
