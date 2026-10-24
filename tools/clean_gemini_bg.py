# 사용법: python3 tools/clean_gemini_bg.py 원본.png public/art/결과.jpg [높이=720]
# Gemini 배경 그림의 오른쪽 아래 별 표시를 양옆 색으로 메워 지우고, 높이를 맞춰 JPG 로 저장한다.
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
height = int(sys.argv[3]) if len(sys.argv) > 3 else 720
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()

# 오른쪽 아래 구석에서 밝은 무채색(별) 찾기
x0, y0 = W - W // 6, H - H // 3
pts = [(x, y) for y in range(y0, H) for x in range(x0, W)
       if min(px[x, y]) > 115 and max(px[x, y]) - min(px[x, y]) < 25]
if pts:
    m = 12
    left = max(0, min(p[0] for p in pts) - m)
    right = min(W - 1, max(p[0] for p in pts) + m)
    top = max(0, min(p[1] for p in pts) - m)
    bottom = min(H - 1, max(p[1] for p in pts) + m)
    # 별 왼쪽 열과 오른쪽 열 색을 가로로 이어 칠한다 (땅은 가로로 거의 같은 색)
    for y in range(top, bottom + 1):
        a, b = px[left, y], px[right, y]
        for x in range(left + 1, right):
            t = (x - left) / (right - left)
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
    print('별 지움', (left, top, right, bottom))
else:
    print('별 없음')

im = im.resize((round(W * height / H), height), Image.LANCZOS)
im.save(out, quality=88, optimize=True)
print(out, im.size)
