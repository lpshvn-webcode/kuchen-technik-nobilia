#!/usr/bin/env python3
"""Build web assets for the interactive showroom.

Usage:
    python3 tools/build_showroom_assets.py [--depth-model PATH]

Inputs : showroom/source/structura-425/*.jpeg (official 5K photos)
         showroom/interactive/*-view-NN-desktop.webp (existing scenes)
Outputs: showroom/structura-425/*      (AVIF/WebP scenes, depth maps, detail crops)
         showroom/interactive/*-depth.webp (depth for existing scenes)
         showroom/assets-meta.js       (sizes + tiny blurred placeholders)

Depth maps are produced with MiDaS v2.1 small (ONNX):
https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx
The 66 MB model is not stored in the repository. Without --depth-model the
existing depth files are kept as they are.
"""
import argparse, base64, io, json, os, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'showroom/source/structura-425'
OUT = ROOT / 'showroom/structura-425'
INT = ROOT / 'showroom/interactive'
META = {}


def src(n):
    return next(SRC.glob(f'{n}_*'))


def save(img, path, fmt, **kw):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, fmt, **kw)
    return path.stat().st_size


def lqip(img):
    t = img.copy()
    t.thumbnail((28, 28))
    b = io.BytesIO()
    t.convert('RGB').save(b, 'JPEG', quality=40)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def scene_set(key, photo, widths, avif_q=55, webp_q=76):
    im = Image.open(photo).convert('RGB')
    total = 0
    for tag, w in widths.items():
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        total += save(r, OUT / f'{key}-{tag}.avif', 'AVIF', quality=avif_q, speed=4)
        total += save(r, OUT / f'{key}-{tag}.webp', 'WEBP', quality=webp_q, method=5)
    META[key] = {'w': im.width, 'h': im.height, 'lqip': lqip(im)}
    print(f'{key}: {total // 1024} KB (all formats)')
    return im


def crop(im, cx, cy, wfrac, aspect=4 / 3):
    w = im.width * wfrac
    h = w / aspect
    x0 = min(max(cx * im.width - w / 2, 0), im.width - w)
    y0 = min(max(cy * im.height - h / 2, 0), im.height - h)
    return im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))


def details(a, b):
    d30610 = Image.open(src(30610)).convert('RGB')
    d30609 = Image.open(src(30609)).convert('RGB')
    d30625 = Image.open(src(30625)).convert('RGB')
    specs = {
        'island': crop(a, .48, .74, .34),
        'oak': crop(a, .35, .43, .22),
        'upper': crop(a, .58, .39, .30),
        'faucet': crop(b, .64, .50, .20),
        'oven': crop(b, .265, .53, .20),
        'handle': crop(d30610, .88, .50, .24),
        'drawers': crop(d30609, .55, .50, .88),
        'pantry': crop(d30625, .62, .38, .95),
    }
    for name, c in specs.items():
        r = c.resize((1000, 750), Image.LANCZOS)
        size = save(r, OUT / f'd-{name}.webp', 'WEBP', quality=78, method=5)
        print(f'd-{name}: {size // 1024} KB')


def previews(a):
    for tag, (w, h, cx, cy, fw) in {
        'desktop': (1200, 720, .50, .53, 1.0),
        'mobile': (720, 900, .50, .57, .40),
    }.items():
        c = crop(a, cx, cy, fw, aspect=w / h).resize((w, h), Image.LANCZOS)
        save(c, INT / f'structura425-preview-{tag}.avif', 'AVIF', quality=52, speed=4)
        save(c, INT / f'structura425-preview-{tag}.webp', 'WEBP', quality=76, method=5)
        save(c, INT / f'structura425-preview-{tag}.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
    cover = crop(a, .5, .55, 1.0, aspect=1000 / 730).resize((1000, 730), Image.LANCZOS)
    print('cover:', save(cover, OUT / 'cover.webp', 'WEBP', quality=78, method=5) // 1024, 'KB')


def make_depth(model_path):
    import numpy as np, onnxruntime as ort, cv2
    sess = ort.InferenceSession(model_path)

    def guided_filter(I, p, r, eps):
        box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
        mI, mp = box(I), box(p)
        a = (box(I * p) - mI * mp) / (box(I * I) - mI * mI + eps)
        b = mp - a * mI
        return box(a) * I + box(b)

    def depth(img_path, out_path, size=1400):
        im = cv2.imread(str(img_path))
        h, w = im.shape[:2]
        s = size / max(h, w)
        im = cv2.resize(im, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
        x = cv2.resize(rgb, (256, 256), interpolation=cv2.INTER_CUBIC)
        x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
        d = sess.run(None, {'0': x})[0][0]
        d = cv2.resize(d, (im.shape[1], im.shape[0]), interpolation=cv2.INTER_CUBIC)
        lo, hi = np.percentile(d, 1), np.percentile(d, 99)
        g = (np.clip((d - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)
        W = 640
        H = round(W * g.shape[0] / g.shape[1])
        g = cv2.resize(g, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        guide = cv2.cvtColor(cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        # snap depth edges to photo edges so straight lines stay straight under parallax
        for _ in range(2):
            g = guided_filter(guide, g, 9, 4e-4)
        g = cv2.GaussianBlur(g, (0, 0), 1.2)
        Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).save(out_path, 'WEBP', quality=82, method=5)

    for key, name in (('a', '30606'), ('b', '30607')):
        depth(src(name), OUT / f'{key}-depth.webp')
    for f in sorted(INT.glob('*-view-*-desktop.webp')):
        depth(f, f.with_name(f.name.replace('-desktop.webp', '-depth.webp')))
    print('depth maps done')


def old_meta():
    for f in sorted(INT.glob('*-view-*-desktop.webp')):
        im = Image.open(f).convert('RGB')
        META[f.name.replace('-desktop.webp', '')] = {'w': im.width, 'h': im.height, 'lqip': lqip(im)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--depth-model')
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    wide = {'sd': 1800, 'hd': 3400}
    a = scene_set('a', src(30606), wide)
    b = scene_set('b', src(30607), wide)
    scene_set('a-live', src(30611), {'hd': 3400})
    scene_set('b-live', src(30614), {'hd': 3400})
    details(a, b)
    previews(a)
    if args.depth_model:
        make_depth(args.depth_model)
    old_meta()
    (ROOT / 'showroom/assets-meta.js').write_text(
        'export const META=' + json.dumps(META, separators=(',', ':')) + ';\n')
    print('meta written')


if __name__ == '__main__':
    sys.exit(main())
