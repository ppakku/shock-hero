// 킹 계열 전용 공격의 계산 (화면과 상관없는 부분)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 이번 공격 차례에 전용 공격을 꼭 내야 하는지: 목록에 있는데 아직 한 번도 안 썼으면 내보낸다
export function needsSignature(list, seen, name) {
  return Boolean(name) && (list || []).includes('signature') && !seen.has(name);
}

// 주인공 등 뒤 자리. 등 뒤가 벽이면 앞쪽으로 나온다.
export function behindSpot(x, facing, gap, lo, hi) {
  const back = x - facing * gap;
  if (back >= lo && back <= hi) return back;
  return clamp(x + facing * gap, lo, hi);
}

// 가운데 x, 반지름 r 인 구역. 싸움터를 넘는 쪽은 잘라 낸다. { x0, w }
export function zoneAround(x, r, lo, hi) {
  const x0 = Math.max(lo, x - r);
  return { x0, w: Math.min(hi, x + r) - x0 };
}

// 구역 안에 고르게 내리칠 번개 자리들
export function boltSpots(zone, count) {
  return Array.from({ length: count }, (_, i) => zone.x0 + (zone.w * (i + 0.5)) / count);
}

// 불기둥 줄. rows 줄이 from 쪽에서 to 쪽으로 차례로 터진다. 뒷줄은 앞줄 빈틈에 선다.
// 기둥 하나: { x, warnAt(경고 시작), at(터지는 때) }
export function fireRows(from, to, { rows = 1, gap, warn, step, rest }) {
  const dir = to >= from ? 1 : -1;
  const count = Math.floor(Math.abs(to - from) / gap) + 1;
  const list = [];
  let warnAt = 0;
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 ? gap / 2 : 0;
    for (let i = 0; i < count; i++) {
      const x = from + dir * (shift + i * gap);
      if (Math.abs(x - from) <= Math.abs(to - from)) list.push({ x, warnAt, at: warnAt + warn + i * step });
    }
    warnAt += warn + count * step + rest;
  }
  return list;
}

const MIX_KINDS = ['bolt', 'spike', 'spore'];
const MIX_OFFSET = { bolt: 0, spike: 70, spore: 190 }; // 주인공 자리에서 떨어진 거리

// 마지막 공격에 섞이는 작은 위험들. 세 가지가 번갈아 나와서 어느 하나도 빠지지 않는다.
// 하나: { kind, at(나오는 때), offset(주인공에서 떨어진 거리) }
export function mixPlan(count, gap, rand = Math.random) {
  const start = Math.floor(rand() * MIX_KINDS.length);
  return Array.from({ length: count }, (_, i) => {
    const kind = MIX_KINDS[(start + i) % MIX_KINDS.length];
    const side = rand() < 0.5 ? -1 : 1;
    return { kind, at: i * gap, offset: MIX_OFFSET[kind] * side };
  });
}
