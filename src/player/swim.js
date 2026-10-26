import Phaser from 'phaser';
import { makeSeaMonsterTextures } from '../enemies/seaTextures.js';
import { swimConfig, swimGravityOffset, swimVertical, swimHorizontal, clampToCeiling } from '../logic/swim.js';

// 헤엄치기: 수중 스테이지(stage.swim = true)에서 GameScene 이 player.swim 에 붙인다.
// - 중력이 약해서 천천히 가라앉는다 (부력)
// - 점프를 누르면 위로 한 번 차고 오르고, 꾹 누르고 있으면 계속 헤엄쳐 올라간다
// - 옆으로는 조금 느리고, 물의 저항 때문에 부드럽게 출발하고 멈춘다
// - 대시는 짧은 헤엄 돌진 (점프를 누르고 있으면 비스듬히 위로)
// - 공격은 그대로. 주인공 뒤로 거품이 올라온다
export class SwimController {
  constructor(player, swimCfg, worldGravity) {
    this.player = player;
    this.scene = player.scene;
    this.c = swimConfig(swimCfg);
    this.strokeTimer = 0;
    this.bubbleTimer = 0;
    this.t = 0;
    makeSeaMonsterTextures(this.scene); // 거품 그림 (swim_bubble)
    player.body.setGravityY(swimGravityOffset(worldGravity, this.c.gravityScale));
    player.setDragX(0); // 땅의 마찰 대신 물의 저항(waterDrag)으로 멈춘다
    // 헤엄 거품 (작은 동그라미가 위로 올라가며 사라짐)
    this.bubbles = this.scene.add
      .particles(0, 0, 'swim_bubble', {
        lifespan: 900,
        speedY: { min: -90, max: -40 },
        speedX: { min: -20, max: 20 },
        scale: { start: 0.6, end: 1.1 },
        alpha: { start: 0.9, end: 0 },
        emitting: false,
      })
      .setDepth(11);
  }

  get dashScale() {
    return this.c.dashMultiplier;
  }

  // Player.step 의 걷기와 점프 대신 부른다
  move(dt, input) {
    const p = this.player;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let speed = p.cfg.player.moveSpeed * this.c.moveMultiplier;
    if (p.isCharging) speed *= p.cfg.charge.moveSpeedMultiplier;
    p.setVelocityX(swimHorizontal(p.body.velocity.x, dir, speed, dt, this.c.waterDrag));
    if (dir !== 0) p.facing = dir;
    p.setFlipX(p.facing < 0);

    const r = swimVertical(p.body.velocity.y, input, this.strokeTimer, dt, this.c);
    this.strokeTimer = r.strokeTimer;
    p.setVelocityY(r.vy);
    if (r.stroked) {
      this.scene.onPlayerJump?.();
      this.bubbles.explode(4, p.x - p.facing * 6, p.y + 10);
    }
  }

  // 헤엄 대시: 점프를 누르고 있으면 비스듬히 위로
  onDash(dir, input) {
    const p = this.player;
    const speed = p.cfg.dash.speed * this.c.dashMultiplier;
    const up = input.jumpDown ? -0.45 : 0;
    p.setVelocity(dir * speed * (1 - Math.abs(up) * 0.3), up * speed);
    this.bubbles.explode(8, p.x, p.y);
  }

  // 번개 사수의 물속 백스텝: 앞을 본 채로 뒤로 쑥 빠진다 (점프를 누르고 있으면 조금 위로)
  onBackstep(facing, speed, input = {}) {
    const p = this.player;
    const up = input.jumpDown ? -0.35 : 0;
    p.setVelocity(-facing * speed, up * speed);
    this.bubbles.explode(8, p.x, p.y);
  }

  // 매 프레임 (GameScene.update 에서 player.update 다음에): 천장 막기, 거품, 헤엄 자세
  update(dt) {
    const p = this.player;
    this.t += dt;
    if (!p.body) return;
    const cl = clampToCeiling(p.y, p.body.velocity.y, this.c.ceilingY);
    if (cl.y !== p.y) {
      p.y = cl.y; // 몸통 판정은 다음 물리 단계에서 그림 위치를 따라온다
      p.setVelocityY(cl.vy);
    }
    const onGround = p.body.blocked.down || p.body.touching.down;
    // 거품 꼬리
    this.bubbleTimer -= dt;
    const moving = Math.abs(p.body.velocity.x) > 40 || Math.abs(p.body.velocity.y) > 60;
    if (!p.dead && this.bubbleTimer <= 0 && (moving || Math.random() < 0.15)) {
      this.bubbleTimer = onGround ? 0.35 : 0.12;
      this.bubbles.emitParticleAt(p.x - p.facing * 10 + Phaser.Math.Between(-4, 4), p.y - 18, 1);
    }
    // 물속에서 둥둥: 살짝 기울고 흔들림 (궁극기, 대시, 맞을 때는 그대로)
    if (p.dead || p.ultActive || p.dashing || p.hurtLock > 0 || p.customArt) return;
    if (!onGround) {
      const tilt = Phaser.Math.Clamp(p.body.velocity.x / 30, -8, 8) + Math.sin(this.t * 4) * 3;
      p.setAngle(tilt);
    } else if (p.angle !== 0) {
      p.setAngle(0);
    }
  }

  destroy() {
    this.bubbles.destroy();
  }
}
