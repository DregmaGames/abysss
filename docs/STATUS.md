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
- Step 5 (abilities and families) on branch `step-5-abilities`: spec `docs/specs/abilities.md` (with "Implementation notes (batch A)" and
  "(batch B)"), data in `src/balance.js` (`abilityRules`, `families`, `abilities`, `builds`). **Done (batches A and B)**: offers (1 of 3),
  3 active slots with the replace choice, ranks, families with bonuses at 2 and 4, monster statuses, all three class groups (mage,
  warrior with weapon overrides, archer) and the shared pool, every effect kind, level-up screen, bot builds, the ABILITIES page of the
  equipment panel. The old passives (table, files, flags) are gone.
- Step 6 (doors and extraction) on branch `step-6-doors-extraction`: the after-room choice, door modifiers, the sealed bag, in-run equipping from the sealed bag, gear per class.
  Rules in `src/balance.js` (`doors`, `run.deathKeepsEquipped`, `loot.bagSize` = sealed bag of a run, `loot.stashSize` = kept bag).
- Step 7 (economy) on branch `step-7-economy`: **done** (spec `docs/specs/economy.md` with "Decisions by the user" and "Implementation notes"; data in
  `src/balance.js` `economy`; code in `src/sim/economy.js`, `core.js`, `combat.js`, `fissures.js`, `src/save.js` v6, `src/qa/bot.js` `shopVisit`, shop panel in
  `src/view/panels.js`, merchant in `hud.js` / `game.js`). Gold is sealed per run (banked on leave / win, lost on death), per class; shop (BUY / SELL / UPGRADE / RANKS)
  in the city (Blacksmith and Trainer) since step 8; the shop sells commons, magic and ONE rare (250 / 400 / 550 gold), never epic or better; the merchant in rooms sells scrolls and potions.
- Difficulty tiers removed (2026-11-11, user decision): no `tierMult`, `tierGear`, `ilvlTier`, `gold.tier`, `sim.tier`, `shopTier`, `?tier=`, title tier picker or save `shop.tier`.
  Monsters, item level, gold and shop numbers equal what tier 1 gave (drop ilvl = 1 + floor(room / 3), shop ilvl 2, gold x room only). Difficulty = room number + doors.
  `run.gearK` kept: it is now the only rule where gear score raises monster strength (+0.5 % per point; gear 100 = x1.5), and the title shows it ("Monsters x1.xx").
  Decide in step 10 whether it stays. Old saves load as they are (the stored shop tier is ignored; save stays v6).
- Step 8 (city) on branch `step-8-city`: **done**. Title ("ENTER THE CITY", the class picker row stays on the title) -> the walkable city of the selected class. The title no longer has EQUIPMENT or SHOP.
  City = `src/view/city.js` (`CityScene` world + `CityHudScene` overlay), 26 x 15 tiles, art in `tools/pixelart.py` `city()`. Stalls: Blacksmith (BUY with the scrolls, SELL, UPGRADE; `Panels.openShop(scene, false, 'smith')`),
  Trainer on the Neutral quarter's plot (permanent RANKS; `'trainer'`), Don Montoto (the old man who replaced the Appraiser: a story line per talk and free identify-all, `Panels.openMontoto`), Mage quarter = fenced empty plot with a sign, the Rift portal (walk into it = run).
  Equipping and the kept bag: the inventory button / I in the city. Result screen: RUN AGAIN and BACK TO CITY. QUIT RUN (settings) goes to the city; END (city) goes to the title; the test room is still on the title.
  Don Montoto (user design, 2026-11-11, replaces the Appraiser; no fee any more, `economy.appraiser` and `G.appraiseFee/appraiseAt` are gone). Rescue: his cage is ALWAYS in room 5 (`economy.montoto.room` = index 4; `G.cageRoom` = 4 until the character has rescued him, none in the test room)
  from the start of the room, but it only opens once the room is clear (`Sim.roomClear()` = phase chest or exit, i.e. super fissure closed): tap or I in reach (22 px) -> `Sim.freeCaged`; before that it emits `cagelocked` (toast "Clear the room first", cage tag LOCKED). Opening sets `gear.city.montoto` at once (kept if the hero dies later).
  In the city: talk -> one story line (`src/lore.js` `G.MONTOTO_STORIES`, 16 entries `{ en }`, next one each talk, cycling; index `gear.city.story`, saved) and IDENTIFY ALL (FREE): `G.identifyAll(gear)` clears `unid` on the whole kept bag, reveal item by item (SKIP ends it). All his UI strings: `G.MONTOTO_UI` in `src/lore.js` (`G.montotoText(key, vars)`).
  Saved PER CHARACTER. Save v8: `gears[c].city = { montoto, story }`; v7's `appraiser` flag loads as `montoto` (rescued stays rescued), v4-v6 load as not rescued. Debug CAGE puts a (locked until clear) cage beside the hero. The career bot (`opts.rescue`, on in `sim_bot --career`) frees him after the chest of room 5 and `Bot.prepareGear` / `shopVisit` call `G.identifyAll` first (scrolls only for what is still hidden).
  City labels (`CityScene.label`) are clamped to the camera each frame, so in portrait (540x960, the city is wider than the view and scrolls) none is cut.
