# Step: SIZE TUNING PANEL (a test tool in the debug panel)

Model: Opus 5.5. Branch `step-size-panel` (from `step-weapon-glow`). Work alone, no subagents. Never ask questions: decide, note
the decision in docs/STATUS.md, go on. Commit and push after each part; do not merge into any other branch.

## What the user wants
Today Settings has one Zoom slider (the integer pixel scale S of `G.computeView`). He wants, for himself and his brother to TUNE the
game's sizes while playing (not a player option), separate sizes for: the hero, the monsters, the map (room size), the city, the
map's obstacles (pillars, inner blocks, pits), and the fissures and the super fissure. When they like a set of values, those get
baked into `src/balance.js` as the defaults for everybody (a later step; this step only builds the tool and makes it easy to read
the values off).
He chose: the hero and monster sizes are VISUAL only (hitboxes unchanged: say so on the panel in one short line). The map,
obstacles and fissure sizes change the GAME for real (the sim generates bigger/smaller rooms, obstacles and cracks: what you see is
where you collide).

## Part 1: the values and where they act (commit 1)
In `src/balance.js` a `tune` block with the six multipliers, all 1.0 by default: `hero`, `monsters`, `room`, `city`, `obstacles`,
`fissures` (one for normal cracks and the super fissure's arms together, or two if that reads better; decide). Each has a sane
range (e.g. 0.6-1.6) and a step (0.1).
- hero / monsters: the view draws the hero (HD rig in `src/view/hd.js` and the chunky sprite path), the held weapon, the trim /
  glow overlays, shadows and the boss at that scale around their feet. HD art stays pixel-exact only at whole multiples: allow
  any step but snap the drawn size to whole HD pixels like the rig already does.
- room: `G.genRoom` (`src/mapgen.js`) room width/height ranges (and the boss room, test room, tutorial room) times `room`, rounded
  to whole tiles, keeping every guarantee the generator and `tools/determinism.js`'s room sanity block check (connectivity,
  reserved zones). Monster counts per room: keep them as they are (the user will judge density) but say so.
- obstacles: the size (and if natural, the count) of interior blocks / pillars / pits times `obstacles`, rounded to tiles.
- fissures: crack arm lengths and widths (`fissure` block: arm px ranges etc.) and the super fissure's arms times `fissures`.
- city: the city layout (`CITY` table in `src/view/city.js`) — scale the CAMERA zoom of the city only if scaling the layout is
  unreasonable; decide and say which. Simplest acceptable: the city is drawn at `city` x the normal zoom (fractional camera zoom
  is fine for the city only if it does not blur badly; otherwise round to the nearest whole art-pixel scale and say so).
The sim reads these from the balance object it is given, so the same seed with the same tune values gives the same run
(determinism). Default values must leave every run byte-identical to today (`tools/determinism.js`, and a bot run with seeds 1-3
compared before/after).

## Part 2: the panel (commit 2)
DBG panel (`src/view/panels.js` P.openDebug): a button SIZES that opens a sub-panel with one row per value: label, value (e.g.
"1.2x"), − and + buttons, and a RESET row; also a COPY line that shows the six values as one short text the user can read out to
us (e.g. `hero 1.2 monsters 1.0 room 1.3 ...`), and if the clipboard works, copies it. Values persist in localStorage (try/catch:
the artifact page may refuse storage; fall back to memory) and in `G.cheats`; changes to hero / monsters / city apply at once;
room / obstacles / fissures apply from the next room generated (say so on the panel: "next room"), plus a "NEW ROOM" button that
regenerates the current room with the new values when you are in the test room (use whatever restart the test room has). Spanish
and English labels (`src/i18n.js`, `tools/check_i18n.js`), font glyphs as the rest of the UI. The panel must fit at 960x540,
1640x922 and the phone size 844x390. Also URL params for QA: `?tune=hero:1.2,room:1.3` sets values for that page.

## Checks
`python3 tools/build.py`; `node tools/determinism.js` (defaults: identical; also once with a non-default tune to prove
same-seed-same-run holds with tune values); `node tools/check_i18n.js`; `node tools/sim_bot.js --seeds 1-3` before and after
(identical at defaults); `node qa/equip.js <out>` and `node qa/glow.js <out>` still PASS; one new `qa/sizes.js`: opens the test
room with a few tune values via the URL, checks the room size and a crack length changed as expected and the hero sprite's display
height scaled, 0 console errors, saves screenshots at 1640x922 for default and for `hero:1.3,monsters:1.3,room:1.3,fissures:1.3`
and of the SIZES panel at 960x540 and 844x390. Look at every screenshot. Max 10 bot seeds per command, ever. Copy the final build
to `/home/claude/builds/riftscar_sizes.html` and the screenshots to `/home/claude/builds/sizes/`. Update `docs/STATUS.md` and save
this brief as `docs/steps/step-size-panel.md`.

## Final report (short, plain text)
Commits; what each value does exactly and its range; how the city one works; which checks ran and their results; what was NOT
tested; what is still rough.
