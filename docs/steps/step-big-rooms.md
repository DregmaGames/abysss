# Step: BIG ROOMS TEST (branch `step-big-rooms`, built on `step-hd-pilot`; not merged)

The brief as given to the agent. Work alone, no subagents. No questions: decide, note the decision in `docs/STATUS.md`, go on.
Commit and push after each part. Do NOT merge into main or into step-hd-pilot.

## What the user decided (he played the HD pilot on a 1640x922 desktop window with the Zoom setting at its lowest, S=2)

He and his brother like how it looks THAT SMALL: hero and monsters small on screen (the HD mage is 54 screen px tall on a 922 px
high window), art mode HD. The problem: at that zoom the room is a small island in the middle of a black screen. He wants the map
bigger so it covers the whole screen, with characters staying that small. His answers:

1. Art mode: **HD** (double-density sprites). Make HD the default art mode again when nothing is saved (`G.HD.init` in
   `src/view/hd.js` defaulted to 'lo'); keep the three-way Settings button.
2. Bigger rooms (about twice the floor area) filled the **intermediate** way: about **40-50 % more monsters** and **longer
   fissures** (the crack network should span the bigger room; more arms / longer arms rather than many more separate cracks),
   not double of everything.
3. Run length (10 rooms, 8-10 min today): **decide after testing**. So keep 10 rooms, measure, and report numbers so he can choose.
4. Phone: landscape; on small screens the camera stays as close as today and follows the player through the bigger room. Do not
   remove the portrait layout in this step.
5. The city gets bigger too, but that is the NEXT step: do not touch the city here.

## Part 1: the view (commit 1)

`G.computeView` in `src/view/ui.js` picks the integer pixel scale S: before, `base = round(min(w,h)/240)`, so a 922 px high window
got S=4 and a 1080 one S=5. New default: on big screens show about twice as much world. Suggested:
`base = min(oldBase, max(2, round(min/470)))`, which gives 300->1, 390->2, 540->2, 720->2, 922->2, 1080->2, 1440->3. Check the zoom
slider still works both ways from the new default (its range, its label text, the saved zoom offset of existing saves: a saved
negative offset must not push S below what works; clamp). World and UI share S, so panels and HUD get smaller on desktop: check
Settings, inventory, the ability cards and the HUD still read at 1640x922 and 1920x1080 (S=2) and fix what breaks (centre panels,
do not let the HUD strand in corners badly). HD sprites are drawn at half scale: at even S they are pixel-exact; at odd S
(1440p -> 3) they are uneven; note it in STATUS, do not solve it now.

## Part 2: bigger rooms (commit 2; this changes the sim, keep it deterministic)

`G.genRoom` in `src/mapgen.js`: rooms were `W = rng.int(30, 36), H = rng.int(20, 24)` tiles of 16 px (boss 34x24). Target: a room
fills a 16:9 view at S=2 on 922-1080 px high windows (820x461 to 960x540 art px), so about **W 52-58, H 30-33 tiles** (boss room
about 54x32); every size goes to `src/balance.js` (all tunables live there). On a window smaller than the room the camera follows
the player as today; on a bigger one the room is centred. Then make everything that assumed the old size right for the new one,
at least:

- the wall outline / notches / inner pits and pillars: more of them so the floor is not an empty hall (interior blocks, alcoves),
  still fully connected and with free space around spawn, doors, chest, exit, the cage of room 5 and the merchant;
- the crack network (`genFissure` and the cluster logic): longer, spanning the room, arms stop before reserved zones and walls as
  today; the super-fissure;
- monster counts about +45 % (the per-room tables / multipliers in `src/balance.js`), spawn positions spread over the room, packs
  still near their fissures; boss fight and telegraphs sized for the bigger arena;
- pickups, chest, doors, exit, Don Montoto's cage (room 5), the in-room merchant, torches and decoration density, lights;
- the test room (`?room=test`), the tutorial (`src/sim/tutorial.js`: its steps must still be completable; positions relative to
  the room, not absolute), the daily challenge (same generator, just bigger);
- the bots (`tools/sim_bot.js`, `qa/bot.js`): they must still path through the bigger room and leave / clear as before;
- anything else `grep` shows using the old sizes (minimap or room-fit camera code, fog, `G.M` only in the sim: no inexact Math in
  sim/mapgen, `tools/determinism.js` enforces it).

Do not rebalance beyond what is needed to keep the game playable: no changes to gear, abilities or the economy.

## Part 3: measure and report (commit 3: docs + any small fix)

Bot budget is strict: **at most 10 seeds per command, never more**. Run, before the sim change (on the untouched branch) and after:
`node tools/sim_bot.js --seeds 1-10` for each class (mage, warrior, archer) and one `--career` run per class; collect win rate,
average run minutes, average seconds per room, deaths by room. Put a small before/after table in `docs/STATUS.md` with a plain
recommendation for decision 3 (keep 10 rooms and accept the new length, or cut to N rooms to stay at 8-10 min) backed by the
numbers. Do not change the number of rooms.

## Checks (CLAUDE.md test budget)

`python3 tools/build.py`; `node tools/determinism.js`; `node tools/check_i18n.js`; `node tools/check_bag.js`;
`node tools/check_tutorial.js`; `node qa/bot.js --seeds 3,4,5` once at the end (browser must match Node); `node qa/hd.js <out>`
(0 console errors); `node qa/tutorial.js` once if it runs in reasonable time. Screenshots (Playwright via `qa/lib.js`, looked at):
a normal room, the boss room and the test room at **1640x922, 1920x1080, 960x540 and 844x390**, plus one portrait 540x960. The
final build goes to `/home/claude/builds/riftscar_rooms.html` and the screenshots to `/home/claude/builds/rooms/`. Update
`docs/STATUS.md` (what was done, numbers, what is rough).

## Final report (short, plain text)

Commits; the room sizes and monster multipliers chosen; the before/after table; which checks ran and their results; what was NOT
tested; what is still rough; and the recommendation on the number of rooms.

## Result

See `docs/STATUS.md` > "Big rooms test" and "Last measured (big rooms test)".
