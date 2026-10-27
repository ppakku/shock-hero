// 함께하기: 친구(2P)의 성장 정보와 친구 기기에 저장할 보상. 화면과 상관없어서 테스트한다.
import { normalizeHero } from './heroes.js';
import { normalizeUpgrades, ranksLeft } from './growth.js';
import { normalizeShop } from './shop.js';
import { addXp } from './progression.js';
import { treasureReward, clearReward } from './rewards.js';
import { clearStagePatch } from './save.js';
import { dexReward, monsterName } from './dex.js';

// 친구가 방에 들어올 때 보내는 내 정보 (저장에서 뽑는다)
export function guestProfile(save) {
  return {
    hero: normalizeHero(save.settings?.hero),
    level: save.level,
    xp: save.xp,
    upgrades: save.upgrades,
    shop: save.shop,
  };
}

// 방장이 받은 친구 정보를 믿을 수 있는 모양으로 (이상한 값은 기본값)
export function cleanProfile(p, maxRank = 5) {
  const level = Number.isInteger(p?.level) && p.level >= 1 ? Math.min(p.level, 999) : 1;
  const xp = Number.isFinite(p?.xp) && p.xp >= 0 ? p.xp : 0;
  return {
    hero: normalizeHero(p?.hero),
    level,
    xp,
    upgrades: normalizeUpgrades(p?.upgrades, maxRank),
    shop: normalizeShop(p?.shop),
  };
}

// 방장 게임에서 일어난 일을 친구 저장에 반영한다.
// msg: { kind: 'treasure', stage, id } | { kind: 'xp', amount } | { kind: 'clear', stage, time, flawless }
//      | { kind: 'dexMonster', id } | { kind: 'dexBoss', stage }
// stage: msg.stage 의 스테이지 데이터. 돌려주는 값: { patch, gems, text } (text 는 친구 화면에 잠깐 보여 줄 글)
export function applyGuestReward(save, msg, stage, cfg) {
  if (msg?.kind === 'treasure' && stage) {
    const r = treasureReward(save, stage, msg.stage, msg.id, cfg.gems);
    return { patch: r.patch, gems: r.gems, text: r.gems > 0 ? `보물 발견! 보석 +${r.gems}` : '' };
  }
  if (msg?.kind === 'xp') {
    const r = addXp(save, msg.amount, cfg.level);
    // 오른 레벨만큼 카드를 고를 수 있다 (혼자 할 때 고른다)
    const left = ranksLeft(save.upgrades, cfg.upgrades.maxRank);
    const picksPending = Math.min(left, (save.picksPending || 0) + r.levelsGained);
    return { patch: { level: r.level, xp: r.xp, picksPending }, gems: 0, text: r.levelsGained > 0 ? `레벨 업! Lv ${r.level}` : '' };
  }
  if (msg?.kind === 'clear' && stage) {
    const reward = clearReward(save, stage, msg.stage, { flawless: Boolean(msg.flawless) }, cfg.gems);
    const { patch } = clearStagePatch(save, msg.stage, Number(msg.time) || 0);
    return { patch: { ...patch, ...reward.patch }, gems: reward.gems, text: `스테이지 ${msg.stage} 클리어! 보석 +${reward.gems}` };
  }
  // 도감: 방장 게임에서 잡은 몬스터와 보스를 친구 도감에도 적는다
  if (msg?.kind === 'dexMonster' && typeof msg.id === 'string') {
    const r = dexReward(save, 'monster', msg.id, cfg.gems);
    return { patch: r.patch, gems: r.gems, text: r.isNew ? `도감 등록! ${monsterName(msg.id)}` : '' };
  }
  if (msg?.kind === 'dexBoss' && Number.isInteger(msg.stage)) {
    const r = dexReward(save, 'boss', msg.stage, cfg.gems);
    return { patch: r.patch, gems: r.gems, text: r.isNew ? `도감에 보스 등록! 보석 +${r.gems}` : '' };
  }
  return { patch: {}, gems: 0, text: '' };
}
