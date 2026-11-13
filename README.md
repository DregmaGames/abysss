# Riftscar (prototype)

Top-down dark-fantasy roguelike with a light RPG layer. Pixel art, Phaser 3, one playable HTML
file: `dist/riftscar.html`. No bundler, no package installs.

## Loop

1. Explore a room. Walking near a hairline crack wakes it: the fissure expands across the floor.
2. Kill what comes out (imps, bats, skeletons, hounds, cultists, wardens). When its monsters are dead the fissure closes and leaves an orange-edged scar.
3. With every fissure sealed, the super fissure in the middle opens. Beat its wave to close it.
4. Open the chest, take the gate. After each room (not the last) choose: leave with the sealed bag, or go on through one of
   two doors; each door is a fissure modifier for the next room (longer cracks, faster spawns, an extra elite...) that pays a loot bonus.
   Ten rooms; the Rift Tyrant is in the tenth.
5. Kills give EXP (pick 1 of 3 abilities per level: actives that change the attack, passives, family bonuses), closures and monsters drop gear and ability
   tomes. Gear found in a run goes into the sealed bag (the HUD shows only its count and best rarity): leaving or winning
   keeps it, dying loses it (worn gear is kept). Between runs you walk the city (title -> class -> city): the Blacksmith buys, sells, upgrades and sells scrolls, the Trainer sells permanent ranks, Don Montoto (rescued from a cage in room 5 of a run once it is clear) tells stories and identifies kept items for free, and the Rift portal starts a run. Equip from the inventory button; the gear you start with stays on all run.
   Difficulty comes from the room number and the doors; the gear score also scales the monsters a little (`run.gearK`).

Controls: WASD / arrows move, SPACE dodge, Q or E pulse, I inventory, ESC settings.
Touch: drag on the left to move, two buttons on the right (they appear after the first touch).

## Build and run

```
python3 tools/pixelart.py     # regenerate assets/ (palette, atlas, tiles, fonts) from code
python3 tools/build.py        # src/ + vendor/phaser.min.js + assets/ -> dist/riftscar.html
```

Open `dist/riftscar.html` in a browser. URL options: `?seed=123` fixes the run seed,
`&scene=game` or `&scene=city` skips the title, `&fresh=1` ignores the saved gear, `&touch=1` shows the
touch controls with a mouse, `&bot=1&speed=8` lets the QA bot play fast-forward. `&hd=0|1` turns the HD art pilot off / on for the session. `&fresh=1` also marks the tutorial as done (QA); `&tutorial=1` brings it back (`&scene=game&tutorial=1` starts the tutorial room).

## Layout

```
src/balance.js        every tunable number (the only balance file)
src/rng.js mapgen.js  deterministic RNG and room generator: same seed = same map
src/sim/              the game rules, no Phaser, fixed 60 Hz step, runs under Node too (tutorial.js: the tutorial room and its director)
src/qa/bot.js         the QA bot (plays through the same inputs a player has)
src/view/             Phaser scenes: title, city, game, HUD, panels, room and fissure rendering, FX
tools/pixelart.py     all art, drawn in code at one pixel size
tools/import_asset.py magenta-key import pipeline for generated art (docs/grok-prompts.md)
tools/hd_atlas.py     HD art pilot: double-density sprites and floor (docs/grok-prompts.md > HD art)
tools/sim_bot.js      bulk bot runs under Node: win rate, deaths per room, softlocks
tools/contrast.js     WCAG contrast check of every HUD/panel text colour
qa/                   headless Chromium checks (Playwright)
```

One pixel size: the whole game, world and UI, is drawn at one integer scale S. 960x540 gives
480x270 art pixels at 2x, 540x960 gives 270x480; a desktop window (922-1080 px high) is also 2x, so it
shows about twice as much world and a room (52-58 x 30-33 tiles, `BAL.room`) fills it; on a smaller
view the camera follows the hero. The zoom setting moves S for everything at once;
layouts are computed from the art-pixel viewport and rebuilt on resize or rotation.

## QA

```
node tools/contrast.js                      # text contrast, fails under 4.5:1
node tools/sim_bot.js --seeds 1-10 [--leave N]  # bot win rate in the Node sim (at most 10 seeds); --leave N: leaves after room N
node tools/check_bag.js                     # die / leave / win bag outcomes, doors and modifiers, save migration, hints state, tutorial flags, gentle first run, save backup codes
node tools/check_tutorial.js                # the tutorial room in the Node sim: a scripted player walks all 13 steps for every class
node tools/sim_bot.js --career 14           # consecutive runs keeping gear
node qa/bot.js --seeds 1-12                 # bot plays the real game in headless Chromium:
                                            #   no console errors, no softlock, must match Node
node qa/screens.js both                     # screenshots of every screen at 960x540 and 540x960
node qa/city.js                             # city: both layouts, both languages: nothing off screen, no label or prompt overlaps, rotation
node qa/tutorial.js [land_en|land_es|port_en|port_es]  # the interactive tutorial played in the browser (keyboard 960x540, touch 540x960), then the city steps and the gated run steps
node qa/touch.js [portrait|landscape] [lang]  # the game by finger (touch emulation): city, run, level-up, doors, inventory, settings
node qa/test_room.js [dir]                  # test room: edge, blocked step, dodge arc, touch, restart; 2 shots
node qa/session.js --minutes 10             # scripted real-time session with rotation, menus, restarts
node qa/hd.js                               # HD art pilot: test room, boss, city, cage, both sizes, ?hd=1 and 0, the toggle
node qa/rooms.js [dir] [ui|rooms|all] [WxH ...]  # big rooms: HUD and panels at 1640x922 / 1920x1080, zoom steps, old-save zoom; a room, the boss room and the test room at five sizes
node tools/run_length.js [--class C] [--md]  # run and room times of the Node bot per class: fresh, career, and a hero who cannot die (10 seeds per command)
```

Results of the last full pass are in `docs/qa-report.md`.
