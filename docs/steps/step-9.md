# Step 9: Minimum content

Model: Sonnet 5.5. Branch: `step-9-content`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Content for the minimum public version: one biome (tiles, props, palette), six monster
types with a visible wind-up before every attack, one boss with three attacks, and gear for both
classes in all 7 slots with class-specific weapons. Code-drawn art first; for anything code draws
badly, write a prompt in docs/grok-prompts.md and import with tools/import_asset.py.
VERIFY: python3 tools/pixelart.py --sheet and look at the sheet; node tools/sim_bot.js --seeds
1-200 per class; node qa/screens.js both.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
