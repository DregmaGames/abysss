#!/usr/bin/env python3
"""Art test "27 px" (the sprite resolution of the user's reference): a generated sheet reduced to the game's own art
pixel grid with soft shading, instead of the double-density import of tools/hd_atlas.py.

    python3 -I tools/lo_sprite.py strip SHEET --names a,b,c --ref 4 --tall 27 [--colors 28] [--key-hue 323]
        figures side by side on a flat backdrop -> one frame per figure, one scale (figure --ref is --tall art px tall)
    python3 -I tools/lo_sprite.py frame assets/hd/skeleton.png --name skeleton [--colors 12] [--no-rim]
        an HD frame (RGBA) at half size

Each frame is area-averaged in linear light (alpha weighted), cut at half coverage, snapped to a small palette shared
by the frames of the call, brightened a little (the rooms are dark) and given a 1 px dark rim. It is saved as
assets/hd/lo_<name>.png at 2x (every art pixel = 2x2 HD pixels), so the HD atlas, its anchors and the motion rig serve
it unchanged; src/view/hd.js shows lo_<name> instead of <name> in the '27 px' mode. Ends with hd_atlas.py pack.
Run with -I on downloaded art; sources stay outside the repo.
"""
import argparse, os, subprocess, sys
import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'hd')
RIM = (16, 14, 26, 235)


def keyed(im, hue, tol=22):
    """RGB sheet -> (rgb 0..1, alpha 0/1): the backdrop is every saturated, bright pixel near the key hue."""
    a = np.asarray(im.convert('RGB')).astype(float) / 255
    mx = a.max(2); mn = a.min(2); d = mx - mn + 1e-9
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    back = (np.abs(((h - hue + 180) % 360) - 180) < tol) & (d / (mx + 1e-9) > 0.55) & (mx > 0.5)
    return a, (~back).astype(float)


def figures(alpha, gap=12, min_w=40):
    cols = np.where(alpha.max(0) > 0)[0]
    runs = []; st = pv = cols[0]
    for c in cols[1:]:
        if c - pv > gap:
            runs.append((st, pv)); st = c
        pv = c
    runs.append((st, pv))
    out = []
    for x0, x1 in runs:
        if x1 - x0 < min_w:
            continue
        rows = np.where(alpha[:, x0:x1 + 1].max(1) > 0)[0]
        out.append((x0, rows[0], x1 + 1, rows[-1] + 1))
    return out


def shrink(rgb, al, k):
    """Area average in linear light, weighted by coverage; opaque where at least half covered."""
    H, W = al.shape
    w2 = max(1, round(W * k)); h2 = max(1, round(H * k))
    lin = rgb ** 2.2 * al[..., None]
    im = Image.fromarray((np.dstack([lin, al]) * 255).astype(np.uint8), 'RGBA').resize((w2, h2), Image.BOX)
    o = np.asarray(im).astype(float) / 255
    A = o[..., 3]
    c = (o[..., :3] / np.maximum(A[..., None], 1e-6)) ** (1 / 2.2)
    return Image.fromarray((np.dstack([c, (A > 0.5).astype(float)]) * 255).astype(np.uint8), 'RGBA')


def finish(frames, colors, rim, bright=1.22, sat=1.15):
    px = np.vstack([np.asarray(f).reshape(-1, 4) for f in frames])
    op = px[px[:, 3] > 0][:, :3]
    pal = Image.fromarray(op.reshape(1, -1, 3).astype(np.uint8), 'RGB').quantize(colors, method=Image.MEDIANCUT, kmeans=3)
    out = []
    for f in frames:
        q = f.convert('RGB').quantize(palette=pal, dither=Image.NONE).convert('RGB')
        q = ImageEnhance.Brightness(ImageEnhance.Color(q).enhance(sat)).enhance(bright)
        a = np.asarray(f.getchannel('A')) > 0
        H, W = a.shape
        pad = 1 if rim else 0
        o = np.zeros((H + 2 * pad, W + 2 * pad, 4), np.uint8)
        o[pad:pad + H, pad:pad + W, :3] = np.asarray(q)
        o[pad:pad + H, pad:pad + W, 3] = a * 255
        if rim:
            A = o[..., 3] > 0
            nb = np.zeros_like(A)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb |= np.roll(np.roll(A, dy, 0), dx, 1)
            o[nb & ~A] = RIM
        out.append(Image.fromarray(o, 'RGBA'))
    return out


def save(frames, names):
    os.makedirs(OUT, exist_ok=True)
    for f, n in zip(frames, names):
        f.resize((f.width * 2, f.height * 2), Image.NEAREST).save(os.path.join(OUT, 'lo_%s.png' % n))
        print('  lo_%s: %dx%d art px' % (n, f.width, f.height))
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'hd_atlas.py'), 'pack'])


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    s = sp.add_parser('strip')
    s.add_argument('source'); s.add_argument('--names', required=True); s.add_argument('--ref', type=int, default=0)
    s.add_argument('--tall', type=int, default=27); s.add_argument('--colors', type=int, default=28)
    s.add_argument('--key-hue', type=float, default=323); s.add_argument('--no-rim', action='store_true')
    f = sp.add_parser('frame')
    f.add_argument('source'); f.add_argument('--name', required=True); f.add_argument('--colors', type=int, default=12)
    f.add_argument('--no-rim', action='store_true')
    a = ap.parse_args()
    if a.cmd == 'strip':
        names = a.names.split(',')
        rgb, al = keyed(Image.open(a.source), a.key_hue)
        boxes = figures(al)
        if len(boxes) != len(names):
            sys.exit('%d figures found, %d names given' % (len(boxes), len(names)))
        k = a.tall / (boxes[a.ref][3] - boxes[a.ref][1])
        frames = [shrink(rgb[y0:y1, x0:x1], al[y0:y1, x0:x1], k) for x0, y0, x1, y1 in boxes]
        save(finish(frames, a.colors, not a.no_rim), names)
    else:
        im = np.asarray(Image.open(a.source).convert('RGBA')).astype(float) / 255
        fr = shrink(im[..., :3], (im[..., 3] > 0.5).astype(float), 0.5)
        save(finish([fr], a.colors, not a.no_rim), [a.name])


if __name__ == '__main__':
    main()