- Step 8b (language) on branch `step-8b-language`: English / Espanol. `src/i18n.js` (built after `lore.js`): `G.t(key, params)`, one flat table per language (`G.LANG.en`, `G.LANG.es`, 482 keys), `G.plural`, `G.itemName`, `G.itemType`, `G.statLine`, `G.abilityText`, `G.doorLines`, `G.storyText`.
  English texts of the data tables (abilities, families, ranks, doors, classes, weapon bases) are copied from `src/balance.js` when i18n loads; the Spanish ones are in i18n.js by id. The sim is language-free: `S.objective()` returns `obj.*` keys, the bag-full event carries `msg.bagFull`, items keep their English `name` (unused by the view): names are assembled from slot, weapon type, rarity and first bonus stat with one rule per language (Spanish: noun + intrinsic adjective + bonus adjective + complement, agreeing in gender and number: "Espada Veloz de Hierro", "Botines Protegidos").
  Setting: `save.settings.lang` (null = follow `navigator.language`, "es*" = Spanish), shared by all characters, chosen in the Settings panel (ENGLISH / ESPANOL buttons, applies at once through `G.applyView`); `?lang=en|es` overrides for the session and is not saved. Don Montoto's 16 lines are `{ en, es }` in `lore.js`; his UI strings are `mon.*` keys (`G.montotoText` is an alias).
  Font: `tools/pixelart.py` adds a, e, i, o, u with acute, n with tilde, u with diaeresis (both cases) and the inverted ! and ? to both bitmap fonts (capitals rise 1-2 px above the line). Checks: `node tools/check_i18n.js` (same keys and placeholders, no unused keys, every character in the font, English texts = the sim's, Spanish agreement, no English left hardcoded in `src/view`).
  Settings panel rebuilt: language row, zoom and shake rows with [-] / [+] buttons, tapping the track picks the nearest step, dragging works with mouse and touch even outside the track, zoom applies when the pointer is released (the old live rebuild cut the drag), the zoom slider now also goes below the default on big screens (`G.view.lo`), label = knob = `G.view.S`.
  Rough: no Spanish for `qa/` logs or bot output; the capital N with tilde touches the top of a button; Spanish text is about 20 % longer, panels were shortened or wrapped but touch was not tested on a real device.
- Step 9 (content audit and polish) on branch `step-9-content`: no new systems. Attack poses (frame `_2`, view `G.attackPose`): imp claws up / bat fangs when within 10 px of touching, skeleton arms up, warden fists up, hound crouch,
  tyrant fists up (`tyrant_2`, slam and burst) and head down (`tyrant_3`, charge). Ground telegraphs (`drawGround`): skeleton 1 / warden 3 dotted aim lines during the wind-up; boss burst lanes.
  Sim change (only one): the boss burst had no wind-up (first volley fired at once); now state `burstWind`, `burstWindup` 0.6 s (x0.7 enraged), the volley angle `m.ba` is fixed at the start so the lanes shown are the real ones.
  Imp and bat still hurt on contact with no sim wind-up (pose only). No sixth monster: a new type in the fissure pools would change every bot result.
  Room dressing (view only, `RoomView.dress`, picked by `G.hash32` of seed / room / tile, never the sim rng): bones, rubble, skull, grate, puddle, candles (2 frames, glow), cobwebs in inner corners, chains / banners / moss on wall faces; never on a fissure, the start, exit or chest.
  Don Montoto has his own body plan (bent, hood, beard to the belt, stick). Axe and mace icons and in-hand sprites redrawn (the mace read as a spear). City settings button = gear icon (`city.set` key removed). `UI.button` moves a label with an accented capital (Ñ, Á...) down so the mark clears the frame.
  City labels pushed in from the edge are lifted a line when they overlap (portrait); the TALK tag sits above the stall label. `qa/screens.js` (23 shots per size: title, city, stalls, run, door choice, result, back to city, boss slam / burst / charge, won) and `qa/session.js` (title -> city -> portal -> run -> LEAVE -> city -> again, default 2 min) rewritten for today's game. Grok prompts: tyrant poses, Montoto, Montoto portrait, skeleton throw.
- Step 9b (what step 9 left rough, same branch `step-9-content`):
  **City, two layouts** (`src/view/city.js`, `LAND` / `PORT`, picked by `pickLayout()`: portrait when the screen is taller than wide and narrower than 416 art px). `land` = the old 26 x 15 city, unchanged. `port` = 16 x 23 tiles (256 x 368):
  Blacksmith and Trainer on top, Don Montoto and the Mage quarter in the middle, the portal at the bottom; at 540x960 the whole city is on screen, nothing scrolls. A rotation rebuilds the world (`applyView`) and keeps the hero at the stall they were at.
  **Prompt and labels**: the TALK / LOOK / READ prompt sits one line (`LINE` 12 px) above the label of the thing in reach (`placeTag`) and is lifted while it touches any label; labels are placed with their real boxes (`box`: an accented capital rises 2 px).
  On wide screens the overlay's TALK button moved to the bottom right (it covered the portal). `CityScene.snapshot()` now gives layout, map, camera view, label boxes and the prompt box; `node qa/city.js` checks all of it (both sizes, both languages, rescued / empty stall, reachability on foot, rotation).
  **Rift Tyrant**: hands redrawn as three-clawed hands (bone claws 2 px wide) in every pose; the poses are separate drawings on an armless body (`ty_pose` in `tools/pixelart.py`): `tyrant_2` slam = arms straight up, `tyrant_4` burst (new) = arms spread, light in the palms, `tyrant_3` charge = head down, claws on the floor.
  Burst lanes (`drawLanes` in `game.js`, view only): every lane is a 7 px dithered strip from the boss to the first wall (150 px at most) with a bright core that runs outward and arrives when the volley fires; the second volley's lanes show the same way while the boss waits for it. Ground layer, under the sprites.
  **Sixth monster: the Cultist (Cultista)**, `ai: 'caster'` (`S.casterAI`, `S.fizzle` in `combat.js`), a walker (open cracks stop it; its cast crosses them). Keeps 66-104 px away; every 3.4 s, with the hero in sight (150 px), it stops for 0.9 s (pose `cultist_2`) and draws a rune of radius 22 on the floor: under a standing hero, or 0.8 x the way a walking hero would cover in 0.9 s ahead of them.
  The rune erupts (14 damage if the hero is on it) and stays 6 s as a rift pool: 7 damage every 0.45 s to a hero standing in it (the dodge crosses unhurt). Killing the cultist while it casts removes the rune. HP 46, speed 30, contact 6, threat 3, exp 6. In the fissure pools of rooms 4-9 (weights 1, 1, 2, 2, 2, 3), not in the super waves.
  Sim: `sim.pools`, teles with `rune` / `pool` / `owner`, events `hex`, `erupt`, `fizzle`. View: `drawRune` (pink circle, a star drawn stroke by stroke), `drawPools` (pink dithered disc; blinks in its last second); enemy magic is pink like enemy shots, never green like a fissure. Palette `cu0-cu3`.
  Bot: leaves a pool it stands in (dodges when deep in it), does not step into one (`inPool`), keeps 30 px from a cultist, the melee bot charges at it like at other ranged monsters.
  **Touch** (`node qa/touch.js`, hasTouch context, taps and CDP touch events): everything worked by tap; fixed: (1) once a finger has been seen (`G.finger`, set by a capturing `touchstart` listener) `UI.button` gives every button a hit box of at least 44 CSS px (`UI.FINGER`); before: settings [-] / [+] 28 px, close buttons 36 x 32, city END 52 x 28;
  the city overlay is rebuilt at the first touch; city settings / END buttons are 20 px tall; (2) a level-up or door choice that has just opened ignores taps and clicks for 400 ms (`GUARD`, `HudScene.tooSoon`): a finger on its way to the stick or DODGE picked a card; keys 1-3 and the bot are not held back;
  (3) narrow inventory in a run: the bag title ran into the scroll count (it now takes its short form); (4) result screen: a wrapped line (Spanish, portrait) was overprinted by the next one (lines now flow).
- `main` is the working base. One branch per step: `step-N-<slug>`.

## Last measured (2026-11-11, step 9b: city portrait, prompt, tyrant claws, burst lanes, cultist, touch)

- `determinism.js` pass, `check_bag.js` pass, `check_i18n.js` pass (483 keys: `mob.cultist` added), `contrast.js` 0 failing (lowest 5.65:1).
- `sim_bot --seeds 1-10` fresh gear, before -> after (the cultist changes every run from room 4 on): mage 0 -> 1 (seed 10), warrior 2 (7, 9) -> 2 (3, 8), archer 2 (5, 10) -> 0; 0 softlocks, 0 timeouts, worst stuck 16 s.
  With the first numbers (HP 40, cast every 4.2 s, pool 18 px / 4.5 s, rune under the hero only) it was 1 / 4 / 2: the cultist was a free kill that ate spawn budget, so the rune now leads a walking hero and the pool is bigger and longer.
  Damage taken by source in those 10 runs: warrior pools 867 + runes 87 of 13 700, archer 732 + 39 of 4 560.
- `--career 10 --seeds 1-10`, before -> after: mage 3 wins (first run 7) -> 2 (first run 9); warrior 7 (first run 4) -> 4 (first run 7); archer 2 (first run 9) -> 2 (first run 9). 0 softlocks, 0 timeouts, `bestFromDrops` PASS x3.
- `qa/city.js`: 2518 checks, 0 failing, 0 errors. `qa/touch.js`: portrait en 35 of 35, portrait es 35 of 35, landscape en 35 of 35, 0 errors.
- `qa/screens.js both`: 24 + 24 screenshots (new: `run_cultist`), 0 errors. `qa/session.js --minutes 2`: 3 runs from the portal, left twice, rotated, 11 level-ups, worst stuck 6.7 s, 0 errors.
  `qa/bot.js --seeds 3,4,5` (mage): 0 wins, 0 errors, 0 softlocks, all match Node. `qa/test_room.js`: passes, 0 errors (portrait: the debug button sometimes needs a second tap when a level-up opens under it; the script retries, as before).
- Screenshots: `/tmp/step9b_city_portrait.png`, `/tmp/step9b_montoto_talk.png`, `/tmp/step9b_boss.png`, `/tmp/step9b_monster6.png`.
- Rough: the cultist is tuned on 10 seeds per class only (archer fresh 2 -> 0, careers a little slower: all inside the targets, all inside the noise); the bot dodges pools well, a person may find 3 cultists in room 9 harder than the bot does;
  a casting cultist blinks orange like every wind-up, which turns its wine robe red; pools and runes are flat dithered discs (no animation frames); no sound. In portrait the END button covers 2 px of the top wall's corner.
  Touch was emulated (Chromium, hasTouch), not tried on a phone: thumb reach, the 400 ms guard and the stick's feel need a real device. The tyrant's claws are code-drawn; the Grok prompt for painted poses is still in `docs/grok-prompts.md`.
  City labels and the prompt are checked at the two sizes only; a zoomed-in city still scrolls (labels are clamped and lifted, the prompt follows).

## Last measured (2026-11-11, step 9: content audit)

- `determinism.js` pass, `check_bag.js` pass, `check_i18n.js` pass, `contrast.js` 0 failing (lowest 5.65:1).
- `sim_bot --seeds 1-10` before -> after: mage 0 -> 0, warrior 1 (7) -> 2 (7, 9), archer 2 (5, 10) -> 2 (5, 10); 0 softlocks, 0 timeouts. Only runs that reached the boss changed (burst wind-up); every other run identical field by field.
- `qa/screens.js both`: 23 + 23 screenshots, 0 errors. `qa/session.js --minutes 2`: 3 runs from the portal, left twice, rotated, 13 level-ups, worst stuck 6.7 s, 0 errors.
- Rough: imp / bat have no sim wind-up (contact); the tyrant's raised fists are square blocks (Grok prompt written); burst lanes are thin dots; props are rare in some rooms and not tuned per room; the city in portrait still scrolls; touch not tested; `qa/bot.js` and `qa/test_room.js` not run; Spanish only checked on city and settings.

## Last measured (2026-11-11, Don Montoto, step 8)

- `determinism.js` passes (rescue run: warrior seed 1, 7 rooms, twice identical, he is freed). `check_bag.js` passes (new: no fee left, identify-all free / never rerolls / refused when not rescued, 16 story lines cycle and wrap, cage always room 5, locked until the room is clear (also during the super phase),
  refused from far away, saved at once, not back, none for later runs, kept after death, none in the test room, debug CAGE, career bot frees him / leaving before room 5 does not, v6 and v7 -> v8, the `appraiser` flag becomes `montoto`, malformed city state, story index round trip).
- `sim_bot --seeds 1-10` (fresh gear, ignores the cage): mage 0 / warrior 1 / archer 2 wins, 0 softlocks, 0 timeouts (same as before). Career warrior 10 runs: 7 wins, first at run 4, 3 left (was 5 wins, first at run 5): identify-all is free so scrolls go further. Not tuned.
- Browser (script outside the repo, `qa/lib.js`): room 5 forced, tap on the closed cage -> "Clear the room first", debug SKIP PHASE until clear, cage opens (saved), leave -> BACK TO CITY, talk twice (two different lines), IDENTIFY ALL (3 -> 0, gold unchanged), portrait labels all inside the view with the hero at both ends; 0 console errors.
  Screenshots `/tmp/montoto_city_portrait.png` (540x960), `/tmp/montoto_talk.png` (960x540).
- Rough: in portrait the city still scrolls sideways (labels are clamped, not the map fitted); the sprite is a recoloured townsperson body plan with a beard and a stick; the reveal is plain; touch not tested; no English-only audit of `G.MONTOTO_UI` for other languages yet (only `en`); `economy.md` never mentioned the fee, so it is unchanged.

## Last measured (2026-11-11, step 8: city)

- `sim_bot --seeds 1-10 --json` mage / warrior / archer: identical to main field by field (0 / 1 / 2 wins; the cage does not touch the sim and the fresh-gear bot ignores it). Career warrior (`--career 10 --seeds 1-10`): identical
  to main run by run (5 wins, first at run 5, 4 left, 0 dead-lock) even with the bot freeing the Appraiser. `determinism.js` passes (adds a rescue run twice); `check_bag.js` passes (adds appraise fee / refusal / no reroll, cage per seed,
  free in reach, saved per character, v6 -> v7, malformed city state). `contrast.js` 0 failing.
- Browser (script outside the repo, `qa/lib.js`, 960x540 and 540x960, 0 console errors): title -> class -> city -> walk to the Blacksmith -> buy a scroll (15) -> portal -> run -> debug CAGE, free him with I (saved) -> leave with the sealed bag
  (banked) -> result -> BACK TO CITY (Appraiser now in his stall) -> sell an item -> Trainer rank -> Appraiser identifies an item (23 gold, reveal) -> inventory button -> portal -> die -> RUN AGAIN (new seed). Screenshots
  `/tmp/step8_city_landscape.png`, `/tmp/step8_city_portrait.png`.
- Rough: touch not tested (the stick is a copy of the run's); tapping a stall from afar only says "Walk closer"; the reveal is plain (icon, name, stat lines one by one); the cage appears in 50 % of runs until freed (a guess); in portrait the city scrolls
  sideways and edge labels can be cut; the city has no music or ambient life; `qa/session.js` and `qa/screens.js` still use the old title buttons (`res_gear`, `title_shop`) and are stale; the Appraiser was replaced by Don Montoto (see the newer entry).

## Last measured (2026-11-11, tiers removed)

- Fresh gear seeds 1-10, mage / warrior / archer: 0 / 1 / 2 wins, every run identical to before (fresh gear was tier 1). Careers of 10 (seeds 1-10): mage 3 wins, first at run 8 (same as before);
  warrior 5 wins (was 1), first at run 5 (same); archer 2 wins (was 1), first at run 9 (same). Before, careers moved to tier 2 after gear 70 and stalled there. 0 softlocks, 0 timeouts.
- `determinism.js`, `check_bag.js` pass; browser: title and a game at 960x540, 0 console errors. `qa/screens.js` no longer clicks the tier buttons (not run).

## Last measured (2026-11-11, step 7 balance pass)

- Spec `docs/specs/economy.md` "Balance pass, 2026-11-11": more scroll drops (kill 0.0035, elite 0.1, chest 0.22, super 0.2), scroll 15 in town / 25 at the merchant,
  rank costs 40 / 90 / 160 / 250 / 360, bot career pushes past its target when HP >= 70 % and gear allows (`bot.career.pushHp`, `pushGear`).
- 6 rounds, last kept. Careers of 10 (mage / warrior / archer): 3 / 1 / 1 wins, first win at run 8 / 5 / 9 (target was 2-5 wins, first at 4-7: not met for
  mage timing and warrior / archer count). Fresh gear seeds 1-10: 0 / 1 / 2 wins (met). 0 softlocks, 0 timeouts; `bestFromDrops` PASS x3.
  Scrolls per career run 6.0 / 5.3 / 3.2; gold per career run 584 / 524 / 343. Limit: careers move to tier 2 after the first win and stall there.
- `node tools/determinism.js` and `node tools/check_bag.js` pass (check_bag now reads prices from the balance). No browser runs in this pass.

## Last measured (2026-11-11, step 7: economy)

- Before the economy was switched on (old scroll rates, `economy.merchant.chance=0`): `sim_bot --seeds 1-10 --json` identical field by field to the runs before step 7 for mage, warrior, archer.
- Node bot seeds 1-10, fresh gear, default policy (new scroll rates, merchants on): mage 0 wins, warrior 0 (was 4), archer 1 (was 2); 0 softlocks, 0 timeouts, worst stuck 8 / 15 / 15 s.
  Scrolls found per run 1.0 / 2.4 / 1.8 (was 11 / 16 / 11); merchants met in 10 runs 4 / 6 / 5, used 2 / 3 / 5; gold earned per run 135 / 434 / 323. Wins fell because a fresh-gear run identifies far fewer
  items (not tuned, as the spec says); the careers below are the real test.
- Careers (`--career 10 --seeds 1-10`): gold per run (earned + sold) mage avg 504 (31 .. 1194), warrior 503 (118 .. 801), archer 381 (29 .. 647). Spent over 10 runs: mage scrolls 75 / items 107 / upgrades 1975 / ranks 2300 (15 of 25 ranks);
  warrior 150 / 150 / 1330 / 1000 (10 ranks); archer 225 / 76 / 755 / 1000 (10 ranks); merchant 0 / 80 / 150. Outcomes: mage 7 left, 2 dead, 1 win (run 10); warrior 7 left, 3 dead; archer 6 left, 4 dead. Worn items at run 10: 0 shop items for all three,
  the best ones are drops (rarity 3-4 from the loot table), `bestFromDrops` PASS x3. The bot never bought the rare in these careers (it only spends gold left after ranks and upgrades).
  Ranks 10-15 of 25 and gold per run are above or at the spec's targets (130 for 3 rooms, 500-750 for a win); the deaths at the end of a career lose 400-800 gold each.
- `node tools/check_bag.js`: all checks pass (adds sell prices, shop stock per tier / own-class weapons / 200 restocks per class never above rare / epic refused / rare 250 = 5 x magic, buy refusals, upgrades, ranks,
  gold banked on leave / win, lost on death, none in the test room, door bonus, merchant rooms and buying, v5 -> v6 and malformed v6 saves, bot shopVisit). `node tools/determinism.js` passes, plus seed 3 with merchants twice per class.
- Browser (Playwright script outside the repo, `qa/lib.js`): title SHOP: sell an item (+14 gold), buy a scroll (25), buy a rank (60), RANKS / BUY / SELL tabs; in a run (DBG `MERCHANT` cheat): tap the merchant opens his panel and pauses the run,
  2 scrolls bought from the run gold, close resumes; 0 errors. Screenshots `/tmp/step7_shop.png` (960x540, BUY tab with the rare selected) and `/tmp/step7_merchant.png` (540x960).
- Rough: no art look at the merchant sprite in the world (the panel covered him in the screenshot); the UPGRADE tab and the title EQUIPMENT SELL button were not clicked in the browser; coins do not fly to the counter;
  the wins of a fresh-gear run fell with the scroll drops; `qa/bot.js` (browser bot), `qa/session.js`, `qa/screens.js` not run; touch not tested; the rare may be too expensive for the bot's spending order (never bought).

## Last measured (2026-11-11, step 6 finished: gear per class, in-run equip, identification)

- Node bot seeds 1-10, default policy, first build, fresh gear each run (the bot equips from the sealed bag and identifies with the scrolls it finds): mage 0 wins
  (deaths by room 2:2 5:2 6:1 9:3 10:2), warrior 4 wins (5,7,9,10), archer 2 wins (3,4). No softlocks, no timeouts, worst stuck 16 s. Scrolls found per run
  11 / 16 / 11 (mage / warrior / archer), items identified in the run 8.9 / 12.5 / 8.6; wins are back from step 6's 0 because the bot equips in runs again (step 5 had 3-4).
- Career warrior (`--career 10 --seeds 1-10`): 7 left, 3 won (runs 8, 9, 10), 0 dead, no softlocks. Gear score 0 -> 15 / 23 / 42 / 61 / 64 / 65 / 65 / 62 / 62 / 62 (tier 1 all career).
  Items identified in the run: 4, 5, 6, 9, 6, 16, 11, 13, 10, 5 (85 total); 0 on the title (the bot identifies in the run, so nothing waits in the kept bag). Scrolls
  banked 6.1 per run; found 13 per run, which is more than the plan wants (see Rough).
- `node tools/check_bag.js`: 63 checks pass (adds per-class banking and class switch, v2/v3/v4 migration, in-run equip / swap / full sealed bag / death keeps worn gear,
  identification, scroll drops and bag rule, bot identification). `node tools/determinism.js` passes.
- Browser (Playwright script outside the repo, `qa/lib.js`): bank an item as mage, switch to warrior on the title: its bag is empty, switch back: the item is there;
  in a run: inventory shows the sealed bag, EQUIP moves a common helmet onto the hero, an unidentified item is not equipped by tapping twice, IDENTIFY with a scroll
  reveals it (sealed scroll spent first) and it can then be equipped; 0 errors. Screenshots `/tmp/fix_inv_run.png` (960x540), `/tmp/fix_inv_portrait.png` (540x960, unidentified item).
- Rough: scroll drops are generous (13 per run; lower `eliteScroll`, `superScroll`, `chestScroll` when step 7 adds the shop); the item name still shows its first extra stat word; the
  bot identifies by rarity, not stats; a full sealed bag never blocks a swap because the replaced item takes the equipped item's cell (so there is no "bag is full" refusal to show);
  not run: `qa/bot.js`, `qa/session.js`, `qa/screens.js`, touch, the warrior and archer in the in-run inventory by hand.

## Last measured (2026-11-11, step 6: doors and extraction)

- How it works: after clearing any room but the last the sim enters state `choice` (`Sim.enterChoice`): `leave()` banks the sealed bag into the
  kept bag (`gear.bag`, cap `stashSize` 30, best items first, the rest lost) and ends the run as `left`; `takeDoor(i)` loads the next room with the
  door's modifier. Doors after room N = `G.doorsFor(seed, N)`, a pure function of the run seed and N (two different modifiers); the doors taken are
  `sim.doorLog`. Winning banks the bag; dying empties it (`finishRun`). Quitting a run from the settings panel and the test room lose the bag.
  `genRoom(seed, room, B, mod)`: crackLen and extraCracks change only the cracks, the walls stay.
- Door modifiers (loot = +that share of gear drop chances and +that much rarity luck): Long cracks (arms x1.4) +25 %; More cracks (+1 crack) +30 %;
  Fast spawns (pause between packs x0.5) +20 %; Crowded (alive cap x1.6) +20 %; Extra elite (+1 warden in the super fissure wave) +30 %;
  Hardened foes (monster hp and damage x1.2) +25 %. The numbers are guesses, not balanced.
- Bag and gear (per class): the save holds one gear set per class, `save.gears[classId] = {equipped, bag (kept bag), nextId}` (`G.gearOf(save, cls)`
  creates an empty one on first use; `G.newGear()`). Settings and stats are shared. A run uses the gear of the class that plays it and banks into
  that class's kept bag; the title EQUIPMENT view, the class picker and the gear score show the selected class's gear. Loot goes to `sim.bag` (cap
  `bagSize` 20); the HUD shows count and best rarity on the inventory button. In a run the inventory shows the sealed bag as a grid ("sealed bag of
  this run"); EQUIP (`Sim.equipFromSealed`) moves the item onto the hero (own-class weapons only) and the replaced item takes the equipped item's cell
  in the sealed bag, so a swap never overflows the bag (a full bag cannot block it); DROP discards from the sealed bag. Death keeps equipped gear
  (`deathKeepsEquipped`) and loses the rest of the sealed bag. Between runs (title) the player equips and discards from the class's `gears[c].bag`.
  Save v4 (key unchanged): a v2/v3 save's shared gear (worn items + kept bag) goes whole to the class in `settings.cls` (default mage); a worn
  weapon that class cannot use moves to its bag; an old bag over the stash size stays whole (nothing lost); `nextId` raised above every item id.
- Identification (step 6b): items of rarity 1+ (`BAL.loot.unidentifiedFrom`) drop unidentified (`item.unid = true`): type, name, rarity and item level show, the stats
  do not, and the item cannot be equipped (`G.canEquipNow`). The stats are rolled at the drop with the same rng draws as before (the flag costs none), so
  identifying only clears the flag. Commons and every item of an old save (no `unid` field) count as identified. A Scroll of Identification is a count:
  `gear.scrolls` per class (kept, like the stash; cap `loot.scrollCap` 99) and `sim.scrolls` (sealed, found in this run). Rule: found scrolls are sealed
  like the bag (banked into `gear.scrolls` on leave or win, lost on death, nothing in the test room); spending takes a sealed scroll first, then a kept one.
  IDENTIFY button on an unidentified item in the inventory (in a run: `Sim.identifySealed`; on the title: `G.identifyInBag`). Drops (`BAL.loot`): killScroll 1.2 %
  per kill, eliteScroll 20 %, bossScroll 100 %, chestScroll 40 % per chest, superScroll 50 % per super fissure closed (the door loot bonus multiplies kill,
  elite, boss and closure chances). Art: `i_scroll`, `i_unid` (a "?" over the icon). Save v5: adds `gears[c].scrolls`; v4 and older saves load with 0 scrolls and
  all items identified. Not built (steps 7 and 8): buying scrolls, the in-room merchant. The item name still shows its first extra stat word ("Savage ...").
- Bot: default goes on to room 10 and takes the door with the smaller loot bonus; `--leave N` (also `?leave=N` in the browser) leaves after room N.
  `G.Bot.prepareGear` equips and discards between runs (used by `--career`). `sim_bot` reports `left` and bag items.
- Career (`sim_bot --career 10 --seeds 1-10`, 10 runs, gear kept): between runs `G.Bot.prepareGear` equips the best item per slot (own-class weapons only)
  and discards the rest; the bot leaves when HP < 40 % after a room, or at a target room that starts at 3 and rises 1 per extraction, cap 10
  (`BAL.bot.career`). Gear score 0 -> 54 / 62 / 55 and the last runs reach room 9-10: mage 7 left, 3 dead, deepest room 9 (no win); warrior 8 left or won
  (wins in runs 9, 10), 1 dead; archer 9 left or won (wins in runs 9, 10), 1 dead. Gear score stays under 70, so tier 1 all career (the label now reads `tier N/3`).
- Checks: `node tools/determinism.js` passes (500 rooms, 1200 modified rooms, doors, seed 3 default and `--leave 5` twice, 9 builds twice);
  `node tools/check_bag.js`: 33 checks pass (die / leave / win bag, full kept bag, test room, doors deterministic, each modifier, loot bonus
  102 -> 137 item drops in 4800 imp kills, save migration).
- Node bot seeds 1-10, first build, default policy: mage 0 wins (deaths by room 2:3 5:1 6:4 8:2), warrior 0 (6:2 7:1 8:6 9:1), archer 0 (3:2 4:2 5:3 6:3);
  worst stuck 8 s, no softlocks. `--leave 5` mage: 6 left, 4 dead (3 in room 2, 1 in room 5), avg bag 13 items, 10.9 kept. Wins fell from 3-4 of 10 (step 5)
  to 0 because a fresh-save run now starts with no gear and the bot cannot pick any up mid-run; with gear kept from earlier runs it is a different game
  (`--career` was not run). Needs a balance pass when the city (step 8) gives gear a place.
- Browser bot `qa/bot.js --seeds 3,4,5` (mage): 0 wins (dead in rooms 5, 4, 5), 0 errors, 0 softlocks, all match Node, through the HUD door choice.
- By hand in the browser (script outside the repo): door choice at 960x540 and 540x960 (`/tmp/step6_landscape.png`, `/tmp/step6_portrait.png`), click a door
  (next room has the modifier), click LEAVE (state left, bag banked), v2 save loads on the title and EQUIPMENT equips and drops from the kept bag, in-run
  inventory is read-only, 0 errors.
- Not run: `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, `?leave=N` in the browser, the result screen after leave/death looked at (opens ~10 s later at
  headless fps; the data was checked), touch on the choice, warrior and archer in the browser, the DBG DOORS button by click.

## Last measured (2026-11-11, step 5 batch B: warrior and archer abilities)

- Node bot seeds 1-10 per build (`--class c --build b`): warrior blade 3 wins (5,7,10), avg win 352 s, level 18.1, Steel 4 in 9 runs;
  blood 3 (3,5,10), 395 s, level 20.8, Blood 4 in 10; thunder 4 (5,6,8,10), 299 s, level 20.3, Storm 4 in 9.
  Archer plague 4 (5,6,8,9), 356 s, level 17.1, Venom 4 in 7; marks 4 (1,2,3,9), 399 s, level 17.6, Steel 4 in 9; winter 4 (1,3,6,7),
  370 s, level 15.6, Frost 4 in 5 (target 6). No softlocks, no timeouts, worst stuck 17 s. Wins are earlier than the 480-600 s target.
- Mage 3 builds seeds 1-10 identical field by field before and after (pyro 4, storm 3, frost 2).
- Tuning (first runs: blade 2, blood 7, thunder 3, plague 3, marks 0, winter 4): Bloodreaver nerfed (Rend dps x0.7, Blood Drinker
  pct x0.4-0.75, Frenzy v x0.5, Iron Body hp 15..60, Second Wind regen x0.6); Poison Tips dps x1.5, Toxic Cloud dps x1.3; Marksman: Ricochet
  n 2/3/4 r 100 fall 1.0, Hunter's Mark pct 0.25/0.35/0.5, Split Shot rare w 6 (was epic w 3; without it the build is 0 of 10). Several are
  beyond the spec's +-50%. Ten seeds are noisy: a change to any shared number moves other builds by 1-2 wins.
- Determinism passes, including all 9 builds seed 3 twice with the inexact Math functions throwing.
- Browser bot `qa/bot.js --seeds 3,4,5` default builds: warrior 1 win (5), archer 1 win (5), 0 errors, 0 softlocks, all match Node.
  Mage was not rerun in the browser (its sim is unchanged).
- Screenshots of the ABILITIES page: `/tmp/step5b_landscape.png`, `/tmp/step5b_portrait.png` (warrior, 3 actives, 9 passives, 4 families).
- Not run: `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, the level-up cards with the warrior or archer by hand (the browser bot
  picked from them), the 3 builds per class in the browser, touch on the new page.

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

- Step 6: bot win rate is 0 of 10 with a fresh save (no gear); door numbers are unbalanced; the choice modal is plain (no art on the cards); a full
  sealed bag (20) just stops picking items up; the kept bag (30) drops the weakest new items when full; `qa/screens.js` and `qa/session.js` still
  use `gear.bag` as the in-run bag and are stale; the objective plate does not say "choose" while the modal is up.

- Step 5: abilities use family icons only (no per-ability icons); effect art is placeholder (rings, sparks, a gold bolt for Thunder Wave, no
  wave or whirl sprite); the numbers are balanced by 10-seed bot runs only; the bot wins in 300-400 s, short of the 480-600 s design target;
  Winter Hunter reaches Frost 4 in only 5 of 10 runs; the epic abilities are rarely taken.

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

## Confirmed by the user (2026-11-11)

- Dying loses the sealed bag; equipped gear is kept (`BAL.run.deathKeepsEquipped`).
- Quitting a run from settings loses the bag, like dying.
- The kept bag holds 30 items (`loot.stashSize`).

## Design assumptions waiting for the user

- Bats fly over open cracks; the boss ignores them; other monsters walk around.
- The cultist is a walker (open cracks stop it), but its rune and pool can be drawn across a crack. Its pools are pink, not rift green.
- A fresh level-up or door choice ignores taps and clicks for 400 ms (keys still work).
- 3 active ability slots, family bonuses at 2 and 4. Split Shot is rare, not epic (see batch B notes).
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
- `src/sim/combat.js`: auto-attack (`shootBolts` or `swing`, event `swing`), `castSkill` -> pulse, monster AI (`casterAI` = the cultist), `steer`, projectiles, telegraphs (`teles`), rift pools (`pools`), pickups, kills.
- `src/sim/boss.js`, `src/sim/items.js` (also `bankItems`, `doorsFor`, `doorEffects`), `src/save.js` (v3, migration). Run end and doors: `Sim.finishRun`, `enterChoice`, `leave`, `takeDoor` in `core.js`.
- `src/sim/abilities.js`: pool, offers, family tiers, stats, card info. `src/sim/effects.js`: statuses, triggers, effect kinds, orbit, zones, echoes.
- `src/qa/bot.js`: the bot (`G.Bot(sim, buildId)`, `G.botRun`); `crossDir` dodges across cracks; `pickAbility` follows a build.
- Test room: `Sim({ testRoom: true })` loads `B.run.testRoom`; `restartTestRoom` reloads it on clear.
  Sim events for the view: `blocked` (mage pushes into an open crack), `dodge.cross`, `land.cross`.

View (Phaser):
- `src/view/game.js`: scene, fixed 60 Hz stepping, sim events to effects, `G.qa.state()`.
- `src/view/room.js`: tiles and `FissureView` (per-pixel crack renderer, `updateNet`; dark halo =
  barrier edge, `bump` flares the lip). Dodge arc and recoil: `planArc`/`drawArc` in `game.js`.
- `src/view/city.js` (city world and overlay), `src/view/hud.js`, `src/view/panels.js` (inventory, settings, debug, result), `src/view/ui.js`
  (UI toolkit, `UI.hit` names for QA clicks), `title.js`, `input.js`, `fx.js`, `boot.js`, `main.js`.

Tools:
- `tools/build.py` builds `dist/riftscar.html`. `tools/determinism.js`, `tools/check_bag.js`. `tools/sim_bot.js`
  (`--seeds`, `--leave N`, `--class id`, `--build id`, `--json`, `--set path=value`, `--career N`). `tools/contrast.js`.
- `qa/bot.js`, `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, `qa/city.js` (layouts, labels, prompt), `qa/touch.js` (touch emulation), `qa/lib.js`: headless Chromium checks.
- `tools/check_secrets.py`, `tools/clean_url.py`, `tools/hooks/`, `.claude/hooks/guard.py`.

URL parameters: `seed`, `tier`, `class`, `build`, `speed`, `bot=1`, `manual=1`, `touch=1`, `fresh=1`, `scene`,
`room=test`, `debug=0`, `leave=N` (bot).

## Planned later

- A dagger class (daguero), after the first public version's three classes. It may take the Venom family.
