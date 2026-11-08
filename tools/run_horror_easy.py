# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/run_horror_easy.py 출력폴더
# 쉬움과 어려움 난이도를 진짜 화면에서 확인한다. 쉬움: 작은 지도가 늘 떠 있고 내 세모가 따라 움직이며,
# 아이템이 줄지 않는다. 어려움: 작은 지도가 없고 벽 지도와 바닥 아이템이 있다. 고른 난이도는 다시 열어도 남는다.
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


def chooser(pg, fresh=False):
    pg.goto(f'http://localhost:{PORT}/?timer')
    if fresh:
        pg.evaluate('localStorage.clear()')
        pg.reload()
    time.sleep(3)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_selector('#horror button[data-pick="easy"]', timeout=20000)


def pressed(pg, id_):
    return pg.get_attribute(f'#horror button[data-pick="{id_}"]', 'aria-pressed') == 'true'


def enter(pg, map_id=None, monster='seino'):
    if map_id == 'forest':
        pg.click('#horror [data-forest]')
        pg.click('#horror [data-forest-enter]')
    elif map_id == 'pool':
        pg.click('#horror [data-pool]')
        pg.click('#horror [data-pool-enter]')
    else:
        pg.click(f'#horror button[data-pick="{map_id}"]')
        pg.click(f'#horror button[data-pick="{monster}"]')
        pg.click('#horror button:has-text("들어가기")')
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    intro = pg.inner_text('#horror')
    pg.click('#horror button:has-text("시작")')
    time.sleep(0.5)
    pg.evaluate("window.__horror.stalkers.forEach((s) => { s.graceT = 1e9; })")
    return intro


MINI = "(() => { const c = document.querySelector('#horror [data-mini-map]'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y, data: c.toDataURL() }; })()"


def easy_round(pg, map_id, tag, touch=False):
    intro = enter(pg, map_id)
    check(f'{tag}: intro says easy', '쉬움' in intro)
    mini = pg.evaluate(MINI)
    vw = pg.evaluate('innerWidth')
    check(f'{tag}: mini map shown', bool(mini) and mini['w'] > vw * 0.15, str(mini and (mini['w'], mini['h'])))
    held = pg.evaluate("({ ...window.__horror.aids.state.held })")
    check(f'{tag}: all aids held', all(v == float('inf') for v in held.values()), str(held))
    check(f'{tag}: no boards or floor items', pg.evaluate("window.__horror.aids.state.boards.length + window.__horror.aids.state.items.length") == 0)
    check(f'{tag}: slots show infinity', pg.inner_text('#horror').count('∞') >= 4)
    pg.screenshot(path=f'{OUT}/{tag}_easy.png')
    # 내가 움직이면 작은 지도가 다시 그려진다
    before = mini['data'] if mini else ''
    pg.evaluate("(() => { const g = window.__horror; g.yaw += Math.PI / 2; })()")
    time.sleep(0.5)
    after = pg.evaluate(MINI)
    check(f'{tag}: mini map follows me', after and after['data'] != before)
    if not touch:
        for key in ['Digit2', 'Digit2', 'Digit2', 'Digit1', 'Digit1', 'Digit1']:
            pg.keyboard.press(key)
            time.sleep(0.3)
        used = pg.evaluate("({ compass: window.__horror.aids.compassT > 0, flare: window.__horror.aids.flareT > 0 })")
        held = pg.evaluate("({ ...window.__horror.aids.state.held })")
        check(f'{tag}: aids used and not used up', used['compass'] and used['flare'] and all(v == float('inf') for v in held.values()), f'{used} {held}')
        pg.screenshot(path=f'{OUT}/{tag}_easy_used.png')
    errors = pg.evaluate('window.__errs || []')
    check(f'{tag}: no page errors', not errors, str(errors[:3]))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=ARGS)
        pg = browser.new_page(viewport={'width': 1280, 'height': 720})
        pg.add_init_script("window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message)));")
        chooser(pg, fresh=True)
        check('first time easy pressed', pressed(pg, 'easy') and not pressed(pg, 'hard'))
        pg.screenshot(path=f'{OUT}/chooser.png')
        easy_round(pg, 'school', 'school')
        for map_id in ['forest', 'pool']:
            chooser(pg)
            easy_round(pg, map_id, map_id)
        # 어려움을 고르면 남고, 지금 게임 그대로다
        chooser(pg)
        pg.click('#horror button[data-pick="hard"]')
        chooser(pg)
        check('hard remembered', pressed(pg, 'hard'))
        intro = enter(pg, 'factory')
        check('hard: intro says hard', '어려움' in intro)
        check('hard: no mini map', pg.evaluate(MINI) is None)
        check('hard: boards and items placed', pg.evaluate("window.__horror.aids.state.boards.length > 0 && window.__horror.aids.state.items.length > 0"))
        check('hard: empty hands', pg.evaluate("Object.values(window.__horror.aids.state.held).every((v) => v === 0)"))
        pg.screenshot(path=f'{OUT}/factory_hard.png')
        # 휴대폰 가로 화면, 쉬움
        phone = browser.new_page(viewport={'width': 844, 'height': 390}, user_agent=PHONE_UA, has_touch=True, is_mobile=True)
        phone.add_init_script("window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message)));")
        chooser(phone, fresh=True)
        phone.screenshot(path=f'{OUT}/phone_chooser.png')
        easy_round(phone, 'sewer', 'phone', touch=True)
        browser.close()
    print('FAILS', fails)
    sys.exit(1 if fails else 0)


main()
