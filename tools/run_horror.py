# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/run_horror.py 출력폴더           (키보드로 걷기, 화면 찍기)
#   python3 tools/run_horror.py 출력폴더 --touch   (태블릿 손가락 입력을 진짜 터치 이벤트로 확인)
#   python3 tools/run_horror.py 출력폴더 --shots   (벽 앞 손전등 켠/끈 화면만 찍기)
#   python3 tools/run_horror.py 출력폴더 --creature (괴물 장면과 fps 만 빠르게 확인)
# 시스템 Chrome 으로 타이틀에서 공포 모드를 켜고 확인한다.
import json, math, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
MODE = 'touch' if '--touch' in sys.argv else 'shots' if '--shots' in sys.argv else 'creature' if '--creature' in sys.argv else 'keys'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
if os.environ.get('HORROR_GPU'):  # 소프트웨어 대신 이 컴퓨터의 진짜 그래픽 칩으로 잰다
    ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist']
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
    pg.screenshot(path=f'{OUT}/intro.png')
    check('intro: waits before play', pg.evaluate("window.__horror.state") == 'intro')
    check('intro: shows controls', 'W A S D' in pg.inner_text('#horror'))
    pg.click('#horror button:has-text("시작")')
    time.sleep(0.5)
    check('start button begins play', pg.evaluate("window.__horror.state") == 'play')


# 배경 음악이 실제로 나오는지 잰다. 태블릿 스피커는 150Hz 아래를 거의 못 내므로 그 위 소리도 본다.
AUDIO_PROBE = """async (secs) => {
  const a = window.__horror.audio, an = a.ctx.createAnalyser();
  an.fftSize = 8192;
  a.out.connect(an);
  const t = new Float32Array(an.fftSize), f = new Float32Array(an.frequencyBinCount);
  let rms = 0, peak = 0, n = 0, high = 0;
  const hz = a.ctx.sampleRate / an.fftSize;
  for (const end = performance.now() + secs * 1000; performance.now() < end; ) {
    await new Promise((r) => setTimeout(r, 200));
    an.getFloatTimeDomainData(t);
    an.getFloatFrequencyData(f);
    let sum = 0;
    for (const v of t) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    rms += Math.sqrt(sum / t.length);
    let e = 0;
    f.forEach((db, i) => { if (i * hz >= 150 && i * hz < 3000) e += 10 ** (db / 10); });
    high += 10 * Math.log10(e || 1e-12);
    n += 1;
  }
  a.out.disconnect(an);
  return { state: a.ctx.state, rms: rms / n, peak, highDb: high / n };
}"""


def walk_script(forward_seconds):
    return f"""() => {{
      const g = window.__horror, end = performance.now() + {forward_seconds * 1000};
      g.readInput = () => ({{ move: {{ x: 0, z: performance.now() < end ? 1 : 0, run: false }}, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false }});
    }}"""


def watch(pg, errs):
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(f'console {m.type}: ' + m.text[:300]) if m.type in ('error', 'warning') and 'goatcounter' not in m.text and 'GPU stall' not in m.text else None)


IDLE_INPUT = "window.__horror.readInput = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false })"

# 괴물을 자리에 세우고 주인공이 바라보게 한다.
# 행동은 멈춰 두고, 모형에는 pose 상태를 보여 준다. speed 를 주면 그 자리에서 제자리걸음을 한다.
PLACE_CREATURE = """({ at, heading, player, yaw, pitch, light, pose, speed, fov }) => {
  const g = window.__horror;
  g.lightOn = light;
  g.p = player;
  g.yaw = yaw;
  g.pitch = pitch;
  g.camera.fov = fov;
  g.camera.updateProjectionMatrix();
  Object.assign(g.stalker, { x: at.x, y: at.y, heading, mode: 'stunned', stunT: 999, path: [] });
  const shown = { x: at.x, y: at.y, heading, mode: pose };
  const real = g.model.constructor.prototype.update.bind(g.model);
  g.model.update = (s, dt, p) => {
    g.model.last = { x: at.x - speed * dt, y: at.y }; // 그만큼 걸었다고 알린다
    real(shown, dt, p);
  };
}"""


def creature_shot(pg, name, wait=0.8, pose='patrol', speed=0, fov=70, **place):
    pg.evaluate(PLACE_CREATURE, {**place, 'pose': pose, 'speed': speed, 'fov': fov})
    time.sleep(wait)
    print('creature shot', name, pg.evaluate('window.__horror.stalker.mode'))
    pg.screenshot(path=f'{OUT}/{name}.png')


def measure_fps(pg, secs=6):
    return pg.evaluate("""async (secs) => {
      const g = window.__horror, end = performance.now() + secs * 1000;
      g.renderer.info.autoReset = true;
      let frames = 0;
      await new Promise((done) => {
        const tick = () => { frames += 1; performance.now() < end ? requestAnimationFrame(tick) : done(); };
        requestAnimationFrame(tick);
      });
      return { fps: frames / secs, calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles };
    }""", secs)


