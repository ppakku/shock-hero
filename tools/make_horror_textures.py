# 공포 모드 2판 재질을 직접 그린다. Gemini 이미지 한도가 막혔을 때 쓴 대체 그림이다.
# 모든 그림은 512x512 이고 네 변이 이어진다(주기 노이즈와 감싸기 그리기).
# 사용법: python3 tools/make_horror_textures.py public/art
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

DST = sys.argv[1] if len(sys.argv) > 1 else 'public/art'
S = 512


def noise(seed, beta=2.0, ax=1.0, ay=1.0, size=S):
    # 주기 노이즈: 흰 잡음을 주파수 영역에서 걸러 낸다. ax, ay 로 가로 세로로 늘인다
    rng = np.random.default_rng(seed)
    w = np.fft.fft2(rng.standard_normal((size, size)))
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    f2 = (fx * fx) * ax + (fy * fy) * ay
    f2[0, 0] = 1
    amp = f2 ** (-beta / 4)
    amp[0, 0] = 0
    n = np.real(np.fft.ifft2(w * amp))
    n -= n.min()
    return n / n.max()


def ridged(seed, **kw):
    # 주름: 노이즈 가운데 값에서 가장 깊게 파이는 줄
    return 1 - np.abs(noise(seed, **kw) * 2 - 1)


def lerp(c0, c1, t):
    c0, c1 = np.array(c0, float), np.array(c1, float)
    return c0 + (c1 - c0) * t[..., None]


def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')


def wrap_draw(im, fn):
    # 그림을 9번 어긋나게 그려 가장자리가 반대편으로 이어지게 한다
    d = ImageDraw.Draw(im)
    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            fn(d, ox, oy)


def hatch(a, seed, strength=0.18, step=7):
    # 잉크 교차선 느낌: 대각선 두 방향을 노이즈 세기로 얹는다
    y, x = np.mgrid[0:S, 0:S]
    n = noise(seed, beta=2.5)
    l1 = ((x + y) % step < 1.4) & (n > 0.55)
    l2 = ((x - y) % (step + 2) < 1.2) & (n > 0.7)
    m = (l1 | l2).astype(float)[..., None]
    return a * (1 - m * strength * 3)


def cracks(a, seed, count=7, dark=0.55):
    rng = np.random.default_rng(seed)
    im = Image.new('L', (S, S), 0)

    def fn(d, ox, oy):
        r = np.random.default_rng(seed)
        for _ in range(count):
            x, y = r.uniform(0, S), r.uniform(0, S)
            ang = r.uniform(0, 6.28)
            for _ in range(r.integers(18, 40)):
                ang += r.normal(0, 0.5)
                nx, ny = x + np.cos(ang) * 9, y + np.sin(ang) * 9
                d.line((x + ox, y + oy, nx + ox, ny + oy), fill=255, width=1)
                x, y = nx, ny

    wrap_draw(im, fn)
    m = np.asarray(im.filter(ImageFilter.GaussianBlur(0.6)), float) / 255
    return a * (1 - m[..., None] * dark)


def save(a, name, q=80):
    to_img(a).save(f'{DST}/{name}', quality=q, optimize=True)
    print('wrote', name)


