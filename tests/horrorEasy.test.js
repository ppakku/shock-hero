import { describe, it, expect, vi, afterEach } from 'vitest';
import { EASY, HARD, createRun, emptyHorror, normalizeHorror } from '../src/logic/horrorRun.js';
import { AID_KINDS, createAids, useAid } from '../src/logic/horrorAids.js';
import { RANDOM } from '../src/logic/horrorPick.js';
import { tonightRound } from '../src/logic/horrorTonight.js';
import { ALL_MAPS } from '../src/horror/content.js';
import { LEVEL_OPTIONS, showChooser } from '../src/horror/chooser.js';
import { introLines, levelLine } from '../src/horror/hud.js';
import { startHorror } from '../src/horror/start.js';
import { saveStore } from '../src/save.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;

describe('난이도 저장', () => {
  it('처음에는 쉬움이고, 어려움을 고르면 남는다', () => {
    expect(emptyHorror().level).toBe(EASY);
    expect(normalizeHorror(null).level).toBe(EASY);
    expect(normalizeHorror({ level: HARD }).level).toBe(HARD);
    expect(normalizeHorror({ level: 'nightmare' }).level).toBe(EASY);
  });
});

describe('쉬움의 아이템', () => {
  for (const id of Object.keys(ALL_MAPS)) {
    it(`${id}: 네 가지를 처음부터 들고 있고 써도 줄지 않는다. 벽 지도와 바닥 아이템은 없다`, () => {
      const run = createRun(ALL_MAPS[id].map, k, () => 0.5);
      const aids = createAids(run.level, k.aids, () => 0.5, [], true);
      expect(aids.boards).toEqual([]);
      expect(aids.items).toEqual([]);
      for (const kind of AID_KINDS) {
        for (let i = 0; i < 50; i++) expect(useAid(aids, kind)).toBe(true);
        expect(aids.held[kind]).toBe(Infinity);
      }
    });
  }

  it('어려움은 지금처럼 바닥에 놓이고 빈손으로 시작한다', () => {
    const run = createRun(ALL_MAPS.school.map, k, () => 0.5);
    const aids = createAids(run.level, k.aids, () => 0.5);
    expect(aids.items.length).toBeGreaterThan(0);
    expect(aids.boards).toHaveLength(k.aids.boards);
    for (const kind of AID_KINDS) expect(aids.held[kind]).toBe(0);
  });
});

describe('안내 화면의 난이도 줄', () => {
  it('쉬움과 어려움이 다르게 나오고 두 기기 모두 들어간다', () => {
    expect(levelLine(true, false)).toContain('숫자 1~4');
    expect(levelLine(true, true)).toContain('오른쪽 위 칸');
    expect(levelLine(false, false)).toContain('어려움');
    const round = { mapName: '맵', monsterName: '괴물', hint: '힌트', level: levelLine(true, false) };
    for (const d of ['pc', 'phone']) expect(introLines(d, round)).toContain(round.level);
  });
});

// 고르기 화면이 쓰는 만큼만 흉내 낸 화면
function fakeDom() {
  class El {
    constructor(tag) {
      Object.assign(this, { tag, style: {}, dataset: {}, kids: [], on: {}, attrs: {}, textContent: '', parent: null });
    }
    addEventListener(type, fn) { (this.on[type] ??= []).push(fn); }
    appendChild(c) { c.parent = this; this.kids.push(c); return c; }
    append(...list) { list.forEach((c) => this.appendChild(c)); }
    get lastChild() { return this.kids.at(-1); }
    remove() { if (this.parent) this.parent.kids = this.parent.kids.filter((c) => c !== this); }
    focus() {}
    setAttribute(key, value) { this.attrs[key] = value; }
    click() { (this.on.click ?? []).forEach((fn) => fn({ stopPropagation() {} })); }
  }
  const root = new El('div');
  const all = (from = root) => [from, ...from.kids.flatMap((c) => all(c))];
  vi.stubGlobal('document', { createElement: (tag) => new El(tag) });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  return { root, all };
}

describe('고르기 화면의 난이도 칸', () => {
  afterEach(() => vi.unstubAllGlobals());

  const open = (level) => {
    const dom = fakeDom();
    const calls = { level: [], start: [] };
    showChooser(dom.root, {
      choice: { mapId: RANDOM, monsterId: RANDOM },
      record: normalizeHorror({ level }),
      tonight: tonightRound('2026-11-08'),
      onLook() {},
      onLevel: (id) => calls.level.push(id),
      onStart: (picked) => calls.start.push(picked),
      onLastNight() {},
      onTonight() {},
      onForest() {},
      onPool() {},
      onQuit() {},
    });
    const levelBtn = (id) => dom.all().find((el) => el.tag === 'button' && el.dataset.pick === id && LEVEL_OPTIONS.some((o) => o.name === el.textContent));
    return { dom, calls, levelBtn };
  };

  it('맵 칸 위에 놓이고 저장된 난이도가 눌려 있다', () => {
    const { dom, levelBtn } = open(HARD);
    expect(levelBtn(HARD).attrs['aria-pressed']).toBe('true');
    expect(levelBtn(EASY).attrs['aria-pressed']).toBe('false');
    const labels = dom.all().filter((el) => el.textContent === '난이도' || el.textContent === '맵').map((el) => el.textContent);
    expect(labels).toEqual(['난이도', '맵']);
  });

  it('누르면 바로 알리고, 들어가기는 맵과 괴물만 넘긴다', () => {
    const { dom, calls, levelBtn } = open(undefined);
    expect(levelBtn(EASY).attrs['aria-pressed']).toBe('true');
    levelBtn(HARD).click();
    expect(calls.level).toEqual([HARD]);
    expect(levelBtn(HARD).attrs['aria-pressed']).toBe('true');
    dom.all().find((el) => el.textContent === '들어가기').click();
    expect(calls.start).toEqual([{ mapId: RANDOM, monsterId: RANDOM }]);
  });
});

describe('판을 만들 때 저장된 난이도를 넘긴다', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  for (const [level, easy] of [[undefined, true], [EASY, true], [HARD, false]]) {
    it(`${level ?? '처음'} → easy ${easy}`, async () => {
      const root = { style: {}, textContent: '', remove() {} };
      vi.stubGlobal('document', { createElement: (tag) => (tag === 'canvas' ? { getContext: () => ({ getExtension: () => null }) } : root), body: { appendChild: () => {} } });
      vi.spyOn(saveStore, 'load').mockImplementation(() => ({ horror: { last: null, level }, settings: {} }));
      vi.spyOn(saveStore, 'save').mockImplementation(() => {});
      const made = [];
      class Fake {
        constructor(r, o) { made.push(o); }
        start() {}
      }
      await startHorror({ pause() {}, resume() {} }, { onExit() {} }, async () => ({ HorrorGame: Fake, showChooser: (r, o) => o.onStart(o.choice) }));
      expect(made[0].easy).toBe(easy);
    });
  }
});
