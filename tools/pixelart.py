#!/usr/bin/env python3
"""Riftscar art generator. All game art is drawn here, in code, at ONE pixel size.

Style rules (Hammerwatch-2-like top-down pixel art, own palette and designs):
  * flat colours, 2-3 shades per material, 1 px dark outline on every object sprite
  * nothing is ever scaled or rotated at runtime, so every art pixel is one game pixel

Outputs (all in assets/):
  palette.json   named colours, shared with the game (UI tints, FX, contrast checks)
  atlas.png/json sprites and UI pieces (Phaser JSON-hash atlas)
  tiles.png      16x16 tiles: floor macro-texture, wall tops, wall faces, shadows
  font.png/json  two bitmap fonts (5x7 body, 10x14 heading), outline baked in

    python3 tools/pixelart.py            # regenerate assets/
    python3 tools/pixelart.py --sheet    # also write qa/out/artsheet.png (x4 preview)

Sprites dropped into assets/imported/*.png by tools/import_asset.py are packed into the
atlas too (frame name = file name), and override a code-drawn frame of the same name.
"""
import json, math, os, random, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
T = 16

PALETTE = {
    'outline': '#0b0a10', 'void': '#07060b', 'white': '#ffffff',
    # floor slabs (grout -> highlight)
    'f0': '#121118', 'f1': '#1d1c27', 'f2': '#272633', 'f3': '#32313f', 'f4': '#434253',
    'fa': '#2b2630', 'fb': '#232838',
    # walls: top surface, brick face
    'wt0': '#0f0e16', 'wt1': '#181722', 'wt2': '#55526e',
    'wb0': '#22202c', 'wb1': '#373546', 'wb2': '#4d4a63', 'wb3': '#6c6988',
    # mage
    'mb0': '#1b2868', 'mb1': '#2c4bb8', 'mb2': '#5586ee', 'mb3': '#a6caff',
    'gold': '#f2c23e', 'gold_d': '#a8742a', 'skin': '#f0c8a0', 'skin_d': '#c08862',
    'wood': '#8e5c34', 'wood_d': '#5c3820', 'orb': '#8eeaff', 'orb_c': '#f2fdff', 'boot': '#33261f',
    # monsters
    'ir0': '#5c1420', 'ir1': '#a6252b', 'ir2': '#e04a38', 'ir3': '#ff8c5a',
    'bt0': '#2a2040', 'bt1': '#46356c', 'bt2': '#6e55a2', 'bt3': '#9a82cc',
    'hd0': '#2c1b4a', 'hd1': '#4a2e7e', 'hd2': '#7850be', 'hd3': '#a986e8',
    'sk0': '#585244', 'sk1': '#9c947c', 'sk2': '#d6ceb2', 'sk3': '#f4f0dc',
    'wd0': '#2c3636', 'wd1': '#4c5e5a', 'wd2': '#789084', 'wd3': '#a6c2ae',
    'ty0': '#3a0c18', 'ty1': '#701624', 'ty2': '#b02a30', 'ty3': '#e85c40',
    'cu0': '#2a1030', 'cu1': '#5a1e58', 'cu2': '#8e2f7c', 'cu3': '#c858a0',
    'horn': '#d8cdb0', 'horn_d': '#8c8068',
    'eye_y': '#ffe070', 'eye_r': '#ff4050', 'tooth': '#f4ecd8',
    # rift (open fissure) and ember (edges, scars)
    'rg0': '#12300f', 'rg1': '#2c741b', 'rg2': '#5fc028', 'rg3': '#a8f040', 'rg4': '#e6ffa2',
    'em0': '#3a120c', 'em1': '#96300e', 'em2': '#ee7418', 'em3': '#ffb032', 'em4': '#ffe890',
    'scar': '#0d0b10',
    # pickups and projectiles
    'xp0': '#2a7fd0', 'xp1': '#6ed0ff', 'xp2': '#e0f6ff',
    'heal0': '#2fae5a', 'heal1': '#7cf09a', 'heal2': '#d8ffe0',
    'shot0': '#a81c66', 'shot1': '#f0489a', 'shot2': '#ffc0e0',
    'tome0': '#5a2a8a', 'tome1': '#9a5ad8', 'tome2': '#d8b0ff',
    'ch0': '#4a2c18', 'ch1': '#7a4a26', 'ch2': '#a86c38',
    'iron0': '#2c2e3a', 'iron1': '#565a6c', 'iron2': '#8e94a8', 'iron3': '#c8ccd8',
    'cloth0': '#3a2a4c', 'cloth1': '#6a4c86', 'cloth2': '#9c78b8',
    'moss': '#24331f', 'blood': '#c8283a',
    # the town (step big city): grass and earth of the gardens, water, roof tiles and slates, plaster
    'gr0': '#131a14', 'gr1': '#1a2419', 'gr2': '#243323', 'gr3': '#35492c',
    'dirt0': '#1e1816', 'dirt1': '#2a211d',
    'wat0': '#10202e', 'wat1': '#1c3d55', 'wat2': '#4a86a6',
    'rf0': '#241a1e', 'rf1': '#3d2828', 'rf2': '#5a3a34',
    'rs0': '#1c1f2c', 'rs1': '#2c3144', 'rs2': '#444a62',
    'pl0': '#383435', 'pl1': '#4d4846',
    # UI
    'ui_bg': '#13111b', 'ui_bg2': '#1d1b29', 'ui_line': '#5a5674', 'ui_hi': '#8f8aae',
    'ui_text': '#f2efe6', 'ui_dim': '#aaa6ba', 'ui_warn': '#ffd060', 'ui_good': '#7cf09a', 'ui_bad': '#ff6e5e',
    'hp': '#b4242e', 'hp_d': '#3e0e16', 'xp': '#4aa8ff', 'xp_d': '#16304c',
    'r_common': '#d8d4c8', 'r_magic': '#6eaaff', 'r_rare': '#ffd84a', 'r_epic': '#cc80ff', 'r_legend': '#ff9434',
}


def rgb(key, a=255):
    h = PALETTE[key] if key in PALETTE else key
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), a)


# ----------------------------------------------------------------- sprite helpers
def parse(art, legend, mirror=False):
    """ASCII art -> RGBA image. legend: 'a=key b=key'. '.' is transparent."""
    lut = {'.': (0, 0, 0, 0)}
    for pair in legend.split():
        ch, key = pair.split('=')
        lut[ch] = rgb(key)
    rows = [r for r in art.strip('\n').split('\n')]
    if mirror:
        w = max(len(r) for r in rows)
        rows = [r.ljust(w, '.') + r.ljust(w, '.')[::-1] for r in rows]
    w = max(len(r) for r in rows)
    im = Image.new('RGBA', (w, len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in lut:
                raise ValueError('unknown char %r in sprite row %r' % (ch, r))
            im.putpixel((x, y), lut[ch])
    return im


def outline(im, key='outline', diag=False):
    """Grow the canvas by 1 px and paint the outline colour around every opaque pixel."""
    w, h = im.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(im, (1, 1))
    src = out.copy()
    col = rgb(key)
    nb = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (-1, -1), (1, -1), (-1, 1)] if diag else [])
    for y in range(h + 2):
        for x in range(w + 2):
            if src.getpixel((x, y))[3]:
                continue
            for dx, dy in nb:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src.getpixel((nx, ny))[3]:
                    out.putpixel((x, y), col)
                    break
    return out


def bob(im, feet=2):
    """Second animation frame: everything above the feet moves down 1 px."""
    w, h = im.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(im.crop((0, 0, w, h - feet - 1)), (0, 1))
    out.paste(im.crop((0, h - feet, w, h)), (0, h - feet))
    return out


