// =============================================================
//  게임 숫자 설정 파일
//  여기 숫자를 바꾸고 저장하면 게임이 바로 바뀝니다.
//  (npm run dev 로 켜 둔 상태라면 브라우저가 알아서 새로고침돼요)
//
//  규칙: 숫자만 바꾸세요. 쉼표(,)와 중괄호({ })는 지우지 마세요.
//  시간은 모두 "초" 단위입니다. 1.5 는 1초 반이에요.
// =============================================================

export const balance = {
  // ---------- 주인공 ----------
  player: {
    maxHealth: 100, // 처음 체력
    moveSpeed: 260, // 걷는 속도
    jumpSpeed: 640, // 점프 힘 (클수록 높이 뜀)
    hurtInvincibleTime: 0.8, // 맞은 뒤 깜빡이며 무적인 시간
    hurtKnockback: 260, // 맞았을 때 뒤로 밀리는 힘
  },

  // ---------- 기본 펀치 (짧게 눌렀다 떼기) ----------
  punch: {
    damage: 8, // 피해량
    knockback: 140, // 적을 미는 힘
    range: 60, // 주먹이 닿는 거리
    cooldown: 0.22, // 다음 공격까지 기다리는 시간
  },

  // ---------- 충전 펀치 (꾹 눌렀다 떼기) ----------
  charge: {
    minTime: 0.2, // 이 시간보다 오래 누르면 충전 펀치가 됨
    fullTime: 1.2, // 이 시간만큼 누르면 최대 충전
    minDamage: 15, // 살짝 충전했을 때 피해량
    maxDamage: 40, // 최대 충전 피해량
    minKnockback: 260, // 살짝 충전했을 때 미는 힘
    maxKnockback: 700, // 최대 충전 미는 힘
    range: 85, // 충전 펀치가 닿는 거리
    moveSpeedMultiplier: 0.4, // 충전 중 걷는 속도 (0.4 = 평소의 40%)
  },

  // ---------- 대시 (빠르게 피하기) ----------
  dash: {
    speed: 720, // 대시 속도
    duration: 0.18, // 대시가 이어지는 시간
    invincibleTime: 0.35, // 대시 중 공격을 피하는 무적 시간
    cooldown: 0.7, // 다음 대시까지 기다리는 시간
  },

  // ---------- 초록 몬스터 ----------
  monster: {
    maxHealth: 30, // 체력
    moveSpeed: 90, // 쫓아오는 속도
    damage: 12, // 공격 피해량
    sightRange: 380, // 이만큼 가까워지면 쫓아옴
    attackRange: 70, // 이만큼 가까워지면 공격 준비
    windupTime: 0.55, // 빨개진 뒤 공격하기까지 시간 (피할 기회)
    attackTime: 0.2, // 달려드는 시간
    lungeSpeed: 380, // 달려드는 속도
    recoverTime: 0.8, // 공격 뒤 멍하게 있는 시간 (때릴 기회)
    downKnockback: 450, // 이 힘 이상으로 맞으면 쓰러짐
    xp: 20, // 처치하면 얻는 경험치
  },

  // ---------- 몬스터 종류 (기본 몬스터 숫자에 곱하는 배수) ----------
  // 예: speedMultiplier 1.8 = 기본 몬스터보다 1.8배 빠름
  monsterTypes: {
    // 빨강 날쌘돌이: 빠르고 약함
    fast: {
      healthMultiplier: 0.7,
      speedMultiplier: 1.8,
      damageMultiplier: 0.8,
      windupMultiplier: 0.75, // 공격 신호가 짧음
      sizeMultiplier: 0.85,
      xp: 25,
    },
    // 파랑 뚱보: 느리지만 튼튼하고 아픔
    tank: {
      healthMultiplier: 2.6,
      speedMultiplier: 0.6,
      damageMultiplier: 1.6,
      windupMultiplier: 1.25,
      downKnockbackMultiplier: 1.5, // 잘 안 넘어짐
      sizeMultiplier: 1.4,
      xp: 45,
    },
    // 보라 뜀뛰기: 점프해서 덮침
    jumper: {
      healthMultiplier: 1.0,
      speedMultiplier: 1.1,
      damageMultiplier: 1.1,
      windupMultiplier: 1.0,
      sizeMultiplier: 1.0,
      xp: 30,
    },
  },

  // ---------- 보스 (모든 스테이지 공통 기본값) ----------
  // 스테이지마다 stageN.js 의 boss.healthScale 을 곱해서 더 튼튼해집니다.
  boss: {
    armHealth: 120, // 팔 하나의 체력
    coreHealth: 200, // 약점(코어) 체력
    idleTime: 1.0, // 공격과 공격 사이 쉬는 시간
    slamWarningTime: 1.0, // 내려찍기 전 빨간 경고 시간
    slamDamage: 22, // 내려찍기 피해량
    armRestTime: 1.7, // 찍은 뒤 팔이 바닥에 머무는 시간 (때릴 기회)
    multiSlamCount: 3, // 연속 내려찍기 횟수
    multiSlamWarningTime: 0.6, // 연속 내려찍기 한 번마다 경고 시간
    doubleSlamWarningTime: 1.1, // 두 팔 동시 내려찍기 경고 시간
    sweepWarningTime: 1.0, // 바닥 쓸기 전 경고 시간
    sweepTime: 0.8, // 바닥 쓸기에 걸리는 시간
    sweepDamage: 18, // 바닥 쓸기 피해량
    rockWarningTime: 0.9, // 돌 떨어지기 전 그림자 경고 시간
    rockDamage: 14, // 돌 피해량
    rockCount: 3, // 한 번에 떨어지는 돌 개수
    shockwaveWarningTime: 0.8, // 땅 울림 전 경고 시간
    shockwaveSpeed: 430, // 충격파가 바닥을 달리는 속도
    shockwaveDamage: 16, // 충격파 피해량
    spitCount: 3, // 독침 개수
    spitWarningTime: 0.5, // 독침 뱉기 전 경고 시간
    spitFlightTime: 0.8, // 독침이 날아가는 시간
    spitDamage: 12, // 독침 피해량
    chargedPunchCoreMultiplier: 1.5, // 충전 펀치로 코어를 치면 피해 배수
    armXp: 30, // 팔 하나 부수면 얻는 경험치
    xp: 200, // 보스를 쓰러뜨리면 얻는 경험치
  },

  // ---------- 레벨 ----------
  level: {
    firstLevelXp: 50, // 레벨 2가 되는 데 필요한 경험치
    xpGrowth: 1.5, // 다음 레벨은 필요 경험치가 이 배수만큼 늘어남
    healthPerLevel: 10, // 레벨이 오를 때 늘어나는 최대 체력
    damageBonusPerLevel: 0.1, // 레벨이 오를 때 늘어나는 공격력 (0.1 = 10%)
  },

  // ---------- 세상 ----------
  world: {
    gravity: 1500, // 중력 (클수록 빨리 떨어짐)
  },

  // ---------- 효과 ----------
  effects: {
    screenShake: true, // 화면 흔들림 (true = 켜기, false = 끄기)
    slowMotionScale: 0.25, // 보스 최후의 일격 슬로모션 속도 (0.25 = 4배 느리게)
    slowMotionTime: 1.2, // 슬로모션이 이어지는 시간
  },
};
