import { describe, it, expect } from 'vitest';
import { balance } from '../src/config/balance.js';
import { sanitizeNumbers } from '../src/logic/sanitize.js';
import { HERO_IDS, HERO_WORDS, heroWords, fixJosa, batchim, gunnerAttack, giantAttack, rushAttack } from '../src/logic/heroes.js';
import { keyText, controlLines, CONTROL_INFO, TOUCH_INFO, attackButtonLabel } from '../src/logic/controls.js';
import { shieldResult } from '../src/logic/monsters.js';
import { jellyBlocks, pufferResult } from '../src/logic/swim.js';
import { tokenizeControlLine } from '../src/ui/titleLayout.js';
import { stages } from '../src/stage/index.js';

const cfg = sanitizeNumbers(balance, () => {});
const full = cfg.charge.fullTime + 1;

describe('조사 고르기', () => {
  it('받침을 읽는다', () => {
    expect(batchim('치')).toBe(0);
    expect(batchim('탄')).toBe(4);
    expect(batchim('일')).toBe(8);
    expect(batchim('J')).toBe(null);
  });

  it('(으)로: 받침 있으면 으로, 없거나 ㄹ 받침이면 로', () => {
    expect(fixJosa('충전 펀치(으)로')).toBe('충전 펀치로');
    expect(fixJosa('번개탄(으)로')).toBe('번개탄으로');
    expect(fixJosa('망치(으)로')).toBe('망치로');
    expect(fixJosa('레일(으)로')).toBe('레일로');
  });

  it('을/를, 이/가, 은/는, 이나/나, 과/와, 이랑/랑', () => {
    expect(fixJosa('번개탄(을)를 펀치(을)를')).toBe('번개탄을 펀치를');
    expect(fixJosa('레이저(이)가 망치 내려찍기(이)가 번개탄(이)가')).toBe('레이저가 망치 내려찍기가 번개탄이');
    expect(fixJosa('번개탄(은)는 망치(은)는')).toBe('번개탄은 망치는');
    expect(fixJosa('번개탄(이)나 망치(이)나')).toBe('번개탄이나 망치나');
    expect(fixJosa('번개탄(과)와 망치(과)와')).toBe('번개탄과 망치와');
    expect(fixJosa('번개탄(이)랑 망치(이)랑')).toBe('번개탄이랑 망치랑');
  });

  it('닫는 괄호 뒤면 괄호 앞 글자를 본다, 한글이 아니면 받침 없는 쪽', () => {
    expect(fixJosa('어퍼컷(펀치 버튼)(으)로')).toBe('어퍼컷(펀치 버튼)으로');
    expect(fixJosa('어퍼컷(J)(으)로')).toBe('어퍼컷(J)로');
    expect(fixJosa('L(을)를')).toBe('L를');
    expect(fixJosa('표시 없는 글은 그대로 (괄호도)')).toBe('표시 없는 글은 그대로 (괄호도)');
  });
});

