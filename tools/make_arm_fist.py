# 사용법: python3 tools/make_arm_fist.py 원본.png public/art 이름
# 흰 배경에 팔(왼쪽, 주먹이 아래로)과 주먹(오른쪽, 왼쪽을 향함)이 나란히 있는 그림 한 장에서 게임용 그림 두 장을 만든다.
#   <이름>_arm.png  : 팔 (280x840, 게임에서 70x210)
#   <이름>_fist.png : 로켓 펀치로 날아가는 주먹 (384x266, 게임에서 96x66)
# 팔의 금색 팔찌 윗선을 찾아 art.js 에 적을 armCut(210 높이 기준, 이 아래가 주먹)을 알려 준다.
# 오른쪽 아래 별 표시는 흰 배경과 함께 바깥에서부터 지워진다.
import sys
from collections import deque
from PIL import Image

src, outdir, name = sys.argv[1], sys.argv[2], sys.argv[3]
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


def fit(piece, cw, ch):
    k = min(cw / piece.width, ch / piece.height)
    piece = piece.resize((round(piece.width * k), round(piece.height * k)), Image.LANCZOS)
    out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    out.alpha_composite(piece, ((cw - piece.width) // 2, ch - piece.height))
    return out


def solid_box(piece, min_px=8):
    # 흩어진 점 몇 개는 무시하고, 그림이 든 줄과 칸만으로 상자를 잡는다
    a = piece.getchannel('A').point(lambda v: 255 if v > 128 else 0)
    cols = [sum(1 for y in range(0, piece.height, 2) if a.getpixel((x, y))) for x in range(piece.width)]
    rows = [sum(1 for x in range(0, piece.width, 2) if a.getpixel((x, y))) for y in range(piece.height)]
    xs = [x for x, c in enumerate(cols) if c >= min_px]
    ys = [y for y, c in enumerate(rows) if c >= min_px]
    return piece.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))


# 팔과 주먹 사이 빈 세로줄(가운데에 가장 가까운 곳)에서 나눈다
alpha = im.getchannel('A')
empty = [x for x in range(W) if not any(alpha.getpixel((x, y)) > 128 for y in range(0, H, 3))]
filled = [x for x in range(W) if x not in set(empty)]
gaps = [x for x in empty if filled[0] < x < filled[-1]]
split = min(gaps, key=lambda x: abs(x - W // 2)) if gaps else W // 2
left = im.crop((0, 0, split, H))
right = im.crop((split, 0, W, H))
arm = solid_box(left)
fist = solid_box(right)

# 금색 팔찌 윗선: 노란 픽셀이 한 줄의 1/3 이상인 첫 줄
ap = arm.load()
band = None
for y in range(arm.height):
    row = [ap[x, y] for x in range(arm.width) if ap[x, y][3]]
    gold = sum(1 for r, g, b, a in row if r > 150 and g > 110 and b < 90)
    if row and gold > len(row) / 3:
        band = y
        break

arm_out = fit(arm, 280, 840)
arm_out.save(f'{outdir}/{name}_arm.png', optimize=True)
fit(fist, 384, 266).save(f'{outdir}/{name}_fist.png', optimize=True)
k = min(280 / arm.width, 840 / arm.height)
top = 840 - round(arm.height * k)
cut = round((top + (band or arm.height * 0.7) * k) / 4)
print(f'{outdir}/{name}_arm.png', arm.size, '->', arm_out.size, 'armCut', cut)
