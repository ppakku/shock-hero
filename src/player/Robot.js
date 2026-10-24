import Phaser from 'phaser';
import { FONT } from '../ui/text.js';
import { floatText, ring } from '../fx/effects.js';

// 로봇 조수 볼트: 주인공 옆을 둥둥 떠다니며 말풍선으로 힌트와 농담을 한다.
// 레벨 업 카드로 '로봇 볼트'를 고르면 가까운 적에게 레이저를 쏘고, 높은 레벨에서는 체력도 채워 주고 방패도 쳐 준다.
export class Robot {
  constructor(scene, target) {
    this.scene = scene;
    this.target = target;
    this.sprite = scene.add.image(target.x - 45, target.y - 55, 'robot').setDepth(15).setDisplaySize(30, 34);
    this.bubble = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#111111',
        backgroundColor: '#ffffffee',
        padding: { x: 10, y: 6 },
        wordWrap: { width: 280, useAdvancedWrap: true },
        align: 'left',
      })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);
    this.queue = [];
    this.timer = 0;
    this.t = 0;

    this.stats = null; // robotStats() 결과. null 이면 아직 공격 못 함
    this.zapTimer = 1.5;
    this.healTimer = 0;
    this.guardTimer = 0;
    this.guardReady = false;
    this.zapG = scene.add.graphics().setDepth(16);
    this.guardG = scene.add.graphics().setDepth(14);
    this.rankLabel = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: '#3ff0ff', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(15)
      .setVisible(false);
  }

  // 레벨 업 카드로 볼트 레벨이 바뀌었을 때
  setStats(stats) {
    const was = this.stats?.rank ?? 0;
    this.stats = stats;
    this.rankLabel.setText(stats ? `Lv${stats.rank}` : '').setVisible(Boolean(stats));
    if (!stats) return;
    if (was === 0) this.zapTimer = Math.min(this.zapTimer, 1);
    if (stats.heal && this.healTimer <= 0) this.healTimer = stats.heal.every;
    if (stats.guard && !this.guardReady && this.guardTimer <= 0) this.guardReady = true;
  }

  // 볼트 방패가 있으면 공격 한 번을 막고 true
  tryGuard(player) {
    if (!this.stats?.guard || !this.guardReady) return false;
    this.guardReady = false;
    this.guardTimer = this.stats.guard.every;
    const s = this.scene;
    ring(s, player.x, player.y, 0x3ff0ff, 60, 260, 5);
    floatText(s, player.x, player.y - 56, '볼트 방패!', '#3ff0ff', 20);
    s.sfxPlay?.('tink');
    return true;
  }

  // 레이저, 회복, 방패 시간 흐르기 (싸울 수 있을 때만)
  updateAbilities(dt) {
    const st = this.stats;
    const s = this.scene;
    const p = this.target;
    this.guardG.clear();
    this.rankLabel.setPosition(this.sprite.x, this.sprite.y + 22);
    if (!st || s.ended || p.dead) return;

    if (st.guard) {
      if (!this.guardReady) {
        this.guardTimer -= dt;
        if (this.guardTimer <= 0) this.guardReady = true;
      }
      if (this.guardReady) {
        const a = 0.35 + 0.15 * Math.sin(this.t * 5);
        this.guardG.lineStyle(2, 0x3ff0ff, a).strokeCircle(p.x, p.y, 36);
      }
    }

    if (st.heal) {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer = st.heal.every;
        const healed = p.health.heal(st.heal.amount);
        if (healed > 0) {
          floatText(s, p.x, p.y - 56, `볼트 수리 +${Math.round(healed)}`, '#3ff07a', 18);
          ring(s, p.x, p.y, 0x3ff07a, 50, 300, 3);
        }
      }
    }

    this.zapTimer -= dt;
    if (this.zapTimer > 0) return;
    const targets = s.findRobotTargets ? s.findRobotTargets(this.sprite.x, this.sprite.y, st.range, st.targets) : [];
    if (!targets.length) {
      this.zapTimer = 0.3; // 적이 없으면 잠깐 뒤에 다시 찾는다
      return;
    }
    this.zapTimer = st.interval;
    for (const t of targets) this.zap(t);
  }

  // 레이저 한 방: 지그재그 번개 줄을 그리고 hitArea 로 피해를 준다
  zap(t) {
    const s = this.scene;
    const x0 = this.sprite.x;
    const y0 = this.sprite.y;
    const g = this.zapG;
    const draw = (alpha) => {
      g.clear();
      const steps = 6;
      const pts = [[x0, y0]];
      for (let i = 1; i < steps; i++) {
        const k = i / steps;
        pts.push([x0 + (t.x - x0) * k + Phaser.Math.Between(-8, 8), y0 + (t.y - y0) * k + Phaser.Math.Between(-8, 8)]);
      }
      pts.push([t.x, t.y]);
      for (const [w, c, a] of [[7, 0x3f8cff, 0.35], [3, 0x9ff6ff, 0.9], [1.5, 0xffffff, 1]]) {
        g.lineStyle(w, c, a * alpha);
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
        g.strokePath();
      }
    };
    draw(1);
    s.time.delayedCall(60, () => draw(0.6));
    s.time.delayedCall(130, () => g.clear());
    ring(s, t.x, t.y, 0x9ff6ff, 26, 180, 3);
    s.sparks?.explode(6, t.x, t.y);
    s.sfxPlay?.('zap');
    const st = this.stats;
    const attack = { kind: 'robot', damage: st.damage, knockback: st.knockback, range: 0, ratio: 0, full: false };
    const rect = new Phaser.Geom.Rectangle(t.x - 6, t.y - 6, 12, 12);
    s.hitArea(rect, attack, t.x >= x0 ? 1 : -1);
  }

  update(dt) {
    this.t += dt;
    const tx = this.target.x - this.target.facing * 45;
    const ty = this.target.y - 55 + Math.sin(this.t * 3) * 5;
    const k = 1 - Math.exp(-6 * dt);
    this.sprite.x += (tx - this.sprite.x) * k;
    this.sprite.y += (ty - this.sprite.y) * k;
    this.sprite.setFlipX(this.target.facing < 0);
    this.updateAbilities(dt);

    if (this.bubble.visible) {
      const cam = this.scene.cameras.main;
      const half = this.bubble.width / 2 + 8;
      const x = Phaser.Math.Clamp(this.sprite.x, cam.scrollX + half, cam.scrollX + cam.width - half);
      this.bubble.setPosition(x, Math.max(this.sprite.y - 22, this.bubble.height + 8));
      this.timer -= dt;
      if (this.timer <= 0) this.next();
    }
  }

  // urgent 면 지금 하던 말을 끊고 바로 말한다
  say(lines, urgent = false) {
    const list = Array.isArray(lines) ? lines : [lines];
    if (urgent) {
      this.queue = [...list];
      this.next();
      return;
    }
    this.queue.push(...list);
    if (!this.bubble.visible) this.next();
  }

  next() {
    const raw = this.queue.shift();
    const line = raw && this.scene.keyText ? this.scene.keyText(raw) : raw;
    if (!line) {
      this.bubble.setVisible(false);
      return;
    }
    this.bubble.setText(`볼트: ${line}`).setVisible(true);
    this.timer = Phaser.Math.Clamp(1.4 + line.length * 0.07, 2.2, 5);
  }
}
