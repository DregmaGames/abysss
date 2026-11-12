// Persistence: gear and settings survive between runs (localStorage); level and abilities do not.
(function (G) {
  var KEY = 'riftscar.save.v2';      // the storage key never changed; the save inside carries its own version
  var SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'belt', 'weapon', 'shield'];
  G.SLOTS = SLOTS;
  // The save keeps a list of characters (v9). A character IS a gear set plus an identity: { id, name, cls, equipped, bag, nextId, scrolls, gold, ranks, shop, city, ux }.
  // The sim takes the character object as its `gear` option (the extra fields are ignored); the daily challenge uses a plain G.newGear() of its own and never touches characters.
  G.newGear = function () {
    var eq = {};
    SLOTS.forEach(function (s) { eq[s] = null; });
    return { equipped: eq, bag: [], nextId: 1, scrolls: 0, gold: 0, ranks: {}, shop: null, city: { montoto: false, story: 0 }, ux: { runs: 0, best: 0 } };
  };
  G.newChar = function (cls, name, id) {
    var g = G.newGear();
    g.id = id || 'c1'; g.name = name; g.cls = G.classDef(G.BAL, cls).id;
    return g;
  };
  G.newSave = function () {
    return { v: 9, chars: [], sel: null, nextChar: 1, settings: { zoom: 0, shake: 100, lang: null, music: 50, sfx: 70 }, stats: { runs: 0, wins: 0, best: 0 }, hints: G.cleanHints(null) };
  };
  // ---- characters
  var NAME_OK = /[^A-Za-z0-9áéíóúñüÁÉÍÓÚÑÜ \-]/g;
  // the name rules: letters (with á é í ó ú ñ ü), digits, spaces, hyphens; other characters are dropped, spaces collapse, trimmed, at most BAL.characters.nameMax. '' = not usable.
  G.cleanName = function (str) {
    var n = G.BAL.characters.nameMax;
    var t = String(str == null ? '' : str).replace(/\s/g, ' ').replace(NAME_OK, '').replace(/ +/g, ' ').trim().slice(0, n).trim();
    return t;
  };
  // while typing: only the characters a name may have, at most nameMax (spaces and hyphens stay as typed; G.cleanName trims at the end)
  G.nameChars = function (str) { return String(str == null ? '' : str).replace(/\s/g, ' ').replace(NAME_OK, '').slice(0, G.BAL.characters.nameMax); };
  // a name nobody else has: a repeat gets " 2", " 3"... (the base is cut to keep the whole inside the limit)
  G.uniqueName = function (save, name, exceptId) {
    var n = G.BAL.characters.nameMax, used = {};
    save.chars.forEach(function (c) { if (c.id !== exceptId) used[c.name.toLowerCase()] = true; });
    if (!used[name.toLowerCase()]) return name;
    for (var k = 2; k < 1000; k++) {
      var suf = ' ' + k, cand = name.slice(0, n - suf.length).trim() + suf;
      if (!used[cand.toLowerCase()]) return cand;
    }
    return name;
  };
  // a class's name in a language (the default name of a character); the sim-only Node tools have no language tables
  function clsName(lang, id) { var L = G.LANG && G.LANG[lang]; return L && L['cls.' + id] || id.charAt(0).toUpperCase() + id.slice(1); }
  G.charLimit = function (save) { return save.chars.length >= G.BAL.characters.max; };
  G.charById = function (save, id) {
    for (var i = 0; i < save.chars.length; i++) if (save.chars[i].id === id) return save.chars[i];
    return null;
  };
  // the selected character (null if the save has none)
  G.curChar = function (save) { save = save || G.save; return save ? G.charById(save, save.sel) : null; };
  // create a character and select it. Returns { ok, char } or { ok: false, err: 'limit' | 'name' | 'class' }
  G.addChar = function (save, cls, name) {
    if (G.charLimit(save)) return { ok: false, err: 'limit' };
    if (!G.BAL.classes[cls]) return { ok: false, err: 'class' };
    var nm = G.cleanName(name);
    if (!nm) return { ok: false, err: 'name' };
    var id = 'c' + (save.nextChar || 1);
    while (G.charById(save, id)) id = 'c' + (parseInt(id.slice(1), 10) + 1);
    save.nextChar = parseInt(id.slice(1), 10) + 1;
    var c = G.newChar(cls, G.uniqueName(save, nm), id);
    save.chars.push(c); save.sel = id;
    return { ok: true, char: c };
  };
  G.selectChar = function (save, id) {
    if (!G.charById(save, id)) return false;
    save.sel = id; return true;
  };
  // remove one character (and only it). The selection moves to the first one left, or null.
  G.deleteChar = function (save, id) {
    var i = -1;
    save.chars.forEach(function (c, k) { if (c.id === id) i = k; });
    if (i < 0) return false;
    save.chars.splice(i, 1);
    if (save.sel === id) save.sel = save.chars.length ? save.chars[Math.min(i, save.chars.length - 1)].id : null;
    return true;
  };
  G.randomName = function (cls, rnd) {
    var list = G.CHAR_NAMES[cls] || G.CHAR_NAMES.mage;
    return list[Math.floor((rnd ? rnd() : Math.random()) * list.length) % list.length];
  };
  // make sure a character is selected (QA and direct entry: ?scene=city, ?class=<id>, ?fresh=1). With a class: the selected character if it has that class, else the first one of that class, else a new one named after the class.
  // Without: the selected one, else the first, else a new one of the default class.
  G.ensureChar = function (save, cls) {
    var want = G.BAL.classes[cls] ? cls : null, c = G.curChar(save), i;
    if (c && (!want || c.cls === want)) return c;
    for (i = 0; i < save.chars.length; i++) if (!want || save.chars[i].cls === want) { save.sel = save.chars[i].id; return save.chars[i]; }
    var id = G.classDef(G.BAL, want).id;
    return G.addChar(save, id, clsName(G.lang, id)).char || save.chars[0];
  };
  // G.cls = the class of the selected character (what the scenes, the audio and the sim options read)
  G.syncCls = function () { var c = G.curChar(); G.cls = c ? c.cls : G.BAL.defaultClass; return G.cls; };
  G.loadSave = function () { return G.parseSave(globalThis.localStorage && localStorage.getItem(KEY)); };

  // one class gear set of an old save (v4-v8), sanitized
  function cleanGear(g, B) {
    var n = G.newGear();
    var ok = function (it) { return it && typeof it === 'object' && SLOTS.indexOf(it.slot) >= 0 && it.stats && typeof it.rarity === 'number'; };
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
    n.ux = G.cleanUx(g, n);      // first-run flag (step UX) and the best room
    return n;
  }
  function hasProgress(n) {
    return !!(SLOTS.some(function (k) { return n.equipped[k]; }) || n.bag.length || n.gold || n.scrolls || Object.keys(n.ranks).length || n.ux.runs > 0 || n.city.montoto);
  }
  // text (JSON) -> a current save: validates, sanitizes and migrates older versions; anything unusable gives a fresh save. Also used by the backup import.
  // Older saves (v2-v8) kept one gear set per class: every set with any progress becomes a character named after its class (in the player's language), untouched classes are dropped,
  // the class that was selected becomes the selected character. Nothing with progress is lost.
  G.parseSave = function (raw) {
    try {
      if (raw) {
        var s = JSON.parse(raw), d = G.newSave(), B = G.BAL, legacy = null, selCls = null;
        if (s && (s.v === 4 || s.v === 5 || s.v === 6 || s.v === 7 || s.v === 8) && s.gears && typeof s.gears === 'object') {
          legacy = {};
          Object.keys(s.gears).forEach(function (id) {
            var g = s.gears[id];
            if (!B.classes[id] || !g || typeof g !== 'object') return;
            legacy[id] = cleanGear(g, B);
          });
          selCls = s.settings && B.classes[s.settings.cls] ? s.settings.cls : null;
        } else if (s && (s.v === 2 || s.v === 3) && s.gear && s.gear.equipped) {
          // v2 / v3 -> v4 (per-class gear): the one shared gear set (worn items + kept bag) goes whole to the class that was selected
          // in that save (settings.cls, default mage); the other classes start empty. Nothing is dropped except entries that are not
          // items (an old bag over the stash size stays whole: banking waits until there is room). A worn weapon the selected class cannot use is moved into its bag (over the stash size if need be) so no item is lost.
          var ok = function (it) { return it && typeof it === 'object' && SLOTS.indexOf(it.slot) >= 0 && it.stats && typeof it.rarity === 'number'; };
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
          g0.ux = G.cleanUx({}, g0);
          legacy = {}; legacy[cls] = g0; selCls = cls;
        } else if (s && s.v === 9 && Array.isArray(s.chars)) {
          var seen = {}, next = s.nextChar > 0 ? Math.floor(s.nextChar) : 1;
          s.chars.forEach(function (c) {
            if (!c || typeof c !== 'object' || !B.classes[c.cls]) return;
            var n = cleanGear(c, B), id = typeof c.id === 'string' && /^c\d+$/.test(c.id) && !seen[c.id] ? c.id : null;
            while (!id || seen[id]) id = 'c' + (next++);
            seen[id] = true;
            next = Math.max(next, parseInt(id.slice(1), 10) + 1);
            n.id = id; n.name = G.cleanName(c.name) || clsName(G.lang, c.cls); n.cls = c.cls;
            d.chars.push(n);
          });
          d.nextChar = next;
          d.chars.forEach(function (c, k) { var u = G.uniqueName({ chars: d.chars.slice(0, k) }, c.name); c.name = u; });
          d.sel = G.charById(d, s.sel) ? s.sel : (d.chars.length ? d.chars[0].id : null);
        } else {
          return G.newSave();
        }
        if (legacy) {
          var lang = G.detectLang ? G.detectLang(s.settings && s.settings.lang, G.params && G.params.get ? G.params.get('lang') : null) : 'en';
          G.classIds(B).forEach(function (id) {
            var n = legacy[id];
            if (!n || !hasProgress(n)) return;
            n.id = 'c' + d.nextChar++; n.name = clsName(lang, id); n.cls = id;
            d.chars.push(n);
          });
          var pick = null;
          d.chars.forEach(function (c) { if (c.cls === selCls) pick = c; });
          d.sel = pick ? pick.id : (d.chars.length ? d.chars[0].id : null);
        }
        d.settings = Object.assign(d.settings, s.settings || {});
        delete d.settings.cls;      // v9: the selected character says which class
        if (d.settings.lang !== 'en' && d.settings.lang !== 'es') d.settings.lang = null;      // null: follow the browser language
        d.stats = Object.assign(d.stats, s.stats || {});
        var vet = d.stats.runs > 0 || d.chars.some(function (c) { return c.ux.runs > 0; });      // a save with progress is a veteran: no forced tutorial room
        d.hints = G.cleanHints(s.hints, vet);
        return d;
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
    var best = g.ux && g.ux.best > 0 && isFinite(g.ux.best) ? Math.min(99, Math.floor(g.ux.best)) : 0;
    if (g.ux && typeof g.ux === 'object' && g.ux.runs >= 0 && isFinite(g.ux.runs)) return { runs: Math.min(1000, Math.floor(g.ux.runs)), best: best };
    var used = n.bag.length || n.gold || n.scrolls || Object.keys(n.ranks).length || n.city.montoto || SLOTS.some(function (k) { return n.equipped[k]; });
    return { runs: used ? 1 : 0, best: best };
  };
})(globalThis.G = globalThis.G || {});
