import { FONT } from './text.js';

// 길가 안내판: 배경 그림처럼 굵은 검은 테두리와 만화식 명암으로 그린다.
// 스테이지 바닥 그림(theme.groundImage)에 맞춰 재질이 달라진다. theme.signStyle 로 직접 고를 수도 있다.
const OUTLINE = 0x140c06;

export const SIGN_STYLES = {
  // 부서진 도시: 낡은 나무판
  wood: { board: 0x9a6a3c, light: 0xb98450, dark: 0x6e4524, post: 0x5a3a20, ink: '#fff4dc', inkStroke: '#3a2210', deco: 'planks' },
  // 숲: 이끼 낀 나무판
  moss: { board: 0x8a6438, light: 0xa97c48, dark: 0x5e4020, post: 0x4e3418, ink: '#fff4dc', inkStroke: '#2e1c0c', deco: 'moss' },
  // 화산: 검은 돌판, 틈에서 용암 빛
  lava: { board: 0x3a302c, light: 0x564840, dark: 0x221a16, post: 0x2a2220, ink: '#ffe2b0', inkStroke: '#1a0a04', deco: 'embers' },
  // 얼음 산: 얼음판
  ice: { board: 0x8cc8e8, light: 0xc4ecff, dark: 0x5a96c0, post: 0x6a5a50, ink: '#0e2a44', inkStroke: '#e8f8ff', deco: 'frost' },
  // 성: 회색 돌판, 쇠 테두리
  stone: { board: 0x6e6a78, light: 0x8e8a98, dark: 0x4a4654, post: 0x3a3640, ink: '#f4f0ff', inkStroke: '#1c1a24', deco: 'bolts' },
  // 물속: 물에 젖은 나무판, 따개비
  sea: { board: 0x4e7a6e, light: 0x6a9a8a, dark: 0x30564c, post: 0x3a4a40, ink: '#eafff8', inkStroke: '#0c2420', deco: 'barnacles' },
  // 공장: 쇠판, 노랑 검정 경고 줄무늬
  metal: { board: 0x6a7078, light: 0x8a9098, dark: 0x464c54, post: 0x30343a, ink: '#ffffff', inkStroke: '#14181c', deco: 'hazard' },
};

const BY_GROUND = { city: 'wood', forest: 'moss', lava: 'lava', ice: 'ice', castle: 'stone', sea: 'sea', factory: 'metal' };

export function signStyleFor(theme = {}) {
  if (theme.signStyle && SIGN_STYLES[theme.signStyle]) return theme.signStyle;
  const prefix = (theme.groundImage?.key || '').split('_')[0];
  return BY_GROUND[prefix] || 'wood';
}

