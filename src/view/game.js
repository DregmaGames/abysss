// Game scene: owns the sim, steps it at a fixed 60 Hz, and draws its state.
// The view never changes game state; it reads sim objects and plays sim events.
(function (G) {
  var UI = G.UI, STEP = 1000 / 60;
  var SHADOW = { s: 'shadow_s', m: 'shadow_m', l: 'shadow_l' };
  var DIE_COLOR = { riftling: 'rl2', gazer: 'gz2', husk: 'hb2', warden: 'wd3', boss: 'bs3' };

  G.GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'game' }); },

    create: function () {
      var P = G.params;
      G.screen = 'game';
      if (P.get('fresh') === '1') G.save = G.newSave();
      if (G.runSeed == null) G.runSeed = P.has('seed') ? parseInt(P.get('seed'), 10) >>> 0 : 1;
      if (G.tier == null) G.tier = 0;
      this.speed = parseFloat(P.get('speed') || '1');
      G.manualLevel = P.get('manual') === '1';      // QA: level-up cards are clicked by the test, not auto-picked
      this.sim = new G.Sim({ seed: G.runSeed, tier: G.tier, gear: G.save.gear, events: true });
      this.controls = new G.Controls(this);
      this.fx = new G.FX(this);
      this.fx.quiet = this.speed > 4;
      this.bot = P.get('bot') === '1' && G.Bot ? new G.Bot(this.sim) : null;
      this.maps = { monsters: new Map(), bolts: new Map(), shots: new Map(), orbs: new Map(), drops: new Map() };
      this.acc = 0; this.frame = 0; this.ended = false;
      this.groundG = this.add.graphics().setDepth(-90);     // cooldown rings, telegraphs
      this.player = this.add.image(0, 0, 'atlas', 'mage_0').setOrigin(0.4, 1);
      this.playerShadow = this.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-100);
      this.chest = this.add.image(0, 0, 'atlas', 'chest_closed').setOrigin(0.5, 1);
      this.door = this.add.image(0, 0, 'atlas', 'door_closed').setDepth(-850);
      this.cam = { x: 0, y: 0 };
      this.buildRoom();
      this.applySettings();
      G.gameScene = this;
      G.paused = false;
      if (G.HudScene) { if (this.scene.isActive('hud')) this.scene.stop('hud'); this.scene.launch('hud'); this.scene.bringToTop('hud'); }
      this.sim.events.length = 0;
      this.cameras.main.fadeIn(250, 10, 6, 18);
      G.ready = true;
    },

    applySettings: function () { this.cameras.main.setZoom(G.save.settings.zoom); },

    buildRoom: function () {
      var sim = this.sim, room = sim.room, self = this, k;
      if (this.roomView) this.roomView.destroy();
      if (this.fissG) this.fissG.forEach(function (g) { g.destroy(); });
      for (k in this.maps) { this.maps[k].forEach(function (s) { if (s.sh) s.sh.destroy(); s.destroy(); }); this.maps[k].clear(); }
      this.fx.clear();
      this.roomView = new G.RoomView(this, room);
      this.fissG = sim.fissures.map(function () { return self.add.graphics().setDepth(-700); });
      this.fissDirty = sim.fissures.map(function () { return true; });
      this.fissKey = sim.fissures.map(function () { return ''; });
      this.door.setPosition(room.exit.tx * 16 + 8, room.exit.ty * 16 + 8);
      this.chest.setPosition(sim.chest.x, sim.chest.y + 6).setDepth(sim.chest.y + 6);
      this.cam.x = sim.player.x; this.cam.y = sim.player.y;
    },

    // ------------------------------------------------------------- main loop
    update: function (time, delta) {
      var sim = this.sim, steps = 0, max = Math.max(8, Math.ceil(this.speed * 4));   // catch up to 8 steps per frame, then drop time
      this.frame++;
      if (!G.paused && !this.ended) {
        this.acc += Math.min(delta, 100) * this.speed;
        if (!this.bot) this.controls.read(sim.input);
        while (this.acc >= STEP && steps < max && sim.state === 'play') {
          this.acc -= STEP; steps++;
          if (this.bot) this.bot.update();
          sim.step();
        }
        if (this.acc > STEP * max) this.acc = 0;
        var stuck = sim.stuckSeconds();
        if (stuck > (this.worstStuck || 0)) this.worstStuck = stuck;
        if (sim.state === 'levelup' && !G.HudScene) sim.choosePassive(0);
      } else {
        this.controls.clear();
      }
      this.playEvents();
      this.sync();
      this.fx.update(Math.min(delta, 100) / 1000);
      this.updateCamera();
      this.roomView.tick(this.frame);
    },

    updateCamera: function () {
      var cam = this.cameras.main, p = this.sim.player, room = this.sim.room;
      var vw = 960 / cam.zoom, vh = 540 / cam.zoom, rw = room.w * 16, rh = room.h * 16;
      this.cam.x += (p.x - this.cam.x) * 0.14; this.cam.y += (p.y - this.cam.y) * 0.14;
      var cx = rw <= vw ? rw / 2 : Math.max(vw / 2, Math.min(rw - vw / 2, this.cam.x));
      var cy = rh <= vh ? rh / 2 : Math.max(vh / 2, Math.min(rh - vh / 2, this.cam.y));
      cam.centerOn(Math.round(cx) + this.fx.sx, Math.round(cy) + this.fx.sy);
    },

    // ---------------------------------------------------------------- events
    playEvents: function () {
      var ev = this.sim.events, fx = this.fx, i, e, s;
      for (i = 0; i < ev.length; i++) {
        e = ev[i];
        switch (e.t) {
          case 'hit':
            s = this.maps.monsters.get(e.id);
            if (s && !(s.flashCd > 0)) { s.flash = 3; s.flashCd = s.big ? 14 : 7; }
            fx.number(e.x, e.y, (e.crit ? e.dmg + '!' : '' + e.dmg), e.crit ? 'ui_warn' : 'ui_text');
            fx.burst(e.x, e.y + 4, 'orb', e.crit ? 5 : 2, 50, 0.25);
            if (e.crit) fx.shake(0.12);
            break;
          case 'phit':
            fx.number(e.x, e.y - 12, '-' + e.dmg, 'ui_bad');
            fx.burst(e.x, e.y, 'blood', 8, 70, 0.35);
            fx.shake(0.45);
            this.hurtFlash = 8;
            break;
          case 'heal': fx.number(e.x, e.y - 12, '+' + e.v, 'ui_good'); break;
          case 'die':
            fx.burst(e.x, e.y, DIE_COLOR[e.type] || 'rl2', e.type === 'boss' ? 60 : 10, e.type === 'boss' ? 130 : 70, e.type === 'boss' ? 0.9 : 0.4);
            fx.burst(e.x, e.y, 'rift_glow', 4, 40, 0.5);
            if (e.type === 'boss' || e.type === 'warden') { fx.shake(0.8); fx.ring(e.x, e.y, 4, 40, 0.4, 'ember'); }
            break;
          case 'spawn': fx.burst(e.x, e.y, 'rift_hot', 5, 40, 0.3); break;
          case 'pulse':
            fx.ring(e.x, e.y, 6, e.r, 0.28, 'rift_hot'); fx.ring(e.x, e.y, 2, e.r - 8, 0.34, 'rift_glow');
            fx.shake(0.3);
            break;
          case 'dodge': fx.burst(e.x, e.y, 'robe3', 6, 40, 0.3); this.dashTrail = 10; break;
          case 'windup': s = this.maps.monsters.get(e.id); if (s) s.wind = Math.round(e.dur * 60); break;
          case 'puff': fx.burst(e.x, e.y, 'ui_dim', 3, 30, 0.2); break;
          case 'slam': fx.ring(e.x, e.y, 8, e.r, 0.3, 'ember'); fx.burst(e.x, e.y, 'ember', 24, 120, 0.5); fx.shake(0.9); break;
          case 'enrage': fx.ring(e.x, e.y, 6, 60, 0.6, 'blood'); fx.shake(0.7); break;
          case 'fissure':
            this.fissDirty[e.id] = true;
            if (e.state === 'opening') { fx.shake(e.big ? 0.9 : 0.4); fx.ring(e.x, e.y, 2, e.big ? 36 : 18, 0.5, 'rift_glow', 0.6); }
            if (e.state === 'closing') fx.ring(e.x, e.y, e.big ? 40 : 22, 3, 0.6, 'scar_edge', 0.6);
            if (e.state === 'scar') { fx.burst(e.x, e.y, 'scar_hot', e.big ? 40 : 16, 80, 0.7); fx.shake(e.big ? 0.8 : 0.3); }
            break;
          case 'chest': fx.burst(e.x, e.y, 'gold', 24, 90, 0.7); fx.ring(e.x, e.y, 3, 26, 0.4, 'gold'); break;
          case 'drop': fx.burst(e.x, e.y, UI.RARITY[e.rarity], 6, 40, 0.5); break;
          case 'pickup': fx.burst(this.sim.player.x, this.sim.player.y, e.item ? UI.RARITY[e.item.rarity] : 'violet', 8, 50, 0.4); break;
          case 'room': this.buildRoom(); this.cameras.main.fadeIn(300, 10, 6, 18); break;
          case 'dead': fx.shake(1); fx.burst(this.sim.player.x, this.sim.player.y, 'robe2', 30, 100, 0.9); break;
        }
        if (G.hud) G.hud.onEvent(e);
      }
      ev.length = 0;
    },

    // ------------------------------------------------------------------ sync
    sync: function () {
      var sim = this.sim, tick = sim.tick, self = this, p = sim.player, i;
      // player
      var walk = p.moving ? [1, 0, 2, 0][(tick >> 3) & 3] : 0;
      this.player.setFrame('mage_' + walk).setFlipX(p.face < 0).setOrigin(p.face < 0 ? 0.6 : 0.4, 1);
      this.player.setPosition(p.x, p.y + p.r + 1).setDepth(p.y + p.r);
      this.playerShadow.setPosition(p.x, p.y + p.r);
      this.player.setVisible(sim.state !== 'dead');
      if (this.hurtFlash > 0) { this.hurtFlash--; this.player.setTintFill(0xffffff); }
      else if (p.dashT > 0) this.player.setTintFill(UI.hex('robe3'));
      else this.player.clearTint();
      this.player.setAlpha(p.iframes > 0 && p.dashT <= 0 && (tick >> 2) % 2 ? 0.45 : 1);
      if (this.dashTrail > 0) { this.dashTrail--; if (tick % 2 === 0) this.fx.burst(p.x, p.y, 'robe2', 1, 8, 0.25); }

      this.list('monsters', sim.monsters, function (m) {
        var s = self.add.image(m.x, m.y, 'atlas', m.type + '_0').setOrigin(0.5, 1);
        s.sh = self.add.image(m.x, m.y, 'atlas', SHADOW[m.def.shadow]).setDepth(-100);
        s.flash = 0; s.wind = 0; s.flashCd = 0; s.big = !!(m.def.boss || m.def.elite);
        return s;
      }, function (s, m) {
        s.setPosition(m.x, m.y + m.r + 1).setDepth(m.y + m.r).setFlipX(m.face < 0);
        s.setFrame(m.type + '_' + (((tick >> 3) + m.id) >> 1 & 1));
        s.sh.setPosition(m.x, m.y + m.r);
        s.setAlpha(m.emerge > 0 ? 0.6 : 1);
        if (s.flashCd > 0) s.flashCd--;
        if (s.flash > 0) { s.flash--; s.setTintFill(0xffffff); }
        else if (s.wind > 0) { s.wind--; if ((s.wind >> 2) % 2) s.setTintFill(UI.hex('ember_c')); else s.clearTint(); }
        else if (m.emerge > 0) s.setTint(UI.hex('rift_hot'));
        else if (m.enraged) s.setTint(UI.hex('ember'));
        else s.clearTint();
      });
      this.list('bolts', sim.bolts, function (b) { return self.add.image(b.x, b.y, 'atlas', 'bolt').setDepth(8000); },
        function (s, b) { s.setPosition(b.x, b.y); });
      this.list('shots', sim.shots, function (b) { return self.add.image(b.x, b.y, 'atlas', b.big ? 'shot_big' : 'shot').setDepth(8000); },
        function (s, b) { s.setPosition(b.x, b.y); });
      this.list('orbs', sim.orbs, function (o) { return self.add.image(o.x, o.y, 'atlas', o.kind === 'exp' ? 'orb_exp' : 'orb_heal').setDepth(-50); },
        function (s, o) { s.setPosition(o.x, o.y + (((tick >> 3) + o.id) % 4 === 0 ? -1 : 0)); });
      this.list('drops', sim.drops, function (d) {
        var s = self.add.image(d.x, d.y, 'atlas', d.kind === 'tome' ? 'i_tome' : 'i_' + d.item.slot).setDepth(d.y);
        s.sh = self.add.image(d.x, d.y + 7, 'atlas', 'shadow_s').setDepth(-100);
        s.rar = d.item ? d.item.rarity : 3;
        return s;
      }, function (s, d) {
        s.setPosition(d.x, d.y + ([0, -1, -2, -1][((tick >> 3) + d.id) & 3]));
        if ((tick + d.id * 7) % 24 === 0) self.fx.burst(d.x, d.y - 2, UI.RARITY[s.rar], 1 + (s.rar > 1 ? 1 : 0), 14, 0.6);
      });

      // chest and exit
      var c = sim.chest;
      this.chest.setVisible(c.state !== 'hidden').setFrame(c.state === 'open' ? 'chest_open' : 'chest_closed');
      this.door.setFrame(sim.exit.open ? 'door_open' : 'door_closed');

      // fissures
      for (i = 0; i < sim.fissures.length; i++) this.drawFissure(i, sim.fissures[i], tick);
      this.drawGround(tick);
    },

    list: function (name, arr, make, update) {
      var map = this.maps[name], seen = this.frame, i, s;
      for (i = 0; i < arr.length; i++) {
        s = map.get(arr[i].id);
        if (!s) { s = make(arr[i]); map.set(arr[i].id, s); }
        s.seen = seen;
        update(s, arr[i]);
      }
      if (map.size !== arr.length) {
        map.forEach(function (sp, id) { if (sp.seen !== seen) { if (sp.sh) sp.sh.destroy(); sp.destroy(); map.delete(id); } });
      }
    },

    // Fissure pixels: void core with a glowing violet rim while open; once sealed, a dark scar with an orange edge.
    drawFissure: function (i, f, tick) {
      var g = this.fissG[i], sim = this.sim, shimmer = tick >> 3;
      var hint = f.state === 'dormant' && sim.phase === 'fissures' && sim.openTimer < 1.3 && this.nextDormant() === f;
      var key = f.state + '|' + (f.state === 'open' ? shimmer : Math.round(f.reveal * 40)) + '|' + (hint ? 1 : 0) + '|' + (f.state === 'scar' ? Math.min(60, (sim.tick - (f.scarTick || sim.tick)) >> 3) : 0);
      if (key === this.fissKey[i] && !this.fissDirty[i]) return;
      this.fissKey[i] = key; this.fissDirty[i] = false;
      g.clear();
      if (f.state === 'dormant' && !hint) return;
      var cells = f.cells, n = cells.length, VOID = UI.hex('rift_void'), IN = UI.hex('rift_in'), GLOW = UI.hex('rift_glow'), HOT = UI.hex('rift_hot');
      var SD = UI.hex('scar_dark'), SE = UI.hex('scar_edge'), SM = UI.hex('scar_dim'), SH = UI.hex('scar_hot'), HAIR = UI.hex('f0');
      var cooling = f.state === 'scar' ? Math.min(1, (sim.tick - f.scarTick) / 480) : 0;
      for (var j = 0; j < n; j++) {
        var c = cells[j], col, h = (c.x * 7 + c.y * 13 + 1000) % 11;
        if (hint) { if (!c.core || c.o > 0.3) continue; col = HAIR; }
        else if (f.state === 'scar' || c.o > f.reveal) {
          if (f.state === 'opening') continue;
          // sealed part: orange-edged scar; hot pixels cool down over a few seconds
          col = c.core ? (h < 2 && cooling < 0.5 ? SM : SD) : (h < 4 - cooling * 3 ? SH : (h < 8 ? SE : SM));
        } else {
          col = c.core ? ((h + shimmer) % 9 === 0 ? IN : VOID) : ((h + shimmer) % 5 === 0 ? HOT : GLOW);
        }
        g.fillStyle(col, 1);
        g.fillRect(f.x + c.x, f.y + c.y, 1, 1);
      }
    },
    nextDormant: function () {
      var fs = this.sim.fissures;
      for (var i = 0; i < fs.length; i++) if (!fs[i].big && fs[i].state === 'dormant') return fs[i];
      return null;
    },

    // ground layer: pulse cooldown ring + dodge arc under the mage, telegraphed attack areas
    drawGround: function (tick) {
      var g = this.groundG, sim = this.sim, p = sim.player, s = sim.stats, i, j, pts, n, k;
      g.clear();
      if (sim.state === 'dead') return;
      var px = Math.round(p.x), py = Math.round(p.y + p.r);
      pts = G.ellipsePixels(10, 5); n = pts.length / 2;
      var ready = p.pulseCd <= 0, frac = ready ? 1 : 1 - p.pulseCd / s.pulseCd;
      k = Math.floor(frac * n);
      for (j = 0; j < n; j++) {
        g.fillStyle(UI.hex(ready ? ((tick >> 4) % 2 ? 'rift_hot' : 'rift_glow') : (j < k ? 'ui_hi' : 'wf1')), 1);
        g.fillRect(px + pts[j * 2], py + pts[j * 2 + 1], 1, 1);
      }
      if (p.dodgeCd > 0) {
        pts = G.ellipsePixels(6, 3); n = pts.length / 2; k = Math.floor((1 - p.dodgeCd / s.dodgeCd) * n);
        g.fillStyle(UI.hex('robe3'), 1);
        for (j = 0; j < k; j++) g.fillRect(px + pts[j * 2], py + pts[j * 2 + 1], 1, 1);
      }
      for (i = 0; i < sim.teles.length; i++) {
        var t = sim.teles[i], tx = Math.round(t.x), ty = Math.round(t.y), r = Math.round(t.r), f = t.t / t.dur;
        g.fillStyle(UI.hex('ember'), 1);
        pts = G.ellipsePixels(r, r);
        for (j = 0; j < pts.length; j += 2) g.fillRect(tx + pts[j], ty + pts[j + 1], 1, 1);
        g.fillStyle(UI.hex(f > 0.75 && (tick >> 2) % 2 ? 'ember_c' : 'scar_dim'), 1);
        var rr = Math.max(2, Math.round(r * f)), step = f > 0.75 ? 2 : 3;
        for (var yy = -rr; yy <= rr; yy += step) for (var xx = -rr; xx <= rr; xx += step) {
          if (xx * xx + yy * yy <= rr * rr && ((xx + yy) / step) % 2 === 0) g.fillRect(tx + xx, ty + yy, 1, 1);
        }
      }
    }
  });
})(globalThis.G = globalThis.G || {});
