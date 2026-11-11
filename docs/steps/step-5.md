# Step 5: Abilities and families

Model: Opus 5.5 writes the spec, Sonnet 5.5 implements. Branch: `step-5-abilities`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK (Opus): design the ability system as a table in src/balance.js. On level up the player picks
1 of 3 from a mixed pool of passives and active abilities. Actives attach to the basic attack
(split, chain, burn, pierce, orbit...). Only 3 active slots: picking a 4th replaces one. Every
ability has one family tag; 2 of a family gives a small bonus, 4 a large one. There are three class
groups: mage, warrior and archer (the archer is its own group, not a kind of warrior or mage). Write 12 actives
and 12 passives per class group (mage, warrior, archer) plus shared ones, with numbers. The archer's passive
names already exist in `BAL.classes.archer.passiveNames`; step 5 replaces them with the real pool.
TASK (Sonnet): implement it in src/sim/ and the level-up screen (show family, slot being
replaced, bonus progress). Extend the bot to follow a named build.
VERIFY: bot wins with at least 3 different builds per class over 200 seeds each; report them.

## Notes

- Two sessions. Opus: write `docs/specs/abilities.md` (rules, the ability table with numbers,
  the sim interfaces) and the table in `src/balance.js`. No other code. Sonnet, new session:
  implement from that spec.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
