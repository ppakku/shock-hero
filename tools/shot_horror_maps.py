# 놀이공원과 마트를 진짜 게임에서 확인한다. 고르기 화면, 새 그림 앞에 서서 찍기, 봇으로 끝까지 하기.
# 사용법: npx vite --port 5601 --strictPort 를 켠 뒤
#   HORROR_PORT=5601 python3 tools/shot_horror_maps.py 출력폴더 --chooser  (도장 0, 11, 12, 20개에서 고르기 화면이 스크롤 없이 들어가는지)
#   HORROR_PORT=5601 python3 tools/shot_horror_maps.py 출력폴더 --art      (맵마다 벽, 바닥, 천장, 사물함, 문, 등, 난간, 간판, 벽 조각, 낮은 물건, 안내 화면 사진)
#   HORROR_PORT=5601 python3 tools/shot_horror_maps.py 출력폴더 --play     (두 맵, 네 괴물을 1280x720 과 568x320 에서 봇으로 끝까지. 그리기 수)
import os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
PORT = os.environ.get('HORROR_PORT', '5601')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
MAPS = ('park', 'mart')
MONSTERS = ('seino', 'gazer', 'maw', 'ward')
SIZES = {'pc': (1280, 720), 'phone': (568, 320)}
fails = []
os.makedirs(OUT, exist_ok=True)


def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name, info)
    if not ok:
        fails.append(name)


def page_for(b, size):
    w, h = SIZES[size]
    o = {'viewport': {'width': w, 'height': h}}
    if size == 'phone':
        o.update(has_touch=True, is_mobile=True, user_agent=PHONE_UA, device_scale_factor=2, screen={'width': w, 'height': h})
    pg = b.new_context(**o).new_page()
    pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)[:300]))
    return pg


# 칸 수를 게임에서 읽어 도장을 count 개 찍고 저장한다
SEED = """async (count) => {
  const key = 'shock-hero-save-v1';
  const { boardCells, cellKey } = await import('/src/logic/horrorStamps.js');
  const stamps = Object.fromEntries(boardCells({}).slice(0, count).map((c) => [cellKey(c), 'plain']));
  const save = JSON.parse(localStorage.getItem(key) || '{}');
  localStorage.setItem(key, JSON.stringify({ ...save, horror: { ...save.horror, stamps, lastCleared: false } }));
}"""
# 화면 안에 다 들어가는지 잰다
FITS = """() => {
  const el = document.querySelector('[data-chooser]');
  const out = [...el.querySelectorAll('button,[data-cell]')].filter((b) => { const r = b.getBoundingClientRect(); return r.top < 0 || r.left < 0 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5; }).length;
  const maps = [...el.querySelectorAll('[data-pick]')].length;
  return { scroll: el.scrollHeight, height: el.clientHeight, sideways: el.scrollWidth > el.clientWidth, out, maps, cells: el.querySelectorAll('[data-cell]').length, last: el.querySelector('[data-last-night]').dataset.lastNight };
}"""


def chooser(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    for size in SIZES:
        pg = page_for(b, size)
        pg.goto(f'http://localhost:{PORT}/?timer&fps')
        time.sleep(2.5)
        for n in (0, 11, 12, 20):
            pg.evaluate(SEED, n)
            pg.goto(f'http://localhost:{PORT}/?timer&fps')
            time.sleep(2)
            pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
            pg.wait_for_selector('[data-chooser]', timeout=20000)
            time.sleep(0.8)
            pg.screenshot(path=f'{OUT}/chooser_{size}_{n}.png')
            f = pg.evaluate(FITS)
            check(f'{size} {n} stamps: fits with no scroll', f['scroll'] <= f['height'] + 1 and not f['sideways'] and f['out'] == 0, f)
            check(f'{size} {n} stamps: 20 cells, 11 choice buttons', f['cells'] == 20 and f['maps'] == 11, f)
            check(f'{size} {n} stamps: last night card', (f['last'] == 'open') == (n >= 12), f)
        check(f'{size}: no page errors', not pg.errs, pg.errs[:3])
        pg.context.close()
    b.close()


def open_map(pg, mapId, monster):
    pg.goto(f'http://localhost:{PORT}/?timer&fps&map={mapId}&monster={monster}')
    time.sleep(2.5)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1.2)


def start(pg):
    pg.click('#horror button:has-text("시작")')
    pg.wait_for_function("window.__horror.state === 'play'", timeout=8000)
    time.sleep(0.5)


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


def play(pw):
    bot = open('tools/bot_horror.js', encoding='utf8').read()
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    calls = {}
    for size in SIZES:
        pg = page_for(b, size)
        for mapId in MAPS:
            for monster in MONSTERS:
                tag = f'{mapId}_{monster}_{size}'
                open_map(pg, mapId, monster)
                pg.screenshot(path=f'{OUT}/{tag}_intro.png')
                start(pg)
                time.sleep(1)
                pg.screenshot(path=f'{OUT}/{tag}_start.png')
                pg.evaluate('window.__horrorBot = { careful: true }')
                pg.evaluate(bot)
                res = pg.evaluate(FAST_PLAY, 900)
                print(tag, res)
                calls[tag] = res.get('mean', 0)
                check(f'{tag}: bot escapes', res.get('state') == 'end', res)
                check(f'{tag}: draw calls stay near the others', res.get('max', 999) <= 70, res)
                pg.screenshot(path=f'{OUT}/{tag}_end.png')
                text = pg.inner_text('#horror')
                check(f'{tag}: end screen has the map ending', len(text) > 20, text[:80])
                check(f'{tag}: no page errors', not pg.errs, pg.errs[:3])
                pg.errs.clear()
        pg.context.close()
    print('mean draw calls', calls)
    b.close()


