import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { stages } from '../src/stage/index.js';
import {
  MONSTER_TYPES,
  FLYING_TYPES,
  FROS_MIN_Y,
  FROS_MAX_Y,
  monsterStats,
  parseMonsterSpot,
  pushedKnockback,
  frosHoverY,
  frosXRange,
  frosHoverX,
  floorBelowY,
  venomDirection,
  venomLanding,
  maxCloudDamage,
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
    for (const t of ['fros', 'spitter', 'shield']) expect(MONSTER_TYPES).toContain(t);
    expect(FLYING_TYPES).toEqual(['fros']);
    expect(MONSTER_TYPES).not.toContain('bomber');
  });

  it('배수가 아닌 숫자는 그대로 넘어온다', () => {
    const b = monsterStats(cfg, 'fros');
    expect(b.type).toBe('fros');
    expect(b.venomDamage).toBe(balance.monsterTypes.fros.venomDamage);
    expect(b.cloudWidth).toBeGreaterThan(40);
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

  it('프로스 조준이 멈춘 뒤에도 독구름 밖으로 걸어 나갈 시간이 있다', () => {
    const f = monsterStats(cfg, 'fros');
    expect(cfg.player.moveSpeed * f.venomLockTime).toBeGreaterThan(f.cloudWidth / 2 + 20);
    expect(f.venomWarningTime).toBeGreaterThan(f.venomLockTime);
  });

  it('독구름은 약 1.5초 남고, 계속 서 있어도 피해가 작다', () => {
    const f = monsterStats(cfg, 'fros');
    expect(f.cloudTime).toBeGreaterThanOrEqual(1.2);
    expect(f.cloudTime).toBeLessThanOrEqual(2);
    expect(f.cloudTickTime).toBeGreaterThanOrEqual(0.25);
    expect(maxCloudDamage(f.cloudTime, f.cloudTickTime, f.cloudDamage)).toBeLessThanOrEqual(cfg.player.maxHealth * 0.2);
    expect(f.venomDamage).toBeLessThan(cfg.player.maxHealth * 0.2);
  });
});

describe('난이도', () => {
  const withDiff = (d) => ({ ...cfg, difficulty: d });
  const easy = { level: 'easy', monsterDamage: 0.7, monsterSpeed: 0.9, monsterWindup: 1.3 };
  const hard = { level: 'hard', monsterDamage: 1.25, monsterSpeed: 1.15, monsterWindup: 0.8 };

  it('난이도가 없으면 보통과 같다', () => {
    expect(monsterStats(cfg, 'fros')).toEqual(monsterStats(withDiff({ level: 'normal', monsterDamage: 1, monsterSpeed: 1, monsterWindup: 1 }), 'fros'));
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
    const nf = monsterStats(cfg, 'fros');
    const ef = monsterStats(withDiff(easy), 'fros');
    const hf = monsterStats(withDiff(hard), 'fros');
    expect(ef.venomWarningTime).toBeCloseTo(nf.venomWarningTime * 1.3);
    expect(ef.venomInterval).toBeCloseTo(nf.venomInterval * 1.3);
    expect(hf.venomLockTime).toBeCloseTo(nf.venomLockTime * 0.8);
    expect(ef.venomDamage).toBeLessThan(nf.venomDamage);
    expect(hf.venomDamage).toBeGreaterThan(nf.venomDamage);
    expect(ef.cloudDamage).toBeLessThanOrEqual(nf.cloudDamage);
    expect(ef.cloudDamage).toBeGreaterThanOrEqual(1);
    expect(hf.cloudDamage).toBeGreaterThan(nf.cloudDamage);
    const hs = monsterStats(withDiff(hard), 'spitter');
    const ns = monsterStats(cfg, 'spitter');
    expect(hs.spitWindup).toBeCloseTo(ns.spitWindup * 0.8);
    expect(hs.spitCooldown).toBeCloseTo(ns.spitCooldown * 0.8);
    expect(hs.spitDamage).toBeGreaterThan(ns.spitDamage);
  });
});

