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
      // 2026-11-14 layout (the user: better buttons and font): logo, a character card (portrait, name, arrows, gear score), the gold
      // ENTER button, one row of secondary buttons, settings as an icon top right, the seed and the controls at the bottom.
      function tw(str, font) { var t = UI.text(self, 0, 0, str, null, font); var w = t.width; t.destroy(); return w; }
      var y = tall ? Math.round(V.H * 0.08) : 4;
      var hdLogo = this.textures.exists('hd') && this.textures.get('hd').has('logo_hd') && G.hdMode && G.hdStyle !== 'lo';
      if (hdLogo) {
        // the user's Grok logo: as big as the screen allows (art px: 85 tall at most; short phone screens get ~46)
        var lh = Math.min(85, Math.max(40, V.H - 150), Math.round((V.W - 16) * 85 / 221)), lk = lh / 85 * 0.5;
        var lg2 = this.add.image(cx, y + lh * 0.55, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('em2')).setAlpha(0.28).setScale(lh / 14, lh / 36);
        lg2._dz = -5; L.add(lg2); this.logoGlow = lg2;
        var li = this.add.image(cx, y, 'hd', 'logo_hd').setOrigin(0.5, 0).setScale(lk); li._dz = 1; L.add(li);
        y += lh - 2;
      } else {
        if (V.W >= 204) {
          var lg = this.add.image(cx, y + 15, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('em2')).setAlpha(0.28).setScale(3.2, 1.1);
          lg._dz = -5; L.add(lg); this.logoGlow = lg;
          L.image(cx, y + 15, 'logo');
        } else UI.centerX(L.text(0, y + 6, 'RIFTSCAR', 'em3', true), cx);
        y += 36;
      }
      var tag = L.text(0, y, G.t('title.tag'), 'ui_dim').setMaxWidth(V.W - 12).setCenterAlign(); UI.centerX(tag, cx); if (tag.height > 10) y += tag.height - 8;
      y += tall ? 18 : 12;
      // the character card
      var cw = Math.min(200, V.W - 16), ch = 54, cx0 = Math.round(cx - cw / 2);
      L.panel(cx0, y, cw, ch, 'panel', 0.2);
      L.panel(cx0 + 6, y + 5, 40, ch - 10, 'inset', 0.4);
      this.portBox = { x: cx0 + 26, y: y + ch - 6 };
      this.port = null;
      var nx = cx0 + 52, nw = cx0 + cw - 6 - nx;
      L.button(nx, y + 6, 16, 16, '', function () { self.setClass(-1); }, { icon: 'arrow_l', name: 'cls_l' });
      L.button(nx + nw - 16, y + 6, 16, 16, '', function () { self.setClass(1); }, { icon: 'arrow_r', name: 'cls_r' });
      this.clsMid = nx + nw / 2;
      this.clsText = L.text(0, y + 10, '', 'gold', 'bold');
      L.bar(nx, y + 26, nw, 1, 'gold_d', 0.6).setAlpha(0.7);
      this.gearInfo = L.text(0, y + 31, '', 'ui_dim');
      this.monInfo = L.text(0, y + 41, '', 'ui_dim');
      y += ch + (tall ? 12 : 8);
      // the call to action
      var ew = Math.max(150, tw(G.t('title.enter'), 'bold') + 30);
      var eg = this.add.image(cx, y + 13, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('gold')).setAlpha(0.18).setScale(2.4, 0.6);
      eg._dz = 0.5; L.add(eg); this.enterGlow = eg;
      this.btnStart = L.button(Math.round(cx - ew / 2), y, ew, 26, G.t('title.enter'), function () { self.start(); }, { name: 'start', color: 'gold', main: true });
      y += tall ? 34 : 30;
      // secondary row: daily, practice, tutorial (stacked two + one when the view is narrow)
      var sec = [[G.t('title.daily'), 'gold', 'title_daily', function () { if (!G.Panels.isOpen()) G.Panels.openDaily(self); }],
        [G.t('title.test'), 'ui_good', 'title_test', function () { if (self.input.activePointer.wasTouch) G.touch = true; self.start(true); }],
        [G.t('title.tutorial'), 'ui_text', 'title_tutorial', function () { if (G.Panels.isOpen()) return; if (self.input.activePointer.wasTouch) G.touch = true; G.Tut.replay(); }]];
      var ws = sec.map(function (b) { return Math.max(60, tw(b[0], 'bold') + 16); }), gap = 6, tot = ws.reduce(function (a, b) { return a + b; }, 0) + gap * 2;
      if (tot <= V.W - 12) {
        var sx = Math.round(cx - tot / 2);
        sec.forEach(function (b, k) { L.button(sx, y, ws[k], 20, b[0], b[3], { name: b[2], color: b[1], bold: true }); sx += ws[k] + gap; });
        y += 26;
      } else {
        var bw2 = Math.max(ws[0], ws[1], ws[2]);
        sec.forEach(function (b, k) { L.button(Math.round(cx - bw2 / 2), y, bw2, 20, b[0], b[3], { name: b[2], color: b[1], bold: true }); y += 24; });
      }
      // settings: an icon, top right
      L.button(V.W - 24, 4, 20, 18, '', function () { if (!G.Panels.isOpen()) G.Panels.openSettings(self); }, { icon: 'i_gear', name: 'title_settings' });
      // this is the developers' menu now (M on the main menu): back to the main menu
      L.button(4, 4, 20, 18, '', function () { if (G.Panels.isOpen()) return; self.scene.stop('backdrop'); self.scene.start('menu'); }, { icon: 'arrow_l', name: 'title_menu' });
      // bottom: the controls (centred), the run seed and its reroll (bottom left, small)
      var by = V.H - 12;
      var sk = G.skillLabel(G.cls).toLowerCase(), sp = { skill: sk }, help = G.touch ? [G.t('title.helpTouch', sp)] : (V.W >= 300 ? [G.t('title.helpKeys', sp)] : [G.t('title.helpKeys1', sp), G.t('title.helpKeys2', sp)]);
      var rt = G.t('title.reroll'), rw = tw(rt) + 10, sw0 = tw(G.t('title.seed', { n: 999999 })), seedW = sw0 + 6 + rw + 6;
      var helpW = Math.max.apply(null, help.map(function (h) { return tw(h); }));
      var helpTop = by - (help.length - 1) * 10, sideBySide = (V.W - helpW) / 2 >= seedW + 8;
      var seedRowY = sideBySide ? by - 4 : helpTop - 20;
      help.forEach(function (line, i) { var hy = by - (help.length - 1 - i) * 10; if (hy > y) UI.centerX(L.text(0, hy, line, 'ui_dim'), cx).setAlpha(0.8); });
      // the seed is a tester's tool: shown only where it has room
      var seedOn = seedRowY >= y + 2;
      this.seedText = L.text(6, seedRowY + 4, G.t('title.seed', { n: 999999 }), 'ui_dim').setAlpha(0.7).setVisible(seedOn);
      this.seedX = 6;
      this.btnSeed = L.button(6 + sw0 + 6, seedRowY, rw, 16, rt, function () { G.runSeed = Math.floor(Math.random() * 1000000); self.refresh(); }, { name: 'reroll', color: 'ui_dim' });
      if (!seedOn) this.btnSeed.setVisible(false);
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
      this.clsText.setText(G.classLabel(G.cls).toUpperCase());
      UI.centerX(this.clsText, Math.round(this.clsMid));
      var gs = this.gearScore(), k = (1 + G.BAL.run.gearK * gs).toFixed(2);
      // "Gear score 31   Monsters x1.14" split on its two parts, one per line on the card
      var parts = G.t('title.gear', { gs: gs, k: k }).split(/\s{2,}/);
      this.gearInfo.setText(parts[0] || ''); UI.centerX(this.gearInfo, Math.round(this.clsMid));
      this.monInfo.setText(parts[1] || ''); UI.centerX(this.monInfo, Math.round(this.clsMid));
      // the portrait: the class's HD idle frame (as drawn in the game), feet on the box's floor
      if (this.port) this.port.destroy();
      var ent = G.HD.heroEnt(G.cls, G.gearOf(G.save, G.cls).equipped), E = G.ANIM.ent[ent], fr = E && E.idle && E.idle.frames[0], pb = this.portBox;
      if (fr && this.textures.exists('hd') && this.textures.get('hd').has(fr)) this.port = this.add.image(pb.x, pb.y, 'hd', fr).setScale(0.8);
      else { var C = G.classDef(G.BAL, G.cls); this.port = this.add.image(pb.x, pb.y, 'atlas', C.sprite.frames + '_0').setOrigin(0.5, 1).setScale(1.5); }
      this.port.setDepth(this.L.depth + 2); this.L.objs.push(this.port);
      this.seedText.setText(G.t('title.seed', { n: G.runSeed }));
      this.seedText.x = this.seedX;
    },
    start: function (test) {
      if (G.Panels.isOpen()) return;
      if (!test && G.Tut.forced()) { if (this.input.activePointer.wasTouch) G.touch = true; G.Tut.launch(); return; }      // the very first launch: the tutorial room, then the city
      G.testRoom = !!test;
      this.scene.stop('backdrop'); this.scene.start(test ? 'game' : 'city');      // the city is the hub: gear, shops and the portal are there
    },
    update: function (t) {
      if (this.enterGlow) this.enterGlow.setAlpha(0.14 + 0.08 * Math.sin(t / 420));
      if (this.logoGlow) this.logoGlow.setAlpha(0.24 + 0.06 * Math.sin(t / 700));
    }
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
      // centred on a crack, but never past the room's edge: on a big screen the room fills the view (it is centred when it is smaller)
      var f = this.room.fissures[1] || this.room.fissures[0], V = G.view, rw = this.room.w * 16, rh = this.room.h * 16;
      var cx = rw <= V.W ? rw / 2 : Math.max(V.W / 2, Math.min(rw - V.W / 2, f.x)), cy = rh <= V.H ? rh / 2 : Math.max(V.H / 2, Math.min(rh - V.H / 2, f.y));
      this.cameras.main.setZoom(G.view.S).centerOn(Math.round(cx), Math.round(cy));
    },
    update: function () { this.frame++; this.roomView.tick(this.frame, this.fake, this.frame); }
  });
})(globalThis.G = globalThis.G || {});