// x: 기둥 가운데, groundY: 땅 높이, boardBottom: 판 아래쪽 높이 (땅에서 위로 몇 픽셀)
export function drawSignboard(scene, x, groundY, text, styleName = 'wood', boardBottom = 120) {
  const s = SIGN_STYLES[styleName] || SIGN_STYLES.wood;
  const label = scene.add
    .text(x, 0, text, {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: s.ink, align: 'center',
      stroke: s.inkStroke, strokeThickness: 4, lineSpacing: 2,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(1);

  const padX = 18, padY = 14;
  const w = Math.ceil(label.width + padX * 2);
  const h = Math.ceil(label.height + padY * 2);
  const bottom = groundY - boardBottom;
  const top = bottom - h;
  const left = x - w / 2;
  label.setY(top + h / 2);

  const g = scene.add.graphics().setDepth(0.5);

  // 기둥 두 개 (판이 좁으면 하나)
  const posts = w > 150 ? [left + 22, left + w - 22] : [x];
  for (const px of posts) {
    g.fillStyle(OUTLINE, 1).fillRect(px - 7, bottom - 6, 14, boardBottom + 6);
    g.fillStyle(s.post, 1).fillRect(px - 4, bottom - 6, 8, boardBottom + 3);
    g.fillStyle(0x000000, 0.25).fillRect(px + 1, bottom - 6, 3, boardBottom + 3);
  }
  // 땅에 박힌 자리
  for (const px of posts) g.fillStyle(0x000000, 0.3).fillEllipse(px, groundY, 26, 6);

  // 판 그림자
  g.fillStyle(0x000000, 0.3).fillRoundedRect(left + 5, top + 6, w, h, 10);
  // 굵은 검은 테두리
  g.fillStyle(OUTLINE, 1).fillRoundedRect(left - 3, top - 3, w + 6, h + 6, 12);
  // 판 바탕, 아래쪽 그늘, 위쪽 빛
  g.fillStyle(s.board, 1).fillRoundedRect(left, top, w, h, 9);
  g.fillStyle(s.dark, 1).fillRoundedRect(left, top + h * 0.62, w, h * 0.38, { tl: 0, tr: 0, bl: 9, br: 9 });
  g.fillStyle(s.light, 1).fillRoundedRect(left + 4, top + 3, w - 8, 6, 3);

  decorate(g, s, left, top, w, h);
  return { label, g, left, right: left + w, top, bottom };
}

function decorate(g, s, left, top, w, h) {
  const right = left + w;
  switch (s.deco) {
    case 'planks':
    case 'moss':
    case 'barnacles': {
      // 나무판 이음새
      g.lineStyle(2, OUTLINE, 0.45);
      for (let y = top + h / 3; y < top + h - 6; y += h / 3) g.lineBetween(left + 3, y, right - 3, y);
      // 못
      for (const [nx, ny] of [[left + 9, top + 9], [right - 9, top + 9], [left + 9, top + h - 9], [right - 9, top + h - 9]]) {
        g.fillStyle(OUTLINE, 1).fillCircle(nx, ny, 3);
        g.fillStyle(0xd8c8a8, 1).fillCircle(nx - 0.5, ny - 0.5, 1.5);
      }
      if (s.deco === 'moss') {
        g.fillStyle(0x4a8a2a, 1);
        for (let mx = left + 6; mx < right - 6; mx += 22) g.fillEllipse(mx + ((mx * 7) % 9), top + 1, 16, 7);
        g.fillStyle(0x7ac04a, 1);
        for (let mx = left + 10; mx < right - 10; mx += 30) g.fillEllipse(mx, top, 8, 4);
      }
      if (s.deco === 'barnacles') {
        for (const [bx, by] of [[left + 16, top + h - 6], [left + 26, top + h - 4], [right - 20, top + 6]]) {
          g.fillStyle(OUTLINE, 1).fillCircle(bx, by, 5);
          g.fillStyle(0xd8e0d0, 1).fillCircle(bx, by, 3.5);
          g.fillStyle(0x7a8a80, 1).fillCircle(bx, by, 1.5);
        }
      }
      break;
    }
    case 'embers': {
      // 돌 틈에서 새어 나오는 용암 빛
      g.lineStyle(2, 0xff7a1a, 0.9);
      g.lineBetween(left + 10, top + h - 4, left + 22, top + h - 14).lineBetween(left + 22, top + h - 14, left + 30, top + h - 10);
      g.lineBetween(right - 8, top + 6, right - 18, top + 16);
      g.fillStyle(0xffb040, 0.9).fillCircle(left + 22, top + h - 14, 2);
      break;
    }
    case 'frost': {
      // 위쪽에 눈, 아래로 고드름
      g.fillStyle(0xffffff, 1).fillRoundedRect(left - 2, top - 4, w + 4, 8, 4);
      g.fillStyle(0xe8f8ff, 1);
      for (let ix = left + 12; ix < right - 10; ix += 26) g.fillTriangle(ix - 4, top + h, ix + 4, top + h, ix, top + h + 10);
      g.lineStyle(1.5, 0xffffff, 0.7).lineBetween(left + 8, top + 14, left + 18, top + 24);
      break;
    }
    case 'bolts':
    case 'hazard': {
      // 쇠 테두리와 리벳
      g.lineStyle(3, s.dark, 1).strokeRoundedRect(left + 4, top + 4, w - 8, h - 8, 6);
      for (const [nx, ny] of [[left + 9, top + 9], [right - 9, top + 9], [left + 9, top + h - 9], [right - 9, top + h - 9]]) {
        g.fillStyle(OUTLINE, 1).fillCircle(nx, ny, 3.5);
        g.fillStyle(s.light, 1).fillCircle(nx - 0.5, ny - 0.5, 2);
      }
      if (s.deco === 'hazard') {
        // 판 아래 경고 줄무늬
        const y0 = top + h + 3, sh = 8;
        g.fillStyle(OUTLINE, 1).fillRect(left + 10, y0, w - 20, sh + 2);
        g.fillStyle(0xf2c21c, 1).fillRect(left + 11, y0, w - 22, sh);
        g.fillStyle(0x1a1a1a, 1);
        for (let hx = left + 11; hx < right - 19; hx += 16) g.fillTriangle(hx, y0 + sh, hx + 8, y0, hx + 14, y0).fillTriangle(hx, y0 + sh, hx + 6, y0 + sh, hx + 14, y0);
      }
      break;
    }
  }
}
