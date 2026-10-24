// 아직 그림이 없을 때 쓰는 임시 도형 그림. customArt 로 그림을 넣으면 그쪽이 우선이다.

export function make(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeTextures(scene) {
  make(scene, 'boss_armor', 80, 80, (g) => {
    g.fillStyle(0x8a8f99).fillRoundedRect(0, 0, 80, 80, 14);
    g.fillStyle(0xb5bac4).fillRoundedRect(8, 8, 64, 20, 8);
    g.fillStyle(0x5d626b).fillCircle(12, 12, 4).fillCircle(68, 12, 4).fillCircle(12, 68, 4).fillCircle(68, 68, 4);
  });

  make(scene, 'boss_core', 56, 56, (g) => {
    g.fillStyle(0xff9a1f).fillCircle(28, 28, 28);
    g.fillStyle(0xffd23f).fillCircle(28, 28, 20);
    g.fillStyle(0xfffbe0).fillCircle(28, 28, 10);
  });

  // 로봇 조수 볼트
  make(scene, 'robot', 30, 34, (g) => {
    g.lineStyle(3, 0xbfc7d5).lineBetween(15, 2, 15, 8);
    g.fillStyle(0xff4d4d).fillCircle(15, 3, 3);
    g.fillStyle(0xf2f5fa).fillCircle(15, 20, 13);
    g.fillStyle(0x223047).fillRoundedRect(5, 15, 20, 9, 4);
    g.fillStyle(0x3ff0ff).fillCircle(11, 19, 2.5).fillCircle(19, 19, 2.5);
  });

  make(scene, 'ground', 64, 64, (g) => {
    g.fillStyle(0x3b3a46).fillRect(0, 0, 64, 64);
    g.fillStyle(0x55545f).fillRect(0, 0, 64, 8);
    g.fillStyle(0xe0c040).fillRect(8, 30, 20, 4);
    g.lineStyle(2, 0x2a2933).lineBetween(40, 10, 48, 26).lineBetween(48, 26, 44, 40);
  });

  make(scene, 'platform', 64, 20, (g) => {
    g.fillStyle(0xb5651d).fillRect(0, 0, 64, 20);
    g.fillStyle(0xd98232).fillRect(0, 0, 64, 5);
    g.fillStyle(0x7a3f0f).fillCircle(12, 12, 3).fillCircle(32, 12, 3).fillCircle(52, 12, 3);
  });

  make(scene, 'flag', 44, 90, (g) => {
    g.fillStyle(0xcccccc).fillRect(4, 0, 5, 90);
    g.fillStyle(0x8a8f99).fillTriangle(9, 4, 42, 16, 9, 30);
  });
  make(scene, 'flag_on', 44, 90, (g) => {
    g.fillStyle(0xcccccc).fillRect(4, 0, 5, 90);
    g.fillStyle(0x3ff07a).fillTriangle(9, 4, 42, 16, 9, 30);
  });

  make(scene, 'chest', 44, 34, (g) => {
    g.fillStyle(0x8b5a2b).fillRoundedRect(0, 8, 44, 26, 4);
    g.fillStyle(0xa86d36).fillRoundedRect(0, 0, 44, 14, 6);
    g.fillStyle(0xffd23f).fillRect(0, 12, 44, 4).fillRect(18, 10, 8, 10);
  });
  make(scene, 'chest_open', 44, 34, (g) => {
    g.fillStyle(0x8b5a2b).fillRoundedRect(0, 12, 44, 22, 4);
    g.fillStyle(0xffd23f).fillCircle(14, 14, 5).fillCircle(24, 11, 5).fillCircle(32, 15, 4);
    g.fillStyle(0xa86d36).fillRoundedRect(2, 0, 40, 8, 4);
  });

  make(scene, 'rock', 44, 40, (g) => {
    g.fillStyle(0x7d7468).fillPoints(
      [{ x: 6, y: 10 }, { x: 22, y: 0 }, { x: 40, y: 8 }, { x: 44, y: 28 }, { x: 28, y: 40 }, { x: 4, y: 32 }],
      true,
    );
    g.fillStyle(0x9a9083).fillCircle(18, 14, 6);
  });

  make(scene, 'heart', 24, 22, (g) => {
    g.fillStyle(0xff3a5a).fillCircle(7, 7, 7).fillCircle(17, 7, 7).fillTriangle(0, 9, 24, 9, 12, 22);
    g.fillStyle(0xffb0c0).fillCircle(6, 5, 2.5);
  });

  make(scene, 'glob', 24, 24, (g) => {
    g.fillStyle(0x7dff4a).fillCircle(12, 12, 12);
    g.fillStyle(0xd8ffb0).fillCircle(8, 8, 4);
  });

  make(scene, 'spark', 10, 10, (g) => g.fillStyle(0xffffff).fillCircle(5, 5, 5));
  make(scene, 'puff', 20, 20, (g) => g.fillStyle(0xffffff).fillCircle(10, 10, 10));
}
