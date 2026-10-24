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
  makePowerIcons(scene);
}

// 보물 상자의 특별한 힘(pw_)과 레벨 업 카드(up_) 아이콘. 모두 40 x 40
function makePowerIcons(scene) {
  const S = 40;
  const badge = (g, color) => {
    g.fillStyle(0x000000, 0.55).fillCircle(20, 20, 19);
    g.lineStyle(3, color, 1).strokeCircle(20, 20, 17);
  };
  const bolt = (g, color, ox = 0, oy = 0, k = 1) => {
    g.fillStyle(color, 1);
    g.fillPoints([
      { x: ox + 22 * k, y: oy + 4 * k }, { x: ox + 10 * k, y: oy + 22 * k }, { x: ox + 19 * k, y: oy + 22 * k },
      { x: ox + 15 * k, y: oy + 36 * k }, { x: ox + 30 * k, y: oy + 16 * k }, { x: ox + 21 * k, y: oy + 16 * k },
    ], true);
  };
  const shield = (g, fill, line) => {
    g.fillStyle(fill, 1).fillPoints([{ x: 20, y: 6 }, { x: 32, y: 11 }, { x: 30, y: 25 }, { x: 20, y: 34 }, { x: 10, y: 25 }, { x: 8, y: 11 }], true);
    g.lineStyle(2, line, 1).strokePoints([{ x: 20, y: 6 }, { x: 32, y: 11 }, { x: 30, y: 25 }, { x: 20, y: 34 }, { x: 10, y: 25 }, { x: 8, y: 11 }], true);
  };
  const fist = (g, color) => {
    g.fillStyle(color, 1).fillRoundedRect(10, 12, 20, 16, 5);
    g.fillStyle(color, 1).fillRoundedRect(13, 26, 14, 8, 2);
    g.lineStyle(2, 0x000000, 0.5).lineBetween(15, 13, 15, 20).lineBetween(20, 13, 20, 20).lineBetween(25, 13, 25, 20);
    g.fillStyle(0xffffff, 0.5).fillRoundedRect(12, 14, 6, 4, 2);
  };
  const star = (g, color, cx = 20, cy = 21, r1 = 15, r2 = 6.5) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? r1 : r2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    g.fillStyle(color, 1).fillPoints(pts, true);
  };

  // 번개 신발: 노란 번개 + 신발
  make(scene, 'pw_speed', S, S, (g) => {
    badge(g, 0xffe066);
    g.fillStyle(0xff6a3d, 1).fillRoundedRect(8, 24, 22, 9, 4);
    g.fillStyle(0xffffff, 1).fillRect(8, 31, 24, 3);
    bolt(g, 0xffe066, 6, -2, 0.75);
  });
  // 강철 몸: 은빛 방패
  make(scene, 'pw_shield', S, S, (g) => {
    badge(g, 0xbfe0ff);
    shield(g, 0x9fb4c8, 0xffffff);
    g.fillStyle(0xffffff, 0.6).fillRect(14, 12, 4, 12);
  });
  // 파워 장갑: 빨간 주먹
  make(scene, 'pw_power', S, S, (g) => {
    badge(g, 0xff7a5c);
    fist(g, 0xff5a3a);
  });
  // 무적 별
  make(scene, 'pw_star', S, S, (g) => {
    badge(g, 0xffd23f);
    star(g, 0xffd23f);
    g.fillStyle(0xffffff, 0.8).fillCircle(16, 17, 2.5);
  });
  // 에너지 연사: 파란 공 세 개
  make(scene, 'pw_rapid', S, S, (g) => {
    badge(g, 0x6fc0ff);
    for (const [x, y, r] of [[13, 24, 5], [21, 18, 6], [29, 12, 4]]) {
      g.fillStyle(0x3f8cff, 1).fillCircle(x, y, r);
      g.fillStyle(0xe8f7ff, 1).fillCircle(x, y, r * 0.45);
    }
  });

  // 레벨 업 카드
  make(scene, 'up_attack', S, S, (g) => {
    badge(g, 0xff7a5c);
    fist(g, 0xffcf9a);
  });
  make(scene, 'up_defense', S, S, (g) => {
    badge(g, 0x7ab8ff);
    shield(g, 0x3f7ad8, 0xbfe0ff);
    g.fillStyle(0xbfe0ff, 1).fillRect(18, 12, 4, 16).fillRect(13, 17, 14, 4);
  });
  make(scene, 'up_speed', S, S, (g) => {
    badge(g, 0xffe066);
    g.lineStyle(3, 0xffe066, 1).lineBetween(7, 15, 17, 15).lineBetween(5, 21, 15, 21).lineBetween(7, 27, 17, 27);
    g.fillStyle(0x3ff0ff, 1).fillPoints([{ x: 18, y: 10 }, { x: 34, y: 21 }, { x: 18, y: 32 }, { x: 22, y: 21 }], true);
  });
  make(scene, 'up_robot', S, S, (g) => {
    badge(g, 0x3ff0ff);
    g.lineStyle(3, 0xbfc7d5).lineBetween(20, 6, 20, 11);
    g.fillStyle(0xff4d4d).fillCircle(20, 6, 3);
    g.fillStyle(0xf2f5fa).fillCircle(20, 22, 11);
    g.fillStyle(0x223047).fillRoundedRect(12, 18, 16, 8, 3);
    g.fillStyle(0x3ff0ff).fillCircle(16, 22, 2).fillCircle(24, 22, 2);
    bolt(g, 0x9ff6ff, 22, 18, 0.45);
  });
}
