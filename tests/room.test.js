import { describe, it, expect } from 'vitest';
import { makeRoomCode, cleanCode, isRoomCode, isClean, peerIdFor, mergeInput, CODE_CHARS } from '../src/logic/room.js';

describe('함께하기 방 코드', () => {
  it('5 자리, 헷갈리는 글자 없음', () => {
    for (let i = 0; i < 200; i++) {
      const c = makeRoomCode();
      expect(c).toHaveLength(5);
      expect(isRoomCode(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
    expect(CODE_CHARS).not.toMatch(/[01OIL]/);
  });

  it('나쁜 말 글자 묶음이 들어간 코드는 다시 뽑는다', () => {
    const seq = 'FCK22'.split('').map((c) => (CODE_CHARS.indexOf(c) + 0.5) / CODE_CHARS.length);
    const next = 'ABCDE'.split('').map((c) => (CODE_CHARS.indexOf(c) + 0.5) / CODE_CHARS.length);
    const all = [...seq, ...next];
    let i = 0;
    expect(makeRoomCode(() => all[i++])).toBe('ABCDE');
    expect(isClean('K7Q2M')).toBe(true);
    expect(isClean('AFCKB')).toBe(false);
  });

  it('같은 난수면 같은 코드', () => {
    const r = () => 0.5;
    expect(makeRoomCode(r)).toBe(makeRoomCode(r));
    expect(makeRoomCode(() => 0)).toBe('AAAAA');
    expect(makeRoomCode(() => 0.9999)).toBe('99999');
  });

  it('친구가 친 글자를 코드로 고친다', () => {
    expect(cleanCode('k7q2m')).toBe('K7Q2M');
    expect(cleanCode(' K7 Q-2M ')).toBe('K7Q2M');
    expect(cleanCode('K7Q2MXYZ')).toBe('K7Q2M');
    expect(cleanCode('O0I1L')).toBe('');
    expect(isRoomCode('K7Q2')).toBe(false);
    expect(isRoomCode('k7q2m')).toBe(false);
  });

  it('중개 서버 이름은 게임 이름을 붙인다', () => {
    expect(peerIdFor('K7Q2M')).toBe('shockhero-K7Q2M');
  });

  it('누른 키 합치기: 한 번 누른 키는 읽기 전까지 남는다', () => {
    let s = mergeInput({}, { right: true, jumpPressed: true });
    expect(s.right).toBe(true);
    expect(s.jumpPressed).toBe(true);
    s = mergeInput(s, { right: false });
    expect(s.right).toBe(false);
    expect(s.jumpPressed).toBe(true); // 아직 방장이 안 읽었다
  });
});
