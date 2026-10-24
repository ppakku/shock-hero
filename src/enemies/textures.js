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

  // 프로스 (아들 디자인 말벌, 오른쪽을 보는 모습)
  // 날개 위로(monster_fros), 날개 아래로(monster_fros_flap)를 번갈아 보여 주면 날갯짓이 된다.
  // monster_fros_aim 은 배를 앞으로 구부리고 독침이 보라색으로 빛나는 모습 (맹독 쏘기 직전)
  make(scene, 'monster_fros', 104, 96, (g) => drawFros(g, 'up'));
  make(scene, 'monster_fros_flap', 104, 96, (g) => drawFros(g, 'down'));
  make(scene, 'monster_fros_aim', 104, 96, (g) => drawFros(g, 'aim'));

  // 프로스가 쏘는 맹독 (오른쪽으로 날아가는 보라 방울)
  make(scene, 'monster_venom', 30, 18, (g) => {
    g.fillStyle(0xb070ff, 0.45).fillEllipse(7, 9, 14, 7);
    g.fillStyle(0x5a1a9a).fillEllipse(18, 9, 22, 16);
    g.fillStyle(0x9b30ff).fillEllipse(18, 9, 18, 12);
    g.fillStyle(0x7dff4a).fillEllipse(21, 6, 7, 4);
    g.fillStyle(0xffffff).fillCircle(24, 6, 1.5);
  });

  // 독구름 한 덩이 (여러 개를 겹쳐서 구름을 만든다)
  make(scene, 'monster_poison_puff', 48, 40, (g) => {
    g.fillStyle(0x6a2aa8, 0.6).fillCircle(24, 24, 15);
    g.fillStyle(0x8a3fd1, 0.55).fillCircle(14, 26, 10).fillCircle(35, 26, 11);
    g.fillStyle(0xb070ff, 0.5).fillCircle(22, 14, 10).fillCircle(31, 17, 8);
    g.fillStyle(0x7dff4a, 0.45).fillCircle(16, 18, 3).fillCircle(33, 28, 2.5).fillCircle(25, 30, 2);
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

// 회전한 타원의 꼭짓점들 (ax: rot 방향 반지름, by: 수직 방향 반지름)
function ellipsePts(cx, cy, ax, by, rot, n = 22) {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * ax;
    const y = Math.sin(t) * by;
    pts.push({ x: cx + x * c - y * sn, y: cy + x * sn + y * c });
  }
  return pts;
}

const deg = (d) => (d * Math.PI) / 180;

// 프로스 그리기. pose: 'up' 날개 위, 'down' 날개 아래, 'aim' 배를 구부려 독 쏘기 직전
function drawFros(g, pose) {
  const YELLOW = 0xf5c518;
  const DARK_YELLOW = 0xc99a12;
  const BROWN = 0x5a3a1a;
  const DARK = 0x1c140c;
  const PURPLE = 0x9b30ff;
  const GREEN = 0x7dff4a;
  const aim = pose === 'aim';

  // 다리 (갈색, 마디가 있음)
  const legs = aim
    ? [[56, 54, 50, 66, 52, 78], [61, 56, 66, 68, 70, 78], [66, 55, 78, 62, 86, 70]]
    : [[56, 54, 48, 64, 46, 76], [61, 56, 60, 68, 55, 80], [66, 55, 72, 66, 70, 78]];
  for (const [x1, y1, x2, y2, x3, y3] of legs) {
    g.lineStyle(4, DARK).lineBetween(x1, y1, x2, y2).lineBetween(x2, y2, x3, y3);
    g.lineStyle(2.5, BROWN).lineBetween(x1, y1, x2, y2).lineBetween(x2, y2, x3, y3);
    g.fillStyle(DARK).fillCircle(x3, y3, 1.8);
  }

  // 배 (노랑과 짙은 갈색 줄무늬, 끝에 독침)
  const ang = aim ? deg(55) : deg(125);
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const start = aim ? { x: 54, y: 54 } : { x: 50, y: 52 };
  const gap = aim ? 5.5 : 6.5;
  const widths = [14, 16, 15, 13, 10, 6.5];
  const at = (d) => ({ x: start.x + dir.x * d, y: start.y + dir.y * d });
  const mid = at(gap * 2.5);
  g.fillStyle(DARK).fillPoints(ellipsePts(mid.x, mid.y, gap * 3.4, 17, ang), true);
  for (let k = widths.length - 1; k >= 0; k--) {
    const c = at(k * gap);
    g.fillStyle(k % 2 === 0 ? YELLOW : 0x3b2410).fillPoints(ellipsePts(c.x, c.y, gap * 0.85, widths[k], ang), true);
  }
  // 털 느낌 (작은 점)
  for (let k = 0; k < 5; k += 2) {
    const c = at(k * gap);
    g.fillStyle(0xffe27a).fillCircle(c.x - dir.y * widths[k] * 0.5, c.y + dir.x * widths[k] * 0.5, 2);
  }
  // 독침
  const tip = at(widths.length * gap - 3);
  const end = { x: tip.x + dir.x * 10, y: tip.y + dir.y * 10 };
  const px = -dir.y * 4;
  const py = dir.x * 4;
  if (aim) {
    g.fillStyle(PURPLE, 0.35).fillCircle(end.x, end.y, 9);
    g.fillStyle(0xd9a6ff, 0.5).fillCircle(end.x, end.y, 6);
  }
  g.fillStyle(DARK).fillTriangle(tip.x + px, tip.y + py, tip.x - px, tip.y - py, end.x, end.y);
  g.fillStyle(PURPLE).fillTriangle(tip.x + px * 0.5, tip.y + py * 0.5, tip.x - px * 0.5, tip.y - py * 0.5, end.x, end.y);
  // 뚝뚝 떨어지는 보라 독과 초록 반짝임
  g.fillStyle(PURPLE).fillCircle(tip.x + px * 1.4, tip.y + py * 1.4 + 3, 2.5).fillCircle(end.x - 2, end.y + 3, 2);
  g.fillStyle(GREEN).fillCircle(tip.x - px * 1.2, tip.y - py * 1.2 + 2, 1.8).fillCircle(end.x + 1, end.y + 1, 1.2);

  // 가슴 (털이 북슬북슬한 노랑)
  g.fillStyle(DARK).fillCircle(60, 45, 15);
  g.fillStyle(DARK_YELLOW).fillCircle(60, 45, 13);
  g.fillStyle(YELLOW).fillCircle(58, 42, 9);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.fillStyle(i % 2 ? YELLOW : 0xffe27a).fillCircle(60 + Math.cos(a) * 12, 45 + Math.sin(a) * 12, 2.4);
  }

  // 더듬이
  g.lineStyle(2, 0x3b2410).lineBetween(80, 35, 84, 23).lineBetween(84, 23, 95, 16).lineBetween(76, 36, 77, 22).lineBetween(77, 22, 86, 13);
  // 머리
  g.fillStyle(DARK).fillCircle(80, 44, 13);
  g.fillStyle(YELLOW).fillCircle(80, 44, 11);
  // 커다란 보라 눈
  g.fillStyle(DARK).fillPoints(ellipsePts(84, 41, 8, 10, deg(-15)), true);
  g.fillStyle(0x3a1660).fillPoints(ellipsePts(84, 41, 6.5, 8.5, deg(-15)), true);
  g.fillStyle(0x6b3fa0).fillPoints(ellipsePts(85, 39, 3.5, 5, deg(-15)), true);
  g.fillStyle(0xffffff).fillCircle(86, 37, 1.8);
  // 얼굴 아래와 굽은 턱
  g.fillStyle(BROWN).fillCircle(87, 51, 4.5);
  g.fillStyle(0x8a7a6a).fillTriangle(86, 52, 95, 53, 91, 61);
  g.fillStyle(0x6b5a4a).fillTriangle(84, 54, 91, 57, 86, 62);
  g.fillStyle(DARK).fillCircle(91, 60, 1.2).fillCircle(86, 61, 1.2);

  // 날개 (반투명, 맥이 보임). 몸 위에 그려서 몸이 비쳐 보이게
  const base = { x: 58, y: 36 };
  const wingAngles = pose === 'up' ? [-125, -150] : pose === 'down' ? [-172, -196] : [-142, -166];
  const sizes = [[22, 9, 20], [17, 7, 16]];
  for (let i = 1; i >= 0; i--) {
    const a = deg(wingAngles[i]);
    const [ax, by, dist] = sizes[i];
    const cx = base.x + Math.cos(a) * dist;
    const cy = base.y + Math.sin(a) * dist;
    const pts = ellipsePts(cx, cy, ax, by, a);
    g.fillStyle(0xe8f4ff, 0.5).fillPoints(pts, true);
    g.lineStyle(1.5, 0x2a2a2a, 0.85).strokePoints(pts, true);
    // 날개 맥
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const L = dist + ax * 0.85;
    g.lineStyle(1, 0x5a6a7a, 0.7).lineBetween(base.x, base.y, base.x + ux * L, base.y + uy * L);
    for (const f of [0.45, 0.7]) {
      const bx = base.x + ux * L * f;
      const bb = base.y + uy * L * f;
      g.lineBetween(bx, bb, bx + ux * 8 - uy * by * 0.8, bb + uy * 8 + ux * by * 0.8);
      g.lineBetween(bx, bb, bx + ux * 8 + uy * by * 0.7, bb + uy * 8 - ux * by * 0.7);
    }
  }
}
