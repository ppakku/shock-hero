// art.js 에 { file, cols, rows, frameRate } 로 적은 그림은 스프라이트 시트로 쓴다.
// 불러온 그림을 가로 cols, 세로 rows 칸으로 잘라 0번부터 번호를 붙이고,
// '<키>_anim' 이라는 반복 애니메이션을 만든다.
// 그림이 오른쪽을 보고 있으면 faces: 'right' 를 적는다 (기본은 왼쪽). 한 번만 재생하려면 once: true.
export function isSheet(entry) {
  return entry && typeof entry === 'object' && entry.file && entry.cols > 0 && entry.rows > 0;
}

// 스프라이트 시트 그림이 오른쪽을 보고 있는지
export function sheetFacesRight(scene, key) {
  return Boolean(scene.textures.exists(key) && scene.textures.get(key).customData.facesRight);
}

export function artFile(entry) {
  return typeof entry === 'string' ? entry : entry?.file;
}

export function registerSheets(scene, customArt) {
  for (const [key, entry] of Object.entries(customArt)) {
    if (!isSheet(entry) || !scene.textures.exists(key)) continue;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage();
    const fw = Math.floor(src.width / entry.cols);
    const fh = Math.floor(src.height / entry.rows);
    const total = entry.frames || entry.cols * entry.rows;
    for (let i = 0; i < total; i++) {
      const col = i % entry.cols;
      const row = Math.floor(i / entry.cols);
      tex.add(i, 0, col * fw, row * fh, fw, fh);
    }
    tex.customData.facesRight = entry.faces === 'right';
    scene.anims.create({
      key: `${key}_anim`,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: total - 1 }),
      frameRate: entry.frameRate || 8,
      repeat: entry.once ? 0 : -1, // once: true 면 한 번만 재생 (폭발처럼)
    });
  }
}
