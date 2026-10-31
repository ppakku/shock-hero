# 공포 모드 괴물 그림을 게임용으로 줄인다. 원본은 Gemini 가 아들의 그림을 참고로 그린 것이다.
# 사용법: python3 tools/make_creature_art.py 얼굴.png 피부.png 전신.png
# 얼굴은 정면 투영, 피부는 반복 재질, 몸통은 전신 그림의 정면 갈비뼈 부분을 잘라 쓴다.
import sys
from PIL import Image, ImageFilter

face_src, skin_src, sheet_src = sys.argv[1:4]
OUT = 'public/art'


def erase_star(im, box):
    # 오른쪽 아래 별 표시를 바로 왼쪽 피부로 덮는다
    x0, y0, x1, y1 = box
    w = x1 - x0
    patch = im.crop((x0 - w, y0, x0, y1))
    mask = Image.new('L', patch.size, 0)
    mask.paste(255, (24, 24, patch.width - 24, patch.height - 24))
    im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(14)))


face = Image.open(face_src).convert('RGB')
erase_star(face, (1880, 1880, 2000, 2000))
face.resize((1024, 1024), Image.LANCZOS).save(f'{OUT}/horror_creature_face.jpg', quality=88)

skin = Image.open(skin_src).convert('RGB')
erase_star(skin, (1880, 1880, 2000, 2000))
skin.resize((512, 512), Image.LANCZOS).save(f'{OUT}/horror_creature_skin.jpg', quality=85)

sheet = Image.open(sheet_src).convert('RGB')
# 전신 그림 1792x2400 의 앞모습 가슴: 쇄골부터 허리까지. 팔 사이로 보이는 분홍 배경은 피부색으로 덮는다
torso = sheet.crop((348, 700, 612, 1060))
px = torso.load()
for y in range(torso.height):
    for x in range(torso.width):
        r, g, b = px[x, y]
        if r > 110 and b > 110 and g < min(r, b) - 25:
            px[x, y] = (70, 68, 66)
torso.resize((512, 700), Image.LANCZOS).save(f'{OUT}/horror_creature_torso.jpg', quality=85)
