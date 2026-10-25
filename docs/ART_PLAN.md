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
- [ ] 2-4 수중 보스 (아들 디자인 기다리는 중)

### 3. 일반 몬스터 (각각 4x2 걷기나 떠다니기 8장)
- [x] 초록 몬스터, 빨강 날쌘돌이, 파랑 뚱보, 보라 뜀뛰기 (`monster_green/red/blue/purple.png`, Gemini 웹, `tools/make_sheet.py`)
- [x] 방패병 걷기 8장, 방패 깨진 모습 8장, 날아가는 방패 조각 (`monster_shield.png`, `monster_shield_broken.png`, `monster_shield_piece.png`)
- [ ] 침뱉기, 프로스(아들 디자인), 골드해파리 GX(아들 디자인)
- [ ] 가시복어, 피라냐, 꽃게

### 4. 아이템과 아이콘
- [x] 보물 상자 닫힘, 열림 (`chest.png`, `chest_open.png`, `tools/split_parts.py`)
- [ ] 하트, 체크포인트 깃발(꺼짐, 켜짐)
- [ ] 특별한 힘 아이콘 5개, 레벨 업 카드 아이콘 4개
- [ ] 로봇 볼트 (떠다니기 4장)

### 5. 나머지 스테이지 (배경 파노라마, 보스전 배경, 바닥, 발판, 효과)
- [x] 스테이지 1 파괴된 도시 (`city_bg.jpg`, `city_arena.jpg`, `city_ground.png`, `city_platform.png`, Gemini 웹에서 만듦)
- [x] 스테이지 2 독 숲 (`forest_bg.jpg`, `forest_arena.jpg`, `forest_ground.png`, `forest_platform.png`)
- [x] 스테이지 4 얼음 산 (`ice_bg.jpg`, `ice_arena.jpg`, `ice_ground.png`, `ice_platform.png`)
- [x] 스테이지 5 괴물 성 (`castle_bg.jpg`, `castle_arena.jpg`, `castle_ground.png`, `castle_platform.png`, 배경은 Gemini 원본 다운로드 오류로 화면 크기 그림을 키움)
- [x] 스테이지 6 수중 던전 (아들 배경 + `sea_ground.png`, `sea_platform.png`)
