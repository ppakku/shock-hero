import Phaser from 'phaser';
import { BossBase } from './BossBase.js';
import { Health } from '../logic/health.js';
import {
  coreDamage, rockTargets, pickPattern, shouldRage, restAfterAttack, landingX, difficultyOf, breathCone, avalancheWaves, FROST,
} from '../logic/boss.js';
import { nextTiredAfter, varyCount } from '../logic/bossVariety.js';
import { ComboHazards } from './comboHazards.js';
import { drawIceShard, drawFrostCone } from './bossFx.js';
import { flash, floatText } from '../fx/effects.js';
import { make } from '../fx/textures.js';
import { sheetFacesRight } from '../fx/spriteSheets.js';
import { stamp } from '../fx/bossArt.js';

const Rect = Phaser.Geom.Rectangle;
const intersects = Phaser.Geom.Intersects.RectangleToRectangle;
const lerp = Phaser.Math.Linear;

const HIGH_Y = FROST.highY; // 높이 날 때 몸 가운데 높이 (맞는 곳 아래쪽 y 195: 위쪽 공격(y 약 201까지)도 안 닿음)
const LOW_Y = FROST.lowY; // 급강하 뒤 낮게 떠 있을 때 몸 가운데 높이 (맞는 곳 아래쪽 y 305: 점프 펀치, 위쪽 공격이 닿음)
const SKY_Y = 120; // 빙천지락 때 높이 솟아오른 높이
const BREATH_Y = 200; // 냉기 브레스를 뿜을 때 떠 있는 높이
const GROUND_OFF = 78; // 땅에 서 있을 때 몸 가운데가 바닥에서 떨어진 높이
const BREATH_H = FROST.breathH; // 바닥을 달리는 서리 높이 (점프로 넘기)
const BREATH_LEN = 130; // 바닥을 달리는 서리 길이
const SPIKE_W = FROST.spikeW; // 얼음 가시 하나가 아픈 폭
const SPIKE_H = FROST.spikeH; // 얼음 가시 높이

// 그림 속 위치 (몸통 그림 220x170, 왼쪽을 보는 모습, 가운데 기준)
const EYE = { x: 78, y: -37 };
const MOUTH = { x: 104, y: -23 };
const CHEST = { x: 12, y: 20 };

// 아들이 그린 디자인 시트의 색 (밝은 파랑, 중간 파랑, 짙은 남색, 연한 회청색, 밝은 하늘색)
const PALETTE = { bright: 0x3d9be0, main: 0x2a5fa8, dark: 0x1a2552, pale: 0xc4cee0, light: 0xd8f6ff };
const RAGE_TINT = 0xff9ab4;
const GROUND_TINT = 0x9fb4d4; // 날개가 다 부서져 땅에 떨어졌을 때 (시트 그림) 어둡고 얼어붙은 빛

// 스프라이트 시트(아들 그림, 칸 344x384, 오른쪽을 보는 모습)를 쓸 때
// 모든 칸은 발이 칸 속 (198, 359) 에 오게 맞춰 두었다 (docs/frost_astra_frames.png 를 칸마다 잘라 발을 맞춤).
const SHEET_H = 340; // 화면 높이
const SHEET_W = Math.round((SHEET_H * 344) / 384); // 한 칸 비율 그대로
const SHEET_K = SHEET_H / 384; // 칸 1픽셀이 화면 몇 픽셀인지
const SHEET_ORIGIN_Y = 359 / 384; // 기준점을 발에 둔다 (웅크려도 발이 땅에 붙어 있게)
const SHEET_DX = (198 - 172) * SHEET_K; // 발이 칸 가운데보다 앞(머리 쪽)으로 나와 있는 거리
// 칸마다 눈 위치 (칸 속 좌표). 날갯짓하면 고개가 오르내려서 칸마다 다르다
const SHEET_EYES = [[296, 195], [296, 212], [319, 217], [309, 210], [284, 155], [289, 157], [279, 155], [281, 150]];
const SHEET_MOUTHS = [[301, 217], [314, 235], [334, 235], [321, 230], [291, 180], [301, 182], [286, 180], [289, 175]]; // 칸마다 입 위치
const SHEET_CHEST = [262, 245]; // 가슴 (얼음 심장 자리)
const SHEET_CHEST_LOW = [245, 245]; // 날개를 늘어뜨린 2번 칸의 가슴 (땅에 떨어졌을 때)

const TIPS = {
  icicles: '고드름이 떨어져! 바닥 그림자 밖으로 피해!',
  dive: '급강하다! 빨간 길을 따라 날아와. 대시로 뚫고 지나가!',
  freezeBreath: ['냉기 브레스! 입이 빛나면 파란 부채꼴 밖으로 나가!', '아스트라 밑이나 뒤는 안전해. 바닥을 달리는 서리는 점프로 넘거나 대시로 뚫어!'],
  avalanche: ['빙천지락! 바닥이 빛나는 곳에서 얼음 가시가 솟아!', '빛나지 않는 틈에 서 있다가, 다음 빛이 오면 옆 틈으로 옮겨!'],
  hop: '뛰어올랐다! 그림자 밖으로 도망쳐!',
  land: '지쳐서 내려왔어! 지금이야, 날개를 마구 때려!',
  hover: '낮게 떠 있어! 밑에서 점프 {atk}(이)나 {upAtk}!',
};

// 혹한의 아스트라 (아들 디자인): 수정처럼 빛나는 파란 비늘의 얼음 용.
// 거의 하늘을 날며 싸우고, 날개 2개를 부수면 떨어져서 얼음 심장(약점)이 열린다.
// 대표 기술: 냉기 브레스(부채꼴 + 바닥을 달리는 서리), 빙천지락(번갈아 솟는 얼음 가시)
export class FrostAstraBoss extends BossBase {
  constructor(scene, cfg, stage, skin = 4) {
    super(scene, cfg, stage, skin);
    this.ic = cfg.iceBoss;
    // 난이도: 체력 배수, 공격 시간 배수, 겹쳐 쓰기 확률
    this.diff = difficultyOf(cfg);
    this.hpScale *= this.diff.bossHealth;
    this.x = this.maxX - 120;
    this.y = HIGH_Y + 20;
    this.face = -1; // -1 왼쪽을 봄, 1 오른쪽을 봄
    this.mode = 'fly'; // 'fly' 날기, 'rest' 지쳐서 쉬기, 'grounded' 날개가 부서져 땅에 있음
    this.action = null;
    this.attacks = 0; // 쉬고 나서 한 공격 수
    this.tiredRoll = nextTiredAfter(this.ic.tiredAfter, this.variety, Math.random, 1); // 이번에 지치기까지 공격 수
    this.chained = false;
    this.flap = 0;
    this.flapSound = 0;

    this.aura = scene.add.graphics().setDepth(3);
    this.shadowG = scene.add.graphics().setDepth(1);
    const wingTex = `boss_ice_wing_${skin}`;
    this.wings = [0, 1].map((i) => {
      const sprite = scene.add.image(0, 0, wingTex).setDepth(4).setDisplaySize(170, 130).setOrigin(i === 0 ? 0.98 : 0.02, 0.86).setFlipX(i === 0);
      return {
        side: i === 0 ? -1 : 1, // 화면 왼쪽 날개, 오른쪽 날개
        label: i === 0 ? '왼쪽 날개' : '오른쪽 날개',
        health: new Health(Math.round(this.ic.wingHealth * this.hpScale)),
        alive: true,
        sprite,
        sx: sprite.scaleX,
        sy: sprite.scaleY,
      };
    });
    this.body = scene.add.image(this.x, this.y, `boss_ice_body_${skin}`).setDepth(5).setDisplaySize(220, 170);
    // art.js 에 스프라이트 시트(아들 그림)가 있으면 몸통과 날개 대신 그 애니메이션을 쓴다.
    // 맞는 곳, 날개 체력, 심장 같은 규칙은 그대로이고 그림만 바뀐다.
    this.sheet = scene.anims.exists(`astra_${skin}_anim`);
    this.flashT = 0;
    if (this.sheet) {
      this.sheetRight = sheetFacesRight(scene, `astra_${skin}`);
      this.sprite = scene.add.sprite(this.x, this.y, `astra_${skin}`).setDepth(5).setOrigin(0.5, SHEET_ORIGIN_Y).setDisplaySize(SHEET_W, SHEET_H);
      this.animKey = `astra_${skin}_anim`;
      this.sprite.play(this.animKey);
      this.body.setVisible(false);
      for (const w of this.wings) w.sprite.setVisible(false);
    }
    this.heart = scene.add.image(this.x, this.y, 'ice_heart').setDepth(6).setDisplaySize(26, 32).setAlpha(0.6);
    this.heartHealth = new Health(Math.round(this.ic.heartHealth * this.hpScale));
    this.icicles = [];
    this.spikes = [];
    this.trail = [];
    this.combo = new ComboHazards(this, { rockTexture: 'ice_icicle', rockW: 26, rockH: 64, rockDamage: this.ic.icicleDamage });
    this.pose(0);
  }

