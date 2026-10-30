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
    airJumps: 1, // 공중에서 한 번 더 뛸 수 있는 횟수 (더블 점프). 0 이면 더블 점프 없음
    doubleJumpSpeed: 560, // 더블 점프 힘 (첫 점프보다 조금 약함)
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

  // ---------- 고를 수 있는 주인공 (모험 지도에서 고름) ----------
  // 쇼크 히어로는 위의 펀치, 충전, 대시, 궁극기 숫자를 그대로 쓴다.
  heroes: {
    // 번개 사수: 멀리서 쏘는 원거리형
    gunner: {
      healthMultiplier: 0.8, // 체력 배수 (0.8 = 쇼크 히어로의 80%)
      moveMultiplier: 1.05, // 걷는 속도 배수
      boltDamage: 5, // 번개탄 피해량 (짧게 눌렀다 떼기)
      boltKnockback: 90, // 번개탄이 미는 힘
      boltSpeed: 900, // 번개탄 속도
      boltDistance: 520, // 번개탄이 날아가는 거리
      boltSize: 24, // 번개탄 크기
      boltCooldown: 0.14, // 다음 번개탄까지 기다리는 시간 (작을수록 빠른 연사)
      beamMinDamage: 14, // 살짝 충전한 레이저 피해량
      beamMaxDamage: 34, // 최대 충전 레이저 피해량
      beamMinKnockback: 200, // 살짝 충전한 레이저가 미는 힘
      beamMaxKnockback: 520, // 최대 충전 레이저가 미는 힘
      beamLength: 640, // 레이저 길이
      beamMinWidth: 16, // 살짝 충전한 레이저 굵기
      beamMaxWidth: 48, // 최대 충전 레이저 굵기
      rainStrikes: 9, // 궁극기 번개비 줄기 수 (적이 더 많으면 적마다 하나씩)
    },
    // 강철 거인: 느리지만 세고 넓게 때리는 힘센형
    giant: {
      healthMultiplier: 1.5, // 체력 배수
      moveMultiplier: 0.82, // 걷는 속도 배수
      jumpMultiplier: 0.93, // 점프 힘 배수
      scale: 1.25, // 몸 크기 배수
      smashDamage: 16, // 망치 내려찍기 피해량 (방패도 깸)
      smashKnockback: 340, // 망치가 미는 힘
      smashRange: 92, // 망치가 닿는 거리
      smashHeight: 120, // 망치가 닿는 높이
      smashCooldown: 0.48, // 다음 망치까지 기다리는 시간
      upperDamage: 14, // 망치 올려치기 (위 + 공격) 피해량
      upperKnockback: 200, // 올려치기가 미는 힘
      upperWidth: 110, // 올려치기가 닿는 폭
      spinMinTime: 0.6, // 살짝 충전한 회오리가 도는 시간
      spinMaxTime: 1.6, // 최대 충전 회오리가 도는 시간
      spinTick: 0.16, // 회오리가 때리는 간격
      spinDamage: 6, // 회오리 한 번 피해량
      spinKnockback: 20, // 회오리가 미는 힘 (약해야 적이 회오리 안에 머물며 여러 번 맞음)
      spinRadius: 95, // 회오리 크기
      spinMoveMultiplier: 0.9, // 회오리 중 걷는 속도
      rushDamage: 14, // 몸통 박치기(대시) 피해량
      rushKnockback: 560, // 몸통 박치기가 미는 힘
      quakeShocks: 3, // 궁극기 대지진 흔들림 횟수 (첫 번째가 가장 셈)
    },
    // 바람 닌자: 빠르게 뛰어들어 베는 근접형
    ninja: {
      healthMultiplier: 0.85, // 체력 배수
      moveMultiplier: 1.2, // 걷는 속도 배수
      starDamage: 6, // 표창 피해량 (짧게 눌렀다 떼기)
      starKnockback: 80, // 표창이 미는 힘
      starSpeed: 1000, // 표창 속도
      starDistance: 300, // 표창이 날아가는 거리 (번개탄보다 짧음)
      starSize: 26, // 표창 크기
      starCooldown: 0.16, // 다음 표창까지 기다리는 시간
      slashMinDamage: 14, // 살짝 충전한 돌진 베기 피해량
      slashMaxDamage: 34, // 최대 충전 돌진 베기 피해량
      slashMinKnockback: 200, // 살짝 충전한 돌진 베기가 미는 힘
      slashMaxKnockback: 520, // 최대 충전 돌진 베기가 미는 힘
      slashSpeed: 1000, // 돌진 베기 속도
      slashMinTime: 0.16, // 살짝 충전한 돌진 베기가 이어지는 시간
      slashMaxTime: 0.36, // 최대 충전 돌진 베기가 이어지는 시간 (속도 x 시간 = 날아가는 거리)
      slashCooldown: 0.5, // 돌진 베기를 뗀 뒤 다음 공격까지 기다리는 시간
      slashInvincibleAfter: 0.12, // 돌진 베기가 끝나고도 공격을 피하는 시간
    },
    // 얼음 마법사: 멀리서 적을 느리게 만드는 조종형
    mage: {
      healthMultiplier: 0.9, // 체력 배수
      iceDamage: 7, // 얼음탄 피해량 (짧게 눌렀다 떼기)
      iceKnockback: 70, // 얼음탄이 미는 힘
      iceSpeed: 420, // 얼음탄 속도 (번개탄의 절반쯤으로 천천히 날아감)
      iceDistance: 480, // 얼음탄이 날아가는 거리
      iceSize: 28, // 얼음탄 크기
      iceCooldown: 0.3, // 다음 얼음탄까지 기다리는 시간
      frostMinDamage: 14, // 살짝 충전한 얼음 폭발 피해량
      frostMaxDamage: 32, // 최대 충전 얼음 폭발 피해량
      frostMinKnockback: 120, // 살짝 충전한 얼음 폭발이 미는 힘
      frostMaxKnockback: 300, // 최대 충전 얼음 폭발이 미는 힘 (약해야 느려진 적이 가까이 남음)
      frostReach: 220, // 얼음 폭발이 터지는 거리 (주인공에서 폭발 한가운데까지)
      frostMinRadius: 60, // 살짝 충전한 얼음 폭발 크기
      frostMaxRadius: 120, // 최대 충전 얼음 폭발 크기
      frostCooldown: 0.4, // 얼음 폭발을 뗀 뒤 다음 공격까지 기다리는 시간
      slowMinTime: 1.5, // 살짝 충전한 얼음 폭발에 맞은 적이 느려지는 시간
      slowMaxTime: 3, // 최대 충전 얼음 폭발에 맞은 적이 느려지는 시간
      slowMultiplier: 0.45, // 얼음 폭발에 맞은 적의 속도 (0.45 = 평소의 45%)
      blizzardSlowTime: 4, // 궁극기 눈보라에 맞은 적이 느려지는 시간
      blizzardSlowMultiplier: 0.35, // 눈보라에 맞은 적의 속도
    },
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
    // 프로스 (아들 디자인 말벌): 하늘을 날다가 주인공에게 비스듬히 맹독을 쏨
    // 배를 앞으로 구부리고 보라색으로 빛나면 쏘기 직전. 독이 떨어진 곳에 독구름이 잠깐 남아요.
    // 독을 쏜 뒤 낮게 내려와 쉴 때 점프 펀치나 위쪽 공격으로 잡기
    fros: {
      healthMultiplier: 0.6,
      speedMultiplier: 1.2, // 따라오는 속도 (주인공보다는 느림)
      sizeMultiplier: 1.35, // 커다란 말벌
      xp: 35,
      hoverY: 290, // 떠 있는 높이 (250 ~ 340 사이만 됨, 땅은 480)
      preferDist: 170, // 주인공 옆으로 이만큼 떨어져서 비스듬히 쏨
      shootRange: 320, // 이 가로 거리 안이면 맹독을 쏨
      venomInterval: 3.0, // 맹독을 쏘는 간격
      venomWarningTime: 1.0, // 배가 보라색으로 빛나고 쏘기까지 시간 (피할 기회)
      venomLockTime: 0.35, // 쏘기 직전 조준이 멈추는 시간 (점선이 하얗게 깜빡이면 그 자리를 피하기)
      venomSpeed: 300, // 맹독이 날아가는 속도
      venomDamage: 10, // 맹독에 직접 맞으면 받는 피해
      cloudTime: 1.5, // 독구름이 남아 있는 시간
      cloudWidth: 100, // 독구름 너비 (대시 한 번으로 지나갈 수 있게)
      cloudHeight: 70, // 독구름 높이
      cloudDamage: 3, // 독구름 안에 있으면 한 번에 깎이는 체력
      cloudTickTime: 0.35, // 독구름 피해 간격
      tiredTime: 1.4, // 독을 쏜 뒤 낮게 내려와 쉬는 시간 (때릴 기회)
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

  // ---------- 혹한의 아스트라 (스테이지 4, 날아다니는 얼음 용, 아들 디자인) ----------
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
    breathWarningTime: 1.2, // 냉기 브레스 전 입이 빛나는 경고 시간
    breathTime: 1.5, // 냉기 브레스를 뿜는 시간
    breathConeNear: 50, // 용 몸 가운데에서 부채꼴이 바닥에 닿기 시작하는 거리 (그 안쪽, 용 밑은 안전)
    breathConeLength: 260, // 부채꼴이 바닥을 덮는 길이
    breathWaveDelay: 0.45, // 부채꼴 끝에 서리가 쌓였다가 달려 나가기까지 시간 (점프 준비 시간)
    breathSpeed: 420, // 부채꼴 끝에서 서리가 바닥을 달리는 속도
    breathDamage: 18, // 냉기 브레스 피해량 (한 번만 맞음)
    avalancheWarningTime: 0.95, // 빙천지락 얼음 가시가 솟기 전 바닥이 빛나는 시간
    avalancheGap: 140, // 얼음 가시 자리 간격 (번갈아 솟아서 틈이 생김)
    avalancheDamage: 18, // 얼음 가시 피해량
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

  // ---------- 스테이지 2 보스: 포레스트 와처 (아들이 디자인한 숲 괴물) ----------
  // 땅에 박힌 긴 팔을 때리고, 지쳐서 엎드렸을 때 등의 초록 독혹을 때려요.
  // 둘 다 부수면 엎드릴 때마다 머리(약점)가 낮게 내려와요.
  // 체력은 stage2.js 의 boss.healthScale 과 난이도를 곱해요.
  watcherBoss: {
    armHealth: 180, // 긴 팔 체력
    backHealth: 200, // 등 독혹 체력
    headHealth: 240, // 머리(약점) 체력
    idleTime: 0.9, // 공격과 공격 사이 쉬는 시간
    comboLength: 3, // 이만큼 공격하면 지쳐서 엎드림
    tiredTime: 3.2, // 엎드려 있는 시간 (때릴 기회). 이때 독 웅덩이도 마름
    clawWarningTime: 0.9, // 긴 팔 할퀴기 전 빨간 줄 경고 시간
    clawLength: 520, // 팔이 닿는 거리
    clawDamage: 18, // 할퀴기 피해량
    clawStuckTime: 1.6, // 팔이 땅에 박혀 있는 시간 (때릴 기회)
    burrowWarningTime: 1.2, // 땅속에 숨은 뒤 튀어나올 자리를 보여 주는 시간
    burstDamage: 22, // 튀어나올 때 피해량
    spitCount: 3, // 독 점액 개수 (화나면 1개 더)
    spitWarningTime: 0.6, // 독 점액 뱉기 전 경고 시간
    spitFlightTime: 0.8, // 독 점액이 날아가는 시간
    spitDamage: 10, // 독 점액 피해량
    puddleTime: 4, // 독 웅덩이가 남아 있는 시간
    puddleWidth: 90, // 독 웅덩이 너비
    puddleDamage: 4, // 독 웅덩이에 서 있으면 조금씩 깎이는 체력
    vineCount: 3, // 솟아나는 덩굴 개수 (화나면 1개 더)
    vineWarningTime: 1.0, // 덩굴이 솟기 전 잎사귀 경고 시간
    vineDamage: 9, // 덩굴에 잡힐 때 피해량
    vineHoldTime: 1.4, // 덩굴이 붙잡고 있는 시간 (대시로 바로 빠져나올 수 있음)
    crawlSpeed: 520, // 벽과 천장을 기어가는 속도
    dripCount: 3, // 천장에서 떨어뜨리는 독 방울 개수 (화나면 1개 더)
    chargedPunchHeadMultiplier: 1.5, // 충전 펀치로 머리를 치면 피해 배수
    partXp: 30, // 긴 팔이나 등 독혹을 부수면 얻는 경험치
  },

  // ---------- 스테이지 3 보스: 아스트라노바X (아들이 디자인한 붉은 용) ----------
  // 꼬리를 휘두른 뒤 땅에 떨어진 꼬리를, 날개가 축 처졌을 때 날개를 때려요.
  // 둘 다 부수면 공격이 끝날 때마다 헉헉거려요. 그때 크림색 배(약점)를 때려요.
  // 체력은 stage3.js 의 boss.healthScale 과 난이도를 곱해요.
  dragonBoss: {
    tailHealth: 170, // 꼬리 체력
    wingHealth: 190, // 날개 체력
    bellyHealth: 300, // 배(약점) 체력
    idleTime: 1.2, // 공격과 공격 사이 걸어 다니는 시간
    walkSpeed: 60, // 걷는 속도
    keepDistance: 280, // 주인공과 이만큼 떨어져 있으려고 함
    restTime: 2.4, // 배가 드러난 뒤 공격 끝나고 헉헉거리는 시간 (때릴 기회)
    breathWarningTime: 0.9, // 불 뿜기 전 경고 시간
    breathSpeed: 420, // 땅을 훑는 불길 속도
    breathDamage: 16, // 불길 피해량 (점프로 넘기)
    breathGap: 1.2, // 불길과 불길 사이 시간 (점프하고 내려올 시간)
    wingWarningTime: 0.9, // 날개 바람 전 경고 시간
    gustTime: 1.6, // 날개 바람이 부는 시간
    gustStrength: 170, // 바람이 미는 힘 (걷는 속도 260 보다 작아야 버틸 수 있음)
    wingDownTime: 2.6, // 날개가 축 처져 있는 시간 (때릴 기회)
    tailWarningTime: 0.9, // 꼬리 휘두르기 전 경고 시간
    tailDamage: 18, // 꼬리 피해량
    tailStuckTime: 1.8, // 꼬리가 땅에 떨어져 있는 시간 (때릴 기회)
    takeoffTime: 0.7, // 날아오르기 전 날갯짓 시간
    flyCrossTime: 1.8, // 하늘을 가로지르는 시간
    bombCount: 3, // 하늘에서 떨어뜨리는 불덩이 개수 (화나면 1개 더)
    bombDamage: 14, // 불덩이 피해량
    landDamage: 22, // 내려앉을 때 깔리면 피해량
    landWaveDamage: 12, // 내려앉을 때 충격파 피해량 (점프로 넘기)
    landWaveSpeed: 400, // 내려앉을 때 충격파 속도
    landWaveDistance: 360, // 내려앉을 때 충격파가 가는 거리
    pillarWarningTime: 0.9, // 불기둥이 솟기 전 바닥이 빛나는 시간
    pillarWaveGap: 0.1, // 첫 불기둥 묶음이 솟고 나서 다음 묶음이 빛나기까지 시간
    pillarSpacing: 120, // 불기둥 자리 간격
    pillarDamage: 18, // 불기둥 피해량
    fireballFlightTime: 1.0, // 겹치기 공격 불덩이가 날아가는 시간
    fireTime: 2.5, // 불덩이가 떨어진 바닥이 뜨거운 시간
    fireDamage: 5, // 뜨거운 바닥에 서 있으면 깎이는 체력
    chargedPunchBellyMultiplier: 1.5, // 충전 펀치로 배를 치면 피해 배수
    partXp: 30, // 꼬리나 날개를 부수면 얻는 경험치
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
  // 경험치는 몬스터와 보스를 쓰러뜨려야 얻어요. 보물은 경험치 대신 특별한 힘을 줘요.
  level: {
    firstLevelXp: 50, // 레벨 2가 되는 데 필요한 경험치
    xpGrowth: 1.4, // 다음 레벨은 필요 경험치가 이 배수만큼 늘어남
    healthPerLevel: 10, // 레벨이 오를 때 늘어나는 최대 체력 (공격력은 레벨 업 카드에서 골라요)
  },

  // ---------- 레벨 업 카드 (레벨이 오를 때마다 하나 골라요) ----------
  upgrades: {
    maxRank: 5, // 카드 하나를 올릴 수 있는 최고 레벨
    attackPerRank: 0.12, // 공격력: 한 번 고를 때마다 늘어나는 피해 (0.12 = 12%)
    defensePerRank: 0.08, // 방어력: 한 번 고를 때마다 줄어드는 받는 피해 (0.08 = 8%)
    speedPerRank: 0.07, // 속도: 한 번 고를 때마다 빨라지는 걷기 속도 (0.07 = 7%)
    dashCooldownPerRank: 0.08, // 속도: 한 번 고를 때마다 줄어드는 대시 쿨다운 (0.08 = 8%)
  },

  // ---------- 로봇 볼트 능력 (레벨 업 카드 '로봇 볼트') ----------
  // zapInterval: 레이저를 쏘는 간격(초), zapDamage: 레이저 피해량, zapTargets: 한 번에 맞히는 적 수
  robot: {
    lv1: { zapInterval: 3.0, zapDamage: 8, zapTargets: 1 },
    lv2: { zapInterval: 2.5, zapDamage: 11, zapTargets: 1 },
    lv3: { zapInterval: 2.0, zapDamage: 14, zapTargets: 2 },
    lv4: { zapInterval: 1.6, zapDamage: 17, zapTargets: 2 },
    lv5: { zapInterval: 1.3, zapDamage: 20, zapTargets: 3 },
    zapRange: 420, // 이 거리 안의 적만 노려요
    zapKnockback: 60, // 레이저가 미는 힘 (작게)
    healFromRank: 4, // 이 레벨부터 볼트가 가끔 체력을 채워 줘요
    healEvery: 12, // 체력을 채워 주는 간격 (초)
    healAmount: 10, // 한 번에 채워 주는 체력
    guardFromRank: 5, // 이 레벨부터 볼트 방패가 가끔 공격 한 번을 막아 줘요
    guardEvery: 15, // 볼트 방패가 다시 생기는 시간 (초)
  },

  // ---------- 보물 상자의 특별한 힘 (잠깐 동안만) ----------
  // 스테이지 파일 보물에 power: 'speed' 처럼 쓰면 그 힘이 나오고, 안 쓰면 아무거나 나와요.
  powers: {
    speed: { time: 12, moveMultiplier: 1.5, dashCooldownMultiplier: 0.5 }, // 번개 신발: 엄청 빨라지고 대시를 자주 써요
    shield: { time: 20, amount: 60 }, // 강철 몸: 체력바 위에 60만큼 방패가 생겨요 (다 깨지거나 시간이 끝나면 사라짐)
    power: { time: 12, damageMultiplier: 1.6 }, // 파워 장갑: 모든 공격이 1.6배 아파요
    star: { time: 6, touchDamage: 14, touchEvery: 0.25 }, // 무적 별: 아무것도 아프지 않고, 닿는 적이 다쳐요
    rapid: { time: 10, shotDamageMultiplier: 0.5 }, // 에너지 연사: 펀치할 때마다 파란 에너지탄이 나가요 (에너지탄 피해의 절반)
  },

  // ---------- 보석 (보물과 별로 모아서 상점에서 써요) ----------
  gems: {
    treasure: 2, // 보물을 처음 찾으면
    clear: 1, // 스테이지를 깰 때마다 (다시 깨도)
    star: 3, // 별을 처음 받으면 (별 하나마다)
    dexMonster: 1, // 도감에 새 몬스터가 등록되면
    dexBoss: 3, // 도감에 새 보스가 등록되면
    rushClear: 5, // 보스 러시 코스를 처음 끝까지 깨면
    daily: 3, // 오늘의 도전을 그날 처음 깨면
  },

  // ---------- 보스 러시 (보스 다섯 마리 연달아) ----------
  rush: {
    healBetween: 0.35, // 다음 보스로 넘어갈 때 최대 체력의 이만큼 회복
    nextDelay: 1.6, // 보스를 쓰러뜨리고 다음 보스까지 기다리는 초
  },

  // ---------- 상점 (보석으로 사는 영구 강화) ----------
  // prices: 단계마다 값 (개수 = 살 수 있는 단계 수)
  shop: {
    hp: { perRank: 20, prices: [8, 14, 20] }, // 튼튼한 몸: 최대 체력 +20
    heart: { chancePerRank: 0.1, healPerRank: 5, prices: [6, 12] }, // 하트 행운: 하트가 더 자주, 더 많이 채움
    powerTime: { perRank: 0.25, prices: [8, 14] }, // 오래가는 힘: 보물 힘 시간 +25%
    startShield: { prices: [12] }, // 출발 방패: 스테이지를 시작할 때 강철 몸
    ultStart: { gauge: 0.5, prices: [15] }, // 궁극기 반 충전: 궁극기 게이지 절반을 채우고 시작
    tripleJump: { prices: [25] }, // 트리플 점프: 공중에서 한 번 더 (모두 세 번 점프)
  },

  // ---------- 함께하기 (친구와 둘이서) ----------
  coop: {
    reviveTime: 5, // 한 명이 쓰러지면 몇 초 뒤 친구 옆에서 다시 일어난다 (둘 다 쓰러지면 실패)
    reviveHealth: 0.5, // 다시 일어날 때 체력 (최대 체력의 몇 배)
    maxSpread: 820, // 두 사람이 이보다 멀어지지 못한다 (화면 너비 960 안에 둘 다 보이게, 양쪽 여유 70)
  },

  // ---------- 겨루기 (친구와 서로 대결) ----------
  versus: {
    winsNeeded: 3, // 먼저 몇 판을 이기면 우승인지 (3 = 5 판 3 선승)
    roundTime: 60, // 한 판 제한 시간 (초). 끝나면 남은 체력 비율이 높은 쪽이 이긴다
    countdown: 3, // 판이 시작하기 전 카운트다운 (초)
    roundEndPause: 2, // 승자를 보여 주는 시간 (초)
    ultCap: 0.35, // 궁극기 한 방 피해의 한계 (상대 최대 체력의 몇 배)
    ultGaugeBoost: 3, // 궁극기 게이지가 모험보다 몇 배 빨리 찬다 (한 판이 짧아서)
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
