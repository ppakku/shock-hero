# 바닥 그림을 게임용 반복 타일로 만든다.
# 사용법: python3 tools/make_ground_tile.py 원본.png public/art/결과.png [자를_위y] [자를_아래y] [타일_높이]
# 1) 위쪽 체크무늬(밝은 무채색)를 위에서부터 지워 투명으로  2) 위아래를 잘라 높이를 맞춤
# 3) 오른쪽 끝을 왼쪽 시작과 섞어 좌우로 이어 붙여도 이음새가 안 보이게 함
import sys
from collections import deque
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
top = int(sys.argv[3]) if len(sys.argv) > 3 else 200
bottom = int(sys.argv[4]) if len(sys.argv) > 4 else 640
tile_h = int(sys.argv[5]) if len(sys.argv) > 5 else 130
im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()

def bg(p):
    r, g, b, a = p
    return max(r, g, b) - min(r, g, b) < 26 and max(r, g, b) > 150

seen = bytearray(w * h)
q = deque((x, 0) for x in range(w))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]:
        continue
    seen[i] = 1
    if not bg(px[x, y]):
        continue
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
            q.append((nx, ny))
# 윗면 위에 남은 연기 자국(밝은 반투명 무채색) 정리
for y in range(0, min(h, top + 140)):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a and max(r, g, b) > 120 and max(r, g, b) - min(r, g, b) < 30:
            px[x, y] = (0, 0, 0, 0)

crop = im.crop((0, top, w, bottom))
scale = tile_h / crop.height
crop = crop.resize((round(w * scale), tile_h), Image.LANCZOS)
cw = crop.width
overlap = cw // 7
res = Image.new('RGBA', (cw - overlap, tile_h), (0, 0, 0, 0))
res.paste(crop.crop((0, 0, cw - overlap, tile_h)), (0, 0))
rp, cp = res.load(), crop.load()
for x in range(overlap):
    t = x / overlap  # 0: 오른쪽 끝 그림, 1: 왼쪽 시작 그림
    for y in range(tile_h):
        a = cp[cw - overlap + x, y]
        b = cp[x, y]
        rp[x, y] = tuple(round(a[k] * (1 - t) + b[k] * t) for k in range(4))
res.save(out, optimize=True)
print('saved', out, res.size, 'scale', round(scale, 3))
