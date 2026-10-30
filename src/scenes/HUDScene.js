import Phaser from 'phaser';
import { starText } from '../logic/rewards.js';
import { cfg } from '../config/index.js';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { xpToNext } from '../logic/progression.js';
import { DIFFICULTY_INFO } from '../logic/difficulty.js';
import { POWER_IDS, POWER_INFO, UPGRADE_TRACKS, UPGRADE_INFO } from '../logic/growth.js';
import { makeText, formatTime, FONT, textSize } from '../ui/text.js';
import { isTouchDevice, touchPad, TOUCH_BUTTONS, PAUSE_BUTTON, drawTouchButtons2D, drawPauseButton2D } from '../ui/touch.js';
import { attackButtonLabel } from '../logic/controls.js';
import { normalizeHero, HERO_INFO } from '../logic/heroes.js';
import { RULE_SHORT } from '../logic/daily.js';
import { newMatch, sideName, winPips } from '../logic/versus.js';

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
    this.dailyText = makeText(this, 936, 76, '', 13, '#ffe14a').setOrigin(1, 0.5).setVisible(false); // 오늘의 도전 (혼자 할 때만이라 2P 줄과 안 겹친다)
    this.p2Text = makeText(this, 936, 96, '', 13, '#ffd23f').setOrigin(1, 0.5).setVisible(false); // 함께하기: 2P 체력
    this.monsterText = makeText(this, 600, 30, '', 18, '#ff8a8a').setOrigin(0.5);
    this.bossTitle = makeText(this, 600, 14, '', 16, '#ff9ad5').setOrigin(0.5).setVisible(false);
    this.bossLabels = [0, 1, 2, 3].map(() => makeText(this, 0, 0, '', 12).setOrigin(0.5).setVisible(false));
    this.beepTimer = 0;
    // 레벨 업 카드 레벨 (공격, 방어, 속도, 볼트)
    this.upgradeText = makeText(this, 24, 126, '', 12, '#ffd23f').setOrigin(0, 0.5);
    // 켜진 특별한 힘: 아이콘 + 남은 초
    this.powerIcons = POWER_IDS.map(() => ({
      img: this.add.image(0, 0, 'pw_speed').setVisible(false).setDisplaySize(32, 32),
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
    this.versusHud = null;
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
    if (this.game_?.versus) return this.leaveVersus();
    this.mode = 'play';
    this.overlay.setVisible(false);
    const stage = this.game_?.stageNum;
    const rush = this.game_?.rush;
    const daily = this.game_?.daily;
    this.scene.stop('Game');
    if (rush || daily) this.scene.start('Title'); // 보스 러시와 오늘의 도전은 타이틀에서 시작했으니 타이틀로
    else this.scene.start('Map', { stage });
  }

  // ---------- 태블릿 화면 버튼 ----------
  // 게임 캔버스가 아니라 그 위의 HTML 층(2D canvas)에 그린다. 함께하기는 게임 캔버스를 영상으로 친구에게 보내는데,
  // 캔버스에 그리면 방장 버튼이 친구 화면에도 실려 친구 버튼과 겹쳐 보였다. HTML 층은 영상에 안 담긴다.
  // 손가락 읽기(touchPad)는 그대로 게임 캔버스가 받는다 (이 층은 pointer-events: none). 일시정지 자리만 투명한 요소로 받는다.
  buildTouchPad() {
    const hero = normalizeHero(this.game_?.hero ?? saveStore.load().settings.hero);
    this.padLabels = TOUCH_BUTTONS.map((b) => (b.id === 'attack' ? attackButtonLabel(hero) : b.label)); // 공격 버튼은 주인공의 공격 이름 (펀치, 번개탄, 망치)
    const dpr = Math.min(3, window.devicePixelRatio || 1); // 휴대폰에서 글자가 흐리지 않게
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:960px;height:540px;pointer-events:none;';
    const cv = document.createElement('canvas');
    cv.width = 960 * dpr;
    cv.height = 540 * dpr;
    cv.style.cssText = 'position:absolute;left:0;top:0;width:960px;height:540px;';
    this.padCtx = cv.getContext('2d');
    this.padCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pb = PAUSE_BUTTON;
    const hit = document.createElement('div');
    const hr = pb.r * 1.2;
    hit.style.cssText = `position:absolute;left:${pb.x - hr}px;top:${pb.y - hr}px;width:${hr * 2}px;height:${hr * 2}px;border-radius:50%;pointer-events:auto;touch-action:none;`;
    hit.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.togglePause();
    });
    wrap.append(cv, hit);
    this.pauseHit = hit;
    this.padDom = this.add.dom(480, 270, wrap).setDepth(90);
    // Phaser 가 매 프레임 이 요소의 pointer-events 를 다시 쓰므로 Phaser 속성으로 꺼야 손가락이 게임 캔버스에 닿는다.
    // 일시정지 자리(hit)만 자기 스타일 auto 로 받는다.
    this.padDom.pointerEvents = 'none';
  }

  drawTouchPad(gs, p) {
    const show = this.mode === 'play' && gs.scene.isActive() && !gs.ended && !p.dead;
    const pauseOn = this.mode === 'play' || this.mode === 'paused';
    this.padDom.setVisible(show || pauseOn);
    this.pauseHit.style.display = pauseOn ? '' : 'none';
    const ctx = this.padCtx;
    ctx.clearRect(0, 0, 960, 540);
    if (pauseOn) drawPauseButton2D(ctx);
    if (!show) return;
    const ultReady = typeof p.ultGauge === 'number' && p.ultGauge >= 1;
    drawTouchButtons2D(ctx, this.padLabels, touchPad, { ultReady, font: FONT, textSize });
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

  // 다른 앱으로 넘어갔을 때 (main.js). 하던 중일 때만 멈춘다 (결과 화면이나 이미 멈춘 때는 그대로)
  autoPause() {
    if (this.mode === 'play' && this.game_?.scene.isActive() && !this.game_.ended) this.togglePause();
  }

  showPauseText() {
    const s = saveStore.load().settings;
    const rush = Boolean(this.game_?.rush);
    const versus = Boolean(this.game_?.versus);
    const out = versus ? '나가기' : rush ? '타이틀로' : '지도로';
    const leaveLine = versus ? '겨루기를 그만두고 방으로 돌아가요' : rush ? '타이틀로 가면 이번 보스 러시는 기록되지 않아요' : '지도로 가면 지금 진행은 체크포인트까지만 남아요';
    this.overlayTitle.setText('일시정지').setColor('#ffffff');
    this.overlayBody.setText(
      (this.touch
        ? [leaveLine]
        : [
            'Esc: 계속하기',
            `T: ${out} (${leaveLine})`,
            `H: 화면 흔들림 ${s.shake ? '켜짐' : '꺼짐'}`,
            `F: 효과 줄이기 ${s.lowFx ? '켜짐' : '꺼짐'}`,
            `M: 소리 ${s.muted ? '꺼짐' : '켜짐'}`,
          ]
      ).join('\n'),
    );
    this.setOverlayButtons([
      { text: '계속하기', fn: () => this.togglePause() },
      { text: out, fn: () => this.pauseToTitle() },
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
            'T: 지도로',
            '레벨과 경험치, 보물은 그대로 남아 있어요',
          ]
      ).join('\n'),
    );
    this.setOverlayButtons([
      { text: hasCheckpoint ? '체크포인트에서 다시' : '처음부터 다시', fn: () => this.restartFromOverlay('retry') },
      { text: '지도로', fn: () => this.restartFromOverlay('title') },
    ]);
    this.overlay.setVisible(true);
  }

  // 오늘의 도전 규칙이 깨졌을 때 화면 위쪽에 잠깐
  flashDaily(text) {
    const t = makeText(this, 480, 150, text, 26, '#ffb0a4', { strokeThickness: 6 }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
  }

  // 오늘의 도전 결과 한 줄 (도전 판이 아니면 빈 줄)
  dailyLine(daily) {
    if (!daily) return '';
    if (!daily.ok) return '오늘의 도전은 실패! 다시 도전해 봐요';
    if (daily.already) return '오늘의 도전 성공! (보석은 오늘 이미 받았어요)';
    return `오늘의 도전 성공! 보석 +${daily.gems}`;
  }

  showVictory({ stage, last, time, best, isRecord, level, treasures, stars, newStars = [], gems = 0, totalGems = 0, daily = null }) {
    this.mode = 'victory';
    this.victoryStage = stage;
    this.victoryLast = last;
    this.overlayTitle.setText(last ? '모든 스테이지 클리어!' : `스테이지 ${stage} 클리어!`).setColor('#ffd23f');
    this.overlayBody.setText(
      [
        `걸린 시간 ${formatTime(time)}${isRecord ? '  (최고 기록!)' : ''}`,
        `최고 기록 ${formatTime(best)}    레벨 ${level}    보물 ${treasures}`,
        `별 ${stars ? starText(stars) : ''}    보석 +${gems} (모두 ${totalGems}개)`,
        newStars.length ? `새 별: ${newStars.join(', ')}!` : '',
        ...(daily ? [this.dailyLine(daily)] : []),
        last ? '마지막 보스까지 쓰러뜨리고 모두를 구했어요! 축하해요!' : this.touch ? '' : `Enter 또는 클릭: 스테이지 ${stage + 1}로!`,
        this.touch ? '' : last ? 'Enter 또는 클릭: 지도로    R: 이 스테이지 다시' : 'R: 이 스테이지 다시    T: 지도로',
      ].join('\n'),
    );
    this.setOverlayButtons(
      last
        ? [
            { text: '지도로', fn: () => this.restartFromOverlay('title') },
            { text: '이 스테이지 다시', fn: () => this.restartFromOverlay('retry') },
          ]
        : [
            { text: `스테이지 ${stage + 1}로!`, fn: () => this.restartFromOverlay('next') },
            { text: '이 스테이지 다시', fn: () => this.restartFromOverlay('retry') },
            { text: '지도로', fn: () => this.restartFromOverlay('title') },
          ],
    );
    this.overlay.setVisible(true);
  }

  // 보스 러시에서 쓰러졌을 때
  showRushOver({ reached, total, time }) {
    this.mode = 'rushover';
    this.overlayTitle.setText('보스 러시 끝!').setColor('#ff6a4a');
    this.overlayBody.setText(
      [
        `${total}마리 중 ${reached}번째 보스에서 쓰러졌어요`,
        `여기까지 ${formatTime(time)}`,
        '끝까지 깨야 기록표에 이름이 올라가요',
        this.touch ? '' : 'R 또는 클릭: 처음부터 다시    T: 타이틀로',
      ].join('\n'),
    );
    this.setOverlayButtons([
      { text: '처음부터 다시', fn: () => this.restartFromOverlay('retry') },
      { text: '타이틀로', fn: () => this.restartFromOverlay('title') },
    ]);
    this.overlay.setVisible(true);
  }

  // 보스 러시를 끝까지 깼을 때: 걸린 시간과 가족 기록표 (이번 기록은 노랗게)
  showRushDone({ course, time, rank, gems, list, entry }) {
    this.mode = 'rushdone';
    this.overlayTitle.setText(rank === 1 ? '1등 기록!' : '보스 러시 클리어!').setColor('#ffd23f');
    const lines = [`코스 ${course}   ${entry.name}   ${formatTime(time)}${rank ? `   ${rank}등` : ''}${gems ? `   보석 +${gems}` : ''}`, ''];
    list.slice(0, 5).forEach((r, i) => {
      const me = r.at === entry.at && r.time === entry.time;
      lines.push(`${me ? '▶ ' : ''}${i + 1}등  ${r.name}  ${HERO_INFO[r.hero]?.name ?? ''}${r.duo ? ' (둘이서)' : ''}  ${formatTime(r.time)}`);
    });
    if (!rank) lines.push('', '아깝다! 기록표에 들려면 조금 더 빨라야 해요');
    if (!this.touch) lines.push('', 'R: 한 번 더    Enter 또는 클릭: 타이틀로');
    this.overlayBody.setText(lines.join('\n'));
    this.overlayTitle.setY(120);
    this.overlayBody.setY(170);
    this.setOverlayButtons([
      { text: '한 번 더', fn: () => this.restartFromOverlay('retry') },
      { text: '타이틀로', fn: () => this.restartFromOverlay('title') },
    ]);
    this.overlay.setVisible(true);
  }

  // 겨루기 우승이 정해졌을 때: 같은 친구와 처음부터 또는 방으로
  showVersusOver({ champion, wins }) {
    this.mode = 'versusover';
    this.overlayTitle.setText(`${sideName(champion)} 우승!`).setColor(champion === 0 ? '#7af0ff' : '#ffd23f');
    this.overlayBody.setText([`1P  ${wins[0]} : ${wins[1]}  2P`, this.touch ? '' : 'R 또는 클릭: 한 번 더    T: 방으로'].join('\n'));
    this.setOverlayButtons([
      { text: '한 번 더', fn: () => this.restartFromOverlay('retry') },
      { text: '방으로', fn: () => this.restartFromOverlay('title') },
    ]);
    this.overlay.setVisible(true);
  }

  // 겨루기를 끝내고 타이틀 위에 방을 다시 연다 (나가기를 눌렀거나 친구 연결이 끊겼을 때)
  leaveVersus() {
    this.mode = 'play';
    this.overlay.setVisible(false);
    this.scene.stop('Game');
    this.scene.start('Title', { openRoom: true });
  }

  // 보스 러시 결과 화면에서: retry 는 같은 코스 처음부터, 나머지는 타이틀로
  restartRush(kind) {
    const gs = this.game_;
    const r = gs.rush;
    this.mode = 'play';
    this.overlay.setVisible(false);
    this.overlayTitle.setY(170);
    this.overlayBody.setY(230);
    this.registry.set('runTime', 0);
    if (kind === 'retry') {
      gs.scene.restart({ stage: r.stages[0], rush: { ...r, index: 0, carry: null } });
      return;
    }
    this.scene.stop('Game');
    this.scene.start('Title');
  }

  // retry: 다시 하기, next: 다음으로(게임 오버면 다시 하기), title: 지도로
  restartFromOverlay(kind) {
    if (this.mode === 'versusover') {
      if (kind === 'title') return this.leaveVersus();
      this.mode = 'play';
      this.overlay.setVisible(false);
      this.game_.scene.restart({ versus: newMatch() });
      return;
    }
    if (this.mode === 'rushover' || this.mode === 'rushdone') {
      this.restartRush(kind === 'retry' || (kind === 'next' && this.mode === 'rushover') ? 'retry' : 'title');
      return;
    }
    if (this.mode !== 'gameover' && this.mode !== 'victory') return;
    const gs = this.game_;
    const stage = gs.stageNum;
    const won = this.mode === 'victory' && !this.victoryLast;
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
      this.scene.start('Map', { stage: won ? stage + 1 : stage }); // 깼으면 다음 스테이지를 골라 둔다
      return;
    }
    if (!target.fromCheckpoint) this.registry.set('runTime', 0);
    // 오늘의 도전: 다시 해도 도전 판으로. 쓰러져서 다시 하면 실패 표시는 그대로, 깬 뒤 다시 하면 새 도전
    if (gs.daily && target.stage === stage) target.daily = { ...gs.daily, broken: target.fromCheckpoint ? gs.daily.broken : false }; // 쓰러졌을 때는 fromCheckpoint 가 true
    gs.scene.restart(target);
  }

  // 함께하기: 오른쪽 위에 2P 체력 (쓰러졌으면 부활까지 남은 초)
  drawPartner(gs) {
    const q = gs.partner;
    this.p2Text.setVisible(Boolean(q));
    if (!q) return;
    const g = this.g;
    const ratio = q.dead ? 0 : q.health.ratio;
    g.fillStyle(0x000000, 0.6).fillRoundedRect(756, 70, 180, 14, 5);
    if (ratio > 0) g.fillStyle(ratio < 0.3 ? 0xff6a3d : 0xffd23f, 1).fillRoundedRect(759, 73, 174 * ratio, 8, 3);
    const left = q.dead && q.reviveAt ? Math.max(0, Math.ceil((q.reviveAt - gs.time.now) / 1000)) : null;
    this.p2Text.setText(q.dead ? `2P 쓰러짐${left != null ? `  ${left}초 뒤 부활` : ''}` : `2P 체력 ${Math.ceil(q.health.current)} / ${q.health.max}`);
  }

  // 겨루기 화면: 양쪽 위에 체력과 궁극기, 가운데에 남은 시간과 승수. 모험 정보판은 숨긴다
  makeVersusHud() {
    for (const t of [this.hpText, this.lvText, this.dashText, this.treasureText, this.timeText, this.ultText, this.stageText, this.dailyText, this.p2Text, this.monsterText, this.bossTitle, this.upgradeText]) t.setVisible(false);
    this.versusHud = {
      names: [makeText(this, 24, 50, '', 14, '#7af0ff').setOrigin(0, 0.5), makeText(this, 936, 50, '', 14, '#ffd23f').setOrigin(1, 0.5)],
      clock: makeText(this, 480, 28, '', 32).setOrigin(0.5),
      score: makeText(this, 480, 62, '', 20, '#ffffff').setOrigin(0.5),
    };
  }

  drawVersus(gs) {
    if (!this.versusHud) this.makeVersusHud();
    const g = this.g;
    const h = this.versusHud;
    const v = gs.versus;
    gs.players.forEach((p, side) => {
      const right = side === 1;
      const ratio = p.dead ? 0 : p.health.ratio;
      const x = right ? 704 : 20;
      g.fillStyle(0x000000, 0.6).fillRoundedRect(x, 20, 236, 18, 6);
      const w = 230 * ratio;
      if (w > 0) g.fillStyle(ratio < 0.3 ? 0xff6a3d : right ? 0xffd23f : 0x7af0ff, 1).fillRoundedRect(right ? x + 233 - w : x + 3, 23, w, 12, 4);
      const ult = Math.max(0, Math.min(1, p.ultGauge));
      const ready = ult >= 1 && Math.floor(this.time.now / 200) % 2 === 0;
      g.fillStyle(0x000000, 0.6).fillRect(x, 62, 236, 8);
      if (ult > 0) g.fillStyle(ready ? 0xffffff : 0x3fd0ff, 1).fillRect(right ? x + 234 - 232 * ult : x + 2, 64, 232 * ult, 4);
      h.names[side].setText(`${sideName(side)} ${HERO_INFO[p.hero]?.name ?? ''}  ${Math.ceil(p.health.current)} / ${p.health.max}${ult >= 1 ? '  궁극기!' : ''}`);
    });
    h.clock.setText(String(Math.ceil(v.left))).setColor(v.left <= 10 ? '#ff8a8a' : '#ffffff');
    const need = cfg.versus.winsNeeded;
    h.score.setText(`${winPips(v.match.wins[0], need)}   ${winPips(v.match.wins[1], need)}`);
  }

  update(_t, deltaMs) {
    const gs = this.game_;
    const p = gs?.player;
    this.g.clear();
    if (!p || !p.health) return;
    if (this.touch) this.drawTouchPad(gs, p);
    if (gs.versus) return this.drawVersus(gs);
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
    this.hpText.setText(`${gs.coop ? '1P ' : ''}체력 ${Math.ceil(p.health.current)} / ${p.health.max}${shield > 0 ? `  방패 +${Math.ceil(shield)}` : ''}${low ? '  위험!' : ''}`);
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

    // 보스 러시에는 보물 상자가 없으니 그 자리에 몇 번째 보스인지
    this.treasureText.setText(gs.rush ? `보스 러시 ${gs.rush.index + 1}/${gs.rush.stages.length}` : `보물 ${found}/${st.treasures.length}`);

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
    this.drawPartner(gs);
    // 보스 러시는 스테이지 이름 줄을 비운다 (몇 번째 보스인지는 보물 자리에 쓴다)
    const r = gs.rush;
    this.timeText.setText(formatTime(this.registry.get('runTime') || 0));
    const dl = gs.daily;
    this.dailyText.setVisible(Boolean(dl));
    if (dl) {
      const left = dl.rule === 'time' ? Math.max(0, dl.limit - (this.registry.get('runTime') || 0)) : 0;
      this.dailyText
        .setText(dl.broken ? '오늘의 도전: 실패 (끝까지 가 봐요)' : `오늘의 도전: ${RULE_SHORT[dl.rule]}${dl.rule === 'time' ? `  남은 시간 ${formatTime(left)}` : ''}`)
        .setColor(dl.broken ? '#aaaaaa' : '#ffe14a');
    }
    this.stageText.setText(r ? '' : `스테이지 ${gs.stageNum} ${st.name}  (${DIFFICULTY_INFO[gs.difficulty]?.name ?? '보통'})`);
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
