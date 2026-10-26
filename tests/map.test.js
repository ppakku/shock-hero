import { describe, it, expect } from 'vitest';
import { nodePosition, roadPoints, locateStage, chapterUnlocked } from '../src/ui/mapLayout.js';
import { chapters, stages } from '../src/stage/index.js';

describe('모험 지도', () => {
  it('장마다 스테이지 점이 지도 안(위 장 이름, 아래 설명판 사이)에 겹치지 않게 놓인다', () => {
    for (const ch of chapters) {
      const pts = ch.stages.map((_, i) => nodePosition(i));
      for (const p of pts) {
        expect(p.x).toBeGreaterThan(60);
        expect(p.x).toBeLessThan(900);
        expect(p.y).toBeGreaterThan(110);
        expect(p.y).toBeLessThan(400);
      }
      for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) expect(Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)).toBeGreaterThan(90);
    }
  });

  it('길은 두 점을 잇는다', () => {
    const a = nodePosition(0);
    const b = nodePosition(1);
    const r = roadPoints(a, b, 8);
    expect(r[0]).toEqual(a);
    expect(r[8].x).toBeCloseTo(b.x);
    expect(r[8].y).toBeCloseTo(b.y);
  });

  it('스테이지가 몇 장 몇 번째인지 찾는다', () => {
    expect(locateStage(chapters, 1)).toEqual({ chapterIndex: 0, index: 0 });
    expect(locateStage(chapters, 11)).toEqual({ chapterIndex: 1, index: 0 });
    expect(locateStage(chapters, 20)).toEqual({ chapterIndex: 1, index: 9 });
  });

  it('2장은 스테이지 11 이 열려야 열린다', () => {
    expect(chapterUnlocked(chapters[1], 10)).toBe(false);
    expect(chapterUnlocked(chapters[1], 11)).toBe(true);
    expect(chapters.flatMap((c) => c.stages)).toEqual(stages.map((_, i) => i + 1));
  });
});
