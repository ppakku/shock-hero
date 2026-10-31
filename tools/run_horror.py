# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤 python3 tools/run_horror.py 출력폴더 [이름]
# 시스템 Chrome 으로 타이틀에서 공포 모드를 켜고 몇 초 걸은 뒤 화면을 찍는다.
import os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
os.makedirs(OUT, exist_ok=True)


def open_horror(pg):
    pg.goto('http://localhost:5288/?timer&fps')
    time.sleep(3)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)


def walk_script(forward_seconds):
    return f"""() => {{
      const g = window.__horror, end = performance.now() + {forward_seconds * 1000};
      g.readInput = () => ({{ move: {{ x: 0, z: performance.now() < end ? 1 : 0, run: false }}, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false }});
    }}"""


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    open_horror(pg)
    print('start', pg.evaluate('({ p: window.__horror.p, fps: window.__horror.fps })'))
    pg.screenshot(path=f'{OUT}/light_on.png')
    pg.evaluate(walk_script(3))
    time.sleep(3.5)
    print('walked', pg.evaluate('window.__horror.p'))
    pg.evaluate('window.__horror.lightOn = false')
    time.sleep(0.5)
    pg.screenshot(path=f'{OUT}/light_off.png')
    pg.evaluate('window.__horror.exit()')
    time.sleep(1.5)
    print('title back', pg.evaluate("window.__shockGame.scene.isActive('Title')"), 'errors', errs)
    b.close()