# 지금 맵에서 물건 하나를 찾아 그 앞에 서서 바라본다. pick: 몇 번째 물건
AIM = """({ art, dist, pick }) => {
  const g = window.__horror, map = g.map;
  const mats = [];
  g.scene.traverse((o) => { if (o.isInstancedMesh && (o.material.map?.image?.src ?? '').includes(art)) mats.push(o); });
  const o = mats[0];
  if (!o || !o.count) return null;
  const m = o.instanceMatrix.array, good = [];
  const free = (x, y) => { const ch = map.rows[Math.floor(y)]?.[Math.floor(x)]; return ch && !'#LEPG'.includes(ch); };
  for (let i = 0; i < o.count; i++) {
    const ix = m[i * 16 + 12] / 3, iy = m[i * 16 + 14] / 3, y = m[i * 16 + 13];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let ok = !free(ix - dx * 0.3, iy - dy * 0.3);
      for (let s = 0.2; s <= dist / 3; s += 0.2) ok = ok && free(ix + dx * s, iy + dy * s);
      if (ok) good.push({ x: ix + dx * dist / 3, y: iy + dy * dist / 3, dx, dy, h: y });
    }
  }
  if (!good.length) return null;
  const s = good[Math.min(pick, good.length - 1)];
  g.lightOn = true;
  g.p = { x: s.x, y: s.y };
  g.yaw = Math.atan2(s.dx, s.dy);
  g.pitch = Math.atan2(s.h - 1.6, dist);
  return s;
}"""
HOLD = "(() => { const g = window.__horror; for (const s of g.stalkers) Object.assign(s, { mode: 'stunned', stunT: 9999, path: [], x: 0.5, y: 0.5 }); })()"
# 칸 c 앞에 서서 바라본다. off: 칸에서 떨어진 거리 (칸)
FACE = """({ c, off, pitch }) => {
  const g = window.__horror, map = g.map, way = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([x, y]) => !'#LEPG'.includes(map.rows[Math.floor(c.y + y * off)]?.[Math.floor(c.x + x * off)] ?? '#'));
  g.lightOn = true;
  g.p = { x: c.x + way[0] * off, y: c.y + way[1] * off };
  g.yaw = Math.atan2(way[0], way[1]);
  g.pitch = pitch;
}"""
ITEMS = {
    'park': [('board', 'horror_park_board', 2.2), ('ride', 'horror_park_ride', 3.2), ('booth', 'horror_park_booth', 3.2), ('light', 'horror_light_park', 2.2), ('pipe', 'horror_pipe_park', 2), ('low', 'horror_rail_park', 2)],
    'mart': [('board', 'horror_mart_board', 2.2), ('poster', 'horror_mart_poster', 2.2), ('light', 'horror_light_mart', 2.6), ('pipe', 'horror_pipe_mart', 2), ('low', 'horror_trolley', 2.2)],
}


def art(pw):
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    for size in SIZES:
        pg = page_for(b, size)
        for mapId in MAPS:
            tag = f'{mapId}_{size}'
            bad = []
            pg.on('requestfailed', lambda r: bad.append(r.url))
            pg.on('response', lambda r: bad.append(r.url) if '/art/' in r.url and (r.status >= 400 or 'text/html' in (r.headers.get('content-type') or '')) else None)
            open_map(pg, mapId, 'seino')
            pg.screenshot(path=f'{OUT}/{tag}_intro.png')
            start(pg)
            pg.evaluate(HOLD)
            for name, file, dist in ITEMS[mapId]:
                for pick in (0, 4):
                    s = pg.evaluate(AIM, {'art': file, 'dist': dist, 'pick': pick})
                    check(f'{tag} {name}: found', s is not None)
                    time.sleep(0.7)
                    pg.screenshot(path=f'{OUT}/{tag}_{name}{pick}.png')
            pg.evaluate(FACE, {'c': pg.evaluate('(() => { const m = window.__horror.map, f = (n) => ({ x: n.cx + 0.5, y: n.cy + 0.5 }); return f(m.lockers[3]); })()'), 'off': 1.3, 'pitch': 0})
            time.sleep(0.7)
            pg.screenshot(path=f'{OUT}/{tag}_locker.png')
            for i, door in enumerate(('red', 'blue')):
                pg.evaluate(FACE, {'c': pg.evaluate(f'(() => {{ const c = window.__horror.map.locks[{i}]; return {{ x: c.cx + 0.5, y: c.cy + 0.5 }}; }})()'), 'off': 1.6, 'pitch': 0})
                time.sleep(0.7)
                pg.screenshot(path=f'{OUT}/{tag}_door_{door}.png')
            pg.evaluate(FACE, {'c': pg.evaluate('(() => { const m = window.__horror.map.start; return { x: m.cx + 0.5, y: m.cy + 0.5 }; })()'), 'off': 0, 'pitch': 0})
            time.sleep(0.7)
            pg.screenshot(path=f'{OUT}/{tag}_walls.png')
            pg.evaluate('window.__horror.pitch = -1')
            time.sleep(0.7)
            pg.screenshot(path=f'{OUT}/{tag}_floor.png')
            pg.evaluate('window.__horror.pitch = 1')
            time.sleep(0.7)
            pg.screenshot(path=f'{OUT}/{tag}_ceil.png')
            check(f'{tag}: every art file arrived', not bad, bad[:6])
            check(f'{tag}: no page errors', not pg.errs, pg.errs[:3])
        pg.context.close()
    b.close()


with sync_playwright() as pw:
    if '--chooser' in sys.argv:
        chooser(pw)
    if '--art' in sys.argv:
        art(pw)
    if '--play' in sys.argv:
        play(pw)
print('FAILED' if fails else 'ALL OK', fails)
sys.exit(1 if fails else 0)
