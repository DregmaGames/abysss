// Gear: generation, scoring, equip rules. Pure functions over a `gear` object
// { equipped: {slotKey: item|null}, bag: [item], nextId }.
(function (G) {
  var ITEM_SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'belt', 'weapon', 'shield'];
  G.ITEM_SLOTS = ITEM_SLOTS;
  var BASE_NAME = { helmet: 'Cowl', armor: 'Robe', gloves: 'Wraps', boots: 'Treads', belt: 'Sash', weapon: 'Staff', shield: 'Ward' };
  var PREFIX = { hp: 'Stalwart', dmgPct: 'Savage', atkPct: 'Swift', movePct: 'Fleet', armor: 'Warded', crit: 'Keen',
    rangePct: 'Far', pulsePct: 'Resonant', cdrPct: 'Lucid', regen: 'Mending', expPct: 'Sage' };
  G.SLOT_NAME = { helmet: 'Helmet', armor: 'Armor', gloves: 'Gloves', boots: 'Boots', belt: 'Belt', weapon: 'Weapon',
    shield: 'Shield' };
  G.STAT_LABEL = { hp: ['Max HP', ''], dmgPct: ['Damage', '%'], atkPct: ['Atk speed', '%'], movePct: ['Move speed', '%'],
    armor: ['Armor', ''], crit: ['Crit chance', '%'], rangePct: ['Range', '%'], pulsePct: ['Pulse dmg', '%'],
    cdrPct: ['Cooldowns', '%'], regen: ['HP regen', '/s'], expPct: ['EXP gain', '%'] };
  G.STAT_ORDER = ['hp', 'armor', 'dmgPct', 'atkPct', 'crit', 'movePct', 'rangePct', 'pulsePct', 'cdrPct', 'regen', 'expPct'];

  G.rollRarity = function (rng, luck, B) {
    var w = B.loot.rarity.map(function (v, i) { return v * G.M.pow(1 + luck, i); });
    return rng.weighted(w);
  };

  G.rollItem = function (rng, ilvl, luck, B, gear) {
    var I = B.items, slot = rng.pick(ITEM_SLOTS), rarity = G.rollRarity(rng, luck, B);
    var pool = Object.keys(I.stat), imp = I.implicit[slot], stats = {}, keys = [imp];
    pool = pool.filter(function (k) { return k !== imp; });
    rng.shuffle(pool);
    for (var i = 0; i < rarity; i++) keys.push(pool[i]);
    keys.forEach(function (k) {
      var v = I.stat[k] * (1 + I.ilvlGrow * (ilvl - 1)) * I.rarityMult[rarity] * rng.range(0.85, 1.15);
      stats[k] = k === 'regen' ? Math.max(0.1, Math.round(v * 10) / 10) : Math.max(1, Math.round(v));
    });
    var name = (rarity === 0 ? 'Worn ' : PREFIX[keys[1]] + ' ') + BASE_NAME[slot];
    return { id: gear.nextId++, slot: slot, rarity: rarity, ilvl: ilvl, name: name, stats: stats, power: ilvl * (2 + rarity) };
  };

  // usefulness of an item (bot equip decisions, "better/worse" hint in the UI)
  G.itemValue = function (item, B) {
    var v = 0;
    for (var k in item.stats) v += item.stats[k] / B.items.stat[k] * B.items.weight[k];
    return v;
  };

  G.gearScore = function (gear) {
    var s = 0;
    for (var k in gear.equipped) if (gear.equipped[k]) s += gear.equipped[k].power;
    return s;
  };

  G.gearStats = function (gear) {
    var out = {};
    for (var k in gear.equipped) {
      var it = gear.equipped[k];
      if (!it) continue;
      for (var s in it.stats) out[s] = (out[s] || 0) + it.stats[s];
    }
    return out;
  };

  // which equipment slot a bag item goes into: one slot per item type
  G.targetSlot = function (gear, item) { return item.slot; };

  G.equipFromBag = function (gear, idx, B) {
    var item = gear.bag[idx];
    if (!item) return null;
    var key = G.targetSlot(gear, item, B), old = gear.equipped[key];
    gear.equipped[key] = item;
    if (old) gear.bag[idx] = old; else gear.bag.splice(idx, 1);
    return key;
  };

  G.unequip = function (gear, key, B) {
    var it = gear.equipped[key];
    if (!it || gear.bag.length >= B.loot.bagSize) return false;
    gear.equipped[key] = null;
    gear.bag.push(it);
    return true;
  };

  G.dropFromBag = function (gear, idx) { return gear.bag.splice(idx, 1)[0] || null; };
})(globalThis.G = globalThis.G || {});
