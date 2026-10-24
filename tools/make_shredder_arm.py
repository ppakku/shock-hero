# 사용법: python3 tools/make_shredder_arm.py 원본.png public/art
# 파쇄자 쇠팔(왼쪽)과 주먹(오른쪽)이 나란히 있는 그림 한 장에서 게임용 그림 두 장을 만든다.
#   shredder_arm.png  : 팔뚝 아래에 아래를 향한 주먹을 붙인 팔 (70x210 비율, 아래 80/210 이 주먹, art.js 의 armCut: 130)
#   shredder_fist.png : 로켓 펀치로 날아가는 주먹 (왼쪽을 향함, 여백 없음, 게임에서 96x66)
# 그려 넣어진 체크무늬 배경은 바깥에서부터, 막힌 틈 안은 회색 두 톤이 섞인 덩어리만 지운다.
import sys
from collections import deque
from PIL import Image

src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
W, H = im.size
px = im.load()


def gray(p):
    r, g, b, a = p
    return a and max(r, g, b) - min(r, g, b) < 14


def outside_bg(p):
    # 체크무늬 두 톤과 오른쪽 아래 밝은 별 표시
    return gray(p) and max(p[:3]) >= 98


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
    if not outside_bg(px[x, y]):
        continue
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
            q.append((nx, ny))

# 팔과 파이프 사이처럼 막힌 틈의 체크무늬: 어두운 칸과 밝은 칸이 둘 다 충분히 든 회색 덩어리
done = bytearray(W * H)
for start in range(W * H):
    sx, sy = start % W, start // W
    p = px[sx, sy]
    if done[start] or not gray(p) or not (98 <= max(p[:3]) <= 160):
        continue
    comp = []
    dq = deque([start]); done[start] = 1
    while dq:
        i = dq.popleft(); comp.append(i)
        x, y = i % W, i // W
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H:
                j = ny * W + nx
                pp = px[nx, ny]
                if not done[j] and gray(pp) and 98 <= max(pp[:3]) <= 160:
                    done[j] = 1; dq.append(j)
    if len(comp) < 600:
        continue
    dark = sum(1 for i in comp if max(px[i % W, i // W][:3]) < 126)
    light = len(comp) - dark
    if dark > len(comp) * 0.2 and light > len(comp) * 0.2:
        for i in comp:
            px[i % W, i // W] = (0, 0, 0, 0)

# 외곽선 바깥에 남은 회색 테두리 한 겹을 걷어 낸다
edge = []
for y in range(1, H - 1):
    for x in range(1, W - 1):
        p = px[x, y]
        if gray(p) and max(p[:3]) >= 90 and any(px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            edge.append((x, y))
for x, y in edge:
    px[x, y] = (0, 0, 0, 0)


def piece(x0, x1):
    return im.crop((x0, 0, x1, H)).crop(im.crop((x0, 0, x1, H)).getbbox())


forearm = piece(0, W * 9 // 20)
fist = piece(W * 9 // 20, W)

# 주먹 축(손목 왼쪽 위 -> 손가락 오른쪽 아래)은 약 50도 아래를 향한다
down = fist.rotate(-40, resample=Image.BICUBIC, expand=True)
down = down.crop(down.getbbox())
left = fist.transpose(Image.FLIP_LEFT_RIGHT).rotate(-50, resample=Image.BICUBIC, expand=True)
left = left.crop(left.getbbox())

# 팔: 210 높이 기준 4배(280x840). 위 130 칸에 팔뚝, 아래 80 칸에 주먹
# (로켓 펀치를 쏘면 게임이 130 아래를 잘라 내고 주먹만 날린다)
S = 4
AW, AH, CUT = 70 * S, 210 * S, 130 * S
arm = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
fh = AH - CUT
fw = round(down.width * fh / down.height)
if fw > AW:
    fw, fh = AW, round(down.height * AW / down.width)
fa_h = CUT + 6 * S  # 팔뚝 끝이 주먹 뒤로 살짝 들어가게
fa_w = round(forearm.width * fa_h / forearm.height)
arm.alpha_composite(forearm.resize((fa_w, fa_h), Image.LANCZOS), ((AW - fa_w) // 2, 0))
arm.alpha_composite(down.resize((fw, fh), Image.LANCZOS), ((AW - fw) // 2, AH - fh))
arm.save(f'{outdir}/shredder_arm.png', optimize=True)

# 주먹은 여백 없이 가로 96 기준 4배로 (게임에서 96x66 으로 그림)
FW = 96 * S
FH = round(left.height * FW / left.width)
fist_img = left.resize((FW, FH), Image.LANCZOS)
lw, lh = FW, FH
fist_img.save(f'{outdir}/shredder_fist.png', optimize=True)
print('arm', arm.size, 'forearm', (fa_w, fa_h), 'fist', (fw, fh), '| fist', fist_img.size, (lw, lh))
