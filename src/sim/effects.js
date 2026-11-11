// Ability effects (docs/specs/abilities.md, sections 6 and 7): monster statuses, triggers and effect kinds,
// orbiting bodies, ground zones, delayed echo attacks. Runs only for classes with `abilitySystem`.
// Batch A kinds: dot, chill, mark, chain, burst, split, echo, orbit, zone, heal. The other kinds of the
// spec (bounce, wave, whirl, fan, buff, leech, execute) are batch B and do nothing here.
(function (G) {
  var S = G.Sim.prototype;
  var STATUS_OF = { burning: 'burn', chilled: 'chill', poisoned: 'poison', bleeding: 'bleed', marked: 'mark' };
  var TWO_PI = Math.PI * 2;

  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  // ------------------------------------------------------------------ compile
  // Called by recalc(): turn the owned abilities into per-trigger effect lists (ranks and weapon type
  // resolved), in the order the spec fixes: slot 0, 1, 2, then family effects in `families` order.
  S.compileFx = function () {
    var p = this.player, B = this.B, on = { hit: [], crit: [], strike: [], attack: [], kill: [] }, defs = {}, keys = [], perm = [];
    var W = G.weaponOf(this.cls, this.gear), wt = W && W.id, i;
    function push(key, id, fam, f) {
      if (f.k === 'orbit') {
        defs[key] = f; keys.push(key);
        if (f.on === 'always') { perm.push(key); return; }
      }
      if (on[f.on]) on[f.on].push({ key: key, id: id, fam: fam, f: f });
    }
    for (i = 0; i < p.slots.length; i++) {
      var id = p.slots[i];
      if (!id) continue;
      G.resolveAbility(B, id, p.abil[id], wt).fx.forEach(function (f, j) { push(id + '/' + j, id, B.abilities[id].fam, f); });
    }
    var counts = G.familyCounts(p.abil, B);
    Object.keys(B.families).forEach(function (fam) {
      var t = G.famTier(counts[fam] || 0, B), F = B.families[fam], list = [];
      if (t >= 1 && F.t2.fx) list = list.concat(F.t2.fx);
      if (t >= 2 && F.t4.fx) list = list.concat(F.t4.fx);
      list.forEach(function (f, j) { push('fam:' + fam + '/' + j, null, fam, f); });
    });
    this.fxOn = on; this.orbitDefs = defs; this.orbitKeys = keys;
    // orbiting bodies: drop those of abilities that are gone, make the permanent ones
    this.orbiters = this.orbiters.filter(function (o) { return defs[o.key]; });
    perm.forEach(function (key) {
      var n = 0, f = defs[key];
      this.orbiters = this.orbiters.filter(function (o) { if (o.key !== key) return true; return ++n <= f.perm; });
      for (; n < f.perm; n++) this.orbiters.push({ key: key, life: 0, perm: true, hit: {}, x: 0, y: 0 });
    }, this);
  };

  // ----------------------------------------------------------------- statuses
  S.hasStatus = function (m, name) { return !!(m.fx && m.fx[STATUS_OF[name]]); };
  function fxOf(m) { return m.fx || (m.fx = { acc: 0 }); }

  // burn, poison, bleed: damage over time. dps and t are scaled here (dot and duration multipliers).
  S.addDot = function (m, kind, dps, t, stacks, base) {
    if (m.dead) return;
    var s = this.stats, f = fxOf(m), cur = f[kind];
    dps = dps * base * s.dotMult; t = t * s.durMult;
    if (!cur) { f[kind] = { n: 1, dps: dps, t: t }; this.emit({ t: 'status', id: m.id, s: kind }); }
    else if (kind === 'burn') { if (dps > cur.dps) cur.dps = dps; if (t > cur.t) cur.t = t; }
    else { cur.n = Math.min(stacks || 1, cur.n + 1); if (dps > cur.dps) cur.dps = dps; cur.t = t; }
  };
  S.addChill = function (m, slow, t) {
    if (m.dead) return;
    var s = this.stats, R = this.B.abilityRules, f = fxOf(m), cur = f.chill;
    slow = Math.min(R.maxSlow, slow * s.chillMult) * (m.def.boss ? R.chillBoss : (m.def.elite ? R.chillElite : 1));
    t = t * s.durMult;
    if (!cur) { f.chill = { slow: slow, t: t }; this.emit({ t: 'status', id: m.id, s: 'chill' }); }
    else { if (slow > cur.slow) cur.slow = slow; if (t > cur.t) cur.t = t; }
    m.slowMul = 1 - f.chill.slow;
  };
  S.addMark = function (m, pct, t) {
    if (m.dead) return;
    var f = fxOf(m), cur = f.mark;
    t = t * this.stats.durMult;
    if (!cur) { f.mark = { pct: pct, t: t }; this.emit({ t: 'status', id: m.id, s: 'mark' }); }
    else { if (pct > cur.pct) cur.pct = pct; if (t > cur.t) cur.t = t; }
  };
  // the `apply` block of burst and zone effects: statuses on every monster the effect damaged
  S.applyStatuses = function (m, ap, base) {
    if (!ap || m.dead) return;
    if (ap.burn) this.addDot(m, 'burn', ap.burn.dps, ap.burn.t, 1, base);
    if (ap.poison) this.addDot(m, 'poison', ap.poison.dps, ap.poison.t, ap.poison.stacks, base);
    if (ap.bleed) this.addDot(m, 'bleed', ap.bleed.dps, ap.bleed.t, ap.bleed.stacks, base);
    if (ap.chill) this.addChill(m, ap.chill.slow, ap.chill.t);
    if (ap.mark) this.addMark(m, ap.mark.pct, ap.mark.t);
  };

  // timers and damage ticks of one monster's statuses (called from updateMonsters, before its AI)
  S.tickStatus = function (m, dt) {
    var f = m.fx, tick = this.B.abilityRules.dotTick, dot = 0, k, i, KINDS = ['burn', 'poison', 'bleed'];
    for (i = 0; i < 3; i++) {
      k = KINDS[i];
      if (!f[k]) continue;
      f[k].t -= dt;
      if (f[k].t <= 0) delete f[k]; else dot += f[k].dps * f[k].n;
    }
    if (f.chill) { f.chill.t -= dt; if (f.chill.t <= 0) { delete f.chill; m.slowMul = 1; } }
    if (f.mark) { f.mark.t -= dt; if (f.mark.t <= 0) delete f.mark; }
    if (dot > 0) {
      f.acc += dt;
      if (f.acc >= tick) { f.acc -= tick; this.damageMonster(m, dot * tick, false, 'dot'); }
    } else f.acc = 0;
  };

  // ------------------------------------------------------------------ triggers
  // Run the effects of one trigger. `m`: the target (the monster hit, the dead monster, or the attack's
  // target); `base`: the damage shares are taken from; `b`: the bolt (for split).
  S.runFx = function (trig, m, base, b) {
    var list = this.fxOn[trig], s = this.stats, p = this.player, i, e, f;
    for (i = 0; i < list.length; i++) {
      e = list[i]; f = e.f;
      if (f.if && !this.hasStatus(m, f.if)) continue;
      if (f.every && trig === 'attack') {
        var n = (p.every[e.key] || 0) + 1;
        if (n < f.every) { p.every[e.key] = n; continue; }
        p.every[e.key] = 0;
      }
      if (f.chance !== undefined && !this.rngCombat.chance(Math.min(1, f.chance * s.procMult))) continue;
      this.doFx(e, f, m, base, trig === 'kill' ? 'kfx' : 'fx', b);
    }
  };

  // a bolt of the attack hit a monster (damage already dealt): hit, then crit, then strike (spec section 6)
  S.onAttackHit = function (b, m, dmg, crit) {
    var on = this.fxOn;
    if (on.hit.length) this.runFx('hit', m, dmg, b);
    if (crit && on.crit.length) this.runFx('crit', m, dmg, b);
    if (b.main && !b.struck) {
      b.struck = true;
      if (on.strike.length) this.runFx('strike', m, dmg, b);
    }
  };
  // a normal attack fired at `best`: the `attack` effects (counters count normal attacks only)
  S.runAttackFx = function (best) {
    if (this.fxOn.attack.length) this.runFx('attack', best, this.stats.dmg, null);
  };

  // ------------------------------------------------------------- effect kinds
  S.doFx = function (e, f, m, base, src, b) {
    var s = this.stats, p = this.player, R = this.B.abilityRules, i, cx, cy;
    switch (f.k) {
      case 'dot': this.addDot(m, f.dot, f.dps, f.t, f.stacks, base); break;
      case 'chill': this.addChill(m, f.slow, f.t); break;
      case 'mark': this.addMark(m, f.pct, f.t); break;
      case 'heal': this.heal(p.maxHp * f.pct); break;
      case 'chain': this.chainFx(e, f, m, base, src, f.on === 'attack'); break;
      case 'burst':
        if (f.at === 'player') { cx = p.x; cy = p.y; }
        else if (f.at === 'random') {
          var cand = [];
          for (i = 0; i < this.monsters.length; i++) {
            var q = this.monsters[i];
            if (!q.dead && q.emerge <= 0 && dist(q, p) <= s.range) cand.push(q);
          }
          if (!cand.length) return;
          var t = cand[this.rngCombat.int(0, cand.length - 1)];
          cx = t.x; cy = t.y;
        } else { cx = m.x; cy = m.y; }
        this.areaHit(cx, cy, f.r * s.areaMult, base * f.dmg * s.fxMult, (f.knock || 0) * s.knockMult, src, f.apply, base, e.fam);
        break;
      case 'split': this.splitFx(f, m, base, b); break;
      case 'echo': this.echoes.push({ t: f.delay, dmg: f.dmg }); break;
      case 'orbit':
        var grp = this.orbiters.filter(function (o) { return o.key === e.key; });
        if (f.max && grp.length >= f.max) grp[0].life = f.life;
        else this.orbiters.push({ key: e.key, life: f.life, perm: false, hit: {}, x: p.x, y: p.y });
        break;
      case 'zone':
        if (f.at === 'player') { cx = p.x; cy = p.y; } else { cx = m.x; cy = m.y; }
        this.zones.push({ x: cx, y: cy, r: f.r * s.areaMult, t: f.t * s.durMult, dps: base * f.dps * s.fxMult, base: base,
          apply: f.apply, src: src, fam: e.fam, acc: 0 });
        if (this.zones.length > R.maxZones) this.zones.shift();
        this.emit({ t: 'zone', x: cx, y: cy, r: f.r * s.areaMult, dur: f.t * s.durMult, fam: e.fam });
        break;
      default: break;    // batch B kinds: bounce, wave, whirl, fan, buff, leech, execute
    }
  };

  // Area hit: every living monster within R (edge to centre) takes `dmg` and a shove away from the
  // centre (negative knock pulls in; the boss is not moved, elites move 0.4), then the statuses in `ap`.
  S.areaHit = function (x, y, R, dmg, knock, src, ap, base, fam) {
    var ms = this.monsters, n = ms.length, i;
    this.emit({ t: 'burst', x: x, y: y, r: R, fam: fam });
    for (i = 0; i < n; i++) {
      var m = ms[i];
      if (m.dead) continue;
      var dx = m.x - x, dy = m.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d - m.r > R) continue;
      if (knock) {
        var k = m.def.boss ? 0 : (m.def.elite ? 0.4 : 1), l = d || 1;
        m.kx += dx / l * knock * k; m.ky += dy / l * knock * k;
      }
      this.damageMonster(m, dmg, false, src);
      if (ap) this.applyStatuses(m, ap, base);
    }
  };

  // Chain lightning: from the target (not hit again) to the nearest unhit monster in range and in sight, `jumps`
  // times. From the hero (`attack`), the first monster hit is the attack's target and `jumps` counts all hits.
  S.chainFx = function (e, f, m, base, src, fromHero) {
    var p = this.player, s = this.stats, hit = {}, x, y, pts = [], j, mult = 1;
    if (fromHero) { x = p.x; y = p.y; } else { x = m.x; y = m.y; hit[m.id] = 1; }
    pts.push(x, y);
    for (j = 0; j < f.jumps; j++) {
      var t = (j === 0 && fromHero) ? m : this.chainNext(x, y, f.r, hit);
      if (!t || t.dead) break;
      hit[t.id] = 1; pts.push(t.x, t.y);
      this.damageMonster(t, base * f.dmg * mult * s.fxMult, false, src);
      mult *= f.fall; x = t.x; y = t.y;
    }
    if (pts.length > 2) this.emit({ t: 'chain', pts: pts, fam: e.fam });
  };
  S.chainNext = function (x, y, r, hit) {
    var ms = this.monsters, best = null, bd = r, i;
    for (i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.dead || m.emerge > 0 || hit[m.id]) continue;
      var dx = m.x - x, dy = m.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd && this.los(x, y, m.x, m.y)) { bd = d; best = m; }
    }
    return best;
  };

  // Fracture: child bolts in a fan centred on the hitting bolt's direction. They skip the struck monster,
  // pierce nothing, count as attack hits but never strike (so they never split).
  S.splitFx = function (f, m, base, b) {
    if (!b) return;
    var A = this.cls.attack, a = G.M.atan2(b.vy, b.vx), n = f.n, i;
    for (i = 0; i < n; i++) {
      if (this.bolts.length >= this.B.abilityRules.maxBolts) break;
      var ang = n === 1 ? a : a + (i / (n - 1) - 0.5) * f.spread, hit = {};
      hit[m.id] = 1;
      this.bolts.push({ id: this.nextId++, x: b.x, y: b.y, vx: G.M.cos(ang) * A.speed, vy: G.M.sin(ang) * A.speed, r: A.r,
        dmg: base * f.dmg, crit: b.crit, life: f.life, pierce: 0, knock: A.knock, knockElite: A.knockElite, hit: hit, atk: true, main: false, child: true });
    }
  };

  // ------------------------------------------------------------------ per tick
  // echoes, orbiting bodies and ground zones (after the player, before monsters move)
  S.updateEffects = function (dt) {
    var s = this.stats, p = this.player, R = this.B.abilityRules, i, j, m;
    if (this.echoes.length) {
      var due = [], rest = [];
      for (i = 0; i < this.echoes.length; i++) {
        var ec = this.echoes[i];
        ec.t -= dt;
        (ec.t <= 0 ? due : rest).push(ec);
      }
      this.echoes = rest;
      for (i = 0; i < due.length; i++) {
        var best = this.findTarget();
        if (!best) continue;
        this.emit({ t: 'echo', x: p.x, y: p.y });
        if (this.cls.attack.kind === 'arc') this.swing(best); else this.shootBolts(best, { echo: true, dmgMul: due[i].dmg });
      }
    }
    // orbiting bodies: one angle per group, bodies spread evenly on the ring
    var keys = this.orbitKeys, k;
    for (k = 0; k < keys.length; k++) {
      var key = keys[k], def = this.orbitDefs[key], grp = [];
      this.orbitAng[key] = (this.orbitAng[key] || 0) + def.spin * dt;
      for (i = 0; i < this.orbiters.length; i++) if (this.orbiters[i].key === key) grp.push(this.orbiters[i]);
      for (i = 0; i < grp.length; i++) {
        var o = grp[i], a = this.orbitAng[key] + i * TWO_PI / grp.length;
        o.x = p.x + G.M.cos(a) * def.ring; o.y = p.y + G.M.sin(a) * def.ring;
        if (!o.perm) o.life -= dt;
        for (j = 0; j < this.monsters.length; j++) {
          m = this.monsters[j];
          if (m.dead || m.emerge > 0) continue;
          var dx = m.x - o.x, dy = m.y - o.y, rr = R.orbitR + m.r;
          if (dx * dx + dy * dy >= rr * rr || (o.hit[m.id] || 0) > this.tick) continue;
          o.hit[m.id] = this.tick + Math.ceil(def.hitEvery * 60);
          this.damageMonster(m, s.dmg * def.dmg * s.fxMult, false, 'fx');
        }
      }
    }
    if (this.orbiters.length) this.orbiters = this.orbiters.filter(function (o) { return o.perm || o.life > 0; });
    // ground zones
    if (this.zones.length) {
      var live = [], snap = this.zones;
      this.zones = [];                      // zones made by kills during this update are added after
      for (i = 0; i < snap.length; i++) {
        var z = snap[i];
        z.t -= dt; z.acc += dt;
        if (z.acc >= R.dotTick) {
          z.acc -= R.dotTick;
          for (j = 0; j < this.monsters.length; j++) {
            m = this.monsters[j];
            if (m.dead || dist(m, z) - m.r > z.r) continue;
            this.damageMonster(m, z.dps * R.dotTick, false, z.src);
            this.applyStatuses(m, z.apply, z.base);
          }
        }
        if (z.t > 0) live.push(z);
      }
      this.zones = live.concat(this.zones);
      while (this.zones.length > R.maxZones) this.zones.shift();
    }
  };
})(globalThis.G = globalThis.G || {});
