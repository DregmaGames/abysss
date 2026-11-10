// HUD scene. By default the screen shows only: HP, level, current objective, fissure
// progress and the inventory button, all inside the safe margins. Panels open on top.
(function (G) {
  var UI = G.UI;

  G.HudScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function HudScene() { Phaser.Scene.call(this, { key: 'hud' }); },

    create: function () {
      var self = this, X = UI.SAFE_X, Y = UI.SAFE_Y;
      UI.camera(this);
      G.hud = this;
      this.game_ = G.gameScene;
      this.last = {};
      this.add.image(0, 0, 'atlas', 'vignette').setOrigin(0, 0).setDisplaySize(UI.W, UI.H);

      // HP + level (top-left)
      UI.panel(this, X, Y, 82, 25, 'plate');
      this.add.image(X + 8, Y + 8, 'atlas', 'heart');
      this.bar(X + 15, Y + 4, 42, 7, 'hp_d');
      this.hpFill = this.bar(X + 15, Y + 4, 42, 7, 'hp');
      this.hpText = UI.text(this, X + 60, Y + 4, '');
      this.lvText = UI.text(this, X + 4, Y + 14, '', 'ui_warn');
      this.bar(X + 32, Y + 17, 44, 3, 'xp_d');
      this.xpFill = this.bar(X + 32, Y + 17, 44, 3, 'xp');

      // objective + fissure progress (top-centre)
      this.objPlate = UI.panel(this, 0, Y, 100, 25, 'plate');
      this.objText = UI.text(this, 0, Y + 4, '');
      this.pips = [];
      this.superBarBg = this.bar(0, Y + 16, 60, 4, 'wf1');
      this.superBar = this.bar(0, Y + 16, 60, 4, 'scar_edge');

      // inventory button (top-right)
      this.invBtn = UI.button(this, UI.W - X - 24, Y, 24, 20, '', function () { self.toggleInventory(); });
      this.invIcon = this.add.image(UI.W - X - 12, Y + 10, 'atlas', 'i_bag');
      this.invBadge = UI.text(this, UI.W - X - 7, Y - 2, '!', 'ui_warn').setVisible(false);

      // transient toast (pickups, bag full): fades out, not part of the resting HUD
      this.toast = UI.text(this, 0, UI.H - Y - 24, '').setVisible(false);
      this.toastT = 0;

      var kb = this.input.keyboard;
      kb.on('keydown-I', function () { self.toggleInventory(); });
      kb.on('keydown-TAB', function (e) { e.preventDefault(); self.toggleInventory(); });
      kb.on('keydown-ESC', function () { if (G.Panels && G.Panels.isOpen()) G.Panels.close(); else if (!self.level && G.Panels) G.Panels.openSettings(self); });
      ['ONE', 'TWO', 'THREE'].forEach(function (k, i) { kb.on('keydown-' + k, function () { self.pickLevel(i); }); });
      this.events.once('shutdown', function () { G.hud = null; if (G.Panels) G.Panels.close(true); G.paused = false; });
      this.botWait = 0; this.endT = -1;
      this.refresh(true);
    },

    bar: function (x, y, w, h, color) {
      return this.add.image(x, y, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(w, h).setTint(UI.hex(color));
    },

    toggleInventory: function () {
      if (!G.Panels || this.level) return;
      if (G.Panels.isOpen()) { G.Panels.close(); return; }
      var st = this.game_.sim.state;
      if (st === 'dead' || st === 'won') return;
      this.invBadge.setVisible(false);
      G.Panels.openInventory(this);
    },

    say: function (text, color) {
      this.toast.setText(text).setTint(UI.hex(color || 'ui_text')).setVisible(true).setAlpha(1);
      this.toast.x = Math.round((UI.W - this.toast.width) / 2);
      this.toastT = 150;
    },

    onEvent: function (e) {
      if (e.t === 'pickup') {
        if (e.item) { this.say(UI.RARITY_NAME[e.item.rarity] + ' ' + e.item.name, UI.RARITY[e.item.rarity]); this.invBadge.setVisible(true); }
        else this.say('Tome of power', 'violet_l');
      } else if (e.t === 'msg') this.say(e.text, 'ui_bad');
      else if (e.t === 'levelup') this.openLevel();
      else if (e.t === 'dead' || e.t === 'won') this.endT = 50;
      else if (e.t === 'room') this.last = {};
    },

    // ------------------------------------------------------- level-up choice
    openLevel: function () {
      var sim = this.game_.sim, self = this, B = sim.B;
      if (this.level) this.level.destroy();
      if (G.Panels && G.Panels.isOpen()) G.Panels.close();
      var m = this.level = UI.modal(this, 300, 130, null), n = sim.choices.length, cw = 92, gap = 6;
      var head = m.text(0, 7, sim.choiceTome ? 'TOME OF POWER' : 'LEVEL ' + sim.player.level, 'ui_warn', true);
      head.x = Math.round((UI.W - head.width) / 2);
      var sub = m.text(0, 26, 'Choose one passive  (click or press 1-' + n + ')', 'ui_dim');
      sub.x = Math.round((UI.W - sub.width) / 2);
      var x0 = Math.round((300 - (n * cw + (n - 1) * gap)) / 2);
      this.cards = [];
      sim.choices.forEach(function (id, i) {
        var info = G.passiveInfo(id, B), lvl = sim.player.passives[id] || 0, cx = x0 + i * (cw + gap), col = G.PASSIVE_COLOR[info.rarity];
        var bg = UI.panel(self, m.x + cx, m.y + 38, cw, 86, 'btn');
        m.c.add(bg);
        m.image(cx + cw / 2, 38 + 14, 'p_' + id);
        var name = m.text(cx + 5, 38 + 25, info.name, col);
        name.x = m.x + cx + Math.round((cw - name.width) / 2);
        var rar = m.text(cx + 5, 38 + 35, G.PASSIVE_RARITY[info.rarity] + '   Lv ' + (lvl + 1) + '/' + info.max, 'ui_dim');
        rar.x = m.x + cx + Math.round((cw - rar.width) / 2);
        var desc = m.text(cx + 6, 38 + 49, info.desc, 'ui_text');
        desc.setMaxWidth(cw - 12);
        m.text(cx + 4, 38 + 4, '' + (i + 1), 'ui_dim');
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', function () { bg.setFrame('btn_hot'); });
        bg.on('pointerout', function () { bg.setFrame('btn'); });
        bg.on('pointerdown', function () { self.pickLevel(i); });
        self.cards.push(bg);
        if (G.Panels) G.Panels.hits['card_' + i] = { x: (m.x + cx + cw / 2) * UI.S, y: (m.y + 38 + 43) * UI.S };
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
    refresh: function (force) {
      var sim = this.game_.sim, p = sim.player, L = this.last, X = UI.SAFE_X, Y = UI.SAFE_Y, i;
      var hp = Math.ceil(p.hp), key = hp + '/' + p.maxHp;
      if (L.hp !== key) {
        L.hp = key;
        this.hpFill.setDisplaySize(Math.max(0.01, Math.round(42 * Math.max(0, p.hp) / p.maxHp)), 7);
        this.hpText.setText('' + hp).setTint(UI.hex(p.hp < p.maxHp * 0.3 ? 'ui_bad' : 'ui_text'));
      }
      if (L.lv !== p.level) { L.lv = p.level; this.lvText.setText('LV ' + p.level); }
      var xp = Math.round(44 * Math.min(1, p.exp / p.expNext));
      if (L.xp !== xp) { L.xp = xp; this.xpFill.setDisplaySize(Math.max(0.01, xp), 3); }

      var fp = sim.fissureProgress(), obj = sim.objective();
      var okey = obj + '|' + fp.states.join(',') + '|' + sim.phase;
      if (L.obj !== okey) {
        L.obj = okey;
        this.objText.setText(obj);
        var showBar = sim.phase === 'super', n = fp.total + 1, rowW = showBar ? 60 : fp.total * 9 + 11;
        var w = Math.max(this.objText.width, rowW) + 16, x0 = Math.round((UI.W - w) / 2);
        // keep clear of the HP plate on the left and the inventory button on the right
        x0 = Math.max(X + 86, Math.min(UI.W - X - 28 - w, x0));
        this.objPlate.setPosition(x0, Y).setSize(w, 25);
        this.objText.setPosition(x0 + Math.round((w - this.objText.width) / 2), Y + 4);
        while (this.pips.length < n) this.pips.push(this.add.image(0, 0, 'atlas', 'pip_wait').setOrigin(0, 0));
        var px = x0 + Math.round((w - (fp.total * 9 + 11)) / 2);
        for (i = 0; i < this.pips.length; i++) {
          var pip = this.pips[i], st = fp.states[i];
          pip.setVisible(i < n && !showBar);
          if (i >= n) continue;
          var tag = st === 'scar' ? 'done' : (st === 'dormant' ? 'wait' : 'open');
          pip.setFrame((i === n - 1 ? 'pips_' : 'pip_') + tag).setPosition(px + i * 9, Y + (i === n - 1 ? 12 : 13));
        }
        this.superBarBg.setVisible(showBar).setPosition(x0 + Math.round((w - 60) / 2), Y + 16);
        this.superBar.setVisible(showBar).setPosition(x0 + Math.round((w - 60) / 2), Y + 16);
      }
      if (sim.phase === 'super') this.superBar.setDisplaySize(Math.max(0.01, Math.round(60 * sim.superProgress())), 4);
    },

    update: function () {
      var gs = this.game_, sim = gs.sim;
      this.refresh(false);
      if (this.toastT > 0) {
        this.toastT--;
        if (this.toastT < 30) this.toast.setAlpha(this.toastT < 15 ? 0.4 : 0.7);
        if (this.toastT === 0) this.toast.setVisible(false);
      }
      if (sim.state === 'levelup' && !this.level) this.openLevel();
      if (this.level && gs.bot && !G.manualLevel && --this.botWait <= 0) this.pickLevel(gs.bot.pickPassive());
      if (this.endT > 0 && --this.endT === 0 && G.Panels) G.Panels.openResult(this, sim.state);
    }
  });
})(globalThis.G = globalThis.G || {});
