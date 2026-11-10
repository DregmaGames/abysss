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
import json, os, random, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
T = 16

PALETTE = {
    'outline': '#0b0a10', 'void': '#07060b', 'white': '#ffffff',
    # floor slabs (grout -> highlight)
    'f0': '#14131b', 'f1': '#1f1e2a', 'f2': '#282735', 'f3': '#323141', 'f4': '#403f52',
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
    # UI
    'ui_bg': '#13111b', 'ui_bg2': '#1d1b29', 'ui_line': '#5a5674', 'ui_hi': '#8f8aae',
    'ui_text': '#f2efe6', 'ui_dim': '#aaa6ba', 'ui_warn': '#ffd060', 'ui_good': '#7cf09a', 'ui_bad': '#ff6e5e',
    'hp': '#d8343c', 'hp_d': '#4c121c', 'xp': '#4aa8ff', 'xp_d': '#16304c',
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

    # --- the Rift Tyrant: boss of the last room
    L = 'a=ty0 b=ty1 c=ty2 d=ty3 h=horn H=horn_d Y=eye_y K=outline T=tooth G=rg3 g=rg2 W=horn'
    ty = parse('''
..hh.............
.hHh.............
.hHHh............
.hHHh............
..hHHh.....aaaaaa
..hHHHh...abbbbbb
...hHHHh.abbccccc
....hHHHabbcccccc
.....hhabbcYYcccc
......abbbcKYcccc
......abbbccccccc
.....aabbbbcccTTT
...aaabbabbbbbTKT
..abbbbbbaabbbbbb
.abbcccbbbbaaaaaa
abbccdcccbbbbbbbb
abccddcccbbbbbGbb
abcccccccbbbbbGGb
abccccbbbbbbbbbGg
abbccbbabbbbbbGGb
abbbbba.abbbbbGbb
abbbba..abbbbbbGg
abbbba..abbbbbbbb
abbba...abbbbbbbb
abcba...abbbbbbbb
abccba..aabbbbbba
abccba...abbbaab.
aWbWba...abbba...
.W.W.....abbba...
.........abbba...
........abbbba...
........aaaaaa...
''', L, mirror=True)
    add('tyrant_0', outline(ty)); add('tyrant_1', outline(bob(ty, 4)))


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


def glyph(code):
    """Trimmed 1-bit glyph as a list of rows (strings of 0/1), proportional width."""
    cols = FONT5X7[(code - 32) * 5:(code - 32) * 5 + 5]
    if code == 32:
        return ['000'] * 7
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
        for code in range(32, 127):
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
        meta[key]['chars'][str(code)] = [x, y, im.width, im.height, -1, -1, im.width - 1]
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
        for w, h in rng.sample([(2, 2), (2, 1), (1, 2), (3, 2), (2, 1), (1, 1), (2, 2), (1, 2)], 8):
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
        shade = rng.choice(['f1', 'f2', 'f2', 'f2', 'f3'])
        hi = {'f1': 'f2', 'f2': 'f3', 'f3': 'f4'}[shade]
        lo = {'f1': 'f0', 'f2': 'f1', 'f3': 'f2'}[shade]
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
        if pw * ph >= 128 and rng.random() < 0.5:              # hairline crack
            x, y = rng.randint(2, pw - 4), rng.randint(1, 3)
            for _ in range(rng.randint(4, ph - 4)):
                put(x0 + x, y0 + y, lo if rng.random() < 0.7 else 'f0')
                y += 1; x += rng.choice((-1, 0, 0, 1))
                if not (1 <= x < pw - 2 and y < ph - 2):
                    break

    sheet = blank(8 * T, 13 * T)
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
    characters(); objects(); icons(); ui(); logo()
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
