export const FONT = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

// 휴대폰은 화면이 작아서 작은 글자(16 보다 작은 것)를 키운다. main.js 가 게임을 만들기 전에 정한다.
let phone = false;
export function setPhoneText(on) {
  phone = Boolean(on);
}
export function textSize(size, isPhone = phone) {
  return isPhone && size < 16 ? Math.min(16, Math.round(size * 1.2)) : size;
}

export function makeText(scene, x, y, str, size = 18, color = '#ffffff', extra = {}) {
  size = textSize(size);
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#000000',
    strokeThickness: Math.max(2, Math.round(size / 6)),
    align: 'center',
    ...extra,
  });
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
