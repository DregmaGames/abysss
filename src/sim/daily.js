// The daily challenge (step 10): one run a day, the same for everyone. No server, no accounts, no clock in the sim:
// the view passes today's UTC date ('YYYY-MM-DD') and everything else follows from it (BAL.daily).
//   seed  = hash of the date, class = picked from the date, doors = the door taken after each room is fixed (only that one is offered),
//   gear  = a fixed starting kit in a gear set of its own (the save is never read or written: nothing found is banked),
//   score = rooms cleared, kills and, for a win, a bonus that grows the faster it was won (G.dailyScore).
(function (G) {
  // 'YYYY-MM-DD' of a Date, in UTC
  G.utcDate = function (d) { return d.toISOString().slice(0, 10); };

  // the day's run from its date: { date, seed, cls, doors: [door index after room 1, 2, ...] }
  G.dailyInfo = function (date, B) {
    var D = B.daily, n = parseInt(String(date).replace(/-/g, ''), 10) >>> 0, h = G.hash32(n, D.salt);
    var ids = G.classIds(B), rng = new G.RNG(G.hash32(h, 31)), doors = [], i;
    for (i = 0; i < B.run.rooms - 1; i++) doors.push(rng.int(0, (B.doors.offer || 2) - 1));
    return { date: String(date), seed: h % 1000000, cls: ids[G.hash32(h, 7) % ids.length], doors: doors };
  };

  // the fixed starting kit: a new gear set (never the player's), items rolled from the day's seed, identified and worn.
  // Don Montoto counts as rescued (no cage in the daily run), there is no gold and no rank.
  G.dailyGear = function (info, B) {
    var D = B.daily, g = G.newGear(), rng = new G.RNG(G.hash32(info.seed, 2024)), cls = G.classDef(B, info.cls).id;
    g.city.montoto = true;
    g.scrolls = D.scrolls;
    D.kit.forEach(function (k) {
      var wd = null;
      if (k.slot === 'weapon') wd = rng.pick(B.loot.weaponTypes.filter(function (w) { return w.cls === cls; }));
      var it = G.makeItem(rng, k.slot, k.rarity, wd, D.kitIlvl, B, g);
      delete it.unid; it.src = 'daily';
      g.equipped[k.slot] = it;
    });
    return g;
  };

  // the score of a finished (or current) daily run: integers only, the same on every machine
  G.dailyScore = function (sim, B) {
    var S = (B || sim.B).daily.score, won = sim.state === 'won', sec = Math.floor(sim.tick / 60);
    var parts = { rooms: sim.roomsCleared * S.room, kills: sim.kills * S.kill, win: won ? S.win : 0, time: won ? Math.max(0, S.par - sec) * S.perSecond : 0 };
    parts.total = parts.rooms + parts.kills + parts.win + parts.time;
    return parts;
  };
})(globalThis.G = globalThis.G || {});
