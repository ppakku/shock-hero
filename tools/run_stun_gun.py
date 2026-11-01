# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤 python3 tools/run_stun_gun.py 출력폴더 (포트를 바꾸면 HORROR_PORT 로 알려 준다)
# 공포 모드 전기충격기를 진짜 키 입력으로 확인한다: 충전 전, 충전, 빗나감, 맞힘, 숨기, 키 바뀜, 터치 위치
import os, re, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
if os.environ.get('HORROR_GPU'):  # 소프트웨어 대신 이 컴퓨터의 진짜 그래픽 칩으로 잰다
    ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
URL = f"http://localhost:{os.environ.get('HORROR_PORT', '5288')}/?timer&fps"
IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name, info)
    if not ok:
        fails.append(name)


def open_game(pg):
    pg.goto(URL)
    time.sleep(3)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    pg.click('#horror button:has-text("시작")')
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    # 시험이 끝날 때까지 세이노가 잡지 못하게 멀리 세워 둔다
    pg.evaluate("""() => { const g = window.__horror; g.keepAway = setInterval(() => { if (!g.gunTest) { g.stalker.x = 1.5; g.stalker.y = 1.5; g.stalker.mode = 'patrol'; } }, 20); }""")


def state(pg):
    return pg.evaluate("""() => { const g = window.__horror, f = g.gun; return { shock: g.run.shock, arcs: f.arcs.filter((a) => a.core.visible).length, shown: f.root.visible, halo: f.halo.visible, strip: f.stripMat.color.getHex(), bolt: f.fx.boltT, zap: f.fx.zapT, kick: f.fx.kickT, hum: g.audio?.humOn, mode: g.stalker.mode, say: g.hud.message.textContent }; }""")


def stand_clear(pg):
    pg.evaluate("""() => { const g = window.__horror, b = g.map.boxes.find((_, i) => !g.run.usedBoxes.includes(i)); const f = window.__horrorLogic.center(window.__horrorLogic.frontOf(g.map, b)); g.p = f; g.yaw = Math.atan2(-(window.__horrorLogic.center(b).x - f.x), -(window.__horrorLogic.center(b).y - f.y)); g.pitch = 0; }""")
    time.sleep(0.5)


