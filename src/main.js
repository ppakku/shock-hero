import Phaser from 'phaser';
import { cfg, DEBUG } from './config/index.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { DexScene } from './scenes/DexScene.js';
import { RushScene } from './scenes/RushScene.js';
import { MapScene } from './scenes/MapScene.js';
import { RoomScene } from './scenes/RoomScene.js';
import { GuestScene } from './scenes/GuestScene.js';
import { isPhone, usePhoneLayout } from './ui/touch.js';
import { setPhoneText } from './ui/text.js';
import { coop } from './net/coop.js';

// ?timer 를 붙이면 화면 새로고침 신호 대신 타이머로 돈다 (화면 없는 브라우저에서 자동 확인할 때)
const useTimer = new URLSearchParams(window.location.search).has('timer');

// 휴대폰이면 화면 버튼과 작은 글자를 키운다 (장면을 만들기 전에 정해야 한다)
const phone = isPhone();
if (phone) {
  usePhoneLayout();
  setPhoneText(true);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#140b1f',
  fps: { target: 60, forceSetTimeOut: useTimer },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true }, // 함께하기 방 코드 입력 상자
  input: { activePointers: 4 }, // 태블릿: 손가락 여러 개 (이동하면서 펀치)
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: cfg.world.gravity }, debug: DEBUG },
  },
  scene: [BootScene, TitleScene, GameScene, HUDScene, LevelUpScene, ShopScene, DexScene, RushScene, MapScene, RoomScene, GuestScene], // LevelUp 은 HUD 위에 그려진다
});

// 다른 앱으로 넘어가거나(전화, 알림) 휴대폰을 세로로 돌리면 하던 스테이지를 일시정지한다.
// 돌아왔을 때 보스 공격 한가운데서 바로 이어지지 않고, 계속하기를 눌러야 다시 움직인다.
function away() {
  if (game.scene.isActive('HUD')) game.scene.getScene('HUD').autoPause?.();
  coop.away(true);
}
game.events.on(Phaser.Core.Events.HIDDEN, away);
game.events.on(Phaser.Core.Events.VISIBLE, () => coop.away(false));
const portrait = window.matchMedia?.('(orientation: portrait)');
if (phone && portrait) {
  portrait.addEventListener?.('change', (e) => (e.matches ? away() : coop.away(false)));
}

// 자동 확인용 (브라우저 콘솔에서 window.__shockGame 으로 접근)
window.__shockGame = game;
