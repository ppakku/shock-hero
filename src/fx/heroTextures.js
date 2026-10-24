import { make } from './textures.js';

// 주인공 그림: docs/hero_sheet.png (아이들이 그린 캐릭터 시트)를 보고 도형으로 그린다.
// 검은 쫄쫄이 슈트 + 노란 무늬, 큰 눈알 렌즈 방독면, 헝클어진 갈색 머리, 검은 반바지.
// customArt 에 player 그림을 넣으면 그 한 장을 모든 동작에 쓴다.

// 한 장면(프레임) 크기. 화면에서는 이 크기 그대로(72x80) 보이고, 그림은 2배로 촘촘하게 그린다.
export const HERO_FRAME = { w: 72, h: 80, feetY: 78 };
const S = 2;
const CX = 36;
// 스프라이트 기준점: 몸 한가운데 (발에서 31 위)
export const HERO_ORIGIN_Y = (HERO_FRAME.feetY - 31) / HERO_FRAME.h;

const C = {
  suit: 0x2b2b31,
  suitBack: 0x1d1d22,
  shade: 0x202025,
  light: 0x3c3c45,
  gold: 0xf2b51c,
  goldBack: 0xb08214,
  shorts: 0x141417,
  glove: 0x101013,
  hair: 0x3e2a1b,
  hairDark: 0x2a1c12,
  mask: 0x18181c,
  lens: 0xe9eef1,
  lensRing: 0x8f969f,
  blue: 0x3f8cff,
  blueLight: 0x9fd8ff,
};

const rad = (d) => (d * Math.PI) / 180;
// 각도 약속: 0 = 아래로, + = 앞쪽(오른쪽)으로 돌아감, 180 = 위로
const endOf = (x, y, ang, len) => ({ x: x + Math.sin(rad(ang)) * len, y: y + Math.cos(rad(ang)) * len });

// 끝이 둥근 사다리꼴 마디 (팔, 다리)
function seg(g, x, y, ang, len, w0, w1, color, accent) {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(-rad(ang));
  g.fillStyle(color);
  g.fillPoints([{ x: -w0 / 2, y: 0 }, { x: w0 / 2, y: 0 }, { x: w1 / 2, y: len }, { x: -w1 / 2, y: len }], true);
  g.fillCircle(0, 0, w0 / 2);
  g.fillCircle(0, len, w1 / 2);
  if (accent) accent(g, len, w0, w1);
  g.restore();
  return endOf(x, y, ang, len);
}

function leg(g, hip, [thigh, shin, foot = 0], back) {
  const suit = back ? C.suitBack : C.suit;
  const gold = back ? C.goldBack : C.gold;
  const knee = seg(g, hip.x, hip.y, thigh, 13, 8, 6.2, suit, (gg, len) => {
    gg.fillStyle(gold).fillRect(1.2, len * 0.45, 1.8, len * 0.5); // 허벅지 옆 노란 줄
  });
  const ankle = seg(g, knee.x, knee.y, shin, 12, 6, 4.6, suit, (gg, len) => {
    gg.fillStyle(gold).fillRoundedRect(-1.2, -1.5, 4, 4.5, 1.5); // 무릎 노란 패드
    gg.fillStyle(gold).fillRect(0.6, len * 0.35, 1.4, len * 0.45); // 정강이 노란 줄
  });
  // 신발: 검은 신발 + 노란 밑창
  g.save();
  g.translateCanvas(ankle.x, ankle.y);
  g.rotateCanvas(-rad(foot));
  g.fillStyle(back ? 0x0c0c0e : C.glove).fillRoundedRect(-3, -1.5, 9.5, 4.2, 2);
  g.fillStyle(gold).fillRoundedRect(-3.2, 2.2, 10, 1.6, 0.8);
  g.fillStyle(0x3a3a40).fillRect(0, -0.8, 3, 0.8);
  g.restore();
  // 반바지 (허벅지 윗부분 덮기)
  seg(g, hip.x, hip.y, thigh, 6, 9.2, 8.6, back ? 0x0e0e10 : C.shorts);
}

