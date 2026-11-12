// Title screen: logo, class, gear score and monster scale, run seed, start.
(function (G) {
  var UI = G.UI;
  G.TitleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function TitleScene() { Phaser.Scene.call(this, { key: 'title' }); },
    create: function () {
      var self = this;
      G.screen = 'title';
      G.hud = null; G.gameScene = null; G.paused = false; G.daily = null; G.tutorial = false;
      if (G.runSeed == null) G.runSeed = G.params.has('seed') ? (parseInt(G.params.get('seed'), 10) >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) % 1000000;
      if (G.cls == null) G.cls = G.classDef(G.BAL, G.params.get('class') || (G.save && G.save.settings.cls)).id;
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
      var tag = L.text(0, y, G.t('title.tag'), 'ui_dim').setMaxWidth(V.W - 12); UI.centerX(tag, cx); if (tag.height > 10) y += tag.height - 8;
      y += tall ? 26 : 16;
      this.btnStart = L.button(cx - 64, y, 128, 24, G.t('title.enter'), function () { self.start(); }, { name: 'start', color: 'ui_warn' });
      y += tall ? 30 : 26;
      // class picker: cycles through BAL.classes (one class today)
      L.button(cx - 64, y, 22, 20, '', function () { self.setClass(-1); }, { icon: 'arrow_l', name: 'cls_l' });
      L.button(cx + 42, y, 22, 20, '', function () { self.setClass(1); }, { icon: 'arrow_r', name: 'cls_r' });
      this.clsText = L.text(0, y + 6, '');
      y += tall ? 26 : 22;
      this.gearInfo = L.text(0, y, '', 'ui_dim');
      y += tall ? 22 : 15;
      this.seedText = L.text(0, y + 5, G.t('title.seed', { n: 999999 }), 'ui_dim');
      var rt = G.t('title.reroll'), rw = Math.max(54, rt.length * 6 + 10), seedW = this.seedText.width, rowX = Math.round(cx - (seedW + 8 + rw) / 2);
      this.seedX = rowX;
      this.btnSeed = L.button(rowX + seedW + 8, y, rw, 18, rt, function () { G.runSeed = Math.floor(Math.random() * 1000000); self.refresh(); }, { name: 'reroll' });
      y += tall ? 34 : 24;
      // settings and the daily challenge side by side
      var dt = G.t('title.daily'), st = G.t('title.settings'), dw = Math.max(60, dt.length * 6 + 12), sw = Math.max(60, st.length * 6 + 12), rx = Math.round(cx - (sw + 6 + dw) / 2);
      L.button(rx, y, sw, 20, st, function () { if (!G.Panels.isOpen()) G.Panels.openSettings(self); }, { name: 'title_settings' });
      L.button(rx + sw + 6, y, dw, 20, dt, function () { if (!G.Panels.isOpen()) G.Panels.openDaily(self); }, { name: 'title_daily', color: 'gold' });
      y += tall ? 28 : 24;
      // practice: one room with the crack network, restarted on every clear (also ?scene=game&room=test); beside it the tutorial room
      var pt = G.t('title.test'), tt = G.t('title.tutorial'), pw2 = Math.max(80, pt.length * 6 + 12), tw2 = Math.max(60, tt.length * 6 + 12), px2 = Math.round(cx - (pw2 + 6 + tw2) / 2);
      L.button(px2, y, pw2, 20, pt, function () { if (self.input.activePointer.wasTouch) G.touch = true; self.start(true); }, { name: 'title_test', color: 'ui_good' });
      L.button(px2 + pw2 + 6, y, tw2, 20, tt, function () { if (G.Panels.isOpen()) return; if (self.input.activePointer.wasTouch) G.touch = true; G.Tut.replay(); }, { name: 'title_tutorial', color: 'ui_warn' });
      y += tall ? 28 : 25;
      var sk = G.skillLabel(G.cls).toLowerCase(), sp = { skill: sk }, help = G.touch ? [G.t('title.helpTouch', sp)] : (V.W >= 300 ? [G.t('title.helpKeys', sp)] : [G.t('title.helpKeys1', sp), G.t('title.helpKeys2', sp)]);
      help.forEach(function (line, i) { if (y + i * 10 < V.H - 12) UI.centerX(L.text(0, y + i * 10, line, 'ui_dim'), cx); });
      this.refresh();
    },
    gearScore: function () { return G.gearScore(G.gearOf(G.save, G.cls)); },
    setClass: function (d) {
      var ids = G.classIds(G.BAL), i = ids.indexOf(G.cls);
      G.cls = ids[(i + d + ids.length) % ids.length];
      if (G.save) { G.save.settings.cls = G.cls; G.storeSave(G.save); }   // the choice survives the session
      this.refresh();
    },
    refresh: function () {
      this.clsText.setText(G.classLabel(G.cls).toUpperCase()).setTint(UI.hex('ui_text'));
      UI.centerX(this.clsText, Math.round(G.view.W / 2));
      var gs = this.gearScore(), cx = Math.round(G.view.W / 2);
      this.gearInfo.setText(G.t('title.gear', { gs: gs, k: (1 + G.BAL.run.gearK * gs).toFixed(2) }));
      UI.centerX(this.gearInfo, cx);
      this.seedText.setText(G.t('title.seed', { n: G.runSeed }));
      this.seedText.x = this.seedX;
    },
    start: function (test) {
      if (G.Panels.isOpen()) return;
      if (!test && G.Tut.forced()) { if (this.input.activePointer.wasTouch) G.touch = true; G.Tut.launch(); return; }      // the very first launch: the tutorial room, then the city
      G.testRoom = !!test;
      this.scene.stop('backdrop'); this.scene.start(test ? 'game' : 'city');      // the city is the hub: gear, shops and the portal are there
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
