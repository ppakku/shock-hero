# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/run_horror.py 출력폴더           (키보드로 걷기, 화면 찍기)
#   python3 tools/run_horror.py 출력폴더 --touch   (태블릿 손가락 입력을 진짜 터치 이벤트로 확인)
#   python3 tools/run_horror.py 출력폴더 --shots   (벽 앞 손전등 켠/끈 화면만 찍기)
#   python3 tools/run_horror.py 출력폴더 --creature (괴물 장면과 fps 만 빠르게 확인)
#   python3 tools/run_horror.py 출력폴더 --rounds  (아홉 조합을 진짜 게임에서 봇으로 끝까지 하고, 괴물 규칙과 그리기 수를 보고, 사진을 찍기)
#   python3 tools/run_horror.py 출력폴더 --last    (도장판을 채워 마지막 밤을 고르기 화면에서 열고 봇으로 끝까지. PC 와 휴대폰 크기)
#   python3 tools/run_horror.py 출력폴더 --tonight (오늘의 밤 카드로 시작해 다섯 조건을 봇으로 지키고 깨서 끝까지. PC 와 휴대폰 크기)
#   python3 tools/run_horror.py 출력폴더 --replay  (한 판 더를 여러 번 눌러 판이 바뀌고 오디오 노드까지 남는 것이 없는지 보기)
#   python3 tools/run_horror.py 출력폴더 --sound   (세이노가 가깝고 멀 때, 순찰과 추격의 소리 크기만 재기)
#   python3 tools/run_horror.py 출력폴더 --robust  (화면 꺼짐, 보석, 소리 실패, 나가기 실패, 세이노 숨기기, 비상등. --play 에도 들어 있다)
#   python3 tools/run_horror.py 출력폴더 --phone   (휴대폰 가로 화면: 안내, 쪽지, 손가락이 쪽지를 지나 걷기)
#   python3 tools/run_horror.py 출력폴더 --stalk   (진짜 행동 코드로 바라보기와 매복. --play 에도 들어 있다)
#   python3 tools/run_horror.py 출력폴더 --play    (줍기, 숨기, 펀치, 일시정지, 잡힘, 봇의 탈출까지. 기본 실행에도 들어 있다)
# 시스템 Chrome 으로 타이틀에서 공포 모드를 켜고 확인한다.
import json, math, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
MODE = 'tonight' if '--tonight' in sys.argv else 'last' if '--last' in sys.argv else 'replay' if '--replay' in sys.argv else 'rounds' if '--rounds' in sys.argv else 'touch' if '--touch' in sys.argv else 'shots' if '--shots' in sys.argv else 'creature' if '--creature' in sys.argv else 'play' if '--play' in sys.argv else 'sound' if '--sound' in sys.argv else 'robust' if '--robust' in sys.argv else 'phone' if '--phone' in sys.argv else 'stalk' if '--stalk' in sys.argv else 'keys'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
if os.environ.get('HORROR_GPU'):  # 소프트웨어 대신 이 컴퓨터의 진짜 그래픽 칩으로 잰다
    ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist']
IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
PORT = os.environ.get('HORROR_PORT', '5288')  # 다른 일과 겹치면 포트를 바꿔 돌린다
URL = f'http://localhost:{PORT}/?timer&fps&map=factory&monster=seino'  # 좌표를 쓰는 검사는 공장과 세이노로 고정한다
FREE_URL = f'http://localhost:{PORT}/?timer&fps'  # 맵과 괴물을 게임이 고른다
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
    near = {'x': 2.5, 'y': 16.5}
    front = {'at': {'x': 5.0, 'y': 16.5}, 'heading': -math.pi / 2, 'player': near, 'yaw': east, 'pitch': 0.05, 'light': True}
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
    creature_shot(pg, 'creature_face', **{**front, 'player': {'x': 3.8, 'y': 16.5}, 'pitch': 0.42})
    creature_shot(pg, 'creature_dark', **{**front, 'at': {'x': 9.5, 'y': 16.5}, 'player': {'x': 1.5, 'y': 16.5}, 'light': False, 'pitch': 0.05})
    creature_shot(pg, 'creature_dark_chase', **{**front, 'at': {'x': 9.5, 'y': 16.5}, 'player': {'x': 1.5, 'y': 16.5}, 'light': False, 'pitch': 0.05}, pose='chase')
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
    pg.evaluate(PLACE_CREATURE, {**front, 'at': {'x': 6.5, 'y': 16.5}, 'pose': 'patrol', 'speed': 0, 'fov': 70})
    pg.evaluate("""() => {
      const g = window.__horror;
      g.model.update = g.model.constructor.prototype.update;
      g.p = { x: 1.5, y: 16.5 };
      Object.assign(g.stalker, { mode: 'investigate', stunT: 0, target: { cx: 2, cy: 16 }, path: [{ cx: 5, cy: 16 }, { cx: 4, cy: 16 }, { cx: 3, cy: 16 }] });
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
      Object.assign(g.stalker, { x: 5.5, y: 16.5, mode: 'stunned', stunT: 999, path: [] });
      const shown = { x: 5.5, y: 16.5, heading: 0, mode: 'search' }; // 주인공이 옆에 있다
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
      const shown = { x: 5.5, y: 16.5, heading: -Math.PI / 2, mode: 'chase' };
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


# 바쁜 컴퓨터에서는 프레임이 늦다. 정해진 시간을 재우는 대신 그렇게 될 때까지 기다린다
def becomes(pg, expr, timeout=5000):
    try:
        pg.wait_for_function(expr, timeout=timeout, polling=30)
        return True
    except Exception:
        return False


def stand_at(pg, x, y):
    pg.evaluate('([x, y]) => { window.__horror.p = { x, y }; }', [x, y])
    time.sleep(0.4)


def note_state(pg):
    return pg.evaluate("({ open: window.__horror.hud.noteOpen, found: window.__horror.notes.found, hidden: window.__horror.hidden, status: window.__horror.hud.status.textContent, prompt: window.__horror.hud.prompt.textContent })")


def stand_at_note(pg, i, off=0):
    s = pg.evaluate('(i) => window.__horror.notes.spots[i]', i)
    stand_at(pg, s['x'] + off, s['y'])
    return s


# 쪽지: 진짜 E 와 Enter 로 읽고 닫는다. 닫는 키는 닫기만 하고, 세이노와 걷기는 멈추지 않는다
def note_checks(pg):
    check('note: all spots placed', pg.evaluate('window.__horror.notes.total') == 8 and all(pg.evaluate('window.__horror.notes.spots.map((s) => Number.isFinite(s.x) && Number.isFinite(s.y))')))
    check('note: status starts at 0', '쪽지 0/8' in note_state(pg)['status'], note_state(pg))
    # 쪽지 자리 번호는 판마다 섞여서 어느 칸이 나올지 모른다. 벽이 아닌 옆 칸에 서서 내려다본다
    pg.evaluate("""() => {
      const g = window.__horror, s = g.notes.spots[0];
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([x, y]) => g.map.rows[Math.floor(s.y) + y][Math.floor(s.x) + x] === '.');
      g.p = { x: s.x + dx * 0.9, y: s.y + dy * 0.9 };
      g.yaw = Math.atan2(dx, dy);
      g.pitch = -0.6;
    }""")
    time.sleep(0.5)
    pg.screenshot(path=f'{OUT}/note_world.png')
    check('note: prompt', 'E: 쪽지 읽기' in note_state(pg)['prompt'], note_state(pg))
    check('note: paper is drawn', pg.evaluate('window.__horror.noteMeshes[0].visible && window.__horror.noteMeshes[0].parent.visible'))
    pg.keyboard.press('e')
    time.sleep(0.4)
    n = note_state(pg)
    check('note: E opens it', n['open'] and n['found'] == 1 and '쪽지 1/8' in n['status'], n)
    check('note: paper is gone from the world', not pg.evaluate('window.__horror.noteMeshes[0].visible'))
    check('note: shows the first story note', pg.evaluate("window.__horror.hud.noteEl.textContent.includes('밤 근무표')"))
    check('note: prompt says how to close', 'E: 쪽지 닫기' in n['prompt'], n)
    pg.screenshot(path=f'{OUT}/note_1280.png')
    t0 = pg.evaluate('window.__horror.playTime')
    time.sleep(0.5)
    check('note: the game keeps running', pg.evaluate('window.__horror.playTime') > t0 + 0.2)
    p0 = game(pg)['p']
    pg.keyboard.down('w')
    time.sleep(0.5)
    pg.keyboard.up('w')
    p1 = game(pg)['p']
    check('note: keys still walk while it is open', math.hypot(p1['x'] - p0['x'], p1['y'] - p0['y']) > 0.2 and note_state(pg)['open'], (p0, p1))
    # 사물함 앞에서 닫아도 숨지 않는다
    lock = pg.evaluate('window.__horror.map.lockers[0]')
    front = pg.evaluate("(c) => { const g = window.__horror, f = window.__horrorLogic.frontOf(g.map, c); return { x: f.cx + 0.5, y: f.cy + 0.5 }; }", lock)
    stand_at(pg, front['x'], front['y'])
    check('note: a locker is in reach', pg.evaluate("window.__horror.nearestUse().kind") == 'locker')
    pg.keyboard.press('e')
    time.sleep(0.4)
    n = note_state(pg)
    check('note: E only closes, it does not hide', not n['open'] and n['hidden'] is None, n)
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('note: next E uses the locker', note_state(pg)['hidden'] is not None, note_state(pg))
    pg.keyboard.press('e')
    time.sleep(0.4)
    # 나란히 있는 쪽지가 있어도 닫는 키가 다음 쪽지를 집지 않는다
    stand_at_note(pg, 1)
    pg.evaluate("(() => { const g = window.__horror; g.notes.spots[2] = { ...g.notes.spots[1], x: g.notes.spots[1].x + 0.4 }; })()")
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('note: second note', note_state(pg)['found'] == 2 and note_state(pg)['open'], note_state(pg))
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('note: closing does not take the next one', note_state(pg)['found'] == 2 and not note_state(pg)['open'], note_state(pg))
    pg.keyboard.press('e')
    time.sleep(0.3)
    check('note: third note opens', note_state(pg)['found'] == 3 and note_state(pg)['open'], note_state(pg))
    # 누르고 있어서 생긴 반복 입력은 닫지 않는다, Enter 는 닫는다
    pg.keyboard.down('Enter')
    time.sleep(0.2)
    check('note: Enter closes', not note_state(pg)['open'], note_state(pg))
    pg.keyboard.up('Enter')
    stand_at_note(pg, 3)
    pg.keyboard.down('e')
    time.sleep(0.2)
    pg.keyboard.down('e')  # 두 번째 down 은 반복 입력이다
    pg.keyboard.down('e')
    time.sleep(0.3)
    pg.keyboard.up('e')
    check('note: holding E does not flick it shut', note_state(pg)['open'] and note_state(pg)['found'] == 4, note_state(pg))
    # 일시정지, 잡힘, 쫓김은 쪽지를 닫는다
    pg.keyboard.press('Escape')
    time.sleep(0.4)
    check('note: pause closes it', game(pg)['state'] == 'paused' and not note_state(pg)['open'], note_state(pg))
    pg.screenshot(path=f'{OUT}/pause_with_notes.png')
    read_notes_keyboard(pg)
    pg.click('#horror button:has-text("계속하기")')
    time.sleep(0.3)
    held = note_state(pg)
    check('note: resume shows the same note again', held['open'] and held['found'] == 4 and pg.evaluate("window.__horror.hud.noteEl.textContent.includes(window.__horror.hud.noteLines[0])"), held)
    pg.keyboard.press('e')
    time.sleep(0.3)
    check('note: reopened note closes with E', not note_state(pg)['open'] and note_state(pg)['hidden'] is None, note_state(pg))
    stand_at_note(pg, 4)
    pg.keyboard.press('e')
    time.sleep(0.3)
    check('note: open before the catch', note_state(pg)['open'])
    pg.evaluate(FAKE_LOCK)
    pg.evaluate('window.__horror.getCaught()')
    check('note: caught closes it', not note_state(pg)['open'] and not pg.evaluate("document.querySelector('#horror button')"), note_state(pg))
    check('note: caught note can be read later', pg.evaluate('window.__horror.notes.read.length') == 5)
    pg.keyboard.press('e')  # 잡히는 장면의 E 는 아무 일도 없다
    pg.wait_for_function("window.__horror.state === 'play'", timeout=20000)
    time.sleep(0.3)
    check('note: play goes on after the catch', not note_state(pg)['open'] and game(pg)['state'] == 'play', game(pg))
    check('note: says where to read it again', '일시정지' in pg.evaluate('window.__horror.hud.message.textContent'), pg.evaluate('window.__horror.hud.message.textContent'))
    pg.evaluate("delete document.pointerLockElement")
    pg.evaluate(PARK_STALKER)
    stand_at_note(pg, 5)
    pg.keyboard.press('e')
    time.sleep(0.3)
    pg.evaluate("window.__horror.onStalkerEvents(['chase'])")
    check('note: a chase clears the view', not note_state(pg)['open'], note_state(pg))
    check('note: chase says where to read it again', '일시정지' in pg.evaluate('window.__horror.hud.message.textContent'), pg.evaluate('window.__horror.hud.message.textContent'))
    time.sleep(0.2)
    # 쫓기는 동안에는 쪽지를 고르지 않는다
    stand_at_note(pg, 6)
    use = pg.evaluate("""() => {
      const g = window.__horror, was = g.stalker.mode, before = g.nearestUse().kind;
      g.stalker.mode = 'chase';
      const during = g.nearestUse()?.kind ?? null;
      g.stalker.mode = was;
      return { before, during };
    }""")
    check('note: not offered during a chase', use['before'] == 'note' and use['during'] != 'note', use)


# 키보드만으로 읽은 쪽지를 넘겨 보고 일시정지로 돌아온다
def read_notes_keyboard(pg):
    layer = lambda: pg.inner_text('#horror')
    check('read notes: button on the pause layer', '읽은 쪽지' in layer())
    pg.keyboard.press('Tab')  # 계속하기 다음 버튼
    pg.keyboard.press('Enter')
    time.sleep(0.2)
    check('read notes: Enter opens the latest', '읽은 쪽지 4/4' in layer(), layer()[:80])
    pg.screenshot(path=f'{OUT}/read_notes.png')
    pg.keyboard.press('Enter')  # 처음 초점은 이전 쪽지
    time.sleep(0.2)
    check('read notes: previous note', '읽은 쪽지 3/4' in layer(), layer()[:80])
    pg.keyboard.press('Tab')
    pg.keyboard.press('Tab')
    pg.keyboard.press('Enter')
    time.sleep(0.2)
    check('read notes: back to pause', '계속하기' in layer() and '돌아가기' not in layer(), layer()[:80])
    check('read notes: still paused', game(pg)['state'] == 'paused')


# 파란 문: 진짜 E 키로 열쇠를 줍고 열고 지나간다
def blue_door(pg):
    door = pg.evaluate('window.__horror.run.doors[1]')
    front = (door['cx'] + 0.5, door['cy'] - 0.5)  # 날개 2 는 문 아래쪽이다
    stand_at(pg, *front)
    pg.evaluate('window.__horror.yaw = Math.PI; window.__horror.pitch = 0')
    time.sleep(0.5)
    pg.screenshot(path=f'{OUT}/door_blue.png')
    check('blue door: asks for the blue key', '파란 열쇠가 필요해' in game(pg)['prompt'], game(pg))
    pg.keyboard.press('e')
    time.sleep(0.3)
    check('blue door: stays shut without key', not pg.evaluate('window.__horror.run.doors[1].open'))
    key = pg.evaluate('window.__horror.run.keys[1]')
    stand_at(pg, key['cx'] + 0.5, key['cy'] + 0.5)
    check('blue key: prompt', '파란 열쇠 줍기' in game(pg)['prompt'], game(pg))
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('blue key: E takes it', pg.evaluate('window.__horror.run.keys[1].taken && !window.__horror.keyMeshes[1].visible') and '열쇠 1' in game(pg)['status'], game(pg))
    stand_at(pg, *front)
    check('blue door: prompt with key', 'E: 문 열기' in game(pg)['prompt'], game(pg))
    pg.keyboard.press('e')
    time.sleep(0.6)
    pg.screenshot(path=f'{OUT}/door_blue_opening.png')
    time.sleep(1)
    check('blue door: E opens it', pg.evaluate('window.__horror.run.doors[1].open') and '열쇠 0' in game(pg)['status'], game(pg))
    pg.keyboard.down('w')
    time.sleep(2.5)
    pg.keyboard.up('w')
    check('blue door: walks through', game(pg)['p']['y'] > door['cy'] + 0.5, game(pg))


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
    stand_at(pg, 23.5, 25.5)
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('panel: needs fuses', not game(pg)['powered'] and '필요해' in game(pg)['prompt'], game(pg))

    # 잠긴 문: 열쇠가 없으면 안내만, 진짜 E 키로 줍고 연다
    door = pg.evaluate('window.__horror.run.doors[0]')
    front = (door['cx'] + 0.5, door['cy'] + 1.5)
    stand_at(pg, *front)
    pg.evaluate('window.__horror.yaw = 0')
    time.sleep(0.5)
    # 문 앞 칸의 눈길은 이때 저장된다. 날개 안쪽 구역은 문이 열려야 그린다
    pg.wait_for_function("window.__horror.scene.children.find((c) => c.userData.index === Math.floor(window.__horror.run.doors[0].cy / 7) * Math.ceil(window.__horror.map.w / 7) + Math.floor(window.__horror.run.doors[0].cx / 7)).visible", timeout=10000)
    wing_chunk = "window.__horror.scene.children.find((c) => c.userData.index === (Math.floor((window.__horror.run.doors[0].cy - 7) / 7) * Math.ceil(window.__horror.map.w / 7) + Math.floor(window.__horror.run.doors[0].cx / 7))).visible"
    check('door: wing chunk hidden while shut', not pg.evaluate(wing_chunk))
    pg.screenshot(path=f'{OUT}/door_locked.png')
    check('door: needs key', '열쇠가 필요해' in game(pg)['prompt'], game(pg))
    pg.keyboard.press('e')
    time.sleep(0.3)
    check('door: stays shut without key', not pg.evaluate('window.__horror.run.doors[0].open'))
    key = pg.evaluate('window.__horror.run.keys[0]')
    stand_at(pg, key['cx'] + 0.5, key['cy'] + 0.5)
    check('key: prompt', '열쇠 줍기' in game(pg)['prompt'], game(pg))
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('key: E takes it', pg.evaluate('window.__horror.run.keys[0].taken && !window.__horror.keyMeshes[0].visible') and '열쇠 1' in game(pg)['status'], game(pg))
    stand_at(pg, *front)
    check('door: prompt with key', 'E: 문 열기' in game(pg)['prompt'], game(pg))
    pg.keyboard.press('e')
    time.sleep(0.6)
    pg.screenshot(path=f'{OUT}/door_opening.png')
    time.sleep(1)
    pg.screenshot(path=f'{OUT}/door_open.png')
    check('door: E opens it', pg.evaluate('window.__horror.run.doors[0].open') and '열쇠 0' in game(pg)['status'], game(pg))
    check('door: saved sight is dropped, wing chunk drawn from the same cell', pg.evaluate(wing_chunk))
    pg.evaluate("([x, y]) => { const g = window.__horror; g.readInput = () => ({ move: { x: 0, z: 1, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false }); }", list(front))
    time.sleep(2.5)
    pg.evaluate(IDLE_INPUT)
    check('door: walks through', game(pg)['p']['y'] < door['cy'], game(pg))
    pg.evaluate('delete window.__horror.readInput')

    note_checks(pg)
    blue_door(pg)

    # 숨기: 시작 방 사물함 (6, 25)
    stand_at(pg, 5.5, 25.5)
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
    stand_at(pg, 2.5, 25.5)
    pg.keyboard.press('e')
    time.sleep(0.4)
    check('box: E charges', game(pg)['shock'] and '충전됨' in game(pg)['status'], game(pg))
    # 느린 Chrome 에서 먼저 잡히지 않게 세이노는 멈춘 채 옆에 두고, 펀치가 멈춤 시간을 새로 맞추는지 본다
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 4.5, y: 25.5, stunT: 9999 })")
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
    pg.evaluate("window.__lows = []; const g = window.__horror; const t = setInterval(() => window.__lows.push(g.flash.intensity), 30); setTimeout(() => clearInterval(t), 3500)")
    stand_at(pg, sc['cx'] + 0.5, sc['cy'] + 0.5)
    time.sleep(3.7)
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
    check('scare: second cell starts a flicker', becomes(pg, 'window.__horror.blink !== null') or pg.evaluate('window.__horror.scaresLeft.length') == left - 1, (pg.evaluate('window.__horror.state'), pg.evaluate('window.__horror.scaresLeft.length'), left))
    pg.evaluate(FAKE_LOCK)  # 마우스가 잠겨 있으면 잡힌 뒤 바로 이어진다
    pg.evaluate("window.__horror.getCaught()")
    becomes(pg, 'window.__horror.lunge?.hush <= 0')  # 정적이 끝나야 얼굴이 나온다
    k_ = pg.evaluate("({ blink: window.__horror.blink, i: window.__horror.flash.intensity, base: window.__horror.k.flashIntensity })")
    check('scare: caught cancels the flicker and keeps the face light', k_['blink'] is None and k_['i'] < k_['base'] * 0.5, k_)
    pg.wait_for_function("window.__horror.state === 'play'", timeout=20000)
    check('scare: true brightness back after caught', pg.evaluate('window.__horror.flash.intensity') == base, '')
    pg.evaluate("delete document.pointerLockElement")
    pg.evaluate(PARK_STALKER)
    low = pg.evaluate("() => { const g = window.__horror; g.lowFx = true; g.p = { x: 1.5, y: 1.5 }; const s = g.map.scares[2]; g.p = { x: s.cx + 0.5, y: s.cy + 0.5 }; return null; }")
    becomes(pg, 'window.__horror.scare')
    becomes(pg, '!window.__horror.scare')  # 어둠이 끝난 뒤에 본다
    time.sleep(0.3)
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


# 진짜 행동 코드로 바라보기와 매복에 들어가게 해서 눈빛, 자세, 빠져나오기를 본다
def play_stalk(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    watch(pg, errs)
    open_horror(pg)
    pg.evaluate(IDLE_INPUT)
    time.sleep(2)
    pg.evaluate(FAKE_LOCK)
    pg.evaluate('(() => { const g = window.__horror; g.trackFps = () => {}; g.ratio = 1.5; g.renderer.setPixelRatio(1.5); })()')

    # 바라보기: 넓은 방 끝에서 손전등을 켠 주인공을 본다
    pg.evaluate("""() => {
      const g = window.__horror;
      g.k.watchChance = 1;
      g.lightOn = true;
      g.p = { x: 15.5, y: 21.5 };
      g.yaw = -Math.PI / 2;
      g.pitch = 0.05;
      Object.assign(g.stalker, { x: 22.5, y: 21.5, heading: -Math.PI / 2, mode: 'patrol', stunT: 0, path: [], calmT: 99, graceT: 0, patrolIndex: 0 });
    }""")
    pg.wait_for_function("window.__horror.stalker.mode === 'watch'", timeout=8000, polling=30)
    becomes(pg, 'window.__horror.model.glow > 0.8')  # 눈빛은 게임 시간으로 밝아져서 느린 시험에서는 늦다
    w = pg.evaluate("({ mode: window.__horror.stalker.mode, x: window.__horror.stalker.x, glow: window.__horror.model.glow, stretch: window.__horror.model.pose.stretch, lean: window.__horror.model.pose.lean, shown: window.__horror.model.group.visible, say: window.__horror.hud.message.textContent })")
    print('watch', w)
    pg.screenshot(path=f'{OUT}/watch_live.png')
    check('watch: stands still, eyes bright', w['mode'] == 'watch' and w['x'] == 22.5 and w['glow'] > 0.8, w)
    check('watch: tall upright pose', w['stretch'] > 1.08 and w['lean'] < 0.42, w)
    check('watch: drawn from far', w['shown'], w)
    check('watch: no text warning', w['say'] == '', w)
    pg.evaluate("window.__horror.lightOn = false")
    time.sleep(0.15)
    pg.screenshot(path=f'{OUT}/watch_live_dark.png')
    pg.evaluate("window.__horror.lightOn = true")
    pg.wait_for_function("window.__horror.stalker.mode === 'chase'", timeout=8000, polling=30)
    check('watch: ends in a chase with a warning', '들켰다' in pg.evaluate('window.__horror.hud.message.textContent') and pg.evaluate('window.__horror.stalker.warnT') > 0)

    # 매복: 추격 중 벽 너머로 놓치게 한다
    pg.evaluate("""() => {
      const g = window.__horror;
      g.k.ambushChance = 1;
      g.k.ambushWaitChance = 1;
      g.p = { x: 3.5, y: 8.5 };
      Object.assign(g.stalker, { x: 22.5, y: 21.5, mode: 'chase', path: [], lostT: 99, warnT: 0, stunT: 0 });
    }""")
    pg.wait_for_function("window.__horror.stalker.mode === 'ambush'", timeout=8000, polling=30)
    pg.wait_for_function("window.__horror.stalker.path.length === 0", timeout=60000, polling=100)
    a = pg.evaluate("({ mode: window.__horror.stalker.mode, kind: window.__horror.stalker.ambushKind, say: window.__horror.hud.message.textContent, glow: window.__horror.model.glow })")
    print('ambush', a)
    check('ambush: waits silently', a['mode'] == 'ambush' and a['kind'] == 'wait', a)
    time.sleep(1.5)
    check('ambush: eyes nearly dark', pg.evaluate('window.__horror.model.glow') < 0.2, pg.evaluate('window.__horror.model.glow'))
    # 가까이 가서 눈빛과 자세를 찍는다. 시선이 닿으면 뛰쳐나온다
    spot = pg.evaluate("""() => {
      const g = window.__horror, s = g.stalker, L = window.__horrorLogic;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let n = 5; n >= 3; n--) {
          const c = { x: s.x + dx * n, y: s.y + dy * n };
          if (L.lineOfSight(g.map, c, s)) return { ...c, yaw: Math.atan2(-(s.x - c.x), -(s.y - c.y)) };
        }
      }
      return null;
    }""")
    print('ambush view', spot)
    if spot:
        pg.evaluate("(c) => { const g = window.__horror; g.lightOn = true; g.p = { x: c.x, y: c.y }; g.yaw = c.yaw; g.pitch = 0.05; }", spot)
        time.sleep(0.5)
        pg.screenshot(path=f'{OUT}/ambush_live.png')
    a2 = pg.evaluate("({ mode: window.__horror.stalker.mode, lean: window.__horror.model.pose.lean, stretch: window.__horror.model.pose.stretch, shown: window.__horror.model.group.visible })")
    print('ambush near', a2)
    check('ambush: crouched pose', a2['stretch'] < 0.97, a2)
    pg.evaluate("(() => { const g = window.__horror; const s = g.stalker; g.p = { x: s.x + 2, y: s.y }; if (!window.__horrorLogic.lineOfSight(g.map, g.p, s)) g.p = { x: s.x - 2, y: s.y }; if (!window.__horrorLogic.lineOfSight(g.map, g.p, s)) g.p = { x: s.x, y: s.y + 2 }; if (!window.__horrorLogic.lineOfSight(g.map, g.p, s)) g.p = { x: s.x, y: s.y - 2 }; })()")
    pg.wait_for_function("window.__horror.stalker.mode === 'chase'", timeout=5000, polling=30)
    check('ambush: springs into a chase with a warning', '들켰다' in pg.evaluate('window.__horror.hud.message.textContent') and pg.evaluate('window.__horror.stalker.warnT') > 0)
    print('errors', errs)
    check('stalk: no errors', not errs, errs)
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
    check('end screen: counts notes', '쪽지 0/8' in t1, t1)
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


# 벽 그림을 못 받으면 셔터도 색만 남는다. 색이 열쇠와 맞춰 보는 표시다
def play_no_art(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 640, 'height': 360})
    pg.route('**/art/horror_wall.jpg', lambda r: r.abort())
    pg.route('**/art/horror_door_factory_*.jpg', lambda r: r.abort())  # 문은 자기 그림을 먼저 쓰므로 함께 막아야 벽 그림 대비를 본다
    open_horror(pg)
    time.sleep(1)
    door = pg.evaluate("window.__horror.run.doors[0]")
    stand_at(pg, door['cx'] + 0.5, door['cy'] + 1.5)
    pg.evaluate("window.__horror.yaw = 0")
    time.sleep(0.5)
    pg.screenshot(path=f'{OUT}/door_no_art.png')
    bare = pg.evaluate("window.__horror.scene.children.flatMap((c) => c.children).filter((m) => m.geometry?.parameters?.height === 3 && m.material?.emissiveIntensity === 0.12).map((m) => m.material.map === null)")
    check('no wall art: shutters drop the broken picture', len(bare) == 2 and all(bare), bare)
    b.close()


def play_robust(pw):
    play_rewards(pw)
    play_lost(pw)
    play_no_art(pw)
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
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 9.5, y: 16.5 }); window.__horror.p = { x: 1.5, y: 16.5 }")
    check('cull: far down a corridor is drawn', shown())
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 9.5, y: 15.5 }); window.__horror.p = { x: 1.5, y: 15.5 }")
    check('cull: same distance behind a wall is hidden', not shown())
    pg.evaluate("window.__horror.toggleLocker(0)")
    check('cull: always drawn from inside a locker', shown())
    pg.evaluate("window.__horror.toggleLocker(0)")
    check('cull: hidden again after leaving', becomes(pg, '!window.__horror.model.group.visible'))
    pg.evaluate(FAKE_LOCK)
    pg.evaluate("window.__horror.getCaught()")
    check('cull: drawn in the caught scene', becomes(pg, 'window.__horror.lunge?.hush <= 0 && window.__horror.model.group.visible'))
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
    play_stalk(pw)
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


# 손가락으로 쪽지를 읽고 닫는다. 쪽지 위에 닿은 손가락도 걷고 둘러볼 수 있어야 한다
def touch_notes(pg, t, w, h):
    pg.evaluate(PARK_STALKER)
    label = f'touch {w}x{h}'
    stand_at_note(pg, 0)
    check(f'{label}: prompt', '사용: 쪽지 읽기' in note_state(pg)['prompt'], note_state(pg))
    tap(t, button_xy(pg, '사용'))
    n = note_state(pg)
    check(f'{label}: use button opens the note', n['open'] and n['found'] == 1 and '쪽지 1/8' in n['status'], n)
    pg.screenshot(path=f'{OUT}/note_{w}x{h}.png')
    box = pg.evaluate("(() => { const r = window.__horror.hud.noteEl.getBoundingClientRect(), b = window.__horror.hud.noteEl.querySelector('button').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, scroll: window.__horror.hud.noteEl.scrollHeight, btnBottom: b.bottom, btnTop: b.top }; })()")
    print('note box', box)
    check(f'{label}: fits the screen', box['top'] >= 0 and box['bottom'] <= h and box['scroll'] <= box['height'] + 1 and box['btnBottom'] <= box['bottom'], box)
    longest = pg.evaluate("""async () => {
      const { NOTES, fillName } = await import('/src/horror/story.js'), g = window.__horror, lines = g.hud.noteLines, compact = g.device === 'phone';
      const all = Object.values(NOTES).flat().map((n) => fillName(n, g.monsters[0].name));
      let worst = 0, fits = true, hits = [];
      for (const n of all) {
        g.hud.showNote(n, compact);
        const el = g.hud.noteEl, b = el.querySelector('button').getBoundingClientRect(), r = el.getBoundingClientRect();
        worst = Math.max(worst, r.height);
        fits = fits && b.bottom <= r.bottom && el.scrollHeight <= r.height + 1;
        for (const btn of g.input.buttons) {
          const o = btn.getBoundingClientRect();
          if (o.left < r.right && r.left < o.right && o.top < r.bottom && r.top < o.bottom) hits.push(btn.textContent);
        }
      }
      g.hud.showNote(all[all.length - 1], compact);
      await new Promise((f) => setTimeout(f, 150));
      return { worst, fits, hits: [...new Set(hits)], lines };
    }""")
    print('longest note', longest)
    pg.screenshot(path=f'{OUT}/note_longest_{w}x{h}.png')
    pg.evaluate("(lines) => window.__horror.hud.showNote(lines, window.__horror.device === 'phone')", longest['lines'])
    check(f'{label}: every story note fits', longest['fits'] and longest['worst'] <= h - 16, longest)
    check(f'{label}: note clears every button', not longest['hits'], longest['hits'])
    mid_y = (box['top'] + box['bottom']) / 2
    # 왼쪽 손가락이 쪽지 위에 닿아도 걷는다
    x0 = max(box['left'] + 20, 40)
    s0 = state(pg)
    t.down(1, x0, mid_y)
    t.drag(1, x0, mid_y, x0, mid_y - 40)
    time.sleep(0.5)
    s1 = state(pg)
    t.up(1)
    check(f'{label}: a thumb on the note still walks', math.hypot(s1['x'] - s0['x'], s1['y'] - s0['y']) > 0.1 and note_state(pg)['open'], (s0, s1))
    # 오른쪽 손가락이 쪽지 위에 닿아도 둘러본다
    x1 = box['right'] - 20
    s0 = state(pg)
    t.down(2, x1, mid_y)
    t.drag(2, x1, mid_y, x1 - 60, mid_y, steps=10)
    time.sleep(0.2)
    t.up(2)
    s1 = state(pg)
    check(f'{label}: a finger on the note still looks', abs(s1['yaw'] - s0['yaw']) > 0.05 and note_state(pg)['open'], (s0['yaw'], s1['yaw']))
    tap(t, button_xy(pg, '손전등'))
    check(f'{label}: light button works under the note', not state(pg)['light'], state(pg))
    tap(t, button_xy(pg, '손전등'))
    # 사물함 앞에서 사용 버튼: 닫기만 한다
    pg.evaluate("(() => { const g = window.__horror, f = window.__horrorLogic.frontOf(g.map, g.map.lockers[0]); g.p = { x: f.cx + 0.5, y: f.cy + 0.5 }; })()")
    time.sleep(0.3)
    tap(t, button_xy(pg, '사용'))
    n = note_state(pg)
    check(f'{label}: use button only closes', not n['open'] and n['hidden'] is None, n)
    # 닫기 버튼: 손가락이 조이스틱이 되지 않는다
    stand_at_note(pg, 1)
    tap(t, button_xy(pg, '사용'))
    check(f'{label}: second note opens', note_state(pg)['open'] and note_state(pg)['found'] == 2, note_state(pg))
    xy = button_xy(pg, '닫기')
    t.down(9, xy['x'], xy['y'])
    time.sleep(0.08)
    stuck = pg.evaluate('Boolean(window.__horror.input.stick || window.__horror.input.lookTouch)')
    t.up(9)
    time.sleep(0.4)
    check(f'{label}: close button closes', not note_state(pg)['open'], note_state(pg))
    check(f'{label}: close button is not a stick', not stuck)
    time.sleep(0.2)
    # 손가락으로 읽은 쪽지를 본다
    tap(t, button_xy(pg, '멈춤'))
    pg.screenshot(path=f'{OUT}/pause_{w}x{h}.png')
    tap(t, button_xy(pg, '읽은 쪽지'))
    check(f'{label}: read notes opens by touch', '읽은 쪽지 2/2' in pg.inner_text('#horror'), pg.inner_text('#horror')[:80])
    pg.screenshot(path=f'{OUT}/read_notes_{w}x{h}.png')
    tap(t, button_xy(pg, '이전 쪽지'))
    check(f'{label}: previous note by touch', '읽은 쪽지 1/2' in pg.inner_text('#horror'))
    tap(t, button_xy(pg, '돌아가기'))
    tap(t, button_xy(pg, '계속하기'))
    check(f'{label}: back to play', game(pg)['state'] == 'play', game(pg))


def run_phone(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    errs = []
    for w, h in ((844, 390), (667, 375), (568, 320)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True, user_agent=PHONE_UA, device_scale_factor=2)
        pg = ctx.new_page()
        watch(pg, errs)
        t = Touch(ctx.new_cdp_session(pg))
        pg.goto(URL)
        time.sleep(3)
        pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
        pg.wait_for_function('window.__horror', timeout=20000)
        time.sleep(1)
        pg.screenshot(path=f'{OUT}/phone_intro_{w}x{h}.png')
        check(f'phone {w}: device', pg.evaluate('window.__horror.device') == 'phone')
        intro = pg.evaluate("(() => { const l = window.__horror.hud.layer, r = l.getBoundingClientRect(); const bs = [...l.querySelectorAll('button')].map((x) => x.getBoundingClientRect().bottom); return { scroll: l.scrollHeight, height: r.height, bottom: Math.max(...bs), text: l.textContent }; })()")
        print('phone intro', {k: v for k, v in intro.items() if k != 'text'})
        check(f'phone {w}: intro mentions keys', '열쇠' in intro['text'])
        if intro['scroll'] > intro['height'] + 1:
            print(f'phone {w}: intro needs a scroll', intro['scroll'], intro['height'])
        pg.evaluate("window.__horror.hud.layer.scrollTop = 1e4")
        tap(t, button_xy(pg, '시작'))
        check(f'phone {w}: start', pg.evaluate('window.__horror.state') == 'play')
        touch_notes(pg, t, w, h)
        if w == 844:
            t.down(1, 120, 300)
            t.drag(1, 120, 300, 120, 248)
            time.sleep(0.3)
            pg.screenshot(path=f'{OUT}/joystick_phone.png')
            t.up(1)
        ctx.close()
    print('errors', errs)
    check('phone: no errors', not errs, errs)
    b.close()


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

    t.down(1, 200, 500)
    t.drag(1, 200, 500, 200, 425)
    time.sleep(0.2)
    pg.screenshot(path=f'{OUT}/joystick_tablet.png')
    t.up(1)
    time.sleep(0.2)

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

    # 사용 버튼, 쇼크 버튼. 세이노는 멀리 세워 두고 시작 방 상자 옆으로 간다
    pg.evaluate(PARK_STALKER)
    stand_at(pg, 2.5, 25.5)
    check('touch: prompt says 사용', '사용: 쇼크 충전' in game(pg)['prompt'], game(pg))
    pg.screenshot(path=f'{OUT}/hud_1024.png')
    tap(t, button_xy(pg, '사용'))
    check('touch: use button charges', game(pg)['shock'], game(pg))
    pg.evaluate("Object.assign(window.__horror.stalker, { x: 4.5, y: 25.5, heading: -Math.PI / 2, mode: 'patrol', stunT: 0, path: [] })")
    tap(t, button_xy(pg, '쇼크'))
    check('touch: punch button stuns', game(pg)['mode'] == 'stunned' and not game(pg)['shock'], game(pg))
    pg.evaluate(PARK_STALKER)

    # 숨은 채로도 사용 버튼이 보이고 눌린다
    stand_at(pg, 5.5, 25.5)
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

    touch_notes(pg, t, 1024, 768)

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


# 창과 문서에 달린 듣기 함수 수를 센다. 판이 바뀌어도 늘면 안 된다
COUNT_LISTENERS = """() => {
  window.__listeners = 0;
  for (const t of [window, document]) {
    const add = t.addEventListener.bind(t), rm = t.removeEventListener.bind(t), seen = new WeakMap();
    t.addEventListener = (type, fn, o) => {
      const types = seen.get(fn) ?? new Set();
      if (!types.has(type)) window.__listeners += 1;
      types.add(type);
      seen.set(fn, types);
      add(type, fn, o);
    };
    t.removeEventListener = (type, fn, o) => {
      if (seen.get(fn)?.delete(type)) window.__listeners -= 1;
      rm(type, fn, o);
    };
  }
}"""

ROUND_NOW = """() => {
  const g = window.__horror, root = document.getElementById('horror');
  return {
    round: g.round, state: g.state, have: g.run.have, caught: g.run.caughtCount, notes: g.notes.found,
    home: g.p.x === g.map.start.cx + 0.5 && g.p.y === g.map.start.cy + 0.5, kinds: g.stalker.kind ?? null,
    kids: root.children.length, canvases: root.querySelectorAll('canvas').length, buttons: root.querySelectorAll('button').length,
    listeners: window.__listeners, text: root.innerText,
  };
}"""


AUDIO_VOICE_SPREAD = 8  # 지난 판의 멈춘 노드 수는 괴물 목소리마다 이만큼 다르다


# Chrome 이 실제로 살려 둔 오디오 노드를 센다. JS 쪽 집계는 끝난 소리와 GC 를 못 본다
def watch_audio_nodes(cdp):
    live = set()
    cdp.on('WebAudio.audioNodeCreated', lambda e: live.add(e['node']['nodeId']))
    cdp.on('WebAudio.audioNodeWillBeDestroyed', lambda e: live.discard(e['nodeId']))
    cdp.send('WebAudio.enable')
    return live


# 짧은 소리가 끝나고 GC 가 돈 뒤의 수. 지난 판을 변수로 붙들고 있으면 그만큼 늘어나 보인다
def settled_audio_nodes(cdp, live):
    time.sleep(1.5)
    for _ in range(3):
        cdp.send('HeapProfiler.collectGarbage')
        time.sleep(0.3)
    return len(live)


def play_replay(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 640, 'height': 360})
    errs = []
    watch(pg, errs)
    cdp = pg.context.new_cdp_session(pg)
    nodes = watch_audio_nodes(cdp)
    pg.goto(FREE_URL)
    pg.evaluate("localStorage.removeItem('shock-hero-save-v1')")
    pg.goto(FREE_URL)
    time.sleep(3)
    pg.evaluate(COUNT_LISTENERS)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.click('[data-chooser] button:has-text("들어가기")', timeout=20000)  # 랜덤 그대로 들어간다
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(0.5)
    seen = []
    first = None
    counts = []
    for i in range(12):
        counts.append(settled_audio_nodes(cdp, nodes))
        now = pg.evaluate(ROUND_NOW)
        print('round', i, now['round'], 'kids', now['kids'], 'listeners', now['listeners'])
        seen.append(now['round'])
        first = first or now
        names = pg.evaluate('(() => { const g = window.__horror; return [g.place.name, g.monsters[0].name, g.monsters[0].hint]; })()')
        check(f'replay {i}: intro names the round', all(n in now['text'] for n in names), names)
        check(f'replay {i}: fresh game', now['state'] == 'intro' and now['have'] == 0 and now['caught'] == 0 and now['notes'] == 0 and now['home'], {k: v for k, v in now.items() if k != 'text'})
        check(f'replay {i}: nothing left behind', now['canvases'] == 1 and now['kids'] == first['kids'] and now['listeners'] == first['listeners'], (now['kids'], now['listeners']))
        if i:
            check(f'replay {i}: other map and monster', seen[i]['mapId'] != seen[i - 1]['mapId'] and seen[i]['monsterId'] != seen[i - 1]['monsterId'], seen[i - 1:])
        saved = pg.evaluate("JSON.parse(localStorage.getItem('shock-hero-save-v1')).horror.last")
        check(f'replay {i}: save remembers the round', saved == now['round'], saved)
        pg.screenshot(path=f'{OUT}/replay_intro_{i}.png')
        pg.click('#horror button:has-text("시작")')
        pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
        time.sleep(0.5)
        pg.evaluate('(() => { const g = window.__horror; window.__oldHorror = g; g.run.powered = true; g.win(); })()')
        pg.wait_for_function("window.__horror.state === 'end'", timeout=5000)
        check(f'replay {i}: end screen offers another', '한 판 더' in pg.inner_text('#horror'))
        pg.click('#horror button:has-text("한 판 더")')
        pg.click('[data-chooser] button:has-text("들어가기")', timeout=10000)
        pg.wait_for_function('window.__horror && window.__horror !== window.__oldHorror', timeout=10000)
        check(f'replay {i}: old game is gone', pg.evaluate('(() => { const dead = window.__oldHorror.dead === true; window.__oldHorror = null; return dead; })()'))
        time.sleep(0.4)
    print('audio nodes', counts)
    check('replay: audio nodes do not grow', max(counts[2:]) - min(counts[1:]) <= AUDIO_VOICE_SPREAD, counts)
    check('replay: every map and monster came up', len({r['mapId'] for r in seen}) == 3 and len({r['monsterId'] for r in seen}) == 4, seen)
    pg.click('#horror button:has-text("타이틀로")')
    pg.wait_for_function('!window.__horror && window.__shockGame.scene.isActive("Title")', timeout=10000)
    check('replay: root removed at title', pg.evaluate("!document.getElementById('horror')"))
    ctxwarn = [e for e in errs if 'context' in e.lower()]
    check('replay: no WebGL context warning', not ctxwarn, ctxwarn)
    check('replay: no errors', not errs, errs)
    b.close()


BLANK_INPUT = "({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0, light: false, use: false, punch: false, pause: false })"

# 진짜 게임의 update 를 시간 재지 않고 빨리 돌린다. 그림은 1초에 한 장만 그려서 그리기 수를 잰다
FAST_PLAY = """(limit) => {
  const g = window.__horror;
  g.renderer.setAnimationLoop(null);
  const calls = [];
  let t = 0;
  for (; t < limit && g.state !== 'end'; t += 1 / 30) {
    g.update(1 / 30);
    if (Math.round(t * 30) % 30 === 0) {
      g.renderer.render(g.scene, g.camera);
      calls.push(g.renderer.info.render.calls);
    }
    if (g.state === 'paused') return { paused: true, t };
  }
  return { state: g.state, t: Math.round(t), caught: g.run.caughtCount, mean: Math.round(calls.reduce((a, b) => a + b, 0) / calls.length), max: Math.max(...calls) };
}"""

# 주인공을 시작 칸에 두고 d 칸쯤 떨어진, 곧게 보이는 칸에 괴물을 세운다. 주인공은 그쪽을 본다
FACE_MONSTER = """([near, far, mode]) => {
  const g = window.__horror, L = window.__horrorLogic, s = g.stalker;
  let best = null;
  const spots = [g.map.start, ...g.map.chunks ?? []];
  for (let cy = 1; cy < g.map.h - 1 && !best; cy += 1) for (let cx = 1; cx < g.map.w - 1 && !best; cx += 1) {
    const from = { x: cx + 0.5, y: cy + 0.5 };
    if (!L.reachable(g.map, g.map.start).has(`${cx},${cy}`)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = Math.round((near + far) / 2), to = { x: from.x + dx * n, y: from.y + dy * n };
      if (L.reachable(g.map, g.map.start).has(`${Math.floor(to.x)},${Math.floor(to.y)}`) && L.lineOfSight(g.map, from, to)) { best = { from, to }; break; }
    }
  }
  if (!best) return null;
  g.p = best.from;
  Object.assign(s, { x: best.to.x, y: best.to.y, path: [], mode, stunT: mode === 'stunned' ? 9999 : 0, graceT: 0, warnT: 0 });
  g.yaw = Math.atan2(-(s.x - g.p.x), -(s.y - g.p.y));
  g.pitch = 0;
  return best;
}"""


def open_round(pg, mapId, monsterId):
    pg.goto(f'http://localhost:{PORT}/?timer&fps&map={mapId}&monster={monsterId}')
    time.sleep(2.5)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    pg.click('#horror button:has-text("시작")')
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate(FAKE_LOCK)


def gazer_rule(pg, tag):
    place = pg.evaluate(FACE_MONSTER, [4, 6, 'patrol'])
    check(f'{tag}: found a straight view', place is not None, place)
    pg.evaluate(f'window.__horror.readInput = () => {BLANK_INPUT}')
    time.sleep(0.3)
    a = pg.evaluate('({ x: window.__horror.stalker.x, y: window.__horror.stalker.y, mode: window.__horror.stalker.mode })')
    time.sleep(1.5)
    b = pg.evaluate('({ x: window.__horror.stalker.x, y: window.__horror.stalker.y, mode: window.__horror.stalker.mode })')
    check(f'{tag}: gazer stops while looked at', b['mode'] == 'watch' and a['x'] == b['x'] and a['y'] == b['y'], (a, b))
    pg.screenshot(path=f'{OUT}/{tag}_near.png')
    pg.evaluate('window.__horror.yaw += Math.PI')
    pg.wait_for_function("(() => { const g = window.__horror, s = g.stalker; return s.mode !== 'watch' && Math.hypot(s.x - g.p.x, s.y - g.p.y) < 3.5; })()", timeout=15000)
    check(f'{tag}: gazer comes when you look away', True)
    # 사물함 안: 틈으로 보면 문 앞에서 멈추고, 고개를 돌리면 떠난다
    pg.evaluate("""() => {
      const g = window.__horror, L = window.__horrorLogic, f = L.center(L.frontOf(g.map, g.map.lockers[0]));
      g.toggleLocker(0);
      Object.assign(g.stalker, { x: f.x, y: f.y, path: [], mode: 'patrol', graceT: 0, warnT: 0 });
    }""")
    time.sleep(0.6)
    check(f'{tag}: gazer stops at the locker while seen', pg.evaluate('window.__horror.stalker.mode') == 'watch')
    pg.screenshot(path=f'{OUT}/{tag}_locker.png')
    pg.evaluate(f'window.__horror.readInput = () => {{ const i = {BLANK_INPUT}; i.lookX = 0.1; return i; }}')
    pg.wait_for_function("(() => { const g = window.__horror, s = g.stalker; return Math.hypot(s.x - g.p.x, s.y - g.p.y) > 3 && g.state === 'play'; })()", timeout=10000)
    check(f'{tag}: gazer leaves the locker when you look away', True)
    pg.evaluate('window.__horror.toggleLocker(0)')
    pg.evaluate(f'window.__horror.readInput = () => {BLANK_INPUT}')


def maw_rule(pg, tag):
    place = pg.evaluate(FACE_MONSTER, [5, 7, 'patrol'])
    check(f'{tag}: found a straight view', place is not None, place)
    pg.evaluate(f'window.__horror.readInput = () => {BLANK_INPUT}')
    time.sleep(1.2)
    still = pg.evaluate('window.__horror.stalker.mode')
    check(f'{tag}: standing still is silent', still in ('patrol', 'search', 'investigate'), still)
    pg.evaluate(FACE_MONSTER, [5, 7, 'stunned'])
    time.sleep(0.4)
    pg.screenshot(path=f'{OUT}/{tag}_near.png')
    pg.evaluate(FACE_MONSTER, [5, 7, 'patrol'])
    pg.evaluate(f'window.__horror.readInput = () => {{ const i = {BLANK_INPUT}; i.move.z = -1; i.move.run = true; return i; }}')  # 등 쪽으로 달리면 소리가 난다
    pg.wait_for_function("window.__horror.stalker.mode === 'chase'", timeout=6000)
    check(f'{tag}: maw rushes at a running noise', True)


# 벽 건너 뒤에서 호러워드가 곧장 다가오게 하고, 벽이 튀어나오는 모습을 정면에서 찍는다
WARD_BEHIND_WALL = """(() => {
  const g = window.__horror, s = g.stalker, L = window.__horrorLogic, c = L.cellOf(g.p);
  const wall = (x, y) => g.map.rows[y]?.[x] === '#';
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let n = 1; n <= 6; n++) {
      const x = c.cx + dx * n, y = c.cy + dy * n;
      if (!L.lineOfSight(g.map, g.p, L.center({ cx: c.cx + dx * (n - 1), cy: c.cy + dy * (n - 1) }))) break;
      if (!wall(x, y)) continue;
      if (n < 2) break;
      g.yaw = Math.atan2(-dx, -dy);
      g.pitch = 0;
      const b = L.center({ cx: x + dx, cy: y + dy });
      Object.assign(s, { x: b.x, y: b.y, mode: 'chase', lastSeen: c, path: [], repathT: 0, graceT: 0, warnT: 9, lostT: -99 });
      g.readInput = () => ({ move: { x: 0, z: 0, run: false }, lookX: 0, lookY: 0 });
      return n;
    }
  }
  return null;
})()"""


def ward_rule(pg, tag):
    place = pg.evaluate(WARD_BEHIND_WALL)
    check(f'{tag}: found a wall to come through', place is not None, place)
    pg.wait_for_function('window.__horror.stalker.inWall && window.__horror.bulge.active', timeout=6000)
    check(f'{tag}: ward passes into a wall and the wall bulges', True)
    # 벽 앞면 바로 뒤에 왔을 때 세워 두고 찍는다
    pg.wait_for_function(f'(() => {{ const g = window.__horror, s = g.stalker; if (Math.hypot(s.x - g.p.x, s.y - g.p.y) > {place} - 0.2) return false; s.wallSlow = 0; g.k.monsters.ward.wallSlow = 0; return true; }})()', timeout=6000, polling=30)
    time.sleep(0.3)
    pg.screenshot(path=f'{OUT}/{tag}_bulge.png')
    pg.evaluate('window.__horror.k.monsters.ward.wallSlow = 0.35')
    pg.wait_for_function('!window.__horror.stalker.inWall', timeout=8000)
    check(f'{tag}: ward comes out the other side', True)
    pg.evaluate('window.__horror.stalker.warnT = 0')
    pg.wait_for_function("window.__horror.state === 'caught'", timeout=6000, polling=30)
    check(f'{tag}: ward catches on touch like seino', True)
    pg.wait_for_function("window.__horror.state === 'play'", timeout=6000)
    pg.evaluate(f'window.__horror.readInput = () => {BLANK_INPUT}')


def seino_shot(pg, tag):
    place = pg.evaluate(FACE_MONSTER, [4, 6, 'stunned'])
    check(f'{tag}: found a straight view', place is not None, place)
    pg.evaluate(f'window.__horror.readInput = () => {BLANK_INPUT}')
    time.sleep(0.8)
    pg.screenshot(path=f'{OUT}/{tag}_near.png')


def run_rounds(pw):
    bot = open('tools/bot_horror.js', encoding='utf8').read()
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    errs = []
    watch(pg, errs)
    calls = []
    for mapId in ('factory', 'sewer', 'school'):
        for monsterId in ('seino', 'gazer', 'maw', 'ward'):
            tag = f'{mapId}_{monsterId}'
            open_round(pg, mapId, monsterId)
            time.sleep(0.8)
            pg.screenshot(path=f'{OUT}/{tag}_start.png')
            {'seino': seino_shot, 'gazer': gazer_rule, 'maw': maw_rule, 'ward': ward_rule}[monsterId](pg, tag)
            pg.evaluate(FACE_MONSTER, [3, 3, 'stunned'])
            time.sleep(0.5)
            pg.screenshot(path=f'{OUT}/{tag}_close.png')
            pg.evaluate('(() => { const g = window.__horror; g.stalker.x = g.p.x + 0.4; g.stalker.y = g.p.y; g.getCaught(); })()')
            pg.wait_for_function("window.__horror.state === 'caught' && window.__horror.lunge.t > 0.25", timeout=5000, polling=30)
            pg.evaluate('window.__horror.caughtFrame = () => {}')
            pg.screenshot(path=f'{OUT}/{tag}_caught.png')
            # 규칙 검사가 흐트러 놓은 자리를 버리고 처음부터 봇으로 끝까지 한다
            open_round(pg, mapId, monsterId)
            pg.evaluate('window.__horrorBot = { careful: true }')
            pg.evaluate(bot)
            res = pg.evaluate(FAST_PLAY, 900)
            print(tag, res)
            calls.append(res.get('mean', 0))
            check(f'{tag}: bot escapes in the real game', res.get('state') == 'end', res)
            check(f'{tag}: draw calls stay near today', res.get('max', 999) <= 70, res)
            pg.screenshot(path=f'{OUT}/{tag}_end.png')
            n = len(errs)
            check(f'{tag}: no errors', n == 0, errs)
            errs.clear()
    print('mean draw calls', calls)
    b.close()


# 칸 수를 게임에서 읽어 도장을 count 개 찍고 저장한다
SEED_STAMPS = """async (count) => {
  const key = 'shock-hero-save-v1';
  const { boardCells, cellKey } = await import('/src/logic/horrorStamps.js');
  const stamps = Object.fromEntries(boardCells({}).slice(0, count).map((c) => [cellKey(c), 'plain']));
  const save = JSON.parse(localStorage.getItem(key) || '{}');
  localStorage.setItem(key, JSON.stringify({ ...save, gems: 0, horror: { ...save.horror, stamps, lastCleared: false } }));
  return Object.keys(stamps).length;
}"""
SAVED = "JSON.parse(localStorage.getItem('shock-hero-save-v1'))"
# 화면 안에 다 들어가는지 잰다
FITS = """(sel) => {
  const l = document.querySelector(sel), r = l.getBoundingClientRect();
  const out = [...l.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.bottom > innerHeight + 1 || x.right > innerWidth + 1 || x.top < -1 || x.left < -1; }).map((b) => b.textContent);
  return { scroll: l.scrollHeight, height: Math.round(r.height), out };
}"""


def open_chooser(pg):
    pg.goto(FREE_URL)
    time.sleep(2.5)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_selector('[data-chooser]', timeout=20000)


def last_round(pw, b, w, h, phone):
    tag = f'last_{w}x{h}'
    o = {'viewport': {'width': w, 'height': h}}
    if phone:
        o.update(has_touch=True, is_mobile=True, user_agent=PHONE_UA, device_scale_factor=2, screen={'width': w, 'height': h})
    ctx = b.new_context(**o)
    pg = ctx.new_page()
    errs = []
    watch(pg, errs)
    pg.goto(FREE_URL)
    time.sleep(2)
    total = pg.evaluate("import('/src/logic/horrorStamps.js').then((m) => m.boardSize())")
    pg.evaluate(SEED_STAMPS, total - 1)
    open_chooser(pg)
    shut = pg.locator('[data-last-night]')
    check(f'{tag}: locked card', shut.get_attribute('data-last-night') == 'locked' and shut.is_disabled(), shut.inner_text())
    check(f'{tag}: locked card says how many are left', '1개' in shut.inner_text(), shut.inner_text())
    pg.screenshot(path=f'{OUT}/{tag}_chooser_locked.png')
    fit = pg.evaluate(FITS, '[data-chooser]')
    check(f'{tag}: chooser fits', fit['scroll'] <= fit['height'] + 1 and not fit['out'], fit)
    pg.evaluate(SEED_STAMPS, total)
    open_chooser(pg)
    card = pg.locator('[data-last-night]')
    check(f'{tag}: open card', card.get_attribute('data-last-night') == 'open' and card.is_enabled(), card.inner_text())
    pg.screenshot(path=f'{OUT}/{tag}_chooser_open.png')
    card.click()
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    pg.screenshot(path=f'{OUT}/{tag}_intro.png')
    check(f'{tag}: device', pg.evaluate('window.__horror.device') == ('phone' if phone else 'pc'))
    check(f'{tag}: two monsters', pg.evaluate('window.__horror.stalkers.map((s) => s.monsterId).length') == 2)
    fit = pg.evaluate(FITS, '#horror > div[style*="z-index: 5"]')
    print(tag, 'intro', fit)
    pg.locator('#horror button:has-text("시작")').click()
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate(FAKE_LOCK)
    time.sleep(1.5)
    pg.screenshot(path=f'{OUT}/{tag}_play.png')
    both = pg.evaluate("""() => {
      const g = window.__horror;
      g.cullCreature();
      const far = g.hunters.map((h) => h.model.group.visible);
      g.renderer.render(g.scene, g.camera);
      const culled = g.renderer.info.render.calls;
      const c = window.__horrorLogic.center(g.map.start);
      g.stalkers.forEach((s, i) => Object.assign(s, { x: c.x + 2 + i, y: c.y, mode: 'stunned', stunT: 3, path: [] }));
      g.yaw = -Math.PI / 2; g.p = c;
      return { far, culled };
    }""")
    time.sleep(0.6)
    near = pg.evaluate("""() => { const g = window.__horror; g.renderer.render(g.scene, g.camera); return { calls: g.renderer.info.render.calls, shown: g.hunters.map((h) => h.model.group.visible), tags: g.hud.tags.textContent }; }""")
    pg.screenshot(path=f'{OUT}/{tag}_both.png')
    print(tag, 'cull', both, near)
    check(f'{tag}: both cull behind walls', both['far'] == [False, False], both)
    check(f'{tag}: draw calls with both in view', near['calls'] <= 110, near)
    # 규칙 검사가 옮긴 자리를 버리고 처음부터 고르기 화면을 지나 끝까지 한다
    open_chooser(pg)
    pg.locator('[data-last-night]').click()
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(0.5)
    pg.locator('#horror button:has-text("시작")').click()
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate(FAKE_LOCK)
    before = pg.evaluate(SAVED)
    if phone:
        pg.evaluate("window.__horrorBot = {}")
        pg.evaluate(open('tools/bot_child.js', encoding='utf8').read())
    else:
        pg.evaluate("window.__horrorBot = { careful: true }")
        pg.evaluate(open('tools/bot_horror.js', encoding='utf8').read())
    res = pg.evaluate(FAST_PLAY, 1500)
    print(tag, res)
    check(f'{tag}: bot reaches the end', res.get('state') == 'end', res)
    check(f'{tag}: draw calls stay reasonable', res.get('max', 999) <= 110, res)
    time.sleep(0.5)
    pg.screenshot(path=f'{OUT}/{tag}_end.png')
    text = pg.inner_text('#horror')
    names = pg.evaluate('window.__horror.monsters.map((m) => m.name)')
    check(f'{tag}: ending names both', all(n in text for n in names) and '볼트' in text, text[:200])
    check(f'{tag}: reward text', '보석' in text, text[:300])
    fit = pg.evaluate(FITS, '#horror > div[style*="z-index: 5"]')
    check(f'{tag}: end screen buttons on screen', not fit['out'] or fit['scroll'] > fit['height'], fit)
    print(tag, 'end', fit)
    after = pg.evaluate(SAVED)
    gain = pg.evaluate('window.__horror.k.lastNight.gems')
    check(f'{tag}: gems once', after['gems'] - before['gems'] == gain, (before['gems'], after['gems']))
    check(f'{tag}: cleared saved', after['horror']['lastCleared'] is True)
    check(f'{tag}: board untouched', after['horror']['stamps'] == before['horror']['stamps'] and after['horror']['gemDay'] == before['horror']['gemDay'] and after['horror']['escapes'] == before['horror']['escapes'])
    pg.locator('#horror button:has-text("한 판 더")').click()
    pg.wait_for_selector('[data-chooser]', timeout=10000)
    check(f'{tag}: replay card', '다시' in pg.locator('[data-last-night]').inner_text())
    pg.locator('[data-last-night]').click()
    pg.wait_for_function('window.__horror && window.__horror.state === "intro"', timeout=20000)
    pg.locator('#horror button:has-text("시작")').click()
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate('(() => { const g = window.__horror; g.run.powered = true; g.win(); })()')
    check(f'{tag}: replay pays nothing', pg.evaluate(SAVED)['gems'] == after['gems'])
    check(f'{tag}: no errors', not errs, errs)
    ctx.close()


def run_last(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    last_round(pw, b, 1280, 720, False)
    last_round(pw, b, 568, 320, True)
    b.close()


# 기기 시계를 며칠 옮긴다. window.__dayShift 를 바꾸면 게임 중에도 날이 바뀐다
SHIFT_DATE = """(days) => {
  const Real = Date;
  window.__dayShift = days;
  const now = () => Real.now() + window.__dayShift * 86400000;
  window.Date = class extends Real {
    constructor(...a) { if (a.length) super(...a); else super(now()); }
    static now() { return now(); }
  };
}"""
# 오늘부터 며칠 뒤에 그 조건이 나오는가
DAY_FOR_RULE = """async (rule) => {
  const { tonightRound } = await import('/src/logic/horrorTonight.js');
  const { todayKey } = await import('/src/logic/daily.js');
  for (let d = 0; d < 400; d++) {
    const t = tonightRound(todayKey(new Date(Date.now() + d * 86400000)));
    if (t.rule === rule) return { d, ...t };
  }
}"""
TONIGHT_BOT = {
    'noLight': '{ careful: true }',
    'noRun': '{ careful: true, noRun: true }',
    'noShock': '{ careful: true, noShock: true }',
    'noCatch': '{ careful: true, sneak: true }',
    'notes': '{ careful: true, notes: window.__horror.k.tonight.notes }',
}
# 조건을 깨는 입력을 봇 입력에 얹는다. 게임의 같은 길을 지난다
TONIGHT_BREAK = {
    'noRun': """() => { const g = window.__horror, read = g.readInput; let n = 0; g.readInput = (dt) => { const inp = read(dt); if (n++ < 300) { inp.move.run = true; inp.move.z = 1; } return inp; }; }""",
    'noShock': """() => { const g = window.__horror, read = g.readInput; let n = 0; g.run.shock = true; g.readInput = (dt) => { const inp = read(dt); if (n++ === 2) inp.punch = true; return inp; }; }""",
    'noCatch': """() => { const g = window.__horror; const s = g.stalker; s.x = g.p.x + 0.3; s.y = g.p.y; s.graceT = 0; s.warnT = 0; s.mode = 'chase'; }""",
}
TONIGHT_LINE = 'window.__horror.hud.tonightEl.textContent'


def tonight_start(pg, tag, shot):
    pg.locator('[data-tonight]').click()
    pg.wait_for_function("window.__horror && window.__horror.state === 'intro'", timeout=20000)
    time.sleep(0.6)
    if shot:
        pg.screenshot(path=f'{OUT}/{tag}_intro.png')
    intro = pg.inner_text('#horror')
    fit = pg.evaluate(FITS, '#horror > div[style*="z-index: 5"]')
    check(f'{tag}: intro names the condition, buttons on screen', '오늘의 밤 조건' in intro and not fit['out'], fit)
    pg.locator('#horror button:has-text("시작")').click()
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate(FAKE_LOCK)


def tonight_finish(pg, tag, shot):
    res = pg.evaluate(FAST_PLAY, 1500)
    print(tag, res)
    check(f'{tag}: bot reaches the end', res.get('state') == 'end', res)
    time.sleep(0.3)
    if shot:
        pg.screenshot(path=f'{OUT}/{tag}_end.png')
    fit = pg.evaluate(FITS, '#horror > div[style*="z-index: 5"]')
    check(f'{tag}: end screen buttons on screen', not fit['out'], fit)
    text = pg.inner_text('#horror')
    print(tag, 'end text:', text.replace('\n', ' / ')[:260])
    return text


def again(pg):
    pg.locator('#horror button:has-text("한 판 더")').click()
    pg.wait_for_selector('[data-chooser]', timeout=10000)


def tonight_rule(pw, b, w, h, phone, rule, shot):
    tag = f'tonight_{rule}_{w}x{h}'
    o = {'viewport': {'width': w, 'height': h}}
    if phone:
        o.update(has_touch=True, is_mobile=True, user_agent=PHONE_UA, device_scale_factor=2, screen={'width': w, 'height': h})
    ctx = b.new_context(**o)
    pg = ctx.new_page()
    errs = []
    watch(pg, errs)
    pg.goto(FREE_URL)
    time.sleep(1.5)
    day = pg.evaluate(DAY_FOR_RULE, rule)
    print(tag, day)
    ctx.add_init_script(f'({SHIFT_DATE})({day["d"]})')
    pg.goto(FREE_URL)
    time.sleep(1)
    total = pg.evaluate("import('/src/logic/horrorStamps.js').then((m) => m.boardSize())")
    pg.evaluate(SEED_STAMPS, total)  # 마지막 밤 칸까지 열린, 글이 가장 긴 고르기 화면
    open_chooser(pg)
    if shot:
        pg.screenshot(path=f'{OUT}/{tag}_chooser.png')
    fit = pg.evaluate(FITS, '[data-chooser]')
    check(f'{tag}: chooser fits', fit['scroll'] <= fit['height'] + 1 and not fit['out'], fit)
    card = pg.locator('[data-tonight]').inner_text()
    print(tag, 'card:', card.replace('\n', ' / '))
    box = pg.evaluate("(() => { const a = [...document.querySelectorAll('[data-tonight] div')]; return a.map((d) => d.getBoundingClientRect().height); })()")
    check(f'{tag}: card lines stay on one row', all(x <= (15 if phone else 19) for x in box), box)
    longest = pg.evaluate("""async () => {
      const { MAPS, MONSTERS } = await import('/src/horror/content.js');
      const { TONIGHT_RULES, tonightRuleText } = await import('/src/logic/horrorTonight.js');
      const { balance } = await import('/src/config/balance.js');
      const [top, low] = document.querySelectorAll('[data-tonight] div');
      const keep = [top.textContent, low.textContent];
      const seen = [];
      for (const map of Object.values(MAPS)) for (const m of Object.values(MONSTERS)) { top.textContent = `오늘의 밤: ${map.name}, ${m.name}`; seen.push(top.getBoundingClientRect().height); }
      for (const r of TONIGHT_RULES) { low.textContent = `${tonightRuleText(r, balance.horror)} (오늘 보석 받음)`; seen.push(low.getBoundingClientRect().height); }
      [top.textContent, low.textContent] = keep;
      return Math.max(...seen);
    }""")
    check(f'{tag}: every card text stays on one row', longest <= (15 if phone else 19), longest)
    names = pg.evaluate("({ mapId, monsterId }) => import('/src/horror/content.js').then((m) => [m.MAPS[mapId].name, m.MONSTERS[monsterId].name])", day)
    check(f'{tag}: card shows the map and monster', all(n in card for n in names), card)
    tonight_start(pg, tag, shot)
    check(f'{tag}: game got the round', pg.evaluate("(() => { const g = window.__horror; return [g.round.mapId, g.round.monsterId, g.tonight.rule, g.tonight.date]; })()") == [day['mapId'], day['monsterId'], rule, day['date']])
    if rule == 'noLight':
        check(f'{tag}: light starts off', pg.evaluate('window.__horror.lightOn') is False)
    time.sleep(0.4)
    if shot:
        pg.screenshot(path=f'{OUT}/{tag}_play.png')
    print(tag, 'line:', pg.evaluate(TONIGHT_LINE))
    before = pg.evaluate(SAVED)
    pg.evaluate(f'window.__horrorBot = {TONIGHT_BOT[rule]}')
    pg.evaluate(open('tools/bot_horror.js', encoding='utf8').read())
    text = tonight_finish(pg, f'{tag}_met', shot)
    after = pg.evaluate(SAVED)
    gain = after['gems'] - before['gems']
    met = '조건 성공' in text
    if rule == 'noCatch' and not met:  # 안 잡히기는 봇도 가끔 잡힌다. 그때는 다시 한다
        again(pg)
        tonight_start(pg, tag, False)
        pg.evaluate(f'window.__horrorBot = {TONIGHT_BOT[rule]}')
        pg.evaluate(open('tools/bot_horror.js', encoding='utf8').read())
        text = tonight_finish(pg, f'{tag}_met2', shot)
        after = pg.evaluate(SAVED)
        gain = after['gems'] - before['gems']
        met = '조건 성공' in text
    check(f'{tag}: met, end says so', met and '보석 15개' in text, text[:200])
    check(f'{tag}: pays tonight gems on top', gain >= 15 + 5, gain)
    check(f'{tag}: day saved', after['horror']['tonightDone'] == [day['date']], after['horror'].get('tonightDone'))
    again(pg)
    pg.wait_for_selector('[data-tonight]')
    check(f'{tag}: card says paid', '받음' in pg.locator('[data-tonight]').inner_text())
    # 같은 날 다시: 이번에는 조건을 깬다
    tonight_start(pg, f'{tag}_again', False)
    if rule == 'noLight':  # 봇을 끼우기 전에 진짜 입력으로 켠다
        if phone:
            pg.locator('#horror button:has-text("손전등")').dispatch_event('pointerdown', {'pointerId': 7, 'bubbles': True})
        else:
            pg.keyboard.press('KeyF')
        time.sleep(0.5)
        check(f'{tag}: real press turned the light on', pg.evaluate('window.__horror.lightOn') is True)
    pg.evaluate(f'window.__horrorBot = {TONIGHT_BOT[rule]}')
    pg.evaluate(open('tools/bot_horror.js', encoding='utf8').read())
    if rule == 'noLight':
        pass
    elif rule == 'notes':
        pg.evaluate('window.__horrorBot = { careful: true }')
    else:
        pg.evaluate(TONIGHT_BREAK[rule])
        time.sleep(0.2 if rule != 'noRun' else 1)
    if rule != 'notes':
        becomes(pg, f"{TONIGHT_LINE}.includes('깨졌어요')", 15000)
        line = pg.evaluate(TONIGHT_LINE)
        check(f'{tag}: line says broken', '깨졌어요' in line, line)
        if shot:
            pg.screenshot(path=f'{OUT}/{tag}_broken.png')
    text = tonight_finish(pg, f'{tag}_broken', shot)
    check(f'{tag}: end says not met', '못 지켰어요' in text, text[:200])
    again2 = pg.evaluate(SAVED)
    check(f'{tag}: broken round pays no tonight gems', again2['gems'] - after['gems'] < 15, again2['gems'] - after['gems'])
    if pg.locator('#horror button:has-text("한 판 더")').count():
        again(pg)
    # 같은 날 또 지켜도 더 주지 않는다
    tonight_start(pg, f'{tag}_third', False)
    pg.evaluate("(() => { const g = window.__horror; g.notes.found = g.k.tonight.notes; g.run.powered = true; g.win(); })()")
    time.sleep(0.3)
    text = pg.inner_text('#horror')
    extra = pg.evaluate(SAVED)['gems'] - again2['gems']  # 처음 안 잡힌 보너스는 따로 받을 수 있다
    check(f'{tag}: replay met pays nothing', '오늘 보석은 이미 받았어요' in text and extra < 15, extra)
    check(f'{tag}: no errors', not errs, errs)
    ctx.close()


# 자정을 넘긴 판은 시작한 날로 따지고, 한 번만 준다
def tonight_midnight(pw, b):
    tag = 'tonight_midnight'
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page()
    errs = []
    watch(pg, errs)
    ctx.add_init_script(f'({SHIFT_DATE})(0)')
    pg.goto(FREE_URL)
    time.sleep(1.5)
    open_chooser(pg)
    tonight_start(pg, tag, False)
    date = pg.evaluate('window.__horror.tonight.date')
    pg.evaluate('window.__dayShift = 1')
    before = pg.evaluate(SAVED)
    pg.evaluate("(() => { const g = window.__horror; g.notes.found = g.k.tonight.notes; g.run.powered = true; g.win(); })()")
    time.sleep(0.3)
    after = pg.evaluate(SAVED)
    check(f'{tag}: paid by the day it started', after['horror']['tonightDone'] == [date] and after['gems'] - before['gems'] >= 15, after['horror'])
    again(pg)
    next_date = pg.evaluate("import('/src/logic/daily.js').then((m) => m.todayKey())")
    check(f'{tag}: card moved to the new day', next_date != date)
    tonight_start(pg, f'{tag}_next', False)
    check(f'{tag}: next round is the new day', pg.evaluate('window.__horror.tonight.date') == next_date)
    pg.evaluate("(() => { const g = window.__horror; g.notes.found = g.k.tonight.notes; g.run.powered = true; g.win(); })()")
    time.sleep(0.3)
    check(f'{tag}: new day pays again', pg.evaluate(SAVED)['horror']['tonightDone'] == [date, next_date])
    check(f'{tag}: no errors', not errs, errs)
    ctx.close()


# 손전등 없이 괴물과 물건이 보이는지 사진으로 본다
def tonight_dark(pw, b):
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page()
    for mapId in ('factory', 'sewer', 'school'):
        for monster in ('gazer', 'seino'):
            open_round(pg, mapId, monster)
            pg.evaluate(IDLE_INPUT)
            for d in (3, 6):
                got = pg.evaluate(FACE_MONSTER, [d, d, 'stunned'])
                pg.evaluate('window.__horror.lightOn = false')
                time.sleep(0.5)
                pg.screenshot(path=f'{OUT}/dark_{mapId}_{monster}_{d}.png')
                print('dark', mapId, monster, d, got)
    ctx.close()


def run_tonight(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    only = os.environ.get('TONIGHT_ONLY')
    if only == 'dark':
        tonight_dark(pw, b)
    else:
        for rule in ([only] if only else ['noLight', 'noRun', 'noShock', 'noCatch', 'notes']):
            tonight_rule(pw, b, 1280, 720, False, rule, True)
            tonight_rule(pw, b, 568, 320, True, rule, True)
        if not only:
            tonight_midnight(pw, b)
            tonight_dark(pw, b)
    b.close()


with sync_playwright() as pw:
    {'tonight': run_tonight, 'last': run_last, 'replay': play_replay, 'rounds': run_rounds, 'keys': run_keys, 'shots': run_shots, 'touch': run_touch, 'creature': run_creature, 'play': run_play, 'sound': play_sound, 'robust': play_robust, 'phone': run_phone, 'stalk': play_stalk}[MODE](pw)
    if MODE == 'keys':
        run_play(pw)
if fails:
    print('FAILED:', fails)
    sys.exit(1)
