import { describe, it, expect } from 'vitest';
import { controlLines, startHint, escapeText, MONSTER_NAME } from '../src/horror/hud.js';

describe('공포 모드 조작 안내', () => {
  it('PC 는 키보드와 마우스를 알려 준다', () => {
    const text = controlLines(false).join(' ');
    for (const word of ['W A S D', '마우스', 'Shift', 'F', 'Esc', '줍기와 숨기: E', '쇼크 펀치: J 또는 왼쪽 클릭', '좌우 방향키']) expect(text).toContain(word);
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

  it('끝 화면은 실제로 받은 보석만 말한다', () => {
    expect(escapeText({ gems: 10, daily: 5, bonus: 5 }, true)).toContain('보석 10개');
    expect(escapeText({ gems: 5, daily: 5, bonus: 0 }, false)).toBe('탈출 성공! 보석 5개');
    expect(escapeText({ gems: 5, daily: 5, bonus: 0 }, true)).toContain('보석 5개');
    const bonusOnly = escapeText({ gems: 5, daily: 0, bonus: 5 }, true);
    expect(bonusOnly).toContain('보석 5개');
    expect(bonusOnly).toContain('오늘 이미');
    for (const clean of [true, false]) {
      const none = escapeText({ gems: 0, daily: 0, bonus: 0 }, clean);
      expect(none).toContain('오늘은 이미 보석을 받았어요');
      expect(none).not.toMatch(/보석 \d/);
    }
  });

  it('괴물 이름은 세이노다', () => {
    expect(MONSTER_NAME).toBe('세이노');
  });
});
