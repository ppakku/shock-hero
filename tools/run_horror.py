# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/run_horror.py 출력폴더           (키보드로 걷기, 화면 찍기)
#   python3 tools/run_horror.py 출력폴더 --touch   (태블릿 손가락 입력을 진짜 터치 이벤트로 확인)
#   python3 tools/run_horror.py 출력폴더 --shots   (벽 앞 손전등 켠/끈 화면만 찍기)
#   python3 tools/run_horror.py 출력폴더 --creature (괴물 장면과 fps 만 빠르게 확인)
#   python3 tools/run_horror.py 출력폴더 --sound   (세이노가 가깝고 멀 때, 순찰과 추격의 소리 크기만 재기)
#   python3 tools/run_horror.py 출력폴더 --robust  (화면 꺼짐, 보석, 소리 실패, 나가기 실패, 세이노 숨기기, 비상등. --play 에도 들어 있다)
#   python3 tools/run_horror.py 출력폴더 --play    (줍기, 숨기, 펀치, 일시정지, 잡힘, 봇의 탈출까지. 기본 실행에도 들어 있다)
# 시스템 Chrome 으로 타이틀에서 공포 모드를 켜고 확인한다.
import json, math, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
MODE = 'touch' if '--touch' in sys.argv else 'shots' if '--shots' in sys.argv else 'creature' if '--creature' in sys.argv else 'play' if '--play' in sys.argv else 'sound' if '--sound' in sys.argv else 'robust' if '--robust' in sys.argv else 'keys'
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
  const a = window.__horror.audio, an = a.ctx.createAnalyser(), tap = a.comp || a.out; // 압축기를 지난 소리, 스피커로 가는 소리를 잰다
  an.fftSize = 8192;
  tap.connect(an);
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
  tap.disconnect(an);
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
    g.model.hasLast = true; g.model.lastX = at.x - speed * dt; g.model.lastY = at.y; // 그만큼 걸었다고 알린다
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
    pg.evaluate('window.__horror.cullCreature = () => {}')  # 게임이 보임 여부를 덮어쓰지 않게 한다
    for shown in [True, False] * 3:  # 번갈아 재서 컴퓨터 부하가 한쪽에만 쏠리지 않게 한다
        pg.evaluate('(v) => { window.__horror.model.group.visible = v; }', shown)
        runs[shown].append(measure_fps(pg, 4))
    pg.evaluate('delete window.__horror.cullCreature; window.__horror.model.group.visible = true')
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


# 화면 없는 Chrome 은 마우스 잠금이 없어서 잠긴 것처럼 보이게 한다
FAKE_LOCK = "Object.defineProperty(document, 'pointerLockElement', { get: () => document.getElementById('horror'), configurable: true })"

# 세이노를 멀리 세워 둔다. 조작만 따로 확인할 때 쓴다
PARK_STALKER = "Object.assign(window.__horror.stalker, { x: 24.5, y: 4.5, mode: 'stunned', stunT: 9999, path: [] })"


def game(pg):
    return pg.evaluate("""() => {
      const g = window.__horror, s = g.stalker;
      return { state: g.state, have: g.run.have, shock: g.run.shock, powered: g.run.powered, caught: g.run.caughtCount, hidden: g.hidden, p: g.p, mode: s.mode,
        away: Math.hypot(s.x - g.p.x, s.y - g.p.y), status: g.hud.status.textContent, prompt: g.hud.prompt.textContent };
    }""")


def stand_at(pg, x, y):
    pg.evaluate('([x, y]) => { window.__horror.p = { x, y }; }', [x, y])
    time.sleep(0.4)


