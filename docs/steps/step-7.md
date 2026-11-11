# Step 7: Economy

Model: Opus 5.5 writes the spec, Sonnet 5.5 implements. Branch: `step-7-economy`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Design and implement the gold economy in src/balance.js and src/sim/. Sell prices by
rarity and item level; shop stock; permanent passive ranks bought with gold (the only permanent
power besides gear). Hard rule: the shop never sells the best gear. It sells base items, upgrades
for found items and passive ranks; the top rarities only drop in fissures. Add a career
simulation: 30 consecutive bot runs with selling and buying.
VERIFY: node tools/sim_bot.js --career 30: report gold per run, what was bought, and show that
the best equipped items came from drops, not the shop.

## Notes

- Two sessions. Opus: write `docs/specs/economy.md` (sell prices, shop stock, passive ranks,
  the numbers) and the tables in `src/balance.js`. No other code. Sonnet, new session: implement
  from that spec, including the career simulation.
- The career run counts as bot runs: 10 consecutive runs, not 30, unless the user allows more.
- Scroll of Identification (added with step 6b): items of rarity 1+ drop unidentified (`it.unid`) and are identified with a scroll
  (`gear.scrolls`, per class; `BAL.loot` has the drop chances). The economy must price the scroll (buy price in the town shop, probably
  a sell price too) and add a merchant NPC inside some rooms (a rare room feature, like the chest) that sells scrolls (and possibly
  potions) for gold, paid from the run's gold. Bought scrolls follow the scroll rule: a scroll bought in a run is sealed (banked on leave
  or win, lost on death) like one found.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
