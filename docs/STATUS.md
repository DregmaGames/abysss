# Riftscar: project status

One page. Every session reads it at the start and updates it before its last commit.
Design decisions live in the plan doc (the user has it); this file is what an agent needs.

## Where we are

- Done: step 0 (repo, security rules, QA on a clean clone), step 1 (crack network), debug panel,
  step 2 (test room, barrier edge, blocked feedback, dodge arc), step 3 code (class architecture)
  on branch `step-3-classes`.
- User feedback on step 2 (2026-11-11): played the test room and approved it; crossing cracks with
  the dodge feels good.
- Step 4 (warrior, four weapon types) on branch `step-4-warrior`. Step 4b (archer) on `step-4b-archer`, built on it. Classes are data: `docs/classes.md`.
- Step 5 (abilities and families) on branch `step-5-abilities`: spec `docs/specs/abilities.md` (with "Implementation notes (batch A)"),
  data in `src/balance.js` (`abilityRules`, `families`, `abilities`, `builds`). **Batch A done**: offers (1 of 3, offer roll), 3 active slots
  with the replace choice, ranks, families with bonuses at 2 and 4, monster statuses, the mage group fully playable (class flag
  `abilitySystem`), level-up screen, bot builds. Warrior and archer still run the old passives (batch B: their groups, the remaining
  kinds `bounce wave whirl fan buff leech execute`, removing the old passive code).
- `main` is the working base. One branch per step: `step-N-<slug>`.

## Last measured (2026-11-11, step 5 batch A: mage abilities)

- Node bot seeds 1-10, mage builds (`--build <id>`): pyro 4 wins (1,3,7,9), avg win 457 s, avg level 16.4, Fire reached 4 in 8 runs;
  storm 3 wins (2,4,9), avg win 406 s, level 18.6, Storm 4 in 9 runs; frost 2 wins (2,3), avg win 538 s, level 18.9, Frost 4 in 7 runs.
  No softlocks, no timeouts, worst stuck 16 s. Storm was 0 of 10 before tuning: `mg_chain` r 60 -> 90 and dmg x1.5, `mg_twin`
  chance x1.5 and dmg 0.8 -> 1.0 (pyro and frost were 4 and 3 untouched).
- Warrior and archer `sim_bot --seeds 1-10 --json` identical before and after (3 wins each: 7,9,10 and 2,6,7).
- Determinism passes; it now also plays the 3 mage builds seed 3 twice (identical) with the inexact Math functions throwing.
- Browser bot `qa/bot.js --seeds 3,4,5` mage (default build pyro): 1 win (3), 0 errors, 0 softlocks, all match Node.
  Touch (540x960, taps) and keyboard (1-3, Esc) checked on the card and slot picker; `/tmp/step5a_landscape.png` and
  `/tmp/step5a_portrait.png` (cards with a "Replaces a slot" card), plus the picker with `Fire 4 -> 3: loses Pyre`.
- Not run: `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, the warrior and archer in the browser, 3 builds in the browser bot
  (only the default). Archer and warrior builds do not exist yet.

## Last measured (2026-11-11, step 4b: archer)

- Archer: HP 90, dmg 20, speed 76, atk every 0.8 s, reach 150 (mage 112), arrows fly 330 px/s and pierce 1 enemy
  at base; dodge = roll 52 px; skill = Volley (14 piercing arrows in a ring, 14 dmg, range 120, cd 7). Green hood,
  quiver, bow in the sprite; arrow projectile (rotates), bow icon `i_weapon_bow`. Own pool order and passive names
  (`passiveNames`, e.g. Strong Draw, Quick Nock, Deadeye, Piercing Arrow, Volley Mastery). Step 5 designs three class groups.
- Weapon drops now ignore the played class: every type equal weight (`BAL.loot.weaponTypes`: staff, sword, axe,
  mace, hammer, bow). Equip only your own class's weapons; others are bag loot (to sell in the city later; default,
  the user can change it). Inventory: "<Class> weapon", EQUIP disabled. Bot skips and discards them first. Bows are
  "Short Bow", "Yew Longbow" (rare and up). Warrior's old class-only roll removed.
- Node bot seeds 1-10 (loot change shifts mage and warrior): mage before 5 wins (1,2,4,7,8), after 3 wins
  (2,6,7); warrior before 3 (4,7,9), after 3 (7,9,10); archer 3 wins (2,6,7), no softlocks, worst stuck 16 s.
  Archer dmg tuned 15 -> 20 (0-1 wins before). Determinism passes.
- Browser bot seeds 3,4,5 `--class archer`: 0 wins (rooms 9, 4, 8), 0 errors, 0 softlocks, all match Node.
  Test room and `?class=archer` title load with 0 errors; screenshots `/tmp/step4b_landscape.png`, `/tmp/step4b_portrait.png`.
- Not run: `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, DBG panel clicks with the archer, inventory EQUIP-disabled look.

