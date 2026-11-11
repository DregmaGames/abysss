// Persistence: gear and settings survive between runs (localStorage); level and abilities do not.
(function (G) {
  var KEY = 'riftscar.save.v2';
  var SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'belt', 'weapon', 'shield'];
  G.SLOTS = SLOTS;
  G.newSave = function () {
    var eq = {};
    SLOTS.forEach(function (s) { eq[s] = null; });
    return { v: 3, gear: { equipped: eq, bag: [], nextId: 1 }, settings: { zoom: 0, shake: 100 }, stats: { runs: 0, wins: 0, best: 0 } };
  };
  G.loadSave = function () {
    try {
      var raw = globalThis.localStorage && localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw), d = G.newSave();
        // v2 -> v3 (step 6): gear.bag used to fill during runs; it is now the bag kept between runs (equip and discard on the
        // title screen). An old save's bag becomes the kept bag as it is: bad entries dropped, the rest cut to the stash size.
        if (s && (s.v === 2 || s.v === 3) && s.gear && s.gear.equipped) {
          var B = G.BAL, ok = function (it) { return it && typeof it === 'object' && SLOTS.indexOf(it.slot) >= 0 && it.stats && typeof it.rarity === 'number'; };
          s.gear.bag = (Array.isArray(s.gear.bag) ? s.gear.bag : []).filter(ok).slice(0, B ? B.loot.stashSize : 30);
          SLOTS.forEach(function (k) { if (!(k in s.gear.equipped) || !ok(s.gear.equipped[k])) s.gear.equipped[k] = null; });
          s.v = 3;
          if (!s.gear.nextId) s.gear.nextId = 1;
          var top = 0;
          s.gear.bag.concat(SLOTS.map(function (k) { return s.gear.equipped[k]; })).forEach(function (it) { if (it && it.id >= top) top = it.id + 1; });
          if (s.gear.nextId < top) s.gear.nextId = top;
          s.settings = Object.assign(d.settings, s.settings || {});
          s.stats = Object.assign(d.stats, s.stats || {});
          return s;
        }
      }
    } catch (e) { /* corrupt or unavailable storage: start fresh */ }
    return G.newSave();
  };
  G.storeSave = function (save) {
    try { if (globalThis.localStorage) localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage full or blocked */ }
  };
})(globalThis.G = globalThis.G || {});
