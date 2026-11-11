// Persistence: gear and settings survive between runs (localStorage); level and abilities do not.
(function (G) {
  var KEY = 'riftscar.save.v2';
  var SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'belt', 'weapon', 'shield'];
  G.SLOTS = SLOTS;
  G.newSave = function () {
    var eq = {};
    SLOTS.forEach(function (s) { eq[s] = null; });
    return { v: 2, gear: { equipped: eq, bag: [], nextId: 1 }, settings: { zoom: 0, shake: 100 }, stats: { runs: 0, wins: 0, best: 0 } };
  };
  G.loadSave = function () {
    try {
      var raw = globalThis.localStorage && localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw), d = G.newSave();
        if (s && s.v === 2 && s.gear && s.gear.equipped) {
          SLOTS.forEach(function (k) { if (!(k in s.gear.equipped)) s.gear.equipped[k] = null; });
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
