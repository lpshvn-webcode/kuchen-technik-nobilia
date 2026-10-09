#!/usr/bin/env python3
"""Build web assets for the interactive showroom from showroom/source/<kitchen>/.

Usage:
    python3 tools/build_showroom_assets.py [--depth-model PATH] [--only SLUG]

For every kitchen in KITCHENS it writes showroom/<slug>/:
    a-sd/hd.{avif,webp}, b-sd/hd.{avif,webp}   base scenes (hd only for 5K sources)
    a-live-hd.*, b-live-hd.*                    aligned variant (people / evening light)
    a-depth.webp, b-depth.webp                  depth maps (need --depth-model)
    d-<card>.webp                               detail card crops
    cover.webp                                  catalogue cover
and showroom/interactive/<id>-preview-*.{avif,webp,jpg} plus showroom/assets-meta.js.

Depth maps use MiDaS v2.1 small (ONNX), not stored in the repository:
https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx
Without --depth-model the existing depth files are kept.
"""
import argparse, base64, io, json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRCROOT = ROOT / 'showroom/source'
INT = ROOT / 'showroom/interactive'
META = {}

# photos: scene key -> source file (and optional aligned "live" variant)
# cards:  card id -> (source file | 'photo:<key>', centre x, centre y, width fraction)
# preview: (desktop centre x, y) and (mobile centre x, y, width fraction), taken from photo "a"
KITCHENS = {
    'structura-425': dict(
        id='structura425',
        photos={'a': dict(src='30606_26_Structura_425_M.jpeg', live='30611_26_Structura_425_P.jpeg'),
                'b': dict(src='30607_26_Structura_425_M.jpeg', live='30614_26_Structura_425_P.jpeg')},
        cards={'island': ('photo:a', .48, .74, .34), 'oak': ('photo:a', .35, .43, .22), 'upper': ('photo:a', .58, .39, .30),
               'faucet': ('photo:b', .64, .50, .20), 'oven': ('photo:b', .265, .53, .20),
               'handle': ('30753_26_Structura_425_D.jpeg', .5, .6, 1.0), 'drawers': ('30751_26_Structura_425_D.jpeg', .5, .5, 1.0),
               'pantry': ('30750_26_Structura_425_D.jpeg', .5, .45, 1.0)},
        preview=((.50, .53), (.50, .57, .40))),
    'cadra-746': dict(
        id='cadra746',
        photos={'a': dict(src='30462_26_Cadra_746_M.jpeg'), 'b': dict(src='30464_26_Cadra_746_M.jpeg')},
        cards={'niche': ('30472_26_Cadra_746_D.jpeg', .5, .38, 1.0), 'faucet': ('30471_26_Cadra_746_D.jpeg', .5, .55, 1.0),
               'island': ('30465_26_Cadra_746_D.jpeg', .5, .55, 1.0), 'worktop': ('30473_26_Cadra_746_D.jpeg', .5, .25, 1.0),
               'oven': ('photo:b', .76, .47, .20), 'drawers': ('30474_26_Cadra_746_D.jpeg', .5, .62, 1.0),
               'fronts': ('30470_26_Cadra_746_D.jpeg', .5, .5, 1.0)},
        preview=((.50, .56), (.48, .58, .45))),
    'nordic-793': dict(
        id='nordic793',
        photos={'a': dict(src='30439_26_Nordic_793_M.jpeg', live='30439_26_Nordic_793_P_AI.jpeg'),
                'b': dict(src='30441_26_Nordic_793_M.jpeg', live='30441_26_Nordic_793_P_AI.jpeg')},
        cards={'sink': ('30445_26_Nordic_793_D.jpeg', .5, .4, 1.0), 'shelf': ('30444_26_Nordic_793_D.jpeg', .5, .35, 1.0),
               'worktop': ('30456_26_Nordic_793_D.jpeg', .5, .45, 1.0), 'fronts': ('30454_26_Nordic_793_D.jpeg', .5, .5, .9),
               'handle': ('30455_26_Nordic_793_D.jpeg', .5, .55, 1.0), 'island': ('30443_26_Nordic_793_D.jpeg', .5, .7, 1.0),
               'tall': ('30442_26_Nordic_793_D.jpeg', .5, .6, 1.0)},
        preview=((.50, .56), (.58, .60, .45))),
    'senso-499': dict(
        id='senso499',
        photos={'a': dict(src='30649_26_Senso_499_M.jpeg', live='30666_26_Senso_499_P.jpeg'),
                'b': dict(src='30650_26_Senso_499_D.jpeg', live='30669_26_Senso_499_P.jpeg')},
        cards={'vitrine': ('30664_26_Senso_499_D.jpeg', .5, .5, .95), 'faucet': ('30660_26_Senso_499_D.jpeg', .5, .45, 1.0),
               'island': ('30659_26_Senso_499_D.jpeg', .5, .45, 1.0), 'handle': ('30658_26_Senso_499_D.jpeg', .5, .35, 1.0),
               'pullout': ('30661_26_Senso_499_D.jpeg', .5, .6, 1.0), 'lift': ('30663_26_Senso_499_D.jpeg', .5, .5, .9),
               'bar': ('30656_26_Senso_499_D.jpeg', .5, .4, 1.0), 'hob': ('30654_26_Senso_499_D.jpeg', .5, .25, 1.0)},
        preview=((.50, .55), (.45, .58, .42))),
    'structura-409': dict(
        id='structura409',
        photos={'a': dict(src='30724_26_Structura_409_M.jpeg', live='generated-10.png')},
        cards={'vitrine': ('30726_26_Structura_409_D.jpeg', .5, .4, 1.0), 'ovens': ('generated-03.png', .5, .5, 1.0),
               'sink': ('30728_26_Structura_409_D.jpeg', .5, .3, 1.0), 'island': ('30732_26_Structura_409_D.jpeg', .5, .6, 1.0),
               'fronts': ('30729_26_Structura_409_D.jpeg', .5, .5, 1.0),
               'hob': ('generated-07.png', .5, .5, 1.0), 'bar': ('30730_26_Structura_409_D.jpeg', .5, .4, 1.0)},
        preview=((.50, .55), (.42, .58, .45))),
    'structura-419': dict(
        id='structura419',
        photos={'a': dict(src='view-01-wide.jpg'), 'b': dict(src='generated-08.png')},
        cards={'knob': ('view-02-detail.jpg', .5, .45, 1.0),
               'cooktop': ('view-05-cooktop.jpg', .5, .45, 1.0), 'tall': ('view-06-tall-units.jpg', .5, .35, 1.0),
               'sink': ('generated-09.png', .5, .5, 1.0), 'shelf': ('generated-04.png', .5, .5, 1.0),
               'oven': ('generated-10.png', .5, .5, 1.0)},
        preview=((.50, .54), (.42, .56, .45))),
}


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


