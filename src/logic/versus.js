// 겨루기: 함께하기 친구와 서로 때려서 먼저 세 판을 이기는 대결. 화면과 상관없어서 테스트한다.
// 판(match)은 { round, wins: [1P 승수, 2P 승수], heroes: [1P 주인공, 2P 주인공] } 이고, 2P 쪽 번호는 1 이다.

// 겨루기에서는 레벨, 강화 카드, 상점 강화를 쓰지 않는다 (오래 한 사람이 무조건 이기지 않게)
export const VERSUS_PROFILE = { level: 1, upgrades: {}, shop: {} };

export const newMatch = (heroes) => ({ round: 1, wins: [0, 0], heroes });

// 겨루기용 설정: 궁극기 게이지만 빨리 찬다 (한 판 체력 100 안팎이라 모험 속도로는 궁극기를 못 쓴다)
export function versusConfig(cfg) {
  const u = cfg.ultimate;
  const k = cfg.versus.ultGaugeBoost;
  return { ...cfg, ultimate: { ...u, gaugePerDamage: u.gaugePerDamage * k, gaugePerHurt: u.gaugePerHurt * k } };
}

export const sideName = (side) => `${side + 1}P`;

// 시간이 다 됐을 때 이긴 쪽: 남은 체력 비율이 높은 쪽. 같으면 null (무승부)
export function timeUpWinner([first, second]) {
  if (first === second) return null;
  return first > second ? 0 : 1;
}

// 한 판이 끝난 뒤의 판 상태. winner 가 null 이면 승수 없이 같은 판을 다시 한다.
// champion: 정해진 승수를 채운 쪽 (아직 없으면 null)
export function afterRound(match, winner, winsNeeded) {
  if (winner === null) return { ...match, champion: null };
  const wins = match.wins.map((n, side) => (side === winner ? n + 1 : n));
  return { ...match, round: match.round + 1, wins, champion: wins[winner] >= winsNeeded ? winner : null };
}

// 상대가 받는 피해. 궁극기는 최대 체력의 ultCap 배까지만 (한 방에 판이 끝나지 않게)
export function versusDamage(attack, maxHealth, ultCap) {
  if (attack.kind !== 'ultimate') return attack.damage;
  return Math.min(attack.damage, Math.round(maxHealth * ultCap));
}

// 승수 표시: 2 승 / 3 승이면 '●●○'
export const winPips = (wins, winsNeeded) => '●'.repeat(Math.min(wins, winsNeeded)) + '○'.repeat(Math.max(0, winsNeeded - wins));
