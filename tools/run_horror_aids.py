# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/run_horror_aids.py 출력폴더
# 도움 아이템(벽 지도, 조명탄, 나침반, 소리 장난감, 분필)을 진짜 키 입력으로 줍고 써 보고 화면을 찍는다.
# 맵마다 한 번, 휴대폰 가로 화면에서 한 번 돈다.
import os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
PORT = os.environ.get('HORROR_PORT', '5288')
os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name, info)
    if not ok:
        fails.append(name)


def open_round(pg, map_id, monster='seino'):
    pg.goto(f'http://localhost:{PORT}/?timer')
    time.sleep(3)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_selector(f'#horror button[data-pick="{map_id}"]', timeout=20000)
    pg.click(f'#horror button[data-pick="{map_id}"]')
    pg.click(f'#horror button[data-pick="{monster}"]')
    pg.click('#horror button:has-text("들어가기")')
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    pg.click('#horror button:has-text("시작")')
    time.sleep(0.5)
    # 괴물은 멀리서 쉬게 한다. 아이템만 본다
    pg.evaluate("window.__horror.stalkers.forEach((s) => { s.graceT = 1e9; })")


# 아이템 자리에 서서 그 아이템을 바라본다 (한 칸 뒤에서)
STAND = """([kind, back]) => {
  const g = window.__horror, L = window.__horrorLogic;
  const list = kind === 'board' ? g.aids.state.boards : g.aids.state.items.filter((c) => c.kind === kind && !c.taken);
  const c = list[0];
  if (kind === 'board') {
    g.p = L.center(c);
    g.yaw = Math.atan2(-c.dx, -c.dy);
  } else {
    g.p = L.center(c);
    g.yaw = 0;
  }
  g.pitch = 0;
  return { cx: c.cx, cy: c.cy };
}"""


def step(pg, secs=0.4):
    time.sleep(secs)


def run_map(pg, map_id, tag):
    open_round(pg, map_id)
    held = lambda: pg.evaluate("({ ...window.__horror.aids.state.held })")
    check(f'{tag}: slots shown', pg.inner_text('#horror').count('조명탄') >= 1)
    pg.screenshot(path=f'{OUT}/{tag}_start.png')
    # 벽 지도 보기
    pg.evaluate(STAND, ['board', 0])
    step(pg, 0.6)
    pg.screenshot(path=f'{OUT}/{tag}_board_wall.png')
    check(f'{tag}: board prompt', '벽 지도 보기' in pg.inner_text('#horror'))
    pg.keyboard.press('KeyE')
    step(pg, 0.6)
    check(f'{tag}: map opens', pg.evaluate("window.__horror.aids.mapOpen"))
    pg.screenshot(path=f'{OUT}/{tag}_map.png')
    pos = pg.evaluate("({ ...window.__horror.p })")
    pg.keyboard.down('KeyW')
    step(pg, 1)
    pg.keyboard.up('KeyW')
    check(f'{tag}: frozen while map open', pg.evaluate("({ ...window.__horror.p })") == pos)
    pg.keyboard.press('KeyE')
    step(pg, 0.3)
    check(f'{tag}: E closes map', not pg.evaluate("window.__horror.aids.mapOpen"))
    check(f'{tag}: seen board text', '이 지도는 이미 봤다' in pg.inner_text('#horror'))
    # 줍기
    for kind in ['flare', 'compass', 'toy', 'chalk']:
        pg.evaluate(STAND, [kind, 0])
        step(pg, 0.3)
        if kind == 'flare':
            pg.evaluate("(() => { const g = window.__horror; g.p = { x: g.p.x, y: g.p.y + 1.1 }; })()")
            step(pg, 0.4)
            pg.screenshot(path=f'{OUT}/{tag}_item_floor.png')
            pg.evaluate(STAND, [kind, 0])
            step(pg, 0.2)
        pg.keyboard.press('KeyE')
        step(pg, 0.3)
    h = held()
    check(f'{tag}: picked all four', h['flare'] == 1 and h['compass'] == 1 and h['toy'] == 1 and h['chalk'] == 10, str(h))
    # 조명탄: 손전등을 끄고 전후를 찍는다
    pg.evaluate("(() => { const g = window.__horror, L = window.__horrorLogic; g.p = L.center(g.map.start); g.yaw = 0; g.lightOn = false; })()")
    step(pg, 0.6)
    pg.screenshot(path=f'{OUT}/{tag}_dark.png')
    dark = pg.evaluate("window.__horror.ambientLight.intensity")
    pg.keyboard.press('Digit1')
    step(pg, 1)
    bright = pg.evaluate("window.__horror.ambientLight.intensity")
    pg.screenshot(path=f'{OUT}/{tag}_flare.png')
    check(f'{tag}: flare brightens', bright > dark * 3, f'{dark:.2f} -> {bright:.2f}')
    step(pg, 5)
    check(f'{tag}: flare ends', abs(pg.evaluate("window.__horror.ambientLight.intensity") - dark) < 0.01)
    pg.evaluate("window.__horror.lightOn = true")
    # 나침반
    pg.keyboard.press('Digit2')
    step(pg, 0.6)
    pg.screenshot(path=f'{OUT}/{tag}_compass.png')
    check(f'{tag}: compass arrow', '초' in pg.inner_text('#horror') and pg.evaluate("window.__horror.aids.compass !== null"))
    # 장난감과 분필
    pg.keyboard.press('Digit3')
    step(pg, 0.4)
    check(f'{tag}: toy thrown', pg.evaluate("window.__horror.aids.toy.visible"))
    pg.keyboard.press('Digit4')
    step(pg, 0.6)
    pg.evaluate("(() => { const g = window.__horror; g.p = { x: g.p.x, y: g.p.y + 1.2 }; g.pitch = -0.6; })()")
    step(pg, 0.5)
    pg.screenshot(path=f'{OUT}/{tag}_chalk.png')
    check(f'{tag}: chalk mark', pg.evaluate("window.__horror.aids.state.marks.length") == 1)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    for map_id in ['school', 'factory', 'sewer']:  # 역은 마지막 밤에만 나온다. 놓기 규칙은 tests/horrorAids.test.js 가 넷 다 본다
        pg = browser.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        run_map(pg, map_id, map_id)
        check(f'{map_id}: no js errors', not errs, str(errs[:2]))
        pg.close()
    # 휴대폰 가로: 아이템 칸을 손가락으로 누른다
    ctx = browser.new_context(viewport={'width': 844, 'height': 390}, user_agent=PHONE_UA, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    open_round(pg, 'school')
    pg.evaluate(STAND, ['flare', 0])
    step(pg, 0.3)
    pg.evaluate("window.__horror.aids.use({ kind: 'aid', index: window.__horror.aids.state.items.findIndex((c) => c.kind === 'flare') })")
    step(pg, 0.3)
    pg.screenshot(path=f'{OUT}/phone_slots.png')
    box = pg.locator('#horror button:has-text("조명탄")').bounding_box()
    pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    step(pg, 0.6)
    check('phone: tap slot fires flare', pg.evaluate("window.__horror.aids.flareT > 0"))
    pg.screenshot(path=f'{OUT}/phone_flare.png')
    pg.evaluate(STAND, ['board', 0])
    step(pg, 0.3)
    pg.evaluate("window.__horror.aids.use({ kind: 'board', index: 0 })")
    step(pg, 0.5)
    pg.screenshot(path=f'{OUT}/phone_map.png')
    check('phone: no js errors', not errs, str(errs[:2]))
    browser.close()

print('FAILS:', fails if fails else 'none')
sys.exit(1 if fails else 0)
