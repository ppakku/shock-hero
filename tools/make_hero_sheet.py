# 사용법: python3 tools/make_hero_sheet.py 원본폴더 주인공 결과.webp [미리보기.jpg]
# Gemini 로 받은 주인공 시트 세 장(주인공_a.png, _b.png, _c.png: 마젠타 배경, 가로 4칸 세로 2칸, 8장)을
# 게임이 읽는 한 장으로 합친다. 칸마다 같은 크기, 같은 발 위치, 같은 몸 위치로 맞춘다.
# 칸 순서는 src/fx/heroTextures.js 의 HERO_ART_POSES 와 같다.
import sys
from collections import deque
import numpy as np
from PIL import Image

CELL_W, CELL_H, FEET = 360, 312, 300  # heroTextures.js 의 ART_FRAME x 3
HERO_H = 198  # 서 있는 키
COLS, ROWS = 5, 4
POSES = [('a', 1), ('c', 1), ('c', 2), ('b', 1), ('b', 2), ('b', 4), ('b', 5), ('b', 6), ('b', 8), ('a', 2), ('a', 3), ('a', 4), ('a', 5), ('a', 6), ('a', 7), ('a', 8), ('c', 3), ('c', 3), ('c', 7), ('c', 4)]
SPIN_LAST = {'shock': ('c', 8), 'gunner': ('c', 8), 'ninja': ('c', 8), 'mage': ('c', 8), 'giant': ('c', 7)}


def key_magenta(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pink = np.minimum(r, b) - g
    alpha = 1 - np.clip((pink - 60) / 120, 0, 1)
    fix = pink.clip(0, 255)
    rgb = np.stack([r - fix * (alpha < 1), g, b - fix * (alpha < 1)], -1).clip(0, 255)
    alpha[pink > 30] = 0  # 마젠타가 비치는 흐린 잔상
    h, w = pink.shape
    corner = np.zeros_like(alpha, bool)
    corner[int(h * 0.9):int(h * 0.975), int(w * 0.925):int(w * 0.985)] = True
    alpha[corner & (a.min(2) > 110)] = 0  # 오른쪽 아래 별 표시
    return np.dstack([rgb, alpha * 255]).astype('uint8')


# 덩어리(주인공 하나씩)를 찾는다. 작은 조각(잔상, 별 표시)은 버린다
def blobs(rgba):
    step = 4
    mask = rgba[::step, ::step, 3] > 128
    h, w = mask.shape
    seen = np.zeros_like(mask)
    found = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            q = deque([(y0, x0)])
            seen[y0, x0] = True
            cells = []
            while q:
                y, x = q.popleft()
                cells.append((y, x))
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            found.append(np.array(cells) * step)
    biggest = max(len(c) for c in found)
    return [c for c in found if len(c) > biggest * 0.25]


def figures(path):
    rgba = key_magenta(path)
    keep = blobs(rgba)
    if len(keep) != 8:
        sys.exit(f'{path}: 주인공이 {len(keep)}명 보인다 (8명이어야 함)')
    midY = rgba.shape[0] / 2
    def rank(c):
        return (c[:, 0].mean() > midY, c[:, 1].mean())
    keep.sort(key=rank)
    out = []
    for c in keep:
        y0, x0 = c.min(0)
        y1, x1 = c.max(0) + 4
        mask = np.zeros(rgba.shape[:2], bool)
        for y, x in c:
            mask[max(0, y - 6):y + 10, max(0, x - 6):x + 10] = True
        cut = rgba[y0:y1, x0:x1].copy()
        cut[..., 3] = cut[..., 3] * mask[y0:y1, x0:x1]
        out.append(Image.fromarray(cut, 'RGBA'))
    return out


def place(fig, scale):
    w, h = round(fig.width * scale), round(fig.height * scale)
    small = fig.resize((w, h), Image.LANCZOS)
    a = np.asarray(small)[..., 3].astype(float)
    top = a[: max(1, int(h * 0.55))]  # 팔다리와 들고 있는 물건에 흔들리지 않게 윗몸으로 가운데를 잡는다
    cx = (top.sum(0) * np.arange(w)).sum() / max(1, top.sum())
    cell = Image.new('RGBA', (CELL_W, CELL_H))
    cell.alpha_composite(small.crop((max(0, round(cx - CELL_W / 2)), max(0, h - FEET), w, h)), (max(0, round(CELL_W / 2 - cx)), max(0, FEET - h)))
    return cell


# 숨 쉬기: 같은 그림을 발 기준으로 살짝 눌러서 자세가 튀지 않게 한다
def breathe(cell, squash):
    h = round(CELL_H * squash)
    small = cell.resize((CELL_W, h), Image.LANCZOS)
    out = Image.new('RGBA', (CELL_W, CELL_H))
    out.alpha_composite(small, (0, FEET - round(FEET * squash)))
    return out


def main():
    src, hero, out = sys.argv[1], sys.argv[2], sys.argv[3]
    sheets = {k: figures(f'{src}/{hero}_{k}.png') for k in 'abc'}
    idle = {'a': sheets['a'][0].height, 'b': np.median([f.height for f in sheets['b']]), 'c': np.median([f.height for f in sheets['c'][:2]])}
    sheet = Image.new('RGBA', (CELL_W * COLS, CELL_H * ROWS))
    poses = list(POSES)
    poses[17] = ('c', 3) if hero == 'giant' else ('a', 6)  # smash 는 강철 거인만 쓴다
    poses[18] = SPIN_LAST[hero]
    for i, (k, n) in enumerate(poses):
        cell = place(sheets[k][n - 1], HERO_H / idle[k])
        if i == 0:
            stand = cell
        elif i in (1, 2):
            cell = breathe(stand, 0.985 if i == 1 else 0.97)
        sheet.paste(cell, ((i % COLS) * CELL_W, (i // COLS) * CELL_H))
    sheet.save(out, quality=88, method=6)
    if len(sys.argv) > 4:
        bg = Image.new('RGB', sheet.size, (70, 80, 100))
        bg.paste(sheet, (0, 0), sheet)
        bg.resize((sheet.width // 2, sheet.height // 2)).save(sys.argv[4], quality=85)


if __name__ == '__main__':
    main()
