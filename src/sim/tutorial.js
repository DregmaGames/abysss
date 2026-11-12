// The interactive tutorial (sim side): a small fixed room and a director that moves through 13 steps, each finished by something the player does.
// Built after fissures.js. Everything here is deterministic (no wall clock, no Math.random) and only runs when the Sim was built with `tutorial` (a hand-made
// room, weak monsters, a hero that cannot die, no exp / gold / drops / banking). The view (src/view/tutorial.js) only reads `sim.tut` and the 'tutstep' /
// 'tutdone' events. Normal runs, the test room, the bots and the daily challenge never have `sim.tut`, so nothing in them changes.
(function (G) {
  var S = G.Sim.prototype, T = 16;
  // the steps, in order. 'skill' also has a second half (sub 1: the monsters of the step are being finished off).
  G.TUT_STEPS = ['move', 'attack', 'dodge', 'cross', 'skill', 'darken', 'super', 'chest', 'pickup', 'bag', 'identify', 'equip', 'exit'];
  var IDX = {};
  G.TUT_STEPS.forEach(function (id, i) { IDX[id] = i; });

  // ------------------------------------------------------------------ the room
  // 24 x 26 tiles: the hero starts at the bottom, a crack runs wall to wall across the middle (the only way on is a dodge across it),
  // the super fissure is above it, the chest and the exit at the top. Pure function of the balance numbers: the same room every time.
  G.tutorialRoom = function (B) {
    var TB = B.tutorial, F = B.fissure, W = TB.w, H = TB.h, tiles = new Uint8Array(W * H), x, y, i, k;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (x === 0 || x === W - 1 || y < 2 || y === H - 1) tiles[y * W + x] = 1;
    [[3, 17, 2, 2], [W - 5, 17, 2, 2], [3, 6, 2, 2], [W - 5, 6, 2, 2]].forEach(function (b) {      // four small pillars
      for (var yy = b[1]; yy < b[1] + b[3]; yy++) for (var xx = b[0]; xx < b[0] + b[2]; xx++) tiles[yy * W + xx] = 1;
    });
    function at(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 1 : tiles[ty * W + tx]; }
    var sx = W >> 1, sy = H - 3, ex = W >> 1, cx = sx * T + 8, yc = TB.crackRow * T + 8;
    // the crack: a wobbling band from wall to wall; o = distance from the middle, so the tips go dark first (like any crack)
    function lineY(px) { return Math.round(yc + G.M.sin(px / 11) * 3 + G.M.sin(px / 4.3) * 1.2); }
    var core = {}, x0 = 12, x1 = W * T - 12, half = Math.max(cx - x0, x1 - cx);
    for (x = x0; x <= x1; x++) {
      var ly = lineY(x), o = Math.abs(x - cx) / half;
      for (y = -3; y <= 3; y++) {
        if (Math.abs(y) === 3 && ((x * 7) % 5 === 0)) continue;      // a ragged lip
        core[(x - cx) + ',' + (ly + y - yc)] = o;
      }
    }
    var cells = [];
    for (k in core) { var p = k.split(','); cells.push({ x: +p[0], y: +p[1], o: core[k], core: true }); }
    var edge = {};
    for (i = 0; i < cells.length; i++) {
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var kk = (cells[i].x + dx) + ',' + (cells[i].y + dy);
        if (kk in core) continue;
        if (!(kk in edge) || edge[kk] > cells[i].o) edge[kk] = cells[i].o;
      }
    }
    for (k in edge) { var q = k.split(','); cells.push({ x: +q[0], y: +q[1], o: edge[k], core: false }); }
    cells.sort(function (a, b) { return a.o - b.o || a.y - b.y || a.x - b.x; });
    for (i = 0; i < cells.length; i++) cells[i].seg = Math.min(F.segments - 1, Math.floor(cells[i].o * F.segments));
    var crack = { x: cx, y: yc, big: false, cl: 0, cells: cells };
    // the super fissure: the usual pit with its arms, in the middle of the upper half
    var bx = cx, by = TB.pitRow * T + 8;
    var pit = G.genFissure(new G.RNG(0x7077), true).filter(function (c) { return !at(Math.floor((bx + c.x) / T), Math.floor((by + c.y) / T)); });
    var fissures = [crack, { x: bx, y: by, big: true, cl: -1, cells: pit }];
    // dressing: a fixed handful of floor marks and torches on the top wall
    var rng = new G.RNG(0x7071), decals = [], torches = [];
    for (y = 2; y < H - 1; y++) for (x = 1; x < W - 1; x++) if (!at(x, y) && rng.chance(0.06)) decals.push({ x: x * T + rng.int(3, 12), y: y * T + rng.int(4, 12), k: rng.int(0, 5) });
    [4, 8, 16, 20].forEach(function (tx) { torches.push({ x: tx * T + 8, y: 1 * T + 8 }); });
    var h = 2166136261;
    for (i = 0; i < W * H; i++) h = Math.imul(h ^ tiles[i], 16777619);
    for (i = 0; i < fissures.length; i++) h = Math.imul(h ^ (fissures[i].x * 31 + fissures[i].y * 17 + fissures[i].cells.length), 16777619);
    h = Math.imul(h ^ (ex * 131 + sx), 16777619) >>> 0;
    return {
      seed: 0x7077, index: 0, boss: false, w: W, h: H, tiles: tiles,
      start: { x: sx * T + 8, y: sy * T + 8 },
      exit: { tx: ex, ty: 1, x: ex * T + 8, y: 2 * T + 3 },
      chest: { x: ex * T + 8, y: 4 * T + 8 },
      fissures: fissures, decals: decals, torches: torches, hash: h,
      tut: {
        crackY: yc, lineY: lineY,
        spot: { x: cx, y: yc - 38 },                                   // the marked spot on the far side of the crack
        dummy: [{ x: cx - 100, y: sy * T + 8 - 56 }, { x: cx + 100, y: sy * T + 8 - 56 }, { x: cx - 100, y: sy * T + 8 - 106 }, { x: cx + 100, y: sy * T + 8 - 106 }],      // where the training dummy can stand
        wave: [{ x: cx - 70, y: yc - 56 }, { x: cx + 70, y: yc - 56 }, { x: cx, y: yc - 74 }]      // where step 5's monsters come from
      }
    };
  };

  // ---------------------------------------------------------------- the director
  // called by Sim.loadRoom after the crack network is built: this room's crack does not spawn on its own, the director does
  S.tutSetup = function () {
    var TB = this.B.tutorial, big = this.fissures[this.fissures.length - 1];
    this.threat = TB.dmgMult; this.hpThreat = TB.hpMult;
    this.clusters.forEach(function (cl) { cl.queue = []; cl.total = 0; });
    big.queue = TB.superWave.slice(); big.total = big.queue.length;
    this.tutEnter();
  };
  S.tutId = function () { return this.tut.done ? 'done' : G.TUT_STEPS[this.tut.step]; };
  S.tutBigId = function () { return this.fissures.length - 1; };

  // the player did something the sim cannot see for itself (the view calls this: 'bag' = the inventory was opened)
  S.tutNote = function (kind) { if (this.tut && !this.tut.done) this.tut.act[kind] = true; };

  S.tutAdvance = function () {
    var t = this.tut;
    t.step++; t.act = {}; t.sub = 0; t.t = 0;
    this.player.hp = this.player.maxHp;      // a fresh start for every step
    this.progress();
    if (t.step >= G.TUT_STEPS.length) { this.tutFinish(); return; }
    this.emit({ t: 'tutstep', step: t.step, id: G.TUT_STEPS[t.step] });
    this.tutEnter();
  };

  // what a step puts into the room when it starts
  S.tutEnter = function () {
    var t = this.tut, id = this.tutId(), p = this.player, R = this.room.tut, TB = this.B.tutorial, i, m;
    if (id === 'move') { t.p0 = { x: p.x, y: p.y }; }
    else if (id === 'attack') {      // the dummy stands where it is farthest from the hero: the hero has to walk up to it
      var best = R.dummy[0], bd = -1, d;
      for (i = 0; i < R.dummy.length; i++) { d = (R.dummy[i].x - p.x) * (R.dummy[i].x - p.x) + (R.dummy[i].y - p.y) * (R.dummy[i].y - p.y); if (d > bd) { bd = d; best = R.dummy[i]; } }
      t.dummy = this.spawnMonster('dummy', best.x, best.y, this.tutBigId());
    }
    else if (id === 'dodge' || id === 'cross') { p.dodgeCd = 0; }
    else if (id === 'skill') { p.pulseCd = 0; this.tutSkillWave(); }
    else if (id === 'darken') {
      t.crackLeft = TB.crackWave.slice(); t.spawnCd = 0.8;
      this.clusters[0].total = t.crackLeft.length;
    }
  };
  S.tutSkillWave = function () {
    var R = this.room.tut, TB = this.B.tutorial, t = this.tut, i, m;
    t.wave = [];
    for (i = 0; i < TB.skillWave.length; i++) t.wave.push(this.spawnMonster(TB.skillWave[i], R.wave[i % R.wave.length].x, R.wave[i % R.wave.length].y, this.tutBigId()));
    this.player.pulseCd = 0;
  };

  S.tutUpdate = function (dt) {
    var t = this.tut, TB = this.B.tutorial, p = this.player, R = this.room.tut, id = this.tutId(), i, m, dx, dy;
    if (t.done) return;
    t.t += dt;
    // the hero cannot die here; low health mends quickly
    if (p.hp < 1) p.hp = 1;
    if (p.hp < p.maxHp * TB.healBelow) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * TB.healRate * dt);
    // the crack is the way on: before the crossing step the hero cannot dodge over it early, after it they cannot go back (the monsters could not follow)
    var step = t.step;
    if (step < IDX.cross) { if (p.y < R.crackY + TB.crossMargin) p.y = R.crackY + TB.crossMargin; }
    else if (step > IDX.cross) { if (p.y > R.crackY - TB.crossMargin) p.y = R.crackY - TB.crossMargin; }

    if (id === 'darken') {
      t.spawnCd -= dt;
      if (t.crackLeft.length && t.spawnCd <= 0) {
        var live = 0;
        for (i = 0; i < this.monsters.length; i++) if (!this.monsters[i].dead && this.monsters[i].fid === 0) live++;
        if (live < TB.crackAlive) {
          var px = this.rngRoom.range(40, this.room.w * T - 40);
          this.spawnMonster(t.crackLeft.shift(), px, R.lineY(px) - 18, 0);
          t.spawnCd = TB.crackEvery;
        } else t.spawnCd = 0.2;
      }
    }
    this.tutCheck();
  };

  // The step conditions: did the player do what this step asks? Cheap and safe to repeat; the sim runs it every tick and the view runs it every
  // frame while a panel pauses the sim (identifying and equipping happen in the bag screen).
  S.tutCheck = function () {
    var t = this.tut, TB = this.B.tutorial, p = this.player, R = this.room.tut, id = this.tutId(), i, dx, dy;
    if (t.done) return;
    switch (id) {
      case 'move': dx = p.x - t.p0.x; dy = p.y - t.p0.y; if (dx * dx + dy * dy >= TB.moveDist * TB.moveDist) this.tutAdvance(); break;
      case 'attack': if (t.dummy.dead) this.tutAdvance(); break;
      case 'dodge': if (t.act.dodge) this.tutAdvance(); break;
      case 'cross': if (p.y < R.crackY - TB.crossMargin) this.tutAdvance(); break;
      case 'skill':
        if (t.act.skill) t.sub = 1;
        var alive = 0;
        for (i = 0; i < t.wave.length; i++) if (!t.wave[i].dead) alive++;
        if (!alive) { if (t.sub) this.tutAdvance(); else this.tutSkillWave(); }      // killed before the skill was used: another wave
        break;
      case 'darken': if (this.phase !== 'fissures') this.tutAdvance(); break;
      case 'super': if (this.phase === 'chest' || this.phase === 'exit') this.tutAdvance(); break;
      case 'chest': if (this.phase === 'exit') this.tutAdvance(); break;
      case 'pickup': if (this.bag.length >= 1 && this.scrolls >= 1) this.tutAdvance(); break;
      case 'bag': if (t.act.bag) this.tutAdvance(); break;
      case 'identify': if (t.item && !t.item.unid) this.tutAdvance(); break;
      case 'equip': if (this.gear.equipped.weapon === t.item) this.tutAdvance(); break;
    }
    // the item must not get lost (dropped from the bag): it comes back as a pickup
    if (!t.done && t.step >= IDX.bag && t.step <= IDX.equip && t.item && this.bag.indexOf(t.item) < 0 && this.gear.equipped.weapon !== t.item) {
      this.drops.push({ id: this.nextId++, kind: 'item', x: p.x, y: p.y + 10, item: t.item, age: 0 });
      t.step = IDX.pickup; t.act = {}; t.sub = 0;
      this.emit({ t: 'tutstep', step: t.step, id: 'pickup' });
    }
  };

  // the chest opened: the tutorial's own loot instead of a roll. An unidentified weapon of the hero's class and a Scroll of Identification.
  S.tutChest = function (x, y) {
    var B = this.B, TB = B.tutorial, own = B.loot.weaponTypes.filter(function (w) { return w.cls === this.clsId; }, this), wd = null, i;
    for (i = 0; i < own.length; i++) if (own[i].id === this.cls.defaultWeapon) wd = own[i];
    if (!wd) wd = own[0];
    this.tut.item = G.makeItem(this.rngRoom, 'weapon', TB.itemRarity, wd, TB.itemIlvl, B, this.gear);
    this.drops.push({ id: this.nextId++, kind: 'item', x: x - 34, y: y + 4, item: this.tut.item, age: 0 });
    this.drops.push({ id: this.nextId++, kind: 'scroll', x: x + 34, y: y + 4, item: null, age: 0 });
    this.emit({ t: 'drop', x: x - 34, y: y + 4, kind: 'item', rarity: this.tut.item.rarity });
    this.emit({ t: 'drop', x: x + 34, y: y + 4, kind: 'scroll', rarity: 2 });
  };

  // The tutorial is over: the hero walked into the exit at its last step (tutFinish), or the player skipped it (tutEnd(false), called by the view).
  // The first time the tutorial's weapon stays on the character, if it was equipped; a replay puts back what was worn. What the swap pushed out goes to the kept bag.
  S.tutFinish = function () {
    this.tutEnd(true);
    this.emit({ t: 'tutdone', reward: !!this.tut.reward, kept: this.tut.kept });
  };
  S.tutEnd = function (finished) {
    var t = this.tut, B = this.B, worn = !!t.item && this.gear.equipped.weapon === t.item;
    if (t.ended) return;
    t.ended = true; t.done = true; t.step = G.TUT_STEPS.length;
    t.kept = false;
    if (worn && t.reward) { G.bankItems(this.gear, this.bag, B); t.kept = true; }
    else if (worn) this.gear.equipped.weapon = t.prevWeapon || null;
    this.bag = []; this.scrolls = 0;
    this.recalc();
    this.player.hp = this.player.maxHp;
    this.progress();
  };

  // where the pointer goes for the current step (world px), or null when it points at something in the interface (the view does that)
  S.tutTarget = function () {
    var t = this.tut, R = this.room.tut, id = this.tutId(), p = this.player, i, best = null, bd = 1e9;
    if (t.done) return null;
    if (id === 'attack') return t.dummy && !t.dummy.dead ? { x: t.dummy.x, y: t.dummy.y - 8, kind: 'dummy' } : null;
    if (id === 'cross') return { x: R.spot.x, y: R.spot.y, kind: 'spot' };
    if (id === 'skill') {
      for (i = 0; i < t.wave.length; i++) { var m = t.wave[i]; if (!m.dead) { var d = Math.abs(m.x - p.x) + Math.abs(m.y - p.y); if (d < bd) { bd = d; best = m; } } }
      return best ? { x: best.x, y: best.y - 8, kind: 'monster' } : null;
    }
    if (id === 'darken') { var ns = this.nearestSeg(p.x, p.y, null); return ns ? { x: ns.x, y: ns.y, kind: 'fissure' } : null; }
    if (id === 'super') { var f = this.fissures[this.fissures.length - 1]; return { x: f.x, y: f.y, kind: 'super' }; }
    if (id === 'chest') return { x: this.chest.x, y: this.chest.y - 10, kind: 'chest' };
    if (id === 'pickup') {
      for (i = 0; i < this.drops.length; i++) { var dr = this.drops[i], dd = Math.abs(dr.x - p.x) + Math.abs(dr.y - p.y); if (dd < bd) { bd = dd; best = dr; } }
      return best ? { x: best.x, y: best.y - 6, kind: 'drop' } : null;
    }
    if (id === 'exit') return { x: this.exit.x, y: this.exit.y + 6, kind: 'exit' };
    return null;
  };
})(globalThis.G = globalThis.G || {});
