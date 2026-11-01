# 큰입이 그림을 게임용으로 만든다. 원본은 Gemini 가 초상화와 아들의 그림(3488)을 참고로 그린 넉 장이다.
# 사용법: python3 tools/make_maw_art.py 머리앞.png 머리뒤.png 전신앞.png 전신뒤.png
# 머리: 앞뒤 그림을 둘러 입힌다. 입안은 그림 그대로 쓰고, 3D 쪽에서 입 자리를 파 넣어 깊이를 낸다 (creatureMaw.js).
# 머리털: 앞뒤 그림의 머리털만 투명 배경으로 떠서 가운데가 앞, 양끝이 뒤인 한 장으로 잇는다.
# 몸: 몸통은 둘러 입히고, 비스듬한 팔과 다리와 손가락은 중심선을 따라 곧게 펴서 한 장에 늘어놓는다.
# 이빨 빛: 어둠에서 이빨만 희미하게 뜨게 하는 흑백 그림.
# 끝에 creatureMaw.js 의 키 표에 옮길 치수를 찍는다. 미터 값은 머리 그림과 전신 그림의 축척으로 잰다.
import sys
import numpy as np
from PIL import Image, ImageFilter
from wrap_art import half_widths, keys, load, mask_of, side_tone, smooth, wrap

head_src, head_back_src, body_src, body_back_src = sys.argv[1:5]
OUT = 'public/art'
SCALE = 2  # 그림을 이만큼 키워 저장한다. 먹선이 흐려지지 않게 키운 뒤 살짝 날을 세운다

# 머리 앞 그림에서 잰 자리 (원본 픽셀)
CX = 424
HEAD_M = 0.00102  # 머리 그림 한 픽셀의 미터. 머리털 끝까지가 턱 위 1m 다
CHIN, CROWN = 985, 90
SKULL_ROW = 470  # 이 줄 위는 머리털에 덮여 윤곽을 못 잰다. 달걀꼴로 잇는다
JAW = [(860, 209), (900, 186), (930, 160), (955, 128), (972, 90), (985, 12)]  # 목과 붙어 있어 윤곽을 못 재는 턱선: (줄, 반폭)
HAIR_LINE = [(0, 300), (130, 310), (220, 350), (300, 440), (360, 560), (424, 560)]  # 머리털이 끝나는 줄: (가운데에서 떨어진 거리, 줄)
MOUTH = (424, 676)  # 입 가운데
MOUTH_EDGE = [  # 입 테두리 (윗입술 가운데에서 입꼬리를 지나 아랫입술 가운데로): (가운데에서의 각도, 반지름)
    (0, 222), (15, 226), (30, 238), (45, 250), (60, 254), (75, 248), (90, 240), (105, 236), (120, 236), (135, 236), (150, 232), (165, 228), (180, 226),
]
FRONT_HEAD = 2 / 3
HEAD_W, HEAD_PX = 1536, 1536
HAIR_W, HAIR_H = 1536, 640

# 전신 그림에서 잰 자리 (원본 픽셀). 중심선은 어림값이고 윤곽에 맞춰 다시 잡는다
BODY_M = 0.0022
BODY_TOP, BODY_BOTTOM = 442, 712  # 목 아래부터 가랑이까지
ARM = [(322, 470), (290, 560), (251, 640), (203, 720), (168, 772), (163, 845)]  # 끝 토막은 손바닥
LEG = [(372, 700), (368, 800), (358, 920), (353, 1000), (362, 1100), (366, 1185)]
FINGERS = [
    [(160, 825), (118, 868), (75, 910), (77, 970), (85, 1030), (112, 1125)],
    [(145, 855), (105, 930), (128, 1040), (183, 1148)],
    [(150, 860), (127, 930), (160, 1010), (212, 1075)],
    [(175, 810), (200, 860), (195, 920), (183, 985)],
]
WRIST = (168, 772)
BODY_TONE = (118, 98, 80)  # 곧게 펼 때 윤곽 바깥을 채우는 살빛
FOOT = (292, 1150, 392, 1250)  # 왼쪽 발 네모
# 몸 그림 한 장의 칸: [왼쪽, 위, 폭, 높이] (픽셀)
SHEET = 1024
TORSO_CELL = (0, 0, 640, 620)
ARM_CELL = (640, 0, 128, 1024)
LEG_CELL = (768, 0, 128, 1024)
FINGER_CELL = (896, 0, 64, 1024)
FOOT_CELL = (0, 640, 256, 256)
SKIN_CELL = (300, 660, 300, 300)
FRONT_LIMB = 1 / 2


