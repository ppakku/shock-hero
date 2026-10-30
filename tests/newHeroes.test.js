import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { shieldResult } from '../src/logic/monsters.js';
import { jellyBlocks, pufferResult } from '../src/logic/swim.js';
import { versusDamage } from '../src/logic/versus.js';
import { ultimateAttack } from '../src/logic/combat.js';
import { HERO_IDS, HERO_INFO, heroStats, ninjaAttack, mageAttack, frostRect, blizzardSlow } from '../src/logic/heroes.js';
import { HERO_LOOKS, HERO_POSES } from '../src/fx/heroTextures.js';
import { guestProfile, cleanProfile } from '../src/logic/coopRewards.js';
import { keyText, controlLines, attackButtonLabel } from '../src/logic/controls.js';
import { NO_SLOW, addSlow, tickSlow, slowedStats } from '../src/logic/slow.js';
import { challengeText, makeChallenge } from '../src/logic/daily.js';

const cfg = sanitizeNumbers(balance, () => {});
const full = cfg.charge.fullTime + 1;

describe('주인공 다섯 명', () => {
  it('모든 주인공에게 소개 글과 생김새가 있다', () => {
    expect(HERO_IDS).toEqual(['shock', 'gunner', 'giant', 'ninja', 'mage']);
    for (const id of HERO_IDS) {
      expect(HERO_INFO[id].name).toBeTruthy();
      expect(HERO_LOOKS[id].prefix).toBeTruthy();
      expect(`${HERO_INFO[id].name}${HERO_INFO[id].short}${HERO_INFO[id].lines.join('')}`).not.toMatch(/[—·]/);
    }
    expect(Object.keys(HERO_POSES).length).toBeGreaterThan(0);
  });

  it('바람 닌자는 빠르고 체력이 조금 적다, 얼음 마법사는 보통 속도에 체력이 조금 적다', () => {
    const ninja = heroStats('ninja', cfg);
    const mage = heroStats('mage', cfg);
    expect(ninja.health).toBeLessThan(1);
    expect(ninja.move).toBeGreaterThan(1);
    expect(mage.health).toBeLessThan(1);
    expect(mage.move).toBe(1);
  });

  it('친구 프로필에 새 주인공이 그대로 지나가고, 모르는 이름은 쇼크 히어로', () => {
    expect(cleanProfile({ hero: 'ninja' }).hero).toBe('ninja');
    expect(cleanProfile({ hero: 'mage' }).hero).toBe('mage');
    expect(cleanProfile({ hero: 'robot' }).hero).toBe('shock');
    expect(guestProfile({ settings: { hero: 'mage' } }).hero).toBe('mage');
  });

  it('오늘의 도전이 다섯 주인공을 모두 고른다', () => {
    const seen = new Set();
    for (let d = 1; d <= 28; d++) {
      for (let m = 1; m <= 12; m++) seen.add(makeChallenge(`2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, {}, 20).hero);
    }
    expect([...seen].sort()).toEqual([...HERO_IDS].sort());
    expect(challengeText({ hero: 'ninja', stage: 2, rule: 'noDash', limit: null })).toBe('바람 닌자로 스테이지 2를 대시 안 쓰고 깨기');
    expect(challengeText({ hero: 'mage', stage: 3, rule: 'noUlt', limit: null })).toBe('얼음 마법사로 스테이지 3을 궁극기 안 쓰고 깨기');
  });

  it('안내 글이 주인공 공격 이름으로 바뀐다', () => {
    expect(keyText('{strong}(으)로 부숴! {atk}(으)로 쳐!', 'classic', 'ninja')).toBe('돌진 베기로 부숴! 표창으로 쳐!');
    expect(keyText('{strong}(으)로 부숴! {atk}(으)로 쳐!', 'classic', 'mage')).toBe('얼음 폭발로 부숴! 얼음탄으로 쳐!');
    expect(attackButtonLabel('ninja')).toBe('표창');
    expect(attackButtonLabel('mage')).toBe('얼음탄');
    expect(controlLines('touch', 'mage')[1]).toBe('얼음탄 버튼 (꾹 눌렀다 떼면 얼음 폭발)    대시 버튼    일시정지 오른쪽 위 II');
  });
});

describe('바람 닌자', () => {
  it('짧게 떼면 표창: 번개탄보다 짧게 날아가고 위로도 던진다', () => {
    const a = ninjaAttack(0.05, cfg);
    expect(a.style).toBe('star');
    expect(a.damage).toBe(cfg.heroes.ninja.starDamage);
    expect(cfg.heroes.ninja.starDistance).toBeLessThan(cfg.heroes.gunner.boltDistance);
    expect(ninjaAttack(0.05, cfg, 1, { up: true }).up).toBe(true);
  });

  it('꾹 누르면 돌진 베기: 오래 누를수록 세고 멀리 간다', () => {
    const low = ninjaAttack(cfg.charge.minTime + 0.01, cfg);
    const max = ninjaAttack(full, cfg);
    expect(low.style).toBe('slash');
    expect(max.full).toBe(true);
    expect(low.damage).toBeLessThan(max.damage);
    expect(max.damage).toBe(cfg.heroes.ninja.slashMaxDamage);
    expect(low.time).toBeLessThan(max.time);
    expect(max.time).toBe(cfg.heroes.ninja.slashMaxTime);
    // 대시보다 멀리 간다
    expect(max.speed * max.time).toBeGreaterThan(cfg.dash.speed * cfg.dash.duration);
  });

  it('조언이 실제 규칙과 맞는다 (방패, 해파리, 가시복어)', () => {
    expect(shieldResult(ninjaAttack(0.05, cfg).kind, 1, -1, true)).toBe('blocked');
    expect(shieldResult(ninjaAttack(full, cfg).kind, 1, -1, true)).toBe('break');
    expect(jellyBlocks(ninjaAttack(0.05, cfg).kind, true, 0)).toBe(true);
    expect(jellyBlocks(ninjaAttack(full, cfg).kind, true, 1)).toBe(false);
    expect(pufferResult(ninjaAttack(0.05, cfg).kind, true)).toBe('hit');
    expect(pufferResult(ninjaAttack(full, cfg).kind, true)).toBe('hit');
  });
});

describe('얼음 마법사', () => {
  it('짧게 떼면 얼음탄: 번개탄보다 천천히 날아가고 적을 느리게 하지는 않는다', () => {
    const a = mageAttack(0.05, cfg);
    expect(a.style).toBe('ice');
    expect(a.damage).toBe(cfg.heroes.mage.iceDamage);
    expect(a.slow).toBeUndefined();
    expect(cfg.heroes.mage.iceSpeed).toBeLessThan(cfg.heroes.gunner.boltSpeed / 2);
  });

  it('꾹 누르면 얼음 폭발: 오래 누를수록 크고 오래 느려진다', () => {
    const low = mageAttack(cfg.charge.minTime + 0.01, cfg);
    const max = mageAttack(full, cfg);
    expect(low.style).toBe('frost');
    expect(low.damage).toBeLessThan(max.damage);
    expect(low.radius).toBeLessThan(max.radius);
    expect(low.slow.time).toBeLessThan(max.slow.time);
    expect(max.slow).toEqual({ time: cfg.heroes.mage.slowMaxTime, multiplier: cfg.heroes.mage.slowMultiplier });
  });

  it('얼음 폭발은 앞쪽 멀리, 위를 누르면 머리 위에서 터진다', () => {
    const right = frostRect(100, 400, 1, 220, 60, false);
    expect(right.x + right.w / 2).toBe(320);
    const left = frostRect(500, 400, -1, 220, 60, false);
    expect(left.x + left.w / 2).toBe(280);
    const up = frostRect(100, 400, 1, 220, 60, true);
    expect(up.x + up.w / 2).toBe(100);
    expect(up.y + up.h / 2).toBe(180);
  });

  it('조언이 실제 규칙과 맞는다 (방패, 해파리, 가시복어)', () => {
    expect(shieldResult(mageAttack(0.05, cfg).kind, 1, -1, true)).toBe('blocked');
    expect(shieldResult(mageAttack(full, cfg).kind, 1, -1, true)).toBe('break');
    expect(jellyBlocks(mageAttack(0.05, cfg).kind, true, 0)).toBe(true);
    expect(jellyBlocks(mageAttack(full, cfg).kind, true, 1)).toBe(false);
    expect(pufferResult(mageAttack(0.05, cfg).kind, true)).toBe('hit');
  });

  it('눈보라는 궁극기라서 겨루기 피해 상한을 따르고 느려짐이 붙는다', () => {
    const { attack } = ultimateAttack(cfg);
    const blizzard = { ...attack, slow: blizzardSlow(cfg) };
    expect(versusDamage(blizzard, 100, 0.1)).toBe(10);
    expect(blizzard.slow.multiplier).toBe(cfg.heroes.mage.blizzardSlowMultiplier);
  });
});

describe('느려짐', () => {
  it('얼음에 맞으면 느려지고 시간이 지나면 풀린다', () => {
    let s = addSlow(NO_SLOW, { time: 2, multiplier: 0.5 });
    expect(s).toEqual({ left: 2, multiplier: 0.5 });
    s = tickSlow(s, 1.5);
    expect(s.left).toBeCloseTo(0.5);
    expect(s.multiplier).toBe(0.5);
    expect(tickSlow(s, 0.6)).toBe(NO_SLOW);
    expect(tickSlow(NO_SLOW, 1)).toBe(NO_SLOW);
  });

  it('또 맞으면 시간은 긴 쪽, 속도는 느린 쪽', () => {
    const s = addSlow({ left: 1, multiplier: 0.35 }, { time: 3, multiplier: 0.45 });
    expect(s).toEqual({ left: 3, multiplier: 0.35 });
    const t = addSlow({ left: 3, multiplier: 0.45 }, { time: 1, multiplier: 0.35 });
    expect(t).toEqual({ left: 3, multiplier: 0.35 });
  });

  it('끝난 느려짐은 이전 배수를 물려주지 않는다', () => {
    expect(addSlow(NO_SLOW, { time: 1, multiplier: 0.9 }).multiplier).toBe(0.9);
  });

  it('이상한 값이면 그대로 둔다', () => {
    expect(addSlow(NO_SLOW, null)).toBe(NO_SLOW);
    expect(addSlow(NO_SLOW, { time: 0, multiplier: 0.5 })).toBe(NO_SLOW);
    expect(addSlow(NO_SLOW, { time: 2, multiplier: 0 })).toBe(NO_SLOW);
    expect(addSlow(NO_SLOW, { time: 2, multiplier: 1.5 })).toBe(NO_SLOW);
  });

  it('몬스터 속도 숫자만 줄고 원래 묶음은 그대로', () => {
    const m = { moveSpeed: 100, lungeSpeed: 400, dartSpeed: 500, damage: 12, maxHealth: 30 };
    const s = slowedStats(m, 0.5);
    expect(s).toEqual({ moveSpeed: 50, lungeSpeed: 200, dartSpeed: 250, damage: 12, maxHealth: 30 });
    expect(m.moveSpeed).toBe(100);
    expect(slowedStats({ moveSpeed: 100 }, 0.5)).toEqual({ moveSpeed: 50 });
  });
});
