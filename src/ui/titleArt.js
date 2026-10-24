// 타이틀 화면 그림 (흑백 만화 잉크 느낌, 망점, 회색 연기, 주황 불꽃)
// 모두 캔버스에 직접 그려서 텍스처로 만든다. 한 번 만들면 다시 만들지 않는다.

export const TITLE_FONT = '"Black Han Sans"';
const BODY_FONT = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

// 같은 씨앗이면 늘 같은 순서로 나오는 난수 (그림이 매번 똑같게)
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 캔버스 텍스처 하나 만들기
function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  tex.refresh();
}

// 망점 (만화 인쇄 점). rFn(x, y) 가 점 반지름을 정한다.
function halftone(ctx, x0, y0, w, h, step, rFn, color = 'rgba(0,0,0,0.35)') {
  ctx.fillStyle = color;
  for (let y = y0, row = 0; y < y0 + h; y += step, row++) {
    for (let x = x0 + (row % 2) * (step / 2); x < x0 + w; x += step) {
      const r = rFn(x, y);
      if (r <= 0.15) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 가장자리가 울퉁불퉁한 사각형 경로 (찢은 종이, 거친 붓)
function roughRectPath(ctx, x, y, w, h, jitter, rnd, step = 8) {
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i <= w; i += step) pts.push([x + i, y + (rnd() - 0.5) * jitter]);
  for (let i = 0; i <= h; i += step) pts.push([x + w + (rnd() - 0.5) * jitter, y + i]);
  for (let i = w; i >= 0; i -= step) pts.push([x + i, y + h + (rnd() - 0.5) * jitter]);
  for (let i = h; i >= 0; i -= step) pts.push([x + (rnd() - 0.5) * jitter, y + i]);
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}

// 동그라미 여러 개를 뭉친 연기 덩어리 (바깥에만 잉크 테두리)
function smokeCluster(ctx, blobs, { fill = '#7a7f87', light = '#a3a8ae', dark = '#4b4f56', ink = '#16181b', line = 3 } = {}) {
  const union = () => {
    ctx.beginPath();
    blobs.forEach(([x, y, r]) => {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    });
  };
  // 1) 바깥 잉크 테두리
  ctx.fillStyle = ink;
  blobs.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r + line, 0, Math.PI * 2);
    ctx.fill();
  });
  // 2) 한 덩어리로 칠하고, 아래로 갈수록 어둡게
  let top = Infinity;
  let bottom = -Infinity;
  blobs.forEach(([, y, r]) => {
    top = Math.min(top, y - r);
    bottom = Math.max(bottom, y + r);
  });
  ctx.save();
  union();
  ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, fill);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(-2000, top - 10, 5000, bottom - top + 20);
  // 3) 뭉게뭉게: 동그라미마다 왼쪽 위에 흐린 밝은 빛, 오른쪽 아래에 그늘 선
  blobs.forEach(([x, y, r]) => {
    const h = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x - r * 0.3, y - r * 0.35, r * 0.8);
    h.addColorStop(0, light);
    h.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = h;
    ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2, r * 2);
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, line * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.92, Math.PI * 0.05, Math.PI * 0.6);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // 4) 아래쪽 망점 그림자
  halftone(ctx, Math.min(...blobs.map((p) => p[0] - p[2])), top + (bottom - top) * 0.45, 2000, bottom - top, 4,
    (px, py) => ((py - top) / (bottom - top) - 0.4) * 2.2, 'rgba(10,12,16,0.35)');
  ctx.restore();
}

// 연기 덩어리 동그라미 배치: 가운데는 크고 가장자리는 작게, 위로 부풀게
function puffBlobs(seed, cx, cy, w, h, count) {
  const rnd = seeded(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * d * w * 0.5;
    const y = cy + Math.sin(a) * d * h * 0.5 - (1 - d) * h * 0.15;
    out.push([x, y, (0.22 + (1 - d) * 0.28 + rnd() * 0.1) * Math.min(w, h * 1.6) * 0.55]);
  }
  return out.sort((p, q) => q[1] - p[1]);
}

// 불꽃 모양 (아래가 넓고 위로 갈래가 갈라진 혀 모양)
function flamePath(ctx, cx, base, w, h, rnd, tongues = 3) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, base);
  const pts = [];
  for (let i = 0; i < tongues; i++) {
    const t = (i + 0.5) / tongues;
    const tx = cx - w / 2 + w * t + (rnd() - 0.5) * w * 0.15;
    const th = h * (i === Math.floor(tongues / 2) ? 1 : 0.55 + rnd() * 0.3);
    pts.push([tx, base - th]);
  }
  let px = cx - w / 2;
  pts.forEach(([tx, ty], i) => {
    const valley = i === 0 ? null : [(pts[i - 1][0] + tx) / 2, base - h * (0.25 + rnd() * 0.15)];
    if (valley) ctx.quadraticCurveTo(valley[0] - 4, valley[1] + 6, valley[0], valley[1]);
    ctx.quadraticCurveTo(tx - w * 0.18, base - (base - ty) * 0.45, tx, ty);
    ctx.quadraticCurveTo(tx + w * 0.05, base - (base - ty) * 0.5, tx + w * 0.08, base - (base - ty) * 0.35);
    px = tx;
  });
  ctx.quadraticCurveTo(cx + w / 2 + 2, base - h * 0.2, cx + w / 2, base);
  ctx.closePath();
  return px;
}

