// 성장 규칙: 레벨 업 카드(업그레이드)와 보물 상자의 특별한 힘.
// 화면(Phaser)과 상관없는 계산만 모아서 테스트하기 쉽게 했다.

// ---------- 레벨 업 카드 ----------

export const UPGRADE_TRACKS = ['attack', 'defense', 'speed', 'robot'];

export const UPGRADE_INFO = {
  attack: { name: '공격력', icon: 'up_attack', color: '#ff7a5c' },
  defense: { name: '방어력', icon: 'up_defense', color: '#7ab8ff' },
  speed: { name: '속도', icon: 'up_speed', color: '#ffe066' },
  robot: { name: '로봇 볼트', icon: 'up_robot', color: '#3ff0ff' },
};

export function emptyUpgrades() {
  return { attack: 0, defense: 0, speed: 0, robot: 0 };
}

// 저장 파일에서 읽은 값을 안전하게 (모르는 이름은 버리고, 0 ~ maxRank 정수로)
export function normalizeUpgrades(data, maxRank = 5) {
  const u = emptyUpgrades();
  if (!data || typeof data !== 'object') return u;
  for (const t of UPGRADE_TRACKS) {
    const v = data[t];
    if (Number.isInteger(v) && v > 0) u[t] = Math.min(maxRank, v);
  }
  return u;
}

export const totalRanks = (u) => UPGRADE_TRACKS.reduce((s, t) => s + (u[t] || 0), 0);

// 아직 올릴 수 있는 칸 수
export const ranksLeft = (u, maxRank) => UPGRADE_TRACKS.length * maxRank - totalRanks(u);

export function attackMultiplier(u, up) {
  return 1 + (u.attack || 0) * up.attackPerRank;
}

// 받는 피해에 곱하는 값 (작을수록 덜 아픔). 아무리 올려도 10% 는 맞는다.
export function damageTakenMultiplier(u, up) {
  return Math.max(0.1, 1 - (u.defense || 0) * up.defensePerRank);
}

export function speedMultiplier(u, up) {
  return 1 + (u.speed || 0) * up.speedPerRank;
}

export function dashCooldownMultiplier(u, up) {
  return Math.max(0.2, 1 - (u.speed || 0) * up.dashCooldownPerRank);
}

// 로봇 볼트 능력. rank 0 이면 null (아직 공격 못 함). 설정에 없는 높은 레벨은 가장 높은 lvN 을 쓴다.
export function robotStats(rank, rc) {
  if (!rank || rank < 1) return null;
  let lv = null;
  for (let r = rank; r >= 1 && !lv; r--) lv = rc[`lv${r}`];
  if (!lv) return null;
  return {
    rank,
    interval: Math.max(0.2, lv.zapInterval),
    damage: lv.zapDamage,
    targets: Math.max(1, Math.round(lv.zapTargets)),
    range: rc.zapRange,
    knockback: rc.zapKnockback,
    heal: rank >= rc.healFromRank ? { every: rc.healEvery, amount: rc.healAmount } : null,
    guard: rank >= rc.guardFromRank ? { every: rc.guardEvery } : null,
  };
}

const pct = (v) => `${Math.round(v * 100)}%`;

// 카드에 쓸 설명: 지금 레벨에서 한 단계 올리면 무엇이 좋아지는지
export function upgradeCard(track, u, cfg) {
  const up = cfg.upgrades;
  const rank = u[track] || 0;
  const maxed = rank >= up.maxRank;
  const info = UPGRADE_INFO[track];
  const next = rank + 1;
  let lines;
  if (track === 'attack') {
    lines = [`모든 공격 +${pct(up.attackPerRank)}`, `지금 ${pct(attackMultiplier(u, up))} 힘`];
  } else if (track === 'defense') {
    lines = [`받는 피해 -${pct(up.defensePerRank)}`, `지금 ${pct(1 - damageTakenMultiplier(u, up))} 덜 아픔`];
  } else if (track === 'speed') {
    lines = [`걷기 +${pct(up.speedPerRank)}`, `대시 쿨다운 -${pct(up.dashCooldownPerRank)}`];
  } else {
    const s = robotStats(next, cfg.robot);
    const rc = cfg.robot;
    if (rank === 0) lines = ['볼트가 레이저를 쏴요!', `${s.interval}초마다 피해 ${s.damage}`];
    else if (next === rc.healFromRank) lines = [`레이저 피해 ${s.damage}`, '가끔 체력도 채워 줘요'];
    else if (next === rc.guardFromRank) lines = [`레이저 ${s.targets}마리 동시`, '볼트 방패가 공격을 막아요'];
    else lines = [`${s.interval}초마다 피해 ${s.damage}`, s.targets > 1 ? `한 번에 ${s.targets}마리` : '더 빠르고 세게'];
  }
  return {
    track,
    name: info.name,
    icon: info.icon,
    color: info.color,
    rank,
    maxed,
    title: maxed ? `${info.name} Lv ${rank} (최고!)` : `${info.name} Lv ${rank} → ${next}`,
    lines: maxed ? ['더 올릴 수 없어요'] : lines,
  };
}

