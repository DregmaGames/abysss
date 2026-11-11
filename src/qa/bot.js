// QA bot. Plays through the same sim API a player uses: it only writes sim.input,
// picks level-up choices and equips gear. Deterministic (no randomness of its own),
// so one seed always gives the same run in Node and in the browser.
(function (G) {
  var T = 16;
  var KEEP = { imp: 44, bat: 38, skeleton: 36, hound: 64, warden: 56, tyrant: 76 };
  var DIRS = [];
  for (var i = 0; i < 16; i++) DIRS.push({ x: G.M.cos(i / 16 * 6.2832), y: G.M.sin(i / 16 * 6.2832) });

  // buildId: one of BAL.builds[cls] (default: the first)
  function Bot(sim, buildId, opts) {
    this.leaveAt = opts && +opts.leave > 0 ? +opts.leave : 0;
    // class hint (BAL.classes.<id>.bot): keep-away multiplier
    this.melee = sim.cls.attack.kind === 'arc'; this.keep = sim.cls.bot.keep;
    var builds = sim.B.builds && sim.B.builds[sim.clsId];
    this.buildId = builds ? (builds[buildId] ? buildId : Object.keys(builds)[0]) : null;
    this.order = builds ? builds[this.buildId].order : [];
    this.sim = sim; this.room = null; this.field = null; this.goalTile = -1; this.orbit = 1;
    this.thinkTick = -999; this.mx = 0; this.my = 0; this.wantDodge = false; this.wantPulse = false;
  }

  // Level-up card for a build (spec section 11). Score of an ability: its place in the build order (L - k), else
  // 0.5 for a passive or an active already owned, 0.6 for a new active with a free slot, -1 for a new active
  // that needs a slot. A card that needs a slot is only taken over a slotted active that scores lower; the
  // slot replaced is the lowest-scored one (ties: lower index). Returns { i, slot }.
  Bot.prototype.pickAbility = function () {
    var sim = this.sim, p = sim.player, B = sim.B, order = this.order, L = order.length, c = sim.choices, i, k;
    function base(id, owned) {
      var idx = order.indexOf(id);
      if (idx >= 0) return L - idx;
      return B.abilities[id].type === 'passive' || owned ? 0.5 : 0.6;
    }
    var worst = -1, ws = 1e9;
    for (k = 0; k < p.slots.length; k++) if (p.slots[k]) { var sc = base(p.slots[k], true); if (sc < ws) { ws = sc; worst = k; } }
    var best = -1, bs = -1e9, fb = 0, fbs = -1e9;
    for (i = 0; i < c.length; i++) {
      var id = c[i], need = sim.needsSlot(i), score = need ? (order.indexOf(id) >= 0 ? L - order.indexOf(id) : -1) : base(id, !!p.abil[id]);
      if (score > fbs) { fbs = score; fb = i; }
      if (need && score <= ws) continue;               // never replace an active with a lower-scored one
      if (score > bs) { bs = score; best = i; }
    }
    if (best < 0) best = fb;                            // every card is a worse active: take the best one anyway
    return { i: best, slot: sim.needsSlot(best) ? worst : 0 };
  };

  // Between runs (never inside one: a run's gear is fixed): equip what is better for the class, then discard
  // other classes' weapons first, then the weakest, until there is room for a full sealed bag.
  Bot.prepareGear = function (gear, B, clsId) {
    var g = gear, i, changed = true, guard = 0;
    while (changed && guard++ < 60) {
      changed = false;
      for (i = 0; i < g.bag.length; i++) {
        var it = g.bag[i], cur = g.equipped[G.targetSlot(g, it, B)];
        if (!G.canEquip(it, B, clsId)) continue;
        if (!cur || G.itemValue(it, B) > G.itemValue(cur, B) + 0.01) { G.equipFromBag(g, i, B, clsId); changed = true; break; }
      }
    }
    while (g.bag.length > B.loot.stashSize - B.loot.bagSize) {
      var worst = 0;
      for (i = 1; i < g.bag.length; i++) {
        var fi = G.canEquip(g.bag[i], B, clsId) ? 0 : 1, fw = G.canEquip(g.bag[worst], B, clsId) ? 0 : 1;
        if (fi > fw || (fi === fw && G.itemValue(g.bag[i], B) < G.itemValue(g.bag[worst], B))) worst = i;
      }
      G.dropFromBag(g, worst);
    }
  };

  // After a room is cleared (sim.state 'choice'): -1 = leave with the sealed bag, else the index of the door to take.
  // Policy: leave once `leave` rooms are cleared (opts.leave, 1-based; default: never, go on to the boss). Door rule: the one
  // paying the smaller loot bonus (the milder fissure), the first on a tie.
  Bot.prototype.afterRoom = function () {
    var sim = this.sim, B = sim.B;
    if (this.leaveAt && sim.roomIndex + 1 >= this.leaveAt) return -1;
    var best = 0, i;
    for (i = 1; i < sim.doors.length; i++) if (B.doors.mods[sim.doors[i]].loot < B.doors.mods[sim.doors[best]].loot) best = i;
    return best;
  };

  Bot.prototype.pathDir = function (gx, gy) {
    var sim = this.sim, p = sim.player, room = sim.room;
    if (this.room !== room) { this.room = room; this.field = new Int16Array(room.w * room.h); this.goalTile = -1; }
    var tx = Math.floor(gx / T), ty = Math.floor(gy / T), tile = ty * room.w + tx;
    if (tile !== this.goalTile) { sim.bfs(tx, ty, this.field); this.goalTile = tile; }
    var d = sim.fieldDir(this.field, p.x, p.y);
    if (d) return d;
    var dx = gx - p.x, dy = gy - p.y, l = Math.sqrt(dx * dx + dy * dy);
    return l < 1.5 ? { x: 0, y: 0 } : { x: dx / l, y: dy / l };
  };

  // Is the way along `g` blocked by an open crack within a few px? Then return the direction to
  // dodge across it (the landing spot must be free), 'wait' while the dodge recharges, or null.
  Bot.prototype.crossDir = function (g) {
    var sim = this.sim, p = sim.player, D = sim.cls.dodge, gl = Math.sqrt(g.x * g.x + g.y * g.y), k, i;
    if (gl < 0.1) return null;
    var ux = g.x / gl, uy = g.y / gl, blocked = false;
    for (k = 2; k <= 10 && !blocked; k += 2) if (sim.crackHits(p.x + ux * k, p.y + uy * k, p.r)) blocked = true;
    if (!blocked) return null;
    if (p.dodgeCd > 0 || p.dashT > 0) return 'wait';
    var base = G.M.atan2(uy, ux), tries = [0, 0.4, -0.4, 0.8, -0.8];
    for (i = 0; i < tries.length; i++) {
      var a = base + tries[i], dx = G.M.cos(a), dy = G.M.sin(a), ok = true;
      for (k = 6; k <= D.dist && ok; k += 6) if (sim.boxHits(p.x + dx * k, p.y + dy * k, p.r)) ok = false;
      if (ok && !sim.crackHits(p.x + dx * D.dist, p.y + dy * D.dist, p.r)) return { x: dx, y: dy };
    }
    return null;
  };

  Bot.prototype.update = function () {
    var sim = this.sim;
    if (sim.state !== 'play') return;
    var p = sim.player, s = sim.stats, K = sim.cls.skill, inp = sim.input, i;
    // Human-like reaction time: in a fight the bot only re-decides every `reactionTicks`
    // and holds its last decision in between. Out of combat it steers every tick.
    var fight = sim.monsters.length || sim.shots.length || sim.teles.length;
    if (fight && sim.tick - this.thinkTick < sim.B.bot.reactionTicks) {
      inp.mx = this.mx; inp.my = this.my;
      inp.dodge = this.wantDodge && p.dodgeCd <= 0; inp.pulse = this.wantPulse && p.pulseCd <= 0;
      if (inp.dodge) this.wantDodge = false;
      if (inp.pulse) this.wantPulse = false;
      return;
    }
    this.thinkTick = sim.tick;
    var ax = 0, ay = 0, nearest = null, nd = 1e9, close = 0, inPulse = 0, heavy = 0, dodge = false, urgent = 0;

    for (i = 0; i < sim.monsters.length; i++) {
      var m = sim.monsters[i];
      if (m.dead) continue;
      var dx = m.x - p.x, dy = m.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01, gap = d - m.r;
      if (gap < nd) { nd = gap; nearest = m; }
      var keep = KEEP[m.type] * this.keep + (m.st === 'lunge' || m.st === 'wind' || m.st === 'charge' || m.st === 'chargeWind' ? 24 : 0);
      if (gap < keep) { var w = (keep - gap) / keep * (m.def.boss ? 3 : 2); ax -= dx / d * w; ay -= dy / d * w; }
      if (gap < 15) close++;
      if (gap < K.radius - 8) { inPulse++; if (m.def.elite || m.def.boss) heavy++; }
      // a lunging husk / charging boss aimed at us: sidestep with a dodge
      if ((m.st === 'lunge' || m.st === 'charge') && gap < 36 && (m.lx * -dx + m.ly * -dy) / d > 0.6) dodge = true;
    }
    for (i = 0; i < sim.shots.length; i++) {
      var b = sim.shots[i], rx = p.x - b.x, ry = p.y - b.y, sp2 = b.vx * b.vx + b.vy * b.vy;
      var tca = (rx * b.vx + ry * b.vy) / sp2;
      if (tca < 0 || tca > 0.9) continue;
      var cx = b.x + b.vx * tca - p.x, cy = b.y + b.vy * tca - p.y, miss = Math.sqrt(cx * cx + cy * cy);
      if (miss > p.r + b.r + 7) continue;
      var sl = Math.sqrt(sp2), nx = -b.vy / sl, ny = b.vx / sl, side = (cx * nx + cy * ny) > 0 ? -1 : 1;
      ax += nx * side * 3; ay += ny * side * 3; urgent++;
      if (tca < 0.2 && miss < p.r + b.r + 1) dodge = true;
    }
    for (i = 0; i < sim.teles.length; i++) {
      var t = sim.teles[i], ex = p.x - t.x, ey = p.y - t.y, ed = Math.sqrt(ex * ex + ey * ey) || 0.01;
      if (ed > t.r + 12) continue;
      ax += ex / ed * 5; ay += ey / ed * 5; urgent++;
      if ((t.r + 4 - ed) / s.speed > t.dur - t.t - 0.08) dodge = true;
    }

    // goal
    var g = null, gw = 1;
    if (nearest) {
      if (this.melee) {   // melee: close to swing reach and stay in the arc; charge at what keeps its distance
        if (nd > s.range * 0.6 || !sim.los(p.x, p.y, nearest.x, nearest.y)) {
          g = this.pathDir(nearest.x, nearest.y);
          if (nd > 40 && (nearest.def.ai === 'ranged' || nearest.def.ai === 'elite') && p.dodgeCd <= 0 && !urgent) dodge = true;
        } else { var hx = nearest.x - p.x, hy = nearest.y - p.y, hl = Math.sqrt(hx * hx + hy * hy) || 1; g = { x: hx / hl, y: hy / hl }; gw = 0.25; }
      } else if (nd > s.range * 0.72 || !sim.los(p.x, p.y, nearest.x, nearest.y)) g = this.pathDir(nearest.x, nearest.y);
      else {   // in range: circle the target so shots miss
        var ox = nearest.x - p.x, oy = nearest.y - p.y, ol = Math.sqrt(ox * ox + oy * oy) || 1;
        if (sim.tick % 240 === 0) this.orbit = -this.orbit;
        g = { x: -oy / ol * this.orbit, y: ox / ol * this.orbit }; gw = 0.5;
      }
    }
    if (!g || (!urgent && nd > 70)) {
      var want = null, best = 1e9;
      for (i = 0; i < sim.drops.length; i++) {
        var dr = sim.drops[i];
        if (dr.kind === 'item' && sim.bag.length >= sim.B.loot.bagSize) continue;
        var dd = Math.abs(dr.x - p.x) + Math.abs(dr.y - p.y);
        if (dd < best && (!nearest || dd < 90)) { best = dd; want = dr; }
      }
      if (want) { g = this.pathDir(want.x, want.y); gw = 1.2; }
      else if (!nearest) {
        if (sim.phase === 'chest') g = this.pathDir(sim.chest.x, sim.chest.y + 4);
        else if (sim.phase === 'exit') g = this.pathDir(sim.exit.x, sim.exit.y);
        else {
          // walk to the nearest open crack segment (or the super fissure) and wait beside it
          var tg = sim.objectiveTarget();
          if (tg) {
            var fx = tg.x - p.x, fy = tg.y - p.y, fd = Math.sqrt(fx * fx + fy * fy);
            if (fd > 62) g = this.pathDir(tg.x, tg.y);
            else if (fd < 40) { g = { x: -fx / (fd || 1), y: -fy / (fd || 1) }; gw = 0.6; }
          }
        }
      }
    }
    if (g) { ax += g.x * gw; ay += g.y * gw; }

    // pick the best of 16 directions that is not blocked by a wall
    var al = Math.sqrt(ax * ax + ay * ay), mx = 0, my = 0;
    if (al > 0.15) {
      var bs = -1e9;
      for (i = 0; i < 16; i++) {
        var dir = DIRS[i], sc = (dir.x * ax + dir.y * ay) / al;
        if (sim.boxHits(p.x + dir.x * 9, p.y + dir.y * 9, p.r) || sim.crackHits(p.x + dir.x * 4, p.y + dir.y * 4, p.r)) sc -= 1.2;
        else if (sim.boxHits(p.x + dir.x * 20, p.y + dir.y * 20, p.r)) sc -= 0.35;
        if (sc > bs) { bs = sc; mx = dir.x; my = dir.y; }
      }
    }
    // an open crack between us and where we are going: jump it with the dodge
    if (g && gw >= 1 && sim.crackLit > 0) {
      var cross = this.crossDir(g);
      if (cross && cross !== 'wait') { mx = cross.x; my = cross.y; dodge = true; }   // 'wait': keep sliding along it
    }
    inp.mx = this.mx = mx; inp.my = this.my = my;
    if (close >= 3 && p.hp < p.maxHp * 0.5) dodge = true;
    this.wantDodge = !!(dodge && (mx || my));
    inp.dodge = this.wantDodge && p.dodgeCd <= 0;
    if (inp.dodge) this.wantDodge = false;
    var shotsNear = 0;
    for (i = 0; i < sim.shots.length; i++) if (Math.abs(sim.shots[i].x - p.x) + Math.abs(sim.shots[i].y - p.y) < 34) shotsNear++;
    this.wantPulse = inPulse >= 3 || heavy >= 1 || (inPulse >= 2 && p.hp < p.maxHp * 0.5) || shotsNear >= 3;
    inp.pulse = this.wantPulse && p.pulseCd <= 0;
    if (inp.pulse) this.wantPulse = false;
  };

  G.Bot = Bot;

  // Headless run of one seed (Node or browser console). Returns a summary.
  G.botRun = function (seed, opts) {
    opts = opts || {};
    var gear = opts.gear || G.newSave().gear;
    var sim = new G.Sim({ seed: seed, tier: opts.tier || 0, gear: gear, bal: opts.bal, cls: opts.cls }), bot = new Bot(sim, opts.build, { leave: opts.leave });
    var maxTicks = (opts.maxSeconds || 1200) * 60, softlock = false, worstStuck = 0, roomTicks = [], last = 0, lastRoom = 0, minHp = sim.B.run.roomMult.map(function () { return 1; });
    while (sim.tick < maxTicks && (sim.state === 'play' || sim.state === 'levelup' || sim.state === 'choice')) {
      if (sim.state === 'choice') { var ch = bot.afterRoom(); if (ch < 0) sim.leave(); else sim.takeDoor(ch); continue; }
      if (sim.state === 'levelup') {
        var pk = bot.pickAbility(); sim.chooseAbility(pk.i, pk.slot);
        continue;
      }
      bot.update();
      sim.step();
      if (sim.roomIndex !== lastRoom) { roomTicks.push(sim.tick - last); last = sim.tick; lastRoom = sim.roomIndex; }
      var hpf = sim.player.hp / sim.player.maxHp;
      if (hpf < minHp[sim.roomIndex]) minHp[sim.roomIndex] = hpf;
      var st = sim.stuckSeconds();
      if (st > worstStuck) worstStuck = st;
      if (st > sim.B.softlockSeconds) { softlock = true; break; }
    }
    // the build and what it came to
    var abilInfo = { build: bot.buildId, slots: sim.player.slots.slice(), abil: Object.assign({}, sim.player.abil), fams: G.familyCounts(sim.player.abil, sim.B) };
    return Object.assign({ seed: seed, cls: sim.clsId, result: softlock ? 'softlock' : (sim.state === 'won' ? 'win' : (sim.state === 'left' ? 'left' : (sim.state === 'dead' ? 'dead' : 'timeout'))),
      room: sim.roomIndex, phase: sim.phase, rooms: sim.roomsCleared, seconds: Math.round(sim.tick / 60), level: sim.player.level,
      kills: sim.kills, hp: Math.round(sim.player.hp), gearScore: G.gearScore(gear), bag: sim.result, doors: sim.doorLog.slice(), worstStuck: Math.round(worstStuck), minHp: minHp, roomSeconds: roomTicks.map(function (t) { return Math.round(t / 60); }) }, abilInfo);
  };
})(globalThis.G = globalThis.G || {});
