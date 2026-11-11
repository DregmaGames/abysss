# Step 8: Walkable city

Model: Sonnet 5.5. Branch: `step-8-city`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Build the city as a small walkable scene in the game's view and pixel size. Version 1 has
two characters: the Blacksmith (buy, sell, upgrade) and Don Montoto, who replaced the Appraiser (opens the sealed bag with
a reveal, one item at a time). Don Montoto is not there at first: he is rescued inside a run
(a caged NPC in a room) and then appears in the city. The result screen offers "run again"
directly, without walking through the city. Leave empty plots for the Mage and Neutral quarters.
VERIFY: a scripted Playwright session: run, leave, appraise, sell, buy, run again, at both sizes;
node qa/session.js --minutes 10.
- The Blacksmith's shop (or a stall next to him) also sells Scrolls of Identification for gold (price from the step 7 economy), added to
  the class's kept scroll count `gear.scrolls`. Don Montoto's reveal is the same thing as identification: it clears `unid` on an item of
  the sealed or kept bag (stats are already rolled; it never rerolls), so do not build a second mechanism.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
