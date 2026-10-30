// 몬스터 도감: 처음 잡은 몬스터와 보스가 도감에 등록된다. 잡은 수도 센다.
// 몬스터 칸은 생김새마다 하나 (용암 지대의 불꽃 슬라임은 초록 몬스터와 따로). id 는 게임 속 그림 이름(texture key).
// 저장: save.dex = { monsters: { id: 잡은 수 }, bosses: [깬 보스의 스테이지 번호] }
import { parseMonsterSpot } from './monsters.js';

// by: 'son' 이면 아들이 디자인한 몬스터 (도감에 작가 이름표가 붙는다)
export const MONSTER_DEX = [
  { id: 'monster', name: '초록 몬스터', group: '기본', desc: '꿀렁꿀렁 기어 와서 몸통 박치기를 해요.', tip: '빨개지면 공격 신호! 피한 다음 때려요.' },
  { id: 'monster_fast', name: '빨강 날쌘돌이', group: '기본', desc: '뿔 달린 불 도깨비. 아주 빠르지만 약해요.', tip: '공격 신호가 짧아요. 눈을 떼지 마세요.' },
  { id: 'monster_tank', name: '파랑 뚱보', group: '기본', desc: '느리지만 아주 튼튼하고 세게 때려요.', tip: '충전 펀치를 여러 번 먹여요.' },
  { id: 'monster_jumper', name: '보라 뜀뛰기', group: '기본', desc: '긴 다리로 높이 뛰어 위에서 덮쳐요.', tip: '대시로 밑으로 빠져나가요.' },
  { id: 'monster_spitter', name: '청록 침뱉기', group: '기본', desc: '멀리서 느린 침을 뱉는 두꺼비예요.', tip: '침은 점프로 넘거나 대시로 뚫어요. 가까이 붙으면 약해요.' },
  { id: 'monster_shield', name: '방패병', group: '기본', desc: '앞쪽 방패로 보통 펀치를 막아요.', tip: '충전 펀치로 방패를 깨거나 뒤에서 때려요.' },
  { id: 'monster_fros', name: '프로스', group: '기본', by: 'son', desc: '하늘을 나는 커다란 말벌. 맹독을 쏘고 독구름을 남겨요.', tip: '독을 쏜 뒤 낮게 내려와 쉴 때 점프 공격으로 잡아요.' },
  { id: 'monster_forest_fast', name: '독버섯 날쌘돌이', group: '독 숲', desc: '독 숲의 날쌘돌이. 갓에서 독 방울이 튀어요.', tip: '빠르니까 공격 신호를 잘 봐요.' },
  { id: 'monster_forest_tank', name: '이끼 뚱보', group: '독 숲', desc: '이끼와 버섯이 자란 숲의 뚱보예요.', tip: '충전 펀치를 여러 번 먹여요.' },
  { id: 'monster_lava_basic', name: '불꽃 슬라임', group: '용암', desc: '머리에 불꽃이 타는 용암 젤리예요.', tip: '빨개지면 공격 신호! 피한 다음 때려요.' },
  { id: 'monster_lava_tank', name: '마그마 뚱보', group: '용암', desc: '현무암 몸 틈으로 용암이 빛나요. 아주 튼튼해요.', tip: '충전 펀치를 여러 번 먹여요.' },
  { id: 'monster_lava_jumper', name: '불씨 뜀뛰기', group: '용암', desc: '불꽃 꼬리를 휘날리며 깡총 뛰어요.', tip: '대시로 밑으로 빠져나가요.' },
  { id: 'monster_ice_basic', name: '얼음 슬라임', group: '얼음', desc: '눈이 쌓인 차가운 얼음 젤리예요.', tip: '빨개지면 공격 신호! 피한 다음 때려요.' },
  { id: 'monster_ice_fast', name: '서리 도깨비', group: '얼음', desc: '고드름 뿔이 난 얼음 산의 날쌘돌이예요.', tip: '공격 신호가 짧아요. 눈을 떼지 마세요.' },
  { id: 'monster_ice_tank', name: '설인 뚱보', group: '얼음', desc: '하얀 털로 덮인 커다란 설인이에요.', tip: '충전 펀치를 여러 번 먹여요.' },
  { id: 'monster_ice_jumper', name: '얼음 뜀뛰기', group: '얼음', desc: '얼음 결정이 돋은 외눈 뜀뛰기예요.', tip: '대시로 밑으로 빠져나가요.' },
  { id: 'monster_jelly', name: '골드해파리 GX', group: '바다', by: 'son', desc: '금빛 해파리. 전기 독을 쏘고 순간 경화로 단단해져요.', tip: '가까이 가면 단단한 공이 돼요. 그땐 꾹 눌러 충전 공격으로 깨뜨려요.' },
  { id: 'monster_puffer', name: '가시복어 뿌뿌', group: '바다', desc: '부르르 떨다가 가시 공처럼 부풀어요.', tip: '부풀면 맨손으로 때리지 말고, 바람이 빠져 빙글빙글 돌 때 때려요.' },
  { id: 'monster_piranha', name: '이빨 피라냐', group: '바다', desc: '떼로 다니다가 쏜살같이 돌진해요.', tip: '빨간 점선은 돌진할 길이에요. 점선 밖으로 비켜요.' },
  { id: 'monster_crab', name: '집게 꽃게', group: '바다', desc: '물속 바닥을 옆으로 걸어 다녀요.', tip: '빨갛게 깜빡이며 집게를 들면 공격 신호! 위로 헤엄쳐 피한 다음 때려요.' },
];

