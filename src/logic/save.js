import { normalizeDifficulty } from './difficulty.js';
import { normalizeControls } from './controls.js';

const KEY = 'shock-hero-save-v1';
export const STAGE_COUNT = 5;

export function defaultSave() {
  return {
    level: 1,
    xp: 0,
    treasures: [], // 찾은 보물 id
    unlocked: 1, // 갈 수 있는 가장 높은 스테이지
    checkpoint: null, // null 이면 처음부터, 숫자면 그 스테이지의 보스 앞 체크포인트
    bestTimes: {}, // 스테이지별 가장 빨리 깬 시간(초). 예: { 1: 95.2 }
    settings: { shake: true, muted: false, difficulty: 'normal', controls: 'classic' },
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
  if (data.settings && typeof data.settings === 'object') {
    if (typeof data.settings.shake === 'boolean') d.settings.shake = data.settings.shake;
    if (typeof data.settings.muted === 'boolean') d.settings.muted = data.settings.muted;
    d.settings.difficulty = normalizeDifficulty(data.settings.difficulty);
    d.settings.controls = normalizeControls(data.settings.controls);
  }
  return d;
}

// storage 는 localStorage 처럼 getItem/setItem 이 있는 것. 없거나 막혀 있어도 게임은 돈다.
export function createSaveStore(storage) {
  function load() {
    try {
      const raw = storage?.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : defaultSave();
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

// 레벨 초기화: 레벨, 경험치, 보물, 스테이지 기록을 지우고 설정만 남긴다
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
