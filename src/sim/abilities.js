// Abilities (docs/specs/abilities.md): data helpers, family bonuses, stats, offers and the 1-of-3 roll.
// Pure functions of the balance table and the player's `abil` map ({ id: rank }); no sim state here.
(function (G) {
  // a plain number is the same at every rank; an array holds the total at each rank
  G.rk = function (v, rank) { return Array.isArray(v) ? v[Math.min(rank, v.length) - 1] : v; };

  // the class group of a class: its own id unless `group` says otherwise
  G.groupOf = function (C) { return C.group || C.id; };

  // the offer pool of a class: its group's abilities in table order, then the shared ones.
  // `only` (bolt / arc) leaves out abilities that do not fit the attack kind.
  G.abilityPool = function (B, clsId) {
    var C = G.classDef(B, clsId), grp = G.groupOf(C), kind = C.attack.kind, out = [], ids = Object.keys(B.abilities), pass, i;
    for (pass = 0; pass < 2; pass++) for (i = 0; i < ids.length; i++) {
      var d = B.abilities[ids[i]];
      if (d.grp !== (pass ? 'shared' : grp) || (d.only && d.only !== kind)) continue;
      out.push(ids[i]);
    }
    return out;
  };

  // an ability's numbers at a rank (and weapon type), ranks and `wpn` overrides resolved
  G.resolveAbility = function (B, id, rank, wtype) {
    var d = B.abilities[id], wp = wtype && d.wpn && d.wpn[wtype], out = { stats: {}, fx: [] }, k;
    if (d.stats) for (k in d.stats) out.stats[k] = G.rk(wp && wp[k] !== undefined ? wp[k] : d.stats[k], rank);
    if (d.fx) d.fx.forEach(function (f) {
      var r = {};
      for (k in f) r[k] = k === 'apply' ? f[k] : G.rk(wp && wp[k] !== undefined ? wp[k] : f[k], rank);
      out.fx.push(r);
    });
    return out;
  };

  // family -> number of owned abilities (actives in slots and passives at rank >= 1, one each)
  G.familyCounts = function (abil, B) {
    var out = {}, id;
    for (id in abil) if (abil[id] > 0 && B.abilities[id]) { var f = B.abilities[id].fam; out[f] = (out[f] || 0) + 1; }
    return out;
  };
  // 0, 1 (small bonus) or 2 (small + large) for n owned
  G.famTier = function (n, B) {
    var T = B.abilityRules.famTiers;
    return n >= T[1] ? 2 : (n >= T[0] ? 1 : 0);
  };

  // summed stats of all owned abilities (table order) plus the reached family tiers
  G.abilityStats = function (abil, B, wtype) {
    var out = {}, ids = Object.keys(B.abilities), i, k, counts = G.familyCounts(abil, B);
    function add(st) { for (k in st) out[k] = (out[k] || 0) + st[k]; }
    for (i = 0; i < ids.length; i++) if (abil[ids[i]] > 0) add(G.resolveAbility(B, ids[i], abil[ids[i]], wtype).stats);
    Object.keys(B.families).forEach(function (fam) {
      var t = G.famTier(counts[fam] || 0, B), F = B.families[fam];
      if (t >= 1 && F.t2.stats) add(F.t2.stats);
      if (t >= 2 && F.t4.stats) add(F.t4.stats);
    });
    return out;
  };

  function num(v) { return v === Math.floor(v) ? '' + v : (Math.round(v * 10) / 10).toFixed(1); }

  // fills a description template: {s.key} = stat at the shown rank, {i.key} = field of fx[i], {i.key%} = that x 100
  G.fillDesc = function (tpl, R) {
    return tpl.replace(/\{(s|\d+)\.(\w+)(%?)\}/g, function (all, src, key, pct) {
      var v = src === 's' ? R.stats[key] : (R.fx[+src] || {})[key];
      if (v === undefined) return '?';
      return pct ? num(Math.round(v * 100)) : num(v);
    });
  };

  // card data for an ability at the rank the player would have after taking it
  G.abilityInfo = function (id, B, rank, clsId, wtype) {
    var d = B.abilities[id], R = G.resolveAbility(B, id, Math.max(1, rank), wtype), F = B.families[d.fam];
    var desc = G.fillDesc(d.desc, R);
    return { id: id, name: d.name, fam: d.fam, famName: F.name, type: d.type, rarity: d.rarity, max: d.max, rank: rank, desc: desc };
  };
  G.famInfo = function (fam, B) { var F = B.families[fam]; return { name: F.name, icon: F.icon, text: F.text, t2: F.t2, t4: F.t4 }; };

  G.ABILITY_RARITY = ['Common', 'Rare', 'Epic'];
  G.ABILITY_COLOR = ['r_common', 'r_rare', 'r_epic'];

  // Up to `cards` distinct ids (spec section 4): card 1 an active, card 2 a passive, then either.
  // The only random source is `rng` (the level-up stream).
  G.rollAbilities = function (rng, player, B, pool, tome) {
    var R = B.abilityRules, owned = player.abil, counts = G.familyCounts(owned, B), used = 0, i;
    for (i = 0; i < player.slots.length; i++) if (player.slots[i]) used++;
    var full = used >= R.slots;
    var elig = pool.filter(function (id) {
      var d = B.abilities[id];
      return (owned[id] || 0) < d.max && !(d.rarity === 2 && player.level < R.epicMinLevel);
    });
    function weight(id) {
      var d = B.abilities[id], w = d.w;
      if (owned[id]) w *= R.ownedMult;
      if (counts[d.fam]) w *= R.familyMult;
      if (full && d.type === 'active' && !owned[id]) w *= R.fullSlotNewMult;
      if (tome && d.rarity >= 1) w *= R.tomeRareMult;
      return w;
    }
    var out = [];
    function draw(list) {
      if (!list.length) return;
      var k = rng.weighted(list.map(weight)), id = list[k];
      out.push(id);
      elig.splice(elig.indexOf(id), 1);
    }
    draw(elig.filter(function (id) { return B.abilities[id].type === 'active'; }));
    draw(elig.filter(function (id) { return B.abilities[id].type === 'passive'; }));
    while (out.length < R.cards && elig.length) draw(elig);
    return out;
  };
})(globalThis.G = globalThis.G || {});
