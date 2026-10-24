import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import {
  UPGRADE_TRACKS, emptyUpgrades, normalizeUpgrades, attackMultiplier, damageTakenMultiplier, speedMultiplier,
  dashCooldownMultiplier, robotStats, upgradeCard, autoPickTrack, applyPick, ranksLeft, POWER_IDS, POWER_INFO,
  treasurePower, PowerSet,
} from '../src/logic/growth.js';
import { createSaveStore, defaultSave, resetProgress } from '../src/logic/save.js';
import { stages } from '../src/stage/index.js';

const cfg = sanitizeNumbers(balance, () => {});
const up = cfg.upgrades;
const MAX = up.maxRank;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}

describe('레벨 업 카드 계산', () => {
  it('처음에는 모두 0 이고 배수는 1', () => {
    const u = emptyUpgrades();
    expect(attackMultiplier(u, up)).toBe(1);
    expect(damageTakenMultiplier(u, up)).toBe(1);
    expect(speedMultiplier(u, up)).toBe(1);
    expect(dashCooldownMultiplier(u, up)).toBe(1);
    expect(robotStats(0, cfg.robot)).toBeNull();
  });

  it('칸을 올리면 공격은 세지고, 받는 피해는 줄고, 빨라진다', () => {
    const u = { attack: 2, defense: 3, speed: 1, robot: 0 };
    expect(attackMultiplier(u, up)).toBeCloseTo(1 + 2 * up.attackPerRank);
    expect(damageTakenMultiplier(u, up)).toBeCloseTo(1 - 3 * up.defensePerRank);
    expect(speedMultiplier(u, up)).toBeCloseTo(1 + up.speedPerRank);
    expect(dashCooldownMultiplier(u, up)).toBeCloseTo(1 - up.dashCooldownPerRank);
  });

  it('방어력을 아무리 올려도 피해가 0 이 되지는 않는다', () => {
    expect(damageTakenMultiplier({ defense: 100 }, up)).toBeGreaterThan(0);
  });

  it('로봇 볼트는 레벨이 오를수록 자주, 세게 쏘고 Lv 4 회복, Lv 5 방패', () => {
    const r1 = robotStats(1, cfg.robot);
    const r5 = robotStats(5, cfg.robot);
    expect(r1.interval).toBeGreaterThan(r5.interval);
    expect(r5.damage).toBeGreaterThan(r1.damage);
    expect(r1.heal).toBeNull();
    expect(robotStats(cfg.robot.healFromRank, cfg.robot).heal).not.toBeNull();
    expect(robotStats(cfg.robot.guardFromRank - 1, cfg.robot).guard).toBeNull();
    expect(r5.guard).not.toBeNull();
    // 설정에 없는 레벨은 가장 높은 레벨 값을 쓴다
    expect(robotStats(9, cfg.robot).damage).toBe(r5.damage);
  });

  it('카드에 지금 레벨과 다음 레벨이 보인다', () => {
    const c = upgradeCard('attack', { attack: 2 }, cfg);
    expect(c.title).toBe('공격력 Lv 2 → 3');
    expect(c.lines[0]).toContain('12%');
    const m = upgradeCard('robot', { robot: MAX }, cfg);
    expect(m.maxed).toBe(true);
    for (const t of UPGRADE_TRACKS) {
      const card = upgradeCard(t, emptyUpgrades(), cfg);
      expect(card.lines.join(' ')).not.toMatch(/[—·]/);
    }
  });

  it('자동 고르기는 가장 낮은 칸, 다 차면 null', () => {
    expect(autoPickTrack({ attack: 1, defense: 0, speed: 1, robot: 0 }, MAX)).toBe('defense');
    expect(autoPickTrack({ attack: MAX, defense: MAX, speed: MAX, robot: MAX }, MAX)).toBeNull();
  });

  it('카드를 고르면 그 칸이 오르고 남은 카드가 줄어든다', () => {
    const save = { ...defaultSave(), picksPending: 2 };
    const r = applyPick(save, 'robot', MAX);
    expect(r.upgrades.robot).toBe(1);
    expect(r.picksPending).toBe(1);
    expect(applyPick({ ...save, picksPending: 0 }, 'robot', MAX)).toBeNull();
    expect(applyPick({ ...save, upgrades: { ...emptyUpgrades(), attack: MAX } }, 'attack', MAX)).toBeNull();
    expect(applyPick(save, 'fly', MAX)).toBeNull();
  });

  it('남은 칸 수', () => {
    expect(ranksLeft(emptyUpgrades(), MAX)).toBe(UPGRADE_TRACKS.length * MAX);
  });

  it('이상한 값은 버린다', () => {
    expect(normalizeUpgrades({ attack: 2.5, defense: -1, speed: 'x', robot: 99, fly: 3 }, MAX)).toEqual({ attack: 0, defense: 0, speed: 0, robot: MAX });
  });
});

