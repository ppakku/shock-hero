import { heroWords, fixJosa } from './heroes.js';

// 조작 방식
// classic: A/D 또는 방향키로 이동, Space/W/↑ 점프, J 펀치, K/Shift 대시, L 궁극기
// arrows: 방향키로 이동, Space/↑ 점프, A 펀치, S 대시, D 궁극기
export const CONTROL_SCHEMES = ['classic', 'arrows'];

// 안내 글 속 {punch} 같은 표시를 고른 조작 방식의 키 이름으로 바꾼다.
// 스테이지 안내판과 로봇 대사에 쓴다. 예: '{punch} 를 꾹 눌러!' → 'J 를 꾹 눌러!'
// 터치의 공격 버튼 이름은 주인공마다 다르다 (펀치 버튼, 번개탄 버튼, 망치 버튼).
export const KEY_NAMES = {
  classic: { move: 'A / D 또는 ← →', jump: 'Space', punch: 'J', dash: 'K 또는 Shift', ult: 'L', up: 'W 나 ↑' },
  arrows: { move: '← →', jump: 'Space 또는 ↑', punch: 'A', dash: 'S 또는 Shift', ult: 'D', up: '↑' },
  touch: { move: '조이스틱', jump: '점프 버튼', punch: '펀치 버튼', dash: '대시 버튼', ult: '궁극기 버튼', up: '조이스틱 위로' },
};

// 터치 화면 공격 버튼에 쓸 글자 (주인공의 기본 공격 이름)
export const attackButtonLabel = (hero) => heroWords(hero).atk;

const fill = (str, names) => String(str).replace(/\{(\w+)\}/g, (m, k) => (typeof names[k] === 'string' ? names[k] : m));

// 조작법 글 틀. {atk} 같은 주인공 말과 {punch} 같은 키 이름은 controlLines 가 채운다.
const KEY_LINES = [
  '이동 {move}    점프 {jump}    {dashName} {dash}',
  '{atk} {punch} 또는 마우스 왼쪽 (꾹 눌렀다 떼면 {hold})    일시정지 Esc',
  '{upName} {up} 누른 채 {atk}    궁극기 {ult} (파란 게이지가 꽉 차면)',
];
const TOUCH_LINES = [
  '이동 왼쪽 화면을 엄지로 밀기 (조이스틱)    점프 버튼 (물속에선 꾹 눌러 헤엄)',
  '{atk} 버튼 (꾹 눌렀다 떼면 {hold})    대시 버튼    일시정지 오른쪽 위 II',
  '{upName} 조이스틱을 위로 민 채 {atk} 버튼    궁극기 버튼 (파란 게이지가 꽉 차면)',
];

// 조작법 철판에 쓸 세 줄. scheme 은 'classic', 'arrows', 'touch'. hero 는 고른 주인공.
export function controlLines(scheme, hero = 'shock') {
  const touch = scheme === 'touch';
  const names = touch ? {} : KEY_NAMES[normalizeControls(scheme)];
  return (touch ? TOUCH_LINES : KEY_LINES).map((line) => fixJosa(fill(fill(line, heroWords(hero)), names)));
}

export const CONTROL_INFO = {
  classic: { name: '기본 (WASD + J K L)', lines: controlLines('classic') },
  arrows: { name: '방향키 + A S D', lines: controlLines('arrows') },
};

// 태블릿 (키보드 없음): 화면 버튼으로 한다. 타이틀 조작판에 이 글을 쓴다.
export const TOUCH_INFO = { name: '터치 버튼', lines: controlLines('touch') };

// 조작 방식별 키 이름 (Phaser KeyCodes 이름)
export const CONTROL_KEYS = {
  classic: { left: ['A', 'LEFT'], right: ['D', 'RIGHT'], jump: ['SPACE', 'W', 'UP'], up: ['W', 'UP'], attack: ['J'], dash: ['K', 'SHIFT'], ult: ['L'] },
  arrows: { left: ['LEFT'], right: ['RIGHT'], jump: ['SPACE', 'UP'], up: ['UP'], attack: ['A'], dash: ['S', 'SHIFT'], ult: ['D'] },
};

// 안내 글을 고른 조작 방식과 주인공에 맞게 바꾼다.
// 1) {atk}, {strong}, {shieldTip} 같은 주인공 말 (src/logic/heroes.js 의 HERO_WORDS)
// 2) {punch}, {dash} 같은 키 이름. scheme 이 'touch' 면 버튼 이름으로 바꾸고 뒷말을 버튼에 맞게 고친다 ('J 를' → '펀치 버튼을').
// 3) '망치(으)로' 같은 조사 표시를 받침에 맞게 고른다 ('망치로', '번개탄으로').
export function keyText(str, scheme, hero = 'shock') {
  const touch = scheme === 'touch';
  const words = heroWords(hero);
  const names = touch ? { ...KEY_NAMES.touch, punch: `${words.atk} 버튼` } : KEY_NAMES[normalizeControls(scheme)];
  const out = fixJosa(fill(fill(str, words), names));
  if (!touch) return out;
  return out
    .replace(/ 또는 마우스 왼쪽/g, '') // 태블릿에는 마우스가 없다
    .replace(/조이스틱 위로 누른 채/g, '조이스틱을 위로 민 채')
    .replace(/버튼 키를/g, '버튼을')
    .replace(/버튼 키/g, '버튼')
    .replace(/버튼 를/g, '버튼을')
    .replace(/버튼 로/g, '버튼으로');
}

export function normalizeControls(scheme) {
  return CONTROL_SCHEMES.includes(scheme) ? scheme : 'classic';
}