def play_controls(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    watch(pg, errs)
    open_horror(pg)
    pg.evaluate(PARK_STALKER)
    time.sleep(1)
    pg.screenshot(path=f'{OUT}/hud_1280.png')
    check('hud: status shown', '퓨즈 0/3' in game(pg)['status'], game(pg))

    # 줍기: 진짜 E 키
    f = pg.evaluate('window.__horror.run.fuses[0]')
    stand_at(pg, f['cx'] + 0.5, f['cy'] + 0.5)
    check('fuse: prompt', 'E: 퓨즈 줍기' in game(pg)['prompt'], game(pg))
    pg.screenshot(path=f'{OUT}/fuse_prompt.png')
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('fuse: E takes it', game(pg)['have'] == 1 and not pg.evaluate('window.__horror.fuseMeshes[0].visible'), game(pg))

    # 패널은 모자라면 안 켜진다
    stand_at(pg, 25.5, 16.5)
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('panel: needs fuses', not game(pg)['powered'] and '필요해' in game(pg)['prompt'], game(pg))

    # 숨기: 시작 방 옆 사물함 (6, 13)
    stand_at(pg, 5.5, 13.5)
    pg.keyboard.press('e')
    time.sleep(0.5)
    hid = game(pg)
    check('locker: E hides', hid['hidden'] is not None and pg.evaluate("window.__horror.hud.slit.style.display") == 'block', hid)
    pg.screenshot(path=f'{OUT}/locker.png')
    pg.keyboard.press('e')
    time.sleep(0.4)
    out = game(pg)
    check('locker: E leaves where you were', out['hidden'] is None and abs(out['p']['x'] - 5.5) < 0.01, out)

    # 전기 상자와 펀치: 시작 방 상자 (1, 17) 옆. 세이노가 가까이 오면 진짜 클릭으로 친다
    stand_at(pg, 2.5, 17.5)
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('box: E charges', game(pg)['shock'] and '충전됨' in game(pg)['status'], game(pg))
    # 느린 Chrome 에서 먼저 잡히지 않게 세이노는 멈춘 채 옆에 두고, 펀치가 멈춤 시간을 새로 맞추는지 본다
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 4.5, y: 17.5, stunT: 9999 })")
    pg.evaluate(FAKE_LOCK)
    pg.mouse.click(640, 360)
    time.sleep(0.5)
    print('after punch', game(pg), pg.evaluate('window.__horror.stalker.stunT'))
    check('punch: click stuns', pg.evaluate('window.__horror.stalker.stunT') < 10 and not game(pg)['shock'], game(pg))
    pg.evaluate("delete document.pointerLockElement")
    pg.evaluate(PARK_STALKER)

    # 일시정지
    pg.keyboard.press('Escape')
    time.sleep(0.5)
    check('pause: Esc pauses', game(pg)['state'] == 'paused' and '계속하기' in pg.inner_text('#horror'), game(pg))
    pg.screenshot(path=f'{OUT}/pause.png')
    t0 = pg.evaluate('performance.now()')
    pg.click('#horror button:has-text("계속하기")')
    time.sleep(0.5)
    check('pause: resume plays again', game(pg)['state'] == 'play', game(pg))
    print('resume took', pg.evaluate('performance.now()') - t0)

    # 놀람 장면: 밟으면 한 번만 울리고 손전등이 깜빡이고, 잡히면 깜빡임이 끊겨 밝기가 돌아온다
    sc = pg.evaluate('window.__horror.map.scares[0]')
    pg.evaluate("window.__lows = []; const g = window.__horror; const t = setInterval(() => window.__lows.push(g.flash.intensity), 30); setTimeout(() => clearInterval(t), 1800)")
    stand_at(pg, sc['cx'] + 0.5, sc['cy'] + 0.5)
    time.sleep(2)
    lows = pg.evaluate('window.__lows')
    left = pg.evaluate('window.__horror.scaresLeft.length')
    base = pg.evaluate('window.__horror.k.flashIntensity')
    check('scare: flicker dims the flashlight then restores it', min(lows) < base * 0.5 and lows[-1] == base, (min(lows), lows[-1], base))
    check('scare: fires once', left == pg.evaluate('window.__horror.map.scares.length') - 1, left)
    stand_at(pg, sc['cx'] + 0.5, sc['cy'] + 1.5)
    stand_at(pg, sc['cx'] + 0.5, sc['cy'] + 0.5)
    check('scare: not again on the same cell', pg.evaluate('window.__horror.blink') is None, '')
    sc2 = pg.evaluate('window.__horror.map.scares[1]')
    stand_at(pg, sc2['cx'] + 0.5, sc2['cy'] + 0.5)
    check('scare: second cell starts a flicker', pg.evaluate('window.__horror.blink') is not None, '')
    pg.evaluate(FAKE_LOCK)  # 마우스가 잠겨 있으면 잡힌 뒤 바로 이어진다
    pg.evaluate("window.__horror.getCaught()")
    k_ = pg.evaluate("({ blink: window.__horror.blink, i: window.__horror.flash.intensity, base: window.__horror.k.flashIntensity })")
    check('scare: caught cancels the flicker and keeps the face light', k_['blink'] is None and k_['i'] < k_['base'] * 0.5, k_)
    pg.wait_for_function("window.__horror.state === 'play'", timeout=20000)
    check('scare: true brightness back after caught', pg.evaluate('window.__horror.flash.intensity') == base, '')
    pg.evaluate("delete document.pointerLockElement")
    pg.evaluate(PARK_STALKER)
    low = pg.evaluate("() => { const g = window.__horror; g.lowFx = true; g.p = { x: 1.5, y: 1.5 }; const s = g.map.scares[2]; g.p = { x: s.cx + 0.5, y: s.cy + 0.5 }; return null; }")
    time.sleep(0.5)
    check('scare: lowFx plays no flicker', pg.evaluate('window.__horror.blink') is None and pg.evaluate('window.__horror.flash.intensity') == base, '')
    pg.evaluate('window.__horror.lowFx = false')
    print('errors', errs)
    check('controls: no errors', not errs, errs)
    b.close()


