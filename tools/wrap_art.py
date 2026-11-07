# 앞뒤 그림을 몸통에 둘러 입히는 공용 도구. tools/make_gazer_art.py 와 tools/make_maw_art.py 가 쓴다.
# 앞면은 줄마다 윤곽을 재서 정면 그림 그대로 입히고, 옆구리는 먹선을 지운 살빛으로 이어서 옆에서 봐도 스티커처럼 보이지 않게 한다.
import numpy as np
from PIL import Image, ImageFilter

SIDE = 1.17  # src/horror/creatureShell.js 의 wrapU 가 옆구리(90도)에서 내는 값. 앞면 윤곽(1)을 넘는 띠가 옆구리다


def load(path):
    return np.asarray(Image.open(path).convert('RGB'))


def mask_of(rgb):
    a = rgb.astype(int)
    solid = np.minimum(a[..., 0], a[..., 2]) - a[..., 1] < 40  # 마젠타와 별 표시를 뺀다
    im = Image.fromarray((solid * 255).astype('uint8'))
    return np.asarray(im.filter(ImageFilter.MinFilter(15)).filter(ImageFilter.MaxFilter(15))) > 128


def half_widths(mask, mid):
    hw = np.zeros(mask.shape[0])
    for y in range(mask.shape[0]):
        if mask[y, mid]:
            l = np.where(~mask[y, :mid])[0]
            r = np.where(~mask[y, mid:])[0]
            hw[y] = (mid - (l[-1] + 1 if l.size else 0) + (r[0] - 1 if r.size else mask.shape[1] - mid)) / 2
    return hw


def smooth(v, n=31):
    k = np.ones(n) / n
    return np.convolve(np.pad(v, n // 2, mode='edge'), k, 'valid')


def wrap(rows_f, rows_b, hw_f, hw_b, rgb_f, rgb_b, cx_f, cx_b, width, front, inset, tone, unmirror=False, grain_gain=1.0):
    # 그림 한 줄마다: 앞면은 윤곽 안쪽 그림, 뒷면은 뒷모습 그림, 윤곽 밖 띠는 tone 으로 이어 붙인다
    # grain_gain: 옆구리에 얹는 잔금의 세기. 주름이 큰 천은 줄여야 옆구리에 무늬가 생기지 않는다
    # unmirror: 옆구리 선을 넘어서도 잔금을 같은 방향으로 이어 떠서, 얼룩이 거울처럼 겹치거나 선이 생기지 않게 한다
    out = np.zeros((len(rows_f), width, 3))
    u = (np.arange(width) + 0.5) / width
    is_front = np.abs(u - 0.5) < front / 2
    s = np.where(is_front, (u - 0.5) / (front / 2), np.sign(u - 0.5) * (1 - (np.abs(u - 0.5) - front / 2) / (0.5 - front / 2))) * SIDE
    fade = np.clip((1 - np.abs(s)) / 0.2, 0, 1)[:, None]
    fade = fade * fade * (3 - 2 * fade)
    grain = rgb_b.astype(float) - np.asarray(Image.fromarray(rgb_b).filter(ImageFilter.GaussianBlur(30))).astype(float)  # 옆구리에 얹을 잔금
    shadow = np.where(is_front, 1, 0.68 + 0.32 * np.clip((1 - np.abs(s)) / 0.7, 0, 1))[:, None]  # 뒷면은 옆구리로 갈수록 앞면만큼 어두워진다
    grain_s = np.where(is_front | ~unmirror, s, np.sign(s) * (2 * SIDE - np.abs(s)))
    for y, (rf, rb) in enumerate(zip(rows_f, rows_b)):
        xf = (cx_f + s * max(hw_f[rf] - inset, 1)).round().astype(int).clip(0, rgb_f.shape[1] - 1)
        xb = (cx_b - s * max(hw_b[rb] - inset, 1)).round().astype(int).clip(0, rgb_b.shape[1] - 1)
        row = np.where(is_front[:, None], rgb_f[rf, xf], rgb_b[rb, xb]).astype(float)
        side = tone[y] + grain_gain * grain[rb, (cx_b - grain_s * max(hw_b[rb] - inset, 1) * 0.6).round().astype(int).clip(0, rgb_b.shape[1] - 1)]
        out[y] = row * shadow * fade + side * (1 - fade)
    return out.clip(0, 255).astype('uint8')


def side_tone(rgb, rows, hw, cx, inset, gain):
    # 윤곽 바로 안쪽의 살빛을 줄마다 재서 부드럽게 만든다. 먹선을 피해 안쪽 띠의 밝은 쪽을 쓴다
    tone = np.zeros((len(rows), 3))
    for i, r in enumerate(rows):
        w = max(hw[r] - inset, 2)
        xs = np.linspace(cx + w * 0.72, cx + w * 0.95, 24).astype(int).clip(0, rgb.shape[1] - 1)
        xl = np.linspace(cx - w * 0.72, cx - w * 0.95, 24).astype(int).clip(0, rgb.shape[1] - 1)
        px = np.vstack([rgb[r, xs], rgb[r, xl]])
        tone[i] = np.percentile(px, 70, axis=0)
    return np.stack([smooth(tone[:, c], 601) for c in range(3)], -1) * gain


def keys(name, base, rows, hw, m, n):
    print(name)
    print(', '.join(f'[{round(float((rows[-1] - r) * m + base), 3)}, {round(float(hw[r] * m), 3)}]' for r in np.linspace(rows[0], rows[-1], n).astype(int)))
