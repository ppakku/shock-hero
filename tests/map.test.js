import { describe, it, expect } from 'vitest';
import { nodePosition, roadPoints, locateStage, chapterUnlocked, mapStartStage } from '../src/ui/mapLayout.js';
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

describe('지도를 열 때 고르는 스테이지', () => {
  const base = { checkpoint: null, lastStage: null, unlocked: 1 };

  it('처음이거나 초기화했으면 1 번', () => {
    expect(mapStartStage(base, undefined, 20)).toBe(1);
  });

  it('해 본 적이 있으면 마지막으로 들어간 스테이지', () => {
    expect(mapStartStage({ ...base, lastStage: 3, unlocked: 6 }, undefined, 20)).toBe(3);
  });

  it('체크포인트가 있으면 그 스테이지, 깨고 돌아오면 정해 준 스테이지', () => {
    expect(mapStartStage({ ...base, lastStage: 3, checkpoint: 5, unlocked: 6 }, undefined, 20)).toBe(5);
    expect(mapStartStage({ ...base, lastStage: 3, unlocked: 6 }, 4, 20)).toBe(4);
    expect(mapStartStage(base, 99, 20)).toBe(20);
  });
});