describe('레벨 업 카드 저장', () => {
  it('고른 카드는 다시 불러와도 남아 있다', () => {
    const store = createSaveStore(memoryStorage());
    store.update({ level: 3, upgrades: { attack: 1, defense: 0, speed: 0, robot: 1 }, picksPending: 0 });
    const d = store.load();
    expect(d.upgrades).toEqual({ attack: 1, defense: 0, speed: 0, robot: 1 });
    expect(d.picksPending).toBe(0);
  });

  it('카드가 생기기 전 저장은 지금까지 오른 레벨만큼 공짜 카드를 받는다', () => {
    const s = memoryStorage();
    s.setItem('shock-hero-save-v1', JSON.stringify({ level: 6, xp: 10, treasures: ['stage1-roof'] }));
    const store = createSaveStore(s);
    const d = store.load();
    expect(d.level).toBe(6);
    expect(d.upgrades).toEqual(emptyUpgrades());
    expect(d.picksPending).toBe(5);
    // 한 장 고르고 저장하면 다시 공짜 카드가 생기지 않는다
    const r = applyPick(d, 'attack', MAX);
    store.update(r);
    expect(store.load().picksPending).toBe(4);
  });

  it('새 게임은 카드 0장', () => {
    expect(createSaveStore(memoryStorage()).load().picksPending).toBe(0);
  });

  it('레벨 초기화하면 카드도 지워진다', () => {
    const save = { ...defaultSave(), level: 7, upgrades: { attack: 3, defense: 1, speed: 2, robot: 4 }, picksPending: 2 };
    const r = resetProgress(save);
    expect(r.upgrades).toEqual(emptyUpgrades());
    expect(r.picksPending).toBe(0);
    const store = createSaveStore(memoryStorage());
    store.save(r);
    expect(store.load().picksPending).toBe(0);
  });
});

describe('보물 상자의 특별한 힘', () => {
  it('모든 힘에 이름, 설명, 시간이 있다', () => {
    for (const id of POWER_IDS) {
      expect(POWER_INFO[id].name).toBeTruthy();
      expect(`${POWER_INFO[id].name} ${POWER_INFO[id].desc}`).not.toMatch(/[—·]/);
      expect(cfg.powers[id].time).toBeGreaterThan(0);
    }
    expect(cfg.powers.star.time).toBeLessThan(cfg.powers.speed.time); // 무적은 짧게
  });

  it('보물에 적힌 힘이 나오고, 없으면 무작위', () => {
    expect(treasurePower({ power: 'star' })).toBe('star');
    expect(treasurePower({}, () => 0)).toBe(POWER_IDS[0]);
    expect(treasurePower({ power: 'fly' }, () => 0.99)).toBe(POWER_IDS[POWER_IDS.length - 1]);
  });

  it('스테이지 보물의 power 이름은 모두 맞고, 경험치는 없다', () => {
    for (const st of stages) {
      for (const t of st.treasures) {
        if (t.power !== undefined) expect(POWER_IDS).toContain(t.power);
        expect(t.xp).toBeUndefined();
      }
    }
  });

  it('시간이 지나면 끝나고, 다시 먹으면 시간이 처음부터', () => {
    const ps = new PowerSet(cfg.powers);
    ps.add('speed');
    expect(ps.has('speed')).toBe(true);
    ps.update(cfg.powers.speed.time - 1);
    ps.add('speed');
    expect(ps.remaining('speed')).toBeCloseTo(cfg.powers.speed.time);
    expect(ps.update(cfg.powers.speed.time + 0.1)).toEqual(['speed']);
    expect(ps.has('speed')).toBe(false);
  });

  it('강철 몸 방패가 피해를 먼저 받고, 다 깨지면 끝난다', () => {
    const ps = new PowerSet(cfg.powers);
    ps.add('shield');
    const amount = cfg.powers.shield.amount;
    const a = ps.absorb(20);
    expect(a).toEqual({ left: 0, absorbed: 20, broke: false });
    const b = ps.absorb(amount);
    expect(b.left).toBe(20);
    expect(b.broke).toBe(true);
    expect(ps.has('shield')).toBe(false);
    expect(ps.absorb(10).left).toBe(10);
  });
});
