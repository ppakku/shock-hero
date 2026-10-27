import { describe, it, expect } from 'vitest';
import { customArt } from '../src/config/art.js';
import { stages } from '../src/stage/index.js';
import { bootArt, stageArt, monsterArtKeys, bossArtKeys, BOOT_ART } from '../src/logic/stageArt.js';
import { bossDex, monsterStages } from '../src/logic/dex.js';
import { existsSync } from 'node:fs';

describe('필요한 그림만 받기', () => {
  it('처음 받는 그림은 art.js 에 있고, 파일도 있다', () => {
    expect(bootArt(customArt)).toHaveLength(BOOT_ART.length);
    for (const a of bootArt(customArt)) expect(existsSync(`public/art/${a.file}`)).toBe(true);
  });

  it('모든 스테이지: 받을 파일이 다 있다', () => {
    stages.forEach((_, i) => {
      for (const a of stageArt(i + 1, stages, customArt)) expect(existsSync(`public/art/${a.file}`), `${i + 1}: ${a.file}`).toBe(true);
    });
  });

  it('art.js 의 그림은 처음이나 어느 스테이지에서든 한 번은 받는다 (빠뜨린 그림이 없다)', () => {
    const got = new Set(BOOT_ART);
    stages.forEach((_, i) => stageArt(i + 1, stages, customArt).forEach((a) => got.add(a.key)));
    const missing = Object.keys(customArt).filter((k) => !got.has(k));
    expect(missing).toEqual([]);
  });

  it('도감의 몬스터가 나오는 스테이지에서는 그 몬스터 그림을 받는다', () => {
    for (const [id, nums] of Object.entries(monsterStages(stages))) {
      if (!customArt[id]) continue;
      for (const n of nums) expect(monsterArtKeys(stages[n - 1]), `${id} in ${n}`).toContain(id);
    }
  });

  it('보스 얼굴 그림은 그 보스 스테이지에서 받는다', () => {
    for (const b of bossDex(stages)) {
      if (!b.portrait || !customArt[b.portrait]) continue;
      expect(bossArtKeys(stages[b.stage - 1], b.stage, customArt)).toContain(b.portrait);
    }
  });

  it('스테이지 1 은 다른 스테이지 보스 그림을 받지 않는다', () => {
    const keys = stageArt(1, stages, customArt).map((a) => a.key);
    expect(keys).toContain('boss_body_1');
    expect(keys).not.toContain('boss_body_10');
    expect(keys).not.toContain('astra_4');
    expect(keys).not.toContain('fx_breath');
  });

  it('침뱉기가 나오면 조준, 침 그림도 같이', () => {
    const n = stages.findIndex((st) => monsterArtKeys(st).includes('monster_spitter')) + 1;
    expect(n).toBeGreaterThan(0);
    expect(monsterArtKeys(stages[n - 1])).toEqual(expect.arrayContaining(['monster_spitter_aim', 'monster_spitter_spit', 'monster_spit']));
  });
});
