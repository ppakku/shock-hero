const KEY = 'shock-hero-save-v1';

export function defaultSave() {
  return {
    level: 1,
    xp: 0,
    treasures: [], // 찾은 보물 id
    checkpoint: null, // null 이면 처음부터, 'boss' 면 보스 앞 체크포인트
    bestTime: null, // 보스를 가장 빨리 잡은 시간(초)
    settings: { shake: true, muted: false },
  };
}

function normalize(data) {
  const d = defaultSave();
  if (!data || typeof data !== 'object') return d;
  if (Number.isInteger(data.level) && data.level >= 1) d.level = data.level;
  if (typeof data.xp === 'number' && data.xp >= 0) d.xp = data.xp;
  if (Array.isArray(data.treasures)) d.treasures = data.treasures.filter((t) => typeof t === 'string');
  if (typeof data.checkpoint === 'string') d.checkpoint = data.checkpoint;
  if (typeof data.bestTime === 'number' && data.bestTime > 0) d.bestTime = data.bestTime;
  if (data.settings && typeof data.settings === 'object') {
    if (typeof data.settings.shake === 'boolean') d.settings.shake = data.settings.shake;
    if (typeof data.settings.muted === 'boolean') d.settings.muted = data.settings.muted;
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

export function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
