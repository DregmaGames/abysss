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

  // ---- material of the armour pieces (step gear data; table and tuning hook: B.items.material)
  var MAT_ROLL = 0x4d415431, MAT_OLD = 0x4d415430;      // salts of the two side streams
  function matOk(m) { return m === 0 || m === 1 || m === 2; }
  G.hasMat = function (B, slot) { return B.items.material.slots.indexOf(slot) >= 0; };
  // The material of a new item. It is NOT drawn from the item's stream: it comes from a side stream seeded with the stream's state at
  // that moment (hash of rng.s), so the stream does not advance and every other roll of every existing seed stays what it was.
  G.rollMat = function (rng, B) { return new G.RNG(G.hash32(rng.s >>> 0, MAT_ROLL)).weighted(B.items.material.weights); };
  // The material of an item from before materials existed: from its id (stable across loads; written into the item on load).
  G.matOfId = function (id, B) { return new G.RNG(G.hash32(id >>> 0, MAT_OLD)).weighted(B.items.material.weights); };
  // the stat multiplier of a material (all 1 today: cosmetic)
  G.matStatMult = function (B, mat, stat) {
    var M = B.items.material, by = M.statMultBy[mat];
    return by && by[stat] !== undefined ? by[stat] : M.statMult[mat];
  };
  // the English name an item is stored with (the same parts G.itemName assembles in src/i18n.js): [adjective] base
  function storedName(it, B, noMat) {
    var wd = null, WT = B.loot.weaponTypes, i, keys = Object.keys(it.stats || {});
    for (i = 0; i < WT.length; i++) if (it.wtype && WT[i].id === it.wtype) wd = WT[i];
    var base = wd ? (it.rarity >= 2 && wd.itemRare ? wd.itemRare : wd.item) : (!noMat && matOk(it.mat) && G.hasMat(B, it.slot) ? B.items.material.base[it.slot][it.mat] : BASE_NAME[it.slot]);
    return (it.rarity === 0 ? (!wd || wd.worn ? 'Worn ' : '') : (PREFIX[keys[1]] ? PREFIX[keys[1]] + ' ' : '')) + base;
  }
  // An item from an old save, an old export code or old shop stock: gives it its material (helmet, armor, shield, gloves, boots) from its
  // id, and its stored English name when that was the generator's old name. Other slots never carry one. Returns true when it changed.
  G.fillMat = function (it, B) {
    if (!it) return false;
    if (!G.hasMat(B, it.slot)) { if (it.mat === undefined) return false; delete it.mat; return true; }
    if (matOk(it.mat)) return false;
    var old = storedName(it, B, true);
    it.mat = G.matOfId(it.id, B);
    if (it.name === old) it.name = storedName(it, B);
    return true;
  };
  // What the view draws on the hero (pure): the material and rarity of each visible piece that is worn, and the weapon.
  //   { armor, helmet, shield, gloves, boots: mat (0 | 1 | 2) or null when the slot is empty,
  //     rarity: { armor, helmet, shield, gloves, boots: rarity or null }, weapon: { wtype, rarity } or null }
  // A worn piece always has a material here (an item without the field gets the default of its id).
  G.LOOK_SLOTS = ['armor', 'helmet', 'shield', 'gloves', 'boots'];
  G.gearLook = function (equipped) {
    var out = { rarity: {} }, eq = equipped || {}, w = eq.weapon;
    G.LOOK_SLOTS.forEach(function (k) {
      var it = eq[k];
      out[k] = it ? (matOk(it.mat) ? it.mat : G.matOfId(it.id, G.BAL)) : null;
      out.rarity[k] = it ? it.rarity : null;
    });
    out.weapon = w ? { wtype: w.wtype || null, rarity: w.rarity } : null;
    return out;
  };

  G.rollItem = function (rng, ilvl, luck, B, gear, cls) {
    var slot = rng.pick(ITEM_SLOTS), rarity = G.rollRarity(rng, luck, B);
    // weapon drops pick their type from all types, equal weight, whatever class is played (one extra draw)
    var wd = slot === 'weapon' ? rng.pick(B.loot.weaponTypes) : null;
    return G.makeItem(rng, slot, rarity, wd, ilvl, B, gear);
  };

  // The stat roll shared by drops and the shop (step 7): shuffle, ranges, name, id. `wd`: the weapon type entry (weapons only).
  G.makeItem = function (rng, slot, rarity, wd, ilvl, B, gear) {
    var I = B.items, wtype = wd ? wd.id : null;
    var mat = G.hasMat(B, slot) ? G.rollMat(rng, B) : null;      // a side stream: the rolls below are the ones they always were
    var pool = Object.keys(I.stat), imp = I.implicit[slot], stats = {}, keys = [imp];
    pool = pool.filter(function (k) { return k !== imp; });
    rng.shuffle(pool);
    for (var i = 0; i < rarity; i++) keys.push(pool[i]);
    keys.forEach(function (k) {
      var v = I.stat[k] * (1 + I.ilvlGrow * (ilvl - 1)) * I.rarityMult[rarity] * rng.range(0.85, 1.15);
      if (mat !== null) v *= G.matStatMult(B, mat, k);      // the material hook (1 today)
      stats[k] = k === 'regen' ? Math.max(0.1, Math.round(v * 10) / 10) : Math.max(1, Math.round(v));
    });
    var base = wd ? (rarity >= 2 && wd.itemRare ? wd.itemRare : wd.item) : (mat !== null ? I.material.base[slot][mat] : BASE_NAME[slot]);
    var name = (rarity === 0 ? (!wd || wd.worn ? 'Worn ' : '') : PREFIX[keys[1]] + ' ') + base;
    var it = { id: gear.nextId++, slot: slot, rarity: rarity, ilvl: ilvl, name: name, stats: stats, power: ilvl * (2 + rarity) };
    if (wtype) it.wtype = wtype;
    if (mat !== null) it.mat = mat;
    if (rarity >= B.loot.unidentifiedFrom) it.unid = true;      // stats are rolled now, only hidden until identified (no reroll)
    return it;
  };

  // ---- the starter weapon (step gear data; numbers and names: B.items.starter)
  // the weapon type entry a class starts with: its defaultWeapon, else its first own type (null: the class has no weapon type)
  G.starterType = function (B, clsId) {
    var C = G.classDef(B, clsId), own = B.loot.weaponTypes.filter(function (w) { return w.cls === C.id; }), i;
    for (i = 0; i < own.length; i++) if (own[i].id === C.defaultWeapon) return own[i];
    return own[0] || null;
  };
  // the item itself: fixed (no rng), common, identified, flagged `starter` (its name comes from B.items.starter.names)
  G.starterWeapon = function (B, clsId, gear) {
    var S = B.items.starter, wd = G.starterType(B, clsId), stats = {}, k;
    if (!wd) return null;
    for (k in S.stats) stats[k] = S.stats[k];
    return { id: gear.nextId++, slot: 'weapon', rarity: S.rarity, ilvl: S.ilvl, name: S.names[wd.id] || ((wd.worn ? 'Worn ' : '') + wd.item), stats: stats,
      power: S.ilvl * (2 + S.rarity), wtype: wd.id, starter: true };
  };
  // Gives a character its starter weapon, once: gear.starter says the question is settled (so a sold or dropped starter never comes back).
  // A character that already wears a weapon, or keeps one its class can use in the bag (an old save), gets nothing. Returns the item or null.
  G.giveStarter = function (gear, B, clsId) {
    if (gear.starter) return null;
    gear.starter = true;
    if (gear.equipped.weapon || gear.bag.some(function (it) { return it.slot === 'weapon' && G.canEquip(it, B, clsId); })) return null;
    var top = gear.nextId > 0 ? gear.nextId : 1;      // an id no item of this character has (old saves: nextId is not trusted)
    gear.bag.concat(Object.keys(gear.equipped).map(function (k) { return gear.equipped[k]; }), gear.shop && gear.shop.stock ? gear.shop.stock : [])
      .forEach(function (it) { if (it && it.id >= top) top = it.id + 1; });
    gear.nextId = top;
    var it = G.starterWeapon(B, clsId, gear);
    if (it) gear.equipped.weapon = it;
    return it;
  };

  // A town shop item (step 7): always identified, marked src 'shop'. HARD RULE: throws above economy.shop.maxRarity (rare; never epic or better).
  G.rollShopItem = function (rng, ilvl, rarity, B, gear, clsId) {
    if (rarity > B.economy.shop.maxRarity) throw new Error('shop never sells rarity ' + rarity);
    var slot = rng.pick(ITEM_SLOTS), wd = null;
    if (slot === 'weapon') {
      var own = B.loot.weaponTypes.filter(function (w) { return w.cls === G.classDef(B, clsId).id; });
      wd = rng.pick(own);
    }
    var it = G.makeItem(rng, slot, rarity, wd, ilvl, B, gear);
    delete it.unid; it.src = 'shop';
    return it;
  };

  // atlas frame of an item's icon: a typed weapon has its own
  // the class that can equip a weapon type (null: any; non-weapons are usable by every class)
  G.weaponClass = function (B, wtype) {
    var WT = B.loot.weaponTypes;
    for (var i = 0; i < WT.length; i++) if (WT[i].id === wtype) return WT[i].cls;
    return null;
  };
  G.canEquip = function (item, B, clsId) {
    var c = item && item.slot === 'weapon' && item.wtype ? G.weaponClass(B, item.wtype) : null;
    return !c || c === G.classDef(B, clsId).id;
  };
  // identification (step 6b): an item with `unid` set shows its type, name and rarity but not its stats, and cannot be equipped.
  // Items without the flag (commons, everything from old saves) are identified.
  G.isUnid = function (item) { return !!(item && item.unid); };
  G.canEquipNow = function (item, B, clsId) { return !!item && !item.unid && G.canEquip(item, B, clsId); };
  // scrolls kept for a class: gear.scrolls. A scroll is spent from `sealed` first (lost on death), then from the kept ones.
  G.useScroll = function (gear, sealed) {
    if (sealed > 0) return 'sealed';
    if ((gear.scrolls | 0) > 0) { gear.scrolls--; return 'kept'; }
    return null;
  };
  // between runs: identify the item at gear.bag[idx] with a kept scroll
  G.identifyInBag = function (gear, idx) {
    var it = gear.bag[idx];
    if (!it || !it.unid || (gear.scrolls | 0) < 1) return false;
    gear.scrolls--; it.unid = false;
    return true;
  };
  // "Warrior weapon" for a weapon only another class can use, else null
  G.foreignClass = function (item, B, clsId) {
    if (G.canEquip(item, B, clsId)) return null;
    return B.classes[G.weaponClass(B, item.wtype)].name;
  };

  G.itemIcon = function (item) { return 'i_' + (item.wtype ? 'weapon_' + item.wtype : item.slot); };

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

  G.gearStats = function (gear, B, clsId) {
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

  G.equipFromBag = function (gear, idx, B, clsId) {
    var item = gear.bag[idx];
    if (!G.canEquipNow(item, B, clsId)) return null;
    var key = G.targetSlot(gear, item, B), old = gear.equipped[key];
    gear.equipped[key] = item;
    if (old) gear.bag[idx] = old; else gear.bag.splice(idx, 1);
    return key;
  };

  G.unequip = function (gear, key, B) {
    var it = gear.equipped[key];
    if (!it || gear.bag.length >= B.loot.stashSize) return false;
    gear.equipped[key] = null;
    gear.bag.push(it);
    return true;
  };

  // bag outcomes of a run (step 6). The sealed bag of a run goes into the kept bag (gear.bag) on leaving or winning,
  // best items first while there is room; what does not fit is lost. Returns { kept, lost }.
  G.bankItems = function (gear, items, B) {
    var order = items.slice().sort(function (a, b) { return G.itemValue(b, B) - G.itemValue(a, B) || a.id - b.id; }), kept = 0;
    order.forEach(function (it) { if (gear.bag.length < B.loot.stashSize) { gear.bag.push(it); kept++; } });
    return { kept: kept, lost: items.length - kept };
  };
  // banks the sealed scroll count into the kept one (cap B.loot.scrollCap); returns how many were kept
  G.bankScrolls = function (gear, n, B) {
    var have = gear.scrolls | 0, now = Math.min(B.loot.scrollCap, have + n);
    gear.scrolls = now;
    return now - have;
  };
  // best rarity in a list of items (-1 when empty)
  G.bestRarity = function (items) {
    var b = -1;
    for (var i = 0; i < items.length; i++) if (items[i].rarity > b) b = items[i].rarity;
    return b;
  };

  // The doors offered after room N: two different modifiers, a pure function of the run seed and N.
  G.doorsFor = function (seed, roomIndex, B) {
    var ids = Object.keys(B.doors.mods), rng = new G.RNG(G.hash32(seed >>> 0, 5150 + roomIndex * 31));
    rng.shuffle(ids);
    return ids.slice(0, B.doors.offer || 2);
  };
  // the modifier for `id` (null for none)
  G.doorMod = function (B, id) { return id ? B.doors.mods[id] || null : null; };
  // what a door does, in words, built from its numbers: [text, ...]
  G.doorEffects = function (B, id) {
    var m = G.doorMod(B, id), out = [];
    if (!m) return out;
    function pct(x) { return Math.round(Math.abs(x - 1) * 100) + '%'; }
    if (m.crackLen) out.push('Cracks ' + pct(m.crackLen) + ' ' + (m.crackLen > 1 ? 'longer' : 'shorter'));
    if (m.extraCracks) out.push(m.extraCracks > 0 ? '+' + m.extraCracks + ' crack' + (m.extraCracks > 1 ? 's' : '') : m.extraCracks + ' cracks');
    if (m.spawnEvery) out.push('Monsters come ' + (m.spawnEvery < 1 ? Math.round((1 / m.spawnEvery - 1) * 100) + '% faster' : pct(m.spawnEvery) + ' slower'));
    if (m.aliveThreat) out.push(pct(m.aliveThreat) + ' ' + (m.aliveThreat > 1 ? 'more' : 'fewer') + ' monsters alive at once');
    if (m.extraElite) out.push('An extra ' + m.extraElite + ' in the super fissure');
    if (m.threat) out.push('Monsters ' + pct(m.threat) + ' ' + (m.threat > 1 ? 'stronger' : 'weaker'));
    return out;
  };

  G.dropFromBag = function (gear, idx) { return gear.bag.splice(idx, 1)[0] || null; };
})(globalThis.G = globalThis.G || {});
