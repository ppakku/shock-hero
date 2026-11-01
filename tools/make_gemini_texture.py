# Gemini 가 그린 재질 한 장을 게임용 512 jpg 로 줄인다. 오른쪽 아래 별 표시를 지우고 밝기를 맞춘다.
# 사용법: python3 tools/make_gemini_texture.py 원본.png public/art/이름.jpg [밝기=1.0] [크기=512]
import sys
from PIL import Image, ImageEnhance, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
gain = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
size = int(sys.argv[4]) if len(sys.argv) > 4 else 512

im = Image.open(src).convert('RGB')
w, h = im.size
s = int(w * 0.1)
x0, y0 = w - s - int(w * 0.02), h - s - int(h * 0.02)
patch = im.crop((x0 - s, y0, x0, y0 + s))
mask = Image.new('L', (s, s), 0)
mask.paste(255, (s // 8, s // 8, s - s // 8, s - s // 8))
im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(s // 12)))
im = ImageEnhance.Brightness(im).enhance(gain)
im.resize((size, size), Image.LANCZOS).save(dst, quality=82, optimize=True)
print('wrote', dst)
