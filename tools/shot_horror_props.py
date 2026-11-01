# 공포 모드 소품 그림을 네 맵에서 실제 게임으로 찍는다. 등, 배관, 천장, 낮은 가구, 붉은 쪽지.
# 사용법: npx vite --port 5511 --strictPort 를 켠 뒤
#   HORROR_PORT=5511 python3 tools/shot_horror_props.py 출력폴더           (1280x720, 568x320 사진, 등 깜빡임, 그리기 수)
#   HORROR_PORT=5511 python3 tools/shot_horror_props.py 출력폴더 --calls   (그리기 수만. 그림 넣기 전과 비교할 때)
#   HORROR_PORT=5511 python3 tools/shot_horror_props.py 출력폴더 --broken  (새 그림을 전부 막고 원래 색으로 도는지 보기)
import math, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CALLS_ONLY = '--calls' in sys.argv
BROKEN = '--broken' in sys.argv
PORT = os.environ.get('HORROR_PORT', '5288')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ALL_MAPS = ('factory', 'sewer', 'school', 'station', 'park', 'mart')
MAPS = [m for m in ALL_MAPS if m in sys.argv] or list(ALL_MAPS)
SIZES = {'pc': (1280, 720), 'phone': (568, 320)}
NEW_ART = ['light', 'pipe', 'ceil']
CELL = 3
EYE = 1.6
fails = []


def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name, info)
    if not ok:
        fails.append(name)


# 게임 안 물건을 찾아 벽에 붙은 자리를 돌려준다
FIND = """(kind) => {
  const g = window.__horror;
  let found = null;
  g.scene.traverse((o) => {
    if (found || !o.isInstancedMesh) return;
    const src = o.material.map?.image?.src ?? '';
    const hit = kind === 'light' ? o.material === g.world.lightMat
      : kind === 'pipe' ? o.geometry.type === 'CylinderGeometry'
      : /horror_(desk|bench)/.test(src);
    if (hit) found = o;
  });
  if (!found) return null;
  const e = found.matrixWorld.elements.slice(), m = found.instanceMatrix.array;
  const best = [];
  for (let i = 0; i < found.count; i++) {
    best.push({ x: m[i * 16 + 12] + e[12], y: m[i * 16 + 13] + e[13], z: m[i * 16 + 14] + e[14] });
  }
  return best;
}"""

# 물건 앞 빈 칸을 찾아 서서 바라본다. 맵 끝이나 벽으로 뒤가 막히지 않는 자리를 고른다
AIM = """({ items, dist, light, pick, wall }) => {
  const g = window.__horror, map = g.map, free = (x, y) => map.rows[Math.floor(y)]?.[Math.floor(x)] && !'#LRCXSMFKAB'.includes(map.rows[Math.floor(y)][Math.floor(x)]);
  const good = [];
  for (const it of items) {
    const ix = it.x / 3, iy = it.z / 3;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let ok = true;
      for (let s = 0.6; s <= dist / 3; s += 0.2) ok = ok && free(ix + dx * s, iy + dy * s);
      if (wall && free(ix - dx * 0.3, iy - dy * 0.3)) ok = false;
      if (ok) good.push({ it, x: ix + dx * dist / 3, y: iy + dy * dist / 3, dx, dy });
    }
  }
  if (!good.length) return null;
  const s = good[Math.min(pick, good.length - 1)];
  g.lightOn = light;
  g.p = { x: s.x, y: s.y };
  g.yaw = Math.atan2(s.dx, s.dy);
  g.pitch = Math.atan2(s.it.y - 1.6, dist) ;
  return s;
}"""

HOLD = """() => { const g = window.__horror; for (const h of g.hunters) Object.assign(h.stalker ?? g.stalker, { mode: 'stunned', stunT: 9999, path: [] }); g.stalker.x = 0.5; g.stalker.y = 0.5; }"""

# 등 색을 몇 초 적어 깜빡임이 살아 있는지 본다
FLICKER = """async () => {
  const c = window.__horror.world.lightMat.color, seen = [];
  for (const end = performance.now() + 5000; performance.now() < end;) {
    seen.push(Math.max(c.r, c.g, c.b));
    await new Promise((r) => setTimeout(r, 30));
  }
  return { min: Math.min(...seen), max: Math.max(...seen), map: !!window.__horror.world.lightMat.map, color: c.getHexString() };
}"""

