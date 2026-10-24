import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { stages } from '../src/stage/index.js';
import { stage6 } from '../src/stage/stage6.js';
import { withDifficulty } from '../src/logic/difficulty.js';
import { monsterStats, parseMonsterSpot, MONSTER_TYPES, FLYING_TYPES, SEA_TYPES } from '../src/logic/monsters.js';
import { readFileSync } from 'node:fs';
import {
  swimConfig, swimGravityOffset, swimVertical, swimHorizontal, clampToCeiling,
  swimmerY, swimmerYRange, swimmerXRange, dartVector, jellyBlocks, pufferResult,
  whirlPullStep, seaChargeY, seaPhaseIndex, seaUsableAttacks, inSweepBand, SWIMMER_MIN_Y,
} from '../src/logic/swim.js';

const cfg = sanitizeNumbers(balance, () => {});
const sw = swimConfig(cfg.swim);

describe('헤엄치기 계산', () => {
  it('물속 중력은 땅보다 약하다 (몸에 음수 중력을 더함)', () => {
    expect(swimGravityOffset(1500, 0.3)).toBeCloseTo(-1050);
    expect(swimGravityOffset(1500, 1)).toBeCloseTo(0);
    expect(swimGravityOffset(1500, 2)).toBeCloseTo(0); // 1 보다 크면 1 로
  });

  it('점프를 누르면 위로 헤엄치고, 꾹 누르면 간격마다 다시 찬다', () => {
    let r = swimVertical(0, { jumpPressed: true, jumpDown: true }, 0, 1 / 60, sw);
    expect(r.stroked).toBe(true);
    expect(r.vy).toBe(-sw.strokeSpeed);
    // 바로 다음 프레임은 아직 안 참
    const r2 = swimVertical(-200, { jumpPressed: false, jumpDown: true }, r.strokeTimer, 1 / 60, sw);
    expect(r2.stroked).toBe(false);
    // 간격이 지나면 다시 참
    const r3 = swimVertical(-100, { jumpPressed: false, jumpDown: true }, 0.01, 0.02, sw);
    expect(r3.stroked).toBe(true);
    expect(r3.vy).toBe(-sw.strokeSpeed);
  });

  it('손을 떼면 천천히 가라앉는다 (가라앉는 속도에 한계)', () => {
    const r = swimVertical(900, { jumpPressed: false, jumpDown: false }, 0, 1 / 60, sw);
    expect(r.vy).toBe(sw.maxFallSpeed);
    expect(sw.maxFallSpeed).toBeLessThan(300);
    const up = swimVertical(-2000, { jumpPressed: false, jumpDown: false }, 0, 1 / 60, sw);
    expect(up.vy).toBe(-sw.maxRiseSpeed);
  });

  it('꾹 누르고 있으면 계속 올라간다 (1초 시뮬레이션)', () => {
    const g = 1500 * sw.gravityScale;
    let y = 450;
    let vy = 0;
    let timer = 0;
    for (let i = 0; i < 60; i++) {
      const r = swimVertical(vy, { jumpPressed: i === 0, jumpDown: true }, timer, 1 / 60, sw);
      vy = r.vy + g / 60;
      timer = r.strokeTimer;
      y += vy / 60;
    }
    expect(450 - y).toBeGreaterThan(150);
  });

  it('옆으로는 걷기보다 조금 느리고 부드럽게 출발한다', () => {
    const speed = cfg.player.moveSpeed * sw.moveMultiplier;
    expect(speed).toBeLessThan(cfg.player.moveSpeed);
    const v1 = swimHorizontal(0, 1, speed, 1 / 60, sw.waterDrag);
    expect(v1).toBeGreaterThan(0);
    expect(v1).toBeLessThan(speed);
    let v = 0;
    for (let i = 0; i < 60; i++) v = swimHorizontal(v, 1, speed, 1 / 60, sw.waterDrag);
    expect(v).toBeGreaterThan(speed * 0.95);
  });

  it('천장 위로는 못 올라간다', () => {
    expect(clampToCeiling(100, -300, 150)).toEqual({ y: 150, vy: 0 });
    expect(clampToCeiling(200, -300, 150)).toEqual({ y: 200, vy: -300 });
  });
});

