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
  City = `src/view/city.js` (`CityScene` world + `CityHudScene` overlay), 26 x 15 tiles, art in `tools/pixelart.py` `city()`. (Since step big city: one town of 56 x 32 tiles, see "Bigger city" at the end of this file.) Stalls: Blacksmith (BUY with the scrolls, SELL, UPGRADE; `Panels.openShop(scene, false, 'smith')`),
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
  (The two layouts below were replaced by one town in step big city: "Bigger city" at the end of this file.)
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
- Step 10 (balance and daily challenge) on branch `step-10-balance-daily`. Rounds and numbers: `docs/steps/step-10.md` "Round log" (rounds 0-8, final = round 7).
  **Balance** (`src/balance.js`): `run.roomMult` 0.75, 1.25, 1.5, 1.85, 2.25, 2.7, 3.2, 3.8, 4.3, boss 3.8; `run.monsterHp` 1.4 and `run.monsterDmg` 0.75 (x on top of roomMult: longer, softer fights);
  `fissure.spawnEvery` 0.3 -> 1.3 s; mage hp 110 dmg 12.5; warrior hp 245 dmg 27; archer hp 100 dmg 21; ranks unchanged (Vitality +6, Might +3 %: the WIP's +8 / +4 fed the late-career snowball).
  `run.gearK` kept at 0.0045 but now of the gear score the hero BRINGS INTO the run (`sim.startGear`; items equipped during the run no longer raise monsters): with gearK 0 a geared career wins 86-95 % of its runs after the first win.
  Monster HP and damage threat are separate (`sim.hpThreat`, `sim.threat`). Bot (QA only): career target rises 2 rooms per extraction (`bot.career.step` 2; with 1 the earliest possible first win was run 8),
  the dodge lands where the dash really stops, after 20 s without progress the bot walks up to monsters instead of keeping away (`bold`), no flip-flop between two drops. A ricochet uses the bounce it was shot with (crash fix when the ability was replaced).
  `node tools/sim_bot.js --class C --seeds 1-100 --brief` (one line) and `--career 10 --careers 10` (10 careers of 10 runs, one line).
  **Daily challenge** (`src/sim/daily.js`, `BAL.daily`): the UTC date ('YYYY-MM-DD', `?daily=` overrides for QA) hashes (salt 1010) to the seed, the class and the door taken after each room (only that door is offered, LEAVE stays).
  Fixed kit: magic weapon of the class + common armor + common boots, item level 2, identified and worn, 2 scrolls, no gold / ranks, no cage; a gear set of its own, the save is never read for it nor changed (no stats, nothing banked).
  Score = 1000 x rooms cleared + 10 x kills, a win adds 5000 + 5 x every second under 900 s of game time. Share text (one line, `daily.share`), e.g.
  "Riftscar Daily Rift 2026-11-12 - Archer - fell in room 9/10 - 259 kills - 6:41 - score 10590"; COPY SHARE TEXT uses the async clipboard, then execCommand, and if both fail (an iframe without permission)
  shows the text selected in a DOM box to copy by hand (`G.showManualCopy`, CLOSE / Escape). Entry: DAILY RIFT on the title (beside SETTINGS) and the DAILY RIFT board beside the portal in the city (READ).
  Result: TRY AGAIN = the same day's run, BACK TO CITY. `node qa/daily.js` (both sizes: title and city entry, matches Node, copy, manual copy, save unchanged).
- Audio (branch `step-audio`): sound effects and music, all made in code with the Web Audio API (no files). `src/view/audio.js` (built after `ui.js`), view only: the sim is untouched.
  `G.audio.event(e, scene)` is called for every sim event in `GameScene.playEvents`; UI sounds come from `UI.button` (click, back for close / back / resume, hover on a mouse); card pick (`applyAbility`), door / leave (`pickDoor`), Don Montoto's talk (`openMontoto`) call `G.audio.play`.
  Sounds (`G.audio.sounds`): attacks per class and weapon (mage bolt, archer arrow, sword / axe / mace / hammer), hit, crit, die (per type), boss death, player hurt, dodge (louder across a crack), skills (mage, warrior shockwave, archer volley), level-up, card, crack opening / big / closing / scar, segment going dark, super fissure, exit opening, chest, drop by rarity (rarer = higher, more notes, shimmer; legend adds a fifth), gold, scroll, tome, item pickup, orbs, equip, identify, door, leave, merchant, buy, locked cage, rescue, Montoto's mumble, blocked step, boss wind-ups (slam, burst, charge, as long as the sim wind-up), slam impact, boss shot, summon, enrage, Cultist rune / eruption / fizzle, ability bursts, chain, zone, echo, UI click / hover / back, dead, won.
  Limits: 12 voices (18 for priority sounds), a cooldown per sound, +-6 % random pitch (`Math.random`, view only), no sounds while the debug fast-forward is above x4.
  SFX style (second pass): chunky and physical. Hits = a low sine thump + a short noise crunch (crit adds a metallic ring); sword / axe = a noise whoosh + inharmonic ringing partials, mace / hammer = duller, lower thud + muffled noise; arrow = whoosh + string twang; mage = airy noise + rising sparkly pings; loot = bell-like (sine + 2.76x partial) notes that climb in pitch and count with rarity (legend adds a chord tail); boss slam = a deep short boom.
  Music (second pass): generative and deterministic, a pure function of the bar number (`hh(bar, salt)` hash, no state, no Math.random), so it is varied but always musical. Chords come from four fixed progressions per track (a cycle picks one, never the same twice in a row); melodies walk a scale and end on a chord tone of the next chord.
  `city` 80 BPM, A minor: string pad (two detuned saws per triad note, low-pass, slow attack, vibrato), lute bass on beats 1 and 3, harp arpeggio in eighths (4 patterns, random rests, echo), a woodwind melody (triangle + sines, 5 Hz vibrato, a breath of noise) on about 2 of 3 two-bar groups with 5 rhythm shapes.
  `run` 72 BPM, D minor / phrygian: cello drone (3 saws through a slow low-pass; it glides to each chord root), choir-like pad (detuned saws + sine octave, 2.2 s attack, one chord per 2 bars), a sparse staccato ostinato (4 patterns, root / minor 2nd / fifth / minor 3rd), soft frame-drum (sine glide + muffled noise) on beats 1 and 3.
  `boss` layer on the run's clock (144 BPM = twice the run's): kick-like toms, clap, 16th shaker, a bass pulse, and brass stabs (3 detuned saws, low-pass opening 500 -> 3000 Hz) on the run's current chord root with 4 motif shapes; the run track dips to 80 %.
  Each track = a gain node, a cheap echo (delay + low-pass feedback) and a 150 ms scheduler that adds the notes of the bars due in the next second (about 15 oscillators at once). A 200 ms poll picks city / run from the active scene and the boss from the monsters; changes cross-fade over 2.5 s (boss 1.5 s). Music at 0 % stops it all.
  Why the first music was silent (user report): no bug in the graph, it was just too quiet: -37 dBFS RMS at the default 50 % (bus gain 0.14, voices at 0.03-0.1, low-passed at 240-700 Hz, and the energy was in a 36-110 Hz sine bass that laptop speakers and phones do not play), against effects peaking at -18. Fixed by gain staging (bus x2.6 at 100 % squared, voices in the 150-2500 Hz range) and a measurement tool.
  Levels, measured with `G.audio.meter(ms)` (analysers on the buses, dBFS RMS / peak, defaults music 50 %, effects 70 %): music city -24 / -10, run -26 / -12, boss -24 / -6; effects in a dense fight -21 RMS, peaks +3 on the effects bus; master peak -2.8 dBFS (compressor as limiter, never above -2.8), 10 voices at most. Each sound alone peaks between -1 and -26 on the effects bus.
  Settings: `save.settings.music` (default 50) and `sfx` (70), two sliders in the settings panel (0-100 % in steps of 10, with - / +); `settings` panel is taller (compact layout without hint lines when the view is under 222 art px high). Texts `set.music`, `set.sfx` in English and Spanish.
  Start: the AudioContext is created at the first pointer / key / touch event (nothing before); `?mute=1` turns audio off. Debug counters: `G.audio.stats` (played, dropped, cooled, voicesMax, ctx state, music mode, boss, byName).
  Rough: nobody has judged the new sound by ear yet (levels measured, taste not); the music has no melody memory between bars (by design) so phrases can feel loose; styles are "fantasy adventure" in general, no tune is taken from any game.
- HD art pilot (branch `step-hd-pilot`, NOT merged; view only, the sim gains one debug action `cheatSpawn`): the user chose DOUBLE ART RESOLUTION, SAME
  ON-SCREEN SIZE. Sprites in `assets/hd_atlas.png` (tools/hd_atlas.py; docs/grok-prompts.md > HD art) are drawn at half scale with the feet anchor
  stored per frame, so at 960x540 one HD pixel = one screen pixel; hitboxes, speeds, rooms and camera are unchanged. Frames without HD art keep the chunky atlas.
  `src/view/hd.js` (`G.HD`: init / set / frame / show / chunky; `G.Rig`: motion), `src/view/anim.js` (`G.ANIM`: frames per state, fps, fallbacks, motion knobs).
  Imported: skeleton (one pose for every frame), tyrant idle/walk (= burst pose with the chest glow repainted, `--calm`), slam, charge, burst; Don Montoto
  (city, 2 frames; and in his cage, bars redrawn at 2x). Motion (HD sprites only): flip toward the walk or the target, walk tied to the distance walked
  (bob, alternating sway, squash on each landing, dust), breathing, wind-up lean (from the `windup` event) and release lunge + stretch (when the wind-up
  ends / `shoot`), hit recoil + squash, death = flash, knock-back with a hop, tip over, flatten and fade with bits (boss: shudder and flashes, 1.6 s),
  soft contact shadows sized from the frame's foot width. Offsets / squash are whole HD pixels (origin shifts: Phaser floors positions to art px), tilt in 0.035 rad steps.
  HD floor: `assets/hd_floor.png` (256 HD px tile, code-made flagstones on a 4 art px grid, or a user texture mirrored 2x2) as a tile sprite under the walls in every dungeon room.
  Switch: `?hd=0|1` > `save.settings.hd` (default true) > on; Settings title row "HD TEST: ON/OFF" (rebuilds the room / restarts the city). Debug in the test room:
  BOSS HERE and SKELETONS replace BOSS ROOM and DOORS. The hero is drawn from HD frames as soon as a class sheet is imported.
  Mage imported (Grok 4x2 sheet, 8 frames, idle 28x54 HD px): walk x4 (row redrawn by Grok: stride, feet together, stride, feet together; both strides still show the same leg in front),
  idle x1, attack x2, hurt x1; `G.ANIM.ent.mage`. Checked: build, `qa/hd.js` (0 console errors), determinism. Rough: no screenshot check of the mage's own
  walk / attack frames (`qa/hd.js` captures the skeleton), warrior and archer still chunky.
  ART TEST "27 PX" (2026-11-12, the user's pick after seeing the HD mage: "the resolution of Hammerwatch 2"; A TEST, NOT to be applied to everything yet).
  Measured on the user's 1920x1080 screenshot of that game: 3x3 screen px per game px (640x360), hero about 14x27 px, soft shading, no hard outline; so its
  sprite resolution is this game's own art pixel grid. `tools/lo_sprite.py` reduces a generated sheet to that grid (area average in linear light, shared
  small palette, a little brighter, 1 px dark rim) and saves `assets/hd/lo_<name>.png` at 2x, so the HD atlas, anchors and rig serve it unchanged.
  Done for the mage (8 frames, idle 15x29 art px with the rim) and the skeleton (from its HD frame); tyrant and Don Montoto keep their HD frames in this mode.
  Art mode is now three-way: `?hd=0|1|2` / `save.settings.hd` false | true | 'lo' / Settings title button ART: OLD -> 27 PX -> HD (`G.HD.mode / next / set`,
  `G.hdStyle`); default without a saved choice = 'lo'. In 'lo': `lo_` frames when the atlas has them, chunky floor, rig sizes and offsets in whole art px, no tilt.
  Checked: build, check_i18n, `qa/lo.js` (both sizes, hero walk frames cycle, 0 console errors). Rough: faces and hands are an automatic reduction (no hand
  clean-up yet), the hero's attack frames were not captured (they show while standing), the reduced skeleton is mushy, breathing / bob round to zero at this size.
