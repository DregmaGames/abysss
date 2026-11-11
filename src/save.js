// Persistence: gear and settings survive between runs (localStorage); level and abilities do not.
(function (G) {
  var KEY = 'riftscar.save.v2';
  var SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'belt', 'weapon', 'shield'];
  G.SLOTS = SLOTS;
  // One gear set per class: { equipped: {slot: item|null}, bag: [kept items], nextId }. Created on first use for any class id.
  G.newGear = function () {
    var eq = {};
    SLOTS.forEach(function (s) { eq[s] = null; });
    return { equipped: eq, bag: [], nextId: 1, scrolls: 0, gold: 0, ranks: {}, shop: null, city: { appraiser: false } };
  };
  G.newSave = function () {
    return { v: 7, gears: {}, settings: { zoom: 0, shake: 100 }, stats: { runs: 0, wins: 0, best: 0 } };
  };
  // the gear (worn items and kept bag) of a class; the sim takes this object as its `gear` option
  G.gearOf = function (save, clsId) {
    var id = G.classDef(G.BAL, clsId).id;
    if (!save.gears[id]) save.gears[id] = G.newGear();
    return save.gears[id];
  };
  G.loadSave = function () {
    try {
      var raw = globalThis.localStorage && localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw), d = G.newSave(), B = G.BAL;
        var ok = function (it) { return it && typeof it === 'object' && SLOTS.indexOf(it.slot) >= 0 && it.stats && typeof it.rarity === 'number'; };
        if (s && (s.v === 4 || s.v === 5 || s.v === 6 || s.v === 7) && s.gears && typeof s.gears === 'object') {
          Object.keys(s.gears).forEach(function (id) {       // v4: sanitize each class's gear
            var g = s.gears[id], n = G.newGear();
            if (!B.classes[id] || !g || typeof g !== 'object') { delete s.gears[id]; return; }
            n.bag = (Array.isArray(g.bag) ? g.bag : []).filter(ok);
            SLOTS.forEach(function (k) { n.equipped[k] = g.equipped && ok(g.equipped[k]) ? g.equipped[k] : null; });
            n.nextId = g.nextId > 0 ? g.nextId : 1;
            n.scrolls = g.scrolls > 0 ? Math.min(Math.floor(g.scrolls), B.loot.scrollCap) : 0;      // v4 -> v5: scrolls start at 0; items without `unid` are identified
            var E = B.economy;      // v6: gold, ranks and the shop stock (older saves start with 0 gold, no ranks and no stock: nothing is lost)
            n.gold = g.gold > 0 ? Math.min(Math.floor(g.gold), E.gold.cap) : 0;
            Object.keys(g.ranks && typeof g.ranks === 'object' ? g.ranks : {}).forEach(function (r) {
              var v = Math.floor(+g.ranks[r]);
              if (E.ranks[r] && v > 0) n.ranks[r] = Math.min(v, E.rankCost.length);
            });
            var sh = g.shop;
            n.shop = sh && sh.rolls >= 0 && Array.isArray(sh.stock) && sh.stock.length === E.shop.rarities.length &&
              sh.stock.every(function (it) { return it === null || ok(it); }) ? { rolls: Math.floor(sh.rolls), stock: sh.stock } : null;
            n.city.appraiser = !!(g.city && g.city.appraiser === true);      // v7: city state per character (v6 and older: not rescued yet; nothing else changes)
            s.gears[id] = n;
          });
          s.v = 7;
          s.settings = Object.assign(d.settings, s.settings || {});
          s.stats = Object.assign(d.stats, s.stats || {});
          return s;
        }
        // v2 / v3 -> v4 (per-class gear): the one shared gear set (worn items + kept bag) goes whole to the class that was selected
        // in that save (settings.cls, default mage); the other classes start empty. Nothing is dropped except entries that are not
        // items (an old bag over the stash size stays whole: banking waits until there is room). A worn weapon the selected class cannot use is moved into its bag (over the stash size if need be) so no item is lost.
        if (s && (s.v === 2 || s.v === 3) && s.gear && s.gear.equipped) {
          var cls = G.classDef(B, s.settings && s.settings.cls).id, g0 = G.newGear(), old = s.gear;
          g0.bag = (Array.isArray(old.bag) ? old.bag : []).filter(ok);
          SLOTS.forEach(function (k) {
            var it = old.equipped[k];
            if (!ok(it)) return;
            if (G.canEquip(it, B, cls)) g0.equipped[k] = it; else g0.bag.push(it);
          });
          var top = old.nextId > 0 ? old.nextId : 1;
          g0.bag.concat(SLOTS.map(function (k) { return g0.equipped[k]; })).forEach(function (it) { if (it && it.id >= top) top = it.id + 1; });
          g0.nextId = top;
          d.gears[cls] = g0;
          d.settings = Object.assign(d.settings, s.settings || {});
          d.stats = Object.assign(d.stats, s.stats || {});
          return d;
        }
      }
    } catch (e) { /* corrupt or unavailable storage: start fresh */ }
    return G.newSave();
  };
  G.storeSave = function (save) {
    try { if (globalThis.localStorage) localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage full or blocked */ }
  };
})(globalThis.G = globalThis.G || {});
