import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { agePuddles, standingInPuddle, addPuddle } from '../src/logic/puddles.js';
import { chooseWatcherAttack, watcherPhaseIndex, popUpX, spreadTargets, crawlPlan, WATCHER_PATTERNS } from '../src/logic/watcher.js';
import { chooseDragonAttack, dragonPhaseIndex, pillarWaves, flyLandingX, gustVelocity, gustPillarXs, DRAGON_PATTERNS } from '../src/logic/dragon.js';
import { difficultyOf, pickSideAttack, NORMAL_DIFFICULTY } from '../src/logic/bossCombo.js';
import { stage2 } from '../src/stage/stage2.js';
import { stage3 } from '../src/stage/stage3.js';

describe('바닥 웅덩이', () => {
  it('시간이 지나면 사라진다', () => {
    let list = addPuddle([], { x: 100, w: 90, left: 1 });
    list = agePuddles(list, 0.5);
    expect(list).toHaveLength(1);
    list = agePuddles(list, 0.6);
    expect(list).toHaveLength(0);
  });

  it('땅에 서 있을 때만 닿는다', () => {
    const list = [{ x: 100, w: 90, left: 3 }];
    expect(standingInPuddle(list, 140, 12, true)).not.toBeNull();
    expect(standingInPuddle(list, 140, 12, false)).toBeNull();
    expect(standingInPuddle(list, 170, 12, true)).toBeNull();
  });

  it('너무 많으면 오래된 것부터 지운다', () => {
    let list = [];
    for (let i = 0; i < 10; i++) list = addPuddle(list, { x: i, w: 10, left: 1 }, 8);
    expect(list).toHaveLength(8);
    expect(list[0].x).toBe(2);
  });
});

describe('포레스트 와처', () => {
  const phases = stage2.boss.phases;

  it('부서진 부위 수로 단계를 고른다', () => {
    expect(watcherPhaseIndex(true, true)).toBe(0);
    expect(watcherPhaseIndex(false, true)).toBe(1);
    expect(watcherPhaseIndex(true, false)).toBe(1);
    expect(watcherPhaseIndex(false, false)).toBe(2);
  });

  it('긴 팔이 부서지면 할퀴기를 하지 않는다', () => {
    for (let i = 0; i < 20; i++) expect(chooseWatcherAttack(phases, false, true, null, () => i / 20)).not.toBe('claw');
  });

  it('방금 한 공격은 되도록 다시 하지 않는다', () => {
    for (let i = 0; i < 20; i++) expect(chooseWatcherAttack(phases, true, true, 'spit', () => i / 20)).not.toBe('spit');
  });

  it('스테이지 2 공격 이름이 모두 맞고, 첫 단계에 긴 팔 할퀴기가 있다', () => {
    expect(stage2.boss.type).toBe('watcher');
    expect(phases).toHaveLength(3);
    for (const list of phases) for (const p of list) expect(WATCHER_PATTERNS).toContain(p);
    expect(phases[0]).toContain('claw');
  });

  it('튀어나오는 자리는 싸움터 안쪽이다', () => {
    expect(popUpX(3800, 3840, 4800, 105, () => 0)).toBe(3945);
    expect(popUpX(5000, 3840, 4800, 105, () => 1)).toBe(4695);
    expect(popUpX(4300, 3840, 4800, 105, () => 0.5)).toBe(4300);
  });

  it('덩굴과 독 방울 자리: 하나는 플레이어 위, 나머지는 서로 떨어져 있다', () => {
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const xs = spreadTargets(4300, 4, 3890, 4750, rand, 150);
    expect(xs[0]).toBe(4300);
    expect(xs.length).toBe(4);
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) expect(Math.abs(xs[i] - xs[j])).toBeGreaterThanOrEqual(150);
  });

  it('벽 타기는 가까운 벽으로 올라가 반대편으로 내려온다', () => {
    expect(crawlPlan(3950, 3860, 4780)).toEqual({ startWall: 3860, endWall: 4780, dir: 1 });
    expect(crawlPlan(4700, 3860, 4780)).toEqual({ startWall: 4780, endWall: 3860, dir: -1 });
  });

  it('덩굴은 대시로 빠져나올 수 있을 만큼만 붙잡고, 웅덩이는 조금만 아프다', () => {
    const w = balance.watcherBoss;
    expect(w.vineHoldTime).toBeLessThanOrEqual(2);
    expect(w.puddleDamage).toBeLessThan(w.spitDamage);
    expect(w.tiredTime).toBeGreaterThanOrEqual(2);
  });
});

