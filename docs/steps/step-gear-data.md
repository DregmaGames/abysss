# Step: GEAR DATA for visible equipment (brief, as given to the agent; 2026-11-13)

You are a coding agent on **Riftscar** (top-down roguelike, Phaser 3 view over a deterministic Phaser-free sim, one HTML file). Step: **GEAR DATA for visible equipment** (data and rules only; the art side is done elsewhere). Work alone, do not spawn subagents. Never ask questions: decide, note the decision in docs/STATUS.md, go on.

## Set-up (your own clone; never touch the other folders under /home/claude)
```
git clone https://github.com/DregmaGames/abysss /home/claude/abysss-gear   # three s's. NEVER the repo "abyss".
cd /home/claude/abysss-gear && git checkout step-weapon-glow && git checkout -b step-gear-data && git config core.hooksPath tools/hooks
```
Read `CLAUDE.md` (its security rules are absolute: no package installs, no curl/wget/sudo, never read or print credentials, `python3 tools/check_secrets.py` before every commit and push, `--history` before the first push of the branch), then `docs/STATUS.md` (the last sections: weapon rarity glow, visible equipment test) and `README.md` > QA. Open source files only as needed, by search and line ranges. Commit messages in English, ending with exactly:
```
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ADux4yHmxewpZyPdpKFN15
```
Commit AND push (`git push -u origin step-gear-data`) after each part. Do NOT merge into any other branch.

## What the user decided (Diablo 2 style visible equipment)
Every character starts with NO armour and a very basic COMMON weapon. Pieces found later show on the hero one by one: weapon, helmet, body armour, shield, plus gloves and boots as a colour change. How a piece looks: its MATERIAL, one of three (light / medium / heavy = leather, chainmail, plate), the same three for every class, and its rarity only changes the colour of its trim and its glow. The view work that draws this is done in another session; this step gives it the data.

## Part 1: starter weapon (commit 1)
A new character of each class starts with one common weapon equipped: the class's default weapon type (warrior: `defaultWeapon` sword; mage: its staff; archer: its bow), rarity common, the lowest item level, identified, with a plain name in English and Spanish (e.g. "Worn Sword" / "Espada gastada", "Apprentice Staff", "Short Bow"; follow how item names are stored and translated today). Stats: the weakest roll the generator can give that slot, fixed (not random), in `src/balance.js`. Where: wherever a class's gear is first created (`src/save.js` gear set creation). Existing saves: a character whose weapon slot is empty AND who owns no weapon in the bag gets the starter too, once (a save flag so it is not given again after they sell or drop it); everybody else is untouched. The test room, the tutorial (it gives "the tutorial's one item (own-class weapon)": decide whether the starter replaces that gift or the gift stays as an upgrade; keep the tutorial's item step working), the daily challenge's fixed kit and the bots must all still work. This changes balance a little (fresh characters hit harder): do not retune, measure (part 3).

## Part 2: material on armour pieces (commit 2)
Items of the slots `helmet`, `armor`, `shield`, `gloves`, `boots` get a field `mat`: 0 light (leather), 1 medium (chainmail), 2 heavy (plate). `belt` and `weapon` have none.
- Rolled when the item is generated, from the item's own RNG stream in a way that does not shift the other rolls of existing seeds more than necessary (say how you did it). Equal chances unless you find a reason; the weights live in `src/balance.js`.
- Cosmetic for now: NO stat difference between materials (the user has not decided that). Put a clearly named hook / table in `src/balance.js` (multipliers all 1) so it can be tuned later.
- The item's name and its inventory card show the material (e.g. "Leather Cap", "Chainmail Hauberk", "Plate Helm"; English and Spanish; follow the existing naming scheme and keep names within the widths the panels use; `tools/check_i18n.js` and the font's glyphs).
- Old items without `mat` (saved gear, bag, shop stock): a deterministic default from the item's id (stable across loads), written on load so it stays.
- One accessor for the view: `G.gearLook(equipped)` (pure, in a Phaser-free file) -> `{ armor: mat|null, helmet: mat|null, shield: mat|null, gloves: mat|null, boots: mat|null, rarity: { armor: r, helmet: r, ... }, weapon: { wtype, rarity } | null }` for what is equipped. Do not change `src/view/hd.js` rendering in this step beyond calling nothing new; a unit check of the accessor in `tools/check_bag.js` (or a new small `tools/check_gear.js`) is enough.
Determinism must hold (`tools/determinism.js`), and the save version / migration must be handled the way earlier steps did it (`src/save.js`; old saves and export codes still load; see `src/backup.js` tests if any).

## Part 3: measure and report (commit 3)
Bot budget is strict: **at most 10 seeds per command**. Before (untouched branch) and after: `node tools/sim_bot.js --seeds 1-10` for mage, warrior and archer (no gear), and one career run per class if the tool supports it. A small before/after table in `docs/STATUS.md` (wins, average minutes, deaths by room). Do not retune; say in one line whether the starter weapon makes the early rooms visibly easier.

## Checks
`python3 tools/build.py`; `node tools/determinism.js`; `node tools/check_i18n.js`; `node tools/check_bag.js`; `node tools/check_tutorial.js`; `node qa/bot.js --seeds 3,4,5` once at the end; `node qa/equip.js <out>` and `node qa/glow.js <out>` (they exist on this branch and must still pass: `qa/equip.js` expects a fresh warrior to show the bare sheet; with the starter weapon the fresh warrior now also shows a weapon in the fist: update that one expectation and say so); `node qa/tutorial.js land_en` once; `node qa/daily.js` once. Two screenshots of the inventory showing a material name (960x540 and 1640x922), looked at with the Read tool. Copy the final build to `/home/claude/builds/riftscar_gear.html` and the screenshots to `/home/claude/builds/gear/` (create the folders; nothing in /tmp). Update `docs/STATUS.md` and save this brief as `docs/steps/step-gear-data.md`.

## Final report (short, plain text)
Commits; the starter weapons (names, stats); how `mat` is rolled and migrated; the before/after table; which checks ran and their results; what you did NOT test; what is still rough.
