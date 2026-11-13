#!/usr/bin/env python3
"""HD art (pilot): sprites at TWICE the art density, shown at half scale (same size on screen and in the world).

At 960x540 one art pixel is 2 screen pixels; one HD pixel is 1 screen pixel. The view draws a sprite from the HD
atlas when the frame exists there (src/view/hd.js, frame map in src/view/anim.js), else from the chunky atlas.
HD art keeps the source's own colours (a light quantisation tidies JPEG noise); it is NOT snapped to the palette.

    python3 -I tools/hd_atlas.py import SRC --name skeleton --height 50            # one figure
    python3 -I tools/hd_atlas.py import SRC --name tyrant --split cols --cells 0,1,2 \\
            --names tyrant_slam,tyrant_charge,tyrant_burst --own-box --ref 2 --height 68
    python3 -I tools/hd_atlas.py import SHEET --name mage --grid 4x3 --cells 0-9 \\
            --names mage_idle_0,mage_walk_0,...  --height 48                       # a grid of frames
    python3 -I tools/hd_atlas.py floor                     # the code-made dungeon floor -> assets/hd_floor.png
    python3 -I tools/hd_atlas.py floor --from floor.png    # a user texture, tiled with mirroring
    python3 -I tools/hd_atlas.py pack                      # assets/hd/*.png -> assets/hd_atlas.png + .json
    python3 tools/build.py

`import` and `floor` repack at the end. Every frame gets an anchor (feet centre: the middle of its lowest opaque
rows) stored in the atlas json as `anchor`, so a figure with a raised arm still stands on its feet.
Previews (x4, on the floor colour) go to qa/out/hd_<name>.png.
"""
import argparse, json, os, random, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
HD = os.path.join(ROOT, 'assets', 'hd')
QA = os.path.join(ROOT, 'qa', 'out')


def pal():
    with open(os.path.join(ROOT, 'assets', 'palette.json')) as f:
        p = json.load(f)
    return {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in p.items()}


# ----------------------------------------------------------------------------- keying and cutting
def hsv(a):
    """float arrays (h in degrees, s, v) of an (..., 3) uint8 array"""
    f = a.astype(np.float32) / 255
    mx, mn = f.max(-1), f.min(-1)
    d = mx - mn
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm = nz & (mx == r); gm = nz & (mx == g) & ~rm; bm = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h * 60, s, mx


def key_out(im, tol=20, sat=0.45, val=0.3):
    """Backdrop (the border's median colour, by hue: magenta, hot pink) -> transparent; a source's own alpha is kept."""
    a = np.array(im.convert('RGBA'))
    rgb = a[..., :3]
    ring = np.concatenate([rgb[:2].reshape(-1, 3), rgb[-2:].reshape(-1, 3), rgb[:, :2].reshape(-1, 3), rgb[:, -2:].reshape(-1, 3)])
    key = np.median(ring, 0)
    kh = hsv(key.reshape(1, 3).astype(np.uint8))[0][0]
    h, s, v = hsv(rgb)
    d = np.abs(h - kh); d = np.minimum(d, 360 - d)
    bg = (d <= tol) & (s > sat) & (v > val)
    alpha = (a[..., 3] >= 128) & ~bg
    # pink fringe: a dark pixel next to the backdrop that still leans to the key hue is backdrop shade, not outline
    print('key colour #%02x%02x%02x (hue %d)' % (int(key[0]), int(key[1]), int(key[2]), kh))
    out = a.copy()
    out[..., 3] = np.where(alpha, 255, 0)
    out[~alpha, :3] = 0
    return out


def components_clean(a, min_px):
    """Drop opaque blobs smaller than min_px source pixels (JPEG crumbs in the backdrop)."""
    m = a[..., 3] > 0
    H, W = m.shape
    lab = np.zeros((H, W), np.int32)
    n = 0
    sizes = [0]
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]:
            continue
        n += 1
        st = [(y0, x0)]; lab[y0, x0] = n; c = 0
        while st:
            y, x = st.pop(); c += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; st.append((yy, xx))
        sizes.append(c)
    sizes = np.array(sizes)
    keep = sizes >= min_px
    keep[0] = False
    a = a.copy()
    a[~keep[lab]] = 0
    return a


