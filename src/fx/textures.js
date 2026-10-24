// 아직 그림이 없을 때 쓰는 임시 도형 그림. customArt 로 그림을 넣으면 그쪽이 우선이다.

function make(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeTextures(scene, stages = []) {
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

  // 스테이지마다 색이 다른 보스
  for (let i = 0; i < stages.length; i++) makeBossTextures(scene, i + 1, stages[i].boss);

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

function makeBossTextures(scene, skin, boss) {
  const c = boss.colors;
  // 보스 몸통 (왼쪽을 보는 모습)
  make(scene, `boss_body_${skin}`, 220, 280, (g) => {
    g.fillStyle(c.main).fillRoundedRect(10, 20, 200, 260, 60);
    g.fillStyle(c.light).fillRoundedRect(30, 120, 140, 150, 40);
    g.fillStyle(c.dark).fillCircle(170, 90, 10).fillCircle(150, 230, 8).fillCircle(190, 200, 6);
    g.fillStyle(0xfff04d).fillEllipse(55, 75, 40, 30).fillEllipse(110, 70, 34, 26);
    g.fillStyle(0xd40000).fillCircle(48, 76, 8).fillCircle(103, 71, 7);
    g.fillStyle(0x2a0e25).fillRoundedRect(30, 110, 100, 34, 14);
    g.fillStyle(0xffffff);
    for (let i = 0; i < 6; i++) g.fillTriangle(34 + i * 16, 110, 46 + i * 16, 110, 40 + i * 16, 124);
    if (boss.crown) {
      g.fillStyle(0xffd23f).fillPoints(
        [{ x: 40, y: 30 }, { x: 50, y: 0 }, { x: 70, y: 22 }, { x: 90, y: 0 }, { x: 110, y: 22 }, { x: 130, y: 0 }, { x: 140, y: 30 }],
        true,
      );
      g.fillStyle(0xff3a6a).fillCircle(90, 20, 6);
    }
  });

  // 보스 팔 (주먹이 아래)
  make(scene, `boss_arm_${skin}`, 70, 210, (g) => {
    g.fillStyle(c.arm).fillRoundedRect(18, 0, 34, 160, 14);
    g.fillStyle(c.dark).fillRect(18, 60, 34, 8).fillRect(18, 110, 34, 8);
    g.fillStyle(c.light).fillRoundedRect(0, 148, 70, 62, 20);
    g.lineStyle(4, c.dark).lineBetween(18, 160, 18, 200).lineBetween(35, 160, 35, 205).lineBetween(52, 160, 52, 200);
  });
}
