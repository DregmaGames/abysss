#!/usr/bin/env python3
"""Import pipeline for generated art (Grok etc.) that code cannot draw well.

Input: an image of one sprite, or a grid of frames, on a MAGENTA background (see docs/grok-prompts.md).
Output: assets/imported/<name>_<n>.png at the game's art resolution, in the game's palette, with the
same 1 px outline as the code-drawn sprites. tools/pixelart.py packs everything in assets/imported/
into the atlas; a frame with the same name as a code-drawn one replaces it.

    python3 tools/import_asset.py raw/tyrant.jpg --name tyrant --grid 4x4 --cells 0,1 --height 34
    python3 tools/pixelart.py && python3 tools/build.py

Steps: backdrop key (the border colour, hue based: tolerant of JPEG noise and gradients, works for magenta
and hot pink; a layer PNG's own alpha is kept) -> split the grid or the figures -> crop all
chosen frames to one shared box (keeps animation aligned) -> area-average down to the target height
-> hard alpha -> snap every pixel to the nearest palette colour (limited to --colors of them, so the
sprite keeps 2-3 shades per material) -> remove stray pixels -> outline -> save, plus an x6 preview.
"""
import argparse, colorsys, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def border_key(im):
    """The backdrop colour: the median of the image border (magenta, hot pink...)."""
    im = im.convert('RGB')
    w, h = im.size
    px = im.load()
    ring = [px[x, y] for x in range(0, w, 4) for y in (0, 1, h - 2, h - 1)] + [px[x, y] for y in range(0, h, 4) for x in (0, 1, w - 2, w - 1)]
    return tuple(sorted(c[i] for c in ring)[len(ring) // 2] for i in range(3))


def keyer(key, tol, sat, val):
    """True for backdrop pixels: hue within `tol` degrees of the key colour's hue, saturated and not dark.
    A narrow hue window keeps purple robes (hue ~270) when the backdrop is hot pink (~330) or magenta (~300)."""
    kh = colorsys.rgb_to_hsv(*(c / 255 for c in key))[0] * 360

    def is_key(r, g, b):
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        d = abs(h * 360 - kh)
        return min(d, 360 - d) <= tol and s > sat and v > val
    return is_key


def key_out(im, is_key):
    """Backdrop -> transparent. A source with alpha (a layer PNG) keeps its own transparency as well."""
    if im.mode in ('P', 'PA', 'LA') or 'transparency' in im.info:
        im = im.convert('RGBA')
    alpha = im.getchannel('A').load() if im.mode == 'RGBA' else None
    rgb = im.convert('RGB')
    w, h = rgb.size
    src = rgb.load()
    out = Image.new('RGBA', (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            dst[x, y] = (0, 0, 0, 0) if (alpha is not None and alpha[x, y] < 128) or is_key(r, g, b) else (r, g, b, 255)
    return out


def split_cols(im, n_min_gap):
    """Figures side by side with any spacing: runs of columns holding opaque pixels, split on gaps of empty columns."""
    a = im.getchannel('A')
    w, h = im.size
    filled = [a.crop((x, 0, x + 1, h)).getbbox() is not None for x in range(w)]
    segs, start, gap = [], None, 0
    for x, f in enumerate(filled + [False] * (n_min_gap + 1)):
        if f:
            if start is None:
                start = x
            gap = 0; end = x
        elif start is not None:
            gap += 1
            if gap > n_min_gap:
                segs.append((start, end + 1)); start = None
    segs = [s for s in segs if s[1] - s[0] > w // 40]          # crumbs are not figures
    return [im.crop((s0, 0, s1, h)) for s0, s1 in segs]


def bbox_of(frames):
    box = None
    for f in frames:
        b = f.getchannel('A').getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box


def downscale(im, height, scale=None):
    """Area-average with premultiplied alpha, then a hard alpha edge (no soft pixels in pixel art).
    `scale` (art px per source px) overrides `height`, so frames of different sizes keep one scale."""
    if scale:
        height = max(1, round(im.height * scale))
    w = max(1, round(im.width * height / im.height))
    pm = im.copy()
    px = pm.load()
    for y in range(pm.height):
        for x in range(pm.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r * a // 255, g * a // 255, b * a // 255, a)
    small = pm.resize((w, height), Image.BOX)
    px = small.load()
    for y in range(height):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), 255) if a >= 128 else (0, 0, 0, 0)
    return small


def downscale_mode(im, height, scale, pal, sub=4, accent=()):
    """Majority vote instead of the average, for sources that are already pixel art: reduce to `sub` x the
    target, snap those pixels to the palette, then each art pixel takes the colour most of its sub x sub
    pixels have (transparent if most are). Flat areas and dark outlines survive; averages would mix them to mud.
    `accent` colours (eyes, glows) win a pixel with only 2 of its sub x sub votes, so a tiny eye is not voted away."""
    if scale:
        height = max(1, round(im.height * scale))
    w = max(1, round(im.width * height / im.height))
    pm = im.copy()
    px = pm.load()
    for y in range(pm.height):
        for x in range(pm.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r * a // 255, g * a // 255, b * a // 255, a)
    big = pm.resize((w * sub, height * sub), Image.BOX)
    bp = big.load()
    cache = {}
    cols = [[None] * (w * sub) for _ in range(height * sub)]
    for y in range(height * sub):
        for x in range(w * sub):
            r, g, b, a = bp[x, y]
            if a >= 128:
                c = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a))
                q = (c[0] >> 2, c[1] >> 2, c[2] >> 2)
                if q not in cache:
                    cache[q] = min(pal, key=lambda p: dist(p[1], c))[1]
                cols[y][x] = cache[q]
    out = Image.new('RGBA', (w, height), (0, 0, 0, 0))
    op = out.load()
    for y in range(height):
        for x in range(w):
            votes = {}
            for yy in range(y * sub, y * sub + sub):
                for xx in range(x * sub, x * sub + sub):
                    c = cols[yy][xx]
                    votes[c] = votes.get(c, 0) + 1
            if votes.get(None, 0) * 2 > sub * sub:
                continue
            votes.pop(None, None)
            acc = [c for c in votes if c in accent and votes[c] >= 2]
            op[x, y] = (max(acc, key=votes.get) if acc else max(votes, key=votes.get)) + (255,)
    return out


def dist(c1, c2):
    dr, dg, db = c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]
    return 2 * dr * dr + 4 * dg * dg + 3 * db * db


def to_palette(frames, palette, colors, skip, keys, accent=()):
    """Snap to the game palette; keep only the `colors` most used entries so shading stays flat.
    `keys` (prefixes) restricts the choice to named material ramps, e.g. ty,horn,em."""
    pal = [(k, (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16))) for k, v in palette.items()
           if not k.startswith(('ui_', 'r_')) and k not in skip and (not keys or k.startswith(tuple(keys)))]
    count = {}
    for f in frames:
        for r, g, b, a in list(f.get_flattened_data() if hasattr(f, 'get_flattened_data') else f.getdata()):
            if a:
                k = min(pal, key=lambda p: dist(p[1], (r, g, b)))[0]
                count[k] = count.get(k, 0) + 1
    top = sorted(count, key=count.get, reverse=True)[:colors]
    keep = [p for p in pal if p[0] in top or (accent and p[0] in count and p[0].startswith(tuple(accent)))]   # accents never capped
    out = []
    for f in frames:
        g2 = f.copy()
        px = g2.load()
        for y in range(g2.height):
            for x in range(g2.width):
                r, g, b, a = px[x, y]
                if a:
                    px[x, y] = min(keep, key=lambda p: dist(p[1], (r, g, b)))[1] + (255,)
        out.append(g2)
    return out, [k for k, _ in keep]


def family(key):
    """Material ramp of a palette key: ty0..ty3 -> ty, horn / horn_d -> horn, eye_y -> eye."""
    return key.rstrip('0123456789').split('_')[0]


def smooth(im, names):
    """Flatten shading noise: a pixel whose colour no 4-neighbour shares takes the colour most of its
    8 neighbours have, but only within the same material ramp (an eye or a glint is kept)."""
    px = im.load()
    w, h = im.size
    src = im.copy().load()
    for y in range(h):
        for x in range(w):
            c = src[x, y]
            if not c[3]:
                continue
            n4 = [src[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h]
            if any(n == c for n in n4):
                continue
            votes = {}
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if (dx or dy) and 0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3]:
                        votes[src[x + dx, y + dy]] = votes.get(src[x + dx, y + dy], 0) + 1
            if not votes:
                continue
            best = max(votes, key=votes.get)
            if votes[best] >= 3 and family(names.get(best[:3], '?')) == family(names.get(c[:3], '!')):
                px[x, y] = best
    return im


def despeckle(im):
    """Drop opaque pixels with no opaque 4-neighbour (JPEG crumbs)."""
    px = im.load()
    w, h = im.size
    kill = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and not any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3]
                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                kill.append((x, y))
    for x, y in kill:
        px[x, y] = (0, 0, 0, 0)
    return im


