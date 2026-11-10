# Riftscar (prototype)

Top-down dark-fantasy roguelike with a light RPG layer. Pixel art, Phaser 3, one playable HTML
file: `dist/riftscar.html`. No bundler, no package installs.

## Loop

1. Explore a room. Walking near a hairline crack wakes it: the fissure expands across the floor.
2. Kill what comes out. When its monsters are dead the fissure closes and leaves an orange-edged scar.
3. With every fissure sealed, the super fissure in the middle opens. Beat its wave to close it.
4. Open the chest, take the gate to the next room. Ten rooms; the Rift Tyrant is in the tenth.
5. Kills give EXP (pick 1 of 3 passives per level), closures and monsters drop gear and ability
   tomes. Gear is kept between runs; gear score unlocks harder tiers and also scales the monsters.

Controls: WASD / arrows move, SPACE dodge, Q or E pulse, I inventory, ESC settings.
Touch: drag on the left to move, two buttons on the right (they appear after the first touch).

## Build and run

```
python3 tools/pixelart.py     # regenerate assets/ (palette, atlas, tiles, fonts) from code
python3 tools/build.py        # src/ + vendor/phaser.min.js + assets/ -> dist/riftscar.html
```

Open `dist/riftscar.html` in a browser. URL options: `?seed=123` fixes the run seed,
`&scene=game` skips the title, `&tier=1`, `&fresh=1` ignores the saved gear, `&touch=1` shows the
touch controls with a mouse, `&bot=1&speed=8` lets the QA bot play fast-forward.

## Layout

```
src/balance.js        every tunable number (the only balance file)
src/rng.js mapgen.js  deterministic RNG and room generator: same seed = same map
src/sim/              the game rules, no Phaser, fixed 60 Hz step, runs under Node too
src/qa/bot.js         the QA bot (plays through the same inputs a player has)
src/view/             Phaser scenes: title, game, HUD, panels, room and fissure rendering, FX
tools/pixelart.py     all art, drawn in code at one pixel size
tools/import_asset.py magenta-key import pipeline for generated art (docs/grok-prompts.md)
tools/sim_bot.js      bulk bot runs under Node: win rate, deaths per room, softlocks
tools/contrast.js     WCAG contrast check of every HUD/panel text colour
qa/                   headless Chromium checks (Playwright)
```

One pixel size: the whole game, world and UI, is drawn at one integer scale S. 960x540 gives
480x270 art pixels at 2x, 540x960 gives 270x480. The zoom setting raises S for everything at once;
layouts are computed from the art-pixel viewport and rebuilt on resize or rotation.

## QA

```
node tools/contrast.js                      # text contrast, fails under 4.5:1
node tools/sim_bot.js --seeds 1-400         # bot win rate in the Node sim (target 25-40 %)
node tools/sim_bot.js --career 14           # consecutive runs keeping gear, tiers unlocking
node qa/bot.js --seeds 1-12                 # bot plays the real game in headless Chromium:
                                            #   no console errors, no softlock, must match Node
node qa/screens.js both                     # screenshots of every screen at 960x540 and 540x960
node qa/session.js --minutes 10             # scripted real-time session with rotation, menus, restarts
```

Results of the last full pass are in `docs/qa-report.md`.