function drawFlame(ctx, cx, base, w, h, seed) {
  const layers = [
    [1, '#d9431b', '#14100c'],
    [0.72, '#ff8c1a', null],
    [0.45, '#ffd84a', null],
    [0.22, '#fff6c4', null],
  ];
  layers.forEach(([k, color, ink]) => {
    const rnd = seeded(seed);
    flamePath(ctx, cx, base, w * k, h * k, rnd);
    ctx.fillStyle = color;
    ctx.fill();
    if (ink) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  });
}

// ------------------------------------------------------------
// 배경 (하늘, 먼 도시, 가까운 도시, 주인공이 선 옥상)
// ------------------------------------------------------------
function drawBackground(ctx, W, H) {
  const rnd = seeded(7);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#30353d');
  sky.addColorStop(0.32, '#7d838c');
  sky.addColorStop(0.5, '#6a7079');
  sky.addColorStop(1, '#262a31');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  halftone(ctx, 0, 0, W, 260, 6, (x, y) => 0.4 + 1.2 * Math.abs(Math.sin(x * 0.011 + y * 0.004)) * (1 - y / 320), 'rgba(20,22,26,0.32)');

  // 하늘 높이 깔린 무거운 연기
  smokeCluster(ctx, puffBlobs(3, 120, 30, 320, 150, 22), { fill: '#5f646c', light: '#8d9299', dark: '#3c4047', line: 2 });
  smokeCluster(ctx, puffBlobs(4, 800, 20, 380, 140, 24), { fill: '#5f646c', light: '#8d9299', dark: '#3c4047', line: 2 });

  // 불빛에 물든 연기 (주황 빛)
  [[130, 230, 160], [690, 210, 170], [930, 200, 130], [380, 240, 120]].forEach(([x, y, r]) => {
    const g = ctx.createRadialGradient(x, y, 10, x, y, r);
    g.addColorStop(0, 'rgba(255,140,40,0.55)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });

  // 먼 도시 (밝은 회색 실루엣)
  ctx.fillStyle = '#4c5159';
  ctx.strokeStyle = '#1c1e22';
  ctx.lineWidth = 2;
  for (let x = -10; x < W; ) {
    const w = 30 + rnd() * 40;
    const h = 90 + rnd() * 130;
    const top = 330 - h;
    ctx.fillRect(x, top, w, H - top);
    ctx.strokeRect(x, top, w, H - top);
    if (rnd() < 0.35) {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, top);
      ctx.lineTo(x + w / 2, top - 18 - rnd() * 20);
      ctx.stroke();
    }
    ctx.fillStyle = '#3d4249';
    for (let wy = top + 8; wy < 320; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 9) ctx.fillRect(wx, wy, 4, 6);
    ctx.fillStyle = '#4c5159';
    x += w + 2 + rnd() * 10;
  }

  // 가까운 도시 (짙은 실루엣, 부서진 지붕)
  for (let x = -20; x < 700; ) {
    const w = 46 + rnd() * 60;
    const h = 70 + rnd() * 110;
    const top = 360 - h;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x, top);
    const broken = rnd() < 0.5;
    if (broken) {
      for (let i = 1; i <= 4; i++) ctx.lineTo(x + (w * i) / 4, top + (rnd() - 0.3) * 22);
    } else ctx.lineTo(x + w, top);
    ctx.lineTo(x + w, H);
    ctx.closePath();
    ctx.fillStyle = '#272a30';
    ctx.fill();
    ctx.strokeStyle = '#0d0e10';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#17191c';
    for (let wy = top + 14; wy < 360; wy += 16) for (let wx = x + 7; wx < x + w - 10; wx += 13) if (rnd() < 0.8) ctx.fillRect(wx, wy, 7, 9);
    // 잉크 빗금
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const hx = x + w - 4 - i * 3;
      ctx.beginPath();
      ctx.moveTo(hx, top + 10);
      ctx.lineTo(hx, top + 60);
      ctx.stroke();
    }
    x += w + rnd() * 8;
  }

  // 주인공이 선 옥상 건물 (오른쪽)
  const bx = 690;
  const top = 236;
  ctx.fillStyle = '#1b1d21';
  ctx.beginPath();
  ctx.moveTo(bx, H);
  ctx.lineTo(bx, top + 14);
  ctx.lineTo(bx - 8, top + 14);
  ctx.lineTo(bx - 8, top);
  ctx.lineTo(W + 10, top);
  ctx.lineTo(W + 10, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.stroke();
  // 옥상 난간 윗면 (밝은 회색)
  ctx.fillStyle = '#5b6068';
  ctx.fillRect(bx - 8, top, W - bx + 18, 7);
  ctx.strokeRect(bx - 8, top, W - bx + 18, 14);
  ctx.fillStyle = '#34373d';
  ctx.fillRect(bx, top + 14, W - bx, H);
  ctx.strokeStyle = '#0a0b0d';
  ctx.lineWidth = 3;
  for (let wy = top + 34; wy < H; wy += 54) {
    for (let wx = bx + 22; wx < W - 30; wx += 70) {
      ctx.fillStyle = '#111215';
      ctx.fillRect(wx, wy, 40, 32);
      ctx.strokeRect(wx, wy, 40, 32);
      ctx.fillStyle = '#4a4e55';
      ctx.fillRect(wx + 3, wy + 3, 6, 26);
    }
  }
  halftone(ctx, bx, top + 14, W - bx, H - top, 5, (x) => 0.3 + ((x - bx) / (W - bx)) * 1.5, 'rgba(0,0,0,0.45)');

  // 아래쪽은 어둡게 (카드와 버튼이 잘 보이게)
  const shade = ctx.createLinearGradient(0, 230, 0, H);
  shade.addColorStop(0, 'rgba(14,16,22,0)');
  shade.addColorStop(0.3, 'rgba(14,16,22,0.7)');
  shade.addColorStop(1, 'rgba(10,12,18,0.96)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 230, W, H - 230);
  halftone(ctx, 0, 300, W, H - 300, 6, (x, y) => 0.4 + ((y - 300) / 240) * 1.1, 'rgba(60,70,90,0.18)');
}

// ------------------------------------------------------------
// 주인공 (검은 슈트, 노란 줄, 방독면, 갈색 머리) 정면으로 선 자세
// 캔버스 150 x 230, 발이 (75, 226) 쯤
// ------------------------------------------------------------
function drawHero(ctx) {
  const SUIT = '#2b2c31';
  const SUIT_L = '#45474e';
  const YEL = '#f0b323';
  const INK = '#0b0b0c';
  const poly = (pts, fill, line = 3) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (line) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = line;
      ctx.stroke();
    }
  };
  const stroke = (pts, color, w = 1.5) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  };

  // 다리 (벌리고 선 자세)
  poly([[58, 148], [74, 150], [70, 206], [56, 206], [50, 176]], SUIT);
  poly([[78, 150], [94, 148], [102, 176], [96, 206], [82, 206]], SUIT);
  poly([[52, 166], [55, 166], [57, 200], [55, 200]], YEL, 0);
  poly([[98, 166], [101, 168], [96, 200], [94, 200]], YEL, 0);
  // 부츠
  poly([[52, 204], [72, 204], [74, 222], [46, 224], [48, 214]], '#1d1e22');
  poly([[80, 204], [100, 204], [106, 214], [108, 224], [80, 222]], '#1d1e22');
  poly([[46, 221], [74, 219], [74, 225], [45, 226]], YEL, 2);
  poly([[80, 219], [108, 221], [109, 226], [80, 225]], YEL, 2);
  // 반바지
  poly([[52, 116], [98, 116], [104, 158], [80, 160], [75, 140], [70, 160], [46, 158]], '#1a1a1d');
  stroke([[72, 120], [70, 130]], YEL, 2);
  stroke([[78, 120], [80, 130]], YEL, 2);
  // 몸통 (역삼각형)
  poly([[34, 58], [116, 58], [106, 92], [98, 118], [52, 118], [44, 92]], SUIT);
  // 가슴 근육 그늘
  poly([[48, 66], [74, 68], [74, 86], [56, 88], [46, 78]], '#24252a', 0);
  poly([[102, 66], [76, 68], [76, 86], [94, 88], [104, 78]], '#24252a', 0);
  // 옆구리 노란 줄
  poly([[44, 74], [48, 75], [54, 116], [51, 116]], YEL, 1);
  poly([[106, 74], [102, 75], [96, 116], [99, 116]], YEL, 1);
  // 근육 선
  stroke([[75, 64], [75, 116]], SUIT_L, 1.5);
  stroke([[52, 70], [64, 84], [75, 84]], SUIT_L, 2);
  stroke([[98, 70], [86, 84], [75, 84]], SUIT_L, 2);
  for (let i = 0; i < 3; i++) {
    stroke([[64, 92 + i * 8], [86, 92 + i * 8]], 'rgba(90,92,100,0.7)', 1.2);
  }
  // 팔 (주먹 쥐고 살짝 벌림)
  poly([[36, 58], [50, 66], [48, 84], [43, 104], [40, 130], [26, 129], [25, 104], [22, 84], [27, 64]], SUIT);
  poly([[114, 58], [100, 66], [102, 84], [107, 104], [110, 130], [124, 129], [125, 104], [128, 84], [123, 64]], SUIT);
  stroke([[30, 80], [40, 88]], SUIT_L, 2);
  stroke([[120, 80], [110, 88]], SUIT_L, 2);
  // 어깨 노란 덮개
  poly([[28, 62], [42, 57], [46, 62], [32, 70]], YEL, 1.5);
  poly([[122, 62], [108, 57], [104, 62], [118, 70]], YEL, 1.5);
  // 팔뚝 보호대
  poly([[29, 112], [41, 114], [39, 124], [28, 122]], YEL, 1.5);
  poly([[121, 112], [109, 114], [111, 124], [122, 122]], YEL, 1.5);
  // 주먹
  poly([[26, 128], [40, 130], [41, 142], [34, 146], [25, 141]], '#1d1e22');
  poly([[124, 128], [110, 130], [109, 142], [116, 146], [125, 141]], '#1d1e22');
  stroke([[27, 136], [39, 137]], YEL, 1.5);
  stroke([[123, 136], [111, 137]], YEL, 1.5);

  // 목 + 노란 목도리
  poly([[64, 46], [86, 46], [88, 58], [62, 58]], SUIT);
  poly([[56, 52], [94, 52], [98, 62], [75, 68], [52, 62]], YEL, 2.5);
  stroke([[60, 56], [72, 64]], INK, 2);
  stroke([[88, 55], [80, 64]], INK, 2);

  // 머리
  ctx.beginPath();
  ctx.ellipse(75, 32, 15, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c9997a';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  // 방독면 (아래쪽 얼굴)
  poly([[61, 34], [89, 34], [90, 44], [82, 51], [68, 51], [60, 44]], '#3a3b40', 2.5);
  // 양옆 노란 필터와 가운데 필터
  [[59, 44], [91, 44]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = YEL;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#5a4210';
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(75, 46, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.stroke();
  // 둥근 고글 (노란 테, 하얀 렌즈)
  [[68, 29], [82, 29]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#d9a520';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = '#eef3f6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 1.6, y - 1.6, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  // 헝클어진 갈색 머리
  const hair = [[59, 32], [55, 24], [58, 22], [54, 14], [61, 15], [60, 7], [67, 11], [70, 3], [75, 9], [81, 2], [84, 10], [91, 6], [90, 14], [97, 15], [92, 21], [95, 27], [90, 31], [88, 22], [82, 25], [80, 19], [74, 24], [70, 18], [65, 24], [63, 21]];
  poly(hair, '#5b3b22', 2.5);
  stroke([[66, 14], [70, 19]], '#2e1d10', 1.5);
  stroke([[80, 10], [79, 18]], '#2e1d10', 1.5);

  // 잉크 그림자 망점 (오른쪽 몸)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  halftone(ctx, 80, 50, 60, 180, 3, (x) => (x - 80) * 0.025, 'rgba(0,0,0,0.35)');
  ctx.restore();
}

// ------------------------------------------------------------
// 스테이지 사진 (흑백 장면 120 x 66)
// ------------------------------------------------------------
function drawPhoto(ctx, W, H, kind) {
  const rnd = seeded(kind.length * 97 + kind.charCodeAt(0));
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  const ground = H * 0.75;
  const fillPoly = (pts, color) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const circle = (x, y, r, color, line) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (line) {
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  if (kind === 'water') {
    sky.addColorStop(0, '#bdbdbd');
    sky.addColorStop(1, '#2a2a2a');
  } else if (kind === 'lava') {
    sky.addColorStop(0, '#5a5a5a');
    sky.addColorStop(1, '#a8a8a8');
  } else if (kind === 'castle') {
    sky.addColorStop(0, '#3c3c3c');
    sky.addColorStop(1, '#8c8c8c');
  } else {
    sky.addColorStop(0, '#d6d6d6');
    sky.addColorStop(1, '#8e8e8e');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  if (kind === 'city') {
    // 무너진 빌딩들과 연기
    smokeCluster(ctx, [[86, 14, 12], [96, 8, 10], [76, 6, 9]], { fill: '#555', light: '#777', dark: '#333', ink: '#222', line: 1 });
    for (let x = -4; x < W; ) {
      const w = 12 + rnd() * 16;
      const h = 18 + rnd() * 30;
      const shade = 50 + Math.floor(rnd() * 50);
      const top = ground - h;
      fillPoly([[x, ground], [x, top + rnd() * 6], [x + w * 0.4, top], [x + w * 0.7, top + 8 * rnd()], [x + w, top + 4], [x + w, ground]], `rgb(${shade},${shade},${shade})`);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let wy = top + 5; wy < ground - 3; wy += 6) for (let wx = x + 2; wx < x + w - 3; wx += 5) ctx.fillRect(wx, wy, 2, 3);
      x += w + 1;
    }
    fillPoly([[0, ground], [W, ground], [W, H], [0, H]], '#5c5c5c');
    for (let i = 0; i < 14; i++) circle(rnd() * W, ground + 2 + rnd() * (H - ground), 2 + rnd() * 3, '#3a3a3a');
  } else if (kind === 'forest') {
    // 독 숲: 굵은 나무와 버섯, 낮게 깔린 안개
    fillPoly([[0, ground], [W, ground], [W, H], [0, H]], '#4a4a4a');
    for (let i = 0; i < 7; i++) {
      const x = 6 + i * 18 + rnd() * 6;
      const w = 5 + rnd() * 4;
      fillPoly([[x, ground + 2], [x + 1, 14], [x + w - 1, 14], [x + w, ground + 2]], `rgb(${40 + i * 6},${40 + i * 6},${40 + i * 6})`);
      const c = 70 + i * 8;
      // 뭉쳐 있는 잎 덩어리
      for (let j = 0; j < 4; j++) circle(x + w / 2 + (rnd() - 0.5) * 18, 8 + rnd() * 14, 8 + rnd() * 5, `rgb(${c},${c},${c})`, '#222');
    }
    [[22, 0.9], [60, 1.2], [96, 0.8]].forEach(([x, s]) => {
      fillPoly([[x - 1.5 * s, ground + 6], [x - 1.5 * s, ground - 2], [x + 1.5 * s, ground - 2], [x + 1.5 * s, ground + 6]], '#ddd');
      ctx.beginPath();
      ctx.ellipse(x, ground - 3 * s, 6 * s, 4 * s, 0, Math.PI, 0);
      ctx.fillStyle = '#eee';
      ctx.fill();
      circle(x - 2 * s, ground - 5 * s, 1.2 * s, '#555');
    });
    const fog = ctx.createLinearGradient(0, ground - 14, 0, H);
    fog.addColorStop(0, 'rgba(230,230,230,0)');
    fog.addColorStop(1, 'rgba(230,230,230,0.55)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, ground - 14, W, H);
  } else if (kind === 'lava') {
    // 용암: 화산과 연기 기둥, 갈라진 땅 사이로 밝은 용암
    fillPoly([[30, ground], [58, 20], [70, 20], [100, ground]], '#3a3a3a');
    smokeCluster(ctx, [[64, 14, 9], [58, 6, 8], [72, 4, 7], [66, -2, 8]], { fill: '#2a2a2a', light: '#444', dark: '#1a1a1a', ink: '#111', line: 1 });
    fillPoly([[0, ground - 6], [W, ground - 2], [W, H], [0, H]], '#262626');
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, H - 8);
    ctx.bezierCurveTo(30, H - 18, 50, H - 2, 80, ground + 6);
    ctx.bezierCurveTo(95, ground, 110, ground + 10, W, ground + 4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 7;
    ctx.stroke();
    for (let i = 0; i < 6; i++) circle(10 + rnd() * 100, ground - 10 - rnd() * 20, 1 + rnd(), '#fff');
  } else if (kind === 'ice') {
    // 얼음 산: 눈 덮인 봉우리와 고드름, 눈송이
    fillPoly([[-10, ground + 4], [28, 12], [52, ground + 4]], '#6a6a6a');
    fillPoly([[30, ground + 4], [76, 4], [124, ground + 4]], '#545454');
    fillPoly([[28, 12], [20, 26], [26, 24], [32, 28], [36, 22]], '#f4f4f4');
    fillPoly([[76, 4], [64, 22], [72, 18], [78, 24], [84, 18], [90, 22]], '#f4f4f4');
    fillPoly([[0, ground], [W, ground], [W, H], [0, H]], '#d8d8d8');
    for (let x = 4; x < W; x += 9) fillPoly([[x, ground], [x + 4, ground], [x + 2, ground + 5 + rnd() * 5]], '#9a9a9a');
    for (let i = 0; i < 16; i++) circle(rnd() * W, rnd() * ground, 0.8 + rnd() * 0.8, '#fff');
  } else if (kind === 'castle') {
    // 괴물 성: 달, 뾰족 탑, 박쥐
    circle(92, 16, 10, '#efefef');
    fillPoly([[0, ground], [W, ground], [W, H], [0, H]], '#2e2e2e');
    const c = '#151515';
    fillPoly([[30, ground], [30, 34], [90, 34], [90, ground]], c);
    for (let x = 30; x < 90; x += 8) fillPoly([[x, 34], [x, 30], [x + 4, 30], [x + 4, 34]], c);
    [[24, 20], [56, 10], [88, 22]].forEach(([x, top]) => {
      fillPoly([[x, ground], [x, top + 8], [x + 12, top + 8], [x + 12, ground]], c);
      fillPoly([[x - 2, top + 8], [x + 6, top - 6], [x + 14, top + 8]], c);
    });
    fillPoly([[54, ground], [54, 50], [60, 44], [66, 50], [66, ground]], '#777');
    ctx.fillStyle = '#999';
    [[36, 44], [78, 44], [60, 26]].forEach(([x, y]) => ctx.fillRect(x, y, 3, 5));
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    [[14, 12], [40, 6], [104, 32]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 1);
      ctx.quadraticCurveTo(x - 2, y + 1, x, y);
      ctx.quadraticCurveTo(x + 2, y + 1, x + 4, y - 1);
      ctx.stroke();
    });
  } else if (kind === 'water') {
    // 물속 던전: 빛줄기, 해초, 물고기, 거품
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    [[20, 10], [54, 14], [88, 10]].forEach(([x, w]) => fillPoly([[x, 0], [x + w, 0], [x + w * 2.2, H], [x + w * 0.6, H]], 'rgba(255,255,255,0.14)'));
    fillPoly([[0, ground + 4], [W, ground], [W, H], [0, H]], '#1e1e1e');
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    [10, 26, 98, 110].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, H);
      for (let y = H; y > ground - 22 - rnd() * 10; y -= 4) ctx.lineTo(x + Math.sin(y * 0.4) * 3, y);
      ctx.stroke();
    });
    fillPoly([[50, 28], [64, 22], [74, 28], [64, 34]], '#262626');
    fillPoly([[74, 28], [80, 23], [80, 33]], '#262626');
    circle(56, 27, 1, '#ccc');
    for (let i = 0; i < 9; i++) circle(30 + rnd() * 70, 8 + rnd() * 40, 1 + rnd() * 2.2, null, '#e8e8e8');
    fillPoly([[40, ground + 2], [46, ground - 10], [58, ground - 10], [64, ground + 2]], '#3a3a3a');
  }

  // 오래된 사진 느낌: 망점, 가장자리 어둡게, 긁힘
  halftone(ctx, 0, 0, W, H, 3, () => 0.45, 'rgba(0,0,0,0.12)');
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    const x = rnd() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * 10, H);
    ctx.stroke();
  }
}

