// Riftscar - the main menu (2026-11-14): PLAY (-> hero choice -> the city), SETTINGS, CREDITS, QUIT, and "M" top right for the old
// title screen (now the developers' menu: seed, test room, daily, tutorial). The background is the user's Grok scene (`menu_bg` in
// the HD atlas) when it exists, else the dim generated room of the title (scene 'backdrop'); embers rise over it.
(function () {
  var UI = G.UI;

  G.MenuScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function MenuScene() { Phaser.Scene.call(this, { key: 'menu' }); },
    create: function () {
      var self = this;
      G.screen = 'menu';
      G.hud = null; G.gameScene = null; G.paused = false; G.daily = null; G.tutorial = false;
      if (G.runSeed == null) G.runSeed = G.params.has('seed') ? (parseInt(G.params.get('seed'), 10) >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) % 1000000;
      if (G.cls == null) G.cls = G.classDef(G.BAL, G.params.get('class') || (G.save && G.save.settings.cls)).id;
      this.hasBg = this.textures.exists('hd') && this.textures.get('hd').has('menu_bg');
      if (!this.hasBg) this.scene.launch('backdrop');
      this.scene.bringToTop();
      this.page = 'main';
      this.L = null; this.embers = [];
      this.build();
      this.game.events.on('viewchange', this.onView, this);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.onView, self); });
      this.input.keyboard.on('keydown-ESC', function () { if (G.Panels.isOpen()) G.Panels.close(); else if (self.page !== 'main') { self.page = 'main'; self.build(); } });
      this.input.keyboard.on('keydown-ENTER', function () { if (G.Panels.isOpen()) return; if (self.page === 'main') self.go('heroes'); else self.pick(G.cls); });
      G.ready = true;
    },
    onView: function () { this.build(); G.Panels.relayout(this); },
    go: function (page) { if (G.Panels.isOpen()) return; this.page = page; this.build(); },
    build: function () {
      var V = G.view;
      UI.camera(this);
      if (this.L) this.L.destroy();
      this.L = UI.layer(this, 100);
      this.embers.forEach(function (e) { e.img.destroy(); }); this.embers = [];
      // the background: the Grok scene, covering the view (cropped, not stretched), then a dark gradient at the bottom for the text
      if (this.hasBg) {
        var bg = this.add.image(V.W / 2, V.H / 2, 'hd', 'menu_bg').setOrigin(0.5, 0.5), fr = bg.frame;
        bg.setScale(Math.max(V.W / fr.width, V.H / fr.height)); bg._dz = -10; this.L.add(bg);
      }
      var dim = this.add.image(0, 0, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(V.W, V.H).setTint(UI.hex('void')).setAlpha(this.hasBg ? 0.25 : 0.5);
      dim._dz = -9; this.L.add(dim);
      for (var i = 0; i < 26; i++) this.embers.push(this.ember(true));
      if (this.page === 'heroes') this.buildHeroes(); else this.buildMain();
    },
    ember: function (anywhere) {
      var V = G.view, e = { img: this.add.image(0, 0, 'atlas', 'px').setBlendMode(Phaser.BlendModes.ADD).setDepth(this.L.depth - 5) };
      e.x = Math.random() * V.W; e.y = anywhere ? Math.random() * V.H : V.H + 4; e.vy = -(8 + Math.random() * 18); e.vx = (Math.random() - 0.5) * 6;
      e.life = 4 + Math.random() * 5; e.t = anywhere ? Math.random() * e.life : 0;
      e.img.setTint(UI.hex(Math.random() < 0.5 ? 'em3' : 'em2'));
      return e;
    },
    logo: function (y, maxH) {
      var L = this.L, V = G.view, cx = Math.round(V.W / 2);
      if (this.textures.get('hd').has('logo_hd')) {
        var lh = Math.min(85, maxH, Math.round((V.W - 16) * 85 / 221));
        var g = this.add.image(cx, y + lh * 0.55, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('em2')).setAlpha(0.28).setScale(lh / 14, lh / 36);
        g._dz = -5; L.add(g); this.logoGlow = g;
        var li = this.add.image(cx, y, 'hd', 'logo_hd').setOrigin(0.5, 0).setScale(lh / 85 * 0.5); li._dz = 1; L.add(li);
        return y + lh;
      }
      L.image(cx, y + 15, 'logo'); return y + 36;
    },
    buildMain: function () {
      var self = this, L = this.L, V = G.view, cx = Math.round(V.W / 2);
      var y = this.logo(V.H >= 300 ? Math.round(V.H * 0.1) : 6, Math.max(40, V.H - 150));
      y += V.H >= 300 ? 16 : 8;
      var bw = Math.min(150, V.W - 40), bh = V.H >= 230 ? 24 : 20, gap = V.H >= 230 ? 8 : 5;
      L.button(Math.round(cx - bw / 2), y, bw, bh + 2, G.t('menu.play'), function () { self.go('heroes'); }, { name: 'menu_play', main: true });
      y += bh + 2 + gap;
      [['menu.settings', 'menu_settings', function () { if (!G.Panels.isOpen()) G.Panels.openSettings(self); }],
       ['menu.credits', 'menu_credits', function () { self.credits(); }],
       ['menu.quit', 'menu_quit', function () { self.quit(); }]].forEach(function (b) {
        L.button(Math.round(cx - bw / 2), y, bw, bh, G.t(b[0]), b[2], { name: b[1], bold: true });
        y += bh + gap;
      });
      // M: the developers' menu (the old title screen: seed, test room, daily, tutorial, class)
      L.button(V.W - 22, 4, 18, 18, 'M', function () { if (G.Panels.isOpen()) return; self.leave(); self.scene.start('title'); }, { name: 'menu_dev', bold: true });
      var ver = L.text(4, V.H - 10, 'Riftscar', 'ui_dim'); ver.setAlpha(0.5);
    },
    // the hero choice: the three classes side by side (stacked cards when the view is narrow)
    buildHeroes: function () {
      var self = this, L = this.L, V = G.view, cx = Math.round(V.W / 2), ids = G.BAL.classOrder || Object.keys(G.BAL.classes);
      var head = L.text(0, 8, G.t('menu.choose'), 'gold', 'bold'); UI.centerX(head, cx);
      L.button(4, 4, 46, 18, G.t('menu.back'), function () { self.go('main'); }, { name: 'menu_back', bold: true });
      var n = ids.length, gap = 6, cw = Math.min(120, Math.floor((V.W - 12 - gap * (n - 1)) / n)), top = 26, ch = Math.min(V.H - top - 6, 220);
      var x0 = Math.round(cx - (cw * n + gap * (n - 1)) / 2);
      this.ports = [];
      ids.forEach(function (id, i) {
        var x = x0 + i * (cw + gap), sel = id === G.cls;
        L.panel(x, top, cw, ch, 'panel', 0.2);
        // portrait: the class's HD idle frames, animated (walk in place when chosen)
        var pbH = Math.min(70, Math.round(ch * 0.36));
        L.panel(x + 5, top + 5, cw - 10, pbH, 'inset', 0.4);
        var ent = G.HD.heroEnt(id, G.gearOf(G.save, id).equipped), E = G.ANIM.ent[ent], k = Math.min(1, (pbH - 6) / 46);
        var pi = self.add.image(x + cw / 2, top + 5 + pbH - 3, 'hd', E.idle.frames[0]).setScale(k); pi._dz = 2; L.add(pi);
        self.ports.push({ img: pi, E: E, id: id });
        var ny = top + pbH + 9;
        var nm = L.text(0, ny, G.classLabel(id).toUpperCase(), 'gold', 'bold'); UI.centerX(nm, x + cw / 2);
        var gs = 0, eq = G.gearOf(G.save, id).equipped; Object.keys(eq).forEach(function (s2) { if (eq[s2]) gs += eq[s2].power || 0; });
        var gt = L.text(0, ny + 11, G.t('menu.gear', { gs: Math.round(gs) }), 'ui_dim'); UI.centerX(gt, x + cw / 2);
        var by = top + ch - 24;
        var ds = L.text(x + 6, ny + 23, G.t('cdesc.' + id), 'ui_text').setMaxWidth(cw - 12).setCenterAlign(); UI.centerX(ds, x + cw / 2);
        if (ds.y + ds.height > by - 2) ds.setVisible(false);      // no room: the card keeps the name, the picture and the button
        L.button(x + 6, by, cw - 12, 18, G.t('menu.pick'), function () { self.pick(id); }, { name: 'pick_' + id, main: sel, bold: true });
      });
    },
    pick: function (id) {
      if (G.Panels.isOpen()) return;
      G.cls = G.classDef(G.BAL, id).id;
      if (G.save) { G.save.settings.cls = G.cls; G.storeSave(G.save); }
      if (G.Tut.forced()) { if (this.input.activePointer.wasTouch) G.touch = true; this.leave(); G.Tut.launch(); return; }      // the very first launch: tutorial first
      G.testRoom = false;
      this.leave(); this.scene.start('city');
    },
    leave: function () { this.scene.stop('backdrop'); this.embers.forEach(function (e) { e.img.destroy(); }); this.embers = []; },
    credits: function () {
      if (G.Panels.isOpen()) return;
      var self = this, V = G.view, m = UI.modal(this, 230, 150, G.t('menu.creditsTitle'));
      var t = m.text(m.x + 8, m.y + 22, G.t('menu.creditsBody').split('|').join('\n'), 'ui_text').setMaxWidth(m.w - 16);      // | = a line break in the text tables
      m.button(m.x + m.w - 56, m.y + m.h - 24, 48, 18, 'OK', function () { m.destroy(); self.modal = null; }, { name: 'credits_ok', bold: true });
      this.modal = m;
    },
    quit: function () {
      // a page can only close a window it opened itself; otherwise a short note (an app build can exit here)
      try { window.close(); } catch (e) { /* not allowed */ }
      if (this.quitNote) this.quitNote.destroy();
      var V = G.view, t = UI.text(this, 0, V.H - 24, G.t('menu.quitMsg'), 'ui_warn').setDepth(3000);
      UI.centerX(t, Math.round(V.W / 2)); this.quitNote = t;
      this.time.delayedCall(3000, function () { if (t.active) t.destroy(); });
    },
    update: function (time, dms) {
      var dt = Math.min(0.05, dms / 1000), V = G.view, self = this;
      this.embers.forEach(function (e, i) {
        e.t += dt; if (e.t >= e.life) { e.img.destroy(); self.embers[i] = self.ember(false); return; }
        e.x += e.vx * dt; e.y += e.vy * dt; var u = e.t / e.life;
        e.img.setPosition(Math.round(e.x), Math.round(e.y)).setAlpha(Math.min(1, u * 4) * (1 - u));
      });
      if (this.logoGlow) this.logoGlow.setAlpha(0.24 + 0.06 * Math.sin(time / 700));
      if (this.ports) this.ports.forEach(function (p) {
        var fr = p.id === G.cls ? p.E.walk.frames : p.E.idle.frames, f = fr[Math.floor(time / 130) % fr.length];
        if (p.img.active && p.img.frame.name !== f) p.img.setFrame(f, false, false);
      });
    }
  });
})();
