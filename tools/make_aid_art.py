# 공포 모드 도움 아이템 그림. Gemini 원본(~/workspace/shock-hero-art/aids/)을 게임용 파일로 만든다. 원본은 레포에 넣지 않는다.
# 사용법: python3 tools/make_aid_art.py 원본폴더 [미리보기폴더]
# 1) 모든 원본의 오른쪽 아래 별 표시(가장자리에서 64~160 픽셀)를 배경색으로 덮는다
# 2) 마젠타 배경을 알파로 빼고, 가장자리 색에서 배경을 덜어 분홍 테가 남지 않게 한다
# 3) items_<맵>.png: 왼쪽부터 조명탄, 나침반, 장난감, 분필. 세로줄마다 그림이 있는지 보고 빈 틈으로 나눈다
#    (줄, 끈, 리본이 떨어진 덩어리여도 틈이 넓은 곳 셋에서만 자른다) -> public/art/aid_<맵>_<종류>.webp
# 4) board_<맵>.png: 지도판 테두리 -> public/art/aid_board_<맵>.webp, 지도를 그릴 빈 안쪽 네모를 잰다
# 5) forest_box.png, forest_panel.png: 숲의 충전 상자와 전원 -> public/art/horror_forest_box.webp, horror_forest_panel.webp
# 6) 그림의 가로세로 비율과 안쪽 네모를 src/horror/aidArtSizes.js 에 적는다 (게임과 시험이 읽는다)
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAW = os.path.expanduser(sys.argv[1])
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
OUT = 'public/art'
SIZES = 'src/horror/aidArtSizes.js'
MAPS = ['factory', 'sewer', 'school', 'station', 'pool', 'forest']
KINDS = ['flare', 'compass', 'toy', 'chalk']
STAR = (64, 160)
ITEM_H = 256  # 아이템 그림 높이 (긴 쪽이 이만큼)
BOARD_W = 1024


def load(name):
    im = Image.open(f'{RAW}/{name}.png').convert('RGB')
    W, H = im.size
    a, b = STAR
    bg = tuple(int(v) for v in np.median(np.asarray(im)[:40, :40].reshape(-1, 3), 0))
    ImageDraw.Draw(im).rectangle((W - b - 16, H - b - 16, W - a + 16, H - a + 16), fill=bg)
    return im, np.array(bg, float)


# 마젠타 배경을 뺀 RGBA (원본 크기)
def keyed(name):
    im, bg = load(name)
    a = np.asarray(im).astype(float)
    pink_of = lambda c: np.minimum(c[..., 0], c[..., 2]) - c[..., 1]  # noqa: E731
    pink = pink_of(a)
    bg_pink = pink_of(bg)
    lo, hi = 40, bg_pink - 40
    alpha = 1 - np.clip((pink - lo) / (hi - lo), 0, 1)
    # 섞인 가장자리: 보인 색 = 알파 x 그림 + (1 - 알파) x 배경 이므로 배경 몫을 덜어 낸다
    al = np.maximum(alpha, 0.05)[..., None]
    rgb = ((a - (1 - al) * bg) / al).clip(0, 255)
    rgb = np.where(alpha[..., None] >= 0.999, a, rgb)
    # 덜어 내고도 남은 분홍기는 빨강과 파랑을 초록 쪽으로 누른다
    left = np.clip(pink_of(rgb), 0, None) * (alpha < 0.999)
    rgb[..., 0] -= left
    rgb[..., 2] -= left
    alpha = np.asarray(Image.fromarray((alpha * 255).astype('uint8')).filter(ImageFilter.MinFilter(3))).astype(float)  # 한 픽셀 깎아 테를 없앤다
    return np.dstack([rgb.clip(0, 255), alpha]).astype('uint8')


