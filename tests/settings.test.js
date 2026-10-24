import { describe, it, expect } from 'vitest';
import { adjustMonsters, withDifficulty, normalizeDifficulty, DIFFICULTY_VALUES } from '../src/logic/difficulty.js';
import { CONTROL_KEYS, normalizeControls } from '../src/logic/controls.js';
import { createSaveStore, defaultSave, resetProgress } from '../src/logic/save.js';

const spots = [
  { x: 900, y: 480, type: 'basic' },
  { x: 1100, y: 480, type: 'fast' },
  { x: 1300, y: 480, type: 'basic' },
  { x: 1500, y: 480, type: 'tank' },
  { x: 1700, y: 480, type: 'basic' },
  { x: 1900, y: 480, type: 'fast' },
];

describe('난이도', () => {
  it('보통은 스테이지 파일 그대로', () => {
    expect(adjustMonsters(spots, 'normal', 3000)).toEqual(spots);
  });

  it('쉬움은 몬스터가 적고 특수 몬스터가 줄어든다', () => {
    const easy = adjustMonsters(spots, 'easy', 3000);
    expect(easy.length).toBeLessThan(spots.length);
    const special = (list) => list.filter((s) => s.type !== 'basic').length;
    expect(special(easy)).toBeLessThan(special(spots));
  });

  it('어려움은 몬스터가 많고 특수 몬스터가 늘어나며, 모두 보스 문 앞에 있다', () => {
    const hard = adjustMonsters(spots, 'hard', 2000);
    expect(hard.length).toBeGreaterThan(spots.length);
    const special = (list) => list.filter((s) => s.type !== 'basic').length;
    expect(special(hard)).toBeGreaterThan(special(spots));
    for (const s of hard) expect(s.x).toBeLessThanOrEqual(1920);
  });

  it('보스는 어려울수록 빠르고 튼튼하고 공격을 더 겹쳐 쓴다', () => {
    const { easy, normal, hard } = DIFFICULTY_VALUES;
    expect(hard.bossSpeed).toBeLessThan(normal.bossSpeed);
    expect(normal.bossSpeed).toBeLessThan(easy.bossSpeed);
    expect(hard.bossCombo).toBeGreaterThan(normal.bossCombo);
    expect(hard.bossHealth).toBeGreaterThan(easy.bossHealth);
  });

  it('설정에 난이도 값을 붙이고, 모르는 이름은 보통으로', () => {
    expect(withDifficulty({ a: 1 }, 'hard').difficulty.level).toBe('hard');
    expect(normalizeDifficulty('impossible')).toBe('normal');
  });
});

describe('조작 방식', () => {
  it('방향키 방식은 A S D 로 펀치, 대시, 궁극기', () => {
    expect(CONTROL_KEYS.arrows.attack).toContain('A');
    expect(CONTROL_KEYS.arrows.dash).toContain('S');
    expect(CONTROL_KEYS.arrows.ult).toContain('D');
    expect(CONTROL_KEYS.arrows.left).not.toContain('A');
    expect(normalizeControls('x')).toBe('classic');
  });

  it('한 방식 안에서 같은 키가 두 동작에 겹치지 않는다 (점프와 위쪽 공격은 같이 써도 됨)', () => {
    for (const keys of Object.values(CONTROL_KEYS)) {
      const used = new Map();
      for (const [action, names] of Object.entries(keys)) {
        if (action === 'up') continue;
        for (const n of names) {
          expect(used.has(n), `${n} 이 ${used.get(n)} 와 ${action} 에 겹쳐요`).toBe(false);
          used.set(n, action);
        }
      }
    }
  });
});

describe('설정 저장과 레벨 초기화', () => {
  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  }

  it('난이도와 조작 방식이 저장된다', () => {
    const store = createSaveStore(memoryStorage());
    store.update({ settings: { ...defaultSave().settings, difficulty: 'hard', controls: 'arrows' } });
    expect(store.load().settings.difficulty).toBe('hard');
    expect(store.load().settings.controls).toBe('arrows');
  });

  it('초기화하면 레벨과 보물은 지워지고 설정은 남는다', () => {
    const save = { ...defaultSave(), level: 7, xp: 30, treasures: ['a'], unlocked: 4, bestTimes: { 1: 50 }, settings: { shake: false, muted: true, difficulty: 'hard', controls: 'arrows' } };
    const r = resetProgress(save);
    expect(r.level).toBe(1);
    expect(r.treasures).toEqual([]);
    expect(r.unlocked).toBe(1);
    expect(r.bestTimes).toEqual({});
    expect(r.settings).toEqual(save.settings);
  });
});
