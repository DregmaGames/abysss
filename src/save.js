// Persistence: gear and settings survive between runs (localStorage); level and abilities do not.
(function (G) {
  var KEY = 'riftscar.save.v2';
  var SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'belt', 'weapon', 'shield'];
  G.SLOTS = SLOTS;
  // One gear set per class: { equipped: {slot: item|null}, bag: [kept items], nextId }. Created on first use for any class id.
  G.newGear = function () {
    var eq = {};
    SLOTS.forEach(function (s) { eq[s] = null; });
    return { equipped: eq, bag: [], nextId: 1, scrolls: 0, gold: 0, ranks: {}, shop: null, city: { montoto: false, story: 0 }, ux: { runs: 0 } };
  };
  G.newSave = function () {
    return { v: 8, gears: {}, settings: { zoom: 0, zoomRule: 2, shake: 100, lang: null, music: 50, sfx: 70, hd: true }, stats: { runs: 0, wins: 0, best: 0 }, hints: G.cleanHints(null) };
  };
  // the gear (worn items and kept bag) of a class; the sim takes this object as its `gear` option
  G.gearOf = function (save, clsId) {
    var id = G.classDef(G.BAL, clsId).id;
    if (!save.gears[id]) save.gears[id] = G.newGear();
    return save.gears[id];
  };
  G.loadSave = function () { return G.parseSave(globalThis.localStorage && localStorage.getItem(KEY)); };
  // text (JSON) -> a current save: validates, sanitizes and migrates older versions; anything unusable gives a fresh save. Also used by the backup import.
  G.parseSave = function (raw) {
    try {
      if (raw) {
        var s = JSON.parse(raw), d = G.newSave(), B = G.BAL;
        var ok = function (it) { return it && typeof it === 'object' && SLOTS.indexOf(it.slot) >= 0 && it.stats && typeof it.rarity === 'number'; };
        if (s && (s.v === 4 || s.v === 5 || s.v === 6 || s.v === 7 || s.v === 8) && s.gears && typeof s.gears === 'object') {
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
            var ct = g.city && typeof g.city === 'object' ? g.city : {};      // v7: city state per character; v8: the Appraiser became Don Montoto (flag `appraiser` -> `montoto`, plus the story index)
            n.city.montoto = ct.montoto === true || ct.appraiser === true;      // older than v7: not rescued yet; nothing else changes
            n.city.story = ct.story >= 0 && isFinite(ct.story) ? Math.floor(ct.story) % G.MONTOTO_STORIES.length : 0;
            n.ux = G.cleanUx(g, n);      // first-run flag (step UX)
            s.gears[id] = n;
          });
          s.v = 8;
          var zr = s.settings && s.settings.zoomRule >= 2 ? 2 : 1;      // 1: the zoom offset counts from the old, closer default (G.migrateZoom converts it at boot, where the screen is known)
          s.settings = Object.assign(d.settings, s.settings || {});
          s.settings.zoomRule = zr;
          if (s.settings.lang !== 'en' && s.settings.lang !== 'es') s.settings.lang = null;      // null: follow the browser language
          s.stats = Object.assign(d.stats, s.stats || {});
          var vet = (s.stats && s.stats.runs > 0) || Object.keys(s.gears).some(function (id) { return s.gears[id].ux.runs > 0; });      // a save with progress is a veteran: no forced tutorial room
          s.hints = G.cleanHints(s.hints, vet);
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
          d.settings.zoomRule = s.settings && s.settings.zoomRule >= 2 ? 2 : 1;
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
  // ---- first-time guidance state (hints seen / switched off; per-character first-run flag)
  // The tutorial state lives in hints.tut (shared by the characters, like the hints): state 'pending' (the forced tutorial room has not been finished or skipped),
  // 'done' or 'skipped'; got = the tutorial weapon was given once (a replay gives nothing); steps = the gated steps outside the tutorial room that were finished (G.TUT_GATES).
  // A save from before the tutorial: with progress (`vet`) it counts as done with every gate finished, an untouched one gets the tutorial.
  G.TUT_GATES = ['city', 'card', 'choice', 'merchant', 'cage'];
  G.newTut = function (done) {
    var t = { state: done ? 'done' : 'pending', got: !!done, steps: {} };
    if (done) G.TUT_GATES.forEach(function (k) { t.steps[k] = true; });
    return t;
  };
  // "Replay tutorial": every pop-up is shown again, from the tutorial room on (hints back on, nothing seen). `got` stays: the weapon is given only once.
  G.resetTut = function (save) {
    var H = save.hints = save.hints || G.cleanHints(null);
    H.off = false; H.seen = {};
    H.tut = H.tut || G.newTut(false);
    H.tut.state = 'pending'; H.tut.steps = {};
    return save;
  };
  G.cleanHints = function (h, vet) {
    var out = { off: false, seen: {}, tut: G.newTut(false) };
    if (h && typeof h === 'object') {
      out.off = h.off === true;
      if (h.seen && typeof h.seen === 'object') Object.keys(h.seen).forEach(function (k) { if (h.seen[k] === true || h.seen[k] === 1) out.seen[k] = true; });
      var t = h.tut;
      if (t && typeof t === 'object') {
        out.tut.state = t.state === 'done' || t.state === 'skipped' ? t.state : 'pending';
        out.tut.got = t.got === true;
        if (t.steps && typeof t.steps === 'object') G.TUT_GATES.forEach(function (k) { if (t.steps[k] === true) out.tut.steps[k] = true; });
        return out;
      }
    }
    if (vet) out.tut = G.newTut(true);
    return out;
  };
  // runs: how many runs this character has started. A save from before this flag existed with any progress counts as 1 (no softened run for veterans).
  G.cleanUx = function (g, n) {
    if (g.ux && typeof g.ux === 'object' && g.ux.runs >= 0 && isFinite(g.ux.runs)) return { runs: Math.min(1000, Math.floor(g.ux.runs)) };
    var used = n.bag.length || n.gold || n.scrolls || Object.keys(n.ranks).length || n.city.montoto || SLOTS.some(function (k) { return n.equipped[k]; });
    return { runs: used ? 1 : 0 };
  };
})(globalThis.G = globalThis.G || {});
