import Phaser from 'phaser';
import { cfg, DEBUG } from './config/index.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { MapScene } from './scenes/MapScene.js';

// ?timer 를 붙이면 화면 새로고침 신호 대신 타이머로 돈다 (화면 없는 브라우저에서 자동 확인할 때)
const useTimer = new URLSearchParams(window.location.search).has('timer');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#140b1f',
  fps: { target: 60, forceSetTimeOut: useTimer },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4 }, // 태블릿: 손가락 여러 개 (이동하면서 펀치)
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: cfg.world.gravity }, debug: DEBUG },
  },
  scene: [BootScene, TitleScene, GameScene, HUDScene, LevelUpScene, ShopScene, MapScene], // LevelUp 은 HUD 위에 그려진다
});

// 자동 확인용 (브라우저 콘솔에서 window.__shockGame 으로 접근)
window.__shockGame = game;
