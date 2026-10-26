# 사용법: python3 -I tools/make_pose_sheets.py 원본.png 칸높이 결과=칸번호들[@가로x세로] ... [조각=칸번호#순위@높이]
# 예:    python3 -I tools/make_pose_sheets.py spitter_raw.png 128 \
#            public/art/monster_spitter.png=1,2,7,8,1,2,7,8@4x2 \
#            public/art/monster_spitter_aim.png=3 public/art/monster_spitter_spit.png=5 \
#            public/art/monster_spit.png=5#2@64
# 흰 배경에 가로 4칸 세로 2칸으로 그린 8장 그림(칸 번호는 왼쪽 위부터 1~8)에서 원하는 칸만 골라
# 걷기 시트와 한 장짜리 자세 그림을 "같은 칸 크기, 같은 발 위치"로 만든다 (그래서 바꿔 끼워도 크기가 안 튄다).
# 칸마다 배경을 지운 뒤 가장 큰 덩어리(몸)만 남긴다: 몸에서 떨어진 침, 흔들림 선, 별 표시는 사라진다.
# '칸번호#2@64' 는 그 칸에서 두 번째로 큰 덩어리(예: 날아가는 침)만 따로 잘라 높이 64로 저장한다.
# 조각이 칸 경계에 걸쳐 있으면 칸번호 대신 'box:x0,y0,x1,y1'(원본 픽셀 좌표)을 쓰고 '#1' 로 가장 큰 덩어리를 고른다.
import sys
from collections import deque
from PIL import Image

src, cell_h, specs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
COLS, ROWS = 4, 2
im = Image.open(src).convert('RGBA')
cw, ch = im.width // COLS, im.height // ROWS


def bg(p):
    r, g, b, a = p
    return max(r, g, b) - min(r, g, b) < 24 and max(r, g, b) > 150


def clear_bg(c):
    # 바깥에서부터 흰 배경을 지운다
    px = c.load()
    w, h = c.size
    seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
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
    return c


def pieces(c):
    # 투명하지 않은 픽셀 덩어리들을 큰 순서로 (덩어리마다 픽셀 목록)
    px = c.load()
    w, h = c.size
    label = [0] * (w * h)
    groups = []
    for sy in range(h):
        for sx in range(w):
            if px[sx, sy][3] == 0 or label[sy * w + sx]:
                continue
            n = len(groups) + 1
            label[sy * w + sx] = n
            q, pts = deque([(sx, sy)]), []
            while q:
                x, y = q.popleft()
                pts.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and not label[ny * w + nx]:
                        label[ny * w + nx] = n
                        q.append((nx, ny))
            groups.append(pts)
    return sorted(groups, key=len, reverse=True)


def only(c, pts):
    # 덩어리 하나만 남긴 새 그림
    out = Image.new('RGBA', c.size, (0, 0, 0, 0))
    src_px, out_px = c.load(), out.load()
    for x, y in pts:
        out_px[x, y] = src_px[x, y]
    return out


cache = {}


def cell(n):
    if n not in cache:
        if isinstance(n, tuple):  # 칸 대신 원본 좌표 상자 (칸 경계에 걸친 조각용)
            box = n
        else:
            col, row = (n - 1) % COLS, (n - 1) // COLS
            box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
        c = clear_bg(im.crop(box))
        cache[n] = (c, pieces(c))
    return cache[n]


# 1) 조각(침 등)은 따로 잘라 저장
poses = []
for spec in specs:
    out, rule = spec.split('=', 1)
    if '#' in rule:
        n, rest = rule.split('#')
        rank, h = (rest.split('@') + ['64'])[:2]
        key = tuple(int(v) for v in n[4:].split(',')) if n.startswith('box:') else int(n)
        c, groups = cell(key)
        piece = only(c, groups[int(rank) - 1])
        piece = piece.crop(piece.getbbox())
        piece = piece.resize((max(1, round(piece.width * int(h) / piece.height)), int(h)), Image.LANCZOS)
        piece.save(out, optimize=True)
        print(out, piece.size)
    else:
        nums, _, grid = rule.partition('@')
        cols, rows = map(int, grid.split('x')) if grid else (1, 1)
        poses.append((out, [int(x) for x in nums.split(',')], cols, rows))

# 2) 자세 그림: 쓰는 칸 전부의 몸 크기로 같은 칸 상자를 정하고, 가운데-아래(발)를 맞춘다
bodies = {}
for _, nums, _, _ in poses:
    for n in nums:
        if n not in bodies:
            c, groups = cell(n)
            body = only(c, groups[0])
            bodies[n] = body.crop(body.getbbox())
if bodies:
    pad = 4
    frame_w = max(b.width for b in bodies.values()) + pad * 2
    frame_h = max(b.height for b in bodies.values()) + pad
    fw = round(frame_w * cell_h / frame_h)
    for out, nums, cols, rows in poses:
        sheet = Image.new('RGBA', (fw * cols, cell_h * rows), (0, 0, 0, 0))
        for i, n in enumerate(nums):
            b = bodies[n]
            frame = Image.new('RGBA', (frame_w, frame_h), (0, 0, 0, 0))
            frame.alpha_composite(b, ((frame_w - b.width) // 2, frame_h - b.height))
            sheet.alpha_composite(frame.resize((fw, cell_h), Image.LANCZOS), ((i % cols) * fw, (i // cols) * cell_h))
        sheet.save(out, optimize=True)
        print(out, sheet.size, 'frame', (fw, cell_h))
