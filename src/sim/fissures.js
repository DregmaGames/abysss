// Room loop: the crack network (all open, darkened by kills), then the super fissure, chest and exit.
(function (G) {
  var S = G.Sim.prototype;

  // ------------------------------------------------------------ the network
  // Every normal crack is open from the start of the room. Joined cracks form a cluster with one
  // spawn queue and one kill meter: each kill darkens the next segment (tips first), and a dark
  // segment is a permanent scar. A crack whose segments are all dark pays out like a closed fissure.
  // When the whole network is dark the super fissure opens.
  var T = 16;

  S.setupFissures = function (room) {
    var B = this.B, F = B.fissure, self = this, index = this.roomIndex, i, s, c;
    this.crackW = room.w * T; this.crackH = room.h * T;
    this.crackGrid = new Uint8Array(this.crackW * this.crackH);   // open crack pixels (count of cracks on each)
    this.crackTile = new Uint8Array(room.w * room.h);             // open crack pixels per tile (walker pathing)
    this.crackLit = 0;
    this.fissures = room.fissures.map(function (f, id) {
      var queue = [];
      if (f.big) { queue = F.superWave[index].slice(); if (self.modDef.extraElite) queue.push(self.modDef.extraElite); }
      else {
        var budget = F.budget[index], pool = F.pool[index], types = Object.keys(pool);
        while (budget > 0) {
          var ok = types.filter(function (t) { return B.monsters[t].threat <= budget; });
          var t = ok[self.rngRoom.weighted(ok.map(function (k) { return pool[k]; }))];
          queue.push(t); budget -= B.monsters[t].threat;
        }
      }
      var o = { id: id, x: f.x, y: f.y, big: f.big, cl: f.cl, cells: f.cells, state: f.big ? 'dormant' : 'opening', t: 0, reveal: 0,
        queue: queue, total: queue.length, spawnCd: 0, alive: 0, dealt: 0 };
      if (!f.big) {
        o.nSeg = F.segments; o.dark = []; o.darkTick = []; o.segCells = []; o.segX = []; o.segY = []; o.litN = 0;
        for (s = 0; s < o.nSeg; s++) { o.dark.push(false); o.darkTick.push(0); o.segCells.push([]); }
        for (i = 0; i < f.cells.length; i++) { c = f.cells[i]; if (c.core) o.segCells[c.seg].push(c); }
        for (s = 0; s < o.nSeg; s++) {
          var sc = o.segCells[s], sx = 0, sy = 0;
          if (!sc.length) { o.dark[s] = true; o.segX.push(o.x); o.segY.push(o.y); continue; }
          for (i = 0; i < sc.length; i++) { sx += sc[i].x; sy += sc[i].y; }
          o.segX.push(o.x + sx / sc.length); o.segY.push(o.y + sy / sc.length);
          o.litN++;
        }
      }
      return o;
    });
    // clusters: one queue and one kill meter per group of joined cracks
    var byCl = {}, cls = this.clusters = [], f;
    for (i = 0; i < this.fissures.length; i++) {
      f = this.fissures[i];
      if (f.big) continue;
      var cl = byCl[f.cl];
      if (!cl) { cl = byCl[f.cl] = { id: cls.length, cracks: [], queue: [], total: 0, killed: 0, order: [], darkN: 0 }; cls.push(cl); }
      f.cluster = cl.id;
      cl.cracks.push(f.id);
      cl.queue = cl.queue.concat(f.queue); cl.total += f.total;
      f.queue = [];
      if (!f.litN) { f.state = 'scar'; f.scarTick = this.tick; continue; }
      for (s = 0; s < f.nSeg; s++) if (!f.dark[s]) this.lightSeg(f, s, 1);
    }
    for (i = 0; i < cls.length; i++) {           // darkening order: outermost band of every crack first
      for (s = F.segments - 1; s >= 0; s--) for (var k = 0; k < cls[i].cracks.length; k++) {
        f = this.fissures[cls[i].cracks[k]];
        if (f.litN && !f.dark[s]) cls[i].order.push([f.id, s]);
      }
    }
    for (i = 0; i < this.fissures.length; i++) {
      f = this.fissures[i];
      if (!f.big && f.state === 'opening') this.emit({ t: 'fissure', id: f.id, state: 'opening', big: false, x: f.x, y: f.y });
    }
  };

  S.lightSeg = function (f, s, v) {
    var cells = f.segCells[s], W = this.crackW, H = this.crackH, RW = this.room.w, i;
    for (i = 0; i < cells.length; i++) {
      var x = f.x + cells[i].x, y = f.y + cells[i].y;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      this.crackGrid[y * W + x] += v;
      this.crackTile[(y >> 4) * RW + (x >> 4)] += v;
      this.crackLit += v;
    }
  };

  // does a box of half-size h at (x, y) touch an open crack?
  S.crackHits = function (x, y, h) {
    if (!this.crackLit) return false;
    var W = this.crackW, g = this.crackGrid;
    var x0 = Math.max(0, Math.floor(x - h)), x1 = Math.min(W - 1, Math.floor(x + h));
    var y0 = Math.max(0, Math.floor(y - h)), y1 = Math.min(this.crackH - 1, Math.floor(y + h));
    for (var yy = y0; yy <= y1; yy++) for (var xx = x0, r = yy * W; xx <= x1; xx++) if (g[r + xx]) return true;
    return false;
  };
  // does an open crack cross the straight line between two points?
  S.crackOnLine = function (x0, y0, x1, y1, r) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy), n = Math.ceil(d / 2), h = Math.max(1, r - 2);
    for (var i = 1; i < n; i++) if (this.crackHits(x0 + dx * i / n, y0 + dy * i / n, h)) return true;
    return false;
  };

  // a monster from the network died: its cluster's meter moves, segments go dark
  S.networkKill = function (m) {
    var f = this.fissures[m.fid];
    if (!f || f.big) return;
    var cl = this.clusters[f.cluster];
    cl.killed++;
    var target = cl.killed >= cl.total ? cl.order.length : Math.floor(cl.order.length * cl.killed / cl.total);
    while (cl.darkN < target) this.darkenSeg(cl.order[cl.darkN++]);
  };
  S.darkenSeg = function (fs) {
    var f = this.fissures[fs[0]], s = fs[1];
    if (f.dark[s]) return;
    f.dark[s] = true; f.darkTick[s] = this.tick; f.litN--;
    this.lightSeg(f, s, -1);
    this.flowTick = -999;                              // walkers can path through it now
    this.progress();
    this.emit({ t: 'seg', id: f.id, seg: s, x: f.segX[s], y: f.segY[s] });
    if (this.B.fissure.segHeal) this.heal(this.player.maxHp * this.B.fissure.segHeal);
    if (!f.litN) { f.state = 'scar'; f.reveal = 0; this.closeReward(f); }
  };

  // nearest open segment of a cluster (or of any cluster when cl is null)
  S.nearestSeg = function (x, y, cl) {
    var best = null, bd = 1e9, i, s;
    for (i = 0; i < this.fissures.length; i++) {
      var f = this.fissures[i];
      if (f.big || !f.litN || (cl && f.cluster !== cl.id)) continue;
      for (s = 0; s < f.nSeg; s++) {
        if (f.dark[s]) continue;
        var d = Math.abs(f.segX[s] - x) + Math.abs(f.segY[s] - y);
        if (d < bd) { bd = d; best = { f: f, s: s, x: f.segX[s], y: f.segY[s], d: d }; }
      }
    }
    return best;
  };

  // spawn the next monster of a cluster beside one of its open segments, never on the crack
  S.spawnFromCluster = function (cl) {
    var type = cl.queue[0], def = this.B.monsters[type], rng = this.rngRoom, lit = [], i, s, k, j;
    for (i = 0; i < cl.cracks.length; i++) {
      var f = this.fissures[cl.cracks[i]];
      for (s = 0; s < f.nSeg; s++) if (!f.dark[s]) lit.push([f, s]);
    }
    if (!lit.length) return false;
    cl.queue.shift();
    for (k = 0; k < 4; k++) {
      var pick = lit[rng.int(0, lit.length - 1)], cf = pick[0], cells = cf.segCells[pick[1]], c = cells[rng.int(0, cells.length - 1)];
      var a0 = rng.range(0, G.M.TAU);
      for (j = 0; j < 16; j++) {
        var a = a0 + (j % 8) * G.M.TAU / 8, d = j < 8 ? 11 + def.r : 17 + def.r;
        var px = cf.x + c.x + G.M.cos(a) * d, py = cf.y + c.y + G.M.sin(a) * d;
        if (!this.boxHits(px, py, def.r) && !this.crackHits(px, py, def.r)) { this.spawnMonster(type, px, py, cf.id); return true; }
      }
    }
    this.spawnMonster(type, pick[0].x, pick[0].y, pick[0].id);     // fallback: it can always walk out of a crack
    return true;
  };

  S.openFissure = function (f) {
    f.state = 'opening'; f.t = 0; f.reveal = 0;
    this.progress();
    this.emit({ t: 'fissure', id: f.id, state: 'opening', big: f.big, x: f.x, y: f.y });
  };

  S.updateFissures = function (dt) {
    var F = this.B.fissure, fs = this.fissures, i, f, open = 0;
    for (i = 0; i < fs.length; i++) {
      f = fs[i];
      if (f.big) continue;
      if (f.state === 'opening') { f.t += dt; f.reveal = Math.min(1, f.t / F.openTime); if (f.reveal >= 1) f.state = 'open'; }
      if (f.state !== 'scar') open++;
    }
    if (this.phase === 'fissures') {
      this.spawnCd -= dt;
      if (this.spawnCd <= 0) {
        // the cluster nearest to the player spawns next, while the network's monsters stay under the cap
        var p = this.player, best = null, bd = 1e9, live = 0, cl;
        for (i = 0; i < this.clusters.length; i++) {
          cl = this.clusters[i];
          if (!cl.queue.length) continue;
          var ns = this.nearestSeg(p.x, p.y, cl);
          if (ns && ns.d < bd) { bd = ns.d; best = cl; }
        }
        for (i = 0; i < this.monsters.length; i++) {
          var m = this.monsters[i];
          if (!m.dead && !fs[m.fid].big) live += m.def.threat;
        }
        if (best && (!live || live + this.B.monsters[best.queue[0]].threat <= F.aliveThreat * (this.modDef.aliveThreat || 1) * F.budget[this.roomIndex])) {
          this.spawnFromCluster(best);
          this.spawnCd = F.spawnEvery * (this.modDef.spawnEvery || 1);
        } else this.spawnCd = 0.1;
      }
      if (!open) {
        this.phase = 'super';
        this.openFissure(fs[fs.length - 1]);
        this.emit({ t: 'phase', phase: 'super' });
      }
    }
    f = fs[fs.length - 1];                         // the super fissure: opens, spawns its wave, closes
    if (f.state === 'opening') {
      f.t += dt;
      f.reveal = Math.min(1, f.t / F.superOpenTime);
      if (f.reveal >= 1) { f.state = 'open'; f.spawnCd = 0.15; }
    } else if (f.state === 'open') {
      f.spawnCd -= dt;
      if (f.queue.length && f.spawnCd <= 0) {
        var a = this.rngRoom.range(0, 6.283), d = this.rngRoom.range(0, 10);
        this.spawnMonster(f.queue.shift(), f.x + G.M.cos(a) * d, f.y + G.M.sin(a) * d, f.id);
        f.spawnCd = F.superSpawnEvery;
      }
      if (!f.queue.length && f.alive <= 0) {
        f.state = 'closing'; f.t = 0;
        this.progress();
        this.emit({ t: 'fissure', id: f.id, state: 'closing', big: true, x: f.x, y: f.y });
      }
    } else if (f.state === 'closing') {
      f.t += dt;
      f.reveal = Math.max(0, 1 - f.t / F.superCloseTime);
      if (f.reveal <= 0) { f.state = 'scar'; this.closeReward(f); }
    }
  };

  // closing a fissure pays out: EXP, a heal, a gear roll; the super fissure also reveals the chest
  S.closeReward = function (f) {
    var F = this.B.fissure, L = this.B.loot, rng = this.rngRoom, i, n = f.big ? 6 : 3;
    this.progress();
    f.scarTick = this.tick;
    for (i = 0; i < n; i++) this.spawnOrb('exp', f.x, f.y, F.closeExp * (f.big ? 3 : 1) / n);
    this.heal(this.player.maxHp * (f.big ? F.superHeal : F.closeHeal));
    if (rng.chance(this.lootP(f.big ? L.superGear : L.closeGear))) this.spawnItem(f.x, f.y, f.big ? L.luck.super : L.luck.close);
    if (f.big && rng.chance(L.superTome)) this.spawnDrop('tome', f.x, f.y, null);
    for (i = 0; i < this.orbs.length; i++) this.orbs[i].magnet = true;
    this.emit({ t: 'fissure', id: f.id, state: 'scar', big: f.big, x: f.x, y: f.y });
    if (f.big) {
      this.phase = 'chest';
      this.chest.state = 'closed';
      this.emit({ t: 'phase', phase: 'chest' });
    }
  };

  S.fissureProgress = function () {
    var done = 0, total = 0, open = 0;
    for (var i = 0; i < this.fissures.length; i++) {
      var f = this.fissures[i];
      if (f.big) continue;
      total++;
      if (f.state === 'scar') done++;
      else if (f.state !== 'dormant') open++;
    }
    var big = this.fissures[this.fissures.length - 1];
    return { done: done, total: total, open: open, superState: big.state, states: this.fissures.map(function (f) { return f.state; }) };
  };

  // 0..1: how much of the super fissure's wave (or the boss) has been beaten down
  S.superProgress = function () {
    var f = this.fissures[this.fissures.length - 1], left = 0, i;
    if (f.state === 'scar' || f.state === 'closing') return 1;
    for (i = 0; i < f.queue.length; i++) left += Math.round(this.B.monsters[f.queue[i]].hp * this.threat);
    for (i = 0; i < this.monsters.length; i++) if (!this.monsters[i].dead && this.monsters[i].fid === f.id) left += this.monsters[i].hp;
    return f.dealt + left > 0 ? f.dealt / (f.dealt + left) : 0;
  };

  S.objective = function () {
    var fp = this.fissureProgress();
    if (this.phase === 'fissures') return 'Seal the fissures';
    if (this.phase === 'super') return this.room.boss ? 'Slay the Rift Tyrant' : 'Close the super fissure';
    if (this.phase === 'chest') return 'Open the chest';
    return this.room.boss ? 'Leave through the gate' : 'Take the exit';
  };

  // where the current objective is (for the off-screen pointer); null while the fight is on top of you
  S.objectiveTarget = function () {
    var p = this.player, f, best;
    if (this.phase === 'chest') return { x: this.chest.x, y: this.chest.y, kind: 'chest' };
    if (this.phase === 'exit') return { x: this.exit.x, y: this.exit.y, kind: 'exit' };
    if (this.phase === 'super') { f = this.fissures[this.fissures.length - 1]; return { x: f.x, y: f.y, kind: 'super' }; }
    best = this.nearestSeg(p.x, p.y, null);
    return best ? { x: best.x, y: best.y, kind: 'fissure' } : null;
  };

  S.updateRoomGoals = function () {
    var p = this.player, c = this.chest, e = this.exit, L = this.B.loot, i;
    if (this.phase === 'chest') {
      var dx = p.x - c.x, dy = p.y - c.y;
      if (dx * dx + dy * dy < 16 * 16) {
        c.state = 'open';
        var n = L.chestItems[this.roomIndex];
        for (i = 0; i < n; i++) this.spawnItem(c.x + (i - (n - 1) / 2) * 12, c.y + 14, this.room.boss ? L.luck.boss : L.luck.chest);
        this.phase = 'exit'; e.open = true;
        this.progress();
        this.emit({ t: 'chest', x: c.x, y: c.y });
        this.emit({ t: 'phase', phase: 'exit' });
      }
    } else if (this.phase === 'exit') {
      if (Math.abs(p.x - e.x) < 9 && p.y < e.y + 9) {
        this.roomsCleared++;
        this.progress();
        if (this.testRoom >= 0) this.restartTestRoom();
        else if (this.roomIndex === this.B.run.rooms - 1) this.finishRun('won');
        else this.enterChoice();
      }
    }
  };
})(globalThis.G = globalThis.G || {});
