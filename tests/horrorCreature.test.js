import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CreatureModel, lookYaw } from '../src/horror/creatureModel.js';

const loader = { load: () => new THREE.Texture() };
const make = () => {
  const model = new CreatureModel(new THREE.Scene(), loader);
  model.update({ x: 5, y: 5, heading: 0, mode: 'patrol' }, 0, { x: 50, y: 50 });
  model.group.updateMatrixWorld(true);
  return model;
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

  it('puts both eyes in front of the head, level and apart', () => {
    const [a, b] = make().eyes;
    expect(a.position.z).toBeGreaterThan(0.1);
    expect(a.position.y).toBeCloseTo(b.position.y, 3);
    expect(a.position.x).toBeLessThan(-0.05);
    expect(b.position.x).toBeGreaterThan(0.05);
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
});