function arm(g, sh, [upper, fore], back, glow) {
  const suit = back ? C.suitBack : C.suit;
  const gold = back ? C.goldBack : C.gold;
  const elbow = seg(g, sh.x, sh.y, upper, 10.5, 6.6, 5.4, suit);
  const wrist = seg(g, elbow.x, elbow.y, fore, 9.5, 5.4, 4.4, suit, (gg, len) => {
    gg.fillStyle(gold).fillRoundedRect(-2, len * 0.25, 4, len * 0.45, 1.2); // 팔뚝 노란 판
  });
  // 어깨 노란 덮개
  g.fillStyle(gold).fillCircle(sh.x, sh.y + 0.5, 3.6);
  g.fillStyle(suit).fillCircle(sh.x - 0.8, sh.y + 2.2, 2.2);
  const fist = endOf(elbow.x, elbow.y, fore, 11.5);
  if (glow) {
    const big = glow === 2;
    g.fillStyle(C.blue, 0.18).fillCircle(fist.x, fist.y, big ? 13 : 10);
    g.fillStyle(C.blue, 0.3).fillCircle(fist.x, fist.y, big ? 9 : 7);
    g.fillStyle(C.blue).fillCircle(fist.x, fist.y, big ? 5.4 : 4.6);
    g.fillStyle(C.blueLight).fillCircle(fist.x + 0.8, fist.y - 1, big ? 3 : 2.4);
    g.fillStyle(0xffffff).fillCircle(fist.x + 1.2, fist.y - 1.5, 1.1);
  } else {
    g.fillStyle(C.glove).fillCircle(wrist.x, wrist.y, 3.2);
    g.fillCircle(fist.x, fist.y, 3.4);
    g.fillStyle(0x34343a).fillCircle(fist.x + 0.8, fist.y - 1, 1.1);
  }
  return fist;
}

function torso(g, hip, lean, breath) {
  g.save();
  g.translateCanvas(hip.x, hip.y);
  g.rotateCanvas(rad(lean));
  const b = breath;
  // 몸통 (넓은 가슴, 좁은 허리)
  g.fillStyle(C.suit).fillPoints(
    [
      { x: -6, y: 0 }, { x: 6.5, y: 0 }, { x: 9, y: -9 }, { x: 10.5, y: -15 - b }, { x: 7.5, y: -19 - b },
      { x: -6.5, y: -19 - b }, { x: -9, y: -15 - b }, { x: -7.5, y: -8 },
    ],
    true,
  );
  // 가슴 근육과 복근
  g.fillStyle(C.light).fillEllipse(4.5, -13.5 - b, 8, 4.5);
  g.fillStyle(C.light).fillEllipse(-1.5, -13.5 - b, 6, 4);
  g.fillStyle(C.shade);
  for (let i = 0; i < 3; i++) g.fillRect(-0.5, -9.5 + i * 3, 6, 0.8);
  g.fillRect(2.4, -10, 0.8, 9);
  // 옆구리 노란 줄
  g.fillStyle(C.gold).fillPoints(
    [{ x: 6, y: -1 }, { x: 8, y: -1 }, { x: 10, y: -12 - b }, { x: 9.5, y: -16 - b }, { x: 8.2, y: -12 }],
    true,
  );
  g.fillStyle(C.goldBack).fillPoints([{ x: -6.5, y: -2 }, { x: -5, y: -2 }, { x: -8, y: -14 - b }, { x: -9, y: -12 }], true);
  // 반바지 허리 + 노란 끈
  g.fillStyle(C.shorts).fillRoundedRect(-7.5, -2.5, 15.5, 6, 2);
  g.fillStyle(0x26262b).fillRect(-7.5, -2.5, 15.5, 1.2);
  g.fillStyle(C.gold).fillRect(3.2, -1.4, 0.9, 3.4).fillRect(4.8, -1.4, 0.9, 3).fillCircle(3.6, 2.2, 0.8).fillCircle(5.2, 1.8, 0.8);
  g.restore();
}

function head(g, x, y, tilt) {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(rad(tilt));
  // 목
  g.fillStyle(C.suitBack).fillRect(-2.5, 3, 5.5, 5);
  // 뒷머리
  g.fillStyle(C.hairDark).fillCircle(-1.5, -2, 6.6);
  // 방독면 얼굴
  g.fillStyle(C.mask).fillEllipse(1.2, 0.8, 11.5, 12.5);
  // 큰 눈알 렌즈 2개 (뒤쪽은 조금 작게)
  g.fillStyle(C.lensRing).fillCircle(0, -0.8, 2.7);
  g.fillStyle(0xcfd5da).fillCircle(0, -0.8, 1.9);
  g.fillStyle(C.lensRing).fillCircle(4.4, -0.6, 3.3);
  g.fillStyle(C.lens).fillCircle(4.4, -0.6, 2.5);
  g.fillStyle(0xffffff).fillCircle(5.1, -1.5, 0.9);
  // 노란 필터 통 (입 앞, 볼 옆)
  g.fillStyle(C.gold).fillCircle(5.6, 4.4, 2.6);
  g.fillStyle(0x2a2a30).fillCircle(5.9, 4.4, 1.5);
  g.fillStyle(C.gold).fillCircle(6, 4.4, 0.6);
  g.fillStyle(C.goldBack).fillCircle(-1.6, 4.2, 2.1);
  // 헝클어진 머리 (삐죽삐죽)
  g.fillStyle(C.hair).fillEllipse(-0.5, -5.2, 13, 6);
  g.fillPoints(
    [
      { x: -7.5, y: -3 }, { x: -9.5, y: -6 }, { x: -6, y: -6.5 }, { x: -7, y: -10 }, { x: -3, y: -8 },
      { x: -2.5, y: -11.5 }, { x: 0.5, y: -8.5 }, { x: 3, y: -11 }, { x: 3.8, y: -7.8 }, { x: 7, y: -8.5 },
      { x: 6, y: -5.5 }, { x: 7.8, y: -3.8 }, { x: 4, y: -3.6 }, { x: 2.5, y: -2.4 }, { x: -1, y: -3.2 },
    ],
    true,
  );
  g.fillStyle(C.hairDark).fillTriangle(-4, -6, -1, -9, 0, -5).fillTriangle(1.5, -6, 4.5, -8.5, 4, -4.5);
  g.restore();
}

