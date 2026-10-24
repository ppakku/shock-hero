import Phaser from 'phaser';
import { makeCanvas } from '../enemies/seaTextures.js';

// 수중 던전 배경 (stage.theme.scenery === 'underwater'). GameScene.drawBackground 가 부른다.
// 아들이 그린 물속 동굴 그림(public/art/underwater_bg.jpg)을 가장 먼 곳에 깔고,
// 그 앞에 코드로 그린 빛줄기, 바위, 부서진 기둥, 쇠사슬, 흔들리는 해초, 빛나는 산호와 버섯, 거품, 일렁이는 물빛을 겹친다.
// 바닥은 이끼 낀 돌바닥, 발판은 돌판으로 덮어 그린다.

export const UNDERWATER_BG_KEY = 'underwater_bg';

// 배경 장식 그림 (캔버스)
function makeSceneryTextures(scene) {
  // 긴 해초 (초록, 노랑)
  const kelp = (key, stem, leaf, h) =>
    makeCanvas(scene, key, 48, h, (ctx) => {
      ctx.strokeStyle = stem;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(24, h);
      for (let y = h; y > 6; y -= 8) ctx.lineTo(24 + Math.sin(y / 22) * 7, y);
      ctx.stroke();
      ctx.fillStyle = leaf;
      for (let y = h - 14; y > 14; y -= 18) {
        const x = 24 + Math.sin(y / 22) * 7;
        const s = (y / 18) % 2 < 1 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + s * 22, y - 4, x + s * 20, y - 18);
        ctx.quadraticCurveTo(x + s * 8, y - 10, x, y);
        ctx.fill();
      }
    });
  kelp('sea_kelp', '#2f7a2a', '#7ad84a', 220);
  kelp('sea_kelp2', '#7a6a20', '#c8b040', 170);
  kelp('sea_kelp3', '#3a9a3a', '#b4ff5a', 120);

  // 가지 산호 (주황, 보라)
  const coral = (key, color, tip) =>
    makeCanvas(scene, key, 72, 64, (ctx) => {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      const branch = (x, y, a, len, w) => {
        if (len < 6) {
          ctx.fillStyle = tip;
          ctx.beginPath();
          ctx.arc(x, y, w + 1, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        const x2 = x + Math.cos(a) * len;
        const y2 = y + Math.sin(a) * len;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        branch(x2, y2, a - 0.45, len * 0.68, Math.max(2, w * 0.7));
        branch(x2, y2, a + 0.4, len * 0.68, Math.max(2, w * 0.7));
      };
      branch(36, 64, -Math.PI / 2, 22, 7);
    });
  coral('sea_coral', '#e8783a', '#ffb070');
  coral('sea_coral2', '#9a4ad8', '#d898ff');

  // 빛나는 버섯 무리
  makeCanvas(scene, 'sea_mushroom', 44, 36, (ctx) => {
    for (const [x, h, r] of [[12, 22, 8], [26, 30, 10], [36, 16, 6]]) {
      ctx.fillStyle = '#d8f0c0';
      ctx.fillRect(x - 2, 36 - h, 4, h);
      ctx.fillStyle = '#fff36a';
      ctx.beginPath();
      ctx.ellipse(x, 36 - h, r, r * 0.6, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#ffffd0';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, 36 - h - r * 0.25, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 부서진 돌기둥
  makeCanvas(scene, 'sea_column', 64, 180, (ctx) => {
    ctx.fillStyle = '#4a6a70';
    ctx.strokeStyle = '#1a2a30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 180);
    ctx.lineTo(10, 30);
    ctx.lineTo(22, 18);
    ctx.lineTo(34, 26);
    ctx.lineTo(44, 12);
    ctx.lineTo(54, 22);
    ctx.lineTo(54, 180);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,40,46,0.8)';
    ctx.lineWidth = 2;
    for (const x of [22, 32, 42]) {
      ctx.beginPath();
      ctx.moveTo(x, 34);
      ctx.lineTo(x, 176);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a7e84';
    ctx.fillRect(4, 166, 56, 14);
    ctx.strokeRect(4, 166, 56, 14);
    // 이끼
    ctx.fillStyle = 'rgba(110,190,90,0.7)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(12 + i * 8, 40 + ((i * 37) % 90), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // 쓰러진 기둥 머리
  makeCanvas(scene, 'sea_lintel', 170, 44, (ctx) => {
    ctx.fillStyle = '#4a6a70';
    ctx.strokeStyle = '#1a2a30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.lineTo(160, 4);
    ctx.lineTo(166, 30);
    ctx.lineTo(120, 40);
    ctx.lineTo(112, 32);
    ctx.lineTo(8, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  // 위에서 늘어진 쇠사슬
  makeCanvas(scene, 'sea_chain', 20, 220, (ctx) => {
    ctx.strokeStyle = '#1e3036';
    ctx.lineWidth = 4;
    for (let y = 0; y < 220; y += 16) {
      ctx.beginPath();
      if ((y / 16) % 2 === 0) ctx.ellipse(10, y + 8, 5, 9, 0, 0, Math.PI * 2);
      else ctx.ellipse(10, y + 8, 2, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  // 위로 올라가는 거품
  makeCanvas(scene, 'sea_bubble', 16, 16, (ctx) => {
    ctx.strokeStyle = 'rgba(200,250,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(5.5, 5.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawUnderwater(scene) {
  const st = scene.stage;
  const th = st.theme;
  const W = st.width;
  const gy = st.groundY;
  makeSceneryTextures(scene);
  const rng = new Phaser.Math.RandomDataGenerator([`shock-hero-sea-${scene.stageNum}`]);

  // 0) 물 색
  const sky = scene.add.graphics().setScrollFactor(0).setDepth(-20);
  sky.fillGradientStyle(th.sky[0], th.sky[0], th.sky[1], th.sky[1], 1).fillRect(0, 0, 960, 540);

  // 1) 아들 그림 (가장 먼 곳, 아주 천천히 움직임). 없으면 건너뜀
  if (scene.textures.exists(UNDERWATER_BG_KEY)) {
    const img = scene.add.image(0, -50, UNDERWATER_BG_KEY).setOrigin(0, 0).setScrollFactor(0.05, 1).setDepth(-19);
    const needW = 960 + (W - 960) * 0.05 + 10;
    const s = Math.max(needW / img.width, 640 / img.height);
    img.setScale(s);
    // 그림 왼쪽의 금색 해파리는 진짜 몬스터로 헷갈릴 수 있어서 바위와 해초로 살짝 가린다
    const jx = 160 * (s / 1); // 원본(1600 폭) 그림에서 해파리 가운데 x 약 160, y 약 525
    const jy = -50 + 525 * s;
    const cover = scene.add.graphics().setScrollFactor(0.05, 1).setDepth(-18.6);
    cover.fillStyle(0x0b2c34, 1).fillEllipse(jx, jy + 10, 120 * s * 1.3, 150 * s * 1.3);
    cover.fillStyle(0x12404a, 1).fillEllipse(jx - 10, jy - 10, 70 * s * 1.3, 60 * s * 1.3);
    for (const [dx, key, sc] of [[-30, 'sea_kelp', 0.7], [5, 'sea_kelp3', 1.1], [35, 'sea_kelp2', 0.8]]) {
      scene.add.image(jx + dx * s, jy + 90 * s, key).setOrigin(0.5, 1).setScrollFactor(0.05, 1).setDepth(-18.5).setScale(sc).setTint(0x5a8a7a);
    }
    // 앞쪽 놀이 공간이 잘 보이게 살짝 어둡게
    scene.add.rectangle(0, 0, 960, 540, 0x032028, 0.35).setOrigin(0, 0).setScrollFactor(0).setDepth(-18);
  }

  // 2) 먼 바위: 천장 종유석과 바위 기둥 (반투명)
  const far = scene.add.graphics().setScrollFactor(0.3, 1).setDepth(-16);
  const farSpan = W * 0.3 + 960;
  for (let x = -40; x < farSpan; x += rng.between(70, 140)) {
    const h = rng.between(40, 130);
    far.fillStyle(th.far, 0.75).fillTriangle(x, -10, x + rng.between(40, 80), -10, x + rng.between(15, 45), h);
  }
  for (let x = rng.between(100, 300); x < farSpan; x += rng.between(380, 620)) {
    const w = rng.between(60, 110);
    far.fillStyle(th.far, 0.65).fillRect(x, 0, w, gy);
    far.fillStyle(th.near, 0.4).fillRect(x + w * 0.6, 0, w * 0.25, gy);
  }

  // 3) 빛줄기 (위에서 비스듬히 내려옴, 천천히 깜빡이며 흔들림)
  const rays = scene.add.graphics().setScrollFactor(0).setDepth(-15).setBlendMode(Phaser.BlendModes.ADD);
  const rayDefs = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 140 + i * 150 + rng.between(-40, 40), w: rng.between(40, 90), ph: rng.frac() * 6, lean: rng.between(80, 160) }));

  // 4) 중간 장식: 부서진 기둥, 쓰러진 기둥 머리, 쇠사슬, 해초
  const mid = 0.6;
  const midSpan = W * mid + 960;
  const sway = (img, amp, dur) => {
    img.setAngle(-amp);
    scene.tweens.add({ targets: img, angle: amp, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rng.between(0, dur) });
  };
  for (let x = 200; x < midSpan; x += rng.between(500, 800)) {
    scene.add.image(x, gy + 6, 'sea_column').setOrigin(0.5, 1).setScrollFactor(mid, 1).setDepth(-12).setTint(0x8ab0b4).setAngle(rng.between(-8, 8));
    if (rng.frac() < 0.6) scene.add.image(x + 90, gy, 'sea_lintel').setOrigin(0.5, 1).setScrollFactor(mid, 1).setDepth(-12).setTint(0x7aa0a4).setAngle(rng.between(-12, 4));
  }
  for (let x = 120; x < midSpan; x += rng.between(260, 480)) {
    const ch = scene.add.image(x, -10, 'sea_chain').setOrigin(0.5, 0).setScrollFactor(mid, 1).setDepth(-12).setScale(1, rng.realInRange(0.8, 1.4)).setAlpha(0.85);
    sway(ch, 2, rng.between(2200, 3400));
  }
  for (let x = 60; x < midSpan; x += rng.between(90, 200)) {
    const key = rng.pick(['sea_kelp', 'sea_kelp2', 'sea_kelp']);
    const k = scene.add.image(x, gy + 4, key).setOrigin(0.5, 1).setScrollFactor(mid, 1).setDepth(-11).setTint(0x88b8a8).setScale(rng.realInRange(0.8, 1.3));
    sway(k, rng.between(3, 6), rng.between(1600, 2600));
  }

  // 5) 거품 (화면 아래에서 위로)
  scene.add
    .particles(0, 560, 'sea_bubble', {
      x: { min: 0, max: 960 },
      frequency: 160,
      speedY: { min: -70, max: -30 },
      speedX: { min: -10, max: 10 },
      scale: { min: 0.4, max: 1.0 },
      alpha: { start: 0.8, end: 0.1 },
      lifespan: 8000,
    })
    .setScrollFactor(0)
    .setDepth(-5);

  // 6) 가까운 장식 (주인공과 같은 거리): 해초, 산호, 빛나는 버섯, 거품 기둥
  const glow = scene.add.graphics().setDepth(-3).setBlendMode(Phaser.BlendModes.ADD);
  const glows = [];
  for (let x = 140; x < W; x += rng.between(140, 260)) {
    const r = rng.frac();
    if (r < 0.45) {
      const k = scene.add.image(x, gy + 6, rng.pick(['sea_kelp3', 'sea_kelp2', 'sea_kelp3'])).setOrigin(0.5, 1).setDepth(-2).setScale(rng.realInRange(0.7, 1.1));
      sway(k, rng.between(4, 8), rng.between(1400, 2200));
    } else if (r < 0.75) {
      scene.add.image(x, gy + 4, rng.pick(['sea_coral', 'sea_coral2'])).setOrigin(0.5, 1).setDepth(-2).setScale(rng.realInRange(0.7, 1.1));
      glows.push({ x, y: gy - 24, r: 30, color: 0xff9a5a, ph: rng.frac() * 6 });
    } else {
      scene.add.image(x, gy + 3, 'sea_mushroom').setOrigin(0.5, 1).setDepth(-2);
      glows.push({ x, y: gy - 22, r: 34, color: th.window, ph: rng.frac() * 6 });
    }
  }
  // 바닥 틈에서 올라오는 거품 기둥
  for (let x = 500; x < W; x += rng.between(700, 1100)) {
    scene.add
      .particles(x, gy - 4, 'sea_bubble', {
        frequency: 260,
        speedY: { min: -110, max: -60 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.4, end: 1.0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: 3200,
      })
      .setDepth(-2);
  }

  // 7) 이끼 낀 돌바닥 (기본 땅 그림 위에 덮어 그림)
  const bed = scene.add.graphics().setDepth(0.2);
  bed.fillStyle(0x1c3a40, 1).fillRect(0, gy, W, 60);
  for (let row = 0; row < 3; row++) {
    const y = gy + 4 + row * 19;
    const off = row % 2 ? 30 : 0;
    for (let x = -off; x < W; x += 60) {
      const shade = [0x2e5258, 0x355c62, 0x29494f][(x / 60 + row) % 3 | 0] ?? 0x2e5258;
      bed.fillStyle(shade, 1).fillRoundedRect(x + 2, y, 56, 16, 4);
    }
  }
  bed.fillStyle(0x4f8a5a, 1).fillRect(0, gy, W, 5);
  for (let x = 0; x < W; x += 22) bed.fillStyle(0x6fb85a, 0.9).fillEllipse(x + rng.between(0, 10), gy + 2, rng.between(14, 26), 7);
  for (let x = 80; x < W; x += rng.between(120, 260)) bed.fillStyle(0x9dff6a, 0.7).fillCircle(x, gy + rng.between(18, 50), 2);

  // 발판: 이끼 낀 돌판으로 덮어 그림
  const slabs = scene.add.graphics().setDepth(0.3);
  for (const p of st.platforms) {
    const l = p.x - p.w / 2;
    slabs.fillStyle(0x2e5258, 1).fillRoundedRect(l, p.y, p.w, 20, 6);
    slabs.fillStyle(0x4a7a80, 1).fillRoundedRect(l + 2, p.y + 2, p.w - 4, 7, 4);
    slabs.lineStyle(2, 0x14262a, 1).strokeRoundedRect(l, p.y, p.w, 20, 6);
    slabs.fillStyle(0x6fb85a, 0.9);
    for (let x = l + 8; x < l + p.w - 6; x += 16) slabs.fillEllipse(x, p.y + 1, 12, 5);
    slabs.fillStyle(0x4f8a5a, 0.8).fillRect(l + p.w * 0.3, p.y + 18, 4, 10).fillRect(l + p.w * 0.7, p.y + 18, 4, 14);
  }

  // 8) 일렁이는 물빛 (화면 위쪽에 물결 무늬)
  const caustic = scene.add.graphics().setScrollFactor(0).setDepth(-4).setBlendMode(Phaser.BlendModes.ADD);

  // 매 프레임 움직이는 것들: 빛줄기, 물빛, 빛나는 산호와 버섯
  const tick = () => {
    const t = scene.time.now / 1000;
    const camX = scene.cameras.main.scrollX;
    rays.clear();
    for (const r of rayDefs) {
      const a = 0.05 + 0.04 * Math.sin(t * 0.7 + r.ph);
      const x = ((r.x - camX * 0.1) % 1100 + 1100) % 1100 - 70 + Math.sin(t * 0.3 + r.ph) * 20;
      rays.fillStyle(th.sun, a);
      rays.fillPoints([{ x: x - r.w / 2, y: -10 }, { x: x + r.w / 2, y: -10 }, { x: x + r.w + r.lean, y: 470 }, { x: x - r.w * 0.2 + r.lean, y: 470 }], true);
    }
    caustic.clear();
    for (let i = 0; i < 9; i++) {
      const y = 20 + i * 14;
      const a = 0.05 * (1 - i / 9);
      caustic.lineStyle(3, 0xbff8ff, a);
      caustic.beginPath();
      for (let x = 0; x <= 960; x += 24) {
        const yy = y + Math.sin(x / 70 + t * 1.4 + i) * 5 + Math.sin(x / 31 - t * 2 + i * 2) * 2;
        if (x === 0) caustic.moveTo(x, yy);
        else caustic.lineTo(x, yy);
      }
      caustic.strokePath();
    }
    glow.clear();
    const view = scene.cameras.main.worldView;
    for (const gl of glows) {
      if (gl.x < view.x - 60 || gl.x > view.right + 60) continue;
      const a = 0.12 + 0.08 * Math.sin(t * 2 + gl.ph);
      glow.fillStyle(gl.color, a).fillCircle(gl.x, gl.y, gl.r);
      glow.fillStyle(gl.color, a * 0.8).fillCircle(gl.x, gl.y, gl.r * 0.5);
    }
  };
  tick();
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
}
