// Room loop: fissures open, spawn, close into scars; then the super fissure, chest and exit.
(function (G) {
  var S = G.Sim.prototype;

  S.openFissure = function (f) {
    f.state = 'opening'; f.t = 0; f.reveal = 0;
    this.progress();
    this.emit({ t: 'fissure', id: f.id, state: 'opening', big: f.big, x: f.x, y: f.y });
  };

  S.updateFissures = function (dt) {
    var F = this.B.fissure, fs = this.fissures, i, f, active = 0, dormant = null, scars = 0, normal = 0;
    for (i = 0; i < fs.length; i++) {
      f = fs[i];
      if (f.big) continue;
      normal++;
      if (f.state === 'opening' || f.state === 'open') active++;
      else if (f.state === 'dormant') { if (!dormant) dormant = f; }
      else if (f.state === 'scar') scars++;
    }
    if (this.phase === 'fissures') {
      if (dormant) {
        this.openTimer -= dt;
        if (active === 0 && this.openTimer > 1.5) this.openTimer = 1.5;     // never leave the room idle
        if (this.openTimer <= 0 && active < F.maxActive) { this.openFissure(dormant); this.openTimer = F.nextDelay; }
      } else if (scars === normal) {
        this.phase = 'super';
        this.openFissure(fs[fs.length - 1]);
        this.emit({ t: 'phase', phase: 'super' });
      }
    }
    for (i = 0; i < fs.length; i++) {
      f = fs[i];
      if (f.state === 'opening') {
        f.t += dt;
        f.reveal = Math.min(1, f.t / (f.big ? F.superOpenTime : F.openTime));
        if (f.reveal >= 1) { f.state = 'open'; f.spawnCd = 0.15; }
      } else if (f.state === 'open') {
        f.spawnCd -= dt;
        if (f.queue.length && f.spawnCd <= 0) {
          var a = this.rngRoom.range(0, 6.283), d = this.rngRoom.range(0, f.big ? 10 : 6);
          this.spawnMonster(f.queue.shift(), f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, f.id);
          f.spawnCd = f.big ? F.superSpawnEvery : F.spawnEvery;
        }
        if (!f.queue.length && f.alive <= 0) {
          f.state = 'closing'; f.t = 0;
          this.progress();
          this.emit({ t: 'fissure', id: f.id, state: 'closing', big: f.big, x: f.x, y: f.y });
        }
      } else if (f.state === 'closing') {
        f.t += dt;
        f.reveal = Math.max(0, 1 - f.t / (f.big ? F.superCloseTime : F.closeTime));
        if (f.reveal <= 0) { f.state = 'scar'; this.closeReward(f); }
      }
    }
  };

  // closing a fissure pays out: EXP, a heal, a gear roll; the super fissure also reveals the chest
  S.closeReward = function (f) {
    var F = this.B.fissure, L = this.B.loot, rng = this.rngRoom, i, n = f.big ? 6 : 3;
    this.progress();
    f.scarTick = this.tick;
    for (i = 0; i < n; i++) this.spawnOrb('exp', f.x, f.y, F.closeExp * (f.big ? 3 : 1) / n);
    this.heal(this.player.maxHp * (f.big ? F.superHeal : F.closeHeal));
    if (rng.chance(f.big ? L.superGear : L.closeGear)) this.spawnItem(f.x, f.y, f.big ? L.luck.super : L.luck.close);
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
    if (this.phase === 'fissures') return fp.open || fp.done ? 'Seal the fissures' : 'Explore the room';
    if (this.phase === 'super') return this.room.boss ? 'Slay the Rift Tyrant' : 'Close the super fissure';
    if (this.phase === 'chest') return 'Open the chest';
    return this.room.boss ? 'Leave through the gate' : 'Take the exit';
  };

  S.updateRoomGoals = function () {
    var p = this.player, c = this.chest, e = this.exit, L = this.B.loot, i;
    if (this.phase === 'chest') {
      var dx = p.x - c.x, dy = p.y - c.y;
      if (dx * dx + dy * dy < 14 * 14) {
        c.state = 'open';
        var n = L.chestItems[this.roomIndex];
        for (i = 0; i < n; i++) this.spawnItem(c.x + (i - (n - 1) / 2) * 12, c.y + 14, this.room.boss ? L.luck.boss : L.luck.chest);
        this.phase = 'exit'; e.open = true;
        this.progress();
        this.emit({ t: 'chest', x: c.x, y: c.y });
        this.emit({ t: 'phase', phase: 'exit' });
      }
    } else if (this.phase === 'exit') {
      if (Math.abs(p.x - e.x) < 7 && p.y < e.y + 5) {
        this.roomsCleared++;
        this.progress();
        if (this.roomIndex === this.B.run.rooms - 1) { this.state = 'won'; this.emit({ t: 'won' }); }
        else this.loadRoom(this.roomIndex + 1);
      }
    }
  };
})(globalThis.G = globalThis.G || {});
