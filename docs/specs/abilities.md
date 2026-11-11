# Spec: abilities and families (step 5)

Written by the design session (Opus). The implementation session (Sonnet) builds it from this file
without asking questions. Where this spec leaves a choice open, it says so and gives a default.

The data is already in `src/balance.js`: `abilityRules`, `families`, `abilities`, `builds`. The sim does
not read it yet. The old `passives` table and the old level-up still run the game until you switch over.


## Decisions by the user (2026-11-11)

- Replacing an active loses all its ranks (as written below).
- Venom stays archer-only for now. A dagger class (daguero) is planned later and may use it.
- Shared Mending stays in the Blood family.
- Implementation runs in two batches: batch A = rules, offers, slots, families, statuses and the
  mage group; batch B = warrior and archer groups and the remaining mechanics.

## 1. What the player sees

- Each level up (and each ability tome) offers **3 cards**: usually 1 active, 1 passive and 1 of either.
  The player takes one.
- **Actives** change the auto-attack: bolts that burn, split, chain or bounce, swings that whirl, send
  waves or slam the ground, sparks that orbit the hero. There are no new buttons. The class skill (Pulse,
  Shockwave, Volley) and the dodge stay as they are.
- **Passives** are stats: damage, attack speed, HP, armor, crit, burn damage, area and so on.
- Abilities have **ranks** (actives 3, passives 2 to 5). Taking an ability you already have raises its rank.
- **3 active slots.** Taking a new active when all 3 are full replaces one: the player picks which one.
  The replaced active is gone with all its ranks. It can be offered again later, from rank 1.
- Every ability has **one family**. Owning 2 abilities of a family gives its small bonus. Owning 4 gives
  the large bonus as well. Actives in slots and passives at rank 1 or more count, 1 each, whatever the rank.
  Losing an active can drop a family below a threshold, and then the bonus is lost.
- **Class groups**: mage, warrior and archer each have their own 12 actives and 12 passives over 4
  families. A small shared pool (2 actives, 7 passives) is open to every class.

A run has 8 to 10 minutes, 10 rooms and about 18 to 21 picks (the bot reaches level 18 to 22). That is
enough for 3 actives at rank 3 (9 picks), the 4-bonus of one family and the 2-bonus of a second one.
A typical build: 3 actives and 3 passives of the main family (6, so the 4-bonus is safe even after a
replacement), 2 passives of a second family, and the rest in generic stats.

## 2. Class group identities

| group | families | identity |
| --- | --- | --- |
| mage | Fire, Frost, Storm, Arcane | Elemental caster: fast weak bolts that turn into explosions, chains, shards, frost fields and orbiting sparks. Area damage from many small procs. |
| warrior | Steel, Blood, Fire, Storm | Melee bruiser: every swing is already an area attack; actives make it wider (cleave, whirl), longer (thunder wave), sustained (bleed, leech, frenzy) or explosive (eruption, slam, inferno). |
| archer | Venom, Steel, Frost, Storm | Long-range hunter: few strong arrows that pierce; actives add bounces, side arrows, marks, stacking poison, traps and frost fields, and extra shots. |

## 3. Families and bonuses

