# 변종 보스 확인: 스테이지 보스전을 브라우저로 띄워 전용 공격을 강제로 내고 화면을 저장한다.
# 쓰는 법: 개발 서버를 켜고 python3 tools/run_variant.py <스테이지> <저장 폴더> [포트]
import os, sys, time
from playwright.sync_api import sync_playwright

n, out = int(sys.argv[1]), sys.argv[2]
port = sys.argv[3] if len(sys.argv) > 3 else '5173'
os.makedirs(out, exist_ok=True)
errors = []

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='chrome', headless=True, args=['--use-angle=swiftshader'])
    p = b.new_page(viewport={'width': 1280, 'height': 720})
    p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(f'http://localhost:{port}/?all&debug')
    p.wait_for_function('window.__shockGame?.scene.getScenes(true).length', timeout=60000)
    time.sleep(3)
    print('scenes', p.evaluate('window.__shockGame.scene.getScenes(true).map(s=>s.scene.key)'), errors[:2], flush=True)
    p.evaluate(f"""()=>{{const g=window.__shockGame; g.scene.getScenes(true).forEach(s=>g.scene.stop(s.scene.key)); g.registry.set('runTime',0); g.scene.start('Game',{{stage:{n},fromCheckpoint:true}})}}""")
    p.wait_for_function('window.__shock?.scene?.boss?.state', timeout=60000)
    time.sleep(1.5)
    p.evaluate("""()=>{const s=window.__shock.scene; window.__shockAutoPick=true; for (const m of [...s.monsters]) m.die(); s.player.setPosition(s.stage.arena.startX+120, s.stage.groundY-60); s.player.health.current=99999}""")
    p.wait_for_function('window.__shock.scene.boss.state==="fight"', timeout=30000)
    p.evaluate("""()=>{const b=window.__shock.scene.boss; b.def={...b.def,phases:b.def.phases.map(()=>['signature'])}; if(b.combo!==undefined) b.tiredRoll=99; b.timer=0}""")
    seen, hurt0 = False, p.evaluate('window.__shock.scene.player.health.current')
    for i in range(16):
        time.sleep(0.75)
        act = p.evaluate('window.__shock.scene.boss.action?.type ?? null')
        seen = seen or act == 'signature'
        p.screenshot(path=f'{out}/s{n}_{i:02d}.png')
    print('stage', n, 'skin', p.evaluate('window.__shock.scene.boss.skin'), 'signature ran', seen,
          'hp lost', hurt0 - p.evaluate('window.__shock.scene.player.health.current'), 'errors', errors[:3])
    b.close()
