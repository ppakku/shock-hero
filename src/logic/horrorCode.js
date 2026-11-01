// 공포 모드 정문 번호: 붉은 쪽지 3장과 전원 화면으로 4자리를 맞힌다. 판마다 번호가 바뀐다.
export const CODE_LEN = 4;
export const CLUE_COUNT = 3;

// 첫째 자리는 쪽지에 그대로, 둘째는 첫째에 add 를 더한 수, 셋째는 둘째와 같거나 1 작은 수, 넷째는 전원 화면에 나온다
export function createCode(rand = Math.random) {
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const first = pick(1, 6);
  const add = pick(1, 3);
  const second = first + add;
  const same = rand() < 0.5;
  return { digits: [first, second, same ? second : second - 1, pick(0, 9)], add, same, entered: '', solved: false };
}

// key: '0' 에서 '9', 또는 'erase'. 네 자리를 다 넣으면 'right' 나 'wrong', 그 전에는 'typing' 을 돌려준다
export function pressCode(code, key) {
  if (code.solved) return 'right';
  if (key === 'erase') code.entered = code.entered.slice(0, -1);
  else if (code.entered.length < CODE_LEN) code.entered += key;
  if (code.entered.length < CODE_LEN) return 'typing';
  const right = code.entered === code.digits.join('');
  code.entered = '';
  code.solved = right;
  return right ? 'right' : 'wrong';
}

// 입력 칸 모습: 넣은 숫자와 빈칸
export function codeDisplay(code) {
  return Array.from({ length: CODE_LEN }, (_, i) => code.entered[i] ?? '_').join(' ');
}
