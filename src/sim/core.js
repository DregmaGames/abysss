// Simulation core: run state, room loading, player, movement and collisions.
// Fixed 60 Hz step, no Phaser, no wall-clock, no Math.random: same seed + same inputs = same run.
(function (G) {
  var T = 16;

  function Sim(opts) {
    var B = this.B = opts.bal || G.BAL, C = this.cls = G.classDef(B, opts.cls);
    this.clsId = C.id;
    this.seed = opts.seed >>> 0;
    this.tier = opts.tier || 0;
    this.gear = opts.gear;
    this.keepEvents = !!opts.events;
    this.events = [];
    this.input = { mx: 0, my: 0, dodge: false, pulse: false };
    this.tick = 0;
    this.state = 'play';                 // play | levelup | dead | won
    this.kills = 0; this.roomsCleared = 0; this.nextId = 1;
    this.rngCombat = new G.RNG(G.hash32(this.seed, 9001));
    this.rngLevel = new G.RNG(G.hash32(this.seed, 4242));
    this.choices = []; this.choiceTome = false;
    this.cheats = opts.cheats || {};     // debug panel toggles: god, noCd (see the cheats section below)
    this.player = { x: 0, y: 0, r: C.base.r, hp: C.base.hp, maxHp: C.base.hp, fx: 0, fy: -1, face: 1, moving: false,
      atkCd: C.attack.firstCd, dodgeCd: 0, dashT: 0, dashX: 0, dashY: 0, iframes: 0, pulseCd: 0,
      level: 1, exp: 0, expNext: this.expFor(1), passives: {}, pending: 0, tomes: 0, walk: true,
      crackBlock: false, blockTick: -999, dashOver: false };
    this.stats = {};
    this.recalc();
    this.player.hp = this.stats.maxHp;
    this.testRoom = opts.testRoom ? B.run.testRoom : -1;   // test room: one room, restarted on clear
    this.loops = 0;
    this.loadRoom(this.testRoom >= 0 ? this.testRoom : 0);
  }
  var S = Sim.prototype;

  S.emit = function (o) { if (this.keepEvents) this.events.push(o); };
  S.progress = function () { this.progressTick = this.tick; };
  S.stuckSeconds = function () { return (this.tick - this.progressTick) * this.B.DT; };
  S.expFor = function (level) { var E = this.B.exp; return Math.round(E.base + E.grow * G.M.pow(level - 1, E.pow)); };

  // the class table entry for an id (unknown or missing id: the default class), with its id
  G.classDef = function (B, id) {
    if (!B.classes[id]) id = B.defaultClass;
    var C = B.classes[id];
    if (!C.id) C.id = id;
    return C;
  };
  // the weapon type table entry (with its id) a class swings with: from the equipped weapon item's
  // `wtype`, else the class's default. null for a class without weapon types.
  G.weaponOf = function (C, gear) {
    if (!C.weapons) return null;
    var it = gear && gear.equipped && gear.equipped.weapon, id = C.weaponForce || (it && it.wtype);
    if (!C.weapons[id]) id = C.defaultWeapon;
    var W = C.weapons[id]; if (!W.id) W.id = id;
    return W;
  };
  G.classIds = function (B) { return Object.keys(B.classes); };

  // derived stats = class base + gear + passives (pure; also used by the inventory screen outside a run)
  G.computeStats = function (B, gear, passives, cls) {
    var C = G.classDef(B, cls), P = C.base, cap = B.items.cap, g = G.gearStats(gear), p = G.passiveSums(passives || {}, B), s = {};
    function v(k) { return (g[k] || 0) + (p[k] || 0); }
    s.maxHp = Math.round(P.hp + v('hp'));
    s.dmg = P.dmg * (1 + v('dmgPct') / 100);
    s.atkInterval = P.atkInterval / (1 + v('atkPct') / 100);
    s.speed = P.speed * (1 + Math.min(cap.movePct, v('movePct')) / 100);
    s.range = P.range * (1 + v('rangePct') / 100);
    var W = G.weaponOf(C, gear);      // melee weapon type: damage, speed and reach
    if (W) { s.dmg *= W.dmg; s.atkInterval *= W.atk; s.range += W.reach; }
    s.crit = Math.min(cap.crit, P.crit * 100 + v('crit')) / 100;
    s.armor = v('armor');
    s.pulseDmg = C.skill.dmg * (1 + v('pulsePct') / 100);
    s.pulseCd = C.skill.cd * (1 - Math.min(cap.cdrPct, v('cdrPct') + (p.pulseCdPct || 0)) / 100);
    s.dodgeCd = C.dodge.cd * (1 - Math.min(cap.cdrPct, v('cdrPct') + (p.dodgeCdPct || 0)) / 100);
    s.regen = v('regen');
    s.expMult = 1 + v('expPct') / 100;
    s.pierce = p.pierce || 0; s.multi = p.multi || 0; s.leech = p.leech || 0;
    return s;
  };
  // called whenever gear or passives change: stats apply immediately
  S.recalc = function () {
    var oldMax = this.stats.maxHp || 0, s = this.stats = G.computeStats(this.B, this.gear, this.player.passives, this.clsId), pl = this.player;
    pl.maxHp = s.maxHp;
    if (oldMax && s.maxHp > oldMax) pl.hp += s.maxHp - oldMax;
    if (pl.hp > s.maxHp) pl.hp = s.maxHp;
  };

  S.loadRoom = function (index) {
    var B = this.B, room = this.room = G.genRoom(this.seed, index, B), F = B.fissure, self = this;
    this.roomIndex = index;
    this.rngRoom = new G.RNG(G.hash32(room.seed, 77));
    this.threat = B.run.tierMult[this.tier] * B.run.roomMult[index] * (1 + B.run.gearK * G.gearScore(this.gear));
    this.ilvl = 1 + this.tier * B.run.ilvlTier + Math.floor(index / B.run.ilvlRooms);
    this.player.x = room.start.x; this.player.y = room.start.y;
    this.player.dashT = 0;
    this.monsters = []; this.shots = []; this.bolts = []; this.orbs = []; this.drops = []; this.teles = [];
    this.setupFissures(room);           // src/sim/fissures.js
    this.phase = 'fissures';             // fissures | super | chest | exit
    this.roomTick = this.tick; this.spawnCd = F.firstDelay;
    this.chest = { x: room.chest.x, y: room.chest.y, state: 'hidden' };
    this.exit = { x: room.exit.x, y: room.exit.y, open: false };
    this.flow = new Int16Array(room.w * room.h);          // to the player, around walls (flyers)
    this.flowWalk = new Int16Array(room.w * room.h);      // to the player, around walls and open cracks (walkers)
    this.flowTile = -1; this.flowTick = -999;
    this.msgTick = -999;
    this.progress();
    this.emit({ t: 'room', index: index });
  };

  // ---------------------------------------------------------------- geometry
  S.wallAt = function (px, py) {
    var r = this.room, tx = Math.floor(px / T), ty = Math.floor(py / T);
    return tx < 0 || ty < 0 || tx >= r.w || ty >= r.h ? 1 : r.tiles[ty * r.w + tx];
  };
  S.boxHits = function (x, y, h) {
    return this.wallAt(x - h, y - h) || this.wallAt(x + h, y - h) || this.wallAt(x - h, y + h) || this.wallAt(x + h, y + h) ||
      (h > 8 && (this.wallAt(x, y - h) || this.wallAt(x, y + h) || this.wallAt(x - h, y) || this.wallAt(x + h, y)));
  };
  // axis-separated box move (slides along walls). |dx|,|dy| must stay below one tile.
  // Walkers (the player outside a dodge, monsters that do not fly) cannot step onto an open crack.
  // Leaving one is always allowed, so nothing can get trapped inside a crack.
  S.move = function (e, dx, dy) {
    var h = e.r, E = 0.01, cc = e.walk && this.crackLit > 0 && !(e.dashT > 0), inC = cc && this.crackHits(e.x, e.y, h), blk = false;
    if (dx) {
      e.x += dx;
      if (this.boxHits(e.x, e.y, h)) e.x = dx > 0 ? Math.floor((e.x + h) / T) * T - h - E : (Math.floor((e.x - h) / T) + 1) * T + h + E;
      if (cc && !inC && this.crackHits(e.x, e.y, h)) { e.x -= dx; blk = true; }
    }
    if (dy) {
      e.y += dy;
      if (this.boxHits(e.x, e.y, h)) e.y = dy > 0 ? Math.floor((e.y + h) / T) * T - h - E : (Math.floor((e.y - h) / T) + 1) * T + h + E;
      if (cc && !inC && this.crackHits(e.x, e.y, h)) { e.y -= dy; blk = true; }
    }
    if (e === this.player) e.crackBlock = blk;
  };
  // line of sight for a shot-sized object: two parallel rays 2 px either side, sampled every 2 px,
  // so "can see" always means "a bolt can get there" (no false positives at wall corners)
  S.los = function (x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return true;
    var n = Math.ceil(d / 2), ox = -dy / d * 2, oy = dx / d * 2;
    for (var i = 1; i < n; i++) {
      var x = x0 + dx * i / n, y = y0 + dy * i / n;
      if (this.wallAt(x + ox, y + oy) || this.wallAt(x - ox, y - oy)) return false;
    }
    return true;
  };
  // breadth-first distance field over floor tiles from one tile (monster pathing, bot pathing)
  // `block` (optional): extra blocked tiles, e.g. tiles an open crack runs through; the start tile is
  // always allowed, so a field can be built from a player standing next to a crack
  S.bfs = function (tx, ty, out, block) {
    var r = this.room, W = r.w, H = r.h, q = [], head = 0, i, t = r.tiles;
    for (i = 0; i < W * H; i++) out[i] = -1;
    if (tx < 0 || ty < 0 || tx >= W || ty >= H || t[ty * W + tx]) return out;
    out[ty * W + tx] = 0; q.push(ty * W + tx);
    while (head < q.length) {
      var c = q[head++], cx = c % W, d = out[c] + 1;
      if (cx + 1 < W && !t[c + 1] && out[c + 1] < 0 && !(block && block[c + 1])) { out[c + 1] = d; q.push(c + 1); }
      if (cx > 0 && !t[c - 1] && out[c - 1] < 0 && !(block && block[c - 1])) { out[c - 1] = d; q.push(c - 1); }
      if (c + W < W * H && !t[c + W] && out[c + W] < 0 && !(block && block[c + W])) { out[c + W] = d; q.push(c + W); }
      if (c - W >= 0 && !t[c - W] && out[c - W] < 0 && !(block && block[c - W])) { out[c - W] = d; q.push(c - W); }
    }
    return out;
  };
  // unit direction that follows a distance field downhill from (x,y); null when already at the goal tile
  S.fieldDir = function (field, x, y) {
    var r = this.room, W = r.w, tx = Math.floor(x / T), ty = Math.floor(y / T), here = field[ty * W + tx];
    if (here === 0) return null;
    var best = here < 0 ? 32767 : here, bx = 0, by = 0;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      var nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= r.h) continue;
      var d = field[ny * W + nx];
      if (d < 0 || d >= best) continue;
      if (dx && dy && (r.tiles[ty * W + nx] || r.tiles[ny * W + tx])) continue;   // no corner cutting
      best = d; bx = nx; by = ny;
    }
    if (best === (here < 0 ? 32767 : here)) return null;
    var vx = bx * T + 8 - x, vy = by * T + 8 - y, l = Math.sqrt(vx * vx + vy * vy) || 1;
    return { x: vx / l, y: vy / l };
  };

  // ------------------------------------------------------------------ player
  S.updatePlayer = function (dt) {
    var p = this.player, s = this.stats, P = this.B.player, D = this.cls.dodge, inp = this.input;
    var mx = inp.mx, my = inp.my, l = Math.sqrt(mx * mx + my * my);
    p.moving = l > 0.01;
    if (p.moving) { mx /= l; my /= l; p.fx = mx; p.fy = my; if (Math.abs(mx) > 0.2) p.face = mx > 0 ? 1 : -1; }
    if (p.atkCd > 0) p.atkCd -= dt;
    if (p.dodgeCd > 0) p.dodgeCd -= dt;
    if (p.pulseCd > 0) p.pulseCd -= dt;
    if (p.iframes > 0) p.iframes -= dt;
    if (s.regen && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + s.regen * dt);
    if (this.cheats.noCd) { p.dodgeCd = 0; p.pulseCd = 0; }

    if (inp.dodge && p.dodgeCd <= 0 && p.dashT <= 0) {
      p.dashT = D.time; p.dashX = p.fx; p.dashY = p.fy;
      p.iframes = Math.max(p.iframes, D.iframes);
      p.dodgeCd = s.dodgeCd;
      p.dashOver = false; p.dashHit = {};
      // cross: the dash line runs over an open crack (the view draws the hop arc)
      var cross = this.crackLit > 0 && this.crackOnLine(p.x, p.y, p.x + p.dashX * D.dist, p.y + p.dashY * D.dist, p.r);
      this.emit({ t: 'dodge', x: p.x, y: p.y, dx: p.dashX, dy: p.dashY, cross: cross, dur: D.time });
    }
    inp.dodge = false;
    if (p.dashT > 0) {
      var sp = D.dist / D.time * dt;
      this.move(p, p.dashX * sp, p.dashY * sp);
      if (!p.dashOver && this.crackHits(p.x, p.y, p.r)) p.dashOver = true;
      if (D.knock) this.chargeHit(D);
      p.dashT -= dt;
      if (p.dashT <= 0) this.emit({ t: 'land', x: p.x, y: p.y, cross: p.dashOver });
    } else if (p.moving) {
      this.move(p, mx * s.speed * dt, my * s.speed * dt);
      // pushing into an open crack: tell the view where, at most every blockedEvery seconds
      if (p.crackBlock && this.tick - p.blockTick >= P.blockedEvery * 60) {
        p.blockTick = this.tick;
        this.emit({ t: 'blocked', x: p.x + mx * (p.r + 2), y: p.y + my * (p.r + 2), dx: mx, dy: my });
      }
    }

    if (inp.pulse && p.pulseCd <= 0) this.castSkill();   // the class's active skill (input name kept: pulse)
    inp.pulse = false;
    if (p.atkCd <= 0) this.autoAttack();
  };

  S.hurtPlayer = function (dmg, x, y) {
    var p = this.player;
    if (p.iframes > 0 || this.state !== 'play' || this.cheats.god) return false;
    dmg = Math.max(1, Math.round(dmg * 100 / (100 + this.stats.armor)));
    p.hp -= dmg;
    p.iframes = this.B.player.hurtIframes;
    this.emit({ t: 'phit', x: p.x, y: p.y, dmg: dmg });
    if (p.hp <= 0) { p.hp = 0; this.state = 'dead'; this.emit({ t: 'dead' }); }
    return true;
  };
  S.heal = function (amount) {
    var p = this.player, before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (p.hp - before >= 1) this.emit({ t: 'heal', x: p.x, y: p.y, v: Math.round(p.hp - before) });
  };

  // -------------------------------------------------------------- progression
  S.gainExp = function (v) {
    var p = this.player;
    p.exp += v * this.stats.expMult;
    while (p.exp >= p.expNext) { p.exp -= p.expNext; p.level++; p.expNext = this.expFor(p.level); p.pending++; }
    if (p.pending > 0 && this.state === 'play') this.openLevelUp(false);
  };
  S.openLevelUp = function (tome) {
    var p = this.player;
    this.choices = G.rollPassives(this.rngLevel, p.passives, this.B, tome, this.cls.passives);
    this.choiceTome = tome;
    if (!this.choices.length) {           // everything maxed: heal instead
      if (tome) p.tomes--; else p.pending--;
      this.heal(p.maxHp * 0.2);
      return;
    }
    this.state = 'levelup';
    this.emit({ t: 'levelup', tome: tome });
  };
  S.choosePassive = function (i) {
    if (this.state !== 'levelup' || !this.choices[i]) return false;
    var p = this.player, id = this.choices[i];
    p.passives[id] = (p.passives[id] || 0) + 1;
    if (this.choiceTome) p.tomes--; else { p.pending--; this.heal(p.maxHp * this.B.player.levelHeal); }
    this.recalc();
    this.state = 'play';
    this.choices = [];
    this.emit({ t: 'passive', id: id });
    if (p.pending > 0) this.openLevelUp(false);
    else if (p.tomes > 0) this.openLevelUp(true);
    return true;
  };

  // ---------------------------------------------------------------- inventory
  S.equip = function (bagIdx) {
    var key = G.equipFromBag(this.gear, bagIdx, this.B);
    if (key) { this.recalc(); this.emit({ t: 'equip', slot: key }); }
    return key;
  };
  S.unequip = function (key) {
    var ok = G.unequip(this.gear, key, this.B);
    if (ok) { this.recalc(); this.emit({ t: 'equip', slot: key }); }
    return ok;
  };
  S.dropItem = function (bagIdx) { return G.dropFromBag(this.gear, bagIdx); };

  // ------------------------------------------------------------------ cheats
  // Debug panel actions, to reach any part of a run fast. They go through the normal sim paths
  // (kill, darkenSeg, loadRoom), so the rest of the run behaves as it would in play.
  S.cheatKillAll = function () {
    for (var i = 0; i < this.monsters.length; i++) if (!this.monsters[i].dead) this.kill(this.monsters[i]);
  };
  // network -> all dark (super fissure opens); super -> its wave is gone (it closes, chest appears);
  // chest -> the mage stands on it; exit -> the mage stands in the gate
  S.cheatSkipPhase = function () {
    var i, f, p = this.player;
    if (this.phase === 'fissures') {
      this.cheatKillAll();
      for (i = 0; i < this.clusters.length; i++) {
        var cl = this.clusters[i];
        cl.queue = [];
        while (cl.darkN < cl.order.length) this.darkenSeg(cl.order[cl.darkN++]);
      }
    } else if (this.phase === 'super') {
      f = this.fissures[this.fissures.length - 1];
      f.queue = [];
      if (f.state === 'opening') { f.state = 'open'; f.reveal = 1; }
      this.cheatKillAll();
    } else if (this.phase === 'chest') { p.x = this.chest.x; p.y = this.chest.y; }
    else if (this.phase === 'exit') { p.x = this.exit.x; p.y = this.exit.y; }
    this.progress();
  };
  // test room: the same room again, full HP; level, passives and gear are kept
  S.restartTestRoom = function () {
    this.loops++;
    this.player.hp = this.player.maxHp;
    this.loadRoom(this.roomIndex);
  };
  S.cheatRoom = function (index) {
    index = Math.max(0, Math.min(this.B.run.rooms - 1, index));
    if (index > this.roomIndex) this.roomsCleared += index - this.roomIndex;
    this.loadRoom(index);
  };
  S.cheatLevel = function () {
    var p = this.player;
    this.gainExp((p.expNext - p.exp) / this.stats.expMult + 0.01);
  };
  S.cheatLoot = function () {
    var p = this.player;
    for (var i = -1; i <= 1; i++) this.spawnItem(p.x + i * 14, p.y + 12, this.B.loot.luck.boss);
  };

  // -------------------------------------------------------------------- step
  S.step = function () {
    if (this.state !== 'play') return;
    var dt = this.B.DT;
    this.tick++;
    this.updatePlayer(dt);
    this.updateFlow();
    this.updateFissures(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateRoomGoals();
  };

  S.updateFlow = function () {
    var p = this.player, tile = Math.floor(p.y / T) * this.room.w + Math.floor(p.x / T);
    if (tile !== this.flowTile || this.tick - this.flowTick > 30) {
      this.bfs(Math.floor(p.x / T), Math.floor(p.y / T), this.flow);
      if (this.crackLit > 0) this.bfs(Math.floor(p.x / T), Math.floor(p.y / T), this.flowWalk, this.crackTile);
      else this.flowWalk.set(this.flow);
      this.flowTile = tile; this.flowTick = this.tick;
    }
  };

  G.Sim = Sim;
})(globalThis.G = globalThis.G || {});
