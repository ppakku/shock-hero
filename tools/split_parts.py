# 사용법: python3 tools/split_parts.py 원본.png public/art 이름1.png:높이 이름2.png:높이 ...
# 흰 배경에 여러 부품(예: 닫힌 상자, 열린 상자, 방패 조각)이 가로로 나란히 그려진 그림을
# 빈 세로줄 중 가장 넓은 곳들에서 나눠, 부품마다 배경을 지우고 잘라 정한 높이로 저장한다.
# 반짝이처럼 떨어진 작은 조각도 같은 칸 안에 있으면 함께 남는다. 별 표시는 흰 배경과 함께 지워진다.
import sys
from collections import deque
from PIL import Image

src, outdir, specs = sys.argv[1], sys.argv[2], sys.argv[3:]
im = Image.open(src).convert('RGBA')
W, H = im.size
px = im.load()


def bg(p):
    r, g, b, a = p
    return max(r, g, b) - min(r, g, b) < 28 and max(r, g, b) > 150


seen = bytearray(W * H)
q = deque()
for x in range(W):
    q.append((x, 0)); q.append((x, H - 1))
for y in range(H):
    q.append((0, y)); q.append((W - 1, y))
while q:
    x, y = q.popleft()
    i = y * W + x
    if seen[i]:
        continue
    seen[i] = 1
    if not bg(px[x, y]):
        continue
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
            q.append((nx, ny))

alpha = im.getchannel('A')
filled = [any(alpha.getpixel((x, y)) > 128 for y in range(0, H, 3)) for x in range(W)]
first = filled.index(True)
last = W - 1 - filled[::-1].index(True)
# 빈 세로줄 구간들 (그림 사이)
gaps, x = [], first
while x <= last:
    if not filled[x]:
        s = x
        while x <= last and not filled[x]:
            x += 1
        gaps.append((x - s, (s + x) // 2))
    x += 1
cuts = sorted(c for _, c in sorted(gaps, reverse=True)[: len(specs) - 1])
bounds = [0] + cuts + [W]
for (spec, x0, x1) in zip(specs, bounds, bounds[1:]):
    name, h = spec.split(':')
    part = im.crop((x0, 0, x1, H))
    part = part.crop(part.getbbox())
    h = int(h)
    part = part.resize((round(part.width * h / part.height), h), Image.LANCZOS)
    part.save(f'{outdir}/{name}', optimize=True)
    print(f'{outdir}/{name}', part.size)
