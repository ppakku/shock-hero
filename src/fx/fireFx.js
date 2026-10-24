import Phaser from 'phaser';
import { emitCount, particleBudget } from './fxLogic.js';

// 불 효과 묶음 (용 보스 아스트라노바X 가 쓰고, 다른 보스도 가져다 쓸 수 있다).
// 겹겹이 쌓은 알갱이: 하얀 노랑 심지 > 주황 불꽃 > 빨강 > 연기, 그리고 날아오르는 불씨.
// 알갱이 뿌리개(emitter)는 처음에 한 번만 만들고 계속 다시 쓴다. 수는 maxParticles 로 막아 둔다.
// 빛 번짐은 더하기 섞기(ADD)로 그린 부드러운 동그라미(fx_soft)를 모아 쓴다 (캔버스 모드에서도 됨).

const ADD = Phaser.BlendModes.ADD;

// 부드러운 동그라미 그림들 (가운데가 밝고 가장자리로 갈수록 투명)
export function makeFxTextures(scene) {
  const soft = (key, size, stops) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const r = size / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  };
  soft('fx_soft', 64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
  // 캔버스 모드는 알갱이 색칠(tint)이 안 되니까 색을 미리 칠한 그림도 만든다
  soft('fx_core', 48, [[0, 'rgba(255,255,240,1)'], [0.4, 'rgba(255,236,150,0.7)'], [1, 'rgba(255,200,80,0)']]);
  soft('fx_flame', 48, [[0, 'rgba(255,190,80,1)'], [0.45, 'rgba(255,110,30,0.6)'], [1, 'rgba(200,30,10,0)']]);
  soft('fx_ember', 16, [[0, 'rgba(255,250,210,1)'], [0.5, 'rgba(255,170,60,0.8)'], [1, 'rgba(255,90,20,0)']]);
  soft('fx_smoke', 48, [[0, 'rgba(40,26,22,0.9)'], [0.6, 'rgba(40,26,22,0.4)'], [1, 'rgba(40,26,22,0)']]);
  soft('fx_dust', 32, [[0, 'rgba(255,240,220,0.9)'], [1, 'rgba(255,240,220,0)']]);
}

export class FireFx {
  constructor(scene, depth = 8.6) {
    this.scene = scene;
    makeFxTextures(scene);
    const webgl = scene.game.renderer.type === Phaser.WEBGL;
    const P = (tex, cfg, d) => scene.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(d);

    // 연기 (불 뒤에, 보통 섞기)
    this.smoke = P('fx_smoke', {
      lifespan: { min: 900, max: 1500 }, speed: { min: 10, max: 50 }, gravityY: -70,
      scale: { start: 0.5, end: 1.6 }, alpha: { start: 0.55, end: 0 }, rotate: { min: 0, max: 360 },
      maxParticles: 60, maxAliveParticles: 60,
    }, depth - 0.4);
    // 불꽃 (주황에서 빨강으로 식어 감)
    this.flame = P(webgl ? 'fx_soft' : 'fx_flame', {
      lifespan: { min: 260, max: 560 }, speed: { min: 20, max: 110 }, gravityY: -340,
      scale: { start: 0.75, end: 0.15 }, alpha: { start: 0.9, end: 0 }, // 보통 섞기: 밝은 용암 배경에서도 주황 빨강 색이 살아 있게
      ...(webgl ? { color: [0xffd060, 0xff7a18, 0xd8280c, 0x4a0c06], colorEase: 'Quad.easeOut' } : {}),
      maxParticles: 260, maxAliveParticles: 260,
    }, depth);
    // 하얀 노랑 심지
    this.core = P(webgl ? 'fx_soft' : 'fx_core', {
      lifespan: { min: 140, max: 300 }, speed: { min: 10, max: 60 }, gravityY: -200,
      scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.75, end: 0 }, blendMode: ADD,
      ...(webgl ? { tint: [0xffffff, 0xfff6c8] } : {}),
      maxParticles: 140, maxAliveParticles: 140,
    }, depth + 0.2);
    // 날아오르는 불씨
    this.ember = P('fx_ember', {
      lifespan: { min: 600, max: 1300 }, speed: { min: 60, max: 240 }, gravityY: -160,
      scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: ADD,
      maxParticles: 140, maxAliveParticles: 140,
    }, depth + 0.3);
    // 바람에 날리는 먼지 (날개 바람). 방향마다 하나씩
    const gust = (angle) =>
      P('fx_dust', {
        lifespan: { min: 380, max: 650 }, speed: { min: 520, max: 900 }, angle: { min: angle - 6, max: angle + 6 },
        scale: { start: 0.55, end: 0.15 }, alpha: { start: 0.55, end: 0 },
        maxParticles: 80, maxAliveParticles: 80,
      }, depth + 0.5);
    this.gustL = gust(180);
    this.gustR = gust(0);

