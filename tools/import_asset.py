#!/usr/bin/env python3
"""Import pipeline for generated art (Grok etc.) that code cannot draw well.

Input: an image of one sprite, or a grid of frames, on a MAGENTA background (see docs/grok-prompts.md).
Output: assets/imported/<name>_<n>.png at the game's art resolution, in the game's palette, with the
same 1 px outline as the code-drawn sprites. tools/pixelart.py packs everything in assets/imported/
into the atlas; a frame with the same name as a code-drawn one replaces it.

    python3 tools/import_asset.py raw/tyrant.jpg --name tyrant --grid 4x4 --cells 0,1 --height 34
    python3 tools/pixelart.py && python3 tools/build.py

Steps: magenta key (hue based, tolerant of JPEG noise and gradients) -> split the grid -> crop all
chosen frames to one shared box (keeps animation aligned) -> area-average down to the target height
-> hard alpha -> snap every pixel to the nearest palette colour (limited to --colors of them, so the
sprite keeps 2-3 shades per material) -> remove stray pixels -> outline -> save, plus an x6 preview.
"""
import argparse, colorsys, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def is_key(r, g, b):
    """True for the magenta backdrop (hue ~300 deg, strong saturation), whatever its brightness."""
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.76 <= h <= 0.95 and s > 0.45 and v > 0.25


def key_out(im):
    im = im.convert('RGB')
    w, h = im.size
    src = im.load()
    out = Image.new('RGBA', (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            dst[x, y] = (0, 0, 0, 0) if is_key(r, g, b) else (r, g, b, 255)
    return out


def bbox_of(frames):
    box = None
    for f in frames:
        b = f.getchannel('A').getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box


def downscale(im, height):
    """Area-average with premultiplied alpha, then a hard alpha edge (no soft pixels in pixel art)."""
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


def dist(c1, c2):
    dr, dg, db = c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]
    return 2 * dr * dr + 4 * dg * dg + 3 * db * db


def to_palette(frames, palette, colors, skip, keys):
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
    keep = [p for p in pal if p[0] in sorted(count, key=count.get, reverse=True)[:colors]]
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
    ap.add_argument('--single', action='store_true', help='one frame, saved as <name>.png (no _0 suffix)')
    a = ap.parse_args()

    with open(os.path.join(ROOT, 'assets', 'palette.json')) as f:
        palette = json.load(f)
    sheet = key_out(Image.open(a.source))
    cols, rows = (int(v) for v in a.grid.lower().split('x'))
    cw, ch = sheet.width // cols, sheet.height // rows
    cells = [int(c) for c in a.cells.split(',')]
    frames = [sheet.crop(((c % cols) * cw, (c // cols) * ch, (c % cols + 1) * cw, (c // cols + 1) * ch)) for c in cells]
    box = bbox_of(frames)
    if not box:
        sys.exit('nothing but magenta in the chosen cells')
    frames = [downscale(f.crop(box), a.height) for f in frames]
    if a.gamma != 1.0:
        lut = [round(255 * (i / 255) ** a.gamma) for i in range(256)]
        frames = [Image.merge('RGBA', [c.point(lut) for c in f.split()[:3]] + [f.getchannel('A')]) for f in frames]
    frames, used = to_palette(frames, palette, a.colors, set(a.skip.split(',')), [k for k in a.keys.split(',') if k])
    ol = palette['outline']
    ol = (int(ol[1:3], 16), int(ol[3:5], 16), int(ol[5:7], 16), 255)
    frames = [add_outline(despeckle(f), ol) for f in frames]
    os.makedirs(a.out, exist_ok=True)
    names = []
    for i, f in enumerate(frames):
        nm = a.name if a.single else '%s_%d' % (a.name, i)
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
