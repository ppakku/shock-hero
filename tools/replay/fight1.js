// 스테이지 1: 오른쪽으로 달리다 점프하고 펀치를 계속 날리는 8초
// at = 스테이지 시작 뒤 몇 ms 에 누르는지, hold = 몇 ms 누르고 있는지 (기본 80)
// key 이름은 Playwright 키 이름 (KeyD, Space, KeyJ, KeyK, KeyL, ShiftLeft ...)
const punches = [];
for (let t = 3100; t < 7000; t += 400) punches.push({ at: t, key: 'KeyJ' });

export default {
  stage: 1,
  seconds: 8,
  fps: 10,
  keys: [
    { at: 500, key: 'KeyD', hold: 2500 },
    { at: 1500, key: 'Space', hold: 120 },
    ...punches,
    { at: 4500, key: 'KeyD', hold: 800 },
  ],
};