// ------------------------------------------------------------
// 카드 바탕 (베이지 종이 / 고른 카드는 초록 + 노랑검정 경고 줄)
// ------------------------------------------------------------
function drawPaper(ctx, W, H) {
  const rnd = seeded(31);
  roughRectPath(ctx, 3, 3, W - 6, H - 6, 4, rnd, 6);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#e2d3ad');
  g.addColorStop(1, '#c6b388');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#4a3c24';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 10 + rnd() * 24;
    const s = ctx.createRadialGradient(x, y, 1, x, y, r);
    s.addColorStop(0, 'rgba(120,90,40,0.22)');
    s.addColorStop(1, 'rgba(120,90,40,0)');
    ctx.fillStyle = s;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  halftone(ctx, 0, 0, W, H, 4, () => 0.5, 'rgba(90,70,40,0.12)');
  ctx.restore();
}

function hazardBand(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#ffd400';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#111';
  for (let sx = x - h; sx < x + w + h; sx += 14) {
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + 7, y + h);
    ctx.lineTo(sx + 7 + h, y);
    ctx.lineTo(sx + h, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawGreenCard(ctx, W, H) {
  const rnd = seeded(44);
  ctx.fillStyle = '#2f9a2c';
  ctx.fillRect(4, 4, W - 8, H - 8);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(10,60,10,0.35)' : 'rgba(120,220,90,0.25)';
    ctx.beginPath();
    ctx.arc(4 + rnd() * (W - 8), 4 + rnd() * (H - 8), 3 + rnd() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  halftone(ctx, 4, 4, W - 8, H - 8, 4, () => 0.6, 'rgba(0,40,0,0.25)');
  hazardBand(ctx, 4, 4, W - 8, 11);
  hazardBand(ctx, 4, H - 15, W - 8, 11);
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}

function drawGlow(ctx, W, H) {
  ctx.shadowColor = 'rgba(255,225,60,1)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(255,230,80,0.9)';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.strokeRect(12, 12, W - 24, H - 24);
}

function drawPin(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(12, 19, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, 12);
  ctx.lineTo(11, 19);
  ctx.stroke();
  const g = ctx.createRadialGradient(7, 6, 1, 9, 8, 8);
  g.addColorStop(0, '#ff8a80');
  g.addColorStop(0.5, '#e02a1e');
  g.addColorStop(1, '#7a0d08');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(9, 8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#300';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// 리벳 박힌 철판 (조작법 판)
function drawPlate(ctx, W, H) {
  const rnd = seeded(5);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#b4b8bd');
  g.addColorStop(0.5, '#9a9ea4');
  g.addColorStop(1, '#7d8187');
  ctx.fillStyle = '#121315';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = g;
  ctx.fillRect(4, 4, W - 8, H - 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.strokeStyle = 'rgba(40,42,46,0.6)';
  ctx.strokeRect(11, 11, W - 22, H - 22);
  // 긁힌 자국
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(30,30,34,0.35)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 8);
    ctx.stroke();
  }
  halftone(ctx, 4, 4, W - 8, H - 8, 5, (x, y) => 0.3 + (y / H) * 0.6, 'rgba(0,0,0,0.12)');
  const bolt = (x, y) => {
    const b = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5);
    b.addColorStop(0, '#eef0f2');
    b.addColorStop(1, '#55595f');
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1b1d';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.lineTo(x + 2.5, y);
    ctx.stroke();
  };
  [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]].forEach(([x, y]) => bolt(x, y));
}

// 아래 버튼 3종: 빨간 낙서 물감, 파란 테이프, 회색 철판
function drawPaint(ctx, W, H) {
  const rnd = seeded(12);
  // 노란 물감 튄 자국
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = rnd() < 0.6 ? '#ffd43b' : '#ffffff';
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() < 0.5 ? rnd() * 10 : H - rnd() * 10, 1 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  roughRectPath(ctx, 10, 8, W - 20, H - 18, 7, rnd, 10);
  ctx.fillStyle = '#c62f25';
  ctx.fill();
  ctx.strokeStyle = '#2a0805';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // 흘러내린 물감
  ctx.fillStyle = '#c62f25';
  for (let i = 0; i < 5; i++) {
    const x = 20 + rnd() * (W - 40);
    const len = 4 + rnd() * 7;
    ctx.fillRect(x, H - 12, 3, len);
    ctx.beginPath();
    ctx.arc(x + 1.5, H - 12 + len, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  roughRectPath(ctx, 10, 8, W - 20, H - 18, 7, seeded(12), 10);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,120,100,0.35)';
  ctx.lineWidth = 2;
  for (let y = 12; y < H; y += 5) {
    ctx.beginPath();
    ctx.moveTo(8, y + rnd() * 2);
    ctx.lineTo(W - 8, y + rnd() * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTape(ctx, W, H) {
  const rnd = seeded(23);
  ctx.beginPath();
  ctx.moveTo(8, 6);
  ctx.lineTo(W - 8, 4);
  for (let y = 4; y <= H - 6; y += 5) ctx.lineTo(W - 8 + (y % 10 === 4 ? 5 : -2), y);
  ctx.lineTo(W - 6, H - 6);
  ctx.lineTo(8, H - 4);
  for (let y = H - 4; y >= 6; y -= 5) ctx.lineTo(8 + (y % 10 === 6 ? -5 : 2), y);
  ctx.closePath();
  ctx.fillStyle = '#4f74ad';
  ctx.fill();
  ctx.strokeStyle = '#0d1a2e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(10, 8, W - 20, 6);
  ctx.fillStyle = 'rgba(0,0,30,0.18)';
  ctx.fillRect(10, H - 14, W - 20, 6);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(10 + rnd() * (W - 30), 8 + rnd() * (H - 16), 10 + rnd() * 20, 1);
  }
}

function drawSteelButton(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#a9adb3');
  g.addColorStop(1, '#6b6f75');
  ctx.fillStyle = '#121315';
  ctx.fillRect(6, 4, W - 12, H - 8);
  ctx.fillStyle = g;
  ctx.fillRect(9, 7, W - 18, H - 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 10, W - 24, H - 20);
  [[17, 15], [W - 17, 15], [17, H - 15], [W - 17, H - 15]].forEach(([x, y]) => {
    ctx.fillStyle = '#d7dadd';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

// 제목 "쇼크 히어로": 하얀 붓글씨, 거친 검은 테두리, 먹물 튄 자국
function drawTitle(ctx, W, H, fontReady) {
  const rnd = seeded(77);
  const font = fontReady ? `76px ${TITLE_FONT}` : `900 70px ${BODY_FONT}`;
  // 뒤에 깔린 먹물 붓질과 튄 자국
  // 마른 붓으로 쓱 그은 자국: 굵기가 다른 가로 획을 여러 번 겹친다
  ctx.strokeStyle = '#0c0c0d';
  for (let i = 0; i < 26; i++) {
    const y = 26 + i * 2.6 + (rnd() - 0.5) * 3;
    const x0 = 12 + rnd() * 50;
    const x1 = W - 14 - rnd() * 60;
    ctx.lineWidth = 2 + rnd() * 6;
    ctx.globalAlpha = 0.55 + rnd() * 0.4;
    ctx.beginPath();
    ctx.moveTo(x0, y + 6);
    ctx.quadraticCurveTo(W / 2, y - 4 + (rnd() - 0.5) * 6, x1, y - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0c0c0d';
  for (let i = 0; i < 40; i++) {
    const side = rnd() < 0.5;
    const x = side ? rnd() * 60 : W - rnd() * 70;
    const y = 10 + rnd() * (H - 20);
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + rnd() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = W / 2;
  const cy = H / 2 + 2;
  // 거친 테두리: 조금씩 어긋나게 여러 번
  ctx.strokeStyle = '#000';
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = 12 + rnd() * 6;
    ctx.strokeText('쇼크 히어로', cx + (rnd() - 0.5) * 4, cy + (rnd() - 0.5) * 4);
  }
  ctx.fillStyle = '#f4f4f0';
  ctx.fillText('쇼크 히어로', cx, cy);
  // 붓이 마른 자국 (글자 위에만)
  const letters = document.createElement('canvas');
  letters.width = W;
  letters.height = H;
  const lc = letters.getContext('2d');
  lc.font = font;
  lc.textAlign = 'center';
  lc.textBaseline = 'middle';
  lc.fillStyle = '#fff';
  lc.fillText('쇼크 히어로', cx, cy);
  lc.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 70; i++) {
    lc.fillStyle = rnd() < 0.7 ? 'rgba(150,154,160,0.75)' : 'rgba(20,20,20,0.8)';
    lc.fillRect(rnd() * W, rnd() * H, 6 + rnd() * 30, 1 + rnd() * 1.5);
  }
  // 글자 아래쪽은 살짝 회색 (붓 결)
  const shade = lc.createLinearGradient(0, cy - 30, 0, cy + 34);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(110,114,120,0.45)');
  lc.fillStyle = shade;
  lc.fillRect(0, 0, W, H);
  // 결을 입힌 글자를 하얀 글자 위에 그대로 덮는다
  ctx.drawImage(letters, 0, 0);
  // 위에 튄 먹물 몇 방울
  ctx.fillStyle = '#000';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(80 + rnd() * (W - 160), 18 + rnd() * (H - 36), 1 + rnd() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 부제 "몬스터 브레이커": 검은 붓질 위 초록 붓글씨
function drawSubtitle(ctx, W, H, fontReady) {
  const rnd = seeded(91);
  ctx.fillStyle = '#0b0b0c';
  ctx.beginPath();
  ctx.moveTo(6, H * 0.35);
  for (let x = 6; x <= W - 6; x += 12) ctx.lineTo(x, H * 0.2 + (rnd() - 0.5) * 8);
  ctx.lineTo(W - 2, H * 0.55);
  for (let x = W - 6; x >= 6; x -= 12) ctx.lineTo(x, H * 0.85 + (rnd() - 0.5) * 8);
  ctx.closePath();
  ctx.fill();
  // 붓 끝 갈라진 털
  ctx.strokeStyle = '#0b0b0c';
  for (let i = 0; i < 10; i++) {
    ctx.lineWidth = 1 + rnd() * 2;
    const y = H * 0.25 + rnd() * H * 0.55;
    ctx.beginPath();
    ctx.moveTo(W - 20, y);
    ctx.lineTo(W + 2 - rnd() * 6, y + (rnd() - 0.5) * 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(rnd() * 6, y + (rnd() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.font = fontReady ? `32px ${TITLE_FONT}` : `900 30px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  ctx.strokeText('몬스터 브레이커', W / 2, H / 2 + 1);
  ctx.fillStyle = '#62f03a';
  ctx.fillText('몬스터 브레이커', W / 2, H / 2 + 1);
}

// ------------------------------------------------------------
// 텍스처 만들기 (타이틀 화면을 처음 그릴 때 한 번)
// ------------------------------------------------------------
export const PHOTO_W = 120;
export const PHOTO_H = 66;

export function makeTitleTextures(scene, fontReady) {
  canvasTex(scene, 'tt-bg', 960, 540, drawBackground);
  canvasTex(scene, 'tt-hero', 150, 230, drawHero);
  canvasTex(scene, 'tt-smoke0', 260, 130, (ctx) =>
    smokeCluster(ctx, puffBlobs(9, 130, 72, 220, 90, 18), { fill: '#6c7179', light: '#9ba0a7', dark: '#454950', line: 2 }),
  );
  canvasTex(scene, 'tt-smoke1', 220, 120, (ctx) =>
    smokeCluster(ctx, puffBlobs(11, 110, 66, 180, 80, 15), { fill: '#575c64', light: '#868b92', dark: '#363a40', line: 2 }),
  );
  for (let i = 0; i < 3; i++) canvasTex(scene, `tt-flame${i}`, 64, 96, (ctx) => drawFlame(ctx, 32, 94, 54, 86, 100 + i * 17));
  canvasTex(scene, 'tt-ember', 8, 8, (ctx) => {
    const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, '#fff2b0');
    g.addColorStop(0.5, '#ff9a1f');
    g.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 8);
  });
  canvasTex(scene, 'tt-dots', 8, 8, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.arc(2, 2, 1, 0, Math.PI * 2);
    ctx.arc(6, 6, 1, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTex(scene, 'tt-card-paper', 148, 124, drawPaper);
  canvasTex(scene, 'tt-card-green', 148, 124, drawGreenCard);
  canvasTex(scene, 'tt-card-glow', 172, 148, drawGlow);
  canvasTex(scene, 'tt-pin', 20, 24, drawPin);
  canvasTex(scene, 'tt-plate', 620, 96, drawPlate);
  canvasTex(scene, 'tt-btn-paint', 260, 48, drawPaint);
  canvasTex(scene, 'tt-btn-tape', 260, 48, drawTape);
  canvasTex(scene, 'tt-btn-steel', 260, 48, drawSteelButton);
  canvasTex(scene, 'tt-title', 560, 116, (ctx, w, h) => drawTitle(ctx, w, h, fontReady));
  canvasTex(scene, 'tt-sub', 300, 50, (ctx, w, h) => drawSubtitle(ctx, w, h, fontReady));
}

export function photoTexture(scene, kind) {
  const key = `tt-photo-${kind}`;
  canvasTex(scene, key, PHOTO_W, PHOTO_H, (ctx, w, h) => drawPhoto(ctx, w, h, kind));
  return key;
}

// 망토와 목도리 꼬리 (바람에 펄럭임). g 는 Graphics, t 는 초.
// (sx, sy): 오른쪽 어깨 자리
export function drawCape(g, sx, sy, t) {
  g.clear();
  const wave = (k, sp, amp) => Math.sin(t * sp + k * 3.2) * amp * k;
  // 망토: 어깨에서 오른쪽 아래로
  const top = [];
  const bottom = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    top.push({ x: sx - 34 + k * 120, y: sy + k * 26 + wave(k, 2.6, 10) });
    bottom.push({ x: sx - 30 + k * 104, y: sy + 120 - k * 50 + wave(k, 2.6, 14) });
  }
  g.fillStyle(0x0b0b0c, 1);
  g.fillPoints([...top, ...bottom.reverse()].map((p) => ({ x: p.x + 2, y: p.y + 2 })), true);
  g.fillStyle(0x3a3226, 1);
  g.fillPoints([...top, ...bottom], true);
  g.lineStyle(2, 0x0b0b0c, 1);
  g.strokePoints([...top, ...bottom], true);
  // 망토 안쪽 주름
  g.lineStyle(1.5, 0x221d16, 1);
  for (let j = 1; j < 4; j++) {
    const a = top[j * 2];
    const b = bottom[N - j * 2];
    g.lineBetween(a.x, a.y + 6, b.x, b.y - 6);
  }
  // 목도리 꼬리 두 갈래 (노란 천 띠, 검은 테두리)
  [[0, 3.4, 0, 112], [1, 3.0, 12, 88]].forEach(([n, sp, off, len]) => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      pts.push({ x: sx - 4 + k * len, y: sy - 10 + off + k * (6 + n * 12) + Math.sin(t * sp - k * 5 + n) * 8 * k });
    }
    const left = [];
    const right = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(i + 1, pts.length - 1)];
      const o = pts[Math.max(i - 1, 0)];
      const dx = q.x - o.x;
      const dy = q.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const w = (6 - (i / 12) * 3.5) * (1 + 0.25 * Math.sin(t * 5 + i));
      left.push({ x: p.x - (dy / d) * w, y: p.y + (dx / d) * w });
      right.push({ x: p.x + (dy / d) * w, y: p.y - (dx / d) * w });
    });
    // 끝은 갈라진 천
    const tip = pts[pts.length - 1];
    const ribbon = [...left, { x: tip.x + 6, y: tip.y + 4 }, { x: tip.x - 2, y: tip.y }, { x: tip.x + 6, y: tip.y - 4 }, ...right.reverse()];
    g.fillStyle(n ? 0xd99a12 : 0xf0b323, 1);
    g.fillPoints(ribbon, true);
    g.lineStyle(2, 0x0b0b0c, 1);
    g.strokePoints(ribbon, true);
    g.lineStyle(1.5, 0x1a1a1a, 0.8);
    g.strokePoints(pts.slice(2), false);
  });
}
