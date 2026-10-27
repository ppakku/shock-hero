import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { stages } from '../stage/index.js';
import { cfg } from '../config/index.js';
import { HERO_INFO } from '../logic/heroes.js';
import { HERO_LOOKS } from '../fx/heroTextures.js';
import { todayKey, todayChallenge, challengeText, doneToday } from '../logic/daily.js';
import { isTouchDevice } from '../ui/touch.js';
import { makeText, FONT } from '../ui/text.js';
import { TITLE_FONT } from '../ui/titleArt.js';
import { coop } from '../net/coop.js';

// 오늘의 도전 창. 타이틀 위에 열리고, 닫으면 타이틀을 다시 그린다.
// 오늘 정해진 스테이지, 주인공, 규칙을 보여 주고 시작 버튼을 누르면 그 스테이지를 처음부터 한다.
// Enter 로 시작, Esc 또는 T 로 닫기. 손가락으로 눌러도 된다.
const INK = 0x10161c;

const RULE_TIP = {
  time: '시간이 지나면 도전은 실패지만, 끝까지 해 볼 수 있어요.',
  noDeath: '체크포인트에서 다시 하면 도전은 실패예요. 천천히 조심조심!',
  noUlt: '궁극기 게이지가 차도 꾹 참아요.',
  noDash: '대시 대신 점프로 피해 봐요.',
};

export class DailyScene extends Phaser.Scene {
  constructor() {
    super('Daily');
  }

  create() {
    const save = saveStore.load();
    const date = todayKey();
    const { challenge, patch } = todayChallenge(save, date, stages.length);
    if (patch) saveStore.update(patch); // 오늘 도전을 적어 둔다 (오늘 스테이지를 더 깨도 안 바뀌게)
    this.challenge = challenge;
    this.solo = !coop.hostConnected; // 함께하기 친구가 들어와 있으면 혼자 할 때만 된다
    const done = doneToday(save, date);
    const c = challenge;
    const st = stages[c.stage - 1];
    const hero = HERO_INFO[c.hero];

    this.add.rectangle(480, 270, 960, 540, 0x000000, 0.9).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(INK, 1).fillRoundedRect(156, 70, 648, 404, 18);
    g.fillStyle(0xf4ecd8, 1).fillRoundedRect(162, 76, 636, 392, 14);
    // 위 띠 (노랑 검정 줄무늬, 보스 러시 버튼과 같은 느낌)
    g.fillStyle(0x2a2f38, 1).fillRoundedRect(162, 76, 636, 64, { tl: 14, tr: 14, bl: 0, br: 0 });
    for (let x = 162; x < 798; x += 20) g.fillStyle(0xffc21f, 1).fillTriangle(x, 140, x + 10, 140, x + 5, 132);
    this.add
      .text(186, 108, '오늘의 도전', { fontFamily: `${TITLE_FONT}, ${FONT}`, fontSize: '32px', color: '#ffe14a', stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0, 0.5);
    makeText(this, 774, 108, date.replace(/-/g, '.'), 16, '#dddddd').setOrigin(1, 0.5);

    // 왼쪽: 주인공 그림과 이름
    g.fillStyle(0xe2d6b8, 1).fillRoundedRect(186, 160, 170, 190, 12);
    const key = `${HERO_LOOKS[c.hero].prefix}_idle0`;
    const tex = c.hero === 'shock' && this.registry.get('heroCustomArt') ? 'player' : this.textures.exists(key) ? key : 'player';
    const img = this.add.image(271, 318, tex).setOrigin(0.5, 1);
    img.setScale(Math.min(150 / img.width, 140 / img.height));
    makeText(this, 271, 334, hero.name, 18, hero.color, { strokeThickness: 4 }).setOrigin(0.5);

    // 오른쪽: 도전 설명
    const dark = { strokeThickness: 0 };
    makeText(this, 380, 172, `스테이지 ${c.stage}  ${st?.name ?? ''}`, 17, '#5a5040', { ...dark, fontStyle: 'bold' }).setOrigin(0, 0.5);
    makeText(this, 380, 216, challengeText(c), 22, '#1a1408', { ...dark, fontStyle: 'bold', align: 'left', wordWrap: { width: 396, useAdvancedWrap: true }, lineSpacing: 6 }).setOrigin(0, 0);
    makeText(this, 380, 290, RULE_TIP[c.rule], 15, '#5a5040', { ...dark, align: 'left', wordWrap: { width: 396, useAdvancedWrap: true } }).setOrigin(0, 0);
    makeText(this, 380, 336, '이번 판만 이 주인공으로 해요. 고른 주인공은 그대로 남아요.', 13, '#7a6a50', dark).setOrigin(0, 0.5);

    const reward = done ? '오늘 깼어요! 보석은 하루에 한 번만 받아요.' : `깨면 보석 ${cfg.gems.daily}개`;
    makeText(this, 480, 378, reward, 18, done ? '#2a7a3a' : '#1c4a7a', { ...dark, fontStyle: 'bold' }).setOrigin(0.5);

    const can = this.solo;
    this.startBtn = makeText(this, 400, 430, can ? (done ? '한 번 더 하기' : '도전 시작!') : '혼자 할 때만 돼요', 22, '#1a1408', {
      backgroundColor: can ? '#ffe14a' : '#999999',
      padding: { x: 22, y: 10 },
      strokeThickness: 0,
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerdown', () => this.start());
    const close = makeText(this, 600, 430, '닫기', 22, '#ffffff', { backgroundColor: '#5a1020', padding: { x: 22, y: 10 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.close());
    if (!isTouchDevice()) makeText(this, 480, 506, 'Enter: 시작    Esc 또는 T: 닫기', 14, '#cccccc').setOrigin(0.5);

    const kb = this.input.keyboard;
    const once = (fn) => (e) => {
      if (!e?.repeat) fn();
    };
    ['ENTER', 'SPACE'].forEach((k) => kb.on(`keydown-${k}`, once(() => this.start())));
    ['ESC', 'T'].forEach((k) => kb.on(`keydown-${k}`, once(() => this.close())));
    this.cameras.main.fadeIn(120);
  }

  start() {
    if (!this.solo) {
      sfx.play('locked');
      return;
    }
    sfx.play('beep');
    this.scene.get('Title').startDaily(this.challenge);
  }

  close() {
    sfx.play('beep');
    const title = this.scene.get('Title');
    this.scene.stop();
    title.closeDaily?.();
  }
}
