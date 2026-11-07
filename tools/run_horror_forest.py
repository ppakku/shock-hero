# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/run_horror_forest.py 출력폴더
# 어른용 숲 판: 고르기 화면의 어른용 칸과 확인 창으로 들어가 처녀귀신을 봇 (careful) 으로 여러 씨앗 탈출시킨다.
#   FOREST_SEEDS=1,2,3      씨앗 (Math.random 고정)
#   FOREST_FROM=480         해가 이만큼 진 뒤에 시작한다 (느린 사람 흉내. 300 은 어스름, 480 은 밤)
#   FOREST_BASE=factory     같은 씨앗으로 그 맵의 세이노와 견준다
#   FOREST_TUNE='{"night": {"blinkAfter": 6}}'  처녀귀신 값을 바꿔 본다
#   FOREST_NOSHOT=1         확인 창, 소개 화면 사진을 찍지 않는다
import json, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PORT = os.environ.get('HORROR_PORT', '5288')
FREE_URL = f'http://localhost:{PORT}/?timer&fps'
FAKE_LOCK = "Object.defineProperty(document, 'pointerLockElement', { get: () => document.getElementById('horror'), configurable: true })"
os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name, info)
    if not ok:
        fails.append(name)


def watch(pg, errs):
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(f'console {m.type}: ' + m.text[:300]) if m.type in ('error', 'warning') and 'goatcounter' not in m.text and 'GPU stall' not in m.text else None)


# 판을 같은 수로 다시 돌릴 수 있게 Math.random 을 씨앗으로 고정한다
SEED_RANDOM = """(() => {
  const m = /[?&]seed=(\\d+)/.exec(location.search);
  if (!m) return;
  let a = Number(m[1]) >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})()"""
# FAST_PLAY 처럼 빨리 돌리되, 잡힌 때와 해 질 녘 단계를 같이 적는다
FOREST_PLAY = """([limit, from]) => {
  const g = window.__horror;
  g.renderer.setAnimationLoop(null);
  g.playTime = from; // 느린 사람처럼 해가 이만큼 진 뒤에 시작한다
  const catches = [], calls = [];
  let t = 0, was = g.run.caughtCount;
  for (; t < limit && g.state !== 'end'; t += 1 / 30) {
    g.update(1 / 30);
    if (g.run.caughtCount !== was) { was = g.run.caughtCount; catches.push(`${Math.round(g.playTime)}s:${g.dusk.stage}`); }
    if (Math.round(t * 30) % 60 === 0) { g.renderer.render(g.scene, g.camera); calls.push(g.renderer.info.render.calls); }
    if (g.state === 'paused') return { paused: true, t };
  }
  return { state: g.state, t: Math.round(g.playTime), stage: g.dusk?.stage, caught: g.run.caughtCount, catches, have: g.run.have, max: Math.max(...calls) };
}"""
# 세이노 판과 같은 방식으로 돌린 결과 (비교용)
PLAIN_PLAY = """(limit) => {
  const g = window.__horror;
  g.renderer.setAnimationLoop(null);
  let t = 0;
  for (; t < limit && g.state !== 'end'; t += 1 / 30) g.update(1 / 30);
  return { state: g.state, t: Math.round(g.playTime), caught: g.run.caughtCount };
}"""


