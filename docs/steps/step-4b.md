# Step 4b: Archer

Model: Sonnet 5.5. Branch: `step-4b-archer` (built on `step-4-warrior`, not merged into main yet).

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Add the archer, the third class next to the mage and the warrior (`docs/classes.md`).
- Ranged with a bow: attack kind `bolt` with archer numbers: longer reach than the mage, slower
  shots, arrows that pierce one enemy at base (`base.pierce`). Own skill that fits a bow: Volley
  (a ring of piercing arrows, built on bolts). Numbers in `src/balance.js`.
- The archer is its own third group for abilities and families (not a kind of warrior or mage): own
  passive pool and passive names now. `docs/steps/step-5.md` designs three class groups plus shared.
- Weapons: the archer's weapon is a bow (Short Bow, Yew Longbow for rare and up). Weapon drops are
  NOT tied to the class played: any monster, chest or crack can drop any weapon type (staff, sword,
  axe, mace, hammer, bow), equal weight, one draw from the sim rng (`BAL.loot.weaponTypes`). A
  character can only equip weapons of its own class; the rest is bag loot (to be sold in the city
  later). The inventory shows "<Class> weapon" and disables EQUIP; the bot never equips them and
  drops them first when the bag fills. Other gear stays usable by every class.
- Art through `tools/pixelart.py` (hood, bow, green and brown; arrow; bow icon).
- Title picker, `?class=archer`, saved class choice, debug panel and test room work with the archer.
- The bot plays the archer (keep-away and passive picks). Target over seeds 1-10: about 2 to 4 wins,
  no softlocks. Mage and warrior: measure before and after; the loot table changed, so the numbers
  may differ (report both).
- Sim stays deterministic (`G.M`, no `Math.sin` and friends).

## Test budget

Determinism check, Node bot 10 seeds per class (mage, warrior before and after, archer),
`node qa/bot.js --seeds 3,4,5 --class archer` once at the end, 2 screenshots of the archer in play
(960x540 and 540x960).

## Done

`python3 tools/build.py`, update `docs/STATUS.md`, one commit, English message. Report what was
tested, the numbers, and what is still rough.