describe('프로스', () => {
  it('높이는 언제나 250 ~ 340 사이', () => {
    expect(frosHoverY(480)).toBe(290); // 스테이지 파일에 y 를 안 적으면 땅 높이 → 기본 높이
    expect(frosHoverY(100)).toBe(FROS_MIN_Y);
    expect(frosHoverY(390)).toBe(FROS_MAX_Y);
    expect(frosHoverY(300)).toBe(300);
    expect(frosHoverY(undefined, 270)).toBe(270);
  });

  it('예전 이름 bomber 로 적어도 프로스가 나온다', () => {
    expect(parseMonsterSpot({ x: 100, type: 'bomber' }, 480).type).toBe('fros');
    expect(parseMonsterSpot({ x: 100, type: 'fros' }, 480).type).toBe('fros');
  });

  it('주인공 옆 위쪽에 떠 있고, 문 쪽이 막히면 반대편으로 간다', () => {
    const range = { min: 40, max: 1000 };
    expect(frosHoverX(600, 500, 170, range)).toBe(670);
    expect(frosHoverX(400, 500, 170, range)).toBe(330);
    expect(frosHoverX(990, 900, 170, range)).toBe(730); // 오른쪽은 문 너머라 왼쪽으로
  });

  it('맹독은 언제나 아래로 비스듬히 날아가 바닥에 떨어진다', () => {
    const d = venomDirection(600, 290, 430, 450);
    expect(d.x).toBeLessThan(0);
    expect(d.y).toBeGreaterThan(0);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    const flat = venomDirection(600, 290, 300, 280); // 주인공이 더 높아도 아래로
    expect(flat.y).toBeGreaterThanOrEqual(0.35 - 1e-9);
    const land = venomLanding(600, 290, d, [], 480);
    expect(land.y).toBe(480);
    expect(land.x).toBeLessThan(600);
    // 날아가는 길에 발판이 있으면 발판 위에 떨어진다
    const plat = venomLanding(600, 290, { x: 0, y: 1 }, [{ x: 600, y: 390, w: 128 }], 480);
    expect(plat.y).toBe(390);
  });

  it('보스 문이 닫혀 있으면 문을 넘어가지 않는다', () => {
    const st = stages[1];
    expect(frosXRange(st, false).max).toBeLessThan(st.gateX);
    expect(frosXRange(st, true).max).toBeLessThan(st.width);
    expect(frosXRange(st, false).min).toBeGreaterThan(0);
  });

  it('쓰러지면 아래 발판 위에, 없으면 땅에 떨어진다', () => {
    const plats = [{ x: 500, y: 390, w: 128 }, { x: 500, y: 200, w: 128 }];
    expect(floorBelowY(500, 290, plats, 480)).toBe(390);
    expect(floorBelowY(800, 290, plats, 480)).toBe(480);
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

  it('프로스는 2, 침뱉기는 3, 방패병은 4 스테이지부터 나온다', () => {
    expect(firstStage('fros')).toBe(2);
    expect(firstStage('spitter')).toBe(3);
    expect(firstStage('shield')).toBe(4);
  });

  it('스테이지 5 에는 모든 종류가 나온다', () => {
    const t = typesIn(stages[4]);
    for (const type of MONSTER_TYPES) expect(t.has(type), type).toBe(true);
  });

  it('새 몬스터가 처음 나오는 스테이지에는 보스 문 앞에 안내판이나 로봇 대사가 있다', () => {
    const intro = { fros: '프로스', spitter: '침', shield: '방패' };
    for (const [type, word] of Object.entries(intro)) {
      const st = stages[firstStage(type) - 1];
      const first = Math.min(...st.monsters.map((s) => parseMonsterSpot(s, st.groundY)).filter((m) => m.type === type).map((m) => m.x));
      const texts = [...st.signs.map((s) => [s.x, s.text]), ...st.talks.map((t) => [t.x, t.lines.join(' ')])];
      expect(texts.some(([x, text]) => x < first && x < st.gateX && text.includes(word)), type).toBe(true);
    }
  });

  it('안내 글에 예전 이름 폭탄벌레가 남아 있지 않다', () => {
    for (const st of stages) {
      const all = [...st.signs.map((s) => s.text), ...st.talks.flatMap((t) => t.lines)].join('\n');
      expect(all).not.toContain('폭탄벌레');
    }
  });

  it('안내 글에 긴 줄표나 가운뎃점을 쓰지 않는다', () => {
    for (const st of stages) {
      const all = [...st.signs.map((s) => s.text), ...st.talks.flatMap((t) => t.lines)].join('\n');
      expect(all).not.toMatch(/[—·]/);
    }
  });
});
