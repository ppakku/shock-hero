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

  // ---------- 궁극기 (L 키, 게이지가 꽉 찼을 때) ----------
  ultimate: {
    damage: 60, // 화면 안 몬스터에게 주는 피해
    bossDamage: 60, // 보스에게 주는 피해
    knockback: 600, // 몬스터를 날려 보내는 힘
    gaugePerDamage: 0.005, // 적에게 피해 1을 줄 때 차는 양 (1 이 되면 꽉 참. 0.005 면 피해 200)
    gaugePerHurt: 0.004, // 내가 피해 1을 받을 때 차는 양
    jumpSpeed: 760, // 하늘로 뛰어오르는 힘
    slamSpeed: 1300, // 땅으로 내려꽂는 속도
    slowMotionScale: 0.3, // 땅을 찍은 순간 느려지는 정도 (0.3 = 3배 느리게)
    slowMotionTime: 0.5, // 느린 화면이 이어지는 시간
    invincibleAfter: 0.8, // 궁극기가 끝나고도 무적인 시간
  },

  // ---------- 특수 기술 ----------
  skills: {
    upperDamage: 10, // 어퍼컷(W 나 ↑ + 펀치) 피해량
    upperKnockback: 160, // 어퍼컷이 미는 힘
    upperReach: 220, // 어퍼컷이 머리 위로 닿는 높이
    upperWidth: 80, // 어퍼컷이 닿는 폭
    shotDamage: 30, // 최대 충전 때 나가는 에너지탄 피해량
    shotKnockback: 420, // 에너지탄이 미는 힘
    shotSpeed: 760, // 에너지탄 속도
    shotDistance: 350, // 에너지탄이 날아가는 거리
    shotSize: 44, // 에너지탄 크기
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
    downKnockback: 450, // 이 힘 이상으로 맞으면 쓰러짐 (최대 충전 펀치는 700 이라 쓰러짐)
    knockbackScale: 0.6, // 펀치에 맞고 밀려나는 정도 (0.6 = 펀치 힘의 60% 만큼만 밀림)
    heroKnockback: 200, // 몬스터에게 맞은 주인공이 뒤로 밀려나는 힘
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
    // 노랑 폭탄벌레: 하늘을 날다가 주인공 위에서 폭탄을 떨어뜨림
    // 바닥에 빨간 원(그림자)이 생기면 거기로 폭탄이 떨어져요. 점프 펀치나 위쪽 공격으로 잡기
    bomber: {
      healthMultiplier: 0.6,
      speedMultiplier: 1.2, // 따라오는 속도 (주인공보다는 느림)
      sizeMultiplier: 1.0,
      xp: 35,
      hoverY: 290, // 떠 있는 높이 (250 ~ 340 사이만 됨, 땅은 480)
      bombInterval: 2.8, // 폭탄을 떨어뜨리는 간격
      bombWarningTime: 0.9, // 빨간 원이 보이고 폭탄이 떨어지기까지 시간 (피할 기회)
      bombFallTime: 0.35, // 폭탄이 떨어지는 데 걸리는 시간
      bombDamage: 14, // 폭탄 피해량
      bombRadius: 55, // 폭발 크기
      tiredTime: 1.3, // 폭탄을 떨어뜨린 뒤 낮게 내려와 쉬는 시간 (때릴 기회)
    },
    // 청록 침뱉기: 거리를 두고 느린 침을 뱉음. 점프로 넘거나 대시로 뚫기
    spitter: {
      healthMultiplier: 0.8,
      speedMultiplier: 0.9,
      sizeMultiplier: 1.0,
      xp: 35,
      keepAway: 220, // 주인공이 이만큼 가까우면 뒤로 물러남
      shootRange: 460, // 이 거리 안이면 침을 뱉음
      spitWindup: 0.8, // 볼이 부풀고 초록으로 깜빡인 뒤 뱉기까지 시간 (피할 기회)
      spitSpeed: 230, // 침이 날아가는 속도 (느릴수록 피하기 쉬움)
      spitDamage: 12, // 침 피해량
      spitCooldown: 2.2, // 다음 침까지 기다리는 시간
    },
    // 회색 방패병: 앞쪽 방패로 기본 펀치를 막음. 충전 펀치로 방패를 깨거나 뒤에서 때리기
    shield: {
      healthMultiplier: 1.5,
      speedMultiplier: 0.8,
      damageMultiplier: 1.2,
      windupMultiplier: 1.2,
      downKnockbackMultiplier: 1.2, // 최대 충전 펀치면 쓰러짐
      sizeMultiplier: 1.1,
      xp: 45,
      guardBreakTime: 3.0, // 방패가 깨진 뒤 다시 드는 데 걸리는 시간
      guardBreakStun: 1.0, // 방패가 깨지면 비틀거리는 시간
      turnDelay: 0.5, // 뒤로 돌아가면 방향을 바꾸기까지 걸리는 시간 (뒤를 칠 기회)
    },

    // ===== 수중 던전 (스테이지 6) 몬스터 =====
    // 금색 골드해파리 GX (아들 디자인): 둥둥 떠다니며 전기 독을 쏘고, 가까이 가면 빛나는 공으로 단단해짐
    // 단단할 때 맨손 펀치는 "팅!" 튕겨 나가요. 충전 펀치를 반 넘게 모아 때리면 깨져요
    jelly: {
      healthMultiplier: 1.3,
      speedMultiplier: 0.7, // 떠다니는 속도
      sizeMultiplier: 1.0,
      xp: 40,
      swimY: 330, // 떠 있는 기본 높이 (170 ~ 446 사이만 됨, 땅은 480)
      boltWindup: 0.9, // 보라 점선이 보이고 독을 쏘기까지 시간 (피할 기회)
      boltSpeed: 240, // 독 화살 속도
      boltDamage: 12, // 독 화살 피해량
      boltCooldown: 2.6, // 다음 독까지 기다리는 시간
      hardenRange: 130, // 주인공이 이만큼 가까우면 순간 경화
      hardenTime: 1.6, // 단단한 공으로 있는 시간
      hardenCooldown: 4.0, // 다음 경화까지 기다리는 시간
      tiredTime: 1.2, // 경화가 풀린 뒤 지쳐서 가라앉는 시간 (때릴 기회)
      breakRatio: 0.5, // 경화를 깨는 데 필요한 충전 (0.5 = 반 충전)
    },
    // 주황 가시복어 뿌뿌: 가까이 가면 가시 공으로 부풀어요. 가시가 섰을 때 맨손으로 때리면 내가 따끔!
    puffer: {
      healthMultiplier: 1.0,
      speedMultiplier: 0.7,
      sizeMultiplier: 1.0,
      xp: 35,
      swimY: 390,
      puffRange: 170, // 주인공이 이만큼 가까우면 부풀 준비
      inflateWarning: 0.7, // 부르르 떨며 빨개진 뒤 부풀기까지 시간 (피할 기회)
      spikyTime: 1.8, // 가시 공으로 있는 시간
      thornDamage: 8, // 가시 공을 맨손으로 때리면 내가 받는 피해
      bumpDamage: 12, // 가시 공에 부딪히면 받는 피해
      puffCooldown: 3.0, // 다음 부풀기까지 기다리는 시간
      dizzyTime: 1.4, // 바람이 빠진 뒤 어지러운 시간 (때릴 기회)
    },
    // 남색 이빨 피라냐: 작고 빠름. 빨간 점선을 따라 일직선으로 돌진해요
    piranha: {
      healthMultiplier: 0.6,
      speedMultiplier: 1.4,
      damageMultiplier: 0.9,
      sizeMultiplier: 0.9,
      xp: 25,
      swimY: 330,
      dartWindup: 0.75, // 빨간 점선이 보이고 돌진하기까지 시간 (피할 기회)
      dartSpeed: 520, // 돌진 속도
      dartTime: 0.5, // 돌진하는 시간 (점선 길이 = 속도 x 시간)
      dartCooldown: 2.0, // 다음 돌진까지 기다리는 시간
      dartRange: 320, // 이 거리 안이면 돌진 준비
      recoverTime: 0.9, // 돌진 뒤 숨 고르는 시간 (때릴 기회)
    },
    // 빨강 집게 꽃게: 바닥을 옆걸음으로 다니다가 집게로 꽉!
    crab: {
      healthMultiplier: 1.4,
      speedMultiplier: 0.9,
      damageMultiplier: 1.0,
      windupMultiplier: 1.1,
      downKnockbackMultiplier: 1.2,
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

  // ---------- 헤엄치기 (수중 스테이지, 스테이지 6) ----------
  // 점프를 누르면 위로 헤엄치고, 꾹 누르고 있으면 계속 올라가요. 떼면 천천히 가라앉아요.
  swim: {
    gravityScale: 0.3, // 물속 중력 (0.3 = 땅의 30%. 작을수록 천천히 가라앉음)
    maxFallSpeed: 210, // 가라앉는 가장 빠른 속도
    strokeSpeed: 330, // 점프 한 번에 위로 차고 오르는 힘
    strokeInterval: 0.3, // 점프를 꾹 누르면 이 간격마다 다시 헤엄쳐 올라감
    maxRiseSpeed: 380, // 위로 오르는 가장 빠른 속도
    moveMultiplier: 0.8, // 옆으로 헤엄치는 속도 (걷는 속도 260 에 곱함. 0.8 = 208)
    waterDrag: 7, // 물의 저항 (클수록 빨리 출발하고 빨리 멈춤)
    dashMultiplier: 0.8, // 헤엄 대시 속도 (대시 속도에 곱함)
    ceilingY: 150, // 이보다 위로는 못 올라감 (화면 위 체력바에 가리지 않게. 발판은 y 190 보다 낮게 두기)
  },

  // ---------- 심해 아귀왕 (스테이지 6, 물속 보스) ----------
  // 스테이지 파일의 boss.healthScale 을 체력에 곱합니다.
  seaBoss: {
    lureHealth: 200, // 머리 위 초롱불 체력 (부수면 먹물을 못 씀)
    jawHealth: 220, // 큰 턱 체력 (부수면 소용돌이 때 깨물지 못함)
    heartHealth: 420, // 심장(약점) 체력. 초롱불과 턱을 다 부숴야 맞아요
    swimSpeed: 200, // 헤엄치는 속도
    idleTime: 1.0, // 공격과 공격 사이 쉬는 시간
    tiredAfter: 3, // 공격을 이만큼 하면 지쳐서 바닥에 내려앉아요
    restTime: 3.0, // 바닥에서 헉헉대며 쉬는 시간 (때릴 기회)
    chargeWarningTime: 1.1, // 돌진 전 빨간 띠 경고 시간
    chargeSpeed: 620, // 돌진 속도
    chargeDamage: 20, // 돌진 피해량
    dizzyTime: 1.8, // 돌진하다 벽에 부딪혀 어지러운 시간 (때릴 기회)
    bubbleCount: 4, // 바닥에서 올라오는 거품 폭탄 개수
    bubbleWarningTime: 0.9, // 거품 폭탄이 올라오기 전 바닥 경고 시간
    bubbleRiseSpeed: 150, // 거품 폭탄이 올라가는 속도
    bubbleDamage: 12, // 거품 폭탄 피해량 (펀치로 미리 터뜨리면 안전)
    whirlWarningTime: 1.0, // 소용돌이 전 경고 시간
    whirlTime: 2.6, // 소용돌이가 빨아들이는 시간
    whirlPull: 130, // 끌려가는 속도 (헤엄 속도 208 보다 작아야 도망칠 수 있어요)
    whirlBiteDamage: 18, // 입까지 끌려가면 깨물리는 피해량
    inkTime: 4.0, // 먹물로 어두워지는 시간
    sweepWarningTime: 1.0, // 꼬리 휩쓸기 전 바닥 경고 시간
    sweepSpeed: 520, // 꼬리 휩쓸기 속도
    sweepDamage: 16, // 꼬리 휩쓸기 피해량
    sweepHeight: 100, // 꼬리가 휩쓰는 바닥 높이 (헤엄쳐 올라가서 피하기)
    rageAt: 0.5, // 전체 체력이 이 비율 아래면 분노 모드
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
