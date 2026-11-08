# 공포 모드 소품 그림 (등, 배관, 천장, 책상, 의자, 붉은 쪽지). Gemini 원본을 잘라 게임용 jpg 로 만든다.
# 사용법: python3 tools/make_horror_props.py 원본폴더 [이름...]
# 앞면 그림은 물건만 잘라 낸다 (별 표시도 함께 잘린다). 되풀이 그림은 별 표시를 덮고, 이음매가 없게 되감는다.
# 천장은 어둠이 달라지지 않게, 그림 평균이 맵의 ceil 색과 같아지는 tint 를 함께 찍는다.
import os, sys
import numpy as np
from PIL import Image, ImageFilter

RAW = sys.argv[1]
OUT = 'public/art'
ONLY = sys.argv[2:]
STAR = 0.13  # 오른쪽 아래 별 표시가 있는 네모의 한 변 (원본 가로 대비)

# 이름: (자를 띠들 [왼, 위, 오른, 아래] 원본 비율, 결과 가로, 결과 세로). 띠가 여럿이면 위아래로 잇는다
FACES = {
    'light_school': ([(0, 0.013, 1, 0.054), (0, 0.202, 1, 0.847), (0, 0.95, 1, 0.99)], 256, 96),
    'light_station': ([(0.036, 0.218, 0.964, 0.782)], 256, 84),
    'light_factory': ([(0.065, 0.287, 0.915, 0.717)], 256, 73),
    'light_sewer': ([(0.06, 0.06, 0.95, 0.90)], 192, 192),
    'clue': ([(0.02, 0.02, 0.66, 0.90)], 256, 352),
    'desk': ([(0.02, 0.066, 0.98, 0.895)], 256, 168),
    'bench': ([(0.095, 0.57, 0.905, 0.895)], 320, 100),
}
# 이름: (결과 크기, 그림 평균을 맞출 맵의 색, 쓸 왼쪽 위 비율). Gemini 가 같은 무늬를 두 번 그린 그림은 한 번치만 쓴다
TILES = {
    'ceil_factory': (512, 0x1b1a19, 1),
    'ceil_sewer': (512, 0x111614, 0.58),
    'ceil_school': (512, 0x24262c, 0.58),
    'ceil_station': (512, 0x1c1e26, 0.58),
    'ceil_park': (512, 0x1c1820, 1),
    'ceil_mart': (512, 0x20242a, 1),
    'pipe_factory': (256, 0x2e3236, 1),
    'pipe_sewer': (256, 0x3a4438, 1),
    'pipe_school': (256, 0x4a4a46, 1),
    'pipe_station': (256, 0x4a4a46, 1),
    'pipe_park': (256, 0x6a3a34, 1),
    'pipe_mart': (256, 0x5a5e62, 1),
}


STRIPES_KEEP = 0.35


def load(name):
    return Image.open(f'{RAW}/{name}.png').convert('RGB')


def face(name, bands, w, h):
    im = load(name)
    W, H = im.size
    parts = [im.crop((round(a * W), round(b * H), round(c * W), round(d * H))) for a, b, c, d in bands]
    full = Image.new('RGB', (parts[0].width, sum(p.height for p in parts)))
    y = 0
    for p in parts:
        full.paste(p, (0, y))
        y += p.height
    save(full.resize((w, h), Image.LANCZOS), name)


def erase_star(im):
    W, H = im.size
    s = int(W * STAR)
    x0, y0 = W - s, H - s
    patch = im.crop((x0 - s, y0, x0, H))
    mask = Image.new('L', (s, s), 0)
    mask.paste(255, (s // 8, s // 8, s, s))
    im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(s // 16)))


# a, b 를 가로로 겹칠 때 두 그림 차이가 가장 작은 위에서 아래 길을 찾아, 왼쪽이 a 인 판을 돌려준다 (1 이면 a)
def cut_mask(a, b, soft):
    err = ((a - b) ** 2).sum(axis=2)
    h, w = err.shape
    cost = err.copy()
    for y in range(1, h):
        left = np.r_[np.inf, cost[y - 1, :-1]]
        right = np.r_[cost[y - 1, 1:], np.inf]
        cost[y] += np.minimum(np.minimum(left, cost[y - 1]), right)
    path = [int(cost[-1].argmin())]
    for y in range(h - 2, -1, -1):
        x = path[-1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        path.append(lo + int(cost[y, lo:hi].argmin()))
    path.reverse()
    mask = (np.arange(w)[None, :] < np.array(path)[:, None]).astype(float)
    return np.array(Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(soft))) / 255


# 가로로 되풀이되게 한다: 오른쪽 끝을 왼쪽 끝 위에 겹쳐 이음매 길을 따라 잇는다
def wrap_x(a, over, soft):
    w = a.shape[1] - over
    out = a[:, :w].copy()
    mask = cut_mask(a[:, w:], a[:, :over], soft)[..., None]
    out[:, :over] = a[:, w:] * mask + a[:, :over] * (1 - mask)
    return out


# 큰 얼룩이 되풀이되어 보이지 않게 넓은 밝기 차이를 편다
def flatten(a, radius):
    im = Image.fromarray(a.clip(0, 255).astype('uint8'))
    low = np.array(im.filter(ImageFilter.GaussianBlur(radius))).astype(float)
    return a - low + low.mean(axis=(0, 1))


# 천장의 붉은 녹물이 핏자국처럼 보이지 않게 누런 녹빛으로 돌린다
def ochre(a):
    out = a.copy()
    out[..., 1] = np.maximum(a[..., 1], a[..., 0] * 0.74)
    out[..., 2] = np.maximum(a[..., 2], a[..., 0] * 0.52)
    return out


# 손전등 아래서 골판 줄무늬가 너무 튀지 않게 세로줄 밝기 차이를 줄인다. keep: 남길 비율
def soften_stripes(a, keep):
    return a - (1 - keep) * (a.mean(axis=0, keepdims=True) - a.mean(axis=(0, 1), keepdims=True))


def to_linear(c):
    c = c / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def tile(name, size, plain, part):
    im = load(name)
    erase_star(im)
    im = im.crop((0, 0, round(im.width * part), round(im.height * part)))
    side = round(size * 1.16)
    a = np.array(im.resize((side, side), Image.LANCZOS)).astype(float)
    a = flatten(a, size / 4)
    if name.startswith('ceil'):
        a = ochre(a)
    if name == 'ceil_factory':
        a = soften_stripes(a, STRIPES_KEEP)
    over = side - size
    a = wrap_x(a, over, 1.5)
    a = wrap_x(a.transpose(1, 0, 2), over, 1.5).transpose(1, 0, 2)
    im = Image.fromarray(a.clip(0, 255).round().astype('uint8'))
    save(im, name)
    mean = to_linear(np.array(im).astype(float)).mean(axis=(0, 1))
    goal = to_linear(np.array([plain >> 16, plain >> 8 & 255, plain & 255], float))
    rgb = (to_srgb(np.minimum(1, goal / mean)) * 255).round().astype(int)
    print(f'  tint 0x{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}')


def save(im, name):
    path = f'{OUT}/horror_{name}.jpg'
    im.save(path, quality=80, optimize=True)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    for name, (bands, w, h) in FACES.items():
        if (not ONLY or name in ONLY) and os.path.exists(f'{RAW}/{name}.png'):
            face(name, bands, w, h)
    for name, (size, plain, part) in TILES.items():
        if (not ONLY or name in ONLY) and os.path.exists(f'{RAW}/{name}.png'):
            tile(name, size, plain, part)
