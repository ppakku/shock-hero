import { describe, it, expect, vi, afterEach } from 'vitest';
import { FOREST_MAP_ID, FOREST_MONSTER_ID, FOREST_ROUND, MAP_IDS, MONSTER_IDS, RANDOM, chooseRound, forcedRound, isForest, isLastNight, isRound, pickRound, roundMonsters } from '../src/logic/horrorPick.js';
import { addStamp, boardSize, cellKey, normalizeStamps } from '../src/logic/horrorStamps.js';
import { createRun, normalizeHorror } from '../src/logic/horrorRun.js';
import { tonightRound } from '../src/logic/horrorTonight.js';
import { ALL_MAPS, ALL_MONSTERS, FOREST_PLACE, MAPS, MONSTERS, SPECIAL_MONSTERS } from '../src/horror/content.js';
import { forestCard, poolCard, showChooser } from '../src/horror/chooser.js';
import { HorrorHud, escapeText, forestEscapeHead, introLines } from '../src/horror/hud.js';
import { ENDINGS, FINAL_LINES, NOTES, clueTexts, fillName } from '../src/horror/story.js';
import { startHorror } from '../src/horror/start.js';
import { saveStore } from '../src/save.js';
import { balance } from '../src/config/balance.js';

const k = balance.horror;
const maiden = ALL_MONSTERS[FOREST_MONSTER_ID];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('어른용 숲 판', () => {
  it('맵과 괴물 목록 밖에 있어서 도장판이 그대로다', () => {
    expect(MAP_IDS).not.toContain(FOREST_MAP_ID);
    expect(MONSTER_IDS).not.toContain(FOREST_MONSTER_ID);
    expect(Object.keys(MAPS)).not.toContain(FOREST_MAP_ID);
    expect(Object.keys(MONSTERS)).not.toContain(FOREST_MONSTER_ID);
    expect(boardSize()).toBe(MAP_IDS.length * MONSTER_IDS.length);
    expect(isRound(FOREST_ROUND)).toBe(false);
    expect(isForest(FOREST_ROUND)).toBe(true);
    expect(isLastNight(FOREST_ROUND)).toBe(false);
    expect(isForest({ mapId: MAP_IDS[0], monsterId: MONSTER_IDS[0] })).toBe(false);
    expect(roundMonsters(FOREST_ROUND)).toEqual([FOREST_MONSTER_ID]);
  });

  it('게임이 찾는 표에는 숲과 처녀귀신이 있다', () => {
    expect(ALL_MAPS[FOREST_MAP_ID]).toBe(FOREST_PLACE);
    expect(maiden).toBe(SPECIAL_MONSTERS[FOREST_MONSTER_ID]);
    expect(maiden.name).toBe('처녀귀신');
    expect(maiden.model && maiden.voice && maiden.hint).toBeTruthy();
    expect(FOREST_PLACE.hint).toBe(maiden.hint);
    for (const id of MONSTER_IDS) expect(ALL_MONSTERS[id]).toBe(MONSTERS[id]);
  });

  it('랜덤으로도, 오늘의 밤으로도 절대 나오지 않는다', () => {
    for (let i = 0; i < 300; i++) {
      const rand = () => (i + 0.5) / 300;
      expect(pickRound(null, rand).mapId).not.toBe(FOREST_MAP_ID);
      expect(pickRound(FOREST_ROUND, rand).monsterId).not.toBe(FOREST_MONSTER_ID);
      const r = chooseRound({ mapId: FOREST_MAP_ID, monsterId: FOREST_MONSTER_ID }, null, rand); // 잘못 고른 값도 보통 판이 된다
      expect(isRound(r)).toBe(true);
      expect(chooseRound({ mapId: RANDOM, monsterId: RANDOM }, null, rand).monsterId).not.toBe(FOREST_MONSTER_ID);
    }
    for (let d = 1; d <= 400; d++) {
      const t = tonightRound(`2026-${String(1 + (d % 12)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}-${d}`);
      expect(t.mapId).not.toBe(FOREST_MAP_ID);
      expect(t.monsterId).not.toBe(FOREST_MONSTER_ID);
    }
  });

  it('시험 주소로 바로 들어갈 수 있다', () => {
    expect(forcedRound(`?map=${FOREST_MAP_ID}`)).toBe(FOREST_ROUND);
    expect(forcedRound(`?monster=${FOREST_MONSTER_ID}`)).toBe(FOREST_ROUND);
    expect(forcedRound(`?map=${FOREST_MAP_ID}&monster=${MONSTER_IDS[1]}`)).toBe(FOREST_ROUND);
    expect(forcedRound(`?map=${MAP_IDS[0]}&monster=${MONSTER_IDS[1]}`)).toEqual({ mapId: MAP_IDS[0], monsterId: MONSTER_IDS[1] });
  });

  it('지난 판으로 저장되어도 버려지고, 도장을 주지 않는다', () => {
    expect(normalizeHorror({ last: FOREST_ROUND }).last).toBe(null);
    expect(addStamp({}, FOREST_ROUND, true)).toEqual({ stamps: {}, earned: null });
    expect(normalizeStamps({ [cellKey(FOREST_ROUND)]: 'gold' })).toEqual({});
  });
});

