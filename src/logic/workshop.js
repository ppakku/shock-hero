// 몬스터 공방: 아이들이 생김새, 색, 크기, 움직임, 이름을 골라 나만의 몬스터를 만든다.
// 만든 몬스터는 고른 스테이지에 나오고, 도감 '공방' 칸에 작가 이름과 함께 올라간다.
// 저장: save.workshop = { designs: [작품], next: 다음 번호 }. 작품은 최대 MAX_DESIGNS 개.
// 화면과 상관없는 계산만 여기 둔다 (색 바꾸기도 픽셀 배열만 다룬다). 그림 만들기는 src/fx/workshopTextures.js
import { parseMonsterSpot } from './monsters.js';
import { PLAYERS } from './rush.js';

export const MAX_DESIGNS = 3;
export const NAME_MAX = 10;
export const INTRO_MAX = 40;

// 생김새: 도감에 있는 걷는 몬스터 그림. free 는 처음부터, 나머지는 도감에서 한 번 잡으면 쓸 수 있다
export const LOOKS = [
  { id: 'monster', name: '초록 몬스터', free: true },
  { id: 'monster_fast', name: '빨강 날쌘돌이', free: true },
  { id: 'monster_tank', name: '파랑 뚱보', free: true },
  { id: 'monster_jumper', name: '보라 뜀뛰기', free: true },
  { id: 'monster_forest_fast', name: '독버섯 날쌘돌이' },
  { id: 'monster_forest_tank', name: '이끼 뚱보' },
  { id: 'monster_lava_basic', name: '불꽃 슬라임' },
  { id: 'monster_lava_tank', name: '마그마 뚱보' },
  { id: 'monster_lava_jumper', name: '불씨 뜀뛰기' },
  { id: 'monster_ice_basic', name: '얼음 슬라임' },
  { id: 'monster_ice_fast', name: '서리 도깨비' },
  { id: 'monster_ice_tank', name: '설인 뚱보' },
  { id: 'monster_ice_jumper', name: '얼음 뜀뛰기' },
];

// 색: hue 는 몸의 주된 색을 이 색상환 각도로 돌린다. gold, shadow 는 따로 칠한다
export const COLORS = [
  { id: 'orig', name: '원래 색', swatch: null },
  { id: 'red', name: '빨강', hue: 0, swatch: 0xe8402a },
  { id: 'orange', name: '주황', hue: 28, swatch: 0xff8a1a },
  { id: 'yellow', name: '노랑', hue: 54, swatch: 0xffe14a },
  { id: 'green', name: '초록', hue: 120, swatch: 0x3fc04a },
  { id: 'sky', name: '하늘', hue: 192, swatch: 0x4ac8f0 },
  { id: 'blue', name: '파랑', hue: 226, swatch: 0x3a5ae8 },
  { id: 'purple', name: '보라', hue: 276, swatch: 0x9a4ae0 },
  { id: 'pink', name: '분홍', hue: 322, swatch: 0xff6ac0 },
  { id: 'gold', name: '황금', swatch: 0xd8a820 },
  { id: 'shadow', name: '그림자', swatch: 0x2a2a3a },
];

// 크기: scale 은 보통 몬스터에 견준 크기, hp 는 체력 배수. 거대는 한 마리만 나온다
export const SIZES = [
  { id: 's', name: '꼬마', scale: 0.7, hp: 0.6, count: 2 },
  { id: 'm', name: '보통', scale: 1, hp: 1, count: 2 },
  { id: 'l', name: '왕', scale: 1.35, hp: 1.6, count: 2 },
  { id: 'xl', name: '거대', scale: 1.75, hp: 2.4, count: 1 },
];

// 움직임: 게임 속 몬스터 종류 (src/enemies/Monster.js 가 움직인다)
export const MOVES = [
  { id: 'basic', name: '꿀렁 박치기', desc: '꿀렁꿀렁 다가와 몸통 박치기' },
  { id: 'fast', name: '쌩쌩 돌진', desc: '아주 빠르게 달려들지만 약해요' },
  { id: 'tank', name: '쿵쿵 한 방', desc: '느리지만 튼튼하고 아프게 때려요' },
  { id: 'jumper', name: '폴짝 덮치기', desc: '높이 뛰어 위에서 덮쳐요' },
];

