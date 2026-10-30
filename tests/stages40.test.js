import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { stages, chapters, CHAPTER_NAMES, getStage, totalTreasures } from '../src/stage/index.js';
import { MONSTER_TYPES, parseMonsterSpot } from '../src/logic/monsters.js';
import { rushCourses, courseUnlocked, normalizeRush, finishRush, emptyRush } from '../src/logic/rush.js';
import { createSaveStore, defaultSave, clearStagePatch, STAGE_COUNT } from '../src/logic/save.js';
import { stageRamp, withDifficulty, levelsAhead, STAGE_LEVELS, DIFFICULTIES } from '../src/logic/difficulty.js';
import { monsterStats } from '../src/logic/monsters.js';
import { balance as cfg } from '../src/config/balance.js';
import { todayChallenge } from '../src/logic/daily.js';
import { stageChoices } from '../src/logic/workshop.js';
import { pageCount, pageOf, turnPage } from '../src/ui/paging.js';
import { locateStage, chapterUnlocked, mapStartStage } from '../src/ui/mapLayout.js';
import { bossDex, dexCounts, normalizeDex } from '../src/logic/dex.js';
import { customArt } from '../src/config/art.js';
import { stageArt, bossArtKeys } from '../src/logic/stageArt.js';

const JUMP = 100; // README: 발판 사이 높이는 100 이하
const REACH = 90; // 발판 끝과 끝 사이 가로 거리 (logic.test.js 의 발판 규칙과 같음)
const SEA_ONLY = ['jelly', 'puffer', 'piranha', 'crab'];
const LAND_ONLY = ['basic', 'fast', 'tank', 'jumper', 'fros', 'spitter', 'shield'];
const BOSS_KINDS = ['arms', 'watcher', 'dragon', 'ice', 'king', 'sea'];
// 보스 종류마다 그림이 있는 skin (art.js)
const SKINS = { arms: [1], watcher: [2], dragon: [3], ice: [4], king: [5, 10], sea: [6] };
const ATTACKS = {
  arms: ['slam', 'multiSlam', 'doubleSlam', 'sweep', 'rocks', 'shockwave', 'spit', 'rocketPunch', 'inhale'],
  watcher: ['claw', 'spit', 'burrow', 'vines', 'crawl'],
  dragon: ['breath', 'tail', 'wing', 'pillars', 'fly'],
  ice: ['freezeBreath', 'dive', 'avalanche', 'icicles', 'hop'],
  sea: ['charge', 'bubbles', 'sweep', 'ink', 'whirlpool'],
};
ATTACKS.king = [...ATTACKS.arms, 'summon', 'leap', 'charge'];

const late = stages.map((st, i) => ({ st, n: i + 1 })).filter((s) => s.n > 20);

function reachable(st) {
  const seen = new Set();
  const list = st.platforms;
  const fromGround = list.filter((p) => st.groundY - p.y <= JUMP);
  const stack = [...fromGround];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    for (const q of list) {
      if (seen.has(q) || p.y - q.y > JUMP) continue;
      const gap = Math.max(0, Math.abs(p.x - q.x) - (p.w + q.w) / 2);
      if (gap <= REACH) stack.push(q);
    }
  }
  return seen;
}

