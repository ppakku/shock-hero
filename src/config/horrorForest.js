// 숲 판 (어른용, 해 질 녘 숲과 처녀귀신) 의 설정. balance.horror 가 여기 값을 가져다 쓴다

export const maidenVoice = { // 숨 섞인 여린 소리. 멀면 흐느끼고, 가까워지면 흥얼거리고, 코앞에서는 귓가에 속삭인다. 발소리 대신 옷자락이 스친다
  breathFreq: 2600, breathQ: 2.4,
  breathLevel: { patrol: 0.3, investigate: 0.4, search: 0.4, chase: 0.7, stunned: 0, watch: 0.15 },
  breathSwellSec: { patrol: 2.6, investigate: 2.2, search: 2.2, chase: 1.2, stunned: 2.6, watch: 3.2 },
  stepEvery: { patrol: 1.3, investigate: 1.1, search: 1.1, chase: 0.6, stunned: 0, watch: 0 },
  layers: {
    near: 3, // 이 칸 안이면 속삭인다
    far: 8, // 이보다 멀면 흐느낀다. 그 사이는 흥얼거린다
    // mix: 거리 구간마다 섞는 비율
    sob: { freq: 540, formant: 1100, q: 4, vibrato: 5.5, vibratoDepth: 14, pulse: 1.7, vol: 0.5, mix: { far: 1, mid: 0.25, near: 0 } },
    hum: { freqs: [349.2, 392], cutoff: 900, vibrato: 0.4, vibratoDepth: 6, vol: 0.35, mix: { far: 0, mid: 1, near: 0.3 } },
    whisper: { freq: 3400, every: 0.16, spread: 0.3, vol: 0.9 }, // 속삭임 음절 사이 시간 (초) 에 0~spread 초를 더한다
  },
};

// 숲 판 (어른용). 해가 지는 동안 하늘과 밝기가 바뀐다 (logic/horrorDusk.js)
export const forestRound = {
  dusk: {
    twilightAt: 180, // 노을이 끝나고 어스름이 되는 때 (판 시작 뒤 초)
    nightAt: 480, // 해가 완전히 지는 때 (초)
    // 단계가 시작되는 순간의 색. 그 사이는 고르게 바뀐다. sky 는 하늘 위, 가운데, 지평선 색
    // fogFar: 안개 끝 거리 배수 (fogCells 에 곱한다), ambientScale: 주변 밝기 배수 (ambient 에 곱한다)
    // tint: 하늘 돔 그림에 곱하는 색 (노을은 그림 그대로 흰색, 밤은 짙은 남색)
    glow: { tint: 0xffffff, top: 0x463c78, mid: 0xd26e78, low: 0xf09650, fog: 0x8c5a4b, fogFar: 1.6, ambient: 0xffd8b0, ambientScale: 4 }, // 손전등 없이도 다닐 만큼 밝다
    twilight: { tint: 0x8c78a8, top: 0x281e50, mid: 0x6e3c6e, low: 0xa0505a, fog: 0x3c2238, fogFar: 1.2, ambient: 0xb490c0, ambientScale: 2 },
    night: { tint: 0x141a30, top: 0x06080f, mid: 0x0a0c1a, low: 0x10101e, fog: 0x05060c, fogFar: 1, ambient: 0x9cb4fc, ambientScale: 1 }, // 다른 맵의 어둠과 같다
  },
};

// 처녀귀신 (숲 판). 해가 지는 단계마다 값이 다르고 나머지는 세이노 값을 쓴다
// walk: 순찰, 조사 속도, chase: 추격 속도 (0 은 쫓지 않음), hear: 듣는 거리와 빛을 알아채는 거리 배수
// blinkAfter: 주인공 눈에 안 보인 채 이만큼 지나면 순간이동한다 (초), blinkMin, blinkMax: 주인공에게서 나타나는 거리 (칸)
export const maidenMonster = {
  glow: {
    walk: 0.5, chase: 0, hear: 0.4,
    showTime: 1.6, // 눈에 띈 뒤 서서 바라보다가 사라지기까지 (초)
    slipDist: 5, // 이만큼 다가가면 바로 사라진다 (칸)
  },
  twilight: { walk: 0.8, chase: 1.7, hear: 1, blinkAfter: 6, blinkMin: 5, blinkMax: 8, blinkWarn: 1.2 }, // blinkWarn: 나타난 뒤 잡지 않는 시간 (초)
  night: { walk: 1.1, chase: 2.15, hear: 1.4, blinkAfter: 3.5, blinkMin: 2.5, blinkMax: 4, blinkWarn: 0.9 }, // 달리기(2.3)보다 조금 느리다
};