## Last measured (2026-11-11, step 4: warrior)

- Warrior: HP 250, dmg 32, speed 74, swing reach 30 px (+ weapon), arc melee on a cooldown; dodge = charge
  (58 px, crosses cracks, shoves and hits what it touches: `dodge.knock`, `dodge.hit`); skill = Shockwave
  (pulse kind, radius 46). Iron-grey knight with red plume and gold shield; the weapon is its own sprite.
- Weapon types (`BAL.classes.warrior.weapons`): sword (fast), axe (more dmg), mace (knockback), hammer
  (slowest, most dmg, wide arc). The weapon item's `wtype` picks it; none equipped = sword. Warrior weapon
  drops roll a type (one extra rng draw, only for classes with `weapons`). `G.weaponOf`, `G.itemIcon`.
  `weaponForce` in the class entry forces a type for QA: `--set 'classes.warrior.weaponForce="axe"'`.
- Mage `sim_bot --seeds 1-10 --json` identical before/after (5 wins: 1, 2, 4, 7, 8). Determinism passes.
- Warrior bot seeds 1-10: 3 wins (4, 7, 9), no softlocks, worst stuck 16 s. Forced type: sword 3, axe 3,
  mace 2, hammer 3 wins. Browser bot seeds 3,4,5 (`qa/bot.js --class warrior`): 1 win (4), 0 errors,
  0 softlocks, all match Node.
- Bot melee: closes to 0.6 x reach, charges at ranged and elite monsters, keep-away 0.8. Passive names and
  skill name are per class (`passiveNames`, `skill.name`); the class choice is saved in `settings.cls`.
- Not run: `qa/screens.js`, `qa/session.js`, `qa/test_room.js` (test room with the warrior not checked).

## Last measured (2026-11-11, step 3)

- Mage moved to `BAL.classes.mage` with no behaviour change: `node tools/sim_bot.js --seeds 1-10
  --json` before and after is identical field by field (5 wins: 1, 2, 4, 7, 8; worst stuck 16 s;
  no softlocks).
- Determinism: 500 rooms generated twice, 0 mismatches; a bot run played twice is identical.
- Browser bot, seeds 3,4,5: 1 win (4), 0 console errors, 0 softlocks, all match Node, worst stuck 15.1 s.
- Screenshots: title at 960x540 (new MAGE picker row fits; help line still on screen), test room
  at 540x960 via `?scene=game&room=test&class=mage&bot=1`. Title class arrows, TEST ROOM button and
  the debug panel (F2) work; 0 console errors.
- Melee path smoke test only (throwaway class in a scratch script, not shipped): swings hit and
  kill; the unchanged bot with that class died in room 2 in 39 s (1 seed).
- Not run on this build: `qa/screens.js` (stale), `qa/session.js`, `qa/test_room.js`.

## Step 2 measured (2026-11-10)

- `qa/test_room.js` (960x540 mouse, 540x960 touch): title button enters room 2, touch stick pushes
  into a crack (blocked events, 0-1 px of travel), touch DODGE crosses it (dodge+ and land+ events),
  debug SKIP PHASE clears the room and it restarts (loops 1, same room); `?scene=game&room=test`
  works; 0 console errors.

## Fix after step 2 (crack ends)

