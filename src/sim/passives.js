// Level-up passives: names, descriptions (generated from the balance file), and the 1-of-3 roll.
(function (G) {
  var NAME = { power: 'Arcane Power', haste: 'Quick Cast', vital: 'Vitality', swift: 'Swiftness', range: 'Far Sight',
    wisdom: 'Wisdom', regen: 'Mending', crit: 'Keen Eye', pulse: 'Pulse Mastery', blink: 'Blink Mastery',
    ward: 'Warding', pierce: 'Piercing Bolt', multi: 'Split Bolt', leech: 'Soul Leech' };
  G.PASSIVE_RARITY = ['Common', 'Rare', 'Epic'];
  G.PASSIVE_COLOR = ['r_common', 'r_rare', 'r_epic'];
  G.passiveInfo = function (id, B) {
    var d = B.passives[id], desc;
    switch (id) {
      case 'power': desc = '+' + d.dmgPct + '% damage'; break;
      case 'haste': desc = '+' + d.atkPct + '% attack speed'; break;
      case 'vital': desc = '+' + d.hp + ' max HP'; break;
      case 'swift': desc = '+' + d.movePct + '% move speed'; break;
      case 'range': desc = '+' + d.rangePct + '% range'; break;
      case 'wisdom': desc = '+' + d.expPct + '% EXP gain'; break;
      case 'regen': desc = '+' + d.regen + ' HP per second'; break;
      case 'crit': desc = '+' + d.crit + '% crit chance'; break;
      case 'pulse': desc = '+' + d.pulsePct + '% pulse damage, -' + d.pulseCdPct + '% cooldown'; break;
      case 'blink': desc = '-' + d.dodgeCdPct + '% dodge cooldown'; break;
      case 'ward': desc = '+' + d.armor + ' armor'; break;
      case 'pierce': desc = 'Bolts pierce +' + d.pierce + ' enemy'; break;
      case 'multi': desc = '+' + d.multi + ' side bolt'; break;
      case 'leech': desc = 'Heal ' + d.leech + ' HP per kill'; break;
    }
    return { id: id, name: NAME[id], desc: desc, rarity: d.rarity, max: d.max };
  };

  // up to 3 distinct passives that are not at max level, from the class pool (default: all, table order)
  G.rollPassives = function (rng, owned, B, tome, pool) {
    var ids = (pool || Object.keys(B.passives)).filter(function (id) { return (owned[id] || 0) < B.passives[id].max; });
    var out = [];
    while (out.length < 3 && ids.length) {
      var w = ids.map(function (id) { var d = B.passives[id]; return d.w * (tome && d.rarity > 0 ? B.tomeRareBoost : 1); });
      var i = rng.weighted(w);
      out.push(ids[i]);
      ids.splice(i, 1);
    }
    return out;
  };

  G.passiveSums = function (owned, B) {
    var out = {};
    for (var id in owned) {
      var d = B.passives[id];
      for (var k in d) if (k !== 'rarity' && k !== 'max' && k !== 'w') out[k] = (out[k] || 0) + d[k] * owned[id];
    }
    return out;
  };
})(globalThis.G = globalThis.G || {});