def play_bot(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 640, 'height': 360})  # 화면 없는 Chrome 은 느려서 작게 돌린다
    errs = []
    watch(pg, errs)
    pg.goto(URL)
    pg.evaluate("localStorage.removeItem('shock-hero-save-v1')")
    open_horror(pg)  # 주소를 새로 열므로 잠금 흉내는 그 뒤에 한다
    pg.evaluate(FAKE_LOCK)
    bot = open('tools/bot_horror.js', encoding='utf8').read()
    gems0 = pg.evaluate("JSON.parse(localStorage.getItem('shock-hero-save-v1') || '{}').gems || 0")

    # 잡히는 판: 얼굴이 코앞에 온 순간에 멈춰 찍는다
    pg.evaluate('window.__horrorBot = { caughtOnPurpose: true }')
    pg.evaluate(bot)
    pg.wait_for_function("window.__horror.state === 'caught' && window.__horror.lunge.t > 0.25", timeout=30000, polling=30)
    pg.evaluate('window.__horror.caughtFrame = () => {}')
    pg.screenshot(path=f'{OUT}/caught.png')
    pg.evaluate('delete window.__horror.caughtFrame; window.__horrorBot = null')
    pg.wait_for_function("window.__horror.state === 'play'", timeout=20000)
    after = game(pg)
    print('after caught', after)
    check('caught: back at start, monster far', after['caught'] == 1 and after['away'] > 15 and after['mode'] == 'patrol', after)
    check('caught: creature sounds back', pg.evaluate('window.__horror.audio.suspended') is False)
    time.sleep(0.6)
    pg.screenshot(path=f'{OUT}/after_caught.png')

    # 세이노가 살아 있는 채로 끝까지 한다
    pg.evaluate('window.__horrorBot = { careful: true }')
    pg.wait_for_function("window.__horror.state === 'end'", timeout=540000, polling=500)
    end = game(pg)
    print('escaped', end)
    check('escape: full game finished', end['have'] == 3 and end['powered'], end)
    pg.screenshot(path=f'{OUT}/escape.png')
    saved = pg.evaluate("JSON.parse(localStorage.getItem('shock-hero-save-v1'))")
    print('saved', saved['horror'], saved['gems'] - gems0)
    check('escape: saved once', saved['horror']['escapes'] == 1 and saved['horror']['cleanEscapes'] == 0 and saved['gems'] - gems0 == 5, saved['horror'])
    check('escape: remembers the day it paid', saved['horror']['gemDay'] is not None, saved['horror'])
    pg.click('#horror button:has-text("타이틀로")')
    time.sleep(1.5)
    check('escape: back to title', pg.evaluate("window.__shockGame.scene.isActive('Title') && !window.__horror"))
    print('errors', errs)
    check('bot: no errors', not errs, errs)
    b.close()