- Big rooms test (branch `step-big-rooms`, built on `step-hd-pilot`, NOT merged; brief `docs/steps/step-big-rooms.md`). The user played the HD pilot on a
  1640x922 window at the lowest zoom (S=2) and wants that size of hero with the map covering the screen.
  **Part 1, the view (done)**: `G.computeView` (`src/view/ui.js`, constants `UI.VIEW`): default S = min(old default, max(2, round(short side / 470))):
  short side 300 -> 1; 390, 540, 720, 922, 1080 -> 2; 1440 -> 3. So phones and 960x540 are as before, a desktop window shows about twice as much world.
  Zoom slider: range `lo`..`maxS`, lo = the smallest S that shows at most 720 art px on the short side (and never under default - 2), maxS = short side / 180.
  At 922 and 1080 the default (2x) IS the lowest step (2x..5x / 2x..6x): decision, because at 1x the 7 px font is unreadable and the room is an island again;
  at 1440 the slider goes 2x..8x with the default 3x in between. Old saves: `settings.zoomRule` (2 = offsets count from the new default); a save without it is
  converted at boot (`G.migrateZoom`, where the screen size is known): a player who had moved the slider keeps the S they had (the user's -2 at 922 stays 2x,
  a +1 stays 5x), an untouched 0 takes the new default. Art mode default without a saved choice is HD again (`G.HD.init`), the three-way button stays.
  HUD: on a view 640 art px wide or more the HP plate is 130 px wide instead of 86 (bar 110). Panels were already centred by `UI.modal`.
  Checked with `node qa/rooms.js <out> ui` at 1640x922 and 1920x1080: S=2, Settings / inventory / level-up cards / door choice inside the screen and centred,
  zoom + then - returns to 2x and - again stays at 2x, old-save offsets -2 / +1 / 0 give 2x / 5x / 2x, 0 console errors.
  Known, not solved: HD sprites are drawn at half scale, pixel-exact at even S; at odd S (the 1440p default 3x) one HD pixel is 1.5 screen px (uneven rows).
  **Part 2, bigger rooms (done; numbers in "Last measured (big rooms test)")**: every size is in `src/balance.js` `room` (new block) and `fissure`.
  Rooms 52-58 x 30-33 tiles (was 30-36 x 20-24; floor about x2.1), boss room 54 x 32 with eight pillars in two rows (was 34 x 24, four).
  Outline: cut corners 5-11 x 3-6 (half of them in two steps), 5-9 buttresses 3-7 long and 1-3 deep. Inside: 11-17 blocks (pillars, wide walls, tall walls,
  big blocks, L shapes), 2 free tiles round each; reserved floor round the start (merchant and cage stand there), under the exit (chest) and 13 x 11 tiles round the super fissure.
  Cracks: one more per room (3, 4, 4, 4, 5, 5, 5, 5, 6, boss 3), arms 150-215 px (was 90-130), half of the cracks grow a third arm; a new crack takes the heading
  with the most free floor (of 6), an arm turns past a pillar or wall up to 3 times instead of ending there (never more than 1.5 rad off its first heading), stubs
  are retried; crack centres go to the sectors of a 3 x 2 grid in a diagonal order and at least half of a room's cracks are separate centres before any branches off another (`siteShare`), so the network covers the room. Super fissure: pit radius 16 (13), 7-8 arms of 50-72 px (6-7 of 34-50).
  Monsters: count x budget per room = 15, 24, 32, 36, 50, 60, 65, 70, 96, boss 27 threat points (was 10, 18, 21, 24, 36, 40, 44, 48, 65, 18: +46 % on average), super waves
  6, 9, 9, 12, 9, 9, 12, 10, 13 monsters (was 4, 6, 6, 8, 6, 6, 8, 7, 9; the same wardens). So that they also fill the room at once and the room does not just last longer:
  `aliveThreat` 1.4 -> 1.85 (with the bigger budgets about +45 % alive at once), `spawnEvery` 1.3 -> 0.9 s, `superSpawnEvery` 0.5 -> 0.35 s. Boss: slam radius 56 -> 66,
  charge 0.6 -> 0.8 s (108 -> 144 px), summons 3 -> 4. NOT changed: gear, abilities, the economy tables, monster stats, `roomMult`; a kill pays what it paid, so a run
  now gives more exp and kill gold (see the table). Tutorial room 38 x 26 (was 24 x 26; two more pillars, torches every 4 tiles from the exit; every
  position in it was already relative). The test room and the daily challenge use the same generator. `genFissure` keeps crack px in a Map with number keys (a room is generated in about 30 ms).
  View: lights along the arms of a crack (one every 52 px, each goes out with its band), big crack textures redraw their shimmer half as often, the title backdrop
  is clamped to the room. `tools/determinism.js` has a new room sanity block (size, crack count, no stub, floor share, chest / exit / super fissure / merchant / cage reachable, no crack on a wall or on the start).
- `main` is the working base. One branch per step: `step-N-<slug>`.

## Last measured (2026-11-13, big rooms test)

Node bot, seeds 1-10, one command per row (`node tools/run_length.js --md`; never more than 10 seeds per command). `fresh` = `sim_bot --seeds 1-10 --class C`
(a new character, no gear); `career` = `sim_bot --career 10 --seeds 1-10 --class C` (ten runs in a row keeping gear); `full` = fresh with a hero who cannot
die (`--set classes.C.base.hp=1000000`): the length of all ten rooms at a new character's kill speed. BEFORE = commit 1fa7aec (old rooms), AFTER = this branch.

| class | measure | wins before | wins after | avg run min | win min | s / room | kills | level | gold | deaths by room before | deaths by room after |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mage | fresh | 0/10 | 3/10 | 7.3 -> 9.8 | - -> 12.4 | 54 -> 70 | 259 -> 373 | 18.2 -> 20.6 | 474 -> 667 | 0 0 0 0 0 0 2 4 2 2 | 0 0 0 0 0 2 0 2 2 1 |
| mage | career | 2/10 (3 left) | 4/10 (4 left) | 6.8 -> 8.6 | 9.6 -> 10.2 | 51 -> 61 | 245 -> 354 | 19.8 -> 20.7 | 499 -> 680 | 0 0 0 0 0 0 0 2 1 2 | 0 0 0 0 0 0 0 0 2 0 |
| mage | full | 10/10 | 10/10 | 10.2 -> 12.9 | 10.2 -> 12.9 | 59 -> 76 | 353 -> 482 | 21.8 -> 23.8 | 836 -> 982 | - | - |
| warrior | fresh | 2/10 | 1/10 | 6.7 -> 9.5 | 9.3 -> 10.0 | 50 -> 65 | 251 -> 381 | 17.9 -> 21.4 | 492 -> 624 | 0 0 0 0 1 0 1 5 1 0 | 0 0 0 0 0 1 0 5 2 1 |
| warrior | career | 4/10 (4 left) | 6/10 (4 left) | 6.5 -> 8.3 | 7.6 -> 9.7 | 44 -> 58 | 257 -> 364 | 21.2 -> 23.2 | 584 -> 736 | 0 0 0 0 0 0 1 1 0 0 | 0 0 0 0 0 0 0 0 0 0 |
| warrior | full | 10/10 | 10/10 | 10.3 -> 13.1 | 10.3 -> 13.1 | 60 -> 77 | 368 -> 503 | 22.2 -> 24.8 | 847 -> 995 | - | - |
| archer | fresh | 0/10 | 2/10 | 5.8 -> 7.4 | - -> 10.0 | 45 -> 58 | 215 -> 302 | 16.9 -> 19.0 | 426 -> 546 | 0 0 0 0 0 2 2 2 1 3 | 0 0 0 0 1 1 1 3 2 0 |
| archer | career | 2/10 (4 left) | 5/10 (4 left) | 5.5 -> 7.6 | 7.2 -> 9.1 | 41 -> 53 | 222 -> 340 | 18.1 -> 21.4 | 492 -> 702 | 0 0 0 0 0 0 0 2 1 1 | 0 0 0 0 0 0 0 1 0 0 |
| archer | full | 10/10 | 10/10 | 8.5 -> 10.8 | 8.5 -> 10.8 | 50 -> 64 | 309 -> 434 | 20.8 -> 23.7 | 809 -> 951 | - | - |

Seconds by room of the `full` runs, rooms 1-10 (room 10 = the boss room):
mage 31 43 44 54 65 63 66 75 92 78 -> 39 56 57 72 81 86 86 93 118 89; warrior 25 34 40 47 63 68 70 83 111 75 -> 30 45 51 63 81 91 92 106 139 88;
archer 27 37 40 42 54 55 54 61 76 62 -> 36 48 49 58 69 73 71 77 96 69.

What the numbers say:
- A full run of 10 rooms is about 25 % longer: 10.2 / 10.3 / 8.5 min -> 12.9 / 13.1 / 10.8 min (mage / warrior / archer). A room takes 58-77 s instead of 45-60 s.
  It is not +45 % because the monsters also come faster and more at once (spawn pause 1.3 -> 0.9 s, alive cap x1.45): what is left is the walking in a room of twice the floor.
- Kills per full run +37 % (353 -> 482, 368 -> 503, 309 -> 434); the hero ends about 2 levels higher; gold earned +17 %; items found the same (the sealed bag is full at 20 either way).
- It is somewhat EASIER: wins without gear 2/30 -> 6/30, in careers 8/30 -> 15/30. Ten seeds are noisy (2 to 4 of 10 count as the same), but every class moved the same way
  in careers. Why: more exp per room (the same room is reached 2-3 levels higher) and more floor to keep away on. Nothing was done about it (the brief: no rebalance
  beyond playable); the knobs, if the user wants the old difficulty back, are `run.roomMult` / `run.monsterDmg` (monsters) or `exp` (levels), not gear or abilities.
- No softlock, no timeout in the 90 runs of the table; the browser matches Node.

**Recommendation for decision 3 (number of rooms): cut to 8 rooms (7 + the boss) if 8-10 minutes stays the goal.** From the `full` times above, keeping the room
order and the boss last: 10 rooms = 12.9 / 13.1 / 10.8 min; 9 rooms = 11.0 / 10.8 / 9.2 min; **8 rooms = 9.4 / 9.0 / 7.9 min**; 7 rooms = 8.0 / 7.5 / 6.7 min.
Eight big rooms are also close to the old run in content: about the kills of the old ten rooms (the first seven rooms and the boss hold 65 % of the new monsters, about 320 kills
against 310-370 before) and probably close to the old final level (not measured). Keeping 10 rooms is fine only if 11-13 minute runs are wanted (more loot and levels per run, which suits a
farming game, but late deaths then cost 9-10 minutes). The cut is a balance step of its own, not done here: every per-room table in `src/balance.js` has ten entries (`roomMult`,
`fissure.count / budget / pool / superWave`, `loot.chestItems`), Don Montoto's cage is in room 5, the merchant rooms and the daily score (par 900 s) count on ten rooms,
and the first-win pace must be measured again. These are estimates from 10 seeds per class: the boss would be met at a lower level in an 8-room run, so its room would last longer than the 69-89 s measured.

