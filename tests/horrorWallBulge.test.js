import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WallBulge, bodyShape, pushAt } from '../src/horror/wallBulge.js';
import { parseMap } from '../src/logic/horrorGrid.js';

// 복도 둘 사이의 벽 한 줄 (y = 2)
const map = parseMap([
  '##########',
  '#M.......#',
  '##########',
  '#L.......#',
  '##########',
]);
const make = () => {
  const scene = new THREE.Scene();
  return { scene, bulge: new WallBulge(scene, map, new THREE.MeshBasicMaterial()) };
};
const outward = (mesh) => {
  const a = mesh.geometry.attributes.position.array;
  const base = mesh.userData.base;
  let top = 0;
  for (let i = 0; i < a.length; i++) top = Math.max(top, Math.abs(a[i] - base[i]));
  return top;
};

describe('벽 튀어나옴', () => {
  it('머리와 몸 자리가 가장 많이 튀어나오고 옆은 그대로다', () => {
    expect(bodyShape(0, 2.25)).toBeCloseTo(1, 1);
    expect(bodyShape(0, 1)).toBeGreaterThan(0.5);
    expect(bodyShape(2.5, 1.5)).toBeLessThan(0.01);
  });

  it('표면 근처에서 세고, 깊거나 다 나오면 없다', () => {
    expect(pushAt(0.1)).toBeGreaterThan(0.8);
    expect(pushAt(5)).toBe(0);
    expect(pushAt(-1)).toBe(0);
  });

  it('벽 곁에 없으면 조각을 그리지 않는다', () => {
    const { bulge } = make();
    bulge.update({ x: 5.5, y: 1.5 }, 1 / 30, false);
    expect(bulge.active).toBe(false);
  });

  it('벽 안을 지나면 벽을 민다', () => {
    const { bulge } = make();
    bulge.update({ x: 5.5, y: 2.1 }, 1 / 30, false);
    expect(bulge.active).toBe(true);
    const shown = bulge.meshes.filter((m) => m.visible);
    expect(Math.max(...shown.map(outward))).toBeGreaterThan(0.3);
  });

  it('지나가고 나면 사라진다', () => {
    const { bulge } = make();
    bulge.update({ x: 5.5, y: 2.1 }, 1 / 30, false);
    bulge.update({ x: 5.5, y: 3.5 }, 1 / 30, false);
    expect(bulge.active).toBe(false);
  });

  it('효과 줄이기를 켜면 떨리지 않아도 튀어나온다', () => {
    const { bulge } = make();
    bulge.update({ x: 5.5, y: 2.1 }, 1 / 30, true);
    const m = bulge.meshes.find((x) => x.visible);
    expect(outward(m)).toBeGreaterThan(0.3);
    expect((m.position.x / 1.5) % 1).toBeCloseTo(0, 5);
  });
});