# 세이노가 가까울 때와 멀 때, 순찰과 추격에서 소리 크기를 잰다.
# 세이노는 멈춰 세우고(행동 코드가 모드를 바꾸지 못하게), 소리 쪽에만 모드를 알려 준다.
def play_sound(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 640, 'height': 360})
    errs = []
    watch(pg, errs)
    open_horror(pg)
    pg.evaluate(IDLE_INPUT)
    time.sleep(5)  # 음악이 차오르기를 기다린다
    pg.evaluate("Object.assign(window.__horror, { onStalkerEvents: () => {} })")
    pg.evaluate("""() => {
      const a = window.__horror.audio, real = a.updateStalker.bind(a);
      window.__soundMode = 'patrol';
      a.updateStalker = (cam, pos, mode, d, dt) => real(cam, pos, window.__soundMode, d, dt);
    }""")
    res = {}
    for mode in ('patrol', 'chase'):
        for where, dx in (('far', None), ('near', 2.5)):
            at = "x: 24.5, y: 4.5" if dx is None else f"x: g.p.x + {dx}, y: g.p.y"
            pg.evaluate("(mode) => { window.__soundMode = mode; }", mode)
            pg.evaluate("() => { const g = window.__horror; Object.assign(g.stalker, { %s, heading: -Math.PI / 2, mode: 'stunned', stunT: 9999, path: [] }); }" % at)
            time.sleep(3)  # 소리 크기가 자리 잡기를 기다린다
            res[f'{mode}_{where}'] = pg.evaluate(AUDIO_PROBE, 6)
            print('sound', mode, where, res[f'{mode}_{where}'])
    r = {k: v['rms'] for k, v in res.items()}
    print('rms', {k: round(v, 3) for k, v in r.items()})
    # 압축기가 평균 크기를 고르게 만들어도 추격은 멀 때보다 눈에 띄게 커야 한다
    check('sound: chase near is clearly louder than chase far', r['chase_near'] > r['chase_far'] * 1.25, r)
    # 압축기가 가까운 소리의 평균 크기를 한 선에 눌러서, 가까운 순찰과 가까운 추격은 비슷하게 나온다. 대신 추격 때 음악이 낮아진 것을 본다
    check('sound: music ducks in chase', r['chase_far'] < r['patrol_far'] * 0.7, r)
    check('sound: chase near is louder than patrol far', r['chase_near'] > r['patrol_far'] * 1.25, r)
    check('sound: not clipping', max(v['peak'] for v in res.values()) < 0.98, res)
    print('errors', errs)
    b.close()


# 전원을 켠 것처럼 만들고 정문으로 나간다. 끝 화면 글자와 저장을 돌려준다
def quick_escape(pg, clean):
    open_horror(pg)
    pg.evaluate(PARK_STALKER)
    pg.evaluate("(clean) => { const g = window.__horror; g.run.powered = true; g.run.caughtCount = clean ? 0 : 1; g.win(); }", clean)
    time.sleep(0.3)
    text = pg.inner_text('#horror')
    pg.screenshot(path=f'{OUT}/end_{quick_escape.n}.png')
    quick_escape.n += 1
    pg.click('#horror button:has-text("타이틀로")')
    pg.wait_for_function('!window.__horror', timeout=10000)
    time.sleep(0.8)
    return text, pg.evaluate("JSON.parse(localStorage.getItem('shock-hero-save-v1'))")


quick_escape.n = 1