def up(a, k=SCALE):
    im = Image.fromarray(a).resize((a.shape[1] * k, a.shape[0] * k), Image.BICUBIC)
    return np.asarray(im.filter(ImageFilter.UnsharpMask(2, 60, 2)))


def solid_of(rgb):
    # 마젠타만 뺀 윤곽. mask_of 와 달리 손가락처럼 가는 것도 남는다
    a = rgb.astype(int)
    return np.minimum(a[..., 0], a[..., 2]) - a[..., 1] < 40


def edge_at(angle):
    return np.interp(angle, *zip(*MOUTH_EDGE))


def cover_bg(rgb, mask, color=(24, 20, 18)):
    # 윤곽 바깥 마젠타를 칠한다. 그림을 키우거나 흐릴 때 가장자리에 분홍이 번지지 않게
    grown = np.asarray(Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.MinFilter(5))) > 128
    out = rgb.copy()
    out[~grown] = color
    return out


# ---- 머리
front = load(head_src)
back = load(head_back_src)
mask = mask_of(front)
mask_b = mask_of(back)
hw = half_widths(mask, CX)
hw[:SKULL_ROW] = hw[SKULL_ROW] * np.sqrt(np.clip(1 - ((SKULL_ROW - np.arange(SKULL_ROW)) / (SKULL_ROW - CROWN)) ** 2, 0, 1))
for (a, wa), (b, wb) in zip(JAW, JAW[1:]):
    hw[a:b + 1] = np.linspace(wa, wb, b + 1 - a)
hw = smooth(hw, 25)
hw[:CROWN] = 0
rows = np.linspace(CROWN + 4, CHIN - 1, HEAD_PX).astype(int)
tone = side_tone(front, rows, np.maximum(hw, 60), CX, 16, 0.8)
# 뒤 그림은 머리와 목이 함께 있어 머리뼈 아래 끝(뒤통수 그늘)까지만 쓴다
rows_b = np.linspace(CROWN + 4, 800, HEAD_PX).astype(int)
yy, xx = np.mgrid[0:front.shape[0], 0:front.shape[1]]
ang = np.degrees(np.arctan2(np.abs(xx - MOUTH[0]), MOUTH[1] - yy))
inside = np.hypot(xx - MOUTH[0], yy - MOUTH[1]) < edge_at(ang) * 0.93
# 입이 갈라지는 줄 둘레는 새까맣게 칠해서, 턱이 내려가도 까만 틈의 경계가 보이지 않는다
night = 1 - inside * np.exp(-(((yy - MOUTH[1]) / 26.0) ** 2)) * np.clip(1.3 - np.abs(xx - MOUTH[0]) / 330, 0, 1).clip(0, 1) ** 0.3
back_plain = (cover_bg(back, mask_b) * 0.85).astype('uint8')
head = wrap(rows, rows_b, np.maximum(hw, 8), np.maximum(hw, 8), (cover_bg(front, mask) * night[..., None]).astype('uint8'), back_plain, CX, CX, HEAD_W, FRONT_HEAD, 14, tone, True)
Image.fromarray(head).filter(ImageFilter.UnsharpMask(2, 50, 2)).save(f'{OUT}/horror_maw_head.jpg', quality=85)

