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
- `bot_bossb.js`, `run_bossb.py`: 주먹 발사, 빨아들이기, 얼음, 킹 보스까지 대응하는 봇과 실행 도우미 (`exec(open("tools/run_bossb.py").read())`, `start_stage(n)`, `skip_to_boss()`, `run()`)