const NAME_FRONT = ['불꽃', '얼음', '번개', '꿀렁', '쿵쿵', '말랑', '뾰족', '방귀', '꼬질', '반짝', '왕눈', '털북'];
const NAME_BACK = ['주먹', '젤리', '도깨비', '대장', '괴물', '돌이', '벌레', '킹', '몬', '공', '방울', '발톱'];

const ids = (list) => list.map((e) => e.id);
const pick = (list, id, fallback) => (ids(list).includes(id) ? id : fallback);

// 이름 다듬기: 앞뒤 빈칸, 줄바꿈, 꺾쇠 같은 기호를 빼고 max 글자까지
export function cleanText(str, max) {
  if (typeof str !== 'string') return '';
  const s = str.replace(/\s+/g, ' ').replace(/[\u0000-\u001f<>{}\\]/g, '').trim();
  return [...s].slice(0, max).join('');
}

export function randomName(rand = Math.random) {
  const a = NAME_FRONT[Math.floor(rand() * NAME_FRONT.length) % NAME_FRONT.length];
  const b = NAME_BACK[Math.floor(rand() * NAME_BACK.length) % NAME_BACK.length];
  return `${a}${b}`;
}

export function emptyWorkshop() {
  return { designs: [], next: 1 };
}

// 새 작품의 처음 모양
export function newDesign(n, maker = PLAYERS[2]) {
  return { id: `w${n}`, name: `내 몬스터 ${n}`, intro: '', look: 'monster', color: 'orig', size: 'm', move: 'basic', maker, stage: 1, caught: 0 };
}

export function normalizeDesign(d, stageCount = 99) {
  if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !/^w\d{1,4}$/.test(d.id)) return null;
  const stage = Number.isInteger(d.stage) && d.stage >= 1 && d.stage <= stageCount ? d.stage : 1;
  return {
    id: d.id,
    name: cleanText(d.name, NAME_MAX) || '이름 없는 몬스터',
    intro: cleanText(d.intro, INTRO_MAX),
    look: pick(LOOKS, d.look, 'monster'),
    color: pick(COLORS, d.color, 'orig'),
    size: pick(SIZES, d.size, 'm'),
    move: pick(MOVES, d.move, 'basic'),
    maker: PLAYERS.includes(d.maker) ? d.maker : PLAYERS[2],
    stage,
    caught: Number.isInteger(d.caught) && d.caught > 0 ? d.caught : 0,
  };
}

export function normalizeWorkshop(data, stageCount = 99) {
  const w = emptyWorkshop();
  if (!data || typeof data !== 'object') return w;
  const seen = new Set();
  for (const raw of Array.isArray(data.designs) ? data.designs : []) {
    const d = normalizeDesign(raw, stageCount);
    if (!d || seen.has(d.id) || w.designs.length >= MAX_DESIGNS) continue;
    seen.add(d.id);
    w.designs.push(d);
  }
  const top = Math.max(0, ...w.designs.map((d) => Number(d.id.slice(1))));
  w.next = Number.isInteger(data.next) && data.next > top ? data.next : top + 1;
  return w;
}

// 작품 저장하기 (같은 id 면 고치기, 없으면 새로 넣기). 잡은 수는 그대로 둔다
export function saveDesign(workshop, design, stageCount = 99) {
  const w = normalizeWorkshop(workshop, stageCount);
  const d = normalizeDesign(design, stageCount);
  if (!d) return w;
  const i = w.designs.findIndex((x) => x.id === d.id);
  if (i >= 0) {
    w.designs[i] = { ...d, caught: w.designs[i].caught };
    return w;
  }
  if (w.designs.length >= MAX_DESIGNS) return w;
  w.designs.push({ ...d, caught: 0 });
  w.next = Math.max(w.next, Number(d.id.slice(1)) + 1);
  return w;
}

export function removeDesign(workshop, id) {
  const w = normalizeWorkshop(workshop);
  return { ...w, designs: w.designs.filter((d) => d.id !== id) };
}

// 게임에서 작품을 잡았을 때. first: 처음 잡았는지
export function recordCatch(workshop, id) {
  const w = normalizeWorkshop(workshop);
  const d = w.designs.find((x) => x.id === id);
  if (!d) return { workshop: w, first: false, design: null };
  d.caught += 1;
  return { workshop: w, first: d.caught === 1, design: d };
}