describe('스테이지 40개', () => {
  it('스테이지 40개, 네 장, 장마다 10개', () => {
    expect(stages).toHaveLength(40);
    expect(STAGE_COUNT).toBe(40);
    expect(chapters.map((c) => c.chapter)).toEqual([1, 2, 3, 4]);
    expect(chapters.map((c) => c.stages.length)).toEqual([10, 10, 10, 10]);
    expect(chapters[2].stages).toEqual(Array.from({ length: 10 }, (_, i) => 21 + i));
    expect(chapters[3].stages).toEqual(Array.from({ length: 10 }, (_, i) => 31 + i));
    for (const c of [1, 2, 3, 4]) expect(CHAPTER_NAMES[c]).toMatch(new RegExp(`^${c}장: `));
    expect(getStage(40)).toBe(stages[39]);
    expect(getStage(99)).toBe(stages[39]);
  });

  it('이름과 보스 이름이 겹치지 않는다', () => {
    expect(new Set(stages.map((s) => s.name)).size).toBe(40);
    expect(new Set(stages.map((s) => s.boss.name)).size).toBe(40);
  });

  it('보물 id 는 40 스테이지 전체에서 겹치지 않는다', () => {
    const ids = stages.flatMap((s) => s.treasures.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(totalTreasures);
    late.forEach(({ st, n }) => st.treasures.forEach((t) => expect(t.id.startsWith(`stage${n}-`), t.id).toBe(true)));
  });

  it('새 스테이지마다 게임에 필요한 값이 다 있다', () => {
    for (const { st, n } of late) {
      const at = `스테이지 ${n}`;
      expect(st.chapter, at).toBe(n <= 30 ? 3 : 4);
      expect(st.groundY, at).toBe(480);
      expect(st.playerStartX, at).toBeLessThan(st.gateX);
      expect(st.gateX, at).toBeLessThan(st.checkpointX);
      expect(st.checkpointX, at).toBeLessThan(st.arena.startX);
      expect(st.arena.endX, at).toBe(st.width);
      expect(st.arena.endX - st.arena.startX, at).toBe(960);
      expect(st.theme.sky, at).toHaveLength(2);
      expect(st.theme.groundImage, at).toBeTruthy();
      expect(st.signs.length, at).toBeGreaterThanOrEqual(2);
      expect(st.talks.length, at).toBeGreaterThanOrEqual(2);
      expect(st.talks.some((t) => t.x === st.checkpointX), at).toBe(true);
      expect(st.treasures.length, at).toBeGreaterThanOrEqual(8);
      expect(st.monsters.length, at).toBeGreaterThanOrEqual(30);
    }
  });

  it('스테이지마다 발판과 몬스터 순서가 다르다 (복사본이 아니다)', () => {
    const shape = (st) => st.platforms.map((p) => `${p.y}:${p.w}`).join(',');
    const mix = (st) => st.monsters.map((m) => parseMonsterSpot(m, 480).type).join(',');
    expect(new Set(late.map((s) => shape(s.st))).size).toBe(20);
    expect(new Set(late.map((s) => mix(s.st))).size).toBe(20);
  });

  it('몬스터는 알려진 종류이고 보스 문 앞에 있다, 물속과 땅 위가 섞이지 않는다', () => {
    for (const { st, n } of late) {
      for (const spot of st.monsters) {
        const m = parseMonsterSpot(spot, st.groundY);
        expect(MONSTER_TYPES, `${n} ${m.type}`).toContain(m.type);
        expect(m.x, `${n}`).toBeLessThan(st.gateX);
        expect((st.swim ? SEA_ONLY : LAND_ONLY).includes(m.type), `${n} ${m.type}`).toBe(true);
      }
    }
  });

  it('장마다 헤엄치는 스테이지가 있고, 발판은 헤엄 천장 아래다', () => {
    expect(late.filter((s) => s.st.swim).map((s) => s.n)).toEqual([26, 36]);
    for (const { st } of late.filter((s) => s.st.swim)) {
      expect(st.boss.type).toBe('sea');
      for (const p of st.platforms) expect(p.y).toBeGreaterThan(190);
    }
  });

  it('모든 발판에 땅에서 차례로 올라갈 수 있다', () => {
    for (const { st, n } of late) {
      expect(reachable(st).size, `스테이지 ${n}`).toBe(st.platforms.length);
      for (const p of st.platforms) expect(p.x + p.w / 2, `${n}`).toBeLessThan(st.gateX);
    }
  });

  it('보스는 있는 종류와 그림이 있는 skin 을 쓰고, 공격 이름이 맞다', () => {
    for (const { st, n } of late) {
      const b = st.boss;
      expect(BOSS_KINDS, `${n}`).toContain(b.type);
      expect(SKINS[b.type], `${n}`).toContain(b.skin);
      expect(b.healthScale, `${n}`).toBeGreaterThan(1);
      for (const list of [...b.phases, ...(b.finalPhase ? [b.finalPhase] : [])]) {
        expect(list.length, `${n}`).toBeGreaterThan(0);
        for (const a of list) expect(ATTACKS[b.type], `${n} ${a}`).toContain(a);
      }
      if (b.type === 'king') {
        expect(b.finalPhase, `${n}`).toBeTruthy();
        expect(b.colors, `${n}`).toBeTruthy();
      }
    }
  });

  it('장의 끝은 킹 보스, 스테이지 40 이 마지막이고 엔딩이 있다', () => {
    for (const ch of chapters) expect(stages[ch.stages.at(-1) - 1].boss.type).toBe('king');
    expect(stages.at(-1).name).toBe('마왕성');
    expect(stages.at(-1).endingLines.length).toBeGreaterThanOrEqual(3);
    expect(stages.filter((s) => s.endingLines)).toHaveLength(1);
  });

  it('보스 그림을 다른 스테이지와 같이 받는다', () => {
    for (const { st, n } of late) {
      const keys = stageArt(n, stages, customArt).map((a) => a.file);
      for (const f of keys) expect(existsSync(`public/art/${f}`), `${n} ${f}`).toBe(true);
      if (st.boss.type !== 'sea') expect(bossArtKeys(st, n, customArt).length, `${n}`).toBeGreaterThan(0);
    }
    expect(bossDex(stages)).toHaveLength(40);
  });

  it('글에 줄표와 가운뎃점을 쓰지 않는다', () => {
    const texts = late.flatMap(({ st }) => [st.name, st.boss.name, ...st.signs.map((s) => s.text), ...st.talks.flatMap((t) => t.lines), ...(st.boss.intro || []), ...(st.endingLines || [])]);
    for (const t of texts) expect(/[—·]/.test(t), t).toBe(false);
  });
});

describe('보스 러시 코스 8개', () => {
  const courses = rushCourses(40);

  it('다섯 스테이지씩 여덟 코스, 이름이 다 다르다', () => {
    expect(courses).toHaveLength(8);
    expect(courses.flatMap((c) => c.stages)).toEqual(stages.map((_, i) => i + 1));
    expect(courses[7].stages).toEqual([36, 37, 38, 39, 40]);
    expect(new Set(courses.map((c) => c.name)).size).toBe(8);
    for (const c of courses) expect(c.name).not.toMatch(/^코스 /);
  });

  it('새 코스 기록을 저장하고 예전 코스 기록도 그대로다', () => {
    const save = { gems: 0, rush: { ...emptyRush(), records: { 4: [{ name: '꿀곰이', hero: 'shock', time: 200, duo: false, at: 1 }] }, cleared: [4] } };
    const r = finishRush(save, 8, { name: '불꼬리', hero: 'shock', time: 300, duo: false, at: 2 }, { rushClear: 5 }, 8);
    expect(r.firstClear).toBe(true);
    const rush = normalizeRush(r.patch.rush, 8);
    expect(rush.cleared).toEqual([4, 8]);
    expect(rush.records[4]).toHaveLength(1);
    expect(rush.records[8]).toHaveLength(1);
  });

  it('쪽 나누기: 한 쪽 네 코스, 두 쪽', () => {
    expect(pageCount(courses.length, 4)).toBe(2);
    expect(pageOf(3, 4)).toBe(0);
    expect(pageOf(4, 4)).toBe(1);
    expect(turnPage(1, 1, 4, 8)).toBe(5);
    expect(turnPage(5, -1, 4, 8)).toBe(1);
    expect(turnPage(5, 1, 4, 8)).toBe(5);
    expect(turnPage(1, -1, 4, 8)).toBe(1);
    expect(pageCount(40, 20)).toBe(2);
    expect(pageCount(0, 20)).toBe(1);
    expect(turnPage(3, 1, 4, 6)).toBe(5); // 마지막 쪽이 짧으면 마지막 칸
  });
});

describe('20 스테이지를 다 깬 예전 저장', () => {
  const finished = () => {
    const bestTimes = {};
    for (let n = 1; n <= 20; n++) bestTimes[n] = 100 + n;
    return { ...defaultSave(), level: 15, unlocked: 20, bestTimes, lastStage: 20, flawless: [20], treasures: ['stage20-relic'], gems: 77, dex: { monsters: { monster: 3 }, bosses: [20] }, rush: { ...emptyRush(), cleared: [1, 2, 3, 4] } };
  };
  const storeWith = (data) => {
    const mem = { 'shock-hero-save-v1': JSON.stringify(data) };
    return createSaveStore({ getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = v) });
  };

  it('스테이지 21 이 열리고 진행은 그대로다', () => {
    const s = storeWith(finished()).load();
    expect(s.unlocked).toBe(21);
    expect(s.bestTimes[20]).toBe(120);
    expect(s.level).toBe(15);
    expect(s.gems).toBe(77);
    expect(s.treasures).toEqual(['stage20-relic']);
    expect(s.flawless).toEqual([20]);
    expect(s.dex.bosses).toEqual([20]);
    expect(s.rush.cleared).toEqual([1, 2, 3, 4]);
    expect(chapterUnlocked(chapters[2], s.unlocked)).toBe(true);
    expect(chapterUnlocked(chapters[3], s.unlocked)).toBe(false);
    expect(mapStartStage(s, undefined, stages.length)).toBe(20);
  });

  it('아직 다 안 깬 저장은 그대로, 40 을 넘지 않는다', () => {
    expect(storeWith({ ...defaultSave(), unlocked: 7, bestTimes: { 1: 90, 2: 90 } }).load().unlocked).toBe(7);
    expect(storeWith({ ...defaultSave(), unlocked: 1 }).load().unlocked).toBe(1);
    const all = {};
    for (let n = 1; n <= 40; n++) all[n] = 90;
    expect(storeWith({ ...defaultSave(), unlocked: 40, bestTimes: all }).load().unlocked).toBe(40);
  });

  it('스테이지 40 까지 저장되고, 깬 번호가 스테이지 수까지만 올라간다', () => {
    const s = defaultSave();
    expect(clearStagePatch({ ...s, unlocked: 20 }, 20, 90).patch.unlocked).toBe(21);
    expect(clearStagePatch({ ...s, unlocked: 40 }, 40, 90).patch.unlocked).toBe(40);
    const store = storeWith({ ...s, unlocked: 33, checkpoint: 33, lastStage: 32, flawless: [31], bestTimes: { 32: 80 } });
    const l = store.load();
    expect(l.checkpoint).toBe(33);
    expect(l.lastStage).toBe(32);
    expect(l.flawless).toEqual([31]);
    expect(l.bestTimes[32]).toBe(80);
  });

  it('도감, 오늘의 도전, 공방이 새 스테이지를 받아들인다', () => {
    expect(normalizeDex({ bosses: [40, 41] }, stages.length).bosses).toEqual([40]);
    expect(dexCounts({ dex: { bosses: [40] } }, stages.length)).toMatchObject({ bosses: 1, bossTotal: 40 });
    const save = { ...defaultSave(), bestTimes: { 38: 120 } };
    expect(todayChallenge(save, '2026-10-31', stages.length).challenge.stage).toBe(38);
    const choices = stageChoices({ unlocked: 40 }, stages);
    expect(choices).toContain(40);
    expect(choices).not.toContain(26);
    expect(choices).not.toContain(36);
  });

  it('러시 코스는 깬 스테이지로 열린다', () => {
    const s = storeWith(finished()).load();
    const c = rushCourses(stages.length);
    expect(c.filter((x) => courseUnlocked(s, x)).map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('스테이지 40 의 세기', () => {
  it('예상 레벨이 스테이지마다 있고 줄어들지 않는다', () => {
    expect(STAGE_LEVELS).toHaveLength(40);
    for (let i = 1; i < 40; i++) expect(STAGE_LEVELS[i]).toBeGreaterThanOrEqual(STAGE_LEVELS[i - 1]);
    expect(levelsAhead(18, 40)).toBe(0);
  });

  it('스테이지 21 부터는 천천히 쌓인다 (앞 스테이지 숫자는 그대로)', () => {
    expect(stageRamp(20).monsterHealth).toBeCloseTo(2.4);
    expect(stageRamp(10).monsterHealth).toBeCloseTo(1.9);
    expect(stageRamp(40).monsterHealth).toBeCloseTo(2.9);
    expect(stageRamp(40).bossHealth).toBeCloseTo(1.95);
    expect(stageRamp(40).bossSpeed).toBeCloseTo(0.715);
    expect(stageRamp(40).monsterWindup).toBeCloseTo(0.715);
  });

  it('모든 난이도에서 숫자가 정상 범위다', () => {
    for (const lv of DIFFICULTIES) {
      const d = withDifficulty(cfg, lv, 40, 18).difficulty;
      expect(d.monsterHealth).toBeLessThan(4);
      expect(d.monsterDamage).toBeLessThan(3.1);
      expect(d.bossHealth).toBeLessThan(3);
      expect(d.bossDamage).toBeLessThan(2.7);
      expect(d.bossSpeed).toBeGreaterThan(0.55);
      expect(d.monsterWindup).toBeGreaterThan(0.55);
      expect(d.bossCombo).toBeLessThanOrEqual(0.9);
    }
  });

  it('보통 난이도 예상 레벨 주인공은 몬스터 한 방에 절반 이상 깎이지 않는다', () => {
    const hp = cfg.player.maxHealth + (STAGE_LEVELS[39] - 1) * cfg.level.healthPerLevel;
    const c = withDifficulty(cfg, 'normal', 40, STAGE_LEVELS[39]);
    expect(monsterStats(c, 'tank').damage).toBeLessThan(hp / 3);
    expect(c.boss.slamDamage).toBeLessThan(hp / 3);
  });
});
