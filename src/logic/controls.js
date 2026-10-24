// 조작 방식
// classic: A/D 또는 방향키로 이동, Space/W/↑ 점프, J 펀치, K/Shift 대시, L 궁극기
// arrows: 방향키로 이동, Space/↑ 점프, A 펀치, S 대시, D 궁극기
export const CONTROL_SCHEMES = ['classic', 'arrows'];

export const CONTROL_INFO = {
  classic: {
    name: '기본 (WASD + J K L)',
    lines: [
      '이동 A / D 또는 ← →    점프 Space    대시 K 또는 Shift',
      '펀치 J 또는 마우스 왼쪽 (꾹 눌렀다 떼면 충전 펀치)    일시정지 Esc',
      '어퍼컷 W 나 ↑ 누른 채 펀치    궁극기 L (파란 게이지가 꽉 차면)',
    ],
  },
  arrows: {
    name: '방향키 + A S D',
    lines: [
      '이동 ← →    점프 Space 또는 ↑    대시 S 또는 Shift',
      '펀치 A 또는 마우스 왼쪽 (꾹 눌렀다 떼면 충전 펀치)    일시정지 Esc',
      '어퍼컷 ↑ 누른 채 펀치    궁극기 D (파란 게이지가 꽉 차면)',
    ],
  },
};

// 태블릿 (키보드 없음): 화면 버튼으로 한다. 타이틀 조작판에 이 글을 쓴다.
export const TOUCH_INFO = {
  name: '터치 버튼',
  lines: [
    '이동 왼쪽 화면을 엄지로 밀기 (조이스틱)    점프 버튼 (물속에선 꾹 눌러 헤엄)',
    '펀치 버튼 (꾹 눌렀다 떼면 충전 펀치)    대시 버튼    일시정지 오른쪽 위 II',
    '어퍼컷 조이스틱을 위로 민 채 펀치    궁극기 버튼 (파란 게이지가 꽉 차면)',
  ],
};

// 조작 방식별 키 이름 (Phaser KeyCodes 이름)
export const CONTROL_KEYS = {
  classic: { left: ['A', 'LEFT'], right: ['D', 'RIGHT'], jump: ['SPACE', 'W', 'UP'], up: ['W', 'UP'], attack: ['J'], dash: ['K', 'SHIFT'], ult: ['L'] },
  arrows: { left: ['LEFT'], right: ['RIGHT'], jump: ['SPACE', 'UP'], up: ['UP'], attack: ['A'], dash: ['S', 'SHIFT'], ult: ['D'] },
};

// 안내 글 속 {punch} 같은 표시를 고른 조작 방식의 키 이름으로 바꾼다.
// 스테이지 안내판과 로봇 대사에 쓴다. 예: '{punch} 를 꾹 눌러!' → 'J 를 꾹 눌러!'
export const KEY_NAMES = {
  classic: { move: 'A / D 또는 ← →', jump: 'Space', punch: 'J', dash: 'K 또는 Shift', ult: 'L', up: 'W 나 ↑' },
  arrows: { move: '← →', jump: 'Space 또는 ↑', punch: 'A', dash: 'S 또는 Shift', ult: 'D', up: '↑' },
  touch: { move: '조이스틱', jump: '점프 버튼', punch: '펀치 버튼', dash: '대시 버튼', ult: '궁극기 버튼', up: '조이스틱 위로' },
};

// scheme 이 'touch' 면 버튼 이름으로 바꾸고, 뒤에 붙은 말을 버튼에 맞게 고친다 ('J 를' → '펀치 버튼을').
export function keyText(str, scheme) {
  const touch = scheme === 'touch';
  const names = KEY_NAMES[touch ? 'touch' : normalizeControls(scheme)];
  const out = String(str).replace(/\{(\w+)\}/g, (m, k) => names[k] ?? m);
  if (!touch) return out;
  return out
    .replace(/ 또는 마우스 왼쪽/g, '') // 태블릿에는 마우스가 없다
    .replace(/조이스틱 위로 누른 채/g, '조이스틱을 위로 민 채')
    .replace(/버튼 키를/g, '버튼을')
    .replace(/버튼 키/g, '버튼')
    .replace(/버튼 를/g, '버튼을')
    .replace(/버튼 로/g, '버튼으로');
}

export function normalizeControls(scheme) {
  return CONTROL_SCHEMES.includes(scheme) ? scheme : 'classic';
}
