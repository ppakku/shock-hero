// 몬스터 공방 작품 그림: 고른 생김새 그림을 복사해 고른 색으로 칠한 새 그림(ws_<생김새>_<색>)을 만든다.
// 걷기 스프라이트 시트면 칸과 걷기 애니메이션도 똑같이 만든다. 색 계산은 src/logic/workshop.js
import { recolorPixels, textureKey } from '../logic/workshop.js';
import { TEXTURE } from '../enemies/Monster.js';

// 그림을 만들고 이름을 돌려준다. 원래 그림이 없으면 같은 움직임의 기본 그림 이름
export function ensureWorkshopTexture(scene, design) {
  const look = scene.textures.exists(design.look) ? design.look : TEXTURE[design.move] || 'monster';
  if (!scene.textures.exists(look)) return look;
  const key = textureKey({ ...design, look });
  const base = scene.textures.get(look);
  const src = base.getSourceImage();
  if (scene.textures.exists(key)) {
    // 원래 그림이 그사이 진짜 그림으로 바뀌었으면(그림 받기 전 임시 도형으로 만들었던 것) 다시 만든다
    if (scene.textures.get(key).customData.from === src) return key;
    scene.anims.remove(`${key}_anim`);
    scene.textures.remove(key);
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    if (design.color !== 'orig') {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      recolorPixels(img.data, design.color);
      ctx.putImageData(img, 0, 0);
    }
    const tex = scene.textures.addCanvas(key, canvas);
    for (const name of base.getFrameNames()) {
      if (name === 'dex') continue; // 도감용 잘라 낸 조각은 다시 만든다
      const f = base.get(name);
      tex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
    }
    tex.customData = { ...base.customData, from: src };
    const anim = scene.anims.get(`${look}_anim`);
    if (anim) {
      scene.anims.create({
        key: `${key}_anim`,
        frames: anim.frames.map((f) => ({ key, frame: f.textureFrame })),
        frameRate: anim.frameRate,
        repeat: anim.repeat,
      });
    }
    return key;
  } catch {
    return look; // 그림을 읽을 수 없으면(드물게 막힌 경우) 원래 그림 그대로
  }
}
