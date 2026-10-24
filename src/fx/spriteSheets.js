// art.js 에 { file, cols, rows, frameRate } 로 적은 그림은 스프라이트 시트로 쓴다.
// 불러온 그림을 가로 cols, 세로 rows 칸으로 잘라 0번부터 번호를 붙이고,
// '<키>_anim' 이라는 반복 애니메이션을 만든다.
export function isSheet(entry) {
  return entry && typeof entry === 'object' && entry.file && entry.cols > 0 && entry.rows > 0;
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
    scene.anims.create({
      key: `${key}_anim`,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: total - 1 }),
      frameRate: entry.frameRate || 8,
      repeat: -1,
    });
  }
}
