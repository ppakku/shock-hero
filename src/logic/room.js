// 함께하기 방 코드. 화면과 상관없어서 테스트한다.
// 헷갈리는 글자(숫자 0 과 영어 O, 숫자 1 과 영어 I, L)는 빼고 대문자와 숫자만 쓴다.
export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
const PREFIX = 'shockhero-'; // 다른 게임과 같은 중개 서버를 쓰므로 앞에 이름을 붙인다

// 아이들 화면에 나오면 안 되는 영어 글자 묶음. 코드에 들어 있으면 다시 뽑는다.
export const BLOCKED = ['FCK', 'FUK', 'FUC', 'FAG', 'SEX', 'ASS', 'XXX', 'KKK', 'NAZ', 'DCK', 'CUM', 'WTF', 'TWAT', 'SHT', 'PUSS', 'PNS', 'VAG', 'KYS', 'NGR', 'NGA'];
export const isClean = (code) => !BLOCKED.some((w) => code.includes(w));

// 5 자리 무작위 방 코드 (rand 는 0 이상 1 미만을 주는 함수)
export function makeRoomCode(rand = Math.random) {
  for (let tries = 0; ; tries++) {
    let s = '';
    for (let i = 0; i < CODE_LENGTH; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length) % CODE_CHARS.length];
    if (isClean(s) || tries > 50) return s;
  }
}

// 친구가 친 글자를 코드 모양으로: 소문자는 대문자로, 쓸 수 없는 글자와 빈칸은 버리고, 5 자리까지만
export function cleanCode(text) {
  return String(text || '')
    .toUpperCase()
    .split('')
    .filter((c) => CODE_CHARS.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

export const isRoomCode = (code) => typeof code === 'string' && code.length === CODE_LENGTH && cleanCode(code) === code;

// 중개 서버에 쓰는 방 이름
export const peerIdFor = (code) => `${PREFIX}${code}`;

// 친구가 보낸 키 묶음을 방장이 쓰는 모양으로 합친다.
// 누르고 있는 키(down)는 새 값으로, 한 번 누른 키(pressed)는 방장이 읽을 때까지 남겨 둔다 (두 번 받는 사이에 사라지지 않게).
export const HELD_KEYS = ['left', 'right', 'jumpDown', 'attackDown', 'upDown'];
export const TAP_KEYS = ['jumpPressed', 'dashPressed', 'ultPressed'];
export function mergeInput(prev, msg) {
  const out = { ...prev };
  for (const k of HELD_KEYS) out[k] = Boolean(msg[k]);
  for (const k of TAP_KEYS) out[k] = Boolean(prev[k] || msg[k]);
  return out;
}
