# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/run_horror.py 출력폴더           (키보드로 걷기, 화면 찍기)
#   python3 tools/run_horror.py 출력폴더 --touch   (태블릿 손가락 입력을 진짜 터치 이벤트로 확인)
#   python3 tools/run_horror.py 출력폴더 --shots   (벽 앞 손전등 켠/끈 화면만 찍기)
# 시스템 Chrome 으로 타이틀에서 공포 모드를 켜고 확인한다.
import json, math, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
MODE = 'touch' if '--touch' in sys.argv else 'shots' if '--shots' in sys.argv else 'keys'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
URL = 'http://localhost:5288/?timer&fps'
os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name, info)
    if not ok:
        fails.append(name)


def open_horror(pg):
    pg.goto(URL)
    time.sleep(3)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)


def walk_script(forward_seconds):
    return f"""() => {{
      const g = window.__horror, end = performance.now() + {forward_seconds * 1000};
      g.readInput = () => ({{ move: {{ x: 0, z: performance.now() < end ? 1 : 0, run: false }}, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false }});
    }}"""


def watch(pg, errs):
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(f'console {m.type}: ' + m.text[:300]) if m.type in ('error', 'warning') and 'goatcounter' not in m.text and 'GPU stall' not in m.text else None)


def run_keys(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    watch(pg, errs)
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
    check('keys: no errors', not errs, errs)
    b.close()


def run_shots(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    watch(pg, errs)
    open_horror(pg)
    # 시작 방 북쪽 벽(y=13)을 2.5칸 앞에 두고 본다
    pg.evaluate("window.__horror.readInput = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false }); window.__horror.p = { x: 3.5, y: 15.5 }")
    time.sleep(3)
    pg.screenshot(path=f'{OUT}/wall_on.png')
    print('fps on', pg.evaluate('window.__horror.fps'))
    pg.evaluate('window.__horror.lightOn = false')
    time.sleep(1)
    pg.screenshot(path=f'{OUT}/wall_off.png')
    pg.evaluate('window.__horror.lightOn = true; window.__horror.p = { x: 3.5, y: 16.0 }')
    time.sleep(1)
    pg.screenshot(path=f'{OUT}/wall_on_far.png')
    print('errors', errs)
    b.close()


# ---------- 터치 ----------
class Touch:
    def __init__(self, cdp):
        self.cdp = cdp
        self.pts = {}  # id -> (x, y)

    def send(self, kind):
        self.cdp.send('Input.dispatchTouchEvent', {
            'type': kind,
            'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in self.pts.items()],
        })

    def down(self, i, x, y):
        self.pts[i] = (x, y)
        self.send('touchStart')

    def move(self, i, x, y):
        self.pts[i] = (x, y)
        self.send('touchMove')

    def up(self, i):
        self.pts.pop(i)
        self.send('touchEnd')

    def drag(self, i, x0, y0, x1, y1, steps=8, wait=0.03):
        for s in range(1, steps + 1):
            self.move(i, x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps)
            time.sleep(wait)


def state(pg):
    return pg.evaluate('({ x: window.__horror.p.x, y: window.__horror.p.y, yaw: window.__horror.yaw, pitch: window.__horror.pitch, light: window.__horror.lightOn })')


def title_tap(pg, t):
    # 타이틀 입구 버튼의 화면 좌표를 구해서 손가락으로 누른다
    xy = pg.evaluate("""() => {
      const s = window.__shockGame.scene.getScene('Title'), c = window.__shockGame.canvas.getBoundingClientRect();
      const k = c.width / window.__shockGame.scale.gameSize.width;
      return { x: c.left + s.horrorBtn.x * k, y: c.top + s.horrorBtn.y * k, has: Boolean(s.horrorBtn) };
    }""")
    check('title: entrance visible on tablet', xy['has'], xy)
    t.down(1, xy['x'], xy['y'])
    time.sleep(0.08)
    t.up(1)
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)


def button_xy(pg, label):
    return pg.evaluate("""(label) => {
      const b = [...document.querySelectorAll('#horror button')].find((e) => e.textContent === label);
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }""", label)


def tap(t, xy):
    t.down(9, xy['x'], xy['y'])
    time.sleep(0.08)
    t.up(9)
    time.sleep(0.4)


def run_touch(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    ctx = b.new_context(viewport={'width': 1024, 'height': 768}, has_touch=True, is_mobile=False,
                        user_agent=IPAD_UA, device_scale_factor=1)
    pg = ctx.new_page()
    errs = []
    watch(pg, errs)
    cdp = ctx.new_cdp_session(pg)
    t = Touch(cdp)
    pg.goto(URL)
    time.sleep(3)
    env = pg.evaluate("({ pts: navigator.maxTouchPoints, coarse: matchMedia('(pointer: coarse)').matches, screen: [screen.width, screen.height] })")
    print('env', env)
    check('env: touch device', env['pts'] > 0 and env['coarse'], env)
    title_tap(pg, t)
    check('tap entrance starts mode', pg.evaluate('Boolean(window.__horror)'))
    check('touch branch (buttons exist)', pg.evaluate("document.querySelectorAll('#horror button').length") == 4)
    pg.screenshot(path=f'{OUT}/touch_start.png')
    time.sleep(0.5)

    def face(s):
        return (-math.sin(s['yaw']), -math.cos(s['yaw'])), (math.cos(s['yaw']), -math.sin(s['yaw']))

    def delta(a, b2):
        return b2['x'] - a['x'], b2['y'] - a['y']

    # 왼쪽 스틱 위로: 보는 방향으로 간다
    s0 = state(pg)
    t.down(1, 200, 500)
    t.drag(1, 200, 500, 200, 440)
    time.sleep(0.8)
    s1 = state(pg)
    t.up(1)
    f, r = face(s0)
    dx, dy = delta(s0, s1)
    fw = dx * f[0] + dy * f[1]
    check('stick up walks forward', fw > 0.3 and abs(dx * r[0] + dy * r[1]) < 0.05, f'forward={fw:.2f} side={dx * r[0] + dy * r[1]:.2f} p {s0["x"]:.2f},{s0["y"]:.2f} -> {s1["x"]:.2f},{s1["y"]:.2f}')

    # 스틱 오른쪽: 오른쪽 옆걸음
    s0 = state(pg)
    t.down(1, 200, 500)
    t.drag(1, 200, 500, 260, 500)
    time.sleep(0.6)
    s1 = state(pg)
    t.up(1)
    f, r = face(s0)
    dx, dy = delta(s0, s1)
    side = dx * r[0] + dy * r[1]
    check('stick right strafes right', side > 0.2 and abs(dx * f[0] + dy * f[1]) < 0.05, f'right={side:.2f} fwd={dx * f[0] + dy * f[1]:.2f} dx={dx:.2f} dy={dy:.2f}')

    # 스틱 왼쪽
    s0 = state(pg)
    t.down(1, 200, 500)
    t.drag(1, 200, 500, 140, 500)
    time.sleep(0.6)
    s1 = state(pg)
    t.up(1)
    f, r = face(s0)
    dx, dy = delta(s0, s1)
    side = dx * r[0] + dy * r[1]
    check('stick left strafes left', side < -0.2, f'right={side:.2f}')

    # 오른쪽 반 끌기: 오른쪽으로 끌면 오른쪽으로 돈다 (yaw 가 줄어든다), 아래로 끌면 아래를 본다 (pitch 가 줄어든다)
    s0 = state(pg)
    t.down(2, 700, 400)
    t.drag(2, 700, 400, 800, 340, steps=10)
    time.sleep(0.2)
    t.up(2)
    s1 = state(pg)
    check('drag right turns right (yaw down)', s1['yaw'] < s0['yaw'] - 0.2, f'yaw {s0["yaw"]:.3f} -> {s1["yaw"]:.3f}')
    check('drag up looks up (pitch up)', s1['pitch'] > s0['pitch'] + 0.1, f'pitch {s0["pitch"]:.3f} -> {s1["pitch"]:.3f}')
    s0 = state(pg)
    t.down(2, 700, 400)
    t.drag(2, 700, 400, 640, 460, steps=10)
    t.up(2)
    s1 = state(pg)
    check('drag left+down turns left, looks down', s1['yaw'] > s0['yaw'] + 0.1 and s1['pitch'] < s0['pitch'] - 0.1, f'yaw {s0["yaw"]:.3f}->{s1["yaw"]:.3f} pitch {s0["pitch"]:.3f}->{s1["pitch"]:.3f}')

    # 두 손가락: 걸으면서 둘러보기. 먼저 시선을 평평하게 맞춘다.
    pg.evaluate('window.__horror.pitch = 0; window.__horror.p = { x: 3.5, y: 16.2 }')
    s0 = state(pg)
    t.down(1, 200, 500)
    t.drag(1, 200, 500, 200, 440)
    t.down(2, 700, 400)
    for _ in range(10):
        t.move(2, t.pts[2][0] + 8, 400)
        t.move(1, 200, 440)
        time.sleep(0.05)
    s1 = state(pg)
    t.up(2)
    t.up(1)
    moved = math.hypot(s1['x'] - s0['x'], s1['y'] - s0['y'])
    check('two fingers: walks while looking', moved > 0.2 and s1['yaw'] < s0['yaw'] - 0.1, f'moved={moved:.2f} yaw {s0["yaw"]:.3f}->{s1["yaw"]:.3f}')
    pg.screenshot(path=f'{OUT}/touch_two_fingers.png')

    # 손전등 버튼
    on0 = state(pg)['light']
    tap(t, button_xy(pg, '손전등'))
    on1 = state(pg)['light']
    check('light button toggles', on0 != on1, f'{on0} -> {on1}')
    tap(t, button_xy(pg, '손전등'))
    check('light button toggles back', state(pg)['light'] == on0)

    # 멈춤 버튼: 타이틀로 돌아온다
    tap(t, button_xy(pg, '멈춤'))
    time.sleep(1.5)
    back = pg.evaluate("window.__shockGame.scene.isActive('Title') && !document.getElementById('horror') && !window.__horror")
    check('pause returns to a working title', back)
    check('pause: no errors', not errs, errs)

    # 두 번째 입장: 타이틀이 살아 있고 다시 들어가진다
    time.sleep(0.5)
    title_tap(pg, t)
    check('second entry works', pg.evaluate('Boolean(window.__horror)'))
    s0 = state(pg)
    t.down(1, 200, 500)
    t.drag(1, 200, 500, 200, 440)
    time.sleep(0.5)
    t.up(1)
    s1 = state(pg)
    check('second entry: stick walks', math.hypot(s1['x'] - s0['x'], s1['y'] - s0['y']) > 0.2)
    tap(t, button_xy(pg, '멈춤'))
    time.sleep(1.5)
    check('second exit returns to title', pg.evaluate("window.__shockGame.scene.isActive('Title') && !window.__horror"))

    # 12번 연속 들어가고 나가기: 오류와 WebGL 컨텍스트 경고가 없어야 한다
    n0 = len(errs)
    for i in range(12):
        pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
        pg.wait_for_function('window.__horror', timeout=20000)
        time.sleep(0.4)
        pg.evaluate('window.__horror.exit()')
        pg.wait_for_function('!window.__horror && window.__shockGame.scene.isActive("Title")', timeout=10000)
        time.sleep(0.5)
    new = errs[n0:]
    ctxwarn = [e for e in new if 'context' in e.lower()]
    check('12 enter/exit loops: no errors', not new, new)
    check('12 enter/exit loops: no WebGL context warning', not ctxwarn, ctxwarn)
    print('all console issues', errs)
    pg.screenshot(path=f'{OUT}/touch_end.png')
    b.close()


with sync_playwright() as pw:
    {'keys': run_keys, 'shots': run_shots, 'touch': run_touch}[MODE](pw)
if fails:
    print('FAILED:', fails)
    sys.exit(1)