7 families. `BAL.families`: `name`, `icon` (palette key of the family colour, for icons and pips),
`text` (palette key for the family name on dark UI; check it with `tools/contrast.js`), `t2`, `t4`.
Each tier has `desc`, optional `stats` (same keys as passives) and optional `fx` (same shape as an
active's effects, plain numbers, no ranks). With 4 owned, t2 and t4 both apply.

| family | groups | 2 owned | 4 owned |
| --- | --- | --- | --- |
| Fire | mage, warrior, shared | +20% burn and poison damage (`dotPct` 20) | Pyre: a burning enemy that dies explodes: burst r 28, 60% damage, knock 40, burns (0.3 per s, 3 s) |
| Frost | mage, archer, shared | Chill 20% stronger (`chillPct` 20) | Shatter: +25% damage to chilled enemies (`chilledPct` 25); a chilled enemy that dies bursts: r 26, 40%, chills (0.3, 1.5 s) |
| Storm | all three, shared | +8% attack speed, +5% move speed | Overcharge: every 6th attack also chains lightning to 4 enemies (60%, x0.9 per jump, jump r 70) |
| Arcane | mage, shared | -10% cooldowns (`cdrPct`), +15% area | Arcane Motes: 2 permanent motes orbit the hero (ring 30, spin 3 rad/s, 40% damage, each hits a monster at most every 0.6 s) |
| Steel | warrior, archer, shared | +8 armor, +15% crit damage | Sunder: crits mark the enemy (+20% damage taken, 3 s); +15% damage to elites and the boss |
| Blood | warrior, shared | +30 max HP | Bloodlust: kills heal 1.5% max HP and give a stack of +4% attack speed (max 5 stacks, 4 s) |
| Venom | archer | +15% poison and burn damage, +15% status duration | Plague: a poisoned enemy that dies leaves a toxic cloud: zone r 26, 3 s, 30% per s, poisons |

## 4. Offers: how the cards are rolled

`G.rollAbilities(rng, player, B, pool, tome)` returns up to `abilityRules.cards` (3) distinct ids. `rng` is
`sim.rngLevel` (as today). No other random source.

1. **Pool**: `G.abilityPool(B, clsId)`: the abilities whose `grp` is the class's group (`C.group || C.id`),
   in table order, then the `shared` ones in table order. Leave out abilities whose `only` does not match
   `C.attack.kind`. The order is part of the run: reordering the table changes every seed.
2. **Eligible**: `rank < max`, and rarity 2 only from player level `epicMinLevel` (5) on.
3. **Weight** of an eligible ability = `w`
   x `ownedMult` (1.6) if the player has it (rank >= 1)
   x `familyMult` (1.25) if the player owns at least 1 ability of its family (counting this one)
   x `fullSlotNewMult` (0.4) if it is an active the player does not have and all slots are full
   x `tomeRareMult` (2.5) if this is a tome offer and rarity >= 1.
4. **Draws**, each one `rng.weighted(weights)` over the list, removing the drawn id:
   - card 1 from the eligible actives (skip the draw if there are none),
   - card 2 from the eligible passives (skip if none),
   - then from all eligible ids not drawn yet, until there are 3 cards or nothing is left.
   So a normal offer is active, passive, either. When one kind is empty, the others fill the 3 cards.
5. **No duplicates** in one offer. **Maxed** abilities never come back.
6. **Nothing eligible**: no offer; heal `emptyHeal` (20%) of max HP and use up the level or tome
   (today's behaviour). With 80+ ranks per class pool this should not happen in a normal run.

## 5. Data shape (`src/balance.js`)

```
abilities: {
  <id>: { grp: 'mage'|'warrior'|'archer'|'shared', fam: <family id>, type: 'active'|'passive',
          rarity: 0|1|2, w: <roll weight>, max: <ranks>, name, desc, only?: 'bolt'|'arc',
          stats?: { <stat key>: n | [per rank] },
          fx?: [ { k: <effect kind>, on: <trigger>, chance?, every?, if?, ...fields } ],
          wpn?: { <warrior weapon type>: { <field>: n | [per rank] } } }
}
```

- **Numbers**: a plain number is the same at every rank; an array has `max` entries and entry r-1 is
  the total at rank r (not an increment). Helper: `G.rk(v, rank) = Array.isArray(v) ? v[rank - 1] : v`.
- **Shares** (`dmg`, `dps`, `pct`, `slow`, `chance`, `below`, `fall`) are fractions. `dmg` 0.6 = 60%.
- `wpn` (warrior only): for the equipped weapon type, every field in `wpn[type]` replaces the field of
  the same name in each fx entry that has it, and in `stats`. Resolve it when compiling (section 8).
- **desc** placeholders: `{s.key}` = stat at the rank shown, `{i.key}` = field of `fx[i]`, `{i.key%}` =
  that x 100, rounded. Numbers print as integers when whole, else with one decimal. The card shows the
  values of the rank you would get (rank 1 for a new ability).
- Ids: `mg_`, `wr_`, `ar_`, `sh_` prefixes, `_p_` for passives. They never clash with the old passive ids.
- `builds`: section 11.

### Stat keys

Passives, actives (`stats`) and family tiers (`stats`) all sum into one stat map (`G.abilityStats`).
Old keys keep their meaning in `G.computeStats`: `hp, dmgPct, atkPct, movePct, rangePct, expPct, regen,
crit, pulsePct, pulseCdPct, dodgeCdPct, armor, pierce, multi, leech` (HP per kill), `cdrPct`
(new as a passive source; gear already has it, same cap). New keys and where they apply:

| key | computed stat | used in |
| --- | --- | --- |
| `critDmg` | `s.critMult = C.base.critMult + critDmg / 100` | every crit (replaces `C.base.critMult` in `shootBolts`, `swing`) |
| `dotPct` | `s.dotMult = 1 + dotPct / 100` | dps of burn, poison and bleed at application |
| `chillPct` | `s.chillMult = 1 + chillPct / 100` | chill slow at application (then the `maxSlow` cap) |
| `chilledPct` | `s.chilledMult` | damage taken by chilled monsters (section 7) |
| `durPct` | `s.durMult` | duration of burn, poison, bleed, chill, mark and zones |
| `procPct` | `s.procMult` | every `chance` (capped at 1). Never changes `every` |
| `fxPct` | `s.fxMult` | damage of burst, chain, zone, orbit, wave (not dots, not attack bolts) |
| `areaPct` | `s.areaMult` | radius of burst and zone (not the class skill, not swings) |
| `elitePct` | `s.eliteMult` | damage taken by elites and the boss |
| `lowHpPct` | `s.lowHpMult` | all player damage while the hero is under `lowHp` (50%) of max HP |
| `arcPct` | `s.arcMult` | swing width (cap the arc at 2 pi) |
| `knockPct` | `s.knockMult` | knockback of swings and bursts |

## 6. Triggers, conditions, effect kinds

### Triggers (`on`)

| on | fires | target | base |
| --- | --- | --- | --- |
| `hit` | every monster hit by an attack: main bolt, side and fan bolts, split shards, bounces, echoes, every monster a swing hits | the monster hit | that hit's damage (after crit, before damage-taken modifiers) |
| `crit` | like `hit`, only on crit hits | the monster hit | that hit's damage |
| `strike` | once per attack: the first monster the centre bolt hits (normal or echo attack), or the swing's target | that monster | that hit's damage |
| `attack` | when a normal attack fires (not echoes) | the attack's target (`best`) | `s.dmg` with buffs |
| `kill` | a monster dies from player damage of any source except `kfx` | the dead monster (its position and statuses at death) | `s.dmg` with buffs |
| `always` | permanent (only the Arcane t4 orbit) | - | `s.dmg` with buffs |

What is **not** an attack: the class skill (pulse, volley arrows), the dodge and the warrior's charge hit,
and the damage of effects (burst, chain, zone, orbit, wave, dots). They never fire `hit`, `crit`, `strike`
or `attack`. This rule is what stops loops. Kills by them do fire `kill`, except kills by damage that a
`kill` effect dealt (source `kfx`).

Order on one hit: damage, then the `hit` effects, then the `crit` effects (if crit), then the `strike`
effects (if it is the strike). Within a trigger: slot 0, 1, 2, then family effects in `families` order,
each ability's `fx` in array order. So Frost Arrow (`hit`, chills) runs before Shatter Shot (`strike`,
`if: chilled`) on the same arrow: they combo on purpose.

### Modifiers

- `chance`: one `rngCombat.chance(min(1, chance * s.procMult))` per trigger event per effect. **No roll
  when the field is absent**, so abilities without chances add no rng draws.
- `every: n`: a counter per effect entry (key `<id>/<i>`, family effects `fam:<fam>/<i>`), counting normal
  attacks; it fires on the n-th, then restarts at 0. Only for `on: attack`. The counter resets when the
  ability is replaced, and is kept between rooms.
- `if`: `burning | chilled | poisoned | bleeding | marked`: the target must have that status, else skip.

### Effect kinds (`k`)

All damage from effects goes through `damageMonster` with a source (section 7). `apply` (burst, zone,
wave) applies statuses to every monster the effect damages, after the damage:
`apply: { burn: { dps, t }, chill: { slow, t }, poison: { dps, stacks, t }, bleed: {...}, mark: { pct, t } }`,
with shares of the same base as the parent effect.

| k | fields | what it does | new? |
| --- | --- | --- | --- |
| `dot` | `dot` burn / poison / bleed, `dps`, `t`, `stacks` | Status on the target. dps = `dps x base x s.dotMult`, t x `s.durMult`. **burn**: one instance; a new one keeps the higher dps and the longer t. **poison**, **bleed**: stack up to `stacks`; each new hit adds a stack (until max), keeps the higher per-stack dps and refreshes t. Damage every `dotTick` (0.5 s): dps x 0.5 (x stacks), source `dot`, no crit. | new |
| `chill` | `slow`, `t` | Status: slow = min(`maxSlow`, slow x `s.chillMult`) x (`chillElite` 0.6 on elites, `chillBoss` 0.35 on the boss). Keeps the stronger slow and the longer t. The monster's own movement speed x (1 - slow): walking, weaving, lunges, the boss's chase and charge. Knockback is not slowed. Attack timers are not slowed. | new |
| `mark` | `pct`, `t` | Status: +pct damage taken from all player sources. Keeps the higher pct and the longer t. | new |
| `chain` | `jumps`, `r`, `dmg`, `fall` | Instant lightning. From a `hit`/`strike`/`kill` target (that monster is not hit again) or, for `attack`, from the hero to `best` first. Each jump: the nearest living, emerged monster not yet in this chain, within `r` of the current point and in line of sight (`sim.los`). Jump j (0-based) deals base x dmg x fall^j x `s.fxMult`. Event `chain`. | new |
| `burst` | `at` target / player / random, `r`, `dmg`, `knock`, `apply` | Area hit. Centre: the trigger's target, the hero, or (`random`) a monster picked with `rngCombat.int` from the living, emerged monsters within `s.range` of the hero, in `sim.monsters` order (none: nothing happens). Radius r x `s.areaMult`. Every living monster with `dist - m.r <= R` takes base x dmg x `s.fxMult` and knock x `s.knockMult` away from the centre (negative = pulled in; boss 0, elites x 0.4), then `apply`. Same loop as `castPulse`: factor out `S.areaHit(x, y, R, dmg, knock, src, apply)`. Event `burst`. | generalises the pulse |
| `split` | `n`, `dmg`, `spread`, `life` | Bolts only, `on: strike`. At the hit point, n child bolts in a fan of `spread` rad centred on the bolt's direction (n = 1: straight on), dmg = hitting bolt dmg x share, pierce 0, life in s, speed = class bolt speed. Children count as attack hits (`hit`, `crit`) but never `strike`, never split, never bounce. They skip the monster that was struck. No new child when `sim.bolts.length >= maxBolts` (160). | new (uses bolts) |
| `bounce` | `n`, `r`, `fall` | Bolts only, no trigger: a property of every attack bolt but children. When a bolt hits and would be removed (no pierce left) and has bounces left: turn it toward the nearest living monster not in `b.hit`, within `r` and in sight, same speed, dmg x fall, life >= r / speed + 0.05. Else remove it as today. | new |
| `wave` | `dmg`, `speed`, `range`, `r` | Arc only, `on: attack`. A bolt from the hero toward `best`: life = range / speed, pierce all, base x dmg x `s.fxMult`, knock half the weapon's, source `fx`. Walls stop it. Flag `fxb: true` (no `hit` triggers). View frame `fx_wave` (or the mage bolt frame, tinted with the family colour). | new (uses bolts) |
| `orbit` | `max`, `life`, `ring`, `spin`, `dmg`, `hitEvery`, `perm` | Orbiting bodies, one group per effect key. `on: attack`: add one (if the group has `max`, the oldest gets its life back instead). `perm: n` (`on: always`): n bodies that never expire, made at compile time, kept between rooms. Body j of n in a group sits at angle `a + j x 2 pi / n` on a circle of radius `ring` around the hero; `a += spin x dt` per group. A body touches a monster when their distance < `orbitR` (4) + m.r; it then deals `s.dmg x dmg x s.fxMult` (source `fx`) and cannot hit that monster again for `hitEvery` s. Updated each tick after the player. | new |
| `echo` | `chance`, `delay`, `dmg` | `on: attack`: after `delay` s, attack again (same class attack, a fresh target search like `autoAttack`, nothing if no target) with damage x dmg. An echo does not reset `atkCd`, does not fire `attack` effects or count `every`, cannot echo. Its hits fire `hit`, `crit`, `strike`. | new |
| `zone` | `at` target / player, `r`, `t`, `dps`, `apply` | A lingering circle on the ground (it does not follow anyone): r x `s.areaMult`, t x `s.durMult`, dps = base x dps x `s.fxMult` fixed at creation. Every `dotTick`: each living monster inside takes dps x 0.5 (source `fx`, or `kfx` if the zone came from a `kill` effect), then `apply`. At most `maxZones` (6): the oldest goes. Cleared on room load. Event `zone`. | new |
| `buff` | `stat` atkPct / dmgPct / movePct, `v`, `stacks`, `t` | A stack on the hero (max `stacks`), all stacks refresh to t. Totals: atkPct divides the next `atkCd`; dmgPct multiplies attack and effect base damage; movePct multiplies move speed (the `movePct` cap still applies to gear plus passives only). | new |
| `leech` | `pct` | Heal base x pct, at most `leechCap` (2%) of max HP per attack in total (the budget resets on each attack and each echo). | new |
| `whirl` | `every`, `dmg` | Arc only, `on: attack`, applied **before** the swing: this swing has a 2 pi arc and damage x dmg. | new (swing option) |
| `fan` | `every`, `side`, `dmg` | Bolts only, `on: attack`, **before** the shot: this shot has `side` more bolts on each side, beyond `s.multi`; those bolts deal dmg share (instead of `sideDmg`). | extends `multi` |
| `execute` | `below` | `on: hit`: a non-elite, non-boss monster left at `hp <= below x maxHp` dies (damage = its HP, source `fx`). Event `execute`. | new |
| `heal` | `pct` | Heal pct x max HP. | uses `S.heal` |

Existing mechanics used as they are: `multi` and `pierce` (stat keys, from Arcane Missiles, Split Shot,
Ice Lance, Piercing Arrow), knockback, `leech` per kill, crit, the pulse loop (`burst` reuses it).

**New for the sim**: monster statuses (burn, poison, bleed, chill, mark), chain lightning, ground zones,
orbiting bodies, delayed echo attacks, bolt bounce, split shards, the warrior's wave projectile, whirl
and fan attack options, execute, the hero's stacking buffs, a damage source on every hit.

## 7. Attack kinds and weapons

All proc damage is a share of the hit's damage (or of `s.dmg`), and all counters count attacks. A slow
hard hit and a fast light hit get the same damage per second from an ability, so classes and weapon
types need no special cases beyond `wpn`.

**Bolt (mage, archer)**: `shootBolts(best, ctx)` gets an attack context `ctx = { echo, dmgMul, fanSide,
fanDmg }`. The centre bolt (i = 0) carries `main: true`; every attack bolt carries `atk: true` and
`bounce` (from the compiled bolt mods); split shards carry `child: true`. In `updateProjectiles`, after
`damageMonster` of an `atk` bolt: call `S.onAttackHit(b, m, dmg, crit)`, which runs `hit`, `crit`, then
`strike` if `b.main && !b.struck` (then sets `b.struck`). The volley skill's arrows are not `atk`.

**Arc (warrior)**: `swing(best, ctx)` with `ctx = { echo, dmgMul, arc }`. Width = (ctx.arc or weapon arc)
x `s.arcMult` (max 2 pi). Each monster hit runs `hit` (and `crit`); `best` also runs `strike`.

| weapon | swing | how the actives play |
| --- | --- | --- |
| sword | fast, narrow (2.0 rad) | Most swings, so `every` effects (Whirlwind, Inferno, Thunder Slam) come often; Thunder Wave is faster (`wpn.sword.speed` 260). |
| axe | more damage, 2.2 rad | Neutral: every proc is a share of a bigger hit. |
| mace | slow, huge knockback | Eruption and Thunder Slam knock harder (`wpn.mace.knock`); enemies fly out of melee, so it suits Thunder Wave and Arc Strike. |
| hammer | slowest, widest (2.9 rad), most damage | Whirlwind every 3/3/2 swings (time between whirls stays close to the sword's), Eruption r 40, Thunder Slam r 42-50 and knock 180, wider Thunder Wave (r 8). Wide arcs touch more monsters, so `hit` statuses (Rend, Flame Blade) spread best here. |

Compile `wpn` with `G.weaponOf(C, gear)`; `S.equip`/`unequip` already call `recalc`, which recompiles.

### Damage pipeline

`S.damageMonster(m, dmg, crit, src)`, `src` = `atk | fx | kfx | dot | skill | dash` (default `atk`; give
the pulse/volley `skill`, the charge `dash`). For every player source, before rounding:
dmg x (1 + mark pct) x (`s.chilledMult` if chilled) x (`s.eliteMult` if elite or boss) x (`s.lowHpMult`
if the hero is under `lowHp`). The `hit` event gets `src` so the view can draw dot ticks smaller.
`S.kill(m, src)` fires the `kill` effects when `src !== 'kfx'`.

## 8. Sim interfaces

New file `src/sim/abilities.js` (data helpers, offers, compile) replaces `src/sim/passives.js`; new file
`src/sim/effects.js` (statuses, triggers, effect kinds, orbit and zone updates). Add both to the file lists
in `tools/build.py`, `tools/sim_bot.js` and `tools/determinism.js`, after `sim/core.js` for effects.js.

**State**
- `player.abil = { id: rank }` (actives and passives) replaces `player.passives`.
- `player.slots = [id|null, id|null, id|null]`, `player.every = { key: n }`, `player.buffs = { key: { stat, v, n, t } }`.
- `sim.orbiters = [{ key, life, perm, hit: { monsterId: tick } }]`, `sim.orbitAng = { key: a }`,
  `sim.zones = [{ x, y, r, t, dps, apply, src, fam, acc }]`, `sim.echoes = [{ t, dmg }]`.
- `monster.fx = {}` at spawn; filled with `burn { dps, t }`, `poison { n, dps, t }`, `bleed {...}`,
  `chill { slow, t }`, `mark { pct, t }`; one tick accumulator per monster for dots. Updated in
  `updateMonsters` before the AI (expire at t <= 0); `m.slowMul = 1 - chill.slow` (1 when not chilled).
- Compiled at `recalc`: `sim.fxOn = { hit: [], crit: [], strike: [], attack: [], kill: [] }` (entries
  `{ key, id, fam, f }`, f = the fx with ranks and `wpn` resolved), `sim.boltMods = { bounce }`, perm orbit groups.
- Reset per room: `zones`, `echoes`, non-perm orbiters, `bolts` (as today). Keep `abil`, `slots`,
  `every`, `buffs`, perm orbiters.

**Functions**
- `G.rk(v, rank)`; `G.abilityPool(B, clsId)`; `G.rollAbilities(rng, player, B, pool, tome)` (section 4).
- `G.resolveAbility(B, id, rank, wtype)` -> `{ stats, fx }` with numbers resolved.
- `G.familyCounts(abil, B)` -> `{ fam: n }`; `G.famTier(n, B)` -> 0, 1 (>= 2) or 2 (>= 4).
- `G.abilityStats(abil, B, wtype)` -> summed stats of passives, actives' `stats` and reached family tiers.
  Replaces `G.passiveSums`.
- `G.computeStats(B, gear, abil, cls)`: same signature, third argument is now `player.abil`; adds the
  stats of section 5. `src/view/panels.js` passes `player.abil`.
- `G.abilityInfo(id, B, rank, clsId, wtype)` -> `{ id, name, fam, famName, type, rarity, max, rank, desc }`.
- `G.famInfo(fam, B)` -> `{ name, icon, text, t2, t4 }`.
- `S.openLevelUp(tome)`: rolls with `G.rollAbilities(this.rngLevel, p, B, this.pool, tome)`.
- `S.needsSlot(i)` -> true when card i is an active the player does not have and no slot is free.
- `S.chooseAbility(i, slot)`: false if the state or card is wrong; `'slot'` (and nothing changes) if
  `needsSlot(i)` and `slot` is not 0, 1 or 2; else applies the pick: rank +1, a new active goes into the
  first free slot or replaces `slot` (its rank and `every` counters are deleted), levels-up heal as today,
  `recalc`, events, next pending offer. Returns true.
- `S.choosePassive(i)`: kept as `return this.chooseAbility(i, 0)` for old callers (`view/game.js`
  without HUD). The HUD and the bot call `chooseAbility`.
- `S.cheatAbilities(ids)`: debug: sets the listed abilities to rank 1 (actives into slots), `recalc`.
  The DBG panel gets a button `ABILITIES` that gives the default build's 3 actives, to test the slot picker.

**Events** (only kept when `keepEvents`)
- `{ t: 'ability', id, rank, slot, replaced }` after a pick (`replaced` = the dropped id or null).
- `{ t: 'famTier', fam, tier, prev }` when a family's tier changes (up or down).
- `{ t: 'burst', x, y, r, fam }`, `{ t: 'chain', pts: [x0, y0, x1, y1, ...], fam }`,
  `{ t: 'zone', x, y, r, t, fam }`, `{ t: 'execute', x, y }`, `{ t: 'echo', x, y }`.
- `{ t: 'status', id, s }` only when a status starts on a monster that did not have it (no spam).
- `hit` gains `src`. Orbiters and zones are drawn from `sim.orbiters` / `sim.zones` each frame.

**Determinism**: everything runs in the fixed tick. Random draws only on `rngCombat` (procs, random
targets) and `rngLevel` (offers). Loops go over `sim.monsters` in array order. Use `G.M` for sin, cos,
atan2. Never iterate an object to decide an order that changes the run; use the compiled arrays.

## 9. Level-up screen and HUD

Art space is 480x270 (landscape) or 270x480 (portrait). Cards stay in a row in landscape and a column in
portrait (`hud.js openLevel`), and grow as needed (about 110 px tall in a row).

Each card shows:
1. Family icon `fam_<fam>` and the name (rarity colour, as today).
2. `ACTIVE` or `PASSIVE` and the family name in the family's `text` colour; `NEW` or `Rank 2/3`.
3. The description at the rank you would get.
4. Family progress: the family name with 4 pips, filled up to the count **after** this pick, the 2nd and
   4th pips marked as thresholds. If the pick reaches 2 or 4: the bonus text, in `ui_good`.
5. A new active with full slots: `Replaces a slot` in `ui_warn`.

Below the cards: the 3 active slots (icon, name, rank; empty slots dimmed) and the families the player
has, with pips. Taking a `Replaces a slot` card opens the **slot picker** in the same modal: title
`Replace which active?`, one button per slot (icon, name, rank, family), and on a slot whose loss drops a
family below 2 or 4: `Fire 4 -> 3: loses Pyre` in `ui_bad`. A `BACK` button returns to the cards.
Keys: 1-3 pick a card, then 1-3 pick a slot, Esc goes back. Hit areas `card_<i>`, `slot_<i>`, `slot_back`
(for QA).

HUD in play: the 3 active slots as small icons with rank pips near the skill button (landscape) or above
it (portrait); the character panel lists abilities and reached family bonuses (should; not required for
this step).

Art (`tools/pixelart.py`, palette colours only): 7 family icons `fam_<fam>` (same size as the `p_` icons).
Per-ability icons are a later step. Effects in `src/view/game.js`/`fx.js`: burst = an expanding ring in
the family colour (like the pulse), chain = 1 px lines between points for about 0.12 s, zone = a pulsing
filled circle at low alpha, orbiters = a small glowing dot (the mage `bolt` frame tinted works), wave = a
crescent frame or a tinted bolt, statuses = a tint or a 1 px pip over the monster (chill blue, burn
orange, poison green, bleed red, mark white).

## 10. Moving off the old passives

When the new system works: delete `BAL.passives`, `BAL.tomeRareBoost`, the classes' `passives`,
`passiveNames` and `bot.pick`, and `src/sim/passives.js`. The `p_<id>` icons can stay unused. Update
`docs/classes.md` (`passives` -> ability pool by group, `bot.pick` -> `BAL.builds`). The saves do not hold
passives, so nothing to migrate. All seeds change after the switch; the "before" numbers for this step
are in `docs/STATUS.md`.

## 11. Bot builds

`BAL.builds[cls][buildId] = { name, fams, order }`; the first build of a class is its default.
`new G.Bot(sim, buildId)`; `G.botRun(seed, { cls, build })` and its summary get `build`, plus final
`slots`, `abil` and `fams` (counts) so reports can show whether the build came together.
`tools/sim_bot.js --build <id>`; `qa/bot.js --build <id>` (URL `&build=<id>`).

`Bot.prototype.pickAbility()` -> `{ i, slot }`. Score of a card, with `order` of length L:
- id in `order` at index k: L - k;
- not in `order`: passive 0.5; active with a free slot 0.6; active that needs a slot -1.
Take the highest score; ties go to the lower card index. If the card needs a slot: replace the slotted
active with the lowest score (same rule; ties: the lower slot index). The bot never replaces an active
with a lower-scored one: a listed active is only taken over a slot whose active scores less.

| class | build | aims for | order (most wanted first) |
| --- | --- | --- | --- |
| mage | `pyro` Pyromancer | Fire 4 + Arcane 2 | Ignite, Fireball, Meteor, Inner Fire, Pyromancy, Quick Cast, Wildfire, Mana Shield, Arcane Mind, Vitality, Far Sight |
| mage | `storm` Stormcaller | Storm 4 + Arcane 2 | Chain Lightning, Ball Lightning, Twin Cast, Quick Cast, Static Focus, Inner Fire, Conduction, Mana Shield, Arcane Mind, Vitality, Swiftness |
| mage | `frost` Frostweaver | Frost 4 + Arcane 2 | Frost Bolt, Ice Lance, Blizzard, Deep Cold, Inner Fire, Shatter Point, Ice Armor, Quick Cast, Mana Shield, Arcane Mind, Vitality |
| warrior | `blade` Bladestorm | Steel 4 + Storm 2 | Whirlwind, Cleave, Executioner, Heavy Blows, Quick Strikes, Plate Armour, Giant Slayer, Killer Instinct, Iron Body, Vitality |
| warrior | `blood` Bloodreaver | Blood 4 + Steel 2 | Rend, Frenzy, Blood Drinker, Iron Body, Heavy Blows, Berserker, Second Wind, Plate Armour, Quick Strikes, Vitality |
| warrior | `thunder` Thunder Lord | Storm 4 + Fire 2 | Thunder Wave, Thunder Slam, Arc Strike, Quick Strikes, Heavy Blows, Killer Instinct, Iron Body, Charge Mastery, Blazing Fury, Wildfire, Vitality |
| archer | `plague` Plaguebringer | Venom 4 + Steel 2 | Poison Tips, Toxic Cloud, Plague Arrow, Toxicology, Strong Draw, Lingering Venom, Quick Nock, Hunter's Feast, Deadeye, Vitality |
| archer | `marks` Marksman | Steel 4 + Storm 2 | Ricochet, Split Shot, Hunter's Mark, Strong Draw, Quick Nock, Deadeye, Piercing Arrow, Eagle Eye, Vitality, Winter Coat |
| archer | `winter` Winter Hunter | Frost 4 + Storm 2 | Frost Arrow, Shatter Shot, Frost Trap, Frostbite, Strong Draw, Cold Precision, Winter Coat, Quick Nock, Eagle Eye, Vitality |

The epic actives (Meteor, Ball Lightning, Blizzard, Frenzy, Executioner, Inferno, Thunder Slam, Plague
Arrow, Split Shot, Frost Trap, Thunder Arrow, Singularity) only appear from level 5; until then the bot
fills the slot with what the build lists next or with any active (0.6), and replaces it later.

## 12. The ability table

The numbers below are generated from `src/balance.js`; the table there is the source of truth.
Rarity: C common, R rare, E epic. In "numbers", `a / b / c` = rank 1 / 2 / 3; shares are fractions.
`{x}` in the text = the value of field x at the shown rank.

#### mage actives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `mg_ignite` | Ignite | fire | C | 10 | 3 | Bolts set enemies on fire: {dps}% of the hit per second for {t} s | **dot** on hit, dot burn, dps 0.3 / 0.45 / 0.6, t 3 |
| `mg_fireball` | Fireball | fire | R | 6 | 3 | The first enemy a bolt hits explodes: {dmg}% in radius {r} | **burst** on strike, at target, r 22 / 26 / 30, dmg 0.5 / 0.65 / 0.8, knock 40 |
| `mg_meteor` | Meteor | fire | E | 3 | 3 | Every {every} attacks a meteor hits a random enemy in range: {dmg}%, burns | **burst** on attack, every 5 / 5 / 4, at random, r 34, dmg 1.5 / 2 / 2.5, knock 60, apply {burn dps 0.3, t 3} |
| `mg_frostbolt` | Frost Bolt | frost | C | 10 | 3 | Bolts chill: {slow}% slower for {t} s. +{dmgPct}% damage | `dmgPct` 5 / 10 / 15<br>**chill** on hit, slow 0.25 / 0.32 / 0.4, t 1.5 |
| `mg_icelance` | Ice Lance | frost | R | 6 | 3 | Bolts pierce +{pierce}; +{chilledPct}% damage to chilled enemies | `pierce` 1 / 1 / 2<br>`chilledPct` 15 / 25 / 35 |
| `mg_blizzard` | Blizzard | frost | E | 3 | 3 | {chance}% chance: a blizzard on the target, {dps}% per second for {t} s, chills | **zone** on strike, chance 0.25 / 0.3 / 0.35, at target, r 30 / 34 / 38, t 3, dps 0.4 / 0.55 / 0.7, apply {chill slow 0.3, t 1} |
| `mg_chain` | Chain Lightning | storm | C | 10 | 3 | Bolts arc to {jumps} more enemies: {dmg}%, less per jump | **chain** on strike, jumps 2 / 3 / 4, r 60, dmg 0.6 / 0.7 / 0.8, fall 0.85 |
| `mg_twin` | Twin Cast | storm | R | 6 | 3 | {chance}% chance to cast again at once ({dmg}% damage) | **echo** on attack, chance 0.2 / 0.3 / 0.4, delay 0.12, dmg 0.8 |
| `mg_ball` | Ball Lightning | storm | E | 3 | 3 | Each attack adds an orbiting spark (max {max}, {life} s): {dmg}% on touch | **orbit** on attack, max 2 / 3 / 4, life 4, ring 22, spin 4, dmg 0.35 / 0.4 / 0.45, hitEvery 0.5 |
| `mg_fracture` | Fracture | arcane | C | 10 | 3 | Bolts shatter on the first enemy into {n} shards ({dmg}% each) | **split** on strike, n 2 / 3 / 4, dmg 0.4 / 0.45 / 0.5, spread 1.2, life 0.35 |
| `mg_missiles` | Arcane Missiles | arcane | R | 6 | 3 | +{multi} side bolt on each side | `multi` 1 / 1 / 2<br>`dmgPct` 0 / 5 / 5 |
| `mg_singularity` | Singularity | arcane | E | 3 | 3 | Every {every} attacks the target collapses: pulls enemies in, {dmg}%, marks them | **burst** on attack, every 6 / 5 / 5, at target, r 40 / 44 / 48, dmg 0.8 / 1 / 1.2, knock -120, apply {mark pct 0.15, t 3} |

#### mage passives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `mg_p_fire` | Inner Fire | fire | C | 10 | 5 | +{dmgPct}% damage | `dmgPct` 10 / 20 / 30 / 40 / 50 |
| `mg_p_pyro` | Pyromancy | fire | R | 6 | 3 | +{dotPct}% burn and poison damage | `dotPct` 20 / 40 / 60 |
| `mg_p_wild` | Wildfire | fire | R | 5 | 3 | +{areaPct}% area of explosions and zones | `areaPct` 12 / 24 / 36 |
| `mg_p_cold` | Deep Cold | frost | C | 8 | 3 | Chill {chillPct}% stronger | `chillPct` 15 / 30 / 45 |
| `mg_p_icearmor` | Ice Armor | frost | C | 8 | 3 | +{armor} armor | `armor` 6 / 12 / 18 |
| `mg_p_shatter` | Shatter Point | frost | R | 5 | 3 | +{critDmg}% crit damage | `critDmg` 15 / 30 / 45 |
| `mg_p_haste` | Quick Cast | storm | C | 10 | 5 | +{atkPct}% attack speed | `atkPct` 8 / 16 / 24 / 32 / 40 |
| `mg_p_conduct` | Conduction | storm | R | 5 | 3 | +{procPct}% chance of ability effects | `procPct` 15 / 30 / 45 |
| `mg_p_static` | Static Focus | storm | R | 6 | 4 | +{crit}% crit chance | `crit` 4 / 8 / 12 / 16 |
| `mg_p_reach` | Far Sight | arcane | C | 7 | 3 | +{rangePct}% range | `rangePct` 8 / 16 / 24 |
| `mg_p_mind` | Arcane Mind | arcane | R | 6 | 3 | +{fxPct}% ability effect damage | `fxPct` 12 / 24 / 36 |
| `mg_p_shield` | Mana Shield | arcane | C | 8 | 4 | +{hp} max HP | `hp` 15 / 30 / 45 / 60 |

#### warrior actives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `wr_cleave` | Cleave | steel | C | 10 | 3 | Swings {arcPct}% wider, +{knockPct}% knockback (only arc) | `arcPct` 20 / 35 / 50<br>`knockPct` 10 / 20 / 30 |
| `wr_whirl` | Whirlwind | steel | R | 6 | 3 | Every {every} swings is a full circle at {dmg}% damage (only arc) | **whirl** on attack, every 4 / 4 / 3, dmg 1.2 / 1.4 / 1.6<br>_hammer_: every 3 / 3 / 2 |
| `wr_execute` | Executioner | steel | E | 3 | 3 | Hits kill normal enemies left under {below}% HP. +{elitePct}% vs elites | `elitePct` 5 / 10 / 15<br>**execute** on hit, below 0.12 / 0.16 / 0.2 |
| `wr_rend` | Rend | blood | C | 10 | 3 | Hits bleed: {dps}% of the hit per second, stacks {stacks}x, {t} s | **dot** on hit, dot bleed, dps 0.2 / 0.25 / 0.3, stacks 3, t 3 |
| `wr_drain` | Blood Drinker | blood | R | 6 | 3 | Heal {pct}% of damage dealt by swings. +{hp} max HP | `hp` 10 / 20 / 30<br>**leech** on hit, pct 0.04 / 0.06 / 0.08 |
| `wr_frenzy` | Frenzy | blood | E | 3 | 3 | Kills give +{v}% attack speed for {t} s (stacks {stacks}x) | **buff** on kill, stat atkPct, v 6 / 8 / 10, stacks 5, t 4 |
| `wr_flame` | Flame Blade | fire | C | 10 | 3 | Hits burn: {dps}% of the hit per second for {t} s | **dot** on hit, dot burn, dps 0.35 / 0.5 / 0.65, t 3 |
| `wr_eruption` | Eruption | fire | R | 6 | 3 | {chance}% chance: the ground under the target erupts, {dmg}%, burns | **burst** on strike, chance 0.25 / 0.3 / 0.35, at target, r 30, dmg 0.7 / 0.9 / 1.1, knock 50, apply {burn dps 0.3, t 3}<br>_hammer_: r 40<br>_mace_: knock 120 |
| `wr_inferno` | Inferno | fire | E | 3 | 3 | Every {every} swings, the ground around you burns: {dps}% per second, {t} s | **zone** on attack, every 5, at player, r 36 / 40 / 44, t 3, dps 0.5 / 0.65 / 0.8, apply {burn dps 0.2, t 2} |
| `wr_wave` | Thunder Wave | storm | C | 10 | 3 | Swings send a wave forward through enemies: {dmg}%, {range} px (only arc) | **wave** on attack, dmg 0.4 / 0.55 / 0.7, speed 220, range 90 / 100 / 110, r 5<br>_sword_: speed 260<br>_hammer_: r 8 |
| `wr_arc` | Arc Strike | storm | R | 6 | 3 | Swings arc lightning to {jumps} more enemies: {dmg}% | **chain** on strike, jumps 2 / 3 / 3, r 50, dmg 0.5 / 0.6 / 0.75, fall 0.85 |
| `wr_slam` | Thunder Slam | storm | E | 3 | 3 | Every {every} swings, thunder around you: {dmg}% in radius {r}, knocks back | **burst** on attack, every 3, at player, r 34 / 38 / 42, dmg 0.6 / 0.75 / 0.9, knock 120<br>_mace_: knock 180<br>_hammer_: r 42 / 46 / 50, knock 180 |

#### warrior passives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `wr_p_heavy` | Heavy Blows | steel | C | 10 | 5 | +{dmgPct}% damage | `dmgPct` 10 / 20 / 30 / 40 / 50 |
| `wr_p_plate` | Plate Armour | steel | C | 8 | 3 | +{armor} armor | `armor` 8 / 16 / 24 |
| `wr_p_giant` | Giant Slayer | steel | R | 5 | 3 | +{elitePct}% damage to elites and bosses | `elitePct` 12 / 24 / 36 |
| `wr_p_iron` | Iron Body | blood | C | 9 | 4 | +{hp} max HP | `hp` 25 / 50 / 75 / 100 |
| `wr_p_berserk` | Berserker | blood | R | 5 | 3 | +{lowHpPct}% damage while under half HP | `lowHpPct` 20 / 35 / 50 |
| `wr_p_wind` | Second Wind | blood | R | 5 | 3 | +{regen} HP per second | `regen` 0.8 / 1.6 / 2.4 |
| `wr_p_smolder` | Smoldering Steel | fire | R | 6 | 3 | +{dotPct}% burn and bleed damage | `dotPct` 20 / 40 / 60 |
| `wr_p_wild` | Wildfire | fire | C | 6 | 3 | +{areaPct}% area of explosions and zones | `areaPct` 12 / 24 / 36 |
| `wr_p_fury` | Blazing Fury | fire | R | 5 | 3 | +{fxPct}% ability effect damage | `fxPct` 12 / 24 / 36 |
| `wr_p_quick` | Quick Strikes | storm | C | 10 | 5 | +{atkPct}% attack speed | `atkPct` 8 / 16 / 24 / 32 / 40 |
| `wr_p_charge` | Charge Mastery | storm | C | 7 | 3 | -{dodgeCdPct}% charge cooldown | `dodgeCdPct` 15 / 30 / 45 |
| `wr_p_crit` | Killer Instinct | storm | R | 6 | 4 | +{crit}% crit chance | `crit` 4 / 8 / 12 / 16 |

#### archer actives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `ar_poison` | Poison Tips | venom | C | 10 | 3 | Arrows poison: {dps}% of the hit per second per stack, {stacks} stacks, {t} s | **dot** on hit, dot poison, dps 0.12 / 0.16 / 0.2, stacks 4, t 4 |
| `ar_cloud` | Toxic Cloud | venom | R | 6 | 3 | {chance}% chance: a toxic cloud on the target, {dps}% per second, poisons | **zone** on strike, chance 0.3 / 0.35 / 0.4, at target, r 28, t 4, dps 0.3 / 0.4 / 0.5, apply {poison dps 0.1, stacks 4, t 3} |
| `ar_plague` | Plague Arrow | venom | E | 3 | 3 | Kills burst into poison: {dmg}% in radius {r}, poisons | **burst** on kill, at target, r 36, dmg 0.4 / 0.55 / 0.7, knock 0, apply {poison dps 0.12, stacks 4, t 4} |
| `ar_ricochet` | Ricochet | steel | C | 10 | 3 | Arrows bounce to {n} more enemies ({fall}% damage each bounce) (only bolt) | **bounce** n 1 / 2 / 3, r 70, fall 0.8 |
| `ar_mark` | Hunter's Mark | steel | R | 6 | 3 | The first enemy hit is marked: +{pct}% damage taken for {t} s | **mark** on strike, pct 0.12 / 0.18 / 0.24, t 4 |
| `ar_split` | Split Shot | steel | E | 3 | 3 | +{multi} side arrow on each side (only bolt) | `multi` 1 / 1 / 2<br>`dmgPct` 0 / 5 / 5 |
| `ar_frost` | Frost Arrow | frost | C | 10 | 3 | Arrows chill: {slow}% slower for {t} s. +{dmgPct}% damage | `dmgPct` 5 / 10 / 15<br>**chill** on hit, slow 0.25 / 0.32 / 0.4, t 1.5 |
| `ar_shatter` | Shatter Shot | frost | R | 6 | 3 | A chilled target shatters: {dmg}% in radius {r}, chills | **burst** on strike, if chilled, at target, r 26, dmg 0.6 / 0.8 / 1, knock 30, apply {chill slow 0.3, t 1.5} |
| `ar_trap` | Frost Trap | frost | E | 3 | 3 | Every {every} shots, a frost field at the target: {dps}% per second, chills | **zone** on attack, every 6 / 5 / 4, at target, r 32, t 4, dps 0.25 / 0.35 / 0.45, apply {chill slow 0.4, t 1} |
| `ar_double` | Double Nock | storm | C | 10 | 3 | {chance}% chance to shoot again at once ({dmg}% damage) | **echo** on attack, chance 0.25 / 0.35 / 0.45, delay 0.1, dmg 0.8 |
| `ar_fan` | Fan of Arrows | storm | R | 6 | 3 | Every {every} shots, +{side} arrows on each side ({dmg}%) (only bolt) | **fan** on attack, every 4 / 4 / 3, side 2 / 2 / 3, dmg 0.6 / 0.7 / 0.8 |
| `ar_thunder` | Thunder Arrow | storm | E | 3 | 3 | Every {every} shots, lightning strikes a random enemy in range: {dmg}% | **burst** on attack, every 3, at random, r 20, dmg 1.2 / 1.5 / 1.8, knock 30 |

#### archer passives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `ar_p_tox` | Toxicology | venom | C | 8 | 3 | +{dotPct}% poison and burn damage | `dotPct` 20 / 40 / 60 |
| `ar_p_linger` | Lingering Venom | venom | R | 6 | 3 | +{durPct}% status and zone duration | `durPct` 20 / 40 / 60 |
| `ar_p_feast` | Hunter's Feast | venom | R | 5 | 3 | Heal {leech} HP per kill | `leech` 1 / 2 / 3 |
| `ar_p_draw` | Strong Draw | steel | C | 10 | 5 | +{dmgPct}% damage | `dmgPct` 10 / 20 / 30 / 40 / 50 |
| `ar_p_deadeye` | Deadeye | steel | C | 7 | 4 | +{crit}% crit chance | `crit` 4 / 8 / 12 / 16 |
| `ar_p_pierce` | Piercing Arrow | steel | E | 3 | 2 | Arrows pierce +{pierce} enemy | `pierce` 1 / 2 |
| `ar_p_coat` | Winter Coat | frost | C | 8 | 3 | +{armor} armor | `armor` 6 / 12 / 18 |
| `ar_p_precise` | Cold Precision | frost | R | 5 | 3 | +{critDmg}% crit damage | `critDmg` 15 / 30 / 45 |
| `ar_p_bite` | Frostbite | frost | R | 6 | 3 | Chill {chillPct}% stronger | `chillPct` 15 / 30 / 45 |
| `ar_p_quick` | Quick Nock | storm | C | 10 | 5 | +{atkPct}% attack speed | `atkPct` 8 / 16 / 24 / 32 / 40 |
| `ar_p_eagle` | Eagle Eye | storm | C | 7 | 3 | +{rangePct}% range | `rangePct` 8 / 16 / 24 |
| `ar_p_tail` | Tailwind | storm | R | 5 | 3 | +{procPct}% chance of ability effects | `procPct` 15 / 30 / 45 |

#### shared actives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `sh_kindle` | Kindle | fire | C | 5 | 3 | {chance}% chance per hit to burn: {dps}% of the hit per second, {t} s | **dot** on hit, chance 0.35, dot burn, dps 0.3 / 0.4 / 0.5, t 3 |
| `sh_chill` | Chilling Touch | frost | C | 5 | 3 | {chance}% chance per hit to chill: {slow}% slower for {t} s | **chill** on hit, chance 0.5, slow 0.2 / 0.25 / 0.3, t 1.2 |

#### shared passives

| id | name | family | rar | w | max | what it does | numbers (per rank) |
|---|---|---|---|---|---|---|---|
| `sh_vigor` | Vitality | blood | C | 9 | 5 | +{hp} max HP | `hp` 18 / 36 / 54 / 72 / 90 |
| `sh_mend` | Mending | blood | R | 5 | 3 | +{regen} HP per second | `regen` 0.6 / 1.2 / 1.8 |
| `sh_ward` | Warding | steel | C | 6 | 3 | +{armor} armor | `armor` 6 / 12 / 18 |
| `sh_swift` | Swiftness | storm | C | 7 | 3 | +{movePct}% move speed | `movePct` 7 / 14 / 21 |
| `sh_reflex` | Reflexes | storm | R | 4 | 3 | -{dodgeCdPct}% dodge cooldown | `dodgeCdPct` 15 / 30 / 45 |
| `sh_wisdom` | Wisdom | arcane | C | 6 | 3 | +{expPct}% EXP gain | `expPct` 15 / 30 / 45 |
| `sh_focus` | Focus | arcane | R | 4 | 3 | +{pulsePct}% skill damage, -{pulseCdPct}% skill cooldown | `pulsePct` 30 / 60 / 90<br>`pulseCdPct` 15 / 30 / 45 |

## 13. Tuning

Numbers are a first pass, sized against today's passives (power was +12% per rank, haste +10%; a run
takes about 18-21 picks). Expected value of an active at rank 3: +35-60% damage in its situation (single
target for dots and marks, packs for bursts, chains and zones). If a build misses the acceptance bar,
tune in this order, within +-50% of the written numbers, and write the changes in `docs/STATUS.md`:
the build's actives' `dmg`/`dps`, then `every`/`chance`, then weights. Do not change `cards`, `slots`,
`famTiers` or the trigger rules without asking the user. Keep `exp` and monster numbers as they are.

## 14. Acceptance checklist (implementation session)

Test budget (from `CLAUDE.md` and the step brief, it replaces the 200 seeds of the old plan): the
determinism check, at most 10 seeds per Node bot run, 3 browser seeds once at the end, 2 screenshots.
Never 100, 200 or 400 seeds.

- [ ] `python3 tools/build.py` succeeds; `node tools/contrast.js` passes with the family text colours.
- [ ] `node tools/determinism.js` passes. Extend its bot check so it also plays `--class warrior --build
      blade` and `--class archer --build plague` seed 3 twice (identical).
- [ ] The old passive code and tables are gone (section 10); `grep -rn "passives\b\|rollPassives\|passiveSums" src tools` finds nothing
      that still runs.
- [ ] Node bot, one run of seeds 1-10 per class and build (9 runs):
      `node tools/sim_bot.js --class <c> --build <b> --seeds 1-10`. Pass: 0 softlocks, 0 timeouts;
      every build at least 2 wins of 10; per class the best build at least 3 wins (today's default:
      3 for each class). Report wins, win seeds, average seconds of the wins (design target 480-600 s;
      report it, it does not gate), average level, and in how many runs the build's first family reached
      4 (target at least 6 of 10). Retuning reruns use the same 10 seeds.
- [ ] Browser: `node qa/bot.js` once at the end, 3 seeds: mage seed 3, warrior seed 4, archer seed 5
      (default builds). 0 console errors, 0 softlocks, results match Node.
- [ ] 2 screenshots: the level-up cards with a `Replaces a slot` card at 960x540, and the slot picker at
      540x960 (DBG `ABILITIES`, then `LEVEL UP`). Look at both: text inside the cards, pips visible,
      nothing off screen.
- [ ] `docs/STATUS.md`: what was tested, the numbers per build, what is still rough. `docs/classes.md` updated.
- [ ] One commit, English message; `python3 tools/check_secrets.py` before it.


## Implementation notes (batch A)

Batch A = rules, offers, slots, families, statuses, the mage group and the shared pool. Choices made where the
spec was open (simplest reading):

- **Switch**: a class has the new system when its entry has `abilitySystem: true` (the mage only). The warrior and
  archer still run `passives` / `rollPassives` / `passiveSums` and play exactly as before (their `sim_bot --seeds 1-10
  --json` is identical before and after). `G.computeStats` takes `player.abil` as its third argument for a class
  with the flag, `player.passives` otherwise. `choosePassive(i)` is `chooseAbility(i, 0)` for the new system.
  The old tables and files go in batch B.
- **Effects implemented**: `dot` (burn, poison, bleed), `chill`, `mark`, `chain`, `burst`, `split`, `echo`, `orbit`
  (attack and permanent), `zone`, `heal`; all triggers (`hit`, `crit`, `strike`, `attack`, `kill`, `always`), `if`,
  `every`, `chance`, and every stat key of section 5 (`lowHpPct`, `arcPct`, `knockPct`, `elitePct`... are computed;
  the ones only the warrior and archer use are not exercised yet). **Not implemented (batch B)**: `bounce`, `wave`,
  `whirl`, `fan`, `buff`, `leech`, `execute`; they are ignored if present. Warrior swings do not fire `hit` / `strike`
  yet; `swing` only uses `s.critMult`.
- `castPulse` was not factored into `S.areaHit` (a second loop was written), so the pulse and the warrior's numbers
  cannot change. The two can be merged in batch B.
- `familyMult` applies when the player owns at least one ability of the family, the offered one included.
- `attack` effects run right after the shot or swing (not before); `every` counters count normal attacks only.
- `chain` from the hero (`on: attack`, Storm Overcharge): the attack's target is the first hit, then the nearest
  unhit monsters; `jumps` counts all enemies hit. From a hit, strike or kill target: `jumps` enemies beyond the target.
- `burst` `apply` and `zone` `apply`: `dps` shares use the parent effect's base (the triggering hit, or `s.dmg`).
  A zone made by a `kill` effect deals `kfx` damage (its kills do not fire `kill` effects again).
- Dots tick together: one `dot` hit per monster per `dotTick` with the sum of burn, poison and bleed.
- Status events: a monster tint (chill blue, burn orange, poison green, bleed red, mark white) is drawn instead of pips.
- The `echo` bolt attack emits `echo`, not `cast`. An echo of an arc class would call `swing` (unused until batch B).
- Bot (`Bot.pickAbility`): an owned active that is not in the build's order scores 0.5 (like a passive). When every
  card is a new active that would replace a better one, the bot takes the highest-scored card anyway (a pick is
  mandatory) and replaces its lowest slot. The browser bot takes the build from `?build=<id>`.
- Level-up screen: cards show family icon, name (rarity colour), `ACTIVE` / `PASSIVE`, the family in its colour,
  `NEW` or `Rank r/max`, the description at the rank you would get, 4 pips (filled after this pick; 2nd and 4th
  outlined as thresholds), the bonus text in green when the pick reaches 2 or 4, and `Replaces a slot`. Below: the
  3 slots and the owned families with pips. A new active with full slots opens the slot picker (`Replace which
  active?`, `slot_0..2`, `slot_back`, keys 1-3 and Esc); a slot whose loss drops a family tier (net of the new
  active's own family) shows `Fire 4 -> 3: loses Pyre` in red. The in-play HUD shows the 3 slots bottom centre
  (not by the skill button, which exists on touch only). The character panel does not list abilities yet.
- Debug panel: `ABILITIES` gives the default build's 3 actives. Family icons `fam_<id>` are in `tools/pixelart.py`.
- Tuning (batch A, Storm build was 0 of 10): `mg_chain` radius 60 -> 90 and damage x1.5; `mg_twin` chance x1.5 and
  damage 0.8 -> 1.0 (both within the +-50% allowed). Other numbers are as written.


## Implementation notes (batch B)

Batch B = the warrior and archer groups, the remaining kinds, the switch of all three classes, removing the old passives.
Choices made where the spec was open (simplest reading):

- **Switch**: every class uses the ability system, so the `abilitySystem` flag, `useAbil`, `src/sim/passives.js`, `BAL.passives`,
  `BAL.tomeRareBoost`, the classes' `passives`, `passiveNames` and `bot.pick`, `G.passiveInfo` / `rollPassives` / `passiveSums`,
  `Bot.pickPassive` and the old level-up card code are deleted. `S.choosePassive(i)` stays as `chooseAbility(i, 0)`.
- **`whirl` and `fan`** are not in the `attack` list: `S.preAttack()` runs them before the attack (their `every` counters count normal
  attacks) and returns the context for `swing` / `shootBolts`. A whirl swing is a full circle (`s.arcMult` does not widen it further);
  fan extra bolts are those beyond `s.multi` and use the fan's `dmg` share instead of `sideDmg`.
- **`bounce`** is compiled into `sim.boltMods.bounce` (the one with the highest `n`); `shootBolts` copies `n` into each attack bolt.
  The bolt turns only when it has no pierce left; split children and fan bolts of the volley skill never bounce (children have no field,
  the volley is not an attack bolt).
- **`wave`** is a bolt with `fxb` and `wave` flags, source `fx`, pierce 9999, no hit triggers. Drawn as the mage `bolt` frame in gold.
- **`leech`**: budget `leechCap` x max HP, reset at the start of every swing and every bolt volley of an attack (and echo); one budget
  per attack, not per monster.
- **`execute`**: the monster dies by a `fx` hit for its remaining HP (so `kill` effects fire); elites and the boss are never executed.
- **`buff`**: stacks per effect key on `player.buffs`; `atkPct` divides the next `atkCd`, `dmgPct` multiplies attack damage and the
  base of `attack`, `kill` and orbit effects (`S.baseDmg()`), `movePct` multiplies move speed. A replaced active drops its buffs.
  Buff time ignores `durPct`.
- **Swings** now fire `hit` / `crit` for every monster hit and `strike` for `best` (the swing's target); `knockPct` applies to swings.
- `castPulse` is still its own loop (not merged with `areaHit`), so the Shockwave numbers are unchanged.
- **Character panel**: the equipment panel (opened with I or the bag button) has an `ABILITIES` button (only during a run) that opens
  a page listing the 3 active slots (family icon, name, rank pips, description at the current rank and weapon type), the passives with
  rank, and the families with 4 pips and their reached bonus. Per-ability icons were not made: family icons are used everywhere.
  Hit names for QA: `inv_abil`, `abil_back`, `abil_close`.
- **Tuning** (10 seeds, `--build`): see `docs/STATUS.md` for the numbers. Changed: Rend dps 0.2/0.25/0.3 -> 0.14/0.17/0.2,
  Blood Drinker pct 0.04/0.06/0.08 -> 0.015/0.02/0.03, Frenzy v 6/8/10 -> 3/4/5, Iron Body hp 25..100 -> 15/30/45/60, Second Wind
  regen 0.8/1.6/2.4 -> 0.5/1/1.5 (Bloodreaver was 6-7 of 10); Poison Tips dps x1.5, Toxic Cloud dps x1.3 (Plaguebringer 1 of 10);
  Ricochet n 1/2/3 -> 2/3/4, r 100, fall 1.0, Hunter's Mark pct 0.25/0.35/0.5, and Split Shot is now rare (w 6) instead of epic w 3,
  because the Marksman got 0 of 10 and the 3-arrow volley is what makes it work. Some of these are beyond the +-50% of section 13.
