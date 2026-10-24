# 사용법: python3 tools/remove_checker_bg.py 원본.png public/art/결과.png  (가로 4칸, 세로 2칸 시트 기준)
# 체크무늬 배경을 칸 바깥에서부터 지워 진짜 투명으로 만든다
import sys
from collections import deque
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
COLS, ROWS = 4, 2
im = Image.open(src).convert('RGBA')
W, H = im.size
cw, ch = W // COLS, H // ROWS
FW, FH = cw // 2, ch // 2  # 절반 크기로 저장
sheet = Image.new('RGBA', (FW * COLS, FH * ROWS), (0, 0, 0, 0))

def is_bg(p):
    r, g, b, a = p
    mx, mn = max(r, g, b), min(r, g, b)
    # 회색 체크무늬(채도 낮고 밝기 중간~밝음) 또는 점선/글자(아주 어두운 무채색)
    return (mx - mn) < 22 and (mx > 105 or mx < 40)

for row in range(ROWS):
    for col in range(COLS):
        cell = im.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
        px = cell.load()
        w, h = cell.size
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
            if not is_bg(px[x, y]):
                continue
            px[x, y] = (0, 0, 0, 0)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                    q.append((nx, ny))
        # 바깥과 막힌 틈 안의 체크무늬: 회색 덩어리가 충분히 크면(체크 칸 하나 이상) 지운다
        cand = bytearray(w * h)
        for y in range(h):
            for x in range(w):
                r, g, b, al = px[x, y]
                if al and (max(r, g, b) - min(r, g, b)) < 16 and 118 <= max(r, g, b) <= 210:
                    cand[y * w + x] = 1
        done = bytearray(w * h)
        for start in range(w * h):
            if not cand[start] or done[start]:
                continue
            comp = []; dq = deque([start]); done[start] = 1
            while dq:
                i = dq.popleft(); comp.append(i)
                x, y = i % w, i // w
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if cand[j] and not done[j]:
                            done[j] = 1; dq.append(j)
            if len(comp) > 120:
                for i in comp:
                    px[i % w, i // w] = (0, 0, 0, 0)
        # 남은 작은 조각(글자, 별 로고 등) 지우기: 투명이 아닌 덩어리 중 가장 큰 것만 남긴다
        alpha = [px[x, y][3] > 0 for y in range(h) for x in range(w)]
        label = [0] * (w * h)
        sizes = {}
        lab = 0
        for start in range(w * h):
            if not alpha[start] or label[start]:
                continue
            lab += 1
            dq = deque([start]); label[start] = lab; n = 0
            while dq:
                i = dq.popleft(); n += 1
                x, y = i % w, i // w
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if alpha[j] and not label[j]:
                            label[j] = lab; dq.append(j)
            sizes[lab] = n
        big = max(sizes, key=sizes.get)
        keep = {l for l, n in sizes.items() if l == big or n > 1500}  # 불꽃처럼 떨어진 큰 조각은 남김
        for i in range(w * h):
            if alpha[i] and label[i] not in keep:
                px[i % w, i // w] = (0, 0, 0, 0)
        # 가장자리 회색 테두리 부드럽게: 투명 옆의 밝은 무채색 픽셀은 반투명
        a = cell.split()[3]
        edge = a.filter(ImageFilter.MinFilter(3))
        ep = edge.load()
        for y in range(h):
            for x in range(w):
                r, g, b, al = px[x, y]
                if al and not ep[x, y] and (max(r, g, b) - min(r, g, b)) < 30 and max(r, g, b) > 110:
                    px[x, y] = (r, g, b, 90)
        sheet.paste(cell.resize((FW, FH), Image.LANCZOS), (col * FW, row * FH))
        print('cell', row, col, 'pieces', len(sizes), 'kept', len(keep))
sheet.save(out, optimize=True)
print('saved', out, sheet.size)
