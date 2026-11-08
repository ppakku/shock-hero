# 처녀귀신 그림을 게임용으로 만든다. 원본은 Gemini 가 그린 넉 장이다 (전신 앞, 전신 뒤, 얼굴 가까이, 걸린 머리카락).
# 사용법: python3 tools/make_maiden_art.py ~/workspace/shock-hero-art/forest
#   폴더 안의 ghost_front.png ghost_back.png ghost_face.png hair.png 를 읽어 public/art 에 쓴다.
# 1) 마젠타 배경을 빼면서 섞인 분홍도 되돌린다: 흐려지는 소복 자락은 반투명 흰 천으로 남는다 (색 = 그림 - 분홍 몫)
# 2) 오른쪽 아래 Gemini 별 표시는 자리로 지운다
# 몸 (horror_maiden_body.webp): 앞뒤 그림을 둘러 입힌 소복. 알파에 찢어진 밑단과 아래로 갈수록 투명해지는 자락이 들어 있다.
# 머리 (horror_maiden_head.jpg): 머리카락에 덮인 얼굴과 뒷머리를 둘러 입힌다.
# 머리카락 (horror_maiden_hair.webp): 걸린 머리카락 덩어리 넷과 두 손을 투명 배경으로 한 장에 늘어놓는다.
# 얼굴 (horror_maiden_face.webp): 가까이 다가오면 머리카락 사이로 보이는 얼굴. 가장자리는 머리카락 어둠에 녹는다.
# 안내 화면 얼굴 (horror_face_maiden.webp): 다른 괴물과 같은 480x512.
# 끝에 creatureMaiden.js 의 키 표에 옮길 치수를 찍는다.
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from wrap_art import half_widths, side_tone, smooth, wrap

SRC = sys.argv[1].rstrip('/')
OUT = 'public/art'
MAGENTA = np.array([255, 0, 255], float)
MARK = (2560, 1340)  # 전신과 머리카락 그림의 별 표시: 이 점보다 오른쪽 아래
FACE_MARK = (1860, 1860, 2010, 2010)  # 얼굴 그림의 별 표시 네모

# 전신 앞 그림에서 잰 자리 (원본 픽셀)
CX = 1376  # 몸 가운데 줄
CROWN, CHIN, NECK, HEM = 62, 320, 345, 1452  # 정수리, 턱, 머리와 몸이 만나는 줄 (머리 받침점), 밑단 끝
BODY_TOP = 330  # 몸 그림의 맨 위 줄. 머리 속으로 조금 들어간다
HAND_ROWS = (845, 1060)  # 손이 몸 윤곽에 붙어 있는 줄. 몸 폭은 이 사이를 곧게 이어 손을 뺀다
ROBE_AT_HANDS = 174  # 손 바로 안쪽 소복의 반폭 (픽셀)
FADE_FROM = 1080  # 이 줄부터 밑단 끝까지 점점 투명해진다
ROBE_TINT = (0.95, 0.98, 1.03)  # 소복 빛: 살짝 푸른 흰색
HAIR_DARK = (16, 16, 20)  # 머리 옆구리를 메우는 머리카락 색
HAIR_TINT = (0.94, 0.96, 1.06)  # 머리카락 윤기: 보랏빛을 빼고 푸른 검정으로
HEM_HOLD = 1340  # 이 아래는 찢어진 밑단이라 윤곽 대신 이 줄의 폭을 쓴다
# 전신 뒤 그림에서 같은 자리: 앞 그림 줄 -> 뒤 그림 줄
BACK_MAP = [(CROWN, 94), (NECK, 322), (HEM, 1380)]
M = 0.00175  # 한 픽셀의 미터. 정수리가 땅 위 2.55m
HEM_Y = 0.12  # 밑단 끝 높이 (미터). 발 없이 떠 있다
FRONT_HEAD, FRONT_BODY = 2 / 3, 1 / 2
HEAD_W, HEAD_PX = 768, 768
BODY_W, BODY_PX = 1024, 1280
# 머리카락 그림: 덩어리마다 [왼쪽, 오른쪽] 픽셀. 위쪽 나뭇가지는 HAIR_TOP 줄 아래로 잘라 낸다
CLUMPS = [(440, 720), (760, 1160), (1180, 1530), (1545, 1835)]
HAIR_TOP, HAIR_BOTTOM = 262, 1440
CLUMP_W, SHEET_H = 256, 1024
# 손: [왼쪽, 위, 오른쪽, 아래] 와 몸 쪽 가장자리 (여기서 투명해진다)
HANDS = [((1095, 815, 1212, 1052), 1196, -1), ((1540, 815, 1657, 1052), 1556, 1)]
HAND_W = 128
# 얼굴 그림에서 쓰는 네모 (원본 2048 픽셀)
FACE_BOX = (404, 280, 1644, 1900)
FACE_OUT = (448, 586)


