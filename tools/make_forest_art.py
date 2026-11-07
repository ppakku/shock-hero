# 해 질 녘 숲 그림. Gemini 원본(~/workspace/shock-hero-art/forest/)을 게임용 파일로 만든다. 원본은 레포에 넣지 않는다.
# 사용법: python3 tools/make_forest_art.py 원본폴더 [이름...]
#   이름을 주면 그것만 다시 만든다 (bark, floor, crown, bush, hollow, gate, totem, cairn, hair, sky, intro, door)
# 1) 모든 원본의 오른쪽 아래 별 표시(원본 픽셀로 가장자리에서 64~160)를 자리로 지운다
# 2) 되풀이 그림(나무껍질, 숲 바닥)은 make_horror_props 처럼 넓은 얼룩을 펴고 이음매 없이 되감는다
# 3) 마젠타 배경 그림은 알파로 빼고, 가장자리 분홍기를 지우고, 투명한 곳의 색을 둘레 색으로 채워 (게임은 alphaTest 로 자른다)
#    멀리서 흐려질 때 분홍이나 검은 테가 생기지 않게 한다
# 4) 잠긴 문 두 장(빨강, 파랑)은 나무껍질로 판자 울타리를 짜고 쇠사슬과 색칠한 자물쇠 판을 그려 만든다
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_horror_props import wrap_x, flatten  # noqa: E402  (같은 되감기 방식)

RAW = os.path.expanduser(sys.argv[1])
OUT = 'public/art'
ONLY = sys.argv[2:]
STAR = (64, 160)  # 별 표시가 들어 있는 네모: 오른쪽, 아래 가장자리에서 이 픽셀 사이 (원본 크기와 상관없이 같다)


def load(name):
    return Image.open(f'{RAW}/{name}.png').convert('RGB')


def star_box(im, pad=16):
    W, H = im.size
    a, b = STAR
    return (W - b - pad, H - b - pad, W - a + pad, H - a + pad)


