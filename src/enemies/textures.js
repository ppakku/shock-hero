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

  // 노랑 폭탄벌레 (날개, 줄무늬, 배 밑의 폭탄 구멍)
  make(scene, 'monster_bomber', 52, 48, (g) => {
    g.fillStyle(0xcff4ff, 0.75).fillEllipse(16, 10, 26, 16).fillEllipse(32, 8, 24, 14);
    g.lineStyle(2, 0x7fb8d8, 0.9).strokeEllipse(16, 10, 26, 16).strokeEllipse(32, 8, 24, 14);
    g.fillStyle(0xf2c21b).fillEllipse(24, 28, 42, 28);
    g.fillStyle(0x2a2a2a).fillRect(12, 16, 5, 24).fillRect(22, 14, 5, 28);
    g.fillStyle(0xffe066).fillEllipse(38, 26, 22, 22);
    g.fillStyle(0xffffff).fillCircle(42, 22, 6);
    g.fillStyle(0x111111).fillCircle(44, 22, 3);
    g.lineStyle(2, 0x2a2a2a).lineBetween(40, 15, 46, 4).lineBetween(44, 16, 51, 8);
    g.fillStyle(0x2a2a2a).fillCircle(24, 42, 5);
    g.fillStyle(0xff5a2a).fillCircle(24, 42, 2.5);
    g.fillStyle(0x2a2a2a).fillTriangle(2, 26, 8, 22, 8, 32);
  });

  // 폭탄벌레가 떨어뜨리는 폭탄
  make(scene, 'monster_bomb', 22, 26, (g) => {
    g.fillStyle(0x222222).fillCircle(11, 15, 10);
    g.fillStyle(0x555555).fillCircle(8, 12, 3);
    g.lineStyle(2, 0x8b5a2b).lineBetween(11, 5, 15, 1);
    g.fillStyle(0xffd23f).fillCircle(16, 2, 2.5);
  });

  // 청록 침뱉기 (부푼 볼, 앞으로 내민 입술)
  make(scene, 'monster_spitter', 52, 48, (g) => {
    g.fillStyle(0x1f9e8f).fillEllipse(24, 30, 44, 34);
    g.fillStyle(0x47cbb9).fillEllipse(18, 24, 24, 14);
    g.fillStyle(0x8ae35a, 0.9).fillCircle(34, 36, 8);
    g.fillStyle(0xff8a5a).fillEllipse(46, 30, 12, 14);
    g.fillStyle(0x6b1f1f).fillEllipse(48, 30, 5, 7);
    g.fillStyle(0xffffff).fillCircle(26, 14, 7).fillCircle(38, 16, 6);
    g.fillStyle(0x111111).fillCircle(28, 14, 3).fillCircle(40, 16, 3);
    g.fillStyle(0x157267).fillCircle(12, 36, 3).fillCircle(20, 42, 2.5);
  });

  // 침뱉기가 뱉는 침 (오른쪽으로 날아가는 모양)
  make(scene, 'monster_spit', 26, 18, (g) => {
    g.fillStyle(0x7dff4a, 0.5).fillEllipse(8, 9, 14, 8);
    g.fillStyle(0x5ad12a).fillEllipse(16, 9, 18, 14);
    g.fillStyle(0xc8ff9a).fillEllipse(19, 6, 6, 4);
  });

  // 회색 방패병 (투구, 앞쪽의 큰 방패)
  const shieldBody = (g, angry) => {
    g.fillStyle(0x6b6f7a).fillEllipse(22, 30, 38, 34);
    g.fillStyle(0x8c919d).fillEllipse(18, 24, 20, 12);
    g.fillStyle(0x4a4e57).fillEllipse(22, 14, 32, 16);
    g.fillStyle(0x4a4e57).fillTriangle(14, 8, 22, 0, 30, 8);
    g.fillStyle(0xffffff).fillCircle(30, 22, 5);
    g.fillStyle(0x111111).fillCircle(31, 22, 2.5);
    g.lineStyle(3, 0x2a2a2a).lineBetween(24, 15, 35, angry ? 19 : 17);
    g.fillStyle(0x3b3e45).fillRect(10, 44, 8, 4).fillRect(26, 44, 8, 4);
  };
  make(scene, 'monster_shield', 52, 48, (g) => {
    shieldBody(g, true);
    g.fillStyle(0x3d6fb0).fillRoundedRect(36, 4, 15, 42, 5);
    g.fillStyle(0x6fa0e0).fillRoundedRect(38, 6, 5, 38, 2);
    g.fillStyle(0xffd23f).fillRect(42, 14, 4, 22).fillRect(38, 22, 12, 4);
    g.fillStyle(0xdde6f0).fillCircle(39, 8, 1.5).fillCircle(48, 8, 1.5).fillCircle(39, 42, 1.5).fillCircle(48, 42, 1.5);
  });
  // 방패가 깨진 방패병 (방패 없이 놀란 얼굴, 땀방울)
  make(scene, 'monster_shield_broken', 52, 48, (g) => {
    shieldBody(g, false);
    g.fillStyle(0x7fd0ff).fillTriangle(40, 4, 37, 12, 43, 12).fillCircle(40, 12, 3);
    g.fillStyle(0x3d6fb0).fillRect(38, 30, 6, 10);
  });
  // 날아가는 방패 조각
  make(scene, 'monster_shield_piece', 16, 40, (g) => {
    g.fillStyle(0x3d6fb0).fillRoundedRect(0, 0, 15, 40, 5);
    g.fillStyle(0xffd23f).fillRect(6, 10, 4, 20);
  });
}