# 이빨 빛: 입 안쪽에서 밝고 누런 곳만 남긴다. 머리 그림과 같은 자리에 온다
lum = front.astype(float).mean(-1)
teeth = np.clip((lum - 90) / 60, 0, 1) * inside
teeth = np.asarray(Image.fromarray((teeth * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))
face_glow = lum * mask * ~inside * 0.05  # 살도 아주 희미하게 떠서 어둠에서 머리 윤곽이 잡힌다
glow_rgb = np.dstack([np.maximum(teeth, face_glow).astype('uint8')] * 3)
glow = wrap(rows, rows_b, np.maximum(hw, 8), np.maximum(hw, 8), glow_rgb, np.zeros_like(back), CX, CX, HEAD_W // 2, FRONT_HEAD, 14, np.zeros_like(tone))[::2]
Image.fromarray(glow).filter(ImageFilter.GaussianBlur(1)).save(f'{OUT}/horror_maw_glow.jpg', quality=80)

# 머리털: 앞은 앞 그림, 뒤는 뒤 그림. 마젠타는 투명하게, 위아래로는 한 줄도 늘리지 않고 그대로 옮긴다
def hair_half(rgb):
    a = rgb.astype(float)
    pink = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    keep = 1 - np.clip((pink - 20) / 200, 0, 1)  # 먹선 가장자리까지 살려서 멀리서도 가닥이 보인다
    keep[(a[..., 0] - a[..., 1] > 8) & (a[..., 0] > 60) & (pink <= 20)] = 0  # 머리털 사이로 보이는 살은 뺀다. 살은 머리 그림에 있다
    line = np.interp(np.abs(np.arange(rgb.shape[1]) - CX), *zip(*HAIR_LINE)) + 50
    fade = np.clip((line[None, :] - np.arange(rgb.shape[0])[:, None]) / 50, 0, 1)
    cut = rgb.copy()
    cut[pink > 20] = (8, 10, 8)  # 마젠타가 섞인 곳은 먹빛으로
    return np.dstack([cut, (keep * fade * 255).astype('uint8')])


HAIR_ROWS = 560  # 머리털 그림을 쓰는 줄 수
SIDE_HAIR = 140  # 옆머리를 메우는 반폭
n = front.shape[1]
strip = np.zeros((HAIR_ROWS, n * 2, 4), 'uint8')
strip[:, n // 2:n // 2 + n] = hair_half(front)[:HAIR_ROWS]
back_hair = hair_half(back)[:HAIR_ROWS]  # 옆을 돌아 뒤로 가면 뒤 그림의 왼쪽 끝부터 이어진다
strip[:, :n // 2] = back_hair[:, n // 2:]
strip[:, n // 2 + n:] = back_hair[:, :n // 2]
# 그림 양끝은 비어 있으니, 옆머리는 뒤 그림 가운데 머리털을 세로로 늘여 메운다. 옆에서도 한 덩어리로 보인다
side = Image.fromarray(back_hair[:330, CX - SIDE_HAIR:CX + SIDE_HAIR], 'RGBA').resize((SIDE_HAIR * 2, 440))
side = np.asarray(side)
for seam in (n // 2, n // 2 + n):
    area = strip[40:480, seam - SIDE_HAIR:seam + SIDE_HAIR]
    area[side[..., 3] > area[..., 3]] = side[side[..., 3] > area[..., 3]]
strip[-16:, :16] = (8, 8, 6, 255)  # 먹빛 한 칸: 3D 머리털 가닥이 여기를 쓴다
Image.fromarray(strip, 'RGBA').resize((HAIR_W, HAIR_H), Image.LANCZOS).save(f'{OUT}/horror_maw_hair.webp', quality=85, method=6)

# 안내 화면 얼굴: 다른 괴물과 같은 높이로, 마젠타를 빼고 아래쪽을 어둠에 녹인다
a = front.astype(float)
pink = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
keep = 1 - np.clip((pink - 40) / 80, 0, 1)
fade = np.clip((a.shape[0] * 0.97 - np.arange(a.shape[0])) / (a.shape[0] * 0.14), 0, 1)[:, None]
for c in (0, 2):
    a[..., c] -= pink.clip(0, 255) * (keep < 1)
cutout = Image.fromarray(np.dstack([a.clip(0, 255), keep * fade * 255]).astype('uint8'), 'RGBA')
cutout = cutout.crop(cutout.getbbox())
cutout.resize((round(cutout.width * 512 / cutout.height), 512), Image.LANCZOS).save(f'{OUT}/horror_face_maw.webp', quality=82, method=6)

print('head m per px', HEAD_M, 'crown above chin', round((CHIN - CROWN) * HEAD_M, 3), 'art top above chin', round(CHIN * HEAD_M, 3))
keys('head keys (m above chin, half width)', 0, np.arange(CROWN + 4, CHIN), hw, HEAD_M, 18)
print('split row above chin', round((CHIN - MOUTH[1]) * HEAD_M, 3))
print('mouth edge (deg, radius m)', [(a, round(r * HEAD_M, 3)) for a, r in MOUTH_EDGE])
print('mouth centre above chin', round((CHIN - MOUTH[1]) * HEAD_M, 3))


# ---- 몸
def polyline(points, n):
    p = np.array(points, float)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    s = np.linspace(0, d[-1], n)
    return np.stack([np.interp(s, d, p[:, 0]), np.interp(s, d, p[:, 1])], -1)


def straighten(rgb, mask, points, rows, width):
    # 중심선을 따라 수직으로 잘라 곧은 그림을 만든다. 줄마다 윤곽에 맞춰 중심을 다시 잡는다
    line = polyline(points, rows)
    line = np.stack([smooth(line[:, 0], 61), smooth(line[:, 1], 61)], -1)  # 꺾이는 곳에서 자르는 방향이 튀지 않게 한다
    tan = np.gradient(line, axis=0)
    tan /= np.maximum(np.hypot(*tan.T), 1e-6)[:, None]
    nor = np.stack([-tan[:, 1], tan[:, 0]], -1)
    h, w = mask.shape
    inside = lambda p: mask[int(np.clip(p[1], 0, h - 1)), int(np.clip(p[0], 0, w - 1))]
    half = np.ones(rows)
    mid = np.zeros(rows)
    for i in range(rows):
        lo = hi = 0
        while lo < 45 and inside(line[i] + nor[i] * (lo + 1)):
            lo += 1
        while hi < 45 and inside(line[i] - nor[i] * (hi + 1)):
            hi += 1
        mid[i] = (lo - hi) / 2
        half[i] = (lo + hi) / 2 + 1
    mid, half = smooth(mid, 41), smooth(half, 31)
    cols = np.arange(width) - width / 2
    out = np.zeros((rows, width, 3), 'uint8')
    for i in range(rows):
        c = line[i] + nor[i] * mid[i]
        p = c[None, :] + nor[i][None, :] * cols[:, None]
        out[i] = rgb[p[:, 1].round().astype(int).clip(0, h - 1), p[:, 0].round().astype(int).clip(0, w - 1)]
    return out, half


def limb_strip(rgb_f, rgb_b, points, cell, m, name):
    # 곧게 편 앞뒤 그림을 둘러 한 칸에 넣는다. 끝에 길이와 굵기를 찍는다
    _, _, cw, ch = cell
    width = 110
    rows = ch // 2
    mask_f, mask_b = solid_of(rgb_f), solid_of(rgb_b)
    sf, hf = straighten(cover_bg(rgb_f, mask_f, BODY_TONE), mask_f, points, rows, width)
    sb, hb = straighten(cover_bg(rgb_b, mask_b, BODY_TONE), mask_b, points, rows, width)
    ids = np.arange(rows)
    tone = side_tone(sf, ids, hf, width // 2, 2, 0.75)
    out = wrap(ids, ids, hf, hb, sf, sb, width // 2, width // 2, cw // 2, FRONT_LIMB, 3, tone)
    length = np.hypot(*np.diff(polyline(points, rows), axis=0).T).sum()
    print(name, 'length m', round(length * m, 3), 'radius m along limb', [round(float(hf[i] * m), 3) for i in np.linspace(0, rows - 1, 9).astype(int)])
    return up(out)


front = load(body_src)
back = load(body_back_src)
mask, mask_b = mask_of(front), mask_of(back)
mid = 424
hw = smooth(half_widths(mask, mid), 21)
hw_b = smooth(half_widths(mask_b, mid), 21)
rows = np.linspace(BODY_TOP, BODY_BOTTOM, TORSO_CELL[3] // 2).astype(int)
plain_f, plain_b = cover_bg(front, mask, BODY_TONE), cover_bg(back, mask_b, BODY_TONE)
tone = side_tone(plain_f, rows, hw, mid, 8, 0.75)
torso = up(wrap(rows, rows, hw, hw_b, plain_f, plain_b, mid, mid, TORSO_CELL[2] // 2, FRONT_LIMB, 6, tone))

sheet = np.zeros((SHEET, SHEET, 3), 'uint8')


def put(cell, a):
    x, y, w, h = cell
    sheet[y:y + h, x:x + w] = np.asarray(Image.fromarray(a).resize((w, h), Image.BICUBIC))


put(TORSO_CELL, torso)
put(ARM_CELL, limb_strip(front, back, ARM, ARM_CELL, BODY_M, 'arm'))
put(LEG_CELL, limb_strip(front, back, LEG, LEG_CELL, BODY_M, 'leg'))
put(FINGER_CELL, limb_strip(front, back, FINGERS[0], FINGER_CELL, BODY_M, 'finger'))
x0, y0, x1, y1 = FOOT
put(FOOT_CELL, cover_bg(front, mask)[y0:y1, x0:x1])
put(SKIN_CELL, front[790:870, 362:386])
Image.fromarray(sheet).save(f'{OUT}/horror_maw_body.jpg', quality=84)

print('torso keys (rows above floor m, half width front m, half width back m)')
for r in np.linspace(BODY_TOP, BODY_BOTTOM, 12).astype(int):
    print(round((1240 - r) * BODY_M, 3), round(float(hw[r]) * BODY_M, 3), round(float(hw_b[r]) * BODY_M, 3))
print('fingers from the wrist (x out, y down, m)')
for f in FINGERS:
    print([(round((WRIST[0] - x) * BODY_M, 3), round((y - WRIST[1]) * BODY_M, 3)) for x, y in f])