def play_rewards(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 640, 'height': 360})
    errs = []
    watch(pg, errs)
    pg.goto(URL)
    pg.evaluate("localStorage.removeItem('shock-hero-save-v1')")
    t1, s1 = quick_escape(pg, True)
    check('gems: first escape pays both', '보석 10개' in t1 and s1['gems'] == 10, (t1, s1['gems']))
    t2, s2 = quick_escape(pg, True)
    check('gems: second escape today pays none and says so', '오늘은 이미 보석을 받았어요' in t2 and s2['gems'] == 10 and s2['horror']['escapes'] == 2, (t2, s2['gems']))
    # 어제 받은 것으로 바꾸면 탈출 보석만 다시 받는다
    pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('shock-hero-save-v1')); s.horror.gemDay = '2020-01-01'; localStorage.setItem('shock-hero-save-v1', JSON.stringify(s)); }")
    t3, s3 = quick_escape(pg, True)
    check('gems: next day pays the escape, no second bonus', '보석 5개' in t3 and s3['gems'] == 15, (t3, s3['gems']))
    check('gems: no errors', not errs, errs)
    b.close()


# 화면을 잃어도 까만 화면에서 쫓기지 않는다. WEBGL_lose_context 로 진짜 잃게 한다
def play_lost(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 640, 'height': 360})
    open_horror(pg)
    pg.evaluate(PARK_STALKER)
    pg.evaluate("window.__lostExt = window.__horror.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lostExt.loseContext()")
    time.sleep(0.8)
    check('lost: pauses', game(pg)['state'] == 'paused', game(pg))
    check('lost: tells the player', '화면이 잠깐 꺼졌어요' in pg.inner_text('#horror'))
    pg.screenshot(path=f'{OUT}/lost.png')
    pg.click('#horror button:has-text("계속하기")')
    time.sleep(0.3)
    check('lost: resume waits for the screen', game(pg)['state'] == 'paused', game(pg))
    pg.evaluate('window.__lostExt.restoreContext()')
    time.sleep(1.5)
    check('restored: stays on pause', game(pg)['state'] == 'paused', game(pg))
    check('restored: says so', '화면이 돌아왔어요' in pg.inner_text('#horror'))
    pg.screenshot(path=f'{OUT}/restored.png')
    pg.click('#horror button:has-text("계속하기")')
    time.sleep(1.5)
    check('restored: resume plays', game(pg)['state'] == 'play' and '화면이' not in pg.inner_text('#horror'), game(pg))
    pg.screenshot(path=f'{OUT}/restored_play.png')
    # 다시 잃은 채로 타이틀로 나가도 깨끗해야 한다
    pg.evaluate('window.__horror.pause()')
    pg.evaluate('window.__lostExt.loseContext()')
    time.sleep(0.5)
    pg.click('#horror button:has-text("타이틀로")')
    time.sleep(1.5)
    check('lost: quit still reaches title', pg.evaluate("window.__shockGame.scene.isActive('Title') && !document.getElementById('horror') && !window.__horror"))
    check('exit clears the bot helpers', pg.evaluate('!window.__horrorLogic'))
    # 잡히는 중에 잃으면 돌아오는 순간 멈춘다
    open_horror(pg)
    pg.evaluate(PARK_STALKER)
    pg.evaluate(FAKE_LOCK)
    pg.evaluate("window.__horror.getCaught(); window.__horror.renderer.getContext().getExtension('WEBGL_lose_context').loseContext()")
    pg.wait_for_function("window.__horror.state !== 'caught'", timeout=20000)
    check('lost in caught: pauses after respawn', game(pg)['state'] == 'paused', game(pg))
    b.close()


