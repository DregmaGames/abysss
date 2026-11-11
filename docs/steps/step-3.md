# Step 3: Class architecture

Model: Opus 5.5. Branch: `step-3-classes`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Introduce character classes as data. A class defines base stats, attack kind (projectile or
melee arc), dodge parameters, sprite frames and its ability pool. Move the current mage into this
shape with no behaviour change. Add class selection to the run start and to the bot. Write the
class table in src/balance.js and a short docs/classes.md that explains how to add one.
VERIFY: node tools/sim_bot.js --seeds 1-10 must give the same results as before this step for
the mage (same seeds, same outcomes); node qa/screens.js both.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
