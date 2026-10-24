import { make } from './textures.js';

// 주인공 그림 (customArt 로 그림을 넣으면 그쪽이 우선이다)
export function makeHeroTextures(scene) {
  // 주인공: 파란 슈트, 하얀 바이저, 노란 번개 문양
  make(scene, 'player', 40, 60, (g) => {
    g.fillStyle(0x1e6fff).fillRoundedRect(4, 16, 32, 42, 8);
    g.fillStyle(0x1e6fff).fillRoundedRect(8, 0, 24, 20, 9);
    g.fillStyle(0xe8fbff).fillRoundedRect(14, 7, 18, 6, 3);
    g.fillStyle(0x0f3d99).fillRect(4, 42, 32, 4);
    g.fillStyle(0xffd23f).fillPoints(
      [
        { x: 22, y: 20 }, { x: 14, y: 31 }, { x: 20, y: 31 },
        { x: 16, y: 40 }, { x: 27, y: 27 }, { x: 21, y: 27 },
      ],
      true,
    );
    g.fillStyle(0xff4d4d).fillRoundedRect(30, 26, 9, 9, 3); // 빨간 주먹 장갑
  });
}
