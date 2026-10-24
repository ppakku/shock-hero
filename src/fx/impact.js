import Phaser from 'phaser';
import { saveStore } from '../save.js';
import { hitStopMs } from './fxLogic.js';

// 때리는 맛 (주인공과 모든 보스가 같이 쓴다):
//   멈칫(히트 스톱), 화면 확대 펀치, 한쪽으로 흔들기, 하얀 번쩍임, 궁극기 색 번쩍임.
// GameScene 이 만들고(scene.impact) update 맨 앞에서 tick 을 부른다.
// 효과 줄이기(save.settings.lowFx)가 켜져 있으면 멈칫, 확대, 번쩍임, 빛 번짐을 모두 끈다.
// 화면 흔들림은 원래 있던 흔들림 설정(H)을 그대로 따른다.
export class ImpactFx {
  constructor(scene) {
    this.scene = scene;
    this.lowFx = !!saveStore.load().settings.lowFx;
    this.stopLeft = 0; // 멈칫이 남은 시간 (실제 밀리초)
    this.log = []; // 자동 확인용: 최근 멈칫 기록
    this.glows = []; // 빛 번짐(preFX glow) 목록: 효과 줄이기를 켜면 끈다
    this.webgl = scene.game.renderer.type === Phaser.WEBGL;
    this.zoomBack = false;

    // 화면 전체를 덮는 번쩍임 판 (카메라를 따라다님)
    const plate = (color, blend) =>
      scene.add.rectangle(480, 270, 1200, 760, color, 1).setScrollFactor(0).setDepth(56).setAlpha(0).setVisible(false).setBlendMode(blend);
    this.white = plate(0xffffff, Phaser.BlendModes.NORMAL);
    this.red = plate(0xff2a5a, Phaser.BlendModes.ADD);
    this.cyan = plate(0x2ad8ff, Phaser.BlendModes.ADD);
    this.flashes = []; // { obj, a, ms, left, wobble }

    const cam = scene.cameras.main;
    cam.setZoom(1);
    // 확대 펀치가 끝나면 원래 크기로 돌아간다
    cam.on(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
      if (!this.zoomBack) return;
      this.zoomBack = false;
      cam.zoomTo(1, this.zoomOutMs || 200, 'Quad.easeInOut', true);
    });
  }

  setLowFx(on) {
    this.lowFx = !!on;
    for (const g of this.glows) if (g.fx) g.fx.active = !this.lowFx;
    if (this.lowFx) {
      this.stopLeft = 0;
      this.scene.physics.world.resume();
      for (const f of this.flashes) f.obj.setVisible(false);
      this.flashes = [];
      this.scene.cameras.main.setZoom(1);
    }
    this.scene.events.emit('lowfx', this.lowFx);
  }

  // 매 프레임 맨 앞에서 부른다 (실제 밀리초). 멈칫 중이면 true: 이번 프레임은 게임을 진행하지 않는다.
  tick(deltaMs) {
    const ms = Math.min(deltaMs, 100);
    for (const f of this.flashes) {
      f.left -= ms;
      const q = Math.max(0, f.left / f.ms);
      f.obj.setAlpha(f.a * q * q);
      if (f.wobble) f.obj.x = 480 + f.wobble * q;
      if (f.left <= 0) f.obj.setVisible(false);
    }
    this.flashes = this.flashes.filter((f) => f.left > 0);
    if (this.stopLeft <= 0) return false;
    this.stopLeft -= ms;
    if (this.stopLeft <= 0) {
      this.stopLeft = 0;
      this.scene.physics.world.resume();
    }
    return true;
  }

  get frozen() {
    return this.stopLeft > 0;
  }

  // ---------- 낱개 효과 ----------

  // 멈칫: 게임 전체가 아주 잠깐(50~90ms) 멈춰서 세게 맞은 느낌을 준다
  hitStop(kind) {
    const ms = hitStopMs(kind, this.lowFx);
    if (ms <= 0) return 0;
    this.stopLeft = Math.max(this.stopLeft, ms);
    this.scene.physics.world.pause();
    this.log.push({ kind, ms, sceneTime: Math.round(this.scene.time.now), real: Math.round(performance.now()) });
    if (this.log.length > 20) this.log.shift();
    return ms;
  }

  // 화면이 살짝 다가왔다가 돌아온다
  zoomPunch(amount = 0.03, inMs = 60, outMs = 200) {
    if (this.lowFx) return;
    const cam = this.scene.cameras.main;
    this.zoomBack = true;
    this.zoomOutMs = outMs;
    cam.zoomTo(1 + amount, inMs, 'Quad.easeOut', true);
  }

  // 한쪽으로 흔들기 (x, y 세기 따로). 흔들림 설정(H)을 따른다.
  dirShake(ix, iy, duration) {
    this.scene.shake(new Phaser.Math.Vector2(ix, iy), duration);
  }

  flashPlate(obj, alpha, ms, wobble = 0) {
    if (this.lowFx) return;
    obj.setVisible(true).setAlpha(alpha);
    obj.x = 480 + wobble;
    this.flashes = this.flashes.filter((f) => f.obj !== obj);
    this.flashes.push({ obj, a: alpha, ms, left: ms, wobble });
  }

  // 하얀 번쩍임
  whiteFlash(alpha = 0.35, ms = 120) {
    this.flashPlate(this.white, alpha, ms);
  }

  // 궁극기: 빨강과 하늘색이 양쪽으로 어긋나며 번쩍 (색이 갈라지는 느낌을 싸게 흉내)
  chroma(ms = 320) {
    this.flashPlate(this.red, 0.28, ms, -14);
    this.flashPlate(this.cyan, 0.28, ms * 0.8, 14);
  }

  // 빛 번짐 (WebGL 에서만, 효과 줄이기면 꺼 둠). 캔버스 모드에서는 아무 일도 안 한다.
  addGlow(obj, color = 0xff8a2a, outer = 6, inner = 0) {
    if (!this.webgl || !obj?.preFX) return null;
    obj.preFX.padding = Math.max(obj.preFX.padding || 0, outer * 2);
    const fx = obj.preFX.addGlow(color, outer, inner, false, 0.1, 10);
    fx.active = !this.lowFx;
    this.glows.push({ obj, fx });
    return fx;
  }

  // ---------- 상황별 묶음 ----------

  // 최대 충전 펀치가 맞았을 때 (dir = 때린 방향)
  chargedHit(dir = 1) {
    this.hitStop('charged');
    this.zoomPunch(0.03, 50, 180);
    this.dirShake(0.012, 0.003, 140);
    this.whiteFlash(0.16, 90);
    return dir;
  }

  // 보스가 크게 내려찍거나 부딪혔을 때. shake=true 면 위아래 흔들기도 같이.
  bossSlam(power = 1, shake = false) {
    this.hitStop('bossSlam');
    this.zoomPunch(0.022 * power, 60, 240);
    if (shake) this.dirShake(0.004 * power, 0.018 * power, 280);
  }

  // 보스 부위를 부쉈을 때
  partBreak() {
    this.hitStop('partBreak');
    this.zoomPunch(0.04, 70, 260);
    this.whiteFlash(0.3, 140);
  }

  // 궁극기 쿵!
  ultimate() {
    this.hitStop('ultimate');
    this.zoomPunch(0.06, 70, 380);
    this.whiteFlash(0.5, 170);
    this.chroma(340);
  }

  // 보스를 쓰러뜨린 마지막 한 방
  bossDefeated() {
    this.hitStop('ultimate');
    this.zoomPunch(0.07, 90, 600);
    this.chroma(260);
  }
}
