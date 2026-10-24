import Phaser from 'phaser';
import { cfg, DEBUG } from './config/index.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';

// ?timer 를 붙이면 화면 새로고침 신호 대신 타이머로 돈다 (화면 없는 브라우저에서 자동 확인할 때)
const useTimer = new URLSearchParams(window.location.search).has('timer');

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#140b1f',
  fps: { target: 60, forceSetTimeOut: useTimer },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: cfg.world.gravity }, debug: DEBUG },
  },
  scene: [BootScene, TitleScene, GameScene, HUDScene],
});
