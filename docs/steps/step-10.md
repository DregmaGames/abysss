# Step 10: Balance and daily challenge

Model: Opus 5.5. Branch: `step-10-balance-daily`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## User decisions for this step (2026-11-12; they replace the task text below where they differ)

- Seeds: up to 100 seeds per class per run, in the Node sim only (`tools/sim_bot.js`), one-line
  summary output (no per-seed logs). Careers stay at 10 consecutive runs, but may be run over several
  starting seeds (e.g. 10 careers of 10 runs per class) to average. Browser runs stay at 3 seeds.
  Never above 100 seeds per run.
- Balance target is PROGRESSION, not a fresh-save win rate, per class (mage, warrior, archer):
  - fresh save (no gear): 5 % to 15 % wins over seeds 1-100;
  - careers of 10 consecutive runs: first win between run 4 and run 7 on average, and after the
    first win 30 % to 50 % of the remaining runs are wins;
  - deaths spread across rooms, not piled on the boss (report deaths per room);
  - wins take 8 to 10 minutes of game time;
  - no softlocks; best equipped items still come from drops, not the shop.
- Decide `run.gearK` (keep, change or remove) from the numbers, with a one-line reason.
- Daily challenge: seed from the UTC date; class and door choices fixed for the day (from the date);
  result screen shows a score and a share text (copy to clipboard; no server, no accounts). Fixed
  starting kit, not the saved gear; does not change the saves. Entry: a title button and a portal or
  sign in the city. All text through `G.t` in English and Spanish.
- Work in rounds; stop at the first round that meets all targets, or after 10 rounds with the best.

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
