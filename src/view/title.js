// Title screen: logo, difficulty tier (gated by gear score), run seed, start.
(function (G) {
  var UI = G.UI;
  var ROMAN = ['I', 'II', 'III'];
  G.TitleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function TitleScene() { Phaser.Scene.call(this, { key: 'title' }); },
    create: function () {
      var self = this;
      G.screen = 'title';
      G.hud = null; G.gameScene = null; G.paused = false;
      if (G.runSeed == null) G.runSeed = G.params.has('seed') ? (parseInt(G.params.get('seed'), 10) >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) % 1000000;
      if (G.tier == null) G.tier = 0;
      this.scene.launch('backdrop');
      this.scene.bringToTop();
      this.L = null;
      this.build();
      this.game.events.on('viewchange', this.onView, this);
      this.input.keyboard.on('keydown-ESC', function () { if (G.Panels.isOpen()) G.Panels.close(); });
      this.input.keyboard.on('keydown-ENTER', function () { self.start(); });
      this.input.keyboard.on('keydown-I', function () { if (G.Panels.isOpen()) G.Panels.close(); else G.Panels.openInventory(self); });
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.onView, self); G.Panels.close(true); });
      if (G.openGearOnTitle) { G.openGearOnTitle = false; G.Panels.openInventory(this); }
      G.ready = true;
    },
    onView: function () { this.build(); G.Panels.relayout(this); },
    build: function () {
      var self = this, V = G.view, cx = Math.round(V.W / 2), tall = V.H >= 300;
      UI.camera(this);
      if (this.L) this.L.destroy();
      var L = this.L = UI.layer(this, 100);
      var dim = this.add.image(0, 0, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(V.W, V.H).setTint(UI.hex('void')).setAlpha(0.5);
      dim._dz = -60; L.add(dim);
      var vg = this.add.image(0, 0, UI.vignette(this)).setOrigin(0, 0);
      vg._dz = -50; L.add(vg);
      var y = tall ? Math.round(V.H * 0.16) : 12;
      if (V.W >= 204) L.image(cx, y + 15, 'logo');
      else UI.centerX(L.text(0, y + 6, 'RIFTSCAR', 'em3', true), cx);
      y += 36;
      UI.centerX(L.text(0, y, 'Seal the rifts. Keep what you find.', 'ui_dim'), cx);
      y += tall ? 26 : 16;
      this.btnStart = L.button(cx - 64, y, 128, 24, 'ENTER THE RIFT', function () { self.start(); }, { name: 'start', color: 'ui_warn' });
      y += tall ? 36 : 29;
      L.button(cx - 64, y, 22, 20, '', function () { self.setTier(G.tier - 1); }, { icon: 'arrow_l', name: 'tier_l' });
      L.button(cx + 42, y, 22, 20, '', function () { self.setTier(G.tier + 1); }, { icon: 'arrow_r', name: 'tier_r' });
      this.tierText = L.text(0, y + 6, '');
      y += 25;
      this.tierInfo = L.text(0, y, '', 'ui_dim');
      y += tall ? 22 : 15;
      this.seedText = L.text(0, y + 5, '', 'ui_dim');
      this.btnSeed = L.button(cx + 10, y, 54, 18, 'REROLL', function () { G.runSeed = Math.floor(Math.random() * 1000000); self.refresh(); }, { name: 'reroll' });
      y += tall ? 34 : 24;
      L.button(cx - 76, y, 74, 20, 'EQUIPMENT', function () { if (!G.Panels.isOpen()) G.Panels.openInventory(self); }, { name: 'title_gear' });
      L.button(cx + 2, y, 74, 20, 'SETTINGS', function () { if (!G.Panels.isOpen()) G.Panels.openSettings(self); }, { name: 'title_settings' });
      y += tall ? 28 : 24;
      // practice: one room with the crack network, restarted on every clear (also ?scene=game&room=test)
      L.button(cx - 76, y, 152, 20, 'TEST ROOM (PRACTICE)', function () { if (self.input.activePointer.wasTouch) G.touch = true; self.start(true); }, { name: 'title_test', color: 'ui_good' });
      y += tall ? 28 : 25;
      var help = G.touch ? ['Drag to move.  Buttons: dodge, pulse.'] : (V.W >= 300 ? ['WASD move    SPACE dodge    Q pulse    I inventory'] : ['WASD move   SPACE dodge', 'Q pulse   I inventory']);
      help.forEach(function (line, i) { if (y + i * 10 < V.H - 12) UI.centerX(L.text(0, y + i * 10, line, 'ui_dim'), cx); });
      this.refresh();
    },
    gearScore: function () { return G.gearScore(G.save.gear); },
    setTier: function (t) {
      G.tier = Math.max(0, Math.min(G.BAL.run.tierGear.length - 1, t));
      this.refresh();
    },
    refresh: function () {
      var need = G.BAL.run.tierGear[G.tier], gs = this.gearScore(), locked = gs < need, cx = Math.round(G.view.W / 2);
      this.tierText.setText('TIER ' + ROMAN[G.tier]).setTint(UI.hex(locked ? 'ui_bad' : 'ui_warn'));
      UI.centerX(this.tierText, cx);
      this.tierInfo.setText(locked ? 'Locked: needs gear score ' + need + ' (you: ' + gs + ')' : 'Gear score ' + gs + '   Monsters x' + (G.BAL.run.tierMult[G.tier] * (1 + G.BAL.run.gearK * gs)).toFixed(2));
      UI.centerX(this.tierInfo, cx);
      this.seedText.setText('Seed ' + G.runSeed);
      this.seedText.x = cx - 64;
      this.btnStart.setEnabled(!locked);
    },
    start: function (test) {
      if (!test && this.gearScore() < G.BAL.run.tierGear[G.tier]) return;
      if (G.Panels.isOpen()) return;
      G.testRoom = !!test;
      this.scene.stop('backdrop'); this.scene.start('game');
    },
    update: function () {}
  });

  // a real generated room, drawn dim under the title
  G.BackdropScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BackdropScene() { Phaser.Scene.call(this, { key: 'backdrop' }); },
    create: function () {
      var self = this;
      this.room = G.genRoom(7, 1, G.BAL);
      this.roomView = new G.RoomView(this, this.room);
      // show the room mid-fight: one scar, one open fissure, the super fissure dormant
      this.fake = this.room.fissures.map(function (f, i) {
        return { state: i === 0 ? 'scar' : (i === 1 ? 'open' : 'dormant'), reveal: 1, scarTick: 0 };
      });
      this.frame = 0;
      this.applyView();
      this.game.events.on('viewchange', this.applyView, this);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.applyView, self); self.roomView.destroy(); });
    },
    applyView: function () {
      var f = this.room.fissures[1] || this.room.fissures[0];
      this.cameras.main.setZoom(G.view.S).centerOn(f.x, f.y);
    },
    update: function () { this.frame++; this.roomView.tick(this.frame, this.fake, this.frame); }
  });
})(globalThis.G = globalThis.G || {});
