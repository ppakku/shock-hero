import { describe, it, expect, vi } from 'vitest';
import { cfg } from '../src/config/index.js';
import { createGunFx, fireGunFx, chargeGunFx, stepGunFx, gunPush, jagged, ribbonPositions } from '../src/logic/horrorStunGun.js';
import { StunGun } from '../src/horror/stunGun.js';
import { faceBox } from '../src/horror/art.js';
import * as THREE from 'three';

const k = cfg.horror.stunGun;
const litArcs = (g) => g.arcs.filter((a) => a.core.visible).length;
const [blue, green] = cfg.horror.stamps.bolts;
const make = (o = {}) => new StunGun({ aspect: 16 / 9, touch: false, lowFx: false, k, bolt: blue, ...o });
const frame = { lit: true, walking: false, target: { x: 0, y: 0, z: -3 } };

describe('전기충격기 움직임 계산', () => {
  it('맞히면 번개가 이어지고 빗나가면 불꽃만 튄다', () => {
    const hit = createGunFx();
    fireGunFx(hit, 'hit', k);
    expect(hit.boltT).toBeGreaterThan(0);
    const miss = createGunFx();
    fireGunFx(miss, 'miss', k);
    expect(miss.boltT).toBe(0);
    expect(miss.zapT).toBeGreaterThan(0);
  });

  it('충전 없이 누르면 살짝만 움직이고 불꽃이 없다', () => {
    const fx = createGunFx();
    const hit = createGunFx();
    fireGunFx(fx, 'empty', k);
    fireGunFx(hit, 'hit', k);
    stepGunFx(fx, k.kickTime / 2);
    stepGunFx(hit, k.kickTime / 2);
    expect(fx.zapT).toBe(0);
    expect(gunPush(fx, k)).toBeGreaterThan(0);
    expect(gunPush(fx, k)).toBeLessThan(gunPush(hit, k));
  });

  it('시간이 지나면 모두 제자리로 돌아온다', () => {
    const fx = createGunFx();
    fireGunFx(fx, 'hit', k);
    chargeGunFx(fx, k);
    stepGunFx(fx, 5);
    expect(fx).toMatchObject({ kickT: 0, zapT: 0, boltT: 0, chargeT: 0 });
    expect(gunPush(fx, k)).toBe(0);
  });

  it('시간이 거꾸로 와도 번쩍이지 않는다', () => {
    const fx = createGunFx();
    stepGunFx(fx, -0.38);
    expect(fx).toMatchObject({ kickT: 0, zapT: 0, boltT: 0, chargeT: 0 });
  });

  it('번개의 양 끝은 정확히 닿는다', () => {
    const from = { x: 0.1, y: -0.2, z: -0.5 };
    const to = { x: 1, y: 2, z: -3 };
    const pts = jagged(from, to, 6, 0.3);
    expect(pts).toHaveLength(7);
    expect(pts[0]).toEqual(from);
    expect(pts[6]).toEqual(to);
  });

  it('띠는 먼 곳에서 넓어져 화면에서 같은 굵기로 보인다', () => {
    const out = new Float32Array(12);
    ribbonPositions([{ x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: -2 }], 0.1, out);
    expect(Math.abs(out[1] - out[4])).toBeCloseTo(0.1);
    expect(Math.abs(out[7] - out[10])).toBeCloseTo(0.2);
    expect(out.every(Number.isFinite)).toBe(true);
  });

  it('점이 겹쳐도 띠가 깨지지 않는다', () => {
    const out = new Float32Array(12);
    ribbonPositions([{ x: 1, y: 1, z: -1 }, { x: 1, y: 1, z: -1 }], 0.1, out);
    expect(out.every(Number.isFinite)).toBe(true);
  });
});

