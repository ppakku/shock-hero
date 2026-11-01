# 괴물 모형을 앞, 옆, 가까이, 멀리, 어둠에서 찍는다. 게임을 켜지 않고 모형만 본다.
# 사용법: npx vite --port 5288 --strictPort 를 켠 뒤
#   python3 tools/shot_creature.py 출력폴더 gazer maw mole
import json, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
WHO = sys.argv[2:] or ['gazer', 'maw', 'mole']
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
URL = f"http://localhost:{os.environ.get('PORT', '5288')}/tools/creature_view.html"
SHOTS = {
    'front': dict(cam=[0, 1.6, 4.2], at=[0, 1.4, 0]),
    'side': dict(cam=[4.2, 1.6, 0], at=[0, 1.4, 0]),
    'three': dict(cam=[2.8, 1.6, 3.2], at=[0, 1.4, 0]),
    'back': dict(cam=[0, 1.6, -4.2], at=[0, 1.4, 0]),
    'near': dict(cam=[0, 1.6, 2.4], at=[0, 2.0, 0]),
    'far': dict(cam=[0, 1.6, 14], at=[0, 1.4, 0], fov=45),
    'dark': dict(cam=[0, 1.6, 7], at=[0, 1.5, 0], light=False),
    'darkchase': dict(cam=[0, 1.6, 7], at=[0, 1.5, 0], light=False, mode='chase'),
    'chase': dict(cam=[3, 1.6, 3.2], at=[0, 1.4, 0], mode='chase', walk=2),
    'stunned': dict(cam=[0, 1.6, 4.2], at=[0, 1.4, 0], mode='stunned'),
    'search': dict(cam=[2.5, 1.6, 3.2], at=[0, 1.4, 0], mode='search'),
    'frozen': dict(cam=[0, 1.6, 4.2], at=[0, 1.4, 0], mode='watch'),
    'walk': dict(cam=[4.2, 1.6, 0.2], at=[0, 1.4, 0], heading=0, walk=1),
    'catch': dict(cam=[0, 1.6, 0.6], at=[0, 1.6, 0], mode='chase', face=True),
}

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME, args=ARGS)
    pg = b.new_page(viewport={'width': 960, 'height': 600})
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:400]))
    pg.on('console', lambda m: errs.append(f'{m.type}: ' + m.text[:300]) if m.type in ('error',) else None)
    pg.goto(URL)
    pg.wait_for_function('window.ready', timeout=30000)
    for who in WHO:
        for name, view in SHOTS.items():
            info = pg.evaluate('(v) => window.view(v)', {'who': who, **({'mode': 'chase'} if who == 'mole' else {}), **view})
            pg.screenshot(path=f'{OUT}/{who}_{name}.png')
            print(who, name, json.dumps(info))
    print('\n'.join(sorted(set(errs))) or 'no errors')
    b.close()