  static makeTextures(scene, stage, skin) {
    const c = { ...PALETTE, ...(stage.boss.colors || {}) };
    const O = c.dark; // 테두리
    // 몸통 (왼쪽을 보는 모습: 머리가 왼쪽, 긴 꼬리가 오른쪽). 날개는 따로.
    make(scene, `boss_ice_body_${skin}`, 220, 170, (g) => {
      // 꼬리: 오른쪽 아래로 길게 뻗고 끝이 말려 올라감
      const tail = [
        { x: 138, y: 94 }, { x: 166, y: 102 }, { x: 188, y: 116 }, { x: 202, y: 132 }, { x: 208, y: 148 }, { x: 216, y: 158 },
        { x: 198, y: 154 }, { x: 190, y: 140 }, { x: 176, y: 128 }, { x: 158, y: 122 }, { x: 136, y: 120 },
      ];
      g.fillStyle(c.main).fillPoints(tail, true);
      g.lineStyle(2, O).strokePoints(tail, true);
      // 꼬리 가시 (얼음 결정)
      for (const [x, y] of [[156, 102], [174, 109], [190, 120], [201, 134]]) {
        g.fillStyle(c.light).fillTriangle(x - 6, y + 2, x + 5, y + 2, x + 6, y - 13);
        g.lineStyle(1.5, O).strokeTriangle(x - 6, y + 2, x + 5, y + 2, x + 6, y - 13);
      }
      // 꼬리 끝 큰 결정
      g.fillStyle(c.light).fillTriangle(204, 152, 214, 150, 219, 169);
      g.fillStyle(c.bright).fillTriangle(196, 150, 206, 146, 200, 166);
      // 뒷다리 (몸통 뒤)
      g.fillStyle(c.main).fillEllipse(140, 120, 48, 42);
      g.lineStyle(2, O).strokeEllipse(140, 120, 48, 42);
      g.lineStyle(12, c.main).lineBetween(146, 132, 152, 156);
      g.fillStyle(c.main).fillEllipse(156, 159, 26, 10);
      g.fillStyle(0xf4fcff).fillTriangle(142, 160, 148, 156, 140, 168).fillTriangle(150, 161, 156, 157, 150, 169).fillTriangle(160, 161, 166, 157, 162, 169);
      // 몸통
      g.fillStyle(c.main).fillEllipse(118, 96, 104, 72);
      g.fillStyle(c.bright, 0.7).fillEllipse(124, 84, 84, 38);
      // 비늘 무늬 (작은 반달)
      g.lineStyle(1.5, O, 0.55);
      for (let row = 0; row < 6; row++) {
        const y = 70 + row * 9;
        for (let x = 78 + (row % 2) * 6; x < 168; x += 12) {
          if (((x - 118) / 52) ** 2 + ((y - 96) / 36) ** 2 > 0.75) continue;
          g.beginPath();
          g.arc(x, y, 5, 0, Math.PI, false);
          g.strokePath();
        }
      }
      g.lineStyle(2, O).strokeEllipse(118, 96, 104, 72);
      // 연한 회청색 배 (가로 무늬)
      const belly = [{ x: 84, y: 78 }, { x: 104, y: 82 }, { x: 116, y: 108 }, { x: 110, y: 130 }, { x: 90, y: 130 }, { x: 78, y: 104 }];
      g.fillStyle(c.pale).fillPoints(belly, true);
      g.lineStyle(1.5, 0x8d9bb8);
      for (let y = 88; y < 128; y += 7) {
        g.lineBetween(82, y, 97, y + 4);
        g.lineBetween(97, y + 4, 112, y);
      }
      g.lineStyle(2, O).strokePoints(belly, true);
      // 등 가시 (얼음 결정 줄)
      for (const [x, y, h] of [[98, 64, 18], [112, 60, 22], [126, 60, 24], [140, 64, 20], [154, 72, 16]]) {
        g.fillStyle(c.light).fillTriangle(x - 7, y + 4, x + 7, y + 4, x + 5, y - h);
        g.fillStyle(0xffffff, 0.8).fillTriangle(x - 2, y + 2, x + 2, y + 2, x + 4, y - h + 6);
        g.lineStyle(1.5, O).strokeTriangle(x - 7, y + 4, x + 7, y + 4, x + 5, y - h);
      }
      // 앞다리와 발톱
      g.lineStyle(13, O).lineBetween(94, 106, 84, 128).lineBetween(84, 128, 76, 142);
      g.lineStyle(10, c.main).lineBetween(94, 106, 84, 128).lineBetween(84, 128, 76, 142);
      g.fillStyle(0xf4fcff).fillTriangle(66, 142, 72, 140, 64, 152).fillTriangle(73, 144, 79, 142, 74, 154).fillTriangle(80, 144, 86, 142, 84, 153);
      // 목 (아래쪽은 연한 목줄기)
      const neck = [{ x: 104, y: 70 }, { x: 82, y: 46 }, { x: 62, y: 42 }, { x: 50, y: 62 }, { x: 70, y: 76 }, { x: 88, y: 96 }];
      g.fillStyle(c.main).fillPoints(neck, true);
      g.fillStyle(c.pale).fillPoints([{ x: 52, y: 62 }, { x: 70, y: 76 }, { x: 88, y: 96 }, { x: 84, y: 80 }, { x: 66, y: 66 }], true);
      g.lineStyle(2, O).strokePoints(neck, true);
      for (const [x, y] of [[80, 46], [92, 56]]) {
        g.fillStyle(c.light).fillTriangle(x - 5, y + 2, x + 5, y + 4, x + 6, y - 12);
        g.lineStyle(1.5, O).strokeTriangle(x - 5, y + 2, x + 5, y + 4, x + 6, y - 12);
      }
      // 얼음 뿔 왕관 (머리 뒤로 여러 갈래)
      const horns = [
        [30, 40, 37, 37, 16, 18],
        [37, 37, 46, 35, 28, 4],
        [45, 35, 54, 35, 52, 0],
        [53, 37, 61, 41, 76, 8],
        [59, 43, 66, 49, 90, 28],
      ];
      for (const [x1, y1, x2, y2, tx, ty] of horns) {
        g.fillStyle(c.bright).fillTriangle(x1, y1, x2, y2, tx, ty);
        g.fillStyle(c.light, 0.9).fillTriangle((x1 + x2) / 2, (y1 + y2) / 2, x2 - 1, y2, tx, ty);
        g.lineStyle(1.5, O).strokeTriangle(x1, y1, x2, y2, tx, ty);
      }
      // 머리
      g.fillStyle(c.main).fillEllipse(46, 50, 46, 32);
      // 주둥이
      const snout = [{ x: 32, y: 42 }, { x: 8, y: 50 }, { x: 4, y: 58 }, { x: 12, y: 63 }, { x: 42, y: 62 }];
      g.fillStyle(c.main).fillPoints(snout, true);
      g.fillStyle(c.bright, 0.8).fillTriangle(30, 43, 10, 50, 34, 50);
      // 아래턱
      const jaw = [{ x: 12, y: 65 }, { x: 42, y: 63 }, { x: 46, y: 72 }, { x: 20, y: 74 }];
      g.fillStyle(c.pale).fillPoints(jaw, true);
      g.lineStyle(2, O).strokeEllipse(46, 50, 46, 32).strokePoints(snout, true).strokePoints(jaw, true);
      // 입과 이빨
      g.fillStyle(0x0d1530).fillRect(8, 62, 34, 4);
      g.fillStyle(0xffffff);
      for (let x = 10; x < 38; x += 6) g.fillTriangle(x, 62, x + 4, 62, x + 2, 68);
      g.fillStyle(0x0d1530).fillCircle(11, 53, 2); // 콧구멍
      // 볼 가시
      g.fillStyle(c.light).fillTriangle(52, 60, 58, 54, 72, 66);
      g.lineStyle(1.5, O).strokeTriangle(52, 60, 58, 54, 72, 66);
      // 빛나는 하늘색 눈
      g.fillStyle(0x7ff8ff, 0.35).fillCircle(32, 48, 9);
      g.fillStyle(c.bright).fillTriangle(22, 42, 44, 40, 40, 45); // 눈썹뼈
      g.fillStyle(0x9ffcff).fillEllipse(32, 48, 14, 7);
      g.fillStyle(0xffffff).fillCircle(29, 47, 1.5);
      g.fillStyle(0x0d1530).fillRect(32, 45, 2, 7);
    });

    // 날개 하나 (오른쪽 날개 모습, 왼쪽은 뒤집어서 씀). 붙는 곳이 왼쪽 아래. 반투명 얼음 막 + 결정 테두리
    make(scene, `boss_ice_wing_${skin}`, 170, 130, (g) => {
      const root = { x: 4, y: 112 };
      const wrist = { x: 60, y: 22 };
      const tips = [{ x: 166, y: 4 }, { x: 152, y: 50 }, { x: 130, y: 82 }, { x: 94, y: 106 }];
      const membrane = [root, wrist, tips[0], { x: 144, y: 32 }, tips[1], { x: 128, y: 62 }, tips[2], { x: 106, y: 88 }, tips[3], { x: 60, y: 104 }, { x: 30, y: 124 }];
      g.fillStyle(c.light, 0.5).fillPoints(membrane, true);
      g.fillStyle(c.bright, 0.28).fillPoints([wrist, tips[0], { x: 144, y: 32 }, tips[1], { x: 128, y: 62 }, tips[2], { x: 70, y: 70 }], true);
      // 얼음 금 (반짝이는 결)
      g.lineStyle(1.5, 0xffffff, 0.7);
      g.lineBetween(70, 40, 110, 30).lineBetween(90, 52, 124, 50).lineBetween(70, 70, 100, 78).lineBetween(40, 86, 66, 94).lineBetween(110, 30, 120, 18);
      // 뒤쪽 테두리 고드름
      g.fillStyle(c.light);
      for (const p of [{ x: 144, y: 32 }, { x: 128, y: 62 }, { x: 106, y: 88 }, { x: 60, y: 104 }]) g.fillTriangle(p.x - 6, p.y - 2, p.x + 4, p.y - 2, p.x - 2, p.y + 12);
      g.lineStyle(2, O, 0.8).strokePoints(membrane, true);
      // 뼈대
      g.lineStyle(6, O).lineBetween(root.x, root.y, wrist.x, wrist.y).lineBetween(wrist.x, wrist.y, tips[0].x, tips[0].y);
      g.lineStyle(4, c.main).lineBetween(root.x, root.y, wrist.x, wrist.y).lineBetween(wrist.x, wrist.y, tips[0].x, tips[0].y);
      for (const t of tips.slice(1)) {
        g.lineStyle(4, O).lineBetween(wrist.x, wrist.y, t.x, t.y);
        g.lineStyle(2, c.bright).lineBetween(wrist.x, wrist.y, t.x, t.y);
      }
      // 손가락 끝 결정과 손목 발톱
      g.fillStyle(0xffffff);
      for (const t of tips) g.fillCircle(t.x, t.y, 2.5);
      g.fillStyle(c.light).fillTriangle(56, 22, 64, 18, 52, 4);
      g.lineStyle(1.5, O).strokeTriangle(56, 22, 64, 18, 52, 4);
      g.fillStyle(c.light).fillTriangle(160, 4, 168, 2, 169, 14);
    });

    // 얼음 심장 (약점)
    make(scene, 'ice_heart', 30, 36, (g) => {
      g.fillStyle(0x3fd0ff).fillPoints([{ x: 15, y: 0 }, { x: 30, y: 14 }, { x: 15, y: 36 }, { x: 0, y: 14 }], true);
      g.fillStyle(0xe8ffff).fillPoints([{ x: 15, y: 6 }, { x: 22, y: 14 }, { x: 15, y: 26 }, { x: 8, y: 14 }], true);
    });
    // 떨어지는 고드름 (얼음 결정 조각)
    make(scene, 'ice_icicle', 26, 64, (g) => {
      g.fillStyle(c.bright).fillTriangle(0, 0, 26, 0, 13, 64);
      g.fillStyle(0xbfeeff).fillTriangle(4, 0, 22, 0, 13, 58);
      g.fillStyle(0xffffff).fillTriangle(6, 0, 12, 0, 11, 40);
      g.lineStyle(1.5, O).strokeTriangle(0, 0, 26, 0, 13, 64);
    });
    // 빙천지락 얼음 가시 덩어리 (아래가 바닥)
    make(scene, 'frost_spike', 80, 120, (g) => {
      const spike = (x0, x1, tx, ty) => {
        g.fillStyle(c.bright).fillTriangle(x0, 120, x1, 120, tx, ty);
        g.fillStyle(0xbff4ff).fillTriangle((x0 + tx) / 2, 120, x1 - 3, 120, tx, ty + 4);
        g.fillStyle(0xffffff, 0.9).fillTriangle((x0 + x1) / 2 - 2, 120, (x0 + x1) / 2 + 2, 120, tx, ty + 12);
        g.lineStyle(2, O).strokeTriangle(x0, 120, x1, 120, tx, ty);
      };
      spike(2, 34, 10, 40);
      spike(46, 78, 70, 46);
      spike(16, 64, 40, 0);
    });
  }

