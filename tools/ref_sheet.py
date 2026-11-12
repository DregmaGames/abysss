#!/usr/bin/env python3
"""Reference sheets for redrawing sprites with an image model (Grok), and the way back.

    python3 tools/ref_sheet.py make  skeleton_0,skeleton_1,skeleton_2 out/ref_skeleton.png
    python3 tools/ref_sheet.py take  skeleton_0,skeleton_1,skeleton_2 redrawn.jpg --keys sk,outline,rg

`make` lays the named atlas frames side by side on pure magenta, enlarged (nearest neighbour), one frame per
cell, feet on one line. The model is asked to redraw that sheet keeping poses, positions and the pixel grid.
`take` reads the redrawn sheet back on ITS OWN pixel grid (found from the image: the model keeps chunky pixels
but not our exact scale): every art pixel takes the colour of the middle of its block, the backdrop is keyed out by hue, colours snap to the game palette (limited to --keys ramps), and each
figure is cut to a frame centred on itself with the set's feet on one line. Check the new size against the old.
The redrawn sheet already has its outline, so none is added. Frames go to assets/imported/ (tools/pixelart.py
packs them over the code-drawn ones). JPEG sources are fine.
"""
import argparse, colorsys, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAD, FEET = 4, 4          # art px around each frame; rows under the feet


def atlas():
    a = json.load(open(os.path.join(ROOT, 'assets', 'atlas.json')))
    fr = a.get('frames', a)
    im = Image.open(os.path.join(ROOT, 'assets', 'atlas.png')).convert('RGBA')

    def get(n):
        f = fr[n]
        f = f.get('frame', f)
        return im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    return get


def layout(sprites):
    cw = max(s.width for s in sprites) + PAD * 2
    cw += cw % 2                                  # an even cell keeps the centre line between two pixels
    ch = max(s.height for s in sprites) + PAD + FEET
    return cw, ch


