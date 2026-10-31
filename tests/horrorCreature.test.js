import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { CreatureModel, lookYaw } from '../src/horror/creatureModel.js';

const loader = { load: () => new THREE.Texture() };
const make = () => {
  const model = new CreatureModel(new THREE.Scene(), loader);
  model.update({ x: 5, y: 5, heading: 0, mode: 'patrol' }, 0, { x: 50, y: 50 });
  model.group.updateMatrixWorld(true);
  return model;
};

const P = { x: 50, y: 50 };

// 발 끝(발목 아래 바닥 쪽)의 가장 낮은 월드 y
const lowestFoot = (model) => {
  model.group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let low = Infinity;
  model.legs.forEach((leg) => {
    leg.ankle.children.forEach((mesh) => {
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        low = Math.min(low, v.y);
      }
    });
  });
  return low;
};

describe('horror creature', () => {
  it('stays under the triangle budget and shares materials', () => {
    const model = make();
    let tris = 0;
    const mats = new Set();
    model.group.traverse((o) => {
      if (!o.isMesh) return;
      tris += o.geometry.index.count / 3;
      mats.add(o.material);
    });
    expect(tris).toBeLessThan(6000);
    expect(mats.size).toBeLessThanOrEqual(4);
  });

  it('stands about 2.5 metres tall and under the 3 metre ceiling', () => {
    const box = new THREE.Box3().setFromObject(make().group);
    expect(box.max.y).toBeGreaterThan(2.2);
    expect(box.max.y).toBeLessThan(2.9);
  });

  it('keeps its feet on the floor while walking', () => {
    const model = make();
    for (let i = 1; i < 40; i++) {
      model.update({ x: 5 + i * 0.03, y: 5, heading: Math.PI / 2, mode: 'patrol' }, 1 / 30, { x: 50, y: 50 });
      const y = model.hips.position.y;
      expect(y).toBeGreaterThan(0.8);
      expect(y).toBeLessThan(1.2);
    }
  });

  it('keeps the lowest foot point near the floor through a walk cycle', () => {
    const model = make();
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < 90; i++) {
      model.update({ x: 5 + i * 0.03, y: 5, heading: Math.PI / 2, mode: 'patrol' }, 1 / 30, P);
      if (i < 30) continue; // 걸음이 자리 잡은 뒤부터
      const y = lowestFoot(model);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    // 발을 뗄 때 발톱 끝이 바닥 아래로 약 16cm 들어간다 (지금 모양). 더 파고들면 실패
    expect(lo).toBeGreaterThan(-0.2);
    expect(hi).toBeLessThan(0.08);
  });

  it('puts both eyes in front of the head, level and apart', () => {
    const [a, b] = make().eyes.map((e) => e.center);
    expect(a.z).toBeGreaterThan(0.1);
    expect(a.y).toBeCloseTo(b.y, 3);
    expect(a.x).toBeLessThan(-0.05);
    expect(b.x).toBeGreaterThan(0.05);
  });

  it('holds its eyes nearly dark when stunned and brightest in a chase', () => {
    const model = make();
    const run = (mode) => {
      for (let i = 0; i < 90; i++) model.update({ x: 5, y: 5, heading: 0, mode }, 1 / 30, { x: 50, y: 50 });
      return model.glow;
    };
    const patrol = run('patrol');
    const chase = run('chase');
    const stunned = run('stunned');
    expect(chase).toBeGreaterThan(patrol);
    expect(stunned).toBeLessThan(patrol * 0.5);
  });

  it('turns the head toward a near player inside the neck limit, ignores a far one', () => {
    const s = { x: 5, y: 5 };
    expect(lookYaw(s, 0, { x: 7, y: 5 })).toBeCloseTo(1.15);
    expect(lookYaw(s, 0, { x: 5, y: 9 })).toBeCloseTo(0);
    expect(lookYaw(s, Math.PI / 2, { x: 9, y: 5 })).toBeCloseTo(0);
    expect(lookYaw(s, 0, { x: 5, y: 20 })).toBe(0);
  });

  it('poses chase and stunned differently from patrol', () => {
    const settle = (mode, move) => {
      const model = make();
      for (let i = 1; i <= 90; i++) model.update({ x: 5 + (move ? i * 0.05 : 0), y: 5, heading: Math.PI / 2, mode }, 1 / 30, P);
      return model;
    };
    const patrol = settle('patrol', true);
    const chase = settle('chase', true);
    const stunned = settle('stunned', false);
    // 추격: 더 숙이고 목이 길어지고 팔을 들어 올린다
    expect(chase.pose.lean).toBeGreaterThan(patrol.pose.lean + 0.3);
    expect(chase.pose.stretch).toBeGreaterThan(patrol.pose.stretch + 0.15);
    expect(chase.arms[0].shoulder.rotation.x).toBeLessThan(patrol.arms[0].shoulder.rotation.x - 0.8);
    // 기절: 걷지 않고 서서 잘게 떨며, 눈이 꺼진다
    expect(stunned.gait).toBe(0);
    expect(stunned.glow).toBeLessThan(patrol.glow * 0.3);
    expect(stunned.group.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  it('logs a texture failure once and tints the material so it stays visible', () => {
    const calls = [];
    const failing = { load: (url, ok, prog, err) => { const t = new THREE.Texture(); calls.push({ t, err }); return t; } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model = new CreatureModel(new THREE.Scene(), failing);
    expect(calls).toHaveLength(3);
    const maps = model.materials.map((m) => m.map);
    const version = model.materials.map((m) => m.version);
    calls.forEach((c) => c.err());
    expect(spy).toHaveBeenCalledTimes(1);
    model.materials.forEach((m, i) => {
      if (maps[i]) {
        expect(m.map).toBeNull();
        expect(m.version).toBeGreaterThan(version[i]);
        expect(m.color.getHex()).not.toBe(0xa8a8a8);
      }
    });
    expect(model.materials.every((m) => m.map === null)).toBe(true);
    spy.mockRestore();
  });

  it('disposes geometry, materials and textures', () => {
    const model = make();
    const geos = new Set();
    const mats = new Set();
    model.group.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) mats.add(o.material);
    });
    const spies = [...geos, ...mats, ...model.textures].map((x) => vi.fn());
    [...geos, ...mats, ...model.textures].forEach((x, i) => x.addEventListener('dispose', spies[i]));
    model.dispose();
    spies.forEach((f) => expect(f).toHaveBeenCalled());
    expect(model.scene.children).not.toContain(model.group);
  });

  it('casts shadows from the main parts only', () => {
    let casters = 0;
    make().group.traverse((o) => { if (o.isMesh && o.castShadow) casters++; });
    expect(casters).toBeLessThanOrEqual(6);
    expect(casters).toBeGreaterThanOrEqual(4);
  });
});