  // ---------- 모습 ----------

  get heartOpen() {
    return this.mode === 'grounded';
  }

  get wingsAlive() {
    return this.wings.filter((w) => w.alive);
  }

  get speed() {
    return this.tempo * this.diff.bossSpeed * (this.raging ? this.c.rageSpeed : 1);
  }

  get healthRatio() {
    let cur = this.heartHealth.current;
    let max = this.heartHealth.max;
    for (const w of this.wings) {
      cur += w.alive ? w.health.current : 0;
      max += w.health.max;
    }
    return cur / max;
  }

  get groundBodyY() {
    return this.groundY - GROUND_OFF;
  }

  // 입 위치 (그림 속 위치는 왼쪽을 볼 때 기준이라 face 를 곱함)
  get mouth() {
    return { x: this.x + this.face * MOUTH.x, y: this.y + MOUTH.y };
  }

  // 브레스 그림(빛, 부채꼴, 얼음 조각)이 나오는 입. 시트 그림은 칸마다 입이 달라서 그 자리를 쓴다.
  // 맞는 판정(breathTriangle)은 그대로 this.mouth 를 쓴다 (바닥 쪽 부채꼴은 거의 같다)
  get mouthFx() {
    if (!this.sheet || this.feetY === undefined) return this.mouth;
    const m = SHEET_MOUTHS[Number(this.sprite.frame.name)] || SHEET_MOUTHS[0];
    return { x: this.x + this.face * (m[0] - 198) * SHEET_K, y: this.feetY + (m[1] - 359) * SHEET_K };
  }

  // 플레이어 공격이 맞는 곳 (날 때는 날개까지 넓게)
  hitRect() {
    if (this.mode === 'fly') return new Rect(this.x - 120, this.y - FROST.hitHalfH, 240, FROST.hitHalfH * 2);
    return new Rect(this.x - 95, this.y - 55, 190, 125);
  }

  // 주인공 몸통 판정 (그림 테두리 72x80 이 아니라 실제 몸 30x56).
  // 새 기술(냉기 브레스, 빙천지락)은 이걸로 맞혀서, 틈에 서 있으면 확실히 안 맞는다.
  heroRect(p = this.target) {
    const b = p.body;
    return b ? new Rect(b.x, b.y, b.width, b.height) : p.getBounds();
  }

  // 공격이 플레이어를 맞히는 곳 (급강하, 뛰어 내려찍기)
  dangerRect() {
    return new Rect(this.x - 80, this.y - 45, 160, 100);
  }

  // 스프라이트 위치와 날갯짓
  pose(dt) {
    const a = this.action;
    const folded = this.mode !== 'fly' && !(a && a.type === 'land' && a.phase === 'descend');
    const fast = a && (a.type === 'dive' || (a.type === 'avalanche' && a.phase === 'roar'));
    this.flap += dt * (folded ? 0 : fast ? 20 : 9);
    const flipped = this.face > 0;
    // 날갯짓에 맞춰 몸이 살짝 오르내림
    const bob = folded ? 0 : Math.cos(this.flap) * 4;
    this.body.setPosition(this.x, this.y + bob).setFlipX(flipped);
    if (this.sheet) this.poseSheet(dt, folded, fast, bob);
    const s = Math.sin(this.flap);
    for (const w of this.wings) {
      if (!w.alive || this.sheet) continue;
      w.sprite.setPosition(this.x + w.side * 14, this.y - 30 + bob);
      if (folded) w.sprite.setAngle(w.side * -40).setScale(w.sx * 0.7, w.sy * 0.85);
      else w.sprite.setAngle(w.side * s * 32).setScale(w.sx, w.sy * (0.78 + 0.22 * s));
    }
    // 날갯짓 소리 (아래로 칠 때 가끔)
    if (!folded && !this.defeated && this.state === 'fight') {
      const beat = Math.floor(this.flap / (Math.PI * 2));
      if (beat !== this.flapSound) {
        this.flapSound = beat;
        if (Math.random() < 0.35) this.scene.sfxPlay('flap');
      }
    }
    if (this.sheet) {
      const chest = this.mode === 'grounded' ? SHEET_CHEST_LOW : SHEET_CHEST;
      this.heart.setPosition(this.x + this.face * (chest[0] - 198) * SHEET_K, this.feetY + (chest[1] - 359) * SHEET_K);
    } else this.heart.setPosition(this.x + this.face * CHEST.x, this.y + CHEST.y + bob);
    if (this.heartOpen && !this.defeated) {
      const k = 1 + Math.sin(this.t * 8) * 0.12;
      this.heart.setDisplaySize(30 * k * 1.3, 36 * k * 1.3).setAlpha(1);
    }
    // 땅 그림자
    this.shadowG.clear();
    if (!this.defeated) {
      const h = Phaser.Math.Clamp((this.groundY - this.y) / 400, 0, 1);
      this.shadowG.fillStyle(0x000000, 0.35 - 0.2 * h).fillEllipse(this.x, this.groundY, 180 - 80 * h, 18 - 8 * h);
    }
  }

