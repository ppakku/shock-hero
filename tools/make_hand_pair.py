# 전기충격기 손 두 장(꺼짐, 충전)을 같은 틀로 맞춰 투명 PNG 로 만든다. 원본은 Gemini 가 마젠타 배경으로 그린 그림이다.
# 충전 그림은 꺼짐 그림을 고쳐 그린 것이라 몇 픽셀 어긋나서, 장갑과 팔뚝 모양으로 위치를 맞춘 뒤 같은 상자로 자른다.
# 사용법: python3 tools/make_hand_pair.py 꺼짐.png 충전.png public/art [높이=768]
import sys
import numpy as np
from PIL import Image, ImageFilter

cold_src, live_src, dst = sys.argv[1:4]
height = int(sys.argv[4]) if len(sys.argv) > 4 else 768


def erase_star(im):
    # 오른쪽 아래 별 표시를 바로 왼쪽 그림으로 덮는다
    w, h = im.size
    s = int(w * 0.1)
    x0, y0 = w - s - int(w * 0.02), h - s - int(h * 0.02)
    patch = im.crop((x0 - s, y0, x0, y0 + s))
    mask = Image.new('L', (s, s), 0)
    mask.paste(255, (s // 8, s // 8, s - s // 8, s - s // 8))
    im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(s // 12)))


def key(im):
    a = np.asarray(im.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pink = np.minimum(r, b) - g
    alpha = 1 - np.clip((pink - 60) / 120, 0, 1)
    fix = np.where(alpha < 1, pink.clip(0, 255), 0)
    rgb = np.stack([r - fix, g, b - fix], -1).clip(0, 255)
    return np.dstack([rgb, alpha * 255]).astype('uint8')


cold = Image.open(cold_src).convert('RGB')
live = Image.open(live_src).convert('RGB')
erase_star(cold)
erase_star(live)
ca, la = key(cold), key(live)

# 위치 맞추기: 아래쪽 60%(장갑과 팔뚝)의 알파 모양을 위상 상관으로 비교한다
h, w = ca.shape[:2]
m0 = ca[..., 3].astype(float) / 255
m1 = la[..., 3].astype(float) / 255
m0[: int(h * 0.4)] = 0
m1[: int(h * 0.4)] = 0
cor = np.fft.ifft2(np.fft.fft2(m0) * np.conj(np.fft.fft2(m1)))
dy, dx = np.unravel_index(np.argmax(np.abs(cor)), cor.shape)
dy = dy - h if dy > h // 2 else dy
dx = dx - w if dx > w // 2 else dx
print('live shift', dx, dy)
live_img = Image.fromarray(la, 'RGBA')
shifted = Image.new('RGBA', live_img.size, (0, 0, 0, 0))
shifted.paste(live_img, (dx, dy))
cold_img = Image.fromarray(ca, 'RGBA')

# 두 그림의 합친 알파로 같은 상자를 자른다
union = np.maximum(np.asarray(cold_img)[..., 3], np.asarray(shifted)[..., 3])
ys, xs = np.where(union > 40)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
print('box', box)
for name, img in (('cold', cold_img), ('live', shifted)):
    c = img.crop(box)
    c = c.resize((round(c.width * height / c.height), height), Image.LANCZOS)
    c.save(f'{dst}/horror_hand_{name}.png', optimize=True)
    print('wrote', name, c.size)
