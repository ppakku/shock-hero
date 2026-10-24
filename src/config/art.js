// =============================================================
//  내가 그린 그림으로 바꾸기
//  1) 그림을 PNG 로 저장해서 public/art/ 폴더에 넣는다
//  2) 아래에서 바꾸고 싶은 줄 앞의 // 를 지우고 파일 이름을 맞춘다
//  그림 크기는 자동으로 맞춰지니 아무 크기나 괜찮아요.
//  (배경이 투명한 PNG 가 가장 예쁘게 나와요)
// =============================================================

export const customArt = {
  // player: 'player.png', // 주인공 (오른쪽을 보는 모습으로 그려 주세요)
  // monster: 'monster.png', // 초록 몬스터 (오른쪽을 보는 모습)
  // monster_fast: 'monster_fast.png', // 빨강 날쌘돌이
  // monster_tank: 'monster_tank.png', // 파랑 뚱보
  // monster_jumper: 'monster_jumper.png', // 보라 뜀뛰기
  // monster_fros: 'monster_fros.png', // 프로스 말벌 (오른쪽을 보는 모습, 날개 위로)
  // monster_fros_flap: 'monster_fros_flap.png', // 프로스 날개 아래로 (monster_fros 와 같은 크기로 그리면 날갯짓이 돼요)
  // monster_fros_aim: 'monster_fros_aim.png', // 프로스가 배를 앞으로 구부려 독을 쏘기 직전 (같은 크기로)
  // monster_venom: 'monster_venom.png', // 프로스의 맹독 (오른쪽으로 날아가는 모양)
  // monster_poison_puff: 'monster_poison_puff.png', // 독구름 한 덩이 (여러 개를 겹쳐 구름이 돼요)
  // monster_spitter: 'monster_spitter.png', // 청록 침뱉기
  // monster_spit: 'monster_spit.png', // 침뱉기의 침 (오른쪽으로 날아가는 모양)
  // monster_shield: 'monster_shield.png', // 회색 방패병 (방패가 오른쪽 앞에 있게)
  // monster_shield_broken: 'monster_shield_broken.png', // 방패가 깨진 방패병
  // monster_shield_piece: 'monster_shield_piece.png', // 날아가는 방패 조각
  // robot: 'robot.png', // 로봇 조수 볼트
  // boss_body_1: 'boss_body_1.png', // 스테이지 1 보스 몸통 (왼쪽을 보는 모습). 2~5 도 같은 식
  // boss_arm_1: 'boss_arm_1.png', // 스테이지 1 보스 팔 (주먹이 아래로). 2~5 도 같은 식
  // boss_fist_1: 'boss_fist_1.png', // 스테이지 1 보스가 날리는 주먹 (왼쪽을 보는 모습). 5 도 같은 식
  // boss_ice_body_4: 'boss_ice_body_4.png', // 혹한의 아스트라 몸통 (왼쪽을 보는 모습, 날개 없이, 220x170 비율. 머리 왼쪽 위, 꼬리 오른쪽 아래)
  // boss_ice_wing_4: 'boss_ice_wing_4.png', // 혹한의 아스트라 날개 하나 (오른쪽 날개, 붙는 곳이 왼쪽 아래, 170x130 비율, 반투명 얼음 막)
  // ice_heart: 'ice_heart.png', // 혹한의 아스트라 얼음 심장 (약점, 가슴에 붙음)
  // ice_icicle: 'ice_icicle.png', // 떨어지는 고드름 (뾰족한 쪽이 아래)
  // frost_spike: 'frost_spike.png', // 빙천지락 때 바닥에서 솟는 얼음 가시 (아래쪽이 바닥, 80x120 비율)
  // boss_body_5: 'boss_body_5.png', // 킹 돌연변이 앉은 모습 (왼쪽을 보는 모습)
  // boss_king_stand_5: 'boss_king_stand_5.png', // 킹 돌연변이 일어선 모습 (왼쪽을 보는 모습)
  // boss_throne_5: 'boss_throne_5.png', // 킹 돌연변이 왕좌
  // watcher_2: 'watcher_2.png', // 포레스트 와처 (네 발로 기는 모습, 왼쪽을 봄)
  // watcher_flat_2: 'watcher_flat_2.png', // 지쳐서 엎드린 포레스트 와처
  // watcher_blister: 'watcher_blister.png', // 와처 등의 초록 독혹
  // slime_glob: 'slime_glob.png', // 와처가 뱉는 독 점액
  // dragon_3: 'dragon_3.png', // 아스트라노바X (서서 날개를 편 모습, 왼쪽을 봄)
  // dragon_tired_3: 'dragon_tired_3.png', // 날개를 늘어뜨리고 쉬는 아스트라노바X
  // fireball: 'fireball.png', // 용의 불덩이
  // boss_core: 'boss_core.png', // 보스 약점(코어)
  // boss_armor: 'boss_armor.png', // 코어를 덮은 장갑
  // ----- 수중 던전 (스테이지 6) -----
  // monster_jelly: 'monster_jelly.png', // 골드해파리 GX (오른쪽을 보는 모습, 촉수가 아래로)
  // monster_jelly_b: 'monster_jelly_b.png', // 골드해파리 촉수가 흔들린 두 번째 그림 (없으면 첫 그림과 같게 넣기)
  // monster_jelly_ball: 'monster_jelly_ball.png', // 순간 경화: 촉수를 말고 빛나는 공
  // monster_jelly_bolt: 'monster_jelly_bolt.png', // 골드해파리가 쏘는 전기 독 (오른쪽으로 날아가는 모양)
  // monster_puffer: 'monster_puffer.png', // 가시복어 평소 모습 (오른쪽을 보는 모습)
  // monster_puffer_big: 'monster_puffer_big.png', // 가시복어 부푼 모습 (가시 공)
  // monster_piranha: 'monster_piranha.png', // 이빨 피라냐 (오른쪽을 보는 모습)
  // monster_crab: 'monster_crab.png', // 집게 꽃게 (오른쪽을 보는 모습)
  // boss_sea_body_6: 'boss_sea_body_6.png', // 스테이지 6 보스 몸통 (왼쪽을 보는 모습, 아래턱 없이)
  // boss_sea_jaw_6: 'boss_sea_jaw_6.png', // 스테이지 6 보스 아래턱 (이빨이 위로, 붙는 곳이 오른쪽)
  // boss_sea_lure: 'boss_sea_lure.png', // 스테이지 6 보스 머리 위 초롱불
  // boss_sea_heart: 'boss_sea_heart.png', // 스테이지 6 보스 심장 (약점)
  // boss_sea_bubble: 'boss_sea_bubble.png', // 스테이지 6 보스 거품 폭탄
  // rock: 'rock.png', // 떨어지는 돌
  // glob: 'glob.png', // 독침
  // chest: 'chest.png', // 보물 상자
};