  // 스프라이트 시트 그림 맞추기: 발이 (this.x, 몸 가운데 + GROUND_OFF) 에 오게 놓는다.
  // 땅에 서면 몸 가운데가 바닥에서 GROUND_OFF 만큼 위라서 발이 바닥에 딱 닿는다.
  poseSheet(dt, folded, fast, bob) {
    const s = this.sprite;
    this.flashT = Math.max(0, this.flashT - dt);
    this.feetY = this.y + GROUND_OFF + bob;
    if (this.defeated) {
      // 쓰러질 때는 collapse 의 움직임을 그대로 두고, 맞을 때 하얀 깜빡임만 지운다
      if (s.tintFill) s.setTint(this.raging ? RAGE_TINT : 0xffffff);
      return;
    }
    // 그림은 발이 칸 가운데보다 머리 쪽에 있어서, 바라보는 쪽 반대로 조금 옮긴다
    s.setPosition(this.x - this.face * SHEET_DX, this.feetY);
    s.setFlipX(this.sheetRight ? this.face < 0 : this.face > 0);
    if (this.mode === 'grounded') {
      // 날개가 다 부서짐: 시트에는 날개가 그려져 있어서 날갯짓을 멈추고
      // 날개를 아래로 늘어뜨린 칸(2번)에 세워 둔 채 숨만 쉰다 (어둡게 얼어붙은 빛)
      if (s.anims.isPlaying) s.anims.stop();
      s.setFrame(2);
      const breathe = 1 + Math.sin(this.t * 3) * 0.02;
      s.setDisplaySize(SHEET_W * (2 - breathe), SHEET_H * breathe);
    } else {
      if (!s.anims.isPlaying) s.play(this.animKey);
      // 지쳐서 내려앉으면 느리게 날개를 치며 살짝 웅크리고, 급강하나 포효 때는 빠르게, 화나면 더 빠르게
      s.anims.timeScale = folded ? 0.4 : fast ? 1.8 : this.raging ? 1.5 : 1;
      s.setDisplaySize(SHEET_W, folded ? SHEET_H * 0.92 : SHEET_H);
    }
    if (this.flashT > 0) s.setTintFill(0xffffff);
    else if (this.raging) s.setTint(RAGE_TINT);
    else if (this.mode === 'grounded') s.setTint(GROUND_TINT);
    else s.clearTint();
  }

  // 빛나는 눈 (분노하면 붉게)
  drawEyes() {
    if (this.defeated) return;
    const bob = this.mode === 'fly' ? Math.cos(this.flap) * 4 : 0;
    let ex = this.x + this.face * EYE.x;
    let ey = this.y + EYE.y + bob;
    if (this.sheet) {
      // 시트 그림은 칸마다 고개 높이가 달라서 지금 칸의 눈 자리를 쓴다
      const eye = SHEET_EYES[Number(this.sprite.frame.name)] || SHEET_EYES[0];
      ex = this.x + this.face * (eye[0] - 198) * SHEET_K;
      ey = this.feetY + (eye[1] - 359) * SHEET_K;
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    const col = this.raging ? 0xff5070 : 0x7ff8ff;
    this.fxG.fillStyle(col, 0.25 + 0.2 * pulse).fillCircle(ex, ey, 9 + pulse * 3);
    this.fxG.fillStyle(0xffffff, 0.8).fillCircle(ex, ey, 2.5);
  }

  faceTo(x) {
    if (Math.abs(x - this.x) > 20) this.face = x > this.x ? 1 : -1;
  }

  // 목표 쪽으로 날아가기. 다 오면 true
  moveTo(tx, ty, dt, speed = this.ic.flySpeed) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) {
      this.x = tx;
      this.y = ty;
      return true;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return false;
  }

  // ---------- 진행 ----------

  startFight() {
    if (this.state !== 'dormant') return;
    super.startFight();
    this.scene.sfxPlay('freeze');
    this.scene.sfxPlay('roar');
  }

  update(dt) {
    const fighting = this.tickState(dt);
    this.bodyX = this.x;
    if (this.state === 'dead') {
      this.pose(dt);
      return;
    }
    if (!fighting) {
      // 등장: 하늘에서 날개를 치며 내려와 자리 잡기
      if (this.state === 'intro') this.moveTo(this.maxX - 160, HIGH_Y, dt, 120);
      else this.y = HIGH_Y + 20 + Math.sin(this.t * 2) * 8;
      this.pose(dt);
      return;
    }
    if (!this.introSaid) {
      this.introSaid = true;
      this.scene.robot.say(['혹한의 아스트라다! 하늘을 나는 얼음 용이야!', '지쳐서 땅에 내려오거나 낮게 뜨면 그때 날개를 때려!'], true);
    }
    this.warn.clear();
    this.fxG.clear();
    this.hideLabels();
    this.updateRage();
    this.drawRage();

    if (!this.action) {
      this.idle(dt);
      this.timer -= dt;
      if (this.timer <= 0 && this.scene.anyAlive) this.startAction();
    } else {
      this.runAction(dt);
    }
    this.combo.update(dt);
    this.updateTrail(dt);
    this.pose(dt);
    this.drawEyes();
  }

  // 공격 사이: 날 때는 플레이어 위쪽 높은 곳을 맴돌고, 땅에서는 플레이어를 바라본다
  idle(dt) {
    const p = this.target;
    if (this.mode === 'fly') {
      const tx = Phaser.Math.Clamp(p.x + (this.x > p.x ? 220 : -220), this.minX + 40, this.maxX - 40);
      this.moveTo(tx, HIGH_Y + Math.sin(this.t * 2.5) * 10, dt, this.ic.flySpeed * 0.6);
      this.faceTo(p.x);
    } else {
      this.y = this.groundBodyY;
      this.faceTo(p.x);
    }
  }

  updateRage() {
    if (this.defeated || this.state !== 'fight') return;
    if (shouldRage(this.healthRatio, this.ic.rageAt, this.raging)) {
      this.raging = true;
      this.chained = false;
      this.scene.sfxPlay('rage');
      this.scene.shake(0.014, 600);
      this.body.setTint(RAGE_TINT);
      for (const w of this.wingsAlive) w.sprite.setTint(RAGE_TINT);
      floatText(this.scene, this.x, this.y - 110, '분노 모드!', '#ff3030', 34);
      this.scene.robot.say(['아스트라가 화났어! 눈이 빨개졌다!', '쉬지 않고 두 번씩 공격하고, 빙천지락이 한 번 더 솟아. 조심해!'], true);
    }
  }

  drawRage() {
    this.aura.clear();
    if (!this.raging || this.defeated) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
    this.aura.fillStyle(0xff2050, 0.12 + 0.1 * pulse).fillEllipse(this.x, this.y, 300 + pulse * 20, 190);
    this.aura.fillStyle(0x9ff4ff, 0.12 + 0.08 * (1 - pulse)).fillEllipse(this.x, this.y, 230, 140);
    // 몸 둘레를 도는 얼음 조각
    for (let i = 0; i < 6; i++) {
      const ang = this.t * 2.2 + (i * Math.PI) / 3;
      drawIceShard(this.aura, this.x + Math.cos(ang) * 135, this.y + Math.sin(ang) * 70, 9, ang + Math.PI / 2, 0xe8fbff, 0.8);
    }
    this.label(7, '분노!', this.x, this.y - 105, 22 + Math.round(pulse * 4), '#ff3030');
  }

  tip(type, text = TIPS[type]) {
    super.tip(type, text);
  }

