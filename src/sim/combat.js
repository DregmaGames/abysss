// Combat: auto-attack, pulse, monster AI, projectiles, pickups, kills and drops.
(function (G) {
  var S = G.Sim.prototype;

  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  // -------------------------------------------------------------- player kit
  // Auto-attack the nearest monster in range and in sight, the class's way (see BAL.classes).
  S.autoAttack = function () {
    var p = this.player, s = this.stats, best = null, bd = s.range, i, m;
    for (i = 0; i < this.monsters.length; i++) {
      m = this.monsters[i];
      if (m.dead) continue;
      var d = dist(m, p) - m.r;
      if (d < bd && this.los(p.x, p.y, m.x, m.y)) { bd = d; best = m; }
    }
    if (!best) return;
    if (Math.abs(best.x - p.x) > 2) p.face = best.x > p.x ? 1 : -1;
    if (this.cls.attack.kind === 'arc') this.swing(best); else this.shootBolts(best);
    p.atkCd = s.atkInterval;
  };

  // projectile: one bolt at the target, plus `multi` side bolts on each side
  S.shootBolts = function (best) {
    var p = this.player, s = this.stats, C = this.cls, A = C.attack, i;
    var a = G.M.atan2(best.y - p.y, best.x - p.x), life = s.range / A.speed * A.life;
    for (i = -s.multi; i <= s.multi; i++) {
      var ang = a + i * A.spread, crit = this.rngCombat.chance(s.crit);
      var dmg = s.dmg * (i === 0 ? 1 : A.sideDmg) * (crit ? C.base.critMult : 1);
      this.bolts.push({ id: this.nextId++, x: p.x, y: p.y - 2, vx: G.M.cos(ang) * A.speed, vy: G.M.sin(ang) * A.speed,
        r: A.r, dmg: dmg, crit: crit, life: life, pierce: s.pierce, knock: A.knock, knockElite: A.knockElite, hit: {} });
    }
    this.emit({ t: 'cast', x: p.x, y: p.y });
  };

  // melee: one swing toward the target that hits every monster within reach (s.range + its radius)
  // inside an arc of A.arc radians centred on the target. One crit roll per swing.
  S.swing = function (best) {
    var p = this.player, s = this.stats, C = this.cls, A = C.attack, i;
    var dx = best.x - p.x, dy = best.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l;
    var W = G.weaponOf(C, this.gear), arc = W ? W.arc : A.arc, kn = W ? W.knock : A.knock, kne = W ? W.knockElite : A.knockElite;
    var cosHalf = G.M.cos(arc / 2), crit = this.rngCombat.chance(s.crit), dmg = s.dmg * (crit ? C.base.critMult : 1);
    this.emit({ t: 'swing', x: p.x, y: p.y, a: G.M.atan2(uy, ux), arc: arc, r: s.range, crit: crit, w: W ? W.id : null });
    for (i = this.monsters.length - 1; i >= 0; i--) {
      var m = this.monsters[i];
      if (m.dead) continue;
      var mx = m.x - p.x, my = m.y - p.y, d = Math.sqrt(mx * mx + my * my) || 0.01;
      if (d - m.r > s.range) continue;
      if (m !== best && (mx * ux + my * uy) / d < cosHalf) continue;
      var k = m.def.boss ? 0 : (m.def.elite ? kne : kn);
      m.kx += mx / d * k; m.ky += my / d * k;
      this.damageMonster(m, dmg, crit);
    }
  };

  // the warrior's charge: every monster the dash touches is shoved along the dash once and takes a hit
  S.chargeHit = function (D) {
    var p = this.player, i, m;
    for (i = this.monsters.length - 1; i >= 0; i--) {
      m = this.monsters[i];
      if (m.dead || p.dashHit[m.id] || dist(m, p) > p.r + m.r + 3) continue;
      p.dashHit[m.id] = true;
      var k = m.def.boss ? 0 : (m.def.elite ? 0.4 : 1);
      m.kx += p.dashX * D.knock * k; m.ky += p.dashY * D.knock * k;
      this.emit({ t: 'bump', x: m.x, y: m.y });
      if (D.hit) this.damageMonster(m, this.stats.dmg * D.hit, false);
    }
  };

  // the active skill button; skill kinds: 'pulse' (a new kind adds a branch and a cast function)
  S.castSkill = function () {
    if (this.cls.skill.kind === 'pulse') this.castPulse();
  };

  S.castPulse = function () {
    var p = this.player, s = this.stats, K = this.cls.skill, R = K.radius, i;
    p.pulseCd = s.pulseCd;
    this.emit({ t: 'pulse', x: p.x, y: p.y, r: R });
    for (i = this.monsters.length - 1; i >= 0; i--) {
      var m = this.monsters[i], d = dist(m, p);
      if (m.dead || d - m.r > R) continue;
      var k = m.def.boss ? 0.15 : (m.def.elite ? 0.5 : 1), l = d || 1;
      m.kx += (m.x - p.x) / l * K.knock * k; m.ky += (m.y - p.y) / l * K.knock * k;
      this.damageMonster(m, s.pulseDmg, false);
    }
    for (i = this.shots.length - 1; i >= 0; i--) {      // the pulse also clears enemy shots
      if (dist(this.shots[i], p) < R) { this.emit({ t: 'puff', x: this.shots[i].x, y: this.shots[i].y }); this.shots.splice(i, 1); }
    }
  };

  // ---------------------------------------------------------------- monsters
  S.spawnMonster = function (type, x, y, fid) {
    var def = this.B.monsters[type], th = this.threat;
    if (this.boxHits(x, y, def.r)) { var f = this.fissures[fid]; x = f.x; y = f.y; }
    var m = { id: this.nextId++, type: type, def: def, x: x, y: y, r: def.r, hp: Math.round(def.hp * th), maxHp: Math.round(def.hp * th),
      dmg: def.dmg * th, mul: th, fid: fid, hitCd: 0.5, kx: 0, ky: 0, st: 'chase', t: 0, cd: 0.6 + this.rngCombat.next() * 1.2,
      cd2: def.summonEvery || 0, wind: 0, lx: 0, ly: 0, face: 1, los: true, emerge: 0.35, age: 0, atk: 0, px: x, py: y, bump: 0, detour: 0, walkLos: false, side: this.rngCombat.chance(0.5) ? 1 : -1 };
    if (def.boss) { m.t = 1.6; }
    m.walk = !def.fly && !def.boss;      // walkers go around open cracks; bats fly over, the boss ignores them
    this.monsters.push(m);
    this.fissures[fid].alive++;
    this.emit({ t: 'spawn', id: m.id, x: x, y: y, type: type });
    return m;
  };

  S.damageMonster = function (m, dmg, crit) {
    if (m.dead) return;
    dmg = Math.max(1, Math.round(dmg));
    this.fissures[m.fid].dealt += Math.min(dmg, m.hp);
    m.hp -= dmg;
    this.emit({ t: 'hit', id: m.id, x: m.x, y: m.y - m.r, dmg: dmg, crit: crit });
    if (m.hp <= 0) this.kill(m);
  };

  S.kill = function (m) {
    var L = this.B.loot, def = m.def, rng = this.rngRoom, i;
    m.dead = true;
    this.kills++;
    this.fissures[m.fid].alive--;
    this.progress();
    this.networkKill(m);
    this.emit({ t: 'die', id: m.id, x: m.x, y: m.y, type: m.type });
    var parts = def.boss ? 8 : (def.elite ? 3 : 1);
    for (i = 0; i < parts; i++) this.spawnOrb('exp', m.x, m.y, def.exp / parts);
    if (rng.chance(L.healOrb) || def.elite || def.boss) this.spawnOrb('heal', m.x, m.y, L.healOrbPct * (def.boss ? 3 : 1));
    var gearP = def.boss ? 1 : (def.elite ? L.eliteGear : L.killGear);
    if (rng.chance(gearP)) this.spawnItem(m.x, m.y, def.boss ? L.luck.boss : (def.elite ? L.luck.elite : L.luck.kill));
    if (!def.boss && rng.chance(L.killTome)) this.spawnDrop('tome', m.x, m.y, null);
    if (this.stats.leech) this.heal(this.stats.leech);
  };

  S.spawnOrb = function (kind, x, y, v) {
    var a = this.rngCombat.range(0, 6.283), sp = this.rngCombat.range(20, 60);
    this.orbs.push({ id: this.nextId++, kind: kind, x: x, y: y, v: v, vx: G.M.cos(a) * sp, vy: G.M.sin(a) * sp, magnet: false, age: 0 });
  };
  S.spawnDrop = function (kind, x, y, item) {
    var a = this.rngRoom.range(0, 6.283), d = this.rngRoom.range(6, 14), nx = x + G.M.cos(a) * d, ny = y + G.M.sin(a) * d;
    if (this.boxHits(nx, ny, 6)) { nx = x; ny = y; }
    this.drops.push({ id: this.nextId++, kind: kind, x: nx, y: ny, item: item, age: 0 });
    this.emit({ t: 'drop', x: nx, y: ny, kind: kind, rarity: item ? item.rarity : 2 });
  };
  S.spawnItem = function (x, y, luck) {
    this.spawnDrop('item', x, y, G.rollItem(this.rngRoom, this.ilvl, luck, this.B, this.gear, this.cls));
  };

  // direction a monster walks to reach the player: straight when it can see them, else along the
  // flow field. A monster that keeps bumping into a wall detours along the field for a while.
  S.steer = function (m, p, d) {
    var moved = Math.abs(m.x - m.px) + Math.abs(m.y - m.py);
    m.px = m.x; m.py = m.y;
    if (m.detour > 0) m.detour--;
    else if (moved < 0.15) { if (++m.bump > 8) { m.detour = 45; m.bump = 0; } }
    else m.bump = 0;
    var see = m.walk ? m.walkLos : m.los;          // a walker only goes straight if no open crack is in the way
    if ((see && !m.detour) || d < 12) return { x: (p.x - m.x) / (d || 1), y: (p.y - m.y) / (d || 1) };
    return this.fieldDir(m.walk ? this.flowWalk : this.flow, m.x, m.y) || { x: (p.x - m.x) / (d || 1), y: (p.y - m.y) / (d || 1) };
  };
  S.fireShot = function (m, ang, speed, dmg, kind) {
    this.shots.push({ id: this.nextId++, x: m.x, y: m.y, vx: G.M.cos(ang) * speed, vy: G.M.sin(ang) * speed, r: kind === 'big' ? 3.5 : 2.5, dmg: dmg, life: 5, kind: kind });
  };

  S.updateMonsters = function (dt) {
    var p = this.player, ms = this.monsters, B = this.B, i, j, m;
    for (i = 0; i < ms.length; i++) {
      m = ms[i];
      if (m.dead) continue;
      m.age += dt;
      if (m.hitCd > 0) m.hitCd -= dt;
      if (m.kx || m.ky) {
        this.move(m, m.kx * dt, m.ky * dt);
        m.kx *= 0.86; m.ky *= 0.86;
        if (Math.abs(m.kx) + Math.abs(m.ky) < 2) { m.kx = 0; m.ky = 0; }
      }
      if (m.emerge > 0) { m.emerge -= dt; continue; }
      if ((this.tick + m.id) % 10 === 0) {
        m.los = this.los(m.x, m.y, p.x, p.y);
        m.walkLos = m.los && !(m.walk && this.crackLit > 0 && this.crackOnLine(m.x, m.y, p.x, p.y, m.r));
      }
      var dx = p.x - m.x, dy = p.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 0.001, def = m.def, dir, sp = def.speed;
      if (Math.abs(dx) > 2) m.face = dx > 0 ? 1 : -1;
      var frenzy = m.age > 75 && !def.boss;      // failsafe: nothing may hide forever
      if (frenzy) sp *= 1.6;

      if (def.boss) {
        this.bossAI(m, dt, d, dx, dy);
      } else if (def.ai === 'chase' || def.ai === 'weave' || frenzy) {
        dir = this.steer(m, p, d);
        if (def.ai === 'weave' && !frenzy && d > 14) {      // bats swerve side to side as they close in
          var wv = G.M.sin(m.age * 7 + m.id) * def.weave, cw = G.M.cos(wv), sw = G.M.sin(wv);
          dir = { x: dir.x * cw - dir.y * sw, y: dir.x * sw + dir.y * cw };
        }
        this.move(m, dir.x * sp * dt, dir.y * sp * dt);
      } else if (def.ai === 'ranged' || def.ai === 'elite') {
        m.cd -= dt;
        if (m.wind > 0) {
          m.wind -= dt;
          if (m.wind <= 0) {
            var a = G.M.atan2(dy, dx);
            if (def.ai === 'elite') for (j = -1; j <= 1; j++) this.fireShot(m, a + j * def.spread, def.shotSpeed, def.shotDmg * m.mul, 'orb');
            else this.fireShot(m, a, def.shotSpeed, def.shotDmg * m.mul, 'bone');
            m.cd = def.shotEvery;
            this.emit({ t: 'shoot', id: m.id, x: m.x, y: m.y });
          }
        } else {
          var kmin = def.keepMin, kmax = def.keepMax;
          if (d > kmax || !m.los) { dir = this.steer(m, p, d); this.move(m, dir.x * sp * dt, dir.y * sp * dt); }
          else if (d < kmin) this.move(m, -dx / d * sp * 0.8 * dt, -dy / d * sp * 0.8 * dt);
          else this.move(m, -dy / d * m.side * sp * 0.5 * dt, dx / d * m.side * sp * 0.5 * dt);
          if ((this.tick + m.id) % 180 === 0) m.side = -m.side;
          if (m.cd <= 0 && m.los && d < (def.sight || 130)) { m.wind = def.windup; this.emit({ t: 'windup', id: m.id, dur: def.windup }); }
        }
        if (def.ai === 'elite') {
          m.cd2 -= dt;
          if (m.cd2 <= 0) {
            m.cd2 = def.summonEvery;
            for (j = 0; j < def.summon; j++) this.spawnMonster(def.summonType, m.x + (j ? 12 : -12), m.y + 8, m.fid);
          }
        }
      } else if (def.ai === 'lunge') {
        m.cd -= dt;
        if (m.st === 'wind') {
          m.t -= dt;
          if (m.t <= 0) { m.st = 'lunge'; m.t = def.lungeTime; }
        } else if (m.st === 'lunge') {
          this.move(m, m.lx * def.lungeSpeed * dt, m.ly * def.lungeSpeed * dt);
          m.t -= dt;
          if (m.t <= 0) { m.st = 'chase'; m.cd = def.lungeCd; }
        } else {
          dir = this.steer(m, p, d);
          this.move(m, dir.x * sp * dt, dir.y * sp * dt);
          if (d < def.lungeRange && m.cd <= 0 && m.los) {
            m.st = 'wind'; m.t = def.lungeWindup; m.lx = dx / d; m.ly = dy / d;
            this.emit({ t: 'windup', id: m.id, dur: def.lungeWindup });
          }
        }
      }
      if (d < m.r + p.r + 0.5 && m.hitCd <= 0) {
        if (this.hurtPlayer(m.st === 'charge' ? def.chargeDmg * m.mul : m.dmg, m.x, m.y)) m.hitCd = B.contactCd;
      }
    }
    // soft separation so packs do not stack on one pixel
    for (i = 0; i < ms.length; i++) {
      var a2 = ms[i];
      if (a2.dead || a2.def.boss) continue;
      for (j = i + 1; j < ms.length; j++) {
        var b = ms[j];
        if (b.dead || b.def.boss) continue;
        var ox = b.x - a2.x, oy = b.y - a2.y, min = a2.r + b.r;
        if (Math.abs(ox) >= min || Math.abs(oy) >= min) continue;
        var od = Math.sqrt(ox * ox + oy * oy);
        if (od >= min) continue;
        if (od < 0.01) { ox = 1; oy = 0; od = 1; }
        var push = (min - od) * 0.25;
        this.move(a2, -ox / od * push, -oy / od * push);
        this.move(b, ox / od * push, oy / od * push);
      }
    }
    for (i = ms.length - 1; i >= 0; i--) if (ms[i].dead) ms.splice(i, 1);
  };

  // ------------------------------------------------------------- projectiles
  S.updateProjectiles = function (dt) {
    var p = this.player, i, j, b;
    for (i = this.bolts.length - 1; i >= 0; i--) {
      b = this.bolts[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      var gone = b.life <= 0;
      if (!gone && this.wallAt(b.x, b.y)) { gone = true; this.emit({ t: 'puff', x: b.x, y: b.y }); }
      for (j = 0; j < this.monsters.length && !gone; j++) {
        var m = this.monsters[j];
        if (m.dead || b.hit[m.id]) continue;
        var dx = m.x - b.x, dy = m.y - b.y, rr = m.r + b.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        b.hit[m.id] = 1;
        var l = Math.sqrt(b.vx * b.vx + b.vy * b.vy), k = m.def.boss ? 0 : (m.def.elite ? b.knockElite : b.knock);
        m.kx += b.vx / l * k; m.ky += b.vy / l * k;
        this.damageMonster(m, b.dmg, b.crit);
        if (b.pierce > 0) b.pierce--; else gone = true;
      }
      if (gone) this.bolts.splice(i, 1);
    }
    for (i = this.shots.length - 1; i >= 0; i--) {
      b = this.shots[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      var dead = b.life <= 0;
      if (!dead && this.wallAt(b.x, b.y)) { dead = true; this.emit({ t: 'puff', x: b.x, y: b.y }); }
      if (!dead) {
        var ex = p.x - b.x, ey = p.y - b.y, er = p.r + b.r - 1;
        if (ex * ex + ey * ey < er * er && this.hurtPlayer(b.dmg, b.x, b.y)) dead = true;
      }
      if (dead) this.shots.splice(i, 1);
    }
    for (i = this.teles.length - 1; i >= 0; i--) {     // telegraphed area attacks
      var t = this.teles[i];
      t.t += dt;
      if (t.t >= t.dur) {
        if (dist(t, p) < t.r) this.hurtPlayer(t.dmg, t.x, t.y);
        this.emit({ t: 'slam', x: t.x, y: t.y, r: t.r });
        this.teles.splice(i, 1);
      }
    }
  };

  // ----------------------------------------------------------------- pickups
  S.updatePickups = function (dt) {
    var p = this.player, P = this.B.player, i;
    for (i = this.orbs.length - 1; i >= 0; i--) {
      var o = this.orbs[i];
      o.age += dt;
      var dx = p.x - o.x, dy = p.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      if (o.age > 0.25 && (o.magnet || d < P.pickupR)) {
        o.magnet = true;
        var sp = Math.min(260, 90 + o.age * 160) * dt;
        o.x += dx / d * sp; o.y += dy / d * sp;
      } else {
        var ox = o.x, oy = o.y;
        o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 0.9; o.vy *= 0.9;
        if (this.wallAt(o.x, o.y)) { o.x = ox; o.y = oy; o.vx = 0; o.vy = 0; }
      }
      if (d < 7) {
        this.orbs.splice(i, 1);
        if (o.kind === 'exp') { this.emit({ t: 'orb', kind: 'exp' }); this.gainExp(o.v); }
        else { this.emit({ t: 'orb', kind: 'heal' }); this.heal(p.maxHp * o.v); }
        if (this.state !== 'play') return;
      }
    }
    for (i = this.drops.length - 1; i >= 0; i--) {
      var dr = this.drops[i];
      dr.age += dt;
      if (dr.age < 0.4 || dist(dr, p) > 10) continue;
      if (dr.kind === 'tome') {
        this.drops.splice(i, 1);
        p.tomes++;
        this.emit({ t: 'pickup', kind: 'tome' });
        if (this.state === 'play' && p.pending === 0) { this.openLevelUp(true); return; }
      } else if (this.gear.bag.length < this.B.loot.bagSize) {
        this.drops.splice(i, 1);
        this.gear.bag.push(dr.item);
        this.emit({ t: 'pickup', kind: 'item', item: dr.item });
      } else if (this.tick - this.msgTick > 120) {
        this.msgTick = this.tick;
        this.emit({ t: 'msg', text: 'Bag is full' });
      }
    }
  };
})(globalThis.G = globalThis.G || {});
