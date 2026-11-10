// QA bot. Plays through the same sim API a player uses: it only writes sim.input,
// picks level-up choices and equips gear. Deterministic (no randomness of its own),
// so one seed always gives the same run in Node and in the browser.
(function (G) {
  var T = 16;
  var KEEP = { imp: 44, bat: 38, skeleton: 36, hound: 64, warden: 56, tyrant: 76 };
  var PICK = { multi: 12, power: 10, haste: 10, pierce: 9, vital: 7, crit: 7, ward: 6, regen: 6, leech: 6, swift: 5, pulse: 4, range: 4, blink: 3, wisdom: 3 };
  var DIRS = [];
  for (var i = 0; i < 16; i++) DIRS.push({ x: Math.cos(i / 16 * 6.2832), y: Math.sin(i / 16 * 6.2832) });

  function Bot(sim) {
    this.sim = sim; this.room = null; this.field = null; this.goalTile = -1; this.orbit = 1;
    this.thinkTick = -999; this.mx = 0; this.my = 0; this.wantDodge = false; this.wantPulse = false;
  }

  Bot.prototype.pickPassive = function () {
    var c = this.sim.choices, best = 0;
    for (var i = 1; i < c.length; i++) if ((PICK[c[i]] || 0) > (PICK[c[best]] || 0)) best = i;
    return best;
  };

  Bot.prototype.manageGear = function () {
    var sim = this.sim, g = sim.gear, B = sim.B, i, changed = true, guard = 0;
    while (changed && guard++ < 30) {
      changed = false;
      for (i = 0; i < g.bag.length; i++) {
        var it = g.bag[i], cur = g.equipped[G.targetSlot(g, it, B)];
        if (!cur || G.itemValue(it, B) > G.itemValue(cur, B) + 0.01) { sim.equip(i); changed = true; break; }
      }
    }
    while (g.bag.length > B.loot.bagSize - 3) {       // keep room for new drops: discard the weakest
      var worst = 0;
      for (i = 1; i < g.bag.length; i++) if (G.itemValue(g.bag[i], B) < G.itemValue(g.bag[worst], B)) worst = i;
      sim.dropItem(worst);
    }
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

  Bot.prototype.update = function () {
    var sim = this.sim;
    if (sim.state !== 'play') return;
    if (sim.tick % 30 === 0) this.manageGear();
    var p = sim.player, s = sim.stats, P = sim.B.player, inp = sim.input, i;
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
      var keep = KEEP[m.type] + (m.st === 'lunge' || m.st === 'wind' || m.st === 'charge' || m.st === 'chargeWind' ? 24 : 0);
      if (gap < keep) { var w = (keep - gap) / keep * (m.def.boss ? 3 : 2); ax -= dx / d * w; ay -= dy / d * w; }
      if (gap < 15) close++;
      if (gap < P.pulseRadius - 8) { inPulse++; if (m.def.elite || m.def.boss) heavy++; }
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
      if (nd > s.range * 0.72 || !sim.los(p.x, p.y, nearest.x, nearest.y)) g = this.pathDir(nearest.x, nearest.y);
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
        if (dr.kind === 'item' && sim.gear.bag.length >= sim.B.loot.bagSize) continue;
        var dd = Math.abs(dr.x - p.x) + Math.abs(dr.y - p.y);
        if (dd < best && (!nearest || dd < 90)) { best = dd; want = dr; }
      }
      if (want) { g = this.pathDir(want.x, want.y); gw = 1.2; }
      else if (!nearest) {
        if (sim.phase === 'chest') g = this.pathDir(sim.chest.x, sim.chest.y + 4);
        else if (sim.phase === 'exit') g = this.pathDir(sim.exit.x, sim.exit.y);
        else {
          // wait near the fissure that is about to matter, but not on top of it
          // explore: an open fissure first, else walk to the nearest dormant one to wake it
          var f = null, fbest = 1e9;
          for (i = 0; i < sim.fissures.length; i++) {
            var fi = sim.fissures[i], fd0 = Math.abs(fi.x - p.x) + Math.abs(fi.y - p.y);
            if (fi.state === 'opening' || fi.state === 'open') fd0 -= 10000;
            else if (!(fi.state === 'dormant' && (!fi.big || sim.phase === 'super'))) continue;
            if (fd0 < fbest) { fbest = fd0; f = fi; }
          }
          if (f) {
            var fx = f.x - p.x, fy = f.y - p.y, fd = Math.sqrt(fx * fx + fy * fy);
            if (fd > 62) g = this.pathDir(f.x, f.y);
            else if (fd < 48) { g = { x: -fx / (fd || 1), y: -fy / (fd || 1) }; gw = 0.6; }
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
        if (sim.boxHits(p.x + dir.x * 9, p.y + dir.y * 9, p.r)) sc -= 1.2;
        else if (sim.boxHits(p.x + dir.x * 20, p.y + dir.y * 20, p.r)) sc -= 0.35;
        if (sc > bs) { bs = sc; mx = dir.x; my = dir.y; }
      }
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
    var sim = new G.Sim({ seed: seed, tier: opts.tier || 0, gear: gear, bal: opts.bal }), bot = new Bot(sim);
    var maxTicks = (opts.maxSeconds || 1200) * 60, softlock = false, worstStuck = 0, roomTicks = [], last = 0, lastRoom = 0, minHp = sim.B.run.roomMult.map(function () { return 1; });
    while (sim.tick < maxTicks && (sim.state === 'play' || sim.state === 'levelup')) {
      if (sim.state === 'levelup') { sim.choosePassive(bot.pickPassive()); continue; }
      bot.update();
      sim.step();
      if (sim.roomIndex !== lastRoom) { roomTicks.push(sim.tick - last); last = sim.tick; lastRoom = sim.roomIndex; }
      var hpf = sim.player.hp / sim.player.maxHp;
      if (hpf < minHp[sim.roomIndex]) minHp[sim.roomIndex] = hpf;
      var st = sim.stuckSeconds();
      if (st > worstStuck) worstStuck = st;
      if (st > sim.B.softlockSeconds) { softlock = true; break; }
    }
    return { seed: seed, result: softlock ? 'softlock' : (sim.state === 'won' ? 'win' : (sim.state === 'dead' ? 'dead' : 'timeout')),
      room: sim.roomIndex, phase: sim.phase, rooms: sim.roomsCleared, seconds: Math.round(sim.tick / 60), level: sim.player.level,
      kills: sim.kills, hp: Math.round(sim.player.hp), gearScore: G.gearScore(gear), worstStuck: Math.round(worstStuck), minHp: minHp, roomSeconds: roomTicks.map(function (t) { return Math.round(t / 60); }) };
  };
})(globalThis.G = globalThis.G || {});