  // 다음 공격 고르기
  startAction(forceType = null) {
    let type = forceType;
    const tiredAfter = Math.max(2, this.tiredRoll - (2 - this.wingsAlive.length));
    if (!type) {
      if (this.mode === 'fly' && this.attacks >= tiredAfter) type = 'land';
      else {
        const phases = this.def.phases || [];
        const idx = this.mode === 'grounded' ? phases.length - 1 : Math.min(2 - this.wingsAlive.length, phases.length - 1);
        const fallback = this.mode === 'grounded' ? 'hop' : 'icicles';
        type = pickPattern(phases[Math.max(0, idx)], this.lastType, Math.random, fallback);
        if (this.mode === 'grounded' && type === 'dive') type = 'hop';
        if (this.mode === 'fly' && type === 'hop') type = 'dive';
        // 변종은 세 번째 공격까지 전용 공격을 꼭 한 번 보여 준다
        this.picks = (this.picks || 0) + 1;
        if (this.def.signature && !this.sigShown && this.picks >= 3) type = 'signature';
      }
    }
    if (type === 'signature') this.sigShown = true;
    this.lastType = type;
    const p = this.target;
    const a = { type, phase: 'aim', t: 0 };
    this.prepareAttack(a, { freezeBreath: this.ic.breathWarningTime, dive: this.ic.diveWarningTime }, !forceType);
    const mid = (this.minX + this.maxX) / 2;
    if (type === 'icicles') {
      const n = varyCount(Math.max(1, Math.round(this.ic.icicleCount + (this.mode === 'grounded' ? 1 : 0))), this.variety, Math.random, 2);
      a.targets = rockTargets(p.x, n, this.minX - 20, this.maxX + 20);
      a.phase = this.mode === 'fly' ? 'rise' : 'aim';
    } else if (type === 'dive') {
      a.dir = this.x > p.x ? -1 : 1; // 이 방향으로 가로지른다
      a.startX = a.dir < 0 ? this.maxX - 10 : this.minX + 10;
      a.endX = a.dir < 0 ? this.minX + 60 : this.maxX - 60;
      a.ready = false;
    } else if (type === 'freezeBreath') {
      if (this.mode === 'fly') {
        a.dir = p.x > mid ? 1 : -1; // 브레스가 뻗는 방향. 용은 반대쪽 끝에 뜬다
        a.hx = a.dir > 0 ? this.minX + 70 : this.maxX - 70;
      } else {
        a.dir = p.x >= this.x ? 1 : -1;
        a.hx = this.x;
      }
      const cone = breathCone(a.hx, a.dir, this.ic.breathConeNear, this.ic.breathConeLength);
      a.coneNear = cone.near;
      a.coneFar = cone.far;
      a.coneLo = cone.lo;
      a.coneHi = cone.hi;
      a.ready = false;
      a.warnT = 0;
      a.shards = [];
    } else if (type === 'avalanche') {
      const waves = this.raging ? 3 : 2;
      const gap = this.ic.avalancheGap;
      a.waves = avalancheWaves(this.minX - 40, this.maxX + 40, gap, Math.random() * gap, waves, Math.random() < this.variety.shape / 2);
      a.wave = 0;
      a.phase = 'rise';
      a.hitWave = [];
    } else if (type === 'hop') {
      a.tx = Phaser.Math.Clamp(p.x, this.minX, this.maxX);
      a.fromX = this.x;
    } else if (type === 'land') {
      a.phase = 'descend';
      a.tx = landingX(p.x, this.minX + 40, this.maxX - 40, 190);
    } else if (type === 'signature') {
      this.startSignature();
    }
    this.action = a;
    if (type !== 'land') this.scene.sfxPlay('warn');
    this.tip(type);
    // 빙천지락과 전용 공격은 바닥 전체가 위험해서 다른 공격을 겹치지 않는다
    if (type !== 'land' && type !== 'avalanche' && type !== 'signature') this.combo.maybeStart(type, this.diff.bossCombo);
  }

  clearSprites() {
    for (const i of this.icicles) i.destroy();
    this.icicles = [];
    for (const s of this.spikes) s.destroy();
    this.spikes = [];
  }

  endAction() {
    const a = this.action;
    this.action = null;
    this.clearSprites();
    this.warn.clear();
    this.fxG.clear();
    if (a && a.type === 'land') {
      this.attacks = 0;
      this.tiredRoll = nextTiredAfter(this.ic.tiredAfter, this.variety, Math.random, 1);
      this.timer = 0.6;
      this.chained = false;
      return;
    }
    this.attacks += 1;
    const idle = this.restTime(this.mode === 'grounded' ? 1.1 : this.ic.idleTime) * this.speed;
    const rest = restAfterAttack(this.raging, this.chained, idle, this.c.rageChainGap);
    this.timer = rest.wait;
    this.chained = rest.chained;
  }

  runAction(dt) {
    if (this.checkFeint()) return;
    const a = this.action;
    a.t += dt;
    if (a.type === 'icicles') this.runIcicles(dt);
    else if (a.type === 'dive') this.runDive(dt);
    else if (a.type === 'freezeBreath') this.runBreath(dt);
    else if (a.type === 'avalanche') this.runAvalanche(dt);
    else if (a.type === 'hop') this.runHop(dt);
    else if (a.type === 'land') this.runLand(dt);
    else if (a.type === 'crash') this.runCrash(dt);
    else if (a.type === 'signature') this.runSignature(dt);
    else this.endAction();
  }

  next(a, phase) {
    a.phase = phase;
    a.t = 0;
  }

  // ---------- 고드름 비 (그림자 피하기) ----------

  runIcicles(dt) {
    const a = this.action;
    const mid = (this.minX + this.maxX) / 2;
    if (a.phase === 'rise') {
      const done = this.moveTo(Phaser.Math.Clamp(this.x, mid - 200, mid + 200), HIGH_Y - 30, dt, this.ic.flySpeed * 1.4);
      if (done || a.t > 0.7) this.next(a, 'aim');
      return;
    }
    if (a.phase === 'aim') {
      const dur = this.ic.icicleWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      if (this.mode === 'fly') this.x += Math.sin(this.t * 40) * 1.5;
      for (const x of a.targets) {
        this.warn.fillStyle(0x000000, 0.3 + 0.35 * k).fillEllipse(x, this.groundY, 26 + 40 * k, 8 + 8 * k);
        this.warn.lineStyle(2, 0x9fe8ff, 0.5 + 0.5 * Math.sin(this.t * 20)).strokeEllipse(x, this.groundY, 70, 18);
        this.warn.fillStyle(0xbfeeff, 0.5 * k).fillTriangle(x - 8, 0, x + 8, 0, x, 30 * k);
      }
      this.label(0, '고드름 조심!', mid, 70, 26);
      if (a.t >= dur) {
        this.next(a, 'fall');
        this.icicles = a.targets.map((x) => this.scene.add.image(x, -70, 'ice_icicle').setDepth(8).setDisplaySize(26, 64));
        this.scene.sfxPlay('icicle');
      }
      return;
    }
    if (a.phase === 'fall') {
      const k = Math.min(1, a.t / 0.35);
      for (const ic of this.icicles) ic.y = lerp(-70, this.groundY - 32, k * k);
      if (k >= 1) {
        const hits = new Set(); // 고드름 여러 개가 한 사람을 두 번 때리지 않게
        this.scene.shake(0.006, 150);
        for (const ic of this.icicles) {
          this.scene.sparks?.explode(10, ic.x, this.groundY - 10);
          this.scene.dustAt(ic.x, this.groundY, 5);
          this.hurtPlayer(new Rect(ic.x - 26, this.groundY - 64, 52, 64), this.ic.icicleDamage, ic.x, undefined, hits);
          ic.destroy();
        }
        this.icicles = [];
        this.scene.sfxPlay('slam');
        this.next(a, 'after');
      }
      return;
    }
    if (a.t >= 0.45) this.endAction();
  }

  // ---------- 급강하 (대시로 통과) ----------

  // 급강하 길: u(0~1) 에 따른 위치
  divePoint(a, u) {
    const x = lerp(a.startX, a.endX, u);
    const lowY = this.groundY - 70;
    let y;
    if (u < 0.3) y = lerp(HIGH_Y, lowY, Math.sin((u / 0.3) * (Math.PI / 2)));
    else if (u < 0.78) y = lowY;
    else y = lerp(lowY, LOW_Y, Phaser.Math.Easing.Sine.Out((u - 0.78) / 0.22));
    return { x, y };
  }

