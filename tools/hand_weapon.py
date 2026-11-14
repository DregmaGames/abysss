#!/usr/bin/env python3
"""Visible equipment, the weapon in the hand (test). Two jobs:

    python3 -I tools/hand_weapon.py hands warrior_bare [--preview out.png]
        A hero sheet generated holding a flat bright GREEN rod (a placeholder): for every assets/hd/<name>_*.png find the
        rod, record where the weapon goes (the point where the rod leaves the fist, its direction, its length) in
        assets/hd/hand_points.json, and take the rod out of the frame (over the body its pixels are filled from their
        neighbours; elsewhere they become transparent). The untouched frames are kept in assets/hd/raw_rod/.
    python3 -I tools/hand_weapon.py weapon SHEET --guard X,Y --tip X,Y --scale S --name sword [--key-hue 323]
        Cut one weapon out of a generated image (a straight weapon over the flat backdrop): everything from 8 px behind
        the guard point to the tip, turned upright (tip up, the guard point at the bottom centre) and scaled to HD
        pixels -> assets/hd/wpn_<name>.png.
Both end with hd_atlas.py pack, which stores the hand of a frame as `hand: [x, y, degrees, length]` (frame px, x right,
y down, the angle from the fist to the tip). src/view/hd.js draws wpn_<type> there, turned to that angle.
Run with -I on downloaded art.
"""
import argparse, glob, json, math, os, shutil, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD = os.path.join(ROOT, 'assets', 'hd')
RAW = os.path.join(HD, 'raw_rod')


def hsv(a):
    r, g, b = a[..., 0] / 255.0, a[..., 1] / 255.0, a[..., 2] / 255.0
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-9), mx


def find_rod(a):
    op = a[..., 3] > 127
    h, s, v = hsv(a.astype(float))
    core = op & (h > 85) & (h < 160) & (s > 0.45) & (v > 0.3)
    if core.sum() < 5:
        return core, None
    # its dark outline too: greenish or dark pixels touching the rod that have little body around them
    rod = core.copy(); H, W = op.shape
    for _ in range(2):
        add = []
        for y, x in zip(*np.nonzero(op & ~rod)):
            y0, y1, x0, x1 = max(0, y - 1), min(H, y + 2), max(0, x - 1), min(W, x + 2)
            if not rod[y0:y1, x0:x1].any():
                continue
            greenish = 70 < h[y, x] < 175 and s[y, x] > 0.22
            free = 9 - int((op[y0:y1, x0:x1] & ~rod[y0:y1, x0:x1]).sum())      # neighbours that are rod, empty or off the frame
            if greenish or (v[y, x] < 0.3 and free >= 5):
                add.append((y, x))
        for y, x in add:
            rod[y, x] = True
    rodc = core
    ys, xs = np.nonzero(rodc)
    pts = np.stack([xs, ys], 1).astype(float); c = pts.mean(0)
    w, vec = np.linalg.eigh(np.cov((pts - c).T)); d = vec[:, np.argmax(w)]
    proj = (pts - c) @ d
    order = np.argsort(proj); ps = proj[order]
    # the fist hides a piece of the rod: the widest gap splits it; the longer side is the weapon
    gaps = np.diff(ps); k = int(np.argmax(gaps)) if len(gaps) else 0
    by, bx = np.nonzero(op & ~rod); body = np.array([bx.mean(), by.mean()])
    if len(gaps) and gaps[k] > 2.5:
        lo, hi = ps[:k + 1], ps[k + 1:]
        if (hi[-1] - hi[0]) >= (lo[-1] - lo[0]):
            grip, tip = c + d * hi[0], c + d * hi[-1]
        else:
            grip, tip = c + d * lo[-1], c + d * lo[0]
    else:                                             # one piece: the end nearer the body is the fist
        e0, e1 = c + d * ps[0], c + d * ps[-1]
        grip, tip = (e0, e1) if np.linalg.norm(e0 - body) < np.linalg.norm(e1 - body) else (e1, e0)
    ang = math.degrees(math.atan2(tip[1] - grip[1], tip[0] - grip[0]))
    return rod, [round(float(grip[0]), 1), round(float(grip[1]), 1), round(ang, 1), round(float(np.linalg.norm(tip - grip)), 1)]


def remove_rod(a, rod):
    """Rod pixels with body on several sides take the commonest neighbour colour (two passes); the rest go transparent."""
    out = a.copy(); todo = rod.copy(); H, W = rod.shape
    for _ in range(3):
        filled = []
        for y, x in zip(*np.nonzero(todo)):
            nb = [tuple(out[yy, xx]) for yy in range(max(0, y - 1), min(H, y + 2)) for xx in range(max(0, x - 1), min(W, x + 2))
                  if not todo[yy, xx] and out[yy, xx, 3] > 127]
            if len(nb) >= 4:
                filled.append((y, x, max(set(nb), key=nb.count)))
        if not filled:
            break
        for y, x, col in filled:
            out[y, x] = col; todo[y, x] = False
    out[todo] = (0, 0, 0, 0)
    return out