def play_robust(pw):
    play_rewards(pw)
    play_lost(pw)
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 640, 'height': 360})
    errs = []
    watch(pg, errs)
    open_horror(pg)
    pg.evaluate(IDLE_INPUT)
    pg.evaluate(PARK_STALKER)
    time.sleep(0.5)

    # 세이노 숨기기: 벽 너머 먼 곳, 복도 끝, 사물함 안, 벽 너머로 잡힐 때
    def shown():
        time.sleep(0.25)
        return pg.evaluate('window.__horror.model.group.visible')
    check('cull: far behind walls is hidden', not shown())
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 9.5, y: 15.5 }); window.__horror.p = { x: 1.5, y: 15.5 }")
    check('cull: far down a corridor is drawn', shown())
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 9.5, y: 14.5 }); window.__horror.p = { x: 1.5, y: 14.5 }")
    check('cull: same distance behind a wall is hidden', not shown())
    pg.evaluate("window.__horror.toggleLocker(0)")
    check('cull: always drawn from inside a locker', shown())
    pg.evaluate("window.__horror.toggleLocker(0)")
    check('cull: hidden again after leaving', not shown())
    pg.evaluate(FAKE_LOCK)
    pg.evaluate("window.__horror.getCaught()")
    check('cull: drawn in the caught scene', pg.evaluate('window.__horror.model.group.visible'))
    pg.wait_for_function("window.__horror.state === 'play'", timeout=20000)
    check('cull: far again after respawn', not shown())
    pg.evaluate("delete document.pointerLockElement")

    # 마우스가 풀린 채 다시 시작하면 멈춘다
    pg.evaluate("window.__horror.getCaught()")
    pg.wait_for_function("window.__horror.state !== 'caught'", timeout=20000)
    check('respawn unlocked: pauses', game(pg)['state'] == 'paused', game(pg))
    pg.click('#horror button:has-text("계속하기")')
    time.sleep(0.3)
    pg.evaluate(PARK_STALKER)

    # 일시정지와 창 나가기는 손가락을 놓은 것으로 친다
    held = "(() => { const i = window.__horror.input; i.stick = { id: 1, x0: 0, y0: 0, x: 0, y: -40 }; i.lookTouch = { id: 2, x: 0, y: 0 }; })()"
    pg.evaluate(held)
    pg.evaluate("window.dispatchEvent(new Event('blur'))")
    check('input: blur clears fingers', pg.evaluate('!window.__horror.input.stick && !window.__horror.input.lookTouch'))
    pg.evaluate(held)
    pg.evaluate('window.__horror.pause()')
    check('input: pause clears fingers', pg.evaluate('!window.__horror.input.stick && !window.__horror.input.lookTouch'))
    pg.click('#horror button:has-text("계속하기")')
    time.sleep(0.3)

    # 가려졌던 긴 프레임은 해상도를 내리지 않는다
    low = pg.evaluate("""() => {
      const g = window.__horror, r = g.ratio, f = g.fpsFrames;
      for (let i = 0; i < 8; i++) g.trackFps(1);
      return { same: g.ratio === r, frames: g.fpsFrames === f };
    }""")
    check('fps: long gaps are ignored', low['same'] and low['frames'], low)

    # 글자가 같으면 화면을 건드리지 않는다
    writes = pg.evaluate("""async () => {
      const el = window.__horror.hud.prompt; let n = 0;
      const o = new MutationObserver((l) => { n += l.length; });
      o.observe(el, { childList: true, characterData: true, subtree: true });
      await new Promise((r) => setTimeout(r, 500));
      o.disconnect();
      return n;
    }""")
    check('prompt: no writes while unchanged', writes == 0, writes)

    # 비상등: 평소에는 깜빡이고, 효과 줄이기면 멈춰서 어둡다
    sample = """async () => {
      const m = window.__horror.world.lightMat, seen = new Set();
      for (const end = performance.now() + 3000; performance.now() < end; ) {
        await new Promise((r) => requestAnimationFrame(r));
        seen.add(m.color.r.toFixed(3));
      }
      return [...seen].map(Number);
    }"""
    normal = pg.evaluate(sample)
    pg.evaluate('window.__horror.lowFx = true')
    time.sleep(0.2)
    steady = pg.evaluate(sample)
    pg.evaluate('window.__horror.lowFx = false')
    check('lights: flicker normally', len(normal) > 5, len(normal))
    check('lights: steady and dim on lowFx', len(steady) == 1 and steady[0] < max(normal), steady)
    print('decor counts', pg.evaluate('window.__horror.world.counts'))
    check('robust: no errors', not errs, errs)

    # 나가기 정리가 터져도 타이틀로 돌아간다
    pg.evaluate("(() => { window.__horror.model.dispose = () => { throw new Error('시험 삼아 터뜨림'); }; })()")
    pg.evaluate("try { window.__horror.exit(); } catch (e) { window.__exitThrew = true; }")
    time.sleep(1.5)
    check('exit: a throw still reaches title', pg.evaluate("window.__exitThrew === true && window.__shockGame.scene.isActive('Title') && !document.getElementById('horror') && !window.__horror"))

    # 소리를 못 켜도 조용히 이어서 한다
    errs.clear()
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(0.5)
    pg.evaluate("import('/src/audio/sfx.js').then(({ sfx }) => { sfx.unlock = () => { throw new Error('시험 삼아 소리 막기'); }; })")  # 입구를 지난 뒤에 막는다
    time.sleep(0.3)
    pg.click('#horror button:has-text("시작")')
    time.sleep(1)
    bad = [e for e in errs if 'pageerror' in e]
    check('audio failure: plays silent, no per-frame errors', game(pg)['state'] == 'play' and not pg.evaluate('window.__horror.audio') and not bad and len(errs) == 1, errs[:3])
    b.close()


