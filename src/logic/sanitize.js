// balance.js 에 숫자가 아닌 값이나 음수가 들어가도 게임이 멈추지 않게 고친다.
export function sanitizeNumbers(obj, warn = console.warn, path = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const p = path ? `${path}.${key}` : key;
    out[key] = sanitizeValue(value, p, warn);
  }
  return out;
}

function sanitizeValue(value, p, warn) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    warn(`[설정] ${p} 값 "${value}" 에 따옴표가 있어서 숫자 ${Number(value)} 로 바꿨어요`);
    return sanitizeValue(Number(value), p, warn);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      warn(`[설정] ${p} 값이 숫자가 아니라서 0 으로 바꿨어요`);
      return 0;
    }
    if (value < 0) {
      warn(`[설정] ${p} 값이 음수(${value})라서 ${-value} 로 바꿨어요`);
      return -value;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => sanitizeValue(v, `${p}[${i}]`, warn));
  if (value && typeof value === 'object') return sanitizeNumbers(value, warn, p);
  return value;
}