def cmd_hands(a):
    os.makedirs(RAW, exist_ok=True)
    pf = os.path.join(HD, 'hand_points.json')
    points = json.load(open(pf)) if os.path.exists(pf) else {}
    shots = []
    for f in sorted(glob.glob(os.path.join(HD, a.name + '_*.png'))):
        base = os.path.basename(f); raw = os.path.join(RAW, base)
        # a frame that still has its rod is a new import: it replaces the kept copy (else the old drawing would come back)
        if not os.path.exists(raw) or find_rod(np.asarray(Image.open(f).convert('RGBA')))[1] is not None:
            shutil.copy(f, raw)
        im = np.asarray(Image.open(raw).convert('RGBA'))
        rod, hand = find_rod(im)
        if hand is None:
            print('  %s: no rod found' % base); continue
        clean = remove_rod(im, rod)
        Image.fromarray(clean, 'RGBA').save(f)
        points[base[:-4]] = hand
        print('  %s: hand %s, %d rod px' % (base, hand, int(rod.sum())))
        if a.preview:
            Z = 6; W, H = im.shape[1], im.shape[0]
            pv = Image.new('RGBA', (W * 2 + 4, H), (40, 42, 54, 255))
            pv.alpha_composite(Image.fromarray(im, 'RGBA'), (0, 0)); pv.alpha_composite(Image.fromarray(clean, 'RGBA'), (W + 4, 0))
            pv = pv.resize((pv.width * Z, pv.height * Z), Image.NEAREST)
            from PIL import ImageDraw
            d = ImageDraw.Draw(pv); gx, gy = (W + 4 + hand[0] + 0.5) * Z, (hand[1] + 0.5) * Z; t = math.radians(hand[2])
            d.line((gx, gy, gx + math.cos(t) * hand[3] * Z, gy + math.sin(t) * hand[3] * Z), fill=(255, 80, 80, 255), width=2)
            d.ellipse((gx - 4, gy - 4, gx + 4, gy + 4), outline=(255, 255, 0, 255))
            shots.append(pv)
    json.dump(points, open(pf, 'w'), indent=0, sort_keys=True)
    if a.preview and shots:
        Wt = sum(s.width for s in shots) + 8 * len(shots); Ht = max(s.height for s in shots)
        sheet = Image.new('RGBA', (Wt, Ht), (255, 255, 255, 255)); x = 0
        for s in shots:
            sheet.paste(s, (x, 0)); x += s.width + 8
        sheet.save(a.preview)


def cmd_weapon(a):
    gx, gy = [float(v) for v in a.guard.split(',')]; tx, ty = [float(v) for v in a.tip.split(',')]
    src = np.asarray(Image.open(a.source).convert('RGB')).astype(float)
    h, s, v = hsv(src)
    back = (np.abs(((h - a.key_hue + 180) % 360) - 180) < 32) & (s > 0.28) & (v > 0.3)      # wide: the JPEG halo of the backdrop too
    grow = back.copy(); grow[1:, :] |= back[:-1, :]; grow[:-1, :] |= back[1:, :]; grow[:, 1:] |= back[:, :-1]; grow[:, :-1] |= back[:, 1:]
    back = grow                                       # and one more pixel of edge
    L = math.hypot(tx - gx, ty - gy); dx, dy = (tx - gx) / L, (ty - gy) / L
    Y, X = np.mgrid[0:src.shape[0], 0:src.shape[1]]
    along = (X - gx) * dx + (Y - gy) * dy; across = -(X - gx) * dy + (Y - gy) * dx
    keep = ~back & (along > -a.behind) & (along < L + 4) & (np.abs(across) < a.half)
    # sample the kept pixels into an upright image at HD scale (area average over each target pixel)
    S = a.scale; w = int(math.ceil(a.half * 2 * S)) | 1; hgt = int(math.ceil((L + a.behind + 4) * S))
    acc = np.zeros((hgt, w, 4)); cnt = np.zeros((hgt, w))
    ys, xs = np.nonzero((along > -a.behind - 2) & (along < L + 6) & (np.abs(across) < a.half + 2))
    for y, x in zip(ys, xs):
        u = int((across[y, x] + a.half) * S); t = int((L + 4 - along[y, x]) * S)
        if 0 <= u < w and 0 <= t < hgt:
            cnt[t, u] += 1
            if keep[y, x]:
                acc[t, u, :3] += src[y, x]; acc[t, u, 3] += 1
    out = np.zeros((hgt, w, 4), np.uint8)
    solid = (acc[..., 3] * 2 >= np.maximum(cnt, 1)) & (cnt > 0)
    out[solid, :3] = (acc[solid, :3] / acc[solid, 3:4]).astype(np.uint8); out[solid, 3] = 255
    im = Image.fromarray(out, 'RGBA')
    q = im.convert('RGB').quantize(12, method=Image.MEDIANCUT).convert('RGBA'); q.putalpha(im.getchannel('A'))
    # the guard point sits at the bottom centre: drop the rows under it
    bottom = int((L + 4 + a.behind) * S)
    q = q.crop((0, 0, w, min(hgt, bottom)))
    bb = q.getbbox(); q = q.crop((0, bb[1], w, bb[3]))
    q.save(os.path.join(HD, 'wpn_%s.png' % a.name))
    print('  wpn_%s: %dx%d HD px' % (a.name, q.width, q.height))


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    h = sp.add_parser('hands'); h.add_argument('name'); h.add_argument('--preview')
    w = sp.add_parser('weapon'); w.add_argument('source'); w.add_argument('--guard', required=True); w.add_argument('--tip', required=True)
    w.add_argument('--scale', type=float, required=True); w.add_argument('--name', required=True); w.add_argument('--key-hue', type=float, default=323)
    w.add_argument('--half', type=float, default=22, help='half width of the cut, source px'); w.add_argument('--behind', type=float, default=8)
    a = ap.parse_args()
    (cmd_hands if a.cmd == 'hands' else cmd_weapon)(a)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'hd_atlas.py'), 'pack'])


if __name__ == '__main__':
    main()