# 사진 같은 그림: 별 자리를 바로 왼쪽 그림으로 부드럽게 덮는다
def erase_star(im):
    x0, y0, x1, y1 = star_box(im)
    s = x1 - x0
    patch = im.crop((x0 - s, y0, x0, y1))
    mask = Image.new('L', (s, y1 - y0), 0)
    mask.paste(255, (s // 8, s // 8, s - s // 8, y1 - y0 - s // 8))
    im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(s // 10)))
    return im


def save_jpg(im, name, quality=80):
    path = f'{OUT}/{name}.jpg'
    im.save(path, quality=quality, optimize=True)
    print('wrote', path, im.size, os.path.getsize(path) // 1024, 'KB')


def save_webp(im, name):
    path = f'{OUT}/{name}.webp'
    im.save(path, quality=86, method=6)
    print('wrote', path, im.size, os.path.getsize(path) // 1024, 'KB')


def tileable(name, out, size, gain=1.0):
    im = erase_star(load(name))
    side = round(size * 1.16)
    a = np.array(im.resize((side, side), Image.LANCZOS)).astype(float)
    a = flatten(a, size / 4) * gain
    over = side - size
    a = wrap_x(a, over, 1.5)
    a = wrap_x(a.transpose(1, 0, 2), over, 1.5).transpose(1, 0, 2)
    save_jpg(Image.fromarray(a.clip(0, 255).round().astype('uint8')), out)


# 마젠타 배경을 뺀 RGBA. height 로 줄이고, 그림이 있는 곳만 남긴다
def keyed(name, height, crop=None):
    im = load(name)
    ImageDraw.Draw(im).rectangle(star_box(im), fill=(255, 0, 255))  # 별 자리는 배경으로 칠한다
    if crop:
        W, H = im.size
        im = im.crop((round(crop[0] * W), round(crop[1] * H), round(crop[2] * W), round(crop[3] * H)))
    a = np.asarray(im).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pink = np.minimum(r, b) - g  # 마젠타다움 (0 = 그림, 높을수록 배경)
    alpha = 1 - np.clip((pink - 40) / 100, 0, 1)
    # 섞인 가장자리에서 분홍기를 뺀다: 빨강과 파랑을 초록 쪽으로 누른다
    fix = np.clip(pink, 0, None) * (alpha < 1)
    rgb = np.stack([r - fix, g, b - fix], -1).clip(0, 255)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype('uint8')).filter(ImageFilter.MinFilter(3))).astype(float) / 255  # 한 픽셀 깎아 테를 없앤다
    out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype('uint8'), 'RGBA')
    out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())
    out = out.resize((max(1, round(out.width * height / out.height)), height), Image.LANCZOS)
    return bleed(out)


# 투명한 곳의 색을 가까운 그림 색으로 채운다 (알파는 그대로). 줄인 그림에서 테가 생기지 않는다
def bleed(im):
    a = np.asarray(im).astype(float)
    rgb, al = a[..., :3], a[..., 3:] / 255
    fill = rgb * (al > 0.5)
    w = (al > 0.5).astype(float)
    for radius in (2, 6, 16, 40):
        bl = lambda x: np.asarray(Image.fromarray(x.astype('uint8')).filter(ImageFilter.GaussianBlur(radius))).astype(float)  # noqa: E731
        num = np.dstack([bl(fill[..., i]) for i in range(3)])
        den = bl(w[..., 0] * 255)[..., None] / 255
        est = num / np.maximum(den, 1e-3)
        hole = (w < 0.5)
        rgb = np.where(hole & (den > 0.02), est, rgb)
        w = np.maximum(w, (den > 0.02).astype(float))
        fill = rgb * w
    return Image.fromarray(np.dstack([rgb.clip(0, 255), a[..., 3:]]).astype('uint8'), 'RGBA')


# 잠긴 문: 세로 판자 울타리, 가로 띠 둘, 대각선으로 감긴 쇠사슬, 가운데 색칠한 자물쇠 판
def doors():
    bark = erase_star(load('bark')).resize((512, 512), Image.LANCZOS)
    S = 512
    base = Image.new('RGB', (S, S), (20, 16, 12))
    planks = 6
    pw = S // planks
    rnd = np.random.default_rng(7)
    for i in range(planks):
        y0 = int(rnd.integers(0, 40))
        piece = bark.crop((i * 80 % (512 - pw), 0, i * 80 % (512 - pw) + pw - 6, S))
        piece = Image.eval(piece, lambda v: int(v * 0.85))
        base.paste(piece, (i * pw + 3, y0 // 3))
        d = ImageDraw.Draw(base)
        d.polygon([(i * pw + 3, 0), (i * pw + pw // 2, -10), (i * pw + pw - 3, 0)], fill=(20, 16, 12))  # 뾰족한 판자 끝
    rail = bark.crop((0, 300, S, 340)).resize((S, 44))
    rail = Image.eval(rail, lambda v: int(v * 0.7))
    for y in (110, 380):
        base.paste(rail, (0, y))
    d = ImageDraw.Draw(base)
    for y in (110, 380):  # 못
        for x in range(pw // 2, S, pw):
            d.ellipse((x - 5, y + 17, x + 5, y + 27), fill=(70, 62, 55))

    def chain(p0, p1):
        n = 18
        for i in range(n + 1):
            t = i / n
            x = p0[0] + (p1[0] - p0[0]) * t
            y = p0[1] + (p1[1] - p0[1]) * t
            if i % 2:
                d.ellipse((x - 16, y - 8, x + 16, y + 8), outline=(150, 150, 150), width=5)
            else:
                d.ellipse((x - 8, y - 16, x + 8, y + 16), outline=(120, 120, 125), width=5)
    for name, color in (('red', (200, 34, 26)), ('blue', (34, 80, 210))):
        img = base.copy()
        d = ImageDraw.Draw(img)
        chain((30, 60), (482, 452))
        chain((482, 60), (30, 452))
        # 자물쇠와 색칠한 판: 멀리서도 문 색이 읽히게 크게
        d.rounded_rectangle((176, 196, 336, 316), radius=14, fill=color, outline=(30, 20, 15), width=6)
        d.arc((206, 140, 306, 240), 180, 360, fill=(170, 170, 175), width=14)
        d.rectangle((226, 236, 286, 290), fill=(60, 55, 50))
        d.ellipse((248, 250, 264, 266), fill=(10, 10, 10))
        d.rectangle((252, 262, 260, 282), fill=(10, 10, 10))
        save_jpg(img, f'horror_door_forest_{name}', 82)


# 하늘: 가로로 이음매 없이 되감아 돔을 한 바퀴 두른다 (거울 되풀이는 가운데 대칭 줄이 보인다)
def sky():
    im = erase_star(load('sky')).resize((2400, 676), Image.LANCZOS)
    a = wrap_x(np.array(im).astype(float), 352, 6)
    save_jpg(Image.fromarray(a.clip(0, 255).round().astype('uint8')), 'horror_forest_sky', 84)


JOBS = {
    'bark': lambda: tileable('bark', 'horror_forest_bark', 512),
    'floor': lambda: tileable('forest_floor', 'horror_forest_floor', 512),
    'crown': lambda: save_webp(keyed('foliage', 512), 'horror_forest_crown'),
    'bush': lambda: save_webp(keyed('bush', 384), 'horror_forest_bush'),
    'hollow': lambda: save_webp(keyed('hollow_tree', 640), 'horror_forest_hollow'),
    'gate': lambda: save_webp(keyed('gate', 512), 'horror_forest_gate'),
    'totem': lambda: save_webp(keyed('jangseung', 640), 'horror_forest_totem'),
    'cairn': lambda: save_webp(keyed('seonang', 512), 'horror_forest_cairn'),
    'hair': lambda: save_webp(keyed('hair', 512), 'horror_forest_hair'),
    'sky': sky,
    'intro': lambda: save_jpg(erase_star(load('intro_forest')).resize((1024, 572), Image.LANCZOS), 'horror_intro_forest', 82),
    'door': doors,
}

if __name__ == '__main__':
    for name, job in JOBS.items():
        if not ONLY or name in ONLY:
            job()
