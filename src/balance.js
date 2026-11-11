// The one balance file. Every tunable number lives here; the sim reads nothing else.
// Units: art pixels (1 tile = 16 px), seconds, HP. Per-room arrays have one entry per room (10).
(function (G) {
  G.BAL = {
    TILE: 16,
    DT: 1 / 60,

    run: {
      rooms: 10,                      // the last room is the boss room
      tierMult: [1.0, 1.5, 2.1],      // monster hp/dmg multiplier per difficulty tier
      tierGear: [0, 70, 170],         // gear score needed to unlock each tier
      roomMult: [1.05, 1.3, 1.55, 1.8, 2.1, 2.4, 2.75, 3.1, 3.5, 3.0],   // monster hp/dmg multiplier per room
      gearK: 0.005,                   // +0.5 % monster hp/dmg per point of gear score ("gear level scales the room")
      ilvlTier: 3, ilvlRooms: 3,      // item level = 1 + tier * ilvlTier + floor(room / ilvlRooms)
      testRoom: 1                     // ?room=test / TEST ROOM button: this room, restarted on every clear
    },

    // shared by every class (class numbers live in `classes` below)
    player: {
      hurtIframes: 0.3, pickupR: 36, levelHeal: 0.03,
      blockedEvery: 0.4               // s between two 'blocked' events while the hero pushes into an open crack
    },

    // Character classes as data. How to add one: docs/classes.md.
    //   base:   radius, hp, move speed, damage, s per attack, attack range (bolt reach or swing reach), crit.
    //   attack: kind 'bolt' (projectile: speed, r, sideDmg per extra bolt, spread rad between bolts,
    //           life = range / speed * life, knock / knockElite on hit) or 'arc' (melee swing: arc = full
    //           width in rad, knock / knockElite; extra bolts and pierce do nothing for it).
    //   dodge:  dist px, time s, iframes s, cd s (optional knock px and hit = share of dmg: shoves what the dodge touches).   skill: the active button (kind 'pulse' only, for now).
    //   sprite: atlas frame prefix (<frames>_0..2), glow and dash tints (palette keys), attack frame.
    //   passives: the level-up pool, in roll order (the order is part of the run: changing it changes runs).
    //   bot: QA bot hints. keep: multiplier on its keep-away distances; pick: passive preference.
    classes: {
      mage: {
        name: 'Mage',
        base: { r: 5, hp: 100, speed: 78, dmg: 10, atkInterval: 0.5, range: 112, crit: 0.05, critMult: 1.8 },
        attack: { kind: 'bolt', firstCd: 0.4, speed: 250, r: 3, sideDmg: 0.6, spread: 0.22, life: 1.2, knock: 34, knockElite: 14, frame: 'bolt', glow: 'orb' },
        dodge: { dist: 54, time: 0.16, iframes: 0.34, cd: 1.6 },
        skill: { kind: 'pulse', name: 'Pulse', dmg: 26, radius: 54, cd: 7, knock: 200 },
        sprite: { frames: 'mage', glow: 'mb2', dash: 'mb3' },
        passives: ['power', 'haste', 'vital', 'swift', 'range', 'wisdom', 'regen', 'crit', 'pulse', 'blink', 'ward', 'pierce', 'multi', 'leech'],
        bot: { keep: 1, pick: { multi: 12, power: 10, haste: 10, pierce: 9, vital: 7, crit: 7, ward: 6, regen: 6, leech: 6, swift: 5, pulse: 4, range: 4, blink: 3, wisdom: 3 } }
      },
      warrior: {
        name: 'Warrior',
        base: { r: 6, hp: 250, speed: 74, dmg: 32, atkInterval: 0.55, range: 30, crit: 0.05, critMult: 2 },
        attack: { kind: 'arc', firstCd: 0.3, arc: 2.2, knock: 60, knockElite: 22 },
        // weapon types: the weapon item's `wtype` picks one (none equipped: defaultWeapon). dmg and atk
        // (attack interval) multiply the stats, reach adds px to the swing, arc is the full width in rad.
        // The attack fields above are only the fallback. weaponForce: QA override (every weapon counts as this type).
        defaultWeapon: 'sword',
        weapons: {
          sword:  { name: 'Sword',  item: 'Iron Sword',   dmg: 1.0,  atk: 0.85, reach: 0,  arc: 2.0, knock: 50,  knockElite: 18 },
          axe:    { name: 'Axe',    item: 'Iron Axe',     dmg: 1.45, atk: 1.25, reach: -2, arc: 2.2, knock: 60,  knockElite: 22 },
          mace:   { name: 'Mace',   item: 'Old Mace',     dmg: 1.2,  atk: 1.4,  reach: -1, arc: 1.8, knock: 150, knockElite: 60 },
          hammer: { name: 'Hammer', item: 'Heavy Hammer', dmg: 1.9,  atk: 1.85, reach: 2,  arc: 2.9, knock: 190, knockElite: 80 }
        },
        // the charge: crosses cracks like the mage's hop, shoves what it runs into (knock px, hit = share of dmg)
        dodge: { dist: 58, time: 0.17, iframes: 0.3, cd: 1.9, knock: 150, hit: 0.5 },
        skill: { kind: 'pulse', name: 'Shockwave', dmg: 30, radius: 46, cd: 8, knock: 230 },
        sprite: { frames: 'warrior', glow: 'em2', dash: 'iron3', fx: ['em4', 'em3', 'em2'], slash: 'iron3' },
        passives: ['power', 'haste', 'vital', 'swift', 'wisdom', 'regen', 'crit', 'pulse', 'blink', 'ward', 'leech', 'range'],
        passiveNames: { power: 'Heavy Blows', haste: 'Quick Strikes', blink: 'Charge Mastery', pulse: 'Shockwave Mastery', range: 'Long Reach', ward: 'Plate Armour', crit: 'Killer Instinct', leech: 'Bloodthirst' },
        bot: { keep: 0.8, pick: { power: 10, haste: 10, vital: 9, ward: 8, crit: 7, regen: 7, leech: 7, swift: 6, blink: 6, pulse: 5, range: 5, wisdom: 3 } }
      },
      archer: {
        name: 'Archer',
        // longer reach than the mage, slower shots, arrows pierce 1 enemy at base (base.pierce)
        base: { r: 5, hp: 90, speed: 76, dmg: 20, atkInterval: 0.8, range: 150, crit: 0.1, critMult: 2, pierce: 1 },
        attack: { kind: 'bolt', firstCd: 0.5, speed: 330, r: 2.5, sideDmg: 0.6, spread: 0.18, life: 1.2, knock: 16, knockElite: 6, frame: 'arrow', glow: 'rg2', rotate: true },
        dodge: { dist: 52, time: 0.16, iframes: 0.32, cd: 1.5 },
        // Volley: a ring of `count` arrows (each `pierce` enemies, dmg = skill dmg incl. pulse passives) flying `range` px
        skill: { kind: 'volley', name: 'Volley', dmg: 14, count: 14, pierce: 1, range: 120, speed: 260, cd: 7, knock: 40 },
        sprite: { frames: 'archer', glow: 'rg1', dash: 'rg3', fx: ['rg4', 'rg3', 'rg2'] },
        passives: ['power', 'haste', 'crit', 'vital', 'swift', 'range', 'wisdom', 'regen', 'pulse', 'blink', 'ward', 'pierce', 'multi', 'leech'],
        passiveNames: { power: 'Strong Draw', haste: 'Quick Nock', vital: 'Hardy', swift: 'Fleet Foot', range: 'Eagle Eye', crit: 'Deadeye', pulse: 'Volley Mastery', blink: 'Roll Mastery',
          ward: 'Leather Guard', pierce: 'Piercing Arrow', multi: 'Twin Arrow', leech: 'Hunter\'s Feast', regen: 'Forest Mending', wisdom: 'Lore of the Wild' },
        bot: { keep: 1.2, pick: { pierce: 12, multi: 11, power: 10, haste: 10, crit: 8, vital: 7, ward: 6, regen: 6, leech: 6, swift: 5, pulse: 4, range: 4, blink: 3, wisdom: 3 } }
      }
    },
    defaultClass: 'mage',

    exp: { base: 9, grow: 5, pow: 1.22 },   // exp to next = base + grow * (level-1)^pow

    // ai: chase | weave | ranged | lunge | elite | boss. threat: fissure spawn budget cost. exp: orb value.
    monsters: {
      imp:      { ai: 'chase', r: 5, hp: 18, speed: 84, dmg: 9, exp: 2, threat: 1, shadow: 's' },
      bat:      { ai: 'weave', r: 4.5, hp: 10, speed: 104, dmg: 6, exp: 2, threat: 1, shadow: 's', weave: 0.9, fly: 5 },
      skeleton: { ai: 'ranged', r: 5, hp: 26, speed: 36, dmg: 5, exp: 4, threat: 2, shadow: 's',
                  shotDmg: 10, shotSpeed: 100, shotEvery: 2.0, windup: 0.45, keepMin: 62, keepMax: 100, sight: 140 },
      hound:    { ai: 'lunge', r: 7, hp: 80, speed: 38, dmg: 16, exp: 8, threat: 3, shadow: 'm',
                  lungeRange: 54, lungeWindup: 0.5, lungeSpeed: 180, lungeTime: 0.34, lungeCd: 2.6 },
      warden:   { ai: 'elite', r: 9, hp: 260, speed: 34, dmg: 12, exp: 26, threat: 8, shadow: 'm', elite: true,
                  shotDmg: 11, shotSpeed: 100, shotEvery: 2.3, windup: 0.5, spread: 0.3, keepMin: 46, keepMax: 86,
                  summonEvery: 7, summon: 2, summonType: 'imp' },
      tyrant:   { ai: 'boss', r: 14, hp: 1200, speed: 32, dmg: 14, exp: 120, threat: 40, shadow: 'l', boss: true,
                  chaseTime: 2.4, enrageAt: 0.4, enrageRate: 0.7,
                  slamRadius: 56, slamWindup: 0.95, slamDmg: 22,
                  burstShots: 12, burstDmg: 9, burstSpeed: 70, burstGap: 0.55,
                  summon: 3,
                  chargeWindup: 0.75, chargeSpeed: 180, chargeTime: 0.6, chargeDmg: 18 }
    },
    contactCd: 0.6,

    fissure: {
      count:  [2, 3, 3, 3, 4, 4, 4, 4, 5, 2],             // normal fissures per room
      budget: [5, 6, 7, 8, 9, 10, 11, 12, 13, 9],         // threat points per normal fissure
      pool: [                                             // spawn weights, by room
        { imp: 8, bat: 3 },
        { imp: 6, bat: 3, skeleton: 2 },
        { imp: 6, bat: 3, skeleton: 3, hound: 1 },
        { imp: 5, bat: 3, skeleton: 3, hound: 2 },
        { imp: 5, bat: 3, skeleton: 3, hound: 3 },
        { imp: 5, bat: 3, skeleton: 3, hound: 3 },
        { imp: 4, bat: 3, skeleton: 4, hound: 3 },
        { imp: 4, bat: 3, skeleton: 4, hound: 4 },
        { imp: 4, bat: 3, skeleton: 4, hound: 4 },
        { imp: 6, bat: 3, skeleton: 3, hound: 1 }
      ],
      superWave: [
        ['warden', 'imp', 'imp', 'imp'],
        ['warden', 'imp', 'imp', 'bat', 'bat', 'skeleton'],
        ['warden', 'hound', 'imp', 'imp', 'skeleton', 'skeleton'],
        ['warden', 'hound', 'hound', 'bat', 'bat', 'bat', 'imp', 'imp'],
        ['warden', 'warden', 'imp', 'imp', 'imp', 'skeleton'],
        ['warden', 'warden', 'hound', 'hound', 'bat', 'bat'],
        ['warden', 'warden', 'hound', 'skeleton', 'skeleton', 'imp', 'imp', 'imp'],
        ['warden', 'warden', 'hound', 'hound', 'hound', 'skeleton', 'skeleton'],
        ['warden', 'warden', 'warden', 'hound', 'hound', 'bat', 'bat', 'bat', 'bat'],
        ['tyrant']
      ],
      // the crack network: all cracks open when the room starts and go dark segment by segment as
      // their monsters die. An open crack is a wall for walkers; the player crosses it with the dodge.
      crackLen: [90, 130],            // px per arm (two arms per crack; a branch has one)
      segments: 4,                    // dark bands per crack, the tips go dark first
      joinChance: 0.45,               // chance that a crack branches off an earlier one (joined = shared kill meter)
      siteGap: 8,                     // min tiles (manhattan) between separate crack centres
      segHeal: 0.01,                  // heal (fraction of max HP) each time a segment goes dark
      aliveThreat: 1.4,               // monsters alive from the network at once: up to this x one crack's budget
      firstDelay: 1.2,
      openTime: 1.0, closeTime: 1.0, superOpenTime: 1.8, superCloseTime: 1.6,
      spawnEvery: 0.3, superSpawnEvery: 0.5,       // packs come out in a burst
      closeExp: 5, closeHeal: 0.03, superHeal: 0.08
    },

    loot: {
      // chance that a kill / closure drops gear
      killGear: 0.02, eliteGear: 0.3, closeGear: 0.2, superGear: 0.6,
      superTome: 0.3, killTome: 0.003, healOrb: 0.035, healOrbPct: 0.06,
      chestItems: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      // rarity weights: common, magic, rare, epic, legendary
      rarity: [62, 26, 9, 2.5, 0.5],
      // rarity "luck" by source: shifts weight toward the right
      luck: { kill: 0, close: 0.2, elite: 0.4, super: 0.6, chest: 0.8, boss: 1.2 },
      bagSize: 20,
      // weapon drops: any monster, chest or crack can drop any type, equal weight (one rng draw). `cls` = the only class that
      // can equip it (others keep it in the bag as loot). item: base name; itemRare (rarity >= 2): name instead. worn: 'Worn ' prefix when common.
      weaponTypes: [
        { id: 'staff',  cls: 'mage',    item: 'Staff', worn: true },
        { id: 'sword',  cls: 'warrior', item: 'Iron Sword' },
        { id: 'axe',    cls: 'warrior', item: 'Iron Axe' },
        { id: 'mace',   cls: 'warrior', item: 'Old Mace' },
        { id: 'hammer', cls: 'warrior', item: 'Heavy Hammer' },
        { id: 'bow',    cls: 'archer',  item: 'Short Bow', itemRare: 'Yew Longbow' }
      ]
    },

    items: {
      rarityMult: [1, 1.25, 1.55, 1.9, 2.4],
      ilvlGrow: 0.2,                  // +20 % stat value per item level above 1
      // base value of each stat at ilvl 1, common
      stat: { hp: 9, dmgPct: 5, atkPct: 4, movePct: 3, armor: 4, crit: 2, rangePct: 4, pulsePct: 9, cdrPct: 4, regen: 0.3, expPct: 6 },
      implicit: { helmet: 'hp', armor: 'armor', gloves: 'atkPct', boots: 'movePct', belt: 'hp', weapon: 'dmgPct', shield: 'armor' },
      // how much one "base unit" of each stat is worth to the bot / item score
      weight: { hp: 1, dmgPct: 1.3, atkPct: 1.2, movePct: 0.9, armor: 1, crit: 0.9, rangePct: 0.6, pulsePct: 0.5, cdrPct: 0.6, regen: 0.9, expPct: 0.5 },
      cap: { movePct: 30, cdrPct: 45, crit: 60 }
    },

    // max: max level. w: roll weight. rarity 0 common, 1 rare, 2 epic.
    passives: {
      power:  { rarity: 0, max: 5, w: 10, dmgPct: 12 },
      haste:  { rarity: 0, max: 5, w: 10, atkPct: 10 },
      vital:  { rarity: 0, max: 5, w: 9, hp: 18 },
      swift:  { rarity: 0, max: 3, w: 7, movePct: 7 },
      range:  { rarity: 0, max: 3, w: 6, rangePct: 10 },
      wisdom: { rarity: 0, max: 3, w: 6, expPct: 15 },
      regen:  { rarity: 1, max: 3, w: 5, regen: 0.6 },
      crit:   { rarity: 1, max: 4, w: 5, crit: 7 },
      pulse:  { rarity: 1, max: 3, w: 4, pulsePct: 30, pulseCdPct: 15 },
      blink:  { rarity: 1, max: 3, w: 4, dodgeCdPct: 15 },
      ward:   { rarity: 1, max: 3, w: 5, armor: 8 },
      pierce: { rarity: 2, max: 2, w: 2, pierce: 1 },
      multi:  { rarity: 2, max: 2, w: 2, multi: 1 },
      leech:  { rarity: 2, max: 2, w: 2, leech: 1.5 }
    },
    tomeRareBoost: 2.5,               // ability tomes weight rare/epic passives higher

    // ---------------------------------------------------------------- abilities (step 5)
    // The ability system: docs/specs/abilities.md. NOT READ BY THE SIM YET: the old `passives` table above
    // stays in use until the implementation session switches over and then removes it.
    // Numbers: a plain number is the same at every rank; an array has one value per rank (length = max),
    // the value is the total at that rank (not an increment). Shares (dmg, dps, pct, slow) are fractions.
    // Damage shares are of `base`: the triggering hit's damage for on: hit / strike / crit, else the
    // player's current damage (stats.dmg with buffs). Stat keys: see the spec, section "Stat keys".
    abilityRules: {
      slots: 3,                       // active slots; a 4th active replaces one the player picks
      cards: 3,                       // cards per offer: 1 active, 1 passive, 1 of either (see the spec)
      epicMinLevel: 5,                // rarity 2 is not offered before this player level
      ownedMult: 1.6,                 // roll weight x this for an ability the player already has (not maxed)
      familyMult: 1.25,               // roll weight x this when the player owns >= 1 ability of its family
      fullSlotNewMult: 0.4,           // roll weight x this for a new active while all slots are full
      tomeRareMult: 2.5,              // ability tome: rarity >= 1 weight x this
      famTiers: [2, 4],               // owned abilities of one family for its small (t2) and large (t4) bonus
      emptyHeal: 0.2,                 // nothing left to offer: heal this share of max HP instead
      dotTick: 0.5,                   // s between two damage ticks of burn / poison / bleed / zones
      chillElite: 0.6, chillBoss: 0.35, maxSlow: 0.7,   // chill strength on elites / the boss, cap on slow
      leechCap: 0.02,                 // life on hit: at most this share of max HP healed per attack
      maxZones: 6, maxBolts: 160,     // caps: lingering zones alive (oldest goes), player bolts alive (new child bolts dropped)
      lowHp: 0.5,                     // lowHpPct applies while the hero is under this share of max HP
      orbitR: 4                       // radius of one orbiting body (px)
    },

    // one family tag per ability; t2 / t4: bonus with 2 / 4 owned abilities of the family (t4 adds to t2).
    // icon: palette key of the family colour (icons, pips); text: palette key for its name on dark UI.
    families: {
      fire:   { name: 'Fire',   icon: 'em2',   text: 'em3',
                t2: { desc: '+20% burn and poison damage', stats: { dotPct: 20 } },
                t4: { desc: 'Pyre: burning enemies explode on death (60% damage, burns)',
                      fx: [{ k: 'burst', on: 'kill', if: 'burning', at: 'target', r: 28, dmg: 0.6, knock: 40, apply: { burn: { dps: 0.3, t: 3 } } }] } },
      frost:  { name: 'Frost',  icon: 'orb',   text: 'orb',
                t2: { desc: 'Chill 20% stronger', stats: { chillPct: 20 } },
                t4: { desc: 'Shatter: +25% damage to chilled enemies; they burst into frost on death',
                      stats: { chilledPct: 25 },
                      fx: [{ k: 'burst', on: 'kill', if: 'chilled', at: 'target', r: 26, dmg: 0.4, knock: 0, apply: { chill: { slow: 0.3, t: 1.5 } } }] } },
      storm:  { name: 'Storm',  icon: 'gold',  text: 'gold',
                t2: { desc: '+8% attack speed, +5% move speed', stats: { atkPct: 8, movePct: 5 } },
                t4: { desc: 'Overcharge: every 6th attack also throws lightning at 4 enemies (60%)',
                      fx: [{ k: 'chain', on: 'attack', every: 6, jumps: 4, r: 70, dmg: 0.6, fall: 0.9 }] } },
      arcane: { name: 'Arcane', icon: 'tome1', text: 'r_epic',
                t2: { desc: '-10% cooldowns, +15% area', stats: { cdrPct: 10, areaPct: 15 } },
                t4: { desc: 'Arcane Motes: 2 motes orbit you (40% damage)',
                      fx: [{ k: 'orbit', on: 'always', perm: 2, ring: 30, spin: 3, dmg: 0.4, hitEvery: 0.6 }] } },
      steel:  { name: 'Steel',  icon: 'iron2', text: 'iron3',
                t2: { desc: '+8 armor, +15% crit damage', stats: { armor: 8, critDmg: 15 } },
                t4: { desc: 'Sunder: crits mark the enemy (+20% damage taken, 3 s); +15% vs elites',
                      stats: { elitePct: 15 },
                      fx: [{ k: 'mark', on: 'crit', pct: 0.2, t: 3 }] } },
      blood:  { name: 'Blood',  icon: 'blood', text: 'ui_bad',
                t2: { desc: '+30 max HP', stats: { hp: 30 } },
                t4: { desc: 'Bloodlust: kills heal 1.5% HP and give +4% attack speed (5 stacks, 4 s)',
                      fx: [{ k: 'heal', on: 'kill', pct: 0.015 }, { k: 'buff', on: 'kill', stat: 'atkPct', v: 4, stacks: 5, t: 4 }] } },
      venom:  { name: 'Venom',  icon: 'rg2',   text: 'rg3',
                t2: { desc: '+15% poison and burn damage, +15% status duration', stats: { dotPct: 15, durPct: 15 } },
                t4: { desc: 'Plague: poisoned enemies leave a toxic cloud on death',
                      fx: [{ k: 'zone', on: 'kill', if: 'poisoned', at: 'target', r: 26, t: 3, dps: 0.3, apply: { poison: { dps: 0.1, stacks: 4, t: 3 } } }] } }
    },

    // The ability table, in roll order (the order is part of the run). grp: the class group (a class's
    // pool = its group's abilities in table order, then 'shared'). type: active | passive.
    // rarity 0 common, 1 rare, 2 epic. w: roll weight. max: ranks. only: 'bolt' | 'arc' (attack kinds it fits).
    // desc: {s.key} = stat at the shown rank, {i.key} = field of fx[i], {i.key%} = that x 100.
    // fx: the active's effects (see the spec, "Effect kinds"). wpn: per warrior weapon type, fields that
    // replace the same fields in every fx entry (and in stats) of the ability.
    abilities: {
      // ===== MAGE: elemental caster. Fire, Frost, Storm, Arcane =====
      mg_ignite:   { grp: 'mage', fam: 'fire', type: 'active', rarity: 0, w: 10, max: 3, name: 'Ignite',
                     desc: 'Bolts set enemies on fire: {0.dps%}% of the hit per second for {0.t} s',
                     fx: [{ k: 'dot', on: 'hit', dot: 'burn', dps: [0.3, 0.45, 0.6], t: 3 }] },
      mg_fireball: { grp: 'mage', fam: 'fire', type: 'active', rarity: 1, w: 6, max: 3, name: 'Fireball',
                     desc: 'The first enemy a bolt hits explodes: {0.dmg%}% in radius {0.r}',
                     fx: [{ k: 'burst', on: 'strike', at: 'target', r: [22, 26, 30], dmg: [0.5, 0.65, 0.8], knock: 40 }] },
      mg_meteor:   { grp: 'mage', fam: 'fire', type: 'active', rarity: 2, w: 3, max: 3, name: 'Meteor',
                     desc: 'Every {0.every} attacks a meteor hits a random enemy in range: {0.dmg%}%, burns',
                     fx: [{ k: 'burst', on: 'attack', every: [5, 5, 4], at: 'random', r: 34, dmg: [1.5, 2.0, 2.5], knock: 60, apply: { burn: { dps: 0.3, t: 3 } } }] },
      mg_frostbolt: { grp: 'mage', fam: 'frost', type: 'active', rarity: 0, w: 10, max: 3, name: 'Frost Bolt',
                     desc: 'Bolts chill: {0.slow%}% slower for {0.t} s. +{s.dmgPct}% damage',
                     stats: { dmgPct: [5, 10, 15] },
                     fx: [{ k: 'chill', on: 'hit', slow: [0.25, 0.32, 0.4], t: 1.5 }] },
      mg_icelance: { grp: 'mage', fam: 'frost', type: 'active', rarity: 1, w: 6, max: 3, name: 'Ice Lance',
                     desc: 'Bolts pierce +{s.pierce}; +{s.chilledPct}% damage to chilled enemies',
                     stats: { pierce: [1, 1, 2], chilledPct: [15, 25, 35] } },
      mg_blizzard: { grp: 'mage', fam: 'frost', type: 'active', rarity: 2, w: 3, max: 3, name: 'Blizzard',
                     desc: '{0.chance%}% chance: a blizzard on the target, {0.dps%}% per second for {0.t} s, chills',
                     fx: [{ k: 'zone', on: 'strike', chance: [0.25, 0.3, 0.35], at: 'target', r: [30, 34, 38], t: 3, dps: [0.4, 0.55, 0.7], apply: { chill: { slow: 0.3, t: 1 } } }] },
      mg_chain:    { grp: 'mage', fam: 'storm', type: 'active', rarity: 0, w: 10, max: 3, name: 'Chain Lightning',
                     desc: 'Bolts arc to {0.jumps} more enemies: {0.dmg%}%, less per jump',
                     fx: [{ k: 'chain', on: 'strike', jumps: [2, 3, 4], r: 60, dmg: [0.6, 0.7, 0.8], fall: 0.85 }] },
      mg_twin:     { grp: 'mage', fam: 'storm', type: 'active', rarity: 1, w: 6, max: 3, name: 'Twin Cast',
                     desc: '{0.chance%}% chance to cast again at once ({0.dmg%}% damage)',
                     fx: [{ k: 'echo', on: 'attack', chance: [0.2, 0.3, 0.4], delay: 0.12, dmg: 0.8 }] },
      mg_ball:     { grp: 'mage', fam: 'storm', type: 'active', rarity: 2, w: 3, max: 3, name: 'Ball Lightning',
                     desc: 'Each attack adds an orbiting spark (max {0.max}, {0.life} s): {0.dmg%}% on touch',
                     fx: [{ k: 'orbit', on: 'attack', max: [2, 3, 4], life: 4, ring: 22, spin: 4, dmg: [0.35, 0.4, 0.45], hitEvery: 0.5 }] },
      mg_fracture: { grp: 'mage', fam: 'arcane', type: 'active', rarity: 0, w: 10, max: 3, name: 'Fracture',
                     desc: 'Bolts shatter on the first enemy into {0.n} shards ({0.dmg%}% each)',
                     fx: [{ k: 'split', on: 'strike', n: [2, 3, 4], dmg: [0.4, 0.45, 0.5], spread: 1.2, life: 0.35 }] },
      mg_missiles: { grp: 'mage', fam: 'arcane', type: 'active', rarity: 1, w: 6, max: 3, name: 'Arcane Missiles',
                     desc: '+{s.multi} side bolt on each side',
                     stats: { multi: [1, 1, 2], dmgPct: [0, 5, 5] } },
      mg_singularity: { grp: 'mage', fam: 'arcane', type: 'active', rarity: 2, w: 3, max: 3, name: 'Singularity',
                     desc: 'Every {0.every} attacks the target collapses: pulls enemies in, {0.dmg%}%, marks them',
                     fx: [{ k: 'burst', on: 'attack', every: [6, 5, 5], at: 'target', r: [40, 44, 48], dmg: [0.8, 1.0, 1.2], knock: -120, apply: { mark: { pct: 0.15, t: 3 } } }] },
      mg_p_fire:   { grp: 'mage', fam: 'fire', type: 'passive', rarity: 0, w: 10, max: 5, name: 'Inner Fire', desc: '+{s.dmgPct}% damage', stats: { dmgPct: [10, 20, 30, 40, 50] } },
      mg_p_pyro:   { grp: 'mage', fam: 'fire', type: 'passive', rarity: 1, w: 6, max: 3, name: 'Pyromancy', desc: '+{s.dotPct}% burn and poison damage', stats: { dotPct: [20, 40, 60] } },
      mg_p_wild:   { grp: 'mage', fam: 'fire', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Wildfire', desc: '+{s.areaPct}% area of explosions and zones', stats: { areaPct: [12, 24, 36] } },
      mg_p_cold:   { grp: 'mage', fam: 'frost', type: 'passive', rarity: 0, w: 8, max: 3, name: 'Deep Cold', desc: 'Chill {s.chillPct}% stronger', stats: { chillPct: [15, 30, 45] } },
      mg_p_icearmor: { grp: 'mage', fam: 'frost', type: 'passive', rarity: 0, w: 8, max: 3, name: 'Ice Armor', desc: '+{s.armor} armor', stats: { armor: [6, 12, 18] } },
      mg_p_shatter: { grp: 'mage', fam: 'frost', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Shatter Point', desc: '+{s.critDmg}% crit damage', stats: { critDmg: [15, 30, 45] } },
      mg_p_haste:  { grp: 'mage', fam: 'storm', type: 'passive', rarity: 0, w: 10, max: 5, name: 'Quick Cast', desc: '+{s.atkPct}% attack speed', stats: { atkPct: [8, 16, 24, 32, 40] } },
      mg_p_conduct: { grp: 'mage', fam: 'storm', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Conduction', desc: '+{s.procPct}% chance of ability effects', stats: { procPct: [15, 30, 45] } },
      mg_p_static: { grp: 'mage', fam: 'storm', type: 'passive', rarity: 1, w: 6, max: 4, name: 'Static Focus', desc: '+{s.crit}% crit chance', stats: { crit: [4, 8, 12, 16] } },
      mg_p_reach:  { grp: 'mage', fam: 'arcane', type: 'passive', rarity: 0, w: 7, max: 3, name: 'Far Sight', desc: '+{s.rangePct}% range', stats: { rangePct: [8, 16, 24] } },
      mg_p_mind:   { grp: 'mage', fam: 'arcane', type: 'passive', rarity: 1, w: 6, max: 3, name: 'Arcane Mind', desc: '+{s.fxPct}% ability effect damage', stats: { fxPct: [12, 24, 36] } },
      mg_p_shield: { grp: 'mage', fam: 'arcane', type: 'passive', rarity: 0, w: 8, max: 4, name: 'Mana Shield', desc: '+{s.hp} max HP', stats: { hp: [15, 30, 45, 60] } },

      // ===== WARRIOR: melee bruiser, every swing is an area attack. Steel, Blood, Fire, Storm =====
      wr_cleave:   { grp: 'warrior', fam: 'steel', type: 'active', rarity: 0, w: 10, max: 3, name: 'Cleave', only: 'arc',
                     desc: 'Swings {s.arcPct}% wider, +{s.knockPct}% knockback',
                     stats: { arcPct: [20, 35, 50], knockPct: [10, 20, 30] } },
      wr_whirl:    { grp: 'warrior', fam: 'steel', type: 'active', rarity: 1, w: 6, max: 3, name: 'Whirlwind', only: 'arc',
                     desc: 'Every {0.every} swings is a full circle at {0.dmg%}% damage',
                     fx: [{ k: 'whirl', on: 'attack', every: [4, 4, 3], dmg: [1.2, 1.4, 1.6] }],
                     wpn: { hammer: { every: [3, 3, 2] } } },
      wr_execute:  { grp: 'warrior', fam: 'steel', type: 'active', rarity: 2, w: 3, max: 3, name: 'Executioner',
                     desc: 'Hits kill normal enemies left under {0.below%}% HP. +{s.elitePct}% vs elites',
                     stats: { elitePct: [5, 10, 15] },
                     fx: [{ k: 'execute', on: 'hit', below: [0.12, 0.16, 0.2] }] },
      wr_rend:     { grp: 'warrior', fam: 'blood', type: 'active', rarity: 0, w: 10, max: 3, name: 'Rend',
                     desc: 'Hits bleed: {0.dps%}% of the hit per second, stacks {0.stacks}x, {0.t} s',
                     fx: [{ k: 'dot', on: 'hit', dot: 'bleed', dps: [0.2, 0.25, 0.3], stacks: 3, t: 3 }] },
      wr_drain:    { grp: 'warrior', fam: 'blood', type: 'active', rarity: 1, w: 6, max: 3, name: 'Blood Drinker',
                     desc: 'Heal {0.pct%}% of damage dealt by swings. +{s.hp} max HP',
                     stats: { hp: [10, 20, 30] },
                     fx: [{ k: 'leech', on: 'hit', pct: [0.04, 0.06, 0.08] }] },
      wr_frenzy:   { grp: 'warrior', fam: 'blood', type: 'active', rarity: 2, w: 3, max: 3, name: 'Frenzy',
                     desc: 'Kills give +{0.v}% attack speed for {0.t} s (stacks {0.stacks}x)',
                     fx: [{ k: 'buff', on: 'kill', stat: 'atkPct', v: [6, 8, 10], stacks: 5, t: 4 }] },
      wr_flame:    { grp: 'warrior', fam: 'fire', type: 'active', rarity: 0, w: 10, max: 3, name: 'Flame Blade',
                     desc: 'Hits burn: {0.dps%}% of the hit per second for {0.t} s',
                     fx: [{ k: 'dot', on: 'hit', dot: 'burn', dps: [0.35, 0.5, 0.65], t: 3 }] },
      wr_eruption: { grp: 'warrior', fam: 'fire', type: 'active', rarity: 1, w: 6, max: 3, name: 'Eruption',
                     desc: '{0.chance%}% chance: the ground under the target erupts, {0.dmg%}%, burns',
                     fx: [{ k: 'burst', on: 'strike', chance: [0.25, 0.3, 0.35], at: 'target', r: 30, dmg: [0.7, 0.9, 1.1], knock: 50, apply: { burn: { dps: 0.3, t: 3 } } }],
                     wpn: { hammer: { r: 40 }, mace: { knock: 120 } } },
      wr_inferno:  { grp: 'warrior', fam: 'fire', type: 'active', rarity: 2, w: 3, max: 3, name: 'Inferno',
                     desc: 'Every {0.every} swings, the ground around you burns: {0.dps%}% per second, {0.t} s',
                     fx: [{ k: 'zone', on: 'attack', every: 5, at: 'player', r: [36, 40, 44], t: 3, dps: [0.5, 0.65, 0.8], apply: { burn: { dps: 0.2, t: 2 } } }] },
      wr_wave:     { grp: 'warrior', fam: 'storm', type: 'active', rarity: 0, w: 10, max: 3, name: 'Thunder Wave', only: 'arc',
                     desc: 'Swings send a wave forward through enemies: {0.dmg%}%, {0.range} px',
                     fx: [{ k: 'wave', on: 'attack', dmg: [0.4, 0.55, 0.7], speed: 220, range: [90, 100, 110], r: 5 }],
                     wpn: { sword: { speed: 260 }, hammer: { r: 8 } } },
      wr_arc:      { grp: 'warrior', fam: 'storm', type: 'active', rarity: 1, w: 6, max: 3, name: 'Arc Strike',
                     desc: 'Swings arc lightning to {0.jumps} more enemies: {0.dmg%}%',
                     fx: [{ k: 'chain', on: 'strike', jumps: [2, 3, 3], r: 50, dmg: [0.5, 0.6, 0.75], fall: 0.85 }] },
      wr_slam:     { grp: 'warrior', fam: 'storm', type: 'active', rarity: 2, w: 3, max: 3, name: 'Thunder Slam',
                     desc: 'Every {0.every} swings, thunder around you: {0.dmg%}% in radius {0.r}, knocks back',
                     fx: [{ k: 'burst', on: 'attack', every: 3, at: 'player', r: [34, 38, 42], dmg: [0.6, 0.75, 0.9], knock: 120 }],
                     wpn: { mace: { knock: 180 }, hammer: { r: [42, 46, 50], knock: 180 } } },
      wr_p_heavy:  { grp: 'warrior', fam: 'steel', type: 'passive', rarity: 0, w: 10, max: 5, name: 'Heavy Blows', desc: '+{s.dmgPct}% damage', stats: { dmgPct: [10, 20, 30, 40, 50] } },
      wr_p_plate:  { grp: 'warrior', fam: 'steel', type: 'passive', rarity: 0, w: 8, max: 3, name: 'Plate Armour', desc: '+{s.armor} armor', stats: { armor: [8, 16, 24] } },
      wr_p_giant:  { grp: 'warrior', fam: 'steel', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Giant Slayer', desc: '+{s.elitePct}% damage to elites and bosses', stats: { elitePct: [12, 24, 36] } },
      wr_p_iron:   { grp: 'warrior', fam: 'blood', type: 'passive', rarity: 0, w: 9, max: 4, name: 'Iron Body', desc: '+{s.hp} max HP', stats: { hp: [25, 50, 75, 100] } },
      wr_p_berserk: { grp: 'warrior', fam: 'blood', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Berserker', desc: '+{s.lowHpPct}% damage while under half HP', stats: { lowHpPct: [20, 35, 50] } },
      wr_p_wind:   { grp: 'warrior', fam: 'blood', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Second Wind', desc: '+{s.regen} HP per second', stats: { regen: [0.8, 1.6, 2.4] } },
      wr_p_smolder: { grp: 'warrior', fam: 'fire', type: 'passive', rarity: 1, w: 6, max: 3, name: 'Smoldering Steel', desc: '+{s.dotPct}% burn and bleed damage', stats: { dotPct: [20, 40, 60] } },
      wr_p_wild:   { grp: 'warrior', fam: 'fire', type: 'passive', rarity: 0, w: 6, max: 3, name: 'Wildfire', desc: '+{s.areaPct}% area of explosions and zones', stats: { areaPct: [12, 24, 36] } },
      wr_p_fury:   { grp: 'warrior', fam: 'fire', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Blazing Fury', desc: '+{s.fxPct}% ability effect damage', stats: { fxPct: [12, 24, 36] } },
      wr_p_quick:  { grp: 'warrior', fam: 'storm', type: 'passive', rarity: 0, w: 10, max: 5, name: 'Quick Strikes', desc: '+{s.atkPct}% attack speed', stats: { atkPct: [8, 16, 24, 32, 40] } },
      wr_p_charge: { grp: 'warrior', fam: 'storm', type: 'passive', rarity: 0, w: 7, max: 3, name: 'Charge Mastery', desc: '-{s.dodgeCdPct}% charge cooldown', stats: { dodgeCdPct: [15, 30, 45] } },
      wr_p_crit:   { grp: 'warrior', fam: 'storm', type: 'passive', rarity: 1, w: 6, max: 4, name: 'Killer Instinct', desc: '+{s.crit}% crit chance', stats: { crit: [4, 8, 12, 16] } },

      // ===== ARCHER: long-range hunter, few strong arrows that pierce. Venom, Steel, Frost, Storm =====
      ar_poison:   { grp: 'archer', fam: 'venom', type: 'active', rarity: 0, w: 10, max: 3, name: 'Poison Tips',
                     desc: 'Arrows poison: {0.dps%}% of the hit per second per stack, {0.stacks} stacks, {0.t} s',
                     fx: [{ k: 'dot', on: 'hit', dot: 'poison', dps: [0.12, 0.16, 0.2], stacks: 4, t: 4 }] },
      ar_cloud:    { grp: 'archer', fam: 'venom', type: 'active', rarity: 1, w: 6, max: 3, name: 'Toxic Cloud',
                     desc: '{0.chance%}% chance: a toxic cloud on the target, {0.dps%}% per second, poisons',
                     fx: [{ k: 'zone', on: 'strike', chance: [0.3, 0.35, 0.4], at: 'target', r: 28, t: 4, dps: [0.3, 0.4, 0.5], apply: { poison: { dps: 0.1, stacks: 4, t: 3 } } }] },
      ar_plague:   { grp: 'archer', fam: 'venom', type: 'active', rarity: 2, w: 3, max: 3, name: 'Plague Arrow',
                     desc: 'Kills burst into poison: {0.dmg%}% in radius {0.r}, poisons',
                     fx: [{ k: 'burst', on: 'kill', at: 'target', r: 36, dmg: [0.4, 0.55, 0.7], knock: 0, apply: { poison: { dps: 0.12, stacks: 4, t: 4 } } }] },
      ar_ricochet: { grp: 'archer', fam: 'steel', type: 'active', rarity: 0, w: 10, max: 3, name: 'Ricochet', only: 'bolt',
                     desc: 'Arrows bounce to {0.n} more enemies ({0.fall%}% damage each bounce)',
                     fx: [{ k: 'bounce', n: [1, 2, 3], r: 70, fall: 0.8 }] },
      ar_mark:     { grp: 'archer', fam: 'steel', type: 'active', rarity: 1, w: 6, max: 3, name: 'Hunter\'s Mark',
                     desc: 'The first enemy hit is marked: +{0.pct%}% damage taken for {0.t} s',
                     fx: [{ k: 'mark', on: 'strike', pct: [0.12, 0.18, 0.24], t: 4 }] },
      ar_split:    { grp: 'archer', fam: 'steel', type: 'active', rarity: 2, w: 3, max: 3, name: 'Split Shot', only: 'bolt',
                     desc: '+{s.multi} side arrow on each side',
                     stats: { multi: [1, 1, 2], dmgPct: [0, 5, 5] } },
      ar_frost:    { grp: 'archer', fam: 'frost', type: 'active', rarity: 0, w: 10, max: 3, name: 'Frost Arrow',
                     desc: 'Arrows chill: {0.slow%}% slower for {0.t} s. +{s.dmgPct}% damage',
                     stats: { dmgPct: [5, 10, 15] },
                     fx: [{ k: 'chill', on: 'hit', slow: [0.25, 0.32, 0.4], t: 1.5 }] },
      ar_shatter:  { grp: 'archer', fam: 'frost', type: 'active', rarity: 1, w: 6, max: 3, name: 'Shatter Shot',
                     desc: 'A chilled target shatters: {0.dmg%}% in radius {0.r}, chills',
                     fx: [{ k: 'burst', on: 'strike', if: 'chilled', at: 'target', r: 26, dmg: [0.6, 0.8, 1.0], knock: 30, apply: { chill: { slow: 0.3, t: 1.5 } } }] },
      ar_trap:     { grp: 'archer', fam: 'frost', type: 'active', rarity: 2, w: 3, max: 3, name: 'Frost Trap',
                     desc: 'Every {0.every} shots, a frost field at the target: {0.dps%}% per second, chills',
                     fx: [{ k: 'zone', on: 'attack', every: [6, 5, 4], at: 'target', r: 32, t: 4, dps: [0.25, 0.35, 0.45], apply: { chill: { slow: 0.4, t: 1 } } }] },
      ar_double:   { grp: 'archer', fam: 'storm', type: 'active', rarity: 0, w: 10, max: 3, name: 'Double Nock',
                     desc: '{0.chance%}% chance to shoot again at once ({0.dmg%}% damage)',
                     fx: [{ k: 'echo', on: 'attack', chance: [0.25, 0.35, 0.45], delay: 0.1, dmg: 0.8 }] },
      ar_fan:      { grp: 'archer', fam: 'storm', type: 'active', rarity: 1, w: 6, max: 3, name: 'Fan of Arrows', only: 'bolt',
                     desc: 'Every {0.every} shots, +{0.side} arrows on each side ({0.dmg%}%)',
                     fx: [{ k: 'fan', on: 'attack', every: [4, 4, 3], side: [2, 2, 3], dmg: [0.6, 0.7, 0.8] }] },
      ar_thunder:  { grp: 'archer', fam: 'storm', type: 'active', rarity: 2, w: 3, max: 3, name: 'Thunder Arrow',
                     desc: 'Every {0.every} shots, lightning strikes a random enemy in range: {0.dmg%}%',
                     fx: [{ k: 'burst', on: 'attack', every: 3, at: 'random', r: 20, dmg: [1.2, 1.5, 1.8], knock: 30 }] },
      ar_p_tox:    { grp: 'archer', fam: 'venom', type: 'passive', rarity: 0, w: 8, max: 3, name: 'Toxicology', desc: '+{s.dotPct}% poison and burn damage', stats: { dotPct: [20, 40, 60] } },
      ar_p_linger: { grp: 'archer', fam: 'venom', type: 'passive', rarity: 1, w: 6, max: 3, name: 'Lingering Venom', desc: '+{s.durPct}% status and zone duration', stats: { durPct: [20, 40, 60] } },
      ar_p_feast:  { grp: 'archer', fam: 'venom', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Hunter\'s Feast', desc: 'Heal {s.leech} HP per kill', stats: { leech: [1, 2, 3] } },
      ar_p_draw:   { grp: 'archer', fam: 'steel', type: 'passive', rarity: 0, w: 10, max: 5, name: 'Strong Draw', desc: '+{s.dmgPct}% damage', stats: { dmgPct: [10, 20, 30, 40, 50] } },
      ar_p_deadeye: { grp: 'archer', fam: 'steel', type: 'passive', rarity: 0, w: 7, max: 4, name: 'Deadeye', desc: '+{s.crit}% crit chance', stats: { crit: [4, 8, 12, 16] } },
      ar_p_pierce: { grp: 'archer', fam: 'steel', type: 'passive', rarity: 2, w: 3, max: 2, name: 'Piercing Arrow', desc: 'Arrows pierce +{s.pierce} enemy', stats: { pierce: [1, 2] } },
      ar_p_coat:   { grp: 'archer', fam: 'frost', type: 'passive', rarity: 0, w: 8, max: 3, name: 'Winter Coat', desc: '+{s.armor} armor', stats: { armor: [6, 12, 18] } },
      ar_p_precise: { grp: 'archer', fam: 'frost', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Cold Precision', desc: '+{s.critDmg}% crit damage', stats: { critDmg: [15, 30, 45] } },
      ar_p_bite:   { grp: 'archer', fam: 'frost', type: 'passive', rarity: 1, w: 6, max: 3, name: 'Frostbite', desc: 'Chill {s.chillPct}% stronger', stats: { chillPct: [15, 30, 45] } },
      ar_p_quick:  { grp: 'archer', fam: 'storm', type: 'passive', rarity: 0, w: 10, max: 5, name: 'Quick Nock', desc: '+{s.atkPct}% attack speed', stats: { atkPct: [8, 16, 24, 32, 40] } },
      ar_p_eagle:  { grp: 'archer', fam: 'storm', type: 'passive', rarity: 0, w: 7, max: 3, name: 'Eagle Eye', desc: '+{s.rangePct}% range', stats: { rangePct: [8, 16, 24] } },
      ar_p_tail:   { grp: 'archer', fam: 'storm', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Tailwind', desc: '+{s.procPct}% chance of ability effects', stats: { procPct: [15, 30, 45] } },

      // ===== SHARED: every class =====
      sh_kindle:   { grp: 'shared', fam: 'fire', type: 'active', rarity: 0, w: 5, max: 3, name: 'Kindle',
                     desc: '{0.chance%}% chance per hit to burn: {0.dps%}% of the hit per second, {0.t} s',
                     fx: [{ k: 'dot', on: 'hit', chance: 0.35, dot: 'burn', dps: [0.3, 0.4, 0.5], t: 3 }] },
      sh_chill:    { grp: 'shared', fam: 'frost', type: 'active', rarity: 0, w: 5, max: 3, name: 'Chilling Touch',
                     desc: '{0.chance%}% chance per hit to chill: {0.slow%}% slower for {0.t} s',
                     fx: [{ k: 'chill', on: 'hit', chance: 0.5, slow: [0.2, 0.25, 0.3], t: 1.2 }] },
      sh_vigor:    { grp: 'shared', fam: 'blood', type: 'passive', rarity: 0, w: 9, max: 5, name: 'Vitality', desc: '+{s.hp} max HP', stats: { hp: [18, 36, 54, 72, 90] } },
      sh_mend:     { grp: 'shared', fam: 'blood', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Mending', desc: '+{s.regen} HP per second', stats: { regen: [0.6, 1.2, 1.8] } },
      sh_ward:     { grp: 'shared', fam: 'steel', type: 'passive', rarity: 0, w: 6, max: 3, name: 'Warding', desc: '+{s.armor} armor', stats: { armor: [6, 12, 18] } },
      sh_swift:    { grp: 'shared', fam: 'storm', type: 'passive', rarity: 0, w: 7, max: 3, name: 'Swiftness', desc: '+{s.movePct}% move speed', stats: { movePct: [7, 14, 21] } },
      sh_reflex:   { grp: 'shared', fam: 'storm', type: 'passive', rarity: 1, w: 4, max: 3, name: 'Reflexes', desc: '-{s.dodgeCdPct}% dodge cooldown', stats: { dodgeCdPct: [15, 30, 45] } },
      sh_wisdom:   { grp: 'shared', fam: 'arcane', type: 'passive', rarity: 0, w: 6, max: 3, name: 'Wisdom', desc: '+{s.expPct}% EXP gain', stats: { expPct: [15, 30, 45] } },
      sh_focus:    { grp: 'shared', fam: 'arcane', type: 'passive', rarity: 1, w: 4, max: 3, name: 'Focus', desc: '+{s.pulsePct}% skill damage, -{s.pulseCdPct}% skill cooldown', stats: { pulsePct: [30, 60, 90], pulseCdPct: [15, 30, 45] } }
    },

    // QA bot builds per class (the first is the default). order: most wanted first; the bot scores a
    // card by its place in this list (see the spec, "Bot builds"). fams: the families the build aims for.
    builds: {
      mage: {
        pyro:   { name: 'Pyromancer', fams: ['fire', 'arcane'],
                  order: ['mg_ignite', 'mg_fireball', 'mg_meteor', 'mg_p_fire', 'mg_p_pyro', 'mg_p_haste', 'mg_p_wild', 'mg_p_shield', 'mg_p_mind', 'sh_vigor', 'mg_p_reach'] },
        storm:  { name: 'Stormcaller', fams: ['storm', 'arcane'],
                  order: ['mg_chain', 'mg_ball', 'mg_twin', 'mg_p_haste', 'mg_p_static', 'mg_p_fire', 'mg_p_conduct', 'mg_p_shield', 'mg_p_mind', 'sh_vigor', 'sh_swift'] },
        frost:  { name: 'Frostweaver', fams: ['frost', 'arcane'],
                  order: ['mg_frostbolt', 'mg_icelance', 'mg_blizzard', 'mg_p_cold', 'mg_p_fire', 'mg_p_shatter', 'mg_p_icearmor', 'mg_p_haste', 'mg_p_shield', 'mg_p_mind', 'sh_vigor'] }
      },
      warrior: {
        blade:  { name: 'Bladestorm', fams: ['steel', 'storm'],
                  order: ['wr_whirl', 'wr_cleave', 'wr_execute', 'wr_p_heavy', 'wr_p_quick', 'wr_p_plate', 'wr_p_giant', 'wr_p_crit', 'wr_p_iron', 'sh_vigor'] },
        blood:  { name: 'Bloodreaver', fams: ['blood', 'steel'],
                  order: ['wr_rend', 'wr_frenzy', 'wr_drain', 'wr_p_iron', 'wr_p_heavy', 'wr_p_berserk', 'wr_p_wind', 'wr_p_plate', 'wr_p_quick', 'sh_vigor'] },
        thunder: { name: 'Thunder Lord', fams: ['storm', 'fire'],
                  order: ['wr_wave', 'wr_slam', 'wr_arc', 'wr_p_quick', 'wr_p_heavy', 'wr_p_crit', 'wr_p_iron', 'wr_p_charge', 'wr_p_fury', 'wr_p_wild', 'sh_vigor'] }
      },
      archer: {
        plague: { name: 'Plaguebringer', fams: ['venom', 'steel'],
                  order: ['ar_poison', 'ar_cloud', 'ar_plague', 'ar_p_tox', 'ar_p_draw', 'ar_p_linger', 'ar_p_quick', 'ar_p_feast', 'ar_p_deadeye', 'sh_vigor'] },
        marks:  { name: 'Marksman', fams: ['steel', 'storm'],
                  order: ['ar_ricochet', 'ar_split', 'ar_mark', 'ar_p_draw', 'ar_p_quick', 'ar_p_deadeye', 'ar_p_pierce', 'ar_p_eagle', 'sh_vigor', 'ar_p_coat'] },
        winter: { name: 'Winter Hunter', fams: ['frost', 'storm'],
                  order: ['ar_frost', 'ar_shatter', 'ar_trap', 'ar_p_bite', 'ar_p_draw', 'ar_p_precise', 'ar_p_coat', 'ar_p_quick', 'ar_p_eagle', 'sh_vigor'] }
      }
    },

    // QA bot only (not game difficulty): how often it re-decides in a fight. 12 ticks = 0.2 s,
    // roughly a human reaction time. 1 would be a frame-perfect player.
    bot: { reactionTicks: 12 },

    fx: { shakeCap: 5, shakeDecay: 9 },   // max shake offset in art px at 100 %
    softlockSeconds: 400
  };
})(globalThis.G = globalThis.G || {});