def grey(rgb, tint):
    lum = np.asarray(rgb, float) @ np.array([0.3, 0.59, 0.11])
    return (lum[..., None] * np.array(tint)).clip(0, 255).astype('uint8')


def row_y(r):
    return (HEM - r) * M + HEM_Y


def unmix(path, mark):
    # 배경 마젠타와 섞인 만큼 알파를 내리고 색에서 분홍을 뺀다
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    a[mark[1]:, mark[0]:] = MAGENTA
    pink = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    alpha = 1 - np.clip((pink - 10) / 235, 0, 1)
    rgb = (a - (1 - alpha)[..., None] * MAGENTA) / np.maximum(alpha, 0.02)[..., None]
    return bleed(rgb.clip(0, 255), alpha), alpha


def bleed(rgb, alpha):
    # 거의 투명한 곳의 색은 둘레 그림 색으로 채운다. 그림을 줄이거나 흐릴 때 가장자리에 검은 테나 분홍이 번지지 않게
    out = rgb.copy()
    w = np.clip(alpha / 0.35, 0, 1) ** 2
    for sigma in (40, 6):
        den = gaussian_filter(w, sigma) + 1e-6
        fill = np.stack([gaussian_filter(rgb[..., c] * w, sigma) / den for c in range(3)], -1)
        k = np.clip(alpha / 0.35, 0, 1)[..., None]
        out = out * k + fill * (1 - k) if sigma == 40 else out * (0.5 + 0.5 * k) + fill * (0.5 - 0.5 * k)
    return out.clip(0, 255)


def back_row(r):
    return np.interp(r, *zip(*BACK_MAP))


