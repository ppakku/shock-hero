import Phaser from 'phaser';
import { HERO_INFO } from '../logic/heroes.js';
import { auraFlame, auraPulse, ultAuraOn } from './fxLogic.js';

// 궁극기가 꽉 차면 주인공 몸에 생기는 아우라. 주인공 색의 빛이 숨쉬고, 몸 둘레로 불꽃이 피어오른다.
// 태블릿에서 느려지지 않게 미리 구운 그림 몇 장을 돌려 쓴다 (매 프레임 그리거나 새로 만들지 않음).
// 물리가 주인공을 옮긴 뒤인 postupdate 에서 움직여야 대시 중에도 몸에서 뒤처지지 않는다.
const ADD = Phaser.BlendModes.ADD;
const FLAMES = 10;
const FLAMES_LOW = 4; // 효과 줄이기
const FADE_IN = 0.2; // 초
const FADE_OUT = 0.1;
const BEHIND = 9; // 주인공(10) 바로 뒤

// 캔버스 모드에서는 tint 가 안 되니까 주인공 색을 미리 칠해 굽는다
function auraTexture(scene, hero, css) {
  const key = `ult_aura_${hero}`;
  if (scene.textures.exists(key)) return key;
  const size = 64;
  const tex = scene.textures.createCanvas(key, size, size);
  const ctx = tex.getContext();
  const c = Phaser.Display.Color.HexStringToColor(css);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${c.red},${c.green},${c.blue},1)`);
  grad.addColorStop(0.4, `rgba(${c.red},${c.green},${c.blue},0.5)`);
  grad.addColorStop(0.75, `rgba(${c.red},${c.green},${c.blue},0.1)`);
  grad.addColorStop(1, `rgba(${c.red},${c.green},${c.blue},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}

export class UltAura {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.t = 0;
    this.level = 0; // 0 꺼짐 ~ 1 켜짐
    const key = auraTexture(scene, player.hero, (HERO_INFO[player.hero] || HERO_INFO.shock).color);
    const image = () => scene.add.image(0, 0, key).setBlendMode(ADD).setDepth(BEHIND).setVisible(false);
    this.glow = image();
    this.flames = Array.from({ length: FLAMES }, image);
    const update = (time, delta) => this.update(Math.min(delta, 50) / 1000);
    scene.events.on('postupdate', update);
    scene.events.once('shutdown', () => scene.events.off('postupdate', update));
  }

  update(dt) {
    const p = this.player;
    const on = ultAuraOn(p);
    this.level = on ? Math.min(1, this.level + dt / FADE_IN) : Math.max(0, this.level - dt / FADE_OUT);
    const shown = this.level > 0;
    this.glow.setVisible(shown);
    if (!shown) {
      for (const f of this.flames) f.setVisible(false);
      return;
    }
    this.t += dt;
    const k = p.stats.scale; // 강철 거인은 몸이 커서 아우라도 크다
    const midY = p.y;
    const pulse = auraPulse(this.t);
    this.glow.setPosition(p.x, midY).setDisplaySize(112 * k * pulse, 124 * k * pulse).setAlpha(0.8 * pulse * this.level);
    const count = this.scene.impact?.lowFx ? FLAMES_LOW : FLAMES;
    this.flames.forEach((img, i) => {
      if (i >= count) return img.setVisible(false);
      const f = auraFlame(i, count, this.t);
      img.setVisible(true)
        .setPosition(p.x + f.x * 30 * k, midY + f.y * 32 * k)
        .setDisplaySize(20 * k * f.size, 42 * k * f.size)
        .setAlpha(f.alpha * this.level);
    });
  }
}
