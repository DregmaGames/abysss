# Step 2: Playable test room

Model: Sonnet 5.5. Branch: `step-2-test-room`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Render the new fissure network and make one room feel good to play. Draw open segments, the segment-by-segment shutdown and the scars (reuse the per-pixel renderer in src/view/room.js).
Make the barrier readable: a clear edge, a blocked-step feedback, and a visible arc when the dodge carries the player across. Add ?scene=game&room=test to load a single test room that restarts on clear. Touch controls must work.
VERIFY: node qa/screens.js both; node qa/bot.js --seeds 3,4; then STOP and ask the user to play the test room for 10 minutes. Do not start anything else.

## Notes

- Step 1 already draws open segments, dark segments (scars) and a burst when a segment goes dark
  (`FissureView.updateNet` in `src/view/room.js`, the `seg` event in `src/view/game.js`). Missing:
  a clear barrier edge, feedback when a step is blocked, the arc when a dodge crosses a crack.
- `qa/screens.js` is stale: several shots are covered by the level-up modal and its fissure steps
  (`fissure_expanding`, `fissure_closing`) describe the old one-at-a-time flow. Update it in this
  step and keep it to the screens that exist.
- The debug panel (DBG button or F2) reaches any phase fast: use it instead of long bot runs.
- This step ends with the user playing the test room. Stop there.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