def creature_checks(pg):
    # 사진이 흔들리지 않게 해상도를 고정한다
    pg.evaluate('(() => { const g = window.__horror; g.trackFps = () => {}; g.ratio = 1.5; g.renderer.setPixelRatio(1.5); })()')
    # 시작 방에서 오른쪽을 보면 문(7, 15)을 지나 8칸까지 트여 있다
    east = -math.pi / 2
    near = {'x': 2.5, 'y': 15.5}
    front = {'at': {'x': 5.0, 'y': 15.5}, 'heading': -math.pi / 2, 'player': near, 'yaw': east, 'pitch': 0.05, 'light': True}
    side = {**front, 'heading': 0}
    zoom = {'fov': 22, 'pitch': -0.04}
    creature_shot(pg, 'stalker', **front)
    creature_shot(pg, 'creature_side', **side)
    creature_shot(pg, 'zoom_front', **front | zoom)
    creature_shot(pg, 'zoom_side', **side | zoom)
    creature_shot(pg, 'zoom_back', **{**front, 'heading': math.pi / 2} | zoom)
    creature_shot(pg, 'zoom_walk_side', **side | zoom, speed=0.9, wait=1.1)
    creature_shot(pg, 'zoom_chase_side', **side | zoom, pose='chase', speed=2, wait=1.4)
    creature_shot(pg, 'zoom_chase_front', **front | zoom, pose='chase', speed=2, wait=1.4)
    creature_shot(pg, 'zoom_stunned', **front | zoom, pose='stunned')
    creature_shot(pg, 'creature_face', **{**front, 'player': {'x': 3.8, 'y': 15.5}, 'pitch': 0.42})
    creature_shot(pg, 'creature_dark', **{**front, 'at': {'x': 9.5, 'y': 15.5}, 'player': {'x': 1.5, 'y': 15.5}, 'light': False, 'pitch': 0.05})
    creature_shot(pg, 'creature_dark_chase', **{**front, 'at': {'x': 9.5, 'y': 15.5}, 'player': {'x': 1.5, 'y': 15.5}, 'light': False, 'pitch': 0.05}, pose='chase')
    box = pg.evaluate("""() => {
      const g = window.__horror;
      g.model.group.updateMatrixWorld(true);
      let tris = 0, meshes = 0;
      const seen = new Set();
      g.model.group.traverse((o) => {
        if (!o.isMesh) return;
        meshes += 1;
        if (seen.has(o.geometry)) return;
        seen.add(o.geometry);
      });
      g.model.group.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
      return { tris, meshes, shared: seen.size };
    }""")
    print('creature size', box)
    check('creature: under 6000 triangles', box['tris'] < 6000, box)

    creature_motion(pg, front)

    # 괴물이 화면에 있을 때와 없을 때를 같은 자리에서 잰다
    pg.evaluate('window.__horror.renderer.setPixelRatio(1)')
    creature_shot(pg, 'fps_view', **front, speed=0.9)
    runs = {True: [], False: []}
    for shown in [True, False] * 3:  # 번갈아 재서 컴퓨터 부하가 한쪽에만 쏠리지 않게 한다
        pg.evaluate('(v) => { window.__horror.model.group.visible = v; }', shown)
        runs[shown].append(measure_fps(pg, 4))
    pg.evaluate('window.__horror.model.group.visible = true')
    print('fps with creature', [round(r['fps'], 1) for r in runs[True]], runs[True][-1])
    print('fps without creature', [round(r['fps'], 1) for r in runs[False]], runs[False][-1])