// 자세(pose) 하나를 그린다. 주먹 위치(프레임 안 좌표)를 돌려준다.
function drawHero(g, p) {
  const hip = { x: CX + (p.hipX || 0), y: HERO_FRAME.feetY - 26 + (p.hipY || 0) };
  const lean = p.lean || 0;
  const breath = p.breath || 0;
  const shoulderLen = 17 + breath;
  const sh = endOf(hip.x, hip.y, 180 - lean, shoulderLen);
  const backSh = { x: sh.x - 4, y: sh.y + 0.5 };
  const frontSh = { x: sh.x + 1.5, y: sh.y + 0.5 };
  const headPos = endOf(hip.x + 1, hip.y, 180 - lean * 1.1, shoulderLen + 9);

  if (p.trail) p.trail(g, hip);
  arm(g, backSh, p.backArm, true, p.glow === 'back' ? p.glowSize || 1 : 0);
  leg(g, { x: hip.x - 2, y: hip.y }, p.backLeg, true);
  torso(g, hip, lean, breath);
  leg(g, { x: hip.x + 2, y: hip.y }, p.frontLeg, false);
  head(g, headPos.x, headPos.y, (p.headTilt || 0) + lean * 0.3);
  const fist = arm(g, frontSh, p.frontArm, false, p.glow === 'front' ? p.glowSize || 1 : 0);
  return fist;
}

// 대시 때 뒤로 남는 파란 에너지 꼬리
const dashTrail = (shift) => (g, hip) => {
  for (let i = 0; i < 4; i++) {
    const y = hip.y - 22 + i * 7 + ((i + shift) % 2) * 2;
    const len = 22 + ((i * 7 + shift * 5) % 12);
    const x0 = hip.x - 4;
    g.fillStyle(C.blue, 0.35).fillTriangle(x0, y - 2.2, x0, y + 2.2, x0 - len, y);
    g.fillStyle(C.blueLight, 0.8).fillTriangle(x0, y - 1, x0, y + 1, x0 - len * 0.7, y);
  }
};

// 달리기 6장: 다리와 팔을 번갈아 휘두른다
function runPose(i) {
  const ph = (i / 6) * Math.PI * 2;
  const legAt = (phase) => {
    const s = Math.sin(phase);
    const thigh = 34 * s;
    const lift = Math.max(0, -Math.cos(phase)); // 뒤로 차올릴 때 무릎을 접는다
    const shin = thigh - 12 - 55 * lift * (s < 0.3 ? 1 : 0.4);
    return [thigh, shin, s < 0 ? -25 * lift : 0];
  };
  return {
    lean: 14,
    hipY: -1.5 * Math.abs(Math.cos(ph)) + 1,
    frontLeg: legAt(ph),
    backLeg: legAt(ph + Math.PI),
    frontArm: [-38 * Math.sin(ph) + 5, -38 * Math.sin(ph) + 85],
    backArm: [38 * Math.sin(ph) + 5, 38 * Math.sin(ph) + 85],
  };
}

const IDLE = { lean: 3, frontLeg: [8, 2], backLeg: [-8, -4], frontArm: [12, 40], backArm: [-6, 30] };

