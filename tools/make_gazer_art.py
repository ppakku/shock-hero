# 눈뜬이 그림을 게임용으로 만든다. 원본은 Gemini 가 초상화와 아들의 그림(3487)을 참고로 그린 넉 장이다.
# 사용법: python3 tools/make_gazer_art.py 머리앞.png 머리뒤.png 전신앞.png 전신뒤.png
# 머리와 몸 모두 가운데가 앞면, 양쪽 끝이 뒷면이다. 앞면은 줄마다 윤곽을 재서 정면 그림 그대로 입히고,
# 옆구리는 먹선을 지운 살빛으로 이어서 옆에서 봐도 스티커처럼 보이지 않게 한다.
# 흰자와 고리 눈동자는 따로 떠서 눈동자만 움직이게 하고, 안내 화면 얼굴도 머리 그림에서 다시 만든다.
# 끝에 머리와 몸의 높이별 반폭을 찍는다 (creatureGazer.js 의 키 표).
import sys
import numpy as np
from PIL import Image
from wrap_art import half_widths, keys, load, mask_of, side_tone, smooth, wrap

head_src, head_back_src, body_src, body_back_src = sys.argv[1:5]
OUT = 'public/art'
HEIGHT = 2.7  # 게임 속 키 (미터)
HEAD_H, CHIN_Y = 1.05, 1.65  # 머리 높이와 턱 끝 높이
FRONT_HEAD, FRONT_BODY = 2 / 3, 1 / 2  # 그림 폭 가운데 앞면이 차지하는 몫
HEAD_W, HEAD_PX = 1536, 1536
BODY_W, BODY_PX = 1280, 1280
# 머리 앞 그림에서 잰 자리 (원본 픽셀)
CX, EYE_Y, EYE_DX = 848, 689, 260
EYE_R, IRIS_R = 118, 62
CHIN = 1965
JAW = [(1700, 295), (1800, 258), (1850, 225), (1900, 170), (1940, 110), (1965, 20)]  # 목과 붙어 있어 윤곽을 못 재는 턱선: (줄, 반폭)
NECK_FROM = 40  # 전신 그림에서 턱 끝보다 이만큼 아래 줄을 몸 맨 위로 쓴다
BODY_TOP = 1.75  # 몸 맨 위 높이 (미터). 머리 속으로 들어간다
BODY_HW = 0.55  # 옷자락 반폭 (미터)


# 머리
front = load(head_src)
back = load(head_back_src)
mask = mask_of(front)
top = np.where(mask[:, CX])[0][0]
hw = half_widths(mask, CX)
for (a, wa), (b, wb) in zip(JAW, JAW[1:]):
    hw[a:b + 1] = np.linspace(wa, wb, b + 1 - a)
hw = smooth(hw, 25)
mask_b = mask_of(back)
top_b = np.where(mask_b[:, CX])[0][0]
hw_b = smooth(half_widths(mask_b, CX), 25)
m = HEAD_H / (CHIN - top)
print('head top', top, 'chin', CHIN, 'm per px', round(m, 6))
rows = np.linspace(top + 4, CHIN - 1, HEAD_PX).astype(int)
rows_b = np.linspace(top_b + 4, top_b + (CHIN - top) * 0.72, HEAD_PX).astype(int)  # 뒤 그림은 목덜미가 턱보다 위에서 시작한다
tone = side_tone(front, rows, hw, CX, 16, 0.78)
head = wrap(rows, rows_b, hw, hw, front, (back * 0.8).astype('uint8'), CX, CX, HEAD_W, FRONT_HEAD, 14, tone)
Image.fromarray(head).save(f'{OUT}/horror_gazer_head.jpg', quality=84)
keys('head keys (m above chin, half width)', 0, np.arange(top + 4, CHIN), hw, m, 16)

# 눈: 눈동자가 움직이게 흰자와 고리 눈동자를 따로 뜬다
cx, cy = CX - EYE_DX, EYE_Y
eye = front[cy - EYE_R:cy + EYE_R, cx - EYE_R:cx + EYE_R].astype(float)
yy, xx = np.mgrid[-EYE_R:EYE_R, -EYE_R:EYE_R] + 0.5
r = np.hypot(xx, yy)
# 흰자는 눈동자 없이 새로 칠한다: 그림 속 흰자 빛에 위쪽 눈꺼풀 그늘을 얹는다
band = eye[(r > 70) & (r < 92)]
pale = np.percentile(band, 80, axis=0)
shade = (1 - 0.3 * np.clip((yy + EYE_R * 0.1) / -EYE_R, 0, 1) - 0.4 * np.clip(r / EYE_R - 0.62, 0, 1))[..., None]
Image.fromarray((pale * shade).clip(0, 255).astype('uint8')).resize((256, 256), Image.LANCZOS).save(f'{OUT}/horror_gazer_white.jpg', quality=86)
iris = front[cy - IRIS_R:cy + IRIS_R, cx - IRIS_R:cx + IRIS_R]
Image.fromarray(iris).resize((192, 192), Image.LANCZOS).save(f'{OUT}/horror_gazer_iris.jpg', quality=86)

# 안내 화면 얼굴: 다른 괴물과 같은 높이로, 마젠타를 빼고 아래쪽을 어둠에 녹인다
a = front.astype(float)
pink = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
keep = 1 - np.clip((pink - 40) / 80, 0, 1)
fade = np.clip((a.shape[0] * 0.97 - np.arange(a.shape[0])) / (a.shape[0] * 0.14), 0, 1)[:, None]
for c in (0, 2):
    a[..., c] -= pink.clip(0, 255) * (keep < 1)
cutout = Image.fromarray(np.dstack([a.clip(0, 255), keep * fade * 255]).astype('uint8'), 'RGBA')
cutout = cutout.crop(cutout.getbbox())
cutout.resize((round(cutout.width * 512 / cutout.height), 512), Image.LANCZOS).save(f'{OUT}/horror_face_gazer.webp', quality=82, method=6)

# 몸
front = load(body_src)
back = load(body_back_src)
mid = front.shape[1] // 2
mask = mask_of(front)
mask_b = mask_of(back)
hw = half_widths(mask, mid)
hw_b = half_widths(mask_b, mid)
hem = np.where(mask[:, mid] | (hw > 0))[0][-1] - 30
hem_b = np.where(hw_b > 0)[0][-1] - 30
chin = int(np.argmin(hw[300:1100]) + 300)  # 목이 가장 가는 줄
neck = chin - 60 + NECK_FROM
neck_b = int(np.argmin(hw_b[300:1100]) + 300) - 60 + NECK_FROM
print('body neck', chin, 'hem', hem, 'back neck', neck_b, 'hem', hem_b)
hw, hw_b = smooth(hw, 41), smooth(hw_b, 41)
rows = np.linspace(neck, hem, BODY_PX).astype(int)
rows_b = np.linspace(neck_b, hem_b, BODY_PX).astype(int)
tone = side_tone(front, rows, hw, mid, 24, 0.7)
body = wrap(rows, rows_b, hw, hw_b, front, back, mid, mid, BODY_W, FRONT_BODY, 22, tone)
Image.fromarray(body).save(f'{OUT}/horror_gazer_body.jpg', quality=82)
print('body keys (m above floor, half width)')
for row in np.linspace(neck, hem - 8, 14).astype(int):
    print(round(BODY_TOP * (hem - row) / (hem - neck), 3), round(hw[row] * BODY_HW / hw[hem - 60], 3))
