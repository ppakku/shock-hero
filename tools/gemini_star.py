# Gemini 그림 오른쪽 아래의 반투명 별 표시를 찾아 지운다 (다른 도구가 불러 씀).
# 주변보다 밝은 무채색 덩어리 중 별처럼 네모 상자에 가깝고 속이 절반쯤 찬 것만 고른 뒤,
# 그 픽셀만 바깥 둘레 색을 안쪽으로 퍼뜨려 메운다 (거미줄처럼 밝은 무늬는 건드리지 않음).
from collections import deque
from PIL import Image, ImageFilter


def remove_star(im):
    W, H = im.size
    x0, y0 = W * 3 // 4, H * 3 // 5
    region = im.crop((x0, y0, W, H)).convert('RGB')
    w, h = region.size
    lum = region.convert('L')
    base = lum.filter(ImageFilter.BoxBlur(max(6, w // 18)))
    rp, lp, bp = region.load(), lum.load(), base.load()
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b = rp[x, y]
            if lp[x, y] - bp[x, y] > 14 and max(r, g, b) - min(r, g, b) < 34:
                mask[y * w + x] = 1
    best = None
    seen = bytearray(w * h)
    for s in range(w * h):
        if not mask[s] or seen[s]:
            continue
        comp = []
        q = deque([s]); seen[s] = 1
        while q:
            i = q.popleft(); comp.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and mask[j] and not seen[j]:
                    seen[j] = 1; q.append(j)
        xs = [i % w for i in comp]; ys = [i // w for i in comp]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        fill = len(comp) / (bw * bh)
        size_ok = W * 0.012 < bw < W * 0.08
        if size_ok and 0.75 < bw / bh < 1.33 and 0.3 < fill < 0.75:
            if best is None or len(comp) > len(best):
                best = comp
    if not best:
        return None
    # 별과 테두리 2픽셀을 메울 자리로
    hole = set()
    for i in best:
        x, y = i % w, i // w
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if 0 <= x + dx < w and 0 <= y + dy < h:
                    hole.add((x + dx + x0, y + dy + y0))
    px = im.load()
    alpha = len(px[0, 0]) == 4 if isinstance(px[0, 0], tuple) else False
    todo = set(hole)
    while todo:
        nxt = set()
        filled = []
        for (x, y) in todo:
            ns = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                  if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in todo]
            if ns:
                filled.append(((x, y), tuple(sum(c[k] for c in ns) // len(ns) for k in range(len(ns[0])))))
            else:
                nxt.add((x, y))
        if not filled:
            break
        for p, c in filled:
            px[p] = c
        todo = nxt
    xs = [p[0] for p in hole]; ys = [p[1] for p in hole]
    return (min(xs), min(ys), max(xs), max(ys))
