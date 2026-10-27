// 도감과 보스 러시 화면의 작은 그림. 첫 장에서 빈 가장자리를 잘라 낸 조각('dex' 프레임)을 한 번 만들어 둔다 (보스 그림은 여백이 커서)
export function trimmedFrame(scene, key) {
  const tex = scene.textures.get(key);
  if (tex.has('dex')) return 'dex';
  const base = tex.has(0) ? tex.get(0) : tex.get();
  try {
    const c = document.createElement('canvas');
    c.width = base.cutWidth;
    c.height = base.cutHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(base.source.image, base.cutX, base.cutY, base.cutWidth, base.cutHeight, 0, 0, base.cutWidth, base.cutHeight);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (px[(y * c.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return base.name;
    tex.add('dex', base.sourceIndex, base.cutX + x0, base.cutY + y0, x1 - x0 + 1, y1 - y0 + 1);
    return 'dex';
  } catch {
    return base.name;
  }
}

// 그림 한 장을 w x h 안에 맞추기 (스프라이트 시트면 첫 칸). trim 이면 여백을 잘라 낸 조각으로. 그림이 없으면 false
export function fitPortrait(scene, img, key, w, h, trim = false) {
  if (!key || !scene.textures.exists(key)) return false;
  const tex = scene.textures.get(key);
  img.setTexture(key, trim ? trimmedFrame(scene, key) : tex.has(0) ? 0 : undefined);
  img.setScale(Math.min(w / img.frame.width, h / img.frame.height));
  // 왼쪽을 보는 그림(아스트라노바X)은 오른쪽을 보게
  img.setFlipX(key.startsWith('dragon_'));
  return true;
}