// 자동 고르기 (봇 테스트용): 가장 낮은 칸부터, 같으면 목록 순서대로
export function autoPickTrack(u, maxRank) {
  let best = null;
  for (const t of UPGRADE_TRACKS) {
    if ((u[t] || 0) >= maxRank) continue;
    if (best === null || u[t] < u[best]) best = t;
  }
  return best;
}

// 카드 하나를 골랐을 때 저장할 내용. 고를 수 없으면 null.
export function applyPick(save, track, maxRank) {
  const u = normalizeUpgrades(save.upgrades, maxRank);
  if (!UPGRADE_TRACKS.includes(track) || u[track] >= maxRank || !(save.picksPending > 0)) return null;
  u[track] += 1;
  return { upgrades: u, picksPending: Math.min(save.picksPending - 1, ranksLeft(u, maxRank)) };
}

// ---------- 보물 상자의 특별한 힘 ----------

export const POWER_IDS = ['speed', 'shield', 'power', 'star', 'rapid'];

export const POWER_INFO = {
  speed: { name: '번개 신발', desc: '엄청 빨라져요! 대시도 자주!', icon: 'pw_speed', color: '#ffe066', tint: 0xffe066 },
  shield: { name: '강철 몸', desc: '체력바 위에 방패가 생겨요!', icon: 'pw_shield', color: '#bfe0ff', tint: 0x9fd0ff },
  power: { name: '파워 장갑', desc: '모든 공격이 엄청 아파요!', icon: 'pw_power', color: '#ff7a5c', tint: 0xff7a5c },
  star: { name: '무적 별', desc: '아무것도 안 아파요! 몸으로 부딪혀!', icon: 'pw_star', color: '#ffd23f', tint: 0xffd23f },
  rapid: { name: '에너지 연사', desc: '공격할 때마다 에너지탄이 나가요!', icon: 'pw_rapid', color: '#6fc0ff', tint: 0x6fc0ff },
};

// 보물에 적힌 힘. 없거나 모르는 이름이면 무작위.
export function treasurePower(tr, rand = Math.random) {
  if (tr && POWER_IDS.includes(tr.power)) return tr.power;
  return POWER_IDS[Math.floor(rand() * POWER_IDS.length) % POWER_IDS.length];
}

// 켜져 있는 힘들과 남은 시간. 같은 힘을 또 먹으면 시간이 처음부터 다시 간다.
export class PowerSet {
  constructor(powersCfg) {
    this.cfg = powersCfg;
    this.active = {}; // id → { left, time }
    this.shield = 0; // 강철 몸 방패 남은 양
    this.shieldMax = 0;
  }

  add(id) {
    const c = this.cfg[id];
    if (!c) return false;
    this.active[id] = { left: c.time, time: c.time };
    if (id === 'shield') {
      this.shield = c.amount;
      this.shieldMax = c.amount;
    }
    return true;
  }

  has(id) {
    return Boolean(this.active[id]);
  }

  remaining(id) {
    return this.active[id]?.left ?? 0;
  }

  // 지금 켜진 힘 목록 (먹은 순서)
  list() {
    return Object.entries(this.active).map(([id, a]) => ({ id, left: a.left, time: a.time, ratio: a.time > 0 ? a.left / a.time : 0 }));
  }

  // 시간이 다 된 힘의 id 목록을 돌려준다
  update(dt) {
    const ended = [];
    for (const [id, a] of Object.entries(this.active)) {
      a.left -= dt;
      if (a.left <= 0) ended.push(id);
    }
    for (const id of ended) this.end(id);
    return ended;
  }

  end(id) {
    delete this.active[id];
    if (id === 'shield') {
      this.shield = 0;
      this.shieldMax = 0;
    }
  }

  // 피해를 방패가 먼저 받는다. 남은 피해와 방패가 깨졌는지 돌려준다.
  absorb(damage) {
    if (!this.has('shield') || this.shield <= 0) return { left: damage, absorbed: 0, broke: false };
    const absorbed = Math.min(this.shield, damage);
    this.shield -= absorbed;
    const broke = this.shield <= 0;
    if (broke) this.end('shield');
    return { left: damage - absorbed, absorbed, broke };
  }

  clear() {
    this.active = {};
    this.shield = 0;
    this.shieldMax = 0;
  }
}