export const HERO_POSES = {
  idle0: { ...IDLE, breath: 0 },
  idle1: { ...IDLE, breath: 0.6, frontArm: [14, 44], backArm: [-4, 33] },
  idle2: { ...IDLE, breath: 1.1, frontArm: [15, 47], backArm: [-3, 35] },
  run0: runPose(0), run1: runPose(1), run2: runPose(2), run3: runPose(3), run4: runPose(4), run5: runPose(5),
  jump: { lean: 10, frontLeg: [65, 10, 10], backLeg: [-25, -60, -20], frontArm: [60, 100], backArm: [-55, -25] },
  fall: { lean: 4, frontLeg: [28, 8], backLeg: [-12, -30, -10], frontArm: [75, 110], backArm: [-75, -55] },
  dash0: {
    lean: 38, hipY: 1, frontLeg: [60, 5, 10], backLeg: [-55, -75, -30], frontArm: [75, 92], backArm: [-80, -88], trail: dashTrail(0),
  },
  dash1: {
    lean: 38, hipY: 1, frontLeg: [62, 8, 10], backLeg: [-55, -72, -30], frontArm: [78, 92], backArm: [-80, -85], trail: dashTrail(1),
  },
  charge0: { lean: 16, hipY: 1.5, frontLeg: [32, 4], backLeg: [-32, -12], frontArm: [-50, 40], backArm: [45, 120], glow: 'front' },
  charge1: { lean: 17, hipY: 2, frontLeg: [33, 4], backLeg: [-33, -12], frontArm: [-52, 38], backArm: [47, 122], glow: 'front', glowSize: 2 },
  punch: { lean: 20, frontLeg: [40, 8], backLeg: [-40, -30], frontArm: [88, 90], backArm: [-40, 45] },
  punchGlow: { lean: 22, frontLeg: [42, 8], backLeg: [-42, -30], frontArm: [88, 90], backArm: [-40, 45], glow: 'front', glowSize: 2 },
  upper: { lean: -6, hipY: -1, frontLeg: [14, 2], backLeg: [-16, -28], frontArm: [165, 172], backArm: [-35, 40], headTilt: -15 },
  upperGlow: { lean: -6, hipY: -1, frontLeg: [14, 2], backLeg: [-16, -28], frontArm: [165, 172], backArm: [-35, 40], headTilt: -15, glow: 'front', glowSize: 2 },
  hurt: { lean: -16, frontLeg: [15, 25], backLeg: [-22, -8], frontArm: [-60, -100], backArm: [50, 10], headTilt: -15 },
  slam: { lean: 30, hipY: 8, frontLeg: [72, -8, 0], backLeg: [-25, -95, -90], frontArm: [35, 10], backArm: [-60, -30], glow: 'front', glowSize: 2 },
};

// 동작 이름 → 프레임 목록과 빠르기
const ANIMS = {
  idle: { frames: ['idle0', 'idle1', 'idle2', 'idle1'], rate: 4, repeat: -1 },
  run: { frames: ['run0', 'run1', 'run2', 'run3', 'run4', 'run5'], rate: 13, repeat: -1 },
  jump: { frames: ['jump'] },
  fall: { frames: ['fall'] },
  dash: { frames: ['dash0', 'dash1'], rate: 20, repeat: -1 },
  charge: { frames: ['charge0', 'charge1'], rate: 8, repeat: -1 },
  punch: { frames: ['punch'] },
  punchGlow: { frames: ['punchGlow'] },
  upper: { frames: ['upper'] },
  upperGlow: { frames: ['upperGlow'] },
  hurt: { frames: ['hurt'] },
  slam: { frames: ['slam'] },
};
export const HERO_ANIMS = Object.keys(ANIMS);

// 자세별 주먹 위치 (스프라이트 기준점에서 얼마나 떨어졌는지, 오른쪽을 볼 때)
const fistAt = {};
export function heroFistOffset(pose) {
  return fistAt[pose] || { x: 14, y: -4 };
}

function drawFrame(scene, key, pose) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.scaleCanvas(S, S);
  const fist = drawHero(g, pose);
  g.generateTexture(key, HERO_FRAME.w * S, HERO_FRAME.h * S);
  g.destroy();
  return fist;
}

export function makeHeroTextures(scene) {
  // customArt 로 player 그림을 불러왔으면 그 그림 한 장을 모든 동작에 쓴다
  const custom = scene.textures.exists('player');
  scene.registry.set('heroCustomArt', custom);

  for (const [name, pose] of Object.entries(HERO_POSES)) {
    const fist = drawFrame(scene, `hero_${name}`, pose);
    if (fist) fistAt[name] = { x: fist.x - CX, y: fist.y - HERO_ORIGIN_Y * HERO_FRAME.h };
  }
  if (!custom) drawFrame(scene, 'player', HERO_POSES.idle0);

  for (const [name, a] of Object.entries(ANIMS)) {
    const key = `hero-${name}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: a.frames.map((f) => ({ key: `hero_${f}` })),
      frameRate: a.rate || 1,
      repeat: a.repeat ?? 0,
    });
  }

  // 파란 에너지탄
  make(scene, 'hero_ball', 48, 48, (g) => {
    g.fillStyle(C.blue, 0.2).fillCircle(24, 24, 24);
    g.fillStyle(C.blue, 0.45).fillCircle(24, 24, 18);
    g.fillStyle(0x5aa8ff).fillCircle(24, 24, 13);
    g.fillStyle(C.blueLight).fillCircle(25, 22, 8);
    g.fillStyle(0xffffff).fillCircle(26, 21, 4);
  });
}
