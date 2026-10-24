// 수중 던전(스테이지 6) 몬스터 그림. 캔버스에 직접 그린다 (곡선과 "24k" 글자를 쓰려고).
// customArt 로 같은 이름의 그림을 넣었으면 그쪽이 우선이다 (이미 있는 이름이면 건너뜀).

export function makeCanvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  tex.refresh();
}

const GOLD = '#f5c518';
const GOLD_LIGHT = '#ffe680';
const GOLD_DARK = '#8a6410';
const OUTLINE = '#3a2a08';

// 골드해파리 GX 의 금색 반구 머리 (아이 디자인: 24k 표시, 작은 가시, 화난 보라 눈)
function jellyDome(ctx, cx, top, w, h, { eyes = 'angry', mark = '24k' } = {}) {
  const l = cx - w / 2;
  const bottom = top + h;
  // 가시
  ctx.fillStyle = GOLD_DARK;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 7);
    const x = cx + Math.cos(a) * w * 0.48;
    const y = bottom - 4 + Math.sin(a) * h * 0.95;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 2);
    ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    ctx.lineTo(x + 3, y + 2);
    ctx.fill();
  }
  // 반구
  const grad = ctx.createLinearGradient(l, top, l + w, bottom);
  grad.addColorStop(0, GOLD_LIGHT);
  grad.addColorStop(0.45, GOLD);
  grad.addColorStop(1, '#c08a10');
  ctx.fillStyle = grad;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(l, bottom);
  ctx.bezierCurveTo(l - 2, top - 4, l + w + 2, top - 4, l + w, bottom);
  // 아래 가장자리 물결
  for (let i = 4; i >= 1; i--) {
    const x = l + (w * i) / 4;
    ctx.quadraticCurveTo(x - w / 8, bottom + 4, x - w / 4, bottom);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 반짝임
  ctx.fillStyle = 'rgba(255,255,230,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.22, top + h * 0.3, w * 0.1, h * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // 24k 표시
  if (mark) {
    ctx.fillStyle = GOLD_DARK;
    ctx.font = `bold ${Math.round(h * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(mark, cx + w * 0.06, top + h * 0.38);
  }
  // 눈
  const ey = top + h * 0.68;
  const ex = w * 0.2;
  if (eyes === 'angry') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#2a0a3a';
      ctx.beginPath();
      ctx.ellipse(cx + s * ex, ey, w * 0.1, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe680';
      ctx.beginPath();
      ctx.arc(cx + s * ex + s * 1, ey - 1, w * 0.035, 0, Math.PI * 2);
      ctx.fill();
      // 화난 눈썹
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + s * (ex + w * 0.13), ey - h * 0.24);
      ctx.lineTo(cx + s * (ex - w * 0.09), ey - h * 0.13);
      ctx.stroke();
    }
  } else {
    // 꼭 감은 눈 (경화)
    ctx.strokeStyle = '#2a0a3a';
    ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * ex - 4, ey);
      ctx.lineTo(cx + s * ex + 4, ey + 1);
      ctx.stroke();
    }
  }
}

// 촉수 하나 (금색, 끝은 분홍 보라)
function tentacle(ctx, x0, y0, len, phase, sway) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    pts.push({ x: x0 + Math.sin(phase + k * 3.2) * sway * k, y: y0 + len * k });
  }
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 5;
  path();
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  path();
  ctx.stroke();
  // 분홍 보라 끝
  const tip = pts.slice(6);
  ctx.strokeStyle = '#d070d8';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(tip[0].x, tip[0].y);
  for (const p of tip) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

export function makeSeaMonsterTextures(scene) {
  // 골드해파리 GX: 촉수가 흔들리는 그림 2장
  for (let f = 0; f < 2; f++) {
    makeCanvas(scene, `monster_jelly${f ? '_b' : ''}`, 64, 80, (ctx) => {
      for (let i = 0; i < 7; i++) {
        const x = 12 + i * 6.7;
        tentacle(ctx, x, 34, 34 + (i % 2) * 8, f * 1.6 + i * 0.9, 6);
      }
      jellyDome(ctx, 32, 6, 54, 32);
    });
  }
  // 순간 경화: 촉수를 말고 금빛으로 빛나는 단단한 공
  makeCanvas(scene, 'monster_jelly_ball', 64, 64, (ctx) => {
    const glow = ctx.createRadialGradient(32, 32, 10, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,240,150,0.9)');
    glow.addColorStop(1, 'rgba(255,220,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    // 말린 촉수
    ctx.strokeStyle = GOLD_DARK;
    ctx.lineWidth = 3;
    for (const [x, r] of [[22, 6], [32, 7], [42, 6]]) {
      ctx.beginPath();
      ctx.arc(x, 46, r, 0, Math.PI * 1.7);
      ctx.stroke();
    }
    jellyDome(ctx, 32, 12, 44, 34, { eyes: 'closed', mark: 'Q4k' });
  });
  // 독 쏘기: 전기 독 화살 (오른쪽으로 날아가는 모양)
  makeCanvas(scene, 'monster_jelly_bolt', 40, 20, (ctx) => {
    ctx.fillStyle = 'rgba(200,110,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(18, 10, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff59a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, 10);
    ctx.lineTo(10, 5);
    ctx.lineTo(16, 13);
    ctx.lineTo(24, 6);
    ctx.lineTo(30, 11);
    ctx.stroke();
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.ellipse(31, 10, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(33, 9, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // 가시복어 뿌뿌 (평소: 동글동글, 오른쪽을 보는 모습)
  makeCanvas(scene, 'monster_puffer', 60, 50, (ctx) => {
    ctx.fillStyle = '#e8a33a';
    ctx.strokeStyle = '#5a3410';
    ctx.lineWidth = 2;
    // 꼬리
    ctx.beginPath();
    ctx.moveTo(10, 25);
    ctx.lineTo(1, 14);
    ctx.lineTo(1, 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 몸
    ctx.beginPath();
    ctx.ellipse(32, 26, 22, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2b84a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff1c8';
    ctx.beginPath();
    ctx.ellipse(34, 34, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a5a1a';
    for (const [x, y] of [[22, 18], [30, 14], [26, 26], [38, 16]]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 지느러미
    ctx.fillStyle = '#d98a2a';
    ctx.beginPath();
    ctx.moveTo(30, 28);
    ctx.lineTo(22, 36);
    ctx.lineTo(32, 36);
    ctx.closePath();
    ctx.fill();
    // 눈과 입
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(42, 20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(44, 20, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(53, 28, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // 가시복어 부푼 모습: 가시가 잔뜩 선 큰 공 (때리면 따끔!)
  makeCanvas(scene, 'monster_puffer_big', 84, 84, (ctx) => {
    ctx.fillStyle = '#fff6d8';
    ctx.strokeStyle = '#5a3410';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(42 + Math.cos(a - 0.12) * 28, 42 + Math.sin(a - 0.12) * 28);
      ctx.lineTo(42 + Math.cos(a) * 41, 42 + Math.sin(a) * 41);
      ctx.lineTo(42 + Math.cos(a + 0.12) * 28, 42 + Math.sin(a + 0.12) * 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(42, 42, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#f2b84a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff1c8';
    ctx.beginPath();
    ctx.ellipse(44, 54, 20, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // 화난 눈
    for (const x of [34, 54]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, 36, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(x + 1, 37, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#5a3410';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(26, 25);
    ctx.lineTo(39, 30);
    ctx.moveTo(62, 25);
    ctx.lineTo(49, 30);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(44, 52, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 이빨 피라냐 (오른쪽을 보는 모습)
  makeCanvas(scene, 'monster_piranha', 56, 36, (ctx) => {
    ctx.strokeStyle = '#141c2a';
    ctx.lineWidth = 2;
    // 꼬리
    ctx.fillStyle = '#3a5a7a';
    ctx.beginPath();
    ctx.moveTo(12, 18);
    ctx.lineTo(1, 5);
    ctx.lineTo(4, 18);
    ctx.lineTo(1, 31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 몸
    ctx.fillStyle = '#4f7598';
    ctx.beginPath();
    ctx.ellipse(30, 17, 19, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 빨간 배
    ctx.fillStyle = '#e04a3a';
    ctx.beginPath();
    ctx.ellipse(32, 24, 14, 6, 0, 0, Math.PI);
    ctx.fill();
    // 등지느러미
    ctx.fillStyle = '#3a5a7a';
    ctx.beginPath();
    ctx.moveTo(22, 6);
    ctx.lineTo(30, -2);
    ctx.lineTo(34, 6);
    ctx.closePath();
    ctx.fill();
    // 큰 턱과 이빨
    ctx.fillStyle = '#2a3a52';
    ctx.beginPath();
    ctx.moveTo(42, 18);
    ctx.lineTo(55, 14);
    ctx.lineTo(55, 26);
    ctx.lineTo(40, 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(43 + i * 3, 18);
      ctx.lineTo(44.5 + i * 3, 22);
      ctx.lineTo(46 + i * 3, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(42 + i * 3, 27);
      ctx.lineTo(43.5 + i * 3, 23);
      ctx.lineTo(45 + i * 3, 27);
      ctx.fill();
    }
    // 화난 빨간 눈
    ctx.fillStyle = '#ffdd33';
    ctx.beginPath();
    ctx.arc(40, 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0101a';
    ctx.beginPath();
    ctx.arc(41, 11, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#141c2a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(35, 5);
    ctx.lineTo(45, 8);
    ctx.stroke();
  });

  // 집게 꽃게 (바닥을 걷는 게, 오른쪽을 보는 모습)
  makeCanvas(scene, 'monster_crab', 60, 48, (ctx) => {
    ctx.strokeStyle = '#5a1408';
    ctx.lineWidth = 3;
    // 다리
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(18 + i * 4, 34);
      ctx.lineTo(8 + i * 3, 46);
      ctx.moveTo(38 + i * 4, 34);
      ctx.lineTo(46 + i * 4, 46);
      ctx.stroke();
    }
    // 집게
    ctx.fillStyle = '#e85a30';
    ctx.lineWidth = 2;
    for (const [x, y] of [[8, 12], [52, 12]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#14324a';
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 2, y - 1);
      ctx.lineTo(x - 2, y - 1);
      ctx.fill();
      ctx.fillStyle = '#e85a30';
    }
    ctx.beginPath();
    ctx.moveTo(12, 20);
    ctx.lineTo(18, 28);
    ctx.moveTo(48, 20);
    ctx.lineTo(42, 28);
    ctx.stroke();
    // 등딱지
    ctx.fillStyle = '#d8462a';
    ctx.beginPath();
    ctx.ellipse(30, 30, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f07a50';
    ctx.beginPath();
    ctx.ellipse(27, 26, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 눈자루
    ctx.strokeStyle = '#5a1408';
    ctx.beginPath();
    ctx.moveTo(25, 20);
    ctx.lineTo(24, 12);
    ctx.moveTo(35, 20);
    ctx.lineTo(37, 12);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const x of [24, 37]) {
      ctx.beginPath();
      ctx.arc(x, 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(25, 10, 2, 0, Math.PI * 2);
    ctx.arc(38, 10, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 헤엄 거품
  makeCanvas(scene, 'swim_bubble', 12, 12, (ctx) => {
    ctx.strokeStyle = 'rgba(210,250,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(6, 6, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(4.5, 4.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  });
}
