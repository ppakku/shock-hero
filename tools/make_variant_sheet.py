# 사용법: python3 tools/make_variant_sheet.py 원본.png public/art/결과.png [칸가로x칸세로=344x384] [발여백=20]
# 마젠타 배경의 가로 4칸 세로 2칸 8장 그림을 기존 보스 시트와 같은 규격으로 만든다.
# 1) 배경을 지운다  2) 칸마다 몸과 그 주변 조각만 남긴다 (별 표시 같은 작은 조각은 빠진다)
# 3) 8번째 칸은 4번째 칸으로 바꾼다 (별 표시)  4) 8장 모두 같은 배율로 줄여 발이 같은 높이, 몸 가운데가 칸 가운데에 오게 붙인다.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

args = [a for a in sys.argv[1:] if not a.startswith('--')]
src, dst = args[0], args[1]
cell_w, cell_h = map(int, (args[2] if len(args) > 2 else '344x384').split('x'))
foot = int(args[3]) if len(args) > 3 else 20
flip = '--flip' in sys.argv  # 왼쪽을 보게 뒤집는다
COLS, ROWS = 4, 2

im = np.asarray(Image.open(src).convert('RGB')).astype(float)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
pink = np.minimum(r, b) - g
alpha = 1 - np.clip((pink - 60) / 120, 0, 1)
fix = pink.clip(0)
rgb = np.stack([r - fix * (alpha < 1), g, b - fix * (alpha < 1)], -1).clip(0, 255)
rgba = np.dstack([rgb, alpha * 255]).astype('uint8')

H, W = alpha.shape
solid = alpha > 0.5
for i in range(COLS + 1):  # 칸 경계 근처의 곧은 선을 지운다
    near = range(max(0, i * W // COLS - W // 40), min(W, i * W // COLS + W // 40))
    for x in near:
        if solid[:, x].mean() > 0.85:
            alpha[:, max(0, x - 3):x + 4] = 0
for i in range(ROWS + 1):
    near = range(max(0, i * H // ROWS - H // 30), min(H, i * H // ROWS + H // 30))
    for y in near:
        if solid[y, :].mean() > 0.85:
            alpha[max(0, y - 3):y + 4, :] = 0
rgba[..., 3] = (alpha * 255).astype('uint8')
labels, count = ndimage.label(ndimage.binary_opening(alpha > 0.25, iterations=5))  # 칸 사이 가는 선을 끊는다
areas = ndimage.sum_labels(np.ones_like(labels), labels, range(1, count + 1))
centers = ndimage.center_of_mass(np.ones_like(labels), labels, range(1, count + 1))
frames = []
for row in range(ROWS):
    for col in range(COLS):
        inside = [i for i, (cy, cx) in enumerate(centers) if int(cx // (W / COLS)) == col and int(cy // (H / ROWS)) == row]
        if not inside:
            sys.exit(f'칸 {row},{col} 이 비었다')
        main = max(areas[i] for i in inside)
        keep = np.isin(labels, [i + 1 for i in inside if areas[i] >= main * 0.03])
        ys, xs = np.where(keep)
        a = rgba.copy()
        a[..., 3] = a[..., 3] * ndimage.binary_dilation(keep, iterations=6)
        frames.append(Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA'))

frames[7] = frames[3]  # 별 표시가 8번째 칸 몸 위에 겹치므로 비슷한 칸으로 바꾼다
k = min(min((cell_w - 8) / f.width, (cell_h - foot - 8) / f.height) for f in frames)
sheet = Image.new('RGBA', (cell_w * COLS, cell_h * ROWS), (0, 0, 0, 0))
for i, f in enumerate(frames):
    s = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
    x = (i % COLS) * cell_w + (cell_w - s.width) // 2
    y = (i // COLS) * cell_h + cell_h - foot - s.height
    sheet.alpha_composite(s.transpose(Image.FLIP_LEFT_RIGHT) if flip else s, (x, y))
sheet.save(dst)
print(dst, sheet.size, 'scale', round(k, 3))
