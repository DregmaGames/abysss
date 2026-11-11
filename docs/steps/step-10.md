# Step 10: Balance and daily challenge

Model: Opus 5.5. Branch: `step-10-balance-daily`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Tune src/balance.js until the bot win rate is between 25 and 40 percent for each class on
a fresh save, with deaths spread across rooms, not piled on the boss. Then add the daily
challenge: the run seed comes from the UTC date, fixed class and doors, and the result screen
shows a score with a share text (no server, no accounts).
VERIFY: node tools/sim_bot.js --seeds 1-400 per class, report win rate, deaths per room and the
seeds; node qa/bot.js --seeds 1-12 (browser run must match the Node sim).

## Notes

- Ten seeds are too few to tune a win rate. Before tuning, ask the user to allow 100 seeds per
  class in the Node sim only (`tools/sim_bot.js`, one-line summary output). Do not go over 10
  without that answer.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