describe('숲 이야기', () => {
  const run = createRun(FOREST_PLACE.map, k, () => 0.3);

  it('쪽지가 다른 맵과 같은 모양이고 빈칸이 남지 않는다', () => {
    expect(FOREST_PLACE.notes).toBe(NOTES[FOREST_MAP_ID]);
    expect(NOTES[FOREST_MAP_ID]).toHaveLength(NOTES.factory.length);
    const all = fillName([...FOREST_PLACE.notes.flat(), ENDINGS[FOREST_MAP_ID], FINAL_LINES[FOREST_MAP_ID], ...clueTexts(FOREST_MAP_ID, run.code).flat()], maiden.name);
    expect(all.join(' ')).not.toMatch(/[{}]/);
    expect(all.join(' ')).not.toMatch(/[—·]|피|죽|시체|살해/);
    expect(all.join(' ')).not.toMatch(/처녀귀신[는가를]/);
  });

  it('알림은 받침에 맞는 조사로 나온다', () => {
    expect(fillName(maiden.alarm, maiden.name)).toBe('처녀귀신이 따라온다! 도망쳐!');
  });
});

describe('숲 소개와 끝 글', () => {
  const round = { mapName: FOREST_PLACE.name, monsterName: maiden.name, hint: FOREST_PLACE.hint, tonight: null, forest: true };

  it('소개는 숲의 규칙 줄을 쓰고, 휴대폰도 줄 수가 보통 판과 같다', () => {
    const pc = introLines('pc', round);
    expect(pc[0]).toBe('해 질 녘 숲: 처녀귀신');
    expect(pc[1]).toBe(FOREST_PLACE.hint);
    expect(pc.join(' ')).toContain('쪽지 세 장');
    expect(pc.join(' ')).toContain('속 빈 고목');
    expect(pc.join(' ')).toContain('다른 곳에서 나타나요');
    expect(pc.join(' ')).not.toContain('사물함');
    const plain = { ...round, forest: false, monsterName: MONSTERS.seino.name };
    expect(introLines('phone', round)).toHaveLength(introLines('phone', plain).length);
  });

  it('맨 위 경고가 어른용 줄로 바뀌고 굵고 붉다', () => {
    const fakeEl = () => ({
      style: {},
      kids: [],
      addEventListener() {},
      appendChild(c) { this.kids.push(c); },
      get children() { return this.kids; },
      remove() {},
      focus() {},
    });
    vi.stubGlobal('document', { createElement: fakeEl });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const hud = new HorrorHud(fakeEl(), '조심', FOREST_ROUND);
    hud.showIntro('pc', round, () => {}, () => {});
    const top = hud.layer.children[0];
    expect(top.textContent).toBe('어른도 무서워요. 불을 켜고, 혼자 하지 마세요.');
    expect(top.style.cssText).toContain('bold');
    expect(top.style.cssText).toContain('#ff9aa8');
    hud.showIntro('pc', { ...round, forest: false }, () => {}, () => {});
    expect(hud.layer.children[0].textContent).toContain('꽤 무서워요');
  });

  it('탈출 글은 보통 판과 같은 갈래로 숲을 빠져나왔다고 말한다', () => {
    const head = forestEscapeHead(FOREST_PLACE.name);
    expect(head).toBe('해 질 녘 숲을 빠져나왔어요!');
    expect(escapeText({ gems: 5, daily: 5, bonus: 0 }, false, head)).toBe('해 질 녘 숲을 빠져나왔어요! 보석 5개');
    expect(escapeText({ gems: 0, daily: 0, bonus: 0 }, false, head)).toBe('해 질 녘 숲을 빠져나왔어요! 오늘은 이미 보석을 받았어요');
    expect(escapeText({ gems: 10, daily: 5, bonus: 5 }, true, head)).toContain('처음으로 한 번도 안 잡혔어요');
    expect(escapeText({ gems: 5, daily: 5, bonus: 0 }, false)).toBe('탈출 성공! 보석 5개');
  });
});

