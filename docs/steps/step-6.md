# Step 6: Doors and extraction

Model: Sonnet 5.5. Branch: `step-6-doors-extraction`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: After each room show the choice: leave with the sealed bag, or go on. Going on shows two
doors; each door states a fissure modifier for the next room (longer cracks, faster spawns, an
extra elite...) and the loot bonus it pays. Loot found in a run goes into a sealed bag: during
the run the HUD shows only how many items and their best rarity. Dying loses the whole bag;
equipped gear is kept. Leaving or winning keeps the bag for the city. Remove in-run equipping.
VERIFY: unit-style sim checks for die/leave/win bag outcomes; node tools/sim_bot.js --seeds 1-200
with a bot policy that leaves at room 5; node qa/screens.js both.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
