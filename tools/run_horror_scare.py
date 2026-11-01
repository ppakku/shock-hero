# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤 python3 tools/run_horror_scare.py 출력폴더 (포트를 바꾸면 HORROR_PORT 로 알려 준다)
# 공포 모드 고르기 화면, 큰입이 잡힘, 놀람 장면을 진짜 화면으로 확인한다
import os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
PORT = os.environ.get('HORROR_PORT', '5288')
PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name, str(info)[:200])
    if not ok:
        fails.append(name)


def open_title(pg, query='?timer&fps'):
    pg.goto(f'http://localhost:{PORT}/{query}')
    pg.wait_for_function("window.__shockGame?.scene?.getScene('Title')?.ready", timeout=30000)
    time.sleep(1)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")


def begin(pg, query):
    open_title(pg, query)
    pg.wait_for_function('window.__horror', timeout=30000)
    pg.wait_for_function('window.__horror.warmed', timeout=30000)
    pg.click('#horror button:has-text("시작")')
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)


def chooser(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    open_title(pg)
    pg.wait_for_selector('[data-chooser]', timeout=30000)
    check('고르기 화면이 안내 화면보다 먼저 나온다', pg.locator('#horror button:has-text("시작")').count() == 0)
    pressed = pg.evaluate("[...document.querySelectorAll('[data-pick]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.pick)")
    check('처음에는 둘 다 랜덤이다', pressed == ['random', 'random'], pressed)
    pg.screenshot(path=f'{OUT}/chooser_pc.png')
    pg.click('[data-pick="school"]')
    pg.click('[data-pick="maw"]')
    check('고른 몹의 설명이 보인다', '닿지 마세요' in pg.inner_text('[data-chooser]'))
    pg.screenshot(path=f'{OUT}/chooser_pick.png')
    pg.click('button:has-text("들어가기")')
    pg.wait_for_function('window.__horror', timeout=30000)
    r = pg.evaluate('window.__horror.round')
    check('고른 맵과 몹으로 시작한다', r == {'mapId': 'school', 'monsterId': 'maw'}, r)
    check('고르기 화면이 닫힌다', pg.locator('[data-chooser]').count() == 0)
    check('안내 화면에 고른 맵이 보인다', '밤의 학교' in pg.inner_text('#horror'))
    pg.wait_for_function('window.__horror.warmed', timeout=30000)
    pg.click('#horror button:has-text("시작")')
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate("window.__horror.run.have = 3; window.__horror.run.powered = true; window.__horror.state = 'play'; window.__horror.win = window.__horror.win; window.__horror.run.powered = true")
    pg.evaluate("window.__horror.win()")
    pg.wait_for_selector('button:has-text("한 판 더")', timeout=5000)
    pg.click('button:has-text("한 판 더")')
    pg.wait_for_selector('[data-chooser]', timeout=10000)
    pressed = pg.evaluate("[...document.querySelectorAll('[data-pick]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.pick)")
    check('한 판 더는 고르기 화면으로 가고 방금 고른 것이 남아 있다', pressed == ['school', 'maw'], pressed)
    pg.click('button:has-text("타이틀로")')
    time.sleep(0.8)
    check('타이틀로 돌아간다', pg.locator('#horror').count() == 0)
    check('페이지 오류 없음', not errs, errs)
    b.close()
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    for w, h in ((844, 390), (568, 320)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True, user_agent=PHONE_UA)
        pg = ctx.new_page()
        open_title(pg)
        pg.wait_for_selector('[data-chooser]', timeout=30000)
        pg.screenshot(path=f'{OUT}/chooser_phone_{w}.png')
        fit = pg.evaluate("(() => { const e = document.querySelector('[data-chooser]'); const go = [...e.querySelectorAll('button')].pop().getBoundingClientRect(); return { h: e.scrollHeight, view: innerHeight, bottom: go.bottom }; })()")
        check(f'휴대폰 {w}x{h} 가로 화면에 다 들어간다', fit['h'] <= fit['view'] and fit['bottom'] <= fit['view'], fit)
    b.close()


def scare(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    for monster in ('seino', 'gazer', 'maw', 'ward'):
        begin(pg, f'?timer&fps&map=factory&monster={monster}')
        time.sleep(0.6)
        pg.evaluate("""() => { const g = window.__horror, L = window.__horrorLogic; const c = L.cellOf(g.p); g.scaresLeft = [{ cx: c.cx, cy: c.cy }]; g.stalker.graceT = 99; }""")
        pg.wait_for_function("window.__horror.scare?.phase === 'dark'", timeout=4000, polling=20)
        pg.screenshot(path=f'{OUT}/scare_{monster}_dark.png')
        check(f'{monster}: 불이 꺼진다', pg.evaluate('window.__horror.flash.intensity') == 0)
        pg.wait_for_function("window.__horror.scare?.phase === 'face'", timeout=6000, polling=10)
        pg.screenshot(path=f'{OUT}/scare_{monster}_face.png')
        pg.wait_for_function('!window.__horror.scare', timeout=6000, polling=20)
        check(f'{monster}: 끝나면 밝기가 돌아온다', pg.evaluate('window.__horror.ambientLight.intensity === window.__horror.k.ambient'))
        time.sleep(1.2)
        pg.screenshot(path=f'{OUT}/scare_{monster}_after.png')
    begin(pg, '?timer&fps&map=factory&monster=seino')
    time.sleep(0.5)
    shot = pg.evaluate("""() => { const g = window.__horror; g.yaw = -Math.PI / 2; g.figureT = 0; g.stalker.graceT = 99; return true; }""")
    ok = False
    try:
        pg.wait_for_function('window.__horror.figure', timeout=4000, polling=20)
        ok = True
        pg.screenshot(path=f'{OUT}/figure.png')
    except Exception:
        pass
    check('복도 끝에 형체가 나타난다', ok)
    pg.evaluate("""() => { const g = window.__horror, s = g.stalker; s.graceT = 0; s.x = g.p.x + 2; s.y = g.p.y; s.mode = 'chase'; }""")
    time.sleep(0.25)
    pg.screenshot(path=f'{OUT}/dread.png')
    check('괴물이 가까우면 가장자리가 어두워진다', float(pg.evaluate('window.__horror.hud.dread.style.opacity')) > 0.4)
    pg.evaluate("window.__horror.getCaught()")
    pg.wait_for_timeout(30)
    check('잡히면 먼저 깜깜하고 조용하다', pg.evaluate("window.__horror.lunge.hush > 0 || window.__horror.state === 'caught'"))
    pg.wait_for_function("window.__horror.lunge?.t > 0.2", timeout=5000, polling=20)
    pg.screenshot(path=f'{OUT}/caught.png')
    pg.wait_for_function("window.__horror.state === 'play' || window.__horror.state === 'paused'", timeout=9000)
    check('잡힌 뒤 돌아온다', pg.evaluate('window.__horror.ambientLight.intensity === window.__horror.k.ambient'))
    for name in ('scare', 'caught'):
        peak = pg.evaluate("""async (name) => { const a = window.__horror.audio, an = a.ctx.createAnalyser(); an.fftSize = 2048; a.comp.connect(an); await a.ctx.resume(); a.play(name); const t = new Float32Array(an.fftSize); let peak = 0; for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 25)); an.getFloatTimeDomainData(t); peak = Math.max(peak, ...t.map(Math.abs)); } a.comp.disconnect(an); return peak; }""", name)
        check(f'소리 {name}: 찢어지지 않을 만큼 크다', 0.2 < peak <= 1.2, peak)
    pg.evaluate("window.__horror.audio.whisper(Math.random)")
    check('페이지 오류 없음', not errs, errs)
    b.close()


def maw(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    begin(pg, '?timer&fps&map=factory&monster=maw')
    time.sleep(0.5)
    # 큰입이가 달려드는 중에 앞에서 멈춘다. 입력은 하지 않는다
    pg.evaluate("""() => { const g = window.__horror, L = window.__horrorLogic, s = g.stalker; const c = L.cellOf(g.p); s.graceT = 0; s.warnT = 0; s.rushRestT = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 5; d >= 3; d--) {
        const to = { x: g.p.x + dx * d, y: g.p.y + dy * d };
        if (L.lineOfSight(g.map, g.p, to)) { Object.assign(s, to, { mode: 'chase', rushT: 2.5, target: c }); s.path = L.findPath(g.map, L.cellOf(s), c); return; }
      } }""")
    caught = False
    try:
        pg.wait_for_function("window.__horror.state === 'caught'", timeout=5000, polling=20)
        caught = True
    except Exception:
        pass
    check('큰입이: 달려든 앞에서 가만히 있어도 잡힌다', caught, pg.evaluate('window.__horror.stalker.mode'))
    b.close()


with sync_playwright() as pw:
    if "--maw" not in sys.argv:
        chooser(pw)
    maw(pw)
    if "--maw" not in sys.argv:
        scare(pw)
print('FAILS', fails)
sys.exit(1 if fails else 0)
