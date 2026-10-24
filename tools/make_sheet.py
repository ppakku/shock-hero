# 사용법: python3 tools/make_sheet.py 원본.png public/art/결과.png [칸높이=128] [--flip]
# 흰 배경(또는 체크무늬)에 가로 4칸 세로 2칸으로 그린 8장 동작 그림을 게임용 스프라이트 시트로 만든다.
# 1) 칸마다 바깥에서부터 배경을 지운다  2) 8장 전체를 감싸는 같은 상자로 잘라 칸 크기와 기준 위치를 맞춘다
#    (발이 칸 맨 아래에 닿게)  3) 칸 높이를 맞춰 다시 4x2 로 붙인다. --flip 은 좌우를 뒤집는다(왼쪽을 보는 그림일 때).
import sys
from collections import deque
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
src, out = args[0], args[1]
cell_h = int(args[2]) if len(args) > 2 else 128
flip = '--flip' in sys.argv
COLS, ROWS = 4, 2
im = Image.open(src).convert('RGBA')
W, H = im.size
cw, ch = W // COLS, H // ROWS


def bg(p):
    r, g, b, a = p
    return max(r, g, b) - min(r, g, b) < 24 and max(r, g, b) > 150


cells = []
for row in range(ROWS):
    for col in range(COLS):
        c = im.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
        px = c.load()
        w, h = c.size
        seen = bytearray(w * h)
        q = deque()
        for x in range(w):
            q.append((x, 0)); q.append((x, h - 1))
        for y in range(h):
            q.append((0, y)); q.append((w - 1, y))
        while q:
            x, y = q.popleft()
            i = y * w + x
            if seen[i]:
                continue
            seen[i] = 1
            if not bg(px[x, y]):
                continue
            px[x, y] = (0, 0, 0, 0)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                    q.append((nx, ny))
        # 외곽선 바깥 밝은 테두리 한 겹
        edge = [(x, y) for y in range(1, h - 1) for x in range(1, w - 1)
                if px[x, y][3] and bg(px[x, y]) and any(px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in edge:
            px[x, y] = (0, 0, 0, 0)
        cells.append(c)

# 칸마다 그림의 가로 가운데와 발(아래) 위치를 맞춘다: 각 칸 그림 상자를 구해 같은 크기 상자에 가운데-아래로 놓는다
boxes = [c.getbbox() for c in cells]
bw = max(b[2] - b[0] for b in boxes)
bh = max(b[3] - b[1] for b in boxes)
pad = 4
frame_w, frame_h = bw + pad * 2, bh + pad
scale = cell_h / frame_h
fw = round(frame_w * scale)
sheet = Image.new('RGBA', (fw * COLS, cell_h * ROWS), (0, 0, 0, 0))
for i, (c, b) in enumerate(zip(cells, boxes)):
    piece = c.crop(b)
    if flip:
        piece = piece.transpose(Image.FLIP_LEFT_RIGHT)
    frame = Image.new('RGBA', (frame_w, frame_h), (0, 0, 0, 0))
    frame.alpha_composite(piece, ((frame_w - piece.width) // 2, frame_h - piece.height))
    frame = frame.resize((fw, cell_h), Image.LANCZOS)
    sheet.alpha_composite(frame, ((i % COLS) * fw, (i // COLS) * cell_h))
sheet.save(out, optimize=True)
print(out, sheet.size, 'frame', (fw, cell_h))