def run_play(pw):
    play_robust(pw)
    play_controls(pw)
    play_sound(pw)
    play_bot(pw)


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

    # 사용 버튼, 펀치 버튼. 세이노는 멀리 세워 두고 시작 방 상자 옆으로 간다
    pg.evaluate(PARK_STALKER)
    stand_at(pg, 2.5, 17.5)
    check('touch: prompt says 사용', '사용: 쇼크 충전' in game(pg)['prompt'], game(pg))
    pg.screenshot(path=f'{OUT}/hud_1024.png')
    tap(t, button_xy(pg, '사용'))
    check('touch: use button charges', game(pg)['shock'], game(pg))
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 4.5, y: 17.5, heading: -Math.PI / 2, mode: 'patrol', stunT: 0, path: [] })")
    tap(t, button_xy(pg, '펀치'))
    check('touch: punch button stuns', game(pg)['mode'] == 'stunned' and not game(pg)['shock'], game(pg))
    pg.evaluate(PARK_STALKER)

    # 숨은 채로도 사용 버튼이 보이고 눌린다
    stand_at(pg, 5.5, 13.5)
    tap(t, button_xy(pg, '사용'))
    check('touch: use button hides', game(pg)['hidden'] is not None, game(pg))
    pg.screenshot(path=f'{OUT}/touch_locker.png')
    check('touch: use button on top of slit', pg.evaluate("""() => {
      const b = [...document.querySelectorAll('#horror button')].find((e) => e.textContent === '사용');
      const s = getComputedStyle(b), r = b.getBoundingClientRect();
      return Number(s.zIndex) > Number(window.__horror.hud.slit.style.zIndex) && document.elementFromPoint(r.left + 40, r.top + 40) === b;
    }"""))
    tap(t, button_xy(pg, '사용'))
    check('touch: use button leaves', game(pg)['hidden'] is None, game(pg))

    # 멈춤 버튼: 일시정지하고, 타이틀로 버튼으로 돌아온다
    tap(t, button_xy(pg, '멈춤'))
    check('touch: pause button pauses', game(pg)['state'] == 'paused', game(pg))
    pg.screenshot(path=f'{OUT}/touch_pause.png')
    tap(t, button_xy(pg, '계속하기'))
    check('touch: resume button plays', game(pg)['state'] == 'play', game(pg))
    tap(t, button_xy(pg, '멈춤'))
    tap(t, button_xy(pg, '타이틀로'))
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
    tap(t, button_xy(pg, '타이틀로'))
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
    {'keys': run_keys, 'shots': run_shots, 'touch': run_touch, 'creature': run_creature, 'play': run_play, 'sound': play_sound, 'robust': play_robust}[MODE](pw)
    if MODE == 'keys':
        run_play(pw)
if fails:
    print('FAILED:', fails)
    sys.exit(1)
