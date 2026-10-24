import Phaser from 'phaser';
import { make } from './textures.js';
import { foregroundAlpha } from './fxLogic.js';

// 앞쪽 실루엣(전경): 카메라보다 빨리 지나가는(scrollFactor 1.35) 어두운 바위, 풀, 해초 그림자.
// 화면이 깊어 보이게 해 준다. 게임이 잘 보이도록:
//   - 낮은 조각은 땅 아랫부분(발보다 아래, y 498 아래)에만 있다.
//   - 키 큰 조각은 화면 가장자리에서만 보이고 가운데로 오면 사라진다.
//     주인공 가까이 오거나 보스전 중이면 더 흐려진다 (경고가 가려지지 않게).
// 깊이 28: 불꽃(26)보다 위, 보스 경고 글자(31)보다 아래. HUD 는 다른 장면이라 늘 위에 있다.

const FACTOR = 1.35;
const LOW_W = 240;
const LOW_H = 56;
const TALL_W = 140;
const TALL_H = 210;

// 스테이지 모양별 색과 그리기
const KINDS = {
  city: { color: 0x120a1a, light: 0x3a2850 },
  forest: { color: 0x060f06, light: 0x1e3a14 },
  volcano: { color: 0x120604, light: 0xff6a1f },
  mountains: { color: 0x0c1830, light: 0xcfe6ff },
  castle: { color: 0x0a040e, light: 0x5a2a6a },
  underwater: { color: 0x021418, light: 0x1f6a5a },
};

function kindOf(stage) {
  const s = stage.theme?.scenery;
  return KINDS[s] ? s : 'city';
}

// 낮은 조각 (폭 240, 높이 56, 아래쪽이 바닥)
function drawLow(g, kind, rng) {
  const { color, light } = KINDS[kind];
  const H = LOW_H;
  if (kind === 'forest') {
    g.fillStyle(color, 1);
    for (let i = 0; i < 26; i++) {
      const x = rng.between(4, LOW_W - 4);
      const h = rng.between(18, 52);
      g.fillTriangle(x - 5, H, x + rng.between(-14, 14), H - h, x + 5, H);
    }
    g.fillStyle(light, 1).fillEllipse(rng.between(40, 200), H - 14, 26, 12);
    g.fillStyle(color, 1).fillRect(0, H - 8, LOW_W, 8);
    return;
  }
  if (kind === 'underwater') {
    g.fillStyle(color, 1);
    for (let i = 0; i < 5; i++) g.fillEllipse(rng.between(20, 220), H - 6, rng.between(50, 90), rng.between(20, 34));
    // 산호 가지
    for (let i = 0; i < 3; i++) {
      const x = rng.between(30, 210);
      g.lineStyle(6, color, 1).lineBetween(x, H, x - 10, H - 34).lineBetween(x, H, x + 12, H - 40).lineBetween(x - 10, H - 34, x - 20, H - 46);
    }
    g.fillStyle(light, 0.9).fillCircle(rng.between(40, 200), H - 18, 3).fillCircle(rng.between(40, 200), H - 12, 2);
    return;
  }
  // 바위, 잔해, 벽돌: 들쭉날쭉한 덩어리
  const pts = [{ x: 0, y: H }];
  let x = 0;
  while (x < LOW_W) {
    x += rng.between(14, 34);
    pts.push({ x: Math.min(LOW_W, x), y: H - rng.between(10, H - 6) });
  }
  pts.push({ x: LOW_W, y: H });
  g.fillStyle(color, 1).fillPoints(pts, true);
  if (kind === 'volcano') {
    // 바위 틈에서 빛나는 용암
    for (let i = 0; i < 3; i++) {
      const cx = rng.between(30, 210);
      g.lineStyle(3, light, 0.9).lineBetween(cx, H, cx + rng.between(-10, 10), H - rng.between(12, 26));
      g.lineStyle(1, 0xffe08a, 1).lineBetween(cx, H, cx + 2, H - 10);
    }
  } else if (kind === 'mountains') {
    for (let i = 1; i < pts.length - 1; i++) if (i % 2) g.fillStyle(light, 0.75).fillEllipse(pts[i].x, pts[i].y + 3, 20, 7);
  } else if (kind === 'castle') {
    g.lineStyle(3, color, 1);
    for (let i = 0; i < 4; i++) {
      const cx = rng.between(20, 220);
      g.lineBetween(cx, H - 10, cx + rng.between(-30, 30), H - rng.between(30, 50));
    }
    g.fillStyle(light, 0.7).fillRect(rng.between(30, 190), H - 20, 18, 9);
  } else {
    // 도시: 철근
    g.lineStyle(3, light, 0.9);
    for (let i = 0; i < 3; i++) {
      const cx = rng.between(20, 220);
      g.lineBetween(cx, H - 12, cx + rng.between(-18, 18), H - rng.between(36, 54));
    }
  }
}

