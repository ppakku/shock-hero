import Phaser from 'phaser';
import { cfg } from '../config/index.js';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { xpToNext } from '../logic/progression.js';
import { DIFFICULTY_INFO } from '../logic/difficulty.js';
import { POWER_IDS, POWER_INFO, UPGRADE_TRACKS, UPGRADE_INFO } from '../logic/growth.js';
import { makeText, formatTime } from '../ui/text.js';
import { isTouchDevice, touchPad, TOUCH_BUTTONS, PAUSE_BUTTON, STICK } from '../ui/touch.js';

// 화면 위에 겹쳐 그리는 정보판. 게임 장면이 멈춰도 이 장면은 계속 돈다.
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    this.g = this.add.graphics();
    this.hpText = makeText(this, 24, 44, '', 14).setOrigin(0, 0.5);
    this.lvText = makeText(this, 24, 70, '', 14, '#9fe8ff').setOrigin(0, 0.5);
    this.dashText = makeText(this, 290, 34, '대시', 13).setOrigin(0.5);
    this.treasureText = makeText(this, 266, 70, '', 14, '#ffd23f').setOrigin(0, 0.5);
    this.timeText = makeText(this, 936, 30, '', 18).setOrigin(1, 0.5);
    this.ultText = makeText(this, 24, 106, '', 13, '#9fe8ff').setOrigin(0, 0.5).setVisible(false);
    this.stageText = makeText(this, 936, 54, '', 13, '#dddddd').setOrigin(1, 0.5);
    this.monsterText = makeText(this, 600, 30, '', 18, '#ff8a8a').setOrigin(0.5);
    this.bossTitle = makeText(this, 600, 14, '', 16, '#ff9ad5').setOrigin(0.5).setVisible(false);
    this.bossLabels = [0, 1, 2, 3].map(() => makeText(this, 0, 0, '', 12).setOrigin(0.5).setVisible(false));
    this.beepTimer = 0;
    // 레벨 업 카드 레벨 (공격, 방어, 속도, 볼트)
    this.upgradeText = makeText(this, 24, 126, '', 12, '#ffd23f').setOrigin(0, 0.5);
    // 켜진 특별한 힘: 아이콘 + 남은 초
    this.powerIcons = POWER_IDS.map(() => ({
      img: this.add.image(0, 0, 'pw_speed').setVisible(false).setScale(0.8),
      text: makeText(this, 0, 0, '', 12).setOrigin(0.5).setVisible(false),
    }));

    this.overlay = this.add.container(0, 0).setVisible(false).setDepth(100);
    this.overlayBg = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.6);
    this.overlayTitle = makeText(this, 480, 170, '', 48, '#ffffff', { strokeThickness: 8 }).setOrigin(0.5);
    this.overlayBody = makeText(this, 480, 230, '', 20, '#ffffff', { lineSpacing: 10 }).setOrigin(0.5, 0);
    this.overlay.add([this.overlayBg, this.overlayTitle, this.overlayBody]);
    this.overlayButtons = [];
    this.mode = 'play';
    this.touch = isTouchDevice();
    if (this.touch) this.buildTouchPad();

    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-M', () => this.toggleSetting('muted'));
    this.input.keyboard.on('keydown-T', () => {
      if (this.mode === 'paused') this.pauseToTitle();
    });
    this.input.keyboard.on('keydown-H', () => {
      if (this.mode === 'paused') this.toggleSetting('shake');
    });
    // 효과 줄이기 (느린 노트북이나 번쩍임이 불편한 사람용)
    this.input.keyboard.on('keydown-F', () => {
      if (this.mode === 'paused') this.toggleSetting('lowFx');
    });
    this.input.keyboard.on('keydown-R', () => this.restartFromOverlay('retry'));
    this.input.keyboard.on('keydown-ENTER', () => this.restartFromOverlay('next'));
    this.input.keyboard.on('keydown-T', () => this.restartFromOverlay('title'));
    // 빈 곳을 누르면 다음으로 (화면 버튼을 누른 거면 그 버튼이 처리한다)
    this.input.on('pointerdown', (_p, over) => {
      if (!over.length) this.restartFromOverlay('next');
    });
  }

  pauseToTitle() {
    this.mode = 'play';
    this.overlay.setVisible(false);
    this.scene.stop('Game');
    this.scene.start('Title');
  }

  // ---------- 태블릿 화면 버튼 ----------
  buildTouchPad() {
    this.padG = this.add.graphics().setDepth(90);
    this.padLabels = TOUCH_BUTTONS.map((b) =>
      makeText(this, b.x, b.y, b.label, b.label.length > 1 ? Math.max(14, Math.round(b.r * 0.46)) : Math.round(b.r * 0.6), '#ffffff')
        .setOrigin(0.5)
        .setDepth(91),
    );
    const pb = PAUSE_BUTTON;
    this.pauseBtn = this.add.container(pb.x, pb.y).setDepth(92);
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.45).fillCircle(0, 0, pb.r).lineStyle(3, 0xffffff, 0.7).strokeCircle(0, 0, pb.r);
    pg.fillStyle(0xffffff, 0.9).fillRect(-7, -8, 5, 16).fillRect(2, -8, 5, 16);
    this.pauseBtn.add(pg);
    this.pauseBtn.setSize(pb.r * 2.4, pb.r * 2.4).setInteractive().on('pointerdown', () => this.togglePause());
  }

  drawTouchPad(gs, p) {
    const show = this.mode === 'play' && gs.scene.isActive() && !gs.ended && !p.dead;
    this.padG.clear().setVisible(show);
    this.padLabels.forEach((t) => t.setVisible(show));
    this.pauseBtn.setVisible(this.mode === 'play' || this.mode === 'paused');
    if (!show) return;
    const ultReady = typeof p.ultGauge === 'number' && p.ultGauge >= 1;
    // 버튼은 게임이 잘 보이게 흐릿하게, 누르는 동안만 또렷하게
    TOUCH_BUTTONS.forEach((b, i) => {
      const down = !!touchPad.down[b.id];
      const glow = b.id === 'ult' && ultReady;
      this.padG.fillStyle(down ? 0xffffff : glow ? 0x3fd0ff : 0x000000, down ? 0.35 : glow ? 0.3 : 0.14).fillCircle(b.x, b.y, b.r);
      this.padG.lineStyle(3, glow ? 0x9fe8ff : 0xffffff, down ? 0.8 : glow ? 0.6 : 0.32).strokeCircle(b.x, b.y, b.r);
      this.padLabels[i].setAlpha(down ? 0.95 : glow ? 0.8 : 0.5);
    });
    this.drawStick();
  }

  // 왼쪽 조이스틱: 엄지를 댄 자리에 받침, 엄지 쪽에 손잡이. 안 댔으면 왼쪽 아래에 흐리게.
  drawStick() {
    const g = this.padG;
    const st = touchPad.stick;
    const r = STICK.radius;
    if (!st) {
      const h = STICK.hint;
      g.fillStyle(0x000000, 0.1).fillCircle(h.x, h.y, r + 12);
      g.lineStyle(3, 0xffffff, 0.22).strokeCircle(h.x, h.y, r + 12);
      g.fillStyle(0xffffff, 0.18).fillCircle(h.x, h.y, 24);
      return;
    }
    g.fillStyle(0x000000, 0.16).fillCircle(st.ax, st.ay, r + 12);
    g.lineStyle(3, 0xffffff, 0.4).strokeCircle(st.ax, st.ay, r + 12);
    let dx = st.x - st.ax;
    let dy = st.y - st.ay;
    const d = Math.hypot(dx, dy);
    if (d > r) {
      dx = (dx / d) * r;
      dy = (dy / d) * r;
    }
    g.fillStyle(0xffffff, 0.45).fillCircle(st.ax + dx, st.ay + dy, 26);
  }

  // 결과 화면과 일시정지 화면에서 손가락으로 누르는 버튼 (태블릿에서만)
  setOverlayButtons(specs) {
    this.overlayButtons.forEach((b) => b.destroy());
    this.overlayButtons = [];
    if (!this.touch) return;
    const w = specs.length > 4 ? 172 : 210; // 버튼이 5개면 조금 좁게 (화면 폭 안에 들어가게)
    const gap = specs.length > 4 ? 12 : 24;
    const x0 = 480 - ((specs.length - 1) * (w + gap)) / 2;
    specs.forEach((sp, i) => {
      const c = this.add.container(x0 + i * (w + gap), 450);
      const bg = this.add.graphics();
      bg.fillStyle(0x1d2a44, 0.95).fillRoundedRect(-w / 2, -30, w, 60, 12).lineStyle(3, 0xffd23f, 1).strokeRoundedRect(-w / 2, -30, w, 60, 12);
      c.add([bg, makeText(this, 0, 0, sp.text, 22, '#ffffff').setOrigin(0.5)]);
      // 누른 버튼을 그 자리에서 지우지 않게 한 박자 뒤에 실행
      c.setSize(w, 60).setInteractive().on('pointerdown', () => this.time.delayedCall(0, sp.fn));
      this.overlay.add(c);
      this.overlayButtons.push(c);
    });
  }

  get game_() {
    return this.scene.get('Game');
  }

  // 첫 시작 때는 HUD 가 아직 만들어지기 전일 수 있다
  onGameStart() {
    this.mode = 'play';
    this.overlay?.setVisible(false);
  }

  togglePause() {
    const gs = this.game_;
    if (this.mode === 'play' && gs.scene.isActive()) {
      this.mode = 'paused';
      gs.scene.pause();
      this.showPauseText();
    } else if (this.mode === 'paused') {
      this.mode = 'play';
      this.overlay.setVisible(false);
      gs.scene.resume();
    }
  }

  showPauseText() {
    const s = saveStore.load().settings;
    this.overlayTitle.setText('일시정지').setColor('#ffffff');
    this.overlayBody.setText(
      (this.touch
        ? ['타이틀로 가면 지금 진행은 체크포인트까지만 남아요']
        : [
            'Esc: 계속하기',
            'T: 타이틀로 (지금 진행은 체크포인트까지만 남아요)',
            `H: 화면 흔들림 ${s.shake ? '켜짐' : '꺼짐'}`,
            `F: 효과 줄이기 ${s.lowFx ? '켜짐' : '꺼짐'}`,
            `M: 소리 ${s.muted ? '꺼짐' : '켜짐'}`,
          ]
      ).join('\n'),
    );
    this.setOverlayButtons([
      { text: '계속하기', fn: () => this.togglePause() },
      { text: '타이틀로', fn: () => this.pauseToTitle() },
      { text: `소리 ${s.muted ? '꺼짐' : '켜짐'}`, fn: () => this.toggleSetting('muted') },
      { text: `흔들림 ${s.shake ? '켜짐' : '꺼짐'}`, fn: () => this.toggleSetting('shake') },
      { text: `효과 ${s.lowFx ? '줄임' : '보통'}`, fn: () => this.toggleSetting('lowFx') },
    ]);
    this.overlay.setVisible(true);
  }

  toggleSetting(name) {
    const save = saveStore.load();
    const settings = { ...save.settings, [name]: !save.settings[name] };
    saveStore.update({ settings });
    if (name === 'muted') sfx.muted = settings.muted;
    if (name === 'lowFx') this.game_?.impact?.setLowFx(settings.lowFx); // 하던 게임에 바로 적용
    if (this.mode === 'paused') this.showPauseText();
  }

  showGameOver(hasCheckpoint) {
    this.mode = 'gameover';
    this.overlayTitle.setText('쓰러졌다!').setColor('#ff5555');
    this.overlayBody.setText(
      (this.touch
        ? ['레벨과 경험치, 보물은 그대로 남아 있어요']
        : [
            hasCheckpoint ? 'R 또는 클릭: 체크포인트에서 다시' : 'R 또는 클릭: 처음부터 다시',
            'T: 타이틀로',
            '레벨과 경험치, 보물은 그대로 남아 있어요',
          ]
      ).join('\n'),
    );
    this.setOverlayButtons([
      { text: hasCheckpoint ? '체크포인트에서 다시' : '처음부터 다시', fn: () => this.restartFromOverlay('retry') },
      { text: '타이틀로', fn: () => this.restartFromOverlay('title') },
    ]);
    this.overlay.setVisible(true);
  }

  showVictory({ stage, last, time, best, isRecord, level, treasures }) {
    this.mode = 'victory';
    this.victoryStage = stage;
    this.victoryLast = last;
    this.overlayTitle.setText(last ? '모든 스테이지 클리어!' : `스테이지 ${stage} 클리어!`).setColor('#ffd23f');
    this.overlayBody.setText(
      [
        `걸린 시간 ${formatTime(time)}${isRecord ? '  (최고 기록!)' : ''}`,
        `최고 기록 ${formatTime(best)}    레벨 ${level}    보물 ${treasures}`,
        '',
        last ? '심해의 왕까지 쓰러뜨리고 도시와 바다를 구했어요! 축하해요!' : this.touch ? '' : `Enter 또는 클릭: 스테이지 ${stage + 1}로!`,
        this.touch ? '' : last ? 'Enter 또는 클릭: 타이틀로    R: 이 스테이지 다시' : 'R: 이 스테이지 다시    T: 타이틀로',
      ].join('\n'),
    );
    this.setOverlayButtons(
      last
        ? [
            { text: '타이틀로', fn: () => this.restartFromOverlay('title') },
            { text: '이 스테이지 다시', fn: () => this.restartFromOverlay('retry') },
          ]
        : [
            { text: `스테이지 ${stage + 1}로!`, fn: () => this.restartFromOverlay('next') },
            { text: '이 스테이지 다시', fn: () => this.restartFromOverlay('retry') },
            { text: '타이틀로', fn: () => this.restartFromOverlay('title') },
          ],
    );
    this.overlay.setVisible(true);
  }

  // retry: 다시 하기, next: 다음으로(게임 오버면 다시 하기), title: 타이틀로
  restartFromOverlay(kind) {
    if (this.mode !== 'gameover' && this.mode !== 'victory') return;
    const gs = this.game_;
    const stage = gs.stageNum;
    let target = { stage, fromCheckpoint: false };
    if (this.mode === 'gameover') {
      if (kind === 'title') target = null;
      else target.fromCheckpoint = true;
    } else if (kind === 'title' || (kind === 'next' && this.victoryLast)) {
      target = null;
    } else if (kind === 'next') {
      target.stage = stage + 1;
    }
    this.mode = 'play';
    this.overlay.setVisible(false);
    if (!target) {
      this.scene.stop('Game');
      this.scene.start('Title');
      return;
    }
    if (!target.fromCheckpoint) this.registry.set('runTime', 0);
    gs.scene.restart(target);
  }

  update(_t, deltaMs) {
    const gs = this.game_;
    const p = gs?.player;
    this.g.clear();
    if (!p || !p.health) return;
    if (this.touch) this.drawTouchPad(gs, p);
    const g = this.g;

    // 체력바 (30% 아래면 빨갛게 깜빡이고 경고음)
    const ratio = p.health.ratio;
    const low = ratio < 0.3 && !p.dead;
    const blink = low && Math.floor(this.time.now / 250) % 2 === 0;
    g.fillStyle(0x000000, 0.6).fillRoundedRect(20, 20, 236, 18, 6);
    g.fillStyle(blink ? 0xff2020 : ratio < 0.3 ? 0xff6a3d : 0x3ff07a, 1).fillRoundedRect(23, 23, 230 * ratio, 12, 4);
    // 강철 몸 방패: 체력바 위에 은빛 줄
    const pw = gs.powers;
    const shield = pw && pw.shield > 0 ? pw.shield : 0;
    if (shield > 0) {
      const sr = Math.min(1, shield / p.health.max);
      g.fillStyle(0xdff0ff, 1).fillRoundedRect(23, 21, 230 * sr, 6, 3);
      g.lineStyle(2, 0x7ab8ff, 1).strokeRoundedRect(20, 18, 236, 22, 7);
    }
    this.hpText.setText(`체력 ${Math.ceil(p.health.current)} / ${p.health.max}${shield > 0 ? `  방패 +${Math.ceil(shield)}` : ''}${low ? '  위험!' : ''}`);
    if (low && this.mode === 'play') {
      this.beepTimer -= deltaMs / 1000;
      if (this.beepTimer <= 0) {
        this.beepTimer = 1.1;
        sfx.play('beep');
      }
    }

    // 레벨과 경험치
    const save = gs.save;
    const need = xpToNext(save.level, cfg.level);
    g.fillStyle(0x000000, 0.6).fillRect(90, 66, 166, 8);
    g.fillStyle(0x9fe8ff, 1).fillRect(91, 67, 164 * Math.min(1, save.xp / need), 6);
    this.lvText.setText(`Lv ${save.level}`);

    // 대시 쿨다운: 원이 차오르면 다시 쓸 수 있음
    const prog = p.dashCd.progress;
    g.fillStyle(0x000000, 0.6).fillCircle(290, 34, 18);
    g.fillStyle(prog >= 1 ? 0x3ff0ff : 0x557a88, 1);
    g.slice(290, 34, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog, false).fillPath();
    this.dashText.setColor(prog >= 1 ? '#000000' : '#ffffff').setStroke(prog >= 1 ? '#3ff0ff' : '#000000', 3);

    const st = gs.stage;
    const found = st.treasures.filter((t) => save.treasures.includes(t.id)).length;
    // 궁극기 게이지 (주인공에 ultGauge 가 있을 때만)
    if (typeof p.ultGauge === 'number') {
      const u = Math.max(0, Math.min(1, p.ultGauge));
      const ready = u >= 1;
      const pulse = ready && Math.floor(this.time.now / 200) % 2 === 0;
      g.fillStyle(0x000000, 0.6).fillRect(20, 84, 236, 10);
      g.fillStyle(ready ? (pulse ? 0xffffff : 0x3fd0ff) : 0x2a7fa8, 1).fillRect(22, 86, 232 * u, 6);
      this.ultText.setText(ready ? gs.keyText('궁극기 준비! {ult} 키') : '궁극기').setVisible(true);
    } else {
      this.ultText.setVisible(false);
    }

    this.treasureText.setText(`보물 ${found}/${st.treasures.length}`);

    // 레벨 업 카드 레벨
    const u = save.upgrades || {};
    const short = { attack: '공격', defense: '방어', speed: '속도', robot: '볼트' };
    this.upgradeText.setText(UPGRADE_TRACKS.map((t) => `${short[t] ?? UPGRADE_INFO[t].name} ${u[t] || 0}`).join('   '));

    // 켜진 특별한 힘: 아이콘 둘레가 줄어들고 아래에 남은 초. 3초 아래면 깜빡
    const list = pw ? pw.list() : [];
    this.powerIcons.forEach((slot, i) => {
      const a = list[i];
      if (!a) {
        slot.img.setVisible(false);
        slot.text.setVisible(false);
        return;
      }
      const x = 42 + i * 46;
      const y = 158;
      const blinkOff = a.left < 3 && Math.floor(this.time.now / 150) % 2 === 0;
      slot.img.setTexture(POWER_INFO[a.id].icon).setPosition(x, y).setVisible(true).setAlpha(blinkOff ? 0.35 : 1);
      slot.text.setText(`${Math.ceil(a.left)}초`).setPosition(x, y + 24).setVisible(true).setColor(a.left < 3 ? '#ff8a8a' : '#ffffff');
      g.lineStyle(4, POWER_INFO[a.id].tint, 1);
      g.beginPath();
      g.arc(x, y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, a.ratio), false);
      g.strokePath();
    });
    this.timeText.setText(formatTime(this.registry.get('runTime') || 0));
    this.stageText.setText(`스테이지 ${gs.stageNum} ${st.name}  (${DIFFICULTY_INFO[gs.difficulty]?.name ?? '보통'})`);
    this.monsterText.setText(gs.gateOpen || gs.bossStarted ? '' : `남은 몬스터 ${gs.monsters.length}`);

    // 보스 체력 (부위별)
    const boss = gs.boss;
    const showBoss = gs.bossStarted && boss && !boss.defeated;
    this.bossTitle.setVisible(showBoss);
    this.bossLabels.forEach((l) => l.setVisible(showBoss));
    if (showBoss) {
      const parts = boss.hudParts().slice(0, 4);
      const w = parts.length > 3 ? 118 : 125;
      const step = w + 8;
      const x0 = 600 - (parts.length * step - 8) / 2;
      this.bossTitle.setText(boss.name);
      this.bossLabels.forEach((l, i) => l.setVisible(i < parts.length));
      parts.forEach((part, i) => {
        const x = x0 + i * step;
        g.fillStyle(0x000000, 0.6).fillRoundedRect(x, 30, w, 12, 4);
        if (part.ratio > 0) g.fillStyle(part.locked ? 0x777777 : part.kind === 'core' ? 0xffb030 : 0xc96cff, 1).fillRoundedRect(x + 2, 32, Math.max(6, (w - 4) * part.ratio), 8, 3);
        this.bossLabels[i].setText(part.label).setPosition(x + w / 2, 54);
      });
    }
  }
}