Checks on the final build (2 035 259 bytes; copy in `/home/claude/builds/riftscar_rooms.html`, screenshots in `/home/claude/builds/rooms/`):
- `python3 tools/build.py` ok; `node tools/determinism.js` pass (500 rooms sane, 500 distinct, 1200 door-modified rooms, every bot run identical twice; it takes about 4 min now);
  `check_i18n.js` pass; `check_bag.js` pass (its in-run equip fixture now identifies the rolled item: with the new rooms the roll came out rare, i.e. unidentified);
  `check_tutorial.js` pass (38 x 26 room, all 13 steps for every class); `contrast.js` pass.
- `node qa/bot.js --seeds 3,4,5` (mage): 0 console errors, 0 softlocks, 3 of 3 match Node (dead in rooms 9, 8, 6; no win in these three seeds, so the script's "one run clears all rooms" condition is not met).
- `node qa/hd.js <out>`: 0 console errors, HD skeletons and floor, the four boss poses, the cage, the toggle (the script now picks a card when a level-up opens: there are more of them).
- `node qa/rooms.js <out> all`: PASS. UI at 1640x922 and 1920x1080 (S=2): Settings 208 x 254, inventory 340 x 200, level-up cards and the door choice centred and inside; zoom 2 > 3 > 2 > 2;
  old-save offsets. Rooms: room 3 (start and fight), the boss room (start and the Tyrant attacking) and the test room at 1640x922, 1920x1080, 960x540, 844x390 and 540x960:
  the room covers 93-100 % of a 1640x922 view (the camera follows a little), 85-95 % of 1920x1080 (whole room on screen, centred); on the three small sizes the camera follows as before. 0 console errors.
  Also looked at: 2560x1440 (S=3, the room fills the view), the title and the tutorial room at 1640x922.
- `node qa/tutorial.js land_en` 131 of 131 and `port_es` 132 of 132; `node qa/test_room.js` 0 errors; `node qa/daily.js` 32 checks, 0 failing; `node qa/touch.js landscape` 35 of 35.

Decisions taken without asking (the brief said to decide and note):
- Zoom: at 922 and 1080 the far default is the lowest step (no 1x). Old saves keep the scale they had chosen, not their offset.
- +45 % monsters = one more crack per room and a bigger budget per crack (not budget alone: three cracks in the first room cover a room of twice the floor better than two),
  and the alive cap and spawn pace rise with it, so the room is fuller, not just longer.
- A kill pays what it paid (exp, gold, drop chances): the economy and exp tables are untouched, a run simply holds more kills.
- Boss: slam radius, charge length and summons up a step; its hp, damage and timings are unchanged.
- The tutorial room was widened (38 x 26), otherwise it would be the same island on a desktop screen that the user complained about.
- NOT touched: the city (next step; at 1640x922 it is a 416 x 240 island in the middle), the portrait layout, the number of rooms.

Rough / not tested:
- Nobody has played it: feel, pace and readability of small sprites in a full room are unjudged (headless Chromium runs at a few fps).
- On a small screen (960x540, phones) the hero sees a sixth of the room; the pointer shows the nearest open crack, but slow monsters (36 px/s) from a far crack need up to 25 s to arrive.
  Only the cluster nearest the hero spawns (as before); on a desktop view the far cracks are lit but idle.
- Long cracks pen walkers behind them more often than the short ones did (same rule as before: an open crack is a wall for walkers); the bot walks up after 20 s, worst "no progress" 13.8 s in the browser runs.
- Performance was not measured: a crack texture is up to 4 x the old area (its shimmer redraws at half rate), a room is generated in about 30 ms. Not run on a phone.
- 1440p (S=3): HD sprites are uneven (1.5 screen px per HD px), as noted in part 1.
- The daily challenge keeps its 900 s par: with longer runs the time bonus is smaller. Scores of the same day differ from the previous build (new rooms).
- Not run: `qa/screens.js`, `qa/session.js`, `qa/city.js`, `qa/lo.js` (27 px mode), `qa/touch.js portrait`, the browser bot for warrior and archer, Spanish at desktop sizes, dragging the zoom slider at desktop sizes.

## Last measured (2026-11-12, HD art pilot)

- `determinism.js` pass, `check_i18n.js` pass (4 keys added), `check_bag.js` pass; `sim_bot --seeds 1-10 --class warrior` identical before / after (wins 1, 3).
  `qa/bot.js --seeds 3,4,5` (HD on): 0 errors, 0 softlocks, all match Node. `node qa/hd.js`: 960x540 and 540x960, hd on / off: HD skeletons and floor present
  when on, chunky when off, boss poses idle / slam / charge / burst seen, death corpses play, Settings toggle off -> on works and is saved, Montoto HD in the city; 0 console errors.
  Zoom S=3 (1440x810) and S=1 looked at: no blur.
- HTML 1 845 562 -> 1 976 616 bytes (+131 KB: HD atlas 512x128 and the floor tile).
- Screenshots: `/tmp/hd_testroom_landscape.png`, `/tmp/hd_testroom_portrait.png`, `/tmp/hd_boss.png`, `/tmp/hd_city_montoto.png`, `/tmp/hd_motion_strip.png` (copies in `/home/claude/builds/hd/`).
- Rough (the look, to judge): the HD skeleton reads THINNER and weaker than the chunky one (the blade takes a fifth of its 50 px, ribs turn to speckle at that size; the
  source has ~75 native pixels, reduced by 2/3); HD sprites next to the chunky hero, imps, bats and walls mix two densities; the tilt shows stair-step edges while walking;
  at S=3 an HD pixel is 1.5 screen px (uneven rows, no blur) and at S=1 every other HD pixel is dropped (floor grout breaks up); the code floor is busy (many 8 px fill stones);
  the tyrant idle is the burst pose (arms spread) so idle and burst differ only by the chest glow; the shadow is subtle on the dark floor; "HD PRUEBA: SÍ" touches the button top.

## Last measured (2026-11-12, step 10: balance and daily challenge)

- Per class, final (round 7). Fresh = seeds 1-100; careers = 10 careers x 10 runs on seeds 1-100 (first-win run averaged over the careers that won).
  mage: fresh 15 %, first win run 7.0 (10/10 careers), after the first win 47 %, win time 566 s fresh / 499 s careers, deaths/room 0,0,3,3,12,16,5,21,20,5.
  warrior: 15 %, 6.9 (9/10), 39 %, 538 / 503 s, deaths 0,0,0,0,5,8,17,20,19,16. archer: 11 %, 6.2 (9/10), 50 %, 493 / 442 s, deaths 0,4,1,6,15,12,17,13,15,6.
  0 softlocks, bestFromDrops 10/10 for every class. Round 0 (the WIP): mage 15 % / 7.0 / 37 %, warrior 22 % / 6.8 / 55 %, archer 7 % / 7.5 / 52 %.
- `determinism.js` pass (daily run twice identical), `check_bag.js` pass (daily checks), `check_i18n.js` pass (503 keys), `contrast.js` 0 failing (lowest 5.65:1), `qa/city.js` 2854 of 2854.
  `qa/bot.js --seeds 3,4,5` (mage): 3 deaths, 0 errors, 0 softlocks, all match Node. `qa/daily.js`: 32 of 32 checks, 0 errors (2026-11-12: archer, dies in room 9, score 10590, same in Node).
- Screenshots: `/tmp/step10_daily_result_landscape.png`, `/tmp/step10_daily_result_portrait.png`.
- Rough: 10 careers per class is noisy (career wins moved 13-24 between rounds with small changes; one point of archer damage moved fresh 7 -> 17 -> 11 %), so the numbers sit near the edges of the targets;
  archer career wins take 7.4 min (fresh 8.2); one warrior and one archer career out of 10 never won; in careers deaths gather in rooms 9-10 (the bot only dies when it pushes deep), the fresh spread is fine.
  The daily result has an empty band above COPY; the board's label sits close to THE RIFT in the wide city; the daily board text was not tested in Spanish on screen (keys and font checked).
- Step 9 art import (branch `step-art-import`, no sim change): the user's four Grok images went through `tools/import_asset.py`, each judged at game size against the code-drawn frame
  (table in `docs/grok-prompts.md` > Status). **Kept**: Don Montoto in the city (`npc_montoto_0/1`, 18x23) and a new portrait `portrait_montoto` (64x62) left of his story in the talk panel
  (`Panels.openMontoto`, shown only when the atlas has the frame; the text wraps beside it). **Rejected** (kept in `assets/imported/rejected/`, not packed): tyrant attack poses `tyrant_2/3/4`,
  skeleton throw `skeleton_2`, the small Montoto for the cage (`pixelart.py` draws `assets/imported/parts/cage_montoto_<f>.png` behind the bars when it exists).
  Importer: border-colour key with a narrow hue window (hot pink backdrops, purple robes survive), `--split cols`, `--own-box`, `--method mode` (majority vote, for pixel-art sources), `--accent`, `--smooth`, `--names`, layer PNG alpha.
- `main` is the working base. One branch per step: `step-N-<slug>`.

## Last measured (2026-11-12, step 9 art import)

- `determinism.js` pass, `check_i18n.js` pass, `sim_bot --seeds 1-10 --class warrior` identical before / after (2 wins, seeds 3, 8; only wall time differs). `qa/city.js` 2518 of 2518, 0 errors.
  `qa/bot.js --seeds 3,4,5`: 0 errors, 0 softlocks, all match Node. Every story line (16 x en / es x both sizes) fits beside the portrait (deepest text 56 of the 78 px inset).
- Screenshots: `/tmp/art_compare.png` (old vs new frames x5 and in-game crops), `/tmp/art_montoto_panel.png`, `/tmp/art_boss_landscape.png`.
- Rough: the imported Montoto's robe has a few dark specks; his two frames differ little (the breathing is subtle); the portrait's skin is a flat brown ramp (`skin_d` / `ch`), no candle light from below.
- Step UX (first-time guidance and save backup) on branch `step-ux`.
  **A, hints**: `src/view/hints.js` (`G.HINTS` table: id, trigger, text key, optional touch / alt key, position, seconds; `G.Hints.on(trigger)`, `tick`, `attach`), texts in `src/i18n_ux.js` (`hint.*`, `set.hints*`, added to the tables of `i18n.js`).
  Run hints (14): move (+ attacks are automatic), crack (seen), blocked, darken, super, chest, exit, levelup, choice, unid, scroll, gold, merchant (near), cage. City (5): city, smith, trainer, montoto (empty / rescued text), portal.
  Each shows once per save (`save.hints = { off, seen }`, shared by characters), 6.5 s or a tap, one at a time (queue of 4), never pauses; top of the screen under the HUD (bottom for level-up and door choice, and in the portrait city); not in the test room or under the QA bot. Settings: HINTS: ON/OFF and RESET HINTS (a short screen, V.H < 212, drops the two grey hint lines to fit).
  **Gentler first run**: `BAL.run.gentle = { rooms: 3, mult: 0.8 }` (hp and damage of monsters in rooms 1-3), applies when `gear.ux.runs === 0` (per character; `save.gears[c].ux.runs` counts runs started; an old save with progress counts as 1). The flag is `sim.gentle` (`opts.gentle` overrides it). `G.parseSave(text)` is the old `loadSave` body (also used by the backup import).
  **B, save backup**: `src/backup.js` (pure): `G.encodeSave(save)` -> `RS1.<base64 of LZW(JSON)>.<FNV-1a checksum, 8 hex>` (one line; roughly half the JSON size on a full save), `G.decodeSave(text)` -> `{ ok, save, from, info }` or `{ ok: false, err }` (err: empty, format, checksum, data, shape, version), `G.saveSummary`. The code format is `RS1`; the save inside keeps its own `v` and goes through `G.parseSave` (the normal migration); versions above 8 are refused.
  UI `src/view/backup.js` (`Panels.openBackup(scene, 'export' | 'import')`, opened from two Settings buttons; no IMPORT inside a run): the code lives in a real DOM `<textarea>` laid over the canvas (it is also the manual-copy fallback: when the clipboard is blocked the box stays visible with the code selected and the status says to press Ctrl+C). COPY (Clipboard API, then `execCommand`), DOWNLOAD (`riftscar-save.txt`), PASTE (clipboard read), CHECK -> a summary (characters, items, gold, runs) -> REPLACE or CANCEL. Replacing keeps this device's settings (zoom, shake, language), saves, and goes to the title. Errors change nothing. The textarea has `opacity .99`: without it headless Chromium leaves a hole in screenshots under it.
  Texts: `bak.*`, `set.export`, `set.import` in `src/i18n_ux.js`. Checks: `check_bag.js` group `backup` (round trip, corrupted / cut / foreign / newer-version codes refused, v6 code migrates, checking changes nothing, three full bags).
- `main` is the working base. One branch per step: `step-N-<slug>`.

## Last measured (2026-11-12, step UX B: save backup)

- `check_bag.js` (group `backup`), `check_i18n.js`, `contrast.js` pass; sim untouched by B (bot results as in A).
- Browser (Playwright script outside the repo, `qa/lib.js`), 960x540, 540x960 and 960x540 at zoom 3, en and es: Settings -> EXPORT shows the code, clipboard blocked (simulated): the box stays with the code selected and the status says so; DOWNLOAD gives `riftscar-save.txt` with the code; with clipboard permission COPY and PASTE work; IMPORT: garbage and a corrupted code give an error and change nothing, a valid code shows the summary, CANCEL changes nothing, REPLACE replaces and stores the save (settings kept); 0 console errors. Screenshot `/tmp/ux_export.png`.
- Rough: LZW with 16-bit codes (about 2x on a full save, nothing on a tiny one); the box font is the browser's monospace; touch keyboards were not tried (emulation only, no phone); import is not offered inside a run on purpose.

## Last measured (2026-11-12, step UX A: hints and gentler first run)

- `sim_bot --seeds 1-10` (fresh gear = first run, so every run is gentle now), before -> after: mage 1 (10) -> 2 (2, 10), warrior 2 (3, 8) -> 0, archer 0 -> 1 (6); 0 softlocks, 0 timeouts. Noise: the softer rooms 1-3 change every later roll; a fresh character's first run is the only case that changes (careers: runs 2+ are identical to before).
- `determinism.js`, `check_bag.js` (new `ux` group), `check_i18n.js`, `contrast.js` (0 failing, lowest 5.65:1) pass; `qa/bot.js --seeds 3,4,5` 0 errors, matches Node.
- Browser, fresh save, 960x540 and 540x960, en and es: every run hint fires once and does not return, the city hints fire per stall, HINTS toggle and RESET work, 0 console errors.

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

## Interactive tutorial (branch `step-tutorial`)

- Replaces the passive hints. Sim option `tutorial: {reward}` (`src/sim/tutorial.js`, `balance.tutorial`, `dummy` monster); view in `src/view/tutorial.js` (`G.Tut`);
  strings in `src/i18n_tut.js` (EN and neutral LatAm ES). Room steps: move, attack, dodge, cross, skill, darken, super, chest, pickup, bag, identify, equip, exit, then "Well done".
  City: Blacksmith, open his shop, Trainer, portal. Run: first level-up card (and slot replace), first after-room choice, first merchant, Don Montoto's cage.
- Save: `hints.tut = {state: pending|done|skipped, got, steps:{city,card,choice,merchant,cage}}`, `hints.off`. Saves with runs or gear progress migrate to done (gates done, got = true).
  Settings: "Tutorial pop-ups on/off" and "Replay tutorial" (hidden in a normal run); title has a TUTORIAL button. `G.resetTut` resets for replay.
- Isolation: the tutorial Sim uses `testRoom = 0` rules (no banking, gold, merchant), hero cannot die, no exp. Bots, careers, daily never set `tutorial`. sim_bot seeds 1-10 per class identical before and after.
- Kept item: the first completion keeps the identified own-class weapon equipped (once, `got`); a replay restores the previous weapon. Skip cleans up. Nothing else reaches the save.
- QA: `tools/check_tutorial.js` (3 classes), `qa/tutorial.js` (land_en, land_es, port_en touch, port_es touch), `check_bag` tutorial flags. URL: `?tutorial=1` (pending), `&scene=game` starts the room; `?fresh=1` marks it done.
- Safety net: in the skill, darken and super steps, 20 s (`balance.tutorial.stuckAfter`) with no monster hurt pulls the live ones to the hero; 20 s more beats them. `check_tutorial` holds monsters out of reach for 3 classes x 3 steps.
- Rough: touch checked by emulation only; with a big modal open on tiny views the pop-up can overlap the panel top; ranged classes can kill the dummy from afar; the city sequence is saved only when the portal is entered; no tutorial sounds.

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
- `src/mapgen.js`: `G.genRoom(runSeed, index, B)`, a pure function. `genFissure` makes one crack. Room sizes, outline, blocks and reserved zones: `BAL.room`; crack length, arms, sites: `BAL.fissure`.
- `src/sim/core.js`: `Sim` (`opts.cls`; `sim.cls`, `sim.clsId`), `G.classDef`, room loading, `move` (walls and open cracks), `bfs`, flow fields
  (`flow` for flyers, `flowWalk` for walkers), player, level-ups, `cheat*` actions.
- `src/sim/fissures.js`: the crack network (`setupFissures`, `networkKill`, `darkenSeg`,
  `spawnFromCluster`, `crackHits`, `crackOnLine`), super fissure, chest, exit, objective.
- `src/sim/combat.js`: auto-attack (`shootBolts` or `swing`, event `swing`), `castSkill` -> pulse, monster AI (`casterAI` = the cultist), `steer`, projectiles, telegraphs (`teles`), rift pools (`pools`), pickups, kills.
- `src/sim/boss.js`, `src/sim/items.js` (also `bankItems`, `doorsFor`, `doorEffects`; the starter weapon `giveStarter`; materials `rollMat`, `fillMat`; `G.gearLook` for the view), `src/save.js` (v9, migration). Run end and doors: `Sim.finishRun`, `enterChoice`, `leave`, `takeDoor` in `core.js`.
- `src/sim/abilities.js`: pool, offers, family tiers, stats, card info. `src/sim/effects.js`: statuses, triggers, effect kinds, orbit, zones, echoes.
- `src/qa/bot.js`: the bot (`G.Bot(sim, buildId)`, `G.botRun`); `crossDir` dodges across cracks; `pickAbility` follows a build.
- Test room: `Sim({ testRoom: true })` loads `B.run.testRoom`; `restartTestRoom` reloads it on clear.
  Sim events for the view: `blocked` (mage pushes into an open crack), `dodge.cross`, `land.cross`.

View (Phaser):
- `src/view/game.js`: scene, fixed 60 Hz stepping, sim events to effects, `G.qa.state()`.
- `src/view/room.js`: tiles and `FissureView` (per-pixel crack renderer, `updateNet`; dark halo =
  barrier edge, `bump` flares the lip). Dodge arc and recoil: `planArc`/`drawArc` in `game.js`.
- `src/view/city.js` (city world and overlay; the `CITY` table at its top places everything in the town, `PROP` says what each prop is), `src/view/hud.js`, `src/view/panels.js` (inventory, settings, debug, result), `src/view/ui.js`
  (UI toolkit, `UI.hit` names for QA clicks), `title.js`, `input.js`, `fx.js`, `boot.js`, `main.js`.

Tools:
- `tools/build.py` builds `dist/riftscar.html`. `tools/determinism.js`, `tools/check_bag.js`. `tools/sim_bot.js`
  (`--seeds`, `--leave N`, `--class id`, `--build id`, `--json`, `--set path=value`, `--career N`). `tools/contrast.js`.
- `qa/bot.js`, `qa/screens.js`, `qa/session.js`, `qa/test_room.js`, `qa/city.js` (layouts, labels, prompt), `qa/touch.js` (touch emulation), `qa/hd.js` (HD pilot), `qa/lib.js`: headless Chromium checks.
- `tools/hd_atlas.py`: HD art (import, floor, pack).
- `tools/check_secrets.py`, `tools/clean_url.py`, `tools/hooks/`, `.claude/hooks/guard.py`.

URL parameters: `seed`, `tier`, `class`, `build`, `speed`, `bot=1`, `manual=1`, `touch=1`, `fresh=1`, `scene`,
`room=test`, `debug=0`, `leave=N` (bot), `hd=0|1` (HD art pilot).

## Planned later

- A dagger class (daguero), after the first public version's three classes. It may take the Venom family.

## Phones: landscape only (branch `step-landscape`, on top of `step-big-rooms`; 2026-11-13, not merged)
The user: on a phone the game is played in landscape and should get there by itself. A page cannot turn the device, so
`src/main.js` turns the game: on a touch device (coarse pointer) whose window is taller than wide, the game is laid out
for the long side and drawn rotated 90 degrees clockwise (`G.rot`), upright once the phone lies on its left side; when the
browser itself goes landscape the turn is off. `#game` (what Phaser measures) has the swapped size and is not rotated;
the canvas and the DOM layer `G.domLayer()` (the save-code box of `src/view/backup.js`, the manual-copy box of
`src/view/panels.js`) carry the rotation; `game.input.transformPointer` turns pointer positions back. It also asks for
`screen.orientation.lock('landscape')` on the first touch (works only where the browser allows: installed / fullscreen).
`?rotate=0` never, `?rotate=1` on any upright window; `qa/lib.js` opens every page with `rotate=0` unless the query sets it.
A tall DESKTOP window still gets the portrait layout (kept, not removed).
Checked: build; `qa/rotate.js` (new: layout 844x390 on a 390x844 touch window, canvas turned, tap on the turned bag button
opens the inventory, stick direction, window turned to 844x390 and back, city, rotate=0) PASS; `qa/daily.js` 32 checks;
`qa/touch.js landscape` 35/35 (one run gave 34/35, the next 35/35: a timing check of the headless browser, not looked into);
the save-code box sits inside its panel, normal and turned. The sim is untouched (determinism not rerun).
Not tested: a real phone (iOS Safari and Android Chrome, the Claude app's artifact viewer), the browser bars changing the
window height, typing into the turned import box (the keyboard opens upright), tablets (a tablet held upright is turned too).

## Cracks: the look they had before the big rooms (same branch, 2026-11-13)
The user, on his phone: the fissures lost quality. Cause: the big-rooms step halved the fork chance (`fissure.fork` 0.07 -> 0.035 per px)
while the arms got 65 % longer, and a fork ran 0.6 x the rest of its arm, so cracks became long bare lines; the tutorial crack was a
smooth even band, now 38 tiles wide. Changed: `fissure.fork` back to 0.07 and new `fissure.forkLen` [14, 46] px (a fork off an arm is a
twig, not one more long arm; forks of forks as before); the tutorial crack (`src/sim/tutorial.js`) is a jagged band (path within 5 px
of its row, half width 2-4 px in runs) with side twigs up to 22 px, from its own fixed seed, still wall to wall.
Checked: build; `tools/determinism.js` (with the 500-room sanity block) pass; `tools/check_tutorial.js` pass; `qa/tutorial.js land_en`
all passed; `node tools/sim_bot.js --seeds 1-10` (mage): 5 wins, no softlocks or timeouts, 626 s average (10 seeds: noise; the
before/after table of the big-rooms step was not rerun); screenshots of two rooms and the tutorial at 1640x922 looked at.
Rough: more twigs = a little more barrier around each crack (not measured); the 27 px / old art modes were not looked at.
Second pass, same night: the user still saw "a straight line" in the tutorial (his first level). The tutorial room now has a
wall three tiles thick across it with a gate (`tutorial.gate` 8 tiles), and the crack is made by `G.genFissure` like any crack of a
run: two arms from the centre to the two wall ends (first seed whose arms reach them), two short arms off them, twigs; a lane
`tutorial.crackLane` px either side of the centre holds only the centre knot, so the dodge lane and the marked spot stay clear
(`tutorial.crackReach / crackEnd / crackSide`). The crossing test, the two clamps and the crack's spawn points follow the crack's
own line (`room.tut.lineY`), spawns stay inside the gate. Checked: `tools/check_tutorial.js` pass, `qa/tutorial.js` land_en
131/131 and port_es (see the commit), `tools/determinism.js` pass, screenshots at 1640x922 and 844x390.
Rough: the tutorial's lower half is now closed by the wall except for the gate (nothing needs to pass but the hero); the
wall-to-wall band code is gone, `tutorial.crackRow` keeps its name.

## Title backdrop off to one side after the window grows (same branch, 2026-11-13)
The user's screenshot: title on a window he had enlarged, the backdrop room sitting left with black to its right. Cause: Phaser resizes
the scenes' cameras on the scale 'resize' event AFTER `G.applyView` (registered first), so a scene that centres its camera on
'viewchange' (the backdrop) centred it for the old window. `G.applyView` (`src/main.js`) now gives the full-window cameras of the
running scenes the new size before it emits 'viewchange'. Checked: title opened at 960x540 then grown to 1640x922 (room centred,
covers the screen) and shrunk to 844x390; `qa/rotate.js` PASS (it resizes a running game both ways). Not rerun: the other QA scripts.

## Bigger city (branch `step-big-city`, on top of `step-landscape`; 2026-11-13, not merged; brief `docs/steps/step-big-city.md`)
The user: on his 1640x922 window the city (26 x 15 tiles) was a small island in a black screen. It is now ONE town of
**56 x 32 tiles (896 x 512 art px)** on every screen: at 1640x922 (820x461 art px) the screen is full and the camera moves a
little with the hero, at 1920x1080 the whole town is on screen, centred, with a rampart of wall top round it instead of the
void (`APRON`), and on a phone (844x390, also turned with `?rotate=1`) or a tall window (540x960) the camera follows the hero.
The two old layouts (`LAND` / `PORT`, `pickLayout`) are gone. The sim, `src/balance.js` and the save are untouched (the city's
saved state is still `gear.city = { montoto, story }`).
**One data table**: `CITY` at the top of `src/view/city.js` (also `G.CITY`): size, wall blocks, ground areas (road, plaza,
garden beds), torches, start, portal, stalls, board, quarters (label, sign, lots) and every prop; `PROP` says what a prop
frame is (solid box, animation frames, light, depth); `KEEPER` who keeps a stall. Collision boxes are worked out from it once.
**Layout** (all in px in the table): the hero arrives on the plaza (448, 242) in front of the portal "La Brecha" / "The Rift",
which stands on a stone dais in the MIDDLE of the market row with two braziers; the row, west to east: Don Montoto (an empty
stall until rescued), Blacksmith, portal, Trainer, a vacant fenced pitch, with stock (barrels, the crates) at both ends.
The market street runs the whole width under the row, lamp posts on its south side. North of the row: the road to a barred
gate in the north wall (gate towers, town banners), the Mage quarter (north-west: two fenced lots, its sign, purple banners)
and the Neutral quarter (north-east: two lots, a sign, grey-green banners, the Trainer's dummies): empty lots for the keepers
to come, NO new shops. South of the street: the notice board (the daily challenge, its own sprite now), the fountain,
planters and two more braziers on the plaza; four garden beds with trees; six boarded-up houses along a lower street (for
the neighbours rescued later); a grove (south-west) and a fenced graveyard with candles (south-east).
Walk from the start, measured by `qa/city.js` over the real collision test, at the slowest class (74 px/s): portal 0.5 s,
Blacksmith 1.3, Trainer 1.3, board 1.1, Don Montoto 2.6; the two quarter signs 3.3.
**Art** (all `tools/pixelart.py`, one pixel size): walls are the ROOMS' wall tiles (top, face, shadows) and torches with the
same light (`glow`, em2, the rooms' flicker); the town's ground is new tiles in `tiles.png` (104-139: a 64 px cobble
texture, the paved road, plaza pavers, a nine-slice garden bed with a kerb); `town()` draws the gate, two houses, the
fountain (2 frames), brazier (3), lamp post, barrel, tree, bare tree, bush, planter, banners on poles (4 colours, 2 frames),
the notice board, graves, an iron fence and the dais. 17 new palette colours (grass, earth, water, roofs, plaster). The old
`c_floor*`, `c_path`, `c_wall` frames are removed. No HD (double-density) art was added: props and ground stay on the art pixel grid.
**The hero in the city is HD**: `CityScene` gives the player a `G.Rig` like `GameScene` (HD frames, walk frames tied to the
distance walked, facing, breathing, soft shadow) when the art mode is HD and the class has a sheet (today: the mage); warrior
and archer stay chunky because they have no HD sheet. Don Montoto was already HD. **The Blacksmith and the Trainer stay
code-drawn chunky sprites** (no HD frames exist for them), as do the stalls.
**Decisions taken without asking** (the brief said: decide and note):
- One layout for every screen instead of a second one for tall windows: 540x960 scrolls now (the camera follows).
- The portal moved from the bottom of the old city into the market row and is entered from the FRONT (the plaza side) only:
  the back of its arch is solid. Scripts that walked down into it now walk up (`qa/touch.js`, `qa/session.js`).
- Labels are fixed to the town (no more clamping to the camera, no lifting): the table places them so that none covers
  another label or a landmark, which then holds on every screen; only the TALK / LOOK / READ prompt follows the screen.
  "RETO DIARIO" is over the notice board, about 100 px from the portal.
- A keeper is solid and the talking spot (`front`) is 26 px in front of the counter (was 14, on the keeper), reach 26 px (was
  30): the hero no longer stands on the keeper he talks to.
- A stall is solid over its whole depth (the hero walks behind it, not through its back).
- The gate is in the NORTH wall, because only north walls show a face in this view; it is dressing (barred, no way out).
- The Neutral quarter has its own sign and text (`city.neutralQuarter`, `city.neutralSign`, English and Spanish:
  "BARRIO NEUTRAL"); the Trainer keeps his stall in the market row, his dummies stand in that quarter.
- On a short screen (under 240 art px high) the camera looks 24 px above the hero instead of 8 (`LOOK`), so the labels of the
  stalls are below the overlay's top strip on arrival; and a city hint is drawn at the bottom beside the TALK button
  (`src/view/hints.js`), because at the top it covered the label and the prompt of the stall in reach.
- The tutorial's city arrows ask the city where to point (`CityScene.pointAt`: just above the label of the stall or portal).
**Checked** (final build): `python3 tools/build.py`; `node tools/check_i18n.js` pass; `node tools/contrast.js` 39 pairs, 0
failing; `node tools/determinism.js` pass (the sim is untouched); `node qa/city.js` (rewritten: 1640x922, 1920x1080, 960x540,
844x390 touch, 540x960; English and Spanish; rescued and empty stall) 8301 of 8301 checks, 0 errors; `node qa/tutorial.js
land_en` 131 of 131 (the four city steps unchanged in the script; one earlier run failed BEFORE the city, in the tutorial
room: "timeout: pop-up of step exit", passed twice since, not looked into); `node qa/touch.js landscape` 35 of 35;
`node qa/rotate.js` PASS (the city turned); `node qa/hd.js` 0 console errors (hero and Don Montoto HD with hd=1, chunky with
hd=0); `node qa/daily.js` 32 checks, 0 failing (the board in the city). Screenshots looked at: the city at 1640x922
(English, Spanish with Don Montoto), 1920x1080, 960x540, 844x390, 540x960, the shop open at 1640x922, Don Montoto's stall at
844x390 in Spanish, the turned phone (390x844, rotate=1), the tutorial's city steps. Copies: `/home/claude/builds/riftscar_city.html`,
`/home/claude/builds/city/`.
**Not tested**: a real phone or a real desktop browser (headless Chromium only, about 4 fps: walking feel and the rig's motion
are unjudged); `qa/tutorial.js` in the other three configs (land_es, port_en, port_es); `qa/touch.js portrait` (its city check
was rewritten but not run); `qa/screens.js` and `qa/session.js` (the latter was edited for the portal's direction, not run);
the 27 px and OLD art modes in the city beyond hd=0; zoom steps other than the default; the warrior and archer beyond the
tutorial run (warrior); the bot (not needed: no sim change).
**Rough**: the town is dark away from the fires (mood, but the far lots and the quarter names are dim, more so under the
overlay's vignette); the six houses are two sprites, the bare tree is small and scratchy; the Blacksmith, the Trainer and
the stalls are chunky beside an HD hero and an HD Don Montoto; at 1640x922 the bottom 50 px of the town (grove, graveyard)
are off screen until the hero walks down; on a phone the vacant pitch and the Neutral quarter sit under the top-right
buttons when the hero stands at the Trainer; a keeper is a small solid in the street, a hero hugging the stalls has to steer
round him; the hero can walk behind houses and trees (drawn behind them, hidden for a moment); nothing in the far corners
can be used yet (lots and dressing only); `qa/tutorial.js` still writes four of its shots to /tmp (untouched).

## Weapon rarity glow, a test (branch `step-weapon-glow`, on top of `step-big-city`; 2026-11-13, not merged)
The user's decisions: the hero's look changes with the weapon TYPE (one generated sheet per type: the warrior needs sword, axe, mace,
hammer), and the weapon's RARITY shows as a glow; on the mage only the staff's crystal glows, not the whole staff. He named the
tiers Common, Magic, Rare, Legendary, Mythic and maybe Unique: the game's item rarities are still common, magic, rare, epic,
legendary (not changed here; mythic and unique exist only as glows to preview).
`tools/weapon_fx.py mage` finds the crystal by colour in every `assets/hd/mage_*.png` and writes a mask `fx_<frame>.png` (the
crystal, a 3 px halo, a soft round halo; 8 px bigger than the frame per side) plus `assets/hd/fx_points.json` (the crystal's
centre, which `tools/hd_atlas.py pack` stores as the frame's `head`). `G.Rig` (`src/view/hd.js`) draws the mask over the hero with
the frame's transform, additive, tinted and pulsing by `G.ANIM.glow` (`src/view/anim.js`: magic blue, rare yellow, epic purple,
legendary orange with sparks, mythic a colour cycle, unique pale gold with more sparks); sparks leave from `head`. Rooms and city.
The glow follows the equipped weapon's rarity; `?glow=<key>` or DBG > GLOW (it replaced RESUME; the X closes the panel) previews one.
Checked: build, check_i18n, `qa/glow.js` (new: 7 states, mask frame follows the hero's frame, 0 console errors) PASS,
`qa/hd.js` 0 console errors. Not checked: the glow on a real item of each rarity in a run, the city, the 27 px / old art modes
(no masks there: no glow), warrior and archer (no sheets yet). Rough: the attack-thrust frame's mask includes the cyan flash.
Warrior imported the same day (Grok 4x2 sheet, the strip method of docs/grok-prompts.md; idle 39x52 HD px): walk x4, idle,
sword raised, sword swung, hurt; `G.ANIM.ent.warrior`. Plate armour, shield and sword are drawn into the sheet, so the chunky
held weapon is hidden over it and the look does not follow the equipped weapon type or armour yet. Checked: build, the warrior
in the test room at 1640x922 (walk frames cycle, 0 console errors). Not captured: its attack frames.
NEXT DECISION (the user, 2026-11-13): the hero must start with NO gear drawn and show what is equipped (armour, weapon), because
the loot players he wants like to see a new piece on the character. See the chat for the plan; nothing of it is built yet.

## Visible equipment, a first test (same branch `step-weapon-glow`, 2026-11-13, not merged)
The user: the hero starts with no gear drawn and shows what is equipped. Generated art cannot be split into one layer per slot, so:
ARMOUR = one sheet per look (the sheet by the body armour worn), WEAPON = its own sprite drawn in the fist.
- The fist: the sheet is generated holding a flat bright green rod. `tools/hand_weapon.py hands <name>` finds the rod in each frame,
  stores the point where it leaves the fist, its angle and length (`assets/hd/hand_points.json` -> frame meta `hand`), and takes the rod
  out (filled from neighbours over the body). Untouched frames: `assets/hd/raw_rod/`.
- The weapon: `tools/hand_weapon.py weapon` cuts a straight weapon out of a generated image, upright, guard at the bottom centre
  (`wpn_sword`, 7x19 HD px, cut from the plate sheet's idle pose). `G.Rig` puts it on the fist, turned to the frame's angle, mirrored
  with the hero; its rarity glow is an additive copy.
- `G.HD.heroEnt(id, equipped)`: `<id>_bare` when no `armor` item is equipped and that sheet exists, else `<id>`;
  `G.HD.heroWeapon`: a weapon sprite when a weapon is equipped and the sheet has hands. `?look=bare|full`, `?wpn=0|1` force them.
Imported: `warrior_bare` (linen shirt, 8 poses, idle 19x46 HD px). So today: a warrior with nothing equipped is in his shirt with
empty hands; a weapon equipped shows a sword in his fist; body armour equipped switches to the plate sheet (sword, shield and
helmet drawn in: no weapon swap on that sheet until a rod version of it exists).
Checked: build, check_i18n, `qa/equip.js` (new: 5 cases, 0 console errors) PASS, the close-ups looked at (standing, walking both ways).
Not checked: equipping real items through the inventory in a run, the city, the attack frames with the weapon, the mage and archer.
Rough: every weapon type draws the sword (the only weapon art); the sword is 2 px wide and turned by the renderer (stair-steps at
some angles); the glow on it is faint; the fist is drawn under the weapon; shield and helmet are not separate.


Armour looks (same branch, 2026-11-13): `warrior_leather`, `warrior_chain`, `warrior_plate` imported (the bare sheet's poses, head and
hands bare, green rod -> fist via tools/hand_weapon.py). `G.HD.heroEnt` picks the body sheet by the body armour's `mat`
(G.ANIM.armorLook; an item with no `mat` counts as plate until step-gear-data lands). Trim: `tools/trim_fx.py NAME STRIP <import opts>`
finds the cyan trim in the full-size source and carries it through the same import -> `trim_<frame>`, drawn tinted by the armour's
rarity (G.ANIM.trimByRarity; ?arar=N previews). The plate sheet came without cyan trim (no trim frames: its rarity shows only as glow).
Checked: `qa/equip.js` 8 cases PASS, close-ups looked at. Rough: the trim is only 4-15 px a frame at this size; helmets and shields
(sheets received, in /home/claude/builds/piezas) need a head point and an off-hand point per frame: not done.
## Gear data for visible equipment (branch `step-gear-data`, on top of `step-weapon-glow`; 2026-11-13, not merged; brief `docs/steps/step-gear-data.md`)
Data and rules only; the art that draws the pieces is another session's work.
### Part 1: the starter weapon
Every new character starts with one common weapon worn and no armour. `BAL.items.starter` (`src/balance.js`): item level 1, common,
`stats: { dmgPct: 4 }` = the weakest roll the generator gives a common weapon of item level 1 (implicit 5 x 0.85, rounded), fixed, no rng.
Type: the class's `defaultWeapon`, else its first `loot.weaponTypes` entry (`G.starterType`). Names (`starter.<type>` keys):
mage "Apprentice Staff" / "Bastón de Aprendiz", warrior "Worn Sword" / "Espada Gastada", archer "Training Bow" / "Arco de Práctica".
- Code: `G.starterType`, `G.starterWeapon`, `G.giveStarter` (`src/sim/items.js`); `G.newGear(clsId)` = a new character with the starter,
  `G.newGear()` = an empty set (tools, the daily kit, the base the migration fills); `G.gearOf` makes new characters. The item carries
  `starter: true` (its name rule); the gear set carries `starter: true` = "decided for this character" (never given twice).
- Save v9 (`src/save.js`, export codes accept v2..v9): a character from an older save with no weapon worn AND no weapon its class can
  use in the kept bag gets the starter on load, with an id above every id it has; every other character is only flagged. A v2 / v3
  save: the class that receives the old gear, same rule. A starter sold or dropped does not come back.
- Decisions (nobody was asked): (1) the archer's starter is "Training Bow" because "Short Bow" is already the name of every common
  bow, and the mage's is "Apprentice Staff" because "Worn Staff" is every common staff; (2) "owns no weapon in the bag" counts only
  weapons the class can equip (a mage holding a warrior's axe as loot still gets the staff), unidentified ones included; (3) the
  tutorial's gift stays, as the first upgrade: it is magic, item level 2 (+6..9 % damage against +4 %); equipping it puts the starter in
  the run's bag and the end of the tutorial banks it into the kept bag (it can be sold); a replay puts the worn weapon back as before;
  (4) the daily challenge keeps its own fixed kit (no starter in it); (5) the Node bot's "no gear" run (`G.botRun` without `gear`,
  `tools/sim_bot.js`, careers) is now a new character, so it wears the starter, like `?fresh=1` in the browser.
- `qa/equip.js`: the `fresh` case now asserts something (it asserted nothing): a fresh warrior shows the bare sheet WITH the weapon
  drawn in the fist, weapon equipped, no armour.
- `tools/check_bag.js`: save version 9 everywhere, new characters count their starter, a `starter` block (19 checks). Two things found
  there that are not from this step: `mod longCracks ... crack cells 12956 -> 12623` FAILS on the untouched branch too (left alone);
  the "changed checksum" test flipped a hex digit to 'A'/'B', which is no change when the digit was 'a' (the decoder lower-cases): it
  now flips to '0'/'1'.
### Part 2: the material of armour pieces
Items of `helmet`, `armor`, `shield`, `gloves`, `boots` carry `mat`: 0 light (leather), 1 medium (chainmail), 2 heavy (plate); `belt` and
`weapon` never do. Table: `BAL.items.material` (`slots`, `ids`, `weights` 1:1:1, `base` = the English base names).
- How it is rolled: NOT from the item's stream. `G.rollMat` seeds a side stream with a hash of the stream's state when `G.makeItem`
  starts (`new G.RNG(G.hash32(rng.s, salt)).weighted(weights)`), so the item stream does not advance: every other roll of every
  existing seed is what it was (0 rolls shifted). Checked: 3000 items with and without materials have the same slots, rarities, stats
  and ids and leave the stream in the same state; the mage's Node bot runs of seeds 1-3 are byte-identical before and after part 2.
  Drops, the tutorial's item, shop stock and the daily kit all go through `G.makeItem`, so all of them have it.
- Cosmetic: no stat difference. THE HOOK: `BAL.items.material.statMult` (per material, all 1) and `statMultBy` (per material and stat,
  empty), read by `G.matStatMult` inside `G.makeItem`. It acts on generation only: existing items keep their stats.
- Names: the base name says the material (`mbase.<slot>.<mat>`; English from the balance table, Spanish in `src/i18n.js`):
  Leather Cap / Chainmail Coif / Plate Helm; Leather Jerkin / Chainmail Hauberk / Plate Cuirass; Leather Buckler / Chainmail Targe /
  Plate Shield; Leather Gloves / Chainmail Mitts / Plate Gauntlets; Leather Boots / Chainmail Boots / Plate Greaves. Spanish: Gorro de
  Cuero / Cofia de Malla / Yelmo de Placas; Jubón / Cota / Coraza; Broquel / Rodela / Escudo; Guantes / Manoplas / Guanteletes; Botas /
  Botas / Grebas. The old bases (Cowl, Robe, Wraps, Treads, Ward) are gone from those five slots; the belt is still a Sash. Longest
  names now: "Stalwart Chainmail Hauberk" (26), "Guanteletes Resonantes de Placas" (32; was 21 / 28): every card wraps the name
  (two lines), nothing is cut. The inventory card has one more line under the type: "Light (leather)" / "Ligero (cuero)", `mat.0..2`,
  `G.itemMat`. The shop, upgrade and Don Montoto cards show it through the name only.
- Old items (worn, kept bag, shop stock; saves and export codes of v2..v8): `G.fillMat` in `G.parseSave` gives each armour piece
  `G.matOfId(id)` (a side stream seeded with the id, same weights), writes it into the item, and renames the stored English name when
  it was the generator's old one ("Keen Cowl" -> "Keen Chainmail Coif"); an invalid `mat` is replaced, one on a belt or weapon removed.
  Same save version as part 1 (v9): the fill does not look at the version, it fills whatever lacks the field.
- For the view: `G.gearLook(equipped)` (`src/sim/items.js`, pure) -> `{ armor, helmet, shield, gloves, boots: 0|1|2|null,
  rarity: { armor, helmet, shield, gloves, boots: rarity|null }, weapon: { wtype, rarity } | null }`; slot list `G.LOOK_SLOTS`. A worn
  piece always has a number (an item without the field gets its id's default; nothing is written). `src/view/hd.js` does not call it yet.
- New: `qa/gear.js` (the inventory at 960x540 and 1640x922, en and es: starter worn, card shows name + material line, texts on screen,
  0 console errors) and the `materials` block of `tools/check_bag.js` (23 checks).
### Part 3: measured, not retuned (2026-11-13)
Node bot, `node tools/sim_bot.js --seeds 1-10 --class <c>` (a new character each run: before = bare hands, after = the starter
weapon, +4 % damage) and one career per class (`--career 10 --seeds 1-10`: 10 runs in a row keeping gear). "Before" = the untouched
`step-weapon-glow`. Minutes = average over all 10 runs. Rooms 1-3 = time to clear the first three rooms / lowest share of HP in them.

| 10 fresh runs | wins | avg min | deaths by room 1..10 | rooms 1-3 |
|---|---|---|---|---|
| mage, before | 5 | 10.4 | 0,0,0,0,0,0,0,2,3,0 | 149 s / 0.89 |
| mage, after | 6 | 10.7 | 0,0,0,0,0,1,0,0,2,1 | 149 s / 0.89 |
| warrior, before | 0 | 7.8 | 0,0,0,0,0,3,2,3,2,0 | 124 s / 0.94 |
| warrior, after | 1 | 8.2 | 0,0,0,0,0,2,2,2,3,0 | 123 s / 0.94 |
| archer, before | 2 | 7.1 | 0,0,0,1,1,2,0,0,4,0 | 131 s / 0.88 |
| archer, after | 3 | 8.5 | 0,0,0,0,1,0,1,2,2,1 | 134 s / 0.82 |

| one career of 10 runs | wins | left | avg min | deaths by room 1..10 | runs (l = left, d = died, w = won, room) |
|---|---|---|---|---|---|
| mage, before | 6 | 3 | 8.0 | 0,0,0,0,0,0,1,0,0,0 | l3 l5 d7 l9 w10 w10 w10 w10 w10 w10 |
| mage, after | 1 | 5 | 8.6 | 0,0,0,0,0,0,0,1,1,2 | l3 l5 l7 l9 w10 l9 d9 d10 d8 d10 |
| warrior, before | 0 | 7 | 7.5 | 0,0,0,0,0,0,0,1,2,0 | l3 l5 l7 d9 l9 d8 l8 d9 l8 l9 |
| warrior, after | 3 | 4 | 8.4 | 0,0,0,0,0,1,0,0,2,0 | l3 l5 d6 l7 w10 d9 d9 l9 w10 w10 |
| archer, before | 3 | 4 | 7.1 | 0,0,0,0,0,0,0,1,2,0 | l3 l5 l7 d9 d8 l9 d9 w10 w10 w10 |
| archer, after | 5 | 4 | 7.5 | 0,0,0,0,0,0,0,1,0,0 | l3 l5 l7 l9 w10 w10 w10 w10 d8 w10 |

In one line: the starter weapon does NOT make the early rooms visibly easier (rooms 1-3 take the same time and cost the same HP;
nobody died before room 5 before or after). Fresh runs go one win up per class and about a room further (8.8 -> 9.0, 6.4 -> 7.0,
6.9 -> 7.9 rooms cleared), which is the size of the noise at 10 seeds. The careers moved both ways (mage 6 -> 1 wins, warrior
0 -> 3, archer 3 -> 5): one career is one chain of 10 dependent runs, and the starter changes the first run, so the whole chain is a
different sample; it says nothing about +4 % damage. Nothing was retuned. Part 2 changes no run (materials do not touch the stream).
Checks of this step (final build): `tools/build.py`; `tools/determinism.js` (500 rooms, every class and build, economy, cage, daily:
identical); `tools/check_i18n.js` all passed (613 keys, both fonts); `tools/check_tutorial.js` all passed; `tools/check_bag.js`: all
pass except `mod longCracks` (fails the same way on the untouched branch); `tools/contrast.js` 0 failing; browser: `qa/gear.js` PASS
(4 cases), `qa/equip.js` PASS, `qa/glow.js` PASS, `qa/daily.js` 32 checks 0 failing, `qa/tutorial.js land_en` 131 of 131
(its "no kept items" check now expects the starter as the one kept item), `qa/bot.js --seeds 3,4,5` (mage, 960x540): 3 runs, 2 wins, 0 console errors, 0 softlocks, 0 mismatches with Node.
Not checked: the in-run inventory card (same code path as the city's), the shop / upgrade / Don Montoto cards with the long names
(they wrap the name the same way; not looked at), `qa/screens.js`, `qa/touch.js`, `qa/session.js`, `qa/city.js`, the tutorial in
Spanish or portrait, a real v8 save from a player's browser (only built ones), Firefox / Safari.
Rough: (1) a fresh mage or archer does not SHOW the starter (only the warrior has a bare sheet with hands; `G.gearLook` is not wired
into `src/view/hd.js`); (2) "Chainmail Targe" / "Rodela de Malla" for a medium shield is a made-up fit of the three materials to a
shield: the user may want other words; (3) materials are the same for every class, so a mage can find and wear plate (as decided;
no class limit exists); (4) item icons do not show the material; (5) the career bot values the starter like any item and may sell it
when it finds a better weapon (as a player would); (6) `BAL.daily` kit items now carry materials, which changes nothing in the run.

Archer imported (2026-11-13, the chosen chibi style, Grok 4x2; idle 46 HD px tall): G.ANIM.ent.archer. The walk row has no bow in hand and cell 8 is a third shot used as hurt. Its armour/hat are drawn in (no visible equipment yet).
## Size tuning panel (branch `step-size-panel`, on top of `step-weapon-glow`; 2026-11-13, not merged; brief `docs/steps/step-size-panel.md`)
A test tool for the user and his brother: six size multipliers, tried while playing, read off as one line, baked into the numbers
of `src/balance.js` in a later step (then set back to 1).
### The values (`BAL.tune`, all 1, range 0.6-1.6, step 0.1; read through `G.tuneOf(B, key)`, clamped, rounded to 0.01)
- `hero`, `monsters` (VISUAL only; the sim's radius and every hit are the same): the HD rig draws the sprite `o.k` times its size
  round the feet, snapped to whole HD px (`src/view/hd.js` R.update: size, motion offsets, held weapon (its height in whole HD px),
  trim and glow follow the sprite, the soft shadow); the chunky path through `G.HD.tuneChunky` (height in whole art px), the chunky
  shadow and the chunky held weapon. `monsters` covers every monster, the boss and the training dummies; `hero` also applies in
  the city. Health bars follow the drawn height.
- `room` (GAME, `G.genRoom`): the room's width and height ranges and the boss room x room (whole tiles); with it the outline's cut
  corners and buttress lengths, the start/exit margin from the side walls, the boss pillars' positions, the centre's crack
  keep-out and the gap between crack centres. The reserved zones (start, chest, super fissure) are NOT scaled (they hold the hero,
  the merchant, the cage, the chest). The test room is a normal room (room 2), so it follows. The tutorial room: only its width
  (its height holds the scripted rows of the wall, crack and pit). Crack COUNT and monster budgets per room are NOT scaled: a
  bigger room has the same monsters, spread thinner (the user judges density).
- `obstacles` (GAME): pillars and wall blocks inside a room: each kind's width and height x obstacles (whole tiles; at least 2, an L
  at least 4 with bars as thick as 2 x obstacles); the boss room's eight pillars. Count: the same range of tries; bigger blocks
  simply fit fewer times (the 2-tile gap and the reserved zones stop them), smaller ones the same number. There are no "pits" in a
  room other than the super fissure's, which is under `fissures`. Buttresses on the walls are outline (under `room`).
- `fissures` (GAME): one value for normal cracks and the super fissure together (decision: one reads better, and the pit's size
  goes with its cracks): arm length range (after a door's crackLen), arm widths (`P.wk` in `G.genFissure`: 7/6 px -> rounded),
  twig lengths, the stub minimum (`minCells`), and the super fissure's pit radius, arm lengths, arm width and keep-out radius. The
  tutorial: the crack's widths, its two short arms and its pit (the two long arms still run from the gate to the wall ends).
- `city` (VIEW): the city camera zoom = S x city, fractional (decision: the CITY table is one hand-placed town with labels, solid
  boxes and walk-time rules, scaling it is unreasonable). At 2.8 (S 2 x 1.4) nearest-neighbour keeps it sharp; the art pixels come
  out a little uneven (2 or 3 screen px), no blur. The follow / centring logic uses the world the camera really shows.
At 1 every number and every rng call is exactly what it was (scaled sizes only replace the old numbers when the value is not 1; the
`ri()` guard only clamps ranges that a tuned size closed up). Same seed + same values = same run: the values live in the balance
object the sim is given.
### The panel (DBG > SIZES; in the city: F2)
One row per value: name, "now" / "next room", [-] value [+]; the line "Hero, monsters: drawn size only, same hitboxes."; the copy
line in green (`hero 1.2 monsters 1.0 room 1.3 city 1.0 obstacles 1.0 fissures 1.0`, English keys in both languages); RESET (back to
1), COPY (to the clipboard when the browser allows it; the line is on screen either way), NEW ROOM (only in the test room: its
restart, so the new room uses the values), BACK (to DBG). The DBG panel got an 8th row (SIZES, green while a value is not 1) and
tighter rows on a screen under 215 art px high (844x390 = 195). Values: `G.Tune` (`src/view/panels.js`) writes `G.BAL.tune` and
`G.cheats.tune`, stores them in localStorage `riftscar.tune` (try/catch: memory only when refused), loaded at boot; `?tune=k:v,...`
sets them for that page without storing. In a run, `hero` / `monsters` apply at once, `room` / `obstacles` / `fissures` from the
next room generated (next room, NEW ROOM, a restart); `city` applies when the city is next shown, at once when changed in the city.
Spanish: TAMAÑOS (PRUEBA), HÉROE, MONSTRUOS, SALA, CIUDAD, OBSTÁCULOS, FISURAS, "ya" / "próx. sala", ORIGINAL, COPIAR, OTRA SALA,
VOLVER. `tools/determinism.js` takes `--tune k:v,...` (both contexts, the size check scales) and `--rooms` (room checks only).
### Checks (final build)
`tools/build.py`; `tools/check_i18n.js` all passed; `tools/check_tutorial.js` all passed; `tools/determinism.js` at defaults: output
identical line for line to the untouched branch (500 rooms, every build, economy, cage, daily); rooms 1-30 x 10 + door modifiers +
tutorial room hashed before/after: same sha1, two Node bot runs same sha1; `tools/determinism.js 10 --tune room:1.3,fissures:1.2`:
0 problems, every run twice identical; `--rooms` sanity (size, crack count, floor share, reach of chest / exit / super fissure /
merchant / cage, cracks off walls and the start) 0 problems at room/obstacles/fissures 0.6, 0.7, 1.3, 1.4, 1.5, 1.6 and mixes
(0.6/1.6/0.6, 1.6/0.6/0.6, 0.6/0.6/0.6, 1.6/1.6/1.6, 0.8/1.3/1.4, 1.1/1.2/0.9); `tools/sim_bot.js --seeds 1-3` identical before/after;
`qa/equip.js` PASS, `qa/glow.js` PASS, `qa/sizes.js` PASS (new: room 52x33 -> 68x43 at 1.3, crack reach over 20 generated rooms
114.9 -> 158.1 px, pit 4410 -> 7241 px, hero drawn 27.5 -> 35.5 px and a skeleton 26.5 -> 34 px with radius 5 both times, city zoom
2 -> 2.8 and F2 > CITY - at once, the panel inside 960x540 / 1640x922 / 844x390 (Spanish), +/-, NEW ROOM, RESET, storage, 0 console
errors); `qa/bot.js --seeds 1-3` 3 wins, 0 console errors, 0 mismatches with Node. Screenshots: `/home/claude/builds/sizes/`.
Problems found and fixed on the way: at room 0.6 the centre's crack keep-out (9 x 7 tiles) left no sites (cracks 1/4): it now
scales with the room, and so does the gap between centres; at room 1.6 the bigger cut corners could close the start into a pocket
(floor share 0): the start margin scales with the room.
Not checked: playing a whole run with tuned values in the browser (only the test room and Node runs), the tutorial room with tuned
values in the browser (Node only: it builds at 0.6-1.6), `qa/screens.js`, `qa/touch.js` (the panel with fingers), `qa/city.js`,
Firefox / Safari, the clipboard in a real browser (headless gives no permission; the line is on screen).
Rough: (1) the room generator at fissures 1.6 takes about 0.2 s a room (0.05-0.15 s at 1): a short pause on a new room; (2) at
room 1.6 a room is 86-93 x 48-51 tiles and the same monster count (thin); at 0.6 it is 32-35 x 18-20 with 3-6 cracks packed in;
(3) the merchant / cage / chest zones keep their size in every room; (4) the city at a fractional zoom has uneven art pixels and
its labels can sit at the screen edge; (5) hero/monster scale also scales the HD sprite's motion offsets but not the dodge hop
height or hit sparks; (6) values stored in localStorage stay on in that browser until RESET (the DBG button turns green as a hint).

Mage base imported (2026-11-13, chibi, blue apprentice robe, green rod -> fist): mage_bare; held staff wpn_staff cut from the first mage sheet (grip 0.46 from the top, G.ANIM.wpnGrip). heroWeapon maps classes without weapon types: mage -> staff, archer -> bow (no bow art yet: falls back to the sword).

Warrior base replaced by the chibi one (2026-11-13). His leather/chain/plate sheets are still the realistic ones: to be redone in the chibi chat.

Batch 2026-11-13 evening: archer_bare (chibi, green shirt, rod as bow; no bow art yet: empty hand) and skill poses for all three (G.ANIM.ent.<cls>_bare.skills, 4 frames each, with fist points; not used by the game yet: needs a skill->pose mapping). wpnArt.any is null: a weapon type with no art draws nothing.

Held weapons by rarity (2026-11-13): tools/weapon_sheet.py cut the six Grok weapon sheets into wpn_<type>_<0..5> (common, magic, rare, legendary, mythic, unique); G.HD.heroWeapon picks by item rarity (G.ANIM.wpnByRarity; epic shows the legendary art) or by the glow preview, grip per type (wpnGripByType). Helmet and shield sheets kept in assets/gear_src/ (not wired: they need head / off-hand points).

Arrows (2026-11-13): arrow_0..5 from the Grok sheet (assets/gear_src/arrows.jpg), the archer HD bolt uses the arrow of the bow rarity index, drawn at 16x3 art px, turned to its flight.

Monsters in the chosen style (2026-11-13): imp, bat, skeleton, hound, cultist, warden and the tyrant (8 poses) imported from Grok sheets; G.ANIM.ent entries; stray specks from row bleed removed. Hound has no hurt pose (its cell came out wrong).

Batch 2026-11-13 night (branch `step-weapon-glow`): the user's new Grok sheets.
- Mage robes, one per armour weight (G.ANIM.armorLook): `mage_leather` = light blue robe, `mage_chain` = reinforced purple robe,
  `mage_plate` = ornate purple battle robe (figures touched: re-spaced with /home/claude/builds/espaciar.py before the import;
  its trim is the blue gems). G.HD.heroEnt picks them by the body armour's `mat` like the warrior's.
- Warrior leather / chain / plate redone in the chibi style (replace the realistic ones), trim found (leather trim is teal:
  tools/trim_fx.py hue window widened to 152-210).
- tools/hand_weapon.py: a frame that still has its rod is a new import and replaces the copy in raw_rod/ (before, a re-import
  got the OLD drawing back).
- Props: chest_closed / chest_open (game.js draws the chest with G.HD.show), the cage (assets/hd/parts/cage_front.png over the
  HD Don Montoto, in hd_atlas.py cage_frames), dummy_0 and the four stalls (city.js `put` swaps stall_* and dummy_* to HD).
- Dungeon floor: the user's big-slab texture (tools/hd_atlas.py floor --from ... --size 512). The old floor: builds/lote2/hd_floor_viejo.png.
Checked: build, qa/equip.js 11 cases PASS (3 new mage cases), screenshots room and city at 960x540 and 540x960, 0 console errors.
Not used: the mage skill-pose rows (robes; the battle robe's skill row came out crimson with a breastplate, not the purple of its
walk sheet) and the sheet with a real staff and a book. Rough: the chest and cage were not seen in a run; Montoto is dark behind
the bars; the floor is a mirrored tile (the mirror can show at a glance).

Town keepers and the merchant (2026-11-13 night, same branch): npc_smith_0..3, npc_trainer_0..3, npc_montoto_0..3 (replaces the
old two frames) and merchant_0..3 imported from the user's Grok sheets (Montoto and merchant re-spaced first: poses touched).
G.ANIM.ent npc_smith / npc_trainer / npc_montoto: slow idle loop + `talk` pose while the hero is in reach (city.js passes
state 'talk' when `this.near` is that stall). The merchant is the one met in the runs (not the town): game.js draws him with
G.HD.show, idle loop / open hand while sim.canTalk(). The cage's Montoto (assets/hd/parts/cage_montoto.png) is the new one.
Checked: build, city at 960x540 and 540x960, a test room with cheatMerchant + cheatCage, 0 console errors.
Not seen: Montoto's stall in the city (needs a save with him rescued), the talk poses on screen.

Portal of the town (2026-11-13 night, same branch; the user's "mejorar el rift", part 1 of 3: portal, fissures, daily board).
city.js `PORTAL` (look numbers) and `updatePortal`: the glow grows and the vortex turns faster as the hero comes near (pk 0..1,
from 24 to 96 px), 36 pooled sparks spiral into the centre; walking in pulls the hero to the foot of the portal over 0.6 s,
shrinking (rig `k`) and spinning (the facing flips faster), a green flash at 0.54 s, then the fade and the run.
Ready for the HD art (prompts given to the user): `portal_arch` (the stone arch, empty opening) and `portal_swirl` (the vortex
on black, drawn ADD and turned by code); with them the old 3-frame portal is hidden. `L.portal.cy` = the vortex centre above
the foot (22 px for the old art; set it to the new arch's opening). Checked: build, a capture sequence far / near / going in,
the run starts, 0 console errors. Rough: the hero arrives already near the portal, so it is always lively.
Portal HD art in (same night): `portal_arch` (Grok arch, 69x50 art px, opening 18 art px wide) and `portal_swirl` (the second
of two Grok vortices, 96 HD px, black kept for ADD, corners faded) turned inside a container stretched to PORTAL.oval [20, 34];
the arch's legs and pillars are solid. Checked: capture sequence, the run starts, 0 console errors.

Fissures as lava (2026-11-13 night, same branch; "mejorar el rift" part 2). View only (src/view/room.js, no sim change):
an open crack is black at its walls, red going in and orange lava in the middle (FissureView.mid = depth / the deepest px
within 3 px, so thin arms get their own middle line), flowing (two layers of a wrapping value-noise table, redrawn every
LAVA.every ticks), yellow streaks; flames (2x4 -> 1 px, rising, yellow -> red) and embers rise from the middle (pooled, cap per
crack); the light is orange. Sealed: black crust, red edge cooling (no yellow, no flames). All numbers in `LAVA`.
Checked: build, room 960x540 and 540x960 close-ups, 0 console errors. Not seen: sealing and the super fissure in the new look.
Fissures at HD density (same night; the user: "es muy pixelado", sent a Grok reference to copy the idea, not the image):
FissureView.buildHD / paintHD (HD art mode only; the old per-px drawing stays for the old art modes). The crack's cells give a
smoothed field sampled at HDF.S = 2 sub px a room px: rocky lip (lumps shaded from the top left, spilling up to 4 sub px past the
crack, darkest px on its outer edge), a red seam where the lip meets the pit, the far wall dripping into wide pits (lit red at
its tips), lava below (the LAVA ramp by depth in the pit, flowing, pulse along the crack, sparkles). Sealed: the pit fills with
dark rock, the seam cools. Particles at 1 HD px. Floor heat: round distance, LINEAR-filtered texture.
Checked: build, room close-ups, 0 console errors. Not checked: frame time on the biggest cracks (each redraw walks every sub px),
the super fissure open in this look, phones.
Bigger cracks (2026-11-14, the user: "más grandes así se ven mejor"). Tried in the sim first (BAL fissures width x1.6, then x1.3,
taper 0.8): node bot 5 seeds went from 4 wins (avg 9 rooms) to 0 (7.2 rooms) and 1 (8 rooms): reverted, the sim is unchanged.
Instead the HD drawing: the whole sim crack is lava pit (outline smoothed by a 3x3 average, every crack px kept inside), the rock lip
is drawn OUTSIDE it on the floor (HDF.lip: 4 sub px solid, lumps to 10), heat radius 8. The far-wall drips now show in most of the
pit. Each crack redraws on its own frame phase (paint ~1-3 ms per crack per redraw, every 3 ticks). Sealed: dark rock, red seam.

Helmets and shields drawn on the hero (2026-11-14; the user equipped a helmet and a shield and saw nothing). tools/gear_points.py:
per hero frame `cap` [head centre x, crown y, head width] (the face of the look's own idle frame matched in each frame; hurt
frames and poor matches use the hair's top rows) and `off` [free hand x, y] (the skin blob below the head that is not the
weapon's fist) -> assets/hd/gear_points.json -> atlas meta. Art: the six Grok helmets and three shields cut from
assets/gear_src (helmets' dark insides made see-through so the face shows; their cyan trim painted dark grey for now: no rarity
tint yet). G.ANIM.helmArt (per class x material), helmFit (top / brim), shieldArt (by material); G.HD.heroHelm / heroShield;
G.Rig draws them through the sprite's origin, scale and tilt (the shield behind the body when the free hand is the back one).
?helm=0|1|2 / ?shield=0|1|2 preview. Lava: more yellow, Bayer-dithered between colours.
Checked: close-ups of 8 class/look/helmet/shield cases standing, walking both ways and attacking, qa/equip.js, 0 console errors.
Rough: the helmet's trim takes no rarity colour; gloves and boots are not drawn; the mage with a shield looks odd (allowed by the loot).

Visible equipment switched OFF (2026-11-14, the user: "quita por ahora el tema de armaduras, sigamos como veníamos antes, deja
nomás la fisura"): G.ANIM.visibleGear = false; G.HD.gearOn() gates heroEnt (each class drawn from its full sheet: warrior,
mage, archer), heroWeapon, trimColor, heroHelm, heroShield. Nothing deleted: ?gear=1 turns it on (qa/equip.js passes it).
The lava fissures, town portal, keepers, stalls, props and floor stay. Checked: the three classes in a room (full sheets,
walk, attack), rooms at 960x540 and 540x960, 0 console errors.
Correction the same night (the user, on the full sheets: "siguen las armaduras y escudos"): with gear off the hero is the BASE
sheet (<cls>_bare: no armour, no shield) with the equipped weapon in the hand, as before the armour looks; armour looks,
trim, helmets and shields stay off (?gear=1 for all). Checked: the three classes standing, walking, attacking, 0 errors.

Class-only weapons (2026-11-14; the user's archer wore a "staff" and showed a bow): the equip rules already refused other
classes' typed weapons; the item was an UNTYPED weapon from a save older than weapon types (any class could wear it; icon
i_weapon = the staff). Now: G.fillWtype (src/sim/items.js) gives such a weapon its owner class's starter type on load
(src/save.js, with fillMat; "...Staff" renamed to the type's base, e.g. "Blazing Yew Longbow"); and G.rollItem picks a weapon
drop's type among the played class's own types only (one draw as before). Checked: 3000 rolls per class (only own types), an
old save with an untyped weapon equipped + one in the bag (both become bows, 0 errors), check_bag (only the known longCracks
failure), node bot 10 seeds: 5 wins / 8.5 rooms (before 6 / 9.0: noise of different drops).