// 키 큰 조각 (폭 140, 높이 210, 아래쪽이 바닥)
function drawTall(g, kind, rng) {
  const { color, light } = KINDS[kind];
  const H = TALL_H;
  const cx = TALL_W / 2;
  if (kind === 'underwater') {
    // 해초 여러 가닥
    for (let s = 0; s < 3; s++) {
      const bx = cx + (s - 1) * 30;
      g.lineStyle(10 - s * 2, color, 1);
      g.beginPath();
      g.moveTo(bx, H);
      for (let k = 1; k <= 10; k++) g.lineTo(bx + Math.sin(k * 0.8 + s) * 14, H - (H - 10) * (k / 10) * (0.7 + s * 0.12));
      g.strokePath();
    }
    return;
  }
  if (kind === 'forest') {
    // 고사리 잎
    g.lineStyle(6, color, 1).lineBetween(cx, H, cx + 20, 20);
    g.fillStyle(color, 1);
    for (let k = 0; k < 9; k++) {
      const y = H - 20 - k * 20;
      const x = cx + 20 * ((H - y) / H);
      const len = 50 - k * 4;
      g.fillTriangle(x, y, x - len, y - 12, x, y - 10).fillTriangle(x, y, x + len, y - 16, x, y - 10);
    }
    return;
  }
  if (kind === 'mountains') {
    // 얼음 결정 기둥
    g.fillStyle(color, 1).fillTriangle(cx - 34, H, cx + 4, 20, cx + 30, H);
    g.fillStyle(color, 1).fillTriangle(cx - 60, H, cx - 34, 110, cx - 12, H);
    g.fillStyle(light, 0.35).fillTriangle(cx - 6, H, cx + 4, 30, cx + 12, H);
    return;
  }
  if (kind === 'castle') {
    // 부서진 기둥과 쇠창살
    g.fillStyle(color, 1).fillRect(cx - 26, 60, 52, H - 60);
    g.fillTriangle(cx - 26, 60, cx - 4, 36, cx + 10, 62).fillTriangle(cx + 4, 62, cx + 26, 44, cx + 26, 62);
    g.lineStyle(4, color, 1);
    for (let k = 0; k < 3; k++) g.lineBetween(cx + 40 + k * 14, H, cx + 40 + k * 14, 110 - k * 8);
    g.fillStyle(light, 0.6).fillRect(cx - 18, 120, 36, 6);
    return;
  }
  // 도시, 용암: 끝이 뾰족한 바위 기둥 (석순)
  g.fillStyle(color, 1).fillPoints(
    [{ x: cx - 46, y: H }, { x: cx - 24, y: 120 }, { x: cx - 6, y: 10 }, { x: cx + 10, y: 70 }, { x: cx + 30, y: 130 }, { x: cx + 50, y: H }],
    true,
  );
  g.fillStyle(color, 1).fillTriangle(cx + 30, H, cx + 52, 150, cx + 68, H);
  if (kind === 'volcano') {
    g.lineStyle(3, light, 0.9).lineBetween(cx - 4, 60, cx - 14, 130).lineBetween(cx - 14, 130, cx + 4, H);
    g.lineStyle(1, 0xffe08a, 1).lineBetween(cx - 4, 60, cx - 14, 130);
  } else {
    g.lineStyle(3, light, 0.9).lineBetween(cx - 6, 10, cx - 18, -4).lineBetween(cx + 10, 70, cx + 26, 52);
  }
}

export class Foreground {
  constructor(scene) {
    this.scene = scene;
    const st = scene.stage;
    this.kind = kindOf(st);
    const rng = new Phaser.Math.RandomDataGenerator([`shock-fg-${scene.stageNum}`]);
    for (let i = 0; i < 3; i++) {
      make(scene, `fg_low_${this.kind}_${i}`, LOW_W, LOW_H, (g) => drawLow(g, this.kind, rng));
      make(scene, `fg_tall_${this.kind}_${i}`, TALL_W, TALL_H, (g) => drawTall(g, this.kind, rng));
    }
    this.pieces = [];
    const end = (st.width - 960) * FACTOR + 960 + 200;
    for (let x = -60; x < end; x += rng.between(200, 360)) {
      const img = scene.add.image(x, 548, `fg_low_${this.kind}_${rng.between(0, 2)}`).setOrigin(0.5, 1).setDepth(28).setScrollFactor(FACTOR, 1);
      img.setScale(rng.realInRange(0.75, 0.95)).setFlipX(rng.frac() < 0.5);
      this.pieces.push({ img, x, tall: false });
    }
    for (let x = rng.between(-40, 200); x < end; x += rng.between(620, 980)) {
      const img = scene.add.image(x, 552, `fg_tall_${this.kind}_${rng.between(0, 2)}`).setOrigin(0.5, 1).setDepth(28).setScrollFactor(FACTOR, 1);
      img.setScale(rng.realInRange(0.8, 1)).setFlipX(rng.frac() < 0.5);
      this.pieces.push({ img, x, tall: true, phase: rng.frac() * 6 });
    }
  }

  update() {
    const sc = this.scene;
    const cam = sc.cameras.main;
    const heroX = sc.player ? sc.player.x - cam.scrollX : -999;
    const t = sc.time.now / 1000;
    const sway = this.kind === 'underwater' || this.kind === 'forest';
    for (const p of this.pieces) {
      const sx = p.x - cam.scrollX * FACTOR;
      const half = p.img.displayWidth / 2;
      const on = sx > -half && sx < 960 + half;
      p.img.setVisible(on);
      if (!on) continue;
      let a = foregroundAlpha(sx, 960, p.tall);
      if (p.tall) {
        if (Math.abs(sx - heroX) < half + 50) a *= 0.3; // 주인공을 가리지 않게
        if (sc.bossStarted) a *= 0.4; // 보스전: 벽 쪽 경고가 잘 보이게
        if (sway) p.img.setAngle(Math.sin(t * 1.3 + p.phase) * 3);
      }
      p.img.setAlpha(a);
    }
  }
}
