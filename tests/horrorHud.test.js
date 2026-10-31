import { describe, it, expect } from 'vitest';
import { controlLines, startHint, MONSTER_NAME } from '../src/horror/hud.js';

describe('공포 모드 조작 안내', () => {
  it('PC 는 키보드와 마우스를 알려 준다', () => {
    const text = controlLines(false).join(' ');
    for (const word of ['W A S D', '마우스', 'Shift', 'F', 'Esc', '줍기와 숨기: E', '쇼크 펀치: 왼쪽 클릭']) expect(text).toContain(word);
    expect(text).not.toContain('버튼');
  });

  it('태블릿은 손가락 조작과 화면 버튼을 알려 준다', () => {
    const text = controlLines(true).join(' ');
    for (const word of ['왼쪽', '오른쪽', '손전등 버튼', '멈춤 버튼', '사용 버튼', '펀치 버튼']) expect(text).toContain(word);
    expect(text).not.toContain('Esc');
  });

  it('기기마다 다른 시작 알림을 준다', () => {
    expect(startHint(true)).toContain('왼쪽');
    expect(startHint(false)).toContain('마우스');
  });

  it('괴물 이름은 세이노다', () => {
    expect(MONSTER_NAME).toBe('세이노');
  });
});
