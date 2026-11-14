#!/usr/bin/env python3
"""Armour trim that takes the rarity colour (visible equipment).

    python3 -I tools/trim_fx.py NAME STRIP [import options, the same as the import of NAME]
    e.g. python3 -I tools/trim_fx.py warrior_chain chain_strip.png --split cols --cells 0-7 --own-box --ref 4 --height 46

The armour sheets are generated with their trim (edges, buckles, studs, rivets) in flat cyan. The trim is 1-2 px once
the sheet is reduced, so it is found in the SOURCE: a copy of the strip with the cyan in white and the rest of the
figure dark is imported with the same options (same silhouette -> same crop and scale), and every HD pixel that got
enough white is trim. For every frame <NAME>_* this writes assets/hd/trim_<frame>.png: the same size as the frame,
grey with the frame pixel's own lightness (so the shading stays), opaque. src/view/hd.js draws it over the hero tinted with the
colour of the armour's rarity. A sheet with no cyan gets no trim frames (its rarity shows only as a glow).
"""
import glob, os, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD = os.path.join(ROOT, 'assets', 'hd')


def hsv(a):
    r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-9), mx


def main():
    name, strip, opts = sys.argv[1], sys.argv[2], sys.argv[3:]
    src = np.asarray(Image.open(strip).convert('RGB')).astype(float)
    h, s, v = hsv(src)
    back = (np.abs(((h - 323 + 180) % 360) - 180) < 32) & (s > 0.28) & (v > 0.3)
    cyan = ~back & (h > 152) & (h < 210)   # 152: Grok draws some trims teal & (s > 0.3) & (v > 0.3)
    m = src.copy(); m[~back] = (40, 40, 40); m[cyan] = (255, 255, 255)
    tmp = os.path.join(HD, '_trim_src.png'); Image.fromarray(m.astype(np.uint8)).save(tmp)
    # the cells of the strip, in the order the hero sheets are imported (docs/grok-prompts.md): walk x4, idle, attack x2, hurt
    frames = [name + '_' + k for k in ('walk_0', 'walk_1', 'walk_2', 'walk_3', 'idle_0', 'attack_0', 'attack_1', 'hurt')]
    names = ['_tm_' + f for f in frames]
    print('  %d cyan source px' % int(cyan.sum()))
    subprocess.check_call([sys.executable, '-I', os.path.join(ROOT, 'tools', 'hd_atlas.py'), 'import', tmp, '--name', '_tm', '--outline', 'no',
                           '--names', ','.join(names)] + opts, stdout=subprocess.DEVNULL)
    for f, t in zip(frames, names):
        fa = np.asarray(Image.open(os.path.join(HD, f + '.png')).convert('RGBA')).astype(float)
        ta = np.asarray(Image.open(os.path.join(HD, t + '.png')).convert('RGBA')).astype(float)
        os.remove(os.path.join(HD, t + '.png'))
        out = os.path.join(HD, 'trim_' + f + '.png')
        if ta.shape != fa.shape:
            print('  %s: size differs (%s vs %s), no trim' % (f, ta.shape[:2], fa.shape[:2])); continue
        trim = (ta[..., 3] > 127) & (fa[..., 3] > 127) & (ta[..., :3].mean(2) > 66)
        if trim.sum() < 4:
            if os.path.exists(out):
                os.remove(out)
            print('  %s: no trim' % f); continue
        lum = fa[..., :3].max(2); lum = np.clip(0.35 + 0.65 * lum / max(1, np.percentile(lum[trim], 95)), 0, 1) * 255
        o = np.zeros(fa.shape, np.uint8); o[trim, 0] = o[trim, 1] = o[trim, 2] = lum[trim].astype(np.uint8); o[trim, 3] = 255
        Image.fromarray(o, 'RGBA').save(out)
        print('  trim_%s: %d px' % (f, int(trim.sum())))
    os.remove(tmp)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'hd_atlas.py'), 'pack'], stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
