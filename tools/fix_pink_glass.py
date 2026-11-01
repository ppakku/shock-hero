# 마젠타 배경 그림에서 투명 유리 속에 번진 분홍기를 회청색으로 바꾼다.
# 사용법: python3 tools/fix_pink_glass.py 입력.png 출력.png
import sys
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
pink = np.clip(np.minimum(r, b) - g, 0, 255)
m = (pink > 12) & (a[..., 3] > 0)
gray = (r + g + b) / 3
k = np.clip(pink / 60, 0, 1)
a[..., 0] = np.where(m, r * (1 - k) + (gray * 0.95) * k, r)
a[..., 1] = np.where(m, g * (1 - k) + (gray * 1.02) * k, g)
a[..., 2] = np.where(m, b * (1 - k) + (gray * 1.1) * k, b)
Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA').save(sys.argv[2], optimize=True)