def split_cols(a, gap):
    filled = (a[..., 3] > 0).any(0)
    segs, start, empty = [], None, 0
    for x, f in enumerate(list(filled) + [False] * (gap + 1)):
        if f:
            if start is None:
                start = x
            empty = 0; end = x
        elif start is not None:
            empty += 1
            if empty > gap:
                segs.append((start, end + 1)); start = None
    segs = [s for s in segs if s[1] - s[0] > a.shape[1] // 40]
    return [a[:, s0:s1] for s0, s1 in segs]


def bbox(a):
    ys, xs = np.nonzero(a[..., 3])
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None


# ----------------------------------------------------------------------------- reduction
def quantise(frames, k):
    """One shared colour table for all frames (median cut of their opaque pixels): k colours, the source's own."""
    px = np.concatenate([f[f[..., 3] > 0][:, :3] for f in frames])
    if len(px) > 400000:
        px = px[np.random.RandomState(1).choice(len(px), 400000, replace=False)]
    side = int(np.ceil(np.sqrt(len(px))))
    tmp = np.zeros((side * side, 3), np.uint8); tmp[:len(px)] = px; tmp[len(px):] = px[0]
    q = Image.fromarray(tmp.reshape(side, side, 3)).quantize(k, method=Image.Quantize.MEDIANCUT)
    p = np.array(q.getpalette()[:k * 3], np.int32).reshape(-1, 3)
    # accents: bright saturated colours (eyes, glows) are rare, so median cut merges them into their
    # surroundings; they get up to 6 entries of their own
    h, s, v = hsv(px.reshape(1, -1, 3))
    acc = px[(s[0] > 0.55) & (v[0] > 0.7)]
    if len(acc) > 20:
        side = int(np.ceil(np.sqrt(len(acc))))
        tmp = np.zeros((side * side, 3), np.uint8); tmp[:len(acc)] = acc; tmp[len(acc):] = acc[0]
        qa = Image.fromarray(tmp.reshape(side, side, 3)).quantize(6, method=Image.Quantize.MEDIANCUT)
        p = np.concatenate([p, np.array(qa.getpalette()[:18], np.int32).reshape(-1, 3)])
    return p


def nearest(rgb, table):
    d = ((rgb[..., None, :].astype(np.int32) - table[None, None]) ** 2 * np.array([2, 4, 3])).sum(-1)
    return d.argmin(-1)


def reduce(a, w, h, table, sub=4):
    """Majority vote: the figure is box-filtered to sub x the target, each sample snapped to the colour table,
    then each HD pixel takes the colour most of its sub x sub samples have. Dark (outline) colours win with
    5 of 16 votes and bright saturated colours (eyes, glows) with 3, so thin lines and small eyes survive.
    Transparent when most samples are backdrop: hard alpha, no soft edge."""
    im = Image.fromarray(a)
    pm = a.astype(np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255
    big = np.array(Image.fromarray(pm[..., :3].astype(np.uint8)).resize((w * sub, h * sub), Image.BOX), np.float32)
    al = np.array(im.getchannel('A').resize((w * sub, h * sub), Image.BOX), np.float32)
    rgb = np.clip(big * 255 / np.maximum(al[..., None], 1), 0, 255).astype(np.uint8)
    idx = nearest(rgb, table)
    idx[al < 128] = -1
    lum = table @ np.array([0.3, 0.55, 0.15])
    th, ts, tv = hsv(table.astype(np.uint8).reshape(1, -1, 3))
    dark = lum < 45
    bright = (ts[0] > 0.55) & (tv[0] > 0.7)
    out = np.zeros((h, w, 4), np.uint8)
    blocks = idx.reshape(h, sub, w, sub).transpose(0, 2, 1, 3).reshape(h, w, sub * sub)
    for y in range(h):
        for x in range(w):
            b = blocks[y, x]
            if (b < 0).sum() * 2 > sub * sub:
                continue
            v = np.bincount(b[b >= 0], minlength=len(table))
            pick = v.argmax()
            acc = np.nonzero(bright & (v >= 3))[0]
            if len(acc):
                pick = acc[v[acc].argmax()]
            else:
                dk = np.nonzero(dark & (v >= 5))[0]
                if len(dk) and not dark[pick]:
                    pick = dk[v[dk].argmax()]
            out[y, x, :3] = table[pick]; out[y, x, 3] = 255
    return out


def tidy(a):
    """Lone pixels: an opaque pixel with no opaque 4-neighbour goes; a colour no 4-neighbour shares takes the
    majority of its 8 neighbours when 4 or more agree and it is neither dark nor bright (eyes and lines stay)."""
    H, W = a.shape[:2]
    src = a.copy()
    for y in range(H):
        for x in range(W):
            if not src[y, x, 3]:
                continue
            n4 = [src[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < H and 0 <= x + dx < W]
            if not any(n[3] for n in n4):
                a[y, x] = 0; continue
            c = tuple(src[y, x])
            if any(tuple(n) == c for n in n4):
                continue
            l = 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2]
            hh, ss, vv = hsv(np.array([[c[:3]]], np.uint8))
            if l < 45 or (ss[0, 0] > 0.55 and vv[0, 0] > 0.7):
                continue
            votes = {}
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if (dx or dy) and 0 <= y + dy < H and 0 <= x + dx < W and src[y + dy, x + dx, 3]:
                        k = tuple(src[y + dy, x + dx]); votes[k] = votes.get(k, 0) + 1
            if votes:
                best = max(votes, key=votes.get)
                if votes[best] >= 4:
                    a[y, x] = best
    return a


def edge_dark_share(a):
    m = a[..., 3] > 0
    pad = np.pad(m, 1)
    edge = m & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    lum = a[..., :3] @ np.array([0.3, 0.55, 0.15])
    return float((lum[edge] < 60).mean()) if edge.any() else 1.0


def outline(a, col):
    H, W = a.shape[:2]
    o = np.zeros((H + 2, W + 2, 4), np.uint8)
    o[1:-1, 1:-1] = a
    m = o[..., 3] > 0
    n = np.zeros_like(m)
    n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
    ring = n & ~m
    o[ring] = col + (255,)
    return o


def calm(a, below):
    """Idle variant of an attack pose: bright warm glow (orange / yellow) under the top `below` share of the figure
    is repainted with the frame's darkest-to-mid reds of the same brightness rank, so the chest stops glowing."""
    H = a.shape[0]
    h, s, v = hsv(a[..., :3])
    glow = (a[..., 3] > 0) & (s > 0.45) & (v > 0.62) & ((h < 60) | (h > 345))
    glow[:int(H * below)] = False
    body = (a[..., 3] > 0) & ~glow & ((h < 15) | (h > 340)) & (v > 0.2)
    reds = np.unique(a[body][:, :3], axis=0)
    if not len(reds):
        return a
    reds = reds[np.argsort(reds @ np.array([0.3, 0.55, 0.15]))]
    lo, hi = reds[len(reds) // 4], reds[len(reds) * 3 // 4]
    ys, xs = np.nonzero(glow)
    for y, x in zip(ys, xs):
        a[y, x, :3] = hi if v[y, x] > 0.85 else lo
    print('calm: %d glow pixels repainted' % len(ys))
    return a


def foot(a):
    """Width (HD px) of the opaque span in the lowest 12 % of the figure: sizes the contact shadow."""
    H = a.shape[0]
    xs = np.nonzero((a[int(H * 0.88):, :, 3] > 0).any(0))[0]
    return int(xs.max() - xs.min() + 1) if len(xs) else a.shape[1]


def anchor(a):
    """Feet centre: middle of the opaque pixels in the lowest 15 % of the figure (x share of the width), y = 1."""
    H, W = a.shape[:2]
    m = a[..., 3] > 0
    rows = m[int(H * 0.85):]
    xs = np.nonzero(rows.any(0))[0]
    if not len(xs):
        return 0.5
    return round((xs.min() + xs.max() + 1) / 2 / W, 4)


def preview(frames, name):
    os.makedirs(QA, exist_ok=True)
    bgc = pal()['f2']
    W = sum(f.shape[1] for f in frames) + 6 * (len(frames) + 1)
    H = max(f.shape[0] for f in frames) + 12
    bg = Image.new('RGBA', (W, H), bgc + (255,))
    x = 6
    for f in frames:
        bg.alpha_composite(Image.fromarray(f), (x, 6)); x += f.shape[1] + 6
    bg.resize((W * 4, H * 4), Image.NEAREST).save(os.path.join(QA, 'hd_%s.png' % name))


def parse_cells(s):
    out = []
    for part in s.split(','):
        if '-' in part:
            a, b = part.split('-'); out += list(range(int(a), int(b) + 1))
        elif part:
            out.append(int(part))
    return out


def cmd_import(a):
    src = Image.open(a.source)
    sheet = key_out(src, a.key_tol)
    sheet = components_clean(sheet, max(30, (sheet.shape[0] // 300) ** 2))
    cells = parse_cells(a.cells)
    if a.split == 'cols':
        figs = split_cols(sheet, max(2, sheet.shape[1] // 100))
        print('split: %d figures' % len(figs))
        frames = [figs[c] for c in cells]
    else:
        cols, rows = (int(v) for v in a.grid.lower().split('x'))
        cw, ch = sheet.shape[1] // cols, sheet.shape[0] // rows
        frames = [sheet[(c // cols) * ch:(c // cols + 1) * ch, (c % cols) * cw:(c % cols + 1) * cw] for c in cells]
    if a.own_box:
        boxes = [bbox(f) for f in frames]
        ref = boxes[a.ref] if a.ref is not None else max(boxes, key=lambda b: b[3] - b[1])
        scale = a.height / (ref[3] - ref[1])
        crops = [f[b[1]:b[3], b[0]:b[2]] for f, b in zip(frames, boxes)]
    else:
        # one shared box: animation frames stay aligned (feet on one row)
        bs = [bbox(f) for f in frames if bbox(f)]
        box = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
        scale = a.height / (box[3] - box[1])
        crops = [f[box[1]:box[3], box[0]:box[2]] for f in frames]
    table = quantise(crops, a.colors)
    names = a.names.split(',') if a.names else ['%s_%d' % (a.name, i) for i in range(len(crops))] if len(crops) > 1 else [a.name]
    ol = pal()['outline']
    out = []
    for nm, c in zip(names, crops):
        w, h = max(1, round(c.shape[1] * scale)), max(1, round(c.shape[0] * scale))
        r = tidy(reduce(c, w, h, table))
        if a.calm is not None:
            r = calm(r, a.calm)
        share = edge_dark_share(r)
        if a.outline == 'yes' or (a.outline == 'auto' and share < 0.7):
            r = outline(r, ol); how = 'outline added'
        else:
            how = 'own outline kept (%d %% of the edge is dark)' % round(share * 100)
        r = r[bbox(r)[1]:bbox(r)[3], bbox(r)[0]:bbox(r)[2]]
        os.makedirs(os.path.dirname(os.path.join(HD, nm + '.png')), exist_ok=True)
        Image.fromarray(r).save(os.path.join(HD, nm + '.png'))
        ncol = len(np.unique(r[r[..., 3] > 0][:, :3], axis=0))
        print('  %s: %dx%d HD px (%dx%d art px on screen), %d colours, %s' % (nm, r.shape[1], r.shape[0], (r.shape[1] + 1) // 2, (r.shape[0] + 1) // 2, ncol, how))
        out.append(r)
    preview(out, a.name)
    print('preview: qa/out/hd_%s.png' % a.name)
    pack()


# ----------------------------------------------------------------------------- floor
FLOOR = os.path.join(ROOT, 'assets', 'hd_floor.png')


def mix(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def code_floor(size=256, cell=8, seed=20261112):
    """A seamless flagstone floor at HD density: stones of 2-5 x 2-4 cells of `cell` HD px (16-40 HD px = 8-20 art px,
    placed on a 4 art px grid; the chunky floor's slabs are 8-24 art px on an 8 px grid), the chunky floor's ramp (f0-f4, fa, fb) with per-stone tone, a 1 px bevel
    (light top-left, dark bottom-right), 1-2 px grout, a few chips and hairline cracks, fine grain."""
    P = pal()
    rng = random.Random(seed)
    assert size % cell == 0
    n = size // cell
    owner = {}
    stones = []
    cells = [(cx, cy) for cy in range(n) for cx in range(n)]
    rng.shuffle(cells)
    for cx, cy in cells:
        if (cx, cy) in owner:
            continue
        for w, h in rng.sample([(3, 2), (4, 2), (2, 2), (3, 3), (4, 3), (2, 3), (5, 3), (3, 4), (4, 4), (5, 2)], 10):
            if all(((cx + i) % n, (cy + j) % n) not in owner for i in range(w) for j in range(h)):
                break
        else:
            w = 2 if ((cx + 1) % n, cy) not in owner else 1
            h = 2 if all(((cx + i) % n, (cy + 1) % n) not in owner for i in range(w)) else 1
        sid = len(stones)
        stones.append((cx, cy, w, h))
        for i in range(w):
            for j in range(h):
                owner[((cx + i) % n, (cy + j) % n)] = sid
    img = np.zeros((size, size, 3), np.int32)
    grout = np.array(P['f0'])
    img[:] = grout
    tones = [mix(P['f1'], P['f2'], 0.6), P['f2'], mix(P['f2'], P['f3'], 0.4), mix(P['f2'], P['f3'], 0.7), mix(P['f2'], P['fa'], 0.7), mix(P['f2'], P['fb'], 0.7)]
    for sid, (cx, cy, w, h) in enumerate(stones):
        base = np.array(rng.choice(tones), np.float32)
        hi = np.array(mix(tuple(base), P['f4'], 0.55), np.float32)
        lo = np.array(mix(tuple(base), P['f0'], 0.55), np.float32)
        x0, y0, pw, ph = cx * cell, cy * cell, w * cell, h * cell
        gx, gy = rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25)       # a slight slope of light across the stone
        # inset: grout 1 px on the right and bottom edge of every stone (2 px where two stones meet)
        for y in range(ph - 1):
            for x in range(pw - 1):
                c = base * (1 + gx * (x / pw - 0.5) * 0.4 + gy * (y / ph - 0.5) * 0.4)
                g = rng.random()
                if g < 0.10:
                    c = c * 0.9
                elif g > 0.93:
                    c = c * 1.08
                corner = (x == 0 or x == pw - 2) and (y == 0 or y == ph - 2)
                if corner:
                    c = (base + grout) / 2                                  # rounded corner
                elif y == 0 or x == 0:
                    c = hi if rng.random() < 0.85 else base
                elif y == ph - 2 or x == pw - 2:
                    c = lo
                img[(y0 + y) % size, (x0 + x) % size] = np.clip(c, 0, 255)
        # a chip or a hairline crack on some stones
        if rng.random() < 0.35:
            x, y = x0 + rng.randint(2, pw - 4), y0 + rng.randint(2, ph - 4)
            for _ in range(rng.randint(4, 9)):
                img[y % size, x % size] = lo * 0.8
                if rng.random() < 0.5:
                    img[(y - 1) % size, x % size] = hi * 0.9
                x += rng.choice((1, 1, 0)); y += rng.choice((-1, 0, 1))
                if not (x0 < x < x0 + pw - 2 and y0 < y < y0 + ph - 2):
                    break
        if rng.random() < 0.15:
            x, y = x0 + rng.randint(1, pw - 3), y0 + rng.randint(1, ph - 3)
            img[y % size, x % size] = lo; img[y % size, (x + 1) % size] = lo; img[(y + 1) % size, x % size] = (lo + base) / 2
    return np.clip(img, 0, 255).astype(np.uint8)


def texture_floor(path, size, mirror, colors, dim):
    """A user's square texture: centre square crop, reduced to size (or size / 2 and mirrored 2 x 2 so the
    tile has no seam), a light quantisation, darkened by `dim` to sit under the sprites like the code floor."""
    im = Image.open(path).convert('RGB')
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width - s) // 2 + s, (im.height - s) // 2 + s))
    half = size // 2 if mirror else size
    im = im.resize((half, half), Image.LANCZOS if s > half * 4 else Image.BOX)
    if colors:
        im = im.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    a = np.array(im, np.float32) * dim
    if mirror:
        top = np.concatenate([a, a[:, ::-1]], 1)
        a = np.concatenate([top, top[::-1]], 0)
    return np.clip(a, 0, 255).astype(np.uint8)


def cmd_floor(a):
    if a.source:
        img = texture_floor(a.source, a.size, not a.no_mirror, a.colors, a.dim)
        print('floor from %s: %dx%d HD px (%d art px square), mirrored: %s' % (os.path.basename(a.source), a.size, a.size, a.size // 2, not a.no_mirror))
    else:
        img = code_floor(a.size)
        print('code floor: %dx%d HD px (%d art px square), stones of 8-40 HD px' % (a.size, a.size, a.size // 2))
    Image.fromarray(img).save(FLOOR)
    os.makedirs(QA, exist_ok=True)
    big = np.tile(img, (2, 2, 1))
    Image.fromarray(big).resize((big.shape[1] * 2, big.shape[0] * 2), Image.NEAREST).save(os.path.join(QA, 'hd_floor.png'))
    print('wrote assets/hd_floor.png; preview (2x2 tiles, x2): qa/out/hd_floor.png')


# ----------------------------------------------------------------------------- cage + pack
def cage_frames():
    """Don Montoto's cage at HD: the chunky cage's bars and base (tools/pixelart.py) redrawn at 2x with a finer
    bevel, and the HD Don Montoto (assets/hd/parts/cage_montoto.png) standing behind the bars."""
    part = os.path.join(HD, 'parts', 'cage_montoto.png')
    if not os.path.exists(part):
        return {}
    P = pal()
    mo = Image.open(part).convert('RGBA')
    out = {}
    for f in range(2):
        W, H = 36, 44
        cg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        fig = mo if f == 0 else mo.crop((0, 0, mo.width, mo.height - 1)).resize((mo.width, mo.height - 1), Image.NEAREST)
        cg.alpha_composite(fig, ((W - fig.width) // 2, 38 - fig.height))
        a = np.array(cg)

        def rect(x, y, w, h, k):
            a[y:y + h, x:x + w, :3] = P[k]; a[y:y + h, x:x + w, 3] = 255
        rect(0, 36, 36, 8, 'iron1'); rect(0, 36, 36, 1, 'iron3'); rect(0, 37, 36, 1, 'iron2'); rect(0, 42, 36, 2, 'iron0')
        for x in range(3, 36, 7):
            rect(x, 38, 2, 2, 'iron0')                                       # rivets
            rect(x, 38, 1, 1, 'iron3')
        rect(0, 2, 36, 4, 'iron1'); rect(0, 2, 36, 1, 'iron3'); rect(0, 5, 36, 1, 'iron0')
        for x in (2, 10, 18, 26, 33):
            rect(x, 6, 3, 30, 'iron1'); rect(x, 6, 1, 30, 'iron3'); rect(x + 2, 6, 1, 30, 'iron0')
        out['cage_%d' % f] = outline(a, P['outline'])
    return out


def pack():
    items = {}
    if os.path.isdir(HD):
        for fn in sorted(os.listdir(HD)):
            if fn.endswith('.png'):
                items[fn[:-4]] = np.array(Image.open(os.path.join(HD, fn)).convert('RGBA'))
    items.update(cage_frames())
    if not items:
        print('no HD frames'); return
    W = 512
    order = sorted(items, key=lambda k: (-items[k].shape[0], k))
    x = y = 1; rowh = 0; place = []; points = json.load(open(os.path.join(HD, 'fx_points.json'))) if os.path.exists(os.path.join(HD, 'fx_points.json')) else {}; hands = json.load(open(os.path.join(HD, 'hand_points.json'))) if os.path.exists(os.path.join(HD, 'hand_points.json')) else {}
    frames = {}
    for k in order:
        h, w = items[k].shape[:2]
        if x + w + 1 > W:
            x = 1; y += rowh + 1; rowh = 0
        place.append((k, x, y))
        frames[k] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'anchor': {'x': anchor(items[k]), 'y': 1}, 'foot': foot(items[k])}
        if k in points:
            frames[k]['head'] = points[k]      # the weapon's glowing head, px from the frame's top left (tools/weapon_fx.py)
        if k in hands:
            frames[k]['hand'] = hands[k]       # where a held weapon goes: x, y, degrees, length (tools/hand_weapon.py)
        rowh = max(rowh, h); x += w + 1
    H = 1
    while H < y + rowh + 1:
        H *= 2
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for k, x, y in place:
        sheet.paste(Image.fromarray(items[k]), (x, y))
    sheet.save(os.path.join(ROOT, 'assets', 'hd_atlas.png'), optimize=True)
    with open(os.path.join(ROOT, 'assets', 'hd_atlas.json'), 'w') as f:
        json.dump({'frames': frames, 'meta': {'size': {'w': W, 'h': H}, 'scale': '1', 'density': 2}}, f, separators=(',', ':'))
    print('hd atlas %dx%d, %d frames: %s' % (W, H, len(frames), ' '.join(sorted(frames))))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    i = sp.add_parser('import', help='a figure or a sheet of frames -> assets/hd/<name>.png')
    i.add_argument('source')
    i.add_argument('--name', required=True, help='name (one frame) or prefix (<name>_0, _1...)')
    i.add_argument('--names', default='', help='frame names in order (overrides the prefix)')
    i.add_argument('--height', type=int, required=True, help='height in HD px (2 x art px) of the tallest frame, or of --ref')
    i.add_argument('--split', default='grid', choices=('grid', 'cols'), help='grid: --grid cells; cols: figures side by side')
    i.add_argument('--grid', default='1x1', help='COLSxROWS of a sheet')
    i.add_argument('--cells', default='0', help='cells (row-major) or figures to take, e.g. 0,1,2 or 0-9')
    i.add_argument('--own-box', action='store_true', help='each frame cropped to its own figure (one scale for all)')
    i.add_argument('--ref', type=int, default=None, help='with --own-box: the frame whose height is --height (default the tallest)')
    i.add_argument('--colors', type=int, default=40, help='colour table size shared by the frames (light quantisation)')
    i.add_argument('--outline', default='auto', choices=('auto', 'yes', 'no'), help='auto: add a 1 px dark outline only if the edge is not dark already')
    i.add_argument('--calm', type=float, default=None, help='repaint warm glow below this share of the height (idle from an attack pose)')
    i.add_argument('--key-tol', type=float, default=20, help='hue window round the backdrop colour, degrees')
    fl = sp.add_parser('floor', help='the HD dungeon floor -> assets/hd_floor.png')
    fl.add_argument('--from', dest='source', default=None, help='a square texture (png / jpg); default: the code-made floor')
    fl.add_argument('--size', type=int, default=256, help='tile size in HD px (power of two)')
    fl.add_argument('--no-mirror', action='store_true', help='the texture is seamless already: do not mirror it')
    fl.add_argument('--colors', type=int, default=64, help='light quantisation of a texture (0 = off)')
    fl.add_argument('--dim', type=float, default=1.0, help='brightness factor for a texture (e.g. 0.7 to sit darker)')
    sp.add_parser('pack', help='repack assets/hd/*.png')
    a = ap.parse_args()
    if a.cmd == 'import':
        cmd_import(a)
    elif a.cmd == 'floor':
        cmd_floor(a)
    else:
        pack()


if __name__ == '__main__':
    main()
