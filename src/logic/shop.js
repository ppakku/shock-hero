// 상점: 보석으로 사는 영구 강화. 숫자는 balance.js 의 shop.
// 화면(Phaser)과 상관없는 계산만 모아서 테스트하기 쉽게 했다.

export const SHOP_IDS = ['hp', 'heart', 'powerTime', 'startShield', 'ultStart', 'tripleJump'];

const pct = (v) => `${Math.round(v * 100)}%`;

// 상점 물건 이름과 설명. desc(c) 는 다음 단계를 사면 무엇이 좋아지는지.
export const SHOP_INFO = {
  hp: { name: '튼튼한 몸', icon: 'up_defense', color: '#ff7a8a', desc: (c) => `최대 체력 +${c.perRank}` },
  heart: { name: '하트 행운', icon: 'heart', color: '#ff5a7a', desc: (c) => `하트가 ${pct(c.chancePerRank)} 더 자주, ${c.healPerRank} 더 채움` },
  powerTime: { name: '오래가는 힘', icon: 'pw_star', color: '#ffd23f', desc: (c) => `보물 힘 시간 +${pct(c.perRank)}` },
  startShield: { name: '출발 방패', icon: 'pw_shield', color: '#bfe0ff', desc: () => '스테이지를 시작하면 강철 몸' },
  ultStart: { name: '궁극기 반 충전', icon: 'up_robot', color: '#3ff0ff', desc: (c) => `궁극기 게이지 ${pct(c.gauge)} 채우고 시작` },
  tripleJump: { name: '트리플 점프', icon: 'up_speed', color: '#ffe066', desc: () => '공중에서 한 번 더 뛰어요 (점프 3번)' },
};

export const prices = (shopCfg, id) => Object.values(shopCfg[id]?.prices || {});
export const maxRankOf = (shopCfg, id) => prices(shopCfg, id).length;

export function emptyShop() {
  return Object.fromEntries(SHOP_IDS.map((id) => [id, 0]));
}

// 저장 파일에서 읽은 값을 안전하게 (모르는 이름은 버리고, 0 이상 정수로)
export function normalizeShop(data) {
  const out = emptyShop();
  if (!data || typeof data !== 'object') return out;
  for (const id of SHOP_IDS) if (Number.isInteger(data[id]) && data[id] > 0) out[id] = Math.min(9, data[id]);
  return out;
}

// 상점 한 줄에 보여 줄 것
export function shopEntry(save, id, shopCfg) {
  const rank = save.shop?.[id] || 0;
  const list = prices(shopCfg, id);
  const maxed = rank >= list.length;
  const price = maxed ? null : list[rank];
  const info = SHOP_INFO[id];
  return {
    id,
    name: info.name,
    icon: info.icon,
    color: info.color,
    rank,
    maxRank: list.length,
    maxed,
    price,
    canBuy: !maxed && (save.gems || 0) >= price,
    desc: maxed ? '다 샀어요!' : info.desc(shopCfg[id]),
  };
}

// 하나 샀을 때 저장할 내용. 살 수 없으면 null.
export function buyItem(save, id, shopCfg) {
  if (!SHOP_IDS.includes(id)) return null;
  const e = shopEntry(save, id, shopCfg);
  if (!e.canBuy) return null;
  return { gems: (save.gems || 0) - e.price, shop: { ...normalizeShop(save.shop), [id]: e.rank + 1 } };
}

// 산 물건이 게임에 주는 효과
export function shopBonuses(shop, shopCfg) {
  const s = normalizeShop(shop);
  const c = shopCfg;
  const cap = (id) => Math.min(s[id], maxRankOf(c, id));
  return {
    maxHealth: cap('hp') * c.hp.perRank,
    heartChance: cap('heart') * c.heart.chancePerRank,
    heartHeal: cap('heart') * c.heart.healPerRank,
    powerTimeMultiplier: 1 + cap('powerTime') * c.powerTime.perRank,
    startShield: cap('startShield') > 0,
    ultStart: cap('ultStart') > 0 ? c.ultStart.gauge : 0,
    airJumps: cap('tripleJump'),
  };
}

// 상점을 얼마나 샀는지 (0 = 하나도 안 삼, 1 = 다 삼). 쓴 보석 기준이라 비싼 강화일수록 크게 친다.
export function shopSpentRatio(shop, shopCfg) {
  const s = normalizeShop(shop);
  let spent = 0;
  let total = 0;
  for (const id of SHOP_IDS) {
    const list = prices(shopCfg, id);
    total += list.reduce((a, b) => a + b, 0);
    spent += list.slice(0, s[id]).reduce((a, b) => a + b, 0);
  }
  return total > 0 ? spent / total : 0;
}

// 몬스터가 하트를 떨어뜨릴 확률. 상점 하트 행운도 난이도 배수를 받는다
export function heartDropChance(baseChance, difficultyMul, shopBonus = 0) {
  return (baseChance + shopBonus) * difficultyMul;
}

// 보물 힘 설정의 시간만 늘린 복사본
export function scalePowerTimes(powersCfg, mul) {
  const out = {};
  for (const [id, p] of Object.entries(powersCfg)) out[id] = { ...p, time: Math.round(p.time * mul * 10) / 10 };
  return out;
}
