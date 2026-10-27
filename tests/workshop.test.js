import { describe, it, expect } from 'vitest';
import {
  MAX_DESIGNS,
  LOOKS,
  cleanText,
  newDesign,
  normalizeWorkshop,
  saveDesign,
  removeDesign,
  recordCatch,
  lookUnlocked,
  stageChoices,
  workshopSpots,
  workshopStats,
  textureKey,
  dominantHue,
  recolorPixels,
  rgbToHsl,
  hslToRgb,
  randomName,
} from '../src/logic/workshop.js';
import { stages } from '../src/stage/index.js';
import { defaultSave, createSaveStore } from '../src/logic/save.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}

describe('몬스터 공방 저장', () => {
  it('이상한 값은 고치고 3개까지만 남긴다', () => {
    const w = normalizeWorkshop({
      designs: [
        { id: 'w1', name: '  불꽃<b>주먹</b>  ', look: 'nope', color: 'gold', size: 'xl', move: 'jumper', maker: '꿀곰이', stage: 3, caught: 2 },
        { id: 'w1', name: '같은 번호' },
        { id: 'bad' },
        { id: 'w2' },
        { id: 'w3' },
        { id: 'w4' },
      ],
    });
    expect(w.designs).toHaveLength(MAX_DESIGNS);
    const d = w.designs[0];
    expect(d.name).toBe('불꽃b주먹/b');
    expect(d.look).toBe('monster');
    expect(d.color).toBe('gold');
    expect(d.size).toBe('xl');
    expect(d.caught).toBe(2);
    expect(w.designs[1].name).toBe('이름 없는 몬스터');
    expect(w.next).toBe(4);
  });

  it('이름은 10글자까지, 한글도 글자 단위로 자른다', () => {
    expect(cleanText('가나다라마바사아자차카타', 10)).toBe('가나다라마바사아자차');
    expect(cleanText('줄\n바꿈', 10)).toBe('줄 바꿈');
  });

  it('저장, 고치기, 지우기, 잡은 수', () => {
    let w = saveDesign(undefined, { ...newDesign(1), name: '쿵쿵킹' });
    w = saveDesign(w, { ...newDesign(2), name: '둘째' });
    expect(w.designs.map((d) => d.name)).toEqual(['쿵쿵킹', '둘째']);
    let r = recordCatch(w, 'w1');
    expect(r.first).toBe(true);
    r = recordCatch(r.workshop, 'w1');
    expect(r.first).toBe(false);
    expect(r.design.caught).toBe(2);
    // 고쳐도 잡은 수는 남는다
    w = saveDesign(r.workshop, { ...r.workshop.designs[0], name: '쿵쿵대왕', caught: 0 });
    expect(w.designs[0].name).toBe('쿵쿵대왕');
    expect(w.designs[0].caught).toBe(2);
    w = removeDesign(w, 'w1');
    expect(w.designs.map((d) => d.id)).toEqual(['w2']);
    // 3개가 꽉 차면 새 작품은 안 들어간다
    w = saveDesign(saveDesign(saveDesign(w, newDesign(3)), newDesign(4)), newDesign(5));
    expect(w.designs).toHaveLength(3);
  });

  it('저장 파일에 들어가고 다시 읽힌다', () => {
    const store = createSaveStore(memoryStorage());
    expect(store.load().workshop.designs).toEqual([]);
    store.update({ workshop: saveDesign(undefined, { ...newDesign(1), stage: 2 }) });
    expect(store.load().workshop.designs[0].stage).toBe(2);
    expect(defaultSave().workshop).toEqual({ designs: [], next: 1 });
  });

  it('무작위 이름은 두 조각을 붙인다', () => {
    expect(randomName(() => 0)).toBe('불꽃주먹');
    expect(randomName(() => 0.99).length).toBeGreaterThan(1);
  });
});

describe('공방 고르기', () => {
  it('생김새: 처음 넷은 바로, 나머지는 도감에서 잡아야', () => {
    const dex = { monsters: { monster_lava_basic: 1 } };
    const open = LOOKS.filter((l) => lookUnlocked(l, dex)).map((l) => l.id);
    expect(open).toEqual(['monster', 'monster_fast', 'monster_tank', 'monster_jumper', 'monster_lava_basic']);
  });

  it('나올 스테이지: 열린 곳 중 물속은 뺀다', () => {
    const choices = stageChoices({ unlocked: stages.length }, stages);
    expect(choices.length).toBeGreaterThan(3);
    for (const n of choices) expect(stages[n - 1].swim).toBeFalsy();
    expect(stageChoices({ unlocked: 1 }, stages)).toEqual([1]);
  });
});

describe('스테이지에 놓기', () => {
  it('모든 땅 스테이지에서 보스 문 앞, 땅 위에 놓는다', () => {
    const d = [{ ...newDesign(1), size: 'm' }, { ...newDesign(2), size: 'xl', move: 'tank' }];
    stages.forEach((st) => {
      const spots = workshopSpots(st, d);
      if (st.swim) return expect(spots).toEqual([]);
      expect(spots.length).toBe(3);
      for (const s of spots) {
        expect(s.x).toBeLessThan(st.gateX);
        expect(s.y).toBe(st.groundY || 480);
        expect(s.workshop).toBeTruthy();
      }
      expect(spots[2].type).toBe('tank');
    });
  });

  it('크기는 체력과 경험치를 바꾼다', () => {
    const m = { maxHealth: 40, xp: 20, size: 1 };
    expect(workshopStats(m, { size: 'xl' })).toMatchObject({ size: 1.75, maxHealth: 96, xp: 48 });
    expect(workshopStats(m, { size: 's' })).toMatchObject({ size: 0.7, maxHealth: 24 });
    expect(textureKey({ look: 'monster', color: 'gold' })).toBe('ws_monster_gold');
  });
});

describe('색 바꾸기', () => {
  const px = (rgbs) => new Uint8ClampedArray(rgbs.flatMap(([r, g, b]) => [r, g, b, 255]));

  it('hsl 바꿨다 되돌리면 같은 색', () => {
    const [h, s, l] = rgbToHsl(60, 180, 90);
    const [r, g, b] = hslToRgb(h, s, l);
    expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([60, 180, 90]);
  });

  it('초록 몸을 빨강으로, 흰 눈은 그대로', () => {
    const p = px([[40, 200, 60], [50, 180, 70], [255, 255, 255]]);
    expect(Math.round(dominantHue(p))).toBeGreaterThan(110);
    recolorPixels(p, 'red');
    const [h] = rgbToHsl(p[0], p[1], p[2]);
    expect(h < 20 || h > 340).toBe(true);
    expect([p[8], p[9], p[10]]).toEqual([255, 255, 255]);
  });

  it('원래 색은 그대로, 그림자는 어둡게', () => {
    const p = px([[40, 200, 60]]);
    recolorPixels(p, 'orig');
    expect([p[0], p[1], p[2]]).toEqual([40, 200, 60]);
    recolorPixels(p, 'shadow');
    expect(rgbToHsl(p[0], p[1], p[2])[2]).toBeLessThan(0.25);
  });
});
