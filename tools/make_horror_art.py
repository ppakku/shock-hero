# 공장 재질을 게임용으로 줄인다. 벽과 바닥 원본은 Gemini 그림이고, 사물함 문은 벽 그림의 철판으로 만든다.
# 사용법: python3 tools/make_horror_art.py 원본폴더 public/art
import sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

src, dst = sys.argv[1], sys.argv[2]


def erase_star(im):
    # 오른쪽 아래 별 표시를 바로 왼쪽 그림으로 덮는다
    w, h = im.size
    s = int(w * 0.1)
    x0, y0 = w - s - int(w * 0.02), h - s - int(h * 0.02)
    patch = im.crop((x0 - s, y0, x0, y0 + s))
    mask = Image.new('L', (s, s), 0)
    mask.paste(255, (s // 8, s // 8, s - s // 8, s - s // 8))
    im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(s // 12)))


wall = Image.open(f'{src}/wall.png').convert('RGB')
erase_star(wall)
wall.resize((512, 512), Image.LANCZOS).save(f'{dst}/horror_wall.jpg', quality=82)

floor = Image.open(f'{src}/floor.png').convert('RGB')
erase_star(floor)
floor.resize((512, 512), Image.LANCZOS).save(f'{dst}/horror_floor.jpg', quality=82)

# 사물함 문: 철판 한 장에 회녹색을 입히고 잉크로 틀과 환기 틈 세 줄을 그린다
w = wall.width
plate = wall.crop((int(w * 0.03), int(w * 0.03), int(w * 0.47), int(w * 0.47))).resize((512, 512), Image.LANCZOS)
grey = ImageOps.grayscale(ImageEnhance.Contrast(plate).enhance(1.2))
door = ImageOps.colorize(grey, black='#0c0f0d', white='#9fb0a4')
ink = ImageDraw.Draw(door)
ink.rectangle((14, 14, 498, 498), outline='#050605', width=12)
ink.rectangle((40, 40, 472, 472), outline='#101311', width=4)
for y in (92, 132, 172):
    ink.rounded_rectangle((130, y, 382, y + 20), radius=8, fill='#020302', outline='#b9c6bc', width=2)
ink.rounded_rectangle((420, 240, 450, 320), radius=6, fill='#23271f', outline='#050605', width=4)
door.save(f'{dst}/horror_locker.jpg', quality=82)