describe('헤엄치는 몬스터', () => {
  it('종류가 등록되어 있고, 꽃게만 땅을 걷는다', () => {
    for (const t of SEA_TYPES) expect(MONSTER_TYPES).toContain(t);
    for (const t of ['jelly', 'puffer', 'piranha']) expect(FLYING_TYPES).toContain(t);
    expect(FLYING_TYPES).not.toContain('crab');
  });

  it('높이는 주인공이 닿는 물속 범위 안 (천장 아래, 땅 위)', () => {
    const r = swimmerYRange(480);
    expect(r.min).toBeGreaterThanOrEqual(sw.ceilingY);
    expect(swimmerY(50, 480)).toBe(SWIMMER_MIN_Y);
    expect(swimmerY(480, 480, 330)).toBe(330); // y 를 안 적으면 기본 높이
    expect(swimmerY(900, 480)).toBeLessThanOrEqual(r.max);
  });

  it('닫힌 보스 문 너머로 못 간다', () => {
    expect(swimmerXRange(stage6, false).max).toBe(stage6.gateX - 50);
    expect(swimmerXRange(stage6, true).max).toBe(stage6.width - 40);
  });

  it('골드해파리 경화: 맨손은 막고, 반 이상 충전 펀치와 궁극기는 뚫는다', () => {
    expect(jellyBlocks('punch', true)).toBe(true);
    expect(jellyBlocks('upper', true)).toBe(true);
    expect(jellyBlocks('shot', true)).toBe(true);
    expect(jellyBlocks('charged', true, 0.3, 0.5)).toBe(true);
    expect(jellyBlocks('charged', true, 0.6, 0.5)).toBe(false);
    expect(jellyBlocks('ultimate', true)).toBe(false);
    expect(jellyBlocks('punch', false)).toBe(false);
  });

  it('가시복어: 가시가 섰을 때 맨손은 찔리고, 에너지탄과 충전 펀치는 통한다', () => {
    expect(pufferResult('punch', true)).toBe('thorns');
    expect(pufferResult('upper', true)).toBe('thorns');
    expect(pufferResult('shot', true)).toBe('hit');
    expect(pufferResult('charged', true)).toBe('hit');
    expect(pufferResult('punch', false)).toBe('hit');
  });

  it('피라냐 돌진 방향은 단위 벡터', () => {
    const d = dartVector(0, 0, 30, 40);
    expect(d.x).toBeCloseTo(0.6);
    expect(d.y).toBeCloseTo(0.8);
    expect(Math.hypot(...Object.values(dartVector(5, 5, 5, 5)))).toBeLessThanOrEqual(1);
  });

  it('난이도 배수가 새 숫자에도 붙는다', () => {
    const hard = withDifficulty(cfg, 'hard');
    const easy = withDifficulty(cfg, 'easy');
    const n = monsterStats(withDifficulty(cfg, 'normal'), 'jelly');
    expect(monsterStats(hard, 'jelly').boltDamage).toBeGreaterThan(n.boltDamage);
    expect(monsterStats(easy, 'jelly').boltWindup).toBeGreaterThan(n.boltWindup);
    expect(monsterStats(hard, 'piranha').dartSpeed).toBeGreaterThan(monsterStats(withDifficulty(cfg, 'normal'), 'piranha').dartSpeed);
    expect(monsterStats(easy, 'puffer').inflateWarning).toBeGreaterThan(monsterStats(withDifficulty(cfg, 'normal'), 'puffer').inflateWarning);
  });
});

