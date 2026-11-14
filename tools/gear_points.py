#!/usr/bin/env python3
"""Where a helmet and a shield go on every hero frame (visible equipment).

    python3 -I tools/gear_points.py            # all hero frames -> assets/hd/gear_points.json, then repack

The hero sheets are generated with a bare head and empty hands, so the pieces are separate sprites drawn on the frame:
- cap: [cx, top, w] = the head's centre column, its top row and its width, HD px from the frame's top left. Found by
  matching the head of the class's bare idle frame (its top part) against each frame, a few px either way: the head is
  the same drawing in every look and pose, only moved.
- off: [x, y] = the free hand (the shield's grip): the skin-coloured blob below the head that is not the weapon's fist
  (meta hand, tools/hand_weapon.py), the biggest one; null when there is none (the game then puts the shield on the body).
tools/hd_atlas.py pack copies them into the atlas json as frame meta `cap` and `off`; src/view/hd.js draws the pieces there.
"""
import glob, json, os, re, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD = os.path.join(ROOT, 'assets', 'hd')
FRAME = re.compile(r'^(warrior|mage|archer)_(bare|leather|chain|plate)_(walk_\d|idle_0|attack_\d|hurt|skill_\d)$')
HEAD = 0.44          # share of the idle frame's height that is head (chibi)


def load(name):
    return np.asarray(Image.open(os.path.join(HD, name + '.png')).convert('RGBA')).astype(float)


def anchor_x(a):
    """The feet's centre column (as tools/hd_atlas.py anchor, in px)."""
    al = a[..., 3] > 0
    rows = np.where(al.any(1))[0]
    low = al[rows[-1] - 2:rows[-1] + 1].any(0)
    xs = np.where(low)[0]
    return (xs.min() + xs.max() + 1) / 2


def hsv(a):
    r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-9), mx


def skin_mask(a, ref_rgb):
    d = np.abs(a[..., :3] - ref_rgb).sum(2)
    return (a[..., 3] > 0) & (d < 70)


def components(mask):
    seen = np.zeros(mask.shape, bool); out = []
    H, W = mask.shape
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not seen[y, x]:
                st = [(y, x)]; seen[y, x] = True; px = []
                while st:
                    cy, cx = st.pop(); px.append((cy, cx))
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; st.append((ny, nx))
                out.append(px)
    return out


def main():
    hands = json.load(open(os.path.join(HD, 'hand_points.json'))) if os.path.exists(os.path.join(HD, 'hand_points.json')) else {}
    out = {}
    for cls, look in [(c, l) for c in ('warrior', 'mage', 'archer') for l in ('bare', 'leather', 'chain', 'plate')]:
        # each look against its own idle frame (a sheet can be drawn at another scale: the mage's battle robe)
        rname = cls + '_' + look + '_idle_0'
        if not os.path.exists(os.path.join(HD, rname + '.png')):
            continue
        ref = load(rname); RH, RW = ref.shape[:2]
        rows = np.where((ref[..., 3] > 0).any(1))[0]; top = rows[0]; hh = int(round(RH * HEAD))
        T = ref[top:top + hh]; tal = T[..., 3] > 0
        # matched on the face (rows f0..f1 of the head): raised arms and flying hair cover the top of the head, rarely the face
        f0, f1 = int(hh * 0.3), int(hh * 0.9); F = T[f0:f1]; fal = F[..., 3] > 0
        cols = np.where(tal[: int(hh * 0.75)].any(0))[0]
        rcx, rw = (cols.min() + cols.max() + 1) / 2, cols.max() + 1 - cols.min()
        rax = anchor_x(ref)
        # the face's skin colour: the commonest warm, mid-saturated colour in the head's lower half
        h, s, v = hsv(T); sk = tal & (h > 10) & (h < 40) & (s > 0.25) & (s < 0.75) & (v > 0.45)
        sk[: hh // 3] = False
        skin = np.median(T[sk][:, :3], 0) if sk.sum() > 4 else np.array([200, 140, 100.])
        hz = tal.copy(); hz[hh // 4:] = False
        hair = np.median(T[hz][:, :3], 0)      # the hair: the commonest colour of the head's top quarter
        for f in sorted(glob.glob(os.path.join(HD, cls + '_' + look + '_*.png'))):
            name = os.path.basename(f)[:-4]
            if not FRAME.match(name):
                continue
            a = load(name); H, W = a.shape[:2]; ax = anchor_x(a)
            # the head: the template moved so the feet line up (bottom rows, anchor columns), then searched a few px
            best = None
            for dy in range(-16, 17):
                for dx in range(-16, 17):
                    oy = (H - RH) + top + dy; ox = int(round(ax - rax)) + dx
                    fy = oy + f0
                    y0, x0 = max(0, fy), max(0, ox); y1, x1 = min(H, fy + (f1 - f0)), min(W, ox + RW)
                    if y1 - y0 < (f1 - f0) * 0.7 or x1 - x0 < RW * 0.5:
                        continue
                    Ts = F[y0 - fy:y1 - fy, x0 - ox:x1 - ox]; As = a[y0:y1, x0:x1]
                    m = Ts[..., 3] > 0
                    if m.sum() < 20:
                        continue
                    diff = np.abs(Ts[..., :3] - As[..., :3]).sum(2)
                    diff = np.where(As[..., 3] > 0, diff, 255 * 3)
                    sc = diff[m].mean() + (fal.sum() - m.sum()) * 2.0 + (abs(dx) + abs(dy)) * 0.8      # small moves preferred on a tie       # the part of the head left outside the frame costs
                    if best is None or sc < best[0]:
                        best = (sc, ox, oy)
            if best is None:
                continue
            _, ox, oy = best
            cap = [round(float(ox + rcx), 1), int(oy), int(rw)]
            if name.endswith('_hurt') or best[0] > 150:
                # a hurt face is another drawing (the match is loose): the head is where the hair is. The top rows with
                # at least 3 hair-coloured px give the crown, and their mean column gives the centre.
                hm = (a[..., 3] > 0) & (np.abs(a[..., :3] - hair).sum(2) < 75)
                rows_h = [y for y in range(H) if hm[y].sum() >= 3]
                if rows_h:
                    y0h = rows_h[0]; xs = np.where(hm[y0h:y0h + 8].any(0))[0]
                    cap = [round(float((xs.min() + xs.max() + 1) / 2), 1), int(y0h), int(rw)]
            # the free hand: skin below the head, not the weapon's fist
            low = skin_mask(a, skin); low[: max(0, oy + int(hh * 0.85))] = False
            comps = [c for c in components(low) if len(c) >= 4]
            hp = hands.get(name)
            if hp:
                comps = [c for c in comps if min((py - hp[1]) ** 2 + (px - hp[0]) ** 2 for py, px in c) > 16]
            off = None
            if comps:
                c = max(comps, key=len); off = [round(float(np.mean([p[1] for p in c])), 1), round(float(np.mean([p[0] for p in c])), 1)]
            out[name] = {'cap': cap, 'off': off}
            print('  %s: head %s, free hand %s, score %.0f' % (name, cap, off, best[0]))
    json.dump(out, open(os.path.join(HD, 'gear_points.json'), 'w'), indent=0, sort_keys=True)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'hd_atlas.py'), 'pack'], stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
