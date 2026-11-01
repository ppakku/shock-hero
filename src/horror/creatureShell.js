// 입이 진짜로 벌어지는 머리: 윗머리와 아래턱을 따로 짜고, 안쪽은 까만 면으로 막는다. 앞은 +Z 다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bone, clamp, knob, lerp, sampleKeys, surface } from './creatureGeometry.js';

const INNER = 0.95; // 안쪽 면이 겉면보다 작은 비율 (입술 두께)
export const warp = (w) => w * (0.4 + (0.6 * Math.abs(w)) / Math.PI); // 얼굴 앞쪽에 그물을 촘촘히 모은다. 코처럼 가는 굴곡도 살아남는다
const BEND = 0.96; // 이 각도까지는 정면 그림 그대로, 그 뒤로는 옆구리로 곧게 잇는다 (옆에서 봐도 줄무늬로 늘어지지 않게)
const bent = (a) => (a < BEND ? Math.sin(a) : Math.sin(BEND) + Math.cos(BEND) * (a - BEND));
const SIDE = bent(Math.PI / 2);

// 각도 w 를 그림의 가로 자리로 바꾼다. 가운데가 front 몫만큼 앞면, 양쪽 끝이 뒷면이다
export function wrapU(w, front) {
  const a = Math.abs(w);
  const u = a <= Math.PI / 2 ? (front / 2) * bent(a) / SIDE : front / 2 + (0.5 - front / 2) * (1 - bent(Math.PI - a) / SIDE);
  return 0.5 + Math.sign(w) * u;
}

// 머리 그물 만들기.
// keys: [높이, 반폭, 반두께, 앞뒤 치우침] 위에서 아래로. edgeU, edgeL: 각도 w 에서 윗입술과 아랫입술 높이.
// mouthW: 입꼬리 각도. relief(x, y): 코나 눈두덩처럼 앞쪽으로 튀어나온 높이. uv: 그림 좌표를 따로 정할 때. lipShade: 입술 안쪽 밝기.
export function shellHead({ keys, edgeU, edgeL, mouthW, relief = () => 0, skin = () => 1, lipShade = 0.42, rows = 16, segs = 36, uv = (p, t, w) => [w / Math.PI, p.y * 1.1] }) {
  const top = keys[0][0];
  const bottom = keys[keys.length - 1][0];
  const point = (y, w, k, out) => {
    const [hw, hd, cz] = sampleKeys(keys, y);
    const x = Math.sin(w) * hw * k;
    const front = Math.max(0, Math.cos(w));
    return out.set(x, y, Math.cos(w) * hd * k + cz + relief(x, y) * front);
  };
  const shade = (p) => skin(p.x, p.y);
  const upper = (k) => (t, u, out) => {
    const w = warp(u);
    return point(lerp(top, edgeU(w), t), w, k, out);
  };
  const lower = (k) => (t, u, out) => {
    const w = warp(u);
    return point(lerp(edgeL(w), bottom, t), w, k, out);
  };
  const lip = (edge, drop) => (t, u, out) => {
    const w = warp(u);
    return point(edge(w) + drop * Math.sin(t * Math.PI), w, lerp(1, INNER, t), out);
  };
  const inMouth = (t, u) => Math.abs(warp(u)) < mouthW + 0.12;
  const black = () => 0;
  const dark = { uv, shade: black, flip: true, rows: 5, segs: 22 };
  const skull = mergeGeometries([
    surface({ rows, segs, uv, shade, at: upper(1) }),
    surface({ rows: 2, segs, uv, shade: () => lipShade, at: lip(edgeU, 0.01), keep: inMouth }),
    surface({ ...dark, at: upper(INNER) }),
  ]);
  const jaw = mergeGeometries([
    surface({ rows: Math.ceil(rows / 2), segs, uv, shade, at: lower(1) }),
    surface({ rows: 2, segs, uv, shade: () => lipShade, at: lip(edgeL, -0.01), keep: inMouth }),
    surface({ ...dark, at: lower(INNER) }),
  ]);
  // 얼굴 앞면의 깊이: 눈처럼 표면에 붙이는 조각이 쓴다
  const frontZ = (x, y) => {
    const [hw, hd, cz] = sampleKeys(keys, y);
    const c = Math.sqrt(Math.max(0, 1 - (x / hw) ** 2));
    return c * hd + cz + relief(x, y) * c;
  };
  return { skull, jaw, frontZ, point };
}