describe('손에 든 전기충격기', () => {
  it('충전 전에는 어둡고 전기가 없다', () => {
    const g = make();
    g.show(true);
    g.update(0.1, frame);
    expect(litArcs(g)).toBe(0);
    expect(g.halo.visible).toBe(false);
  });

  it('충전되면 색이 바뀌고 전기가 튄다', () => {
    const g = make();
    g.show(true);
    const cold = g.stripMat.color.getHex();
    g.setCharged(true);
    g.update(0.1, frame);
    expect(g.stripMat.color.getHex()).not.toBe(cold);
    expect(litArcs(g)).toBeGreaterThan(0);
    expect(g.halo.visible).toBe(true);
  });

  it('맞히면 번개 여러 줄, 효과 줄이기를 켜면 한 줄이다', () => {
    const g = make();
    g.show(true);
    g.fire('hit');
    g.update(0.01, frame);
    expect(litArcs(g)).toBe(k.arcs);
    const low = make({ lowFx: true });
    low.show(true);
    low.fire('hit');
    low.update(0.01, frame);
    expect(litArcs(low)).toBe(k.arcsLow);
  });

  it('괴물이 등 뒤에 있어도 번개는 화면 앞쪽으로 그린다', () => {
    const g = make();
    g.show(true);
    g.fire('hit');
    g.update(0.01, { ...frame, target: { x: 0, y: 0, z: 2 } });
    const pos = g.arcs[0].core.geometry.getAttribute('position').array;
    expect(pos[pos.length - 1]).toBeLessThan(0);
  });

  it('치우면 손, 빛, 번개가 모두 사라진다', () => {
    const g = make();
    g.show(true);
    g.setCharged(true);
    g.update(0.1, frame);
    g.show(false);
    expect(g.root.visible).toBe(false);
    expect(g.halo.visible).toBe(false);
    expect(litArcs(g)).toBe(0);
    g.update(0.1, frame);
    expect(litArcs(g)).toBe(0);
  });

  it('터치 화면에서는 버튼을 피해 더 안쪽에 놓인다', () => {
    expect(make({ touch: true }).home.x).toBeLessThan(make().home.x);
  });

  it('게임 화면을 지우지 않고 위에 겹쳐 그린다', () => {
    const g = make();
    const r = { autoClear: true, clearDepth: vi.fn(), render: vi.fn(() => expect(r.autoClear).toBe(false)) };
    g.render(r);
    expect(r.clearDepth).toHaveBeenCalled();
    expect(r.render).toHaveBeenCalled();
    expect(r.autoClear).toBe(true);
  });
});

describe('번개 색', () => {
  it('고른 색으로 번개와 빛과 띠를 칠한다', () => {
    const gun = make({ bolt: green });
    gun.setCharged(true);
    expect(gun.arcs[0].glow.material.color.getHex()).toBe(new gun.arcs[0].glow.material.color.constructor(green.glow).getHex());
    expect(gun.halo.material.color.getHex()).toBe(new gun.halo.material.color.constructor(green.halo).getHex());
    expect(gun.stripMat.color.getHex()).toBe(new gun.stripMat.color.constructor(green.strip).getHex());
    expect(gun.lampMat.color.getHex()).toBe(new gun.lampMat.color.constructor(green.lamp).getHex());
  });
});

describe('손 그림', () => {
  const fakeLoader = () => {
    const calls = {};
    return { calls, load: (url, ok, prog, err) => { const t = new THREE.Texture(); calls[url] = { t, ok, err }; return t; } };
  };
  const cold = 'art/horror_hand_cold.webp';
  const live = 'art/horror_hand_live.webp';

  it('두 장을 다 받아야 3D 손과 바꾸고, 충전하면 그림이 바뀐다', () => {
    const loader = fakeLoader();
    const g = make({ loader });
    loader.calls[cold].ok();
    expect(g.model.visible).toBe(true);
    expect(g.art.visible).toBe(false);
    loader.calls[live].ok();
    expect(g.model.visible).toBe(false);
    expect(g.art.visible).toBe(true);
    expect(g.artMat.map).toBe(loader.calls[cold].t);
    g.setCharged(true);
    expect(g.artMat.map).toBe(loader.calls[live].t);
  });

  it('한 장이라도 못 받으면 3D 손을 그대로 쓴다', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = fakeLoader();
    const g = make({ loader });
    const tip = g.tipA.position.clone();
    loader.calls[cold].ok();
    loader.calls[live].err();
    expect(g.model.visible).toBe(true);
    expect(g.art.visible).toBe(false);
    expect(g.tipA.position.equals(tip)).toBe(true);
    spy.mockRestore();
  });

  it('번개는 그림 속 침 끝에서 나간다', () => {
    const loader = fakeLoader();
    const g = make({ loader });
    loader.calls[cold].ok();
    loader.calls[live].ok();
    const { hand } = k;
    const spot = (t) => new THREE.Vector3((t[0] - 0.5) * hand.w, (0.5 - t[1]) * hand.h, 0).applyEuler(g.art.rotation).add(g.art.position);
    expect(g.tipA.position.distanceTo(spot(hand.tips[0]))).toBeLessThan(1e-6);
    expect(g.tipB.position.distanceTo(spot(hand.tips[1]))).toBeLessThan(1e-6);
  });
});

describe('앞면 그림 상자', () => {
  it('앞뒤는 그림 전체, 옆은 비율대로 가운데만 쓴다', () => {
    const uv = faceBox(1, 2, 0.5).getAttribute('uv');
    const us = (first) => Array.from({ length: 4 }, (_, i) => uv.getX(first + i));
    expect(Math.min(...us(16))).toBeCloseTo(0);
    expect(Math.max(...us(16))).toBeCloseTo(1);
    expect(Math.min(...us(0))).toBeCloseTo(0.25);
    expect(Math.max(...us(0))).toBeCloseTo(0.75);
  });
});
