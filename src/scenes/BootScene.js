import Phaser from 'phaser';
import { customArt } from '../config/art.js';
import { makeTextures } from '../fx/textures.js';
import { stages } from '../stage/index.js';
import { makeHeroTextures } from '../fx/heroTextures.js';
import { makeMonsterTextures } from '../enemies/index.js';
import { makeBossTextures } from '../boss/index.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.on('loaderror', (file) => console.warn(`[그림] ${file.src} 을(를) 못 불러와서 임시 도형을 써요`));
    for (const [key, file] of Object.entries(customArt)) this.load.image(key, `art/${file}`);
    // 수중 던전(스테이지 6) 배경: 아들이 그린 물속 동굴 그림 (못 불러오면 코드 배경만 그림)
    this.load.image('underwater_bg', 'art/underwater_bg.jpg');
  }

  create() {
    makeTextures(this);
    makeHeroTextures(this);
    makeMonsterTextures(this);
    makeBossTextures(this, stages);
    this.scene.start('Title');
  }
}
