# 사용법: python3 tools/key_magenta.py 원본.png public/art/결과.png [높이=원본그대로] [--no-trim] [--main]
# Gemini 에게 "배경은 완전한 단색 마젠타(#FF00FF)" 로 받은 그림의 배경을 지워 투명 PNG 로 만든다.
# 1) 오른쪽 아래 별 표시도 마젠타 계열이라 함께 지워진다  2) 가장자리는 부드럽게 빼서 분홍 테두리가 남지 않게 한다
# 3) 남은 그림만 남게 잘라 내고 높이를 맞춘다. 칸 나누기가 필요한 시트는 --no-trim 으로 쓴다.
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

args = [a for a in sys.argv[1:] if not a.startswith('--')]
src, dst = args[0], args[1]
height = int(args[2]) if len(args) > 2 else None
im = np.asarray(Image.open(src).convert('RGB')).astype(float)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# 마젠타다움: 빨강과 파랑이 초록보다 얼마나 높은가 (0 = 그림, 1 = 배경)
pink = np.minimum(r, b) - g
alpha = 1 - np.clip((pink - 60) / 120, 0, 1)
# 마젠타가 섞인 가장자리 색에서 분홍기를 뺀다
fix = np.minimum(pink.clip(0), 255)
rgb = np.stack([r - fix * (alpha < 1), g, b - fix * (alpha < 1)], -1).clip(0, 255)
out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype('uint8'), 'RGBA')
if '--main' in sys.argv:  # 가장 큰 덩어리만 남긴다 (둘레의 속도선, 파편, 별 표시를 지움)
    small = out.getchannel('A').point(lambda v: 255 if v > 64 else 0).resize((out.width // 4, out.height // 4), Image.NEAREST)
    w, h = small.size
    px = small.load()
    seen = bytearray(w * h)
    best = []
    for s in range(w * h):
        if seen[s] or not px[s % w, s // w]:
            continue
        seen[s] = 1
        q, comp = deque([s]), []
        while q:
            i = q.popleft()
            comp.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and not seen[j] and px[nx, ny]:
                    seen[j] = 1
                    q.append(j)
        if len(comp) > len(best):
            best = comp
    keep = Image.new('L', (w, h), 0)
    kp = keep.load()
    for i in best:
        kp[i % w, i // w] = 255
    keep = keep.resize(out.size, Image.NEAREST).filter(ImageFilter.MaxFilter(13))
    a = np.asarray(out).copy()
    a[..., 3] = a[..., 3] * (np.asarray(keep) > 0)
    out = Image.fromarray(a, 'RGBA')
if '--no-trim' not in sys.argv:
    out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())
if height:
    out = out.resize((max(1, round(out.width * height / out.height)), height), Image.LANCZOS)
out.save(dst)
print(dst, out.size)
