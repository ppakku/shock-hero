import { surfaceBelow, shadowShape } from './fxLogic.js';

// 발밑 그림자: 주인공, 몬스터, 볼트, 보스 아래에 까만 타원.
// 높이 뛰어오를수록 작고 흐려진다. 발판 위에 있으면 발판 위에 생긴다.
// 땅과 발판(깊이 0)보다 위, 캐릭터(깊이 4 이상)보다 아래에 그린다.
// 보스는 shadowSpots() 를 만들면 그걸 쓰고({ x, feetY, w } 목록), 없으면 보스 그림 아래에 그린다.
export class Shadows {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(0.9);
    this.platforms = scene.stage.platforms || [];
    this.groundY = scene.stage.groundY;
  }

  drop(x, feetY, w, view) {
    if (x < view.x - w || x > view.right + w) return;
    const s = surfaceBelow(x, feetY, this.platforms, this.groundY);
    const h = s - feetY;
    if (h < -8) return; // 땅속(물속 동굴 바닥 아래 등)에 있으면 안 그린다
    const { scale, alpha } = shadowShape(Math.max(0, h));
    const ww = w * scale;
    this.g.fillStyle(0x000000, alpha).fillEllipse(x, s + 1, ww, Math.max(4, ww * 0.2));
    this.g.fillStyle(0x000000, alpha * 0.8).fillEllipse(x, s + 1, ww * 0.55, Math.max(3, ww * 0.12));
  }

  update() {
    const sc = this.scene;
    const g = this.g.clear();
    const view = sc.cameras.main.worldView;
    for (const p of sc.players || [sc.player]) if (p?.active && p.body) this.drop(p.x, p.body.bottom, 46, view); // 함께하기면 두 사람
    for (const m of sc.monsters) {
      if (m.dead || !m.active || !m.visible) continue;
      const feet = m.body ? m.body.bottom : m.y;
      const w = (m.body ? m.body.width : m.displayWidth * 0.6) * 1.15;
      this.drop(m.x, feet, Math.max(20, w), view);
    }
    const r = sc.robot?.sprite;
    if (r?.visible) this.drop(r.x, r.y + 17, 22, view);
    const b = sc.boss;
    if (!b || b.state === 'dead') return g;
    if (typeof b.shadowSpots === 'function') {
      for (const s of b.shadowSpots()) this.drop(s.x, s.feetY, s.w, view);
    } else if (b.sprite?.visible && b.sprite.alpha > 0.2 && b.sprite.getBounds) {
      const bb = b.sprite.getBounds();
      if (bb.bottom <= this.groundY + 12) this.drop(bb.centerX, Math.min(bb.bottom, this.groundY), bb.width * 0.7, view);
    }
    return g;
  }
}
