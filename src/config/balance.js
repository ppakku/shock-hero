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
    heartDropChance: 0.35, // 쓰러질 때 하트를 떨어뜨릴 확률 (0.35 = 35%)
    heartHeal: 20, // 하트를 먹으면 채워지는 체력
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
    rocketPunchWarningTime: 1.2, // 주먹 발사 전 팔을 뒤로 당기는 시간 (경고)
    rocketPunchSpeed: 700, // 날아가는 주먹 속도
    rocketPunchDamage: 18, // 주먹 발사 피해량
    rocketPunchStuckTime: 1.8, // 벽에 박힌 주먹을 때릴 수 있는 시간
    inhaleWarningTime: 1.0, // 빨아들이기 전 경고 시간
    inhaleTime: 2.6, // 빨아들이는 시간
    inhalePull: 150, // 끌려가는 속도 (걷는 속도 260 보다 작아야 도망칠 수 있어요)
    inhaleBiteDamage: 20, // 입까지 끌려가면 깨물리는 피해량
    rageAt: 0.5, // 코어 체력이 이 비율 아래면 분노 모드 (0.5 = 절반)
    rageSpeed: 0.8, // 분노하면 공격 시간에 곱하는 값 (작을수록 빠름)
    rageChainGap: 0.3, // 분노 때 공격 두 개를 이어서 할 때 사이 시간
  },

  // ---------- 얼음 돌연변이 (스테이지 4, 날아다니는 보스) ----------
  // 스테이지 파일의 boss.healthScale 을 체력에 곱합니다.
  iceBoss: {
    wingHealth: 150, // 날개 하나의 체력
    heartHealth: 320, // 얼음 심장(약점) 체력. 날개를 다 부숴야 맞아요
    flySpeed: 280, // 하늘을 나는 속도
    idleTime: 0.9, // 공격과 공격 사이 쉬는 시간
    tiredAfter: 3, // 공격을 이만큼 하면 지쳐서 땅에 내려와요
    restTime: 3.2, // 땅에서 헉헉대며 쉬는 시간 (때릴 기회)
    hoverTime: 1.8, // 급강하 뒤 낮게 떠 있는 시간 (점프 펀치, 위쪽 공격 기회)
    icicleCount: 4, // 고드름 개수
    icicleWarningTime: 1.0, // 고드름 떨어지기 전 그림자 경고 시간
    icicleDamage: 14, // 고드름 피해량
    diveWarningTime: 1.1, // 급강하 전 경고 시간
    diveTime: 1.0, // 급강하로 싸움터를 가로지르는 시간
    diveDamage: 20, // 급강하 피해량
    breathWarningTime: 1.0, // 얼음 숨결 전 경고 시간
    breathSpeed: 400, // 얼음 숨결이 바닥을 달리는 속도
    breathDamage: 16, // 얼음 숨결 피해량
    hopWarningTime: 0.9, // 날개가 부서진 뒤 뛰어올라 내려찍기 경고 시간
    hopDamage: 20, // 뛰어 내려찍기 피해량
    rageAt: 0.5, // 전체 체력이 이 비율 아래면 분노 모드
  },

  // ---------- 킹 돌연변이 (스테이지 5, 마지막 보스) ----------
  // 팔과 코어 체력은 위 boss 숫자를 같이 써요.
  kingBoss: {
    summonMax: 2, // 한 번에 살아 있을 수 있는 부하 수
    summonWarningTime: 1.0, // 부하가 나오기 전 보라색 구멍 경고 시간
    leapWarningTime: 0.9, // 일어선 왕이 뛰어올라 내려찍기 전 경고 시간
    leapDamage: 22, // 뛰어 내려찍기 피해량
    chargeWarningTime: 1.0, // 돌진 전 경고 시간
    chargeSpeed: 650, // 돌진 속도
    chargeDamage: 20, // 돌진 피해량
    tiredTime: 1.6, // 일어선 왕이 공격 뒤 숨 고르는 시간 (때릴 기회)
    coreMultiplier: 2.2, // 왕의 코어 체력 배수 (boss.coreHealth 에 곱함. 일어선 뒤 싸움이 길어져요)
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