describe('주인공별 안내 글', () => {
  it('세 주인공 모두 같은 말 칸이 있고, 금지 기호가 없다', () => {
    const keys = Object.keys(HERO_WORDS.shock);
    for (const id of HERO_IDS) {
      expect(Object.keys(HERO_WORDS[id]).sort()).toEqual([...keys].sort());
      for (const v of Object.values(HERO_WORDS[id])) expect(v).not.toMatch(/[—·]/);
    }
    expect(heroWords('ninja')).toBe(HERO_WORDS.shock);
  });

  it('공격 이름이 주인공마다 바뀌고 조사가 맞는다', () => {
    const t = '그때 {strong}(으)로 팔을 부숴! {atk} 한 방!';
    expect(keyText(t, 'classic', 'shock')).toBe('그때 충전 펀치로 팔을 부숴! 펀치 한 방!');
    expect(keyText(t, 'classic', 'gunner')).toBe('그때 레이저로 팔을 부숴! 번개탄 한 방!');
    expect(keyText(t, 'classic', 'giant')).toBe('그때 망치로 팔을 부숴! 망치 한 방!');
    expect(keyText('{atk}(으)로 터뜨려도 돼!', 'classic', 'gunner')).toBe('번개탄으로 터뜨려도 돼!');
    expect(keyText('{strong}(이)가 제일 세!', 'classic', 'gunner')).toBe('레이저가 제일 세!');
    // 주인공을 안 주면 쇼크 히어로
    expect(keyText('{hold}!', 'classic')).toBe('충전 펀치!');
  });

  it('문장 속 키 표시도 바뀐다', () => {
    expect(keyText('{jellyTip}', 'classic', 'gunner')).toBe('번개탄은 튕겨 나가. J 를 꾹 눌러 레이저로 깨뜨려!');
    expect(keyText('{jellyTip}', 'arrows', 'shock')).toBe('펀치는 튕겨 나가. A 를 꾹 눌러 충전 펀치로 깨뜨려!');
    expect(keyText('{dashSign}', 'touch', 'giant')).toBe('대시 버튼으로 몸통 박치기해서 피하기');
  });

  it('터치에서는 공격 버튼 이름이 주인공 공격 이름', () => {
    expect(keyText('{punch} 를 꾹 눌렀다가 떼면\n{hold}!', 'touch', 'gunner')).toBe('번개탄 버튼을 꾹 눌렀다가 떼면\n레이저!');
    expect(keyText('{punch} 또는 마우스 왼쪽\n{atk}!', 'touch', 'giant')).toBe('망치 버튼\n망치!');
    expect(keyText('점프 {atk}(이)나 {upAtk}({up} 누른 채 {punch})(으)로 잡아!', 'touch', 'shock')).toBe('점프 펀치나 어퍼컷(조이스틱을 위로 민 채 펀치 버튼)으로 잡아!');
    expect(attackButtonLabel('gunner')).toBe('번개탄');
    expect(attackButtonLabel('giant')).toBe('망치');
    expect(attackButtonLabel()).toBe('펀치');
  });

  it('조언이 실제 규칙과 맞는다 (방패, 단단한 해파리, 가시복어)', () => {
    // 방패: 쇼크는 충전 펀치, 사수는 레이저, 거인은 맨 망치와 몸통 박치기로 깸. 거인 회오리와 사수 번개탄은 막힘.
    expect(shieldResult(giantAttack(0.05, cfg).kind, 1, -1, true)).toBe('break');
    expect(shieldResult(rushAttack(cfg).kind, 1, -1, true)).toBe('break');
    expect(shieldResult(giantAttack(full, cfg).kind, 1, -1, true)).toBe('blocked');
    expect(shieldResult(gunnerAttack(0.05, cfg).kind, 1, -1, true)).toBe('blocked');
    expect(shieldResult(gunnerAttack(full, cfg).kind, 1, -1, true)).toBe('break');
    expect(HERO_WORDS.giant.shieldTip).toMatch(/회오리는 방패에 막혀/);
    // 해파리: 거인 망치는 뚫고, 회오리와 올려치기는 튕김
    const smash = giantAttack(0.05, cfg);
    expect(jellyBlocks(smash.kind, true, smash.ratio)).toBe(false);
    expect(jellyBlocks(giantAttack(full, cfg).kind, true, 1)).toBe(true);
    expect(jellyBlocks(giantAttack(0.05, cfg, 1, { up: true }).kind, true, 0)).toBe(true);
    expect(jellyBlocks(gunnerAttack(0.05, cfg).kind, true, 0)).toBe(true);
    expect(jellyBlocks(gunnerAttack(full, cfg).kind, true, 1)).toBe(false);
    // 가시복어: 사수 번개탄은 괜찮고, 거인 회오리와 올려치기는 찔림
    expect(pufferResult(gunnerAttack(0.05, cfg).kind, true)).toBe('hit');
    expect(pufferResult(giantAttack(full, cfg).kind, true)).toBe('thorns');
    expect(pufferResult(giantAttack(0.05, cfg, 1, { up: true }).kind, true)).toBe('thorns');
    expect(pufferResult(smash.kind, true)).toBe('hit');
    expect(HERO_WORDS.gunner.pufferTip).toMatch(/뚫어/);
  });

  it('조작법 세 줄: 쇼크 히어로는 예전 글 그대로, 다른 주인공은 공격 이름이 바뀐다', () => {
    expect(CONTROL_INFO.classic.lines[1]).toBe('펀치 J 또는 마우스 왼쪽 (꾹 눌렀다 떼면 충전 펀치)    일시정지 Esc');
    expect(CONTROL_INFO.arrows.lines[2]).toBe('어퍼컷 ↑ 누른 채 펀치    궁극기 D (파란 게이지가 꽉 차면)');
    expect(TOUCH_INFO.lines[1]).toBe('펀치 버튼 (꾹 눌렀다 떼면 충전 펀치)    대시 버튼    일시정지 오른쪽 위 II');
    expect(controlLines('classic', 'gunner')).toEqual([
      '이동 A / D 또는 ← →    점프 Space    대시 K 또는 Shift',
      '번개탄 J 또는 마우스 왼쪽 (꾹 눌렀다 떼면 레이저)    일시정지 Esc',
      '위로 쏘기 W 나 ↑ 누른 채 번개탄    궁극기 L (파란 게이지가 꽉 차면)',
    ]);
    expect(controlLines('touch', 'giant')[1]).toBe('망치 버튼 (꾹 눌렀다 떼면 회오리)    대시 버튼    일시정지 오른쪽 위 II');
    expect(controlLines('arrows', 'giant')[2]).toBe('올려치기 ↑ 누른 채 망치    궁극기 D (파란 게이지가 꽉 차면)');
  });

  it('키보드 조작법 줄은 타이틀 철판에서 글자를 잃지 않는다', () => {
    for (const id of HERO_IDS) {
      for (const scheme of ['classic', 'arrows']) {
        for (const line of controlLines(scheme, id)) {
          const joined = tokenizeControlLine(line).map((x) => x.text).join(' ');
          expect(joined.replace(/\s+/g, ' ')).toBe(line.replace(/\s+/g, ' '));
        }
      }
    }
  });

  it('모든 스테이지 안내판과 로봇 대사: 바꾼 뒤 {표시}나 조사 표시가 남지 않고, 다른 주인공 글에 펀치가 없다', () => {
    const texts = [];
    for (const st of stages) {
      for (const s of st.signs || []) texts.push(s.text);
      for (const t of st.talks || []) texts.push(...t.lines);
    }
    for (const id of HERO_IDS) {
      for (const scheme of ['classic', 'arrows', 'touch']) {
        for (const raw of texts) {
          const out = keyText(raw, scheme, id);
          expect(out).not.toMatch(/\{\w+\}/);
          expect(out).not.toMatch(/\((?:이|을|은|과|으)\)/);
          if (id !== 'shock') expect(out).not.toMatch(/펀치|어퍼컷/);
        }
      }
    }
  });
});
