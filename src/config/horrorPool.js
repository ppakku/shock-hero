// 불 켜진 수영장 특별판 수치. balance.horror 의 water, monsters.swimmer, voices.swimmer 로 들어간다

// 수영장 물 (src/logic/horrorWater.js). 물괴물은 이 거리 (칸) 안의 물소리만 듣는다
export const POOL_WATER = {
  hear: {
    puddle: 2.5, // 웅덩이를 걷는 소리
    wade: 7, // 얕은 물을 헤치는 소리
    swim: 40, // 깊은 물에서 헤엄치는 소리. 맵 전체에 들린다
    float: 4, // 깊은 물에 가만히 떠 있어도 찰랑인다
    drip: 2, // 물에서 나온 뒤 몸에서 떨어지는 물방울
    runBoost: 1.8, // 웅덩이와 얕은 물에서 달리면 소리 거리에 곱한다
    duck: 14, // 고무오리가 물에 떨어지는 소리
  },
  dripFor: [0, 2.5, 4, 6], // 깊이별로 물에서 나온 뒤 물방울이 떨어지는 시간 (초). 마름, 웅덩이, 얕은 물, 깊은 물
  speedIn: [1, 1, 0.6, 0.75], // 깊이별 걸음 비율
  swimEye: 0.55, // 깊은 물에서 눈높이 (미터). 물 위로 머리만 나온다
  duckRange: 8, // 고무오리를 던지는 거리 (칸)
};

export const SWIMMER = { // 물괴물. 물소리만 듣는다 (src/logic/horrorSwimmer.js)
  swimSpeed: 3.2, // 물속 속도. 달리기보다 빠르다
  crawlSpeed: 1.0, // 물 밖에서 기는 속도. 걷기보다 느려서 물에서 멀어지면 반드시 도망칠 수 있다
  landCost: 4, // 길을 찾을 때 마른 칸 하나를 물 칸 몇 개로 치는지. 클수록 물길로 돌아온다
  lurkSlow: 0.25, // 물속에 가라앉아 떠돌 때 속도 비율
  gropeSlow: 0.4, // 더듬을 때 속도 비율
  gropeTime: 6, // 소리 난 곳 둘레를 더듬는 시간 (초)
  rushWarn: 0.9, // 소리를 듣고 솟아오른 뒤 이 시간 동안은 잡지 않는다 (초)
  touchDist: 0.65, // 이만큼 닿아야 잡힌다
};

export const SWIMMER_VOICE = { // 물속에서 낮게 꾸르륵대는 거품 소리. 물 밖에서는 젖은 몸을 끄는 소리
  breathFreq: 300, breathQ: 3,
  breathLevel: { patrol: 0.3, search: 0.5, chase: 0.8, stunned: 0.1 },
  breathSwellSec: { patrol: 2.4, search: 0.9, chase: 0.6, stunned: 2.4 },
  stepEvery: { patrol: 0, search: 0.9, chase: 0.45, stunned: 0 },
  tone: { freqs: [110, 116.5], type: 'sine', vol: 0.08, cutoff: 600 },
};