def desktop(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    open_game(pg)
    time.sleep(0.5)
    s = state(pg)
    pg.screenshot(path=f'{OUT}/1_empty.png')
    check('시작하면 손이 보이고 전기는 없다', s['shown'] and s['arcs'] == 0 and not s['halo'] and not s['hum'], s)
    check('손은 그림으로 그린다', pg.evaluate('window.__horror.gun.art.visible && !window.__horror.gun.model.visible'))

    pg.keyboard.press('j')
    time.sleep(0.2)
    check('J 는 더 이상 쓰지 않는다', state(pg)['kick'] == 0, state(pg)['kick'])
    pg.keyboard.press('r')
    pg.wait_for_function('window.__horror.hud.message.textContent.includes("쇼크가 없다")', timeout=3000)
    s = state(pg)
    check('충전 없이 R: 살짝 움직이고 안내가 뜬다', s['kick'] > 0 and s['zap'] == 0 and '쇼크가 없다' in s['say'], s)

    stand_clear(pg)
    pg.screenshot(path=f'{OUT}/2_before_box.png')
    prompt = pg.evaluate('window.__horror.hud.prompt.textContent')
    pg.keyboard.press('e')
    pg.wait_for_function('window.__horror.run.shock', timeout=3000)
    pg.screenshot(path=f'{OUT}/3_charging.png')
    time.sleep(1.2)
    s = state(pg)
    pg.screenshot(path=f'{OUT}/4_charged.png')
    check('충전: 색이 바뀌고 빛과 웅웅거림이 켜진다', s['shock'] and s['halo'] and s['hum'], [prompt, s])
    seen = pg.evaluate("""async () => { const g = window.__horror; let n = 0; for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 30)); if (g.gun.arcs.some((a) => a.core.visible)) n++; } return n; }""")
    check('충전된 동안 전기가 계속 튄다', seen > 15, seen)

    pg.keyboard.press('r')
    pg.wait_for_timeout(50)
    s = state(pg)
    pg.screenshot(path=f'{OUT}/5_miss.png')
    check('빗나감: 불꽃만 튀고 충전이 사라진다', not s['shock'] and s['zap'] > 0 and s['bolt'] == 0 and '빗나갔다' in s['say'] and not s['hum'], s)
    time.sleep(1)

    # 두 번째 상자로 충전하고 세이노를 앞에 세워 맞힌다
    pg.evaluate("window.__horror.run.shock = true")
    time.sleep(0.3)
    pg.evaluate("""() => { const g = window.__horror, L = window.__horrorLogic; g.gunTest = true; g.p = L.center(g.map.start); g.yaw = 0; g.pitch = 0; g.stalker.x = g.p.x + 0.3; g.stalker.y = g.p.y - 2; g.stalker.mode = 'patrol'; }""")
    pg.keyboard.press('r')
    pg.wait_for_timeout(40)
    s = state(pg)
    pg.screenshot(path=f'{OUT}/6_hit.png')
    check('맞힘: 번개가 이어지고 세이노가 멈춘다', s['bolt'] > 0 and s['arcs'] >= 1 and s['mode'] == 'stunned' and '맞았다' in s['say'], s)
    pg.evaluate("window.__horror.gunTest = false")
    time.sleep(1)

    pg.evaluate("""() => { const g = window.__horror; g.run.shock = true; g.toggleLocker(0); }""")
    time.sleep(0.4)
    s = state(pg)
    pg.screenshot(path=f'{OUT}/7_locker.png')
    check('숨으면 손과 웅웅거림이 사라진다', not s['shown'] and s['arcs'] == 0 and not s['hum'], s)
    pg.evaluate("window.__horror.toggleLocker(0)")
    time.sleep(0.4)
    check('나오면 손이 돌아온다', state(pg)['shown'])
    # 귀로 듣는 대신 스피커로 가는 파형의 크기를 잰다
    for name, low in (('shockCharge', 0.01), ('shockHit', 0.01), ('shockMiss', 0.01), ('shockEmpty', 0.01)):
        peak = pg.evaluate("""async (name) => { const a = window.__horror.audio, an = a.ctx.createAnalyser(); an.fftSize = 2048; a.comp.connect(an); await a.ctx.resume(); await new Promise((r) => setTimeout(r, 900)); const quiet = new Float32Array(an.fftSize); an.getFloatTimeDomainData(quiet); const before = Math.max(...quiet.map(Math.abs)); a.play(name); const t = new Float32Array(an.fftSize); let peak = 0; for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 25)); an.getFloatTimeDomainData(t); peak = Math.max(peak, ...t.map(Math.abs)); } a.comp.disconnect(an); return { before, peak }; }""", name)
        check(f'소리 {name}: 파형이 생긴다', peak['peak'] > low, peak)
    hum = pg.evaluate("""async () => { const a = window.__horror.audio, g = window.__horror; const level = () => a.humLevel.gain.value; g.run.shock = false; await new Promise((r) => setTimeout(r, 900)); const off = level(); g.run.shock = true; await new Promise((r) => setTimeout(r, 900)); const on = level(); g.run.shock = false; await new Promise((r) => setTimeout(r, 900)); return { off, on, after: level() }; }""")
    check('웅웅거림: 충전되면 켜지고 쓰면 꺼진다', hum['off'] < 0.01 and hum['on'] > 0.03 and hum['after'] < 0.01, hum)
    check('페이지 오류 없음', not errs, errs)
    b.close()


def touch(pw, name, w, h, ua):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True, user_agent=ua)
    pg = ctx.new_page()
    pg.goto(URL)
    time.sleep(3)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    pg.tap('#horror button:has-text("시작")')
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate("window.__horror.run.shock = true")
    time.sleep(0.8)
    pg.screenshot(path=f'{OUT}/{name}.png')
    check(f'{name}: 터치 버튼 이름이 쇼크', pg.locator('#horror button:has-text("쇼크")').count() >= 1 or '쇼크' in pg.inner_text('#horror'))
    b.close()


# 새 그림을 하나도 못 받아도 원래 모습으로 놀 수 있고, 그림을 받았을 때 그리기 횟수가 늘지 않아야 한다
NEW_ART = r'horror_(hand|fuse|key|note|box|panel|gate|door|intro|face)'


def art_lost(pw):
    calls = {}
    for name, block in (('있음', False), ('없음', True)):
        b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        if block:
            pg.route(re.compile(NEW_ART), lambda r: r.abort())
        open_game(pg)
        pg.evaluate("window.__horror.gunTest = false")
        time.sleep(1)
        look = pg.evaluate("() => { const g = window.__horror, f = g.gun; g.hud.showNote(['글']); const note = g.hud.noteEl.style.cssText; g.hud.closeNote(); return { art: f.art.visible, model: f.model.visible, fuse: g.fuseMeshes[0].material.visible, key: g.keyMeshes[0].material.visible, paper: note.includes('horror_note_paper'), calls: g.renderer.info.render.calls }; }")
        calls[name] = look['calls']
        pg.screenshot(path=f'{OUT}/art_{name}.png')
        if block:
            check('그림이 없으면 3D 손, 퓨즈, 열쇠, 어두운 쪽지로 남는다', look['model'] and not look['art'] and look['fuse'] and look['key'], look)
        else:
            check('그림이 있으면 손, 퓨즈, 열쇠를 그림으로 그린다', look['art'] and not look['model'] and not look['fuse'] and not look['key'] and look['paper'], look)
        check(f'그림 {name}: 페이지 오류 없음', not errs, errs)
        b.close()
    check('그림을 입혀도 그리기 횟수가 늘지 않는다', calls['있음'] <= calls['없음'], calls)


with sync_playwright() as pw:
    art_lost(pw)
    desktop(pw)
    touch(pw, 'tablet', 1024, 768, IPAD_UA)
    touch(pw, 'phone', 844, 390, PHONE_UA)
print('FAILS', fails)
sys.exit(1 if fails else 0)
