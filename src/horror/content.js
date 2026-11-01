// 맵과 괴물의 이름, 내용을 한곳에 모은다. 이름을 바꾸려면 여기 한 줄만 고치면 된다.
import { factoryMap, factoryTheme } from './maps/factory.js';
import { sewerMap, sewerTheme } from './maps/sewer.js';
import { schoolMap, schoolTheme } from './maps/school.js';
import { NOTES } from './story.js';

export const MAPS = {
  factory: { name: '밤의 고철 공장', map: factoryMap, theme: factoryTheme, notes: NOTES.factory, blurb: '녹슨 기계 사이로 쇳소리가 울려요' },
  sewer: { name: '지하 수로', map: sewerMap, theme: sewerTheme, notes: NOTES.sewer, blurb: '젖은 바닥, 끝없이 이어지는 어둠' },
  school: { name: '밤의 학교', map: schoolMap, theme: schoolTheme, notes: NOTES.school, blurb: '아무도 없는데 시계만 멈춰 있어요' },
};

export const MONSTERS = {
  seino: { name: '세이노', hint: '달리면 소리가 나고, 손전등 빛은 들켜요', alarm: '{name}에게 들켰다! 도망쳐!', model: 'seino', voice: 'seino' },
  gazer: { name: '눈뜬이', hint: '눈을 떼지 마세요', alarm: '{name}가 빨라졌다! 돌아서서 봐!', model: 'gazer', voice: 'gazer' },
  maw: { name: '큰입이', hint: '앞을 못 봐요. 소리를 내지 말고, 닿지 마세요', alarm: '{name}가 소리를 들었다! 자리를 옮겨!', model: 'maw', voice: 'maw' },
  ward: { name: '호러워드', hint: '벽을 뚫고 와요. 벽이 튀어나오면 도망치세요', alarm: '{name}에게 들켰다! 벽도 소용없어!', model: 'ward', voice: 'ward', throughWalls: true },
};
