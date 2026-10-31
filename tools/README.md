# 자동 확인 도구 (개발용)

화면 없는 Chrome 에서 게임을 자동으로 돌려 보는 스크립트입니다. 게임에는 들어가지 않습니다.

- `bot2.js`: 몬스터를 사냥하고 보스 공격을 피하며 싸우는 봇 (scene.readInput 을 바꿔 끼움)
- `run_stage.py`: browser-harness 안에서 `exec(open(...).read())` 로 불러 쓰는 스테이지 실행 도우미
- `climb.js`: 발판을 차례로 올라가는 봇 (`window.__steps`)
- `keys.py`: CDP 키 입력 도우미

Chrome 실행 예:
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=<포트> --user-data-dir=<임시폴더> --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --window-size=960,540

게임 주소에 `?timer&all` 을 붙인다 (화면 없는 Chrome 은 화면 새로고침 신호가 멈춰서 타이머로 돌려야 함).
browser-harness 호출: `BU_NAME=<고유이름> BU_CDP_URL=http://localhost:<포트> browser-harness <<'PY' ... PY`
- `bot_stage6.js`: 스테이지 6(수중 던전) 봇. 헤엄쳐서 몬스터를 잡고 심해 아귀왕의 띠, 거품, 소용돌이를 피하며 싸운다 (`boss.dangers()` 를 읽음)
- `bot_bossb.js`, `run_bossb.py`: 주먹 발사, 빨아들이기, 얼음, 킹 보스까지 대응하는 봇과 실행 도우미 (`exec(open("tools/run_bossb.py").read())`, `start_stage(n)`, `skip_to_boss()`, `run()`)
- `bot_shredder.js`: 스테이지 1 파쇄자 봇. 톱니 돌진은 대시로 지나가고, 떨어진 주먹과 벽에 낀 톱니를 때린다 (scene.readInput 을 바꿔 끼움)
- `bot_bossa.js`: 포레스트 와처, 아스트라노바X 보스 봇 (scene.readInput 을 바꿔 끼움)
- `remove_checker_bg.py`: AI 그림에 체크무늬가 그려진 스프라이트 시트에서 체크무늬, 칸 글자, 점선을 지워 진짜 투명 PNG로 만드는 도구 (4x2 칸, 절반 크기로 저장)
- `make_ground_tile.py`: AI 바닥 그림을 반복 바닥 타일로 (체크무늬 지우기, 위아래 자르기, 좌우 이음새 섞기)
- `make_shredder_arm.py`: 파쇄자 쇠팔과 주먹이 나란히 그려진 그림 한 장을 팔(주먹이 아래)과 날아가는 주먹(왼쪽을 봄) 두 장으로 나눔 (체크무늬 지우기, 주먹 돌리기)
- `make_arm_fist.py`: 흰 배경에 팔(왼쪽, 주먹이 아래)과 주먹(오른쪽, 왼쪽을 봄)이 나란히 있는 그림을 팔 280x840, 주먹 384x266 두 장으로 나누고 art.js 에 적을 armCut(금 팔찌 윗선)을 알려 줌 (킹 돌연변이)
- `split_parts.py`: 흰 배경에 가로로 나란히 그린 부품 여러 개(예: 닫힌 상자, 열린 상자, 방패 조각)를 빈 세로줄에서 나눠 각각 배경을 지우고 정한 높이로 저장
- `gemini_batch.py`: 사용 중지. 공유 브라우저 연결에서 다른 탭에 프롬프트를 입력한 사고가 있었다 (파일 맨 위 참고)
- `key_magenta.py`: Gemini 에게 단색 마젠타 배경으로 받은 그림을 투명 PNG 로 (별 표시도 함께 지워짐). `--main` 은 가장 큰 덩어리만 남긴다
- `make_fx_sheet.py`: 검은 배경 효과 그림을 게임 크기로 줄이고 별 표시를 지움. 칸 수와 `--cells` 로 쓸 칸만 골라 시트를 만든다
- `clean_gemini_bg.py`: Gemini 배경 그림의 오른쪽 아래 별 표시를 양옆 색으로 메워 지우고 높이 720 JPG 로 저장
- `make_platform.py`: 흰 배경에 그린 발판 그림의 배경(철골 틈 포함)과 별 자국을 지우고 높이를 맞춤
- `make_ground_strip.py`: 흰 배경 위 바닥 띠 그림을 좌우로 이어지는 바닥 타일로 (윗면 위 작은 돌은 남김, surface 값 출력)
- `make_sheet.py`: 흰 배경 4x2 동작 그림(8장)을 칸마다 배경 지우고, 칸 크기와 발 위치를 맞춘 스프라이트 시트로 (몬스터 걷기)
- `make_pose_sheets.py`: 4x2 그림에서 원하는 칸만 골라 걷기 시트와 한 장짜리 자세 그림을 같은 칸 크기로 만들고, 날아가는 조각(침 등)을 따로 잘라 낸다 (몸에서 떨어진 조각은 자세 그림에서 지움). 예: 침뱉기 `python3 -I tools/make_pose_sheets.py spitter_raw.png 128 public/art/monster_spitter.png=1,7,8,2,2,8,7,1@4x2 public/art/monster_spitter_aim.png=3 public/art/monster_spitter_spit.png=5 public/art/monster_spit.png=box:600,930,820,1090#1@64`