  runDive(dt) {
    const a = this.action;
    const p = this.target;
    if (a.phase === 'aim') {
      // 출발점으로 날아가며 경고
      const there = this.moveTo(a.startX, HIGH_Y, dt, this.ic.flySpeed * 1.5);
      this.faceTo(a.endX);
      const dur = this.ic.diveWarningTime * this.speed * a.late;
      if (there) a.ready = true;
      this.drawDiveWarning(a);
      if (a.ready && a.t >= dur) {
        this.next(a, 'dive');
        this.scene.sfxPlay('swoop');
      }
      return;
    }
    if (a.phase === 'dive') {
      const u = Math.min(1, a.t / Math.max(0.4, this.ic.diveTime * this.speed));
      const pt = this.divePoint(a, u);
      this.x = pt.x;
      this.y = pt.y;
      this.trail.push({ x: this.x, y: this.y, life: 0.3 });
      if (u > 0.25 && u < 0.85 && Math.random() < 0.6) this.scene.dustAt(this.x, this.groundY, 2);
      if (u > 0.1 && u < 0.85) this.hurtPlayer(this.dangerRect(), this.ic.diveDamage, this.x - a.dir * 60, 420, (a.hits ??= new Set()));
      if (u >= 1) {
        this.next(a, 'hover');
        this.tip('hover');
      }
      return;
    }
    if (a.phase === 'hover') {
      // 낮게 떠서 숨 고르기 (맞는 곳 아래쪽 y 약 305)
      this.y = LOW_Y + Math.sin(this.t * 5) * 5;
      this.faceTo(p.x);
      this.label(0, this.scene.keyText('지금! 점프 {atk}!'), this.x, this.y - 110, 22, '#ffd23f');
      this.label(1, '▲', this.x, this.y + 85, 22, '#ffd23f');
      if (a.t >= this.ic.hoverTime) this.endAction();
    }
  }

  drawDiveWarning(a) {
    const alpha = 0.2 + 0.15 * Math.sin(this.t * 18);
    const lowY = this.groundY - 70;
    const x0 = Math.min(a.startX, a.endX);
    const x1 = Math.max(a.startX, a.endX);
    // 몸이 낮게 지나가는 구간
    const la = lerp(a.startX, a.endX, 0.22);
    const lb = lerp(a.startX, a.endX, 0.85);
    this.warn.fillStyle(0xff2020, alpha).fillRect(Math.min(la, lb), lowY - 45, Math.abs(lb - la), 115);
    this.warn.lineStyle(3, 0xff4444, 1).strokeRect(Math.min(la, lb), lowY - 45, Math.abs(lb - la), 115);
    // 날아오는 길 (점선)
    for (let u = 0; u <= 1.001; u += 0.04) {
      const pt = this.divePoint(a, u);
      this.warn.fillStyle(0xffe0e0, 0.9).fillCircle(pt.x, pt.y, 4);
    }
    const arrow = a.dir < 0 ? '◀◀  급강하! 대시로 통과!  ◀◀' : '▶▶  급강하! 대시로 통과!  ▶▶';
    this.label(0, arrow, (x0 + x1) / 2, lowY - 75, 24);
  }

  updateTrail(dt) {
    for (const tr of this.trail) {
      tr.life -= dt;
      if (tr.life > 0) this.fxG.fillStyle(0xbfeeff, tr.life * 1.6).fillEllipse(tr.x, tr.y, 140 * tr.life * 3, 44 * tr.life * 3);
    }
    this.trail = this.trail.filter((tr) => tr.life > 0);
  }

  // ---------- 냉기 브레스 (부채꼴 밖으로, 바닥 서리는 점프나 대시) ----------
  // 입에서 큰 부채꼴 서리를 바닥에 뿜고(용 밑과 뒤는 안전),
  // 부채꼴 끝에서 낮은 서리 벽이 바닥을 따라 반대쪽 끝까지 달린다.

  breathTriangle(a) {
    const m = this.mouth;
    return new Phaser.Geom.Triangle(m.x, m.y, a.coneNear, this.groundY + 6, a.coneFar, this.groundY + 6);
  }

