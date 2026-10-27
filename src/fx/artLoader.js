// 필요한 그림을 그때그때 받는다 (목록은 src/logic/stageArt.js). 장면의 preload() 에서 부른다.
// 받기 전에는 코드로 그린 임시 도형이 같은 이름으로 들어 있어서, 그걸 치우고 진짜 그림을 받는다.
// 못 받은 그림은 finishArt 가 임시 도형을 다시 그린다.
import { customArt } from '../config/art.js';
import { stages } from '../stage/index.js';
import { registerSheets } from './spriteSheets.js';
import { makeTextures } from './textures.js';
import { makeMonsterTextures } from '../enemies/index.js';
import { makeBossTextures } from '../boss/index.js';
import { makeText } from '../ui/text.js';

const loaded = new Set(); // 이미 받은 그림 (게임을 켜 둔 동안 다시 받지 않는다)

// entries: [{ key, file }]. 받을 게 있으면 화면 가운데에 "그림 받는 중" 을 띄운다
export function queueArt(scene, entries) {
  const todo = entries.filter((a) => !loaded.has(a.key));
  if (!todo.length) return;
  for (const a of todo) {
    if (scene.textures.exists(a.key)) scene.textures.remove(a.key);
    scene.load.image(a.key, `art/${a.file}`);
    scene.load.once(`filecomplete-image-${a.key}`, () => loaded.add(a.key));
  }
  const label = makeText(scene, 480, 270, '그림 받는 중...', 22, '#ffffff').setOrigin(0.5).setDepth(1000).setScrollFactor(0);
  const progress = (v) => label.active && label.setText(`그림 받는 중... ${Math.round(v * 100)}%`);
  scene.load.on('progress', progress);
  scene.load.once('complete', () => {
    scene.load.off('progress', progress);
    label.destroy();
  });
}

// 받은 뒤 (create 맨 앞에서): 스프라이트 시트를 칸으로 자르고, 못 받은 그림은 임시 도형으로
// (임시 도형은 자르지 않는다: 잘라서 애니메이션을 만들면 나중에 진짜 그림이 와도 옛 칸을 가리킨다)
export function finishArt(scene) {
  registerSheets(scene, Object.fromEntries(Object.entries(customArt).filter(([k]) => loaded.has(k))));
  makeTextures(scene);
  makeMonsterTextures(scene);
  makeBossTextures(scene, stages);
}
