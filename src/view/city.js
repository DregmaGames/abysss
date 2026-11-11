// The city (step 8): a small walkable plaza between runs, drawn at the game's one pixel size.
// Title -> class -> city. The Blacksmith (buy, sell, upgrade, scrolls), Don Montoto (stories, identifies the kept bag for free; rescued in room 5 of a run), the Trainer
// (permanent ranks, the Neutral quarter), an empty plot for the Mage quarter, and the portal that starts a run.
// CityScene is the world (camera follows the hero); CityHudScene is the overlay: gold, buttons, the touch stick, panels.
(function (G) {
  var UI = G.UI, T = 16, COLS = 26, ROWS = 15, MW = COLS * T, MH = ROWS * T;
  var SOLID_H = 14;                                   // a stall's counter: the part the hero cannot walk through
  var REACH = 30;                                     // px from the front of a stall to talk to its owner

  // the layout, in px. A stall's (x, y) is the bottom centre of its sprite; the owner stands in front of the counter.
  var SPOTS = [
    { id: 'smith', x: 100, y: 88, frame: 'stall_smith', npc: 'npc_smith', label: 'BLACKSMITH', color: 'ui_warn' },
    { id: 'trainer', x: 208, y: 88, frame: 'stall_trainer', npc: 'npc_trainer', label: 'TRAINER', color: 'ui_good' },
    { id: 'montoto', x: 316, y: 88, frame: 'stall_montoto', npc: 'npc_montoto', label: G.montotoText('name'), color: 'tome2' }
  ];
  var PLOT = { x: 100, y: 186, w: 48, h: 32 };         // the Mage quarter: a fenced empty plot with a sign
  var SIGN = { x: 144, y: 184 };
  var CRATES = [[304, 200], [320, 202], [312, 188]];
  var PORTAL = { x: 208, y: 222, w: 20, h: 18 };       // walking into it starts a run
  var START = { x: 208, y: 140 };
  var WALKS = [[16, 34, 400, 224]];                    // the walkable box (feet), the plaza inside the walls

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }

  function solids() {
    var out = [];
    SPOTS.forEach(function (s) { out.push([s.x - 22, s.y - SOLID_H, s.x + 22, s.y]); });
    out.push([PLOT.x - 24, PLOT.y - PLOT.h, PLOT.x + 24, PLOT.y]);
    out.push([SIGN.x - 4, SIGN.y - 5, SIGN.x + 4, SIGN.y]);
    CRATES.forEach(function (c) { out.push([c[0] - 6, c[1] - 8, c[0] + 6, c[1]]); });
    return out;
  }

  G.CityScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function CityScene() { Phaser.Scene.call(this, { key: 'city' }); },

    create: function () {
      var self = this, C = this.cls = G.classDef(G.BAL, G.cls);
      G.screen = 'city'; G.city = this; G.gameScene = null; G.hud = null; G.paused = false; G.testRoom = false;
      if (G.runSeed == null) G.runSeed = G.params.has('seed') ? (parseInt(G.params.get('seed'), 10) >>> 0) : 1;
      this.gear = G.gearOf(G.save, G.cls);
      this.solids = solids(); this.labels = [];
      this.controls = new G.Controls(this);
      this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.px = START.x; this.py = START.y; this.face = 1; this.moving = false; this.frame = 0; this.cam = { x: START.x, y: START.y };
      this.entering = false; this.near = null; this.out = { mx: 0, my: 0, dodge: false, pulse: false };
      this.buildWorld();
      this.player = this.add.image(0, 0, 'atlas', C.sprite.frames + '_0').setOrigin(0.42, 1);
      this.shadow = this.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-100);
      this.tag = UI.text(this, 0, 0, 'TALK', 'ui_warn').setDepth(7500).setVisible(false);
      this.cameras.main.setBackgroundColor(UI.hex('void'));
      this.applyView();
      this.game.events.on('viewchange', this.applyView, this);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.applyView, self); if (G.city === self) G.city = null; });
      this.scene.launch('cityhud'); this.scene.bringToTop('cityhud');
      this.cameras.main.fadeIn(250, 7, 6, 11);
      G.ready = true;
    },

    applyView: function () { this.cameras.main.setZoom(G.view.S); this.follow(true); },

    // ---------------------------------------------------------------- the world
    buildWorld: function () {
      var self = this, x, y;
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
        var wall = x === 0 || y <= 1 || x === COLS - 1 || y === ROWS - 1;
        var path = !wall && ((x >= 12 && x <= 13 && y >= 5) || (y >= 7 && y <= 8 && x >= 2 && x <= 23));
        var h = hash(x, y), f = wall ? 'c_wall' : path ? 'c_path' : 'c_floor' + (h % 8 === 0 ? 3 : h % 3);
        this.add.image(x * T, y * T, 'atlas', f).setOrigin(0, 0).setDepth(-1000);
      }
      this.spots = {};
      this.rescued = !!(this.gear.city && this.gear.city.montoto);
      SPOTS.forEach(function (s) {
        var empty = s.id === 'montoto' && !self.rescued, o = { s: s, empty: empty, front: { x: s.x, y: s.y + 14 } };
        o.stall = self.add.image(s.x, s.y, 'atlas', empty ? 'stall_empty' : s.frame).setOrigin(0.5, 1).setDepth(s.y);
        self.label(empty ? 'EMPTY STALL' : s.label, empty ? 'ui_dim' : s.color, s.x, s.y - 52);
        if (!empty) {
          o.npc = self.add.image(s.x, s.y + 12, 'atlas', s.npc + '_0').setOrigin(0.5, 1).setDepth(s.y + 12);
          o.shadow = self.add.image(s.x, s.y + 11, 'atlas', 'shadow_s').setDepth(-100);
        }
        o.stall.setInteractive({ useHandCursor: true });
        if (o.npc) o.npc.setInteractive({ useHandCursor: true });
        var tap = function () { self.tap(o); };
        o.stall.on('pointerdown', tap); if (o.npc) o.npc.on('pointerdown', tap);
        self.spots[s.id] = o;
      });
      // the Mage quarter: nothing built yet
      this.add.image(PLOT.x, PLOT.y, 'atlas', 'plot_fence').setOrigin(0.5, 1).setDepth(PLOT.y);
      this.label('MAGE QUARTER', 'ui_dim', PLOT.x, PLOT.y - PLOT.h - 11);
      this.sign = this.add.image(SIGN.x, SIGN.y, 'atlas', 'c_sign').setOrigin(0.5, 1).setDepth(SIGN.y).setInteractive({ useHandCursor: true });
      this.sign.on('pointerdown', function () { self.say('Mage quarter: nothing built here yet.', 'ui_dim'); });
      this.plotOwner = { s: { id: 'plot' }, front: { x: SIGN.x - 6, y: SIGN.y + 6 } };
      CRATES.forEach(function (c) { self.add.image(c[0], c[1], 'atlas', 'c_crate').setOrigin(0.5, 1).setDepth(c[1]); });
      // the portal
      this.portal = this.add.image(PORTAL.x, PORTAL.y, 'atlas', 'portal_0').setOrigin(0.5, 1).setDepth(PORTAL.y - 20);
      this.add.image(PORTAL.x, PORTAL.y - 16, 'atlas', 'glow').setDepth(-640).setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('rg2')).setAlpha(0.25);
      this.label('THE RIFT', 'ui_good', PORTAL.x, PORTAL.y - 58);
    },

    say: function (text, color) { if (G.cityHud) G.cityHud.say(text, color); },

    // a world label centred on cx: kept fully inside the visible part of the city (clamped to the camera each frame), so a narrow portrait screen never cuts one
    label: function (text, color, cx, y) {
      var t = UI.text(this, 0, 0, text, color).setDepth(6000);
      this.labels = this.labels || [];
      this.labels.push({ t: t, cx: cx, y: y });
      this.placeLabels();
      return t;
    },
    placeLabels: function () {
      var wv = this.cameras.main.worldView, l = wv.x + 3, r = wv.x + wv.width - 3;
      (this.labels || []).forEach(function (b) {
        var w = b.t.width, x = Math.round(Math.max(l, Math.min(r - w, b.cx - w / 2)));
        b.t.setPosition(x, b.y);
      });
    },

    // a tap on a stall or its owner: talk if the hero is in reach
    tap: function (o) {
      if (G.paused || this.entering) return;
      if (this.inReach(o)) this.talk(o); else this.say('Walk closer', 'ui_dim');
    },
    inReach: function (o) { var dx = this.px - o.front.x, dy = this.py - o.front.y; return dx * dx + dy * dy <= REACH * REACH; },
    nearest: function () {
      var best = null, bd = 1e9, self = this;
      Object.keys(this.spots).forEach(function (k) {
        var o = self.spots[k], dx = self.px - o.front.x, dy = self.py - o.front.y, d = dx * dx + dy * dy;
        if (d <= REACH * REACH && d < bd) { bd = d; best = o; }
      });
      var po = this.plotOwner, dx2 = this.px - po.front.x, dy2 = this.py - po.front.y;
      if (!best && dx2 * dx2 + dy2 * dy2 <= 28 * 28) best = po;
      return best;
    },
    talk: function (o) {
      var hud = G.cityHud;
      if (!hud || G.paused) return;
      var id = o.s.id;
      hud.dropStick();
      if (id === 'smith') G.Panels.openShop(hud, false, 'smith');
      else if (id === 'trainer') G.Panels.openShop(hud, false, 'trainer');
      else if (id === 'montoto') {
        if (o.empty) this.say(G.montotoText('emptyStall'), 'ui_warn');
        else G.Panels.openMontoto(hud, false);
      } else this.say('Mage quarter: nothing built here yet.', 'ui_dim');
    },
    // the label and what the button says for the thing in reach
    nearLabel: function (o) { return !o ? null : o.s.id === 'plot' ? 'READ' : o.empty ? 'LOOK' : 'TALK'; },

    // ---------------------------------------------------------------- movement
    blocked: function (x, y) {
      var l = x - 4, r = x + 4, t = y - 5, b = y, i;
      if (l < WALKS[0][0] || r > WALKS[0][2] || t < WALKS[0][1] - 5 || b > WALKS[0][3]) return true;
      for (i = 0; i < this.solids.length; i++) { var s = this.solids[i]; if (r > s[0] && l < s[2] && b > s[1] && t < s[3]) return true; }
      return false;
    },
    move: function (dx, dy) {
      if (!this.blocked(this.px + dx, this.py)) this.px += dx;
      if (!this.blocked(this.px, this.py + dy)) this.py += dy;
    },
    follow: function (snap) {
      var V = G.view, cam = this.cameras.main;
      if (!this.cam) return;
      if (snap) { this.cam.x = this.px; this.cam.y = this.py - 8; } else { this.cam.x += (this.px - this.cam.x) * 0.14; this.cam.y += (this.py - 8 - this.cam.y) * 0.14; }
      var top = 30;                                         // the overlay covers the top strip: let the view scroll that far above the map
      var cx = MW <= V.W ? MW / 2 : Math.max(V.W / 2, Math.min(MW - V.W / 2, this.cam.x));
      var cy = MH + top <= V.H ? (MH - top) / 2 : Math.max(V.H / 2 - top, Math.min(MH - V.H / 2, this.cam.y));
      cam.centerOn(Math.round(cx), Math.round(cy));
      this.placeLabels();
    },

    update: function (time, delta) {
      var o = this.out, C = this.cls, dt = Math.min(delta, 250) / 1000;     // up to 250 ms, moved in small steps so a slow frame never tunnels through a wall
      this.controls.read(o);
      var enter = Phaser.Input.Keyboard.JustDown(this.keyEnter);
      this.frame++;
      if (!G.paused && !this.entering) {
        var mx = o.mx, my = o.my, l = Math.sqrt(mx * mx + my * my);
        this.moving = l > 0.05;
        if (this.moving) {
          if (l > 1) { mx /= l; my /= l; }
          for (var n = Math.max(1, Math.ceil(dt / 0.02)), sp = C.base.speed * dt / n; n > 0; n--) this.move(mx * sp, my * sp);
          if (mx) this.face = mx > 0 ? 1 : -1;
        }
        this.near = this.nearest();
        if ((o.dodge || o.pulse || enter) && this.near) this.talk(this.near);
        // the portal: walking into it starts a run
        if (Math.abs(this.px - PORTAL.x) <= PORTAL.w / 2 && this.py >= PORTAL.y - PORTAL.h && this.py <= PORTAL.y) this.enterRift();
      } else if (G.paused) this.moving = false;
      var walk = this.moving ? ((this.frame >> 3) & 1) : 0;
      this.player.setFrame(C.sprite.frames + '_' + walk).setFlipX(this.face < 0).setOrigin(this.face < 0 ? 0.58 : 0.42, 1).setPosition(Math.round(this.px), Math.round(this.py)).setDepth(this.py);
      this.shadow.setPosition(Math.round(this.px), Math.round(this.py) - 1);
      var self = this;
      Object.keys(this.spots).forEach(function (k) {
        var s = self.spots[k];
        if (s.npc) s.npc.setFrame(s.s.npc + '_' + (((self.frame >> 4) + s.s.x) & 1));
      });
      this.portal.setFrame('portal_' + ((this.frame >> 3) % 3));
      var nl = this.nearLabel(this.near);
      this.tag.setVisible(!!nl && !G.paused);
      if (nl && this.near) this.tag.setText(nl).setPosition(Math.round(this.near.front.x - this.tag.width / 2), Math.round(this.near.front.y - 60 + (this.near.s.id === 'plot' ? 40 : 0) - ((this.frame >> 4) & 1)));
      this.follow(false);
      this.placeLabels();
    },

    enterRift: function () {
      if (this.entering) return;
      this.entering = true;
      var self = this;
      if (G.cityHud) G.cityHud.dropStick();
      this.cameras.main.fadeOut(220, 7, 6, 11);
      this.cameras.main.once('camerafadeoutcomplete', function () {
        G.testRoom = false; G.storeSave(G.save);
        self.scene.stop('cityhud'); self.scene.start('game');
      });
    },

    snapshot: function () {
      var spots = {};
      for (var k in this.spots) spots[k] = { x: this.spots[k].front.x, y: this.spots[k].front.y, empty: !!this.spots[k].empty };
      return { x: Math.round(this.px), y: Math.round(this.py), near: this.near ? this.near.s.id : null, rescued: this.rescued, entering: this.entering, spots: spots, portal: { x: PORTAL.x, y: PORTAL.y }, start: START };
    }
  });

  // ---------------------------------------------------------------- the overlay
  G.CityHudScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function CityHudScene() { Phaser.Scene.call(this, { key: 'cityhud' }); },
    create: function () {
      var self = this;
      G.cityHud = this; this.L = null; this.stickId = null; this.toastT = 0; this.shown = {};
      this.build();
      this.game.events.on('viewchange', this.onView, this);
      var kb = this.input.keyboard;
      kb.on('keydown-I', function () { self.toggleInventory(); });
      kb.on('keydown-TAB', function (e) { e.preventDefault(); self.toggleInventory(); });
      kb.on('keydown-ESC', function () { if (G.Panels.isOpen()) G.Panels.close(); else G.Panels.openSettings(self); });
      // touch: a floating stick on the left 60 % of the screen (the same as in a run)
      this.input.on('pointerdown', function (p, over) {
        if (p.wasTouch && !G.touch) G.touch = true;
        if (!G.touch || over.length || G.paused || self.stickId != null) return;
        var S = G.view.S;
        if (p.x / S > G.view.W * 0.6) return;
        self.stickId = p.id; self.stickX = p.x / S; self.stickY = p.y / S;
        self.stickBase.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
        self.stickKnob.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
      });
      this.input.on('pointermove', function (p) {
        if (p.id !== self.stickId || !G.city) return;
        var S = G.view.S, dx = p.x / S - self.stickX, dy = p.y / S - self.stickY, l = Math.sqrt(dx * dx + dy * dy) || 1, m = Math.min(l, 18);
        self.stickKnob.setPosition(Math.round(self.stickX + dx / l * m), Math.round(self.stickY + dy / l * m));
        var v = G.city.controls.virtual;
        if (l < 5) { v.mx = 0; v.my = 0; } else { v.mx = dx / l; v.my = dy / l; }
      });
      var release = function (p) { if (p.id === self.stickId) self.dropStick(); };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.onView, self); G.cityHud = null; G.Panels.close(true); G.paused = false; });
    },
    dropStick: function () {
      this.stickId = null;
      if (this.stickBase) { this.stickBase.setVisible(false); this.stickKnob.setVisible(false); }
      if (G.city) { G.city.controls.virtual.mx = 0; G.city.controls.virtual.my = 0; }
    },
    onView: function () { this.build(); G.Panels.relayout(this); },
    toggleInventory: function () {
      if (G.Panels.isOpen()) { G.Panels.close(); return; }
      this.dropStick();
      G.Panels.openInventory(this);
    },
    say: function (text, color) {
      this.toast.setText(text).setTint(UI.hex(color || 'ui_text')).setVisible(true).setAlpha(1).setMaxWidth(G.view.W - 16);
      UI.centerX(this.toast, G.view.W / 2);
      this.toastT = 160;
    },
    build: function () {
      var self = this, V = G.view, X = UI.PAD, Y = UI.PAD, g = G.gearOf(G.save, G.cls);
      UI.camera(this);
      if (this.L) this.L.destroy();
      var L = this.L = UI.layer(this, 100);
      var vg = this.add.image(0, 0, UI.vignette(this)).setOrigin(0, 0);
      vg._dz = -50; L.add(vg);
      // class, gold and scrolls (top-left)
      L.panel(X, Y, 96, 27, 'plate');
      L.text(X + 5, Y + 4, G.classDef(G.BAL, G.cls).name.toUpperCase(), 'ui_warn');
      L.image(X + 8, Y + 19, 'i_gold');
      this.goldText = L.text(X + 15, Y + 16, '', 'gold');
      L.image(X + 56, Y + 19, 'i_scroll');
      this.scrollText = L.text(X + 63, Y + 16, '', 'ui_text');
      // buttons (top-right): inventory, settings, title
      L.button(V.W - X - 26, Y, 26, 26, '', function () { self.toggleInventory(); }, { icon: 'i_bag', name: 'inv' });
      L.button(V.W - X - 26, Y + 29, 26, 14, 'SET', function () { if (!G.Panels.isOpen()) { self.dropStick(); G.Panels.openSettings(self); } }, { name: 'city_set' });
      L.button(V.W - X - 26, Y + 46, 26, 14, 'END', function () { if (!G.Panels.isOpen()) { G.Panels.close(true); self.scene.stop('city'); self.scene.stop('cityhud'); self.scene.start('title'); } }, { name: 'city_title' });
      // the talk button: shown when a stall is in reach (a tap on the stall does the same)
      this.talkBtn = L.button(Math.round(V.W / 2 - 30), V.H - 30, 60, 22, 'TALK', function () { if (G.city && G.city.near && !G.paused) G.city.talk(G.city.near); }, { name: 'city_talk', color: 'ui_warn' });
      this.talkBtn.setVisible(false);
      this.toast = L.text(0, V.H - 44, '').setVisible(false);
      this.toast._dz = 4; this.toast.setDepth(L.depth + 4);
      this.stickBase = L.image(0, 0, 'stick_base').setVisible(false);
      this.stickKnob = L.image(0, 0, 'stick_knob', 3).setVisible(false);
      this.stickId = null; this.shown = {};
      this.refresh(g);
    },
    refresh: function (g) {
      this.goldText.setText('' + (g.gold | 0)); this.scrollText.setText('x' + (g.scrolls | 0));
    },
    update: function () {
      var g = G.gearOf(G.save, G.cls), k = (g.gold | 0) + ':' + (g.scrolls | 0);
      if (this.shown.k !== k) { this.shown.k = k; this.refresh(g); }
      var c = G.city, nl = c && !G.paused && !c.entering ? c.nearLabel(c.near) : null;
      if (nl !== this.shown.nl) { this.shown.nl = nl; if (nl) this.talkBtn.setLabel(nl); this.talkBtn.setVisible(!!nl); }
      if (this.toastT > 0 && --this.toastT <= 0) this.toast.setVisible(false);
      else if (this.toastT > 0 && this.toastT < 30) this.toast.setAlpha(this.toastT / 30);
    }
  });
})(globalThis.G = globalThis.G || {});