  runBreath(dt) {
    const a = this.action;
    const gy = this.groundY;
    if (a.phase === 'aim') {
      if (this.mode === 'fly') {
        const there = this.moveTo(a.hx, BREATH_Y, dt, this.ic.flySpeed * 1.5);
        if (there) a.ready = true;
      } else {
        a.ready = true;
        this.y = this.groundBodyY - 6; // 고개를 쳐듦
      }
      this.face = a.dir;
      const dur = this.ic.breathWarningTime * this.speed * a.late;
      if (a.ready) {
        if (a.warnT === 0) this.scene.sfxPlay('breathCharge');
        a.warnT += dt;
      }
      const k = Math.min(1, a.warnT / dur);
      const blink = 0.5 + 0.5 * Math.sin(this.t * 20);
      const m = this.mouthFx;
      // 바닥 부채꼴 자리 (파란 점선 테두리)
      if (a.ready) {
        this.warn.fillStyle(0x3fd0ff, 0.12 + 0.12 * blink).fillTriangle(m.x, m.y, a.coneNear, gy + 4, a.coneFar, gy + 4);
        this.warn.lineStyle(3, 0x9fe8ff, 0.6 + 0.4 * blink).strokeTriangle(m.x, m.y, a.coneNear, gy + 4, a.coneFar, gy + 4);
        this.warn.fillStyle(0x3fd0ff, 0.35 + 0.2 * blink).fillRect(a.coneLo, gy - 8, a.coneHi - a.coneLo, 8);
        // 부채꼴 끝에서 서리가 달려갈 길 (낮은 띠)
        const wx0 = a.dir > 0 ? a.coneFar : this.minX - 60;
        const wx1 = a.dir > 0 ? this.maxX + 60 : a.coneFar;
        this.warn.fillStyle(0x3fd0ff, 0.1 + 0.1 * blink).fillRect(wx0, gy - BREATH_H, wx1 - wx0, BREATH_H);
        this.warn.lineStyle(2, 0x9fe8ff, 0.7).strokeRect(wx0, gy - BREATH_H, wx1 - wx0, BREATH_H);
        // 안전한 곳 (용 밑과 뒤)
        const safeX = a.dir > 0 ? (this.arenaStart + a.coneLo) / 2 : (a.coneHi + this.arenaEnd) / 2;
        this.label(2, '안전', safeX, gy - 20, 18, '#9dffb0');
      }
      // 입이 점점 밝아짐 + 빨려 드는 얼음 가루
      this.fxG.fillStyle(0x7ff8ff, 0.3 + 0.3 * blink).fillCircle(m.x, m.y, 14 + 22 * k);
      this.fxG.fillStyle(0xffffff, 0.8).fillCircle(m.x, m.y, 5 + 9 * k);
      for (let i = 0; i < 8; i++) {
        const ang = i * 0.785 + this.t * 3;
        const r = 70 * (1 - ((this.t * 1.6 + i * 0.125) % 1));
        drawIceShard(this.fxG, m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r, 5, ang + Math.PI, 0xe8fbff, 0.9);
      }
      this.label(0, '냉기 브레스!', m.x + a.dir * 120, m.y - 50, 30, '#7ff8ff');
      this.label(1, '부채꼴 밖으로! 바닥 서리는 점프!', (this.minX + this.maxX) / 2, 245, 22);
      if (a.ready && a.warnT >= dur) {
        this.next(a, 'blow');
        a.front = a.coneFar;
        this.scene.sfxPlay('freezeBreath');
        this.scene.shake(0.008, 300);
      }
      return;
    }
    if (a.phase === 'blow') {
      const m = this.mouthFx;
      const blowDur = this.ic.breathTime * Math.max(0.75, this.speed);
      const power = Math.min(1, a.t / 0.12) * (a.t > blowDur - 0.2 ? Math.max(0, (blowDur - a.t) / 0.2) : 1);
      if (a.t < blowDur) {
        drawFrostCone(this.fxG, m.x, m.y, a.coneNear, a.coneFar, gy, this.t, power);
        // 입에서 쏟아지는 얼음 조각
        for (let i = 0; i < 3; i++) {
          const tx = lerp(a.coneNear, a.coneFar, Math.random());
          const ang = Math.atan2(gy - m.y, tx - m.x);
          const sp = 520 + Math.random() * 200;
          a.shards.push({ x: m.x, y: m.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ang });
        }
        this.fxG.fillStyle(0xffffff, 0.9 * power).fillCircle(m.x, m.y, 16);
        const tri = this.breathTriangle(a);
        a.hits ??= new Set(); // 브레스 한 번에 한 사람은 한 번만 맞는다 (부채꼴과 서리 벽을 합쳐서)
        for (const q of this.scene.players) {
          if (q.dead || a.hits.has(q) || a.t <= 0.08 || !Phaser.Geom.Intersects.RectangleToTriangle(this.heroRect(q), tri)) continue;
          if (q.hurt(this.ic.breathDamage, this.x, 260) !== 'ignored') a.hits.add(q);
        }
      }
      for (const s of a.shards) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y < gy) drawIceShard(this.fxG, s.x, s.y, 8, s.ang, 0xe8fbff, 0.95);
      }
      a.shards = a.shards.filter((s) => s.y < gy);
      // 부채꼴 끝에서 바닥을 달리는 서리 벽.
      // 부채꼴 끝에 서리가 쌓이는 동안(waveDelay)은 멈춰 있어서, 바로 앞에 서 있어도 점프할 시간이 있다.
      const grow = Math.min(1, a.t / this.ic.breathWaveDelay);
      if (grow >= 1) a.front += a.dir * this.ic.breathSpeed * dt;
      const tail = a.front - a.dir * BREATH_LEN;
      const l = Math.min(a.front, tail);
      const waveOn = a.dir > 0 ? tail < this.maxX + 80 : tail > this.minX - 80;
      if (waveOn) {
        const wallArt = stamp(this.scene, 'fx_frost_wall', l + BREATH_LEN / 2, gy + 4, BREATH_LEN + 20, BREATH_H * grow + 10, { flipX: a.dir < 0 });
        if (!wallArt) this.fxG.fillStyle(0xbfeeff, 0.8).fillRect(l, gy - BREATH_H * 0.6 * grow, BREATH_LEN, BREATH_H * 0.6 * grow);
        for (let i = 0; i < 6 && !wallArt; i++) {
          const sx = l + i * 22 + 4;
          const h = grow * BREATH_H * (0.7 + 0.3 * Math.sin(i * 2.1 + this.t * 20));
          this.fxG.fillStyle(0x3d9be0, 0.9).fillTriangle(sx - 2, gy, sx + 10, gy - h - 4, sx + 22, gy);
          this.fxG.fillStyle(0xffffff, 0.95).fillTriangle(sx + 4, gy, sx + 10, gy - h, sx + 16, gy);
        }
        if (Math.random() < 0.5) this.scene.dustAt(a.front, gy, 1);
        if (grow >= 1) this.hurtPlayer(new Rect(l, gy - BREATH_H, BREATH_LEN, BREATH_H), this.ic.breathDamage, a.front - a.dir * 40, undefined, (a.hits ??= new Set()));
      }
      // 지나간 바닥은 살짝 얼어붙음 (아프지 않음)
      const s0 = Math.min(a.coneFar, tail);
      const s1 = Math.max(a.coneFar, tail);
      if (s1 > s0) this.fxG.fillStyle(0xd8f4ff, 0.35).fillRect(s0, gy - 6, s1 - s0, 6);
      if (!waveOn && a.t >= blowDur && a.shards.length === 0) this.next(a, 'after');
      return;
    }
    if (a.t >= 0.4) this.endAction();
  }

  // ---------- 빙천지락 (빛나는 바닥에서 얼음 가시가 번갈아 솟음) ----------

  runAvalanche(dt) {
    const a = this.action;
    const gy = this.groundY;
    const mid = (this.minX + this.maxX) / 2;
    if (a.phase === 'rise') {
      // 하늘 높이 솟아오르기 (땅에서는 몸을 일으켜 세움)
      let done;
      if (this.mode === 'fly') done = this.moveTo(Phaser.Math.Clamp(this.x, mid - 200, mid + 200), SKY_Y, dt, this.ic.flySpeed * 1.5);
      else {
        this.y = this.groundBodyY - 14 * Math.min(1, a.t / 0.4);
        done = a.t >= 0.4;
      }
      this.faceTo(this.target.x);
      this.drawAvalancheGlow(a.waves[0], 0.3);
      if (done || a.t > 0.9) {
        this.next(a, 'roar');
        this.scene.sfxPlay('roar');
      }
      return;
    }
    if (a.phase === 'roar') {
      // 포효하며 날개로 땅을 내리친다
      if (this.mode === 'fly') this.y = SKY_Y + Math.sin(a.t * 30) * 3;
      const k = Math.min(1, a.t / 0.5);
      this.fxG.lineStyle(4, 0xbff4ff, 0.7 * (1 - k)).strokeCircle(this.x, this.y, 60 + 200 * k);
      this.fxG.lineStyle(3, 0xffffff, 0.5 * (1 - k)).strokeCircle(this.x, this.y, 30 + 140 * k);
      this.label(0, '빙천지락!', this.x, Math.max(this.y - 110, this.y + 105 * (this.mode === 'fly' ? 1 : -1)), 34, '#7ff8ff');
      this.drawAvalancheGlow(a.waves[0], 0.5);
      if (a.t >= 0.5) {
        this.scene.sfxPlay('avalanche');
        this.scene.shake(0.012, 500);
        this.next(a, 'warn');
      }
      return;
    }
    if (this.mode === 'fly') this.y = SKY_Y + Math.sin(this.t * 3) * 6;
    else this.y = this.groundBodyY - 14;
    const xs = a.waves[a.wave];
    if (a.phase === 'warn') {
      const dur = this.ic.avalancheWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      this.drawAvalancheGlow(xs, 0.4 + 0.6 * k);
      // 하늘에서 얼음 조각이 빛나는 자리로 꽂힘 (가시가 솟을 때 땅에 닿음)
      for (const x of xs) drawIceShard(this.fxG, x, lerp(-30, gy - 40, k * k), 12, Math.PI / 2, 0xe8fbff, 0.95);
      this.label(1, '빛나는 곳에서 가시가 솟아! 틈으로!', mid, 245, 24);
      if (a.t >= dur) {
        this.next(a, 'erupt');
        this.spikes = xs.map((x) => this.scene.add.image(x, gy + 4, 'frost_spike').setOrigin(0.5, 1).setDepth(7).setDisplaySize(80, 10));
        this.scene.sfxPlay('spikeBurst');
        this.scene.shake(0.01, 200);
        for (const x of xs) {
          this.scene.sparks?.explode(6, x, gy - 20);
        }
      }
      return;
    }
    if (a.phase === 'erupt') {
      const up = Math.min(1, a.t / 0.08);
      const down = a.t > 0.42 ? Math.max(0, 1 - (a.t - 0.42) / 0.13) : 1;
      for (const s of this.spikes) s.setDisplaySize(80, Math.max(4, (SPIKE_H + 10) * up * down));
      if (a.t > 0.03 && a.t < 0.4) {
        const hits = (a.hitWave[a.wave] ??= new Set()); // 한 줄의 가시는 한 사람을 한 번만 때린다
        for (const x of xs) this.hurtPlayer(new Rect(x - SPIKE_W / 2, gy - SPIKE_H, SPIKE_W, SPIKE_H), this.ic.avalancheDamage, x, 300, hits);
      }
      if (a.t >= 0.55) {
        for (const s of this.spikes) s.destroy();
        this.spikes = [];
        if (a.wave + 1 < a.waves.length) {
          a.wave += 1;
          this.next(a, 'warn');
        } else this.next(a, 'after');
      }
      return;
    }
    if (a.t >= 0.4) this.endAction();
  }

  // 가시가 솟을 자리: 빛나는 바닥과 금
  drawAvalancheGlow(xs, k) {
    const gy = this.groundY;
    const blink = 0.5 + 0.5 * Math.sin(this.t * 22);
    for (const x of xs) {
      this.warn.fillStyle(0x3fd0ff, (0.35 + 0.4 * blink) * k).fillEllipse(x, gy, SPIKE_W + 24, 22);
      this.warn.fillStyle(0x7fe0ff, (0.18 + 0.14 * blink) * k).fillRect(x - SPIKE_W / 2, gy - SPIKE_H * k, SPIKE_W, SPIKE_H * k);
      this.warn.fillStyle(0xffffff, 0.25 * k).fillRect(x - 6, gy - SPIKE_H * 1.6 * k, 12, SPIKE_H * 1.6 * k);
      this.warn.lineStyle(2, 0x9fe8ff, 0.8 * k).strokeRect(x - SPIKE_W / 2, gy - SPIKE_H * k, SPIKE_W, SPIKE_H * k);
      this.warn.lineStyle(2, 0xffffff, 0.8 * k);
      this.warn.lineBetween(x - 20, gy - 2, x + 4, gy - 8).lineBetween(x + 4, gy - 8, x + 22, gy - 1);
    }
  }

  // ---------- 뛰어 내려찍기 (날개가 부서진 뒤) ----------

  runHop(dt) {
    const a = this.action;
    const baseY = this.groundBodyY;
    if (a.phase === 'aim') {
      const dur = this.ic.hopWarningTime * this.speed;
      const k = Math.min(1, a.t / dur);
      this.y = baseY + 10 * k; // 웅크리기
      this.faceTo(a.tx);
      this.warn.fillStyle(0x000000, 0.3 + 0.3 * k).fillEllipse(a.tx, this.groundY, 120 + 60 * k, 20);
      this.warn.fillStyle(0xff2020, 0.15 + 0.15 * Math.sin(this.t * 18)).fillRect(a.tx - 95, this.groundY - 120, 190, 120);
      this.warn.lineStyle(3, 0xff4444, 1).strokeRect(a.tx - 95, this.groundY - 120, 190, 120);
      this.label(0, '뛰어내린다! 피해!', a.tx, this.groundY - 200, 24);
      if (a.t >= dur) this.next(a, 'air');
      return;
    }
    if (a.phase === 'air') {
      const k = Math.min(1, a.t / 0.6);
      this.x = lerp(a.fromX, a.tx, k);
      this.y = baseY - Math.sin(k * Math.PI) * 220;
      this.warn.fillStyle(0x000000, 0.45).fillEllipse(a.tx, this.groundY, 180, 20);
      if (k >= 1) {
        this.y = baseY;
        this.scene.sfxPlay('slam');
        this.scene.shake(0.016, 300);
        this.scene.impact?.bossSlam(1); // 쿵: 잠깐 멈칫 + 화면 확대 (src/fx/impact.js)
        this.scene.dustAt(this.x, this.groundY, 18);
        this.scene.sparks?.explode(16, this.x, this.groundY - 10);
        this.hurtPlayer(new Rect(a.tx - 95, this.groundY - 120, 190, 120), this.ic.hopDamage, this.x, 380);
        this.next(a, 'after');
      }
      return;
    }
    if (a.t >= 0.6) this.endAction();
  }

  // ---------- 지쳐서 내려앉기 (때릴 기회) ----------

  runLand(dt) {
    const a = this.action;
    if (a.phase === 'descend') {
      this.faceTo(this.target.x);
      this.warn.fillStyle(0x3fd0ff, 0.25).fillEllipse(a.tx, this.groundY, 180, 20);
      const there = this.moveTo(a.tx, this.groundBodyY, dt, this.ic.flySpeed * 1.2);
      if (there) {
        this.mode = 'rest';
        this.scene.dustAt(this.x, this.groundY, 12);
        this.scene.sfxPlay('slam');
        this.scene.shake(0.006, 150);
        this.next(a, 'rest');
        floatText(this.scene, this.x, this.y - 100, '헉헉...', '#bfeeff', 24);
      }
      return;
    }
    if (a.phase === 'rest') {
      this.faceTo(this.target.x);
      this.y = this.groundBodyY + Math.sin(this.t * 6) * 2;
      this.label(0, '지쳤다! 지금 때려!', this.x, this.y - 115, 22, '#ffd23f');
      // 입김
      if (Math.random() < 0.08) this.scene.dustAt(this.x + this.face * 105, this.y - 20, 1);
      if (a.t >= this.ic.restTime) {
        this.mode = 'fly';
        this.next(a, 'takeoff');
        this.scene.sfxPlay('flap');
      }
      return;
    }
    if (a.phase === 'takeoff') {
      const there = this.moveTo(this.x, HIGH_Y, dt, this.ic.flySpeed);
      if (there || a.t > 1.2) this.endAction();
    }
  }

  // 날개가 다 부서져 떨어진다
  runCrash(dt) {
    const a = this.action;
    if (a.phase === 'aim') {
      this.y = Math.min(this.groundBodyY, this.y + 500 * dt);
      this.x += Math.sin(this.t * 30) * 2;
      if (this.y >= this.groundBodyY) {
        this.scene.sfxPlay('slam');
        this.scene.shake(0.02, 400);
        this.scene.impact?.bossSlam(1); // 쿵: 잠깐 멈칫 + 화면 확대 (src/fx/impact.js)
        this.scene.dustAt(this.x, this.groundY, 24);
        this.next(a, 'after');
      }
      return;
    }
    if (a.t >= 1.0) {
      this.action = null;
      this.attacks = 0;
      this.timer = 1.0;
    }
  }

  // ---------- 플레이어 공격 ----------

  receiveAttack(rect, attack) {
    if (this.state !== 'fight' || this.defeated) return false;
    if (this.action && this.action.type === 'crash' && this.action.phase === 'aim') return false;
    if (this.sig?.receiveAttack?.(rect, attack)) return true;
    if (!intersects(rect, this.hitRect())) return false;
    if (this.heartOpen) {
      const dmg = coreDamage(attack, this.c.chargedPunchCoreMultiplier);
      this.damageHeart(dmg, attack.kind === 'charged' ? '#ffd23f' : '#ffffff');
      return true;
    }
    const side = rect.centerX < this.x ? -1 : 1;
    const wing = this.wings.find((w) => w.alive && w.side === side) || this.wingsAlive[0];
    if (!wing) return false;
    this.damageWing(wing, attack.damage, attack.kind === 'charged' ? '#ffd23f' : '#ffffff');
    return true;
  }

  receiveUltimate(damage) {
    if (this.state !== 'fight' || this.defeated) return false;
    this.sig?.onUltimate?.();
    if (this.heartOpen) this.damageHeart(damage, '#3fd0ff');
    else {
      const wing = this.wingsAlive.sort((a, b) => a.health.current - b.health.current)[0];
      if (!wing) return false;
      this.damageWing(wing, damage, '#3fd0ff');
    }
    return true;
  }

  damageWing(wing, dmg, color) {
    wing.health.damage(dmg);
    floatText(this.scene, this.x + wing.side * 70, this.y - 70, String(dmg), color, color === '#ffffff' ? 20 : 28);
    const tint = this.raging ? RAGE_TINT : null;
    flash(this.scene, wing.sprite, tint);
    flash(this.scene, this.body, tint);
    this.flashT = 0.07; // 시트 그림 깜빡임 (pose 에서 칠함)
    this.scene.sparks?.explode(8, this.x + wing.side * 60, this.y - 30);
    if (wing.health.isDead) this.breakWing(wing);
  }

  damageHeart(dmg, color) {
    this.heartHealth.damage(dmg);
    floatText(this.scene, this.heart.x, this.heart.y - 40, String(dmg), color, color === '#ffffff' ? 20 : 30);
    flash(this.scene, this.heart);
    flash(this.scene, this.body, this.raging ? RAGE_TINT : null);
    this.flashT = 0.07;
    this.scene.sparks?.explode(10, this.heart.x, this.heart.y);
    if (this.heartHealth.isDead) this.defeat();
  }

  breakWing(wing) {
    wing.alive = false;
    this.scene.sfxPlay('break');
    this.scene.shake(0.015, 300);
    floatText(this.scene, this.x + wing.side * 70, this.y - 120, `${wing.label} 파괴!`, '#ff9a1f', 30);
    // 얼음 날개가 산산조각
    for (let i = 0; i < 3; i++) this.scene.sparks?.explode(8, this.x + wing.side * (40 + i * 40), this.y - 40 - i * 15);
    // 시트 그림을 쓸 때는 숨겨 둔 얼음 날개 조각을 그 자리에 보여 주고 떨어뜨린다
    if (this.sheet) wing.sprite.setVisible(true).setPosition(this.x + wing.side * 14, this.y - 30).setAlpha(0.85).setTint(GROUND_TINT);
    this.scene.tweens.add({
      targets: wing.sprite,
      angle: wing.side * 120,
      y: this.groundY,
      alpha: 0,
      duration: 900,
      onComplete: () => wing.sprite.destroy(),
    });
    this.scene.gainXp(this.c.armXp, this.x + wing.side * 60, this.y - 140);
    if (this.wingsAlive.length > 0) {
      this.scene.robot.say(`${wing.label} 끝! 이제 금방 지칠 거야. 하나 남았어!`, true);
      return;
    }
    // 날개가 다 부서지면 떨어진다 (지금 하던 공격은 멈춤)
    this.clearSprites();
    this.combo.clear();
    this.stopSignature();
    this.mode = 'grounded';
    this.action = { type: 'crash', phase: 'aim', t: 0 };
    this.scene.robot.say(['날개가 다 부서졌어! 이제 못 날아!', '가슴의 얼음 심장을 때려! {strong}(이)가 제일 세!'], true);
  }

  hudParts() {
    const parts = this.wings.map((w) => ({ label: w.alive ? w.label : `${w.label} 파괴`, ratio: w.alive ? w.health.ratio : 0, kind: 'part' }));
    parts.push({ label: this.heartOpen ? '얼음 심장 (약점!)' : '얼음 심장 (잠김)', ratio: this.heartHealth.ratio, kind: 'core', locked: !this.heartOpen });
    return parts;
  }

  defeat() {
    if (this.defeated) return;
    this.action = null;
    this.combo.clear();
    this.clearSprites();
    this.aura.clear();
    super.defeat();
  }

  collapse() {
    this.shadowG.clear();
    const targets = [this.body, this.heart, ...this.wingsAlive.map((w) => w.sprite)];
    if (this.sheet) {
      this.sprite.anims.stop();
      targets.push(this.sprite);
    }
    this.scene.tweens.add({ targets, alpha: 0, y: this.groundY - 20, angle: 30, duration: 900 });
  }
}