# 투명한 곳의 색을 가까운 그림 색으로 채운다 (알파는 그대로). 줄인 그림에서 테가 생기지 않는다
def bleed(im):
    a = np.asarray(im).astype(float)
    rgb, al = a[..., :3], a[..., 3:] / 255
    fill = rgb * (al > 0.5)
    w = (al > 0.5).astype(float)
    for radius in (2, 6, 16, 40):
        bl = lambda x: np.asarray(Image.fromarray(x.astype('uint8')).filter(ImageFilter.GaussianBlur(radius))).astype(float)  # noqa: E731
        num = np.dstack([bl(fill[..., i]) for i in range(3)])
        den = bl(w[..., 0] * 255)[..., None] / 255
        est = num / np.maximum(den, 1e-3)
        hole = w < 0.5
        rgb = np.where(hole & (den > 0.02), est, rgb)
        w = np.maximum(w, (den > 0.02).astype(float))
        fill = rgb * w
    return Image.fromarray(np.dstack([rgb.clip(0, 255), a[..., 3:]]).astype('uint8'), 'RGBA')


# 그림이 있는 곳만 남긴다. 별 자국 같은 작은 티끌 (800 픽셀 아래)은 지운다
def trim(rgba):
    from scipy import ndimage
    rgba = rgba.copy()
    labels, n = ndimage.label(rgba[..., 3] > 16)
    areas = ndimage.sum(np.ones(labels.shape), labels, range(1, n + 1))
    keep = np.isin(labels, [i + 1 for i, v in enumerate(areas) if v >= 800])
    rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
    im = Image.fromarray(rgba, 'RGBA')
    return im.crop(Image.fromarray(keep.astype('uint8') * 255).getbbox())


