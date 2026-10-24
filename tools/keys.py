import time
KC = {'Enter':(13,'Enter','Enter'),'d':(68,'KeyD','d'),'a':(65,'KeyA','a'),'j':(74,'KeyJ','j'),'k':(75,'KeyK','k'),' ':(32,'Space',' '),'Escape':(27,'Escape','Escape'),'r':(82,'KeyR','r'),'h':(72,'KeyH','h'),'t':(84,'KeyT','t')}
def kd(k):
    c,code,key=KC[k]; cdp("Input.dispatchKeyEvent", type="rawKeyDown", key=key, code=code, windowsVirtualKeyCode=c, nativeVirtualKeyCode=c)
def ku(k):
    c,code,key=KC[k]; cdp("Input.dispatchKeyEvent", type="keyUp", key=key, code=code, windowsVirtualKeyCode=c, nativeVirtualKeyCode=c)
def tap(k, hold=0.05):
    kd(k); time.sleep(hold); ku(k)
def st():
    return js("""(()=>{const s=window.__shock&&window.__shock.scene; if(!s||!s.player) return null; const p=s.player; return {x:Math.round(p.x),y:Math.round(p.y),hp:p.health.current,max:p.health.max,dead:p.dead,lv:s.save.level,xp:s.save.xp,mons:s.monsters.length,boss:s.bossStarted, bstate:s.boss.state, arms:s.boss.arms.map(a=>a.alive?a.health.current:0), core:s.boss.coreHealth.current, exposed:s.boss.coreExposed, ended:s.ended, action:s.boss.action&&s.boss.action.type+':'+s.boss.action.phase}})()""")