    // 빛 번짐 동그라미 묶음 (매 프레임 다시 놓는다)
    this.glowPool = [];
    this.glowUsed = 0;
    this.glowDepth = depth + 0.1;
    // 아지랑이 (불 위에서 흔들리는 희미한 물결 줄)
    this.haze = scene.add.graphics().setDepth(depth + 0.15).setBlendMode(ADD);
    this.acc = {};
    this.sheetSprites = new Set(); // 폭발, 불기둥 그림 (끝나면 사라짐)
    this.allEmitters = [this.smoke, this.flame, this.core, this.ember, this.gustL, this.gustR];
  }

  get lowFx() {
    return !!this.scene.impact?.lowFx;
  }

  // 초당 rate 개 (효과 줄이기면 3분의 1)
  n(key, rate, dt, max = 8) {
    const s = this.acc[key] || (this.acc[key] = { acc: 0 });
    return emitCount(s, this.lowFx ? rate / 3 : rate, dt, max);
  }

  // 프레임 시작: 빛 번짐과 아지랑이를 지운다
  begin() {
    this.glowUsed = 0;
    this.haze.clear();
  }

  // 프레임 끝: 이번에 안 쓴 빛 번짐 숨기기
  end() {
    for (let i = this.glowUsed; i < this.glowPool.length; i++) this.glowPool[i].setVisible(false);
  }

  // 부드러운 빛 하나 (반지름 r). 효과 줄이기면 조금 작고 흐리게만.
  glow(x, y, r, color = 0xff8a2a, alpha = 0.6) {
    let img = this.glowPool[this.glowUsed];
    if (!img) {
      if (this.glowPool.length >= 48) return; // 너무 많이 만들지 않는다
      img = this.scene.add.image(0, 0, 'fx_soft').setBlendMode(ADD).setDepth(this.glowDepth);
      this.glowPool.push(img);
    }
    this.glowUsed += 1;
    const k = this.lowFx ? 0.7 : 1;
    img.setVisible(true).setPosition(x, y).setDisplaySize(r * 2 * k, r * 2 * k).setTint(color).setAlpha(alpha * k);
  }

  // 깜빡이는 경고 빛 (q: 0~1 경고가 무르익은 정도)
  warnGlow(x, y, r, t, q = 1, color = 0xff5020) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 16);
    this.glow(x, y, r * (0.8 + 0.35 * q + 0.12 * pulse), color, 0.25 + 0.35 * q + 0.2 * pulse);
  }

  // 아지랑이: x 가운데, yTop~yBot 사이, 폭 w
  shimmer(x, yTop, yBot, w, t) {
    if (this.lowFx) return;
    const g = this.haze;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.6 + i / 3) % 1;
      const y = yBot - (yBot - yTop) * ph;
      const a = 0.16 * Math.sin(ph * Math.PI);
      g.lineStyle(2, 0xffd8a0, a);
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const px = x - w / 2 + (w * k) / 8;
        const py = y + Math.sin(t * 9 + k * 1.3 + i) * 4;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
  }

  // ---------- 모양별 불 ----------

  // 입에서 땅으로 뿜는 불줄기
  jet(x0, y0, x1, y1, dt, t) {
    const along = (n, em, spread) => {
      for (let i = 0; i < n; i++) {
        const q = Math.random();
        em.emitParticleAt(x0 + (x1 - x0) * q + Phaser.Math.Between(-spread, spread) * q, y0 + (y1 - y0) * q + Phaser.Math.Between(-spread, spread) * q, 1);
      }
    };
    along(this.n('jetF', 320, dt, 10), this.flame, 26);
    along(this.n('jetC', 160, dt, 6), this.core, 10);
    this.ember.emitParticleAt(x1 + Phaser.Math.Between(-30, 30), y1 - 6, this.n('jetE', 50, dt, 3));
    this.smoke.emitParticleAt(x1, y1 - 30, this.n('jetS', 8, dt, 1));
    this.glow(x0, y0, 46 + Math.sin(t * 30) * 6, 0xffa040, 0.6);
    this.glow((x0 + x1) / 2, (y0 + y1) / 2, 70, 0xff6020, 0.45);
    this.glow(x1, y1 - 10, 90, 0xff5a1f, 0.65);
  }

  // 땅을 달리는 불길 (높이 h)
  wall(x, groundY, h, dt, t, key = 'wall') {
    const n = this.n(`${key}F`, 150, dt, 6);
    for (let i = 0; i < n; i++) this.flame.emitParticleAt(x + Phaser.Math.Between(-20, 20), groundY - Math.random() * h * 0.8, 1);
    this.core.emitParticleAt(x, groundY - h * 0.3, this.n(`${key}C`, 60, dt, 3));
    this.ember.emitParticleAt(x, groundY - h * 0.6, this.n(`${key}E`, 24, dt, 2));
    this.smoke.emitParticleAt(x, groundY - h, this.n(`${key}S`, 5, dt, 1));
    this.glow(x, groundY - h * 0.4, h * 1.4, 0xff6a1f, 0.55);
    this.shimmer(x, groundY - h * 2.2, groundY - h, 60, t + x * 0.01);
  }

  // 솟아오르는 불기둥 (폭 w, 높이 h)
  // light = true 면 불기둥 그림(fx_pillar)이 몸통을 그리니 알갱이는 불씨와 빛만 조금
  column(x, groundY, h, w, dt, t, key = 'col', light = false) {
    if (!light) {
      const n = this.n(`${key}F`, 260, dt, 9);
      for (let i = 0; i < n; i++) this.flame.emitParticleAt(x + Phaser.Math.Between(-w / 2, w / 2), groundY - Math.random() * h, 1);
      const c = this.n(`${key}C`, 120, dt, 5);
      for (let i = 0; i < c; i++) this.core.emitParticleAt(x + Phaser.Math.Between(-w / 5, w / 5), groundY - Math.random() * h * 0.9, 1);
    }
    this.ember.emitParticleAt(x, groundY - h, this.n(`${key}E`, 36, dt, 3));
    this.smoke.emitParticleAt(x, groundY - h, this.n(`${key}S`, 8, dt, 1));
    this.glow(x, groundY - 10, w * 1.6, 0xff8a30, 0.55);
    this.glow(x, groundY - h * 0.5, w * 2.2, 0xff5020, 0.4);
    this.shimmer(x, groundY - h - 90, groundY - h + 10, w * 1.3, t + x * 0.01);
  }

  // 날아가는 불덩이 꼬리
  trail(x, y, dt, key = 'trail') {
    this.flame.emitParticleAt(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(-6, 6), this.n(`${key}F`, 140, dt, 5));
    this.ember.emitParticleAt(x, y, this.n(`${key}E`, 30, dt, 2));
    this.smoke.emitParticleAt(x, y, this.n(`${key}S`, 10, dt, 1));
    this.glow(x, y, 46, 0xff7a1f, 0.7);
  }

  // 뜨거운 바닥 위 작은 불꽃
  lick(x, groundY, w, dt, key) {
    const n = this.n(`${key}F`, 28, dt, 2);
    for (let i = 0; i < n; i++) this.flame.emitParticleAt(x + Phaser.Math.Between(-w / 2, w / 2), groundY - 4, 1);
    if (!this.lowFx) this.ember.emitParticleAt(x + Phaser.Math.Between(-w / 2, w / 2), groundY - 6, this.n(`${key}E`, 4, dt, 1));
    this.glow(x, groundY - 4, w * 0.75, 0xff5a1f, 0.35);
  }

  // 펑! 터지는 불 (power 1 = 불덩이, 2 = 큰 착지)
  burst(x, y, power = 1) {
    const lf = this.lowFx;
    this.core.explode(particleBudget(10 * power, lf, 30), x, y);
    this.flame.explode(particleBudget(26 * power, lf, 60), x, y);
    this.ember.explode(particleBudget(18 * power, lf, 40), x, y);
    this.smoke.explode(particleBudget(5 * power, lf, 12), x, y - 10);
    this.flashGlow(x, y, 70 + 50 * power, 0xffa040, 0.7);
  }

  // 잠깐 번쩍이는 큰 빛 (트윈으로 사라짐)
  flashGlow(x, y, r, color = 0xffc060, alpha = 0.9, ms = 260) {
    const k = this.lowFx ? 0.6 : 1;
    const img = this.scene.add.image(x, y, 'fx_soft').setBlendMode(ADD).setDepth(this.glowDepth + 0.3).setTint(color).setAlpha(alpha * k);
    img.setDisplaySize(r * 2 * k, r * 2 * k);
    this.scene.tweens.add({ targets: img, alpha: 0, scaleX: img.scaleX * 1.5, scaleY: img.scaleY * 1.5, duration: ms, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  // 날개 바람 먼지 (dir: 밀리는 방향)
  gust(x, yTop, yBot, dir, dt) {
    const em = dir > 0 ? this.gustR : this.gustL;
    const n = this.n('gust', 90, dt, 5);
    for (let i = 0; i < n; i++) em.emitParticleAt(x, yTop + Math.random() * (yBot - yTop), 1);
  }

  // 화난 몸에서 피어오르는 불씨
  aura(x, y, w, h, dt) {
    if (this.lowFx) return;
    const n = this.n('aura', 16, dt, 2);
    for (let i = 0; i < n; i++) this.ember.emitParticleAt(x + Phaser.Math.Between(-w / 2, w / 2), y - Math.random() * h, 1);
  }

  // ---------- 아이들이 그린 애니메이션 (있을 때만) ----------

  get hasExplosion() {
    return this.scene.anims.exists('fx_explosion_anim');
  }

  get hasPillar() {
    return this.scene.anims.exists('fx_pillar_anim');
  }

  // 한 번 재생하고 사라지는 그림. 끝나면 destroy.
  playOnce(key, x, y, scale, originY, timeScale = 1) {
    const spr = this.scene.add.sprite(x, y, key).setOrigin(0.5, originY).setScale(scale).setDepth(this.glowDepth + 0.05);
    this.sheetSprites.add(spr);
    spr.on('animationcomplete', () => {
      this.sheetSprites.delete(spr);
      spr.destroy();
    });
    spr.play(`${key}_anim`);
    spr.anims.timeScale = timeScale;
    return spr;
  }

  // 펑! 폭발 그림 (땅에 닿은 지점 x, y). 동시에 6개까지, 효과 줄이기면 3개와 작은 크기.
  // 그림이 없으면 false (알갱이 폭발만).
  explosion(x, y, scale = 0.6) {
    if (!this.hasExplosion) return false;
    const live = [...this.sheetSprites].filter((s) => s.texture.key === 'fx_explosion').length;
    if (live >= (this.lowFx ? 3 : 6)) return false;
    this.playOnce('fx_explosion', x, y, scale * (this.lowFx ? 0.7 : 1), 0.95);
    return true;
  }

  // 솟는 불기둥 그림: 표시 높이 h (판정 높이와 같게). 칸 맨 아래 가운데가 땅.
  // timeScale 로 솟구치는 장면(3~5장)이 피해 나는 시간에 맞게 늘인다.
  pillarSprite(x, groundY, h, timeScale = 1) {
    if (!this.hasPillar) return null;
    const frameH = this.scene.textures.getFrame('fx_pillar', 0)?.height || 538;
    const spr = this.playOnce('fx_pillar', x, groundY + 4, h / frameH, 1, timeScale);
    // 더하기 합성: 그림 칸의 어두운 바탕이 네모로 비치지 않게.
    // 6장부터(사그라듦, 연기)는 칸 위쪽이 반듯하게 잘린 그림이라 빨리 흐리게 지운다.
    spr.setBlendMode(ADD);
    spr.on('animationupdate', (_anim, frame) => {
      if (frame.index >= 6 && !spr.fading) {
        spr.fading = true;
        this.scene.tweens.add({ targets: spr, alpha: 0, duration: 110 });
      }
    });
    return spr;
  }

  // 모두 멈추고 지우기
  clear() {
    for (const e of this.allEmitters) e.killAll();
    for (const s of this.sheetSprites) s.destroy();
    this.sheetSprites.clear();
    this.begin();
    this.end();
  }
}