def add_outline(im, col):
    w, h = im.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(im, (1, 1))
    src = out.copy().load()
    dst = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            if any(0 <= x + dx < w + 2 and 0 <= y + dy < h + 2 and src[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                dst[x, y] = col
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('source')
    ap.add_argument('--name', required=True, help='frame name prefix, e.g. tyrant -> tyrant_0, tyrant_1')
    ap.add_argument('--grid', default='1x1', help='COLSxROWS of the source sheet')
    ap.add_argument('--cells', default='0', help='comma-separated cell indices (row-major) to import, in frame order')
    ap.add_argument('--height', type=int, required=True, help='sprite height in art pixels (before the outline)')
    ap.add_argument('--colors', type=int, default=8, help='max palette colours kept')
    ap.add_argument('--skip', default='void,white', help='palette keys never used')
    ap.add_argument('--keys', default='', help='only these palette ramps (comma-separated key prefixes, e.g. ty,horn,em)')
    ap.add_argument('--gamma', type=float, default=1.0, help='<1 lifts a dark source before the palette snap')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'imported'))
    ap.add_argument('--names', default='', help='frame names in order, e.g. tyrant_2,tyrant_3,tyrant_4 (default <name>_0, _1...)')
    ap.add_argument('--single', action='store_true', help='one frame, saved as <name>.png (no _0 suffix)')
    ap.add_argument('--key', default='auto', help='backdrop colour #RRGGBB, or auto (median of the image border)')
    ap.add_argument('--key-tol', type=float, default=20, help='hue window round the key colour, in degrees')
    ap.add_argument('--key-sat', type=float, default=0.45, help='minimum saturation of a backdrop pixel')
    ap.add_argument('--key-val', type=float, default=0.3, help='minimum brightness of a backdrop pixel (darker = outline, kept)')
    ap.add_argument('--method', default='box', choices=('box', 'mode'), help='box: area average (painted sources); mode: majority vote of palette colours (pixel-art sources)')
    ap.add_argument('--accent', default='', help='mode method: palette keys (prefixes) that win a pixel with few votes: eyes, glows')
    ap.add_argument('--smooth', type=int, default=0, help='passes of the shading-noise filter (same material ramp only)')
    ap.add_argument('--split', default='grid', choices=('grid', 'cols'), help='grid: --grid cells; cols: figures side by side split on empty columns')
    ap.add_argument('--own-box', action='store_true', help='crop each frame to its own figure (same scale; the tallest is --height)')
    a = ap.parse_args()

    with open(os.path.join(ROOT, 'assets', 'palette.json')) as f:
        palette = json.load(f)
    src = Image.open(a.source)
    key = border_key(src) if a.key == 'auto' else tuple(int(a.key.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    print('key colour #%02x%02x%02x, hue window +-%d deg' % (key + (a.key_tol,)))
    sheet = key_out(src, keyer(key, a.key_tol, a.key_sat, a.key_val))
    cells = [int(c) for c in a.cells.split(',')]
    if a.split == 'cols':
        figs = split_cols(sheet, max(2, sheet.width // 100))
        print('split: %d figures found' % len(figs))
        frames = [figs[c] for c in cells]
    else:
        cols, rows = (int(v) for v in a.grid.lower().split('x'))
        cw, ch = sheet.width // cols, sheet.height // rows
        frames = [sheet.crop(((c % cols) * cw, (c // cols) * ch, (c % cols + 1) * cw, (c // cols + 1) * ch)) for c in cells]
    box = bbox_of(frames)
    if not box:
        sys.exit('nothing but backdrop in the chosen cells')
    skip = set(a.skip.split(','))
    keys = [k for k in a.keys.split(',') if k]
    pal = [(k, (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16))) for k, v in palette.items()
           if not k.startswith(('ui_', 'r_')) and k not in skip and (not keys or k.startswith(tuple(keys)))]
    if a.gamma != 1.0:
        lut = [round(255 * (i / 255) ** a.gamma) for i in range(256)]
        frames = [Image.merge('RGBA', [c.point(lut) for c in f.split()[:3]] + [f.getchannel('A')]) for f in frames]

    accent = set(c for k, c in pal if a.accent and k.startswith(tuple(a.accent.split(','))))

    def shrink(f, height, scale=None):
        return downscale_mode(f, height, scale, pal, accent=accent) if a.method == 'mode' else downscale(f, height, scale)
    if a.own_box:
        # each frame cropped to its own box (feet on its bottom row, centred on its own figure); one scale for all,
        # set so the tallest frame is --height
        boxes = [f.getchannel('A').getbbox() for f in frames]
        scale = a.height / max(b[3] - b[1] for b in boxes)
        frames = [shrink(f.crop(b), 0, scale) for f, b in zip(frames, boxes)]
    else:
        frames = [shrink(f.crop(box), a.height) for f in frames]
    frames, used = to_palette(frames, palette, a.colors, set(a.skip.split(',')), [k for k in a.keys.split(',') if k], [k for k in a.accent.split(',') if k])
    names = {(int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16)): k for k, v in palette.items()}
    for _ in range(a.smooth):
        frames = [smooth(f, names) for f in frames]
    ol = palette['outline']
    ol = (int(ol[1:3], 16), int(ol[3:5], 16), int(ol[5:7], 16), 255)
    frames = [add_outline(despeckle(f), ol) for f in frames]
    os.makedirs(a.out, exist_ok=True)
    names = []
    for i, f in enumerate(frames):
        nm = a.names.split(',')[i] if a.names else a.name if a.single else '%s_%d' % (a.name, i)
        f.save(os.path.join(a.out, nm + '.png'))
        names.append(nm)
    prev = Image.new('RGBA', (sum(f.width for f in frames) + 4 * len(frames), max(f.height for f in frames) + 4), (40, 39, 51, 255))
    x = 2
    for f in frames:
        prev.alpha_composite(f, (x, 2)); x += f.width + 4
    qa = os.path.join(ROOT, 'qa', 'out')
    os.makedirs(qa, exist_ok=True)
    prev.resize((prev.width * 6, prev.height * 6), Image.NEAREST).save(os.path.join(qa, 'import_%s.png' % a.name))
    print('imported %s: %dx%d art px, palette keys %s' % (', '.join(names), frames[0].width, frames[0].height, ' '.join(used)))
    print('preview: qa/out/import_%s.png   next: python3 tools/pixelart.py && python3 tools/build.py' % a.name)


if __name__ == '__main__':
    main()
