# Riftscar: project status

One page. Every session reads it at the start and updates it before its last commit.
Design decisions live in the plan doc (the user has it); this file is what an agent needs.

## Where we are

- Done: step 0 (repo, security rules, QA on a clean clone), step 1 (crack network), debug panel,
  step 2 code (test room, barrier edge, blocked feedback, dodge arc) on branch `step-2-test-room`.
- Next: the user plays the test room for 10 minutes (TEST ROOM button on the title, or
  `?scene=game&room=test`). Do not start step 3 before their feedback.
- `main` is the working base. One branch per step: `step-N-<slug>`.

## Last measured (2026-11-10, step 2)

- Determinism: 500 rooms generated twice, 0 mismatches; a bot run played twice is identical.
- Node bot, seeds 1-10: 3 wins (2, 4, 6); worst stuck 16 s; no softlocks (same as before step 2).
- Browser bot, seeds 3,4,5: 1 win, 0 console errors, 0 softlocks, all match Node, worst stuck 15.2 s.
- `qa/test_room.js` (960x540 mouse, 540x960 touch): title button enters room 2, touch stick pushes
  into a crack (blocked events, 0-1 px of travel), touch DODGE crosses it (dodge+ and land+ events),
  debug SKIP PHASE clears the room and it restarts (loops 1, same room); `?scene=game&room=test`
  works; 0 console errors.
- Not run on this build: `qa/screens.js` (stale), `qa/session.js`.

## Fix after step 2 (crack ends)

- Crack arms now end in a point 6 px before a reserved zone (start, chest and exit, super fissure
  pit) and 3 px before a wall or pillar, instead of being cut along the zone's straight edge
  (`genFissure`'s `ok` predicate, `clearOf` in `src/mapgen.js`). Maps changed for every seed.
- After the fix: 0 crack cells touch a reserved zone in 100 rooms; determinism passes; Node bot
  seeds 1-10: 5 wins, no softlocks, worst stuck 16 s. Cracks are about 24 % smaller in area, which
  may have made rooms easier; 10 seeds cannot tell. Check it in step 10.

## Still rough

- Test room is room index 1 (`run.testRoom`) from level 1. The Node bot dies in it in about 12 s
  on 2 of 10 seeds; the rest clear it in 38-57 s. Clearing keeps level, passives and loot.
- Headless Chromium runs the game at about 4 fps, so feel (hop timing, arc fade) is unverified.
- The dodge arc is drawn from the predicted path (walls shorten it, monsters do not).
- Inside a room the only decision is what to kill. Step 2's play test decides if that is enough.
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
- `src/rng.js`: `G.RNG`, `G.hash32`, and `G.M` (sin, cos, atan2, pow, exp, log). The sim must use
  `G.M`, never `Math`, for those: engines disagree on the last bit and runs drift apart.
- `src/mapgen.js`: `G.genRoom(runSeed, index, B)`, a pure function. `genFissure` makes one crack.
- `src/sim/core.js`: `Sim`, room loading, `move` (walls and open cracks), `bfs`, flow fields
  (`flow` for flyers, `flowWalk` for walkers), player, level-ups, `cheat*` actions.
- `src/sim/fissures.js`: the crack network (`setupFissures`, `networkKill`, `darkenSeg`,
  `spawnFromCluster`, `crackHits`, `crackOnLine`), super fissure, chest, exit, objective.
- `src/sim/combat.js`: auto-attack, pulse, monster AI, `steer`, projectiles, pickups, kills.
- `src/sim/boss.js`, `src/sim/items.js`, `src/sim/passives.js`, `src/save.js`.
- `src/qa/bot.js`: the bot (`G.Bot`, `G.botRun`); `crossDir` dodges across cracks.
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
  (`--seeds`, `--json`, `--set path=value`, `--career N`). `tools/contrast.js`.
- `qa/bot.js`, `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, `qa/lib.js`: headless Chromium checks.
- `tools/check_secrets.py`, `tools/clean_url.py`, `tools/hooks/`, `.claude/hooks/guard.py`.

URL parameters: `seed`, `tier`, `speed`, `bot=1`, `manual=1`, `touch=1`, `fresh=1`, `scene`,
`room=test`, `debug=0`.
