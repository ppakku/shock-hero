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

// 조작 방식별 키 이름 (Phaser KeyCodes 이름)
export const CONTROL_KEYS = {
  classic: { left: ['A', 'LEFT'], right: ['D', 'RIGHT'], jump: ['SPACE', 'W', 'UP'], up: ['W', 'UP'], attack: ['J'], dash: ['K', 'SHIFT'], ult: ['L'] },
  arrows: { left: ['LEFT'], right: ['RIGHT'], jump: ['SPACE', 'UP'], up: ['UP'], attack: ['A'], dash: ['S', 'SHIFT'], ult: ['D'] },
};

export function normalizeControls(scheme) {
  return CONTROL_SCHEMES.includes(scheme) ? scheme : 'classic';
}
