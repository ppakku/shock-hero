# browser-harness 안에서 exec(open('tools/run_bossb.py').read()) 로 불러 쓰는 보스 B 확인 도우미
import time, json, os
ROOT = os.environ.get('SHOCK_ROOT', '.')
BOT = open(os.path.join(ROOT, 'tools/bot_bossb.js')).read()

def state():
    for _ in range(3):
        try:
            return js("""(()=>{const s=window.__shock&&window.__shock.scene; if(!s||!s.player) return null; const p=s.player; const b=s.boss;
            return {stage:s.stageNum,x:Math.round(p.x),y:Math.round(p.y),hp:Math.round(p.health.current),dead:p.dead,lv:s.save.level,mons:s.monsters.length,boss:s.bossStarted,
            bstate:b.state, parts:b.hudParts().map(q=>q.label+':'+Math.round(q.ratio*100)), act:b.action&&(b.action.type+':'+b.action.phase), rage:!!b.raging, phase:b.phase||null,
            ended:s.ended, hud:s.scene.get('HUD').mode, t:Math.round(s.registry.get('runTime'))}})()""")
        except Exception as e:
            print('state retry', str(e)[:80]); time.sleep(1)
    return None

def start_stage(n, fromCheckpoint=True, level=None):
    js(f"""(()=>{{const g=window.__shockGame; const gs=g.scene.getScene('Game');
      if (g.scene.isActive('Game')) {{ g.registry.set('runTime',0); gs.scene.restart({{stage:{n},fromCheckpoint:{str(fromCheckpoint).lower()}}}); }}
      else {{ const t=g.scene.getScene('Title'); t.selected={n}; t.begin({str(fromCheckpoint).lower()}); }} }})()""")
    time.sleep(1.5)
    print(js(BOT))

def skip_to_boss():
    js("""(()=>{const s=window.__shock.scene; for (const m of [...s.monsters]) m.die(); s.player.setPosition(s.stage.arena.startX + 200, 440);})()""")

def run(limit=420, every=10, shots=None, on_tick=None):
    t0=time.time(); deaths=0; last=None; patterns=set(); fight_t0=None
    while time.time()-t0 < limit:
        st=state()
        if st is None: time.sleep(1); continue
        if st['act']: patterns.add(st['act'].split(':')[0])
        if st['boss'] and fight_t0 is None: fight_t0 = st['t']
        if on_tick: on_tick(st)
        if st['hud']=='gameover':
            deaths+=1; print('DEATH', st)
            js("window.__shockGame.scene.getScene('HUD').restartFromOverlay('retry')"); time.sleep(1.5)
            print(js(BOT)); skip_to_boss(); continue
        if st['hud']=='victory':
            print('VICTORY', st, 'deaths', deaths, 'patterns', sorted(patterns)); return st, deaths, patterns
        if last is None or time.time()-last>every:
            last=time.time(); print(round(time.time()-t0), st)
        time.sleep(0.25)
    print('TIMEOUT', state(), sorted(patterns)); return None, deaths, patterns
