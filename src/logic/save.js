import { normalizeDifficulty } from './difficulty.js';
import { normalizeControls } from './controls.js';
import { emptyUpgrades, normalizeUpgrades, UPGRADE_TRACKS } from './growth.js';
import { emptyShop, normalizeShop } from './shop.js';
import { normalizeHero } from './heroes.js';
import { emptyDex, normalizeDex } from './dex.js';
import { emptyRush, normalizeRush, COURSE_SIZE } from './rush.js';
import { emptyWorkshop, normalizeWorkshop } from './workshop.js';

const KEY = 'shock-hero-save-v1';
export const STAGE_COUNT = 20; // 스테이지 수 (src/stage/index.js 의 stages 와 같아야 함)

export function defaultSave() {
  return {
    level: 1,
    xp: 0,
    treasures: [], // 찾은 보물 id
    upgrades: emptyUpgrades(), // 레벨 업 카드로 올린 칸 { attack, defense, speed, robot }
    picksPending: 0, // 아직 고르지 않은 레벨 업 카드 수 (다음에 게임을 할 때 고른다)
    unlocked: 1, // 갈 수 있는 가장 높은 스테이지
    checkpoint: null, // null 이면 처음부터, 숫자면 그 스테이지의 보스 앞 체크포인트
    bestTimes: {}, // 스테이지별 가장 빨리 깬 시간(초). 예: { 1: 95.2 }
    flawless: [], // 한 번도 안 쓰러지고 깬 스테이지 번호 (별 3)
    lastStage: null, // 마지막으로 들어간 스테이지 (지도를 열면 여기서 시작)
    gems: 0, // 상점에서 쓰는 보석
    shop: emptyShop(), // 상점에서 산 단계 { hp, heart, ... }
    rush: emptyRush(), // 보스 러시 가족 기록표 (src/logic/rush.js)
    workshop: emptyWorkshop(), // 몬스터 공방에서 만든 작품 (src/logic/workshop.js)
    dex: emptyDex(), // 몬스터 도감 { monsters: { 그림 이름: 잡은 수 }, bosses: [스테이지 번호] } (src/logic/dex.js)
    // hero: 고른 주인공 (src/logic/heroes.js)
    // lowFx: 효과 줄이기 (빛 번짐, 멈칫, 확대, 번쩍임을 끄고 불꽃 수를 줄인다)
    settings: { shake: true, muted: false, difficulty: 'normal', controls: 'classic', lowFx: false, hero: 'shock' },
  };
}

const validStage = (n) => Number.isInteger(n) && n >= 1 && n <= STAGE_COUNT;

function normalize(data) {
  const d = defaultSave();
  if (!data || typeof data !== 'object') return d;
  if (Number.isInteger(data.level) && data.level >= 1) d.level = data.level;
  if (typeof data.xp === 'number' && data.xp >= 0) d.xp = data.xp;
  if (Array.isArray(data.treasures)) d.treasures = [...new Set(data.treasures.filter((t) => typeof t === 'string'))];
  if (validStage(data.unlocked)) d.unlocked = data.unlocked;
  d.upgrades = normalizeUpgrades(data.upgrades, 99);
  if (Number.isInteger(data.picksPending) && data.picksPending > 0) d.picksPending = data.picksPending;
  // 레벨 업 카드가 생기기 전 저장: 지금까지 오른 레벨만큼 카드를 공짜로 고르게 한다
  else if (data.upgrades === undefined && d.level > 1) d.picksPending = d.level - 1;
  d.picksPending = Math.min(d.picksPending, UPGRADE_TRACKS.length * 99);
  // 예전 저장(스테이지 1만 있던 때)은 'boss' 와 bestTime 으로 저장돼 있었다
  if (data.checkpoint === 'boss') d.checkpoint = 1;
  else if (validStage(data.checkpoint)) d.checkpoint = data.checkpoint;
  if (data.bestTimes && typeof data.bestTimes === 'object') {
    for (const [k, v] of Object.entries(data.bestTimes)) {
      if (validStage(Number(k)) && typeof v === 'number' && v > 0) d.bestTimes[Number(k)] = v;
    }
  }
  if (typeof data.bestTime === 'number' && data.bestTime > 0 && !d.bestTimes[1]) {
    d.bestTimes[1] = data.bestTime;
    d.unlocked = Math.max(d.unlocked, 2);
  }
  if (validStage(data.lastStage)) d.lastStage = data.lastStage;
  if (Array.isArray(data.flawless)) d.flawless = [...new Set(data.flawless.filter(validStage))];
  if (Number.isInteger(data.gems) && data.gems >= 0) d.gems = data.gems;
  d.shop = normalizeShop(data.shop);
  d.dex = normalizeDex(data.dex, STAGE_COUNT);
  d.workshop = normalizeWorkshop(data.workshop, STAGE_COUNT);
  d.rush = normalizeRush(data.rush, Math.ceil(STAGE_COUNT / COURSE_SIZE));
  if (data.settings && typeof data.settings === 'object') {
    if (typeof data.settings.shake === 'boolean') d.settings.shake = data.settings.shake;
    if (typeof data.settings.muted === 'boolean') d.settings.muted = data.settings.muted;
    if (typeof data.settings.lowFx === 'boolean') d.settings.lowFx = data.settings.lowFx;
    d.settings.difficulty = normalizeDifficulty(data.settings.difficulty);
    d.settings.controls = normalizeControls(data.settings.controls);
    d.settings.hero = normalizeHero(data.settings.hero);
  }
  return d;
}

// storage 는 localStorage 처럼 getItem/setItem 이 있는 것. 없거나 막혀 있어도 게임은 돈다.
// gemsFor(save): 보석이 생기기 전 저장을 읽을 때 지금까지 한 만큼 보석을 정해 준다 (스테이지를 알아야 해서 밖에서 받음)
// dexFor(save): 도감이 생기기 전 저장을 읽을 때 깬 스테이지로 도감을 채워 준다 (src/logic/dex.js 의 dexFromProgress)
export function createSaveStore(storage, { gemsFor, dexFor } = {}) {
  function load() {
    try {
      const raw = storage?.getItem(KEY);
      if (!raw) return defaultSave();
      const data = JSON.parse(raw);
      const d = normalize(data);
      if (gemsFor && data && typeof data === 'object' && data.gems === undefined) d.gems = gemsFor(d);
      if (dexFor && data && typeof data === 'object' && data.dex === undefined) d.dex = normalizeDex(dexFor(d), STAGE_COUNT);
      return d;
    } catch {
      return defaultSave();
    }
  }

  function save(data) {
    try {
      storage?.setItem(KEY, JSON.stringify(normalize(data)));
      return true;
    } catch {
      return false;
    }
  }

  return {
    load,
    save,
    update(patch) {
      const next = { ...load(), ...patch };
      save(next);
      return normalize(next);
    },
  };
}

// 스테이지를 깼을 때 저장할 내용
export function clearStagePatch(save, stageNum, time) {
  const prev = save.bestTimes[stageNum];
  const isRecord = !prev || time < prev;
  return {
    patch: {
      checkpoint: null,
      unlocked: Math.min(STAGE_COUNT, Math.max(save.unlocked, stageNum + 1)),
      bestTimes: { ...save.bestTimes, [stageNum]: isRecord ? time : prev },
    },
    isRecord,
    best: isRecord ? time : prev,
  };
}

// 레벨 초기화: 레벨, 경험치, 보물, 레벨 업 카드, 스테이지 기록을 지우고 설정만 남긴다
export function resetProgress(save) {
  return { ...defaultSave(), settings: { ...save.settings } };
}

export function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
