# 그림 바꾸기 계획 (Gemini 그림으로 코드 도형 바꾸기)

아이들과 Gemini 로 그림을 만들어 코드로 그린 임시 도형을 하나씩 바꿉니다.
받은 그림은 `public/art/` 에 넣고 `src/config/art.js` 에 연결합니다.

## 모든 프롬프트에 공통으로 붙이는 말

> 2D 사이드뷰 액션 게임용. 굵은 검은 외곽선의 셀 셰이딩 만화 그림체(지금까지 만든 아스트라노바X, 파쇄자, 포레스트 와처와 같은 그림체). 글자, 번호, 점선, 칸 테두리, 워터마크 없음.

- 캐릭터와 물체: "진짜 투명 배경 PNG". 체크무늬가 그려져 와도 지울 수 있으니 괜찮습니다.
- 불, 빛, 폭발, 전기 같은 효과: "완전한 검은 배경(#000000)". 게임에서 더하기 합성으로 그려 검은색이 사라지고 빛만 남습니다.
- 여러 장 동작: "가로 4칸 세로 2칸, 8장, 모든 칸 크기와 기준 위치가 같고 반복 재생되게 이어짐".

## 목록

상태: [ ] 아직, [x] 완료

### 1. 스테이지 3 용암 지대 마무리
- [x] 배경 파노라마, 보스전 배경, 바닥 타일, 아스트라노바X
- [x] 1-1 떠 있는 바위 발판 (`lava_platform.png`, 양 끝 고정 가운데 늘림)
- [x] 1-2 불덩이 (`fx_fireball.png`, 4x1 반복, 그림 준비됨, 효과 에이전트가 연결)
- [x] 1-3 폭발 (`fx_explosion.png`, 4x2 한 번, 그림 준비됨, 효과 에이전트가 연결)
- [x] 1-4 불기둥 (`fx_pillar.png`, 4x2 한 번, 그림 준비됨, 효과 에이전트가 연결)
- [x] 1-5 땅을 훑는 불 뿜기 (`fx_breath.png`, 4x2 반복, 그림 준비됨, 효과 에이전트가 연결)

### 2. 보스
- [x] 파쇄자 몸통, 포레스트 와처
- [x] 보스 몸통과 팔을 잇는 줄: 파쇄자 녹슨 쇠 파이프, 킹 돌연변이 근육 줄 (`boss_link_pipe.png`, `boss_link_muscle.png`, 가로로 이어 붙는 띠)
- [x] 2-1 파쇄자의 쇠팔과 주먹 (`shredder_arm.png`, `shredder_fist.png`, `tools/make_shredder_arm.py` 로 한 장에서 두 장 만듦)
- [x] 2-2 혹한의 아스트라 날갯짓 8장 (`frost_astra.png`, 머리가 오른쪽이라 `faces: 'right'`)
- [x] 2-3 킹 돌연변이 앉은 모습 8장, 일어선 모습 8장, 왕좌, 팔과 주먹 (`king_seated.png`, `king_stand.png`, `king_throne.png`, `king_arm.png`, `king_fist.png`, Gemini 웹, 그림이 오른쪽을 봄)
- [x] 2-4 심해 아귀왕 몸통, 아래턱, 초롱불, 심장, 거품 폭탄 (`boss_sea_*.png`, Gemini 웹, 왼쪽을 봄)
- [x] 2-5 혹한의 아스트라 얼음 심장, 고드름, 얼음 가시 (`ice_heart.png`, `ice_icicle.png`, `frost_spike.png`)
- [x] 2-6 포레스트 와처 독혹, 독 점액, 긴 팔, 손, 덩굴 (`watcher_blister.png`, `slime_glob.png`, `watcher_arm.png`, `watcher_claw.png`, `watcher_vine.png`)
- [x] 2-7 아스트라노바X 꼬리 휘두르기 (`dragon_tail.png`, `dragon_tailtip.png`)
- [x] 2-8 돌과 독침 (`rock.png`, `glob.png`). 팔 보스, 킹, 아귀왕이 같이 씀
- [x] 2-9 공격 효과 (`fx_shockwave`, `fx_rocket_trail`, `fx_whirl`, `fx_portal`, `fx_frost_cone`, `fx_frost_wall`, `fx_sand_wave`, `fx_star`, `fx_puddle_poison`, `fx_puddle_fire`). `src/fx/bossArt.js` 의 stamp() 로 그린다. 그림을 못 받으면 원래 도형이 나온다
- [ ] 2-10 엎드린 와처, 날개 늘어뜨린 용, 먹물 구름 (`watcher_flat_2`, `dragon_tired_3`, `fx_ink`, 코드는 준비됨, art.js 주석을 풀고 파일만 넣으면 됨. 지금은 시트를 눌러서, 먹물은 도형으로 보여 준다)

### 3. 일반 몬스터 (각각 4x2 걷기나 떠다니기 8장)
- [x] 초록 몬스터, 빨강 날쌘돌이, 파랑 뚱보, 보라 뜀뛰기 (`monster_green/red/blue/purple.png`, Gemini 웹, `tools/make_sheet.py`)
- [x] 방패병 걷기 8장, 방패 깨진 모습 8장, 날아가는 방패 조각 (`monster_shield.png`, `monster_shield_broken.png`, `monster_shield_piece.png`)
- [x] 침뱉기 (`monster_spitter.png` 걷기 8장, 조준, 뱉기, 침)
- [ ] 프로스, 골드해파리 GX (아들 디자인 기다리는 중, 주문서에 있음)
- [x] 가시복어 평소와 부푼 모습, 피라냐, 꽃게 (`monster_puffer.png`, `monster_puffer_big.png`, `monster_piranha.png`, `monster_crab.png`, Gemini 웹 한 장을 `tools/split_parts.py` 로 나눔)

### 4. 아이템과 아이콘
- [x] 보물 상자 닫힘, 열림 (`chest.png`, `chest_open.png`, `tools/split_parts.py`)
- [x] 하트, 체크포인트 깃발(꺼짐, 켜짐) (`heart.png`, `flag.png`, `flag_on.png`)
- [x] 특별한 힘 아이콘 5개, 레벨 업 카드 아이콘 4개 (`icon_pw_*.png`, `icon_up_*.png`, 80x80)
- [x] 로봇 볼트 (`robot.png`, 한 장)

### 5. 나머지 스테이지 (배경 파노라마, 보스전 배경, 바닥, 발판, 효과)
- [x] 스테이지 1 파괴된 도시 (`city_bg.jpg`, `city_arena.jpg`, `city_ground.png`, `city_platform.png`, Gemini 웹에서 만듦)
- [x] 스테이지 2 독 숲 (`forest_bg.jpg`, `forest_arena.jpg`, `forest_ground.png`, `forest_platform.png`)
- [x] 스테이지 4 얼음 산 (`ice_bg.jpg`, `ice_arena.jpg`, `ice_ground.png`, `ice_platform.png`)
- [x] 스테이지 5 괴물 성 (`castle_bg.jpg`, `castle_arena.jpg`, `castle_ground.png`, `castle_platform.png`, 배경은 Gemini 원본 다운로드 오류로 화면 크기 그림을 키움)
- [x] 스테이지 6 수중 던전 (아들 배경 + `sea_ground.png`, `sea_platform.png`)
- [x] 스테이지 7 고철 공장 (`factory_bg.jpg`, `factory_arena.jpg`, `factory_ground.png`, `factory_platform.png`)
- [ ] 새 주인공 번개 사수, 강철 거인 (아들 디자인 기다리는 중, 지금은 쇼크 히어로 몸에 색만 바꾼 임시 그림)
