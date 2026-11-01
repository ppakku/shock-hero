# 땅속이 그림을 게임용으로 만든다. 원본은 Gemini 가 아들의 그림(3489)을 참고로 그린 전신 컨셉과 땅 구멍 그림이다.
# 사용법: python3 tools/make_mole_art.py 전신.png 구멍.png
# 줄마다 몸 윤곽을 재서 양옆을 그림 끝까지 펼친다. 머리는 가운데 절반이 앞얼굴, 양쪽 끝 4분의 1씩이 뒤통수다.
# 끝에 머리와 몸의 높이별 반폭을 찍는다 (creatureMole.js 의 키 표).
import sys
import numpy as np
from PIL import Image, ImageFilter

concept, crack = sys.argv[1:3]
OUT = 'public/art'
HEIGHT = 2.7  # 게임 속 키 (미터)
CHIN = 1050  # 원본에서 턱이 끝나는 줄
HEAD_SIZE, BODY_W, BODY_H = 1024, 512, 1024


def body_mask(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    solid = ~((r > 150) & (b > 150) & (g < 110))
    # 가는 머리카락과 흙 부스러기를 지운다 (윤곽이 튀지 않게)
    im = Image.fromarray((solid * 255).astype('uint8'))
    return np.asarray(im.filter(ImageFilter.MinFilter(21)).filter(ImageFilter.MaxFilter(21))) > 128


def edges(mask, mid):
    # 줄마다 mid 를 지나는 구간의 양끝. 윤곽이 튀지 않게 위아래로 고른다
    n = mask.shape[0]
    left = np.full(n, mid - 2.0)
    right = np.full(n, mid + 2.0)
    for y in range(n):
        if mask[y, mid]:
            xs = np.where(~mask[y, :mid])[0]
            left[y] = xs[-1] + 1 if xs.size else 0
            xs = np.where(~mask[y, mid:])[0]
            right[y] = mid + xs[0] - 1 if xs.size else mask.shape[1] - 1
    return left, right


def smooth(v, n=31):
    k = np.ones(n) / n
    return np.convolve(np.pad(v, n // 2, mode='edge'), k, 'valid')


def rectify(rgb, left, right, top, bottom, width, height, margin):
    # 윤곽 바로 안쪽만 쓴다. 가장자리의 마젠타 번짐이 몸에 묻지 않게 margin 만큼 들어간다
    out = np.zeros((height, width, 3), 'uint8')
    for y in range(height):
        row = int(top + (bottom - top) * y / (height - 1))
        xs = np.linspace(left[row] + margin, max(left[row] + margin + 1, right[row] - margin), width).round().astype(int)
        out[y] = rgb[row, xs]
    return out


src = np.asarray(Image.open(concept).convert('RGB'))
mid = src.shape[1] // 2 - 8
mask = body_mask(src)
rows = np.where(mask[:, mid])[0]
top, hem = rows[0], rows[-1]
scale = HEIGHT / (hem - top)
print('top', top, 'hem', hem, 'm per px', round(scale, 5))
left, right = edges(mask, mid)
# 어깨에서는 팔이 몸에 붙어 있다. 팔이 떨어지는 줄의 폭을 그 위로 그대로 쓴다
below = (right - left)[CHIN:hem]
split = CHIN + int(np.argmax(np.diff(below[:400]) < -40)) + 8
print('arms part at', split)
left[CHIN:split] = np.maximum(left[CHIN:split], left[split])
right[CHIN:split] = np.minimum(right[CHIN:split], right[split])
left, right = smooth(left), smooth(right)

face = rectify(src, left, right, top + 10, CHIN, HEAD_SIZE // 2, HEAD_SIZE, 24)
# 뒤통수: 정수리 쪽 맨살을 반복해서 깔고, 얼굴 가장자리 색과 이어 붙인다
patch = np.asarray(Image.fromarray(face[60:230, 90:420]).resize((HEAD_SIZE // 4, HEAD_SIZE // 2)))
back = np.vstack([patch, patch[::-1]])
head = np.zeros((HEAD_SIZE, HEAD_SIZE, 3), 'uint8')
head[:, HEAD_SIZE // 4:HEAD_SIZE * 3 // 4] = face
blend = (1 - np.clip(np.arange(HEAD_SIZE // 4) / 60, 0, 1))[None, :, None]
soft = np.stack([smooth(face[:, -2, c].astype(float), 41) for c in range(3)], -1)[:, None]
head[:, HEAD_SIZE * 3 // 4:] = soft * blend + back * (1 - blend)
soft = np.stack([smooth(face[:, 1, c].astype(float), 41) for c in range(3)], -1)[:, None]
head[:, :HEAD_SIZE // 4] = (soft * blend + back * (1 - blend))[:, ::-1]
Image.fromarray(head).save(f'{OUT}/horror_mole_head.jpg', quality=86)

body = rectify(src, left, right, CHIN - 60, hem - 40, BODY_W, BODY_H, 30)
Image.fromarray(body).save(f'{OUT}/horror_mole_body.jpg', quality=84)

hole = Image.open(crack).convert('RGB')
a = np.asarray(hole).astype(float)
pink = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
alpha = 255 * (1 - np.clip((pink - 40) / 80, 0, 1))
a[..., 0] -= pink.clip(0, 255) * (alpha < 255)
a[..., 2] -= pink.clip(0, 255) * (alpha < 255)
cut = Image.fromarray(np.dstack([a.clip(0, 255), alpha]).astype('uint8'), 'RGBA')
ys, xs = np.where(alpha > 128)
box = (xs.min(), ys.min(), min(xs.max(), int(hole.width * 0.93)), ys.max())
side = max(box[2] - box[0], box[3] - box[1])
cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
square = Image.new('RGBA', (side, side))
square.alpha_composite(cut.crop((max(0, cx - side // 2), max(0, cy - side // 2), cx + side // 2, cy + side // 2)), (max(0, side // 2 - cx), max(0, side // 2 - cy)))
square.resize((512, 512), Image.LANCZOS).save(f'{OUT}/horror_mole_hole.webp', quality=82, method=6)

print('head keys (m above chin, half width)')
for row in np.linspace(top + 6, CHIN, 12).astype(int):
    print(round((CHIN - row) * scale, 3), round((right[row] - left[row]) / 2 * scale, 3))
print('body keys (m above floor, half width)')
for row in np.linspace(CHIN, hem - 6, 12).astype(int):
    print(round((hem - row) * scale, 3), round((right[row] - left[row]) / 2 * scale, 3))
