// =============================================================
//  내가 그린 그림으로 바꾸기
//  1) 그림을 PNG 로 저장해서 public/art/ 폴더에 넣는다
//  2) 아래에서 바꾸고 싶은 줄 앞의 // 를 지우고 파일 이름을 맞춘다
//  그림 크기는 자동으로 맞춰지니 아무 크기나 괜찮아요.
//  (배경이 투명한 PNG 가 가장 예쁘게 나와요)
// =============================================================

export const customArt = {
  // player: 'player.png', // 주인공 (오른쪽을 보는 모습으로 그려 주세요)
  monster: { file: 'monster_green.png', cols: 4, rows: 2, frameRate: 8 }, // 초록 몬스터 (Gemini 그림, 8장 걷기, 오른쪽을 봄)
  monster_fast: { file: 'monster_red.png', cols: 4, rows: 2, frameRate: 14 }, // 빨강 날쌘돌이 (Gemini 그림, 8장 달리기, 오른쪽을 봄)
  monster_tank: { file: 'monster_blue.png', cols: 4, rows: 2, frameRate: 7 }, // 파랑 뚱보 (Gemini 그림, 8장 쿵쿵 걷기, 오른쪽을 봄)
  monster_jumper: { file: 'monster_purple.png', cols: 4, rows: 2, frameRate: 10 }, // 보라 뜀뛰기 (Gemini 그림, 8장 깡총 뛰기, 오른쪽을 봄)
  // 스테이지에 어울리는 생김새 (스테이지 theme.monsterSkins 로 고름, 움직임과 세기는 원래 몬스터 그대로)
  monster_lava_basic: { file: 'monster_lava_basic.png', cols: 4, rows: 2, frameRate: 8 }, // 용암 지대: 불꽃 슬라임 (Gemini 그림)
  monster_lava_tank: { file: 'monster_lava_tank.png', cols: 4, rows: 2, frameRate: 7 }, // 용암 지대: 마그마 뚱보 (Gemini 그림)
  monster_lava_jumper: { file: 'monster_lava_jumper.png', cols: 4, rows: 2, frameRate: 10 }, // 용암 지대: 불씨 뜀뛰기 (Gemini 그림)
  monster_ice_basic: { file: 'monster_ice_basic.png', cols: 4, rows: 2, frameRate: 8 }, // 얼음 산: 얼음 슬라임 (Gemini 그림)
  monster_ice_fast: { file: 'monster_ice_fast.png', cols: 4, rows: 2, frameRate: 14 }, // 얼음 산: 서리 도깨비 (Gemini 그림)
  monster_ice_tank: { file: 'monster_ice_tank.png', cols: 4, rows: 2, frameRate: 7 }, // 얼음 산: 설인 뚱보 (Gemini 그림)
  monster_ice_jumper: { file: 'monster_ice_jumper.png', cols: 4, rows: 2, frameRate: 10 }, // 얼음 산: 얼음 뜀뛰기 (Gemini 그림)
  monster_forest_fast: { file: 'monster_forest_fast.png', cols: 4, rows: 2, frameRate: 14 }, // 독 숲: 독버섯 날쌘돌이 (Gemini 그림)
  monster_forest_tank: { file: 'monster_forest_tank.png', cols: 4, rows: 2, frameRate: 7 }, // 독 숲: 이끼 뚱보 (Gemini 그림)
  // monster_fros: 'monster_fros.png', // 프로스 말벌 (오른쪽을 보는 모습, 날개 위로)
  // monster_fros_flap: 'monster_fros_flap.png', // 프로스 날개 아래로 (monster_fros 와 같은 크기로 그리면 날갯짓이 돼요)
  // monster_fros_aim: 'monster_fros_aim.png', // 프로스가 배를 앞으로 구부려 독을 쏘기 직전 (같은 크기로)
  // monster_venom: 'monster_venom.png', // 프로스의 맹독 (오른쪽으로 날아가는 모양)
  // monster_poison_puff: 'monster_poison_puff.png', // 독구름 한 덩이 (여러 개를 겹쳐 구름이 돼요)
  monster_spitter: { file: 'monster_spitter.png', cols: 4, rows: 2, frameRate: 6 }, // 청록 침뱉기 두꺼비 (Gemini 그림, 8장 숨쉬기, 오른쪽을 봄)
  monster_spitter_aim: 'monster_spitter_aim.png', // 침뱉기가 볼을 부풀려 조준 (걷기 시트 한 칸과 같은 크기)
  monster_spitter_spit: 'monster_spitter_spit.png', // 침뱉기가 침을 뱉는 순간 (걷기 시트 한 칸과 같은 크기)
  monster_spit: 'monster_spit.png', // 침뱉기의 침 (Gemini 그림, 오른쪽으로 날아가는 모양)
  monster_shield: { file: 'monster_shield.png', cols: 4, rows: 2, frameRate: 7 }, // 방패병 (Gemini 그림, 8장 걷기, 오른쪽을 봄, 방패가 오른쪽 앞)
  monster_shield_broken: { file: 'monster_shield_broken.png', cols: 4, rows: 2, frameRate: 12 }, // 방패가 깨진 방패병 (Gemini 그림, 8장 허둥지둥)
  monster_shield_piece: 'monster_shield_piece.png', // 날아가는 깨진 방패 (Gemini 그림)
  robot: 'robot.png', // 로봇 조수 볼트 (Gemini 그림, 앞을 봄)
  // boss_body_1: 'boss_body_1.png', // 스테이지 1 보스 몸통 (왼쪽을 보는 모습). 2~5 도 같은 식
  // boss_arm_1: 'boss_arm_1.png', // 스테이지 1 보스 팔 (주먹이 아래로). 2~5 도 같은 식
  // boss_fist_1: 'boss_fist_1.png', // 스테이지 1 보스가 날리는 주먹 (왼쪽을 보는 모습). 5 도 같은 식
  // boss_ice_body_4: 'boss_ice_body_4.png', // 혹한의 아스트라 몸통 (왼쪽을 보는 모습, 날개 없이, 220x170 비율. 머리 왼쪽 위, 꼬리 오른쪽 아래)
  // boss_ice_wing_4: 'boss_ice_wing_4.png', // 혹한의 아스트라 날개 하나 (오른쪽 날개, 붙는 곳이 왼쪽 아래, 170x130 비율, 반투명 얼음 막)
  astra_4: { file: 'frost_astra.png', cols: 4, rows: 2, frameRate: 8, faces: 'right' }, // 혹한의 아스트라 (아들 그림, 8장 날갯짓, 머리가 오른쪽이라 오른쪽을 봄). 있으면 위 몸통과 날개 대신 씀
  ice_heart: 'ice_heart.png', // 혹한의 아스트라 얼음 심장 (Gemini 그림, 약점, 가슴에 붙음)
  ice_icicle: 'ice_icicle.png', // 떨어지는 고드름 (Gemini 그림, 뾰족한 쪽이 아래)
  frost_spike: 'frost_spike.png', // 빙천지락 때 바닥에서 솟는 얼음 가시 (Gemini 그림, 아래쪽이 바닥, 80x120 비율)
  fx_frost_wall: 'fx_frost_wall.png', // 냉기 브레스 끝에서 바닥을 달리는 서리 벽 (Gemini 그림, 높은 앞쪽이 오른쪽)
  fx_frost_cone: 'fx_frost_cone.png', // 냉기 브레스 부채꼴 (Gemini 그림, 검은 배경, 뾰족한 위쪽이 입)
  watcher_2: { file: 'forest_watcher.png', cols: 4, rows: 2, frameRate: 8, faces: 'right' }, // 포레스트 와처 (아들 그림, 8장, 오른쪽을 봄)
  // watcher_flat_2: 'watcher_flat_2.png', // 지쳐서 엎드린 포레스트 와처 (왼쪽을 봄, 머리가 왼쪽). 넣으면 시트를 누르는 대신 이 그림을 쓴다
  watcher_blister: 'watcher_blister.png', // 와처 등의 초록 독혹 (Gemini 그림)
  slime_glob: 'slime_glob.png', // 와처가 뱉는 독 점액 (Gemini 그림)
  watcher_arm_2: 'watcher_arm.png', // 와처의 긴 팔 토막 (Gemini 그림, 가로로 길게, 팔꿈치 양쪽에 늘여 씀)
  watcher_claw_2: 'watcher_claw.png', // 와처의 할퀴는 손 (Gemini 그림, 손끝이 왼쪽, 오른쪽이 손목)
  watcher_vine_2: 'watcher_vine.png', // 땅에서 솟는 덩굴 (Gemini 그림, 아래쪽이 땅)
  fx_puddle_poison: 'fx_puddle_poison.png', // 독 웅덩이 (Gemini 그림, 가로로 늘여 씀)
  // 스프라이트 시트는 이렇게 적어요: { file: 파일 이름, cols: 가로 칸 수, rows: 세로 칸 수, frameRate: 1초에 몇 장 }
  // 그림이 오른쪽을 보고 있으면 faces: 'right' 를 더 적어요.
  fx_breath: { file: 'fx_breath.png', cols: 4, rows: 2, frameRate: 12 }, // 땅을 훑는 불 뿜기 (아들 그림, 8장 반복, 머리가 왼쪽, 바닥이 칸 맨 아래)
  fx_pillar: { file: 'fx_pillar.png', cols: 4, rows: 2, frameRate: 14, once: true }, // 용암 불기둥 (아들 그림, 8장 한 번, 칸 가운데 맨 아래가 땅)
  fx_explosion: { file: 'fx_explosion.png', cols: 4, rows: 2, frameRate: 16, once: true }, // 폭발 (아들 그림, 8장 한 번, 폭발 중심은 칸 가운데 아래)
  fx_fireball: { file: 'fx_fireball.png', cols: 4, rows: 1, frameRate: 12 }, // 불덩이 (아들 그림, 4장 반복, 왼쪽으로 날아가는 모양, 밝을수록 진함: 더하기 합성 추천)
  boss_arm_1: { file: 'shredder_arm.png', armCut: 130 }, // 파쇄자 쇠팔 (아들 그림, 주먹이 아래로). armCut: 210 높이 중 이 아래가 주먹이라 로켓 펀치 때 잘라 냄
  boss_fist_1: 'shredder_fist.png', // 파쇄자가 날리는 주먹 (아들 그림, 왼쪽을 봄)
  boss_link_1: 'boss_link_pipe.png', // 파쇄자 몸통과 팔을 잇는 녹슨 쇠 파이프 (Gemini 그림, 가로로 이어 붙는 띠)
  boss_body_1: { file: 'shredder.png', cols: 4, rows: 2, frameRate: 8, faces: 'right' }, // 스테이지 1 보스 파쇄자 (아들 그림, 8장, 오른쪽을 봄)
  boss_body_5: { file: 'king_seated.png', cols: 4, rows: 2, frameRate: 6, faces: 'right' }, // 킹 돌연변이 앉은 모습 (Gemini 그림, 8장 숨쉬기, 오른쪽을 봄)
  boss_king_stand_5: { file: 'king_stand.png', cols: 4, rows: 2, frameRate: 8, faces: 'right' }, // 킹 돌연변이 일어선 모습 (Gemini 그림, 8장 쿵쿵 걷기, 오른쪽을 봄)
  boss_throne_5: 'king_throne.png', // 킹 돌연변이 왕좌 (Gemini 그림)
  boss_arm_5: { file: 'king_arm.png', armCut: 139 }, // 킹 돌연변이 팔 (Gemini 그림, 주먹이 아래로). armCut: 금 팔찌 윗선, 이 아래가 주먹
  boss_fist_5: 'king_fist.png', // 킹 돌연변이가 날리는 주먹 (Gemini 그림, 왼쪽을 봄)
  boss_link_5: 'boss_link_muscle.png', // 킹 돌연변이 몸통과 팔을 잇는 근육 줄 (Gemini 그림, 가로로 이어 붙는 띠)
  boss_body_10: { file: 'emperor_seated.png', cols: 4, rows: 2, frameRate: 6, faces: 'right' }, // 그림자 황제 앉은 모습 (Gemini 그림, 8장 숨쉬기, 오른쪽을 봄)
  boss_king_stand_10: { file: 'emperor_stand.png', cols: 4, rows: 2, frameRate: 8, faces: 'right' }, // 그림자 황제 일어선 모습 (Gemini 그림, 8장 쿵쿵 걷기, 오른쪽을 봄)
  boss_throne_10: 'emperor_throne.png', // 그림자 황제 왕좌 (Gemini 그림, 검은 돌과 은빛 가시)
  boss_arm_10: { file: 'emperor_arm.png', armCut: 150 }, // 그림자 황제 팔 (Gemini 그림, 주먹이 아래로). armCut: 은 팔찌 윗선, 이 아래가 주먹
  boss_fist_10: 'emperor_fist.png', // 그림자 황제가 날리는 주먹 (Gemini 그림, 왼쪽을 봄)
  boss_link_10: 'boss_link_shadow.png', // 그림자 황제 몸통과 팔을 잇는 그림자 촉수 줄 (Gemini 그림, 가로로 이어 붙는 띠)
  dragon_3: { file: 'astranova.png', cols: 4, rows: 2, frameRate: 8 }, // 아스트라노바X (아들 그림, 8장 날갯짓, 왼쪽을 봄)
  // dragon_tired_3: 'dragon_tired_3.png', // 날개를 늘어뜨리고 쉬는 아스트라노바X (왼쪽을 봄). 넣으면 시트를 누르는 대신 이 그림을 쓴다
  dragon_tail_3: 'dragon_tail.png', // 꼬리 휘두르기 때 몸 쪽 꼬리 토막 (Gemini 그림, 가로로 길게)
  dragon_tailtip_3: 'dragon_tailtip.png', // 꼬리 끝 토막 (Gemini 그림, 끝이 왼쪽)
  fx_puddle_fire: 'fx_puddle_fire.png', // 뜨거운 용암 웅덩이 (Gemini 그림, 가로로 늘여 씀)
  // fireball: fx_fireball 시트가 있어서 쓰지 않는다 (fx_fireball 을 못 받았을 때만 나오는 임시 도형)
  boss_core: 'boss_core.png', // 보스 약점(코어) (Gemini 그림)
  boss_armor: 'boss_armor.png', // 코어를 덮은 장갑 (Gemini 그림)
  // ----- 수중 던전 (스테이지 6) -----
  // monster_jelly: 'monster_jelly.png', // 골드해파리 GX (오른쪽을 보는 모습, 촉수가 아래로)
  // monster_jelly_b: 'monster_jelly_b.png', // 골드해파리 촉수가 흔들린 두 번째 그림 (없으면 첫 그림과 같게 넣기)
  // monster_jelly_ball: 'monster_jelly_ball.png', // 순간 경화: 촉수를 말고 빛나는 공
  // monster_jelly_bolt: 'monster_jelly_bolt.png', // 골드해파리가 쏘는 전기 독 (오른쪽으로 날아가는 모양)
  monster_puffer: 'monster_puffer.png', // 가시복어 평소 모습 (Gemini 그림, 오른쪽을 봄)
  monster_puffer_big: 'monster_puffer_big.png', // 가시복어 부푼 모습 (Gemini 그림, 가시 공)
  monster_piranha: 'monster_piranha.png', // 이빨 피라냐 (Gemini 그림, 오른쪽을 봄)
  monster_crab: 'monster_crab.png', // 집게 꽃게 (Gemini 그림, 오른쪽을 봄)
  boss_sea_body_6: 'boss_sea_body.png', // 심해 아귀왕 몸통 (Gemini 그림, 왼쪽을 봄, 아래턱 없이, 250x160 비율)
  boss_sea_jaw_6: 'boss_sea_jaw.png', // 심해 아귀왕 아래턱 (Gemini 그림, 이빨이 위로, 붙는 곳이 오른쪽, 112x52 비율)
  boss_sea_lure: 'boss_sea_lure.png', // 심해 아귀왕 머리 위 초롱불 (Gemini 그림)
  boss_sea_heart: 'boss_sea_heart.png', // 심해 아귀왕 심장 (Gemini 그림, 약점)
  boss_sea_bubble: 'boss_sea_bubble.png', // 심해 아귀왕 거품 폭탄 (Gemini 그림)
  fx_sand_wave: 'fx_sand_wave.png', // 꼬리 휩쓸기 모래 파도 (Gemini 그림, 구름이 앞, 오른쪽으로 감, 아래쪽이 바닥)
  // fx_ink: 'fx_ink.png', // 먹물 구름
  rock: 'rock.png', // 떨어지는 돌 (Gemini 그림)
  glob: 'glob.png', // 독침 (Gemini 그림)
  // 보스들이 같이 쓰는 공격 효과 (Gemini 그림, 검은 배경이라 더하기 합성으로 그림, src/fx/bossArt.js)
  fx_shockwave: { file: 'fx_shockwave.png', cols: 4, rows: 1, frameRate: 14 }, // 땅을 달리는 충격파 (4장 반복, 불꽃 바닥이 칸 높이의 약 0.8)
  fx_rocket_trail: 'fx_rocket_trail.png', // 로켓 주먹 불꽃 꼬리 (왼쪽이 주먹 쪽)
  fx_whirl: 'fx_whirl.png', // 빨아들이기 소용돌이 (돌려서 씀)
  fx_portal: 'fx_portal.png', // 킹이 부하를 부르는 보라색 구멍
  fx_star: 'fx_star.png', // 어지러울 때 도는 별 (Gemini 그림, 투명 배경)
  // 특별한 힘 아이콘 5개와 레벨 업 카드 아이콘 4개 (Gemini 그림, 80x80 정사각형)
  pw_speed: 'icon_pw_speed.png', // 번개 신발
  pw_shield: 'icon_pw_shield.png', // 강철 몸
  pw_power: 'icon_pw_power.png', // 파워 장갑
  pw_star: 'icon_pw_star.png', // 무적 별
  pw_rapid: 'icon_pw_rapid.png', // 에너지 연사
  up_attack: 'icon_up_attack.png', // 레벨 업 카드: 공격력
  up_defense: 'icon_up_defense.png', // 레벨 업 카드: 방어력
  up_speed: 'icon_up_speed.png', // 레벨 업 카드: 속도
  up_robot: 'icon_up_robot.png', // 레벨 업 카드: 로봇 볼트
  heart: 'heart.png', // 체력 하트 (Gemini 그림)
  flag: 'flag.png', // 체크포인트 깃발, 꺼짐 (Gemini 그림, 깃대가 왼쪽에서 0.2 쯤)
  flag_on: 'flag_on.png', // 체크포인트 깃발, 켜짐 (Gemini 그림, flag 와 같은 크기, 깃대 자리도 같게)
  chest: 'chest.png', // 보물 상자 (Gemini 그림)
  chest_open: 'chest_open.png', // 열린 보물 상자 (Gemini 그림, 금화와 보석)
};