def sewer_wall():
    y, x = np.mgrid[0:S, 0:S]
    bh, bw = 64, 128
    row = y // bh
    xs = (x + (row % 2) * (bw // 2)) % S
    col = xs // bw
    tone = np.random.default_rng(3).random((S // bh, S // bw + 1))
    t = tone[row, col]
    grain = noise(11, beta=2.6)
    base = lerp((38, 40, 36), (92, 84, 70), np.clip(t * 0.6 + grain * 0.5, 0, 1))
    # 벽돌 사이 이음매
    my = (y % bh) < 5
    mx = (xs % bw) < 5
    mortar = (my | mx).astype(float)
    mortar = np.asarray(Image.fromarray((mortar * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), float) / 255
    a = base * (1 - mortar[..., None] * 0.75)
    # 젖은 이끼: 위에서 아래로 길게 흐르는 얼룩
    moss = noise(21, beta=2.2, ax=6.0, ay=0.6)
    mm = np.clip((moss - 0.5) * 3, 0, 1) * (0.35 + 0.65 * noise(22, beta=2))
    a = lerp_mix(a, (30, 62, 46), mm)
    # 물때 줄기
    st = np.clip((noise(23, beta=2, ax=14.0, ay=0.3) - 0.62) * 5, 0, 1)
    a = a * (1 - st[..., None] * 0.45)
    a = cracks(a, 5)
    a = hatch(a, 31)
    save(a, 'horror_sewer_wall.jpg')


def lerp_mix(a, color, m):
    return a * (1 - m[..., None]) + np.array(color, float) * m[..., None]


def sewer_floor():
    # 얕은 검은 물 아래 깔린 돌바닥과 물결
    y, x = np.mgrid[0:S, 0:S]
    stone = ridged(41, beta=2.4)
    cell = ((x // 128 + (y // 128) % 2) % 2).astype(float)
    base = lerp((18, 28, 28), (46, 62, 58), noise(42, beta=2.2) * 0.7 + stone * 0.3)
    base *= (0.85 + cell[..., None] * 0.2)
    # 돌 틈
    seam = (((x % 128) < 4) | ((y % 128) < 4)).astype(float)
    base *= (1 - seam[..., None] * 0.6)
    # 물결: 비틀린 사인파 무늬의 밝은 줄
    w = noise(43, beta=2.0)
    rip = np.sin((x * 0.09 + w * 14) * 1.0 + np.sin(y * 0.05 + w * 9) * 3)
    hi = np.clip((rip - 0.82) * 6, 0, 1) * (noise(44, beta=2.5) > 0.4)
    a = lerp_mix(base, (120, 150, 142), hi * 0.35)
    a = hatch(a, 45, 0.12)
    save(a, 'horror_sewer_floor.jpg')


def cabinet(name, body0, body1, ink_light, vents, slot, rust, seed):
    # 사물함 문: 틀, 환기 틈, 손잡이. 겉면 얼룩은 노이즈로 만든다
    n = noise(seed, beta=2.4)
    r = noise(seed + 1, beta=2.2, ax=1.0, ay=5.0)
    a = lerp(body0, body1, np.clip(n * 0.8 + 0.1, 0, 1))
    a = lerp_mix(a, rust, np.clip((r - 0.55) * 2.5, 0, 1) * 0.55)
    a = hatch(a, seed + 2, 0.1)
    im = to_img(a)
    d = ImageDraw.Draw(im)
    d.rectangle((10, 10, 501, 501), outline=(8, 9, 8), width=12)
    d.rectangle((38, 38, 473, 473), outline=ink_light, width=3)
    for y in vents:
        d.rounded_rectangle((130, y, 382, y + 18), radius=7, fill=(3, 4, 4), outline=ink_light, width=2)
    if slot:
        d.rectangle((180, 250, 332, 300), fill=(20, 22, 20), outline=ink_light, width=3)
        d.rectangle((192, 262, 320, 288), fill=(52, 50, 44))
    d.rounded_rectangle((420, 300, 448, 390), radius=6, fill=(34, 34, 30), outline=(6, 6, 6), width=4)
    for cx, cy in ((26, 26), (486, 26), (26, 486), (486, 486)):
        d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(30, 30, 28), outline=(6, 6, 6))
    out = np.asarray(im, float)
    out = cracks(out, seed + 3, count=3, dark=0.4)
    save(out, name)


def school_wall():
    y, x = np.mgrid[0:S, 0:S]
    plaster = noise(51, beta=2.3) * 0.6 + noise(52, beta=1.4) * 0.4
    top = lerp((176, 170, 150), (130, 124, 108), plaster)
    low = lerp((98, 128, 108), (66, 90, 76), plaster)
    split = 250
    a = np.where((y < split)[..., None], top, low)
    # 가로 띠와 맨 아래 걸레받이 선: 위아래로 이어도 띠처럼 보인다
    for yy, w in ((split, 8), (0, 6)):
        dy = np.minimum((y - yy) % S, (yy - y) % S)
        band = (dy < w).astype(float)[..., None]
        a = a * (1 - band * 0.65)
    # 얼룩과 벗겨진 곳
    peel = np.clip((noise(53, beta=2.0) - 0.68) * 5, 0, 1)
    a = lerp_mix(a, (60, 56, 46), peel * 0.5)
    damp = np.clip((noise(54, beta=2.2, ax=5.0, ay=0.5) - 0.6) * 4, 0, 1)
    a = a * (1 - damp[..., None] * 0.35)
    a = cracks(a, 55, count=4, dark=0.5)
    a = hatch(a, 56, 0.08)
    save(a * 0.8, 'horror_school_wall.jpg')


def school_floor():
    y, x = np.mgrid[0:S, 0:S]
    pw = 64
    plank = y // pw
    off = (np.random.default_rng(61).random(S // pw) * S).astype(int)
    xs = (x + off[plank]) % S
    seg = xs // 256  # 판자 한 줄에 이음매가 두 번
    tone = np.random.default_rng(62).random((S // pw, 3))[plank, seg]
    grain = noise(63, beta=2.6, ax=0.05, ay=1.0)
    fine = noise(64, beta=1.2, ax=0.05, ay=1.0)
    a = lerp((52, 34, 22), (118, 80, 50), np.clip(tone * 0.5 + grain * 0.45 + fine * 0.15, 0, 1))
    seam = (((y % pw) < 3) | ((xs % 256) < 3)).astype(float)
    a *= (1 - seam[..., None] * 0.8)
    wear = np.clip((noise(65, beta=2.0) - 0.55) * 3, 0, 1)
    a = lerp_mix(a, (150, 126, 96), wear * 0.25)
    a = hatch(a, 66, 0.08)
    save(a, 'horror_school_floor.jpg')


def school_board():
    # 회색 바탕에 얇은 나무 틀과 분필 자국. 색은 게임에서 입힌다
    n = noise(71, beta=2.0)
    a = lerp((92, 92, 92), (122, 122, 122), n)
    sm = np.clip((noise(72, beta=1.6, ax=4.0, ay=1.0) - 0.55) * 3, 0, 1)
    a = lerp_mix(a, (176, 176, 176), sm * 0.35)
    im = to_img(a)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(73)
    for _ in range(40):
        x, y = rng.integers(40, 470), rng.integers(40, 470)
        d.ellipse((x, y, x + 2, y + 2), fill=(30, 30, 30))
    d.rectangle((0, 0, 511, 511), outline=(96, 90, 82), width=26)
    d.rectangle((26, 26, 485, 485), outline=(40, 38, 34), width=3)
    d.rectangle((0, 0, 511, 511), outline=(30, 28, 26), width=3)
    im = im.filter(ImageFilter.GaussianBlur(0.5))
    out = np.asarray(im, float)
    save(out, 'horror_school_board.jpg', q=78)


def maw_skin():
    # 마르고 팽팽한 갈회색 피부, 주름이 자글자글
    t = noise(101, beta=2.4) * 0.6 + noise(102, beta=1.4) * 0.4
    a = lerp((58, 46, 40), (118, 98, 82), t)
    cr = np.clip((ridged(103, beta=2.0, ax=3.0, ay=1.0) - 0.82) * 6, 0, 1)
    a = a * (1 - cr[..., None] * 0.45)
    cr2 = np.clip((ridged(104, beta=1.8, ax=1.0, ay=3.0) - 0.86) * 7, 0, 1)
    a = a * (1 - cr2[..., None] * 0.3)
    a = hatch(a, 105, 0.07)
    save(a, 'horror_maw_skin.jpg', q=82)


def maw_hair():
    # 검은 초록 낙서 머리카락 둥지: 끊김 없이 이어지는 굽은 선 수백 줄
    im = Image.new('RGB', (S, S), (8, 12, 9))

    def fn(d, ox, oy):
        r = np.random.default_rng(111)
        for i in range(520):
            x, y = r.uniform(0, S), r.uniform(0, S)
            ang = r.uniform(0, 6.28)
            col = [(22, 40, 28), (14, 26, 20), (46, 70, 50), (30, 52, 38)][i % 4]
            for _ in range(r.integers(12, 34)):
                ang += r.normal(0, 0.45)
                nx, ny = x + np.cos(ang) * 8, y + np.sin(ang) * 8
                d.line((x + ox, y + oy, nx + ox, ny + oy), fill=col, width=int(r.integers(1, 3)))
                x, y = nx, ny

    wrap_draw(im, fn)
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(0.4)), float)
    save(a, 'horror_maw_hair.jpg', q=82)


sewer_wall()
sewer_floor()
cabinet('horror_sewer_locker.jpg', (44, 48, 40), (96, 94, 76), (140, 150, 130), (90, 130, 170), False, (96, 62, 30), 7)
school_wall()
school_floor()
cabinet('horror_school_locker.jpg', (50, 78, 66), (112, 140, 122), (170, 190, 176), (80, 118, 156), True, (80, 70, 50), 17)
school_board()
maw_skin()
maw_hair()
