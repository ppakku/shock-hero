// 타이틀 화면의 자리 계산 (Phaser 없이 계산만 해서 테스트할 수 있다)

// 스테이지 카드 한 장의 기본 크기 (배율 1일 때)
export const CARD_W = 148;
export const CARD_H = 124;

// 스테이지 카드 자리: 몇 장이든 화면 폭(960)에 맞춘다.
// 7장까지는 한 줄로 놓고 필요하면 줄이고, 더 많으면 두 줄로 나눈다.
// 돌려주는 값: { rows, perRow, scale, w, h, positions: [{ x, y }] } (x, y 는 카드 가운데)
export function cardLayout(count, { width = 960, top = 250, height = CARD_H, margin = 20, gap = 12 } = {}) {
  const n = Math.max(1, count);
  const rows = n <= 7 ? 1 : 2;
  const perRow = Math.ceil(n / rows);
  const fitW = (width - margin * 2 - (perRow - 1) * gap) / (perRow * CARD_W);
  const fitH = (height - (rows - 1) * gap) / (rows * CARD_H);
  const scale = Math.min(1, fitW, fitH);
  const w = CARD_W * scale;
  const h = CARD_H * scale;
  const positions = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - r * perRow);
    const c = i - r * perRow;
    const rowW = inRow * w + (inRow - 1) * gap;
    positions.push({
      x: Math.round(width / 2 - rowW / 2 + w / 2 + c * (w + gap)),
      y: Math.round(top + h / 2 + r * (h + gap)),
    });
  }
  return { rows, perRow, scale, w, h, positions };
}

// 조작법 한 줄을 글자 조각과 키 조각으로 나눈다. 키 조각은 키보드 버튼 모양으로 그린다.
// 예: '이동 A / D' → [{ type: 'text', text: '이동' }, { type: 'key', text: 'A' }, { type: 'text', text: '/' }, { type: 'key', text: 'D' }]
// wide: 앞에 빈칸이 두 칸 이상 있었는지 (묶음 사이를 넓게 띄운다)
const KEY_RE = /^(Space|Shift|Esc|Enter|Tab|[A-Z]|←|→|↑|↓)$/;

export function tokenizeControlLine(line) {
  const out = [];
  const parts = String(line).split(/( +)/);
  let wide = false;
  for (const p of parts) {
    if (!p) continue;
    if (/^ +$/.test(p)) {
      if (p.length >= 2) wide = true;
      continue;
    }
    const isKey = KEY_RE.test(p);
    const last = out[out.length - 1];
    if (!isKey && last && last.type === 'text' && !wide) {
      last.text += ` ${p}`;
    } else {
      out.push({ type: isKey ? 'key' : 'text', text: p, wide: out.length > 0 && wide });
    }
    wide = false;
  }
  return out;
}

// 스테이지 사진에 그릴 장면. 스테이지 파일에 titlePhoto 를 적으면 그것을 쓰고,
// 없으면 이름을 보고, 그래도 모르면 순서대로 고른다.
export const PHOTO_KINDS = ['city', 'forest', 'lava', 'ice', 'castle', 'water'];
const NAME_HINTS = [
  ['water', /바다|바닷|수중|해저|심해|물속|물 속|잠수/], // '괴물' 의 '물' 은 고르지 않게
  ['lava', /용암|화산/],
  ['ice', /얼음|빙하|설산/],
  ['forest', /숲|정글|나무/],
  ['castle', /성|궁/],
  ['city', /도시|마을|거리/],
];

export function photoKind(stage, index) {
  if (stage && PHOTO_KINDS.includes(stage.titlePhoto)) return stage.titlePhoto;
  const name = (stage && stage.name) || '';
  for (const [kind, re] of NAME_HINTS) if (re.test(name)) return kind;
  return PHOTO_KINDS[index % PHOTO_KINDS.length];
}

// 카드가 조금씩 기울어진 각도 (도). 같은 순서면 늘 같은 각도.
export function cardTilt(index) {
  return [-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5][index % 8];
}
