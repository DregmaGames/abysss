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
    this.state = 'play';                 // play | levelup | choice (after a room: leave or a door) | dead | won | left
    this.bag = [];                       // the sealed bag: gear found in this run; kept on leave / win, lost on death (finishRun)
    this.mod = null;                     // the door modifier of the current room (BAL.doors.mods id)
    this.doors = [];                     // the doors offered now (state 'choice'); doorLog: the ids taken, in order
    this.doorLog = []; this.lootBonus = 0; this.result = null;
    this.kills = 0; this.roomsCleared = 0; this.nextId = 1;
    this.rngCombat = new G.RNG(G.hash32(this.seed, 9001));
    this.rngLevel = new G.RNG(G.hash32(this.seed, 4242));
    this.choices = []; this.choiceTome = false;
    this.cheats = opts.cheats || {};     // debug panel toggles: god, noCd (see the cheats section below)
    this.player = { x: 0, y: 0, r: C.base.r, hp: C.base.hp, maxHp: C.base.hp, fx: 0, fy: -1, face: 1, moving: false,
      atkCd: C.attack.firstCd, dodgeCd: 0, dashT: 0, dashX: 0, dashY: 0, iframes: 0, pulseCd: 0,
      level: 1, exp: 0, expNext: this.expFor(1), pending: 0, tomes: 0, walk: true,
      abil: {}, slots: [null, null, null], every: {}, buffs: {},
      crackBlock: false, blockTick: -999, dashOver: false };
    this.stats = {};
    // abilities: offer pool, effect state (src/sim/effects.js)
    this.pool = G.abilityPool(B, C.id);
    this.orbiters = []; this.orbitAng = {}; this.zones = []; this.echoes = [];
    this.fxOn = { hit: [], crit: [], strike: [], attack: [], kill: [] }; this.orbitDefs = {}; this.orbitKeys = [];
    this.fxPre = []; this.boltMods = { bounce: null }; this.leechLeft = 0;
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

  // derived stats = class base + gear + abilities (pure; also used by the inventory screen outside a run)
  // `abil`: the player's { abilityId: rank } map
  G.computeStats = function (B, gear, abil, cls) {
    var C = G.classDef(B, cls), P = C.base, cap = B.items.cap, g = G.gearStats(gear, B, cls), s = {}, W0 = G.weaponOf(C, gear);
    var p = G.abilityStats(abil || {}, B, W0 && W0.id);
    function v(k) { return (g[k] || 0) + (p[k] || 0); }
    s.maxHp = Math.round(P.hp + v('hp'));
    s.dmg = P.dmg * (1 + v('dmgPct') / 100);
    s.atkInterval = P.atkInterval / (1 + v('atkPct') / 100);
    s.speed = P.speed * (1 + Math.min(cap.movePct, v('movePct')) / 100);
    s.range = P.range * (1 + v('rangePct') / 100);
    var W = W0;      // melee weapon type: damage, speed and reach
    if (W) { s.dmg *= W.dmg; s.atkInterval *= W.atk; s.range += W.reach; }
    s.crit = Math.min(cap.crit, P.crit * 100 + v('crit')) / 100;
    s.armor = v('armor');
    s.pulseDmg = C.skill.dmg * (1 + v('pulsePct') / 100);
    s.pulseCd = C.skill.cd * (1 - Math.min(cap.cdrPct, v('cdrPct') + (p.pulseCdPct || 0)) / 100);
    s.dodgeCd = C.dodge.cd * (1 - Math.min(cap.cdrPct, v('cdrPct') + (p.dodgeCdPct || 0)) / 100);
    s.regen = v('regen');
    s.expMult = 1 + v('expPct') / 100;
    s.pierce = (P.pierce || 0) + (p.pierce || 0); s.multi = p.multi || 0; s.leech = p.leech || 0;
    // ability multipliers (1 when the stat is absent)
    s.critMult = P.critMult + (p.critDmg || 0) / 100;
    s.dotMult = 1 + (p.dotPct || 0) / 100; s.chillMult = 1 + (p.chillPct || 0) / 100; s.chilledMult = 1 + (p.chilledPct || 0) / 100;
    s.durMult = 1 + (p.durPct || 0) / 100; s.procMult = 1 + (p.procPct || 0) / 100; s.fxMult = 1 + (p.fxPct || 0) / 100;
    s.areaMult = 1 + (p.areaPct || 0) / 100; s.eliteMult = 1 + (p.elitePct || 0) / 100; s.lowHpMult = 1 + (p.lowHpPct || 0) / 100;
    s.arcMult = 1 + (p.arcPct || 0) / 100; s.knockMult = 1 + (p.knockPct || 0) / 100;
    return s;
  };
  // called whenever gear or abilities change: stats apply immediately
  S.recalc = function () {
    var oldMax = this.stats.maxHp || 0, s = this.stats = G.computeStats(this.B, this.gear, this.player.abil, this.clsId), pl = this.player;
    pl.maxHp = s.maxHp;
    if (oldMax && s.maxHp > oldMax) pl.hp += s.maxHp - oldMax;
    if (pl.hp > s.maxHp) pl.hp = s.maxHp;
    this.compileFx();
  };

  // `mod`: the door modifier of this room (an id of BAL.doors.mods, or none)
  S.loadRoom = function (index, mod) {
    var B = this.B, room = this.room = G.genRoom(this.seed, index, B, mod), F = B.fissure, self = this, dm = G.doorMod(B, mod) || {};
    this.roomIndex = index;
    this.mod = mod && B.doors.mods[mod] ? mod : null;
    this.modDef = dm; this.lootBonus = dm.loot || 0;
    this.rngRoom = new G.RNG(G.hash32(room.seed, 77));
    this.threat = B.run.tierMult[this.tier] * B.run.roomMult[index] * (dm.threat || 1) * (1 + B.run.gearK * G.gearScore(this.gear));
    this.ilvl = 1 + this.tier * B.run.ilvlTier + Math.floor(index / B.run.ilvlRooms);
    this.player.x = room.start.x; this.player.y = room.start.y;
    this.player.dashT = 0;
    this.monsters = []; this.shots = []; this.bolts = []; this.orbs = []; this.drops = []; this.teles = [];
    this.zones = []; this.echoes = [];
    this.orbiters = this.orbiters.filter(function (o) { return o.perm; });
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
    this.emit({ t: 'room', index: index, mod: this.mod });
  };

  // ------------------------------------------------------------ run end and doors (step 6)
  // The run is over: 'dead' empties the sealed bag (and, if BAL.run.deathKeepsEquipped is false, strips the equipped gear);
  // 'won' and 'left' put the sealed bag into the kept bag (gear.bag). this.result says what happened to the items.
  S.finishRun = function (kind) {
    var B = this.B, n = this.bag.length, best = G.bestRarity(this.bag), r = { kind: kind, items: n, best: best, kept: 0, lost: 0 };
    if (kind === 'dead') {
      r.lost = n;
      if (!B.run.deathKeepsEquipped) for (var k in this.gear.equipped) this.gear.equipped[k] = null;
    } else if (this.testRoom < 0) {
      var b = G.bankItems(this.gear, this.bag, B); r.kept = b.kept; r.lost = b.lost;
    } else r.lost = n;
    this.bag = [];
    this.result = r;
    this.state = kind;
    this.emit({ t: kind === 'dead' ? 'dead' : kind });
  };
  // after a room is cleared: the choice (leave, or one of two doors for the next room)
  S.enterChoice = function () {
    this.state = 'choice';
    this.doors = G.doorsFor(this.seed, this.roomIndex, this.B);
    this.progress();
    this.emit({ t: 'choice', doors: this.doors.slice() });
  };
  S.leave = function () {
    if (this.state !== 'choice') return false;
    this.finishRun('left');
    return true;
  };
  // i: index into this.doors. The chosen door is part of the run's inputs (doorLog).
  S.takeDoor = function (i) {
    if (this.state !== 'choice' || !this.doors[i]) return false;
    var id = this.doors[i];
    this.doorLog.push(id); this.doors = [];
    this.state = 'play';
    this.loadRoom(this.roomIndex + 1, id);
    return true;
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
      var spd = s.speed * (1 + this.buffTotal('movePct') / 100);
      this.move(p, mx * spd * dt, my * spd * dt);
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
    if (p.hp <= 0) { p.hp = 0; this.finishRun('dead'); }
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
    this.choices = G.rollAbilities(this.rngLevel, p, this.B, this.pool, tome);
    this.choiceTome = tome;
    if (!this.choices.length) {           // everything maxed: heal instead
      if (tome) p.tomes--; else p.pending--;
      this.heal(p.maxHp * 0.2);
      return;
    }
    this.state = 'levelup';
    this.emit({ t: 'levelup', tome: tome });
  };
  // kept for callers without a slot choice (the view without a HUD): a full-slot card replaces slot 0
  S.choosePassive = function (i) { return this.chooseAbility(i, 0); };

  // ability system: is card i a new active while all slots are taken (the player must pick a slot to replace)?
  S.needsSlot = function (i) {
    var id = this.choices[i], p = this.player;
    if (!id || this.B.abilities[id].type !== 'active' || p.abil[id]) return false;
    return p.slots.indexOf(null) < 0;
  };
  // Take card i. A new active goes into the first free slot, or replaces `slot` (0-2) and loses all its ranks.
  // Returns false (wrong state or card), 'slot' (a slot is needed and `slot` is not 0-2; nothing changes) or true.
  S.chooseAbility = function (i, slot) {
    if (this.state !== 'levelup' || !this.choices[i]) return false;
    var p = this.player, B = this.B, id = this.choices[i], d = B.abilities[id], replaced = null, at = -1;
    if (this.needsSlot(i) && !(slot === 0 || slot === 1 || slot === 2)) return 'slot';
    var before = G.familyCounts(p.abil, B), k;
    if (d.type === 'active') {
      at = p.slots.indexOf(id);
      if (at < 0) {
        at = p.slots.indexOf(null);
        if (at < 0) {
          at = slot; replaced = p.slots[at];
          delete p.abil[replaced];
          for (k in p.every) if (k.indexOf(replaced + '/') === 0) delete p.every[k];
          for (k in p.buffs) if (k.indexOf(replaced + '/') === 0) delete p.buffs[k];
        }
        p.slots[at] = id;
      }
    }
    p.abil[id] = (p.abil[id] || 0) + 1;
    if (this.choiceTome) p.tomes--; else { p.pending--; this.heal(p.maxHp * B.player.levelHeal); }
    this.recalc();
    this.state = 'play';
    this.choices = [];
    this.emit({ t: 'ability', id: id, rank: p.abil[id], slot: at, replaced: replaced });
    var after = G.familyCounts(p.abil, B);
    Object.keys(B.families).forEach(function (fam) {
      var a = G.famTier(after[fam] || 0, B), b = G.famTier(before[fam] || 0, B);
      if (a !== b) this.emit({ t: 'famTier', fam: fam, tier: a, prev: b });
    }, this);
    if (p.pending > 0) this.openLevelUp(false);
    else if (p.tomes > 0) this.openLevelUp(true);
    return true;
  };
  // debug panel: the actives of the class's default bot build (up to the slot count)
  S.defaultActives = function () {
    var b = this.B.builds && this.B.builds[this.clsId], B = this.B, out = [];
    if (!b) return out;
    b[Object.keys(b)[0]].order.forEach(function (id) { if (B.abilities[id].type === 'active' && out.length < B.abilityRules.slots) out.push(id); });
    return out;
  };
  // debug: set the listed abilities to rank 1 (actives into free slots, replacing nothing)
  S.cheatAbilities = function (ids) {
    var p = this.player, B = this.B;
    ids.forEach(function (id) {
      var d = B.abilities[id];
      if (!d || p.abil[id]) return;
      if (d.type === 'active') { var at = p.slots.indexOf(null); if (at < 0) return; p.slots[at] = id; }
      p.abil[id] = 1;
    });
    this.recalc();
  };

  // ---------------------------------------------------------------- inventory
  // No equipping inside a run: the gear a run starts with stays on all run. Equip and discard happen between runs
  // (title screen) on gear.bag, with G.equipFromBag / G.unequip / G.dropFromBag.

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
  // test room: the same room again, full HP; level, abilities and gear are kept
  S.restartTestRoom = function () {
    this.loops++;
    this.player.hp = this.player.maxHp;
    this.loadRoom(this.roomIndex);
  };
  // jump to the after-room choice (as if this room had just been cleared)
  S.cheatChoice = function () {
    if (this.testRoom >= 0 || this.roomIndex >= this.B.run.rooms - 1 || this.state !== 'play') return;
    this.roomsCleared++;
    this.enterChoice();
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
    this.updateEffects(dt);
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