def blank(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def rect(im, x, y, w, h, key, a=255):
    c = rgb(key, a)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < im.width and 0 <= yy < im.height:
                im.putpixel((xx, yy), c)


def ellipse(im, cx, cy, rx, ry, key, a=255):
    c = rgb(key, a)
    for y in range(im.height):
        for x in range(im.width):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1:
                im.putpixel((x, y), c)


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

SPRITES = {}


def add(name, im):
    SPRITES[name] = im


# ------------------------------------------------------------------------ characters
def characters():
    # --- the mage: blue robe, pointed hat, staff with a glowing orb (faces right; flipped in game)
    L = 'a=mb0 b=mb1 c=mb2 d=mb3 g=gold G=gold_d s=skin S=skin_d E=outline w=wood W=wood_d o=orb O=orb_c k=boot'
    body = '''
......aa........
.....abba.......
....abccba......
....abccba......
...abbccbba.....
...abcccbba...o.
..GggggggggG.oOo
abbbbbbbbbbba.o.
.aabbbbbbbaa..w.
...ssssssS....w.
...sEssEsS....w.
...SssssS.....w.
..abSSSSba....w.
.abccbgbbbasS.w.
.abcbbgbbbbssSw.
.abcbbgbbbba..w.
.abcbbgbbbba..W.
.abcbbgbbbba..W.
.aabbbbbbbaa..W.
..aaabbbaaa...W.
'''
    feet = ['''
..kk....kk......
..kk....kk......
''', '''
..kk.....kk.....
.kk.......k.....
''', '''
...kk..kk.......
...k....kk......
''']
    for i, f in enumerate(feet):
        im = parse(body.strip('\n') + '\n' + f.strip('\n'), L)
        if i:
            im = bob(im, 2) if i == 1 else im
        add('mage_%d' % i, outline(im))
    # portrait for the HUD: hat + face, 16x16
    add('portrait', outline(parse('''
.....aa.....
....abba....
...abccba...
...abccba...
..abbccbba..
..abcccbba..
.GggggggggG.
abbbbbbbbbba
.aabbbbbbaa.
..ssssssssS.
..sEsssEsS..
..SsssssS...
...SSSSS....
''', L)))

    # --- the warrior: iron armour, red plume, gold-rimmed shield (faces right; the weapon is its own sprite, w_<type>)
    L = 'a=iron0 b=iron1 c=iron2 d=iron3 r=blood R=ir3 g=gold G=gold_d s=skin S=skin_d E=outline w=wood W=wood_d k=boot'
    wbody = '''
.....rr.........
....rRRr........
....abbba.......
...abccccba....
...abccccba....
...aEEEEEEa....
...abSssSba....
....abbbba.....
.aabccccccbaa...
GgggabbbbbbaS...
GgccabbbbbbbsS..
GgccabgggggbaS..
Ggcgabbbbbbbaa..
.Gggabbbbbbba...
..GGabbbbbbba...
...aabbbbbbaa...
....abbbbbba....
....abbaabba....
....aabbbbaa....
.....aaaaaa.....
'''
    wfeet = ['''
..kk....kk......
..kk....kk......
''', '''
..kk.....kk.....
.kk.......k.....
''', '''
...kk..kk.......
...k....kk......
''']
    for i, f in enumerate(wfeet):
        im = parse(wbody.strip('\n') + '\n' + f.strip('\n'), L)
        if i:
            im = bob(im, 2) if i == 1 else im
        add('warrior_%d' % i, outline(im))

    # --- the archer: green hood and cloak, brown leather, quiver on the back, a bow held in front (faces right)
    L = 'a=rg0 b=rg1 c=rg2 d=rg3 s=skin S=skin_d E=outline w=wood W=wood_d n=ch1 m=ch2 N=ch0 k=boot t=tooth'
    abody = [
        "......aaaa..",
        ".....abbbba.",
        "....abbccbba",
        "..d.abbccbba",
        ".dNdabbssbba",
        ".NNNabbsEsba",
        ".NmNabbSssba",
        ".NNN.abSSba.",
        ".NmNaabbbbaa",
        "..NabbbbbbbS",
        "..abbbnnnbbS",
        "..abbbmmmbba",
        "..abbbbbbbba",
        "..abnnnnnnba",
        "..abbbbbbbba",
        "..aabbbbbbaa",
        "...abbbbbba.",
        "....abbbba..",
        "....aabbaa..",
        ".....aaaa...",
    ]
    # bow overlay (x, y, key): the string is the pale column, the hand grips the wood
    bow = [(13, 7, 'w'), (12, 8, 't'), (13, 8, 'w'), (12, 9, 't'), (14, 9, 'w'), (12, 10, 't'), (14, 10, 'w'), (12, 11, 't'), (13, 11, 'S'), (14, 11, 'w'),
           (12, 12, 't'), (13, 12, 'S'), (14, 12, 'W'), (12, 13, 't'), (14, 13, 'W'), (12, 14, 't'), (14, 14, 'w'), (12, 15, 't'), (14, 15, 'w'), (12, 16, 't'), (13, 16, 'w'), (13, 17, 'w')]
    afeet = ['''
..kk....kk......
..kk....kk......
''', '''
..kk.....kk.....
.kk.......k.....
''', '''
...kk..kk.......
...k....kk......
''']
    for i, f in enumerate(afeet):
        grid = [list(r + '....') for r in abody]
        for (x, y, key) in bow:
            grid[y][x] = key
        im = parse('\n'.join(''.join(r) for r in grid) + '\n' + f.strip('\n'), L)
        if i:
            im = bob(im, 2) if i == 1 else im
        add('archer_%d' % i, outline(im))

    # --- imp: small red demon, the fast melee swarm
    L = 'a=ir0 b=ir1 c=ir2 d=ir3 h=horn H=horn_d Y=eye_y K=outline T=tooth'
    imp = parse('''
.h....
.hH...
..abbb
.abbcc
.abccc
.abYKc
.abccc
..abTT
...abb
..abbc
.ab.bc
.a..ab
...aa.
...a..
''', L, mirror=True)
    add('imp_0', outline(imp)); add('imp_1', outline(bob(imp, 2)))
    # attack pose (frame 2, shown while it is about to touch the hero): claws up, mouth open
    add('imp_2', outline(parse('''
d.....
dh....
ahH...
.abbbb
.abbcc
.abccc
.abYKc
..accc
...aKT
...abb
...abc
...abc
..ab.b
..a..a
''', L, mirror=True)))

    # --- training dummy (tutorial): a post with a sack head, a crossbar and a straw body with a target; it only sways
    L = 'w=wood W=wood_d g=gold G=gold_d r=ir2 R=ir1 K=outline'
    dm = parse('''
....gg
...gGg
...gKg
....Gg
.....w
wwwwww
WWWWWw
..gGrr
..gGRr
..gGrr
..gGgg
.....w
.....w
..WWWw
.WWWWW
''', L, mirror=True)
    add('dummy_0', outline(dm)); add('dummy_1', outline(dm)); add('dummy_2', outline(dm))

    # --- bat: quick, erratic flyer (two explicit wing frames)
    L = 'a=bt0 b=bt1 c=bt2 d=bt3 R=eye_r K=outline T=tooth'
    add('bat_0', outline(parse('''
.aa......
abba...a.
abbba.aba
.abbbabbb
..abbbRbb
...aabbbb
.....abTb
......abb
.......a.
''', L, mirror=True)))
    add('bat_1', outline(parse('''
.......a.
......aba
....aabbb
.aaabbRbb
abbbbbbbb
abbabbbTb
aba.aabbb
aa....abb
a......a.
''', L, mirror=True)))
    # attack pose (frame 2): wings swept back, fangs out
    add('bat_2', outline(parse('''
a........
ab.......
abb......
.abba..a.
..abba.ab
...abbabR
....aabbb
......aTT
.......aT
''', L, mirror=True)))

    # --- hound: purple rift beast that winds up and lunges
    L = 'a=hd0 b=hd1 c=hd2 d=hd3 R=eye_r K=outline T=tooth'
    top = '''
.....a..a..a....aa.a..
....aba.ba.ba..abbab..
.aa.abbabbabba.abbbbba
abba.abbbbbbbbabbbRbbba
.abbabbccccccbbbbbbbbba
..abbbccddddccbbbbTKTa.
..abbccddddcccbbbaaaa..
..abbcccccccccbba.....
..abbbbbbbbbbbbba.....
'''
    legs = ['''
..abba.abba..abba.....
..aba...aba..aba......
..aba...aba..aba......
.aaa...aaa..aaa.......
''', '''
..abba.abba..abba.....
...aba.aba....aba.....
....aba.aba...aba.....
...aaa.aaa...aaa......
''']
    for i, lg in enumerate(legs):
        add('hound_%d' % i, outline(parse(top.strip('\n') + '\n' + lg.strip('\n'), L)))
    # wind-up pose (frame 2): crouched low, jaws open, ready to lunge
    add('hound_2', outline(parse('''
......................
.....a..a..a....aa.a..
....aba.ba.ba..abbab..
.aa.abbabbabba.abbbbba
abba.abbbbbbbbabbbRbbba
.abbabbccccccbbbbbbbbba
..abbbccddddccbbbbTTTa.
..abbccddddcccbbbaKKKa.
..abbcccccccccbbaTTTa..
.aabbabbaabbaabba......
.aaa..aaa...aaa........
''', L)))

    # --- skeleton: keeps its distance and throws bone shards
    L = 'a=sk0 b=sk1 c=sk2 d=sk3 K=outline G=rg3'
    sk = parse('''
...ccd
..cccd
..cKKc
..cGKc
..cccc
...cKc
....bb
.cc.cc
.c.cbc
.c..cc
.c.cbc
.b..cc
.b...c
....cc
...cc.
...c..
...c..
...b..
..bb..
''', L, mirror=True)
    add('skeleton_0', outline(sk)); add('skeleton_1', outline(bob(sk, 3)))
    # wind-up pose (frame 2): both arms raised, a bone shard held over the skull
    add('skeleton_2', outline(parse('''
dd....
c.....
c..ccd
c.cccd
c.cKKc
c.cGKc
c.cccc
.c.cKc
..c.bb
....cc
....bc
....cc
....bc
....cc
.....c
....cc
...cc.
...c..
...c..
...b..
..bb..
''', L, mirror=True)))

    # --- cultist: hooded caster in a wine robe; draws a rune on the floor that becomes a rift pool
    L = 'a=cu0 b=cu1 c=cu2 d=cu3 K=void P=shot1 o=shot2 s=sk2'
    cu = parse('''
....aaa
...abbb
..abccc
..abcKK
..abKPK
..abKKK
..aabcc
.aabbcc
.abbccc
.abcccd
.abccbb
.abcbss
.aabccc
..abccd
..abccd
.abbccd
.abcccd
abbcccd
abccccc
aaaaaaa
''', L, mirror=True)
    add('cultist_0', outline(cu)); add('cultist_1', outline(bob(cu, 2)))
    # wind-up pose (frame 2): both arms thrown up, sparks over the hands, the eyes lit
    add('cultist_2', outline(parse('''
oP..aaa
s..abbb
b.abccc
b.abcKK
b.abKoK
bbabKKK
abbabcc
.abbbcc
..abccc
..abccd
..abccd
..abccd
..abccc
..abccd
..abccd
.abbccd
.abcccd
abbcccd
abccccc
aaaaaaa
''', L, mirror=True)))

    # --- warden: stone brute with rift cracks; elite of the super fissure
    L = 'a=wd0 b=wd1 c=wd2 d=wd3 G=rg3 g=rg2 K=outline'
    wd = parse('''
........aaa
.......abbc
.......abGc
..aaaa.abbc
.abbcbaaabb
abbccccbbbb
abcccdcbbgb
abccccbbbGg
abbccbabbbG
abbbba.abbg
abbbba.abbb
abbba..abbb
abbba..abbb
abcba..abbb
abccba.abba
abccba.abba
.abba..abba
.......abba
......abbba
......aaaaa
''', L, mirror=True)
    add('warden_0', outline(wd)); add('warden_1', outline(bob(wd, 3)))
    # wind-up pose (frame 2): stone fists thrown up, rift light in them
    add('warden_2', outline(parse('''
aa......aaa
aGa....abbc
aGGa...abGc
abba...abbc
.abba.aaabb
..abbccbbbb
..abcdcbbgb
...acccbbGg
....abbabbG
.......abbg
.......abbb
.......abbb
.......abbb
.......abbb
.......abba
.......abba
.......abba
.......abba
......abbba
......aaaaa
''', L, mirror=True)))

    # --- the Rift Tyrant: boss of the last room
    L = 'a=ty0 b=ty1 c=ty2 d=ty3 h=horn H=horn_d Y=eye_y K=outline T=tooth G=rg3 g=rg2 W=horn L=rg4'
    # idle: the arms hang and end in big three-clawed hands (bone claws two pixels wide, dark gaps between them)
    ty = parse('''
...hh.............
..hHh.............
..hHHh............
..hHHh............
...hHHh.....aaaaaa
...hHHHh...abbbbbb
....hHHHh.abbccccc
.....hHHHabbcccccc
......hhabbcYYcccc
.......abbbcKYcccc
.......abbbccccccc
......aabbbbcccTTT
....aaabbabbbbbTKT
...abbbbbbaabbbbbb
..abbcccbbbbaaaaaa
.abbccdcccbbbbbbbb
.abccddcccbbbbbGbb
.abcccccccbbbbbGGb
.abccccbbbbbbbbbGg
.abbccbbabbbbbbGGb
.abbbbba.abbbbbGbb
..abcba..abbbbbbGg
.abccbba.abbbbbbbb
abccdcca.abbbbbbbb
abccccca.abbbbbbbb
abbabbab.aabbbbbba
WWaWWaWW..abbbaab.
WW.WW.WW..abbba...
.T..T..T..abbba...
..........abbba...
.........abbbba...
.........aaaaaa...
''', L, mirror=True)
    add('tyrant_0', outline(ty)); add('tyrant_1', outline(bob(ty, 2)))
    w0, h0 = ty.size

    def ty_pose(pad, drop, arm, ax, ay):
        # the body without its hanging arms (dropped `drop` px, feet planted) plus one arm drawing, mirrored to both sides
        body = ty.copy()
        for y in range(14, h0 - 2):
            for x in range(9):
                body.putpixel((x, y), (0, 0, 0, 0)); body.putpixel((w0 - 1 - x, y), (0, 0, 0, 0))
        im = blank(w0 + 2 * pad, h0)
        if drop:
            im.alpha_composite(body.crop((0, 0, w0, h0 - 4 - drop)), (pad, drop))
            im.alpha_composite(body.crop((0, h0 - 4, w0, h0)), (pad, h0 - 4))
        else:
            im.alpha_composite(body, (pad, 0))
        a = parse(arm, L)
        im.alpha_composite(a, (ax, ay))
        im.alpha_composite(a.transpose(Image.FLIP_LEFT_RIGHT), (im.width - ax - a.width, ay))
        return outline(im)

    # slam wind-up (frame 2): both arms thrown straight up, open claws over the horns
    add('tyrant_2', ty_pose(6, 0, '''
.T..T..T........
WW.WW.WW........
WW.WW.WW........
WWaWWaWWa.......
abbabbabba......
abccbccbca......
abcdccdcba......
abcccccbba......
.abccccba.......
..abccbba.......
..abcbba........
..abcbba........
...abcbba.......
...abccbbaa.....
....abcccbba....
....abbcccbbba..
.....aabbbbbbbb.
.......aaabbbbb.
..........aaaa..
''', 0, 0))
    # burst wind-up (frame 4): arms spread wide at shoulder height, palms open to the room, rift light gathering in them
    add('tyrant_4', ty_pose(10, 0, '''
.T..T...............
WW.WW..T............
WW.WW.WW............
WWaWWaWW............
abbabbaba...........
abcLLcbba...........
abLGGLcbbaaaaaa.....
abcGGccccccccbbaa...
.abcccbbbccccccbba..
..aabbaaabbbbbbbbba.
....aa...aaaaabbbba.
..............aaaa..
''', 0, 6))
    # charge wind-up and charge (frame 3): head and shoulders dropped 3 px, elbows out, claws planted on the floor
    add('tyrant_3', ty_pose(4, 3, '''
.......aaaa..
.....aabbbba.
...aabbccbbba
..abbccdccbba
..abcccccbba.
.abcccbbaa...
.abccba......
.abcbba......
.abcbba......
.abcbba......
.abccba......
abccdcca.....
abccccca.....
abbabbab.....
WWaWWaWW.....
WW.WW.WW.....
T..T..T......
''', 0, 15))


# ---------------------------------------------------------------------- world objects
def objects():
    L = 'a=ch0 b=ch1 c=ch2 g=gold G=gold_d K=outline Y=eye_y y=gold W=white'
    add('chest_closed', outline(parse('''
.aaaaaaaaaaaaaa.
aGbbbbbggbbbbbGa
aGbcccbggbcccbGa
aGbbbbbggbbbbbGa
aggggggKKgggggga
aGbbbbbKKbbbbbGa
aGbcccbggbcccbGa
aGbcccbggbcccbGa
aGbbbbbGGbbbbbGa
.aaaaaaaaaaaaaa.
''', L)))
    add('chest_open', outline(parse('''
.aaaaaaaaaaaaaa.
aGbcccbggbcccbGa
aGbbbbbggbbbbbGa
agggggggggggggga
aKKKKKKKKKKKKKKa
aKYyWYyYYyYWyYKa
aggggggKKgggggga
aGbbbbbggbbbbbGa
aGbcccbggbcccbGa
aGbbbbbGGbbbbbGa
.aaaaaaaaaaaaaa.
''', L)))

    # exit gate: 24x26 stone arch set into the top wall. closed = portcullis, open = lit doorway.
    for name in ('door_closed', 'door_open'):
        im = blank(24, 26)
        rect(im, 0, 4, 24, 22, 'wb1')
        rect(im, 2, 0, 20, 5, 'wb1')
        rect(im, 4, 0, 16, 1, 'wb3'); rect(im, 2, 1, 2, 1, 'wb3'); rect(im, 20, 1, 2, 1, 'wb3')
        rect(im, 0, 4, 2, 1, 'wb3'); rect(im, 22, 4, 2, 1, 'wb3')
        for y in range(8, 26, 6):                      # jamb stones
            rect(im, 0, y, 4, 1, 'wb0'); rect(im, 20, y, 4, 1, 'wb0')
        rect(im, 11, 0, 2, 5, 'wb2'); rect(im, 11, 0, 2, 1, 'wb3')     # keystone
        rect(im, 4, 6, 16, 20, 'void'); rect(im, 6, 4, 12, 2, 'void')
        if name == 'door_closed':
            for x in range(6, 19, 4):
                rect(im, x, 4, 1, 22, 'iron1')
            rect(im, 4, 10, 16, 1, 'iron1'); rect(im, 4, 18, 16, 1, 'iron1')
            for x in range(6, 19, 4):
                rect(im, x, 10, 1, 1, 'iron2'); rect(im, x, 18, 1, 1, 'iron2')
        else:
            rect(im, 6, 20, 12, 2, 'wb0'); rect(im, 5, 22, 14, 2, 'wb1'); rect(im, 4, 24, 16, 2, 'wb2')   # steps
            rect(im, 9, 8, 6, 10, 'em1'); rect(im, 10, 9, 4, 8, 'em2'); rect(im, 11, 11, 2, 5, 'em3')    # warm light beyond
        add(name, outline(im))

    # wall torch: iron cup + 3 flame frames
    L = 'i=iron1 I=iron0 r=em1 o=em2 y=em3 w=em4'
    flames = ['''
...y...
..yoy..
..owo..
.oywyo.
.oywyo.
..oyo..
''', '''
..y....
..oy...
.oywo..
.oywyo.
.oywyo.
..oyo..
''', '''
....y..
...yo..
..owyo.
.oywyo.
.oywyo.
..oyo..
''']
    cup = '''
IiiiiiI
.IiiiI.
..IiI..
...I...
...I...
'''
    for i, f in enumerate(flames):
        add('torch_%d' % i, outline(parse(f.strip('\n') + '\n' + cup.strip('\n'), L)))

    # floor decals (no outline: they are part of the ground)
    L = 'a=f0 b=f1 c=f3 d=f4 m=moss k=sk0 K=sk1 s=scar'
    decals = ['''
..a....
.a.a..a
a...aa.
....a..
''', '''
.cd..
cddc.
.cc.c
....d
''', '''
.mm...
mmmm.m
.mmmm.
..mm..
''', '''
K.....k
.Kk..K.
..KkK..
.k...k.
''', '''
s......
.ss....
...s.s.
....s..
.....ss
''', '''
.c.....
cdc..c.
.c..cdc
.....c.
''']
    for i, d in enumerate(decals):
        add('decal_%d' % i, parse(d, L))

    # floor props (step 9: room variety). View-only dressing, nothing collides with them.
    L = 'a=sk0 b=sk1 c=sk2 d=sk3 K=outline'
    add('prop_bones', outline(parse('''
.....c.....
..cdc.b.cc.
.c..dccdb.c
cbccbc.dcbb
..b...cb...
''', L)))
    add('prop_skull', outline(parse('''
.cdd.
cddcd
cKcKc
.ccb.
.b.b.
''', L)))
    L = 'a=wb0 b=wb1 c=wb2 d=wb3 f=f1'
    add('prop_rubble', outline(parse('''
....cd.....
...bccd....
.cdbbcb.cd.
bccbbbabccd
abbaabaabba
''', L)))
    L = 'a=iron0 b=iron1 c=iron2 f=f0'
    add('prop_grate', parse('''
aaaaaaaaaaa
abbbbbbbbba
abfbfbfbfba
abfbfbfbfba
abfbfbfbfba
abfbfbfbfba
abbbbbbbbba
aaaaaaaaaaa
''', L))
    L = 'a=f0 b=fb c=wb1 d=mb0'
    add('prop_puddle', parse('''
...aaaaa.....
.aabbbbbaaa..
abbbcbbbbbba.
abbbbbbbdbbba
.aabbbbbbbaa.
...aaaaaaa...
''', L))
    L = 'a=sk1 b=sk2 c=sk3 f=em3 g=em4 w=wood_d'
    candles = []
    for f in range(2):
        fl = ('.g..f..g.', '.f..g..f.')[f]
        candles.append(parse('''
%s
.f..f..f.
.c..c....
.b..c..c.
.b..b..b.
.b.wb..b.
wbwwbwwbw
''' % fl, L))
        add('prop_candles_%d' % f, outline(candles[-1]))
    # a cobweb for the inner corner where two walls meet (top-left; flipped for top-right)
    web = blank(12, 12)
    wc = rgb('wb3', 170)
    def wline(x0, y0, x1, y1):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            web.putpixel((round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)), wc)
    spokes = [(11, 0), (11, 5), (8, 8), (5, 11), (0, 11)]
    for sx, sy in spokes:
        wline(0, 0, sx, sy)
    for k in (0.4, 0.75):                      # two strands across the spokes
        pts = [(round(sx * k), round(sy * k)) for sx, sy in spokes]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            wline(x0, y0, x1, y1)
    add('prop_web', web)

    # wall-face props (hung on south-facing wall faces, like the torches)
    L = 'a=iron0 b=iron1 c=iron2'
    add('wall_chain', outline(parse('''
.c.....c.
.b.....b.
.c.....c.
.b.....b.
.c.....c.
.b.....b.
bab...bab
b.b...b.b
.b.....b.
''', L)))
    L = 'a=ir0 b=ir1 c=ir2 g=gold_d w=wood_d'
    add('wall_banner', outline(parse('''
wwwwwwwww
.abbbbba.
.abbcbba.
.abcgcba.
.abbcbba.
.abbbbba.
.abbbbba.
.ab.abba.
.a...ba..
''', L)))
    L = 'a=moss b=rg0'
    add('wall_moss', parse('''
aaabaaaa..a
.aaaaba.aa.
..a.aaa..a.
..a..a.....
.....a.....
''', L))

    # pickups, projectiles
    L = 'a=xp0 b=xp1 c=xp2'
    add('orb_exp', outline(parse('''
.b.
bcb
abb
.a.
''', L)))
    L = 'a=heal0 b=heal1 c=heal2'
    add('orb_heal', outline(parse('''
.bb.
bccb
abbb
.aa.
''', L)))
    L = 'a=mb2 b=orb c=orb_c'
    add('bolt', outline(parse('''
.bb.
bccb
bccb
.bb.
''', L), 'mb1'))
    L = 'a=ch1 b=ch2 c=sk3 d=rg3'
    add('arrow', outline(parse('''
d.......
dab.....
.bbbbbbc
dab.....
d.......
''', L), 'ch0'))
    L = 'a=shot0 b=shot1 c=shot2'
    add('shot', outline(parse('''
.bb.
bccb
bcbb
.bb.
''', L), 'shot0'))
    add('shot_big', outline(parse('''
..bb..
.bccb.
bccccb
bcccbb
.bbbb.
..bb..
''', L), 'shot0'))
    L = 'c=sk2 d=sk3 b=sk1'
    add('shot_bone', outline(parse('''
d..d
.cc.
.cc.
b..c
''', L)))
    L = 'a=tome0 b=tome1 c=tome2 g=gold p=sk3'
    add('i_tome', outline(parse('''
.aaaaaaaa.
abbbbbbbbp
abbcggcbbp
abcg..gcbp
abcg..gcbp
abbcggcbbp
abbbbbbbbp
abbbbbbbbp
.aaaaaaaap
''', L)))
    # Scroll of Identification: a rolled parchment with a gold seal; i_unid: the "?" drawn over an unidentified item
    L = 'a=skin b=skin_d r=wood g=gold h=gold_d'
    add('i_scroll', outline(parse('''
.rrrrrrrr.
rbaaaaaabr
.baaghaab.
.baghhgab.
.baaaaaab.
.baaghaab.
rbaaaaaabr
.rrrrrrrr.
''', L)))
    L = 'g=gold h=gold_d w=white'
    add('i_unid', outline(parse('''
.ggg.
g...g
...g.
..g..
..g..
.....
..g..
''', L)))
    # economy (step 7): the merchant (hooded trader with a pack, 3 idle frames), a gold coin, a healing potion
    L = 'a=cloth0 b=cloth1 c=cloth2 s=skin t=skin_d g=gold h=gold_d w=wood x=wood_d k=boot'
    mer = parse('''
....aaaaaa....
...abbbbbba...
..abbbbbbbba..
..abbssssbba..
..abstsstsba..
..abbssssbba..
...abbbbbba...
.xxabbbbbbaxx.
xxwabbccbbawxx
xwwabbccbbawwx
xwwabbbbbbawwx
.xwabbggbbawx.
..xabbbbbbax..
...abbccbba...
...abbbbbba...
...aaaaaaaa...
...kk....kk...
...kk....kk...
''', L)
    add('merchant_0', outline(mer)); add('merchant_1', outline(bob(mer, 2))); add('merchant_2', outline(mer))
    L = 'g=gold h=gold_d w=white'
    add('i_gold', outline(parse('''
..hhhh..
.hggwgh.
hggwgggh
hgwggggh
hggggggh
hgggggdh
.hggggh.
..hhhh..
'''.replace('d', 'h'), L)))
    L = 'w=wood c=ui_dim r=blood d=hp W=white'
    add('i_potion', outline(parse('''
..wwww..
...cc...
..cccc..
.cdrrdc.
cdrWrrdc
cdrrrrdc
cdrrrrdc
.cdrrdc.
..cccc..
''', L)))
    for nm, rx, ry in (('shadow_s', 6, 2.5), ('shadow_m', 9, 3.5), ('shadow_l', 16, 6)):
        im = blank(int(rx * 2), int(ry * 2) + 1)
        ellipse(im, rx, ry + 0.5, rx, ry, 'void', 120)
        add(nm, im)

    # light: one banded, dithered radial glow, white; tinted and drawn additively in game
    for nm, R in (('glow', 40), ('glow_s', 16)):
        im = blank(R * 2, R * 2)
        for y in range(R * 2):
            for x in range(R * 2):
                d = ((x + 0.5 - R) ** 2 + (y + 0.5 - R) ** 2) ** 0.5 / R
                if d >= 1:
                    continue
                v = (1 - d) ** 1.6 * 4          # 0..4 brightness levels
                lv = int(v)
                if v - lv > (BAYER[y & 3][x & 3] + 0.5) / 16:
                    lv += 1
                if lv > 0:
                    im.putpixel((x, y), (255, 255, 255, min(255, lv * 40)))
        add(nm, im)


