import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { makeText, formatTime } from '../ui/text.js';
import { saveStore } from '../save.js';
import { resetProgress } from '../logic/save.js';
import { stages, totalTreasures } from '../stage/index.js';
import { DIFFICULTIES, DIFFICULTY_INFO } from '../logic/difficulty.js';
import { CONTROL_SCHEMES, CONTROL_INFO } from '../logic/controls.js';

// 타이틀: 스테이지 고르기 + 설정(난이도, 조작, 레벨 초기화)
// ↑ ↓ 로 줄을 옮기고, ← → 로 고르고, Enter 로 시작하거나 바꾼다. 마우스로 눌러도 된다.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.showAll = new URLSearchParams(window.location.search).has('all');
    this.started = false;
    this.confirming = false;
    this.selected = 0;
    this.row = 0; // 0: 스테이지 줄, 1: 설정 줄
    this.option = 0; // 설정 줄에서 고른 버튼 (0 난이도, 1 조작, 2 초기화)
    this.build();

    const kb = this.input.keyboard;
    const on = (keys, fn) => keys.forEach((k) => kb.on(`keydown-${k}`, fn));
    on(['LEFT', 'A'], () => this.move(-1));
    on(['RIGHT', 'D'], () => this.move(1));
    on(['UP', 'W'], () => this.setRow(0));
    on(['DOWN', 'S'], () => this.setRow(1));
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => kb.on(`keydown-${k}`, () => !this.confirming && this.select(i + 1)));
    on(['ENTER', 'SPACE'], () => this.activate());
    kb.on('keydown-N', () => {
      if (this.confirming) this.closeConfirm();
      else if (this.row === 0) this.begin(false);
    });
    kb.on('keydown-Y', () => this.confirming && this.doReset());
    kb.on('keydown-ESC', () => this.confirming && this.closeConfirm());
  }

  // 화면을 (다시) 그린다. 설정을 바꾸거나 초기화하면 다시 부른다.
  build() {
    this.tweens.killAll();
    this.children.removeAll(true);
    const save = saveStore.load();
    this.save = save;
    const firstPick = save.checkpoint || save.unlocked;
    if (this.showAll) save.unlocked = stages.length; // 주소에 ?all: 모든 스테이지 열기 (테스트용, 저장은 안 바뀜)
    if (!this.selected || this.selected > save.unlocked) this.selected = firstPick;

    const { width } = this.scale;
    const g = this.add.graphics();
    g.fillGradientStyle(0x2a1640, 0x2a1640, 0xd9643a, 0xd9643a, 1).fillRect(0, 0, 960, 540);
    g.fillStyle(0x140b1f, 1);
    for (let i = 0; i < 16; i++) {
      const h = 80 + ((i * 53) % 140);
      g.fillRect(i * 62, 540 - h, 54, h);
    }

    makeText(this, width / 2, 58, '쇼크 히어로', 54, '#ffd23f', { strokeThickness: 10 }).setOrigin(0.5);
    makeText(this, width / 2, 108, '몬스터 브레이커', 24, '#ffffff').setOrigin(0.5);
    const scheme = CONTROL_INFO[save.settings.controls] || CONTROL_INFO.classic;
    makeText(this, width / 2, 166, scheme.lines.join('\n'), 15, '#ffffff', { lineSpacing: 5 }).setOrigin(0.5);

    // 스테이지 카드 (스테이지 수에 맞춰 폭과 간격을 줄인다. 6개면 폭 134, 간격 146)
    const gap = Math.min(150, Math.floor(880 / stages.length));
    const cardW = gap - 12;
    this.cards = stages.map((st, i) => {
      const n = i + 1;
      const x = width / 2 + (i - (stages.length - 1) / 2) * gap;
      const box = this.add.rectangle(x, 266, cardW, 80, 0x000000, 0.5).setStrokeStyle(3, 0x888888);
      const locked = n > save.unlocked;
      const found = st.treasures.filter((t) => save.treasures.includes(t.id)).length;
      const best = save.bestTimes[n];
      makeText(this, x, 243, `스테이지 ${n}`, 17, locked ? '#777777' : '#ffffff').setOrigin(0.5);
      makeText(this, x, 265, locked ? '잠김' : st.name, 15, locked ? '#777777' : '#ffd23f').setOrigin(0.5);
      makeText(this, x, 288, locked ? '' : `보물 ${found}/${st.treasures.length}${best ? `  ${formatTime(best)}` : ''}`, 12, '#dddddd').setOrigin(0.5);
      box.setInteractive({ useHandCursor: !locked }).on('pointerdown', () => {
        if (locked || this.confirming) return;
        this.row = 0;
        if (this.selected === n) this.begin(this.canContinue);
        else this.select(n);
      });
      return { box, locked };
    });

    // 설정 버튼 줄
    const d = DIFFICULTY_INFO[save.settings.difficulty];
    const c = CONTROL_INFO[save.settings.controls];
    const labels = [`난이도: ${d.name}`, `조작: ${c.name}`, '레벨 초기화'];
    const xs = [width / 2 - 260, width / 2, width / 2 + 260];
    this.buttons = labels.map((text, i) => {
      const box = this.add.rectangle(xs[i], 338, 240, 36, 0x000000, 0.55).setStrokeStyle(2, 0x888888);
      makeText(this, xs[i], 338, text, 16, i === 2 ? '#ff9a8a' : '#ffffff').setOrigin(0.5);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.confirming) return;
        this.row = 1;
        this.option = i;
        this.press(i);
      });
      return { box };
    });
    this.optionHelp = makeText(this, width / 2, 372, '', 14, '#dddddd').setOrigin(0.5);

    this.startText = makeText(this, width / 2, 414, '', 22, '#3ff07a').setOrigin(0.5);
    this.tweens.add({ targets: this.startText, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.subText = makeText(this, width / 2, 446, '', 15, '#ffffff').setOrigin(0.5);

    const info = [`레벨 ${save.level}`, `보물 ${save.treasures.length}/${totalTreasures}`];
    if (save.bestTimes[stages.length]) info.push('모든 스테이지 클리어!');
    makeText(this, width / 2, 510, info.join('   '), 16, '#dddddd').setOrigin(0.5);

    if (this.sys.game.device.input.touch && !this.sys.game.device.os.desktop) {
      makeText(this, width / 2, 482, '지금은 키보드가 있는 컴퓨터에서 할 수 있어요', 16, '#ff9a1f').setOrigin(0.5);
    }

    // 레벨 초기화 확인 창
    this.confirmBox = this.add.container(0, 0).setDepth(50).setVisible(this.confirming);
    const bg = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.8).setInteractive();
    const msg = makeText(this, 480, 225, '정말 처음부터 다시 할까요?\n레벨, 경험치, 보물, 스테이지 기록이 모두 지워져요.', 22, '#ffffff', { lineSpacing: 8 }).setOrigin(0.5);
    const yes = makeText(this, 390, 320, 'Y: 지우기', 24, '#ff6a5a').setOrigin(0.5).setInteractive({ useHandCursor: true });
    const no = makeText(this, 570, 320, 'N: 취소', 24, '#3ff07a').setOrigin(0.5).setInteractive({ useHandCursor: true });
    yes.on('pointerdown', () => this.doReset());
    no.on('pointerdown', () => this.closeConfirm());
    this.confirmBox.add([bg, msg, yes, no]);

    this.refresh();
  }

  get canContinue() {
    return this.save.checkpoint === this.selected;
  }

  setRow(r) {
    if (this.confirming) return;
    this.row = r;
    this.refresh();
  }

  move(dir) {
    if (this.confirming) return;
    if (this.row === 0) this.select(this.selected + dir);
    else {
      this.option = Phaser.Math.Clamp(this.option + dir, 0, 2);
      this.refresh();
    }
  }

  select(n) {
    if (n < 1 || n > stages.length || n > this.save.unlocked) return;
    this.selected = n;
    this.refresh();
  }

  activate() {
    if (this.confirming) return;
    if (this.row === 0) this.begin(this.canContinue);
    else this.press(this.option);
  }

  // 설정 버튼 누르기: 난이도와 조작은 다음 것으로 바뀌고, 초기화는 확인 창을 띄운다
  press(i) {
    const s = this.save.settings;
    if (i === 2) {
      this.confirming = true;
      this.confirmBox.setVisible(true);
      return;
    }
    if (i === 0) {
      const next = DIFFICULTIES[(DIFFICULTIES.indexOf(s.difficulty) + 1) % DIFFICULTIES.length];
      saveStore.update({ settings: { ...s, difficulty: next } });
    } else {
      const next = CONTROL_SCHEMES[(CONTROL_SCHEMES.indexOf(s.controls) + 1) % CONTROL_SCHEMES.length];
      saveStore.update({ settings: { ...s, controls: next } });
    }
    sfx.unlock();
    sfx.muted = s.muted;
    sfx.play('beep');
    this.build();
  }

  closeConfirm() {
    this.confirming = false;
    this.confirmBox.setVisible(false);
  }

  doReset() {
    saveStore.save(resetProgress(saveStore.load()));
    this.confirming = false;
    this.selected = 1;
    this.row = 0;
    this.build();
    const done = makeText(this, 480, 372, '처음부터 새로 시작해요! 레벨 1, 보물 0개', 18, '#ffd23f').setOrigin(0.5).setDepth(60);
    this.optionHelp.setVisible(false);
    this.time.delayedCall(1800, () => {
      done.destroy();
      this.optionHelp.setVisible(true);
    });
  }

  refresh() {
    const n = this.selected;
    this.cards.forEach((c, i) => {
      const on = this.row === 0 && i + 1 === n;
      const picked = i + 1 === n;
      c.box.setStrokeStyle(on ? 5 : 3, on ? 0x3ff07a : picked ? 0x7fbf8f : c.locked ? 0x444444 : 0x888888);
      c.box.setFillStyle(0x000000, picked ? 0.75 : 0.5);
    });
    this.buttons.forEach((b, i) => {
      const on = this.row === 1 && this.option === i;
      b.box.setStrokeStyle(on ? 4 : 2, on ? 0x3ff07a : 0x888888);
    });
    const helps = [
      DIFFICULTY_INFO[this.save.settings.difficulty].desc,
      '키보드 조작 방식을 바꿔요. 위의 조작법 설명도 바로 바뀌어요.',
      '레벨과 보물을 모두 지우고 처음부터 다시 쌓아요.',
    ];
    this.optionHelp.setText(this.row === 1 ? `${helps[this.option]}  (Enter 또는 클릭으로 바꾸기)` : '↓ 키를 누르면 난이도, 조작, 레벨 초기화를 고를 수 있어요');
    this.startText.setText(this.canContinue ? `Enter: 스테이지 ${n} 체크포인트부터 이어하기` : `Enter: 스테이지 ${n} 시작`);
    if (this.row === 1) this.startText.setText('↑ 키: 스테이지 고르기로 돌아가기');
    this.subText.setText(
      this.row === 1
        ? ''
        : [this.save.unlocked > 1 ? '← → 또는 숫자로 스테이지 고르기' : '', this.canContinue ? 'N: 처음부터' : ''].filter(Boolean).join('    '),
    );
  }

  begin(fromCheckpoint) {
    if (this.started || this.confirming) return;
    this.started = true;
    sfx.unlock();
    sfx.muted = this.save.settings.muted;
    if (!fromCheckpoint) saveStore.update({ checkpoint: null });
    this.registry.set('runTime', 0);
    this.scene.start('Game', { stage: this.selected, fromCheckpoint });
    this.scene.launch('HUD');
  }
}
