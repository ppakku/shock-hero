# 사용법: python3 tools/make_platform.py 원본.png public/art/결과.png [높이=100]
# 흰 배경(또는 체크무늬)에 그린 발판 그림을 바깥에서부터 지워 투명으로 만들고,
# 그림만 남게 자른 뒤 높이를 맞춘다. 별 표시(오른쪽 아래 밝은 무채색)도 바깥 배경과 함께 지워진다.
import sys
from collections import deque
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
height = int(sys.argv[3]) if len(sys.argv) > 3 else 100
im = Image.open(src).convert('RGBA')
W, H = im.size
px = im.load()


def bg(p):
    r, g, b, a = p
    return max(r, g, b) - min(r, g, b) < 24 and max(r, g, b) > 150


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

# 철골 틈처럼 막힌 곳에 갇힌 흰 배경: 발판 그림에는 흰색이 없으니 밝은 무채색은 모두 지운다
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a and max(r, g, b) > 175 and max(r, g, b) - min(r, g, b) < 20:
            px[x, y] = (0, 0, 0, 0)

# 오른쪽 아래 구석의 반투명 별 자국(회색): 녹슨 철은 갈색이라 무채색 회색만 지운다
for y in range(H * 2 // 3, H):
    for x in range(W * 4 // 5, W):
        r, g, b, a = px[x, y]
        if a and max(r, g, b) > 90 and max(r, g, b) - min(r, g, b) < 30:
            px[x, y] = (0, 0, 0, 0)

# 외곽선 바깥에 남은 밝은 테두리 한 겹 걷기
edge = [(x, y) for y in range(1, H - 1) for x in range(1, W - 1)
        if px[x, y][3] and max(px[x, y][:3]) > 170 and max(px[x, y][:3]) - min(px[x, y][:3]) < 30
        and any(px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
for x, y in edge:
    px[x, y] = (0, 0, 0, 0)

im = im.crop(im.getbbox())
im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
im.save(out, optimize=True)
print(out, im.size)