- Crack arms now end in a point 6 px before a reserved zone (start, chest and exit, super fissure
  pit) and 3 px before a wall or pillar, instead of being cut along the zone's straight edge
  (`genFissure`'s `ok` predicate, `clearOf` in `src/mapgen.js`). Maps changed for every seed.
- After the fix: 0 crack cells touch a reserved zone in 100 rooms; determinism passes; Node bot
  seeds 1-10: 5 wins, no softlocks, worst stuck 16 s. Cracks are about 24 % smaller in area, which
  may have made rooms easier; 10 seeds cannot tell. Check it in step 10.

## Still rough

- Step 4: warrior swing art is sparks plus a rotating held weapon (no slash sprite); weapon types are
  balanced by 10-seed bot runs only (noise). HUD skill button and input are still called `pulse`. Item
  names shown for a warrior weapon do not say the type in the stat line beyond the name. The bot does
  not choose weapons by type.
- Test room is room index 1 (`run.testRoom`) from level 1. The Node bot dies in it in about 12 s
  on 2 of 10 seeds; the rest clear it in 38-57 s. Clearing keeps level, passives and loot.
- Headless Chromium runs the game at about 4 fps, so feel (hop timing, arc fade) is unverified.
- The dodge arc is drawn from the predicted path (walls shorten it, monsters do not).
- Inside a room the only decision is what to kill (the user approved the step 2 test room as is).
- `qa/screens.js` is stale (shots covered by the level-up modal, old fissure steps).
- `qa/session.js` once failed to find the UNEQUIP button 13 minutes in; not reproduced.
- Difficulty tiers II and III are not balanced. No audio. No imported art ships.
- Ten seeds give a noisy win rate; treat 2 to 4 wins out of 10 as the same result.

## Design assumptions waiting for the user

- Dying loses the sealed bag; equipped gear is kept.
- Bats fly over open cracks; the boss ignores them; other monsters walk around.
- 3 active ability slots, family bonuses at 2 and 4.
- Where the web version is published (needed before step 11).

## Code map

Sim (no Phaser, deterministic, runs in Node):
- `src/balance.js`: every tunable number. `fissure.*` holds the crack network settings.
  `classes.*` holds the classes (`docs/classes.md`); `player.*` only what all classes share.
- `src/rng.js`: `G.RNG`, `G.hash32`, and `G.M` (sin, cos, atan2, pow, exp, log). The sim must use
  `G.M`, never `Math`, for those: engines disagree on the last bit and runs drift apart.
- `src/mapgen.js`: `G.genRoom(runSeed, index, B)`, a pure function. `genFissure` makes one crack.
- `src/sim/core.js`: `Sim` (`opts.cls`; `sim.cls`, `sim.clsId`), `G.classDef`, room loading, `move` (walls and open cracks), `bfs`, flow fields
  (`flow` for flyers, `flowWalk` for walkers), player, level-ups, `cheat*` actions.
- `src/sim/fissures.js`: the crack network (`setupFissures`, `networkKill`, `darkenSeg`,
  `spawnFromCluster`, `crackHits`, `crackOnLine`), super fissure, chest, exit, objective.
- `src/sim/combat.js`: auto-attack (`shootBolts` or `swing`, event `swing`), `castSkill` -> pulse, monster AI, `steer`, projectiles, pickups, kills.
- `src/sim/boss.js`, `src/sim/items.js`, `src/sim/passives.js` (old passives: warrior and archer until batch B), `src/save.js`.
- `src/sim/abilities.js`: pool, offers, family tiers, stats, card info. `src/sim/effects.js`: statuses, triggers, effect kinds, orbit, zones, echoes.
- `src/qa/bot.js`: the bot (`G.Bot(sim, buildId)`, `G.botRun`); `crossDir` dodges across cracks; `pickAbility` follows a build.
- Test room: `Sim({ testRoom: true })` loads `B.run.testRoom`; `restartTestRoom` reloads it on clear.
  Sim events for the view: `blocked` (mage pushes into an open crack), `dodge.cross`, `land.cross`.

View (Phaser):
- `src/view/game.js`: scene, fixed 60 Hz stepping, sim events to effects, `G.qa.state()`.
- `src/view/room.js`: tiles and `FissureView` (per-pixel crack renderer, `updateNet`; dark halo =
  barrier edge, `bump` flares the lip). Dodge arc and recoil: `planArc`/`drawArc` in `game.js`.
- `src/view/hud.js`, `src/view/panels.js` (inventory, settings, debug, result), `src/view/ui.js`
  (UI toolkit, `UI.hit` names for QA clicks), `title.js`, `input.js`, `fx.js`, `boot.js`, `main.js`.

Tools:
- `tools/build.py` builds `dist/riftscar.html`. `tools/determinism.js`. `tools/sim_bot.js`
  (`--seeds`, `--class id`, `--build id`, `--json`, `--set path=value`, `--career N`). `tools/contrast.js`.
- `qa/bot.js`, `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, `qa/lib.js`: headless Chromium checks.
- `tools/check_secrets.py`, `tools/clean_url.py`, `tools/hooks/`, `.claude/hooks/guard.py`.

URL parameters: `seed`, `tier`, `class`, `build`, `speed`, `bot=1`, `manual=1`, `touch=1`, `fresh=1`, `scene`,
`room=test`, `debug=0`.

## Planned later

- A dagger class (daguero), after the first public version's three classes. It may take the Venom family.
