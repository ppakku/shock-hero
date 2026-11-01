import { existsSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { CreatureModel, createCreature, lookYaw } from '../src/horror/creatureModel.js';
import { GazerModel } from '../src/horror/creatureGazer.js';
import { MawModel } from '../src/horror/creatureMaw.js';
import { WardModel } from '../src/horror/creatureWard.js';

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
    // 기절은 걷다가 맞은 상황으로 본다: 먼저 걷게 한 뒤 같은 자리에서 멈춘다
    const stunned = settle('patrol', true);
    expect(stunned.gait).toBeGreaterThan(0.9);
    const walkingPhase = stunned.phase;
    const at = { x: 5 + 90 * 0.05, y: 5, heading: Math.PI / 2, mode: 'stunned' };
    for (let i = 0; i < 90; i++) stunned.update(at, 1 / 30, P);
    const frozen = stunned.phase;
    for (let i = 0; i < 10; i++) stunned.update(at, 1 / 30, P);
    expect(stunned.phase).toBeCloseTo(frozen, 5);
    expect(walkingPhase).toBeGreaterThan(0.1); // 걷는 동안 걸음이 돌았다
    expect(frozen).toBeCloseTo(walkingPhase, 3); // 맞은 뒤로는 더 돌지 않는다
    // 추격: 더 숙이고 목이 길어지고 팔을 들어 올린다
    expect(chase.pose.lean).toBeGreaterThan(patrol.pose.lean + 0.3);
    expect(chase.pose.stretch).toBeGreaterThan(patrol.pose.stretch + 0.15);
    expect(chase.arms[0].shoulder.rotation.x).toBeLessThan(patrol.arms[0].shoulder.rotation.x - 0.8);
    // 기절: 맞은 자세로 굳어 잘게 떨며(걸음 위상은 위에서 멈춤을 확인했다), 눈이 꺼진다
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

describe('createCreature', () => {
  const build = (id) => createCreature(id, new THREE.Scene(), loader);
  const stand = (model, mode = 'patrol', frames = 1) => {
    for (let i = 0; i < frames; i++) model.update({ x: 5, y: 5, heading: 0, mode }, 1 / 30, P);
    model.group.updateMatrixWorld(true);
    return model;
  };
  // 그림자까지 넣은 그리기 호출 수
  const calls = (model) => {
    let n = 0;
    model.group.traverse((o) => { if (o.isMesh) n += o.castShadow ? 2 : 1; });
    return n;
  };
  const tris = (model) => {
    let n = 0;
    model.group.traverse((o) => { if (o.isMesh) n += o.geometry.index.count / 3; });
    return n;
  };

  it('picks the model by id and keeps seino as the default', () => {
    expect(build('seino')).toBeInstanceOf(CreatureModel);
    expect(build('nobody')).toBeInstanceOf(CreatureModel);
    expect(build('gazer')).toBeInstanceOf(GazerModel);
    expect(build('maw')).toBeInstanceOf(MawModel);
    expect(build('ward')).toBeInstanceOf(WardModel);
  });

  it.each(['gazer', 'maw', 'ward'])('%s keeps the same interface and stays cheap', (id) => {
    const model = stand(build(id));
    for (const key of ['group', 'head', 'textures', 'yaw', 'glow', 'headHeight']) expect(model[key]).toBeDefined();
    expect(calls(model)).toBeLessThanOrEqual(12);
    expect(tris(model)).toBeLessThan(8000);
    const box = new THREE.Box3().setFromObject(model.group);
    expect(box.max.y).toBeGreaterThan(2.4);
    expect(box.max.y).toBeLessThan(2.95);
    expect(() => stand(model, 'some-new-mode', 5)).not.toThrow();
  });

  it.each(['gazer', 'maw', 'ward'])('%s only asks for pictures that exist', (id) => {
    const urls = [];
    createCreature(id, new THREE.Scene(), { load: (url) => { urls.push(url); return new THREE.Texture(); } });
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(existsSync(`public/${url}`), url).toBe(true);
  });

  it.each(['gazer', 'maw', 'ward'])('%s stays visible when its pictures fail and does not block the warm-up', (id) => {
    const fails = [];
    const failing = { load: (url, ok, prog, err) => { fails.push(err); return new THREE.Texture(); } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model = createCreature(id, new THREE.Scene(), failing);
    expect(fails.length).toBeGreaterThan(0);
    fails.forEach((f) => f());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(model.textures).toHaveLength(0);
    expect(model.materials.every((m) => m.map === null)).toBe(true);
    spy.mockRestore();
  });

  it.each(['gazer', 'maw', 'ward'])('%s disposes everything it made', (id) => {
    const model = stand(build(id));
    const items = [...model.materials, ...model.owned];
    model.group.traverse((o) => { if (o.geometry) items.push(o.geometry); });
    const spies = items.map((x) => {
      const f = vi.fn();
      x.addEventListener('dispose', f);
      return f;
    });
    model.dispose();
    spies.forEach((f) => expect(f).toHaveBeenCalled());
    expect(model.scene.children).not.toContain(model.group);
  });

  it('ward leans in, lifts its arms and opens its mouth in a chase', () => {
    const calm = stand(build('ward'), 'patrol', 60);
    const chase = stand(build('ward'), 'chase', 60);
    expect(chase.root.rotation.x).toBeGreaterThanOrEqual(calm.root.rotation.x);
    expect(chase.jaw.rotation.x).toBeGreaterThan(calm.jaw.rotation.x);
    expect(chase.arms[0].shoulder.rotation.x).toBeLessThan(calm.arms[0].shoulder.rotation.x);
  });

  it('gazer holds still while frozen, only the pupils follow the player', () => {
    const model = stand(build('gazer'), 'patrol', 40);
    const snap = () => [
      model.root.rotation.x, model.root.rotation.z, model.root.position.y, model.neck.rotation.z, model.mouth,
      model.head.rotation.x, model.head.rotation.y, model.yaw, ...model.bodyMesh.geometry.attributes.position.array.slice(-60),
    ];
    const s = { x: 5, y: 5, heading: 0.7, mode: 'watch' };
    model.update(s, 1 / 30, { x: 5, y: 8 });
    const held = snap();
    const eyeA = model.pupils[0].mesh.position.x;
    for (let i = 0; i < 40; i++) model.update(s, 1 / 30, { x: 7, y: 8 });
    expect(snap()).toEqual(held);
    expect(model.pupils[0].mesh.position.x).not.toBe(eyeA);
  });

  it('gazer opens its mouth wider in a chase and dims when stunned', () => {
    const rest = vi.spyOn(Math, 'random').mockReturnValue(0);
    const patrol = stand(build('gazer'), 'patrol', 90);
    const chase = stand(build('gazer'), 'chase', 90);
    expect(chase.mouth).toBeGreaterThan(patrol.mouth + 0.1);
    expect(chase.root.rotation.x).toBeGreaterThan(patrol.root.rotation.x);
    expect(stand(build('gazer'), 'stunned', 90).glow).toBeLessThan(patrol.glow * 0.5);
    rest.mockRestore();
  });

  it('gazer opens the painted mouth without moving the skull or the mouth corners', () => {
    const model = build('gazer');
    const g = model.face.geometry;
    const pos = g.attributes.position;
    const move = g.morphAttributes.position[0];
    expect(g.morphTargetsRelative).toBe(true);
    let drop = 0;
    for (let i = 0; i < pos.count; i++) {
      drop = Math.max(drop, -move.getY(i));
      if (pos.getY(i) > 0.3) expect(move.getY(i)).toBe(0);
    }
    expect(drop).toBeGreaterThan(0.05);
  });

  it('gazer puts two ringed eyes on the front of the head', () => {
    const [a, b] = stand(build('gazer')).eyes.map((e) => e.center);
    expect(a.z).toBeGreaterThan(0.1);
    expect(a.x).toBeCloseTo(-b.x, 1);
  });

  it('maw has no eyes and never looks at the player', () => {
    const rest = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const a = build('maw');
    const b = build('maw');
    expect(a.eyes).toBeUndefined();
    for (let i = 0; i < 60; i++) {
      a.update({ x: 5, y: 5, heading: 0, mode: 'patrol' }, 1 / 30, { x: 6, y: 5 });
      b.update({ x: 5, y: 5, heading: 0, mode: 'patrol' }, 1 / 30, { x: 2, y: 9 });
    }
    expect(a.head.rotation.y).toBeCloseTo(b.head.rotation.y, 6);
    rest.mockRestore();
  });

  it('maw rushes low with its mouth wide and searches with its head swinging', () => {
    const rest = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const walk = stand(build('maw'), 'patrol', 90);
    const rush = stand(build('maw'), 'chase', 90);
    expect(rush.spine.rotation.x).toBeGreaterThan(walk.spine.rotation.x + 0.3);
    expect(rush.jaw.rotation.x).toBeGreaterThan(walk.jaw.rotation.x + 0.1);
    expect(rush.arms[0].shoulder.rotation.x).toBeLessThan(walk.arms[0].shoulder.rotation.x - 0.8);
    const sniff = build('maw');
    let swing = 0;
    for (let i = 0; i < 120; i++) {
      stand(sniff, 'search');
      if (i > 60) swing = Math.max(swing, Math.abs(sniff.head.rotation.y));
    }
    expect(swing).toBeGreaterThan(0.45);
    rest.mockRestore();
  });

  it('maw stops to sniff while pauseT runs, whatever its mode', () => {
    const rest = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const model = build('maw');
    for (let i = 0; i < 90; i++) model.update({ x: 5, y: 5, heading: 0, mode: 'patrol', pauseT: 1 }, 1 / 30, P);
    expect(model.pose.lean).toBeGreaterThan(0.35);
    rest.mockRestore();
  });

  it('maw keeps its arms held out to the sides and feet near the floor while walking', () => {
    const model = build('maw');
    const hand = new THREE.Vector3();
    for (let i = 1; i < 90; i++) {
      model.update({ x: 5 + i * 0.03, y: 5, heading: Math.PI / 2, mode: 'patrol' }, 1 / 30, P);
      if (i < 30) continue;
      expect(model.hips.position.y).toBeGreaterThan(0.95);
      expect(model.hips.position.y).toBeLessThan(1.3);
    }
    model.update({ x: 5, y: 5, heading: 0, mode: 'patrol' }, 1 / 30, P);
    model.group.position.set(0, 0, 0);
    model.group.rotation.set(0, 0, 0);
    model.group.updateMatrixWorld(true);
    model.arms[1].fingers.getWorldPosition(hand);
    expect(hand.x).toBeGreaterThan(0.5);
    expect(hand.y).toBeGreaterThan(1);
  });

  it('every skinned point follows a real bone', () => {
    const model = stand(build('maw'));
    const bones = model.skeleton.bones.length;
    for (const m of [model.skin, model.teeth]) {
      const index = m.geometry.attributes.skinIndex;
      for (let i = 0; i < index.count; i++) expect(index.getX(i)).toBeLessThan(bones);
    }
  });
});
