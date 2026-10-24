# 사용법: python3 tools/clean_gemini_bg.py 원본.png public/art/결과.jpg [높이=720]
# Gemini 배경 그림의 오른쪽 아래 별 표시를 찾아 주변 색으로 메워 지우고, 높이를 맞춰 JPG 로 저장한다.
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gemini_star import remove_star  # noqa: E402

src, out = sys.argv[1], sys.argv[2]
height = int(sys.argv[3]) if len(sys.argv) > 3 else 720
im = Image.open(src).convert('RGB')
W, H = im.size

box = remove_star(im)
print('별 지움', box) if box else print('별 없음')

im = im.resize((round(W * height / H), height), Image.LANCZOS)
im.save(out, quality=88, optimize=True)
print(out, im.size)
