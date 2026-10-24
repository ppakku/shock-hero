import Phaser from 'phaser';
import { customArt } from '../config/art.js';
import { makeTextures } from '../fx/textures.js';
import { stages } from '../stage/index.js';
import { makeHeroTextures } from '../fx/heroTextures.js';
import { makeMonsterTextures } from '../enemies/index.js';
import { makeBossTextures } from '../boss/index.js';
import { artFile, registerSheets } from '../fx/spriteSheets.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.on('loaderror', (file) => console.warn(`[그림] ${file.src} 을(를) 못 불러와서 임시 도형을 써요`));
    for (const [key, entry] of Object.entries(customArt)) this.load.image(key, `art/${artFile(entry)}`);
    // 수중 던전(스테이지 6) 배경: 아들이 그린 물속 동굴 그림 (못 불러오면 코드 배경만 그림)
    this.load.image('underwater_bg', 'art/underwater_bg.jpg');
    // 스테이지 파일 theme 의 bgImage(걸어가는 동안 배경), arenaImage(보스전 배경) 그림
    for (const st of stages) {
      for (const pic of [st.theme.bgImage, st.theme.arenaImage, st.theme.groundImage, st.theme.platformImage]) if (pic) this.load.image(pic.key, `art/${pic.file}`);
    }
  }

  create() {
    registerSheets(this, customArt); // 스프라이트 시트는 칸으로 자르고 애니메이션을 만든다
    makeTextures(this);
    makeHeroTextures(this);
    makeMonsterTextures(this);
    makeBossTextures(this, stages);
    this.scene.start('Title');
  }
}
