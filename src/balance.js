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

    player: {
      r: 5, hp: 100, speed: 78,
      dmg: 10, atkInterval: 0.5, range: 112, boltSpeed: 250, boltR: 3,
      crit: 0.05, critMult: 1.8, sideBoltDmg: 0.6,
      dodgeDist: 54, dodgeTime: 0.16, dodgeIframes: 0.34, dodgeCd: 1.6,
      pulseDmg: 26, pulseRadius: 54, pulseCd: 7, pulseKnock: 200,
      hurtIframes: 0.3, pickupR: 36, levelHeal: 0.03,
      blockedEvery: 0.4               // s between two 'blocked' events while the mage pushes into an open crack
    },

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
      bagSize: 20
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

    // QA bot only (not game difficulty): how often it re-decides in a fight. 12 ticks = 0.2 s,
    // roughly a human reaction time. 1 would be a frame-perfect player.
    bot: { reactionTicks: 12 },

    fx: { shakeCap: 5, shakeDecay: 9 },   // max shake offset in art px at 100 %
    softlockSeconds: 400
  };
})(globalThis.G = globalThis.G || {});
