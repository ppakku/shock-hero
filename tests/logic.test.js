import { describe, it, expect, vi } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { Health } from '../src/logic/health.js';
import { Cooldown } from '../src/logic/cooldown.js';
import { chargeRatio, resolveAttack } from '../src/logic/combat.js';
import { addXp, xpToNext, maxHealthFor } from '../src/logic/progression.js';
import { createSaveStore, defaultSave, clearStagePatch, STAGE_COUNT } from '../src/logic/save.js';
import { chooseBossAttack, bossSpeedMultiplier, coreDamage, rockTargets, doubleSlamTargets, BOSS_PATTERNS } from '../src/logic/boss.js';
import { monsterStats, parseMonsterSpot, MONSTER_TYPES } from '../src/logic/monsters.js';
import { stages, chapters } from '../src/stage/index.js';
import { placeTreasures } from '../src/logic/treasures.js';

const cfg = sanitizeNumbers(balance, () => {});

describe('sanitizeNumbers', () => {
  it('고칠 게 없으면 그대로 둔다', () => {
    const warn = vi.fn();
    expect(sanitizeNumbers(balance, warn)).toEqual(balance);
    expect(warn).not.toHaveBeenCalled();
  });

  it('음수, 숫자 아닌 값, 따옴표 숫자를 고친다', () => {
    const warn = vi.fn();
    const out = sanitizeNumbers({ a: { b: -5, c: NaN, d: '12', e: true } }, warn);
    expect(out).toEqual({ a: { b: 5, c: 0, d: 12, e: true } });
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

describe('Health', () => {
  it('피해와 회복은 0과 최대값 사이에 머문다', () => {
    const h = new Health(100);
    expect(h.damage(30)).toBe(30);
    expect(h.heal(50)).toBe(30);
    expect(h.damage(500)).toBe(100);
    expect(h.isDead).toBe(true);
    expect(h.heal(10)).toBe(0);
  });

  it('최대 체력 0 은 1 로 막는다', () => {
    expect(new Health(0).max).toBe(1);
  });
});

describe('Cooldown', () => {
  it('시간이 지나면 다시 쓸 수 있다', () => {
    const c = new Cooldown(0.5);
    c.trigger();
    expect(c.ready).toBe(false);
    c.update(0.25);
    expect(c.progress).toBeCloseTo(0.5);
    c.update(0.3);
    expect(c.ready).toBe(true);
  });

  it('길이 0 이면 언제나 준비 상태', () => {
    const c = new Cooldown(0);
    c.trigger();
    expect(c.ready).toBe(true);
    expect(c.progress).toBe(1);
  });
});

describe('충전 펀치', () => {
  it('짧게 누르면 기본 펀치', () => {
    const a = resolveAttack(0.1, cfg);
    expect(a.kind).toBe('punch');
    expect(a.damage).toBe(cfg.punch.damage);
  });

  it('오래 누를수록 피해와 넉백이 커지고 최대에서 멈춘다', () => {
    const low = resolveAttack(cfg.charge.minTime, cfg);
    const mid = resolveAttack((cfg.charge.minTime + cfg.charge.fullTime) / 2, cfg);
    const full = resolveAttack(cfg.charge.fullTime + 5, cfg);
    expect(low.kind).toBe('charged');
    expect(low.damage).toBe(cfg.charge.minDamage);
    expect(mid.damage).toBeGreaterThan(low.damage);
    expect(mid.knockback).toBeGreaterThan(low.knockback);
    expect(full.damage).toBe(cfg.charge.maxDamage);
    expect(full.full).toBe(true);
  });

  it('레벨 공격력 배수가 피해에 곱해진다', () => {
    expect(resolveAttack(10, cfg, 1.5).damage).toBe(Math.round(cfg.charge.maxDamage * 1.5));
  });

  it('최대 충전 시간이 최소보다 짧게 잘못 설정돼도 멈추지 않는다', () => {
    const broken = { ...cfg.charge, minTime: 1, fullTime: 0.5 };
    expect(chargeRatio(0.9, broken)).toBe(0);
    expect(chargeRatio(1.1, broken)).toBe(1);
  });
});

describe('레벨', () => {
  it('경험치가 차면 레벨이 오르고 남은 경험치는 이어진다', () => {
    const need = xpToNext(1, cfg.level);
    const r = addXp({ level: 1, xp: 0 }, need + 5, cfg.level);
    expect(r).toEqual({ level: 2, xp: 5, levelsGained: 1 });
  });

  it('한 번에 여러 레벨이 오를 수 있다', () => {
    const r = addXp({ level: 1, xp: 0 }, 10000, cfg.level);
    expect(r.levelsGained).toBeGreaterThan(2);
  });

  // 공격력은 레벨 업 카드로 옮겼다 (tests/growth.test.js)
  it('레벨이 오르면 최대 체력이 늘어난다', () => {
    expect(maxHealthFor(3, 100, cfg.level)).toBe(100 + 2 * cfg.level.healthPerLevel);
  });
});

describe('저장', () => {
  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  }

  it('저장한 경험치와 보물은 다시 불러와도 남아 있다', () => {
    const store = createSaveStore(memoryStorage());
    store.update({ level: 3, xp: 12, treasures: ['stage1-chest'], checkpoint: 2, unlocked: 3 });
    const d = store.load();
    expect(d.level).toBe(3);
    expect(d.xp).toBe(12);
    expect(d.treasures).toEqual(['stage1-chest']);
    expect(d.checkpoint).toBe(2);
    expect(d.unlocked).toBe(3);
  });

  it('예전 저장(스테이지 1만 있던 때)도 이어서 쓴다', () => {
    const s = memoryStorage();
    s.setItem('shock-hero-save-v1', JSON.stringify({ level: 5, xp: 3, treasures: ['stage1-chest'], checkpoint: 'boss', bestTime: 60.9 }));
    const d = createSaveStore(s).load();
    expect(d.level).toBe(5);
    expect(d.checkpoint).toBe(1);
    expect(d.bestTimes[1]).toBe(60.9);
    expect(d.unlocked).toBe(2);
  });

  it('스테이지를 깨면 다음 스테이지가 열리고 기록이 남는다', () => {
    const save = { ...defaultSave(), checkpoint: 1 };
    const r = clearStagePatch(save, 1, 120);
    expect(r.patch.unlocked).toBe(2);
    expect(r.patch.checkpoint).toBe(null);
    expect(r.isRecord).toBe(true);
    const slower = clearStagePatch({ ...save, bestTimes: { 1: 100 }, unlocked: 3 }, 1, 120);
    expect(slower.isRecord).toBe(false);
    expect(slower.best).toBe(100);
    expect(slower.patch.unlocked).toBe(3);
    expect(clearStagePatch({ ...save, unlocked: 40 }, 40, 300).patch.unlocked).toBe(40);
  });

  it('저장소가 없거나 고장 나도 기본값으로 시작한다', () => {
    expect(createSaveStore(null).load()).toEqual(defaultSave());
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const store = createSaveStore(throwing);
    expect(store.load()).toEqual(defaultSave());
    expect(store.save(defaultSave())).toBe(false);
  });

  it('망가진 저장 데이터는 기본값으로 바꾼다', () => {
    const s = memoryStorage();
    s.setItem('shock-hero-save-v1', '{"level":-3,"xp":"lots"');
    expect(createSaveStore(s).load()).toEqual(defaultSave());
  });
});

describe('보스 패턴', () => {
  const phases = [['slam', 'doubleSlam'], ['sweep'], ['rocks', 'shockwave']];

  it('부서진 팔 개수에 맞는 목록에서 고른다', () => {
    expect(['slam', 'doubleSlam']).toContain(chooseBossAttack(phases, 2, 2, null, () => 0.5));
    expect(chooseBossAttack(phases, 1, 2, null, () => 0.5)).toBe('sweep');
    expect(['rocks', 'shockwave']).toContain(chooseBossAttack(phases, 0, 2, null, () => 0.5));
  });

  it('팔이 모자라면 그 공격은 빼고, 방금 한 공격은 되도록 피한다', () => {
    expect(chooseBossAttack([['doubleSlam', 'slam']], 1, 3, null, () => 0)).toBe('slam');
    expect(chooseBossAttack([['doubleSlam']], 1, 3)).toBe('slam');
    for (let i = 0; i < 10; i++) expect(chooseBossAttack(phases, 0, 2, 'rocks', () => i / 10)).toBe('shockwave');
  });

  it('팔이 줄수록 빨라진다', () => {
    expect(bossSpeedMultiplier(1)).toBeLessThan(bossSpeedMultiplier(2));
    expect(bossSpeedMultiplier(2, 3)).toBeLessThan(bossSpeedMultiplier(3, 3));
    expect(bossSpeedMultiplier(1, 3)).toBeLessThan(bossSpeedMultiplier(2, 3));
    expect(bossSpeedMultiplier(0, 3)).toBeLessThan(bossSpeedMultiplier(1, 3));
  });

  it('두 팔 동시 내려찍기는 피할 틈을 남긴다', () => {
    const [a, b] = doubleSlamTargets(3100, 3060, 3640);
    expect(a).toBe(3100);
    expect(Math.abs(a - b)).toBeGreaterThanOrEqual(180);
  });

  it('새 공격(주먹 발사, 빨아들이기, 부하 부르기)도 공격 목록에 있다', () => {
    for (const p of ['rocketPunch', 'inhale', 'summon']) expect(Object.keys(BOSS_PATTERNS)).toContain(p);
    expect(chooseBossAttack([['inhale']], 0, 2)).toBe('inhale');
  });

  it('충전 펀치는 코어에 더 아프다', () => {
    expect(coreDamage({ kind: 'charged', damage: 40 }, 1.5)).toBe(60);
    expect(coreDamage({ kind: 'punch', damage: 8 }, 1.5)).toBe(8);
  });

  it('돌 하나는 플레이어 위에 떨어지고, 돌끼리는 떨어져 있다', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const xs = rockTargets(5000, 3, 3060, 3640, rand);
    expect(xs[0]).toBe(3640);
    expect(xs).toHaveLength(3);
    for (let i = 0; i < xs.length; i++)
      for (let j = i + 1; j < xs.length; j++) expect(Math.abs(xs[i] - xs[j])).toBeGreaterThanOrEqual(90);
  });
});

describe('몬스터 종류', () => {
  it('종류마다 능력치가 다르다', () => {
    const basic = monsterStats(cfg, 'basic');
    const fast = monsterStats(cfg, 'fast');
    const tank = monsterStats(cfg, 'tank');
    expect(fast.moveSpeed).toBeGreaterThan(basic.moveSpeed);
    expect(tank.maxHealth).toBeGreaterThan(basic.maxHealth);
    expect(tank.size).toBeGreaterThan(1);
    expect(monsterStats(cfg, 'unknown').type).toBe('basic');
  });

  it('스테이지 파일의 몬스터 한 줄을 읽는다', () => {
    expect(parseMonsterSpot(900, 480)).toEqual({ x: 900, y: 480, type: 'basic' });
    expect(parseMonsterSpot({ x: 1, type: 'tank' }, 480)).toEqual({ x: 1, y: 480, type: 'tank' });
  });
});

// 아이들이 스테이지 파일을 고쳤을 때 실수를 잡아 주는 검사
describe('스테이지 파일 검사', () => {
  it('스테이지는 40개 (저장의 STAGE_COUNT 와 같다), 지도 4장', () => {
    expect(stages).toHaveLength(40);
    expect(chapters.map((c) => c.stages.length)).toEqual([10, 10, 10, 10]);
    expect(STAGE_COUNT).toBe(stages.length);
  });

  it('마지막 스테이지에 엔딩 대사가 있다', () => {
    expect(stages[stages.length - 1].endingLines.length).toBeGreaterThan(0);
  });

  it('뒤 스테이지일수록 몬스터와 보물이 줄지 않는다', () => {
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].monsters.length, `스테이지 ${i + 1} 몬스터`).toBeGreaterThanOrEqual(stages[i - 1].monsters.length);
      expect(stages[i].treasures.length, `스테이지 ${i + 1} 보물`).toBeGreaterThanOrEqual(stages[i - 1].treasures.length);
    }
    expect(stages[stages.length - 1].treasures.length).toBeGreaterThan(stages[0].treasures.length);
  });

  it('보물 id 는 모든 스테이지에서 겹치지 않는다', () => {
    const ids = stages.flatMap((s) => s.treasures.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  stages.forEach((st, i) => {
    describe(`스테이지 ${i + 1} (${st.name})`, () => {
      it('순서: 시작 < 보스 문 < 체크포인트 < 보스 구역', () => {
        expect(st.playerStartX).toBeLessThan(st.gateX);
        expect(st.gateX).toBeLessThan(st.checkpointX);
        expect(st.checkpointX).toBeLessThan(st.arena.startX);
        expect(st.arena.endX).toBe(st.width);
        expect(st.arena.endX - st.arena.startX).toBe(960);
      });

      it('몬스터는 모두 보스 문 앞에 있고 종류 이름이 맞다', () => {
        expect(st.monsters.length).toBeGreaterThan(0);
        for (const spot of st.monsters) {
          const m = parseMonsterSpot(spot, st.groundY);
          expect(m.x).toBeLessThan(st.gateX - 60);
          if (typeof spot === 'object' && spot.type) expect(MONSTER_TYPES).toContain(spot.type);
        }
      });

      it('보물은 3개 이상이고, 무작위 자리는 언제나 보스 문 앞 발판이나 땅 위다', () => {
        expect(st.treasures.length).toBeGreaterThanOrEqual(3);
        let seed = i + 1;
        const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let run = 0; run < 200; run++) {
          const placed = placeTreasures(st, i + 1, rand);
          expect(placed.map((t) => t.id)).toEqual(st.treasures.map((t) => t.id));
          for (const t of placed) {
            expect(t.x).toBeLessThan(st.gateX);
            const onGround = t.y === st.groundY;
            const onPlatform = st.platforms.some((p) => p.y === t.y && Math.abs(p.x - t.x) <= p.w / 2);
            expect(onGround || onPlatform, `${t.id} 아래에 발판이 없어요`).toBe(true);
          }
        }
      });

      it('발판은 점프로 올라갈 수 있게 이어져 있다', () => {
        // 땅이나 다른 발판에서 높이 120 이하, 가로 거리가 가까운 발판이 있어야 한다 (같은 높이로 건너뛰는 공중 다리도 된다)
        for (const p of st.platforms) {
          const fromGround = st.groundY - p.y <= 120;
          const fromOther = st.platforms.some(
            (q) => q !== p && q.y >= p.y && q.y - p.y <= 120 && Math.abs(q.x - p.x) - (q.w + p.w) / 2 <= 90,
          );
          expect(fromGround || fromOther, `x ${p.x}, y ${p.y} 발판에 올라갈 방법이 없어요`).toBe(true);
        }
      });

      it('보스 종류와 공격 목록이 있다', () => {
        const b = st.boss;
        expect(typeof b.type).toBe('string');
        expect(b.phases.length).toBeGreaterThan(0);
        // 팔 보스는 [팔 다 있을 때, ..., 팔 다 부순 뒤] 단계 수가 팔 개수 + 1
        if (b.type === 'arms') {
          expect([2, 3]).toContain(b.arms);
          expect(b.phases).toHaveLength(b.arms + 1);
          for (const list of b.phases) for (const p of list) expect(Object.keys(BOSS_PATTERNS)).toContain(p);
        }
      });
    });
  });
});
