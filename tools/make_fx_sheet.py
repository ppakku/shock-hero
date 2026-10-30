# 사용법: python3 -I tools/make_fx_sheet.py 원본.png public/art/결과.png 칸높이 [가로칸 세로칸] [--cells=3,4,5,6]
# Gemini 에게 검은 배경으로 받은 효과 그림(불, 빛, 전기)을 게임용으로 줄인다. 더하기 합성으로 그려서 검은색은 사라진다.
# 1) 오른쪽 아래 별 표시를 지운다  2) 거의 검은 곳을 완전한 검은색으로 눌러 네모 자국이 안 보이게 한다
# 3) 칸 수를 주면 칸마다 잘라 칸 가장자리를 지우고 다시 붙인다 (기본 1칸). --cells 를 주면 그 칸만 골라 한 줄로 붙인다.
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gemini_star import remove_star

args = [a for a in sys.argv[1:] if not a.startswith('--')]
src, dst = args[0], args[1]
cell_h = int(args[2])
cols = int(args[3]) if len(args) > 3 else 1
rows = int(args[4]) if len(args) > 4 else 1
pick = next((a[8:] for a in sys.argv if a.startswith('--cells=')), None)
cells = [int(c) for c in pick.split(',')] if pick else list(range(cols * rows))

im = Image.open(src).convert('RGB')
print('star', remove_star(im))
W, H = im.size
cw, ch = W // cols, H // rows
cell_w = round(cw * cell_h / ch)
out_cols = len(cells) if pick else cols
out_rows = 1 if pick else rows
sheet = Image.new('RGB', (cell_w * out_cols, cell_h * out_rows))
edge = 2 if cols * rows > 1 else 0
for i, n in enumerate(cells):
    x, y = n % cols * cw, n // cols * ch
    c = im.crop((x, y, x + cw, y + ch)).resize((cell_w, cell_h), Image.LANCZOS)
    if edge:
        blank = Image.new('RGB', (cell_w, cell_h))
        blank.paste(c.crop((edge, edge, cell_w - edge, cell_h - edge)), (edge, edge))
        c = blank
    sheet.paste(c, (i % out_cols * cell_w, i // out_cols * cell_h))
a = np.asarray(sheet).astype(float)
a = ((a - 14).clip(0) * (255 / 241)).clip(0, 255)
Image.fromarray(a.astype('uint8'), 'RGB').save(dst, optimize=True)
print(dst, sheet.size, 'cell', (cell_w, cell_h))
