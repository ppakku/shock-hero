import { balance } from './balance.js';
import { sanitizeNumbers } from '../logic/sanitize.js';

// 게임 코드는 balance.js 를 직접 읽지 않고, 안전하게 고친 이 값을 쓴다.
export const cfg = sanitizeNumbers(balance);

export const DEBUG =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