def crop(im, cx, cy, wfrac, aspect=4 / 3):
    w = min(im.width * wfrac, im.height * aspect)
    h = w / aspect
    x0 = min(max(cx * im.width - w / 2, 0), im.width - w)
    y0 = min(max(cy * im.height - h / 2, 0), im.height - h)
    return im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))


def scene(out, key, src, live=None):
    im = Image.open(src).convert('RGB')
    hd = im.width >= 3000
    sizes = {'sd': 1800, 'hd': 3400} if hd else {'sd': im.width}
    total = 0
    for tag, w in sizes.items():
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if w != im.width else im
        q = 55 if hd else 62
        total += save(r, out / f'{key}-{tag}.avif', 'AVIF', quality=q, speed=4)
        total += save(r, out / f'{key}-{tag}.webp', 'WEBP', quality=76, method=5)
    if live:
        lv = Image.open(live).convert('RGB')
        w = 3400 if lv.width >= 3000 else lv.width
        r = lv.resize((w, round(lv.height * w / lv.width)), Image.LANCZOS) if w != lv.width else lv
        total += save(r, out / f'{key}-live-hd.avif', 'AVIF', quality=55 if hd else 62, speed=4)
        total += save(r, out / f'{key}-live-hd.webp', 'WEBP', quality=76, method=5)
    print(f'  {key}: {total // 1024} KB (all formats){" +live" if live else ""}')
    return im, {'w': im.width, 'h': im.height, 'lqip': lqip(im), 'hd': hd, 'live': bool(live)}


def build(slug, cfg, depth_jobs):
    src = SRCROOT / slug
    out = ROOT / 'showroom' / slug
    print(slug)
    ims = {}
    for key, p in cfg['photos'].items():
        im, meta = scene(out, key, src / p['src'], src / p['live'] if p.get('live') else None)
        ims[key] = im
        META[f'{slug}/{key}'] = meta
        depth_jobs.append((src / p['src'], out / f'{key}-depth.webp'))
    for name, (file, cx, cy, wf) in cfg['cards'].items():
        im = ims[file[6:]] if file.startswith('photo:') else Image.open(src / file).convert('RGB')
        c = crop(im, cx, cy, wf).resize((1000, 750), Image.LANCZOS)
        save(c, out / f'd-{name}.webp', 'WEBP', quality=78, method=5)
    a = ims['a']
    (dx, dy), (mx, my, mw) = cfg['preview']
    for tag, (w, h, cx, cy, fw) in {'desktop': (1200, 720, dx, dy, 1.0), 'mobile': (720, 900, mx, my, mw)}.items():
        c = crop(a, cx, cy, fw, aspect=w / h).resize((w, h), Image.LANCZOS)
        save(c, INT / f"{cfg['id']}-preview-{tag}.avif", 'AVIF', quality=52, speed=4)
        save(c, INT / f"{cfg['id']}-preview-{tag}.webp", 'WEBP', quality=76, method=5)
        save(c, INT / f"{cfg['id']}-preview-{tag}.jpg", 'JPEG', quality=80, optimize=True, progressive=True)
    cover = crop(a, .5, .55, 1.0, aspect=1000 / 730).resize((1000, 730), Image.LANCZOS)
    save(cover, out / 'cover.webp', 'WEBP', quality=78, method=5)


def make_depth(model_path, jobs):
    import numpy as np, onnxruntime as ort, cv2
    sess = ort.InferenceSession(model_path)

    def guided_filter(I, p, r, eps):
        box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
        mI, mp = box(I), box(p)
        a = (box(I * p) - mI * mp) / (box(I * I) - mI * mI + eps)
        b = mp - a * mI
        return box(a) * I + box(b)

    def depth(img_path, out_path, size=1400):
        im = cv2.imdecode(np.fromfile(str(img_path), np.uint8), cv2.IMREAD_COLOR)
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

    for img, out in jobs:
        depth(img, out)
        print('  depth', out.relative_to(ROOT))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--depth-model')
    ap.add_argument('--only')
    args = ap.parse_args()
    jobs = []
    old = ROOT / 'showroom/assets-meta.js'
    if args.only and old.exists():
        META.update(json.loads(old.read_text(encoding='utf-8')[len('export const META='):].rstrip().rstrip(';')))
    for slug, cfg in KITCHENS.items():
        if args.only and slug != args.only:
            continue
        build(slug, cfg, jobs)
    if args.depth_model:
        make_depth(args.depth_model, jobs)
    (ROOT / 'showroom/assets-meta.js').write_text('export const META=' + json.dumps(META, separators=(',', ':')) + ';\n')
    print('meta written')


if __name__ == '__main__':
    sys.exit(main())