def wrap_alpha(rows_f, rows_b, hw_f, hw_b, a_f, a_b, width, front, inset):
    # wrap 과 같은 자리에서 알파를 뜬다. 옆구리 띠는 앞뒤 가장자리 알파의 작은 쪽
    u = (np.arange(width) + 0.5) / width
    is_front = np.abs(u - 0.5) < front / 2
    s = np.where(is_front, (u - 0.5) / (front / 2), np.sign(u - 0.5) * (1 - (np.abs(u - 0.5) - front / 2) / (0.5 - front / 2))) * 1.17
    fade = np.clip((1 - np.abs(s)) / 0.2, 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    out = np.zeros((len(rows_f), width))
    for y, (rf, rb) in enumerate(zip(rows_f, rows_b)):
        xf = (CX + s * max(hw_f[rf] - inset, 1)).round().astype(int).clip(0, a_f.shape[1] - 1)
        xb = (CX - s * max(hw_b[rb] - inset, 1)).round().astype(int).clip(0, a_b.shape[1] - 1)
        row = np.where(is_front, a_f[rf, xf], a_b[rb, xb])
        edge = [a_f[rf, int(CX + k * 0.9 * hw_f[rf])] for k in (-1, 1)] + [a_b[rb, int(CX + k * 0.9 * hw_b[rb])] for k in (-1, 1)]
        out[y] = row * fade + min(edge) * (1 - fade)
    return out


def widths(alpha, cut):
    hw = half_widths(alpha > cut, CX)
    hw[:CROWN] = 0
    return hw


front, a_front = unmix(f'{SRC}/ghost_front.png', MARK)
back, a_back = unmix(f'{SRC}/ghost_back.png', MARK)

# ---- 머리
hw = smooth(widths(a_front, 0.5), 9)
hw_b = smooth(widths(a_back, 0.5), 9)
rows = np.linspace(CROWN + 3, NECK, HEAD_PX).astype(int)
rows_b = back_row(rows).astype(int)
tone = np.tile(HAIR_DARK, (len(rows), 1))  # 머리 옆은 머리카락이다. 윤곽 옆 색을 재면 어깨의 흰 소복이 섞인다
head = wrap(rows, rows_b, hw, hw_b, front.astype('uint8'), back.astype('uint8'), CX, CX, HEAD_W, FRONT_HEAD, 6, tone)
Image.fromarray(head).save(f'{OUT}/horror_maiden_head.jpg', quality=86)
head_hw = hw.copy()

# ---- 몸
hw = widths(a_front, 0.4)
lo, hi = HAND_ROWS
hw[lo:hi] = np.minimum(hw[lo:hi], np.linspace(ROBE_AT_HANDS, hw[hi], hi - lo))  # 손은 따로 붙인다
hw[HEM_HOLD:] = hw[HEM_HOLD]
hw = smooth(hw, 31)
hw_b = widths(a_back, 0.4)
hold_b = int(back_row(HEM_HOLD))
hw_b[hold_b:] = hw_b[hold_b]
hw_b = smooth(hw_b, 31)
rows = np.linspace(BODY_TOP, HEM, BODY_PX).astype(int)
rows_b = back_row(rows).astype(int)
tone = side_tone(front.astype('uint8'), rows, hw, CX, 20, 0.85)
rgb = wrap(rows, rows_b, hw, hw_b, front.astype('uint8'), back.astype('uint8'), CX, CX, BODY_W, FRONT_BODY, 16, tone, True, 0.25)
rgb = grey(rgb, ROBE_TINT)  # 밑단에 남은 분홍기를 빼고 차가운 흰빛으로
alpha = wrap_alpha(rows, rows_b, hw, hw_b, a_front, a_back, BODY_W, FRONT_BODY, 16)
alpha *= np.clip((HEM + 20 - rows) / (HEM + 20 - FADE_FROM), 0, 1)[:, None] ** 0.8  # 아래로 갈수록 투명해진다
alpha[-6:] = 0  # 맨 아랫줄은 늘어지지 않게 비운다
Image.fromarray(np.dstack([rgb, (alpha * 255).astype('uint8')]), 'RGBA').save(f'{OUT}/horror_maiden_body.webp', quality=86, method=6)

# ---- 머리카락과 손
hair, a_hair = unmix(f'{SRC}/hair.png', MARK)
dark = np.array([10, 10, 12], float)
sheet = np.zeros((SHEET_H, CLUMP_W * len(CLUMPS) + HAND_W * len(HANDS), 4), 'uint8')
for i, (x0, x1) in enumerate(CLUMPS):
    a = a_hair[HAIR_TOP:HAIR_BOTTOM, x0:x1].copy()
    a *= np.clip(np.arange(a.shape[0]) / 50, 0, 1)[:, None]  # 잘린 윗머리는 부드럽게 시작한다
    a *= np.clip(np.minimum(np.arange(a.shape[1]), a.shape[1] - 1 - np.arange(a.shape[1])) / 12, 0, 1)[None, :]  # 옆 덩어리 끝을 뺀다
    c = grey(hair[HAIR_TOP:HAIR_BOTTOM, x0:x1], HAIR_TINT) * np.clip(a / 0.3, 0, 1)[..., None] + dark * (1 - np.clip(a / 0.3, 0, 1))[..., None]
    im = Image.fromarray(np.dstack([c, a * 255]).clip(0, 255).astype('uint8'), 'RGBA').resize((CLUMP_W, SHEET_H), Image.LANCZOS)
    sheet[:, i * CLUMP_W:(i + 1) * CLUMP_W] = np.asarray(im)
hand_info = []
for j, ((x0, y0, x1, y1), inner, side) in enumerate(HANDS):
    a = a_front[y0:y1, x0:x1].copy()
    xs = np.arange(x0, x1)
    a *= np.clip((inner - xs) / 14 if side < 0 else (xs - inner) / 14, 0, 1)[None, :]  # 몸 쪽은 소복 그림이 맡는다
    a *= np.clip((np.arange(y1 - y0)) / 24, 0, 1)[:, None]  # 소매 끝 위로 녹아든다
    c = front[y0:y1, x0:x1]
    im = Image.fromarray(np.dstack([c, a * 255]).clip(0, 255).astype('uint8'), 'RGBA').resize((HAND_W, SHEET_H // 2), Image.LANCZOS)
    x = CLUMP_W * len(CLUMPS) + j * HAND_W
    sheet[:SHEET_H // 2, x:x + HAND_W] = np.asarray(im)
    hand_info.append(((x0 - CX) * M, (x1 - CX) * M, row_y(y0), row_y(y1)))
Image.fromarray(sheet, 'RGBA').save(f'{OUT}/horror_maiden_hair.webp', quality=86, method=6)

# ---- 얼굴: 가운데는 그대로, 가장자리는 머리카락 어둠으로 녹인다
face = np.asarray(Image.open(f'{SRC}/ghost_face.png').convert('RGB')).copy()
x0, y0, x1, y1 = FACE_MARK
face[y0:y1, x0:x1] = 6
x0, y0, x1, y1 = FACE_BOX
crop = face[y0:y1, x0:x1].astype(float)
yy, xx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
r = np.hypot((xx / crop.shape[1] - 0.5) / 0.5, (yy / crop.shape[0] - 0.5) / 0.5)
a = np.clip((1 - r) / 0.16, 0, 1) ** 1.5
Image.fromarray(np.dstack([crop, a * 255]).astype('uint8'), 'RGBA').resize(FACE_OUT, Image.LANCZOS).save(f'{OUT}/horror_maiden_face.webp', quality=86, method=6)

# ---- 안내 화면 얼굴: 세이노와 같은 480x512, 둘레는 어둠에 녹인다
port = face[0:2048, 64:1984].astype(float)
yy, xx = np.mgrid[0:port.shape[0], 0:port.shape[1]]
r = np.hypot((xx / port.shape[1] - 0.5) / 0.5, (yy / port.shape[0] - 0.47) / 0.53)
a = np.clip((1.02 - r) / 0.3, 0, 1)
Image.fromarray(np.dstack([port, a * 255]).astype('uint8'), 'RGBA').resize((480, 512), Image.LANCZOS).save(f'{OUT}/horror_face_maiden.webp', quality=82, method=6)

# ---- 치수
print('crown y', round(row_y(CROWN), 3), 'neck y (head pivot)', round(row_y(NECK), 3), 'chin y', round(row_y(CHIN), 3), 'body top y', round(row_y(BODY_TOP), 3))
print('head keys [m above neck, half width]')
print(', '.join(f'[{round((NECK - r) * M, 3)}, {round(float(head_hw[r]) * M, 3)}]' for r in np.linspace(CROWN + 3, NECK, 14).astype(int)))
print('body keys [m above floor, half width]')
print(', '.join(f'[{round(row_y(r), 3)}, {round(float(hw[r]) * M, 3)}]' for r in np.linspace(BODY_TOP, HEM, 22).astype(int)))
print('hands [x left, x right, y top, y bottom]', [tuple(round(v, 3) for v in h) for h in hand_info])
print('face box size (m at head scale) w', round((FACE_BOX[2] - FACE_BOX[0]) / (FACE_BOX[3] - FACE_BOX[1]), 3))