// 고르기 화면이 쓰는 만큼만 흉내 낸 화면
function fakeDom() {
  const dom = { focused: null, keys: [] };
  class El {
    constructor(tag) {
      Object.assign(this, { tag, style: {}, dataset: {}, kids: [], on: {}, attrs: {}, textContent: '', parent: null });
    }
    addEventListener(type, fn) { (this.on[type] ??= []).push(fn); }
    appendChild(c) { c.parent = this; this.kids.push(c); return c; }
    append(...list) { list.forEach((c) => this.appendChild(c)); }
    get lastChild() { return this.kids.at(-1); }
    remove() {
      if (!this.parent) return;
      this.parent.kids = this.parent.kids.filter((c) => c !== this);
      this.parent = null;
    }
    focus() { dom.focused = this; }
    setAttribute(key, value) { this.attrs[key] = value; }
    click() { (this.on.click ?? []).forEach((fn) => fn({ stopPropagation() {} })); }
    text() { return [this.textContent, ...this.kids.map((c) => c.text())].join(''); }
  }
  dom.root = new El('div');
  dom.find = (test, from = dom.root) => {
    if (test(from)) return from;
    for (const c of from.kids) {
      const hit = dom.find(test, c);
      if (hit) return hit;
    }
    return null;
  };
  dom.data = (key) => dom.find((el) => key in el.dataset);
  dom.key = (code) => dom.keys.slice().forEach((fn) => fn({ code, preventDefault() {} }));
  vi.stubGlobal('document', { createElement: (tag) => new El(tag) });
  vi.stubGlobal('window', {
    addEventListener: (type, fn) => { if (type === 'keydown') dom.keys.push(fn); },
    removeEventListener: (type, fn) => { dom.keys = dom.keys.filter((f) => f !== fn); },
  });
  return dom;
}

describe('고르기 화면의 어른용 칸', () => {
  const open = (compact = false) => {
    const dom = fakeDom();
    const calls = { forest: 0, pool: 0, start: 0 };
    showChooser(dom.root, {
      choice: { mapId: RANDOM, monsterId: RANDOM },
      compact,
      record: normalizeHorror({}),
      tonight: tonightRound('2026-11-07'),
      onLook() {},
      onStart: () => calls.start++,
      onLastNight() {},
      onTonight() {},
      onForest: () => calls.forest++,
      onPool: () => calls.pool++,
      onQuit() {},
    });
    return { dom, calls };
  };

  it('오늘의 밤 칸 아래에 두 줄로 놓이고 휴대폰은 한 줄이다', () => {
    const { dom } = open();
    const btn = dom.data('forest');
    expect(btn.text()).toBe(forestCard().join(''));
    expect(forestCard()[0]).toBe('어른용: 해 질 녘 숲, 처녀귀신');
    expect(btn.style.cssText).toContain('#b8435a');
    const panel = btn.parent;
    expect(panel.kids.indexOf(btn)).toBe(panel.kids.indexOf(dom.data('tonight')) + 1);
    const phone = open(true).dom.data('forest');
    expect(phone.kids).toHaveLength(1);
    expect(phone.style.cssText).toContain('font-size:13px');
  });

  it('누르면 확인 창이 뜨고 돌아가기에 손이 가 있어서 Enter 로는 들어가지 않는다', () => {
    const { dom, calls } = open();
    dom.data('forest').click();
    const confirm = dom.data('forestConfirm');
    expect(confirm).toBeTruthy();
    expect(confirm.text()).toContain('하늘이 완전히 어두워지기 전에');
    expect(confirm.text()).toContain('아이 혼자 하지 않게');
    expect(dom.focused).toBe(dom.data('forestBack'));
    dom.focused.click(); // Enter 는 손이 간 버튼을 누른다
    expect(dom.data('forestConfirm')).toBe(null);
    expect(dom.data('chooser')).toBeTruthy();
    expect(calls.forest).toBe(0);
    expect(dom.keys).toHaveLength(0);
  });

  it('돌아가도 고른 맵은 그대로이고, Escape 로도 닫힌다', () => {
    const { dom, calls } = open();
    dom.find((el) => el.dataset.pick === MAP_IDS[1]).click();
    dom.data('forest').click();
    dom.key('Escape');
    expect(dom.data('forestConfirm')).toBe(null);
    expect(dom.find((el) => el.dataset.pick === MAP_IDS[1]).attrs['aria-pressed']).toBe('true');
    dom.data('forest').click(); // 누를 때마다 다시 묻는다
    expect(dom.data('forestConfirm')).toBeTruthy();
    expect(calls.forest).toBe(0);
  });

  it('들어가기를 누르면 화면을 닫고 숲으로 간다', () => {
    const { dom, calls } = open(true);
    dom.data('forest').click();
    dom.data('forestEnter').click();
    expect(calls.forest).toBe(1);
    expect(calls.start).toBe(0);
    expect(dom.data('chooser')).toBe(null);
    expect(dom.keys).toHaveLength(0);
  });
});

