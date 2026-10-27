import Phaser from 'phaser';
import { customArt } from '../config/art.js';
import { makeHeroTextures } from '../fx/heroTextures.js';
import { bootArt } from '../logic/stageArt.js';
import { queueArt, finishArt } from '../fx/artLoader.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.on('loaderror', (file) => console.warn(`[그림] ${file.src} 을(를) 못 불러와서 임시 도형을 써요`));
    // 처음에는 어디서나 쓰는 작은 그림만 받는다. 스테이지 배경, 몬스터, 보스 그림은 그 스테이지에 들어갈 때 받는다 (src/logic/stageArt.js)
    queueArt(this, bootArt(customArt));
  }

  create() {
    finishArt(this); // 받은 그림 정리 + 아직 없는 그림은 임시 도형으로
    makeHeroTextures(this);
    this.scene.start('Title');
  }
}