describe('아스트라노바X', () => {
  const phases = stage3.boss.phases;

  it('부서진 부위 수로 단계를 고른다', () => {
    expect(dragonPhaseIndex(true, true)).toBe(0);
    expect(dragonPhaseIndex(false, true)).toBe(1);
    expect(dragonPhaseIndex(false, false)).toBe(2);
  });

  it('스테이지 3 공격 이름이 모두 맞고, 꼬리와 날개를 드러내는 공격이 있다', () => {
    expect(stage3.boss.type).toBe('dragon');
    expect(phases).toHaveLength(3);
    for (const list of phases) for (const p of list) expect(DRAGON_PATTERNS).toContain(p);
    expect(phases[0]).toContain('tail');
    expect(phases[0]).toContain('wing');
  });

  it('날아오르기는 가끔만: 목록마다 많아야 한 번', () => {
    for (const list of phases) expect(list.filter((p) => p === 'fly').length).toBeLessThanOrEqual(1);
    expect(phases[0]).not.toContain('fly');
  });

  it('방금 한 공격은 되도록 다시 하지 않는다', () => {
    for (let i = 0; i < 20; i++) expect(chooseDragonAttack(phases, true, true, 'breath', () => i / 20)).not.toBe('breath');
  });

  it('불기둥은 두 묶음이 번갈아 나오고 겹치지 않는다', () => {
    const [a, b] = pillarWaves(4260, 5180, 120);
    expect(a.length).toBeGreaterThan(2);
    expect(b.length).toBeGreaterThan(2);
    for (const x of a) expect(b).not.toContain(x);
    for (let i = 1; i < a.length; i++) expect(a[i] - a[i - 1]).toBe(240);
  });

  it('날아오르면 먼 쪽 끝에 내려앉는다', () => {
    expect(flyLandingX(5000, 4390, 5050)).toBe(4390);
    expect(flyLandingX(4450, 4390, 5050)).toBe(5050);
  });

  it('날개 바람은 용에게서 멀어지는 쪽으로 밀고, 그쪽 벽에 불기둥이 솟는다', () => {
    expect(gustVelocity(4500, 4900, 170)).toBe(-170);
    expect(gustVelocity(5000, 4900, 170)).toBe(170);
    expect(gustPillarXs(4500, 4900, 4240, 5200)).toEqual([4280, 4380]);
    expect(gustPillarXs(5000, 4900, 4240, 5200)).toEqual([5160, 5060]);
  });

  it('날개 바람은 걸어서 버틸 수 있다', () => {
    expect(balance.dragonBoss.gustStrength).toBeLessThan(balance.player.moveSpeed);
  });
});

describe('난이도와 겹치기 공격', () => {
  it('cfg.difficulty 가 없으면 보통 난이도', () => {
    expect(difficultyOf({})).toEqual(NORMAL_DIFFICULTY);
    const hard = { level: 'hard', bossHealth: 1.25, bossSpeed: 0.8, bossCombo: 0.5 };
    expect(difficultyOf({ difficulty: hard })).toEqual(hard);
  });

  it('이상한 값은 안전하게 고친다', () => {
    const d = difficultyOf({ difficulty: { level: 'easy', bossHealth: 0, bossSpeed: NaN, bossCombo: 3 } });
    expect(d.bossHealth).toBe(1);
    expect(d.bossSpeed).toBe(1);
    expect(d.bossCombo).toBe(1);
  });

  it('확률에 따라 겹칠 공격을 고른다', () => {
    const map = { claw: ['spit', 'vines'], tired: [] };
    expect(pickSideAttack(map, 'claw', 0, () => 0)).toBeNull();
    expect(pickSideAttack(map, 'claw', 0.5, () => 0.9)).toBeNull();
    expect(['spit', 'vines']).toContain(pickSideAttack(map, 'claw', 0.5, () => 0.1));
    expect(pickSideAttack(map, 'tired', 1, () => 0)).toBeNull();
    expect(pickSideAttack(map, 'nothing', 1, () => 0)).toBeNull();
  });
});
