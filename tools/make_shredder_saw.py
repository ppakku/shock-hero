# 사용법: python3 tools/make_shredder_saw.py 시트.png 톱날.png 덮개.png public/art
# Gemini 로 그린 파쇄자 그림 세 장을 게임용으로 만들고, 시트 칸마다 배 구멍의 자리를 잰다.
#   shredder_body.png  : 4칸 2줄 몸통 시트 (원래 shredder.png 와 같은 1376x768). 스테이지 1 전용
#   shredder_saw.png   : 돌아가는 톱날 (512x512)
#   shredder_guard.png : 구멍을 막는 쇠창살 (512x512)
# 잰 값은 칸 크기에 대한 비율로 출력한다. src/logic/shredder.js 의 SHREDDER_HOLES 에 그대로 옮겨 적는다.
import subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label
sheet_src, saw_src, guard_src, outdir = sys.argv[1:5]
def hole_of(cell):
    # 구멍 가장자리는 굵은 검은 테두리다. 둘레가 가장 검은 타원을 찾는다 (고리 바깥쪽 선보다 작은 크기만 본다).
    rgba = np.asarray(cell).astype(float)
    ink = (rgba[..., :3].mean(-1) < 40) & (rgba[..., 3] > 200)
    h, w = ink.shape
    t = np.linspace(0, 2 * np.pi, 72, endpoint=False)
    best = (0, 0, 0, 0, 0)
    for rx in range(26, 46):
        for ry in range(30, 52):
            ex, ey = (rx * np.cos(t)).astype(int), (ry * np.sin(t)).astype(int)
            for cy in range(int(h * 0.25), int(h * 0.6), 2):
                ys = cy + ey
                for cx in range(int(w * 0.4), int(w * 0.85), 2):
                    score = ink[ys, cx + ex].mean()
                    if score > best[0]:
                        best = (score, cx, cy, rx, ry)
    return best[1:]


def clean_sheet(sheet):
    # 별 표시와 잔티 지우기: 작고 색이 옅은(불꽃이 아닌) 조각만 뺀다. 별은 8번째 칸 발에 붙어 있어 자리로 지운다
    rgba = np.asarray(sheet).copy()
    rgba[670:, 1308:, 3] = 0
    labels, n = label(rgba[..., 3] > 16, structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        mask = labels == i
        c = rgba[..., :3][mask].astype(float)
        fiery = (c[:, 0] - c[:, 2]).mean() > 70
        if mask.sum() < 2500 and not fiery:
            rgba[..., 3][mask] = 0
    return Image.fromarray(rgba, 'RGBA')


COLS, ROWS, W, H = 4, 2, 1376, 768
key = 'tools/key_magenta.py'
tmp = tempfile.mkdtemp()
subprocess.run(['python3', key, sheet_src, f'{tmp}/sheet.png', '--no-trim'], check=True, stdout=subprocess.DEVNULL)
sheet = clean_sheet(Image.open(f'{tmp}/sheet.png').convert('RGBA').resize((W, H), Image.LANCZOS))
sheet.save(f'{outdir}/shredder_body.png', optimize=True)

for src, name in ((saw_src, 'shredder_saw'), (guard_src, 'shredder_guard')):
    subprocess.run(['python3', key, src, f'{tmp}/{name}.png', '--main'], check=True, stdout=subprocess.DEVNULL)
    im = Image.open(f'{tmp}/{name}.png').convert('RGBA')
    im = im.crop(im.getbbox())
    side = max(im.size)  # 네모 칸 가운데에 놓아야 돌릴 때 흔들리지 않는다
    box = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    box.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    box.resize((512, 512), Image.LANCZOS).save(f'{outdir}/{name}.png', optimize=True)


fw, fh = W // COLS, H // ROWS
check = Image.new('RGBA', (W, H), (60, 110, 160, 255))
check.alpha_composite(sheet)
marks = ImageDraw.Draw(check)
print('hole: x, y, rx, ry (fractions of the cell)')
for i in range(COLS * ROWS):
    c, r = i % COLS, i // COLS
    cell = sheet.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
    x, y, rx, ry = hole_of(cell)
    print(f'  [{x / fw:.3f}, {y / fh:.3f}, {rx / fw:.3f}, {ry / fh:.3f}], // {i}')
    if len(sys.argv) > 5:  # 확인용: 잰 타원을 그려 본다
        marks.ellipse((c * fw + x - rx, r * fh + y - ry, c * fw + x + rx, r * fh + y + ry), outline=(0, 255, 0, 255), width=2)
if len(sys.argv) > 5:
    check.save(sys.argv[5])
