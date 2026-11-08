# 놀이공원과 마트 그림. Gemini 원본(~/workspace/shock-hero-art/park/, mart/)을 게임용 파일로 만든다. 원본은 레포에 넣지 않는다.
# 사용법: python3 tools/make_parkmart_art.py 원본폴더(shock-hero-art) [맵:이름...]
#   예: python3 tools/make_parkmart_art.py ~/workspace/shock-hero-art park:door mart
#   이름: wall, floor, ceil, pipe, locker, board, light, low, extra, door, intro
# 도움 아이템과 지도판은 tools/make_aid_art.py 가 만든다 (원본은 aids/items_<맵>.png, board_<맵>.png).
# 1) 되풀이 그림(벽, 바닥, 천장, 난간)은 make_forest_art 처럼 별 표시를 지우고 이음매 없이 되감는다.
#    천장은 어둠이 달라지지 않게, 그림 평균이 맵의 ceil 색과 같아지는 tint 를 함께 찍는다 (테마에 옮겨 적는다)
# 2) 앞면 그림(사물함, 간판, 마트 포스터, 냉동고)은 별 자리를 덮고 크기만 맞춘다
# 3) 벽에 붙은 큰 소품(회전목마, 매표소)은 마젠타를 빼서 어둡게 한 벽 그림 위에 얹는다 (게임은 jpg 판으로 그린다)
# 4) 낮은 소품(울타리, 수레)은 틈으로 뒤가 보이게 투명 webp 로 둔다 (게임은 alphaTest 로 자른다)
# 5) 잠긴 문 두 장(빨강, 파랑)은 문 그림 하나에 색칠한 자물쇠 판을 그려 만든다
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_forest_art as fa  # noqa: E402  (별 지우기, 되감기, 마젠타 빼기를 같이 쓴다)
from make_horror_props import to_linear, to_srgb  # noqa: E402

ROOT = os.path.expanduser(sys.argv[1])
ONLY = sys.argv[2:]
OUT = 'public/art'
CEIL = {'park': 0x1c1820, 'mart': 0x20242a}  # 테마의 ceil 색
LIGHT = {'park': (256, 72), 'mart': (256, 190)}  # 테마 decor.light 의 w:h
LOW = {'park': ('rail', 'horror_rail_park', (512, 304)), 'mart': ('trolley', 'horror_trolley', (512, 341))}  # 테마 decor.low 의 w:h
EXTRA = {'park': [('ride', 'horror_park_ride', (512, 512)), ('booth', 'horror_park_booth', (472, 512))], 'mart': []}
FRONT = {'park': [], 'mart': [('poster', 'horror_mart_poster', (512, 512))]}  # 원본이 화면을 꽉 채운 앞면 소품


def use(m):
    fa.RAW = f'{ROOT}/{m}'


def ceil(m):
    use(m)
    fa.tileable('ceil', f'horror_ceil_{m}', 512)
    a = np.asarray(Image.open(f'{OUT}/horror_ceil_{m}.jpg')).astype(float)
    mean = to_linear(a).mean(axis=(0, 1))
    plain = CEIL[m]
    goal = to_linear(np.array([plain >> 16, plain >> 8 & 255, plain & 255], float))
    rgb = (to_srgb(np.minimum(1, goal / mean)) * 255).round().astype(int)
    print(f'  {m} ceilArt tint 0x{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}')


def front(m, name, out, size):
    use(m)
    fa.save_jpg(fa.erase_star(fa.load(name)).resize(size, Image.LANCZOS), out, 82)


# 색 전구 줄: 검은 바탕에서 빛나는 줄만 잘라 낸다
def light(m):
    use(m)
    im = fa.erase_star(fa.load('light'))
    if m == 'park':
        a = np.asarray(im).astype(float).max(axis=2)
        rows = np.where(a.max(axis=1) > 120)[0]
        cols = np.where(a.max(axis=0) > 120)[0]
        pad = 12
        im = im.crop((max(0, cols[0] - pad), max(0, rows[0] - pad), min(im.width, cols[-1] + pad), min(im.height, rows[-1] + pad)))
    fa.save_jpg(im.resize(LIGHT[m], Image.LANCZOS), f'horror_light_{m}', 82)


# 투명한 곳을 남겨 w:h 판에 가운데 아래로 맞춘다
def fit_box(im, size):
    W, H = size
    k = min(W / im.width, H / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    box = Image.new('RGBA', size, (0, 0, 0, 0))
    box.paste(im, ((W - im.width) // 2, H - im.height))
    return box


def low(m):
    use(m)
    name, out, size = LOW[m]
    im = fa.keyed(name, 1024)
    fa.save_webp(fa.bleed(fit_box(im, size)), out)


def extra(m):
    use(m)
    for name, out, size in EXTRA[m]:
        wall = Image.open(f'{OUT}/horror_{m}_wall.jpg').convert('RGB').resize(size, Image.LANCZOS)
        wall = ImageEnhance.Brightness(wall).enhance(0.45)
        obj = fit_box(fa.keyed(name, 1024), (round(size[0] * 0.96), round(size[1] * 0.97)))
        bg = wall.convert('RGBA')
        bg.alpha_composite(obj, ((size[0] - obj.width) // 2, size[1] - obj.height))
        fa.save_jpg(bg.convert('RGB'), out, 82)
    for name, out, size in FRONT[m]:
        front(m, name, out, size)


def door(m):
    use(m)
    base = fa.erase_star(fa.load('door')).resize((512, 512), Image.LANCZOS)
    for name, color in (('red', (200, 34, 26)), ('blue', (34, 80, 210))):
        img = base.copy()
        d = ImageDraw.Draw(img)
        # 자물쇠와 색칠한 판: 멀리서도 문 색이 읽히게 크게
        d.rounded_rectangle((176, 196, 336, 316), radius=14, fill=color, outline=(30, 20, 15), width=6)
        d.arc((206, 140, 306, 240), 180, 360, fill=(170, 170, 175), width=14)
        d.rectangle((226, 236, 286, 290), fill=(60, 55, 50))
        d.ellipse((248, 250, 264, 266), fill=(10, 10, 10))
        d.rectangle((252, 262, 260, 282), fill=(10, 10, 10))
        fa.save_jpg(img, f'horror_door_{m}_{name}', 82)


def intro(m):
    use(m)
    fa.save_jpg(fa.erase_star(fa.load(f'intro_{m}')).resize((1024, 572), Image.LANCZOS), f'horror_intro_{m}', 82)


def tile(name, out, size):
    def job(m):
        use(m)
        fa.tileable(name, out.format(m=m), size)
    return job


JOBS = {
    'wall': tile('wall', 'horror_{m}_wall', 512),
    'floor': tile('floor', 'horror_{m}_floor', 512),
    'ceil': ceil,
    'pipe': tile('pipe', 'horror_pipe_{m}', 256),
    'locker': lambda m: front(m, 'locker', f'horror_{m}_locker', (512, 512)),
    'board': lambda m: front(m, 'board', f'horror_{m}_board', (512, 512)),
    'light': light,
    'low': low,
    'extra': extra,  # 벽 그림을 쓰므로 wall 다음에 돈다
    'door': door,
    'intro': intro,
}


def wanted(m, name):
    return not ONLY or m in ONLY or f'{m}:{name}' in ONLY


if __name__ == '__main__':
    fa.OUT = OUT
    for m in ('park', 'mart'):
        for name, job in JOBS.items():
            if wanted(m, name):
                job(m)
