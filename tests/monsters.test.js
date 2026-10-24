import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { stages } from '../src/stage/index.js';
import {
  MONSTER_TYPES,
  FLYING_TYPES,
  BOMBER_MIN_Y,
  BOMBER_MAX_Y,
  monsterStats,
  parseMonsterSpot,
  pushedKnockback,
  bomberHoverY,
  bomberXRange,
  bombLandingY,
  spitterMove,
  shieldResult,
} from '../src/logic/monsters.js';

const cfg = sanitizeNumbers(balance, () => {});

describe('몬스터 넉백', () => {
  it('펀치에 밀리는 힘은 60% 정도로 줄었다', () => {
    expect(cfg.monster.knockbackScale).toBeGreaterThan(0.4);
    expect(cfg.monster.knockbackScale).toBeLessThan(0.8);
    expect(pushedKnockback(140, 0.6)).toBeCloseTo(84);
    expect(pushedKnockback(undefined, 0.6)).toBe(0);
  });

  it('최대 충전 펀치는 여전히 모든 땅 몬스터를 쓰러뜨린다', () => {
    for (const type of ['basic', 'fast', 'tank', 'jumper', 'spitter', 'shield']) {
      expect(cfg.charge.maxKnockback, type).toBeGreaterThanOrEqual(monsterStats(cfg, type).downKnockback);
    }
  });

  it('몬스터에게 맞은 주인공은 평소보다 덜 밀린다', () => {
    expect(cfg.monster.heroKnockback).toBeLessThan(cfg.player.hurtKnockback);
    expect(monsterStats(cfg, 'shield').heroKnockback).toBe(cfg.monster.heroKnockback);
  });
});

describe('새 몬스터 능력치', () => {
  it('종류 목록에 새 몬스터가 있다', () => {
    for (const t of ['bomber', 'spitter', 'shield']) expect(MONSTER_TYPES).toContain(t);
    expect(FLYING_TYPES).toContain('bomber'); // 수중 던전의 헤엄치는 몬스터도 중력이 없어서 여기에 들어 있음
  });

  it('배수가 아닌 숫자는 그대로 넘어온다', () => {
    const b = monsterStats(cfg, 'bomber');
    expect(b.type).toBe('bomber');
    expect(b.bombDamage).toBe(balance.monsterTypes.bomber.bombDamage);
    expect(b.bombRadius).toBeGreaterThan(20);
    expect(b.healthMultiplier).toBeUndefined();
    const s = monsterStats(cfg, 'spitter');
    expect(s.spitSpeed).toBeLessThan(cfg.player.moveSpeed); // 침은 걷는 것보다 느림
    expect(monsterStats(cfg, 'shield').guardBreakTime).toBeGreaterThan(0);
  });

  it('balance 의 몬스터 숫자는 모두 그냥 숫자다 (배열 없음)', () => {
    for (const [name, t] of Object.entries(balance.monsterTypes)) {
      for (const [k, v] of Object.entries(t)) expect(typeof v, `${name}.${k}`).toBe('number');
    }
  });

  it('폭탄벌레 경고 시간은 주인공이 반지름 밖으로 걸어 나갈 만큼 길다', () => {
    const b = monsterStats(cfg, 'bomber');
    const walk = cfg.player.moveSpeed * (b.bombWarningTime + b.bombFallTime);
    expect(walk).toBeGreaterThan(b.bombRadius * 2);
  });
});

describe('난이도', () => {
  const withDiff = (d) => ({ ...cfg, difficulty: d });
  const easy = { level: 'easy', monsterDamage: 0.7, monsterSpeed: 0.9, monsterWindup: 1.3 };
  const hard = { level: 'hard', monsterDamage: 1.25, monsterSpeed: 1.15, monsterWindup: 0.8 };

  it('난이도가 없으면 보통과 같다', () => {
    expect(monsterStats(cfg, 'bomber')).toEqual(monsterStats(withDiff({ level: 'normal', monsterDamage: 1, monsterSpeed: 1, monsterWindup: 1 }), 'bomber'));
  });

  it('쉬움은 약하고 느리고 신호가 길며, 어려움은 반대', () => {
    for (const type of MONSTER_TYPES) {
      const n = monsterStats(cfg, type);
      const e = monsterStats(withDiff(easy), type);
      const h = monsterStats(withDiff(hard), type);
      expect(e.damage, type).toBeLessThan(n.damage);
      expect(h.damage, type).toBeGreaterThan(n.damage);
      expect(e.moveSpeed).toBeCloseTo(n.moveSpeed * 0.9);
      expect(h.lungeSpeed).toBeCloseTo(n.lungeSpeed * 1.15);
      expect(e.windupTime).toBeCloseTo(n.windupTime * 1.3);
      expect(h.windupTime).toBeCloseTo(n.windupTime * 0.8);
    }
    const nb = monsterStats(cfg, 'bomber');
    const eb = monsterStats(withDiff(easy), 'bomber');
    expect(eb.bombWarningTime).toBeCloseTo(nb.bombWarningTime * 1.3);
    expect(eb.bombInterval).toBeCloseTo(nb.bombInterval * 1.3);
    expect(eb.bombDamage).toBeLessThan(nb.bombDamage);
    const hs = monsterStats(withDiff(hard), 'spitter');
    const ns = monsterStats(cfg, 'spitter');
    expect(hs.spitWindup).toBeCloseTo(ns.spitWindup * 0.8);
    expect(hs.spitCooldown).toBeCloseTo(ns.spitCooldown * 0.8);
    expect(hs.spitDamage).toBeGreaterThan(ns.spitDamage);
  });
});

