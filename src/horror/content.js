// 맵과 괴물의 이름, 내용을 한곳에 모은다. 이름을 바꾸려면 여기 한 줄만 고치면 된다.
import { factoryMap } from './maps/factory.js';
import { NOTES } from './story.js';

// 맵 파일에 theme 이 들어오면 지운다
const THEME = { wall: 'wall', floor: 'floor', locker: 'locker', fog: 0x000000, ambient: 0x8890a8, lightColor: 0xfff2d8, decor: 'factory' };

export const MAPS = {
  factory: { name: '밤의 고철 공장', map: factoryMap, theme: THEME, notes: NOTES.factory },
  sewer: { name: '지하 수로', map: factoryMap, theme: THEME, notes: NOTES.sewer },
  school: { name: '밤의 학교', map: factoryMap, theme: THEME, notes: NOTES.school },
};

export const MONSTERS = {
  seino: { name: '세이노', hint: '달리면 소리가 나고, 손전등 빛은 들켜요', model: 'seino', voice: 'seino' },
  gazer: { name: '눈뜬이', hint: '눈을 떼지 마세요', model: 'gazer', voice: 'gazer' },
  maw: { name: '큰입이', hint: '앞을 못 봐요. 소리를 내지 마세요', model: 'maw', voice: 'maw' },
};