def fit(im, long_side):
    s = long_side / max(im.size)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def save_webp(im, name, quality=88):
    path = f'{OUT}/{name}.webp'
    im.save(path, quality=quality, alpha_quality=100, method=6)
    print('wrote', path, im.size, os.path.getsize(path) // 1024, 'KB')
    return im


# 네 아이템을 덩어리(이어진 그림)로 나눈다. 작은 덩어리(끈, 사슬, 리본 조각)는 가장 가까운 큰 덩어리에 붙이고,
# 큰 덩어리가 넷 넘으면 가로로 가장 많이 겹치거나 가까운 이웃끼리 붙인다. 왼쪽부터 순서대로 넷
def split_four(rgba):
    from scipy import ndimage
    solid = rgba[..., 3] > 96
    labels, n = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    boxes = ndimage.find_objects(labels)
    areas = ndimage.sum(solid, labels, range(1, n + 1))
    comps = [{'ids': [i + 1], 'x0': b[1].start, 'x1': b[1].stop, 'y0': b[0].start, 'y1': b[0].stop, 'area': areas[i]} for i, b in enumerate(boxes)]
    comps = [c for c in comps if c['area'] > 200]
    big_area = max(c['area'] for c in comps)
    big = [c for c in comps if c['area'] > big_area * 0.08]
    small = [c for c in comps if c['area'] <= big_area * 0.08]

    def join(a, b):
        a['ids'] += b['ids']
        for k, f in (('x0', min), ('y0', min), ('x1', max), ('y1', max)):
            a[k] = f(a[k], b[k])
        a['area'] += b['area']

    def gap(a, b):
        dx = max(0, max(a['x0'], b['x0']) - min(a['x1'], b['x1']))
        dy = max(0, max(a['y0'], b['y0']) - min(a['y1'], b['y1']))
        return dx * dx + dy * dy
    for s in small:
        join(min(big, key=lambda b: gap(b, s)), s)
    big.sort(key=lambda c: (c['x0'] + c['x1']) / 2)
    while len(big) > 4:
        gaps = [big[i + 1]['x0'] - big[i]['x1'] for i in range(len(big) - 1)]
        i = int(np.argmin(gaps))
        join(big[i], big[i + 1])
        del big[i + 1]
    if len(big) != 4:
        raise SystemExit(f'아이템이 넷으로 나뉘지 않는다: {[(c["x0"], c["x1"]) for c in big]}')
    out = []
    for c in big:
        part = rgba.copy()
        part[..., 3] = np.where(np.isin(labels, c['ids']), part[..., 3], 0)
        out.append(trim(part))
    return out


# 빈 안쪽 네모: 가운데 색에서 바깥으로 나가다 색이 크게 바뀌는 곳 (테두리)에서 멈춘다. 0~1 비율
def inner_rect(im):
    a = np.asarray(im.convert('RGB')).astype(float)
    H, W = a.shape[:2]
    blur = np.asarray(im.convert('RGB').filter(ImageFilter.GaussianBlur(4))).astype(float)
    cy, cx = H // 2, W // 2
    ref = np.median(a[cy - H // 8:cy + H // 8, cx - W // 8:cx + W // 8].reshape(-1, 3), 0)
    band = lambda line: np.median(line, 0)  # noqa: E731

    def walk(axis_len, get, step):
        pos = (axis_len // 2)
        while 0 < pos < axis_len - 1:
            c = band(get(pos))
            if np.abs(c - ref).max() > 48:
                return pos
            pos += step
        return pos

    # 가운데를 지나는 넓은 띠의 중앙값으로 걷는다 (긁힘, 얼룩에 멈추지 않게)
    h_band = lambda x: blur[cy - H // 6:cy + H // 6, x]  # noqa: E731
    v_band = lambda y: blur[y, cx - W // 6:cx + W // 6]  # noqa: E731
    x0 = walk(W, h_band, -1)
    x1 = walk(W, h_band, 1)
    y0 = walk(H, v_band, -1)
    y1 = walk(H, v_band, 1)
    pad = 0.015
    return [round(x0 / W + pad, 4), round(y0 / H + pad, 4), round(x1 / W - pad, 4), round(y1 / H - pad, 4)]


# 수영장처럼 안쪽에 타일 줄눈이 있으면 잰 값이 줄눈에서 멈추므로 원본을 보고 정한 값을 쓴다 (0~1, 잘라 낸 그림 기준)
INNER_FIX = {'pool': [0.115, 0.165, 0.895, 0.84]}


def main():
    sizes = {'items': {}, 'boards': {}, 'forest': {}}
    previews = []
    for m in MAPS:
        parts = split_four(keyed(f'items_{m}'))
        sizes['items'][m] = {}
        for kind, part in zip(KINDS, parts):
            im = save_webp(bleed(fit(part, ITEM_H)), f'aid_{m}_{kind}')
            sizes['items'][m][kind] = round(im.width / im.height, 3)
            previews.append(im)
        board = fit(trim(keyed(f'board_{m}')), BOARD_W)
        board = save_webp(bleed(board), f'aid_board_{m}', 86)
        rect = INNER_FIX.get(m) or inner_rect(board)
        sizes['boards'][m] = {'aspect': round(board.width / board.height, 3), 'inner': rect}
        if PREVIEW:
            pv = board.copy()
            d = ImageDraw.Draw(pv)
            d.rectangle((rect[0] * pv.width, rect[1] * pv.height, rect[2] * pv.width, rect[3] * pv.height), outline=(0, 255, 0, 255), width=4)
            bgd = Image.new('RGBA', pv.size, (40, 40, 40, 255))
            Image.alpha_composite(bgd, pv).convert('RGB').save(f'{PREVIEW}/board_{m}.png')
    for name in ('box', 'panel'):
        im = save_webp(bleed(fit(trim(keyed(f'forest_{name}')), 512)), f'horror_forest_{name}')
        sizes['forest'][name] = round(im.width / im.height, 3)
        previews.append(im)
    if PREVIEW:
        cell = 160
        sheet = Image.new('RGBA', (cell * 4, cell * ((len(previews) + 3) // 4)), (60, 60, 60, 255))
        for i, im in enumerate(previews):
            t = fit(im, cell - 8)
            sheet.alpha_composite(t, ((i % 4) * cell + 4, (i // 4) * cell + 4))
        sheet.convert('RGB').save(f'{PREVIEW}/items_sheet.png')
    body = json.dumps(sizes, indent=2, ensure_ascii=False)
    with open(SIZES, 'w') as f:
        f.write('// tools/make_aid_art.py 가 만든다. 손으로 고치지 않는다.\n')
        f.write('// items: 아이템 그림의 가로/세로, boards: 지도판 그림의 가로/세로와 지도를 그릴 빈 안쪽 네모 [왼, 위, 오른, 아래] (0~1),\n')
        f.write('// forest: 숲의 충전 상자와 전원 그림의 가로/세로\n')
        f.write(f'export const AID_ART = {body};\n')
    print('wrote', SIZES)


if __name__ == '__main__':
    main()