def make(names, out, scale):
    get = atlas()
    sp = [get(n) for n in names]
    cw, ch = layout(sp)
    sheet = Image.new('RGBA', (cw * len(sp), ch), (255, 0, 255, 255))
    for i, s in enumerate(sp):
        sheet.alpha_composite(s, (i * cw + (cw - s.width) // 2, ch - FEET - s.height))
    sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.convert('RGB').save(out)
    print('%s: %d frames, cell %dx%d art px, x%d' % (out, len(sp), cw, ch, scale))


def grid_of(im):
    """The model keeps the chunky pixels but not our exact scale, so the pixel grid is read from the image:
    the block size and offset whose lines collect the most edge energy (colour changes between neighbours)."""
    import numpy as np
    a = np.asarray(im).astype(float)
    out = []
    for axis in (1, 0):
        d = np.abs(np.diff(a, axis=axis)).sum(axis=2).sum(axis=1 - axis)
        d -= d.mean()
        best = (-1e18, 0, 0)
        for p in np.arange(10, 34, 0.02):
            n = int(len(d) / p) - 1
            for ph in np.arange(0, p, 0.5):
                sc = d[np.clip(np.round(np.arange(n) * p + ph).astype(int), 0, len(d) - 1)].mean()
                if sc > best[0]:
                    best = (sc, p, ph)
        out.append((best[1], best[2] + 1))          # +1: diff index i is the boundary before pixel i + 1
    return out


def take(names, src, keys, out_dir, key_tol):
    get = atlas()
    orig = [get(n) for n in names]
    im = Image.open(src).convert('RGB')
    (bx, ox), (by, oy) = grid_of(im)
    ox, oy = ox % bx, oy % by
    W, H = int((im.width - ox) / bx), int((im.height - oy) / by)
    print('grid: blocks of %.2f x %.2f px, offset %.1f, %.1f -> %d x %d art px' % (bx, by, ox, oy, W, H))
    palette = json.load(open(os.path.join(ROOT, 'assets', 'palette.json')))
    pal = [(int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16)) for k, v in palette.items() if k.startswith(tuple(keys))]
    corner = im.getpixel((2, 2))
    kh = colorsys.rgb_to_hsv(*[c / 255 for c in corner])[0] * 360
    px = im.load()

    def backdrop(c):
        h, s, v = colorsys.rgb_to_hsv(*[x / 255 for x in c])
        d = abs(h * 360 - kh)
        return min(d, 360 - d) <= key_tol and s > 0.45 and v > 0.4

    grid = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gp = grid.load()
    for ay in range(H):
        for ax in range(W):
            # the middle half of the block: its edges carry the neighbours' colours (JPEG, anti-aliasing)
            x0, x1 = int(ox + (ax + 0.25) * bx), int(ox + (ax + 0.75) * bx)
            y0, y1 = int(oy + (ay + 0.25) * by), int(oy + (ay + 0.75) * by)
            votes = {}
            for y in range(y0, max(y1, y0 + 1), max(1, (y1 - y0) // 5)):
                for x in range(x0, max(x1, x0 + 1), max(1, (x1 - x0) // 5)):
                    c = px[min(x, im.width - 1), min(y, im.height - 1)]
                    k = None if backdrop(c) else min(pal, key=lambda q: (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2)
                    votes[k] = votes.get(k, 0) + 1
            best = max(votes, key=votes.get)
            if best:
                gp[ax, ay] = best + (255,)
    # figures: runs of columns that hold something
    al = grid.getchannel('A')
    cols = [al.crop((x, 0, x + 1, H)).getbbox() is not None for x in range(W)]
    runs, x = [], 0
    while x < W:
        if cols[x]:
            x1 = x
            while x1 < W and cols[x1]:
                x1 += 1
            if x1 - x >= 3:
                runs.append((x, x1))
            x = x1
        else:
            x += 1
    if len(runs) != len(names):
        sys.exit('found %d figures, expected %d' % (len(runs), len(names)))
    feet = max(grid.crop((a, 0, b, H)).getchannel('A').getbbox()[3] for a, b in runs)      # one feet line for the set
    os.makedirs(out_dir, exist_ok=True)
    frames = []
    for (n, o), (a, b) in zip(zip(names, orig), runs):
        box = grid.crop((a, 0, b, H)).getchannel('A').getbbox()
        f = grid.crop((a, box[1], b, feet))               # centred on its own figure, feet on the shared line
        f.save(os.path.join(out_dir, n + '.png'))
        frames.append(f)
        print('%s: %dx%d (was %dx%d)' % (n, f.width, f.height, o.width, o.height))
    # preview: old over new, x8
    pw = sum(max(f.width, o.width) + 4 for f, o in zip(frames, orig))
    ph = max(f.height for f in frames) + max(o.height for o in orig) + 12
    prev = Image.new('RGBA', (pw, ph), (40, 39, 51, 255))
    x, oh = 2, max(o.height for o in orig)
    for f, o in zip(frames, orig):
        w = max(f.width, o.width)
        prev.alpha_composite(o, (x + (w - o.width) // 2, 4 + oh - o.height))
        prev.alpha_composite(f, (x + (w - f.width) // 2, ph - 4 - f.height))
        x += w + 4
    qa = os.path.join(ROOT, 'qa', 'out')
    os.makedirs(qa, exist_ok=True)
    p = os.path.join(qa, 'ref_take_%s.png' % names[0].rsplit('_', 1)[0])
    prev.resize((pw * 8, ph * 8), Image.NEAREST).save(p)
    print('preview (old above, new below):', p)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=['make', 'take'])
    ap.add_argument('names', help='comma-separated atlas frame names, in sheet order')
    ap.add_argument('path', help='make: the sheet to write; take: the redrawn sheet to read')
    ap.add_argument('--scale', type=int, default=24)
    ap.add_argument('--keys', default='', help='take: palette ramps to snap to (prefixes, comma-separated)')
    ap.add_argument('--key-tol', type=float, default=22)
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'imported'))
    a = ap.parse_args()
    nm = a.names.split(',')
    if a.mode == 'make':
        make(nm, a.path, a.scale)
    else:
        take(nm, a.path, [k for k in a.keys.split(',') if k] or [''], a.out, a.key_tol)
