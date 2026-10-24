import Phaser from 'phaser';
import { cfg } from '../config/index.js';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { xpToNext } from '../logic/progression.js';
import { makeText, formatTime } from '../ui/text.js';

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
    this.bossTitle = makeText(this, 600, 18, '다중 팔 돌연변이', 16, '#ff9ad5').setOrigin(0.5).setVisible(false);
    this.bossLabels = ['왼팔', '오른팔', '코어'].map((l, i) => makeText(this, 0, 0, l, 12).setOrigin(0.5).setVisible(false));
    this.beepTimer = 0;

    this.overlay = this.add.container(0, 0).setVisible(false).setDepth(100);
    this.overlayBg = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.6);
    this.overlayTitle = makeText(this, 480, 170, '', 48, '#ffffff', { strokeThickness: 8 }).setOrigin(0.5);
    this.overlayBody = makeText(this, 480, 230, '', 20, '#ffffff', { lineSpacing: 10 }).setOrigin(0.5, 0);
    this.overlay.add([this.overlayBg, this.overlayTitle, this.overlayBody]);
    this.mode = 'play';

    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-M', () => this.toggleSetting('muted'));
    this.input.keyboard.on('keydown-H', () => {
      if (this.mode === 'paused') this.toggleSetting('shake');
    });
    this.input.keyboard.on('keydown-R', () => this.restartFromOverlay());
    this.input.on('pointerdown', () => this.restartFromOverlay());
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
      [
        'Esc: 계속하기',
        `H: 화면 흔들림 ${s.shake ? '켜짐' : '꺼짐'}`,
        `M: 소리 ${s.muted ? '꺼짐' : '켜짐'}`,
      ].join('\n'),
    );
    this.overlay.setVisible(true);
  }

  toggleSetting(name) {
    const save = saveStore.load();
    const settings = { ...save.settings, [name]: !save.settings[name] };
    saveStore.update({ settings });
    if (name === 'muted') sfx.muted = settings.muted;
    if (this.mode === 'paused') this.showPauseText();
  }

  showGameOver(hasCheckpoint) {
    this.mode = 'gameover';
    this.overlayTitle.setText('쓰러졌다!').setColor('#ff5555');
    this.overlayBody.setText(
      [
        hasCheckpoint ? 'R 또는 클릭: 체크포인트에서 다시' : 'R 또는 클릭: 처음부터 다시',
        '레벨과 경험치, 보물은 그대로 남아 있어요',
      ].join('\n'),
    );
    this.overlay.setVisible(true);
  }

  showVictory({ time, best, isRecord, level }) {
    this.mode = 'victory';
    this.overlayTitle.setText('보스 처치!').setColor('#ffd23f');
    this.overlayBody.setText(
      [
        `걸린 시간 ${formatTime(time)}${isRecord ? '  (최고 기록!)' : ''}`,
        `최고 기록 ${formatTime(best)}    레벨 ${level}`,
        '',
        '다음 지역은 아직 공사 중이에요. 다음 단계를 기대해 주세요!',
        'R 또는 클릭: 처음부터 다시',
      ].join('\n'),
    );
    this.overlay.setVisible(true);
  }

  restartFromOverlay() {
    if (this.mode !== 'gameover' && this.mode !== 'victory') return;
    const fromCheckpoint = this.mode === 'gameover';
    if (!fromCheckpoint) this.registry.set('runTime', 0);
    this.mode = 'play';
    this.overlay.setVisible(false);
    this.game_.scene.restart({ fromCheckpoint });
  }

  update(_t, deltaMs) {
    const gs = this.game_;
    const p = gs?.player;
    this.g.clear();
    if (!p || !p.health) return;
    const g = this.g;

    // 체력바 (30% 아래면 빨갛게 깜빡이고 경고음)
    const ratio = p.health.ratio;
    const low = ratio < 0.3 && !p.dead;
    const blink = low && Math.floor(this.time.now / 250) % 2 === 0;
    g.fillStyle(0x000000, 0.6).fillRoundedRect(20, 20, 236, 18, 6);
    g.fillStyle(blink ? 0xff2020 : ratio < 0.3 ? 0xff6a3d : 0x3ff07a, 1).fillRoundedRect(23, 23, 230 * ratio, 12, 4);
    this.hpText.setText(`체력 ${Math.ceil(p.health.current)} / ${p.health.max}${low ? '  위험!' : ''}`);
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

    this.treasureText.setText(save.treasures.length ? `보물 ${save.treasures.length}` : '');
    this.timeText.setText(formatTime(this.registry.get('runTime') || 0));

    // 보스 체력 (부위별)
    const boss = gs.boss;
    const showBoss = gs.bossStarted && boss && !boss.defeated;
    this.bossTitle.setVisible(showBoss);
    this.bossLabels.forEach((l) => l.setVisible(showBoss));
    if (showBoss) {
      const parts = [
        { ratio: boss.arms[0].alive ? boss.arms[0].health.ratio : 0, label: boss.arms[0].alive ? '왼팔' : '왼팔 파괴', locked: false },
        { ratio: boss.arms[1].alive ? boss.arms[1].health.ratio : 0, label: boss.arms[1].alive ? '오른팔' : '오른팔 파괴', locked: false },
        { ratio: boss.coreHealth.ratio, label: boss.coreExposed ? '코어 (약점!)' : '코어 (잠김)', locked: !boss.coreExposed },
      ];
      parts.forEach((part, i) => {
        const x = 400 + i * 135;
        g.fillStyle(0x000000, 0.6).fillRoundedRect(x, 32, 125, 12, 4);
        g.fillStyle(part.locked ? 0x777777 : i === 2 ? 0xffb030 : 0xc96cff, 1).fillRoundedRect(x + 2, 34, 121 * part.ratio, 8, 3);
        this.bossLabels[i].setText(part.label).setPosition(x + 62, 56);
      });
    }
  }
}
