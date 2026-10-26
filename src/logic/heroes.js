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
    lines: ['번개탄 연사, 꾹 누르면 레이저', '대시는 뒤로 빠지는 백스텝', '궁극기: 번개비'],
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
