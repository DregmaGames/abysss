// The one balance file. Every tunable number lives here; the sim reads nothing else.
// Units: art pixels (1 tile = 16 px), seconds, HP. Per-room arrays have one entry per room (10).
(function (G) {
  G.BAL = {
    TILE: 16,
    DT: 1 / 60,

    run: {
      rooms: 10,                      // the last room is the boss room
      roomMult: [0.75, 1.25, 1.5, 1.85, 2.25, 2.7, 3.2, 3.8, 4.3, 3.8],   // monster hp/dmg multiplier per room (step 10: was 1.05 .. 3.5, boss 3.0)
      monsterHp: 1.4,                 // x monster HP in every room (on top of roomMult); step 10: longer fights (win time 8-10 min) ...
      monsterDmg: 0.75,               // ... with softer hits, so a room is about as deadly as before
      // +0.45 % monster hp/dmg per point of the gear score the hero BRINGS INTO the run (step 10: items equipped during the run no longer count,
      // so a fresh save is not punished for equipping its finds; it only slows the snowball of a geared career; was 0.5 % of the live gear score)
      gentle: { rooms: 3, mult: 0.8 },   // the first run of a fresh character: monsters in rooms 1-3 have this share of hp and damage (src/sim/core.js loadRoom; gear.ux.runs === 0)
      gearK: 0.0045,
      ilvlRooms: 3,                   // item level of drops = 1 + floor(room / ilvlRooms)
      testRoom: 1,                    // ?room=test / TEST ROOM button: this room, restarted on every clear
      // Dying empties the sealed bag. Whether the equipped gear survives is a design assumption the user has not confirmed:
      // true = it is kept; false = dying also strips every equipped item. This is the only place the rule lives.
      deathKeepsEquipped: true
    },

    // Rooms (step big rooms; src/mapgen.js). Sizes in tiles of 16 px. A room fills a 16:9 view at pixel scale 2 on a 922-1080 px high
    // window (820x461 to 960x540 art px): about twice the floor of the old 30-36 x 20-24 rooms. On a smaller view the camera follows the hero.
    room: {
      w: [52, 58], h: [30, 33],       // normal rooms
      boss: { w: 54, h: 32 },         // the boss room: eight pillars in two rows
      startMargin: 12,                // the start and the exit are at least this many tiles from the side walls
      // tiles that never become wall: +-start round the start tile (the merchant and Don Montoto's cage stand there), exitW either side of
      // the exit down to row exitH (the chest), centreW x centreH round the super fissure
      reserve: { start: 2, exitW: 2, exitH: 6, centreW: 6, centreH: 5 },
      corner: { chance: 0.8, w: [5, 11], h: [3, 6], step: 0.5 },      // cut corners; `step`: chance of a second, narrower and deeper step
      bumps: [5, 9], bossBumps: 4, bumpLen: [3, 7], bumpDepth: [1, 3],      // buttresses along the walls (two deep ones make an alcove)
      blocks: [11, 17], blockGap: 2,  // pillars and wall blocks inside a normal room; free tiles kept round each
      blockKinds: { pillar: 9, wide: 4, tall: 3, big: 2, ell: 2 },      // weights: 2-3 square | 4-7 x 2 | 2 x 4-6 | 4-5 x 3-4 | an L of two walls
      // no crack centre this close (tiles: x, y) to the start, the exit column (down to row y) and the room centre
      site: { start: [6, 5], exit: [4, 8], centre: [9, 7] },
      decals: 0.06,                   // floor marks per floor tile
      torchGap: 5, torchTop: 0.6, torchIn: 0.3      // wall torches: min tiles apart, chance per face tile on the top wall / on inner walls
    },

    // Doors (step 6). After every room but the last: leave with the sealed bag, or go on through one of two doors.
    // The two doors after room N depend only on the run seed and N (G.doorsFor); each is a fissure modifier for the
    // next room and pays `loot`: +that share of gear drop chances and +that much rarity luck (0.25 = +25 %).
    // Modifier fields (all optional): crackLen (x the arm length), extraCracks (added to the crack count),
    // spawnEvery (x the pause between packs; below 1 = faster), aliveThreat (x the cap on network monsters alive at once),
    // extraElite (monster id added to the super fissure wave), threat (x monster hp and damage).
    doors: {
      mods: {
        longCracks: { name: 'Long cracks',   loot: 0.25, crackLen: 1.4 },
        manyCracks: { name: 'More cracks',   loot: 0.30, extraCracks: 1 },
        fastSpawns: { name: 'Fast spawns',   loot: 0.20, spawnEvery: 0.5 },
        crowd:      { name: 'Crowded',       loot: 0.20, aliveThreat: 1.6 },
        elite:      { name: 'Extra elite',   loot: 0.30, extraElite: 'warden' },
        hardened:   { name: 'Hardened foes', loot: 0.25, threat: 1.2 }
      }
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
    //   group: optional ability group (default = the class id): the level-up pool is BAL.abilities of that group + 'shared'.
    //   bot: QA bot hints. keep: multiplier on its keep-away distances. The ability builds are in BAL.builds.
    classes: {
      mage: {
        name: 'Mage',
        base: { r: 5, hp: 110, speed: 78, dmg: 12.5, atkInterval: 0.5, range: 112, crit: 0.05, critMult: 1.8 },
        attack: { kind: 'bolt', firstCd: 0.4, speed: 250, r: 3, sideDmg: 0.6, spread: 0.22, life: 1.2, knock: 34, knockElite: 14, frame: 'bolt', glow: 'orb' },
        dodge: { dist: 54, time: 0.16, iframes: 0.34, cd: 1.6 },
        skill: { kind: 'pulse', name: 'Pulse', dmg: 26, radius: 54, cd: 7, knock: 200 },
        sprite: { frames: 'mage', glow: 'mb2', dash: 'mb3' },
        bot: { keep: 1 }
      },
      warrior: {
        name: 'Warrior',
        base: { r: 6, hp: 245, speed: 74, dmg: 27, atkInterval: 0.55, range: 30, crit: 0.05, critMult: 2 },
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
        bot: { keep: 0.8 }
      },
      archer: {
        name: 'Archer',
        // longer reach than the mage, slower shots, arrows pierce 1 enemy at base (base.pierce)
        base: { r: 5, hp: 100, speed: 76, dmg: 21, atkInterval: 0.8, range: 150, crit: 0.1, critMult: 2, pierce: 1 },
        attack: { kind: 'bolt', firstCd: 0.5, speed: 330, r: 2.5, sideDmg: 0.6, spread: 0.18, life: 1.2, knock: 16, knockElite: 6, frame: 'arrow', glow: 'rg2', rotate: true },
        dodge: { dist: 52, time: 0.16, iframes: 0.32, cd: 1.5 },
        // Volley: a ring of `count` arrows (each `pierce` enemies, dmg = skill dmg incl. pulse passives) flying `range` px
        skill: { kind: 'volley', name: 'Volley', dmg: 14, count: 14, pierce: 1, range: 120, speed: 260, cd: 7, knock: 40 },
        sprite: { frames: 'archer', glow: 'rg1', dash: 'rg3', fx: ['rg4', 'rg3', 'rg2'] },
        bot: { keep: 1.2 }
      }
    },
    defaultClass: 'mage',

    exp: { base: 9, grow: 5, pow: 1.22 },   // exp to next = base + grow * (level-1)^pow

    // ai: chase | weave | ranged | lunge | caster | elite | boss. threat: fissure spawn budget cost. exp: orb value.
    monsters: {
      // dummy: the tutorial's training dummy (never in a fissure pool): stands still, never hurts (src/sim/tutorial.js)
      dummy:    { ai: 'dummy', r: 7, hp: 55, speed: 0, dmg: 0, exp: 0, threat: 0, shadow: 's' },
      imp:      { ai: 'chase', r: 5, hp: 18, speed: 84, dmg: 9, exp: 2, threat: 1, shadow: 's' },
      bat:      { ai: 'weave', r: 4.5, hp: 10, speed: 104, dmg: 6, exp: 2, threat: 1, shadow: 's', weave: 0.9, fly: 5 },
      skeleton: { ai: 'ranged', r: 5, hp: 26, speed: 36, dmg: 5, exp: 4, threat: 2, shadow: 's',
                  shotDmg: 10, shotSpeed: 100, shotEvery: 2.0, windup: 0.45, keepMin: 62, keepMax: 100, sight: 140 },
      hound:    { ai: 'lunge', r: 7, hp: 80, speed: 38, dmg: 16, exp: 8, threat: 3, shadow: 'm',
                  lungeRange: 54, lungeWindup: 0.5, lungeSpeed: 180, lungeTime: 0.34, lungeCd: 2.6 },
      // cultist: the sixth type, a slow caster that takes floor away. It draws a rune (radius poolR, `windup` s on the floor) under a standing hero,
      // or `lead` x the distance a walking hero would cover in that time ahead of them (keep walking straight and it catches you),
      // the rune erupts (eruptDmg to a hero still on it) and stays as a rift pool for poolTime s that deals poolDmg every poolTick s to a hero
      // standing in it (the dodge crosses it unhurt). Kill it while it casts and the rune is gone. A walker: open cracks stop it, not its cast.
      cultist:  { ai: 'caster', r: 5, hp: 46, speed: 30, dmg: 6, exp: 6, threat: 3, shadow: 's',
                  castEvery: 3.4, windup: 0.9, lead: 0.8, sight: 150, keepMin: 66, keepMax: 104,
                  poolR: 22, eruptDmg: 14, poolDmg: 7, poolTick: 0.45, poolTime: 6 },
      warden:   { ai: 'elite', r: 9, hp: 260, speed: 34, dmg: 12, exp: 26, threat: 8, shadow: 'm', elite: true,
                  shotDmg: 11, shotSpeed: 100, shotEvery: 2.3, windup: 0.5, spread: 0.3, keepMin: 46, keepMax: 86,
                  summonEvery: 7, summon: 2, summonType: 'imp' },
      tyrant:   { ai: 'boss', r: 14, hp: 1200, speed: 32, dmg: 14, exp: 120, threat: 40, shadow: 'l', boss: true,
                  chaseTime: 2.4, enrageAt: 0.4, enrageRate: 0.7,
                  slamRadius: 66, slamWindup: 0.95, slamDmg: 22,      // step big rooms: radius 56 -> 66 for the 54 x 32 arena
                  burstShots: 12, burstDmg: 9, burstSpeed: 70, burstGap: 0.55, burstWindup: 0.6,
                  summon: 4,                                           // step big rooms: was 3
                  chargeWindup: 0.75, chargeSpeed: 180, chargeTime: 0.8, chargeDmg: 18 }      // step big rooms: the charge runs 144 px (was 0.6 s, 108 px)
    },
    contactCd: 0.6,

    // The interactive tutorial (src/sim/tutorial.js, src/view/tutorial.js): a small fixed room, weak monsters, a hero that cannot die.
    // Nothing in it is banked: no exp, gold, drops or progress. The tutorial's one item (own-class weapon) is the only thing it leaves on the character.
    tutorial: {
      w: 38, h: 26,                   // room size in tiles (step big rooms: was 24 wide; every position in it is relative to the room)
      crackRow: 14, pitRow: 8,        // the dividing wall (3 tiles thick) and its crack are on this tile row; the super fissure is on that row, in the middle
      gate: 8,                        // the gate in the dividing wall, tiles (even); the crack lies across it
      crackReach: [30, 22], crackEnd: 20, crackLane: 20, crackSide: [44, 30],      // px the crack may run above / below the row; px from the row at the wall ends; half width of the lane kept clear for the dodge; px of the two short arms (far side, near side)
      moveDist: 60,                   // step 1: px the hero must move
      hpMult: 0.8, dmgMult: 0.25,     // monster hp and damage (x the base numbers; the room multipliers are not used)
      skillWave: ['imp', 'imp', 'bat'],                                  // step 5
      crackWave: ['imp', 'bat', 'imp', 'imp', 'bat', 'imp'], crackAlive: 3, crackEvery: 1.2,      // step 6: the crack's monsters, at most crackAlive at once
      superWave: ['imp', 'imp', 'bat', 'imp'],                           // step 7
      itemRarity: 1, itemIlvl: 2,     // the chest's item: magic, so it drops unidentified
      healBelow: 0.5, healRate: 0.2,  // under this share of max HP the hero heals this share of max HP per second
      stuckAfter: 20,                 // fight steps: this many seconds with no monster hurt -> stragglers are brought to the hero, then beaten
      crossMargin: 13                 // px from the crack's centre line the hero must be past to have crossed (and the line it cannot be pushed back over)
    },

    fissure: {
      // step big rooms: about +45 % monsters per room in a room of twice the floor: one more crack per room (was 2, 3, 3, 3, 4, 4, 4, 4, 5, 2)
      // and a bigger budget per crack (was 5 .. 13, 9); count x budget = 15, 24, 32, 36, 50, 60, 65, 70, 96, 27 (was 10, 18, 21, 24, 36, 40, 44, 48, 65, 18)
      count:  [3, 4, 4, 4, 5, 5, 5, 5, 6, 3],             // normal fissures per room
      budget: [5, 6, 8, 9, 10, 12, 13, 14, 16, 9],        // threat points per normal fissure
      pool: [                                             // spawn weights, by room
        { imp: 8, bat: 3 },
        { imp: 6, bat: 3, skeleton: 2 },
        { imp: 6, bat: 3, skeleton: 3, hound: 1 },
        { imp: 5, bat: 3, skeleton: 3, hound: 2, cultist: 1 },      // the cultist joins in room 4 and grows more common to room 9
        { imp: 5, bat: 3, skeleton: 3, hound: 3, cultist: 1 },
        { imp: 5, bat: 3, skeleton: 3, hound: 3, cultist: 2 },
        { imp: 4, bat: 3, skeleton: 4, hound: 3, cultist: 2 },
        { imp: 4, bat: 3, skeleton: 4, hound: 4, cultist: 2 },
        { imp: 4, bat: 3, skeleton: 4, hound: 4, cultist: 3 },
        { imp: 6, bat: 3, skeleton: 3, hound: 1 }
      ],
      superWave: [                                        // step big rooms: about +45 % monsters (was 4, 6, 6, 8, 6, 6, 8, 7, 9), the same wardens
        ['warden', 'imp', 'imp', 'imp', 'imp', 'bat'],
        ['warden', 'imp', 'imp', 'imp', 'bat', 'bat', 'bat', 'skeleton', 'skeleton'],
        ['warden', 'hound', 'hound', 'imp', 'imp', 'imp', 'skeleton', 'skeleton', 'bat'],
        ['warden', 'hound', 'hound', 'hound', 'bat', 'bat', 'bat', 'bat', 'imp', 'imp', 'imp', 'skeleton'],
        ['warden', 'warden', 'imp', 'imp', 'imp', 'imp', 'skeleton', 'skeleton', 'bat'],
        ['warden', 'warden', 'hound', 'hound', 'hound', 'bat', 'bat', 'bat', 'imp'],
        ['warden', 'warden', 'hound', 'hound', 'skeleton', 'skeleton', 'skeleton', 'imp', 'imp', 'imp', 'imp', 'bat'],
        ['warden', 'warden', 'hound', 'hound', 'hound', 'hound', 'skeleton', 'skeleton', 'skeleton', 'imp'],
        ['warden', 'warden', 'warden', 'hound', 'hound', 'hound', 'bat', 'bat', 'bat', 'bat', 'bat', 'imp', 'imp'],
        ['tyrant']
      ],
      // the crack network: all cracks open when the room starts and go dark segment by segment as
      // their monsters die. An open crack is a wall for walkers; the player crosses it with the dodge.
      crackLen: [150, 215],           // px per arm (two arms per crack; a branch has one). Step big rooms: was 90-130; the network spans the room
      fork: 0.07,                     // chance per px of arm that a side crack forks off: the twig density of the short cracks (0.035 left the long arms bare)
      forkLen: [14, 46],              // px a side crack may run (it was 0.6 x the rest of the arm, which on the long arms made more long bare lines instead of twigs)
      bend: 3,                        // times an arm may turn to run past a pillar, a wall or a reserved zone instead of ending there
      minCells: 260,                  // a crack with fewer px than this (rim included) is a stub: the generator tries again (was 12)
      aim: 6,                         // headings tried for a new crack: it takes the one with the most free floor along both arms
      thirdArm: [0.5, 0.5, 0.8],      // chance that a crack grows a third arm at about a right angle; its length = lo..hi x the arm length
      superPit: { r: 16, arms: [7, 8], armLen: [50, 72], keep: 40 },      // the super fissure: pit radius, arms, px per arm; normal cracks keep `keep` px from its centre
      segments: 4,                    // dark bands per crack, the tips go dark first
      joinChance: 0.45,               // chance that a crack branches off an earlier one (joined = shared kill meter)
      siteShare: 0.5,                 // at least this share of a room's cracks are separate centres (rounded up) before any branches off another: 3 cracks = 2 places
      siteGap: 14,                    // min tiles (manhattan) between separate crack centres (was 8 in the smaller rooms)
      segHeal: 0.01,                  // heal (fraction of max HP) each time a segment goes dark
      aliveThreat: 1.85,              // monsters alive from the network at once: up to this x one crack's budget (step big rooms: was 1.4; with the bigger budgets about +45 % alive at once)
      firstDelay: 1.2,
      openTime: 1.0, closeTime: 1.0, superOpenTime: 1.8, superCloseTime: 1.6,
      spawnEvery: 0.9, superSpawnEvery: 0.35,      // s between two network spawns (step 10: 0.3 -> 1.3; step big rooms: 1.3 -> 0.9 and 0.5 -> 0.35, so +45 % monsters come in about the same time)
      closeExp: 5, closeHeal: 0.03, superHeal: 0.08
    },

    loot: {
      // chance that a kill / closure drops gear
      killGear: 0.02, eliteGear: 0.3, closeGear: 0.2, superGear: 0.6,
      superTome: 0.3, killTome: 0.003, healOrb: 0.035, healOrbPct: 0.06,
      // Scroll of Identification: chance per kill (monster / elite / boss), per chest opened, per super fissure closed. The door loot bonus
      // multiplies the kill and closure chances. Found scrolls go to the sealed scroll count of the run (banked on leave / win, lost on death).
      killScroll: 0.0035, eliteScroll: 0.1, bossScroll: 1, chestScroll: 0.22, superScroll: 0.2, scrollCap: 99,
      unidentifiedFrom: 1,            // items of this rarity or higher drop unidentified (stats hidden until a scroll is used)
      chestItems: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      // rarity weights: common, magic, rare, epic, legendary
      rarity: [62, 26, 9, 2.5, 0.5],
      // rarity "luck" by source: shifts weight toward the right
      luck: { kill: 0, close: 0.2, elite: 0.4, super: 0.6, chest: 0.8, boss: 1.2 },
      bagSize: 20,                    // the sealed bag of one run (items picked up in the run)
      stashSize: 30,                  // the bag kept between runs (equip and discard there)
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
      cap: { movePct: 30, cdrPct: 45, crit: 60 },
      // The starter weapon (step gear data): every new character starts with one common weapon of its class's own type (the class's
      // defaultWeapon, else its first loot.weaponTypes entry), identified and worn, and no armour. Fixed, not rolled: `stats` is the
      // weakest roll the generator gives a common weapon of item level 1 (implicit dmgPct 5 x 0.85, rounded = 4). names: the item's
      // English name by weapon type (Spanish: 'starter.<type>' in src/i18n.js); a type without a name gets the generator's common name.
      starter: { ilvl: 1, rarity: 0, stats: { dmgPct: 4 }, names: { staff: 'Apprentice Staff', sword: 'Worn Sword', bow: 'Training Bow' } }
    },

    // ---------------------------------------------------------------- economy (step 7)
    // Spec: docs/specs/economy.md. Written by the design session; the sim does not read this table yet (nothing here changes a run
    // until the implementation session wires it in). Gold, sell prices, the town shop, item upgrades, permanent ranks, the merchant.
    // Everything is per class (like gear, the kept bag and scrolls): save.gears[cls].gold, .ranks, .shop.
    economy: {
      // Gold is credited the moment it is earned (no pickup, no rng): amount = base x room[roomIndex] x (1 + door x lootBonus).
      // Fractions accumulate (sim.goldFrac), whole coins go to the sealed run gold (sim.gold). Sealed like the bag: banked on leave / win,
      // lost on death (deathKeeps = share kept on death; 0 like items). None in the test room.
      gold: {
        kill: 0.3,                    // per point of the killed monster's threat (imp 1, skeleton 2, hound 3, cultist 3, warden 8, tyrant 40)
        close: 1.5,                   // a normal fissure closed
        superClose: 6,                // the super fissure closed
        chest: 8,                     // the room's chest opened
        boss: 50,                     // extra when the boss dies (on top of its kill gold)
        room: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0],   // x per room
        door: 1,                      // share of the door's loot bonus that also applies to gold (1: a +25 % door pays +25 % gold)
        deathKeeps: 0,
        cap: 999999                   // kept gold per class
      },
      // sell price = round(base[rarity] x (1 + ilvl x (item level - 1)) x (unid if unidentified)), at least min. Scrolls sell for `scroll`.
      sell: { base: [3, 8, 20, 50, 120], ilvl: 0.25, unid: 0.4, min: 1, scroll: 5 },
      // The town shop (on the title screen until step 8 builds the town). Stock: one item per entry of `rarities`, rolled when the stock
      // is (re)made, after every run of the class. Item level = 1 + ilvlAdd (= 2). Price = the identified sell price x buyMult. HARD RULE: no item above maxRarity is ever sold
      // (rare, epic and legendary only drop). Scrolls of Identification: unlimited, `scroll` gold each.
      // User decision 2026-11-11: one RARE entry (the 7th) at rareBuyMult x the identified sell price = 250 (5x the magic item of the shop, 10x what it sells for). maxRarity 2: epic and legendary are refused in the code; maxRare: rares in stock.
      shop: { rarities: [0, 0, 0, 0, 1, 1, 2], maxRarity: 2, maxRare: 1, ilvlAdd: 1, buyMult: 5, rareBuyMult: 10, scroll: 15 },
      // Upgrade a found, identified item by +1 item level (stats rescale from the values at the drop; power and gear score follow).
      // cost = round(cost[rarity] x (1 + ilvl x (item level - 1)) x (1 + grow x upgrades done)). max: upgrades per item, by rarity.
      // Shop items cannot be upgraded.
      upgrade: { cost: [20, 40, 80, 160, 320], ilvl: 0.25, grow: 0.5, max: [1, 2, 3, 3, 3] },
      // Permanent ranks bought with gold, per class. Each adds `per` x rank to `stat` (the item / ability stat keys), added to gear and
      // ability stats in G.computeStats. cost[r] = gold for rank r + 1 (length = max rank). They do not count for families or gear score.
      rankCost: [40, 90, 160, 250, 360],
      ranks: {
        vitality: { name: 'Vitality', stat: 'hp',     per: 6, text: '+6 max HP' },
        might:    { name: 'Might',    stat: 'dmgPct', per: 3, text: '+3 % damage' },
        haste:    { name: 'Haste',    stat: 'atkPct', per: 2, text: '+2 % attack speed' },
        guard:    { name: 'Guard',    stat: 'armor',  per: 3, text: '+3 armor' },
        insight:  { name: 'Insight',  stat: 'expPct', per: 4, text: '+4 % EXP gain' }
      },
      // The merchant: a rare room feature. Present in room index i (lo <= i <= hi) when hash32(seed, 6060 + i * 37) / 2^32 < chance,
      // at most maxPerRun per run (G.merchantRooms). Stands on the first open floor tile of `spots` (tile offsets from the start tile).
      // Opened with a tap within talkR px: the run pauses (state 'merchant'). Paid from the run's sealed gold only.
      // What is bought is sealed like what is found (scrolls banked on leave / win, lost on death); a potion heals at once.
      merchant: {
        chance: 0.15, lo: 1, hi: 8, maxPerRun: 2, talkR: 22,
        spots: [[2, 0], [-2, 0], [2, -1], [-2, -1], [0, -2], [0, 2]],
        scroll: { price: 25, stock: 3 },
        potion: { price: 30, stock: 2, heal: 0.4 }
      },
      // Don Montoto (step 8): the old man in the cage. He is in his cage from the start of room `room` (index 4 = room 5) of every run until the character has
      // rescued him; the cage opens once the room is clear (super fissure closed). spots: tile offsets from the start tile (first open floor tile not on the
      // merchant); freeR: tap / key reach in px. Saved per character: gear.city.montoto. In the city he tells stories and identifies the kept bag, both free.
      montoto: { room: 4, freeR: 22, spots: [[-2, 1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]] }
    },


    // ---------------------------------------------------------------- abilities (step 5)
    // The ability system: docs/specs/abilities.md. Every class uses it (level-ups roll from `abilities`).
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
                     fx: [{ k: 'chain', on: 'strike', jumps: [2, 3, 4], r: 90, dmg: [0.9, 1.05, 1.2], fall: 0.85 }] },   // tuned in batch A: r 60 -> 90, dmg x1.5
      mg_twin:     { grp: 'mage', fam: 'storm', type: 'active', rarity: 1, w: 6, max: 3, name: 'Twin Cast',
                     desc: '{0.chance%}% chance to cast again at once ({0.dmg%}% damage)',
                     fx: [{ k: 'echo', on: 'attack', chance: [0.3, 0.45, 0.6], delay: 0.12, dmg: 1.0 }] },   // tuned in batch A: chance x1.5, dmg 0.8 -> 1.0
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
                     fx: [{ k: 'dot', on: 'hit', dot: 'bleed', dps: [0.14, 0.17, 0.2], stacks: 3, t: 3 }] },
      wr_drain:    { grp: 'warrior', fam: 'blood', type: 'active', rarity: 1, w: 6, max: 3, name: 'Blood Drinker',
                     desc: 'Heal {0.pct%}% of damage dealt by swings. +{s.hp} max HP',
                     stats: { hp: [10, 20, 30] },
                     fx: [{ k: 'leech', on: 'hit', pct: [0.015, 0.02, 0.03] }] },
      wr_frenzy:   { grp: 'warrior', fam: 'blood', type: 'active', rarity: 2, w: 3, max: 3, name: 'Frenzy',
                     desc: 'Kills give +{0.v}% attack speed for {0.t} s (stacks {0.stacks}x)',
                     fx: [{ k: 'buff', on: 'kill', stat: 'atkPct', v: [3, 4, 5], stacks: 5, t: 4 }] },
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
      wr_p_iron:   { grp: 'warrior', fam: 'blood', type: 'passive', rarity: 0, w: 9, max: 4, name: 'Iron Body', desc: '+{s.hp} max HP', stats: { hp: [15, 30, 45, 60] } },
      wr_p_berserk: { grp: 'warrior', fam: 'blood', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Berserker', desc: '+{s.lowHpPct}% damage while under half HP', stats: { lowHpPct: [20, 35, 50] } },
      wr_p_wind:   { grp: 'warrior', fam: 'blood', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Second Wind', desc: '+{s.regen} HP per second', stats: { regen: [0.5, 1, 1.5] } },
      wr_p_smolder: { grp: 'warrior', fam: 'fire', type: 'passive', rarity: 1, w: 6, max: 3, name: 'Smoldering Steel', desc: '+{s.dotPct}% burn and bleed damage', stats: { dotPct: [20, 40, 60] } },
      wr_p_wild:   { grp: 'warrior', fam: 'fire', type: 'passive', rarity: 0, w: 6, max: 3, name: 'Wildfire', desc: '+{s.areaPct}% area of explosions and zones', stats: { areaPct: [12, 24, 36] } },
      wr_p_fury:   { grp: 'warrior', fam: 'fire', type: 'passive', rarity: 1, w: 5, max: 3, name: 'Blazing Fury', desc: '+{s.fxPct}% ability effect damage', stats: { fxPct: [12, 24, 36] } },
      wr_p_quick:  { grp: 'warrior', fam: 'storm', type: 'passive', rarity: 0, w: 10, max: 5, name: 'Quick Strikes', desc: '+{s.atkPct}% attack speed', stats: { atkPct: [8, 16, 24, 32, 40] } },
      wr_p_charge: { grp: 'warrior', fam: 'storm', type: 'passive', rarity: 0, w: 7, max: 3, name: 'Charge Mastery', desc: '-{s.dodgeCdPct}% charge cooldown', stats: { dodgeCdPct: [15, 30, 45] } },
      wr_p_crit:   { grp: 'warrior', fam: 'storm', type: 'passive', rarity: 1, w: 6, max: 4, name: 'Killer Instinct', desc: '+{s.crit}% crit chance', stats: { crit: [4, 8, 12, 16] } },

      // ===== ARCHER: long-range hunter, few strong arrows that pierce. Venom, Steel, Frost, Storm =====
      ar_poison:   { grp: 'archer', fam: 'venom', type: 'active', rarity: 0, w: 10, max: 3, name: 'Poison Tips',
                     desc: 'Arrows poison: {0.dps%}% of the hit per second per stack, {0.stacks} stacks, {0.t} s',
                     fx: [{ k: 'dot', on: 'hit', dot: 'poison', dps: [0.18, 0.24, 0.3], stacks: 4, t: 4 }] },
      ar_cloud:    { grp: 'archer', fam: 'venom', type: 'active', rarity: 1, w: 6, max: 3, name: 'Toxic Cloud',
                     desc: '{0.chance%}% chance: a toxic cloud on the target, {0.dps%}% per second, poisons',
                     fx: [{ k: 'zone', on: 'strike', chance: [0.3, 0.35, 0.4], at: 'target', r: 28, t: 4, dps: [0.4, 0.52, 0.65], apply: { poison: { dps: 0.1, stacks: 4, t: 3 } } }] },
      ar_plague:   { grp: 'archer', fam: 'venom', type: 'active', rarity: 2, w: 3, max: 3, name: 'Plague Arrow',
                     desc: 'Kills burst into poison: {0.dmg%}% in radius {0.r}, poisons',
                     fx: [{ k: 'burst', on: 'kill', at: 'target', r: 36, dmg: [0.4, 0.55, 0.7], knock: 0, apply: { poison: { dps: 0.12, stacks: 4, t: 4 } } }] },
      ar_ricochet: { grp: 'archer', fam: 'steel', type: 'active', rarity: 0, w: 10, max: 3, name: 'Ricochet', only: 'bolt',
                     desc: 'Arrows bounce to {0.n} more enemies ({0.fall%}% damage each bounce)',
                     fx: [{ k: 'bounce', n: [2, 3, 4], r: 100, fall: 1.0 }] },
      ar_mark:     { grp: 'archer', fam: 'steel', type: 'active', rarity: 1, w: 6, max: 3, name: 'Hunter\'s Mark',
                     desc: 'The first enemy hit is marked: +{0.pct%}% damage taken for {0.t} s',
                     fx: [{ k: 'mark', on: 'strike', pct: [0.25, 0.35, 0.5], t: 4 }] },
      ar_split:    { grp: 'archer', fam: 'steel', type: 'active', rarity: 1, w: 6, max: 3, name: 'Split Shot', only: 'bolt',
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
    // career policy (tools/sim_bot.js --career): leave after a room when HP is under lowHp of max, or when the room reached is at or
    // beyond a target that starts at startRoom and rises by step after every run that ends in an extraction (leave or win), up to cap.
    // Balance pass 2026-11-11: at the target it pushes on instead when HP >= pushHp of max and the gear score
    // is >= pushGear x the next room's number (1-based), checked again after every room (like a player who feels strong).
    // shop policy (step 7, docs/specs/economy.md "Bot policy"): rankOrder = tie-break order of ranks; potionHp: buy a merchant potion
    // when HP is under this share of max; baseItemMax: buy at most this many shop items per visit.
    // step 10: career step 1 -> 2 (a player who got out of room N at full health aims two rooms deeper next time, not one)
    bot: { reactionTicks: 12, career: { startRoom: 3, step: 2, cap: 10, lowHp: 0.4, pushHp: 0.7, pushGear: 6 },
           shop: { rankOrder: ['vitality', 'might', 'haste', 'guard', 'insight'], potionHp: 0.5, baseItemMax: 2 } },

    // Daily challenge (step 10, src/sim/daily.js). The UTC date gives the seed, the class and the door taken after each room (salt: mixed into
    // the date hash). kit: the fixed starting gear (slot, rarity) at item level kitIlvl, identified and worn; scrolls: scrolls of Identification
    // to start with. Nothing of the daily run is banked into the save. score = room x rooms cleared + kill x kills, and for a win: win +
    // perSecond x every second under par (game time).
    daily: {
      salt: 1010,
      kit: [{ slot: 'weapon', rarity: 1 }, { slot: 'armor', rarity: 0 }, { slot: 'boots', rarity: 0 }],
      kitIlvl: 2, scrolls: 2,
      score: { room: 1000, kill: 10, win: 5000, par: 900, perSecond: 5 }
    },

    fx: { shakeCap: 5, shakeDecay: 9 },   // max shake offset in art px at 100 %
    softlockSeconds: 400
  };
})(globalThis.G = globalThis.G || {});
