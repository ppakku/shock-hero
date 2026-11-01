// 공포 모드 그림 불러오기. 받기 전이나 못 받았을 때는 부르는 쪽이 지금 모습을 그대로 둔다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 그림을 받을 수 없는 곳(시험)에서는 null 을 돌려준다
export const artLoader = () => (globalThis.document ? new THREE.TextureLoader() : null);

// file: public/art 아래 파일 이름. 받으면 ready(tex)
export function loadArt(loader, file, ready) {
  if (!loader) return null;
  const tex = loader.load(`art/${file}`, () => ready(tex), undefined, () => console.warn('공포 모드 그림을 못 받아 원래 모습으로 둡니다:', file));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 앞뒤에는 그림 전체가, 옆과 위에는 그 면의 비율대로 가운데만 나오는 상자. 재질 하나로 그려서 그리기 횟수가 늘지 않는다
export function faceBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv');
  const squeeze = (first, keepU, keepV) => {
    for (let i = first; i < first + 8; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * keepU, 0.5 + (uv.getY(i) - 0.5) * keepV);
  };
  squeeze(0, Math.min(1, d / w), 1); // 양옆
  squeeze(8, Math.min(1, d / w), Math.min(1, d / h)); // 위아래
  return geo;
}

// 앞뒤에는 그림 전체가, 나머지 면에는 그림 맨 위 band 만큼의 띠가 나오는 크기 1 상자. 책상 상판처럼 위에서 보이는 면이 앞면 그림과 이어진다
export function bandBox(band) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < 16; i++) uv.setY(i, 1 - band + uv.getY(i) * band);
  return geo;
}

// 상판과 다리처럼 떨어진 조각들을 합친 크기 1 모양. 조각마다 그림의 한 구역을 입힌다. 재질 하나로 그려서 그리기 횟수가 늘지 않는다
// parts: [{ x, y, z, u, v }]. 전부 [처음, 끝] 이고 0~1 비율이다. y 와 v 는 아래가 0 이다
export function piecesBox(parts) {
  return mergeGeometries(parts.map(({ x, y, z, u, v }) => {
    const geo = new THREE.BoxGeometry(x[1] - x[0], y[1] - y[0], z[1] - z[0]);
    geo.translate((x[0] + x[1]) / 2 - 0.5, (y[0] + y[1]) / 2 - 0.5, (z[0] + z[1]) / 2 - 0.5);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u[0] + uv.getX(i) * (u[1] - u[0]), v[0] + uv.getY(i) * (v[1] - v[0]));
    return geo;
  }));
}
