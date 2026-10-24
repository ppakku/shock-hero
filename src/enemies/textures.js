import { make } from '../fx/textures.js';

// 일반 몬스터 그림
export function makeMonsterTextures(scene) {
  // 초록 몬스터
  make(scene, 'monster', 52, 48, (g) => {
    g.fillStyle(0x4caf2f).fillEllipse(26, 28, 50, 40);
    g.fillStyle(0x6fd34a).fillEllipse(22, 22, 30, 18);
    g.fillStyle(0x2e7d1b).fillCircle(12, 34, 4).fillCircle(20, 40, 3);
    g.fillStyle(0xffffff).fillCircle(32, 18, 7).fillCircle(44, 20, 5);
    g.fillStyle(0x111111).fillCircle(34, 18, 3).fillCircle(45, 20, 2);
    g.fillStyle(0xffffff);
    for (let i = 0; i < 4; i++) g.fillTriangle(30 + i * 5, 34, 35 + i * 5, 34, 32.5 + i * 5, 40);
  });

  // 빨강 날쌘돌이 (날렵한 몸, 뿔)
  make(scene, 'monster_fast', 52, 48, (g) => {
    g.fillStyle(0xd8322a).fillTriangle(14, 14, 20, 0, 26, 14).fillTriangle(28, 12, 36, 0, 38, 14);
    g.fillStyle(0xd8322a).fillEllipse(26, 30, 46, 32);
    g.fillStyle(0xff6a4d).fillEllipse(22, 24, 26, 14);
    g.fillStyle(0xffffff).fillCircle(34, 24, 6).fillCircle(45, 25, 4);
    g.fillStyle(0x111111).fillCircle(36, 24, 3).fillCircle(46, 25, 2);
    g.lineStyle(3, 0x7a1010).lineBetween(28, 18, 40, 21);
    g.fillStyle(0xffffff);
    for (let i = 0; i < 3; i++) g.fillTriangle(32 + i * 5, 36, 37 + i * 5, 36, 34.5 + i * 5, 41);
  });

  // 파랑 뚱보 (크고 둥근 몸, 갑옷 무늬)
  make(scene, 'monster_tank', 52, 48, (g) => {
    g.fillStyle(0x2f5fb8).fillEllipse(26, 27, 52, 42);
    g.fillStyle(0x4f86e0).fillEllipse(20, 20, 30, 16);
    g.fillStyle(0x1d3f80).fillRect(6, 30, 40, 5);
    g.fillStyle(0xffffff).fillCircle(34, 18, 5).fillCircle(44, 19, 4);
    g.fillStyle(0x111111).fillCircle(35, 18, 2.5).fillCircle(45, 19, 2);
    g.fillStyle(0xffffff).fillRect(30, 38, 4, 5).fillRect(40, 38, 4, 5);
  });

  // 보라 뜀뛰기 (긴 다리)
  make(scene, 'monster_jumper', 52, 48, (g) => {
    g.lineStyle(5, 0x5a2590).lineBetween(16, 34, 8, 47).lineBetween(34, 34, 44, 47);
    g.fillStyle(0x9a4fe0).fillEllipse(26, 22, 44, 32);
    g.fillStyle(0xc08aff).fillEllipse(20, 16, 24, 12);
    g.fillStyle(0xffffff).fillCircle(32, 16, 7);
    g.fillStyle(0x111111).fillCircle(34, 16, 3.5);
    g.fillStyle(0xffffff);
    for (let i = 0; i < 3; i++) g.fillTriangle(30 + i * 5, 28, 35 + i * 5, 28, 32.5 + i * 5, 33);
  });
}
