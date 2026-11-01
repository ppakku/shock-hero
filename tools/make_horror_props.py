# 공포 모드 소품 그림 (등, 배관, 천장, 책상, 의자, 붉은 쪽지). Gemini 원본을 잘라 게임용 jpg 로 만든다.
# 사용법: python3 tools/make_horror_props.py 원본폴더 [이름...]
# 앞면 그림은 물건만 잘라 낸다 (별 표시도 함께 잘린다). 되풀이 그림은 별 표시를 덮고, 이음매가 없게 되감는다.
# 천장은 어둠이 달라지지 않게, 그림 평균이 맵의 ceil 색과 같아지는 tint 를 함께 찍는다.
import os, sys
import numpy as np
from PIL import Image, ImageFilter

RAW = sys.argv[1]
OUT = 'public/art'
ONLY = sys.argv[2:]
STAR = 0.13  # 오른쪽 아래 별 표시가 있는 네모의 한 변 (원본 가로 대비)

# 이름: (자를 띠들 [왼, 위, 오른, 아래] 원본 비율, 결과 가로, 결과 세로). 띠가 여럿이면 위아래로 잇는다
FACES = {
    'light_school': ([(0, 0.013, 1, 0.054), (0, 0.202, 1, 0.847), (0, 0.95, 1, 0.99)], 256, 96),
    'light_station': ([(0.036, 0.218, 0.964, 0.782)], 256, 84),
    'light_factory': ([(0.065, 0.287, 0.915, 0.717)], 256, 73),
}
# 이름: (결과 크기, 천장이면 맞출 색)
TILES = {}


def load(name):
    return Image.open(f'{RAW}/{name}.png').convert('RGB')


def face(name, bands, w, h):
    im = load(name)
    W, H = im.size
    parts = [im.crop((round(a * W), round(b * H), round(c * W), round(d * H))) for a, b, c, d in bands]
    full = Image.new('RGB', (parts[0].width, sum(p.height for p in parts)))
    y = 0
    for p in parts:
        full.paste(p, (0, y))
        y += p.height
    save(full.resize((w, h), Image.LANCZOS), name)


def save(im, name):
    path = f'{OUT}/horror_{name}.jpg'
    im.save(path, quality=80, optimize=True)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    for name, (bands, w, h) in FACES.items():
        if (not ONLY or name in ONLY) and os.path.exists(f'{RAW}/{name}.png'):
            face(name, bands, w, h)