# ----------------------------------------------------------------------------- icons
# ------------------------------------------------------------------------ city (step 8)
def city():
    """Four stalls, three townsfolk, the cage, the portal, a fenced lot, a sign and a crate. Same palette and pixel size as the dungeon.
    The town's ground is in tiles(), its walls are the rooms' wall tiles, the rest of its props are in town()."""

    def stall(c1, c2, wear=False):
        im = blank(48, 40)
        for x in range(48):                                  # striped canopy with a scalloped edge
            col = c1 if (x // 4) % 2 == 0 else c2
            rect(im, x, 0, 1, 12 + (1 if (x // 4) % 2 == 0 else 0), col)
        rect(im, 0, 0, 48, 1, c2)
        rect(im, 2, 12, 2, 24, 'wood_d'); rect(im, 44, 12, 2, 24, 'wood_d')   # posts
        rect(im, 4, 13, 40, 14, 'f0')                         # dark back of the stall
        rect(im, 0, 27, 48, 10, 'ch1'); rect(im, 0, 27, 48, 2, 'ch2'); rect(im, 0, 35, 48, 2, 'ch0')   # counter
        for x in range(4, 48, 8):
            rect(im, x, 30, 1, 5, 'ch0')
        if wear:                                              # torn and bare, a web in the corner
            for x in range(5, 9):
                rect(im, x, 13, 1, 9 - (x - 5) * 2, 'ui_dim')
            for x in range(13, 48, 11):
                rect(im, x, 10, 3, 3, 'f0')
        return im
    sm = stall('ir1', 'ir2')
    rect(sm, 6, 14, 9, 11, 'em1'); rect(sm, 8, 17, 5, 8, 'em2'); rect(sm, 9, 21, 3, 4, 'em3')           # forge glow behind the counter
    rect(sm, 18, 22, 12, 5, 'iron1'); rect(sm, 20, 20, 8, 2, 'iron2'); rect(sm, 18, 22, 12, 1, 'iron3')  # anvil on the counter
    rect(sm, 34, 20, 2, 7, 'wood'); rect(sm, 32, 18, 6, 3, 'iron2')                                      # hammer
    rect(sm, 40, 22, 4, 5, 'iron2'); rect(sm, 40, 22, 4, 1, 'iron3')                                     # helmet on show
    add('stall_smith', outline(sm))
    ap = stall('tome1', 'tome2')
    rect(ap, 8, 18, 10, 9, 'cloth1'); rect(ap, 8, 18, 10, 1, 'cloth2'); rect(ap, 10, 20, 6, 1, 'ui_text'); rect(ap, 10, 23, 6, 1, 'ui_text')   # open ledger
    ellipse(ap, 28, 22, 4, 4, 'orb'); ellipse(ap, 27, 21, 2, 2, 'orb_c'); rect(ap, 25, 26, 6, 1, 'gold_d')   # crystal ball
    rect(ap, 36, 17, 8, 1, 'gold'); rect(ap, 39, 17, 2, 9, 'gold_d'); rect(ap, 36, 18, 2, 3, 'gold'); rect(ap, 42, 18, 2, 3, 'gold')   # scales
    add('stall_montoto', outline(ap))
    tr = stall('rg1', 'rg2')
    for x in (8, 14, 20):                                                                                  # a rack of practice swords
        rect(tr, x, 15, 2, 11, 'iron2'); rect(tr, x, 15, 1, 11, 'iron3'); rect(tr, x - 1, 24, 4, 2, 'wood_d')
    rect(tr, 30, 14, 14, 12, 'wood_d'); ellipse(tr, 37, 20, 4, 4, 'ir1'); ellipse(tr, 37, 20, 2, 2, 'ui_text'); ellipse(tr, 37, 20, 1, 1, 'ir1')   # target board
    add('stall_trainer', outline(tr))
    add('stall_empty', outline(stall('wb1', 'wb2', wear=True)))
    # a fenced empty plot (the Mage quarter): ground, posts and a rope
    pf = blank(48, 32)
    for y in range(32):
        for x in range(48):
            pf.putpixel((x, y), rgb('ch0') if (x * 7 + y * 13) % 11 else rgb('ch1'))
    for x in (0, 22, 44):
        for y in (0, 28):
            rect(pf, x, y, 4, 4, 'wood_d'); rect(pf, x, y, 4, 1, 'wood')
    for x in range(4, 44):
        if not 22 <= x < 26:
            pf.putpixel((x, 1), rgb('boot')); pf.putpixel((x, 29), rgb('boot'))
    for y in range(4, 28):
        pf.putpixel((1, y), rgb('boot')); pf.putpixel((45, y), rgb('boot'))
    add('plot_fence', outline(pf))
    sg = blank(16, 22)                                        # the sign
    rect(sg, 7, 8, 2, 14, 'wood_d'); rect(sg, 1, 1, 14, 9, 'wood'); rect(sg, 1, 1, 14, 1, 'ch2'); rect(sg, 1, 9, 14, 1, 'wood_d')
    rect(sg, 3, 4, 10, 1, 'wood_d'); rect(sg, 3, 6, 7, 1, 'wood_d')
    add('c_sign', outline(sg))
    cr = blank(12, 12)
    rect(cr, 0, 0, 12, 12, 'ch1'); rect(cr, 0, 0, 12, 2, 'ch2'); rect(cr, 0, 5, 12, 1, 'ch0'); rect(cr, 5, 0, 2, 12, 'ch0'); rect(cr, 0, 10, 12, 2, 'ch0')
    add('c_crate', outline(cr))

    # townsfolk: the merchant's body plan, own colours and a mark each
    body = """
....aaaaaa....
...abbbbbba...
..abbbbbbbba..
..abbssssbba..
..abstsstsba..
..abbssssbba..
...abbbbbba...
.xxabbbbbbaxx.
xxwabbccbbawxx
xwwabbccbbawwx
xwwabbbbbbawwx
.xwabbggbbawx.
..xabbbbbbax..
...abbccbba...
...abbbbbba...
...aaaaaaaa...
...kk....kk...
...kk....kk...
"""
    def folk(name, pal, mark):
        im = parse(body, pal + ' s=skin t=skin_d g=gold h=gold_d w=wood x=wood_d k=boot')
        mark(im)
        add(name + '_0', outline(im)); add(name + '_1', outline(bob(im, 2)))
    def smith_mark(im):
        rect(im, 4, 6, 6, 2, 'wood_d'); rect(im, 5, 8, 4, 1, 'wood_d')       # beard
        rect(im, 3, 10, 8, 5, 'ch1'); rect(im, 4, 10, 6, 1, 'ch2')          # leather apron
    def trainer_mark(im):
        rect(im, 3, 2, 8, 1, 'ir1'); rect(im, 3, 3, 8, 1, 'ir2')            # red headband
        rect(im, 4, 10, 6, 2, 'iron2')                                      # bracers
    folk('npc_smith', 'a=iron0 b=iron1 c=iron2', smith_mark)
    folk('npc_trainer', 'a=rg0 b=rg1 c=rg2', trainer_mark)

    # Don Montoto: his own body plan, not the townsfolk one. A bent old man in a deep hood and robe,
    # head pushed forward over a hunched back, a white beard to the belt, a tall walking stick.
    montoto = """
......aaaa........
....aabbbbaa......
...abbbbbbbba.....
..abccccccccbaa...
..abcwwsswwcbbba..
..abcsessescbbbba.
..aabsstssbabbbbba
.g.awwwwwwwabbbbba
gxg.awvwwvwabbbba.
.x.sawwwwwwaabbba.
.xssbawwwwabbbbba.
.x.abbawvwabbbbba.
.x.abbbawwabbbbba.
.x.abhgghggghbbba.
.x.abbbbbbbbbbbba.
.x..abbbbbcbbbbba.
.x..abbbbbcbbbbbba
.x..aaaaaaaaaaaaa.
.y....kk....kk....
.y....kk....kk....
"""
    mo = parse(montoto, 'a=tome0 b=tome1 c=tome2 s=skin t=skin_d e=f0 w=ui_text v=sk2 g=gold h=gold_d x=wood y=wood_d k=boot')
    add('npc_montoto_0', outline(mo)); add('npc_montoto_1', outline(bob(mo, 2)))

    # the cage: iron bars round a hooded old man with a white beard (Don Montoto); 2 frames, he fidgets
    for f in range(2):
        cg = blank(18, 22)
        # an imported small Don Montoto (tools/import_asset.py -> assets/imported/parts/cage_montoto_<f>.png) stands
        # behind the bars when it exists, so the cage matches an imported city sprite; else the code-drawn one
        part = os.path.join(OUT, 'imported', 'parts', 'cage_montoto_%d.png' % f)
        if os.path.exists(part):
            mo_s = Image.open(part).convert('RGBA')
            cg.alpha_composite(mo_s, ((18 - mo_s.width) // 2, 19 - mo_s.height))
        else:
            rect(cg, 4, 6 + f, 10, 13 - f, 'tome1'); rect(cg, 5, 3 + f, 8, 5, 'tome1'); rect(cg, 6, 5 + f, 6, 3, 'skin'); rect(cg, 7, 7 + f, 1, 1, 'f0'); rect(cg, 10, 7 + f, 1, 1, 'f0')
            rect(cg, 4, 6 + f, 10, 1, 'tome2'); rect(cg, 6, 9 + f, 6, 4, 'ui_text'); rect(cg, 7, 13 + f, 4, 1, 'ui_text')   # white beard
        rect(cg, 0, 18, 18, 4, 'iron1'); rect(cg, 0, 18, 18, 1, 'iron2'); rect(cg, 0, 21, 18, 1, 'iron0')
        rect(cg, 0, 1, 18, 2, 'iron1'); rect(cg, 0, 1, 18, 1, 'iron2')
        for x in (1, 5, 9, 13, 16):
            rect(cg, x, 3, 1, 15, 'iron2')
            if x < 16:
                rect(cg, x + 1, 3, 1, 15, 'iron0')
        add('cage_%d' % f, outline(cg))

    # the portal: a stone arch round a swirling rift, 3 frames
    for f in range(3):
        pt = blank(36, 44)
        rect(pt, 2, 40, 32, 4, 'wb1'); rect(pt, 2, 40, 32, 1, 'wb3')                                    # step
        for y in range(4, 40):
            for x in range(36):
                dx, dy = (x + 0.5 - 18) / 12.0, (y + 0.5 - 22) / 18.0
                d = dx * dx + dy * dy
                if d <= 1:
                    ang = math.atan2(dy, dx)
                    v = (math.sin(ang * 3 + d * 6 - f * 2.1) + 1) / 2 * 0.7 + (1 - d) * 0.6
                    pt.putpixel((x, y), rgb(('rg0', 'rg1', 'rg2', 'rg3', 'rg4')[min(4, int(v * 3.2))]))
                elif d <= 1.45:
                    k = 'wb2' if dy < -0.2 or dx < 0 else 'wb1'
                    pt.putpixel((x, y), rgb(k if d < 1.38 else 'wb3' if dy < 0 else 'wb0'))
        add('portal_%d' % f, outline(pt))


# ------------------------------------------------------------ the town (step big city)
def town():
    """Props of the bigger city: the gate in the north wall, houses, a fountain, braziers, lamp posts, barrels, trees,
    bushes, banners on poles, the notice board, graves, an iron fence and the dais under the portal. Same pixel size
    and palette as everything else; every sprite's anchor is its bottom centre."""
    rnd = random.Random(20261113)

    # the gate: a gatehouse front set into the north wall (three wall tiles tall), barred shut
    g = blank(64, 48)
    rect(g, 0, 6, 64, 42, 'wb1')
    for row, y in enumerate(range(7, 48, 4)):                 # brick courses
        rect(g, 0, y + 3, 64, 1, 'wb0')
        for x in range((row % 2) * 4, 64, 8):
            rect(g, x, y, 1, 3, 'wb0')
            if rnd.random() < 0.35:
                rect(g, x + 1, y, 6, 1, 'wb2')
    for x in range(0, 64, 12):                                # merlons
        rect(g, x, 0, 8, 7, 'wb1'); rect(g, x, 0, 8, 1, 'wb3'); rect(g, x, 1, 1, 6, 'wb2'); rect(g, x + 7, 1, 1, 6, 'wb0')
    rect(g, 0, 6, 64, 1, 'wb3')
    rect(g, 0, 7, 2, 41, 'wb2'); rect(g, 62, 7, 2, 41, 'wb0')
    for x in (6, 56):                                         # arrow slits
        rect(g, x, 16, 2, 8, 'void'); rect(g, x - 1, 19, 4, 2, 'void')
    for y in range(12, 48):                                   # the arch: a stone ring, then the doors
        for x in range(64):
            dx = (x + 0.5 - 32) / 21.0
            dy = (y + 0.5 - 30) / 19.0 if y < 30 else 0
            if dx * dx + dy * dy > 1:
                continue
            inner = ((x + 0.5 - 32) / 18.0) ** 2 + (((y + 0.5 - 30) / 16.0) ** 2 if y < 30 else 0)
            if inner <= 1:
                k = 'wood' if (x - 14) % 6 == 1 else 'wood_d' if (x - 14) % 6 else 'boot'
            else:
                k = 'wb3' if x < 30 and y < 26 else 'wb2' if y < 26 or x < 32 else 'wb0'
            g.putpixel((x, y), rgb(k))
    rect(g, 31, 15, 2, 33, 'outline')                         # the seam between the two leaves
    for y in (22, 40):                                        # iron bands and studs
        rect(g, 15, y, 34, 2, 'iron1'); rect(g, 15, y, 34, 1, 'iron2')
        for x in range(17, 48, 6):
            rect(g, x, y, 1, 1, 'iron3')
    rect(g, 13, 30, 38, 3, 'iron0'); rect(g, 13, 30, 38, 1, 'iron1')      # the bar across
    rect(g, 13, 29, 3, 5, 'iron1'); rect(g, 48, 29, 3, 5, 'iron1')
    rect(g, 30, 10, 4, 5, 'wb3'); rect(g, 30, 10, 4, 1, 'white')          # keystone
    add('c_gate', outline(g))

    # a house: the south slope of a tiled roof over a timber and plaster front. Windows boarded: nobody lives there yet.
    def house(r0, r1, r2, ridge):
        im = blank(64, 58)
        rect(im, 0, 0, 64, 34, r1)
        for row, y in enumerate(range(2, 34, 4)):
            rect(im, 0, y + 3, 64, 1, r0)
            for x in range((row % 2) * 3, 64, 6):
                rect(im, x, y, 1, 3, r0)
                if rnd.random() < 0.3:
                    rect(im, x + 1, y, 4, 1, r2)
        rect(im, 0, 0, 64, 2, r2); rect(im, 0, 0, 64, 1, ridge)                               # the ridge
        rect(im, 0, 32, 64, 2, r0)                                                            # eaves
        rect(im, 44, 3, 8, 11, 'wb1'); rect(im, 44, 3, 8, 2, 'wb3'); rect(im, 46, 5, 4, 2, 'void'); rect(im, 51, 5, 1, 9, 'wb0')   # chimney
        rect(im, 1, 34, 62, 24, 'pl0')
        for x in range(64):
            if (x * 5) % 13 == 0:
                rect(im, x, 39 + (x * 3) % 13, 2, 1, 'pl1')
        rect(im, 1, 34, 62, 2, 'outline')                                                     # shadow under the eaves
        rect(im, 1, 54, 62, 4, 'wb0'); rect(im, 1, 54, 62, 1, 'wb1')                          # stone footing
        for x in (1, 20, 41, 60):                                                             # timber frame
            rect(im, x, 36, 3, 18, 'wood_d'); rect(im, x, 36, 1, 18, 'ch1')
        rect(im, 1, 36, 62, 2, 'wood_d')
        rect(im, 26, 40, 12, 18, 'boot'); rect(im, 27, 41, 10, 17, 'wood_d')                  # the door
        for x in (30, 33):
            rect(im, x, 41, 1, 17, 'boot')
        rect(im, 27, 46, 10, 1, 'iron0'); rect(im, 35, 50, 1, 2, 'gold_d')
        for x in (7, 46):                                                                     # two windows, boarded
            rect(im, x, 41, 11, 10, 'wood_d'); rect(im, x + 1, 42, 9, 8, 'f0')
            rect(im, x, 43, 11, 2, 'ch1'); rect(im, x, 43, 11, 1, 'ch2'); rect(im, x, 47, 11, 2, 'ch1'); rect(im, x, 47, 11, 1, 'ch2')
            rect(im, x + 1, 43, 1, 1, 'iron2'); rect(im, x + 9, 47, 1, 1, 'iron2')
        return outline(im)
    add('c_house_a', house('rf0', 'rf1', 'rf2', 'ir1'))
    add('c_house_b', house('rs0', 'rs1', 'rs2', 'wb3'))

    # the fountain: a stone basin seen from above, a short pillar in the middle; 2 frames (the water glints)
    for f in range(2):
        im = blank(40, 30)
        ellipse(im, 20, 18, 20, 12, 'wb0'); ellipse(im, 20, 17, 20, 11, 'wb1'); ellipse(im, 20, 16, 19.5, 10.5, 'wb3')
        ellipse(im, 20, 17, 18.5, 10, 'wb2')
        ellipse(im, 20, 16, 15.5, 7.5, 'wat0'); ellipse(im, 20, 17, 14.5, 6.5, 'wat1')
        for i in range(9):
            a = i * 0.7 + f * 0.35
            x, y = int(20 + math.cos(a) * (5 + (i * 5) % 8)), int(17 + math.sin(a) * (2 + (i * 3) % 4))
            rect(im, x, y, 2 if i % 2 else 1, 1, 'wat2')
        for x in range(5, 37, 5):                              # joints of the rim
            rect(im, x, 25 if 12 < x < 28 else 23, 1, 2, 'wb0')
        rect(im, 17, 4, 6, 13, 'wb2'); rect(im, 17, 4, 1, 13, 'wb3'); rect(im, 22, 4, 1, 13, 'wb0')
        rect(im, 14, 2, 12, 4, 'wb2'); rect(im, 14, 2, 12, 1, 'wb3'); rect(im, 16, 3, 8, 2, 'wat1'); rect(im, 17 + f * 3, 3, 2, 1, 'wat2')
        rect(im, 15, 6, 1, 6 + f, 'wat2'); rect(im, 24, 6, 1, 7 - f, 'wat2')                    # two threads of water
        add('c_fountain_%d' % f, outline(im))

    # a brazier on three legs (the torch's flame, a wider cup), 3 frames
    L = 'i=iron1 I=iron0 h=iron2 r=em1 o=em2 y=em3 w=em4'
    flames = ["""
....y....
...yoy...
..oowoo..
.ooywyoo.
.oyywyyo.
""", """
...y.....
...oy....
..oywoo..
.ooywyoo.
.oyywyyo.
""", """
.....y...
....yo...
..oowyo..
.ooywyoo.
.oyywyyo.
"""]
    stand = """
IhhhhhhhI
IiiiiiiiI
.IiiiiiI.
..IIIII..
...I.I...
..I...I..
..I...I..
.I.....I.
.I.....I.
"""
    for i, f in enumerate(flames):
        add('c_brazier_%d' % i, outline(parse(f.strip('\n') + '\n' + stand.strip('\n'), L)))

    # a lamp post: an iron pole, a lantern hanging from its arm
    lp = blank(11, 30)
    rect(lp, 2, 3, 2, 26, 'iron0'); rect(lp, 2, 3, 1, 26, 'iron1'); rect(lp, 0, 28, 6, 2, 'iron0'); rect(lp, 1, 27, 4, 1, 'iron1')
    rect(lp, 2, 2, 7, 1, 'iron1'); rect(lp, 1, 1, 2, 2, 'iron2'); rect(lp, 8, 2, 1, 3, 'iron1')
    rect(lp, 6, 5, 5, 7, 'iron0'); rect(lp, 7, 6, 3, 5, 'em3'); rect(lp, 8, 7, 1, 3, 'em4'); rect(lp, 6, 5, 5, 1, 'iron1'); rect(lp, 7, 12, 3, 1, 'iron1')
    add('c_lamp', outline(lp))

    bl = blank(12, 15)                                        # a barrel
    rect(bl, 1, 2, 10, 13, 'ch1'); rect(bl, 0, 4, 12, 9, 'ch1')
    for x in (3, 6, 9):
        rect(bl, x, 2, 1, 13, 'ch0')
    rect(bl, 1, 3, 1, 10, 'ch2')
    rect(bl, 0, 5, 12, 1, 'iron1'); rect(bl, 0, 11, 12, 1, 'iron1'); rect(bl, 0, 5, 3, 1, 'iron2'); rect(bl, 0, 11, 3, 1, 'iron2')
    rect(bl, 1, 0, 10, 3, 'ch0'); rect(bl, 2, 0, 8, 2, 'ch1'); rect(bl, 2, 0, 8, 1, 'ch2'); rect(bl, 5, 1, 2, 1, 'boot')
    add('c_barrel', outline(bl))

    # a tree: a dark, heavy crown on a short trunk; and a bare one
    tr = blank(30, 40)
    rect(tr, 13, 26, 4, 14, 'boot'); rect(tr, 13, 26, 1, 14, 'wood_d'); rect(tr, 11, 38, 8, 2, 'boot'); rect(tr, 10, 39, 2, 1, 'boot'); rect(tr, 18, 39, 2, 1, 'boot')
    for cx, cy, rx, ry, k in ((15, 16, 14, 13, 'gr0'), (10, 17, 9, 9, 'gr1'), (20, 15, 9, 10, 'gr1'), (15, 10, 10, 8, 'gr1'),
                              (9, 14, 6, 5, 'gr2'), (19, 11, 7, 5, 'gr2'), (14, 7, 6, 4, 'gr2')):
        ellipse(tr, cx, cy, rx, ry, k)
    for _ in range(40):
        x, y = rnd.randrange(3, 27), rnd.randrange(3, 24)
        if tr.getpixel((x, y))[:3] == rgb('gr2')[:3]:
            tr.putpixel((x, y), rgb('gr3'))
        elif tr.getpixel((x, y))[:3] == rgb('gr1')[:3] and rnd.random() < 0.5:
            tr.putpixel((x, y), rgb('gr0'))
    add('c_tree', outline(tr))
    dead = """
....b......b......
.b...b....b...b...
..b..b...b...b....
...b.bb..b..b.....
....bbb.bb.b......
.b...abbb.b...b...
..bb..abbb..bb....
....bbabbbbb......
......abbb........
......abbb........
......abb.........
.....aabb.........
.....abbb.........
.....abbb.........
....aabbbb........
...aabbbbbb.......
"""
    add('c_tree_dead', outline(parse(dead, 'a=wood_d b=boot')))

    bu = blank(14, 10)                                        # a bush
    ellipse(bu, 7, 6, 7, 4.5, 'gr0'); ellipse(bu, 7, 5, 6.5, 4, 'gr1'); ellipse(bu, 5, 4, 4, 2.5, 'gr2')
    for x, y in ((4, 3), (8, 4), (10, 6), (6, 6)):
        bu.putpixel((x, y), rgb('gr3'))
    add('c_bush', outline(bu))
    pl = blank(22, 15)                                        # a stone planter with bushes in it
    pl.alpha_composite(bu, (1, 0)); pl.alpha_composite(bu, (7, 1))
    rect(pl, 0, 8, 22, 7, 'wb1'); rect(pl, 0, 8, 22, 1, 'wb3'); rect(pl, 0, 14, 22, 1, 'wb0'); rect(pl, 1, 9, 20, 1, 'dirt0')
    for x in (7, 15):
        rect(pl, x, 10, 1, 4, 'wb0')
    add('c_planter', outline(pl))

    # a banner on a pole: the quarter's colours, a swallow tail; 2 frames (the cloth stirs)
    def banner(name, c0, c1, c2):
        for f in range(2):
            im = blank(13, 34)
            rect(im, 1, 2, 2, 32, 'wood_d'); rect(im, 1, 2, 1, 32, 'wood'); rect(im, 0, 0, 4, 2, 'gold_d'); rect(im, 1, 0, 2, 1, 'gold')
            rect(im, 3, 4, 9, 1, 'wood_d')
            for y in range(5, 25):
                sway = 1 if (f and y > 14) else 0
                for x in range(3, 12):
                    if y > 20 and abs(x - 7) < (y - 20):          # the swallow tail
                        continue
                    k = c1 if 4 < x < 10 else c0
                    if (y % 7 == 3 and f == 0) or (y % 7 == 5 and f == 1):
                        k = c0
                    im.putpixel((x + sway, y), rgb(k))
            rect(im, 6, 9, 3, 3, c2); rect(im, 7, 8, 1, 5, c2); rect(im, 5, 10, 5, 1, c2)      # the mark
            add('%s_%d' % (name, f), outline(im))
    banner('c_banner_mage', 'tome0', 'tome1', 'tome2')
    banner('c_banner_neutral', 'wd0', 'wd1', 'wd3')
    banner('c_banner_rift', 'rg0', 'rg1', 'rg3')
    banner('c_banner_town', 'ir0', 'ir1', 'gold')

    # the notice board (the daily challenge): a small roof, papers pinned to the boards, one with a gold seal
    nb = blank(28, 28)
    rect(nb, 3, 6, 2, 22, 'wood_d'); rect(nb, 23, 6, 2, 22, 'wood_d'); rect(nb, 3, 6, 1, 22, 'ch1'); rect(nb, 23, 6, 1, 22, 'ch1')
    rect(nb, 1, 7, 26, 15, 'wood'); rect(nb, 1, 7, 26, 1, 'ch2'); rect(nb, 1, 21, 26, 1, 'wood_d'); rect(nb, 1, 14, 26, 1, 'wood_d')
    rect(nb, 0, 2, 28, 5, 'rf1'); rect(nb, 0, 2, 28, 1, 'rf2'); rect(nb, 0, 6, 28, 1, 'rf0'); rect(nb, 2, 0, 24, 2, 'rf1'); rect(nb, 2, 0, 24, 1, 'rf2')
    for x in range(3, 28, 5):
        rect(nb, x, 2, 1, 4, 'rf0')
    rect(nb, 4, 9, 6, 8, 'sk2'); rect(nb, 5, 11, 4, 1, 'sk0'); rect(nb, 5, 13, 3, 1, 'sk0'); rect(nb, 6, 9, 1, 1, 'ir1')
    rect(nb, 11, 9, 7, 10, 'sk3'); rect(nb, 12, 11, 5, 1, 'sk0'); rect(nb, 12, 13, 5, 1, 'sk0'); rect(nb, 13, 15, 3, 3, 'gold'); rect(nb, 14, 16, 1, 1, 'gold_d')
    rect(nb, 19, 10, 5, 7, 'sk1'); rect(nb, 20, 12, 3, 1, 'sk0'); rect(nb, 21, 10, 1, 1, 'ir1')
    add('c_board', outline(nb))

    gv = blank(9, 12)                                         # graves: a rounded stone, and a wooden cross
    rect(gv, 1, 2, 7, 9, 'wb2'); rect(gv, 2, 1, 5, 1, 'wb2'); rect(gv, 3, 0, 3, 1, 'wb3'); rect(gv, 1, 2, 1, 9, 'wb3'); rect(gv, 7, 3, 1, 8, 'wb0')
    rect(gv, 4, 4, 1, 4, 'wb0'); rect(gv, 3, 5, 3, 1, 'wb0'); rect(gv, 0, 11, 9, 1, 'gr0'); rect(gv, 2, 10, 1, 1, 'moss')
    add('c_grave_0', outline(gv))
    gc = blank(9, 12)
    rect(gc, 4, 0, 2, 12, 'wood_d'); rect(gc, 1, 3, 8, 2, 'wood_d'); rect(gc, 4, 0, 1, 12, 'wood'); rect(gc, 1, 3, 8, 1, 'wood'); rect(gc, 2, 11, 6, 1, 'gr0')
    add('c_grave_1', outline(gc))

    fe = blank(16, 13)                                        # an iron fence, one tile long (posts every 4 px)
    rect(fe, 0, 4, 16, 1, 'iron1'); rect(fe, 0, 10, 16, 1, 'iron1')
    for x in range(1, 16, 4):
        rect(fe, x, 1, 1, 12, 'iron1'); fe.putpixel((x, 0), rgb('iron3')); fe.putpixel((x, 1), rgb('iron2'))
    add('c_fence', fe)

    # the dais under the portal: worn rings of stone, rift-green marks at three points. Part of the ground: no outline.
    da = blank(88, 50)
    for y in range(50):
        for x in range(88):
            dx, dy = (x + 0.5 - 44) / 44.0, (y + 0.5 - 22) / 27.0
            d = (dx * dx + dy * dy) ** 0.5
            if d > 1:
                continue
            ang = math.atan2(dy, dx)
            if d > 0.93:
                k = 'f0'
            elif d > 0.72:
                k = 'f4' if int((ang + math.pi) * 9 / math.pi) % 2 else 'f3'
                if abs(math.sin(ang * 9)) < 0.12:
                    k = 'f1'
            elif d > 0.68:
                k = 'f1'
            elif d > 0.4:
                k = 'f3' if abs(math.sin(ang * 5 + 0.3)) > 0.14 else 'f1'
            elif d > 0.36:
                k = 'f1'
            else:
                k = 'f2' if (x + y) % 7 else 'f3'
            da.putpixel((x, y), rgb(k))
    for ax, ay in ((44, 45), (8, 22), (79, 22)):
        rect(da, ax - 1, ay - 1, 3, 3, 'rg1'); da.putpixel((ax, ay), rgb('rg3'))
    add('c_dais', da)


def icons():
    # 7 equipment slots, 14x14, shared iron/cloth/gold materials
    L = ('a=iron0 b=iron1 c=iron2 d=iron3 g=gold G=gold_d p=cloth0 q=cloth1 r=cloth2 w=wood W=wood_d '
         'o=orb O=orb_c k=boot l=ch1 m=ch2 n=ch0 B=mb1 C=mb2 D=mb0')
    art = {
        'helmet': '''
....aaaa....
..aabccbaa..
.abccddccba.
.abccccccba.
abccccccccba
abcggggggcba
abbaaaaaabba
abba.bb.abba
abba.bb.abba
.aa..bb..aa.
''',
        'armor': '''
.DD......DD.
DBCD....DCBD
DBBCDDDDCBBD
DBBBCggCBBBD
.DBBBggBBBD.
.DBBCggCBBD.
.DBBBggBBBD.
.DBBCggCBBD.
.DBBBggBBBD.
.DDBBBBBBDD.
...DDDDDD...
''',
        'gloves': '''
...l.l.l....
..lmlmlml...
..lmlmlml.l.
..lmmmmmllml
..lmmmmmmmml
..lmmmmmmml.
...lmmmmml..
...nggggn...
...lmmmml...
...lllll....
''',
        'boots': '''
..kkkk......
..kllk......
..klmk......
..kllk......
..kllk......
..klmkk.....
..klllkkkk..
..kllllllmk.
..kkkkkkkkk.
..GGGGGGGGG.
''',
        'belt': '''
............
............
nnnnnnnnnnnn
lmlllggllmll
lllllgGlllll
lmlllggllmll
nnnnnnnnnnnn
............
............
''',
        'weapon': '''
.........oo.
........oOOo
........oOOo
.......w.oo.
......wW....
.....wW.....
....wW......
...wW.......
..wW........
.wW.........
.W..........
''',
        'shield': '''
.aaaaaaaaaa.
abccccccccba
abcBBggBBcba
abcBBggBBcba
abcggggggcba
abcBBggBBcba
.abcBggBcba.
.abccggccba.
..abccccba..
...abccba...
....aaaa....
''',
        'bag': '''
....nnnn....
...n....n...
..nllllllln.
.nlmmmmmmmln
.nlmmggmmmln
.nlmmgGmmmln
.nlmmmmmmmln
.nllmmmmmlln
..nlllllllln
...nnnnnnnn.
''',
    }
    for k, a in art.items():
        add('i_' + k, outline(parse(a, L)))

    # --- warrior weapons: held sprites (w_<type>, blade up, grip at the bottom) and inventory icons
    L = 'b=iron1 c=iron2 d=iron3 g=gold G=gold_d w=wood W=wood_d r=blood'
    W = {
        'sword': '''
..d..
..d..
..d..
..d..
..d..
..c..
..c..
.ggg.
..w..
..w..
..G..
''',
        'axe': '''
...wd..
..cwdd.
..cwcdd
..cwcdd
..cwdd.
...wd..
...w...
...w...
...w...
...W...
...G...
''',
        'mace': '''
.c.c.
ccdcc
.ddd.
ccdcc
.c.c.
..w..
..w..
..w..
..W..
..G..
''',
        'hammer': '''
ccddddc
cddddcb
cccccbb
...w...
...w...
...w...
...w...
...W...
...G...
''',
    }
    for k, a in W.items():
        add('w_' + k, outline(parse(a, L)))

    def icon(name, draw):
        im = blank(12, 12)
        def px(x, y, key):
            if 0 <= x < 12 and 0 <= y < 12:
                im.putpixel((x, y), rgb(key))
        draw(px)
        add('i_weapon_' + name, outline(im))
    def shaft(px, x0, y0, x1, y1, key='wood'):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            px(x0 + (x1 - x0) * i // n, y0 + (y1 - y0) * i // n, key)
    def sword(px):
        for t in range(4, 11):
            px(t, 11 - t, 'iron3'); px(t - 1, 11 - t, 'iron2')
        px(10, 0, 'iron3'); px(2, 7, 'gold'); px(3, 8, 'gold'); px(4, 9, 'gold')
        px(2, 9, 'wood'); px(1, 10, 'wood'); px(0, 11, 'gold_d')
    def axe(px):
        # a broad crescent blade on one side of the haft: the widest head of the set
        shaft(px, 1, 10, 7, 4); px(0, 11, 'gold_d'); shaft(px, 7, 4, 9, 2, 'wood_d')
        for x, y, k in [(8, 0, 'iron2'), (9, 0, 'iron3'), (10, 0, 'iron3'), (11, 1, 'iron3'), (11, 2, 'iron3'), (11, 3, 'iron3'), (11, 4, 'iron2'),
                        (10, 5, 'iron2'), (9, 1, 'iron2'), (10, 1, 'iron3'), (10, 2, 'iron2'), (10, 3, 'iron2'), (10, 4, 'iron1'),
                        (9, 4, 'iron1'), (8, 1, 'iron1'), (7, 1, 'iron1')]:
            px(x, y, k)
    def mace(px):
        # a round flanged head with four spikes on a short grip
        shaft(px, 1, 10, 6, 5); px(0, 11, 'gold_d'); px(2, 8, 'iron2')
        for x, y, k in [(7, 2, 'iron2'), (8, 2, 'iron3'), (9, 2, 'iron2'), (7, 3, 'iron3'), (8, 3, 'iron3'), (9, 3, 'iron2'),
                        (7, 4, 'iron2'), (8, 4, 'iron2'), (9, 4, 'iron1'), (6, 3, 'iron1'), (10, 3, 'iron1'),
                        (8, 0, 'iron3'), (8, 1, 'iron2'), (11, 3, 'iron3'), (5, 3, 'iron2'), (8, 5, 'iron1'), (8, 6, 'iron2'),
                        (6, 1, 'iron2'), (10, 1, 'iron2'), (10, 5, 'iron1')]:
            px(x, y, k)
    def hammer(px):
        shaft(px, 1, 10, 7, 4); px(0, 11, 'gold_d')
        for y in range(0, 4):
            for x in range(5, 12):
                if 0 <= x - y - 4 <= 6:
                    px(x, y, 'iron3' if y == 0 else ('iron2' if y < 3 else 'iron1'))
    icon('sword', sword); icon('axe', axe); icon('mace', mace); icon('hammer', hammer)
    def bowi(px):
        for x, y in [(4, 0), (5, 1), (6, 2), (7, 3), (8, 4), (8, 5), (8, 6), (7, 7), (6, 8), (5, 9), (4, 10)]:
            px(x, y, 'wood')
        for y in range(1, 10):
            px(3, y, 'sk3')
        px(4, 0, 'gold_d'); px(4, 10, 'gold_d'); px(8, 5, 'gold')
        for x in range(2, 10):
            px(x, 5, 'ch2')
        px(10, 5, 'iron3'); px(2, 4, 'rg3'); px(2, 6, 'rg3'); px(1, 5, 'rg3')
    icon('bow', bowi)
    SPRITES['i_weapon_staff'] = SPRITES['i_weapon']

    L = 'r=hp R=hp_d w=white'
    add('heart', outline(parse('''
.rr.rr.
rwrrrrr
rrrrrrr
.rrrrR.
..rrR..
...R...
''', L)))
    # passive icons, 9x9
    L = ('w=ui_text d=ui_dim y=ui_warn g=ui_good r=hp b=xp1 B=xp0 v=tome1 V=tome2 o=em2 O=em3 c=orb k=outline')
    P = {
        'power': '''
......oO.
.....oOo.
....oOo..
.o.oOo...
.ooOo....
..oo.....
.o.oo....
o........
''',
        'haste': '''
....yy...
...yy....
..yy.....
.yyyyy...
...yy....
..yy.....
.yy......
.y.......
''',
        'vital': '''
.rr.rr.
rwrrrrr
rrrrrrr
.rrrrr.
..rrr..
...r...
''',
        'swift': '''
..dd.....
..ww..d..
..ww.....
..www.d..
..wwwww..
..wwwwww.
.........
.d..d..d.
''',
        'range': '''
...www...
.ww...ww.
w..bBb..w
w..BkB..w
w..bBb..w
.ww...ww.
...www...
''',
        'wisdom': '''
.vvvvvvv.
vVVVvVVVv
vVwVvVwVv
vVVVvVVVv
vVwVvVwVv
vVVVvVVVv
.vvvvvvv.
''',
        'regen': '''
...gg....
...gg....
.gggggg..
.gggggg..
...gg....
...gg....
''',
        'crit': '''
....y....
....y....
.y.yyy.y.
..yyyyy..
yyyyyyyyy
..yyyyy..
.y.yyy.y.
....y....
....y....
''',
        'pulse': '''
..ccccc..
.c.....c.
c..ccc..c
c.c...c.c
c.c.w.c.c
c.c...c.c
c..ccc..c
.c.....c.
..ccccc..
''',
        'blink': '''
.........
b..b..ww.
.b..b.www
b..b.wwww
.b..b.www
b..b..ww.
.........
''',
        'ward': '''
.bbbbbbb.
bBBBwBBBb
bBBBwBBBb
bBwwwwwBb
bBBBwBBBb
.bBBwBBb.
..bBBBb..
...bbb...
''',
        'pierce': '''
.......ww
......www
..r..ww..
.rrrww...
.rrww....
.rwwrr...
ww.rr....
w........
''',
        'multi': '''
......c..
.....cc..
c...ccccc
.c...cc..
..c...c..
.c...cc..
c...ccccc
.....cc..
......c..
''',
        'leech': '''
....r....
...rrr...
..rrrrr..
.rrwrrrr.
.rwrrrrr.
.rrrrrrr.
..rrrrr..
...rrr...
''',
    }
    for k, a in P.items():
        add('p_' + k, outline(parse(a, L)))

    # family icons (step 5), 9x9, drawn in the family's palette colours (BAL.families.<id>.icon)
    FAM = {
        'fire': ('o=em2 O=em3 y=em4', '''
....o....
...oo....
..ooOo...
..oOOoo..
.ooOyOoo.
.oOyyyOo.
.oOyyyOo.
..oOOOo..
...ooo...
'''),
        'frost': ('c=orb w=orb_c', '''
....c....
.c..c..c.
..c.c.c..
...ccc...
ccccwcccc
...ccc...
..c.c.c..
.c..c..c.
....c....
'''),
        'storm': ('y=gold d=gold_d', '''
.....yy..
....yy...
...yyd...
..yyyyy..
....yyd..
...yy....
..yd.....
..y......
'''),
        'arcane': ('v=tome1 V=tome2 w=white', '''
....V....
....v....
...vVv...
..vvVvv..
VvvVwVvvV
..vvVvv..
...vVv...
....v....
....V....
'''),
        'steel': ('i=iron2 I=iron3 d=iron1', '''
.IIIIIII.
.IiiIiiI.
.IiiIiiI.
.IIIIIII.
.IiiIiid.
..IiIid..
...IId...
....d....
'''),
        'blood': ('r=blood w=white R=hp_d', '''
....r....
....r....
...rrr...
..rrrrr..
.rrwrrrr.
.rwrrrrR.
.rrrrrrR.
..rrrRR..
...RRR...
'''),
        'venom': ('g=rg2 G=rg3 d=rg1', '''
...ggg...
..gGGGg..
.gGdGdGg.
.gGGGGGg.
..gGdGg..
..ggGgg..
...g.g...
'''),
    }
    for k, (lg, a) in FAM.items():
        add('fam_' + k, outline(parse(a, lg)))

    # small UI glyphs
    L = 'w=ui_text d=ui_dim k=outline g=rg3 G=rg1 o=em2 O=em3 s=wb1 S=wb0 y=ui_warn'
    add('i_gear', outline(parse('''
...ww.ww...
..wwwwwww..
.www...www.
www.....www
.ww.....ww.
www.....www
.www...www.
..wwwwwww..
...ww.ww...
''', L)))
    add('i_close', outline(parse('''
ww...ww
.ww.ww.
..www..
.ww.ww.
ww...ww
''', L)))
    add('arrow_r', outline(parse('''
w..
ww.
www
ww.
w..
''', L)))
    add('arrow_l', outline(parse('''
..w
.ww
www
.ww
..w
''', L)))
    # fissure progress pips: waiting (dim), open (green), sealed (ember); the super pip is larger
    pip = {'wait': 's=ui_line S=ui_bg2', 'open': 's=rg3 S=rg1', 'done': 's=em3 S=em1'}
    for k, lg in pip.items():
        add('pip_' + k, outline(parse('''
..s..
.sSs.
sSSSs
.sSs.
..s..
''', lg)))
        add('pips_' + k, outline(parse('''
s..s..s
.sSsSs.
.SSSSS.
sSSSSSs
.SSSSS.
.sSsSs.
s..s..s
''', lg)))
    # touch controls (only shown after a touch): stick base, knob, round action buttons
    for nm, R, key, a in (('stick_base', 22, 'ui_text', 70), ('stick_knob', 9, 'ui_text', 150), ('tbtn', 15, 'ui_text', 80)):
        im = blank(R * 2, R * 2)
        ellipse(im, R, R, R, R, key, a)
        if nm != 'stick_knob':
            ellipse(im, R, R, R - 2, R - 2, 'ui_bg', 110)
        add(nm, im)
    L = 'w=ui_text c=orb'
    add('t_dodge', parse('''
c..c..ww.
.c..c.www
c..c.wwww
.c..c.www
c..c..ww.
''', L))
    add('t_pulse', parse('''
..ccc..
.c...c.
c..w..c
c.www.c
c..w..c
.c...c.
..ccc..
''', L))


# -------------------------------------------------------------------------- UI frames
def ui():
    def frame(name, fill, edge, hi, size=12, corner=True, a=255):
        im = blank(size, size)
        rect(im, 0, 0, size, size, 'outline')
        rect(im, 1, 1, size - 2, size - 2, edge)
        rect(im, 2, 2, size - 4, size - 4, fill, a)
        rect(im, 1, 1, size - 2, 1, hi)
        if corner:
            for x, y in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
                im.putpixel((x, y), (0, 0, 0, 0))
        add(name, im)
    frame('panel', 'ui_bg', 'ui_line', 'ui_hi')
    frame('btn', 'ui_bg2', 'ui_line', 'ui_hi')
    frame('btn_hot', 'wb1', 'ui_hi', 'ui_text')
    frame('inset', 'void', 'ui_bg2', 'ui_bg2')
    frame('slot', 'ui_bg2', 'ui_line', 'ui_line', 20, False)
    for i, k in enumerate(['r_common', 'r_magic', 'r_rare', 'r_epic', 'r_legend']):
        frame('rar_%d' % i, 'ui_bg2', k, k, 20, False)
    # HUD plate: translucent so the room shows through, text stays on a dark backing
    im = blank(12, 12)
    rect(im, 0, 0, 12, 12, 'outline', 200); rect(im, 1, 1, 10, 10, 'ui_bg', 200)
    for x, y in ((0, 0), (11, 0), (0, 11), (11, 11)):
        im.putpixel((x, y), (0, 0, 0, 0))
    add('plate', im)
    # selection cursor (22x22, hollow)
    im = blank(22, 22)
    for i in range(22):
        for x, y in ((i, 0), (i, 21), (0, i), (21, i)):
            if i < 6 or i > 15:
                im.putpixel((x, y), rgb('ui_text'))
    add('select', im)
    im = blank(3, 3); rect(im, 0, 0, 3, 3, 'white'); add('px', im)
    # slider knob
    add('knob', outline(parse('''
.www.
wwwww
wwdww
wwdww
wwdww
wwwww
.www.
''', 'w=ui_text d=ui_dim')))


# ------------------------------------------------------------------------------ font
# Classic 5x7 dot-matrix glyphs, one byte per column (bit 0 = top row), ASCII 32..126.
FONT5X7 = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5F, 0x00, 0x00, 0x00, 0x07, 0x00, 0x07, 0x00, 0x14, 0x7F, 0x14, 0x7F, 0x14,
    0x24, 0x2A, 0x7F, 0x2A, 0x12, 0x23, 0x13, 0x08, 0x64, 0x62, 0x36, 0x49, 0x55, 0x22, 0x50, 0x00, 0x05, 0x03, 0x00, 0x00,
    0x00, 0x1C, 0x22, 0x41, 0x00, 0x00, 0x41, 0x22, 0x1C, 0x00, 0x08, 0x2A, 0x1C, 0x2A, 0x08, 0x08, 0x08, 0x3E, 0x08, 0x08,
    0x00, 0x50, 0x30, 0x00, 0x00, 0x08, 0x08, 0x08, 0x08, 0x08, 0x00, 0x60, 0x60, 0x00, 0x00, 0x20, 0x10, 0x08, 0x04, 0x02,
    0x3E, 0x51, 0x49, 0x45, 0x3E, 0x00, 0x42, 0x7F, 0x40, 0x00, 0x42, 0x61, 0x51, 0x49, 0x46, 0x21, 0x41, 0x45, 0x4B, 0x31,
    0x18, 0x14, 0x12, 0x7F, 0x10, 0x27, 0x45, 0x45, 0x45, 0x39, 0x3C, 0x4A, 0x49, 0x49, 0x30, 0x01, 0x71, 0x09, 0x05, 0x03,
    0x36, 0x49, 0x49, 0x49, 0x36, 0x06, 0x49, 0x49, 0x29, 0x1E, 0x00, 0x36, 0x36, 0x00, 0x00, 0x00, 0x56, 0x36, 0x00, 0x00,
    0x00, 0x08, 0x14, 0x22, 0x41, 0x14, 0x14, 0x14, 0x14, 0x14, 0x41, 0x22, 0x14, 0x08, 0x00, 0x02, 0x01, 0x51, 0x09, 0x06,
    0x32, 0x49, 0x79, 0x41, 0x3E, 0x7E, 0x11, 0x11, 0x11, 0x7E, 0x7F, 0x49, 0x49, 0x49, 0x36, 0x3E, 0x41, 0x41, 0x41, 0x22,
    0x7F, 0x41, 0x41, 0x22, 0x1C, 0x7F, 0x49, 0x49, 0x49, 0x41, 0x7F, 0x09, 0x09, 0x01, 0x01, 0x3E, 0x41, 0x41, 0x51, 0x32,
    0x7F, 0x08, 0x08, 0x08, 0x7F, 0x00, 0x41, 0x7F, 0x41, 0x00, 0x20, 0x40, 0x41, 0x3F, 0x01, 0x7F, 0x08, 0x14, 0x22, 0x41,
    0x7F, 0x40, 0x40, 0x40, 0x40, 0x7F, 0x02, 0x04, 0x02, 0x7F, 0x7F, 0x04, 0x08, 0x10, 0x7F, 0x3E, 0x41, 0x41, 0x41, 0x3E,
    0x7F, 0x09, 0x09, 0x09, 0x06, 0x3E, 0x41, 0x51, 0x21, 0x5E, 0x7F, 0x09, 0x19, 0x29, 0x46, 0x46, 0x49, 0x49, 0x49, 0x31,
    0x01, 0x01, 0x7F, 0x01, 0x01, 0x3F, 0x40, 0x40, 0x40, 0x3F, 0x1F, 0x20, 0x40, 0x20, 0x1F, 0x7F, 0x20, 0x18, 0x20, 0x7F,
    0x63, 0x14, 0x08, 0x14, 0x63, 0x03, 0x04, 0x78, 0x04, 0x03, 0x61, 0x51, 0x49, 0x45, 0x43, 0x00, 0x00, 0x7F, 0x41, 0x41,
    0x02, 0x04, 0x08, 0x10, 0x20, 0x41, 0x41, 0x7F, 0x00, 0x00, 0x04, 0x02, 0x01, 0x02, 0x04, 0x40, 0x40, 0x40, 0x40, 0x40,
    0x00, 0x01, 0x02, 0x04, 0x00, 0x20, 0x54, 0x54, 0x54, 0x78, 0x7F, 0x48, 0x44, 0x44, 0x38, 0x38, 0x44, 0x44, 0x44, 0x20,
    0x38, 0x44, 0x44, 0x48, 0x7F, 0x38, 0x54, 0x54, 0x54, 0x18, 0x08, 0x7E, 0x09, 0x01, 0x02, 0x08, 0x14, 0x54, 0x54, 0x3C,
    0x7F, 0x08, 0x04, 0x04, 0x78, 0x00, 0x44, 0x7D, 0x40, 0x00, 0x20, 0x40, 0x44, 0x3D, 0x00, 0x00, 0x7F, 0x10, 0x28, 0x44,
    0x00, 0x41, 0x7F, 0x40, 0x00, 0x7C, 0x04, 0x18, 0x04, 0x78, 0x7C, 0x08, 0x04, 0x04, 0x78, 0x38, 0x44, 0x44, 0x44, 0x38,
    0x7C, 0x14, 0x14, 0x14, 0x08, 0x08, 0x14, 0x14, 0x18, 0x7C, 0x7C, 0x08, 0x04, 0x04, 0x08, 0x48, 0x54, 0x54, 0x54, 0x20,
    0x04, 0x3F, 0x44, 0x40, 0x20, 0x3C, 0x40, 0x40, 0x20, 0x7C, 0x1C, 0x20, 0x40, 0x20, 0x1C, 0x3C, 0x40, 0x30, 0x40, 0x3C,
    0x44, 0x28, 0x10, 0x28, 0x44, 0x0C, 0x50, 0x50, 0x50, 0x3C, 0x44, 0x64, 0x54, 0x4C, 0x44, 0x00, 0x08, 0x36, 0x41, 0x00,
    0x00, 0x00, 0x7F, 0x00, 0x00, 0x00, 0x41, 0x36, 0x08, 0x00, 0x08, 0x04, 0x08, 0x10, 0x08,
]


# Lowercase letters with real descenders (rows 7-8), replacing the squeezed 5x7 versions.
DESCENDERS = {
    'g': ['', '', '01111', '10001', '10001', '10001', '01111', '00001', '01110'],
    'j': ['001', '', '011', '001', '001', '001', '001', '001', '110'],
    'p': ['', '', '11110', '10001', '10001', '10001', '11110', '10000', '10000'],
    'q': ['', '', '01111', '10001', '10001', '10001', '01111', '00001', '00001'],
    'y': ['', '', '10001', '10001', '10001', '10001', '01111', '00001', '01110'],
}


# Spanish letters (step 8b): accented vowels, n with tilde, u with diaeresis, inverted ! and ?.
# Lowercase accents sit in the two empty rows above the x-height; capitals get extra rows ABOVE row 0
# (the glyph is taller and its yOffset moves up by that many pixels, see EXTRA_ABOVE).
ACCENTED = {'á': ('a', 'acute'), 'é': ('e', 'acute'), 'í': ('i', 'acute'), 'ó': ('o', 'acute'), 'ú': ('u', 'acute'),
            'ü': ('u', 'diaer'), 'ñ': ('n', 'tilde'),
            'Á': ('A', 'acute'), 'É': ('E', 'acute'), 'Í': ('I', 'acute'), 'Ó': ('O', 'acute'), 'Ú': ('U', 'acute'),
            'Ü': ('U', 'diaer'), 'Ñ': ('N', 'tilde')}
FLIPPED = {'¡': '!', '¿': '?'}
EXTRA_CHARS = list(ACCENTED) + list(FLIPPED)
EXTRA_ABOVE = {}      # code -> rows the glyph rises above row 0 (filled by glyph())


def _accent_rows(kind, w, caps):
    c = w // 2
    def row(*xs):
        return ''.join('1' if i in xs else '0' for i in range(w))
    if kind == 'acute':
        return [row(c + 1), row(c)] if w > 2 else [row(c), row(c - 1 if c else 0)]
    if kind == 'diaer':
        return [row(c - 1, c + 1)]
    return [row(1, 2, 4), row(0, 3)] if w >= 5 else [row(c), row(c)]       # tilde


def accented(ch):
    base, kind = ACCENTED[ch]
    rows = glyph(ord(base))
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, '0') for r in rows]
    caps = base.isupper()
    acc = _accent_rows(kind, w, caps)
    if caps:
        EXTRA_ABOVE[ord(ch)] = len(acc)
        return acc + rows
    if kind == 'diaer':
        rows[0] = acc[0]                      # dots in row 0, one empty row above the x-height
        return rows
    EXTRA_ABOVE[ord(ch)] = 1                  # acute / tilde: rows -1 and 0, row 1 stays empty
    return [acc[0], acc[1]] + rows[1:]


def glyph(code):
    """Trimmed 1-bit glyph as a list of rows (strings of 0/1), proportional width."""
    if chr(code) in ACCENTED:
        return accented(chr(code))
    if chr(code) in FLIPPED:
        rows = glyph(ord(FLIPPED[chr(code)]))
        return rows[:7][::-1] if len(rows) == 7 else rows[::-1]
    cols = FONT5X7[(code - 32) * 5:(code - 32) * 5 + 5]
    if code == 32:
        return ['000'] * 7
    if chr(code) in DESCENDERS:
        rows = DESCENDERS[chr(code)]
        w = max(len(r) for r in rows)
        return [r.ljust(w, '0') for r in rows]
    used = [i for i, c in enumerate(cols) if c]
    cols = cols[used[0]:used[-1] + 1]
    return [''.join('1' if (c >> y) & 1 else '0' for c in cols) for y in range(7)]


def scale2x(rows):
    """EPX / Scale2x: doubles a glyph while keeping diagonals one pixel clean."""
    h, w = len(rows), len(rows[0])
    def at(x, y):
        return rows[y][x] if 0 <= x < w and 0 <= y < h else '0'
    out = []
    for y in range(h):
        r0, r1 = [], []
        for x in range(w):
            p, a, b, c, d = at(x, y), at(x, y - 1), at(x + 1, y), at(x - 1, y), at(x, y + 1)
            e0 = a if (c == a and c != d and a != b) else p
            e1 = b if (a == b and a != c and b != d) else p
            e2 = c if (d == c and d != b and c != a) else p
            e3 = d if (b == d and b != a and d != c) else p
            r0 += [e0, e1]; r1 += [e2, e3]
        out.append(''.join(r0)); out.append(''.join(r1))
    return out


def font():
    """Pack both fonts into one sheet; glyph cells include a baked 1 px outline."""
    W = 256
    cells, meta = [], {}
    for key, big in (('font', False), ('fontbig', True)):
        chars = {}
        for code in list(range(32, 127)) + [ord(c) for c in EXTRA_CHARS]:
            g = glyph(code)
            if big:
                g = scale2x(g)
            im = blank(len(g[0]), len(g))
            for y, r in enumerate(g):
                for x, ch in enumerate(r):
                    if ch == '1':
                        im.putpixel((x, y), (255, 255, 255, 255))
            im = outline(im, 'outline', diag=True)
            cells.append((key, code, im))
            chars[code] = im
        meta[key] = {'size': 14 if big else 7, 'lineHeight': 18 if big else 10, 'chars': {}}
    x = y = rowh = 0
    place = []
    for key, code, im in cells:
        if x + im.width > W:
            x = 0; y += rowh + 1; rowh = 0
        place.append((key, code, im, x, y))
        rowh = max(rowh, im.height)
        x += im.width + 1
    H = y + rowh + 1
    sheet = blank(W, H)
    for key, code, im, x, y in place:
        sheet.paste(im, (x, y))
        # [x, y, w, h, xoffset, yoffset, xadvance]; glyphs overlap by their outline column
        up = EXTRA_ABOVE.get(code, 0) * (2 if key == 'fontbig' else 1)
        meta[key]['chars'][str(code)] = [x, y, im.width, im.height, -1, -1 - up, im.width - 1]
    meta['w'], meta['h'] = W, H
    sheet.save(os.path.join(OUT, 'font.png'))
    with open(os.path.join(OUT, 'font.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    return sheet


def logo():
    """Title logo: the word in 4x glyphs, ember gradient, with a green rift running through it."""
    word = 'RIFTSCAR'
    glyphs = [scale2x(scale2x(glyph(ord(c)))) for c in word]
    gap = 3
    w = sum(len(g[0]) for g in glyphs) + gap * (len(word) - 1)
    im = blank(w, 28)
    grad = ['em4', 'em4', 'em3', 'em3', 'em3', 'em2', 'em2', 'em2', 'em2', 'em1', 'em1', 'em1', 'em0', 'em0']
    rng = random.Random(11)
    x0 = 0
    for g in glyphs:
        for y, r in enumerate(g):
            for x, ch in enumerate(r):
                if ch == '1':
                    im.putpixel((x0 + x, y), rgb(grad[y // 2]))
        x0 += len(g[0]) + gap
    # the rift: a jagged crack across the letters
    y = 15
    for x in range(w):
        if rng.random() < 0.45:
            y += rng.choice((-1, 1))
        y = max(11, min(18, y))
        for dy, key in ((-1, 'em0'), (0, 'rg3'), (1, 'rg1')):
            if im.getpixel((x, y + dy))[3]:
                im.putpixel((x, y + dy), rgb(key))
    add('logo', outline(im, 'outline', diag=True))


# ----------------------------------------------------------------------------- tiles
def tiles():
    """tiles.png, 8 columns:
       0..63   floor macro-texture (128x128, seamless): index = (ty % 8) * 8 + (tx % 8)
       64..79  wall top, 4-bit mask of wall neighbours N=1 E=2 S=4 W=8
       80..95  wall face (a wall with floor to the south): 80 + E?1 + W?2 + N?4 + variant*8
       96..99  shadow overlays: 96 under a face, 97 under a face's left end, 98 right end, 99 torch-lit
       the town's ground (step big city, src/view/city.js):
       104..119 cobbles, a seamless 64x64 texture: 104 + (ty % 4) * 4 + (tx % 4)
       120..123 the paved road, seamless 32x32: 120 + (ty % 2) * 2 + (tx % 2)
       124..127 the plaza's pavers, seamless 32x32, same rule
       128..136 a garden bed with a stone kerb, nine-slice: 128 + row * 3 + column (row, column: 0 edge, 1 middle, 2 edge)
       137..139 more grass for the middle of a bed
    """
    rng = random.Random(20261110)
    FW = 128
    floor = blank(FW, FW)
    owner = {}
    slabs = []
    cells = [(cx, cy) for cy in range(16) for cx in range(16)]
    rng.shuffle(cells)
    for cx, cy in cells:
        if (cx, cy) in owner:
            continue
        for w, h in rng.sample([(2, 2), (2, 1), (1, 2), (3, 2), (2, 1), (2, 3), (2, 2), (1, 2), (3, 2), (2, 2)], 10):
            if all(((cx + i) % 16, (cy + j) % 16) not in owner for i in range(w) for j in range(h)):
                break
        else:
            w = h = 1
        sid = len(slabs)
        slabs.append((cx, cy, w, h))
        for i in range(w):
            for j in range(h):
                owner[((cx + i) % 16, (cy + j) % 16)] = sid

    def put(x, y, key):
        floor.putpixel((x % FW, y % FW), rgb(key))
    for cx, cy, w, h in slabs:
        shade = rng.choice(['f1', 'f2', 'f2', 'f2', 'f3', 'fa', 'fb'])
        hi = {'f1': 'f2', 'f2': 'f3', 'f3': 'f4', 'fa': 'f3', 'fb': 'f3'}[shade]
        lo = {'f1': 'f0', 'f2': 'f1', 'f3': 'f2', 'fa': 'f1', 'fb': 'f1'}[shade]
        x0, y0, pw, ph = cx * 8, cy * 8, w * 8, h * 8
        for y in range(ph):
            for x in range(pw):
                k = shade
                if x == pw - 1 or y == ph - 1:
                    k = 'f0'                                   # grout
                elif (y == 0 or x == 0) and rng.random() < 0.8:
                    k = hi                                     # worn bevel, top-left light
                elif (x == pw - 2 or y == ph - 2) and rng.random() < 0.55:
                    k = lo
                elif rng.random() < 0.03:
                    k = rng.choice([hi, lo])
                put(x0 + x, y0 + y, k)
        for (x, y) in ((0, 0), (pw - 2, 0), (0, ph - 2), (pw - 2, ph - 2)):     # chipped corners
            if rng.random() < 0.5:
                put(x0 + x, y0 + y, 'f0')
        if pw * ph >= 128 and rng.random() < 0.7:              # hairline crack
            x, y = rng.randint(2, pw - 4), rng.randint(1, 3)
            for _ in range(rng.randint(4, ph - 4)):
                put(x0 + x, y0 + y, lo if rng.random() < 0.7 else 'f0')
                y += 1; x += rng.choice((-1, 0, 0, 1))
                if not (1 <= x < pw - 2 and y < ph - 2):
                    break

    sheet = blank(8 * T, 18 * T)
    sheet.paste(floor, (0, 0))

    def tile_at(idx):
        return (idx % 8) * T, (idx // 8) * T

    # wall tops
    for m in range(16):
        im = blank(T, T)
        rect(im, 0, 0, T, T, 'wt0')
        r2 = random.Random(100 + m)
        for _ in range(7):
            x, y = r2.randint(1, 13), r2.randint(1, 14)
            rect(im, x, y, r2.randint(1, 3), 1, 'wt1')
        n, e, s, w = m & 1, m & 2, m & 4, m & 8
        if not n:
            rect(im, 0, 0, T, 1, 'wt2'); rect(im, 0, 1, T, 1, 'wb0')
        if not s:
            rect(im, 0, T - 1, T, 1, 'wt2')
        if not w:
            rect(im, 0, 0, 1, T, 'wt2'); rect(im, 1, 0 if n else 1, 1, T, 'wb0')
        if not e:
            rect(im, T - 1, 0, 1, T, 'wt2'); rect(im, T - 2, 0 if n else 1, 1, T, 'wb0')
        sheet.paste(im, tile_at(64 + m))

    # wall faces
    for v in range(2):
        for m in range(8):
            e, w, n = m & 1, m & 2, m & 4
            im = blank(T, T)
            r2 = random.Random(300 + v * 8 + m)
            rect(im, 0, 0, T, 4, 'wt0')
            if not n:
                rect(im, 0, 0, T, 1, 'wt2')
            rect(im, 0, 4, T, 1, 'wb3')                        # lip between top and face
            rect(im, 0, 5, T, 11, 'wb1')
            for row, y in enumerate((5, 9, 13)):               # three brick courses
                h = 4 if y < 13 else 3
                off = (row + v) % 2 * 4
                rect(im, 0, y + h - 1, T, 1, 'wb0')
                for x in range(off, T + 8, 8):
                    rect(im, x - 1, y, 1, h - 1, 'wb0')
                    if r2.random() < 0.4:
                        rect(im, x, y, 7, 1, 'wb2')
                    if r2.random() < 0.25:
                        rect(im, x + r2.randint(1, 4), y + 1, 2, 1, 'wb2')
                    if r2.random() < 0.2:
                        rect(im, x + r2.randint(0, 4), y + 1, 2, 2, 'wb0')
            rect(im, 0, 15, T, 1, 'outline')
            if not w:
                rect(im, 0, 0, 1, 4, 'wt2'); rect(im, 0, 4, 1, 12, 'wb3')
            if not e:
                rect(im, T - 1, 0, 1, 4, 'wt2'); rect(im, T - 1, 4, 1, 12, 'wb0')
            sheet.paste(im, tile_at(80 + v * 8 + m))

    # shadow overlays (dithered, drawn over the floor)
    def shadow(idx, fn):
        im = blank(T, T)
        for y in range(T):
            for x in range(T):
                a = fn(x, y)
                if a > (BAYER[y & 3][x & 3] + 0.5) / 16:
                    im.putpixel((x, y), rgb('void', 150))
        sheet.paste(im, tile_at(idx))
    shadow(96, lambda x, y: 1.0 - y / 7.0)
    shadow(97, lambda x, y: (1.0 - y / 7.0) * min(1, (x + 1) / 6.0))
    shadow(98, lambda x, y: (1.0 - y / 7.0) * min(1, (T - x) / 6.0))
    shadow(99, lambda x, y: 0.9 - x / 6.0)                     # floor just east of a wall

    # ---- the town's ground
    r3 = random.Random(20261113)

    def stones(size, rows, widths, shades, grout, round_=True):
        """A seamless texture of stones laid in courses: rows = course heights (they add up to size)."""
        im = Image.new('RGBA', (size, size), rgb(grout))
        y = 0
        for h in rows:
            x = r3.randrange(0, 6)
            left = size
            while left > 0:
                w = r3.choice(widths)
                if left - w < 4:
                    w = left
                shade, hi, lo = r3.choice(shades)
                for yy in range(h - 1):
                    for xx in range(w - 1):
                        k = shade
                        if yy == 0 and r3.random() < 0.75:
                            k = hi
                        elif xx == 0 and r3.random() < 0.5:
                            k = hi
                        elif (yy == h - 2 or xx == w - 2) and r3.random() < 0.5:
                            k = lo
                        elif r3.random() < 0.03:
                            k = lo
                        if round_ and (xx, yy) in ((0, 0), (w - 2, 0), (0, h - 2), (w - 2, h - 2)) and r3.random() < 0.8:
                            k = grout
                        im.putpixel(((x + xx) % size, y + yy), rgb(k))
                x += w; left -= w
            y += h
        return im

    def paste_tiles(im, first, per_row):
        for j in range(im.height // T):
            for i in range(im.width // T):
                sheet.paste(im.crop((i * T, j * T, i * T + T, j * T + T)), tile_at(first + j * per_row + i))

    cob = stones(64, [5, 5, 6, 5, 6, 5, 5, 6, 5, 5, 6, 5], [5, 6, 6, 7, 8],
                 [('f1', 'f2', 'f0'), ('f2', 'f3', 'f1'), ('f2', 'f3', 'f1'), ('f2', 'f3', 'f1'), ('fa', 'f3', 'f1'), ('fb', 'f3', 'f1')], 'f0')
    for _ in range(10):                                        # moss in a few joints
        cob.putpixel((r3.randrange(64), r3.randrange(64)), rgb('moss'))
    paste_tiles(cob, 104, 4)
    road = stones(32, [8, 8, 8, 8], [8, 12, 16, 10], [('f3', 'f4', 'f2'), ('f3', 'f4', 'f2'), ('f2', 'f3', 'f1')], 'f1', round_=False)
    paste_tiles(road, 120, 2)
    plaza = Image.new('RGBA', (32, 32), rgb('f1'))             # square pavers, two tones in a checker
    for j in range(4):
        for i in range(4):
            shade, hi, lo = (('f3', 'f4', 'f2') if (i + j) % 2 else ('fa', 'f3', 'f1'))
            for yy in range(7):
                for xx in range(7):
                    k = hi if (yy == 0 or xx == 0) and r3.random() < 0.7 else lo if (yy == 6 or xx == 6) and r3.random() < 0.4 else shade
                    plaza.putpixel((i * 8 + xx, j * 8 + yy), rgb(k))
    paste_tiles(plaza, 124, 2)

    def grass(seed):
        r4 = random.Random(seed)
        im = Image.new('RGBA', (T, T), rgb('gr1'))
        for _ in range(26):
            im.putpixel((r4.randrange(T), r4.randrange(T)), rgb('gr0'))
        for _ in range(9):
            x, y = r4.randrange(T), r4.randrange(1, T)
            im.putpixel((x, y), rgb('gr2')); im.putpixel((x, y - 1), rgb('gr2' if r4.random() < 0.6 else 'gr3'))
        return im
    for row in range(3):
        for col in range(3):
            im = grass(500 + row * 3 + col)
            def kerb(x0, y0, w, h, horiz):
                rect(im, x0, y0, w, h, 'f3')
                if horiz:
                    rect(im, x0, y0, w, 1, 'f4'); rect(im, x0, y0 + h - 1, w, 1, 'f1')
                    for x in range(x0 + 5, x0 + w, 8):
                        rect(im, x, y0, 1, h, 'f1')
                else:
                    rect(im, x0, y0, 1, h, 'f4'); rect(im, x0 + w - 1, y0, 1, h, 'f1')
                    for y in range(y0 + 3, y0 + h, 8):
                        rect(im, x0, y, w, 1, 'f1')
            if col == 0:
                kerb(0, 0, 3, T, False); rect(im, 3, 0, 1, T, 'gr0')
            if col == 2:
                kerb(T - 3, 0, 3, T, False); rect(im, T - 4, 0, 1, T, 'gr0')
            if row == 0:
                kerb(0, 0, T, 3, True); rect(im, 3 if col == 0 else 0, 3, T - (3 if col == 0 else 0) - (3 if col == 2 else 0), 1, 'gr0')
            if row == 2:
                kerb(0, T - 3, T, 3, True)
            sheet.paste(im, tile_at(128 + row * 3 + col))
    for i in range(3):
        sheet.paste(grass(600 + i), tile_at(137 + i))
    sheet.save(os.path.join(OUT, 'tiles.png'))
    return sheet


# ----------------------------------------------------------------------------- atlas
def pack():
    imp = os.path.join(OUT, 'imported')
    if os.path.isdir(imp):
        for f in sorted(os.listdir(imp)):
            if f.endswith('.png'):
                SPRITES[f[:-4]] = Image.open(os.path.join(imp, f)).convert('RGBA')
    W = 256
    items = sorted(SPRITES.items(), key=lambda kv: (-kv[1].height, kv[0]))
    x = y = 1
    rowh = 0
    frames, place = {}, []
    for name, im in items:
        if x + im.width + 1 > W:
            x = 1; y += rowh + 1; rowh = 0
        place.append((name, im, x, y))
        frames[name] = {'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height}}
        rowh = max(rowh, im.height)
        x += im.width + 1
    H = 1
    while H < y + rowh + 1:
        H *= 2
    sheet = blank(W, H)
    for name, im, x, y in place:
        sheet.paste(im, (x, y))
    # 'px' is a 3x3 white block; use only its centre pixel so scaling never bleeds
    f = frames['px']['frame']
    frames['px']['frame'] = {'x': f['x'] + 1, 'y': f['y'] + 1, 'w': 1, 'h': 1}
    sheet.save(os.path.join(OUT, 'atlas.png'))
    with open(os.path.join(OUT, 'atlas.json'), 'w') as fjson:
        json.dump({'frames': frames, 'meta': {'size': {'w': W, 'h': H}, 'scale': '1'}}, fjson, separators=(',', ':'))
    return sheet


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'palette.json'), 'w') as f:
        json.dump(PALETTE, f, indent=0)
    characters(); objects(); city(); town(); icons(); ui(); logo()
    f = font()
    t = tiles()
    a = pack()
    print('atlas %dx%d, %d frames; tiles %dx%d; font %dx%d' % (a.width, a.height, len(SPRITES), t.width, t.height, f.width, f.height))
    if '--sheet' in sys.argv:
        out = os.path.join(ROOT, 'qa', 'out')
        os.makedirs(out, exist_ok=True)
        bg = Image.new('RGBA', (256, a.height + f.height + t.height + 8), rgb('f2'))
        bg.alpha_composite(a, (0, 0)); bg.alpha_composite(f, (0, a.height + 4)); bg.alpha_composite(t, (0, a.height + f.height + 8))
        bg.resize((bg.width * 4, bg.height * 4), Image.NEAREST).save(os.path.join(out, 'artsheet.png'))
        print('wrote qa/out/artsheet.png')


if __name__ == '__main__':
    main()
