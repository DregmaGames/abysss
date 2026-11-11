# Classes

A class is one entry in `BAL.classes` (`src/balance.js`). The sim reads it through `sim.cls`
(`G.classDef(B, id)`; an unknown id falls back to `BAL.defaultClass`). Nothing else in the code
names a class, so adding one is data plus art, and code only for a new attack or skill kind.

## Fields

| Field | What it holds |
| --- | --- |
| `name` | Shown on the title's class picker. |
| `base` | `r` (body radius), `hp`, `speed`, `dmg`, `atkInterval` (s per attack), `range` (bolt reach or swing reach, px), `crit` (0-1), `critMult`. Gear and passives scale these in `G.computeStats`. |
| `attack` | `kind: 'bolt'` (projectile: `speed`, `r`, `sideDmg`, `spread`, `life`, `knock`, `knockElite`, `frame`, `glow`) or `kind: 'arc'` (melee swing: `arc` = full width in radians, `knock`, `knockElite`). `firstCd`: delay of the first attack. |
| `dodge` | `dist` (px), `time` (s), `iframes` (s), `cd` (s). Crossing cracks depends on `dist`. |
| `skill` | The active button. `kind: 'pulse'` (`dmg`, `radius`, `cd`, `knock`) is the only kind today. |
| `sprite` | `frames`: atlas prefix, the game uses `<frames>_0`, `_1`, `_2` (idle, two walk frames). `glow` and `dash`: palette keys for the floor glow and the dodge tint. |
| `passives` | The level-up pool, ids from `BAL.passives`, in roll order. The order is part of the run: reordering it changes every seed. |
| `weapons`, `defaultWeapon` | Optional weapon types (melee): per type `dmg`, `atk` (interval multiplier), `reach` (px), `arc`, `knock`, `knockElite`, `name`, `item` (item name). The weapon item's `wtype` picks one; art `w_<type>` (held) and `i_weapon_<type>` (icon). |
| `passiveNames` | Per-class passive display names. |
| `bot` | QA bot hints: `keep` multiplies its keep-away distances (1 = kite like the mage, lower = stand closer), `pick` is its passive preference. |

## How the sim uses it

- `src/sim/core.js`: the player's radius, HP and first attack delay; the dodge (`cls.dodge`);
  `computeStats(B, gear, passives, clsId)`; the level-up roll uses `cls.passives`.
- `src/sim/combat.js`: `autoAttack` picks the nearest monster in range and in sight, then calls
  `shootBolts` (kind `bolt`) or `swing` (kind `arc`). A swing hits every monster whose edge is
  within `range` and whose direction is inside the arc; one crit roll per swing; it emits
  `{ t: 'swing', x, y, a, arc, r, crit }`. `castSkill` dispatches on `skill.kind`.
- `src/qa/bot.js`: reads `cls.bot`, `cls.dodge.dist` and `cls.skill.radius`.

## Adding a class

1. Copy the `mage` entry in `BAL.classes`, give it a new id and `name`, change the numbers.
   For melee: `attack: { kind: 'arc', firstCd, arc, knock, knockElite }` and a short `base.range`.
2. Pick its `passives` pool. `multi`, `pierce` and `range` only make sense for bolts; leave them
   out of a melee pool. A new passive goes in `BAL.passives` and `G.passiveInfo`.
3. Draw its frames in `tools/pixelart.py` (`<prefix>_0..2`, faces right, palette colours only),
   then `python3 tools/build.py`.
4. A new skill kind: add a branch to `S.castSkill`, its cast function, and its event in
   `src/view/game.js`. The HUD button and the input stay `pulse` (the skill button).
5. Check it: `node tools/sim_bot.js --class <id> --seeds 1-10`, then the title picker
   (or `?class=<id>`) and the test room in the browser. The mage's 10 seeds must not change.

Run start: the title's class arrows set `G.cls`; `?class=<id>` sets it from the URL; the bot
and `tools/sim_bot.js` take `--class <id>` (`G.botRun(seed, { cls })`).