describe('스테이지 6 수중 던전', () => {
  it('마지막 스테이지이고 헤엄치는 스테이지다', () => {
    expect(stages[stages.length - 1]).toBe(stage6);
    expect(stage6.swim).toBe(true);
    expect(stage6.theme.scenery).toBe('underwater');
    expect(stage6.endingLines.length).toBeGreaterThan(0);
    for (const st of stages.slice(0, -1)) expect(st.swim).toBeFalsy();
  });

  it('발판은 헤엄 천장보다 충분히 아래에 있다 (발판 위에 설 수 있게)', () => {
    for (const p of stage6.platforms) expect(p.y - 40, `x ${p.x}`).toBeGreaterThanOrEqual(sw.ceilingY);
  });

  it('헤엄치는 몬스터는 물속 범위 안에 놓인다', () => {
    for (const spot of stage6.monsters) {
      const m = parseMonsterSpot(spot, stage6.groundY);
      if (m.type === 'crab') continue;
      const y = swimmerY(spot.y, stage6.groundY);
      expect(y).toBeGreaterThanOrEqual(SWIMMER_MIN_Y);
      expect(y).toBeLessThan(stage6.groundY);
    }
  });

  it('새 몬스터는 처음 나오기 전에 안내가 있다', () => {
    const intro = { jelly: '해파리', puffer: '복어', piranha: '피라냐' };
    for (const [type, word] of Object.entries(intro)) {
      const first = Math.min(...stage6.monsters.map((s) => parseMonsterSpot(s, stage6.groundY)).filter((m) => m.type === type).map((m) => m.x));
      const texts = [...stage6.signs.map((s) => [s.x, s.text]), ...stage6.talks.map((t) => [t.x, t.lines.join(' ')])];
      expect(texts.some(([x, text]) => x < first && text.includes(word)), type).toBe(true);
    }
  });

  it('보스는 sea 종류로 등록되어 있다', () => {
    expect(stage6.boss.type).toBe('sea');
    // src/boss/index.js 는 Phaser 를 불러서 여기서는 글자로 확인
    expect(readFileSync(new URL('../src/boss/index.js', import.meta.url), 'utf8')).toMatch(/sea: SeaBoss/);
    expect(stage6.boss.phases).toHaveLength(3);
  });
});

describe('심해 아귀왕 계산', () => {
  it('소용돌이는 입 쪽으로 끌되 지나치지 않는다', () => {
    const p = whirlPullStep(0, 0, 100, 0, 130, 0.5);
    expect(p.x).toBeCloseTo(65);
    expect(whirlPullStep(95, 0, 100, 0, 130, 0.5)).toEqual({ x: 100, y: 0 });
  });

  it('소용돌이 힘은 헤엄 속도보다 약해서 도망칠 수 있다', () => {
    expect(cfg.seaBoss.whirlPull).toBeLessThan(cfg.player.moveSpeed * sw.moveMultiplier);
  });

  it('바닥 휩쓸기는 천장까지 헤엄치면 피할 수 있다', () => {
    const heroBottom = sw.ceilingY + 28;
    expect(inSweepBand(heroBottom, 480, cfg.seaBoss.sweepHeight)).toBe(false);
    expect(inSweepBand(479, 480, cfg.seaBoss.sweepHeight)).toBe(true);
  });

  it('돌진 높이와 공격 단계', () => {
    expect(seaChargeY(50, 170, 408)).toBe(170);
    expect(seaChargeY(900, 170, 408)).toBe(408);
    expect(seaPhaseIndex(2)).toBe(0);
    expect(seaPhaseIndex(1)).toBe(1);
    expect(seaPhaseIndex(0)).toBe(2);
  });

  it('초롱불이 없으면 먹물을 안 쓴다', () => {
    expect(seaUsableAttacks(['charge', 'ink'], true)).toEqual(['charge', 'ink']);
    expect(seaUsableAttacks(['charge', 'ink'], false)).toEqual(['charge']);
  });
});
