// The one balance file. Every tunable number lives here; the sim reads nothing else.
// Units: art pixels (1 tile = 16 px), seconds, HP.
(function (G) {
  G.BAL = {
    TILE: 16,
    DT: 1 / 60,

    run: {
      rooms: 4,                       // last room is the boss room
      tierMult: [1.0, 1.45, 2.0],     // monster hp/dmg multiplier per difficulty tier
      tierGear: [0, 40, 90],          // gear score needed to unlock each tier
      roomMult: [0.95, 1.4, 1.9, 2.6],   // monster hp/dmg multiplier per room
      gearK: 0.004,                   // +0.4 % monster hp/dmg per point of gear score
      ilvl: [[1, 1, 2, 2], [3, 3, 4, 4], [5, 5, 6, 6]]   // item level by tier, room
    },

    player: {
      r: 4.5, hp: 100, speed: 64,
      dmg: 10, atkInterval: 0.5, range: 92, boltSpeed: 210, boltR: 3,
      crit: 0.05, critMult: 1.8, sideBoltDmg: 0.6,
      dodgeDist: 46, dodgeTime: 0.16, dodgeIframes: 0.34, dodgeCd: 1.6,
      pulseDmg: 26, pulseRadius: 46, pulseCd: 7, pulseKnock: 170,
      hurtIframes: 0.3, pickupR: 30, levelHeal: 0.06
    },

    exp: { base: 9, grow: 6, pow: 1.25 },   // exp to next = base + grow * (level-1)^pow

    // threat: fissure spawn budget cost. exp: orb value.
    monsters: {
      riftling: { r: 4.5, hp: 18, speed: 70, dmg: 9, exp: 2, threat: 1, shadow: 's' },
      gazer:    { r: 5, hp: 26, speed: 30, dmg: 5, exp: 4, threat: 2, shadow: 's',
                  shotDmg: 10, shotSpeed: 85, shotEvery: 2.0, windup: 0.45, keepMin: 52, keepMax: 84, sight: 118 },
      husk:     { r: 6.5, hp: 80, speed: 30, dmg: 16, exp: 8, threat: 3, shadow: 'm',
                  lungeRange: 44, lungeWindup: 0.5, lungeSpeed: 150, lungeTime: 0.34, lungeCd: 2.6 },
      warden:   { r: 7, hp: 260, speed: 29, dmg: 12, exp: 26, threat: 8, shadow: 'm', elite: true,
                  shotDmg: 11, shotSpeed: 85, shotEvery: 2.3, windup: 0.5, spread: 0.3, summonEvery: 7, summon: 2 },
      boss:     { r: 13, hp: 1150, speed: 27, dmg: 14, exp: 120, threat: 40, shadow: 'l', boss: true,
                  chaseTime: 2.4, enrageAt: 0.4, enrageRate: 0.7,
                  slamRadius: 46, slamWindup: 0.95, slamDmg: 22,
                  burstShots: 12, burstDmg: 9, burstSpeed: 58, burstGap: 0.55,
                  summon: 3,
                  chargeWindup: 0.75, chargeSpeed: 150, chargeTime: 0.6, chargeDmg: 18 }
    },
    contactCd: 0.6,

    fissure: {
      count: [3, 4, 4, 2],            // normal fissures per room
      budget: [6, 9, 12, 8],          // threat points per normal fissure
      pool: [                         // spawn weights per room
        { riftling: 8, gazer: 2 },
        { riftling: 6, gazer: 3, husk: 2 },
        { riftling: 5, gazer: 3, husk: 3 },
        { riftling: 6, gazer: 3, husk: 1 }
      ],
      superWave: [
        ['warden', 'riftling', 'riftling', 'riftling'],
        ['warden', 'riftling', 'riftling', 'gazer', 'gazer', 'husk'],
        ['warden', 'warden', 'husk', 'riftling', 'riftling', 'gazer'],
        ['boss']
      ],
      maxActive: 2, firstDelay: 1.6, nextDelay: 5,
      openTime: 0.9, closeTime: 0.9, superOpenTime: 1.6, superCloseTime: 1.5,
      spawnEvery: 0.3, superSpawnEvery: 0.5,       // packs come out in a burst
      closeExp: 5, closeHeal: 0.04, superHeal: 0.12
    },

    loot: {
      // chance that a kill / closure drops gear
      killGear: 0.02, eliteGear: 0.35, closeGear: 0.2, superGear: 0.6,
      superTome: 0.35, killTome: 0.003, healOrb: 0.035, healOrbPct: 0.06,
      chestItems: [1, 1, 1, 2],
      // rarity weights: common, magic, rare, epic, legendary
      rarity: [62, 26, 9, 2.5, 0.5],
      // rarity "luck" by source: shifts weight toward the right
      luck: { kill: 0, close: 0.2, elite: 0.4, super: 0.6, chest: 0.8, boss: 1.2 },
      bagSize: 20
    },

    items: {
      rarityMult: [1, 1.25, 1.55, 1.9, 2.4],
      ilvlGrow: 0.22,                 // +22 % stat value per item level above 1
      // base value of each stat at ilvl 1, common
      stat: { hp: 9, dmgPct: 5, atkPct: 4, movePct: 3, armor: 4, crit: 2, rangePct: 4, pulsePct: 9, cdrPct: 4, regen: 0.3, expPct: 6 },
      implicit: { helmet: 'hp', armor: 'armor', gloves: 'atkPct', boots: 'movePct', belt: 'hp',
                  weapon: 'dmgPct', shield: 'armor', ring: 'crit', amulet: 'cdrPct' },
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
    tomeRareBoost: 2.5,               // tome picks weight rare/epic passives higher

    // QA bot only (not game difficulty): how often it re-decides in a fight. 12 ticks = 0.2 s,
    // roughly a human reaction time. 1 would be a frame-perfect player.
    bot: { reactionTicks: 12 },

    fx: { shakeCap: 4, shakeDecay: 9 },   // max shake offset in art px at 100 %
    softlockSeconds: 400
  };
})(globalThis.G = globalThis.G || {});
