import time, json
BOT = open('bot2.js').read()
def state():
    for _ in range(3):
        try:
            return _state()
        except Exception as e:
            print('state retry', str(e)[:60]); time.sleep(1)
    return None
def _state():
    return js("""(()=>{const s=window.__shock&&window.__shock.scene; if(!s||!s.player) return null; const p=s.player; const b=s.boss;
    return {stage:s.stageNum,x:Math.round(p.x),y:Math.round(p.y),hp:Math.round(p.health.current),max:p.health.max,dead:p.dead,lv:s.save.level,mons:s.monsters.length,gate:s.gateOpen,boss:s.bossStarted,
    arms:b.arms.map(a=>a.alive?Math.round(a.health.current):0),core:Math.round(b.coreHealth.current),exposed:b.coreExposed,ended:s.ended,act:b.action&&b.action.type,
    hud:s.scene.get('HUD').mode,t:Math.round(s.registry.get('runTime')),chests:s.chests.length}})()""")
def start_stage(n, fromCheckpoint=False):
    js(f"""(()=>{{const g=window.__shockGame; const gs=g.scene.getScene('Game');
      if (g.scene.isActive('Game')) {{ g.registry.set('runTime',0); gs.scene.restart({{stage:{n},fromCheckpoint:{str(fromCheckpoint).lower()}}}); }}
      else {{ const t=g.scene.getScene('Title'); t.save.unlocked=5; t.selected={n}; t.begin({str(fromCheckpoint).lower()}); }} }})()""")
    time.sleep(1.5)
    print(js(BOT))
def run(n, limit=420, every=10):
    t0=time.time(); deaths=0; last=None; patterns=set()
    while time.time()-t0 < limit:
        st=state()
        if st is None: time.sleep(1); continue
        if st['act']: patterns.add(st['act'])
        if st['hud']=='gameover':
            deaths+=1; print('DEATH', st)
            js("window.__shockGame.scene.getScene('HUD').restartFromOverlay('retry')"); time.sleep(1.5); continue
        if st['hud']=='victory':
            print('VICTORY', st, 'deaths', deaths, 'patterns', sorted(patterns)); return st
        if last is None or time.time()-last>every:
            last=time.time(); print(round(time.time()-t0), st)
        time.sleep(0.25)
    print('TIMEOUT', state(), sorted(patterns)); return None