# 진짜 행동 코드로 걷게 해서 앞면이 가는 쪽을 보는지, 머리가 움찔하는지, 눈이 상태를 따르는지 잰다
def creature_motion(pg, front):
    pg.evaluate(PLACE_CREATURE, {**front, 'at': {'x': 6.5, 'y': 15.5}, 'pose': 'patrol', 'speed': 0, 'fov': 70})
    pg.evaluate("""() => {
      const g = window.__horror;
      g.model.update = g.model.constructor.prototype.update;
      g.p = { x: 1.5, y: 15.5 };
      Object.assign(g.stalker, { mode: 'investigate', stunT: 0, target: { cx: 2, cy: 15 }, path: [{ cx: 5, cy: 15 }, { cx: 4, cy: 15 }, { cx: 3, cy: 15 }] });
    }""")
    time.sleep(1.2)
    go = pg.evaluate("""() => {
      const g = window.__horror, s = g.stalker;
      const d = new g.model.group.position.constructor(0, 0, 1).applyQuaternion(g.model.group.quaternion);
      return { mode: s.mode, forwardX: d.x, forwardZ: d.z, x: s.x };
    }""")
    print('walking', go)
    check('creature: walks with its front toward travel (-x)', go['forwardX'] < -0.95, go)
    pg.screenshot(path=f'{OUT}/creature_real_walk.png')

    # 움찔: 15초 동안 머리 기울기가 한 번 이상 크게 튀어야 한다
    twitch = pg.evaluate("""async () => {
      const g = window.__horror, m = g.model;
      Object.assign(g.stalker, { x: 5.5, y: 15.5, mode: 'stunned', stunT: 999, path: [] });
      const shown = { x: 5.5, y: 15.5, heading: 0, mode: 'search' }; // 주인공이 옆에 있다
      const real = m.constructor.prototype.update.bind(m);
      m.update = (s, dt, p) => real(shown, dt, p);
      let peak = 0, jumps = 0, last = 0;
      for (const end = performance.now() + 15000; performance.now() < end; ) {
        await new Promise((r) => requestAnimationFrame(r));
        const z = m.head.rotation.z;
        peak = Math.max(peak, Math.abs(z));
        if (Math.abs(z - last) > 0.15) jumps += 1;
        last = z;
      }
      return { peak, jumps, turn: m.head.rotation.y, glow: m.glow };
    }""")
    print('twitch', twitch)
    check('creature: head twitches', twitch['peak'] > 0.2 and twitch['jumps'] > 0, twitch)
    check('creature: head turns toward player', twitch['turn'] < -1, twitch)

    glow = pg.evaluate("""async () => {
      const g = window.__horror, m = g.model, out = { search: m.glow };
      const shown = { x: 5.5, y: 15.5, heading: -Math.PI / 2, mode: 'chase' };
      const real = m.constructor.prototype.update.bind(m);
      m.update = (s, dt, p) => real(shown, dt, p);
      await new Promise((r) => setTimeout(r, 1200));
      out.chase = m.glow;
      shown.mode = 'stunned';
      await new Promise((r) => setTimeout(r, 2500));
      out.stunned = m.glow;
      return out;
    }""")
    print('eye glow', glow)
    check('creature: eyes follow mode', glow['chase'] > 0.8 and glow['stunned'] < 0.12 < glow['search'], glow)


def run_creature(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    watch(pg, errs)
    open_horror(pg)
    pg.evaluate(IDLE_INPUT)
    time.sleep(2)  # 그림을 다 받기를 기다린다
    creature_checks(pg)
    print('errors', errs)
    check('creature: no errors', not errs, errs)
    b.close()


def run_keys(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    watch(pg, errs)
    open_horror(pg)
    print('start', pg.evaluate('({ p: window.__horror.p, fps: window.__horror.fps })'))
    time.sleep(5)  # 음악이 차오르기를 기다린다
    sound = pg.evaluate(AUDIO_PROBE, 12)
    print('sound', sound)
    check('music: audio running', sound['state'] == 'running', sound)
    check('music: audible, not clipping', 0.01 < sound['rms'] and sound['peak'] < 0.95, sound)
    check('music: audible on small speakers', sound['highDb'] > -45, sound)
    pg.screenshot(path=f'{OUT}/light_on.png')
    pg.evaluate(walk_script(3))
    time.sleep(3.5)
    print('walked', pg.evaluate('window.__horror.p'))
    pg.evaluate('window.__horror.lightOn = false')
    time.sleep(0.5)
    pg.screenshot(path=f'{OUT}/light_off.png')
    creature_checks(pg)
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
      const b = s.horrorBtn;
      if (!b) return { has: false };
      const k = c.width / window.__shockGame.scale.gameSize.width;
      return { x: c.left + b.x * k, y: c.top + b.y * k, has: true };
    }""")
    check('title: entrance visible on tablet', xy['has'], xy)
    if not xy['has']:
        raise SystemExit(1)
    t.down(1, xy['x'], xy['y'])
    time.sleep(0.08)
    t.up(1)
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    check('intro: touch controls shown', '왼쪽' in pg.inner_text('#horror'))
    pg.screenshot(path=f'{OUT}/touch_intro.png')
    tap(t, button_xy(pg, '시작'))
    check('intro: tap start begins play', pg.evaluate("window.__horror.state") == 'play')


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

    # 안내 화면의 타이틀로 버튼도 돌아간다
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(0.6)
    tap(t, button_xy(pg, '타이틀로'))
    time.sleep(1.5)
    check('intro: quit button returns to title', pg.evaluate("window.__shockGame.scene.isActive('Title') && !window.__horror"))

    # 12번 연속 들어가고 나가기: 오류와 WebGL 컨텍스트 경고가 없어야 한다
    n0 = len(errs)
    for i in range(12):
        pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
        pg.wait_for_function('window.__horror', timeout=20000)
        time.sleep(0.4)
        if i % 2:
            pg.evaluate('window.__horror.beginPlay()')  # 소리까지 켠 뒤에도 깨끗하게 나간다
            time.sleep(0.3)
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
    {'keys': run_keys, 'shots': run_shots, 'touch': run_touch, 'creature': run_creature}[MODE](pw)
if fails:
    print('FAILED:', fails)
    sys.exit(1)
