// HUD scene. By default the screen shows only: HP, level, current objective, fissure
// progress and the inventory button. Touch controls appear only after a touch. Panels open on top.
(function (G) {
  var UI = G.UI;

  G.HudScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function HudScene() { Phaser.Scene.call(this, { key: 'hud' }); },

    create: function () {
      var self = this;
      G.hud = this;
      this.game_ = G.gameScene;
      this.L = null; this.level = null; this.toastT = 0; this.toastMsg = null;
      this.botWait = 0; this.endT = -1; this.stickId = null;
      this.build();
      this.game.events.on('viewchange', this.onView, this);

      var kb = this.input.keyboard;
      kb.on('keydown-I', function () { self.toggleInventory(); });
      kb.on('keydown-F2', function (e) { if (e && e.preventDefault) e.preventDefault(); self.toggleDebug(); });
      kb.on('keydown-TAB', function (e) { e.preventDefault(); self.toggleInventory(); });
      kb.on('keydown-ESC', function () { if (G.Panels.isOpen()) G.Panels.close(); else if (!self.level) G.Panels.openSettings(self); });
      ['ONE', 'TWO', 'THREE'].forEach(function (k, i) { kb.on('keydown-' + k, function () { self.pickLevel(i); }); });

      // touch: a floating stick on the left 60 % of the screen
      this.input.on('pointerdown', function (p, over) {
        if (p.wasTouch && !G.touch) { G.touch = true; self.build(); }
        if (!G.touch || over.length || G.paused || self.level || self.stickId != null) return;
        var S = G.view.S;
        if (p.x / S > G.view.W * 0.6) return;
        self.stickId = p.id; self.stickX = p.x / S; self.stickY = p.y / S;
        self.stickBase.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
        self.stickKnob.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
      });
      this.input.on('pointermove', function (p) {
        if (p.id !== self.stickId) return;
        var S = G.view.S, dx = p.x / S - self.stickX, dy = p.y / S - self.stickY, l = Math.sqrt(dx * dx + dy * dy) || 1, m = Math.min(l, 18);
        self.stickKnob.setPosition(Math.round(self.stickX + dx / l * m), Math.round(self.stickY + dy / l * m));
        var v = self.game_.controls.virtual;
        if (l < 5) { v.mx = 0; v.my = 0; } else { v.mx = dx / l; v.my = dy / l; }
      });
      var release = function (p) { if (p.id === self.stickId) self.dropStick(); };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);

      this.events.once('shutdown', function () {
        self.game.events.off('viewchange', self.onView, self);
        G.hud = null; G.Panels.close(true); G.paused = false;
      });
    },

    dropStick: function () {
      this.stickId = null;
      if (this.stickBase) { this.stickBase.setVisible(false); this.stickKnob.setVisible(false); }
      var v = this.game_.controls.virtual; v.mx = 0; v.my = 0;
    },

    onView: function () {
      this.build();
      if (this.level) this.openLevel();
      G.Panels.relayout(this);
    },

    // ---------------------------------------------------------------- layout
    build: function () {
      var self = this, V = G.view, X = UI.PAD, Y = UI.PAD;
      UI.camera(this);
      if (this.L) this.L.destroy();
      var L = this.L = UI.layer(this, 100);
      this.last = {};
      var vg = this.add.image(0, 0, UI.vignette(this)).setOrigin(0, 0);
      vg._dz = -50; L.add(vg);

      // HP + level (top-left)
      L.panel(X, Y, 86, 27, 'plate');
      L.image(X + 8, Y + 9, 'heart');
      L.bar(X + 15, Y + 4, 66, 9, 'hp_d');
      this.hpFill = L.bar(X + 15, Y + 4, 66, 9, 'hp', 1.5);
      this.hpText = L.text(X + 17, Y + 5, '');
      this.lvText = L.text(X + 5, Y + 17, '', 'ui_warn');
      L.bar(X + 37, Y + 19, 44, 3, 'xp_d');
      this.xpFill = L.bar(X + 37, Y + 19, 44, 3, 'xp', 1.5);

      // inventory button (top-right)
      this.invBtn = L.button(V.W - X - 26, Y, 26, 26, '', function () { self.toggleInventory(); }, { icon: 'i_bag', name: 'inv' });
      this.invBadge = L.text(V.W - X - 8, Y - 1, '!', 'ui_warn').setVisible(false);
      this.invBadge._dz = 4; this.invBadge.setDepth(L.depth + 4);

      // objective + fissure progress: top-centre, or a second row when the screen is narrow
      var free = V.W - (86 + X * 2) - (26 + X * 2);
      this.obj = free >= 150 ? { x: X + 86 + X, y: Y, w: free } : { x: X, y: Y + 30, w: V.W - X * 2 };
      // debug button (cheats for testing): under the inventory button, below the objective row if that wraps
      if (G.debug) L.button(V.W - X - 26, (this.obj.y === Y ? Y : this.obj.y) + 30, 26, 14, 'DBG', function () { self.toggleDebug(); }, { name: 'dbg' });
      this.objPlate = L.panel(0, this.obj.y, 100, 27, 'plate');
      this.objText = L.text(0, this.obj.y + 5, '');
      this.roomText = L.text(0, this.obj.y + 16, '', 'ui_dim');
      this.pips = [];
      this.superBarBg = L.bar(0, this.obj.y + 18, 72, 4, 'hp_d');
      this.superBar = L.bar(0, this.obj.y + 18, 72, 4, 'em2', 1.5);

      // transient toast (pickups, bag full): fades out, not part of the resting HUD
      this.toast = L.text(0, V.H - 30, '').setVisible(false);
      this.ptr = L.image(0, 0, 'pips_open').setVisible(false);
      if (this.toastMsg && this.toastT > 0) this.say(this.toastMsg[0], this.toastMsg[1], true);

      // touch controls: only once a touch has been seen (or ?touch=1)
      this.stickBase = L.image(0, 0, 'stick_base').setVisible(false);
      this.stickKnob = L.image(0, 0, 'stick_knob', 3).setVisible(false);
      this.stickId = null;
      this.tDodge = this.tPulse = null;
      if (G.touch) {
        var mk = function (x, y, icon, fn, name) {
          var b = L.image(x, y, 'tbtn'); L.image(x, y, icon, 3);
          b.setInteractive({ useHandCursor: true });
          b.on('pointerdown', fn);
          UI.hit(name, x - 15, y - 15, 30, 30);
          return b;
        };
        this.tPulse = mk(V.W - 24, V.H - 60, 't_pulse', function () { if (!G.paused) self.game_.controls.pulse(); }, 'tpulse');
        this.tDodge = mk(V.W - 58, V.H - 26, 't_dodge', function () { if (!G.paused) self.game_.controls.dodge(); }, 'tdodge');
      }
      this.refresh();
    },

    toggleDebug: function () {
      if (!G.debug || this.level) return;
      if (G.Panels.current === 'debug') { G.Panels.close(); return; }
      var st = this.game_.sim.state;
      if (st === 'dead' || st === 'won') return;
      this.dropStick();
      G.Panels.openDebug(this);
    },

    toggleInventory: function () {
      if (this.level) return;
      if (G.Panels.isOpen()) { G.Panels.close(); return; }
      var st = this.game_.sim.state;
      if (st === 'dead' || st === 'won') return;
      this.invBadge.setVisible(false);
      this.dropStick();
      G.Panels.openInventory(this);
    },

    say: function (text, color, keep) {
      this.toast.setText(text).setTint(UI.hex(color || 'ui_text')).setVisible(true).setAlpha(1);
      UI.centerX(this.toast, G.view.W / 2);
      this.toastMsg = [text, color];
      if (!keep) this.toastT = 150;
    },

    onEvent: function (e) {
      if (e.t === 'pickup') {
        if (e.item) { this.say(UI.RARITY_NAME[e.item.rarity] + ' ' + e.item.name, UI.RARITY[e.item.rarity]); this.invBadge.setVisible(true); }
        else this.say('Ability tome', 'tome2');
      } else if (e.t === 'msg') this.say(e.text, 'ui_bad');
      else if (e.t === 'levelup') this.openLevel();
      else if (e.t === 'dead' || e.t === 'won') this.endT = 50;
      else if (e.t === 'room') { this.last = {}; G.storeSave(G.save); }
    },

    // ------------------------------------------------------- level-up choice
    openLevel: function () {
      var sim = this.game_.sim, self = this, B = sim.B, V = G.view;
      if (this.level) this.level.destroy();
      if (sim.state !== 'levelup') { this.level = null; return; }
      if (G.Panels.isOpen()) G.Panels.close();
      this.dropStick();
      var n = sim.choices.length, row = V.W >= 300, gap = 6;
      var cw = row ? Math.min(108, Math.floor((V.W - 24 - gap * (n - 1)) / n)) : Math.min(V.W - 24, 230), ch = row ? 88 : 46;
      var mw = row ? n * cw + (n - 1) * gap + 16 : cw + 16, mh = row ? 40 + ch + 8 : 40 + n * (ch + gap) + 4;
      var m = this.level = UI.modal(this, mw, mh, null);
      UI.centerX(m.text(0, m.y + 7, sim.choiceTome ? 'ABILITY TOME' : 'LEVEL ' + sim.player.level, 'ui_warn', true), V.W / 2);
      UI.centerX(m.text(0, m.y + 26, 'Choose one passive', 'ui_dim'), V.W / 2);
      sim.choices.forEach(function (id, i) {
        var info = G.passiveInfo(id, B, sim.clsId), lvl = sim.player.passives[id] || 0, col = G.PASSIVE_COLOR[info.rarity];
        var cx = row ? m.x + 8 + i * (cw + gap) : m.x + 8, cy = row ? m.y + 40 : m.y + 40 + i * (ch + gap);
        var bg = m.panel(cx, cy, cw, ch, 'btn', 1);
        if (row) {
          m.image(cx + cw / 2, cy + 14, 'p_' + id);
          UI.centerX(m.text(0, cy + 25, info.name, col), cx + cw / 2);
          UI.centerX(m.text(0, cy + 36, G.PASSIVE_RARITY[info.rarity] + '  Lv ' + (lvl + 1) + '/' + info.max, 'ui_dim'), cx + cw / 2);
          m.text(cx + 6, cy + 50, info.desc, 'ui_text').setMaxWidth(cw - 12);
          m.text(cx + 5, cy + 5, '' + (i + 1), 'ui_dim');
        } else {
          m.image(cx + 13, cy + 14, 'p_' + id);
          m.text(cx + 26, cy + 5, info.name, col);
          m.text(cx + 26, cy + 15, G.PASSIVE_RARITY[info.rarity] + '  Lv ' + (lvl + 1) + '/' + info.max, 'ui_dim');
          m.text(cx + 26, cy + 26, info.desc, 'ui_text').setMaxWidth(cw - 32);
        }
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', function () { bg.setFrame('btn_hot'); });
        bg.on('pointerout', function () { bg.setFrame('btn'); });
        bg.on('pointerdown', function () { self.pickLevel(i); });
        UI.hit('card_' + i, cx, cy, cw, ch);
      });
      this.botWait = this.game_.speed > 4 ? 1 : 30;
      G.screen = 'levelup';
    },
    pickLevel: function (i) {
      var sim = this.game_.sim;
      if (!this.level || sim.state !== 'levelup' || !sim.choices[i]) return;
      this.level.destroy(); this.level = null;
      G.screen = 'game';
      sim.choosePassive(i);            // may emit another 'levelup', handled next frame
    },

    // --------------------------------------------------------------- refresh
    refresh: function () {
      var sim = this.game_.sim, p = sim.player, L = this.last, X = UI.PAD, i, O = this.obj;
      var hp = Math.ceil(p.hp), key = hp + '/' + p.maxHp;
      if (L.hp !== key) {
        L.hp = key;
        this.hpFill.setDisplaySize(Math.max(0.01, Math.round(66 * Math.max(0, p.hp) / p.maxHp)), 9);
        this.hpText.setText(key);
        UI.centerX(this.hpText, X + 15 + 33);
      }
      if (L.lv !== p.level) { L.lv = p.level; this.lvText.setText('LV ' + p.level); }
      var xp = Math.round(44 * Math.min(1, p.exp / p.expNext));
      if (L.xp !== xp) { L.xp = xp; this.xpFill.setDisplaySize(Math.max(0.01, xp), 3); }

      var fp = sim.fissureProgress(), obj = sim.objective();
      var okey = obj + '|' + fp.states.join(',') + '|' + sim.phase + '|' + sim.roomIndex + '|' + sim.loops;
      if (L.obj !== okey) {
        L.obj = okey;
        this.objText.setText(obj);
        var showBar = sim.phase === 'super', n = fp.total + 1, pipsW = fp.total * 8 + 10, rowW = showBar ? 72 : pipsW;
        var room = sim.testRoom >= 0 ? 'Test #' + (sim.loops + 1) : 'Room ' + (sim.roomIndex + 1) + '/' + sim.B.run.rooms;
        this.roomText.setText(room);
        var w = Math.min(O.w, Math.max(this.objText.width, rowW + this.roomText.width + 8) + 14), x0 = O.x + Math.round((O.w - w) / 2);
        // centre on the screen when the free area allows it
        var mid = Math.round((G.view.W - w) / 2);
        if (mid >= O.x && mid + w <= O.x + O.w) x0 = mid;
        this.objPlate.setPosition(x0, O.y).setSize(w, 27);
        UI.centerX(this.objText, x0 + w / 2);
        var total = rowW + 8 + this.roomText.width, px = x0 + Math.round((w - total) / 2);
        this.roomText.setPosition(px + rowW + 8, O.y + 16);
        while (this.pips.length < n) this.pips.push(this.L.image(0, 0, 'pip_wait').setOrigin(0, 0));
        for (i = 0; i < this.pips.length; i++) {
          var pip = this.pips[i], st = fp.states[i];
          pip.setVisible(i < n && !showBar);
          if (i >= n) continue;
          var tag = st === 'scar' ? 'done' : (st === 'dormant' ? 'wait' : 'open');
          pip.setFrame((i === n - 1 ? 'pips_' : 'pip_') + tag).setPosition(px + i * 8, O.y + (i === n - 1 ? 15 : 16));
        }
        this.superBarBg.setVisible(showBar).setPosition(px, O.y + 18);
        this.superBar.setVisible(showBar).setPosition(px, O.y + 18);
      }
      if (sim.phase === 'super') this.superBar.setDisplaySize(Math.max(0.01, Math.round(72 * sim.superProgress())), 4);
      this.updatePointer();
      if (this.tPulse) this.tPulse.setAlpha(p.pulseCd > 0 ? 0.35 : 1);
      if (this.tDodge) this.tDodge.setAlpha(p.dodgeCd > 0 ? 0.35 : 1);
    },

    // objective pointer: a blinking marker on the screen edge, only while the objective is off-screen
    updatePointer: function () {
      var gs = this.game_, t = gs.sim.objectiveTarget(), V = G.view, wv = gs.cameras.main.worldView;
      if (!t || gs.sim.state !== 'play') { this.ptr.setVisible(false); return; }
      var x = t.x - wv.x, y = t.y - wv.y, top = this.obj.y + 34, m = 12;
      if (x >= m && x <= V.W - m && y >= top && y <= V.H - m) { this.ptr.setVisible(false); return; }
      var cx = V.W / 2, cy = (top + V.H - m) / 2, dx = x - cx, dy = y - cy;
      var k = Math.min(dx ? (dx > 0 ? V.W - m - cx : cx - m) / Math.abs(dx) : 1e9, dy ? (dy > 0 ? V.H - m - cy : cy - top) / Math.abs(dy) : 1e9);
      this.ptr.setFrame(t.kind === 'chest' ? 'pip_done' : (t.kind === 'exit' ? 'pips_done' : 'pips_open'));
      this.ptr.setPosition(Math.round(cx + dx * k), Math.round(cy + dy * k)).setVisible((gs.frame >> 4) % 4 !== 0);
    },

    update: function () {
      var gs = this.game_, sim = gs.sim;
      this.refresh();
      if (this.toastT > 0) {
        this.toastT--;
        if (this.toastT < 30) this.toast.setAlpha(this.toastT < 15 ? 0.4 : 0.7);
        if (this.toastT === 0) this.toast.setVisible(false);
      }
      if (sim.state === 'levelup' && !this.level) this.openLevel();
      if (this.level && gs.bot && !G.manualLevel && --this.botWait <= 0) this.pickLevel(gs.bot.pickPassive());
      if (this.endT > 0 && --this.endT === 0) G.Panels.openResult(this, sim.state);
    }
  });
})(globalThis.G = globalThis.G || {});
