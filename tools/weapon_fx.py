#!/usr/bin/env python3
"""Weapon glow masks for the HD hero frames (the rarity glow of src/view/hd.js).

    python3 tools/weapon_fx.py mage            # writes assets/hd/fx_<frame>.png for every assets/hd/mage_*.png, then packs
    python3 tools/weapon_fx.py mage --preview qa/out/fx_mage.png

A mask is white with alpha: the weapon's own pixels, a 3 px halo around them and a wider soft halo round the weapon's
head (the mage's crystal). It is PAD px bigger than its frame on every side so the halo is not cut; the view draws it
over the hero with the frame's own transform, tinted with the rarity colour, additive.

How the weapon is found (per class, by colour; the sheets are generated art, so this is a heuristic to look at):
  mage: only the staff's crystal glows (the user's call: not the whole staff) = the saturated cyan pixels.
"""
import argparse, glob, json, os, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD = os.path.join(ROOT, 'assets', 'hd')
PAD = 8


def hsv(a):
    r, g, b = a[..., 0] / 255.0, a[..., 1] / 255.0, a[..., 2] / 255.0
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-9), mx


def mage_mask(im):
    a = np.asarray(im.convert('RGBA')).astype(float)
    op = a[..., 3] > 127
    h, s, v = hsv(a)
    crystal = op & (h > 165) & (h < 215) & (s > 0.35) & (v > 0.45)
    if crystal.sum() < 4:
        return np.zeros(op.shape, bool), None
    ys, xs = np.nonzero(crystal)
    cx, cy = xs.mean(), ys.mean()
    return crystal, (cx, cy)


def grow(m):
    o = m.copy()
    o[1:, :] |= m[:-1, :]; o[:-1, :] |= m[1:, :]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    return o


def fx_image(mask, head):
    H, W = mask.shape
    big = np.zeros((H + 2 * PAD, W + 2 * PAD), bool); big[PAD:PAD + H, PAD:PAD + W] = mask
    alpha = np.zeros(big.shape, float)
    ring = big
    for k, al in enumerate((150, 95, 45)):            # 3 px halo
        nxt = grow(ring); alpha[nxt & ~ring] = al; ring = nxt
    alpha[big] = 235
    if head is not None:                              # a soft round halo at the weapon's head
        yy, xx = np.mgrid[0:big.shape[0], 0:big.shape[1]]
        d = np.sqrt((xx - head[0] - PAD) ** 2 + (yy - head[1] - PAD) ** 2)
        alpha = np.maximum(alpha, np.clip(1 - d / 9.0, 0, 1) ** 1.6 * 150)
    out = np.zeros(big.shape + (4,), np.uint8); out[..., :3] = 255; out[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


FINDERS = {'mage': mage_mask}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cls', choices=sorted(FINDERS))
    ap.add_argument('--preview')
    a = ap.parse_args()
    files = sorted(f for f in glob.glob(os.path.join(HD, a.cls + '_*.png')))
    shots = []
    pf = os.path.join(HD, 'fx_points.json')
    points = json.load(open(pf)) if os.path.exists(pf) else {}
    for f in files:
        im = Image.open(f).convert('RGBA')
        mask, head = FINDERS[a.cls](im)
        name = os.path.basename(f)
        if not mask.any():
            print('  %s: no weapon found, no mask' % name); continue
        fx = fx_image(mask, head)
        fx.save(os.path.join(HD, 'fx_' + name))
        points[name[:-4]] = [round(head[0]), round(head[1])]      # where the sparks come from (frame px), carried by the atlas
        print('  fx_%s: %d weapon px' % (name, int(mask.sum())))
        if a.preview:
            base = Image.new('RGBA', fx.size, (40, 42, 54, 255)); base.alpha_composite(im, (PAD, PAD))
            tint = Image.new('RGBA', fx.size, (255, 148, 52, 0)); tint.putalpha(fx.getchannel('A').point(lambda v: int(v * 0.8)))
            lit = base.copy(); lit.alpha_composite(tint)
            both = Image.new('RGBA', (fx.width * 2, fx.height), (0, 0, 0, 255)); both.paste(base, (0, 0)); both.paste(lit, (fx.width, 0))
            shots.append(both)
    if a.preview and shots:
        W = sum(s.width for s in shots) + 6 * len(shots); Hh = max(s.height for s in shots)
        sheet = Image.new('RGBA', (W, Hh), (255, 255, 255, 255)); x = 0
        for s in shots:
            sheet.paste(s, (x, 0)); x += s.width + 6
        os.makedirs(os.path.dirname(os.path.abspath(a.preview)), exist_ok=True)
        sheet.resize((W * 3, Hh * 3), Image.NEAREST).save(a.preview)
    json.dump(points, open(pf, 'w'), indent=0, sort_keys=True)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'hd_atlas.py'), 'pack'])


if __name__ == '__main__':
    main()
