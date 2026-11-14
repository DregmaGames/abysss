#!/usr/bin/env python3
"""Held weapons by rarity from a generated 3x2 sheet (common, magic, rare, legendary, mythic, unique; upright weapons on
magenta) -> assets/hd/wpn_<type>_<n>.png, n = 0..5 in that order, scaled to the type's length in HD px. Ends with a pack.
    python3 -I tools/weapon_sheet.py SHEET --type sword --length 22
"""
import argparse, os, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD = os.path.join(ROOT, 'assets', 'hd')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('--type', required=True); ap.add_argument('--length', type=int, required=True)
    a = ap.parse_args()
    src = np.asarray(Image.open(a.sheet).convert('RGB')).astype(float)
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    mx = src.max(2); mn = src.min(2); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    back = (np.abs(((h - 323 + 180) % 360) - 180) < 30) & (d / (mx + 1e-9) > 0.35) & (mx > 120)
    H, W = back.shape
    for i in range(6):
        cx, cy = i % 3, i // 3
        x0, x1, y0, y1 = cx * W // 3, (cx + 1) * W // 3, cy * H // 2, (cy + 1) * H // 2
        al = ~back[y0:y1, x0:x1]
        ys, xs = np.nonzero(al)
        if not len(ys):
            print('  cell %d empty' % i); continue
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgb = src[y0 + by0:y0 + by1, x0 + bx0:x0 + bx1] / 255; A = al[by0:by1, bx0:bx1].astype(float)
        k = a.length / (by1 - by0); w = max(1, round((bx1 - bx0) * k))
        lin = rgb ** 2.2 * A[..., None]
        im = Image.fromarray((np.dstack([lin, A]) * 255).astype(np.uint8), 'RGBA').resize((w, a.length), Image.BOX)
        o = np.asarray(im).astype(float) / 255; AA = o[..., 3]
        c = (o[..., :3] / np.maximum(AA[..., None], 1e-6)) ** (1 / 2.2)
        out = Image.fromarray((np.dstack([c, AA > 0.45]) * 255).astype(np.uint8), 'RGBA')
        out.save(os.path.join(HD, 'wpn_%s_%d.png' % (a.type, i)))
        print('  wpn_%s_%d: %dx%d' % (a.type, i, out.width, out.height))
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'hd_atlas.py'), 'pack'], stdout=subprocess.DEVNULL)

if __name__ == '__main__':
    main()
