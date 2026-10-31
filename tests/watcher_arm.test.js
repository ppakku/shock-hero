import { describe, expect, it, vi } from 'vitest';
import { customArt } from '../src/config/art.js';
import { lookOf } from '../src/fx/bossArt.js';
import { armBoxes, armElbow } from '../src/logic/watcher.js';
import { stages } from '../src/stage/index.js';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {}, Intersects: {} }, BlendModes: {} } }));

const touches = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const sh = { x: 1000, y: 380 };
const tipX = 480;
const armY = 470;
const boxes = armBoxes(sh, tipX, armY, 32);
const hits = (r) => boxes.some((b) => touches(r, b));

describe('와처 긴 팔 맞는 자리', () => {
  it('팔꿈치는 어깨보다 높은 가운데', () => {
    expect(armElbow(sh, tipX, armY)).toEqual({ x: 740, y: 350 });
  });

  it('그려진 팔을 따라 어디든 맞는다', () => {
    const e = armElbow(sh, tipX, armY);
    for (const q of [0, 0.25, 0.5, 0.75, 1]) {
      expect(hits({ x: sh.x + (e.x - sh.x) * q - 10, y: sh.y + (e.y - sh.y) * q - 10, w: 20, h: 20 }), `위팔 ${q}`).toBe(true);
      expect(hits({ x: e.x + (tipX - e.x) * q - 10, y: e.y + (armY - e.y) * q - 10, w: 20, h: 20 }), `아래팔 ${q}`).toBe(true);
    }
  });

  it('팔에서 먼 곳은 맞지 않는다', () => {
    expect(hits({ x: 740, y: 200, w: 40, h: 40 })).toBe(false);
    expect(hits({ x: 300, y: 450, w: 40, h: 40 })).toBe(false);
  });

  it('팔이 오른쪽으로 뻗어도 같다', () => {
    const right = armBoxes({ x: 100, y: 380 }, 620, armY, 32);
    expect(right.some((b) => touches({ x: 350, y: 340, w: 20, h: 20 }, b))).toBe(true);
  });
});

describe('변종 팔다리 그림', () => {
  it('와처와 용은 자기 skin 의 팔다리 그림이 있다', () => {
    for (const [i, st] of stages.entries()) {
      const { type } = st.boss;
      const skin = st.boss.skin || i + 1; // GameScene 과 같은 규칙
      if (type === 'watcher') for (const k of ['arm', 'claw']) expect(customArt[`watcher_${k}_${skin}`], `${skin} ${k}`).toBeTruthy();
      if (type === 'dragon') for (const k of ['tail', 'tailtip']) expect(customArt[`dragon_${k}_${skin}`], `${skin} ${k}`).toBeTruthy();
    }
  });

  it('변종 그림도 원래 그림과 같은 자리에 놓인다', () => {
    expect(lookOf('watcher_claw_wraith')).toEqual(lookOf('watcher_claw_2'));
    expect(lookOf('watcher_arm_bog')).toEqual(lookOf('watcher_arm_2'));
    expect(lookOf('dragon_tail_rock')).toEqual(lookOf('dragon_tail_3'));
    expect(lookOf('dragon_tailtip_black')).toEqual(lookOf('dragon_tailtip_3'));
    expect(lookOf('fx_star')).toEqual({ depth: 8, origin: [0.5, 0.5] });
  });
});
