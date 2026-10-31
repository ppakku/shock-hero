import { describe, it, expect } from 'vitest';
import {
  shredderPhaseIndex, chooseShredderAttack, SAW_PATTERNS, SHREDDER_PATTERNS, walkStep, dashEndX, finStep, rollBlade, bladeDone, sawSpin,
} from '../src/logic/shredder.js';
import { stage1 } from '../src/stage/stage1.js';
import { balance } from '../src/config/balance.js';
import { bossDex } from '../src/logic/dex.js';
import { withDifficulty } from '../src/logic/difficulty.js';

describe('파쇄자 공격 고르기', () => {
  const phases = [['sawDash', 'rocket', 'stomp'], ['sawDash', 'rocket'], ['sawDash', 'stomp']];

  it('부위가 부서질수록 단계가 올라간다', () => {
    expect(shredderPhaseIndex(true, true)).toBe(0);
    expect(shredderPhaseIndex(false, true)).toBe(1);
    expect(shredderPhaseIndex(true, false)).toBe(1);
    expect(shredderPhaseIndex(false, false)).toBe(2);
  });

  it('쇠팔이 없으면 주먹 발사를 안 한다', () => {
    for (let i = 0; i < 20; i++) expect(chooseShredderAttack(phases, false, true, null, 0, () => i / 20)).not.toBe('rocket');
  });

  it('방금 한 공격은 피한다', () => {
    for (let i = 0; i < 20; i++) expect(chooseShredderAttack(phases, true, true, 'rocket', 0, () => i / 20)).not.toBe('rocket');
  });

  it('톱니 공격이 두 번 빠지면 반드시 톱니 공격이 나온다', () => {
    for (let i = 0; i < 20; i++) expect(SAW_PATTERNS).toContain(chooseShredderAttack(phases, true, true, 'stomp', 2, () => i / 20));
  });

  it('쓸 공격이 없으면 톱니 돌진', () => {
    expect(chooseShredderAttack([['rocket']], false, true)).toBe('sawDash');
  });
});

describe('파쇄자 움직임', () => {
  it('걸음은 주인공 쪽으로 가고 keep 안쪽이면 멈춘다', () => {
    expect(walkStep(1000, 500, 200, 100, 1, 0, 2000)).toBe(900);
    expect(walkStep(1000, 900, 200, 100, 1, 0, 2000)).toBe(1000);
  });

  it('걸음은 벽을 넘지 않는다', () => {
    expect(walkStep(110, -500, 100, 100, 1, 100, 2000)).toBe(100);
  });

  it('돌진은 주인공 쪽 벽, 겹쳐 있으면 먼 벽으로 간다', () => {
    expect(dashEndX(500, 300, 100, 900)).toBe(100);
    expect(dashEndX(500, 700, 100, 900)).toBe(900);
    expect(dashEndX(700, 700, 100, 900)).toBe(100);
  });

  it('땅속 톱날은 지나치지 않고 싸움터 안에 있다', () => {
    expect(finStep(100, 110, 230, 1, 0, 500)).toBe(110);
    expect(finStep(490, 900, 230, 1, 0, 500)).toBe(500);
  });

  it('땅속 톱날은 주인공보다 느리다 (도망칠 수 있다)', () => {
    expect(balance.shredderBoss.finSpeed).toBeLessThan(balance.player.moveSpeed);
  });

  it('톱날은 벽에서 한 번 튕기고 두 번째 벽에서 끝난다', () => {
    let b = { x: 95, dir: -1, bounces: 1 };
    const r = rollBlade(b, 100, 0.1, 90, 200);
    expect(r).toMatchObject({ x: 90, dir: 1, bounces: 0, bounced: true });
    expect(bladeDone(r, 90, 200)).toBe(false); // 막 튕긴 톱날은 돌아온다
    b = { x: 195, dir: 1, bounces: 0 };
    const end = rollBlade(b, 100, 0.1, 90, 200);
    expect(end.x).toBe(200);
    expect(bladeDone(end, 90, 200)).toBe(true);
  });

  it('톱니는 공격할수록 빨리 돌고 지치면 멈춘다', () => {
    expect(sawSpin('stop')).toBe(0);
    expect(sawSpin('idle')).toBeLessThan(sawSpin('rev'));
    expect(sawSpin('rev')).toBeLessThan(sawSpin('attack'));
  });
});

describe('스테이지 1 보스', () => {
  it('파쇄자는 새 보스 종류이고 공격의 절반 이상이 톱니 공격이다', () => {
    expect(stage1.boss.type).toBe('shredder');
    expect(stage1.boss.phases).toHaveLength(3);
    for (const list of stage1.boss.phases) {
      for (const p of list) expect(SHREDDER_PATTERNS).toContain(p);
      const kinds = [...new Set(list)];
      expect(kinds.filter((p) => SAW_PATTERNS.includes(p)).length * 2).toBeGreaterThanOrEqual(kinds.length);
    }
  });

  it('모든 공격이 어딘가에서 나온다', () => {
    expect(new Set(stage1.boss.phases.flat())).toEqual(new Set(SHREDDER_PATTERNS));
  });

  it('도감에 그림이 나온다', () => {
    expect(bossDex([stage1])[0].portrait).toBe('boss_body_1');
  });

  it('난이도가 피해량을 바꾼다', () => {
    const hard = withDifficulty(balance, 'hard', 1);
    expect(hard.shredderBoss.dashDamage).toBeGreaterThanOrEqual(balance.shredderBoss.dashDamage);
  });
});
