import Phaser from 'phaser';
import { customArt } from '../config/art.js';
import { makeTextures } from '../fx/textures.js';
import { stages } from '../stage/index.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.on('loaderror', (file) => console.warn(`[그림] ${file.src} 을(를) 못 불러와서 임시 도형을 써요`));
    for (const [key, file] of Object.entries(customArt)) this.load.image(key, `art/${file}`);
  }

  create() {
    makeTextures(this, stages);
    this.scene.start('Title');
  }
}
