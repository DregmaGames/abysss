// Title screen: logo, run seed, difficulty tier, start.
(function (G) {
  var UI = G.UI;
  var ROMAN = ['I', 'II', 'III'];
  G.TitleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function TitleScene() { Phaser.Scene.call(this, { key: 'title' }); },
    create: function () {
      var self = this, B = G.BAL;
      UI.camera(this);
      G.screen = 'title';
      if (G.runSeed == null) G.runSeed = G.params.has('seed') ? (parseInt(G.params.get('seed'), 10) >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) % 1000000;
      if (G.tier == null) G.tier = 0;
      // backdrop: a real generated room, drawn by its own scene underneath (world camera)
      this.scene.launch('backdrop');
      this.scene.bringToTop();
      var fix = function (o) { return o.setScrollFactor(0); };
      fix(this.add.image(0, 0, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(UI.W, UI.H).setTint(UI.hex('rift_void')).setAlpha(0.45));
      fix(this.add.image(0, 0, 'atlas', 'vignette').setOrigin(0, 0));
      fix(this.add.image(UI.W / 2, 40, 'atlas', 'logo'));
      var sub = fix(UI.text(this, 0, 62, 'Seal the rifts. Keep what you find.', 'ui_dim'));
      sub.x = Math.round((UI.W - sub.width) / 2);

      var cx = UI.W / 2;
      this.btnStart = UI.button(this, cx - 54, 80, 108, 18, 'ENTER THE RIFT', function () { self.start(); });
      this.btnTierL = UI.button(this, cx - 54, 102, 18, 16, '<', function () { self.setTier(G.tier - 1); });
      this.btnTierR = UI.button(this, cx + 36, 102, 18, 16, '>', function () { self.setTier(G.tier + 1); });
      this.tierText = UI.text(this, 0, 106, '');
      this.tierInfo = UI.text(this, 0, 120, '', 'ui_dim');
      this.seedText = UI.text(this, 0, 136, '', 'ui_dim');
      this.btnSeed = UI.button(this, cx + 36, 132, 46, 16, 'REROLL', function () {
        G.runSeed = Math.floor(Math.random() * 1000000); self.refresh();
      });
      this.btnSettings = UI.button(this, UI.W - UI.SAFE_X - 58, UI.SAFE_Y, 58, 16, 'SETTINGS', function () {
        if (G.Panels) G.Panels.openSettings(self);
      });
      this.btnGear = UI.button(this, UI.SAFE_X, UI.SAFE_Y, 64, 16, 'EQUIPMENT', function () {
        if (G.Panels && !G.Panels.isOpen()) G.Panels.openInventory(self);
      });
      this.input.keyboard.on('keydown-ESC', function () { if (G.Panels && G.Panels.isOpen()) G.Panels.close(); });
      [this.btnStart, this.btnTierL, this.btnTierR, this.btnSeed, this.btnSettings, this.btnGear].forEach(function (b) { fix(b.c); });
      [this.tierText, this.tierInfo, this.seedText].forEach(fix);
      ['WASD move    SPACE dodge    Q pulse', 'I inventory    ESC settings'].forEach(function (line, i) {
        var help = fix(UI.text(self, 0, UI.H - UI.SAFE_Y - 19 + i * 10, line, 'ui_dim'));
        help.x = Math.round((UI.W - help.width) / 2);
      });
      this.input.keyboard.on('keydown-ENTER', function () { self.start(); });
      G.hud = null; G.gameScene = null; G.paused = false;
      this.refresh();
      G.ready = true;
    },
    gearScore: function () { return G.gearScore ? G.gearScore(G.save.gear) : 0; },
    setTier: function (t) {
      G.tier = Math.max(0, Math.min(G.BAL.run.tierGear.length - 1, t));
      this.refresh();
    },
    refresh: function () {
      var need = G.BAL.run.tierGear[G.tier], gs = this.gearScore(), locked = gs < need, cx = UI.W / 2;
      this.tierText.setText('TIER ' + ROMAN[G.tier]).setTint(UI.hex(locked ? 'ui_bad' : 'ui_warn'));
      this.tierText.x = Math.round(cx - this.tierText.width / 2);
      this.tierInfo.setText(locked ? 'Locked: needs gear score ' + need + ' (you have ' + gs + ')' : 'Gear score ' + gs + '   Monsters x' + G.BAL.run.tierMult[G.tier].toFixed(2));
      this.tierInfo.x = Math.round(cx - this.tierInfo.width / 2);
      this.seedText.setText('Seed ' + G.runSeed);
      this.seedText.x = Math.round(cx - 54);
      this.btnStart.setEnabled(!locked);
    },
    start: function () {
      if (G.gearScore && this.gearScore() < G.BAL.run.tierGear[G.tier]) return;
      if (G.Panels && G.Panels.isOpen()) return;
      if (G.GameScene) { this.scene.stop('backdrop'); this.scene.start('game'); }
    },
    update: function () {}
  });

  G.BackdropScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BackdropScene() { Phaser.Scene.call(this, { key: 'backdrop' }); },
    create: function () {
      var room = G.genRoom(7, 1, G.BAL);
      this.roomView = new G.RoomView(this, room);
      this.cameras.main.setZoom(UI.S).centerOn(room.w * 8, room.h * 8 - 8);
      this.frame = 0;
    },
    update: function () { this.roomView.tick(this.frame++); }
  });
})(globalThis.G = globalThis.G || {});