// 아래턱을 따로 잘라 돌리지 않고 입 둘레만 늘린다. 입꼬리는 그대로라서 볼에 틈이 생기지 않는다.
// mouth: { x: 입꼬리 반폭, y: 입을 가르는 선의 높이, drop: 턱이 내려가는 거리 }
export function jawMorph(g, mouth) {
  const pos = g.attributes.position;
  const d = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const reach = mouth.x + 0.6 * (mouth.y - pos.getY(i)); // 입꼬리는 그대로 두고, 아래로 갈수록 턱 전체가 함께 내려간다
    const open = (1 - clamp(Math.abs(pos.getX(i)) / reach, 0, 1) ** 4) * clamp((pos.getZ(i) + 0.1) / 0.12, 0, 1);
    d[i * 3 + 1] = -mouth.drop * open;
    d[i * 3 + 2] = -0.3 * mouth.drop * open;
  }
  return d;
}

export function morphed(g, delta = new Float32Array(g.attributes.position.count * 3)) {
  g.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)];
  g.morphTargetsRelative = true;
  return g;
}

// 입안을 끝까지 까맣게 막는 덩어리. 벌어진 틈 사이로 뒤가 비치지 않게 한다
export const throat = (r, y, z) => {
  const g = knob(r, 0, y, z);
  g.attributes.color.array.fill(0);
  return g;
};

// 입술을 따라 늘어선 이빨 한 줄. 각도 w 마다 입술 자리(base)에서 sign 쪽(+1 위, -1 아래)으로 뻗는다
export function toothRow({ count, reach, width, base, sign, length, inward = 0.02, wide = 1, tone = 1 }) {
  const parts = [];
  const a = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    const w = lerp(-reach, reach, u);
    base(w, a);
    const len = length(Math.abs(u * 2 - 1));
    const tip = [a.x * (1 - inward), a.y + sign * len, a.z * (1 - inward)];
    const t = bone([a.x, a.y - sign * 0.012, a.z], tip, width, width * 0.12, tone, 6);
    if (wide !== 1) { // 앞니처럼 납작하게
      t.translate(-a.x, 0, -a.z);
      t.scale(wide, 1, 1);
      t.translate(a.x, 0, a.z);
    }
    parts.push(t);
  }
  return parts;
}

// 점을 따라 이어지는 얇은 띠 (옷자락이 찢어진 틈). points 는 [x, y], z 는 표면 깊이
export function strip(points, width, depth) {
  const pos = [];
  const nor = [];
  const tex = [];
  const col = [];
  const idx = [];
  points.forEach(([x, y], i) => {
    const r = width(i / (points.length - 1));
    for (const s of [-1, 1]) {
      const px = x + s * r;
      pos.push(px, y, depth(px, y));
      nor.push(0, 0, 1);
      tex.push(0, 0);
      col.push(0, 0, 0);
    }
    if (i) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(tex, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// 눈처럼 표면에 붙는 타원 조각. r 표(rows)마다 c 밝기를 정한다
export function disc({ rx, ry, depth, rings, uv = () => [0, 0], segs = 16 }) {
  const n = rings.length - 1;
  return surface({
    rows: n,
    segs,
    flip: true, // 가운데에서 바깥으로 도는 면이라 그대로 두면 뒤를 본다
    uv,
    shade: (p, t) => rings[Math.round(t * n)][1],
    at: (t, w, out) => {
      const i = t * n;
      const lo = Math.floor(clamp(i, 0, n - 1));
      const r = lerp(rings[lo][0], rings[lo + 1][0], i - lo);
      const x = Math.sin(w) * rx * r;
      const y = Math.cos(w) * ry * r;
      return out.set(x, y, depth(x, y, r));
    },
  });
}
