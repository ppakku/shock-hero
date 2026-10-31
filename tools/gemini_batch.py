# Gemini 웹에서 그림을 차례로 만들어 파일로 저장한다. API 키 없이 Chrome 에 로그인된 Gemini 를 쓴다.
# 쓰는 법: GEMINI_BATCH=주문서.json browser-harness < tools/gemini_batch.py
# 주문서: [{ "prompt": "...", "out": "/절대/경로/그림.png" }, ...]. 이미 있는 파일은 건너뛴다.
# 한 번에 하나씩만 돌린다 (주문이 많으면 Gemini 가 거절하기 쉽다).
#
# 안전 규칙: 2026-10-31 공유 연결의 "현재 탭"이 다른 세션 탭으로 바뀌어 프롬프트가 Apps Script 편집기에 입력됐다.
# 그래서 이 파일은 전용 탭을 직접 만들어 그 연결(sid)로만 명령을 보낸다.
# goto_url, press_key, js, switch_tab, new_tab 처럼 현재 탭에 작동하는 도구는 쓰지 않는다.
# 글자를 넣기 직전과 보내기 직전에 check_* 가 통과하지 않으면 그 자리에서 멈춘다.
import json, os, shutil, sys, tempfile, time

GEMINI = 'https://gemini.google.com/app'
orders = json.load(open(os.environ['GEMINI_BATCH']))
tab_id = cdp('Target.createTarget', url='about:blank', background=True)['targetId']
sid = cdp('Target.attachToTarget', targetId=tab_id, flatten=True)['sessionId']
DOWNLOADS = tempfile.mkdtemp(prefix='gemini-')


def page(expr):
    r = cdp('Runtime.evaluate', session_id=sid, expression=expr, returnByValue=True, awaitPromise=True)
    return r.get('result', {}).get('value')


def stop(why):
    sys.exit('gemini_batch.py stopped: ' + why)


def on_gemini():
    return page("location.hostname") == 'gemini.google.com'


def check_ready():
    if not on_gemini():
        stop('tab left gemini.google.com')
    if not page("!!document.activeElement?.closest?.('.ql-editor')"):
        stop('focus is not in the Gemini prompt box')


def check_typed(text):
    if not on_gemini():
        stop('tab left gemini.google.com')
    if page("document.querySelector('.ql-editor')?.innerText.trim()") != text.strip():
        stop('prompt box does not hold the prompt')


def go_gemini():
    cdp('Page.navigate', session_id=sid, url=GEMINI)
    for _ in range(40):
        time.sleep(0.5)
        if on_gemini() and page("!!document.querySelector('.ql-editor')"):
            return
    stop('Gemini prompt box did not appear')


def images():
    return page("[...document.querySelectorAll('img')].filter(i=>i.naturalWidth>300).length") or 0


# 그림 위 '원본 크기 이미지 다운로드' 버튼으로 원본 PNG 를 받는다 (화면의 그림은 blob 이라 페이지 안에서 꺼낼 수 없다)
def save_last(path):
    # 보이지 않는 탭에서는 마우스 명령이 끝나지 않아 페이지 안에서 마우스를 올린 신호를 보낸다
    page("""(()=>{const im=[...document.querySelectorAll('img')].filter(i=>i.naturalWidth>300).pop();
      for(const t of ['pointerover','mouseover','mouseenter'])im.dispatchEvent(new MouseEvent(t,{bubbles:true}))})()""")
    time.sleep(1)
    before = set(os.listdir(DOWNLOADS))
    if not page("""(()=>{const b=[...document.querySelectorAll('button')].filter(b=>/다운로드|download/i.test(b.getAttribute('aria-label')||'')).pop();b?.click();return !!b})()"""):
        return False
    for _ in range(60):  # 원본이 커서 몇십 초 걸릴 수 있다
        time.sleep(1)
        got = [f for f in set(os.listdir(DOWNLOADS)) - before if not f.endswith('.crdownload')]
        if got:
            shutil.move(os.path.join(DOWNLOADS, got[0]), path)
            return True
    return False


def make(o):
    go_gemini()
    for _ in range(20):  # 페이지가 뜨는 동안에는 입력칸이 다시 그려져 초점이 빠질 수 있다
        page("document.querySelector('.ql-editor')?.focus()")
        time.sleep(0.5)
        if page("!!document.activeElement?.closest?.('.ql-editor')"):
            break
    check_ready()
    text = '이미지를 만들어 줘. ' + o['prompt']
    cdp('Input.insertText', session_id=sid, text=text)
    time.sleep(0.8)
    check_typed(text)
    # 보이지 않는 탭에서는 Enter 가 먹지 않아 보내기 버튼을 이 탭 안에서 누른다
    page("""[...document.querySelectorAll('button')].find(b=>/보내기|send/i.test(b.getAttribute('aria-label')||''))?.click()""")
    time.sleep(2)
    if page("document.querySelector('.ql-editor')?.innerText.trim()"):
        stop('prompt was not sent')
    for _ in range(100):  # 최대 약 200 초
        time.sleep(2)
        if images() > 0:
            time.sleep(2)
            return save_last(o['out'])
    return False


cdp('Page.enable', session_id=sid)
cdp('Page.setDownloadBehavior', session_id=sid, behavior='allow', downloadPath=DOWNLOADS)  # 이 탭의 다운로드만 따로 받는다
try:
    for o in orders:
        if os.path.exists(o['out']):
            print('skip', o['out'], flush=True)
            continue
        os.makedirs(os.path.dirname(o['out']), exist_ok=True)
        done = make(o)
        print('ok' if done else 'FAIL', o['out'], '' if done else (page("document.body.innerText") or '')[-200:], flush=True)
        time.sleep(3)
finally:
    cdp('Target.closeTarget', targetId=tab_id)
