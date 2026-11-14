#!/usr/bin/env python3
"""Import the user's Grok UI buttons into assets/hd/ (then `hd_atlas.py pack`).

    python3 -I tools/ui_import.py BUTTONS.jpg ICONS.jpg

BUTTONS: 2 rows x 3 (gold, iron) x (normal, hover, pressed), empty, on a flat background -> ui_main, ui_main_hot, ui_main_down,
         ui_btn, ui_btn_hot, ui_btn_down: nine-slice sources (UI.panel stretches the middle; ui.js UI_HD gives the borders).
ICONS:   1 row of 5 square buttons: gear, close, left, right, bag -> ui_i_gear, ui_i_close, ui_i_left, ui_i_right, ui_i_bag.
The hover button's outer glow is cut off with the normal button's outline (same shape); the game draws its own glow.
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD = os.path.join(ROOT, 'assets', 'hd')
BTN_H, ICON_H = 44, 36          # HD px (2 per art px)


def parts(path, n_min):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int)
    bg = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3)]), 0)
    # the button: far from the background colour and not the glow's warm pink (glow = background mixed with yellow)
    d = np.abs(a - bg).sum(2)
    fg = d > 120
    fg = ndimage.binary_fill_holes(ndimage.binary_opening(fg, iterations=2))
    lab, k = ndimage.label(fg)
    sl = [(s, i + 1) for i, s in enumerate(ndimage.find_objects(lab)) if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > a.size / 3 / 200]
    sl.sort(key=lambda t: (t[0][0].start // (a.shape[0] // 4), t[0][1].start))
    assert len(sl) >= n_min, (path, len(sl))
    return im, a, lab, sl


def cut(im, lab, s, i, mask=None):
    sub = np.asarray(im.crop((s[1].start, s[0].start, s[1].stop, s[0].stop)).convert('RGBA')).copy()
    m = mask if mask is not None else (lab[s] == i)
    sub[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(sub), m


def shrink(img, h):
    w = max(1, round(img.width * h / img.height))
    rgb = img.convert('RGB').resize((w, h), Image.BOX)
    al = img.split()[3].resize((w, h), Image.BOX)
    out = rgb.convert('RGBA'); out.putalpha(al.point(lambda v: 255 if v >= 128 else 0))
    # the background bleeds into the edge px when shrinking: pink / magenta px there become the dark outline
    a = np.asarray(out).copy(); r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    pink = (a[..., 3] > 0) & (r > g + 40) & (b > g + 20)
    a[pink, :3] = (22, 15, 14)
    return Image.fromarray(a)


def main(bpath, ipath):
    im, a, lab, sl = parts(bpath, 6)
    names = ['ui_main', 'ui_main_hot', 'ui_main_down', 'ui_btn', 'ui_btn_hot', 'ui_btn_down']
    sl = sl[:6]
    # the hover ones: cut with their row's normal button's shape, centred on their own box
    for row in (0, 1):
        s0, i0 = sl[row * 3]
        base, m0 = cut(im, lab, s0, i0)
        H0, W0 = m0.shape
        for col in range(3):
            s, i = sl[row * 3 + col]
            if col == 0:
                img = base
            else:
                cy, cx = (s[0].start + s[0].stop) // 2, (s[1].start + s[1].stop) // 2
                s2 = (slice(cy - H0 // 2, cy - H0 // 2 + H0), slice(cx - W0 // 2, cx - W0 // 2 + W0))
                img, _ = cut(im, lab, s2, i, m0)
            out = shrink(img, BTN_H)
            out.save(os.path.join(HD, names[row * 3 + col] + '.png'))
            print('  %s %dx%d' % (names[row * 3 + col], out.width, out.height))
    im, a, lab, sl = parts(ipath, 5)
    for (s, i), n in zip(sl[:5], ['ui_i_gear', 'ui_i_close', 'ui_i_left', 'ui_i_right', 'ui_i_bag']):
        img, _ = cut(im, lab, s, i)
        out = shrink(img, ICON_H)
        out.save(os.path.join(HD, n + '.png'))
        print('  %s %dx%d' % (n, out.width, out.height))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