// 쓸 수 있는 생김새: 처음부터 되는 넷 + 도감에서 잡은 것
export function lookUnlocked(look, dex) {
  return Boolean(look.free || dex?.monsters?.[look.id]);
}

// 나올 수 있는 스테이지: 열린 스테이지 중 물속이 아닌 곳 (물속은 헤엄치는 몬스터만 다닌다)
export function stageChoices(save, stages) {
  const out = [];
  const top = Math.min(save.unlocked || 1, stages.length);
  for (let n = 1; n <= top; n++) if (!stages[n - 1].swim) out.push(n);
  return out.length ? out : [1];
}

// 이 스테이지에 놓을 작품 몬스터 자리. 원래 몬스터 자리 중 땅 위에 있고 보스 문보다 앞인 곳 옆에 고르게 놓는다
export function workshopSpots(stage, designs) {
  if (!stage || stage.swim) return [];
  const groundY = stage.groundY || 480;
  const gateX = stage.gateX || Infinity;
  const ground = (stage.monsters || [])
    .map((s) => parseMonsterSpot(s, groundY))
    .filter((s) => s.y >= groundY - 1 && s.x + 70 < gateX - 60)
    .sort((a, b) => a.x - b.x);
  const copies = [];
  for (const d of designs.filter(Boolean)) {
    const count = SIZES.find((s) => s.id === d.size)?.count || 1;
    for (let c = 0; c < count; c++) copies.push(d);
  }
  const out = [];
  if (!ground.length) return out;
  // 앞쪽부터 뒤쪽까지 고르게 퍼지게
  copies.forEach((d, k) => {
    const slot = ground[Math.min(ground.length - 1, Math.floor(((k + 0.5) * ground.length) / copies.length))];
    out.push({ x: slot.x + 70, y: groundY, type: d.move, workshop: d });
  });
  return out;
}

// 몬스터 숫자에 작품 크기 반영 (monsterStats 결과 m 에)
export function workshopStats(m, design) {
  const s = SIZES.find((x) => x.id === design.size) || SIZES[1];
  return { ...m, size: s.scale, maxHealth: Math.max(1, Math.round(m.maxHealth * s.hp)), xp: Math.round(m.xp * s.hp) };
}

export function textureKey(design) {
  return `ws_${design.look}_${design.color}`;
}

export function moveName(id) {
  return MOVES.find((m) => m.id === id)?.name || '';
}

export function sizeName(id) {
  return SIZES.find((m) => m.id === id)?.name || '';
}

// ---------- 색 바꾸기 (RGBA 픽셀 배열을 바로 고친다) ----------

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const COLORFUL = 0.22; // 이보다 채도가 낮은 픽셀(눈 흰자, 검은 선)은 그대로 둔다

// 몸의 주된 색 (진한 색 픽셀들의 색상환 평균 각도). 색 있는 픽셀이 없으면 null
export function dominantHue(px) {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    if (s < COLORFUL || l < 0.12 || l > 0.9) continue;
    const w = s;
    sx += Math.cos((h * Math.PI) / 180) * w;
    sy += Math.sin((h * Math.PI) / 180) * w;
  }
  if (Math.abs(sx) + Math.abs(sy) < 1e-6) return null;
  return (((Math.atan2(sy, sx) * 180) / Math.PI) % 360 + 360) % 360;
}

// colorId 로 픽셀 칠하기. 원래 색이면 그대로
export function recolorPixels(px, colorId) {
  const c = COLORS.find((x) => x.id === colorId);
  if (!c || c.id === 'orig') return px;
  const base = dominantHue(px);
  const shift = typeof c.hue === 'number' && base !== null ? c.hue - base : 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    let [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    if (s < COLORFUL) {
      if (c.id === 'shadow' && l < 0.85) l *= 0.6; // 그림자: 회색 부분도 어둡게 (흰 눈은 그대로)
      else continue;
    } else if (c.id === 'gold') {
      // 황금: 몸의 밝기는 살리고 금빛으로
      h = 44 + (l - 0.5) * 16;
      s = Math.max(0.65, s);
      l = Math.min(0.85, l * 1.08 + 0.04);
    } else if (c.id === 'shadow') {
      h = 250;
      s *= 0.35;
      l *= 0.38;
    } else {
      h += shift;
    }
    const [r, g, b] = hslToRgb(h, s, l);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  return px;
}
