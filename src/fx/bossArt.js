// 보스 공격을 코드 도형 대신 그림으로 그리는 도우미.
// 공격 코드는 프레임마다 stamp() 를 부르기만 하면 된다. 그림은 다시 쓰고, 이번 프레임에 안 부른 그림은 저절로 숨는다.
// stamp() 가 false 면 그림을 못 받은 것이니 원래 도형을 그린다. 맞는 칸과 시간은 그림과 상관없다.
import Phaser from 'phaser';
import { customArt } from '../config/art.js';

// 그림마다 깊이, 기준점, 더하기 합성(add: 검은 배경 효과 그림)
const LOOKS = {
  fx_shockwave: { depth: 8, origin: [0.5, 0.8], add: true },
  fx_rocket_trail: { depth: 8, origin: [0, 0.5], add: true },
  fx_whirl: { depth: 7.9, origin: [0.5, 0.5], add: true },
  fx_portal: { depth: 2, origin: [0.5, 0.5], add: true },
  fx_frost_cone: { depth: 8, origin: [0.5, 0.02], add: true },
  fx_frost_wall: { depth: 8, origin: [0.5, 1] },
  fx_puddle_poison: { depth: 1, origin: [0.5, 1] },
  fx_puddle_fire: { depth: 1, origin: [0.5, 1] },
  fx_sand_wave: { depth: 8, origin: [0.5, 1] },
  fx_star: { depth: 8, origin: [0.5, 0.5] },
  fx_ink: { depth: 8, origin: [0.5, 0.5] },
  watcher_vine_2: { depth: 7, origin: [0.5, 1] },
  watcher_arm_2: { depth: 6, origin: [0.5, 0.5] },
  watcher_claw_2: { depth: 6.1, origin: [0.9, 0.5] },
  dragon_tail_3: { depth: 3.5, origin: [0.5, 0.5] },
  dragon_tailtip_3: { depth: 3.6, origin: [0.5, 0.5] },
};

// 변종 팔다리는 이름 끝(skin)만 달라서 원래 그림과 같은 자리에 놓는다
const LIMB_LOOKS = {
  watcher_arm_: LOOKS.watcher_arm_2,
  watcher_claw_: LOOKS.watcher_claw_2,
  dragon_tail_: LOOKS.dragon_tail_3,
  dragon_tailtip_: LOOKS.dragon_tailtip_3,
};

export function lookOf(key) {
  return LOOKS[key] || LIMB_LOOKS[key.slice(0, key.lastIndexOf('_') + 1)] || {};
}

const pools = new WeakMap(); // 장면마다 { 그림 이름: { list, used } }

// 진짜 그림을 받았는지. 임시 도형도 같은 이름으로 있을 수 있어서 이름만으로는 모른다
export function hasArt(scene, key) {
  if (!customArt[key] || !scene.textures.exists(key)) return false;
  return !(scene.textures.get(key).getSourceImage() instanceof HTMLCanvasElement);
}

function poolsOf(scene) {
  let map = pools.get(scene);
  if (map) return map;
  map = new Map();
  pools.set(scene, map);
  const sweep = () => {
    if (scene.impact?.stopLeft > 0) return; // 멈칫 중에는 공격 코드가 안 돌아서 그대로 둔다
    for (const p of map.values()) {
      for (let i = p.used; i < p.list.length; i++) p.list[i].setVisible(false);
      p.used = 0;
    }
  };
  scene.events.on('postupdate', sweep);
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', sweep);
    pools.delete(scene);
  });
  return map;
}

function makeSprite(scene, key) {
  const look = lookOf(key);
  const s = scene.add.sprite(0, 0, key).setDepth(look.depth ?? 8);
  if (look.origin) s.setOrigin(look.origin[0], look.origin[1]);
  if (look.add) s.setBlendMode(Phaser.BlendModes.ADD);
  if (scene.anims.exists(`${key}_anim`)) s.play(`${key}_anim`);
  return s;
}

// 그림 하나를 이번 프레임에 놓는다. o: rotation, flipX, flipY, alpha, tintFill
export function stamp(scene, key, x, y, w, h, o = {}) {
  if (!hasArt(scene, key)) return false;
  const map = poolsOf(scene);
  if (!map.has(key)) map.set(key, { list: [], used: 0 });
  const p = map.get(key);
  if (p.used >= p.list.length) p.list.push(makeSprite(scene, key));
  const s = p.list[p.used];
  p.used += 1;
  s.setVisible(true).setPosition(x, y).setDisplaySize(w, h).setRotation(o.rotation || 0);
  s.setFlipX(Boolean(o.flipX)).setFlipY(Boolean(o.flipY)).setAlpha(o.alpha ?? 1);
  if (o.tintFill !== undefined) s.setTintFill(o.tintFill);
  else s.clearTint();
  return true;
}

// 두 점 사이를 잇는 그림 (팔, 꼬리). 그림은 가로로 길고 왼쪽 끝이 바깥쪽(from 이 안쪽, to 가 바깥쪽)
// o.overlap: 앞 토막과 겹치게 from 쪽으로 더 늘릴 길이 (꺾이는 곳에 틈이 안 보이게)
export function stampLimb(scene, key, from, to, thick, o = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const back = o.overlap || 0;
  const cx = (from.x + to.x) / 2 - ((dx / len) * back) / 2;
  const cy = (from.y + to.y) / 2 - ((dy / len) * back) / 2;
  return stamp(scene, key, cx, cy, len + back, thick, { ...o, rotation: Math.atan2(dy, dx) + Math.PI, flipY: dx > 0 });
}

// 땅을 달리는 충격파 한 개. 그림이 공격 높이(h)만큼 솟게 칸 크기를 맞춘다
export function stampWave(scene, x, groundY, h = 44) {
  return stamp(scene, 'fx_shockwave', x, groundY, h * 1.6, h * 1.6);
}
