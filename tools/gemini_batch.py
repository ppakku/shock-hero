# Gemini 웹에서 그림을 차례로 만들어 파일로 저장한다. API 키 없이 Chrome 에 로그인된 Gemini 를 쓴다.
# 쓰는 법: GEMINI_BATCH=주문서.json browser-harness < tools/gemini_batch.py
# 주문서: [{ "prompt": "...", "out": "/절대/경로/그림.png" }, ...]. 이미 있는 파일은 건너뛴다.
# 한 번에 하나씩만 돌린다 (Chrome 탭 하나를 쓰므로 동시에 돌리면 서로 방해한다).
import json, os, shutil, sys, tempfile, time

# 사용 중지: 2026-10-31 공유 browser-harness 연결에서 현재 탭이 다른 세션 탭으로 바뀌어
# 프롬프트가 Apps Script 편집기에 입력됐다. 전용 브라우저 연결과 입력 직전 탭 확인이 생길 때까지 돌리지 않는다.
sys.exit('gemini_batch.py is disabled: it can type into another tab on a shared browser connection')

orders = json.load(open(os.environ['GEMINI_BATCH']))
new_tab('https://gemini.google.com/app')
tab = current_tab()
DOWNLOADS = tempfile.mkdtemp(prefix='gemini-')
cdp('Browser.setDownloadBehavior', behavior='allow', downloadPath=DOWNLOADS)  # 평소 다운로드 폴더를 어지럽히지 않게


def images():
    return js("[...document.querySelectorAll('img')].filter(i=>i.naturalWidth>300).length") or 0


# 그림 위 '원본 크기 이미지 다운로드' 버튼으로 원본 PNG 를 받는다 (화면의 그림은 blob 이라 페이지 안에서 꺼낼 수 없다)
def save_last(path):
    box = js("""(()=>{const im=[...document.querySelectorAll('img')].filter(i=>i.naturalWidth>300).pop();
      im.scrollIntoView({block:'center'});const r=im.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()""")
    cdp('Input.dispatchMouseEvent', type='mouseMoved', x=box[0], y=box[1])
    time.sleep(1)
    before = set(os.listdir(DOWNLOADS))
    js("""[...document.querySelectorAll('button')].filter(b=>/다운로드|download/i.test(b.getAttribute('aria-label')||'')).pop().click()""")
    for _ in range(60):  # 원본이 커서 몇십 초 걸릴 수 있다
        time.sleep(1)
        got = [f for f in set(os.listdir(DOWNLOADS)) - before if not f.endswith('.crdownload')]
        if got:
            shutil.move(os.path.join(DOWNLOADS, got[0]), path)
            return True
    return False


for o in orders:
    if os.path.exists(o['out']):
        print('skip', o['out'])
        continue
    os.makedirs(os.path.dirname(o['out']), exist_ok=True)
    goto_url('https://gemini.google.com/app')
    wait_for_load()
    for _ in range(40):
        if js("!!document.querySelector('.ql-editor')"):
            break
        time.sleep(0.5)
    js("document.querySelector('.ql-editor').focus()")
    cdp('Input.insertText', text='이미지를 만들어 줘. ' + o['prompt'])
    time.sleep(0.8)
    press_key('Enter')
    done = False
    for _ in range(100):  # 최대 약 200 초
        time.sleep(2)
        if images() > 0:
            time.sleep(2)
            done = save_last(o['out'])
            break
    print('ok' if done else 'FAIL', o['out'], '' if done else (js("document.body.innerText") or '')[-200:], flush=True)
    time.sleep(3)

cdp('Target.closeTarget', targetId=tab['targetId'])