CALLS = """async () => { const g = window.__horror, i = g.renderer.info; g.lightOn = true; g.p = window.__horrorLogic?.center?.(g.map.start) ?? { x: g.map.start.cx + 0.5, y: g.map.start.cy + 0.5 }; g.yaw = 0; g.pitch = 0;
  const raf = () => new Promise(requestAnimationFrame); await raf(); await raf(); i.autoReset = false; i.reset(); await raf(); const n = i.render.calls; i.autoReset = true; return n; }"""


def wait(pg, secs=0.5):
    pg.evaluate(f'new Promise((r) => setTimeout(r, {int(secs * 1000)}))')


def open_map(pg, mapId):
    pg.goto(f'http://localhost:{PORT}/?timer&fps&map={mapId}&monster=seino')
    time.sleep(2.5)
    pg.evaluate("window.__shockGame.scene.getScene('Title').openHorror()")
    pg.wait_for_function('window.__horror', timeout=20000)
    time.sleep(1)
    pg.click('#horror button:has-text("시작")')
    time.sleep(1)
    pg.evaluate(HOLD)


def shoot(pg, tag, items, dist, light=True, pick=0, wall=True):
    s = pg.evaluate(AIM, {'items': items, 'dist': dist, 'light': light, 'pick': pick, 'wall': wall})
    check(f'{tag}: place found', s is not None)
    wait(pg, 1.0)
    pg.screenshot(path=f'{OUT}/{tag}.png')


def clue_view(pg, tag):
    """바닥의 붉은 쪽지를 내려다본다"""
    spots = pg.evaluate("window.__horror.clueMeshes.map((m) => ({ x: m.position.x, y: 0.03, z: m.position.z }))")
    if not spots:
        print(f'{tag}: this round has no clue notes')
        return
    for light, name in ((True, 'on'), (False, 'dark')):
        shoot(pg, f'{tag}_{name}', spots, 1.9, light, wall=False)


def run_map(pg, mapId, sizes):
    for size, (w, h) in sizes.items():
        pg.set_viewport_size({'width': w, 'height': h})
        open_map(pg, mapId)
        wait(pg, 1)
        tag = f'{mapId}_{size}'
        for kind, dist in (('light', 1.8), ('pipe', 1.8), ('low', 1.8)):
            items = pg.evaluate(FIND, kind)
            if not items:
                print(tag, 'no', kind)
                continue
            shoot(pg, f'{tag}_{kind}', items, dist)
            if kind == 'light':
                shoot(pg, f'{tag}_{kind}2', items, 1.8, True, 5)
                shoot(pg, f'{tag}_{kind}_dark', items, 5.5, False)
        items = pg.evaluate(FIND, 'light')
        shoot(pg, f'{tag}_ceil', items, 2.4, True, 1)
        pg.evaluate('window.__horror.pitch = 1.15')
        wait(pg, 1)
        pg.screenshot(path=f'{OUT}/{tag}_ceil.png')
        clue_view(pg, f'{tag}_clue')
        if size == 'pc':
            f = pg.evaluate(FLICKER)
            check(f'{mapId}: lamp flicker still runs', f['max'] > f['min'] * 2, f)
            check(f'{mapId}: lamp stays bright', f['max'] > 0.7, f)


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, executable_path=CHROME, args=ARGS)
        pg = b.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
        for mapId in MAPS:
            if BROKEN:
                pg.route('**/art/horror_*', lambda r: r.abort() if any(n in r.request.url for n in ('_light_', '_pipe_', '_ceil_', '_clue', '_desk', '_bench')) else r.continue_())
            if not CALLS_ONLY:
                run_map(pg, mapId, {'pc': SIZES['pc']} if BROKEN else SIZES)
            pg.set_viewport_size({'width': 1280, 'height': 720})
            open_map(pg, mapId)
            print('calls', mapId, pg.evaluate(CALLS))
        check('no page errors', not errs, errs[:3])
        b.close()
    print('FAILED' if fails else 'ALL OK', fails)
    sys.exit(1 if fails else 0)


main()
