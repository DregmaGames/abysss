# Step: BIGGER CITY (brief, as given to the agent; 2026-11-13)

You are a coding agent on **Riftscar** (top-down roguelike, Phaser 3 view over a deterministic Phaser-free sim, one HTML file, pixel art drawn by code). Step: **BIGGER CITY**. Work alone, do not spawn subagents. Never ask questions: decide, note the decision in docs/STATUS.md, go on.

## Set-up (your own clone; never touch the other folders under /home/claude)
```
git clone https://github.com/DregmaGames/abysss /home/claude/abysss-city   # three s's. NEVER the repo "abyss".
cd /home/claude/abysss-city && git checkout step-landscape && git checkout -b step-big-city && git config core.hooksPath tools/hooks
```
Read `CLAUDE.md` (its security rules are absolute: no package installs, no curl/wget/sudo, never read or print credentials, `python3 tools/check_secrets.py` before every commit and push, `--history` before the first push of the branch), then `docs/STATUS.md` (the last sections: HD pilot, big rooms, landscape) and `README.md` > QA. Open source files only as needed, by search and line ranges. Commit messages in English, ending with exactly:
```
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ADux4yHmxewpZyPdpKFN15
```
Commit AND push (`git push -u origin step-big-city`) after each part, so nothing is lost if you are stopped. Do NOT merge into any other branch.

## Why
The user plays on a 1640x922 desktop window. Since the "big rooms" step the default view is far (pixel scale S=2 there: 820x461 art px visible; 960x540 art px on a 1080p screen) and the rooms were enlarged to fill it. The city (`src/view/city.js`, 26x15 tiles = 416x240 art px) is now a small island in the middle of a black screen: "la ciudad se ve muy chica". He chose: **make the city bigger too, so it fills the screen, with room for more stalls and for the neighbours rescued later**. Art mode is HD (double-density sprites for characters, `src/view/hd.js`); walls, floors and props stay on the game's own art pixel grid, drawn by `tools/pixelart.py`.

## What to build
1. **Size**: a city of about 54-58 x 30-33 tiles, so it covers a 16:9 window at S=2 from 922 to 1080 px high (centred when the window is bigger than the city; the camera follows the hero when it is smaller, e.g. a phone at 844x390 where 422x195 art px are visible, and the turned phone mode `?rotate=1`). Sizes and positions go in one data table (in `src/balance.js` or at the top of `city.js`, wherever the city's data lives now), not scattered numbers.
2. **A town, not a stretched room**: design a layout that reads as a place. Keep everything that exists and works: the Blacksmith and the Trainer (stalls with their keepers and panels), Don Montoto (appears once rescued; stories + free identification), the empty stall, the Mage quarter (an empty lot with its sign), the portal "La Brecha" (starts a run), the daily board, the crates. Suggested: a central plaza where the hero arrives, with the portal as its landmark; a market street with the stalls; a quarter for the mages and a "neutral" corner as empty lots with signs (room for future keepers: do NOT implement new shops); paved paths between them; a well or fountain; lamp posts or braziers with the same light the rooms' torches use; banners, barrels, a few trees or planters, a notice wall; an outer wall with a gate. New art goes through `tools/pixelart.py` (one pixel size, the palette in `assets/palette.json`); keep the dark-fantasy mood of the rooms.
3. **Short walks**: the hero's speed does not change. The places used every visit (portal, Blacksmith, Trainer, Don Montoto, daily board) must be within a few seconds' walk of where the hero arrives; the far corners are for the empty lots and decoration.
4. **Labels never overlap**: today "RETO DIARIO" is drawn over the portal. Place the signs so no label covers another label or a landmark, at every size below, in English and Spanish.
5. **The hero in the city is drawn in HD** like in the rooms (HD frames + the motion rig of `src/view/hd.js`, walk frames, facing) when the art mode is HD; today the city still shows the old chunky mage. Don Montoto already has HD frames. The Blacksmith and the Trainer stay as they are (code-drawn): say so in STATUS.
6. **Everything that points at city positions keeps working**: the 4 city steps of the tutorial (`src/sim/tutorial.js` / `src/view/tutorial.js`: walk to the Blacksmith, etc.), the arrows and hints, touch controls and the tap targets, `G.qa.hits`, the city QA. Positions relative to the data table.
The sim (`src/sim/`, `src/mapgen.js`) must not change in this step; if the city has any state in the save, old saves must still load.

## Checks (CLAUDE.md test budget; bot runs are not needed here)
`python3 tools/build.py`; `node tools/check_i18n.js`; `node tools/contrast.js` if you add text or colours; `node qa/city.js`; `node qa/tutorial.js land_en` once (it covers the city steps); `node qa/touch.js landscape`; `node qa/rotate.js <out>`; `node qa/hd.js <out>`. Screenshots with Playwright via `qa/lib.js` (look at each one yourself with the Read tool, and fix what looks wrong before you report): the city at **1640x922, 1920x1080, 960x540, 844x390 and 540x960**, in Spanish at 1640x922, with Don Montoto present in one of them, and one with a shop panel open. Copy the final build to `/home/claude/builds/riftscar_city.html` and the screenshots to `/home/claude/builds/city/` (create the folders; nothing in /tmp). Update `docs/STATUS.md` (what was done, what was checked, what is rough) and save this brief as `docs/steps/step-big-city.md`.

## Final report (short, plain text)
Commits; the city size and layout in two or three sentences; which checks ran and their results; what you did NOT test; what is still rough.
