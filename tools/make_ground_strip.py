# 사용법: python3 tools/make_ground_strip.py 원본.png public/art/결과.png 윗면y 아래y [타일_높이=110] [위_여유=14] [왼쪽x] [오른쪽x]
#   위_여유: 윗면 위로 솟은 풀이나 언덕을 남길 높이, 왼쪽x 오른쪽x: 양 끝 덤불처럼 반복하면 어색한 부분을 빼고 자를 범위
# 흰 배경(눈 바닥처럼 흰 그림은 분홍 #FF00FF 배경) 위에 그린 바닥 띠 그림을 반복 바닥 타일로 만든다.
# 1) 위쪽 흰 배경을 위에서부터 지운다 (윗면 위의 작은 돌은 흰색과 이어지지 않아 남는다)
# 2) 윗면y 조금 위부터 아래y 까지 잘라 높이를 맞춘다
# 3) 오른쪽 끝을 왼쪽 시작과 섞어 이어 붙여도 이음새가 안 보이게 한다
# 출력의 윗면 높이(stage 파일 groundImage.surface 에 적을 값)를 알려 준다.
import sys
from collections import deque
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
top, bottom = int(sys.argv[3]), int(sys.argv[4])
tile_h = int(sys.argv[5]) if len(sys.argv) > 5 else 110
pad = int(sys.argv[6]) if len(sys.argv) > 6 else 14  # 윗면 외곽선과 위로 튀어나온 조각을 남길 여유
im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()

seen = bytearray(w * h)
q = deque((x, 0) for x in range(w))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]:
        continue
    seen[i] = 1
    r, g, b, a = px[x, y]
    white = max(r, g, b) - min(r, g, b) < 26 and max(r, g, b) > 170
    magenta = r > 170 and b > 170 and g < 110  # 눈처럼 흰 그림은 분홍(#FF00FF) 배경으로 그린다
    if not (white or magenta):
        continue
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
            q.append((nx, ny))

x0 = int(sys.argv[7]) if len(sys.argv) > 7 else 0
x1 = int(sys.argv[8]) if len(sys.argv) > 8 else w
crop = im.crop((x0, top - pad, x1, bottom))
scale = tile_h / crop.height
crop = crop.resize((round(crop.width * scale), tile_h), Image.LANCZOS)
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
print('saved', out, res.size, 'surface', round(pad * scale))
