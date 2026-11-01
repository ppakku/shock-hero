// 맵과 괴물의 이름, 내용을 한곳에 모은다. 이름을 바꾸려면 여기 한 줄만 고치면 된다.
import { factoryMap, factoryTheme } from './maps/factory.js';
import { sewerMap, sewerTheme } from './maps/sewer.js';
import { schoolMap, schoolTheme } from './maps/school.js';
import { stationMap, stationTheme } from './maps/station.js';
import { parkMap, parkTheme } from './maps/park.js';
import { martMap, martTheme } from './maps/mart.js';
import { NOTES } from './story.js';
import { LAST_MAP_ID } from '../logic/horrorPick.js';

export const MAPS = {
  factory: { name: '밤의 고철 공장', map: factoryMap, theme: factoryTheme, notes: NOTES.factory, blurb: '녹슨 기계 사이로 쇳소리가 울려요' },
  sewer: { name: '지하 수로', map: sewerMap, theme: sewerTheme, notes: NOTES.sewer, blurb: '젖은 바닥, 끝없이 이어지는 어둠' },
  school: { name: '밤의 학교', map: schoolMap, theme: schoolTheme, notes: NOTES.school, blurb: '아무도 없는데 시계만 멈춰 있어요' },
  park: { name: '문 닫은 놀이공원', map: parkMap, theme: parkTheme, notes: NOTES.park, blurb: '꼬불꼬불한 방마다 색 전구가 깜빡여요' },
  mart: { name: '문 닫은 마트', map: martMap, theme: martTheme, notes: NOTES.mart, blurb: '긴 통로 끝까지 보이지만, 저쪽도 나를 봐요' },
};

// 마지막 밤의 맵. MAPS 는 고르기 화면과 도장판의 맵이라 따로 둔다. hint 의 {name} 은 첫째, {other} 는 둘째 괴물이다
export const LAST_PLACE = { name: '막차를 기다리는 역', map: stationMap, theme: stationTheme, notes: NOTES[LAST_MAP_ID], blurb: '둘이 함께 기다려요', hint: '{other}를 보면 멈춰도 {name}는 계속 와요. 계속 움직이세요' };

export const ALL_MAPS = { ...MAPS, [LAST_MAP_ID]: LAST_PLACE };

export const MONSTERS = {
  seino: { name: '세이노', hint: '달리면 소리가 나고, 손전등 빛은 들켜요', alarm: '{name}에게 들켰다! 도망쳐!', model: 'seino', voice: 'seino' },
  gazer: { name: '눈뜬이', hint: '눈을 떼지 마세요', alarm: '{name}가 빨라졌다! 돌아서서 봐!', model: 'gazer', voice: 'gazer' },
  maw: { name: '큰입이', hint: '앞을 못 봐요. 소리를 내지 말고, 닿지 마세요', alarm: '{name}가 소리를 들었다! 자리를 옮겨!', model: 'maw', voice: 'maw' },
  ward: { name: '호러워드', hint: '벽을 뚫고 와요. 벽이 튀어나오면 도망치세요', alarm: '{name}에게 들켰다! 벽도 소용없어!', model: 'ward', voice: 'ward', throughWalls: true },
};
