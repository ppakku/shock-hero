import { chargeRatio } from './combat.js';

// 고를 수 있는 주인공 3명. 버튼은 같지만 싸우는 방법이 다르다.
// shock: 쇼크 히어로 (주먹 근접형, 원래 주인공)
// gunner: 번개 사수 (멀리서 쏘는 원거리형, 체력 적음)
// giant: 강철 거인 (느리지만 세고 넓게 때리는 힘센형, 체력 많음)
export const HERO_IDS = ['shock', 'gunner', 'giant'];

export const HERO_INFO = {
  shock: {
    name: '쇼크 히어로',
    short: '주먹으로 싸워요',
    lines: ['펀치, 꾹 누르면 충전 펀치', '대시로 빠르게 피하기', '궁극기: 쇼크 임팩트'],
    ultName: '쇼크 임팩트!',
    color: '#3fd0ff',
  },
  gunner: {
    name: '번개 사수',
    short: '멀리서 쏴요, 체력은 적어요',
    lines: ['번개탄 연사, 꾹 누르면 레이저', '대시로 빠르게 피하기', '궁극기: 번개비'],
    ultName: '번개비!',
    color: '#ffe14a',
  },
  giant: {
    name: '강철 거인',
    short: '느리지만 세요, 체력이 많아요',
    lines: ['망치 내려찍기, 꾹 누르면 회오리', '대시는 몸통 박치기', '궁극기: 대지진'],
    ultName: '대지진!',
    color: '#ff9a3a',
  },
};

export const normalizeHero = (id) => (HERO_IDS.includes(id) ? id : 'shock');

// 다음(또는 이전) 주인공
export function cycleHero(id, step = 1) {
  const i = HERO_IDS.indexOf(normalizeHero(id));
  const n = HERO_IDS.length;
  return HERO_IDS[(((i + step) % n) + n) % n];
}