const BASE_TEXTURE = {
  basic: 'monster', fast: 'monster_fast', tank: 'monster_tank', jumper: 'monster_jumper', fros: 'monster_fros',
  spitter: 'monster_spitter', shield: 'monster_shield', jelly: 'monster_jelly', puffer: 'monster_puffer',
  piranha: 'monster_piranha', crab: 'monster_crab',
};

// 스테이지에서 이 몬스터가 어떤 도감 칸으로 보이는지 (src/enemies/index.js, Monster.js 와 같은 규칙)
export function dexIdFor(stage, type) {
  let t = type || 'basic';
  if (stage?.swim && t === 'basic') t = 'crab'; // 수중 스테이지의 초록 몬스터는 꽃게
  return stage?.theme?.monsterSkins?.[t] || BASE_TEXTURE[t] || 'monster';
}

// 도감 칸마다 나오는 스테이지 번호들
export function monsterStages(stages) {
  const where = {};
  stages.forEach((st, i) => {
    for (const spot of st.monsters || []) {
      const id = dexIdFor(st, parseMonsterSpot(spot, st.groundY || 480).type);
      (where[id] ||= []).includes(i + 1) || where[id].push(i + 1);
    }
  });
  return where;
}

// 보스 그림 이름 (보스 종류와 skin 으로 정해진다, src/boss/*.js)
const BOSS_PORTRAIT = { arms: 'boss_body_', king: 'boss_body_', dragon: 'dragon_', ice: 'astra_', watcher: 'watcher_', sea: 'boss_sea_body_' };

export function bossDex(stages) {
  return stages.map((st, i) => {
    const n = i + 1;
    const skin = st.boss?.skin || n;
    const pre = BOSS_PORTRAIT[st.boss?.type];
    return { stage: n, name: st.boss?.name || `스테이지 ${n} 보스`, type: st.boss?.type, portrait: pre ? `${pre}${skin}` : null };
  });
}

export function emptyDex() {
  return { monsters: {}, bosses: [] };
}

export function normalizeDex(data, stageCount = 99) {
  const d = emptyDex();
  if (!data || typeof data !== 'object') return d;
  const known = new Set(MONSTER_DEX.map((e) => e.id));
  if (data.monsters && typeof data.monsters === 'object') {
    for (const [id, n] of Object.entries(data.monsters)) {
      if (known.has(id) && Number.isInteger(n) && n > 0) d.monsters[id] = n;
    }
  }
  if (Array.isArray(data.bosses)) d.bosses = [...new Set(data.bosses.filter((n) => Number.isInteger(n) && n >= 1 && n <= stageCount))];
  return d;
}

// 몬스터를 잡았을 때: 저장할 내용과 처음 잡았는지
export function recordMonster(save, id) {
  const dex = normalizeDex(save.dex);
  if (!MONSTER_DEX.some((e) => e.id === id)) return { patch: {}, isNew: false };
  const isNew = !dex.monsters[id];
  dex.monsters[id] = (dex.monsters[id] || 0) + 1;
  return { patch: { dex }, isNew };
}

// 보스를 처음 깼을 때만 새로 등록
export function recordBoss(save, stageNum) {
  const dex = normalizeDex(save.dex);
  if (dex.bosses.includes(stageNum)) return { patch: {}, isNew: false };
  dex.bosses.push(stageNum);
  return { patch: { dex }, isNew: true };
}

export function dexCounts(save, stageCount) {
  const dex = normalizeDex(save.dex, stageCount);
  return {
    monsters: MONSTER_DEX.filter((e) => dex.monsters[e.id]).length,
    monsterTotal: MONSTER_DEX.length,
    bosses: dex.bosses.length,
    bossTotal: stageCount,
  };
}

// 도감 보상: 새로 등록되면 보석을 준다. kind 'monster' 는 id(그림 이름), 'boss' 는 스테이지 번호
export function dexReward(save, kind, key, gemCfg = {}) {
  const r = kind === 'boss' ? recordBoss(save, key) : recordMonster(save, key);
  const gems = r.isNew ? (kind === 'boss' ? gemCfg.dexBoss : gemCfg.dexMonster) || 0 : 0;
  const patch = gems > 0 ? { ...r.patch, gems: (save.gems || 0) + gems } : r.patch;
  return { patch, gems, isNew: r.isNew };
}

export function monsterName(id) {
  return MONSTER_DEX.find((e) => e.id === id)?.name || '';
}

// 도감이 생기기 전 저장: 깬 스테이지의 몬스터와 보스를 채워 준다.
// 보스 문은 몬스터를 다 잡아야 열리니까, 깬 스테이지의 몬스터는 모두 한 번 이상 잡은 것이다 (보석은 안 줌)
export function dexFromProgress(save, stages) {
  const dex = emptyDex();
  const cleared = Object.keys(save.bestTimes || {}).map(Number).filter((n) => n >= 1 && n <= stages.length);
  for (const n of cleared) {
    const st = stages[n - 1];
    for (const spot of st.monsters || []) {
      const id = dexIdFor(st, parseMonsterSpot(spot, st.groundY || 480).type);
      dex.monsters[id] = (dex.monsters[id] || 0) + 1;
    }
    dex.bosses.push(n);
  }
  dex.bosses.sort((a, b) => a - b);
  return dex;
}
