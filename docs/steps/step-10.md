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

## Round log

Per class: fresh = wins over seeds 1-100 (`--brief`); careers = 10 careers x 10 runs over seeds 1-100 (`--career 10 --careers 10`):
first-win run averaged over the careers that won (n won / 10), post = win share of the runs after the first win, time = average win
time in game seconds (fresh / careers), deaths per room (fresh). All with the career bot step 2 of the WIP.

- Round 0 (the WIP as committed in fa93dbe, gearK 0.0045 of the start gear): mage fresh 15 %, first win 7.0 (10/10), post 37 %, time 566 / 478 s,
  deaths 0,0,3,3,12,16,5,21,20,5. warrior fresh 22 %, first 6.8 (9/10), post 55 %, time 538 / 455 s, deaths 0,0,0,0,5,9,9,15,25,15.
  archer fresh 7 %, first 7.5 (10/10), post 52 %, time 482 / 449 s, deaths 0,6,4,3,14,20,11,13,13,9. 0 softlocks, bestFromDrops 10/10 x3.
- Round 1 (gearK 0.0045 -> 0.006, warrior dmg 28 -> 26, archer dmg 20 -> 21): mage 15 %, first 6.2 (5/10), post 47 %, time 566 / 515 s.
  warrior 9 %, first 6.4 (7/10), post 24 %, time 561 / 481 s, deaths 0,0,0,0,3,13,19,16,26,14. archer 11 %, first 7.1 (7/10), post 65 %, time 493 / 432 s.
  Too many careers never win: gearK 0.006 is too steep; warrior -7 % damage halved its fresh rate.
- Round 2 (gearK 0.005, warrior dmg 27, archer dmg 21): mage 15 %, first 8.2 (9/10), post 25 %, time 566 / 492 s, deaths 0,0,3,3,12,16,5,21,20,5.
  warrior 11 %, first 6.3 (7/10), post 62 %, time 542 / 477 s, deaths 0,0,0,0,5,9,14,24,20,17. archer 11 %, first 6.1 (10/10), post 67 %, time 493 / 440 s,
  deaths 0,4,1,6,15,12,17,13,15,6. Careers swing a lot between rounds with small changes (10 careers is noisy: mage 21 -> 14 -> 13 wins).
- Round 3 (gearK 0.0045, warrior dmg 27, archer dmg 20.5; mage = round 0): mage = round 0. warrior 11 %, first 6.6 (8/10), post 56 %, time 542 / 479 s.
  archer 17 %, first 6.9 (10/10), post 55 %, time 492 / 431 s, deaths 0,2,1,2,13,14,12,17,18,4. Archer fresh 20 -> 20.5 -> 21 gave 7 -> 17 -> 11 %: below
  one damage point the seeds decide, not the number. Post-first-win stays above 50 % for warrior and archer whatever gearK does.
- Round 4 (round 3 with archer dmg 21, and the WIP rank buff undone: Vitality 8 -> 6 HP, Might 4 -> 3 %; ranks are permanent and outside the gear score,
  so they fed the late-career snowball): mage 15 %, first 7.0 (10/10), post 47 %, time 566 / 499 s, deaths 0,0,3,3,12,16,5,21,20,5.
  warrior 11 %, first 6.9 (7/10), post 36 %, time 542 / 494 s, deaths 0,0,0,0,5,9,14,24,20,17. archer 11 %, first 6.2 (9/10), post 50 %, time 493 / 442 s,
  deaths 0,4,1,6,15,12,17,13,15,6. Best so far; misses: archer career wins in 7.4 min, 3 warrior careers never win.
- Round 5 (round 4 with warrior hp 235 -> 245, archer dmg 21 -> 20 and hp 100 -> 110): mage = round 4. warrior 15 %, first 6.9 (9/10), post 39 %,
  time 538 / 503 s, deaths 0,0,0,0,5,8,17,20,19,16: all warrior targets met. archer 8 %, first 7.8 (9/10), post 70 %, time 486 / 446 s: worse, back to round 4's archer.
- Round 6 (round 5's warrior, round 4's archer, network spawns every 1.3 -> 1.5 s to lengthen geared wins): mage 11 %, first 7.7 (10/10), post 30 %, time 597 / 515 s.
  warrior 13 %, first 6.7 (10/10), post 33 %, time 552 / 487 s. archer 20 %, first 7.1 (9/10), post 50 %, time 518 / 463 s. Archer fresh out of range and its
  career wins still under 8 min; mage first win later. spawnEvery stays 1.3.
- Round 7 (written into src/balance.js: gearK 0.0045, warrior hp 245 dmg 27, archer hp 100 dmg 21, Vitality 6, Might 3; = rounds 4/5 combined):
  mage 15 %, first 7.0 (10/10), post 47 %, time 566 / 499 s, deaths 0,0,3,3,12,16,5,21,20,5. warrior 15 %, first 6.9 (9/10), post 39 %, time 538 / 503 s,
  deaths 0,0,0,0,5,8,17,20,19,16. archer 11 %, first 6.2 (9/10), post 50 %, time 493 / 442 s, deaths 0,4,1,6,15,12,17,13,15,6. 0 softlocks, bestFromDrops 10/10 x3.
  Misses: archer career wins 7.4 min (fresh 8.2), one warrior and one archer career with no win, career deaths gather in rooms 9-10.
- Round 8 (round 7 with gearK 0, careers only: fresh runs have no start gear): mage 48 career wins, first 5.6, post 86 %; warrior 50, first 5.2, post 95 %;
  archer 51, first 5.5, post 91 %; win times 441 / 434 / 402 s. Without gearK a geared hero wins almost every run: gearK stays 0.0045 (of the start gear).
  Stop here: final = round 7.
- Kept from the WIP: roomMult, monsterHp / monsterDmg, spawnEvery 1.3, mage and archer HP, gearK on the start gear, the bot fixes, career step 2, the daily code.
  Changed: warrior hp 235 -> 245 and dmg 28 -> 27, archer dmg 20 -> 21; reverted: the rank buff (Vitality 8 -> 6, Might 4 -> 3). Fixed: check_bag's rank check read a hardcoded +15 %.

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
