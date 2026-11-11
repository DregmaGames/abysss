# Step 4: Warrior

Model: Sonnet 5.5. Branch: `step-4-warrior`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Add the first warrior class following docs/classes.md. Automatic melee: hits every enemy in
a short arc in front, on a cooldown. Its dodge is a charge that crosses cracks and knocks back.
Draw its sprites in tools/pixelart.py (same pixel size, 2-3 shades, 1 px outline). Teach the bot
to play melee (stay in arc range, charge across cracks toward ranged monsters).
VERIFY: node tools/sim_bot.js --seeds 10 --set class=warrior and the same for mage; report
both win rates; node qa/screens.js both.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
