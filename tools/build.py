#!/usr/bin/env python3
"""Build dist/riftscar.html: one playable file, no bundler.

Concatenates src/*.js in the order below, inlines vendor/phaser.min.js and embeds the
generated art (assets/*.png as data URIs, assets/*.json as objects) in window.G_ASSETS.

    python3 tools/build.py            # -> dist/riftscar.html
"""
import base64, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load order matters: balance and sim first (no Phaser), then QA bot, then the view.
SRC = [
    'balance.js', 'lore.js', 'i18n.js', 'i18n_ux.js', 'rng.js', 'mapgen.js',
    'sim/items.js', 'sim/economy.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js', 'sim/fissures.js', 'sim/boss.js',
    'qa/bot.js', 'save.js', 'input.js',
    'view/ui.js', 'view/fx.js', 'view/room.js', 'view/boot.js', 'view/title.js', 'view/city.js', 'view/game.js',
    'view/hud.js', 'view/panels.js', 'view/hints.js', 'main.js',
]
# Sim-only subset: runs under Node for bulk bot runs (tools/sim_bot.js).
SIM = SRC[:SRC.index('save.js') + 1]

HEAD = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Riftscar - prototype</title>
<style>html,body{margin:0;width:100%;height:100%;background:#07060b;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#game{position:fixed;inset:0}canvas{image-rendering:pixelated;display:block}</style></head>
<body><div id="game"></div>
"""


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


def assets():
    out = {}
    d = os.path.join(ROOT, 'assets')
    for name in sorted(os.listdir(d)):
        p = os.path.join(d, name)
        key, ext = os.path.splitext(name)
        if ext == '.png':
            with open(p, 'rb') as f:
                out[key] = 'data:image/png;base64,' + base64.b64encode(f.read()).decode()
        elif ext == '.json':
            with open(p, encoding='utf-8') as f:
                out[key + 'Json' if key in ('atlas', 'font') else key] = json.load(f)
    return out


def main():
    parts = [HEAD]
    parts.append('<script>' + read('vendor/phaser.min.js').rstrip('\n') + '</script>\n')
    parts.append('<script>window.G_ASSETS=' + json.dumps(assets(), separators=(',', ':')) + ';</script>\n')
    js = []
    for s in SRC:
        js.append('// ---- src/' + s + '\n' + read('src/' + s).rstrip('\n') + '\n')
    parts.append('<script>' + '\n'.join(js) + '</script>\n</body></html>\n')
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out = os.path.join(ROOT, 'dist', 'riftscar.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(''.join(parts))
    print('built', os.path.relpath(out, ROOT), os.path.getsize(out), 'bytes,', len(SRC), 'source files')


if __name__ == '__main__':
    main()