# 고르기 화면의 어른용 칸 -> 확인 창 -> 들어가기 로 숲에 들어간다
def enter_forest(pg, seed, shots=False):
    pg.goto(f'{FREE_URL}&seed={seed}')
    time.sleep(2.5)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_selector('[data-forest]', timeout=20000)
    pg.locator('[data-forest]').click()
    pg.wait_for_selector('[data-forest-confirm]', timeout=3000)
    focus = pg.evaluate("document.activeElement?.dataset?.forestBack !== undefined")
    check('forest: confirm opens, focus on back', focus)
    if shots:
        pg.screenshot(path=f'{OUT}/check_forest_confirm.png')
        pg.keyboard.press('Escape')
        check('forest: Escape closes confirm', pg.locator('[data-forest-confirm]').count() == 0)
        pg.locator('[data-forest]').click()
        pg.locator('[data-forest-back]').click()
        check('forest: back closes confirm', pg.locator('[data-forest-confirm]').count() == 0)
        pg.locator('[data-forest]').click()
    pg.locator('[data-forest-enter]').click()
    pg.wait_for_function("window.__horror && window.__horror.state === 'intro'", timeout=20000)
    check('forest: forest map with maiden', pg.evaluate("window.__horror.round.mapId === 'forest' && window.__horror.stalker.monsterId === 'maiden'"))
    if shots:
        time.sleep(2.5)  # 그림이 다 오도록
        pg.screenshot(path=f'{OUT}/check_forest_intro.png')
    pg.locator('#horror button:has-text("시작")').click()
    pg.wait_for_function("window.__horror.state === 'play'", timeout=5000)
    pg.evaluate(FAKE_LOCK)


def run_forest(pw):
    seeds = [int(s) for s in os.environ.get('FOREST_SEEDS', '1,2,3,4,5,6').split(',')]
    limit = int(os.environ.get('FOREST_LIMIT', '1500'))
    bot = open('tools/bot_horror.js', encoding='utf8').read()
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    rows = []
    for i, seed in enumerate(seeds):
        ctx = b.new_context(viewport={'width': 640, 'height': 360})
        ctx.add_init_script(SEED_RANDOM)
        pg = ctx.new_page()
        errs = []
        watch(pg, errs)
        enter_forest(pg, seed, shots=(i == 0 and not os.environ.get('FOREST_NOSHOT')))
        if os.environ.get('FOREST_TUNE'):  # 설정을 바꿔 보며 견줄 때. 예: {"night": {"blinkAfter": 6}}
            pg.evaluate("(t) => { const m = window.__horror.k.monsters.maiden; for (const [st, v] of Object.entries(t)) Object.assign(m[st], v); }", json.loads(os.environ['FOREST_TUNE']))
        pg.evaluate('window.__horrorBot = { careful: true }')
        pg.evaluate(bot)
        t0 = time.time()
        res = pg.evaluate(FOREST_PLAY, [limit, int(os.environ.get('FOREST_FROM', '0'))])
        res['wall'] = round(time.time() - t0)
        print('forest seed', seed, res)
        rows.append(res)
        check(f'forest seed {seed}: no errors', not errs, errs)
        ctx.close()
    won = [r for r in rows if r.get('state') == 'end']
    print('forest escapes', len(won), '/', len(rows), 'catches', [r['caught'] for r in rows], 'times', [r['t'] for r in rows])
    check('forest: bot escapes most rounds', len(won) * 2 > len(rows), [(r.get('state'), r.get('t'), r.get('caught')) for r in rows])
    if os.environ.get('FOREST_BASE'):  # 같은 씨앗으로 다른 맵의 세이노와 견준다
        for mapId in os.environ['FOREST_BASE'].split(','):
            base = []
            for seed in seeds:
                ctx = b.new_context(viewport={'width': 640, 'height': 360})
                ctx.add_init_script(SEED_RANDOM)
                pg = ctx.new_page()
                pg.goto(f'http://localhost:{PORT}/?timer&map={mapId}&monster=seino&seed={seed}')
                time.sleep(2.5)
                pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
                pg.wait_for_function('window.__horror', timeout=20000)
                pg.click('#horror button:has-text("시작")')
                pg.evaluate(FAKE_LOCK)
                pg.evaluate('window.__horrorBot = { careful: true }')
                pg.evaluate(bot)
                base.append(pg.evaluate(PLAIN_PLAY, limit))
                ctx.close()
            print(f'{mapId} seino', 'escapes', sum(r['state'] == 'end' for r in base), '/', len(base), 'catches', [r['caught'] for r in base], 'times', [r['t'] for r in base])
    b.close()


with sync_playwright() as pw:
    run_forest(pw)
if fails:
    print('FAILED:', fails)
    sys.exit(1)