// 주인공별 체력, 걷기, 점프 배수
export function heroStats(id, cfg) {
  const h = cfg.heroes?.[normalizeHero(id)] || {};
  return {
    health: h.healthMultiplier ?? 1,
    move: h.moveMultiplier ?? 1,
    jump: h.jumpMultiplier ?? 1,
    scale: h.scale ?? 1,
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

// 번개 사수: 짧게 떼면 번개탄, 꾹 누르면 레이저(뚫고 지나감).
// 레이저는 충전 공격으로 쳐서 방패를 깨고 단단한 해파리를 뚫는다.
export function gunnerAttack(heldSec, cfg, damageMultiplier = 1, { up = false } = {}) {
  const g = cfg.heroes.gunner;
  if (heldSec < cfg.charge.minTime) {
    return {
      kind: 'shot',
      style: 'bolt',
      damage: Math.max(1, Math.round(g.boltDamage * damageMultiplier)),
      knockback: g.boltKnockback,
      range: g.boltSize,
      ratio: 0,
      full: false,
      up: Boolean(up),
    };
  }
  const ratio = chargeRatio(heldSec, cfg.charge);
  return {
    kind: 'charged',
    style: 'beam',
    damage: Math.round(lerp(g.beamMinDamage, g.beamMaxDamage, ratio) * damageMultiplier),
    knockback: lerp(g.beamMinKnockback, g.beamMaxKnockback, ratio),
    range: g.beamLength,
    width: lerp(g.beamMinWidth, g.beamMaxWidth, ratio),
    ratio,
    full: ratio >= 1,
    up: Boolean(up),
  };
}

// 레이저가 닿는 사각형. 앞으로 쏘면 가로로 길게, 위로 쏘면 세로로 길게.
// (px, py) 는 주인공 몸 한가운데.
export function beamRect(px, py, facing, length, width, up) {
  if (up) return { x: px - width / 2, y: py - 30 - length, w: width, h: length };
  const x = facing > 0 ? px + 20 : px - 20 - length;
  return { x, y: py - 6 - width / 2, w: length, h: width };
}

// 강철 거인: 짧게 떼면 망치 내려찍기(방패를 깸), 위를 누르면 망치 올려치기,
// 꾹 누르면 회오리 (오래 누를수록 오래 돈다).
export function giantAttack(heldSec, cfg, damageMultiplier = 1, { up = false } = {}) {
  const g = cfg.heroes.giant;
  if (heldSec < cfg.charge.minTime) {
    if (up) {
      return {
        kind: 'upper',
        style: 'hammerUp',
        damage: Math.round(g.upperDamage * damageMultiplier),
        knockback: g.upperKnockback,
        range: cfg.skills.upperReach,
        ratio: 0,
        full: false,
        up: true,
      };
    }
    return {
      kind: 'charged', // 무거운 망치라 방패를 깬다
      style: 'smash',
      damage: Math.round(g.smashDamage * damageMultiplier),
      knockback: g.smashKnockback,
      range: g.smashRange,
      ratio: 0.5,
      full: false,
      up: false,
    };
  }
  const ratio = chargeRatio(heldSec, cfg.charge);
  return {
    kind: 'punch',
    style: 'spin',
    damage: Math.round(g.spinDamage * damageMultiplier),
    knockback: g.spinKnockback,
    range: g.spinRadius,
    time: lerp(g.spinMinTime, g.spinMaxTime, ratio),
    ratio,
    full: ratio >= 1,
    up: false,
  };
}

// 망치 내려찍기가 닿는 사각형: 앞쪽으로 넓고, 키보다 높게
export function smashRect(px, py, facing, range, height) {
  const x = facing > 0 ? px + 4 : px - 4 - range;
  return { x, y: py + 34 - height, w: range, h: height };
}

// 회오리가 닿는 사각형: 몸 둘레 양쪽
export function spinRect(px, py, radius) {
  return { x: px - radius, y: py - radius * 0.7, w: radius * 2, h: radius * 1.4 };
}

// 회오리가 도는 동안 몇 번 때리는지 (처음 한 번 + 간격마다)
export function spinHits(time, tick) {
  if (!(tick > 0) || !(time > 0)) return 0;
  return Math.floor(time / tick) + 1;
}

// 몸통 박치기 피해
export function rushAttack(cfg, damageMultiplier = 1) {
  const g = cfg.heroes.giant;
  return {
    kind: 'charged',
    style: 'rush',
    damage: Math.round(g.rushDamage * damageMultiplier),
    knockback: g.rushKnockback,
    range: 0,
    ratio: 0.5,
    full: false,
    up: false,
  };
}

// 번개비: 화면 안 적마다 번개 한 줄기씩. 남는 줄기는 화면에 고르게 흩뿌린다.
// targets 는 적의 x 목록, 돌려주는 값은 번개가 떨어질 x 목록 (최소 count 개).
export function rainStrikeXs(targets, viewLeft, viewWidth, count) {
  const xs = [...targets];
  const extra = Math.max(0, count - xs.length);
  for (let i = 0; i < extra; i++) xs.push(viewLeft + ((i + 0.5) * viewWidth) / extra);
  return xs;
}

// ---------- 주인공별 안내 글 ----------
// 안내판, 로봇 대사, 조작법 글에서 {atk} 같은 표시를 고른 주인공의 말로 바꾼다 (controls.js 의 keyText).
// 짧은 이름: atk 기본 공격, hold 꾹 눌렀다 떼는 공격, strong 약점을 가장 세게 치는 공격 (충전 공격이라 보스 약점에 더 셈),
//           upAtk 위쪽 공격, upName 조작법 글의 위쪽 공격 이름, dashName 대시 이름.
// 문장: 주인공마다 뜻이 달라지는 조언 (방패, 단단한 해파리, 가시복어 등).
// 문장 안의 {punch} 같은 키 표시와 (으)로 같은 조사 표시는 keyText 가 이어서 바꾼다.
// 근거: 방패는 'charged' 만 깸 (shieldResult), 해파리는 반 충전 이상 'charged' 만 뚫음 (jellyBlocks),
//       가시복어는 'punch', 'upper' 만 찔림 (pufferResult). 거인 회오리는 'punch', 올려치기는 'upper'.
export const HERO_WORDS = {
  shock: {
    atk: '펀치',
    hold: '충전 펀치',
    strong: '충전 펀치',
    upAtk: '어퍼컷',
    upName: '어퍼컷',
    dashName: '대시',
    holdTip: '꾹 눌렀다 떼면 충전 펀치! 오래 누를수록 멀리 날아가.',
    dashSign: '{dash} 로 대시해서 피하기',
    shieldTip: '충전 펀치로 방패를 깨거나 뒤로 돌아가서 때려!',
    shieldSign: '충전 펀치로 방패 깨기, 아니면 뒤에서!',
    jellyTip: '펀치는 튕겨 나가. {punch} 를 꾹 눌러 충전 펀치로 깨뜨려!',
    jellyTalk: '가까이 가면 단단한 공이 돼. 그땐 {punch} 를 꾹 눌러 충전 펀치!',
    pufferTip: '맨손 펀치랑 어퍼컷은 따끔해. 충전 펀치로 치거나, 바람이 빠지면 때려!',
    pufferSign: '맨손 펀치 금지!',
    pufferTalk: '가시복어가 부르르 떨면 곧 부풀어. 맨손 펀치는 따끔해!',
    dashThrough: '돌진이다! 빨간 길을 대시로 뚫고 지나가!',
  },
  gunner: {
    atk: '번개탄',
    hold: '레이저',
    strong: '레이저',
    upAtk: '위로 쏘는 번개탄',
    upName: '위로 쏘기',
    dashName: '대시',
    holdTip: '꾹 눌렀다 떼면 레이저! 오래 누를수록 굵고 세져.',
    dashSign: '{dash} 로 대시해서 피하기',
    shieldTip: '번개탄은 방패에 막혀! 레이저로 방패를 깨거나 뒤로 돌아가서 쏴!',
    shieldSign: '레이저로 방패 깨기, 아니면 뒤에서!',
    jellyTip: '번개탄은 튕겨 나가. {punch} 를 꾹 눌러 레이저로 깨뜨려!',
    jellyTalk: '가까이 가면 단단한 공이 돼. 그땐 {punch} 를 꾹 눌러 레이저!',
    pufferTip: '번개탄이랑 레이저는 가시를 뚫어! 가까이 가지 말고 멀리서 쏴!',
    pufferSign: '가시복어가 부풀어도\n멀리서 쏘면 OK!',
    pufferTalk: '가시복어가 부르르 떨면 곧 부풀어. 번개탄은 가시를 뚫으니까 멀리서 쏴!',
    dashThrough: '돌진이다! 빨간 길을 대시로 뚫고 지나가!',
  },
  giant: {
    atk: '망치',
    hold: '회오리',
    strong: '망치',
    upAtk: '망치 올려치기',
    upName: '올려치기',
    dashName: '몸통 박치기',
    holdTip: '꾹 눌렀다 떼면 회오리! 오래 누를수록 오래 돌아.',
    dashSign: '{dash} 로 몸통 박치기해서 피하기',
    shieldTip: '회오리는 방패에 막혀! 망치로 내려찍거나 몸통 박치기로 방패를 깨!',
    shieldSign: '망치로 방패 깨기!\n회오리는 막혀요',
    jellyTip: '회오리랑 올려치기는 튕겨 나가. 망치로 내려찍어서 깨뜨려!',
    jellyTalk: '가까이 가면 단단한 공이 돼. 그땐 망치로 내려찍어!',
    pufferTip: '회오리랑 올려치기는 따끔해. 망치로 내려찍거나 몸통 박치기로 쳐!',
    pufferSign: '회오리 금지!\n망치로 내려찍기!',
    pufferTalk: '가시복어가 부르르 떨면 곧 부풀어. 회오리랑 올려치기는 따끔해! 망치로 내려찍어!',
    dashThrough: '돌진이다! 빨간 길을 몸통 박치기로 뚫고 지나가!',
  },
};

// 고른 주인공의 안내 말 (모르는 이름은 쇼크 히어로)
export const heroWords = (id) => HERO_WORDS[normalizeHero(id)];

// 받침 번호 (0 이면 받침 없음, 8 이면 ㄹ 받침). 한글 글자가 아니면 null.
export function batchim(ch) {
  const code = ch ? ch.charCodeAt(0) - 0xac00 : -1;
  if (code < 0 || code > 11171) return null;
  return code % 28;
}

// '망치(으)로', '번개탄(을)를' 처럼 쓴 조사를 앞 글자 받침에 맞게 고른다.
// 예: '번개탄(으)로' → '번개탄으로', '망치(으)로' → '망치로', '레이저(이)가' → '레이저가'
// 한글이 아닌 글자 뒤에서는 받침 없는 쪽을 쓴다.
const JOSA = {
  '(이)가': ['이', '가'],
  '(을)를': ['을', '를'],
  '(은)는': ['은', '는'],
  '(과)와': ['과', '와'],
  '(이)나': ['이나', '나'],
  '(이)랑': ['이랑', '랑'],
};
export function fixJosa(str) {
  // 괄호를 닫은 바로 뒤면 괄호 앞 글자를 본다: '어퍼컷(W 누른 채 펀치 버튼)(으)로' → '...버튼)으로'
  return String(str).replace(/([^\s(])(\)?)(\((?:이|을|은|과|으)\)(?:가|를|는|와|나|랑|로))/g, (m, ch, close, josa) => {
    const b = batchim(ch);
    if (josa === '(으)로') return ch + close + (b && b !== 8 ? '으로' : '로'); // ㄹ 받침은 '로'
    const pair = JOSA[josa];
    return pair ? ch + close + (b ? pair[0] : pair[1]) : m;
  });
}
