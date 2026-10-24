import { describe, it, expect } from 'vitest';
import { cardLayout, tokenizeControlLine, photoKind, CARD_W, CARD_H } from '../src/ui/titleLayout.js';
import { CONTROL_INFO } from '../src/logic/controls.js';
import { stages } from '../src/stage/index.js';

// 카드가 화면(960) 안에 다 들어가는지 (고른 카드는 1.07배로 커진다)
function fits(layout, width = 960) {
  const half = (layout.w * 1.07) / 2;
  return layout.positions.every((p) => p.x - half >= 0 && p.x + half <= width);
}

describe('타이틀 스테이지 카드 자리', () => {
  it('5장은 한 줄, 원래 크기', () => {
    const l = cardLayout(5, { margin: 28 });
    expect(l.rows).toBe(1);
    expect(l.scale).toBe(1);
    expect(fits(l)).toBe(true);
  });

  it('6장도 한 줄로 화면 안에 들어간다', () => {
    const l = cardLayout(6, { margin: 28 });
    expect(l.rows).toBe(1);
    expect(l.positions).toHaveLength(6);
    expect(fits(l)).toBe(true);
    // 카드끼리 겹치지 않는다
    for (let i = 1; i < 6; i++) expect(l.positions[i].x - l.positions[i - 1].x).toBeGreaterThanOrEqual(l.w);
  });

  it('8장 넘으면 두 줄, 높이도 원래 칸 안', () => {
    const l = cardLayout(10, { top: 254, margin: 28 });
    expect(l.rows).toBe(2);
    expect(fits(l)).toBe(true);
    const bottom = Math.max(...l.positions.map((p) => p.y)) + l.h / 2;
    expect(bottom).toBeLessThanOrEqual(254 + CARD_H + 1);
    expect(l.w).toBeLessThan(CARD_W);
  });

  it('지금 있는 스테이지 수로도 들어간다', () => {
    expect(fits(cardLayout(stages.length, { margin: 28 }))).toBe(true);
  });
});

describe('조작법 줄 나누기', () => {
  it('키 이름은 키 조각, 나머지는 글자 조각', () => {
    expect(tokenizeControlLine('이동 A / D 또는 ← →    점프 Space')).toEqual([
      { type: 'text', text: '이동', wide: false },
      { type: 'key', text: 'A', wide: false },
      { type: 'text', text: '/', wide: false },
      { type: 'key', text: 'D', wide: false },
      { type: 'text', text: '또는', wide: false },
      { type: 'key', text: '←', wide: false },
      { type: 'key', text: '→', wide: false },
      { type: 'text', text: '점프', wide: true },
      { type: 'key', text: 'Space', wide: false },
    ]);
  });

  it('이어진 글자는 한 조각으로 묶는다', () => {
    const t = tokenizeControlLine('펀치 J 또는 마우스 왼쪽 (꾹 눌렀다 떼면 충전 펀치)    일시정지 Esc');
    expect(t.map((x) => x.text)).toEqual(['펀치', 'J', '또는 마우스 왼쪽 (꾹 눌렀다 떼면 충전 펀치)', '일시정지', 'Esc']);
  });

  it('모든 조작 방식 설명에서 글자를 잃지 않는다', () => {
    for (const info of Object.values(CONTROL_INFO)) {
      for (const line of info.lines) {
        const joined = tokenizeControlLine(line).map((x) => x.text).join(' ');
        expect(joined.replace(/\s+/g, ' ')).toBe(line.replace(/\s+/g, ' '));
        expect(tokenizeControlLine(line).some((x) => x.type === 'key')).toBe(true);
      }
    }
  });
});

describe('스테이지 사진 장면', () => {
  it('이름을 보고 장면을 고른다', () => {
    expect(stages.map((s, i) => photoKind(s, i)).slice(0, 5)).toEqual(['city', 'forest', 'lava', 'ice', 'castle']);
    expect(photoKind({ name: '바닷속 던전' }, 5)).toBe('water');
    expect(photoKind({ name: '괴물 성' }, 0)).toBe('castle');
  });

  it('스테이지 파일의 titlePhoto 가 먼저, 모르는 이름은 순서대로', () => {
    expect(photoKind({ name: '파괴된 도시', titlePhoto: 'ice' }, 0)).toBe('ice');
    expect(photoKind({ name: '???' }, 5)).toBe('water');
    expect(photoKind({ name: '???' }, 7)).toBe('forest');
  });
});