describe('어른용 수영장 칸', () => {
  const open = (compact = false) => {
    const dom = fakeDom();
    const calls = { forest: 0, pool: 0 };
    showChooser(dom.root, {
      choice: { mapId: RANDOM, monsterId: RANDOM },
      compact,
      record: normalizeHorror({}),
      tonight: tonightRound('2026-11-07'),
      onLook() {},
      onStart() {},
      onLastNight() {},
      onTonight() {},
      onForest: () => calls.forest++,
      onPool: () => calls.pool++,
      onQuit() {},
    });
    return { dom, calls };
  };

  it('숲 칸 바로 아래에 같은 붉은 모양으로 놓인다', () => {
    const { dom } = open();
    const btn = dom.data('pool');
    expect(btn.text()).toBe(poolCard().join(''));
    expect(poolCard()[0]).toBe('어른용: 불 켜진 수영장, 물괴물');
    expect(btn.style.cssText).toBe(dom.data('forest').style.cssText);
    const panel = btn.parent;
    expect(panel.kids.indexOf(btn)).toBe(panel.kids.indexOf(dom.data('forest')) + 1);
    expect(open(true).dom.data('pool').kids).toHaveLength(1);
  });

  it('누르면 수영장 확인 창이 뜨고, 돌아가기에 손이 가 있다', () => {
    const { dom, calls } = open();
    dom.data('pool').click();
    const confirm = dom.data('poolConfirm');
    expect(confirm.text()).toContain('물에 닿으면 소리가 나고');
    expect(confirm.text()).toContain('아이 혼자 하지 않게');
    expect(dom.focused).toBe(dom.data('poolBack'));
    dom.key('Escape');
    expect(dom.data('poolConfirm')).toBe(null);
    expect(calls.pool).toBe(0);
  });

  it('들어가기를 누르면 화면을 닫고 수영장으로 간다. 숲으로는 가지 않는다', () => {
    const { dom, calls } = open(true);
    dom.data('pool').click();
    dom.data('poolEnter').click();
    expect(calls.pool).toBe(1);
    expect(calls.forest).toBe(0);
    expect(dom.data('chooser')).toBe(null);
  });
});

describe('숲 시작과 한 판 더', () => {
  async function begin(search = '') {
    const root = { style: {}, textContent: '', remove() {} };
    vi.stubGlobal('document', { createElement: (tag) => (tag === 'canvas' ? { getContext: () => ({ getExtension: () => null }) } : root), body: { appendChild: () => {} } });
    vi.stubGlobal('location', { search });
    let saved = { horror: { last: null }, settings: {} };
    vi.spyOn(saveStore, 'load').mockImplementation(() => JSON.parse(JSON.stringify(saved)));
    vi.spyOn(saveStore, 'save').mockImplementation((s) => { saved = s; });
    const made = [];
    const shown = [];
    class Fake {
      constructor(r, o) { this.o = o; made.push(this); }
      start() {}
    }
    const showChooser = (r, o) => {
      shown.push(o);
      if (shown.length === 1) o.onForest();
    };
    await startHorror({ pause: vi.fn(), resume: vi.fn() }, { onExit: vi.fn() }, async () => ({ HorrorGame: Fake, showChooser }));
    return { made, shown, saved: () => saved };
  }

  it('어른용 칸은 숲으로 들어가고 지난 판으로 남지 않는다', async () => {
    const { made, saved } = await begin();
    expect(made[0].o.round).toBe(FOREST_ROUND);
    expect(made[0].o.tonight).toBe(null);
    expect(saved().horror.last).toBe(null);
  });

  it('숲의 한 판 더는 고르기와 확인 창 없이 바로 숲이다', async () => {
    const { made, shown } = await begin();
    made[0].o.onAgain();
    expect(shown).toHaveLength(1);
    expect(made[1].o.round).toBe(FOREST_ROUND);
    made[1].o.onAgain();
    expect(made[2].o.round).toBe(FOREST_ROUND);
  });

  it('주소로 들어간 숲도 같고, 보통 판의 한 판 더는 전처럼 고르기로 간다', async () => {
    const forced = await begin('?map=forest');
    expect(forced.shown).toHaveLength(0);
    expect(forced.made[0].o.round).toBe(FOREST_ROUND);
    forced.made[0].o.onAgain();
    expect(forced.made[1].o.round).toBe(FOREST_ROUND);
    vi.restoreAllMocks();
    const plain = await begin('?map=sewer&monster=maw');
    plain.made[0].o.onAgain();
    expect(plain.shown).toHaveLength(1);
  });
});