describe('폭탄벌레', () => {
  it('높이는 언제나 250 ~ 340 사이', () => {
    expect(bomberHoverY(480)).toBe(290); // 스테이지 파일에 y 를 안 적으면 땅 높이 → 기본 높이
    expect(bomberHoverY(100)).toBe(BOMBER_MIN_Y);
    expect(bomberHoverY(390)).toBe(BOMBER_MAX_Y);
    expect(bomberHoverY(300)).toBe(300);
    expect(bomberHoverY(undefined, 270)).toBe(270);
  });

  it('보스 문이 닫혀 있으면 문을 넘어가지 않는다', () => {
    const st = stages[1];
    expect(bomberXRange(st, false).max).toBeLessThan(st.gateX);
    expect(bomberXRange(st, true).max).toBeLessThan(st.width);
    expect(bomberXRange(st, false).min).toBeGreaterThan(0);
  });

  it('폭탄은 아래 발판 위에, 없으면 땅에 떨어진다', () => {
    const plats = [{ x: 500, y: 390, w: 128 }, { x: 500, y: 200, w: 128 }];
    expect(bombLandingY(500, 290, plats, 480)).toBe(390);
    expect(bombLandingY(800, 290, plats, 480)).toBe(480);
  });
});

describe('침뱉기와 방패병', () => {
  it('침뱉기는 가까우면 물러나고 멀면 다가온다', () => {
    expect(spitterMove(100, 220, 460)).toBe(-1);
    expect(spitterMove(300, 220, 460)).toBe(0);
    expect(spitterMove(600, 220, 460)).toBe(1);
  });

  it('방패는 앞에서 온 기본 펀치를 막고, 충전 펀치에 깨진다', () => {
    // 방패병이 왼쪽(-1)을 보고, 주인공이 왼쪽에서 오른쪽(+1)으로 침 = 앞에서
    expect(shieldResult('punch', 1, -1, true)).toBe('blocked');
    expect(shieldResult('shot', 1, -1, true)).toBe('blocked');
    expect(shieldResult('charged', 1, -1, true)).toBe('break');
    // 뒤에서 치면 언제나 맞음
    expect(shieldResult('punch', -1, -1, true)).toBe('hit');
    // 궁극기는 언제나, 방패가 깨져 있으면 언제나
    expect(shieldResult('ultimate', 1, -1, true)).toBe('hit');
    expect(shieldResult('punch', 1, -1, false)).toBe('hit');
  });
});

describe('스테이지 몬스터 배치', () => {
  const typesIn = (st) => new Set(st.monsters.map((s) => parseMonsterSpot(s, st.groundY).type));
  const firstStage = (type) => stages.findIndex((st) => typesIn(st).has(type)) + 1;

  it('폭탄벌레는 2, 침뱉기는 3, 방패병은 4 스테이지부터 나온다', () => {
    expect(firstStage('bomber')).toBe(2);
    expect(firstStage('spitter')).toBe(3);
    expect(firstStage('shield')).toBe(4);
  });

  it('스테이지 5 에는 그때까지 나온 모든 종류가 나온다', () => {
    const t = typesIn(stages[4]);
    // 수중 던전(스테이지 6) 몬스터는 6 에서 처음 나오니 빼고 본다
    for (const type of MONSTER_TYPES.filter((x) => firstStage(x) > 0 && firstStage(x) <= 5)) expect(t.has(type), type).toBe(true);
  });

  it('새 몬스터가 처음 나오는 스테이지에는 보스 문 앞에 안내판이나 로봇 대사가 있다', () => {
    const intro = { bomber: '폭탄벌레', spitter: '침', shield: '방패' };
    for (const [type, word] of Object.entries(intro)) {
      const st = stages[firstStage(type) - 1];
      const first = Math.min(...st.monsters.map((s) => parseMonsterSpot(s, st.groundY)).filter((m) => m.type === type).map((m) => m.x));
      const texts = [...st.signs.map((s) => [s.x, s.text]), ...st.talks.map((t) => [t.x, t.lines.join(' ')])];
      expect(texts.some(([x, text]) => x < first && x < st.gateX && text.includes(word)), type).toBe(true);
    }
  });

  it('안내 글에 긴 줄표나 가운뎃점을 쓰지 않는다', () => {
    for (const st of stages) {
      const all = [...st.signs.map((s) => s.text), ...st.talks.flatMap((t) => t.lines)].join('\n');
      expect(all).not.toMatch(/[—·]/);
    }
  });
});
